#!/usr/bin/env tsx

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core';
import ws from 'ws';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

// Define the actual database schema based on introspection
const folders = pgTable("folders", {
  id: serial().primaryKey().notNull(),
  name: text().notNull(),
  parentId: integer("parent_id"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
  userId: text("user_id").default('default').notNull(),
});

const snippets = pgTable("snippets", {
  id: serial().primaryKey().notNull(),
  title: text().notNull(),
  content: text().notNull(),
  trigger: text().notNull(),
  category: text(),
  description: text(),
  parentId: integer("parent_id"),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
  folderId: integer("folder_id"),
});

const clipboardItems = pgTable("clipboard_items", {
  id: serial().primaryKey().notNull(),
  content: text().notNull(),
  type: text().default('text').notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

async function checkExistingData() {
  console.log('🔍 Checking Existing Data in Neon Database');
  console.log('==========================================\n');

  try {
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL not found in environment variables');
      return;
    }

    console.log('📡 Connecting to Neon database...');
    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    
    const db = drizzle({ client: pool });
    console.log('✅ Connected successfully\n');

    // Check folders
    console.log('📁 Checking folders...');
    const folderData = await db.select().from(folders);
    console.log(`Found ${folderData.length} folders:`);
    folderData.forEach((folder, index) => {
      console.log(`  ${index + 1}. "${folder.name}" (User: ${folder.userId}, ID: ${folder.id})`);
    });

    // Check snippets
    console.log('\n📝 Checking snippets...');
    const snippetData = await db.select().from(snippets);
    console.log(`Found ${snippetData.length} snippets:`);
    snippetData.slice(0, 10).forEach((snippet, index) => {
      console.log(`  ${index + 1}. "${snippet.title}" (User: ${snippet.userId}, Trigger: ${snippet.trigger})`);
    });
    if (snippetData.length > 10) {
      console.log(`  ... and ${snippetData.length - 10} more snippets`);
    }

    // Check clipboard items
    console.log('\n📋 Checking clipboard items...');
    const clipboardData = await db.select().from(clipboardItems);
    console.log(`Found ${clipboardData.length} clipboard items:`);
    clipboardData.slice(0, 5).forEach((item, index) => {
      console.log(`  ${index + 1}. User: ${item.userId}, Content: "${item.content.substring(0, 50)}..."`);
    });

    // Get unique users
    console.log('\n👥 Unique users found:');
    const userIds = new Set<string>();
    
    folderData.forEach(f => userIds.add(f.userId));
    snippetData.forEach(s => userIds.add(s.userId));
    clipboardData.forEach(c => userIds.add(c.userId));

    const uniqueUsers = Array.from(userIds).sort();
    console.log(`Found ${uniqueUsers.length} unique users:`);
    uniqueUsers.forEach((userId, index) => {
      const userFolders = folderData.filter(f => f.userId === userId).length;
      const userSnippets = snippetData.filter(s => s.userId === userId).length;
      const userClipboard = clipboardData.filter(c => c.userId === userId).length;
      
      console.log(`  ${index + 1}. "${userId}"`);
      console.log(`     - Folders: ${userFolders}`);
      console.log(`     - Snippets: ${userSnippets}`);
      console.log(`     - Clipboard: ${userClipboard}`);
    });

    await pool.end();
    console.log('\n✅ Data check completed successfully');

  } catch (error) {
    console.error('\n❌ Error checking data:', error);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  checkExistingData().catch(console.error);
} 