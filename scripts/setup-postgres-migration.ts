#!/usr/bin/env node

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import readline from 'readline';
import ws from 'ws';

// Load environment variables
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupPostgreSQLMigration() {
  console.log('🚀 SnipClip PostgreSQL Migration Setup');
  console.log('=====================================\n');

  let databaseUrl = process.env.DATABASE_URL;

  // If no DATABASE_URL is set, help user set it up
  if (!databaseUrl) {
    console.log('❌ No DATABASE_URL found in environment variables.');
    console.log('\nTo set up PostgreSQL, you have several options:');
    console.log('1. Neon (Recommended) - https://neon.tech');
    console.log('2. Supabase - https://supabase.com');
    console.log('3. Railway - https://railway.app');
    console.log('4. Any other PostgreSQL provider\n');

    const useNeon = await question('Would you like help setting up with Neon? (y/n): ');
    
    if (useNeon.toLowerCase() === 'y') {
      console.log('\n📋 Neon Setup Instructions:');
      console.log('1. Go to https://neon.tech and create an account');
      console.log('2. Create a new project');
      console.log('3. Copy the connection string from your dashboard');
      console.log('4. It should look like: postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require\n');
      
      databaseUrl = await question('Paste your Neon connection string here: ');
      
      if (databaseUrl) {
        // Save to .env file
        const envPath = path.join(process.cwd(), '.env');
        const envContent = `DATABASE_URL=${databaseUrl}\nNODE_ENV=production\nSESSION_SECRET=${generateSessionSecret()}\n`;
        
        fs.writeFileSync(envPath, envContent);
        console.log('✅ Saved DATABASE_URL to .env file');
        
        // Reload environment variables
        dotenv.config();
      }
    } else {
      databaseUrl = await question('Please paste your PostgreSQL connection string: ');
    }
  }

  if (!databaseUrl) {
    console.log('❌ No DATABASE_URL provided. Migration cannot proceed.');
    process.exit(1);
  }

  // Validate the connection string
  try {
    const url = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }
    console.log('✅ DATABASE_URL format is valid');
  } catch (error) {
    console.log('❌ Invalid DATABASE_URL format. Please check your connection string.');
    process.exit(1);
  }

  // Configure Neon for serverless environment
  neonConfig.webSocketConstructor = ws;
  
  // Test database connection
  console.log('\n🔌 Testing database connection...');
  const pool = new Pool({ 
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  
  const db = drizzle({ client: pool });

  try {
    const result = await db.execute(sql`SELECT NOW() as current_time`);
    console.log('✅ Database connection successful');
    console.log(`📅 Database time: ${result?.rows?.[0]?.current_time}`);
  } catch (error) {
    console.log('❌ Database connection failed:', error);
    console.log('\nPlease check:');
    console.log('1. Your connection string is correct');
    console.log('2. Your database is accessible');
    console.log('3. Your IP is whitelisted (if required)');
    process.exit(1);
  }

  // Check if tables exist
  console.log('\n📋 Checking database schema...');
  try {
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('snippets', 'folders', 'clipboard_items', 'settings')
      ORDER BY table_name
    `);
    
    const existingTables = tablesResult?.rows?.map(row => row.table_name) || [];
    console.log(`Found ${existingTables.length} existing tables: ${existingTables.join(', ')}`);

    // Check if data exists
    if (existingTables.length > 0) {
      const dataCheck = await db.execute(sql`SELECT COUNT(*) as count FROM snippets`);
      const snippetCount = parseInt(dataCheck?.rows?.[0]?.count as string) || 0;
      
      if (snippetCount > 0) {
        console.log(`⚠️  Database already contains ${snippetCount} snippets.`);
        const proceed = await question('Do you want to proceed with migration anyway? (y/n): ');
        if (proceed.toLowerCase() !== 'y') {
          console.log('Migration cancelled.');
          process.exit(0);
        }
      }
    }
  } catch (error) {
    console.log('⚠️  Could not check existing tables, proceeding with migration...');
  }

  // Run schema migration
  console.log('\n🏗️  Creating database schema...');
  try {
    await runSchemaMigration(db);
    console.log('✅ Database schema created successfully');
  } catch (error) {
    console.log('❌ Schema migration failed:', error);
    process.exit(1);
  }

  // Run data migration
  console.log('\n📦 Migrating data from JSON files...');
  try {
    await migrateJsonData(db);
    console.log('✅ Data migration completed successfully');
  } catch (error) {
    console.log('❌ Data migration failed:', error);
    process.exit(1);
  }

  // Final verification
  console.log('\n🔍 Verifying migration...');
  try {
    const finalCheck = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM snippets) as snippets,
        (SELECT COUNT(*) FROM folders) as folders,
        (SELECT COUNT(*) FROM clipboard_items) as clipboard_items,
        (SELECT COUNT(*) FROM settings) as settings
    `);
    
    const counts = finalCheck?.rows?.[0];
    console.log('📊 Final data counts:');
    console.log(`   Snippets: ${counts?.snippets || 0}`);
    console.log(`   Folders: ${counts?.folders || 0}`);
    console.log(`   Clipboard items: ${counts?.clipboard_items || 0}`);
    console.log(`   Settings: ${counts?.settings || 0}`);
  } catch (error) {
    console.log('⚠️  Could not verify final counts:', error);
  }

  await pool.end();
  rl.close();
  
  console.log('\n🎉 Migration completed successfully!');
  console.log('\nNext steps:');
  console.log('1. Deploy your application');
  console.log('2. The system will now use PostgreSQL');
  console.log('3. Your JSON files remain as backup');
}

async function runSchemaMigration(db: any) {
  // Create folders table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS folders (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(name, user_id)
    )
  `);

  // Create snippets table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS snippets (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      trigger TEXT NOT NULL,
      description TEXT,
      folder_id INTEGER REFERENCES folders(id),
      user_id TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(trigger, user_id)
    )
  `);

  // Create clipboard_items table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS clipboard_items (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      user_id TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // Create settings table
  await db.execute(sql`
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

  // Create indexes
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_snippets_user_id ON snippets(user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_snippets_trigger ON snippets(trigger)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_clipboard_items_user_id ON clipboard_items(user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_clipboard_items_created_at ON clipboard_items(created_at)`);
}

async function migrateJsonData(db: any) {
  const dataDir = path.resolve(process.cwd(), "data");
  
  if (!fs.existsSync(dataDir)) {
    console.log("No data directory found, skipping data migration");
    return;
  }

  // Check if data already exists in database
  const existingDataCheck = await db.execute(sql`
    SELECT 
      (SELECT COUNT(*) FROM snippets) as snippets,
      (SELECT COUNT(*) FROM folders) as folders,
      (SELECT COUNT(*) FROM clipboard_items) as clipboard_items,
      (SELECT COUNT(*) FROM settings) as settings
  `);
  
  const existingCounts = existingDataCheck?.rows?.[0];
  const hasExistingData = (parseInt(existingCounts?.snippets as string) || 0) > 0 || 
                         (parseInt(existingCounts?.folders as string) || 0) > 0;
  
  if (hasExistingData) {
    console.log("⚠️  Database already contains data:");
    console.log(`   Snippets: ${existingCounts?.snippets || 0}`);
    console.log(`   Folders: ${existingCounts?.folders || 0}`);
    console.log(`   Clipboard items: ${existingCounts?.clipboard_items || 0}`);
    console.log(`   Settings: ${existingCounts?.settings || 0}`);
    console.log("✅ Migration already completed successfully!");
    return;
  }

  // First, migrate folders to establish folder IDs
  const folderIdMap = new Map();
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
      
      // Use ON CONFLICT to handle duplicates gracefully
      const result = await db.execute(sql`
        INSERT INTO folders (name, user_id, sort_order, created_at, updated_at)
        VALUES (${mappedFolder.name}, ${mappedFolder.user_id}, ${mappedFolder.sort_order}, ${mappedFolder.created_at}, ${mappedFolder.updated_at})
        ON CONFLICT (name, user_id) DO UPDATE SET
          sort_order = EXCLUDED.sort_order,
          updated_at = EXCLUDED.updated_at
        RETURNING id
      `);
      
      const newFolderId = result?.rows?.[0]?.id;
      if (newFolderId) {
        folderIdMap.set(folder.id, newFolderId);
      }
    }
    console.log(`✅ Migrated ${foldersData.length} folders`);
  }
  
  // Then migrate snippets
  const snippetsPath = path.join(dataDir, "snippets.json");
  if (fs.existsSync(snippetsPath)) {
    console.log("Migrating snippets...");
    const snippetsData = JSON.parse(fs.readFileSync(snippetsPath, 'utf8'));
    
    for (const snippet of snippetsData) {
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
      
      // Use ON CONFLICT to handle duplicates gracefully
      await db.execute(sql`
        INSERT INTO snippets (title, content, trigger, description, user_id, folder_id, created_at, updated_at)
        VALUES (${mappedSnippet.title}, ${mappedSnippet.content}, ${mappedSnippet.trigger}, ${mappedSnippet.description}, ${mappedSnippet.user_id}, ${mappedSnippet.folder_id}, ${mappedSnippet.created_at}, ${mappedSnippet.updated_at})
        ON CONFLICT (trigger, user_id) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          description = EXCLUDED.description,
          folder_id = EXCLUDED.folder_id,
          updated_at = EXCLUDED.updated_at
      `);
    }
    console.log(`✅ Migrated ${snippetsData.length} snippets`);
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
      
      await db.execute(sql`
        INSERT INTO clipboard_items (content, type, user_id, created_at)
        VALUES (${mappedItem.content}, ${mappedItem.type}, ${mappedItem.user_id}, ${mappedItem.created_at})
      `);
    }
    console.log(`✅ Migrated ${clipboardData.length} clipboard items`);
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
      
      await db.execute(sql`
        INSERT INTO settings (snippet_shortcut, clipboard_shortcut, clipboard_enabled, history_limit, launch_on_startup, theme)
        VALUES (${mappedSetting.snippet_shortcut}, ${mappedSetting.clipboard_shortcut}, ${mappedSetting.clipboard_enabled}, ${mappedSetting.history_limit}, ${mappedSetting.launch_on_startup}, ${mappedSetting.theme})
      `);
    }
    console.log(`✅ Migrated ${settingsData.length} settings`);
  }
}

function generateSessionSecret(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Run the setup
setupPostgreSQLMigration()
  .then(() => {
    console.log('\n🎉 Setup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Setup failed:', error);
    process.exit(1);
  }); 