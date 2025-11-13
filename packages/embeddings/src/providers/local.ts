/**
 * Local Embeddings Provider (for development/testing)
 * Uses simple hash-based embeddings - NOT suitable for production!
 */

import crypto from 'crypto';
import { EmbeddingProvider } from '@shelby-rag/shared';

export class LocalEmbeddingsProvider implements EmbeddingProvider {
  private dimension: number;

  constructor(dimension: number = 256) {
    this.dimension = dimension;
  }

  async embed(text: string): Promise<number[]> {
    // Simple hash-based embedding for dev/testing
    // WARNING: This is NOT semantically meaningful!
    const hash = crypto.createHash('sha256').update(text).digest();
    
    // Convert hash bytes to normalized float array
    const embedding: number[] = [];
    for (let i = 0; i < Math.min(this.dimension, hash.length); i++) {
      // Normalize to [-1, 1]
      embedding.push((hash[i] - 128) / 128);
    }
    
    // Pad if needed
    while (embedding.length < this.dimension) {
      embedding.push(0);
    }
    
    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Sequential embedding for local (no API)
    const embeddings: number[][] = [];
    for (const text of texts) {
      embeddings.push(await this.embed(text));
    }
    return embeddings;
  }

  getDimension(): number {
    return this.dimension;
  }

  getName(): string {
    return 'local-hash';
  }
}

