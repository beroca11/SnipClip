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
  // Create tables if they don't exist
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS snippets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      trigger TEXT NOT NULL UNIQUE,
      category TEXT,
      description TEXT,
      parent_id INTEGER,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
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
}

async function runPostgreSQLMigrations() {
  // Create tables if they don't exist
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS snippets (
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
} 