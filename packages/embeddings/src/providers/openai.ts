/**
 * OpenAI Embeddings Provider
 */

import OpenAI from 'openai';
import { EmbeddingProvider, AppError } from '@shelby-rag/shared';

export interface OpenAIEmbeddingsConfig {
  apiKey: string;
  model?: string;
  dimensions?: number;
}

export class OpenAIEmbeddingsProvider implements EmbeddingProvider {
  private client: OpenAI;
  private model: string;
  private dimension: number;

  constructor(config: OpenAIEmbeddingsConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
    
    // Default to text-embedding-3-small (1536 dimensions, cost-effective)
    this.model = config.model || 'text-embedding-3-small';
    this.dimension = config.dimensions || 1536;
  }

  async embed(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new AppError('Text cannot be empty', 'EMPTY_TEXT', 400);
    }

    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error: any) {
      throw new AppError(
        `OpenAI embedding failed: ${error.message}`,
        'OPENAI_EMBED_ERROR',
        500,
        { originalError: error }
      );
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    // Filter out empty texts
    const validTexts = texts.filter(t => t && t.trim().length > 0);
    if (validTexts.length === 0) {
      return [];
    }

    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: validTexts,
        encoding_format: 'float',
      });

      return response.data
        .sort((a, b) => a.index - b.index)
        .map(item => item.embedding);
    } catch (error: any) {
      throw new AppError(
        `OpenAI batch embedding failed: ${error.message}`,
        'OPENAI_BATCH_ERROR',
        500,
        { originalError: error }
      );
    }
  }

  getDimension(): number {
    return this.dimension;
  }

  getName(): string {
    return `openai-${this.model}`;
  }
}

