#!/usr/bin/env node

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function migrateJsonToPostgreSQL() {
  console.log('Starting JSON to PostgreSQL migration...');
  
  // Validate environment
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }
  
  // Connect to PostgreSQL
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });
  
  const db = drizzle({ client: pool });
  
  try {
    const dataDir = path.resolve(process.cwd(), "data");
    
    // Check if data directory exists
    if (!fs.existsSync(dataDir)) {
      console.log("No data directory found, nothing to migrate");
      return;
    }
    
    // Check if migration has already been run
    const migrationCheck = await db.execute(sql`
      SELECT COUNT(*) as count FROM snippets
    `);
    
    if (migrationCheck?.rows?.[0]?.count > 0) {
      console.log("Database already contains data, skipping migration");
      return;
    }
    
    // First, migrate folders to establish folder IDs
    const folderIdMap = new Map(); // Map old folder IDs to new ones
    const foldersPath = path.join(dataDir, "folders.json");
    if (fs.existsSync(foldersPath)) {
      console.log("Migrating folders...");
      const foldersData = JSON.parse(fs.readFileSync(foldersPath, 'utf8'));
      
      for (const folder of foldersData) {
        const mappedFolder = {
          name: folder.name,
          user_id: folder.userId,
          sort_order: folder.sortOrder || 0,
          created_at: new Date(folder.createdAt),
          updated_at: new Date(folder.updatedAt)
        };
        
        // Insert folder and get the new ID
        const result = await db.execute(sql`
          INSERT INTO folders (name, user_id, sort_order, created_at, updated_at)
          VALUES (${mappedFolder.name}, ${mappedFolder.user_id}, ${mappedFolder.sort_order}, ${mappedFolder.created_at}, ${mappedFolder.updated_at})
          RETURNING id
        `);
        
        const newFolderId = result?.rows?.[0]?.id;
        if (newFolderId) {
          folderIdMap.set(folder.id, newFolderId);
        }
      }
      console.log(`Migrated ${foldersData.length} folders`);
    }
    
    // Then migrate snippets with proper folder references
    const snippetsPath = path.join(dataDir, "snippets.json");
    if (fs.existsSync(snippetsPath)) {
      console.log("Migrating snippets...");
      const snippetsData = JSON.parse(fs.readFileSync(snippetsPath, 'utf8'));
      
      for (const snippet of snippetsData) {
        // Map old field names to new schema
        const mappedSnippet = {
          title: snippet.title,
          content: snippet.content,
          trigger: snippet.trigger,
          description: snippet.description || null,
          user_id: snippet.userId,
          folder_id: snippet.folderId ? folderIdMap.get(snippet.folderId) || null : null,
          created_at: new Date(snippet.createdAt),
          updated_at: new Date(snippet.updatedAt)
        };
        
        // Insert snippet
        await db.execute(sql`
          INSERT INTO snippets (title, content, trigger, description, user_id, folder_id, created_at, updated_at)
          VALUES (${mappedSnippet.title}, ${mappedSnippet.content}, ${mappedSnippet.trigger}, ${mappedSnippet.description}, ${mappedSnippet.user_id}, ${mappedSnippet.folder_id}, ${mappedSnippet.created_at}, ${mappedSnippet.updated_at})
        `);
      }
      console.log(`Migrated ${snippetsData.length} snippets`);
    }
    
    // Migrate clipboard items
    const clipboardPath = path.join(dataDir, "clipboard.json");
    if (fs.existsSync(clipboardPath)) {
      console.log("Migrating clipboard items...");
      const clipboardData = JSON.parse(fs.readFileSync(clipboardPath, 'utf8'));
      
      for (const item of clipboardData) {
        const mappedItem = {
          content: item.content,
          type: item.type || 'text',
          user_id: item.userId,
          created_at: new Date(item.createdAt)
        };
        
        // Insert clipboard item
        await db.execute(sql`
          INSERT INTO clipboard_items (content, type, user_id, created_at)
          VALUES (${mappedItem.content}, ${mappedItem.type}, ${mappedItem.user_id}, ${mappedItem.created_at})
        `);
      }
      console.log(`Migrated ${clipboardData.length} clipboard items`);
    }
    
    // Migrate settings
    const settingsPath = path.join(dataDir, "settings.json");
    if (fs.existsSync(settingsPath)) {
      console.log("Migrating settings...");
      const settingsData = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      
      for (const setting of settingsData) {
        const mappedSetting = {
          snippet_shortcut: setting.snippetShortcut || 'ctrl+;',
          clipboard_shortcut: setting.clipboardShortcut || 'ctrl+shift+v',
          clipboard_enabled: setting.clipboardEnabled ? 1 : 0,
          history_limit: setting.historyLimit || 100,
          launch_on_startup: setting.launchOnStartup ? 1 : 0,
          theme: setting.theme || 'light'
        };
        
        // Insert setting
        await db.execute(sql`
          INSERT INTO settings (snippet_shortcut, clipboard_shortcut, clipboard_enabled, history_limit, launch_on_startup, theme)
          VALUES (${mappedSetting.snippet_shortcut}, ${mappedSetting.clipboard_shortcut}, ${mappedSetting.clipboard_enabled}, ${mappedSetting.history_limit}, ${mappedSetting.launch_on_startup}, ${mappedSetting.theme})
        `);
      }
      console.log(`Migrated ${settingsData.length} settings`);
    }
    
    console.log("JSON data migration completed successfully");
    
  } catch (error) {
    console.error("Error during JSON data migration:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
migrateJsonToPostgreSQL()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  }); 