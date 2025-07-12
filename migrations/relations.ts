import { relations } from "drizzle-orm/relations";
import { folders, snippets } from "./schema";

export const snippetsRelations = relations(snippets, ({one}) => ({
	folder: one(folders, {
		fields: [snippets.folderId],
		references: [folders.id]
	}),
}));

export const foldersRelations = relations(folders, ({one, many}) => ({
	snippets: many(snippets),
	folder: one(folders, {
		fields: [folders.parentId],
		references: [folders.id],
		relationName: "folders_parentId_folders_id"
	}),
	folders: many(folders, {
		relationName: "folders_parentId_folders_id"
	}),
}));