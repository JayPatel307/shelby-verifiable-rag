/**
 * Embeddings Provider Factory
 * Creates the appropriate provider based on configuration
 */

import { EmbeddingProvider, AppError } from '@shelby-rag/shared';
import { OpenAIEmbeddingsProvider } from './providers/openai';
import { LocalEmbeddingsProvider } from './providers/local';

export type ProviderType = 'openai' | 'local' | 'cohere';

export interface EmbeddingsConfig {
  provider: ProviderType;
  apiKey?: string;
  model?: string;
  dimensions?: number;
}

export function createEmbeddingsProvider(config: EmbeddingsConfig): EmbeddingProvider {
  switch (config.provider) {
    case 'openai':
      if (!config.apiKey) {
        throw new AppError(
          'OpenAI API key is required',
          'MISSING_API_KEY',
          400
        );
      }
      return new OpenAIEmbeddingsProvider({
        apiKey: config.apiKey,
        model: config.model,
        dimensions: config.dimensions,
      });

    case 'local':
      console.warn('⚠️  Using local hash-based embeddings (not semantically meaningful)');
      return new LocalEmbeddingsProvider(config.dimensions || 256);

    case 'cohere':
      throw new AppError(
        'Cohere provider not yet implemented',
        'UNSUPPORTED_PROVIDER',
        501
      );

    default:
      throw new AppError(
        `Unknown embeddings provider: ${config.provider}`,
        'INVALID_PROVIDER',
        400
      );
  }
}

