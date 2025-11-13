/**
 * SQLite database implementation
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
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

export class SQLiteDatabase implements DatabaseClient {
  private db: Database.Database;

  constructor(dbPath: string = './data.sqlite') {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Open database
    this.db = new Database(dbPath);
    
    // Apply schema
    this.applySchema();
  }

  private applySchema() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    this.db.exec(schema);
  }

  // ====================================================================
  // Pack Operations
  // ====================================================================

  async createPack(pack: Omit<SourcePack, 'created_at'>): Promise<SourcePack> {
    const stmt = this.db.prepare(`
      INSERT INTO source_packs (pack_id, owner_user_id, title, summary, tags, visibility, manifest_blob_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      pack.pack_id,
      pack.owner_user_id,
      pack.title,
      pack.summary || null,
      pack.tags ? JSON.stringify(pack.tags) : null,
      pack.visibility,
      pack.manifest_blob_id || null
    );

    const created = await this.getPack(pack.pack_id);
    if (!created) throw new Error('Failed to create pack');
    return created;
  }

  async getPack(packId: string): Promise<SourcePack | null> {
    const stmt = this.db.prepare('SELECT * FROM source_packs WHERE pack_id = ?');
    const row = stmt.get(packId) as any;
    
    if (!row) return null;
    
    return {
      ...row,
      tags: safeJsonParse<string[]>(row.tags, []),
    };
  }

  async listPacks(userId: string): Promise<SourcePack[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM source_packs 
      WHERE owner_user_id = ? 
      ORDER BY created_at DESC
    `);
    
    const rows = stmt.all(userId) as any[];
    return rows.map(row => ({
      ...row,
      tags: safeJsonParse<string[]>(row.tags, []),
    }));
  }

  async listPublicPacks(query?: string): Promise<SourcePack[]> {
    let stmt;
    let rows: any[];

    if (query && query.trim().length > 0) {
      const searchTerm = `%${query.toLowerCase()}%`;
      stmt = this.db.prepare(`
        SELECT * FROM source_packs 
        WHERE visibility = 'public' 
        AND (LOWER(title) LIKE ? OR LOWER(tags) LIKE ?)
        ORDER BY created_at DESC 
        LIMIT 100
      `);
      rows = stmt.all(searchTerm, searchTerm) as any[];
    } else {
      stmt = this.db.prepare(`
        SELECT * FROM source_packs 
        WHERE visibility = 'public' 
        ORDER BY created_at DESC 
        LIMIT 100
      `);
      rows = stmt.all() as any[];
    }

    return rows.map(row => ({
      ...row,
      tags: safeJsonParse<string[]>(row.tags, []),
    }));
  }

  async updatePackVisibility(packId: string, visibility: Visibility): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE source_packs 
      SET visibility = ?, updated_at = datetime('now')
      WHERE pack_id = ?
    `);
    
    const result = stmt.run(visibility, packId);
    if (result.changes === 0) {
      throw new NotFoundError('Pack');
    }
  }

  async updatePackManifest(packId: string, manifestBlobId: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE source_packs 
      SET manifest_blob_id = ?, updated_at = datetime('now')
      WHERE pack_id = ?
    `);
    
    const result = stmt.run(manifestBlobId, packId);
    if (result.changes === 0) {
      throw new NotFoundError('Pack');
    }
  }

  // ====================================================================
  // Document Operations
  // ====================================================================

  async createDoc(doc: Omit<DocRow, 'created_at'>): Promise<DocRow> {
    const stmt = this.db.prepare(`
      INSERT INTO docs (doc_id, pack_id, path, mime, bytes, sha256, shelby_blob_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      doc.doc_id,
      doc.pack_id,
      doc.path,
      doc.mime,
      doc.bytes,
      doc.sha256,
      doc.shelby_blob_id
    );

    const created = await this.getDoc(doc.doc_id);
    if (!created) throw new Error('Failed to create document');
    return created;
  }

  async getDoc(docId: string): Promise<DocRow | null> {
    const stmt = this.db.prepare('SELECT * FROM docs WHERE doc_id = ?');
    const row = stmt.get(docId) as any;
    return row || null;
  }

  async listDocs(packId: string): Promise<DocRow[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM docs 
      WHERE pack_id = ? 
      ORDER BY path ASC
    `);
    return stmt.all(packId) as DocRow[];
  }

  // ====================================================================
  // Chunk Operations
  // ====================================================================

  async createChunk(chunk: Omit<ChunkRow, 'created_at'>): Promise<ChunkRow> {
    const stmt = this.db.prepare(`
      INSERT INTO chunks (chunk_id, pack_id, doc_id, text, start_byte, end_byte, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      chunk.chunk_id,
      chunk.pack_id,
      chunk.doc_id,
      chunk.text,
      chunk.start_byte,
      chunk.end_byte,
      JSON.stringify(chunk.embedding)
    );

    const created = this.db.prepare('SELECT * FROM chunks WHERE chunk_id = ?').get(chunk.chunk_id) as any;
    
    if (!created) throw new Error('Failed to create chunk');
    
    return {
      ...created,
      embedding: JSON.parse(created.embedding),
    };
  }

  async listChunks(packId: string, limit: number = 1000): Promise<ChunkRow[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM chunks 
      WHERE pack_id = ? 
      ORDER BY created_at ASC
      LIMIT ?
    `);
    
    const rows = stmt.all(packId, limit) as any[];
    return rows.map(row => ({
      ...row,
      embedding: JSON.parse(row.embedding),
    }));
  }

  async searchChunks(
    queryEmbedding: number[],
    packIds: string[],
    limit: number = 5
  ): Promise<ScoredChunk[]> {
    if (packIds.length === 0) return [];

    // Build placeholders for IN clause
    const placeholders = packIds.map(() => '?').join(',');
    
    // Fetch all chunks for these packs (with limit to prevent memory issues)
    const stmt = this.db.prepare(`
      SELECT c.*, d.shelby_blob_id, d.sha256, d.path as doc_path
      FROM chunks c
      JOIN docs d ON d.doc_id = c.doc_id
      WHERE c.pack_id IN (${placeholders})
      LIMIT 5000
    `);

    const rows = stmt.all(...packIds) as any[];

    // Compute cosine similarity for each chunk
    const scored: ScoredChunk[] = rows.map(row => {
      const embedding = JSON.parse(row.embedding);
      const score = cosineSimilarity(queryEmbedding, embedding);
      
      return {
        chunk_id: row.chunk_id,
        pack_id: row.pack_id,
        doc_id: row.doc_id,
        text: row.text,
        start_byte: row.start_byte,
        end_byte: row.end_byte,
        embedding,
        created_at: row.created_at,
        score,
        // Additional fields for convenience
        shelby_blob_id: row.shelby_blob_id,
        sha256: row.sha256,
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
    
    const stmt = this.db.prepare(`
      INSERT INTO users (user_id, email)
      VALUES (?, ?)
    `);

    try {
      stmt.run(id, email);
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        const existing = await this.getUserByEmail(email);
        if (existing) return existing;
      }
      throw error;
    }

    const created = await this.getUser(id);
    if (!created) throw new Error('Failed to create user');
    return created;
  }

  async getUser(userId: string): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE user_id = ?');
    const row = stmt.get(userId) as any;
    return row || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email) as any;
    return row || null;
  }

  // ====================================================================
  // Utility
  // ====================================================================

  async close(): Promise<void> {
    this.db.close();
  }

  /**
   * Get database stats (for debugging/monitoring)
   */
  getStats() {
    const packCount = this.db.prepare('SELECT COUNT(*) as count FROM source_packs').get() as any;
    const docCount = this.db.prepare('SELECT COUNT(*) as count FROM docs').get() as any;
    const chunkCount = this.db.prepare('SELECT COUNT(*) as count FROM chunks').get() as any;
    const userCount = this.db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
    
    return {
      packs: packCount.count,
      documents: docCount.count,
      chunks: chunkCount.count,
      users: userCount.count,
    };
  }
}

