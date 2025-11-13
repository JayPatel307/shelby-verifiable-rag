/**
 * Services initialization
 * Sets up all dependencies for the application
 */

import { ShelbyClient } from '@shelby-rag/shelby-client';
import { createEmbeddingsProvider } from '@shelby-rag/embeddings';
import { PackManager, QueryEngine, Verifier } from '@shelby-rag/core';
import { config } from '../config';
import { db } from './database';

// Initialize Shelby client
console.log('☁️  Initializing Shelby client...');
export const shelbyClient = new ShelbyClient({
  network: config.shelby.network,
  apiKey: config.shelby.apiKey,
  privateKey: config.shelby.privateKey,
  expirationDays: config.shelby.expirationDays,
});

console.log(`   Account: ${shelbyClient.getAccountAddress()}`);

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

