/**
 * Configuration loader
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  
  database: {
    url: process.env.DATABASE_URL || './data.sqlite',
  },
  
  shelby: {
    network: process.env.SHELBY_NETWORK || 'SHELBYNET',
    apiKey: process.env.SHELBY_API_KEY,
    privateKey: process.env.APTOS_PRIVATE_KEY,
    expirationDays: parseInt(process.env.SHELBY_EXPIRATION_DAYS || '30', 10),
  },
  
  embeddings: {
    provider: (process.env.EMBEDDINGS_PROVIDER || 'openai') as 'openai' | 'local',
    apiKey: process.env.OPENAI_API_KEY,
  },
  
  llm: {
    provider: (process.env.LLM_PROVIDER || 'openai') as 'openai' | 'anthropic',
    apiKey: process.env.OPENAI_API_KEY!,
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
  },
  
  upload: {
    maxFileBytes: parseInt(process.env.MAX_FILE_BYTES || '26214400', 10),
    maxFilesPerPack: parseInt(process.env.MAX_FILES_PER_PACK || '1000', 10),
    allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES || 
      'application/pdf,text/plain,text/markdown,text/html,text/csv,application/json,image/png,image/jpeg,image/jpg,image/webp'
    ).split(','),
  },
  
  ocr: {
    enabledDefault: process.env.OCR_ENABLED_DEFAULT === 'true',
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  
  session: {
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  },
};

// Validate required config
if (!config.llm.apiKey && config.embeddings.provider === 'openai') {
  console.warn('⚠️  OPENAI_API_KEY not set. Some features will not work.');
}

if (!config.shelby.apiKey) {
  console.warn('⚠️  SHELBY_API_KEY not set. Using without API key (may be rate limited).');
}

if (!config.shelby.privateKey) {
  console.warn('⚠️  APTOS_PRIVATE_KEY not set. A new account will be generated.');
}

