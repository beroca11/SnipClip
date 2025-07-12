# Data Migration Guide

This guide explains how to migrate your existing JSON data to PostgreSQL when deploying SnipClip.

## Overview

SnipClip now uses PostgreSQL for production deployments, but you may have existing data stored in JSON files. This migration process will automatically transfer your data from the `data/` directory to your PostgreSQL database.

## Prerequisites

1. **PostgreSQL Database**: Ensure you have a PostgreSQL database set up (e.g., Neon, Supabase, etc.)
2. **DATABASE_URL**: Set your PostgreSQL connection string as an environment variable
3. **NODE_ENV**: Set to "production" for production deployments

## Automatic Migration

The migration will run automatically when you start the server in production mode. The system will:

1. Check if PostgreSQL is configured (DATABASE_URL is set)
2. Create the database schema if it doesn't exist
3. Check if data already exists in the database
4. If no data exists, migrate all JSON files from the `data/` directory

## Manual Migration

If you need to run the migration manually, you can use these commands:

### Test Database Connection

```bash
npm run db:test-connection
```

This will:
- Verify your DATABASE_URL is configured
- Test the database connection
- Show existing tables and record counts

### Run Manual Migration

```bash
npm run db:migrate-json
```

This will:
- Connect to your PostgreSQL database
- Migrate all data from JSON files
- Preserve relationships between snippets and folders
- Show progress and results

## Data Mapping

The migration maps your existing JSON data to the new PostgreSQL schema:

### Snippets
- `title` → `title`
- `content` → `content`
- `trigger` → `trigger`
- `description` → `description`
- `userId` → `user_id`
- `folderId` → `folder_id` (with ID mapping)
- `createdAt` → `created_at`
- `updatedAt` → `updated_at`

### Folders
- `name` → `name`
- `userId` → `user_id`
- `sortOrder` → `sort_order`
- `createdAt` → `created_at`
- `updatedAt` → `updated_at`

### Clipboard Items
- `content` → `content`
- `type` → `type`
- `userId` → `user_id`
- `createdAt` → `created_at`

### Settings
- `snippetShortcut` → `snippet_shortcut`
- `clipboardShortcut` → `clipboard_shortcut`
- `clipboardEnabled` → `clipboard_enabled`
- `historyLimit` → `history_limit`
- `launchOnStartup` → `launch_on_startup`
- `theme` → `theme`

## Troubleshooting

### Migration Already Run

If you see "Database already contains data, skipping migration", the migration has already been completed. You can:

1. Check your data: `npm run db:test-connection`
2. Reset the database (if needed): `npm run db:reset`

### Connection Issues

If you get connection errors:

1. Verify your DATABASE_URL is correct
2. Ensure your database is accessible
3. Check firewall/network settings
4. Verify SSL settings for production

### Missing Data

If some data is missing after migration:

1. Check the console logs for any errors
2. Verify the JSON files exist in the `data/` directory
3. Run the manual migration to see detailed output

## Environment Variables

Make sure these environment variables are set:

```bash
DATABASE_URL=postgresql://username:password@host:port/database
NODE_ENV=production
SESSION_SECRET=your-secure-session-secret
```

## Backup

Before running the migration, it's recommended to:

1. Backup your JSON files from the `data/` directory
2. Take a database snapshot if possible
3. Test the migration in a staging environment first

## Post-Migration

After successful migration:

1. Your data will be available in PostgreSQL
2. The JSON files will remain as backup
3. The application will use PostgreSQL for all new operations
4. You can optionally remove the JSON files after verifying the migration

## Support

If you encounter issues:

1. Check the console logs for error messages
2. Verify your database connection
3. Ensure all environment variables are set correctly
4. Test with the connection script first 