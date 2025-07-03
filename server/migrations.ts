import { db } from "./db";
import { 
  snippets, 
  clipboardItems, 
  settings,
  snippetsSQLite,
  clipboardItemsSQLite,
  settingsSQLite
} from "@shared/schema";
import { sql } from "drizzle-orm";

export async function runMigrations() {
  if (!db) {
    console.log("No database available, skipping migrations");
    return;
  }

  try {
    const isSQLite = db.dialect && db.dialect.name === 'sqlite';
    
    if (isSQLite) {
      console.log("Running SQLite migrations...");
      await runSQLiteMigrations();
    } else {
      console.log("Running PostgreSQL migrations...");
      await runPostgreSQLMigrations();
    }
    
    console.log("Migrations completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

async function runSQLiteMigrations() {
  // Create folders table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Create snippets table with folderId
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS snippets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      trigger TEXT NOT NULL UNIQUE,
      description TEXT,
      folder_id INTEGER,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY(folder_id) REFERENCES folders(id)
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS clipboard_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snippet_shortcut TEXT NOT NULL DEFAULT 'ctrl+;',
      clipboard_shortcut TEXT NOT NULL DEFAULT 'ctrl+shift+v',
      clipboard_enabled INTEGER NOT NULL DEFAULT 1,
      history_limit INTEGER NOT NULL DEFAULT 100,
      launch_on_startup INTEGER NOT NULL DEFAULT 0,
      theme TEXT NOT NULL DEFAULT 'light'
    )
  `);

  // Create indexes for better performance
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_snippets_user_id ON snippets(user_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_snippets_trigger ON snippets(trigger)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_clipboard_items_user_id ON clipboard_items(user_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_clipboard_items_created_at ON clipboard_items(created_at)`);

  // Create default General folder and assign all existing snippets
  const result = await db.get(sql`SELECT id FROM folders WHERE name = 'General'`);
  let generalFolderId = result?.id;
  if (!generalFolderId) {
    const insert = await db.run(sql`INSERT INTO folders (name) VALUES ('General')`);
    generalFolderId = insert.lastID;
  }
  
  // Handle existing subfolders by moving their snippets to General and flattening the structure
  const subfolders = await db.all(sql`SELECT id, name FROM folders WHERE parent_id IS NOT NULL`);
  for (const subfolder of subfolders) {
    // Move snippets from subfolder to General
    await db.run(sql`UPDATE snippets SET folder_id = ? WHERE folder_id = ?`, [generalFolderId, subfolder.id]);
    console.log(`Moved snippets from subfolder "${subfolder.name}" to General`);
  }
  
  // Remove all subfolders (folders with parent_id)
  await db.run(sql`DELETE FROM folders WHERE parent_id IS NOT NULL`);
  
  // Ensure all snippets have a folder (assign to General if null)
  await db.run(sql`UPDATE snippets SET folder_id = ? WHERE folder_id IS NULL`, [generalFolderId]);
  
  // Add a trigger to automatically assign new snippets to General folder if no folder is specified
  await db.run(sql`
    CREATE TRIGGER IF NOT EXISTS set_default_folder
    AFTER INSERT ON snippets
    WHEN NEW.folder_id IS NULL
    BEGIN
      UPDATE snippets SET folder_id = (SELECT id FROM folders WHERE name = 'General' LIMIT 1) WHERE id = NEW.id;
    END
  `);

  // Add sort_order column to folders if not exist
  await db.run(sql`ALTER TABLE folders ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`);

  // Check if folders table has userId column
  const tableInfo = await db.run(sql`PRAGMA table_info(folders)`);
  const hasUserId = tableInfo.some((row: any) => row.name === 'user_id');
  
  if (!hasUserId) {
    console.log("Adding userId column to folders table...");
    
    // Add userId column to folders table
    await db.run(sql`ALTER TABLE folders ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default_user'`);
    
    // Add unique constraint for name + userId
    await db.run(sql`CREATE UNIQUE INDEX folders_name_user_id_unique ON folders(name, user_id)`);
    
    console.log("Added userId column to folders table");
  }
  
  // Check if snippets table has unique constraint on trigger + userId
  const snippetIndexes = await db.run(sql`PRAGMA index_list(snippets)`);
  const hasTriggerUserIdIndex = snippetIndexes.some((row: any) => row.name === 'snippets_trigger_user_id_unique');
  
  if (!hasTriggerUserIdIndex) {
    console.log("Adding unique constraint on trigger + userId for snippets...");
    
    // Remove old unique constraint on trigger if it exists
    try {
      await db.run(sql`DROP INDEX IF EXISTS snippets_trigger_unique`);
    } catch (error) {
      // Index might not exist, ignore error
    }
    
    // Add new unique constraint for trigger + userId
    await db.run(sql`CREATE UNIQUE INDEX snippets_trigger_user_id_unique ON snippets(trigger, user_id)`);
    
    console.log("Added unique constraint on trigger + userId for snippets");
  }
}

async function runPostgreSQLMigrations() {
  // Create folders table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS folders (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      sort_order INTEGER DEFAULT 0
    )
  `);

  // Create snippets table with folderId
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS snippets (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      trigger TEXT NOT NULL UNIQUE,
      description TEXT,
      folder_id INTEGER REFERENCES folders(id),
      user_id TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS clipboard_items (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      user_id TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

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

  // Create indexes for better performance
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_snippets_user_id ON snippets(user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_snippets_trigger ON snippets(trigger)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_clipboard_items_user_id ON clipboard_items(user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_clipboard_items_created_at ON clipboard_items(created_at)`);

  // Create default General folder and assign all existing snippets
  const result = await db.execute(sql`SELECT id FROM folders WHERE name = 'General'`);
  let generalFolderId = result?.rows?.[0]?.id;
  if (!generalFolderId) {
    const insert = await db.execute(sql`INSERT INTO folders (name) VALUES ('General') RETURNING id`);
    generalFolderId = insert?.rows?.[0]?.id;
  }
  
  // Handle existing subfolders by moving their snippets to General and flattening the structure
  const subfolders = await db.execute(sql`SELECT id, name FROM folders WHERE parent_id IS NOT NULL`);
  for (const subfolder of subfolders?.rows || []) {
    // Move snippets from subfolder to General
    await db.execute(sql`UPDATE snippets SET folder_id = ${generalFolderId} WHERE folder_id = ${subfolder.id}`);
    console.log(`Moved snippets from subfolder "${subfolder.name}" to General`);
  }
  
  // Remove all subfolders (folders with parent_id)
  await db.execute(sql`DELETE FROM folders WHERE parent_id IS NOT NULL`);
  
  // Ensure all snippets have a folder (assign to General if null)
  await db.execute(sql`UPDATE snippets SET folder_id = ${generalFolderId} WHERE folder_id IS NULL`);
  
  // Add a trigger to automatically assign new snippets to General folder if no folder is specified
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION set_default_folder()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.folder_id IS NULL THEN
        NEW.folder_id := (SELECT id FROM folders WHERE name = 'General' LIMIT 1);
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    DROP TRIGGER IF EXISTS set_default_folder_trigger ON snippets;
    CREATE TRIGGER set_default_folder_trigger
      BEFORE INSERT ON snippets
      FOR EACH ROW
      EXECUTE FUNCTION set_default_folder();
  `);

  // Add sort_order column to folders if not exist
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='folders' AND column_name='sort_order') THEN
        ALTER TABLE folders ADD COLUMN sort_order INTEGER DEFAULT 0;
      END IF;
    END$$;
  `);

  // Check if folders table has userId column
  const hasUserIdColumn = await db.execute(sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'folders' AND column_name = 'user_id'
  `);
  
  if (!hasUserIdColumn?.rows || hasUserIdColumn.rows.length === 0) {
    console.log("Adding userId column to folders table...");
    
    // Add userId column to folders table
    await db.execute(sql`ALTER TABLE folders ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default_user'`);
    
    console.log("Added userId column to folders table");
  }
  
  // Always ensure the correct unique constraint exists
  console.log("Ensuring correct unique constraint on folders...");
  
  // Dynamically find and drop any unique constraint on folders.name
  const constraints = await db.execute(sql`
    SELECT constraint_name 
    FROM information_schema.constraint_column_usage 
    WHERE table_name = 'folders' AND column_name = 'name'
  `);
  for (const row of constraints?.rows || []) {
    // Drop the constraint if it is unique
    await db.execute(sql`ALTER TABLE folders DROP CONSTRAINT IF EXISTS ${sql.raw(row.constraint_name)}`);
  }
  
  // Add new unique constraint for name + userId if it doesn't exist
  const hasNameUserIdConstraint = await db.execute(sql`
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'folders' AND constraint_name = 'folders_name_user_id_unique'
  `);
  
  if (!hasNameUserIdConstraint?.rows || hasNameUserIdConstraint.rows.length === 0) {
    await db.execute(sql`ALTER TABLE folders ADD CONSTRAINT folders_name_user_id_unique UNIQUE(name, user_id)`);
    console.log("Added unique constraint on (name, user_id) for folders");
  }
  
  // Check if snippets table has unique constraint on trigger + userId
  const hasTriggerUserIdConstraint = await db.execute(sql`
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'snippets' AND constraint_name = 'snippets_trigger_user_id_unique'
  `);
  
  if (!hasTriggerUserIdConstraint?.rows || hasTriggerUserIdConstraint.rows.length === 0) {
    console.log("Adding unique constraint on trigger + userId for snippets...");
    
    // Remove old unique constraint on trigger if it exists
    try {
      await db.execute(sql`ALTER TABLE snippets DROP CONSTRAINT IF EXISTS snippets_trigger_key`);
    } catch (error) {
      // Constraint might not exist, ignore error
    }
    
    // Add new unique constraint for trigger + userId
    await db.execute(sql`ALTER TABLE snippets ADD CONSTRAINT snippets_trigger_user_id_unique UNIQUE(trigger, user_id)`);
    
    console.log("Added unique constraint on trigger + userId for snippets");
  }
} 