# SnipClip User Data Migration Scripts

This directory contains scripts to migrate user data (folders, snippets, clipboard items, and settings) from one user to another in the SnipClip database.

---

## 🚨 New: User ID Mapping System for SESSION_SECRET Changes

### Why?
If you ever change your `SESSION_SECRET`, the app used to generate a new user ID for the same PIN/passphrase, causing you to lose access to your old data. Now, SnipClip includes a **user ID mapping system** to ensure you always get the right data, even if the secret changes.

### How does it work?
- When you log in, the backend checks a new `user_mappings` table to see if your PIN/passphrase is already mapped to a user ID.
- If so, you always get the same user ID (and thus the same data), regardless of the current `SESSION_SECRET`.
- If not, the system will create a mapping for you on your next successful login.
- This means you can safely recover from accidental `SESSION_SECRET` changes and never lose access to your folders/snippets/clipboard.

### New Table: `user_mappings`
A new table is created in the database:
- `pin` (text): Your PIN
- `passphrase_hash` (text): A hash of your passphrase (for security)
- `user_id` (text): The canonical user ID for this login
- `created_at`, `updated_at`: Timestamps

### How to Use
- **Just log in as usual.** The system will resolve your user ID using the mapping table.
- If you log in after a `SESSION_SECRET` change, the system will try to find your old user ID and map it for you.
- If you have multiple user IDs, use the migration and consolidation tools below to merge your data.

---

## New: User Data Consolidation Tool

If you have multiple user IDs (e.g., after a secret change), use the new script:

```bash
npx tsx scripts/consolidate-user-data.ts
```
- This script will help you identify which user ID is your real account and guide you through mapping your PIN/passphrase to it.
- It will also recommend migration steps if you want to merge data from other user IDs.

---

## Overview

The migration system consists of these scripts:
- **`migrate-users.ts`** - **Main migration tool** (recommended) - Complete CLI with all features including delete
- **`consolidate-user-data.ts`** - Interactive tool to map PIN/passphrase to the correct user ID and guide consolidation
- **`migrate-user-data.ts`** - Legacy interactive CLI (deprecated, use migrate-users.ts instead)
- **`migrate-user-data-cli.ts`** - Legacy CLI tool (deprecated, use migrate-users.ts instead)

All scripts support PostgreSQL (production) databases with proper Neon configuration.

## Features

- ✅ **Safe Migration**: Dry-run mode to preview changes before execution
- ✅ **Copy Operation**: Source data is preserved, target gets copies with new IDs
- ✅ **Selective Migration**: Choose which data types to migrate (folders, snippets, clipboard)
- ✅ **Relationship Preservation**: Maintains folder-snippet relationships during migration
- ✅ **Error Handling**: Comprehensive error reporting and rollback protection
- ✅ **User Validation**: Checks source/target user existence and data summaries
- ✅ **Database Support**: Works with PostgreSQL (Neon) databases
- ✅ **Duplicate Prevention**: Handles conflicts with existing data
- ✅ **User ID Mapping**: Always get the right data, even after SESSION_SECRET changes

## Quick Start (Recommended)

### 1. List Available Users
```bash
npm run migrate:users list
```

### 2. View User Summary
```bash
npm run migrate:users summary "user_id_here"
```

### 3. Dry Run Migration (Always Do This First)
```bash
npm run migrate:users migrate "source_user" "target_user" --dry-run
```

### 4. Execute Migration
```bash
npm run migrate:users migrate "source_user" "target_user"
```

### 5. (If needed) Consolidate User Data
```bash
npx tsx scripts/consolidate-user-data.ts
```

---

## How to Recover from SESSION_SECRET Changes

1. **Log in with your original PIN/passphrase.**
   - If you see your old data, you're done!
   - If not, run the consolidation tool:
     ```bash
     npx tsx scripts/consolidate-user-data.ts
     ```
2. **Follow the prompts to select your real user ID.**
3. **(Optional) Use the migration tool to merge data from other user IDs.**
4. **Test your login.** You should always see your original data now.

---

## Main Migration Tool (`migrate-users.ts`)

### Basic Commands
```bash
# List all users in database
npm run migrate:users list

# Show detailed user summary
npm run migrate:users summary "0003fb90e9b74a8409e29d6e70d75617"

# Dry run migration (preview changes)
npm run migrate:users migrate "source_user" "target_user" --dry-run

# Execute full migration
npm run migrate:users migrate "source_user" "target_user"

# ⚠️ Delete ALL data for a user (irreversible!)
npm run migrate:users delete "user_id_here"
```

### Delete User Data (NEW)

**Danger!** This will permanently delete all folders, snippets, clipboard items, and user mappings for the specified user ID.

- You will be prompted for confirmation before deletion.
- The CLI will show how many records were deleted from each table.

**Example:**
```bash
npm run migrate:users delete "abc123"
```
Output:
```
⚠️  Are you sure you want to delete ALL data for user "abc123"? This cannot be undone! (y/N): y

🗑️  Deleted for user abc123:
  Folders:        5
  Snippets:       42
  ClipboardItems: 10
  UserMappings:   1
```

### Advanced Options
```bash
# Migrate only specific data types
npm run migrate:users migrate "source" "target" --folders-only
npm run migrate:users migrate "source" "target" --snippets-only
npm run migrate:users migrate "source" "target" --clipboard-only

# Skip specific data types
npm run migrate:users migrate "source" "target" --no-folders
npm run migrate:users migrate "source" "target" --no-snippets
npm run migrate:users migrate "source" "target" --no-clipboard

# Get help
npm run migrate:users --help
```

## Alternative Migration Tools

### User Consolidation Tool
```bash
# Launch interactive consolidation wizard
npm run migrate:consolidate
```

### Legacy Migration Tools (Deprecated)
These are kept for backward compatibility but the main `migrate-users.ts` tool is recommended:

```bash
# Interactive mode (legacy)
npx tsx scripts/migrate-user-data.ts

# Legacy CLI mode
npx tsx scripts/migrate-user-data-cli.ts --list-users
npx tsx scripts/migrate-user-data-cli.ts --user-summary "user_id"
```

## Command Reference

### Main Tool (`migrate-users.ts`)

| Command | Description | Example |
|---------|-------------|---------|
| `list` | List all users | `npm run migrate:users list` |
| `summary <userId>` | Show user data summary | `npm run migrate:users summary "user123"` |
| `migrate <source> <target>` | Migrate data between users | `npm run migrate:users migrate "user1" "user2"` |

### Migration Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without executing |
| `--folders-only` | Migrate only folders |
| `--snippets-only` | Migrate only snippets |
| `--clipboard-only` | Migrate only clipboard items |
| `--no-folders` | Skip folders |
| `--no-snippets` | Skip snippets |
| `--no-clipboard` | Skip clipboard items |

### NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run migrate:users` | **Main migration tool** (recommended) |
| `npm run migrate:consolidate` | User consolidation wizard |
| `npm run db:check` | Detailed database inspection |

## Migration Process

### 1. How Migration Works
- **COPY Operation**: Source user data is **copied** to target user
- **Source Preserved**: Original user keeps all their data unchanged
- **New IDs**: Target user gets copies with new database IDs
- **Relationships Maintained**: Folder-snippet links are preserved

### 2. Migration Order
1. **Folders** - Migrated first to establish structure
2. **Snippets** - Migrated with updated folder references
3. **Clipboard Items** - Migrated with new user ID

### 3. Before and After Example
```
Before Migration:
Source User: user_A
├── Folder: "Work" (ID: 10)
├── Snippet: "Email Template" (ID: 25, in folder 10)
└── Clipboard: "Hello World"

Target User: user_B
└── (empty)

After Migration:
Source User: user_A (UNCHANGED)
├── Folder: "Work" (ID: 10)           ← Still exists
├── Snippet: "Email Template" (ID: 25) ← Still exists
└── Clipboard: "Hello World"          ← Still exists

Target User: user_B (NEW DATA)
├── Folder: "Work" (ID: 45)           ← New copy with new ID
├── Snippet: "Email Template" (ID: 78) ← New copy, linked to folder 45
└── Clipboard: "Hello World"          ← New copy
```

## Database Configuration

### Environment Variables
```bash
# PostgreSQL (Neon Database)
DATABASE_URL="postgresql://user:pass@host:port/database"
NODE_ENV="production"
SESSION_SECRET="your-32-character-secret-key"
```

### Database Support
- **PostgreSQL**: Production databases via Neon with WebSocket support
- **Automatic Configuration**: Scripts automatically configure WebSocket for Neon

## Error Handling

### Common Errors and Solutions

#### 1. User Not Found
```
❌ Error: Source user "user123" not found in database
```
**Solution**: Use `npm run migrate:users list` to see available users

#### 2. Duplicate Data
```
❌ Failed to migrate folder "Work": duplicate key value violates unique constraint
```
**Solution**: Target user already has a folder with the same name

#### 3. Database Connection
```
❌ Migration failed: connect ECONNREFUSED
```
**Solution**: Check `DATABASE_URL` and database server status

#### 4. WebSocket Configuration
```
❌ fetch failed
```
**Solution**: Scripts automatically configure WebSocket for Neon

## Best Practices

### 1. Always Use Dry Run First
```bash
# Preview changes before executing
npm run migrate:users migrate "user1" "user2" --dry-run
```

### 2. Backup Before Migration
```bash
# PostgreSQL backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 3. Migrate in Stages
```bash
# Step 1: Migrate folders first
npm run migrate:users migrate "user1" "user2" --folders-only --dry-run
npm run migrate:users migrate "user1" "user2" --folders-only

# Step 2: Migrate snippets (will link to migrated folders)
npm run migrate:users migrate "user1" "user2" --snippets-only --dry-run
npm run migrate:users migrate "user1" "user2" --snippets-only

# Step 3: Migrate remaining data
npm run migrate:users migrate "user1" "user2" --clipboard-only --dry-run
npm run migrate:users migrate "user1" "user2" --clipboard-only
```

### 4. Verify Migration Results
```bash
# Check target user data after migration
npm run migrate:users summary "target_user"
```

## Troubleshooting

### Database Inspection
```bash
# Check database contents and user data
npm run db:check
```

### Manual Database Queries
```sql
-- PostgreSQL - Check user data
SELECT user_id, COUNT(*) as folders FROM folders GROUP BY user_id;
SELECT user_id, COUNT(*) as snippets FROM snippets GROUP BY user_id;
SELECT user_id, COUNT(*) as clipboard_items FROM clipboard_items GROUP BY user_id;

-- Find specific user data
SELECT * FROM folders WHERE user_id = 'your_user_id';
SELECT * FROM snippets WHERE user_id = 'your_user_id';
```

### Recovery from Failed Migration
1. **Restore from backup** if available
2. **Manually delete partially migrated data**:
```sql
DELETE FROM folders WHERE user_id = 'target_user_id';
DELETE FROM snippets WHERE user_id = 'target_user_id';
DELETE FROM clipboard_items WHERE user_id = 'target_user_id';
```

## Security Considerations

- Scripts require direct database access via `DATABASE_URL`
- User IDs are validated for existence before migration
- No audit logging of migration activities (consider adding for production)
- **Recommendation**: Run migrations in isolated environment for production

## Real-World Usage Examples

### Scenario 1: User Account Merge
```bash
# User wants to merge old account data into new account
npm run migrate:users summary "old_user_id"
npm run migrate:users summary "new_user_id"

# Dry run first
npm run migrate:users migrate "old_user_id" "new_user_id" --dry-run

# Execute migration
npm run migrate:users migrate "old_user_id" "new_user_id"
```

### Scenario 2: Selective Data Migration
```bash
# Migrate only work-related folders and snippets
npm run migrate:users migrate "personal_account" "work_account" --folders-only --dry-run
npm run migrate:users migrate "personal_account" "work_account" --snippets-only --dry-run

# Execute if satisfied
npm run migrate:users migrate "personal_account" "work_account" --folders-only
npm run migrate:users migrate "personal_account" "work_account" --snippets-only
```

### Scenario 3: Bulk User Migration Script
```bash
#!/bin/bash
# Create a batch migration script

USERS=(
  "user1_old:user1_new"
  "user2_old:user2_new"
  "user3_old:user3_new"
)

for user_pair in "${USERS[@]}"; do
  IFS=':' read -r source target <<< "$user_pair"
  echo "Migrating $source to $target"
  
  # Dry run first
  npm run migrate:users migrate "$source" "$target" --dry-run
  
  # Uncomment to execute
  # npm run migrate:users migrate "$source" "$target"
done
```

## Available Scripts Summary

| Script File | Purpose | Status |
|-------------|---------|--------|
| `migrate-users.ts` | **Main migration tool** | ✅ **Recommended** |
| `consolidate-user-data.ts` | User ID mapping/consolidation | ✅ **Available** |
| `check-existing-data.ts` | Database inspection | ✅ Available |
| `setup-db.ts` | Database management | ✅ Available |
| `migrate-user-data.ts` | Legacy interactive CLI | ⚠️ **Deprecated** |
| `migrate-user-data-cli.ts` | Legacy CLI tool | ⚠️ **Deprecated** |

## Support

For issues or questions:
1. **Check error messages** and solutions above
2. **Verify database connectivity** with `npm run db:check`
3. **Use dry-run mode** to identify issues before execution
4. **Review migration logs** for detailed error information
5. **Check user existence** with `npm run migrate:users list`

---

**💡 Tip**: Always start with `npm run migrate:users list` to see available users, then use `npm run migrate:users summary "user_id"` to understand what data will be migrated before running any migration commands. 