/**
 * Embeddings Package
 * Provides text embedding functionality with multiple providers
 */

export { OpenAIEmbeddingsProvider } from './providers/openai';
export { LocalEmbeddingsProvider } from './providers/local';
export { createEmbeddingsProvider, type EmbeddingsConfig, type ProviderType } from './factory';

