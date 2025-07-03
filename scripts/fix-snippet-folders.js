const { db } = require('../server/db');
const { sql } = require('drizzle-orm');

async function fixSnippetFolders() {
  if (!db) {
    console.log("No database available");
    return;
  }

  try {
    console.log("Starting snippet folder migration...");
    
    const isSQLite = db.dialect && db.dialect.name === 'sqlite';
    
    if (isSQLite) {
      console.log("Running SQLite snippet folder migration...");
      
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
      
      // Count snippets without folders
      const nullFolderCount = await db.get(sql`SELECT COUNT(*) as count FROM snippets WHERE folder_id IS NULL`);
      console.log(`Found ${nullFolderCount.count} snippets without folders`);
      
      if (nullFolderCount.count > 0) {
        // Assign all snippets without folders to General folder
        await db.run(sql`UPDATE snippets SET folder_id = ? WHERE folder_id IS NULL`, [generalFolderId]);
        console.log(`Assigned ${nullFolderCount.count} snippets to General folder`);
      }
      
      // Count total snippets
      const totalSnippets = await db.get(sql`SELECT COUNT(*) as count FROM snippets`);
      console.log(`Total snippets in database: ${totalSnippets.count}`);
      
    } else {
      console.log("Running PostgreSQL snippet folder migration...");
      
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
      
      // Count snippets without folders
      const nullFolderCount = await db.get(sql`SELECT COUNT(*) as count FROM snippets WHERE folder_id IS NULL`);
      console.log(`Found ${nullFolderCount.count} snippets without folders`);
      
      if (nullFolderCount.count > 0) {
        // Assign all snippets without folders to General folder
        await db.run(sql`UPDATE snippets SET folder_id = $1 WHERE folder_id IS NULL`, [generalFolderId]);
        console.log(`Assigned ${nullFolderCount.count} snippets to General folder`);
      }
      
      // Count total snippets
      const totalSnippets = await db.get(sql`SELECT COUNT(*) as count FROM snippets`);
      console.log(`Total snippets in database: ${totalSnippets.count}`);
    }
    
    console.log("Snippet folder migration completed successfully!");
    
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  fixSnippetFolders()
    .then(() => {
      console.log("Migration completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

module.exports = { fixSnippetFolders }; 