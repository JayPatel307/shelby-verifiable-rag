# Shelby Source Packs — One‑Day MVP Spec & Starter

A fully‑specified, **one‑day** MVP for a provenance‑first RAG app on Shelby. Paste this into Cursor as your main spec. It includes architecture, file layout, DB schema, REST contracts, and copy‑pasteable code skeletons (server, web, CLI), so Cursor can scaffold and implement end‑to‑end.

---

## TL;DR
- **Goal:** Users upload files/folders → each file is stored on **Shelby** (blob id + sha256). Text is indexed; Q&A answers return **verifiable citations** (blob id + hash + optional byte range). Packs are **private** by default; creators can toggle **public** and appear in **Discover**. Public packs are queryable via `/public_query`.
- **Stack:** TypeScript, **Next.js 15 / App Router** for UI, **Express** API server, **SQLite** via `better-sqlite3`, simple **local vector search** (cosine), **Multer** uploads, `pdf-parse` + `@mozilla/pdfjs-dist` for PDFs, **Tesseract** (optional OCR), and a **Shelby client stub** (single file) you can swap for real SDK.
- **Auth (MVP):** Cookie session with email pseudo‑login (dev‑friendly). All requests carry `x-user-id` (server also trusts session). Good enough for demo; easy to replace with NextAuth/Clerk later.

---

## Monorepo Layout
```
/shelby-packs
  /apps
    /web           # Next.js app (UI)
    /api           # Express server (REST + vector search + file processing)
    /cli           # Tiny Node CLI for folder/zip uploads
  /packages
    /shared        # Shared TS types & utilities
  .env             # root env (optional)
  package.json
  turbo.json       # optional (or remove if not using turborepo)
  README.md
```

If you prefer non-monorepo, keep the same folder names at root.

---

## Environment Variables
Create `.env` files under **/apps/api** and **/apps/web** (the web one only needs `NEXT_PUBLIC_*`).

```
# apps/api/.env
PORT=4000
DATABASE_URL=./data.sqlite
EMBEDDINGS_PROVIDER=openai            # or "local"
OPENAI_API_KEY=sk-...
SHELBY_BASE_URL=http://localhost:4747  # replace w/ real endpoint
SHELBY_WRITE_TOKEN=dev-write-token
MAX_FILE_BYTES=26214400               # 25MB
OCR_ENABLED_DEFAULT=false
CORS_ORIGIN=http://localhost:3000
SESSION_SECRET=use_a_long_random_string

# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## Shared Types (packages/shared/src/types.ts)
```ts
export type Visibility = 'private' | 'public' | 'unlisted';

export interface SourcePack {
  pack_id: string;        // uuid
  owner_user_id: string;  
  title: string;
  summary?: string;
  tags?: string[];
  visibility: Visibility;
  created_at: string;     // ISO
  manifest_blob_id?: string;
}

export interface DocRow {
  doc_id: string;
  pack_id: string;
  path: string;           // original relative path or filename
  mime: string;
  bytes: number;
  sha256: string;
  shelby_blob_id: string; // e.g., "sbly:..."
}

export interface ChunkRow {
  chunk_id: string;
  pack_id: string;
  doc_id: string;
  text: string;
  start_byte: number | null;
  end_byte: number | null;
  embedding: number[];    // JSON array
}

export interface Citation {
  shelby_blob_id: string;
  sha256: string;
  start_byte?: number | null;
  end_byte?: number | null;
  snippet?: string;
}
```

---

## Database Schema (SQLite)
Create `apps/api/src/db/schema.sql` and run once at boot if tables don’t exist.

```sql
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS source_packs (
  pack_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  tags TEXT,                 -- JSON array string
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TEXT DEFAULT (datetime('now')),
  manifest_blob_id TEXT,
  FOREIGN KEY(owner_user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS docs (
  doc_id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL,
  path TEXT,
  mime TEXT,
  bytes INTEGER,
  sha256 TEXT,
  shelby_blob_id TEXT,
  FOREIGN KEY(pack_id) REFERENCES source_packs(pack_id)
);

CREATE TABLE IF NOT EXISTS chunks (
  chunk_id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  text TEXT NOT NULL,
  start_byte INTEGER,
  end_byte INTEGER,
  embedding TEXT NOT NULL,   -- JSON string of number[]
  FOREIGN KEY(pack_id) REFERENCES source_packs(pack_id),
  FOREIGN KEY(doc_id) REFERENCES docs(doc_id)
);

CREATE INDEX IF NOT EXISTS idx_chunks_pack ON chunks(pack_id);
CREATE INDEX IF NOT EXISTS idx_packs_owner ON source_packs(owner_user_id);
```

---

## API Contracts (apps/api)

### Auth model (MVP)
- Dev login endpoint issues a signed cookie and returns `{ user_id }`.
- Requests may also include `x-user-id` header (for CLI). Server validates against a simple allowlist in the session table. (In production swap for NextAuth/Clerk.)

### Endpoints
**POST `/auth/dev-login`** `{ email }` → `{ user_id }`

**POST `/packs`** (multipart)
- fields: `title` (required), `tags` (optional repeated or CSV), `ocr` (`true`/`false`)
- files: `files[]` *or* `archive.zip`
- returns `{ pack_id, files: [{ path, mime, sha256, shelby_blob_id, indexed, chunks }] }`

**PATCH `/packs/:id/visibility`** `{ visibility: 'private'|'public'|'unlisted' }`

**GET `/packs/:id`** → pack metadata + docs summary

**GET `/discover`** `?q=...` → list of public packs (title/tags/summary subset)

**POST `/query`** `{ question, pack_id? }`
- if `pack_id` is omitted → search only requester’s packs
- returns `{ answer, citations: Citation[] }`

**POST `/public_query`** `{ question, pack_id }`
- only if pack is `public`

**GET `/verify/:blob_id`** → `{ ok: boolean, sha256: string }` (re-fetches from Shelby and re-hashes)

---

## Implementation Plan (Server)
Create these files in **/apps/api/src**.

### `index.ts` (Express bootstrap)
```ts
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'path';
import { db, ensureSchema } from './lib/db';
import { requireUser, devLogin } from './lib/auth';
import { handlePacksUpload } from './routes/packs-upload';
import { getPack, setVisibility, discover } from './routes/packs-read';
import { queryPrivate, queryPublic } from './routes/query';
import { verifyBlob } from './routes/verify';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser(process.env.SESSION_SECRET));

ensureSchema();

const upload = multer({ limits: { fileSize: Number(process.env.MAX_FILE_BYTES || 25_000_000) } });

app.post('/auth/dev-login', devLogin);

app.post('/packs', requireUser, upload.any(), handlePacksUpload);
app.get('/packs/:id', getPack);
app.patch('/packs/:id/visibility', requireUser, setVisibility);
app.get('/discover', discover);

app.post('/query', requireUser, queryPrivate);
app.post('/public_query', queryPublic);

app.get('/verify/:blob_id', verifyBlob);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API on :${port}`));
```

### `lib/db.ts`
```ts
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbFile = process.env.DATABASE_URL || './data.sqlite';
export const db = new Database(dbFile);

export function ensureSchema() {
  const sql = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
  db.exec(sql);
}
```

### `lib/auth.ts` (dev‑only auth)
```ts
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { db } from './db';

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const headerUser = req.header('x-user-id');
  const cookieUser = (req as any).signedCookies?.uid;
  const user_id = headerUser || cookieUser;
  if (!user_id) return res.status(401).json({ error: 'unauthorized' });
  // optional: ensure user exists
  const row = db.prepare('SELECT user_id FROM users WHERE user_id=?').get(user_id);
  if (!row) return res.status(401).json({ error: 'unknown user' });
  (req as any).user_id = user_id;
  next();
}

export function devLogin(req: Request, res: Response) {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  let row = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!row) {
    const user_id = randomUUID();
    db.prepare('INSERT INTO users (user_id, email) VALUES (?,?)').run(user_id, email);
    row = { user_id, email };
  }
  res.cookie('uid', row.user_id, { httpOnly: true, signed: true, sameSite: 'lax' });
  res.json({ user_id: row.user_id });
}
```

### `lib/shelby.ts` (client stub)
```ts
import crypto from 'crypto';
import fetch from 'node-fetch';

const BASE = process.env.SHELBY_BASE_URL!;
const TOKEN = process.env.SHELBY_WRITE_TOKEN!;

export async function put(stream: NodeJS.ReadableStream, opts: { sha256?: string, contentType?: string }) {
  // MVP: buffer stream (okay for <=25MB), replace with streaming later
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  const buf = Buffer.concat(chunks);
  const sha256 = opts.sha256 || crypto.createHash('sha256').update(buf).digest('hex');
  const resp = await fetch(`${BASE}/blobs`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': opts.contentType || 'application/octet-stream', 'X-Content-SHA256': sha256 }, body: buf
  });
  if (!resp.ok) throw new Error(`Shelby put failed: ${resp.status}`);
  const json = await resp.json();
  return { blob_id: json.blob_id as string, sha256 };
}

export async function getBlob(blob_id: string): Promise<Buffer> {
  const resp = await fetch(`${BASE}/blobs/${encodeURIComponent(blob_id)}`);
  if (!resp.ok) throw new Error('Shelby get failed');
  const arrayBuf = await resp.arrayBuffer();
  return Buffer.from(arrayBuf);
}
```

### `lib/text.ts` (extract, chunk, embed, cosine)
```ts
import crypto from 'crypto';
import * as pdfParse from 'pdf-parse';
import { createWorker } from 'tesseract.js';

export async function sha256OfBuffer(buf: Buffer) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export async function extractTextFromFile(path: string, mime: string, buf: Buffer, ocr: boolean) {
  if (mime === 'application/pdf') {
    const data = await (pdfParse as any)(buf);
    return String(data.text || '');
  }
  if (mime.startsWith('text/') || mime === 'text/markdown' || mime === 'text/html') {
    return buf.toString('utf8');
  }
  if (ocr && mime.startsWith('image/')) {
    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data } = await worker.recognize(buf);
    await worker.terminate();
    return data.text || '';
  }
  return '';
}

export function chunkText(text: string, maxTokens = 1000, overlap = 200) {
  const words = text.split(/\s+/);
  const window = maxTokens - overlap;
  const out: string[] = [];
  for (let i = 0; i < words.length; i += window) {
    out.push(words.slice(i, i + maxTokens).join(' '));
  }
  return out;
}

export async function embed(text: string): Promise<number[]> {
  if (process.env.EMBEDDINGS_PROVIDER === 'openai') {
    const resp = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text, model: 'text-embedding-3-small' })
    });
    const json = await resp.json();
    return json.data[0].embedding as number[];
  }
  // Local fake embedding (for offline dev) — DO NOT use in prod
  const h = crypto.createHash('sha256').update(text).digest();
  return Array.from(h.slice(0, 256)).map(b => (b - 128) / 128);
}

export function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  const L = Math.min(a.length, b.length);
  for (let i = 0; i < L; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}
```

### `routes/packs-upload.ts`
```ts
import { Request, Response } from 'express';
import { randomUUID, createHash } from 'crypto';
import { db } from '../lib/db';
import { put } from '../lib/shelby';
import { extractTextFromFile, chunkText, embed } from '../lib/text';
import AdmZip from 'adm-zip';
import mime from 'mime-types';

function normalizeTags(raw?: string | string[]) {
  if (!raw) return [] as string[];
  const arr = Array.isArray(raw) ? raw : String(raw).split(',');
  return arr.map(s => s.trim()).filter(Boolean);
}

export async function handlePacksUpload(req: Request, res: Response) {
  const user_id = (req as any).user_id as string;
  const title = String((req.body?.title || '').slice(0, 200));
  if (!title) return res.status(400).json({ error: 'title required' });
  const tags = normalizeTags(req.body?.tags);
  const ocr = String(req.body?.ocr || process.env.OCR_ENABLED_DEFAULT || 'false') === 'true';

  const pack_id = randomUUID();
  db.prepare('INSERT INTO source_packs (pack_id, owner_user_id, title, tags, visibility) VALUES (?,?,?,?,?)')
    .run(pack_id, user_id, title, JSON.stringify(tags), 'private');

  const files: Array<{ path: string, mime: string, buf: Buffer }> = [];

  const fileField = (req.files as any[] | undefined) || [];
  const zip = fileField.find(f => f.fieldname === 'archive.zip');
  if (zip) {
    const z = new AdmZip(zip.buffer);
    for (const entry of z.getEntries()) {
      if (entry.isDirectory) continue;
      const p = entry.entryName.replace(/^\\/+|^\/+/, '');
      const ext = p.split('.').pop() || '';
      const m = mime.lookup(ext) || 'application/octet-stream';
      files.push({ path: p, mime: String(m), buf: entry.getData() });
    }
  } else {
    for (const f of fileField) {
      if (!f || !f.originalname) continue;
      const m = f.mimetype || 'application/octet-stream';
      files.push({ path: f.originalname, mime: m, buf: f.buffer });
    }
  }

  const out: any[] = [];

  for (const f of files) {
    const sha256 = createHash('sha256').update(f.buf).digest('hex');
    const { blob_id } = await put(ReadableFrom(f.buf), { sha256, contentType: f.mime });

    const doc_id = randomUUID();
    db.prepare('INSERT INTO docs (doc_id, pack_id, path, mime, bytes, sha256, shelby_blob_id) VALUES (?,?,?,?,?,?,?)')
      .run(doc_id, pack_id, f.path, f.mime, f.buf.length, sha256, blob_id);

    let indexed = false; let chunkCount = 0;
    const text = await extractTextFromFile(f.path, f.mime, f.buf, ocr);
    if (text && text.trim().length > 0) {
      const chunks = chunkText(text);
      for (const ch of chunks) {
        const emb = await embed(ch);
        db.prepare('INSERT INTO chunks (chunk_id, pack_id, doc_id, text, start_byte, end_byte, embedding) VALUES (?,?,?,?,?,?,?)')
          .run(randomUUID(), pack_id, doc_id, ch, null, null, JSON.stringify(emb));
      }
      indexed = true; chunkCount = chunks.length;
    }

    out.push({ path: f.path, mime: f.mime, sha256, shelby_blob_id: blob_id, indexed, chunks: chunkCount });
  }

  // Optional: write manifest back to Shelby
  const manifest = { title, created_at: new Date().toISOString(), files: out };
  try {
    const buf = Buffer.from(JSON.stringify(manifest, null, 2));
    const { blob_id } = await put(ReadableFrom(buf), { contentType: 'application/json' });
    db.prepare('UPDATE source_packs SET manifest_blob_id=? WHERE pack_id=?').run(blob_id, pack_id);
  } catch (e) { /* non-fatal */ }

  res.json({ pack_id, files: out });
}

function ReadableFrom(buf: Buffer) {
  const { Readable } = require('stream');
  const s = new Readable(); s.push(buf); s.push(null); return s;
}
```

### `routes/packs-read.ts`
```ts
import { Request, Response } from 'express';
import { db } from '../lib/db';

export function getPack(req: Request, res: Response) {
  const id = req.params.id;
  const p = db.prepare('SELECT * FROM source_packs WHERE pack_id=?').get(id);
  if (!p) return res.status(404).json({ error: 'not found' });
  const docs = db.prepare('SELECT path, mime, bytes, sha256, shelby_blob_id FROM docs WHERE pack_id=? LIMIT 1000').all(id);
  res.json({ pack: { ...p, tags: JSON.parse(p.tags || '[]') }, docs });
}

export function setVisibility(req: Request, res: Response) {
  const id = req.params.id; const { visibility } = req.body || {};
  if (!['private','public','unlisted'].includes(visibility)) return res.status(400).json({ error: 'bad visibility' });
  const user_id = (req as any).user_id as string;
  const p = db.prepare('SELECT owner_user_id FROM source_packs WHERE pack_id=?').get(id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (p.owner_user_id !== user_id) return res.status(403).json({ error: 'forbidden' });
  db.prepare('UPDATE source_packs SET visibility=? WHERE pack_id=?').run(visibility, id);
  res.json({ ok: true });
}

export function discover(req: Request, res: Response) {
  const q = String(req.query.q || '').trim().toLowerCase();
  let rows = db.prepare("SELECT pack_id, title, summary, tags, created_at FROM source_packs WHERE visibility='public' ORDER BY created_at DESC LIMIT 100").all();
  rows = rows.map((r: any) => ({ ...r, tags: JSON.parse(r.tags || '[]') }));
  if (q) rows = rows.filter((r: any) => r.title.toLowerCase().includes(q) || (r.tags||[]).join(' ').toLowerCase().includes(q));
  res.json({ items: rows });
}
```

### `routes/query.ts`
```ts
import { Request, Response } from 'express';
import { db } from '../lib/db';
import { embed, cosine } from '../lib/text';

async function topKFromPacks(question: string, packIds: string[], k = 5) {
  const qv = await embed(question);
  const rows: any[] = db.prepare('SELECT text, embedding, d.shelby_blob_id, d.sha256 FROM chunks c JOIN docs d ON d.doc_id=c.doc_id WHERE c.pack_id IN (' + packIds.map(()=>'?').join(',') + ') LIMIT 5000').all(...packIds);
  const scored = rows.map(r => ({ s: cosine(qv, JSON.parse(r.embedding)), text: r.text, shelby_blob_id: r.shelby_blob_id, sha256: r.sha256 }));
  scored.sort((a,b)=>b.s-a.s);
  return scored.slice(0, k);
}

async function callLLM(question: string, contexts: string[]) {
  const sys = 'You answer with citations for every claim. Use the provided contexts only.';
  const prompt = `${sys}\n\nQuestion: ${question}\n\nContext:\n${contexts.map((c,i)=>`[${i+1}] ${c}`).join('\n\n')}\n\nAnswer:`;
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.2 })
  });
  const json = await resp.json();
  return json.choices?.[0]?.message?.content || '';
}

export async function queryPrivate(req: Request, res: Response) {
  const user_id = (req as any).user_id as string;
  const { question, pack_id } = req.body || {};
  if (!question) return res.status(400).json({ error: 'question required' });
  let packIds: string[] = [];
  if (pack_id) {
    const own = db.prepare('SELECT 1 FROM source_packs WHERE pack_id=? AND owner_user_id=?').get(pack_id, user_id);
    const pub = db.prepare("SELECT 1 FROM source_packs WHERE pack_id=? AND visibility='public'").get(pack_id);
    if (!own && !pub) return res.status(403).json({ error: 'no access to pack' });
    packIds = [pack_id];
  } else {
    packIds = db.prepare('SELECT pack_id FROM source_packs WHERE owner_user_id=?').all(user_id).map((r:any)=>r.pack_id);
    if (packIds.length === 0) return res.json({ answer: 'No packs yet.', citations: [] });
  }
  const top = await topKFromPacks(question, packIds, 5);
  const answer = await callLLM(question, top.map(t=>t.text));
  const citations = top.map(t=>({ shelby_blob_id: t.shelby_blob_id, sha256: t.sha256, snippet: t.text.slice(0, 220) }));
  res.json({ answer, citations });
}

export async function queryPublic(req: Request, res: Response) {
  const { question, pack_id } = req.body || {};
  if (!question || !pack_id) return res.status(400).json({ error: 'question and pack_id required' });
  const pub = db.prepare("SELECT 1 FROM source_packs WHERE pack_id=? AND visibility='public'").get(pack_id);
  if (!pub) return res.status(404).json({ error: 'not public' });
  const top = await topKFromPacks(question, [pack_id], 5);
  const answer = await callLLM(question, top.map(t=>t.text));
  const citations = top.map(t=>({ shelby_blob_id: t.shelby_blob_id, sha256: t.sha256, snippet: t.text.slice(0, 220) }));
  res.json({ answer, citations });
}
```

### `routes/verify.ts`
```ts
import { Request, Response } from 'express';
import crypto from 'crypto';
import { getBlob } from '../lib/shelby';

export async function verifyBlob(req: Request, res: Response) {
  try {
    const blob_id = req.params.blob_id;
    const buf = await getBlob(blob_id);
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    res.json({ ok: true, sha256 });
  } catch (e) {
    res.status(404).json({ ok: false });
  }
}
```

---

## Web App (Next.js) — Minimal but Polished
Create **/apps/web** with Next 15 (App Router).

### Pages
- `/` — **Discover**: list public packs with search.
- `/packs` — **My Packs**: create pack (drag‑drop) + list; Public/Private toggle.
- `/packs/[id]` — Pack detail (files, hashes, manifest link if present).
- `/chat` — Chat UI: select **Context** (My Packs OR choose a specific pack id including public ones) and ask.
- `/login` — Dev email login.

### Components to build
- `Uploader` — drag‑drop + folder input (`webkitdirectory`) + zip support; shows progress and posts to `/packs`.
- `PackCard` — title, tags, created_at, visibility toggle.
- `ChatPanel` — textarea, send, renders `answer` + list of citations (each with **Open on Shelby** + **Verify** button calling `/verify/:blob_id`).

**Note:** The web app calls the API at `NEXT_PUBLIC_API_URL`.

### Example Client Helpers (`lib/api.ts`)
```ts
export async function devLogin(email: string) {
  const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/dev-login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
  return r.json();
}

export async function createPack(formData: FormData) {
  const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/packs`, { method: 'POST', credentials: 'include', body: formData });
  return r.json();
}

export async function listDiscover(q?: string) {
  const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/discover${q?`?q=${encodeURIComponent(q)}`:''}`, { cache: 'no-store' });
  return r.json();
}

export async function queryPrivate(body: any) {
  const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/query`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}

export async function queryPublic(body: any) {
  const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public_query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}

export async function verifyBlob(blob_id: string) {
  const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/verify/${encodeURIComponent(blob_id)}`);
  return r.json();
}
```

---

## CLI (apps/cli/index.ts)
```ts
#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import FormData from 'form-data';

async function main() {
  const [,, cmd, dirOrZip, ...rest] = process.argv;
  const api = process.env.API_URL || 'http://localhost:4000';
  const title = getFlag(rest, '--title') || path.basename(dirOrZip);
  const ocr = getFlag(rest, '--ocr') ? 'true' : 'false';
  const tokenUser = process.env.USER_ID || 'cli-user';

  const form = new FormData();
  form.append('title', title);
  form.append('ocr', ocr);

  const stat = fs.statSync(dirOrZip);
  if (stat.isFile() && dirOrZip.endsWith('.zip')) {
    form.append('archive.zip', fs.createReadStream(dirOrZip));
  } else if (stat.isDirectory()) {
    // naive: add up to 1000 files
    let count = 0;
    walk(dirOrZip, (file) => {
      if (count++ > 1000) return; // cap
      form.append('files', fs.createReadStream(file), path.relative(dirOrZip, file));
    });
  } else {
    console.error('Provide a directory or a .zip');
    process.exit(1);
  }

  const resp = await fetch(`${api}/packs`, { method: 'POST', headers: { 'x-user-id': tokenUser }, body: form as any });
  const json = await resp.json();
  console.log(JSON.stringify(json, null, 2));
}

function getFlag(argv: string[], name: string) { const i = argv.indexOf(name); return i>=0 ? argv[i+1] || 'true' : ''; }
function walk(dir: string, cb: (p: string)=>void) {
  for (const e of fs.readdirSync(dir)) {
    const p = path.join(dir, e); const s = fs.statSync(p);
    if (s.isDirectory()) walk(p, cb); else cb(p);
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
```

Make it executable: `chmod +x apps/cli/index.ts` (or compile to JS with ts-node).

---

## Package.json (root)
```json
{
  "name": "shelby-packs",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev:api": "ts-node --transpile-only apps/api/src/index.ts",
    "dev:web": "next dev apps/web",
    "dev": "concurrently \"pnpm dev:api\" \"pnpm dev:web\""
  },
  "devDependencies": {
    "concurrently": "^9.0.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.6.3"
  }
}
```

> Add per‑app package.json with dependencies (`express`, `better-sqlite3`, `multer`, `adm-zip`, `mime-types`, `node-fetch`, `pdf-parse`, `tesseract.js`, `next`, `react`, etc.). Cursor can infer and install from imports.

---

## CORS & Security (MVP)
- Set `CORS_ORIGIN=http://localhost:3000`.
- Rate‑limit `/public_query` (e.g., 30/min/IP). (Cursor: add `express-rate-limit`.)
- File allowlist: `txt, md, html, pdf, png, jpg, jpeg, webp, gif`.
- Size caps: `MAX_FILE_BYTES` and 1000 files per pack.
- Basic content warning on upload ("I have rights to share").

---

## Testing Cheatsheet

### Login (dev)
```bash
curl -s localhost:4000/auth/dev-login -H 'Content-Type: application/json' -d '{"email":"alice@example.com"}'
```

### Upload two files
```bash
curl -X POST localhost:4000/packs \
  -H 'x-user-id: <USER_ID_FROM_LOGIN>' \
  -F 'title=My Pack' \
  -F 'files=@/path/to/a.pdf' \
  -F 'files=@/path/to/notes.txt'
```

### Make public
```bash
curl -X PATCH localhost:4000/packs/<PACK_ID>/visibility \
  -H 'x-user-id: <USER_ID>' \
  -H 'Content-Type: application/json' \
  -d '{"visibility":"public"}'
```

### Query
```bash
curl -s -X POST localhost:4000/query \
  -H 'x-user-id: <USER_ID>' -H 'Content-Type: application/json' \
  -d '{"question":"What is Shelby hot storage?"}'
```

### Public query
```bash
curl -s -X POST localhost:4000/public_query \
  -H 'Content-Type: application/json' \
  -d '{"pack_id":"<PACK_ID>","question":"Summarize the pack"}'
```

### Verify a blob
```bash
curl -s localhost:4000/verify/sbly%3A0xabc...
```

---

## What Cursor Should Do (Explicit Tasks)
1. **Scaffold** the repo with folders shown above.
2. Add `package.json` files and install deps inferred from imports.
3. Implement all server files as specified, ensuring the DB is created and schema applied at boot.
4. Implement the **web** pages & components to:
   - sign in via `/login` (dev email)
   - create packs via drag‑drop or folder input (use `webkitdirectory`)
   - list My Packs and toggle visibility
   - Discover public packs and open pack detail
   - Chat page that calls `/query` (private) and `/public_query` when a public pack is selected
   - Render answer + citations (with **Open on Shelby** and **Verify** buttons)
5. Implement **CLI** app that uploads a folder or zip using `x-user-id` header.
6. Provide `README.md` with run instructions:
   - `pnpm i && pnpm dev` (or npm/yarn)
   - Open `http://localhost:3000`
   - Run API on `:4000`
7. Ensure **.env** examples are created.
8. Add a minimal **rate limiter** to `/public_query`.
9. Add a **file type allowlist** and reject others.
10. Make the Shelby client base URL & token configurable; keep current stub network calls and a simple mock server for local if needed.

---

## Future Switches (don’t build today, leave TODOs)
- Replace dev auth with **NextAuth**.
- Use **ANN** (e.g., `sqlite-vec` or `pgvector`).
- Byte‑range fetch and chunk‑level offsets for exact highlighting.
- Payments on Aptos; encrypted packs (Shelby Octopus); grant-based access.
- Multimodal embeddings and image captioning.

---

## Definition of Done (MVP)
- Uploading a folder/zip from GUI **works**; files appear in pack detail with blob ids + hashes.
- `/query` returns an answer with 2–5 citations referencing Shelby blob ids.
- Toggle pack to **public**; it appears in **Discover** and `/public_query` works.
- **Verify** button re-fetches blob and returns a matching sha256.
- CLI can upload the same pack headless.

That’s it — with this spec, Cursor should generate a runnable app in a single pass. If anything is unclear, default to the interfaces and types above.

