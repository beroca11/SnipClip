import { db } from '../server/db';
import { folders, foldersSQLite } from '../shared/schema';

async function queryAllFolders() {
  try {
    console.log("Querying all folders directly from database...");
    
    if (!db) {
      console.log("No database available");
      return;
    }
    
    const isSQLite = db.dialect && db.dialect.name === 'sqlite';
    const activeFolders = isSQLite ? foldersSQLite : folders;
    
    console.log(`Using ${isSQLite ? 'SQLite' : 'PostgreSQL'} database`);
    
    const allFolders = await db.select().from(activeFolders);
    
    console.log(`\nFound ${allFolders.length} folders in database:`);
    
    if (allFolders.length === 0) {
      console.log("No folders found in database");
    } else {
      allFolders.forEach(folder => {
        console.log(`ID: ${folder.id}, Name: "${folder.name}", User: ${folder.userId || 'N/A'}, Created: ${folder.createdAt}`);
      });
    }
    
  } catch (error) {
    console.error("Error querying folders:", error.message);
  }
}

queryAllFolders().then(() => {
  console.log("\nOperation completed");
  process.exit(0);
}).catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
}); 