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
}

async function runPostgreSQLMigrations() {
  // Create folders table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS folders (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      sort_order INTEGER DEFAULT 0
    )
  `);

  // Create snippets table with folderId
  await db.run(sql`
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

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS clipboard_items (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      user_id TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(sql`
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
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_snippets_user_id ON snippets(user_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_snippets_trigger ON snippets(trigger)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_clipboard_items_user_id ON clipboard_items(user_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_clipboard_items_created_at ON clipboard_items(created_at)`);

  // Create default General folder and assign all existing snippets
  const result = await db.get(sql`SELECT id FROM folders WHERE name = 'General'`);
  let generalFolderId = result?.id;
  if (!generalFolderId) {
    const insert = await db.run(sql`INSERT INTO folders (name) VALUES ('General') RETURNING id`);
    generalFolderId = insert.id;
  }
  
  // Handle existing subfolders by moving their snippets to General and flattening the structure
  const subfolders = await db.all(sql`SELECT id, name FROM folders WHERE parent_id IS NOT NULL`);
  for (const subfolder of subfolders) {
    // Move snippets from subfolder to General
    await db.run(sql`UPDATE snippets SET folder_id = $1 WHERE folder_id = $2`, [generalFolderId, subfolder.id]);
    console.log(`Moved snippets from subfolder "${subfolder.name}" to General`);
  }
  
  // Remove all subfolders (folders with parent_id)
  await db.run(sql`DELETE FROM folders WHERE parent_id IS NOT NULL`);
  
  // Ensure all snippets have a folder (assign to General if null)
  await db.run(sql`UPDATE snippets SET folder_id = $1 WHERE folder_id IS NULL`, [generalFolderId]);
  
  // Add a trigger to automatically assign new snippets to General folder if no folder is specified
  await db.run(sql`
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
  await db.run(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='folders' AND column_name='sort_order') THEN
        ALTER TABLE folders ADD COLUMN sort_order INTEGER DEFAULT 0;
      END IF;
    END$$;
  `);
} 