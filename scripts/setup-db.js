#!/usr/bin/env node

/**
 * Database Setup Script for SnippetStack
 * 
 * This script helps set up and test the database configuration.
 * Usage:
 *   node scripts/setup-db.js [command]
 * 
 * Commands:
 *   init     - Initialize database tables
 *   test     - Test database connection and basic operations
 *   reset    - Reset database (drop and recreate tables)
 *   status   - Show current database status
 */

// Import the compiled JavaScript files
import { db } from '../dist/db.js';
import { runMigrations } from '../dist/migrations.js';
import { storage } from '../dist/storage.js';

const command = process.argv[2] || 'status';

async function showStatus() {
  console.log('=== SnippetStack Database Status ===');
  
  if (!db) {
    console.log('❌ No database configured');
    console.log('   - Set DATABASE_URL for PostgreSQL (production)');
    console.log('   - Or run in development mode for SQLite');
    return;
  }

  const isSQLite = db.dialect && db.dialect.name === 'sqlite';
  console.log(`✅ Database: ${isSQLite ? 'SQLite' : 'PostgreSQL'}`);
  
  if (isSQLite) {
    console.log('   - Using local SQLite database for development');
    console.log('   - Database file: data/snippets.db');
  } else {
    console.log('   - Using PostgreSQL database');
  }

  try {
    // Test connection
    await db.run('SELECT 1');
    console.log('✅ Database connection: OK');
  } catch (error) {
    console.log('❌ Database connection: FAILED');
    console.log('   Error:', error.message);
  }
}

async function initDatabase() {
  console.log('=== Initializing Database ===');
  
  if (!db) {
    console.log('❌ No database configured');
    return;
  }

  try {
    await runMigrations();
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.log('❌ Database initialization failed:', error.message);
  }
}

async function testDatabase() {
  console.log('=== Testing Database Operations ===');
  
  if (!db) {
    console.log('❌ No database configured');
    return;
  }

  try {
    // Test basic operations
    const testUserId = 'test-user-' + Date.now();
    
    // Test settings
    console.log('Testing settings...');
    const settings = await storage.getSettings();
    console.log('✅ Settings retrieved:', settings);
    
    // Test snippet creation
    console.log('Testing snippet creation...');
    const snippet = await storage.createSnippet({
      title: 'Test Snippet',
      content: 'console.log("Hello World");',
      trigger: 'test',
      category: 'test'
    }, testUserId);
    console.log('✅ Snippet created:', snippet);
    
    // Test snippet retrieval
    const snippets = await storage.getSnippets(testUserId);
    console.log('✅ Snippets retrieved:', snippets.length);
    
    // Test clipboard item creation
    console.log('Testing clipboard item creation...');
    const clipboardItem = await storage.createClipboardItem({
      content: 'Test clipboard content',
      type: 'text'
    }, testUserId);
    console.log('✅ Clipboard item created:', clipboardItem);
    
    // Cleanup test data
    await storage.deleteSnippet(snippet.id, testUserId);
    await storage.deleteClipboardItem(clipboardItem.id, testUserId);
    
    console.log('✅ All database operations successful');
  } catch (error) {
    console.log('❌ Database test failed:', error.message);
  }
}

async function resetDatabase() {
  console.log('=== Resetting Database ===');
  
  if (!db) {
    console.log('❌ No database configured');
    return;
  }

  const isSQLite = db.dialect && db.dialect.name === 'sqlite';
  
  try {
    if (isSQLite) {
      // For SQLite, we can drop and recreate tables
      await db.run('DROP TABLE IF EXISTS snippets');
      await db.run('DROP TABLE IF EXISTS clipboard_items');
      await db.run('DROP TABLE IF EXISTS settings');
      console.log('✅ Tables dropped');
    } else {
      // For PostgreSQL, we'll truncate tables instead
      await db.run('TRUNCATE TABLE snippets, clipboard_items, settings RESTART IDENTITY CASCADE');
      console.log('✅ Tables truncated');
    }
    
    await runMigrations();
    console.log('✅ Database reset successfully');
  } catch (error) {
    console.log('❌ Database reset failed:', error.message);
  }
}

// Main execution
async function main() {
  switch (command) {
    case 'init':
      await initDatabase();
      break;
    case 'test':
      await testDatabase();
      break;
    case 'reset':
      await resetDatabase();
      break;
    case 'status':
    default:
      await showStatus();
      break;
  }
  
  process.exit(0);
}

main().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
}); 