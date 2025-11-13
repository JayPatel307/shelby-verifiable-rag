# Shelby Verifiable RAG

A production-ready, verifiable Retrieval-Augmented Generation (RAG) system built on Shelby decentralized storage. Every answer comes with **cryptographic proof** - users can verify that citations came from specific files stored on Shelby's blockchain.

## 🎯 Project Goals

1. **Showcase Shelby in AI**: Demonstrate Shelby's capabilities for storing and retrieving AI training data with verifiable provenance
2. **Attract Developers**: Provide a complete, well-architected example that developers can learn from and build upon
3. **Production Ready**: Not just a demo - designed with extensibility, type safety, and best practices

## ✨ Key Features

- 📦 **Source Packs**: Upload collections of documents (PDFs, text, images) to Shelby
- 🔍 **Semantic Search**: Vector-based search across your document collections
- 💬 **RAG Q&A**: Ask questions and get answers with verifiable citations
- 🔐 **Cryptographic Verification**: Every citation includes Shelby blob ID + SHA256 hash
- 🌍 **Public Discovery**: Share packs publicly for community access
- 🔒 **Privacy First**: All packs are private by default
- 🚀 **Real Shelby Integration**: Uses official Shelby SDK (not mocks)

## 🏗️ Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

### Tech Stack

- **Storage**: Shelby Protocol (Aptos blockchain)
- **Backend**: Node.js + Express + TypeScript
- **Frontend**: Next.js 15 (App Router) + React + TailwindCSS
- **Database**: SQLite (easily swappable to PostgreSQL)
- **Embeddings**: OpenAI (swappable to local/Cohere)
- **Text Processing**: pdf-parse, Tesseract.js (OCR)

### Package Structure

```
├── packages/
│   ├── shared/              ✅ Shared types & utilities
│   ├── database/            ✅ SQLite database layer
│   ├── shelby-client/       ✅ Real Shelby SDK wrapper
│   ├── embeddings/          ✅ OpenAI + local providers
│   ├── text-processing/     ✅ PDF, text, OCR extractors
│   └── core/                🚧 Business logic (in progress)
│
├── apps/
│   ├── api/                 🚧 Express REST API (next)
│   ├── web/                 📅 Next.js UI (planned)
│   └── cli/                 📅 CLI tool (planned)
```

## 📦 Completed Packages

### ✅ `@shelby-rag/shared`
Common types, interfaces, and utilities used across all packages.

**Key Features:**
- Complete TypeScript type definitions
- Storage, embedding, and text extraction interfaces
- Utility functions (hashing, validation, cosine similarity)
- Custom error classes

### ✅ `@shelby-rag/database`
SQLite database implementation with full schema and operations.

**Key Features:**
- Complete SQL schema with indexes
- Pack, document, and chunk management
- User management with dev auth
- Vector similarity search (cosine distance)
- Easy to swap for PostgreSQL/MongoDB

### ✅ `@shelby-rag/shelby-client`
**Real Shelby SDK integration** - not a stub! This uses the official `@shelby-protocol/sdk`.

**Key Features:**
- Upload files to Shelby with proper expiration
- Download files with verification
- Blob metadata queries
- Account management
- Cryptographic verification support

**Example:**
```typescript
import { ShelbyClient } from '@shelby-rag/shelby-client';
import { Network } from '@aptos-labs/ts-sdk';

const client = new ShelbyClient({
  network: Network.SHELBYNET,
  apiKey: process.env.SHELBY_API_KEY,
  privateKey: process.env.APTOS_PRIVATE_KEY,
});

// Upload
const result = await client.upload(buffer, {
  contentType: 'application/pdf',
  metadata: { path: 'documents/myfile.pdf' }
});

// Download & verify
const data = await client.download(result.blob_id);
const verification = await client.verifyBlob(result.blob_id, result.sha256);
```

### ✅ `@shelby-rag/text-processing`
Extract text from various file formats and chunk it for embeddings.

**Supported Formats:**
- PDF (via pdf-parse)
- Plain text, Markdown, HTML, JSON
- Images with OCR (Tesseract.js)

**Chunking Strategies:**
- Word-based with overlap
- Sentence-based (semantic)
- Configurable chunk size and overlap

**Example:**
```typescript
import { textProcessor } from '@shelby-rag/text-processing';

// Extract text
const extracted = await textProcessor.extractText(
  pdfBuffer,
  'application/pdf',
  { ocr: true }
);

// Chunk for embeddings
const chunks = textProcessor.chunkText(extracted.text, {
  maxTokens: 1000,
  overlap: 200
});
```

### ✅ `@shelby-rag/embeddings`
Generate vector embeddings with pluggable providers.

**Providers:**
- OpenAI (`text-embedding-3-small`) - production ready
- Local hash-based - for development without API keys
- Cohere - planned

**Example:**
```typescript
import { createEmbeddingsProvider } from '@shelby-rag/embeddings';

const embedder = createEmbeddingsProvider({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small'
});

const vector = await embedder.embed('What is Shelby storage?');
const vectors = await embedder.embedBatch(chunks);
```

## 🚧 In Progress

### `@shelby-rag/core`
Business logic layer coordinating all packages (currently being built).

Will include:
- `PackManager`: Create, update, and manage source packs
- `QueryEngine`: RAG query processing with citation extraction
- `Verifier`: Blob verification against Shelby storage

## 📅 Next Steps

1. ✅ Complete foundational packages ← **WE ARE HERE**
2. 🚧 Build core business logic
3. 📅 Implement API server (Express)
4. 📅 Build web UI (Next.js)
5. 📅 Create CLI tool
6. 📅 Write comprehensive documentation
7. 📅 End-to-end testing

## 🚀 Quick Start (When Complete)

```bash
# Install dependencies
pnpm install

# Set up environment
cp apps/api/.env.example apps/api/.env
# Edit .env with your Shelby & OpenAI API keys

# Run development servers
pnpm dev

# Open browser
open http://localhost:3000
```

## 🔧 Development

```bash
# Install dependencies
pnpm install

# Run individual apps
pnpm dev:api      # API server on :4000
pnpm dev:web      # Web UI on :3000

# Build all packages
pnpm build

# Run CLI
pnpm cli upload ./my-docs --title "My Pack"
```

## 🌐 Environment Variables

See individual `.env.example` files in each app directory.

**Key Variables:**
```env
# Shelby
SHELBY_BASE_URL=https://api.shelbynet.shelby.xyz
SHELBY_API_KEY=your_api_key_here
APTOS_PRIVATE_KEY=your_aptos_private_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Database
DATABASE_URL=./data.sqlite

# Embeddings
EMBEDDINGS_PROVIDER=openai  # or "local" for dev
```

## 📖 API Endpoints (Planned)

### Authentication
- `POST /auth/dev-login` - Dev login with email

### Packs
- `POST /packs` - Upload files and create pack
- `GET /packs/:id` - Get pack details
- `PATCH /packs/:id/visibility` - Change visibility
- `GET /discover` - List public packs

### Query
- `POST /query` - Query your packs
- `POST /public_query` - Query public packs

### Verification
- `GET /verify/:blob_id` - Verify blob integrity

## 🎨 UI Pages (Planned)

- `/` - Discover public packs
- `/packs` - My packs (create, list, manage)
- `/packs/[id]` - Pack details with file list
- `/chat` - Ask questions with pack context
- `/login` - Dev login

## 🔒 Security Features

- Rate limiting on public endpoints
- File type allowlist
- Size limits per file and pack
- CORS configuration
- Content verification
- User consent for public sharing

## 📄 License

MIT

## 🤝 Contributing

This is currently a showcase project for Shelby Protocol. Contributions welcome after initial release!

## 📚 Learn More

- [Shelby Protocol Docs](https://docs.shelby.xyz)
- [Shelby SDK](https://www.npmjs.com/package/@shelby-protocol/sdk)
- [Aptos Blockchain](https://aptoslabs.com)

---

**Built with ❤️ to showcase Shelby's capabilities in the AI domain**
