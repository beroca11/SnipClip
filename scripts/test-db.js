#!/usr/bin/env node

import { Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Configure Neon for serverless environment
neonConfig.webSocketConstructor = ws;

async function testDatabaseConnection() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log('❌ DATABASE_URL not found in environment variables');
    console.log('Please set DATABASE_URL with your Neon connection string');
    process.exit(1);
  }

  console.log('🔍 Testing database connection...');
  
  try {
    const pool = new Pool({ 
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Database connection successful!');

    // Test query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Database query successful!');
    console.log(`   Current database time: ${result.rows[0].current_time}`);

    // Test table creation (if they don't exist)
    console.log('🔧 Checking/creating tables...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS snippets (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        trigger TEXT NOT NULL UNIQUE,
        category TEXT,
        description TEXT,
        parent_id INTEGER,
        user_id TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS clipboard_items (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'text',
        user_id TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        snippet_shortcut TEXT NOT NULL DEFAULT 'ctrl+;',
        clipboard_shortcut TEXT NOT NULL DEFAULT 'ctrl+shift+v',
        clipboard_enabled INTEGER NOT NULL DEFAULT 1,
        history_limit INTEGER NOT NULL DEFAULT 100,
        launch_on_startup INTEGER NOT NULL DEFAULT 0,
        theme TEXT NOT NULL DEFAULT 'light'
      )
    `);

    console.log('✅ Tables created/verified successfully!');

    // Test insert and select
    console.log('🧪 Testing data operations...');
    
    const testSnippet = {
      title: 'Test Snippet',
      content: 'console.log("Hello World");',
      trigger: 'test',
      user_id: 'test-user'
    };

    const insertResult = await client.query(`
      INSERT INTO snippets (title, content, trigger, user_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [testSnippet.title, testSnippet.content, testSnippet.trigger, testSnippet.user_id]);

    console.log(`✅ Insert successful! Created snippet with ID: ${insertResult.rows[0].id}`);

    // Clean up test data
    await client.query('DELETE FROM snippets WHERE trigger = $1', [testSnippet.trigger]);
    console.log('✅ Test data cleaned up successfully!');

    client.release();
    await pool.end();
    
    console.log('\n🎉 Database test completed successfully!');
    console.log('Your Neon database is properly configured and ready to use.');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error('Please check your DATABASE_URL and try again.');
    process.exit(1);
  }
}

testDatabaseConnection(); 