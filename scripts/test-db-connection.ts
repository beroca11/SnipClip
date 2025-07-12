#!/usr/bin/env node

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testDatabaseConnection() {
  console.log('Testing PostgreSQL database connection...');
  
  // Validate environment
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }
  
  console.log('✅ DATABASE_URL is configured');
  
  // Connect to PostgreSQL
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });
  
  const db = drizzle({ client: pool });
  
  try {
    // Test basic connection
    console.log('🔌 Testing database connection...');
    const result = await db.execute(sql`SELECT NOW() as current_time`);
    console.log('✅ Database connection successful');
    console.log(`📅 Current database time: ${result?.rows?.[0]?.current_time}`);
    
    // Check if tables exist
    console.log('📋 Checking database tables...');
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('snippets', 'folders', 'clipboard_items', 'settings')
      ORDER BY table_name
    `);
    
    const existingTables = tablesResult?.rows?.map(row => row.table_name) || [];
    console.log(`✅ Found ${existingTables.length} tables: ${existingTables.join(', ')}`);
    
    // Check data counts
    for (const table of ['snippets', 'folders', 'clipboard_items', 'settings']) {
      try {
        const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM ${sql.raw(table)}`);
        const count = countResult?.rows?.[0]?.count || 0;
        console.log(`📊 Table ${table}: ${count} records`);
      } catch (error) {
        console.log(`⚠️  Table ${table}: Not accessible or doesn't exist`);
      }
    }
    
    console.log('✅ Database test completed successfully');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the test
testDatabaseConnection()
  .then(() => {
    console.log('🎉 All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Tests failed:', error);
    process.exit(1);
  }); 