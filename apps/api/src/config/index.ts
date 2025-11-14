/**
 * Configuration loader
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  
  database: {
    url: process.env.DATABASE_URL || './data.sqlite',
  },
  
  shelby: {
    apiKey: process.env.SHELBY_API_KEY, // Optional - only for rate limiting
    privateKey: process.env.APTOS_PRIVATE_KEY, // Optional - generates new account if not provided
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
  console.warn('⚠️  OPENAI_API_KEY not set. Queries will not work.');
}

// Shelby configuration notes
if (!config.shelby.apiKey) {
  console.log('ℹ️  SHELBY_API_KEY not set (optional - only needed to avoid rate limits)');
}

if (!config.shelby.privateKey) {
  console.log('ℹ️  APTOS_PRIVATE_KEY not set. A new account will be generated.');
  console.log('ℹ️  Note: You\'ll need to fund this account with APT and ShelbyUSD tokens for uploads.');
}

