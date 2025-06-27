import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleSQLite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import ws from 'ws';
import * as schema from "@shared/schema";
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Configure Neon for serverless environment - proper WebSocket constructor
neonConfig.webSocketConstructor = ws;

// Determine storage type based on environment
const isDevelopment = process.env.NODE_ENV === 'development';
const hasDatabaseUrl = !!process.env.DATABASE_URL;
const useSQLite = isDevelopment && !hasDatabaseUrl;

let pool: Pool | null = null;
let sqliteDb: Database.Database | null = null;
let db: any = null;

if (hasDatabaseUrl) {
  // Use Neon PostgreSQL (production or when DATABASE_URL is provided)
  pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  db = drizzle({ client: pool, schema });
  console.log('Using Neon PostgreSQL database');
} else if (useSQLite) {
  // Use SQLite for development
  const dataDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const dbPath = path.join(dataDir, "snippets.db");
  sqliteDb = new Database(dbPath);
  db = drizzleSQLite(sqliteDb, { schema });
  console.log('Using SQLite database for development');
} else {
  // Fallback to file storage
  console.log('No database configured, using file storage');
}

export { pool, db };

// Cleanup function for graceful shutdown
export function cleanup() {
  if (pool) {
    pool.end();
  }
  if (sqliteDb) {
    sqliteDb.close();
  }
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
