import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { eq, and } from 'drizzle-orm';
import ws from 'ws';
import dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config();
neonConfig.webSocketConstructor = ws;

// Define the actual database schema
const folders = pgTable("folders", {
  id: serial().primaryKey(),
  name: text().notNull(),
  parentId: integer("parent_id"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
  userId: text("user_id").default('default').notNull(),
});

const snippets = pgTable("snippets", {
  id: serial().primaryKey(),
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
  id: serial().primaryKey(),
  content: text().notNull(),
  type: text().default('text').notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

const userMappings = pgTable("user_mappings", {
  id: serial().primaryKey(),
  pin: text().notNull(),
  passphraseHash: text("passphrase_hash").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

class UserMigrator {
  private db: any;
  private pool: any;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not found');
    }

    this.pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    
    this.db = drizzle({ client: this.pool });
  }

  async listUsers() {
    const folderUsers = await this.db.select({ userId: folders.userId }).from(folders);
    const snippetUsers = await this.db.select({ userId: snippets.userId }).from(snippets);
    const clipboardUsers = await this.db.select({ userId: clipboardItems.userId }).from(clipboardItems);

    const userIds = new Set<string>();
    folderUsers.forEach(f => userIds.add(f.userId));
    snippetUsers.forEach(s => userIds.add(s.userId));
    clipboardUsers.forEach(c => userIds.add(c.userId));

    return Array.from(userIds).sort();
  }

  async getUserData(userId: string) {
    const userFolders = await this.db.select().from(folders).where(eq(folders.userId, userId));
    const userSnippets = await this.db.select().from(snippets).where(eq(snippets.userId, userId));
    const userClipboard = await this.db.select().from(clipboardItems).where(eq(clipboardItems.userId, userId));

    return {
      folders: userFolders,
      snippets: userSnippets,
      clipboardItems: userClipboard
    };
  }

  async getUserSummary(userId: string) {
    const data = await this.getUserData(userId);
    
    return {
      userId,
      folders: data.folders.length,
      snippets: data.snippets.length,
      clipboardItems: data.clipboardItems.length,
      folderNames: data.folders.map(f => f.name),
      snippetTitles: data.snippets.map(s => s.title)
    };
  }

  async migrateUser(sourceUserId: string, targetUserId: string, options = {
    includeFolders: true,
    includeSnippets: true,
    includeClipboardItems: true,
    dryRun: false
  }) {
    console.log(`\n🔄 Migration: ${sourceUserId} → ${targetUserId}`);
    console.log('='.repeat(60));

    // Get source data
    const sourceData = await this.getUserData(sourceUserId);
    
    console.log(`\n📊 Source Data:`);
    console.log(`  Folders: ${sourceData.folders.length}`);
    console.log(`  Snippets: ${sourceData.snippets.length}`);
    console.log(`  Clipboard Items: ${sourceData.clipboardItems.length}`);

    if (options.dryRun) {
      console.log('\n🔍 DRY RUN - No changes will be made');
      
      if (options.includeFolders && sourceData.folders.length > 0) {
        console.log('\n📁 Folders to migrate:');
        sourceData.folders.forEach((folder, i) => {
          console.log(`  ${i + 1}. "${folder.name}" (ID: ${folder.id})`);
        });
      }

      if (options.includeSnippets && sourceData.snippets.length > 0) {
        console.log('\n📝 Snippets to migrate:');
        sourceData.snippets.slice(0, 10).forEach((snippet, i) => {
          console.log(`  ${i + 1}. "${snippet.title}" (Trigger: ${snippet.trigger})`);
        });
        if (sourceData.snippets.length > 10) {
          console.log(`  ... and ${sourceData.snippets.length - 10} more snippets`);
        }
      }

      if (options.includeClipboardItems && sourceData.clipboardItems.length > 0) {
        console.log('\n📋 Clipboard items to migrate:');
        sourceData.clipboardItems.slice(0, 5).forEach((item, i) => {
          console.log(`  ${i + 1}. "${item.content.substring(0, 50)}..."`);
        });
        if (sourceData.clipboardItems.length > 5) {
          console.log(`  ... and ${sourceData.clipboardItems.length - 5} more items`);
        }
      }

      return { success: true, dryRun: true };
    }

    // Check if target user already exists
    const targetData = await this.getUserData(targetUserId);
    if (targetData.folders.length > 0 || targetData.snippets.length > 0 || targetData.clipboardItems.length > 0) {
      console.log(`\n⚠️  Target user already has data:`);
      console.log(`  Folders: ${targetData.folders.length}`);
      console.log(`  Snippets: ${targetData.snippets.length}`);
      console.log(`  Clipboard Items: ${targetData.clipboardItems.length}`);
    }

    const stats = {
      foldersMigrated: 0,
      snippetsMigrated: 0,
      clipboardItemsMigrated: 0,
      errors: [] as string[]
    };

    // Migrate folders first
    if (options.includeFolders) {
      console.log('\n📁 Migrating folders...');
      const folderMapping = new Map<number, number>(); // old ID -> new ID
      
      for (const folder of sourceData.folders) {
        try {
          const newFolder = {
            name: folder.name,
            parentId: folder.parentId,
            sortOrder: folder.sortOrder,
            userId: targetUserId,
            createdAt: folder.createdAt,
            updatedAt: new Date().toISOString()
          };

          const result = await this.db.insert(folders).values(newFolder).returning({ id: folders.id });
          folderMapping.set(folder.id, result[0].id);
          stats.foldersMigrated++;
          console.log(`  ✓ "${folder.name}" (${folder.id} → ${result[0].id})`);
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
          // Map folder ID if it exists
          let newFolderId = snippet.folderId;
          if (snippet.folderId && options.includeFolders) {
            const sourceFolder = sourceData.folders.find(f => f.id === snippet.folderId);
            if (sourceFolder) {
              // Find the migrated folder by name
              const targetFolder = await this.db.select()
                .from(folders)
                .where(and(
                  eq(folders.name, sourceFolder.name),
                  eq(folders.userId, targetUserId)
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
            category: snippet.category,
            description: snippet.description,
            parentId: snippet.parentId,
            folderId: newFolderId,
            userId: targetUserId,
            createdAt: snippet.createdAt,
            updatedAt: new Date().toISOString()
          };

          await this.db.insert(snippets).values(newSnippet);
          stats.snippetsMigrated++;
          console.log(`  ✓ "${snippet.title}" (${snippet.trigger})`);
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
            userId: targetUserId,
            createdAt: item.createdAt
          };

          await this.db.insert(clipboardItems).values(newItem);
          stats.clipboardItemsMigrated++;
          console.log(`  ✓ "${item.content.substring(0, 50)}..."`);
        } catch (error) {
          const errorMsg = `Failed to migrate clipboard item: ${error}`;
          stats.errors.push(errorMsg);
          console.log(`  ✗ ${errorMsg}`);
        }
      }
    }

    console.log('\n📈 Migration Results:');
    console.log(`  Folders: ${stats.foldersMigrated}`);
    console.log(`  Snippets: ${stats.snippetsMigrated}`);
    console.log(`  Clipboard Items: ${stats.clipboardItemsMigrated}`);
    console.log(`  Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach(error => console.log(`  - ${error}`));
    }

    return { success: stats.errors.length === 0, stats };
  }

  async deleteUserData(userId: string) {
    // Delete in correct order to respect foreign key constraints
    const deleted = { folders: 0, snippets: 0, clipboardItems: 0, userMappings: 0 };
    
    // 1. Delete snippets first (they reference folders)
    deleted.snippets = (await this.db.delete(snippets).where(eq(snippets.userId, userId))).rowCount || 0;
    
    // 2. Delete folders (no longer referenced by snippets)
    deleted.folders = (await this.db.delete(folders).where(eq(folders.userId, userId))).rowCount || 0;
    
    // 3. Delete clipboard items
    deleted.clipboardItems = (await this.db.delete(clipboardItems).where(eq(clipboardItems.userId, userId))).rowCount || 0;
    
    // 4. Delete user mappings (may not exist in all DBs, so try/catch)
    try {
      deleted.userMappings = (await this.db.delete(userMappings).where(eq(userMappings.userId, userId))).rowCount || 0;
    } catch (e) {
      deleted.userMappings = 0;
    }
    
    return deleted;
  }

  async close() {
    await this.pool.end();
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
🔄 SnipClip User Migration Tool

Usage:
  npx tsx scripts/migrate-users.ts [command] [options]

Commands:
  list                          List all users
  summary <userId>              Show user summary
  migrate <source> <target>     Migrate from source to target user
  delete <userId>               Delete all data for a user
  
Options:
  --dry-run                     Preview changes without executing
  --folders-only                Migrate only folders
  --snippets-only               Migrate only snippets
  --clipboard-only              Migrate only clipboard items
  --no-folders                  Skip folders
  --no-snippets                 Skip snippets
  --no-clipboard                Skip clipboard items

Examples:
  npx tsx scripts/migrate-users.ts list
  npx tsx scripts/migrate-users.ts summary "0003fb90e9b74a8409e29d6e70d75617"
  npx tsx scripts/migrate-users.ts migrate "0003fb90e9b74a8409e29d6e70d75617" "new_user_id" --dry-run
  npx tsx scripts/migrate-users.ts migrate "0003fb90e9b74a8409e29d6e70d75617" "new_user_id"
    `);
    return;
  }

  const migrator = new UserMigrator();

  try {
    const command = args[0];

    if (command === 'list') {
      console.log('📋 Users in database:');
      const users = await migrator.listUsers();
      users.forEach((userId, index) => {
        console.log(`${index + 1}. ${userId}`);
      });
    }
    
    else if (command === 'summary') {
      const userId = args[1];
      if (!userId) {
        console.error('❌ Please provide a user ID');
        return;
      }
      
      console.log(`📊 User Summary: ${userId}`);
      const summary = await migrator.getUserSummary(userId);
      console.log(`Folders: ${summary.folders}`);
      console.log(`Snippets: ${summary.snippets}`);
      console.log(`Clipboard Items: ${summary.clipboardItems}`);
      
      if (summary.folders > 0) {
        console.log(`\nFolder Names: ${summary.folderNames.join(', ')}`);
      }
      if (summary.snippets > 0) {
        console.log(`\nSnippet Titles: ${summary.snippetTitles.slice(0, 10).join(', ')}${summary.snippets > 10 ? '...' : ''}`);
      }
    }
    
    else if (command === 'migrate') {
      const sourceUserId = args[1];
      const targetUserId = args[2];
      
      if (!sourceUserId || !targetUserId) {
        console.error('❌ Please provide both source and target user IDs');
        return;
      }

      const options = {
        includeFolders: !args.includes('--no-folders') && !args.includes('--snippets-only') && !args.includes('--clipboard-only'),
        includeSnippets: !args.includes('--no-snippets') && !args.includes('--folders-only') && !args.includes('--clipboard-only'),
        includeClipboardItems: !args.includes('--no-clipboard') && !args.includes('--folders-only') && !args.includes('--snippets-only'),
        dryRun: args.includes('--dry-run')
      };

      if (args.includes('--folders-only')) {
        options.includeFolders = true;
        options.includeSnippets = false;
        options.includeClipboardItems = false;
      }
      if (args.includes('--snippets-only')) {
        options.includeFolders = false;
        options.includeSnippets = true;
        options.includeClipboardItems = false;
      }
      if (args.includes('--clipboard-only')) {
        options.includeFolders = false;
        options.includeSnippets = false;
        options.includeClipboardItems = true;
      }

      const result = await migrator.migrateUser(sourceUserId, targetUserId, options);
      
      if (result.success) {
        if (result.dryRun) {
          console.log('\n💡 Dry run completed. Remove --dry-run to execute migration.');
        } else {
          console.log('\n✅ Migration completed successfully!');
        }
      } else {
        console.log('\n❌ Migration completed with errors.');
      }
    }

    else if (command === 'delete') {
      const userId = args[1];
      if (!userId) {
        console.error('❌ Please provide a user ID');
        return;
      }
             // Confirm prompt
       const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      await new Promise((resolve) => {
        rl.question(`⚠️  Are you sure you want to delete ALL data for user "${userId}"? This cannot be undone! (y/N): `, async (answer: string) => {
          rl.close();
          if (answer.trim().toLowerCase() !== 'y') {
            console.log('❌ Aborted. No data deleted.');
            resolve(null);
            return;
          }
          const deleted = await migrator.deleteUserData(userId);
          console.log(`\n🗑️  Deleted for user ${userId}:`);
          console.log(`  Folders:        ${deleted.folders}`);
          console.log(`  Snippets:       ${deleted.snippets}`);
          console.log(`  ClipboardItems: ${deleted.clipboardItems}`);
          console.log(`  UserMappings:   ${deleted.userMappings}`);
          resolve(null);
        });
      });
    }
    
    else {
      console.error('❌ Unknown command. Use --help for usage information.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await migrator.close();
  }
}

main(); 