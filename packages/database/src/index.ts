/**
 * Database package - Multiple implementations
 */

export { SQLiteDatabase } from './sqlite';
export { PostgreSQLDatabase, type PostgreSQLConfig } from './postgres';

import { DatabaseClient } from '@shelby-rag/shared';
import { SQLiteDatabase } from './sqlite';
import { PostgreSQLDatabase, PostgreSQLConfig } from './postgres';

/**
 * Create database client based on DATABASE_URL
 * Auto-detects PostgreSQL vs SQLite
 */
export function createDatabase(url: string): DatabaseClient {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    console.log('📊 Using PostgreSQL database');
    return new PostgreSQLDatabase(url);
  } else {
    console.log('📊 Using SQLite database');
    return new SQLiteDatabase(url);
  }
}

