# Shelby Verifiable RAG - Architecture

## Overview
A provenance-first RAG (Retrieval-Augmented Generation) system built on Shelby decentralized storage. Every answer comes with **verifiable citations** - cryptographic proofs that content came from specific files stored on Shelby.

## Core Concept
- **Source Packs**: Collections of documents uploaded to Shelby
- **Verifiable Citations**: Each answer references Shelby blob IDs + SHA256 hashes
- **Public Discovery**: Creators can share packs publicly for community queries
- **Privacy First**: All packs are private by default

## Architecture Principles

### 1. Modularity
Each package has a single, clear responsibility and can be swapped independently.

### 2. Extensibility
Easy to add new:
- Storage backends (Shelby, IPFS, S3)
- Embedding providers (OpenAI, Cohere, local models)
- Document types (PDFs, videos, audio)
- Authentication methods (NextAuth, Clerk, Web3)
- Databases (SQLite, PostgreSQL, MongoDB)

### 3. Type Safety
Shared TypeScript types across all packages ensure consistency.

### 4. Plugin Architecture
Providers follow common interfaces, making swapping implementations trivial.

## Project Structure

```
shelby-verifiable-rag/
├── apps/
│   ├── api/              # Express REST API server
│   │   ├── src/
│   │   │   ├── routes/   # API endpoints
│   │   │   ├── middleware/ # Auth, CORS, rate limiting
│   │   │   └── config/   # Environment configuration
│   │   └── package.json
│   │
│   ├── web/              # Next.js 15 (App Router) UI
│   │   ├── src/
│   │   │   ├── app/      # Pages (discover, packs, chat)
│   │   │   ├── components/ # React components
│   │   │   └── lib/      # Client utilities
│   │   └── package.json
│   │
│   └── cli/              # Command-line upload tool
│       ├── src/
│       └── package.json
│
├── packages/
│   ├── shared/           # Shared types & utilities
│   │   └── src/
│   │       ├── types/    # TypeScript interfaces
│   │       └── utils/    # Common helpers
│   │
│   ├── core/             # Business logic (storage-agnostic)
│   │   └── src/
│   │       ├── pack-manager.ts    # Pack CRUD operations
│   │       ├── query-engine.ts    # RAG query processing
│   │       └── verifier.ts        # Blob verification
│   │
│   ├── shelby-client/    # Shelby SDK wrapper
│   │   └── src/
│   │       ├── client.ts          # Main client
│   │       └── types.ts           # Shelby-specific types
│   │
│   ├── embeddings/       # Embedding providers
│   │   └── src/
│   │       ├── provider.ts        # Interface
│   │       └── providers/
│   │           ├── openai.ts
│   │           ├── local.ts
│   │           └── cohere.ts
│   │
│   ├── text-processing/  # Document text extraction
│   │   └── src/
│   │       ├── extractor.ts       # Interface
│   │       └── extractors/
│   │           ├── pdf.ts
│   │           ├── text.ts
│   │           ├── markdown.ts
│   │           └── ocr.ts
│   │
│   └── database/         # Data persistence layer
│       └── src/
│           ├── client.ts          # Database interface
│           ├── sqlite.ts          # SQLite implementation
│           └── schema.sql         # Database schema
│
├── docs/                 # Documentation
├── plan/                 # Planning documents
└── package.json          # Root package (workspace config)
```

## Data Flow

### Upload Flow
```
User uploads files
    ↓
API receives multipart/form-data
    ↓
text-processing extracts text → chunks it
    ↓
embeddings generates vectors
    ↓
shelby-client uploads to Shelby (returns blob_id + sha256)
    ↓
database stores metadata + embeddings
    ↓
core/pack-manager creates pack manifest
```

### Query Flow
```
User asks question
    ↓
embeddings generates query vector
    ↓
database finds similar chunks (cosine similarity)
    ↓
core/query-engine formats context + calls LLM
    ↓
Returns answer + citations (blob_id + sha256 + snippet)
```

### Verify Flow
```
User clicks "Verify" on citation
    ↓
shelby-client re-fetches blob from Shelby
    ↓
core/verifier re-computes SHA256
    ↓
Returns { ok: boolean, sha256: string }
```

## Key Design Decisions

### Why SQLite?
- Zero-config for MVP
- Fast local development
- Easy to migrate to Postgres later
- Good enough for 100K+ documents

### Why Local Vector Search?
- No external dependencies
- Instant cold starts
- Easy to swap for ANN (Annoy, FAISS, pgvector) later
- Fine for <100K vectors

### Why Express + Next.js?
- Separate concerns: API logic vs UI rendering
- Easy to scale independently
- Next.js App Router for modern React
- Express for flexible API middleware

### Why Multiple Packages?
- Each package is testable in isolation
- Easy to publish individual packages to npm
- Clear boundaries prevent coupling
- New features don't touch unrelated code

## Extension Points

### Adding a New Storage Backend
1. Create `packages/ipfs-client/` following the same interface as `shelby-client`
2. Update `core/pack-manager` to accept storage provider as dependency
3. Configure which provider to use via environment variable

### Adding a New Embedding Provider
1. Add `packages/embeddings/src/providers/your-provider.ts`
2. Implement the `EmbeddingProvider` interface
3. Register in provider factory

### Adding Authentication
1. Create `apps/api/src/middleware/auth.ts`
2. Replace dev auth with NextAuth/Clerk/Supabase
3. Update `requireUser` middleware

### Adding a New Document Type
1. Add extractor to `packages/text-processing/src/extractors/`
2. Implement the `TextExtractor` interface
3. Register MIME type mapping

## Environment Variables

See `.env.example` files in each app for full configuration.

**Key Variables:**
- `SHELBY_BASE_URL` - Shelby RPC endpoint
- `SHELBY_API_KEY` - Your Aptos API key
- `OPENAI_API_KEY` - For embeddings + LLM
- `DATABASE_URL` - SQLite file path
- `EMBEDDINGS_PROVIDER` - "openai" | "local" | "cohere"

## Development Workflow

```bash
# Install dependencies
pnpm install

# Run both API + Web in dev mode
pnpm dev

# Run individually
pnpm dev:api
pnpm dev:web

# Run CLI
pnpm cli upload ./my-docs --title "My Pack"
```

## Testing Strategy

- **Unit tests**: Each package tests its logic independently
- **Integration tests**: API endpoints with test database
- **E2E tests**: Full upload → query → verify flow
- **Manual testing**: Web UI for visual verification

## Future Enhancements

- [ ] Byte-range citations for exact highlighting
- [ ] Multimodal embeddings (images, audio)
- [ ] Aptos blockchain payments for premium packs
- [ ] Encrypted packs with access control
- [ ] Real-time collaborative editing
- [ ] Mobile app (React Native)
- [ ] Browser extension for "Save to Shelby"
- [ ] Webhook support for pack updates

## Security Considerations

- Rate limiting on public query endpoint
- File type allowlist (prevent malicious uploads)
- Size limits per file and per pack
- CORS configuration for web origin
- Content moderation flags
- User consent for public sharing

## Performance Targets (MVP)

- Upload: < 30s for 100 PDF files
- Query: < 3s for answer + citations
- Verify: < 2s to re-fetch and hash
- Discover: < 500ms to list 100 packs

## License

MIT

