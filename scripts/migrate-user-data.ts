#!/usr/bin/env tsx

import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleSQLite } from 'drizzle-orm/better-sqlite3';
import { Pool, neonConfig } from '@neondatabase/serverless';
import Database from 'better-sqlite3';
import ws from 'ws';
import * as schema from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

export interface MigrationOptions {
  sourceUserId: string;
  targetUserId: string;
  includeFolders: boolean;
  includeSnippets: boolean;
  includeClipboardItems: boolean;
  includeSettings: boolean;
  dryRun: boolean;
  force: boolean;
}

interface MigrationStats {
  foldersMigrated: number;
  snippetsMigrated: number;
  clipboardItemsMigrated: number;
  settingsMigrated: number;
  errors: string[];
}

class UserDataMigrator {
  private db: any;
  private isSQLite: boolean;

  constructor() {
    this.initializeDatabase();
  }

  private initializeDatabase() {
    const hasDatabaseUrl = !!process.env.DATABASE_URL;
    
    if (hasDatabaseUrl) {
      // Use PostgreSQL
      const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      });
      this.db = drizzle({ client: pool, schema });
      this.isSQLite = false;
      console.log('Connected to PostgreSQL database');
    } else {
      // Use SQLite
      const dataDir = path.resolve(process.cwd(), "data");
      const dbPath = path.join(dataDir, "snippets.db");
      
      if (!fs.existsSync(dbPath)) {
        throw new Error(`SQLite database not found at ${dbPath}`);
      }
      
      const sqliteDb = new Database(dbPath);
      this.db = drizzleSQLite(sqliteDb, { schema });
      this.isSQLite = true;
      console.log('Connected to SQLite database');
    }
  }

  async getUserData(userId: string) {
    try {
      const folders = await this.db.select().from(schema.folders).where(eq(schema.folders.userId, userId));
      const snippets = await this.db.select().from(schema.snippets).where(eq(schema.snippets.userId, userId));
      const clipboardItems = await this.db.select().from(schema.clipboardItems).where(eq(schema.clipboardItems.userId, userId));
      const settings = await this.db.select().from(schema.settings);

      return { folders, snippets, clipboardItems, settings };
    } catch (error) {
      console.error('Error getting user data:', error);
      throw error;
    }
  }

  async migrateUserData(options: MigrationOptions): Promise<MigrationStats> {
    const stats: MigrationStats = {
      foldersMigrated: 0,
      snippetsMigrated: 0,
      clipboardItemsMigrated: 0,
      settingsMigrated: 0,
      errors: []
    };

    try {
      // Get source user data
      console.log(`\n📊 Fetching data for source user: ${options.sourceUserId}`);
      const sourceData = await this.getUserData(options.sourceUserId);

      if (options.dryRun) {
        console.log('\n🔍 DRY RUN - No changes will be made');
        console.log(`Found ${sourceData.folders.length} folders`);
        console.log(`Found ${sourceData.snippets.length} snippets`);
        console.log(`Found ${sourceData.clipboardItems.length} clipboard items`);
        console.log(`Found ${sourceData.settings.length} settings records`);
        return stats;
      }

      // Migrate folders
      if (options.includeFolders) {
        console.log('\n📁 Migrating folders...');
        for (const folder of sourceData.folders) {
          try {
            const newFolder = {
              name: folder.name,
              userId: options.targetUserId,
              sortOrder: folder.sortOrder,
              createdAt: folder.createdAt,
              updatedAt: new Date()
            };

            await this.db.insert(schema.folders).values(newFolder);
            stats.foldersMigrated++;
            console.log(`  ✓ Migrated folder: ${folder.name}`);
          } catch (error) {
            const errorMsg = `Failed to migrate folder "${folder.name}": ${error}`;
            stats.errors.push(errorMsg);
            console.log(`  ✗ ${errorMsg}`);
          }
        }
      }

      // Migrate snippets
      if (options.includeSnippets) {
        console.log('\n📝 Migrating snippets...');
        for (const snippet of sourceData.snippets) {
          try {
            // Get the new folder ID if this snippet was in a folder
            let newFolderId = null;
            if (snippet.folderId) {
              const sourceFolder = sourceData.folders.find(f => f.id === snippet.folderId);
              if (sourceFolder) {
                const targetFolder = await this.db.select()
                  .from(schema.folders)
                  .where(and(
                    eq(schema.folders.name, sourceFolder.name),
                    eq(schema.folders.userId, options.targetUserId)
                  ))
                  .limit(1);
                
                if (targetFolder.length > 0) {
                  newFolderId = targetFolder[0].id;
                }
              }
            }

            const newSnippet = {
              title: snippet.title,
              content: snippet.content,
              trigger: snippet.trigger,
              description: snippet.description,
              folderId: newFolderId,
              userId: options.targetUserId,
              createdAt: snippet.createdAt,
              updatedAt: new Date()
            };

            await this.db.insert(schema.snippets).values(newSnippet);
            stats.snippetsMigrated++;
            console.log(`  ✓ Migrated snippet: ${snippet.title}`);
          } catch (error) {
            const errorMsg = `Failed to migrate snippet "${snippet.title}": ${error}`;
            stats.errors.push(errorMsg);
            console.log(`  ✗ ${errorMsg}`);
          }
        }
      }

      // Migrate clipboard items
      if (options.includeClipboardItems) {
        console.log('\n📋 Migrating clipboard items...');
        for (const item of sourceData.clipboardItems) {
          try {
            const newItem = {
              content: item.content,
              type: item.type,
              userId: options.targetUserId,
              createdAt: item.createdAt
            };

            await this.db.insert(schema.clipboardItems).values(newItem);
            stats.clipboardItemsMigrated++;
            console.log(`  ✓ Migrated clipboard item: ${item.content.substring(0, 50)}...`);
          } catch (error) {
            const errorMsg = `Failed to migrate clipboard item: ${error}`;
            stats.errors.push(errorMsg);
            console.log(`  ✗ ${errorMsg}`);
          }
        }
      }

      // Migrate settings (only if target user doesn't have settings)
      if (options.includeSettings) {
        console.log('\n⚙️ Migrating settings...');
        const targetSettings = await this.db.select().from(schema.settings);
        
        if (targetSettings.length === 0) {
          for (const setting of sourceData.settings) {
            try {
              const newSetting = {
                snippetShortcut: setting.snippetShortcut,
                clipboardShortcut: setting.clipboardShortcut,
                clipboardEnabled: setting.clipboardEnabled,
                historyLimit: setting.historyLimit,
                launchOnStartup: setting.launchOnStartup,
                theme: setting.theme
              };

              await this.db.insert(schema.settings).values(newSetting);
              stats.settingsMigrated++;
              console.log(`  ✓ Migrated settings`);
            } catch (error) {
              const errorMsg = `Failed to migrate settings: ${error}`;
              stats.errors.push(errorMsg);
              console.log(`  ✗ ${errorMsg}`);
            }
          }
        } else {
          console.log(`  ⚠️ Target user already has settings, skipping settings migration`);
        }
      }

    } catch (error) {
      const errorMsg = `Migration failed: ${error}`;
      stats.errors.push(errorMsg);
      console.error(`\n❌ ${errorMsg}`);
    }

    return stats;
  }

  async listUsers(): Promise<string[]> {
    try {
      const folders = await this.db.select({ userId: schema.folders.userId }).from(schema.folders);
      const snippets = await this.db.select({ userId: schema.snippets.userId }).from(schema.snippets);
      const clipboardItems = await this.db.select({ userId: schema.clipboardItems.userId }).from(schema.clipboardItems);

      const userIds = new Set<string>();
      folders.forEach(f => userIds.add(f.userId));
      snippets.forEach(s => userIds.add(s.userId));
      clipboardItems.forEach(c => userIds.add(c.userId));

      return Array.from(userIds).sort();
    } catch (error) {
      console.error('Error listing users:', error);
      throw error;
    }
  }

  async getUserSummary(userId: string) {
    const folders = await this.db.select().from(schema.folders).where(eq(schema.folders.userId, userId));
    const snippets = await this.db.select().from(schema.snippets).where(eq(schema.snippets.userId, userId));
    const clipboardItems = await this.db.select().from(schema.clipboardItems).where(eq(schema.clipboardItems.userId, userId));

    return {
      folders: folders.length,
      snippets: snippets.length,
      clipboardItems: clipboardItems.length,
      folderNames: folders.map(f => f.name),
      snippetTitles: snippets.map(s => s.title)
    };
  }
}

// Interactive CLI functions
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface();
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function promptYesNo(question: string): Promise<boolean> {
  const answer = await prompt(`${question} (y/n): `);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

async function selectFromList<T>(items: T[], displayFn: (item: T) => string, promptText: string): Promise<T | null> {
  if (items.length === 0) {
    console.log('No items available');
    return null;
  }

  console.log(`\n${promptText}:`);
  items.forEach((item, index) => {
    console.log(`${index + 1}. ${displayFn(item)}`);
  });

  const answer = await prompt(`Select (1-${items.length}) or press Enter to skip: `);
  if (!answer) return null;

  const index = parseInt(answer) - 1;
  if (index >= 0 && index < items.length) {
    return items[index];
  }

  console.log('Invalid selection');
  return null;
}

async function main() {
  console.log('🔄 SnipClip User Data Migration Tool');
  console.log('=====================================\n');

  try {
    const migrator = new UserDataMigrator();

    // List available users
    console.log('📋 Available users:');
    const users = await migrator.listUsers();
    if (users.length === 0) {
      console.log('No users found in the database');
      return;
    }

    users.forEach((userId, index) => {
      console.log(`${index + 1}. ${userId}`);
    });

    // Select source user
    const sourceUserId = await prompt('\nEnter source user ID: ');
    if (!sourceUserId) {
      console.log('No source user ID provided');
      return;
    }

    if (!users.includes(sourceUserId)) {
      console.log(`User "${sourceUserId}" not found in database`);
      return;
    }

    // Show source user summary
    console.log('\n📊 Source user summary:');
    const sourceSummary = await migrator.getUserSummary(sourceUserId);
    console.log(`Folders: ${sourceSummary.folders}`);
    console.log(`Snippets: ${sourceSummary.snippets}`);
    console.log(`Clipboard items: ${sourceSummary.clipboardItems}`);

    if (sourceSummary.folders > 0) {
      console.log(`Folder names: ${sourceSummary.folderNames.join(', ')}`);
    }
    if (sourceSummary.snippets > 0) {
      console.log(`Snippet titles: ${sourceSummary.snippetTitles.slice(0, 5).join(', ')}${sourceSummary.snippets > 5 ? '...' : ''}`);
    }

    // Select target user
    const targetUserId = await prompt('\nEnter target user ID: ');
    if (!targetUserId) {
      console.log('No target user ID provided');
      return;
    }

    // Check if target user exists
    const targetExists = users.includes(targetUserId);
    if (targetExists) {
      console.log('\n📊 Target user summary:');
      const targetSummary = await migrator.getUserSummary(targetUserId);
      console.log(`Folders: ${targetSummary.folders}`);
      console.log(`Snippets: ${targetSummary.snippets}`);
      console.log(`Clipboard items: ${targetSummary.clipboardItems}`);
    } else {
      console.log(`\n⚠️ Target user "${targetUserId}" does not exist - will be created during migration`);
    }

    // Confirm migration
    console.log(`\n🔄 Migration plan:`);
    console.log(`From: ${sourceUserId}`);
    console.log(`To: ${targetUserId}`);
    
    if (!await promptYesNo('\nProceed with migration?')) {
      console.log('Migration cancelled');
      return;
    }

    // Select what to migrate
    const includeFolders = await promptYesNo('Migrate folders?');
    const includeSnippets = await promptYesNo('Migrate snippets?');
    const includeClipboardItems = await promptYesNo('Migrate clipboard items?');
    const includeSettings = await promptYesNo('Migrate settings?');

    // Dry run option
    const dryRun = await promptYesNo('Perform dry run first? (recommended)');

    const options: MigrationOptions = {
      sourceUserId,
      targetUserId,
      includeFolders,
      includeSnippets,
      includeClipboardItems,
      includeSettings,
      dryRun,
      force: false
    };

    // Perform migration
    console.log('\n🚀 Starting migration...');
    const stats = await migrator.migrateUserData(options);

    // Show results
    console.log('\n📈 Migration Results:');
    console.log(`Folders migrated: ${stats.foldersMigrated}`);
    console.log(`Snippets migrated: ${stats.snippetsMigrated}`);
    console.log(`Clipboard items migrated: ${stats.clipboardItemsMigrated}`);
    console.log(`Settings migrated: ${stats.settingsMigrated}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      stats.errors.forEach(error => console.log(`  - ${error}`));
    }

    if (dryRun) {
      console.log('\n💡 Dry run completed. Run the script again and select "no" for dry run to perform the actual migration.');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { UserDataMigrator }; 