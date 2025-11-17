/**
 * Database service initialization
 * Auto-detects SQLite vs PostgreSQL based on DATABASE_URL
 */

import { createDatabase } from '@shelby-rag/database';
import { config } from '../config';

// Initialize database (auto-detects SQLite vs PostgreSQL)
export const db = createDatabase(config.database.url);

console.log(`📊 Database initialized: ${config.database.url}`);

// Log stats (async for PostgreSQL)
db.getStats().then(stats => {
  console.log(` Users: ${stats.users}, Packs: ${stats.packs}, Documents: ${stats.documents}, Chunks: ${stats.chunks}`);
}).catch(err => {
  console.warn('Could not load stats:', err.message);
});

