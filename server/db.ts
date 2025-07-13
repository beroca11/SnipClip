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

// Environment variable validation
function validateEnvironment() {
  const required = ['NODE_ENV'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`Missing environment variables: ${missing.join(', ')}`);
  }
  
  // Validate DATABASE_URL format if provided
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
        throw new Error('Invalid DATABASE_URL protocol');
      }
    } catch (error) {
      console.error('Invalid DATABASE_URL format:', error);
      throw new Error('DATABASE_URL must be a valid PostgreSQL connection string');
    }
  }
  
  // Validate SESSION_SECRET
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
    console.warn('SESSION_SECRET should be at least 32 characters long for security');
  }
}

// Run environment validation
validateEnvironment();

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
  try {
    pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      // Add SSL configuration for production
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });
    
      // Test the connection
  pool.on('error', (err: any) => {
    console.error('Database connection error:', err);
  });
    
    db = drizzle({ client: pool, schema });
    console.log('Using Neon PostgreSQL database');
  } catch (error) {
    console.error('Failed to initialize Neon database:', error);
    console.log('Falling back to SQLite...');
    
    // Fallback to SQLite
    const dataDir = path.resolve(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const dbPath = path.join(dataDir, "snippets.db");
    sqliteDb = new Database(dbPath);
    
    // Enable WAL mode for better performance and concurrency
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('synchronous = NORMAL');
    sqliteDb.pragma('cache_size = 1000');
    sqliteDb.pragma('temp_store = memory');
    
    db = drizzleSQLite(sqliteDb, { schema });
    console.log('Using SQLite database (fallback)');
  }
} else if (useSQLite) {
  // Use SQLite for development
  const dataDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const dbPath = path.join(dataDir, "snippets.db");
  sqliteDb = new Database(dbPath);
  
  // Enable WAL mode for better performance and concurrency
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('synchronous = NORMAL');
  sqliteDb.pragma('cache_size = 1000');
  sqliteDb.pragma('temp_store = memory');
  
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

// Handle graceful shutdown
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
