import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from "@shared/schema";

// Configure Neon for serverless environment - proper WebSocket constructor
neonConfig.webSocketConstructor = ws;

// Only create pool if DATABASE_URL is available
export const pool = process.env.DATABASE_URL ? new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Add connection pooling configuration to handle connection issues
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}) : null;

export const db = pool ? drizzle({ client: pool, schema }) : null;
