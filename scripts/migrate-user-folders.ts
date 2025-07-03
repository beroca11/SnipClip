import { db } from "../server/db";
import { sql } from "drizzle-orm";

const USER_ID = "112421";

async function migrate() {
  // Add user_id to folders if missing
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='folders' AND column_name='user_id'
      ) THEN
        ALTER TABLE folders ADD COLUMN user_id TEXT;
      END IF;
    END$$;
  `);

  // Assign all folders to USER_ID
  await db.execute(sql`UPDATE folders SET user_id = ${USER_ID}`);

  // Add user_id to snippets if missing
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='snippets' AND column_name='user_id'
      ) THEN
        ALTER TABLE snippets ADD COLUMN user_id TEXT;
      END IF;
    END$$;
  `);

  // Assign all snippets to USER_ID
  await db.execute(sql`UPDATE snippets SET user_id = ${USER_ID}`);

  console.log("Migration complete. All folders and snippets now belong to user:", USER_ID);
}

migrate().then(() => process.exit(0)); 