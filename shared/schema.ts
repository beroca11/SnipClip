import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { sqliteTable as sqliteTableCore, text as textSQLite, integer as integerSQLite } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Input sanitization helper
function sanitizeText(text: string): string {
  return text.trim().replace(/[\x00-\x1f\x7f-\x9f]/g, ''); // Remove control characters
}

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

// Enhanced validation schemas with security measures
export const insertSnippetSchema = createInsertSchema(snippets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
}).extend({
  title: z.string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less")
    .transform(sanitizeText)
    .refine(val => val.length > 0, "Title cannot be empty after sanitization"),
  content: z.string()
    .min(1, "Content is required")
    .max(50000, "Content must be 50,000 characters or less")
    .transform(sanitizeText)
    .refine(val => val.length > 0, "Content cannot be empty after sanitization"),
  trigger: z.string()
    .min(1, "Trigger is required")
    .max(50, "Trigger must be 50 characters or less")
    .regex(/^[a-zA-Z0-9\-_\/\.]+$/, "Trigger can only contain letters, numbers, hyphens, underscores, forward slashes, and dots")
    .transform(sanitizeText),
  description: z.string()
    .max(500, "Description must be 500 characters or less")
    .transform(sanitizeText)
    .optional(),
  folderId: z.number()
    .int("Folder ID must be an integer")
    .positive("Folder ID must be positive")
    .optional()
    .nullable()
});

export const insertFolderSchema = createInsertSchema(folders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
}).extend({
  name: z.string()
    .min(1, "Folder name is required")
    .max(100, "Folder name must be 100 characters or less")
    .transform(sanitizeText)
    .refine(val => val.length > 0, "Folder name cannot be empty after sanitization")
    .refine(val => val.toLowerCase() !== "general", "Cannot use 'General' as folder name - it's reserved"),
  sortOrder: z.number()
    .int("Sort order must be an integer")
    .min(0, "Sort order must be non-negative")
    .max(9999, "Sort order must be less than 10,000")
    .default(0)
});

export const insertClipboardItemSchema = createInsertSchema(clipboardItems).omit({
  id: true,
  createdAt: true,
  userId: true,
}).extend({
  content: z.string()
    .min(1, "Content is required")
    .max(100000, "Content must be 100,000 characters or less")
    .transform(sanitizeText)
    .refine(val => val.length > 0, "Content cannot be empty after sanitization"),
  type: z.enum(["text", "url", "code"], {
    errorMap: () => ({ message: "Type must be one of: text, url, code" })
  }).default("text")
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
}).extend({
  snippetShortcut: z.string()
    .min(1, "Snippet shortcut is required")
    .max(20, "Snippet shortcut must be 20 characters or less")
    .regex(/^[a-zA-Z0-9+\-;':,.<>/?]+$/, "Invalid shortcut format")
    .transform(sanitizeText)
    .default("ctrl+;"),
  clipboardShortcut: z.string()
    .min(1, "Clipboard shortcut is required")
    .max(20, "Clipboard shortcut must be 20 characters or less")
    .regex(/^[a-zA-Z0-9+\-;':,.<>/?]+$/, "Invalid shortcut format")
    .transform(sanitizeText)
    .default("ctrl+shift+v"),
  clipboardEnabled: z.number()
    .int("Clipboard enabled must be an integer")
    .min(0, "Clipboard enabled must be 0 or 1")
    .max(1, "Clipboard enabled must be 0 or 1")
    .default(1),
  historyLimit: z.number()
    .int("History limit must be an integer")
    .min(10, "History limit must be at least 10")
    .max(1000, "History limit must be at most 1000")
    .default(100),
  launchOnStartup: z.number()
    .int("Launch on startup must be an integer")
    .min(0, "Launch on startup must be 0 or 1")
    .max(1, "Launch on startup must be 0 or 1")
    .default(0),
  theme: z.enum(["light", "dark"], {
    errorMap: () => ({ message: "Theme must be either 'light' or 'dark'" })
  }).default("light")
});

export type InsertSnippet = z.infer<typeof insertSnippetSchema>;
export type Snippet = typeof snippets.$inferSelect;

export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type Folder = typeof folders.$inferSelect;

export type InsertClipboardItem = z.infer<typeof insertClipboardItemSchema>;
export type ClipboardItem = typeof clipboardItems.$inferSelect;

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

// Partial settings schema for updates
export const updateSettingsSchema = insertSettingsSchema.partial();
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;
