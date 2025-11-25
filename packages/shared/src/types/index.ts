/**
 * Shared TypeScript types for Shelby Verifiable RAG
 * Used across all packages for type safety
 */

// ============================================================================
// Pack Types
// ============================================================================

export type Visibility = 'private' | 'public' | 'unlisted';

export interface SourcePack {
  pack_id: string;          // UUID
  owner_user_id: string;    // User who created the pack
  title: string;            // Pack display name
  summary?: string;         // Optional description
  tags?: string[];          // Searchable tags
  visibility: Visibility;   // Access control
  created_at: string;       // ISO 8601 timestamp
  updated_at?: string;      // ISO 8601 timestamp
  manifest_blob_id?: string; // Shelby blob ID of pack manifest
}

export interface PackManifest {
  pack_id: string;
  title: string;
  summary?: string;
  tags?: string[];
  created_at: string;
  files: ManifestFile[];
}

export interface ManifestFile {
  path: string;
  mime: string;
  bytes: number;
  sha256: string;
  shelby_blob_id: string;
  indexed: boolean;
  chunks: number;
}

// ============================================================================
// Document Types
// ============================================================================

export interface DocRow {
  doc_id: string;           // UUID
  pack_id: string;          // Foreign key
  path: string;             // Original relative path or filename
  mime: string;             // MIME type (application/pdf, text/plain, etc.)
  bytes: number;            // File size in bytes
  sha256: string;           // SHA256 hash for verification
  shelby_blob_id: string;   // Shelby storage reference
  created_at?: string;      // ISO 8601 timestamp
}

// ============================================================================
// Chunk & Embedding Types
// ============================================================================

export interface ChunkRow {
  chunk_id: string;              // UUID
  pack_id: string;               // Foreign key
  doc_id: string;                // Foreign key to document
  shelby_chunk_blob_id: string;  // Shelby blob ID for chunk text
  chunk_index: number;           // Index within document (for ordering)
  start_byte: number | null;     // Optional byte offset in original file
  end_byte: number | null;       // Optional byte offset end
  embedding: number[];           // Vector embedding (stored as JSON in DB)
  created_at?: string;           // ISO 8601 timestamp
}

// Extended chunk with downloaded text (used during queries)
export interface ChunkWithText extends ChunkRow {
  text: string;                  // Downloaded from Shelby
}

// ============================================================================
// Query & Citation Types
// ============================================================================

export interface Citation {
  shelby_blob_id: string;   // Shelby blob reference
  sha256: string;           // Content hash for verification
  start_byte?: number | null; // Optional byte range start
  end_byte?: number | null;   // Optional byte range end
  snippet?: string;         // Text excerpt
  doc_path?: string;        // Original file path
  score?: number;           // Similarity score
}

export interface QueryRequest {
  question: string;         // User's question
  pack_id?: string;         // Optional: specific pack to search
  max_results?: number;     // Number of citations to return (default: 5)
}

export interface QueryResponse {
  answer: string;           // LLM-generated answer
  citations: Citation[];    // Verifiable references
  query_time_ms?: number;   // Performance metric
}

// ============================================================================
// User Types
// ============================================================================

export interface User {
  user_id: string;          // UUID
  email: string;            // Email address
  created_at: string;       // ISO 8601 timestamp
}

// ============================================================================
// Upload Types
// ============================================================================

export interface UploadRequest {
  title: string;            // Required pack title
  summary?: string;         // Optional description
  tags?: string[];          // Optional tags
  ocr?: boolean;            // Enable OCR for images (default: false)
  files: UploadFile[];      // Files to upload
}

export interface UploadFile {
  path: string;             // Relative path within pack
  mime: string;             // MIME type
  buffer: Buffer;           // File content
}

export interface UploadResponse {
  pack_id: string;          // Created pack ID
  files: UploadedFile[];    // Upload results per file
}

export interface UploadedFile {
  path: string;
  mime: string;
  bytes: number;
  sha256: string;
  shelby_blob_id: string;
  indexed: boolean;         // Whether text was extracted
  chunks: number;           // Number of chunks created
  error?: string;           // Optional error message
}

// ============================================================================
// Verification Types
// ============================================================================

export interface VerificationRequest {
  blob_id: string;          // Shelby blob ID to verify
  expected_sha256?: string; // Optional expected hash
}

export interface VerificationResponse {
  ok: boolean;              // Whether verification passed
  blob_id: string;
  computed_sha256: string;  // Actual hash of fetched blob
  expected_sha256?: string; // Expected hash (if provided)
  matched?: boolean;        // Whether hashes matched (if expected provided)
}

// ============================================================================
// Storage Provider Interface
// ============================================================================

export interface StorageProvider {
  /**
   * Upload a blob to storage
   */
  upload(
    data: Buffer,
    options: {
      contentType?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<StorageUploadResult>;

  /**
   * Download a blob from storage
   */
  download(blobId: string): Promise<Buffer>;

  /**
   * Check if a blob exists
   */
  exists(blobId: string): Promise<boolean>;

  /**
   * Get blob metadata without downloading
   */
  getMetadata(blobId: string): Promise<StorageMetadata>;
}

export interface StorageUploadResult {
  blob_id: string;          // Storage reference
  sha256: string;           // Content hash
  bytes: number;            // Size in bytes
}

export interface StorageMetadata {
  blob_id: string;
  bytes: number;
  content_type?: string;
  created_at?: string;
}

// ============================================================================
// Embedding Provider Interface
// ============================================================================

export interface EmbeddingProvider {
  /**
   * Generate embedding vector for text
   */
  embed(text: string): Promise<number[]>;

  /**
   * Batch embed multiple texts (optional, defaults to sequential)
   */
  embedBatch?(texts: string[]): Promise<number[][]>;

  /**
   * Get embedding dimension
   */
  getDimension(): number;

  /**
   * Get provider name
   */
  getName(): string;
}

// ============================================================================
// Text Extraction Interface
// ============================================================================

export interface TextExtractor {
  /**
   * Check if this extractor supports the MIME type
   */
  supports(mimeType: string): boolean;

  /**
   * Extract text from file buffer
   */
  extract(
    buffer: Buffer,
    options: {
      mimeType: string;
      filename?: string;
      ocr?: boolean;
    }
  ): Promise<ExtractedText>;
}

export interface ExtractedText {
  text: string;             // Extracted text content
  metadata?: {              // Optional metadata
    pages?: number;
    language?: string;
    [key: string]: any;
  };
}

// ============================================================================
// Database Interface
// ============================================================================

export interface DatabaseClient {
  // Pack operations
  createPack(pack: Omit<SourcePack, 'created_at'>): Promise<SourcePack>;
  getPack(packId: string): Promise<SourcePack | null>;
  listPacks(userId: string): Promise<SourcePack[]>;
  listPublicPacks(query?: string): Promise<SourcePack[]>;
  updatePackVisibility(packId: string, visibility: Visibility): Promise<void>;
  updatePackManifest(packId: string, manifestBlobId: string): Promise<void>;
  deletePack(packId: string): Promise<void>;

  // Document operations
  createDoc(doc: Omit<DocRow, 'created_at'>): Promise<DocRow>;
  getDoc(docId: string): Promise<DocRow | null>;
  listDocs(packId: string): Promise<DocRow[]>;
  deleteDoc(docId: string): Promise<void>;

  // Chunk operations
  createChunk(chunk: Omit<ChunkRow, 'created_at'>): Promise<ChunkRow>;
  listChunks(packId: string, limit?: number): Promise<ChunkRow[]>;
  searchChunks(embedding: number[], packIds: string[], limit?: number): Promise<ScoredChunk[]>;

  // User operations
  createUser(email: string, userId?: string): Promise<User>;
  getUser(userId: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;

  // Utility
  close(): Promise<void>;
}

export interface ScoredChunk extends ChunkRow {
  score: number;            // Cosine similarity score
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AppConfig {
  port: number;
  database_url: string;
  shelby: {
    base_url: string;
    api_key: string;
    network: string;
  };
  embeddings: {
    provider: 'openai' | 'local' | 'cohere';
    api_key?: string;
  };
  llm: {
    provider: 'openai' | 'anthropic';
    api_key: string;
    model: string;
  };
  upload: {
    max_file_bytes: number;
    max_files_per_pack: number;
    allowed_mime_types: string[];
  };
  ocr: {
    enabled: boolean;
    languages: string[];
  };
  cors: {
    origin: string;
  };
  session: {
    secret: string;
  };
}

// ============================================================================
// Error Types
// ============================================================================

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

