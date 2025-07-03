import { storage } from '../server/storage';

async function listFolders() {
  try {
    console.log("Listing all folders...");
    
    // Try with different user IDs to see if we can find the folder
    const userIds = ["admin", "default_user", "user1", "user2"];
    
    for (const userId of userIds) {
      console.log(`\n--- Folders for user: ${userId} ---`);
      try {
        const folders = await storage.getFolders(userId);
        if (folders.length === 0) {
          console.log("No folders found for this user");
        } else {
          folders.forEach(folder => {
            console.log(`ID: ${folder.id}, Name: "${folder.name}", User: ${folder.userId}`);
          });
        }
      } catch (error) {
        console.log(`Error getting folders for ${userId}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error("Error listing folders:", error.message);
  }
}

listFolders().then(() => {
  console.log("\nOperation completed");
  process.exit(0);
}).catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
}); 