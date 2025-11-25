/**
 * Pack Manager - Orchestrates pack creation and file uploads
 */

import {
  StorageProvider,
  DatabaseClient,
  EmbeddingProvider,
  UploadRequest,
  UploadResponse,
  UploadedFile,
  PackManifest,
  uuid,
  sha256,
  ValidationError,
  AppError,
} from '@shelby-rag/shared';
import { textProcessor } from '@shelby-rag/text-processing';

export interface PackManagerConfig {
  storage: StorageProvider;
  database: DatabaseClient;
  embeddings: EmbeddingProvider;
  maxFileBytes?: number;
  maxFilesPerPack?: number;
  allowedMimeTypes?: string[];
}

export class PackManager {
  private storage: StorageProvider;
  private database: DatabaseClient;
  private embeddings: EmbeddingProvider;
  private maxFileBytes: number;
  private maxFilesPerPack: number;
  private allowedMimeTypes: string[];

  constructor(config: PackManagerConfig) {
    this.storage = config.storage;
    this.database = config.database;
    this.embeddings = config.embeddings;
    this.maxFileBytes = config.maxFileBytes || 26214400; // 25MB default
    this.maxFilesPerPack = config.maxFilesPerPack || 1000;
    this.allowedMimeTypes = config.allowedMimeTypes || [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/html',
      'text/csv',
      'application/json',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ];
  }

  /**
   * Create a new source pack with files
   */
  async createPack(
    userId: string,
    request: UploadRequest
  ): Promise<UploadResponse> {
    // Validation
    this.validateRequest(request);

    const packId = uuid();
    const uploadedFiles: UploadedFile[] = [];

    try {
      // 1. Create pack record
      await this.database.createPack({
        pack_id: packId,
        owner_user_id: userId,
        title: request.title,
        summary: request.summary,
        tags: request.tags || [],
        visibility: 'private',
      });

      console.log(`📦 Created pack: ${packId}`);

      // 2. Process each file
      for (const file of request.files) {
        try {
          const result = await this.processFile(packId, file, request.ocr || false);
          uploadedFiles.push(result);
        } catch (error: any) {
          console.error(`Failed to process file ${file.path}:`, error);
          uploadedFiles.push({
            path: file.path,
            mime: file.mime,
            bytes: file.buffer.length,
            sha256: '',
            shelby_blob_id: '',
            indexed: false,
            chunks: 0,
            error: error.message,
          });
        }
      }

      // 3. Create and upload manifest
      const manifest: PackManifest = {
        pack_id: packId,
        title: request.title,
        summary: request.summary,
        tags: request.tags || [],
        created_at: new Date().toISOString(),
        files: uploadedFiles,
      };

      try {
        const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2));
        const manifestUpload = await this.storage.upload(manifestBuffer, {
          contentType: 'application/json',
          metadata: { path: `${packId}/manifest.json` },
        });

        await this.database.updatePackManifest(packId, manifestUpload.blob_id);
        console.log(`📄 Manifest uploaded: ${manifestUpload.blob_id}`);
      } catch (error: any) {
        console.error('Failed to upload manifest:', error);
        // Non-fatal, continue
      }

      console.log(`✅ Pack created successfully: ${packId}`);

      return {
        pack_id: packId,
        files: uploadedFiles,
      };
    } catch (error: any) {
      // Cleanup on error (optional - could also leave partial data)
      console.error(`Failed to create pack:`, error);
      throw new AppError(
        `Pack creation failed: ${error.message}`,
        'PACK_CREATION_ERROR',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Process a single file: upload, extract text, chunk, embed
   */
  private async processFile(
    packId: string,
    file: { path: string; mime: string; buffer: Buffer },
    ocr: boolean
  ): Promise<UploadedFile> {
    console.log(`  📄 Processing: ${file.path}`);

    // 1. Compute hash
    const fileHash = sha256(file.buffer);

    // 2. Upload to Shelby
    const uploadResult = await this.storage.upload(file.buffer, {
      contentType: file.mime,
      metadata: { path: file.path },
    });

    console.log(`    ☁️  Uploaded: ${uploadResult.blob_id}`);

    // 3. Create document record
    const docId = uuid();
    await this.database.createDoc({
      doc_id: docId,
      pack_id: packId,
      path: file.path,
      mime: file.mime,
      bytes: file.buffer.length,
      sha256: fileHash,
      shelby_blob_id: uploadResult.blob_id,
    });

    // 4. Extract text if supported
    let indexed = false;
    let chunkCount = 0;

    if (textProcessor.isSupported(file.mime)) {
      try {
        const extracted = await textProcessor.extractText(
          file.buffer,
          file.mime,
          { filename: file.path, ocr }
        );

        if (extracted.text && extracted.text.trim().length > 0) {
          // 5. Chunk text - larger chunks, no overlap for speed
          const chunks = textProcessor.chunkText(extracted.text, {
            maxTokens: 3000,  // 3x larger chunks
            overlap: 0,       // No overlap = faster
            minChunkLength: 50,
          });

          console.log(`    ✂️  Created ${chunks.length} chunks (optimized for speed)`);

          // 6. Upload chunks to Shelby, generate embeddings, and store metadata
          // Process chunks in parallel (batches of 5 to avoid overwhelming APIs)
          const BATCH_SIZE = 10;
          
          for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
            const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length);
            const batchChunks = chunks.slice(batchStart, batchEnd);
            
            // Process this batch in parallel
            const batchPromises = batchChunks.map(async (chunkText, batchIndex) => {
              const i = batchStart + batchIndex;
              try {
                const chunkBuffer = Buffer.from(chunkText, 'utf-8');

                // Upload chunk to Shelby and generate embedding in parallel
                const [chunkUpload, embedding] = await Promise.all([
                  this.storage.upload(chunkBuffer, {
                    contentType: 'text/plain',
                    metadata: {
                      path: `${packId}/${docId}/chunk_${i}`,
                      chunk_index: String(i),
                    },
                  }),
                  this.embeddings.embed(chunkText),
                ]);

                console.log(`      ☁️  Chunk ${i + 1}/${chunks.length} → ${chunkUpload.blob_id}`);

                // Store chunk metadata (not the text!)
                await this.database.createChunk({
                  chunk_id: uuid(),
                  pack_id: packId,
                  doc_id: docId,
                  shelby_chunk_blob_id: chunkUpload.blob_id,
                  chunk_index: i,
                  start_byte: null,
                  end_byte: null,
                  embedding,
                });

                return true;
              } catch (error: any) {
                console.error(`    Failed to process chunk ${i}:`, error.message);
                return false;
              }
            });

            // Wait for this batch to complete before starting next batch
            const results = await Promise.all(batchPromises);
            chunkCount += results.filter(r => r).length;
          }

          indexed = true;
          console.log(`    ✅ Uploaded & indexed ${chunkCount} chunks to Shelby`);
        }
      } catch (error: any) {
        console.error(`    Text extraction failed:`, error.message);
        // Non-fatal, file is still uploaded
      }
    } else {
      console.log(`    ⏭️  Skipped indexing (unsupported type)`);
    }

    return {
      path: file.path,
      mime: file.mime,
      bytes: file.buffer.length,
      sha256: fileHash,
      shelby_blob_id: uploadResult.blob_id,
      indexed,
      chunks: chunkCount,
    };
  }

  /**
   * Validate upload request
   */
  private validateRequest(request: UploadRequest) {
    if (!request.title || request.title.trim().length === 0) {
      throw new ValidationError('Title is required');
    }

    if (request.title.length > 200) {
      throw new ValidationError('Title must be 200 characters or less');
    }

    if (!request.files || request.files.length === 0) {
      throw new ValidationError('At least one file is required');
    }

    if (request.files.length > this.maxFilesPerPack) {
      throw new ValidationError(
        `Too many files (max: ${this.maxFilesPerPack})`
      );
    }

    // Validate each file
    for (const file of request.files) {
      if (file.buffer.length > this.maxFileBytes) {
        throw new ValidationError(
          `File ${file.path} exceeds size limit (${this.maxFileBytes} bytes)`
        );
      }

      if (!this.allowedMimeTypes.includes(file.mime)) {
        throw new ValidationError(
          `File type not allowed: ${file.mime}`
        );
      }
    }
  }

  /**
   * Get pack with details
   */
  async getPack(packId: string) {
    const pack = await this.database.getPack(packId);
    if (!pack) return null;

    const docs = await this.database.listDocs(packId);

    return {
      pack,
      docs,
    };
  }

  /**
   * Update pack visibility
   */
  async updateVisibility(
    packId: string,
    userId: string,
    visibility: 'private' | 'public' | 'unlisted'
  ) {
    // Verify ownership
    const pack = await this.database.getPack(packId);
    if (!pack) {
      throw new AppError('Pack not found', 'NOT_FOUND', 404);
    }

    if (pack.owner_user_id !== userId) {
      throw new AppError('Not authorized', 'FORBIDDEN', 403);
    }

    await this.database.updatePackVisibility(packId, visibility);
  }
}

