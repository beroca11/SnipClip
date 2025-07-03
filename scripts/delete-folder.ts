import { storage } from '../server/storage';

async function deleteFolder() {
  try {
    console.log("Attempting to delete folder ID 39...");
    
    // Use the correct user ID for folder 39
    const userId = "7f2c8a00158bf7ff704b2141e54a78de";
    
    const deleted = await storage.deleteFolder(39, userId);
    
    if (deleted) {
      console.log("✓ Folder ID 39 deleted successfully");
    } else {
      console.log("✗ Folder ID 39 not found or could not be deleted");
    }
    
  } catch (error) {
    console.error("Error deleting folder:", error.message);
  }
}

deleteFolder().then(() => {
  console.log("Operation completed");
  process.exit(0);
}).catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
}); 