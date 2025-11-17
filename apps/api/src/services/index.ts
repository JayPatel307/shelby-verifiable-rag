/**
 * Services initialization
 * Sets up all dependencies for the application
 */

import { ShelbyClient } from '@shelby-rag/shelby-client';
import { createEmbeddingsProvider } from '@shelby-rag/embeddings';
import { PackManager, QueryEngine, Verifier } from '@shelby-rag/core';
import { config } from '../config';
import { db } from './database';
import crypto from 'crypto';

// Initialize Shelby client (or use mock for testing)
console.log('☁️  Initializing storage client...');
let shelbyClient: any;

try {
  shelbyClient = new ShelbyClient({
    apiKey: config.shelby.apiKey, // Optional - only for rate limiting
    privateKey: config.shelby.privateKey, // Optional - generates new account if not provided
    expirationDays: config.shelby.expirationDays,
  });
  console.log(`   ✅ Real Shelby client initialized`);
  console.log(`   Account: ${shelbyClient.getAccountAddress()}`);
} catch (error: any) {
  console.warn(`   ⚠️  Shelby client failed: ${error.message}`);
  console.warn(`   ⚠️  Using MOCK storage for testing (uploads won't persist to Shelby)`);
  
  // Mock storage for testing without Shelby
  shelbyClient = {
    upload: async (data: Buffer, opts: any) => ({
      blob_id: `mock:${Date.now()}`,
      sha256: crypto.createHash('sha256').update(data).digest('hex'),
      bytes: data.length,
    }),
    download: async (blobId: string) => Buffer.from('mock data'),
    exists: async () => true,
    getMetadata: async (blobId: string) => ({ blob_id: blobId, bytes: 0 }),
    getAccountAddress: () => 'mock-account',
  };
}

export { shelbyClient };

// Initialize embeddings provider
console.log(`🤖 Initializing embeddings (${config.embeddings.provider})...`);
export const embeddingsProvider = createEmbeddingsProvider({
  provider: config.embeddings.provider,
  apiKey: config.embeddings.apiKey,
  dimensions: 1536, // OpenAI text-embedding-3-small
});

console.log(`   Dimension: ${embeddingsProvider.getDimension()}`);

// Initialize Pack Manager
export const packManager = new PackManager({
  storage: shelbyClient,
  database: db,
  embeddings: embeddingsProvider,
  maxFileBytes: config.upload.maxFileBytes,
  maxFilesPerPack: config.upload.maxFilesPerPack,
  allowedMimeTypes: config.upload.allowedMimeTypes,
});

// Initialize Query Engine
export const queryEngine = new QueryEngine({
  database: db,
  embeddings: embeddingsProvider,
  llm: config.llm,
});

// Initialize Verifier
export const verifier = new Verifier(shelbyClient);

console.log('✅ All services initialized\n');

