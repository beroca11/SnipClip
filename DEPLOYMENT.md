# Deployment Guide

This guide will help you deploy SnipClip with PostgreSQL and migrate your existing data.

## Quick Start

### 1. Set up PostgreSQL Database

You have several options for PostgreSQL hosting:

#### Option A: Neon (Recommended - Free Tier)
1. Go to [https://neon.tech](https://neon.tech)
2. Create an account and new project
3. Copy the connection string from your dashboard
4. It looks like: `postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`

#### Option B: Supabase (Free Tier)
1. Go to [https://supabase.com](https://supabase.com)
2. Create an account and new project
3. Go to Settings > Database
4. Copy the connection string

#### Option C: Railway (Free Tier)
1. Go to [https://railway.app](https://railway.app)
2. Create an account and new project
3. Add a PostgreSQL database
4. Copy the connection string

### 2. Run the Setup Script

```bash
npm run db:setup
```

This interactive script will:
- Help you set up your DATABASE_URL
- Test the database connection
- Create the database schema
- Migrate all your existing JSON data
- Verify the migration was successful

### 3. Deploy to Render

1. Update your `render.yaml` file with your actual DATABASE_URL and SESSION_SECRET
2. Push to your repository
3. Render will automatically deploy your application

## Manual Setup

If you prefer to set up manually:

### 1. Create .env file

```bash
# Create .env file in your project root
DATABASE_URL=postgresql://your-username:your-password@your-host/your-database?sslmode=require
NODE_ENV=production
SESSION_SECRET=your-secure-session-secret-here-make-it-at-least-32-characters-long
```

### 2. Test Database Connection

```bash
npm run db:test-connection
```

### 3. Run Migration

```bash
npm run db:migrate-json
```

## Environment Variables

Make sure these are set in your deployment environment:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `NODE_ENV` | Environment mode | `production` |
| `SESSION_SECRET` | Secure session secret | `your-32-character-secret-here` |

## Troubleshooting

### "No DATABASE_URL found"

This means your PostgreSQL connection string isn't set. Run:
```bash
npm run db:setup
```

### "Database connection failed"

1. Check your connection string format
2. Ensure your database is accessible
3. Check if your IP needs to be whitelisted
4. Verify SSL settings

### "Migration already run"

The database already contains data. You can:
1. Check your data: `npm run db:test-connection`
2. Reset if needed: `npm run db:reset`

### "Tables don't exist"

Run the schema migration:
```bash
npm run db:setup
```

## Data Migration Details

The migration process:

1. **Creates Database Schema**
   - `folders` table with user-specific folders
   - `snippets` table with folder relationships
   - `clipboard_items` table for clipboard history
   - `settings` table for user preferences

2. **Migrates Your Data**
   - All snippets from `data/snippets.json`
   - All folders from `data/folders.json`
   - All clipboard items from `data/clipboard.json`
   - All settings from `data/settings.json`

3. **Preserves Relationships**
   - Snippet-folder relationships are maintained
   - User-specific data is preserved
   - Timestamps are converted properly

## Post-Deployment

After successful deployment:

1. ✅ Your data is now in PostgreSQL
2. ✅ The application uses the database
3. ✅ JSON files remain as backup
4. ✅ All user data is preserved

## Support

If you encounter issues:

1. Check the console logs for error messages
2. Run `npm run db:test-connection` to verify setup
3. Ensure all environment variables are set
4. Try the interactive setup: `npm run db:setup` 