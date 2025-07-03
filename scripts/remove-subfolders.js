const { db } = require('../server/db');
const { sql } = require('drizzle-orm');

async function removeSubfolders() {
  if (!db) {
    console.log("No database available");
    return;
  }

  try {
    console.log("Starting subfolder removal migration...");
    
    const isSQLite = db.dialect && db.dialect.name === 'sqlite';
    
    if (isSQLite) {
      console.log("Running SQLite subfolder removal migration...");
      
      // Get or create General folder
      const generalFolderResult = await db.get(sql`SELECT id FROM folders WHERE name = 'General'`);
      let generalFolderId = generalFolderResult?.id;
      
      if (!generalFolderId) {
        console.log("Creating General folder...");
        const insert = await db.run(sql`INSERT INTO folders (name) VALUES ('General')`);
        generalFolderId = insert.lastID;
        console.log(`General folder created with ID: ${generalFolderId}`);
      } else {
        console.log(`General folder found with ID: ${generalFolderId}`);
      }
      
      // Find all subfolders (folders with parent_id)
      const subfolders = await db.all(sql`SELECT id, name FROM folders WHERE parent_id IS NOT NULL`);
      console.log(`Found ${subfolders.length} subfolders to process`);
      
      // Move snippets from subfolders to General folder
      for (const subfolder of subfolders) {
        const snippetCount = await db.get(sql`SELECT COUNT(*) as count FROM snippets WHERE folder_id = ?`, [subfolder.id]);
        if (snippetCount.count > 0) {
          await db.run(sql`UPDATE snippets SET folder_id = ? WHERE folder_id = ?`, [generalFolderId, subfolder.id]);
          console.log(`Moved ${snippetCount.count} snippets from subfolder "${subfolder.name}" to General`);
        }
      }
      
      // Remove all subfolders
      await db.run(sql`DELETE FROM folders WHERE parent_id IS NOT NULL`);
      console.log(`Removed ${subfolders.length} subfolders`);
      
      // Remove parent_id column if it exists
      try {
        await db.run(sql`ALTER TABLE folders DROP COLUMN parent_id`);
        console.log("Removed parent_id column from folders table");
      } catch (error) {
        console.log("parent_id column doesn't exist or couldn't be removed");
      }
      
    } else {
      console.log("Running PostgreSQL subfolder removal migration...");
      
      // Get or create General folder
      const generalFolderResult = await db.get(sql`SELECT id FROM folders WHERE name = 'General'`);
      let generalFolderId = generalFolderResult?.id;
      
      if (!generalFolderId) {
        console.log("Creating General folder...");
        const insert = await db.run(sql`INSERT INTO folders (name) VALUES ('General') RETURNING id`);
        generalFolderId = insert.id;
        console.log(`General folder created with ID: ${generalFolderId}`);
      } else {
        console.log(`General folder found with ID: ${generalFolderId}`);
      }
      
      // Find all subfolders (folders with parent_id)
      const subfolders = await db.all(sql`SELECT id, name FROM folders WHERE parent_id IS NOT NULL`);
      console.log(`Found ${subfolders.length} subfolders to process`);
      
      // Move snippets from subfolders to General folder
      for (const subfolder of subfolders) {
        const snippetCount = await db.get(sql`SELECT COUNT(*) as count FROM snippets WHERE folder_id = $1`, [subfolder.id]);
        if (snippetCount.count > 0) {
          await db.run(sql`UPDATE snippets SET folder_id = $1 WHERE folder_id = $2`, [generalFolderId, subfolder.id]);
          console.log(`Moved ${snippetCount.count} snippets from subfolder "${subfolder.name}" to General`);
        }
      }
      
      // Remove all subfolders
      await db.run(sql`DELETE FROM folders WHERE parent_id IS NOT NULL`);
      console.log(`Removed ${subfolders.length} subfolders`);
      
      // Remove parent_id column if it exists
      try {
        await db.run(sql`
          DO $$
          BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='folders' AND column_name='parent_id') THEN
              ALTER TABLE folders DROP COLUMN parent_id;
            END IF;
          END$$;
        `);
        console.log("Removed parent_id column from folders table");
      } catch (error) {
        console.log("parent_id column doesn't exist or couldn't be removed");
      }
    }
    
    console.log("Subfolder removal migration completed successfully!");
    
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  removeSubfolders()
    .then(() => {
      console.log("Migration completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

module.exports = { removeSubfolders }; 