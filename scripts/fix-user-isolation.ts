import { db } from "../server/db";
import { sql } from "drizzle-orm";
import { generateUserId } from "../server/auth";

async function fixUserIsolation() {
  console.log("Starting user isolation fix...");
  
  if (!db) {
    console.log("No database connection available. Using file storage.");
    return;
  }
  
  try {
    // Check if we're using SQLite or PostgreSQL
    const isSQLite = db.dialect && db.dialect.name === 'sqlite';
    
    console.log(`Using ${isSQLite ? 'SQLite' : 'PostgreSQL'} database`);
    
    // Check for folders without user_id
    const foldersWithoutUserId = await db.execute(sql`
      SELECT id, name FROM folders WHERE user_id IS NULL OR user_id = ''
    `);
    
    if (foldersWithoutUserId?.rows && foldersWithoutUserId.rows.length > 0) {
      console.log(`Found ${foldersWithoutUserId.rows.length} folders without user_id`);
      
      // Assign a default user_id to these folders
      const defaultUserId = generateUserId("0000", "defaultpassword");
      
      for (const folder of foldersWithoutUserId.rows) {
        await db.execute(sql`
          UPDATE folders 
          SET user_id = ${defaultUserId} 
          WHERE id = ${folder.id}
        `);
        console.log(`Updated folder "${folder.name}" with user_id: ${defaultUserId.substring(0, 8)}...`);
      }
    }
    
    // Check for snippets without user_id
    const snippetsWithoutUserId = await db.execute(sql`
      SELECT id, title, trigger FROM snippets WHERE user_id IS NULL OR user_id = ''
    `);
    
    if (snippetsWithoutUserId?.rows && snippetsWithoutUserId.rows.length > 0) {
      console.log(`Found ${snippetsWithoutUserId.rows.length} snippets without user_id`);
      
      // Assign a default user_id to these snippets
      const defaultUserId = generateUserId("0000", "defaultpassword");
      
      for (const snippet of snippetsWithoutUserId.rows) {
        await db.execute(sql`
          UPDATE snippets 
          SET user_id = ${defaultUserId} 
          WHERE id = ${snippet.id}
        `);
        console.log(`Updated snippet "${snippet.title}" with user_id: ${defaultUserId.substring(0, 8)}...`);
      }
    }
    
    // Check for clipboard items without user_id
    const clipboardWithoutUserId = await db.execute(sql`
      SELECT id, content FROM clipboard_items WHERE user_id IS NULL OR user_id = ''
    `);
    
    if (clipboardWithoutUserId?.rows && clipboardWithoutUserId.rows.length > 0) {
      console.log(`Found ${clipboardWithoutUserId.rows.length} clipboard items without user_id`);
      
      // Clean up old clipboard items without user_id
      await db.execute(sql`
        DELETE FROM clipboard_items WHERE user_id IS NULL OR user_id = ''
      `);
      console.log("Cleaned up clipboard items without user_id");
    }
    
    // Show user statistics
    const userStats = await db.execute(sql`
      SELECT 
        user_id,
        COUNT(*) as snippet_count
      FROM snippets 
      GROUP BY user_id
    `);
    
    console.log("\nUser Statistics:");
    console.log("================");
    for (const stat of userStats?.rows || []) {
      const maskedUserId = stat.user_id.substring(0, 8) + "...";
      console.log(`User ${maskedUserId}: ${stat.snippet_count} snippets`);
    }
    
    const folderStats = await db.execute(sql`
      SELECT 
        user_id,
        COUNT(*) as folder_count
      FROM folders 
      GROUP BY user_id
    `);
    
    console.log("\nFolder Statistics:");
    console.log("==================");
    for (const stat of folderStats?.rows || []) {
      const maskedUserId = stat.user_id.substring(0, 8) + "...";
      console.log(`User ${maskedUserId}: ${stat.folder_count} folders`);
    }
    
    console.log("\nUser isolation fix completed successfully!");
    
  } catch (error) {
    console.error("Error during user isolation fix:", error);
    throw error;
  }
}

// Run the fix if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixUserIsolation().catch(console.error);
}

export { fixUserIsolation }; 