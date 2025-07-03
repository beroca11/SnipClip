import { db } from '../server/db';
import { snippets, snippetsSQLite, folders, foldersSQLite } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

async function deleteFolderWithSnippets() {
  try {
    console.log("Attempting to delete folder ID 39...");
    
    if (!db) {
      console.log("No database available");
      return;
    }
    
    const isSQLite = db.dialect && db.dialect.name === 'sqlite';
    const activeSnippets = isSQLite ? snippetsSQLite : snippets;
    const activeFolders = isSQLite ? foldersSQLite : folders;
    
    console.log(`Using ${isSQLite ? 'SQLite' : 'PostgreSQL'} database`);
    
    // Step 1: Update all snippets that reference folder 39 to set folderId to null
    console.log("Step 1: Updating snippets to remove folder reference...");
    const updateResult = await db.update(activeSnippets)
      .set({ folderId: null })
      .where(eq(activeSnippets.folderId, 39));
    
    console.log(`✓ Updated ${updateResult.rowCount || 0} snippets to remove folder reference`);
    
    // Step 2: Delete the folder
    console.log("Step 2: Deleting folder 39...");
    const deleteResult = await db.delete(activeFolders)
      .where(eq(activeFolders.id, 39));
    
    if (deleteResult.rowCount && deleteResult.rowCount > 0) {
      console.log("✓ Folder ID 39 deleted successfully");
    } else {
      console.log("✗ Folder ID 39 not found or could not be deleted");
    }
    
  } catch (error) {
    console.error("Error deleting folder:", error.message);
  }
}

deleteFolderWithSnippets().then(() => {
  console.log("Operation completed");
  process.exit(0);
}).catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
}); 