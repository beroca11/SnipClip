-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "clipboard_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"snippet_shortcut" text DEFAULT 'ctrl+;' NOT NULL,
	"clipboard_shortcut" text DEFAULT 'ctrl+shift+v' NOT NULL,
	"clipboard_enabled" integer DEFAULT 1 NOT NULL,
	"history_limit" integer DEFAULT 100 NOT NULL,
	"launch_on_startup" integer DEFAULT 0 NOT NULL,
	"theme" text DEFAULT 'light' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snippets" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"trigger" text NOT NULL,
	"category" text,
	"description" text,
	"parent_id" integer,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"folder_id" integer,
	CONSTRAINT "snippets_trigger_user_id_unique" UNIQUE("trigger","user_id")
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"parent_id" integer,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text DEFAULT 'default' NOT NULL,
	CONSTRAINT "folders_name_user_id_unique" UNIQUE("name","user_id")
);
--> statement-breakpoint
ALTER TABLE "snippets" ADD CONSTRAINT "snippets_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_clipboard_items_created_at" ON "clipboard_items" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_clipboard_items_user_id" ON "clipboard_items" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_snippets_trigger" ON "snippets" USING btree ("trigger" text_ops);--> statement-breakpoint
CREATE INDEX "idx_snippets_user_id" ON "snippets" USING btree ("user_id" text_ops);
*/