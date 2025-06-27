# SnippetStack Database Guide

## Overview

SnippetStack uses a hybrid database approach that automatically adapts to your environment:

- **Development**: SQLite (local file-based database)
- **Production**: PostgreSQL (Neon serverless database)
- **Fallback**: File-based JSON storage

## The Data Loss Problem

### What Happened
When Render restarted due to deployment timeout, all user data was lost because:

1. **Ephemeral Storage**: The `data/` directory with JSON files is ephemeral in cloud environments
2. **No Persistence**: Local files don't survive container restarts
3. **No Database**: Production was using file storage instead of a persistent database

### Why It Happened
```typescript
// Old logic - only used database if DATABASE_URL was set
export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new FileStorage();
```

## New Hybrid Database Solution

### How It Works

The new system automatically chooses the best storage option:

```typescript
// New logic - prioritizes database over file storage
const isDevelopment = process.env.NODE_ENV === 'development';
const hasDatabaseUrl = !!process.env.DATABASE_URL;
const useSQLite = isDevelopment && !hasDatabaseUrl;

if (hasDatabaseUrl) {
  // Use Neon PostgreSQL (production)
  db = drizzle({ client: pool, schema });
} else if (useSQLite) {
  // Use SQLite for development
  db = drizzleSQLite(sqliteDb, { schema });
} else {
  // Fallback to file storage
  console.log('No database configured, using file storage');
}
```

### Storage Priority
1. **PostgreSQL** (if `DATABASE_URL` is set)
2. **SQLite** (if in development mode without `DATABASE_URL`)
3. **File Storage** (fallback only)

## Database Options

### 1. Neon PostgreSQL (Recommended for Production)

**Setup:**
```bash
# Set environment variable
export DATABASE_URL="postgresql://user:password@host:port/database"

# Or in .env file
DATABASE_URL=postgresql://user:password@host:port/database
```

**Pros:**
- ✅ Serverless, auto-scaling
- ✅ Built-in connection pooling
- ✅ Free tier available
- ✅ Data persists across deployments
- ✅ Handles concurrent users

**Cons:**
- ❌ Requires internet connection
- ❌ Slight latency for local development

### 2. SQLite (Recommended for Development)

**Setup:**
```bash
# Just run in development mode - SQLite is automatic
npm run dev
```

**Pros:**
- ✅ Zero configuration
- ✅ Works offline
- ✅ Fast local development
- ✅ Database file can be committed to git for testing
- ✅ No external dependencies

**Cons:**
- ❌ Not suitable for high-concurrency production
- ❌ Limited concurrent connections

### 3. File Storage (Fallback Only)

**When used:**
- No database configured
- No development mode

**Pros:**
- ✅ No setup required
- ✅ Works immediately

**Cons:**
- ❌ Data lost on restart
- ❌ Not suitable for production
- ❌ No concurrent access support

## Quick Start

### For Development

1. **Start the development server:**
   ```bash
   npm run dev
   ```
   This automatically uses SQLite with database file at `data/snippets.db`

2. **Check database status:**
   ```bash
   npm run db:status
   ```

3. **Test database operations:**
   ```bash
   npm run db:test
   ```

### For Production

1. **Set up Neon PostgreSQL:**
   - Create account at [neon.tech](https://neon.tech)
   - Create a new project
   - Copy the connection string

2. **Set environment variable:**
   ```bash
   export DATABASE_URL="postgresql://user:password@host:port/database"
   ```

3. **Deploy to Render:**
   - Add `DATABASE_URL` to your Render environment variables
   - Deploy your application

## Database Management Commands

```bash
# Check database status
npm run db:status

# Initialize database tables
npm run db:init

# Test database operations
npm run db:test

# Reset database (⚠️ deletes all data)
npm run db:reset
```

## Migration System

The application automatically runs migrations on startup:

- **SQLite**: Creates tables with `CREATE TABLE IF NOT EXISTS`
- **PostgreSQL**: Creates tables with `CREATE TABLE IF NOT EXISTS`
- **Indexes**: Automatically created for performance

## Data Schema

### Snippets Table
```sql
CREATE TABLE snippets (
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
);
```

### Clipboard Items Table
```sql
CREATE TABLE clipboard_items (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  user_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Settings Table
```sql
CREATE TABLE settings (
  id SERIAL PRIMARY KEY,
  snippet_shortcut TEXT NOT NULL DEFAULT 'ctrl+;',
  clipboard_shortcut TEXT NOT NULL DEFAULT 'ctrl+shift+v',
  clipboard_enabled INTEGER NOT NULL DEFAULT 1,
  history_limit INTEGER NOT NULL DEFAULT 100,
  launch_on_startup INTEGER NOT NULL DEFAULT 0,
  theme TEXT NOT NULL DEFAULT 'light'
);
```

## Troubleshooting

### Database Connection Issues

1. **Check database status:**
   ```bash
   npm run db:status
   ```

2. **Verify environment variables:**
   ```bash
   echo $DATABASE_URL
   echo $NODE_ENV
   ```

3. **Test database operations:**
   ```bash
   npm run db:test
   ```

### Data Loss Prevention

1. **Always use a database in production:**
   - Set `DATABASE_URL` environment variable
   - Never rely on file storage for production

2. **Backup your data:**
   - For SQLite: Copy `data/snippets.db`
   - For PostgreSQL: Use database backup features

3. **Monitor database health:**
   - Check logs for database errors
   - Use `npm run db:status` regularly

### Performance Issues

1. **SQLite limitations:**
   - Only one write operation at a time
   - Not suitable for multiple concurrent users

2. **PostgreSQL optimization:**
   - Connection pooling is automatic
   - Indexes are created automatically

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Production | None |
| `NODE_ENV` | Environment mode | No | `development` |

## Best Practices

1. **Development:**
   - Use SQLite for local development
   - Commit `data/snippets.db` to git for testing
   - Use `npm run db:test` to verify functionality

2. **Production:**
   - Always use PostgreSQL (Neon recommended)
   - Set `DATABASE_URL` environment variable
   - Monitor database performance
   - Regular backups

3. **Testing:**
   - Use `npm run db:reset` to clean test data
   - Test with both SQLite and PostgreSQL
   - Verify data persistence across restarts 