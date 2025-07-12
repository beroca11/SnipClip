import { pgTable, index, serial, text, timestamp, integer, foreignKey, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const clipboardItems = pgTable("clipboard_items", {
	id: serial().primaryKey().notNull(),
	content: text().notNull(),
	type: text().default('text').notNull(),
	userId: text("user_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_clipboard_items_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_clipboard_items_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const settings = pgTable("settings", {
	id: serial().primaryKey().notNull(),
	snippetShortcut: text("snippet_shortcut").default('ctrl+;').notNull(),
	clipboardShortcut: text("clipboard_shortcut").default('ctrl+shift+v').notNull(),
	clipboardEnabled: integer("clipboard_enabled").default(1).notNull(),
	historyLimit: integer("history_limit").default(100).notNull(),
	launchOnStartup: integer("launch_on_startup").default(0).notNull(),
	theme: text().default('light').notNull(),
});

export const snippets = pgTable("snippets", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	content: text().notNull(),
	trigger: text().notNull(),
	category: text(),
	description: text(),
	parentId: integer("parent_id"),
	userId: text("user_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	folderId: integer("folder_id"),
}, (table) => [
	index("idx_snippets_trigger").using("btree", table.trigger.asc().nullsLast().op("text_ops")),
	index("idx_snippets_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.folderId],
			foreignColumns: [folders.id],
			name: "snippets_folder_id_fkey"
		}),
	unique("snippets_trigger_user_id_unique").on(table.trigger, table.userId),
]);

export const folders = pgTable("folders", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	parentId: integer("parent_id"),
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	userId: text("user_id").default('default').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "folders_parent_id_fkey"
		}),
	unique("folders_name_user_id_unique").on(table.name, table.userId),
]);
