import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { sqliteTable as sqliteTableCore, text as textSQLite, integer as integerSQLite } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// PostgreSQL schema
export const folders = pgTable("folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: text("user_id").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Create a unique constraint on name + userId to prevent duplicate folder names per user
export const foldersUniqueConstraint = sql`UNIQUE(name, user_id)`;

export const snippets = pgTable("snippets", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  trigger: text("trigger").notNull(),
  description: text("description"),
  folderId: integer("folder_id").references(() => folders.id),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Create a unique constraint on trigger + userId to prevent duplicate triggers per user
export const snippetsUniqueConstraint = sql`UNIQUE(trigger, user_id)`;

export const clipboardItems = pgTable("clipboard_items", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  type: text("type").notNull().default("text"), // text, url, code
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  snippetShortcut: text("snippet_shortcut").notNull().default("ctrl+;"),
  clipboardShortcut: text("clipboard_shortcut").notNull().default("ctrl+shift+v"),
  clipboardEnabled: integer("clipboard_enabled").notNull().default(1), // boolean as int
  historyLimit: integer("history_limit").notNull().default(100),
  launchOnStartup: integer("launch_on_startup").notNull().default(0),
  theme: text("theme").notNull().default("light"),
});

// SQLite schema (for development)
export const foldersSQLite = sqliteTableCore("folders", {
  id: integerSQLite("id").primaryKey({ autoIncrement: true }),
  name: textSQLite("name").notNull(),
  userId: textSQLite("user_id").notNull(),
  sortOrder: integerSQLite("sort_order").notNull().default(0),
  createdAt: integerSQLite("created_at").notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integerSQLite("updated_at").notNull().default(sql`(strftime('%s', 'now'))`),
});

export const snippetsSQLite = sqliteTableCore("snippets", {
  id: integerSQLite("id").primaryKey({ autoIncrement: true }),
  title: textSQLite("title").notNull(),
  content: textSQLite("content").notNull(),
  trigger: textSQLite("trigger").notNull(),
  description: textSQLite("description"),
  folderId: integerSQLite("folder_id"),
  userId: textSQLite("user_id").notNull(),
  createdAt: integerSQLite("created_at").notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integerSQLite("updated_at").notNull().default(sql`(strftime('%s', 'now'))`),
});

export const clipboardItemsSQLite = sqliteTableCore("clipboard_items", {
  id: integerSQLite("id").primaryKey({ autoIncrement: true }),
  content: textSQLite("content").notNull(),
  type: textSQLite("type").notNull().default("text"),
  userId: textSQLite("user_id").notNull(),
  createdAt: integerSQLite("created_at").notNull().default(sql`(strftime('%s', 'now'))`),
});

export const settingsSQLite = sqliteTableCore("settings", {
  id: integerSQLite("id").primaryKey({ autoIncrement: true }),
  snippetShortcut: textSQLite("snippet_shortcut").notNull().default("ctrl+;"),
  clipboardShortcut: textSQLite("clipboard_shortcut").notNull().default("ctrl+shift+v"),
  clipboardEnabled: integerSQLite("clipboard_enabled").notNull().default(1),
  historyLimit: integerSQLite("history_limit").notNull().default(100),
  launchOnStartup: integerSQLite("launch_on_startup").notNull().default(0),
  theme: textSQLite("theme").notNull().default("light"),
});

export const insertSnippetSchema = createInsertSchema(snippets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
});

export const insertFolderSchema = createInsertSchema(folders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
});

export const insertClipboardItemSchema = createInsertSchema(clipboardItems).omit({
  id: true,
  createdAt: true,
  userId: true,
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
});

export type InsertSnippet = z.infer<typeof insertSnippetSchema>;
export type Snippet = typeof snippets.$inferSelect;

export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type Folder = typeof folders.$inferSelect;

export type InsertClipboardItem = z.infer<typeof insertClipboardItemSchema>;
export type ClipboardItem = typeof clipboardItems.$inferSelect;

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
