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

export const folders = pgTable("folders", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	parentId: integer("parent_id"),
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	userId: text("user_id").default('default').notNull(),
}, (table) => [
	index("idx_folders_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	unique("folders_name_user_id_unique").on(table.name, table.userId),
	foreignKey({
		columns: [table.parentId],
		foreignColumns: [table.id],
	}),
]);

export const settings = pgTable("settings", {
	id: serial().primaryKey().notNull(),
	snippetShortcut: text().default('ctrl+;').notNull(),
	clipboardShortcut: text().default('ctrl+shift+v').notNull(),
	clipboardEnabled: integer().default(1).notNull(),
	historyLimit: integer().default(100).notNull(),
	launchOnStartup: integer().default(0).notNull(),
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
	index("idx_snippets_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("idx_snippets_trigger").using("btree", table.trigger.asc().nullsLast().op("text_ops")),
	unique("snippets_trigger_user_id_unique").on(table.trigger, table.userId),
	foreignKey({
		columns: [table.folderId],
		foreignColumns: [table.id],
	}),
]);

// New table for user mappings to handle SESSION_SECRET changes
export const userMappings = pgTable("user_mappings", {
	id: serial().primaryKey().notNull(),
	pin: text().notNull(),
	passphraseHash: text().notNull(), // Store hash of passphrase for security
	userId: text("user_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_user_mappings_pin").using("btree", table.pin.asc().nullsLast().op("text_ops")),
	index("idx_user_mappings_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	unique("user_mappings_pin_passphrase_unique").on(table.pin, table.passphraseHash),
]);
