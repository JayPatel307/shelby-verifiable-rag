/**
 * PostgreSQL database implementation for production
 */

import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  DatabaseClient,
  SourcePack,
  DocRow,
  ChunkRow,
  User,
  Visibility,
  ScoredChunk,
  NotFoundError,
  cosineSimilarity,
  uuid,
  safeJsonParse,
} from '@shelby-rag/shared';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PostgreSQLConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  max?: number;  // Max connections in pool
  min?: number;  // Min connections in pool
}

export class PostgreSQLDatabase implements DatabaseClient {
  private pool: Pool;

  constructor(config: PostgreSQLConfig | string) {
    // Accept either connection string or config object
    if (typeof config === 'string') {
      // Check if connecting via Cloud SQL Unix socket
      const isCloudSQLSocket = config.includes('/cloudsql/');
      
      this.pool = new Pool({
        connectionString: config,
        ssl: isCloudSQLSocket ? false : false, // No SSL for Cloud SQL Unix sockets
        max: 20,  // Max connections
        min: 2,   // Min connections
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    } else {
      this.pool = new Pool({
        ...config,
        ssl: config.ssl ?? false, // Default to false for Cloud SQL
        max: config.max ?? 20,
        min: config.min ?? 2,
      });
    }

    // Apply schema
    this.applySchema();
  }

  private async applySchema() {
    const schemaPath = path.join(__dirname, 'schema-postgres.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    try {
      await this.pool.query(schema);
      console.log('📊 PostgreSQL schema applied successfully');
    } catch (error) {
      console.error('Failed to apply schema:', error);
      throw error;
    }
  }

  // ====================================================================
  // Pack Operations
  // ====================================================================

  async createPack(pack: Omit<SourcePack, 'created_at'>): Promise<SourcePack> {
    const result = await this.pool.query(
      `INSERT INTO source_packs (pack_id, owner_user_id, title, summary, tags, visibility, manifest_blob_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        pack.pack_id,
        pack.owner_user_id,
        pack.title,
        pack.summary || null,
        pack.tags ? JSON.stringify(pack.tags) : null,
        pack.visibility,
        pack.manifest_blob_id || null,
      ]
    );

    const row = result.rows[0];
    return {
      ...row,
      // PostgreSQL JSONB returns already parsed, don't parse again
      tags: row.tags ? (Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags)) : [],
    };
  }

  async getPack(packId: string): Promise<SourcePack | null> {
    const result = await this.pool.query(
      'SELECT * FROM source_packs WHERE pack_id = $1',
      [packId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      ...row,
      tags: row.tags ? (Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags)) : [],
    };
  }

  async listPacks(userId: string): Promise<SourcePack[]> {
    const result = await this.pool.query(
      `SELECT * FROM source_packs 
       WHERE owner_user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      ...row,
      tags: row.tags ? (Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags)) : [],
    }));
  }

  async listPublicPacks(query?: string): Promise<SourcePack[]> {
    let result;

    if (query && query.trim().length > 0) {
      const searchTerm = `%${query.toLowerCase()}%`;
      result = await this.pool.query(
        `SELECT * FROM source_packs 
         WHERE visibility = 'public' 
         AND (LOWER(title) LIKE $1 OR tags::text LIKE $1)
         ORDER BY created_at DESC 
         LIMIT 100`,
        [searchTerm]
      );
    } else {
      result = await this.pool.query(
        `SELECT * FROM source_packs 
         WHERE visibility = 'public' 
         ORDER BY created_at DESC 
         LIMIT 100`
      );
    }

    return result.rows.map(row => ({
      ...row,
      tags: row.tags ? (Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags)) : [],
    }));
  }

  async updatePackVisibility(packId: string, visibility: Visibility): Promise<void> {
    const result = await this.pool.query(
      `UPDATE source_packs 
       SET visibility = $1, updated_at = NOW()
       WHERE pack_id = $2`,
      [visibility, packId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Pack');
    }
  }

  async updatePackManifest(packId: string, manifestBlobId: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE source_packs 
       SET manifest_blob_id = $1, updated_at = NOW()
       WHERE pack_id = $2`,
      [manifestBlobId, packId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Pack');
    }
  }

  async deletePack(packId: string): Promise<void> {
    const result = await this.pool.query(
      'DELETE FROM source_packs WHERE pack_id = $1',
      [packId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Pack');
    }
  }

  // ====================================================================
  // Document Operations
  // ====================================================================

  async createDoc(doc: Omit<DocRow, 'created_at'>): Promise<DocRow> {
    const result = await this.pool.query(
      `INSERT INTO docs (doc_id, pack_id, path, mime, bytes, sha256, shelby_blob_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        doc.doc_id,
        doc.pack_id,
        doc.path,
        doc.mime,
        doc.bytes,
        doc.sha256,
        doc.shelby_blob_id,
      ]
    );

    return result.rows[0];
  }

  async getDoc(docId: string): Promise<DocRow | null> {
    const result = await this.pool.query(
      'SELECT * FROM docs WHERE doc_id = $1',
      [docId]
    );

    return result.rows[0] || null;
  }

  async listDocs(packId: string): Promise<DocRow[]> {
    const result = await this.pool.query(
      `SELECT * FROM docs 
       WHERE pack_id = $1 
       ORDER BY path ASC`,
      [packId]
    );

    return result.rows;
  }

  async deleteDoc(docId: string): Promise<void> {
    const result = await this.pool.query(
      'DELETE FROM docs WHERE doc_id = $1',
      [docId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Document');
    }
  }

  // ====================================================================
  // Chunk Operations
  // ====================================================================

  async createChunk(chunk: Omit<ChunkRow, 'created_at'>): Promise<ChunkRow> {
    const result = await this.pool.query(
      `INSERT INTO chunks (chunk_id, pack_id, doc_id, shelby_chunk_blob_id, chunk_index, start_byte, end_byte, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        chunk.chunk_id,
        chunk.pack_id,
        chunk.doc_id,
        chunk.shelby_chunk_blob_id,
        chunk.chunk_index,
        chunk.start_byte,
        chunk.end_byte,
        JSON.stringify(chunk.embedding),
      ]
    );

    const row = result.rows[0];
    return {
      ...row,
      embedding: Array.isArray(row.embedding) ? row.embedding : JSON.parse(row.embedding),
    };
  }

  async listChunks(packId: string, limit: number = 1000): Promise<ChunkRow[]> {
    const result = await this.pool.query(
      `SELECT * FROM chunks 
       WHERE pack_id = $1 
       ORDER BY created_at ASC
       LIMIT $2`,
      [packId, limit]
    );

    return result.rows.map(row => ({
      ...row,
      embedding: Array.isArray(row.embedding) ? row.embedding : JSON.parse(row.embedding),
    }));
  }

  async searchChunks(
    queryEmbedding: number[],
    packIds: string[],
    limit: number = 5
  ): Promise<ScoredChunk[]> {
    if (packIds.length === 0) return [];

    // Build placeholders for IN clause
    const placeholders = packIds.map((_, i) => `$${i + 1}`).join(',');

    // Fetch all chunks for these packs (with limit to prevent memory issues)
    const result = await this.pool.query(
      `SELECT c.*, d.shelby_blob_id, d.sha256, d.path as doc_path
       FROM chunks c
       JOIN docs d ON d.doc_id = c.doc_id
       WHERE c.pack_id IN (${placeholders})
       LIMIT 5000`,
      packIds
    );

    // Compute cosine similarity for each chunk
    const scored: ScoredChunk[] = result.rows.map(row => {
      const embedding = Array.isArray(row.embedding) 
        ? row.embedding 
        : JSON.parse(row.embedding);
      const score = cosineSimilarity(queryEmbedding, embedding);

      return {
        chunk_id: row.chunk_id,
        pack_id: row.pack_id,
        doc_id: row.doc_id,
        shelby_chunk_blob_id: row.shelby_chunk_blob_id,
        chunk_index: row.chunk_index,
        start_byte: row.start_byte,
        end_byte: row.end_byte,
        embedding,
        created_at: row.created_at,
        score,
        // Additional fields for convenience (document metadata)
        shelby_blob_id: row.shelby_blob_id, // Document blob ID
        sha256: row.sha256,                  // Document SHA256
        doc_path: row.doc_path,
      } as any;
    });

    // Sort by score descending and return top k
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  // ====================================================================
  // User Operations
  // ====================================================================

  async createUser(email: string, userId?: string): Promise<User> {
    const id = userId || uuid();

    try {
      const result = await this.pool.query(
        `INSERT INTO users (user_id, email)
         VALUES ($1, $2)
         RETURNING *`,
        [id, email]
      );

      return result.rows[0];
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === '23505') { // Unique violation
        const existing = await this.getUserByEmail(email);
        if (existing) return existing;
      }
      throw error;
    }
  }

  async getUser(userId: string): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );

    return result.rows[0] || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    return result.rows[0] || null;
  }

  // ====================================================================
  // Utility
  // ====================================================================

  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Get database stats (for debugging/monitoring)
   */
  async getStats() {
    const result = await this.pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM source_packs) as packs,
        (SELECT COUNT(*) FROM docs) as documents,
        (SELECT COUNT(*) FROM chunks) as chunks,
        (SELECT COUNT(*) FROM users) as users
    `);

    return {
      packs: parseInt(result.rows[0].packs),
      documents: parseInt(result.rows[0].documents),
      chunks: parseInt(result.rows[0].chunks),
      users: parseInt(result.rows[0].users),
    };
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }
}

