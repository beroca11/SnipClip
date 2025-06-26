import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const snippets = pgTable("snippets", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  trigger: text("trigger").notNull().unique(),
  category: text("category"),
  description: text("description"),
  parentId: integer("parent_id"),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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

export const insertSnippetSchema = createInsertSchema(snippets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClipboardItemSchema = createInsertSchema(clipboardItems).omit({
  id: true,
  createdAt: true,
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
});

export type InsertSnippet = z.infer<typeof insertSnippetSchema>;
export type Snippet = typeof snippets.$inferSelect;

export type InsertClipboardItem = z.infer<typeof insertClipboardItemSchema>;
export type ClipboardItem = typeof clipboardItems.$inferSelect;

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
