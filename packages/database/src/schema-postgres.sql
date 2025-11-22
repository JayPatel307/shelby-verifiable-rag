-- Shelby Verifiable RAG Database Schema - PostgreSQL
-- Production schema for Cloud SQL

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =================================================================
-- Users Table
-- =================================================================
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =================================================================
-- Source Packs Table
-- =================================================================
CREATE TABLE IF NOT EXISTS source_packs (
  pack_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  tags JSONB,                      -- JSON array of strings
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  manifest_blob_id TEXT,
  FOREIGN KEY(owner_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CHECK(visibility IN ('private', 'public', 'unlisted')),
  CHECK(length(title) > 0 AND length(title) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_packs_owner ON source_packs(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_packs_visibility ON source_packs(visibility);
CREATE INDEX IF NOT EXISTS idx_packs_created ON source_packs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_packs_tags ON source_packs USING GIN(tags);

-- =================================================================
-- Documents Table
-- =================================================================
CREATE TABLE IF NOT EXISTS docs (
  doc_id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL,
  path TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  shelby_blob_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY(pack_id) REFERENCES source_packs(pack_id) ON DELETE CASCADE,
  CHECK(bytes >= 0),
  CHECK(length(sha256) = 64),
  CHECK(length(shelby_blob_id) > 0)
);

CREATE INDEX IF NOT EXISTS idx_docs_pack ON docs(pack_id);
CREATE INDEX IF NOT EXISTS idx_docs_sha256 ON docs(sha256);
CREATE INDEX IF NOT EXISTS idx_docs_blob_id ON docs(shelby_blob_id);

-- =================================================================
-- Chunks Table (embeddings only - text stored on Shelby)
-- =================================================================
CREATE TABLE IF NOT EXISTS chunks (
  chunk_id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  shelby_chunk_blob_id TEXT NOT NULL, -- Shelby reference for chunk text
  chunk_index INTEGER NOT NULL,        -- Index within document (for ordering)
  start_byte INTEGER,                  -- Optional byte range in original doc
  end_byte INTEGER,
  embedding JSONB NOT NULL,            -- JSON array of numbers (search index)
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY(pack_id) REFERENCES source_packs(pack_id) ON DELETE CASCADE,
  FOREIGN KEY(doc_id) REFERENCES docs(doc_id) ON DELETE CASCADE,
  CHECK(length(shelby_chunk_blob_id) > 0),
  CHECK(chunk_index >= 0),
  CHECK(start_byte IS NULL OR start_byte >= 0),
  CHECK(end_byte IS NULL OR end_byte >= start_byte)
);

CREATE INDEX IF NOT EXISTS idx_chunks_pack ON chunks(pack_id);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id);
CREATE INDEX IF NOT EXISTS idx_chunks_blob ON chunks(shelby_chunk_blob_id);

-- Future: Add pgvector for faster similarity search
-- CREATE EXTENSION IF NOT EXISTS vector;
-- ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(1536);
-- CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops);

-- =================================================================
-- Query Statistics (optional, for analytics)
-- =================================================================
CREATE TABLE IF NOT EXISTS query_stats (
  query_id TEXT PRIMARY KEY,
  user_id TEXT,
  pack_id TEXT,
  question TEXT NOT NULL,
  answer_length INTEGER,
  num_citations INTEGER,
  query_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY(pack_id) REFERENCES source_packs(pack_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_query_stats_user ON query_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_query_stats_pack ON query_stats(pack_id);
CREATE INDEX IF NOT EXISTS idx_query_stats_created ON query_stats(created_at DESC);

-- =================================================================
-- Views (for convenience)
-- =================================================================

-- View: Pack with document count
CREATE OR REPLACE VIEW v_packs_summary AS
SELECT 
  p.*,
  COUNT(DISTINCT d.doc_id) as doc_count,
  COALESCE(SUM(d.bytes), 0) as total_bytes,
  COUNT(DISTINCT c.chunk_id) as chunk_count
FROM source_packs p
LEFT JOIN docs d ON d.pack_id = p.pack_id
LEFT JOIN chunks c ON c.pack_id = p.pack_id
GROUP BY p.pack_id, p.owner_user_id, p.title, p.summary, p.tags, 
         p.visibility, p.created_at, p.updated_at, p.manifest_blob_id;

-- View: Public packs for discovery
CREATE OR REPLACE VIEW v_public_packs AS
SELECT 
  pack_id,
  owner_user_id,
  title,
  summary,
  tags,
  created_at,
  (SELECT COUNT(*) FROM docs WHERE pack_id = source_packs.pack_id) as doc_count
FROM source_packs
WHERE visibility = 'public'
ORDER BY created_at DESC;

