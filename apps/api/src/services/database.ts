/**
 * Database service initialization
 */

import { SQLiteDatabase } from '@shelby-rag/database';
import { config } from '../config';

// Initialize database
export const db = new SQLiteDatabase(config.database.url);

console.log(`📊 Database initialized: ${config.database.url}`);

// Log stats
const stats = db.getStats();
console.log(` Users: ${stats.users}, Packs: ${stats.packs}, Documents: ${stats.documents}, Chunks: ${stats.chunks}`);

