#!/usr/bin/env tsx

import { UserDataMigrator } from './migrate-user-data';
import { MigrationOptions } from './migrate-user-data';

interface CLIOptions {
  sourceUserId?: string;
  targetUserId?: string;
  includeFolders?: boolean;
  includeSnippets?: boolean;
  includeClipboardItems?: boolean;
  includeSettings?: boolean;
  dryRun?: boolean;
  listUsers?: boolean;
  userSummary?: string;
  help?: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--source':
      case '-s':
        options.sourceUserId = args[++i];
        break;
      case '--target':
      case '-t':
        options.targetUserId = args[++i];
        break;
      case '--folders':
        options.includeFolders = true;
        break;
      case '--snippets':
        options.includeSnippets = true;
        break;
      case '--clipboard':
        options.includeClipboardItems = true;
        break;
      case '--settings':
        options.includeSettings = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--list-users':
        options.listUsers = true;
        break;
      case '--user-summary':
        options.userSummary = args[++i];
        break;
      case '--all':
        options.includeFolders = true;
        options.includeSnippets = true;
        options.includeClipboardItems = true;
        options.includeSettings = true;
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
🔄 SnipClip User Data Migration Tool - CLI Version

Usage:
  npx tsx scripts/migrate-user-data-cli.ts [options]

Options:
  -h, --help                    Show this help message
  -s, --source <userId>         Source user ID
  -t, --target <userId>         Target user ID
  --folders                     Migrate folders
  --snippets                    Migrate snippets
  --clipboard                   Migrate clipboard items
  --settings                    Migrate settings
  --all                         Migrate all data types
  --dry-run                     Perform dry run (no actual changes)
  --list-users                  List all users in database
  --user-summary <userId>       Show summary for specific user

Examples:
  # List all users
  npx tsx scripts/migrate-user-data-cli.ts --list-users

  # Show user summary
  npx tsx scripts/migrate-user-data-cli.ts --user-summary "user123"

  # Dry run migration
  npx tsx scripts/migrate-user-data-cli.ts --source "user123" --target "user456" --all --dry-run

  # Migrate all data
  npx tsx scripts/migrate-user-data-cli.ts --source "user123" --target "user456" --all

  # Migrate only snippets and folders
  npx tsx scripts/migrate-user-data-cli.ts --source "user123" --target "user456" --snippets --folders

Environment Variables:
  DATABASE_URL                  PostgreSQL connection string (for production)
  NODE_ENV                      Set to 'development' for SQLite, 'production' for PostgreSQL
`);
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  try {
    const migrator = new UserDataMigrator();

    // List users
    if (options.listUsers) {
      console.log('📋 Available users:');
      const users = await migrator.listUsers();
      if (users.length === 0) {
        console.log('No users found in the database');
        return;
      }
      users.forEach((userId, index) => {
        console.log(`${index + 1}. ${userId}`);
      });
      return;
    }

    // Show user summary
    if (options.userSummary) {
      console.log(`📊 User summary for: ${options.userSummary}`);
      const summary = await migrator.getUserSummary(options.userSummary);
      console.log(`Folders: ${summary.folders}`);
      console.log(`Snippets: ${summary.snippets}`);
      console.log(`Clipboard items: ${summary.clipboardItems}`);
      if (summary.folders > 0) {
        console.log(`Folder names: ${summary.folderNames.join(', ')}`);
      }
      if (summary.snippets > 0) {
        console.log(`Snippet titles: ${summary.snippetTitles.slice(0, 5).join(', ')}${summary.snippets > 5 ? '...' : ''}`);
      }
      return;
    }

    // Validate required options for migration
    if (!options.sourceUserId || !options.targetUserId) {
      console.error('❌ Error: Both --source and --target user IDs are required for migration');
      console.log('Use --help for usage information');
      process.exit(1);
    }

    // Check if any data types are selected
    if (!options.includeFolders && !options.includeSnippets && !options.includeClipboardItems && !options.includeSettings) {
      console.error('❌ Error: No data types selected for migration');
      console.log('Use --folders, --snippets, --clipboard, --settings, or --all to select data types');
      process.exit(1);
    }

    // Validate source user exists
    const users = await migrator.listUsers();
    if (!users.includes(options.sourceUserId)) {
      console.error(`❌ Error: Source user "${options.sourceUserId}" not found in database`);
      console.log('Use --list-users to see available users');
      process.exit(1);
    }

    // Show migration plan
    console.log('🔄 Migration Plan:');
    console.log(`Source: ${options.sourceUserId}`);
    console.log(`Target: ${options.targetUserId}`);
    console.log(`Data types:`);
    if (options.includeFolders) console.log('  - Folders');
    if (options.includeSnippets) console.log('  - Snippets');
    if (options.includeClipboardItems) console.log('  - Clipboard items');
    if (options.includeSettings) console.log('  - Settings');
    console.log(`Mode: ${options.dryRun ? 'Dry run' : 'Live migration'}`);

    // Show source user summary
    console.log('\n📊 Source user summary:');
    const sourceSummary = await migrator.getUserSummary(options.sourceUserId);
    console.log(`Folders: ${sourceSummary.folders}`);
    console.log(`Snippets: ${sourceSummary.snippets}`);
    console.log(`Clipboard items: ${sourceSummary.clipboardItems}`);

    // Show target user summary if exists
    if (users.includes(options.targetUserId)) {
      console.log('\n📊 Target user summary:');
      const targetSummary = await migrator.getUserSummary(options.targetUserId);
      console.log(`Folders: ${targetSummary.folders}`);
      console.log(`Snippets: ${targetSummary.snippets}`);
      console.log(`Clipboard items: ${targetSummary.clipboardItems}`);
    } else {
      console.log(`\n⚠️ Target user "${options.targetUserId}" does not exist - will be created during migration`);
    }

    // Perform migration
    console.log('\n🚀 Starting migration...');
    const migrationOptions: MigrationOptions = {
      sourceUserId: options.sourceUserId,
      targetUserId: options.targetUserId,
      includeFolders: options.includeFolders || false,
      includeSnippets: options.includeSnippets || false,
      includeClipboardItems: options.includeClipboardItems || false,
      includeSettings: options.includeSettings || false,
      dryRun: options.dryRun || false,
      force: false
    };

    const stats = await migrator.migrateUserData(migrationOptions);

    // Show results
    console.log('\n📈 Migration Results:');
    console.log(`Folders migrated: ${stats.foldersMigrated}`);
    console.log(`Snippets migrated: ${stats.snippetsMigrated}`);
    console.log(`Clipboard items migrated: ${stats.clipboardItemsMigrated}`);
    console.log(`Settings migrated: ${stats.settingsMigrated}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      stats.errors.forEach(error => console.log(`  - ${error}`));
      process.exit(1);
    }

    if (options.dryRun) {
      console.log('\n💡 Dry run completed successfully. Remove --dry-run flag to perform actual migration.');
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