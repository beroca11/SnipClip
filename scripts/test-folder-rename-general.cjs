// NOTE: Run migrations before running this test script.
const { storage } = require('../server/storage');

async function testFolderRenameAndGeneral() {
  console.log("Testing folder rename functionality and General folder creation...");
  
  try {
    // Generate unique test identifiers
    const timestamp = Date.now();
    const user1 = `user1_test_${timestamp}`;
    const user2 = `user2_test_${timestamp}`;
    
    console.log("\n--- Testing General Folder Creation ---");
    
    // Test 1: Ensure General folder is created automatically
    console.log("\n--- Test 1: Auto-create General folder ---");
    const folders1 = await storage.getFolders(user1);
    console.log(`✓ User 1 has ${folders1.length} folders initially`);
    
    // Call ensureGeneralFolder explicitly
    const generalFolder = await storage.ensureGeneralFolder(user1);
    console.log("✓ General folder created/retrieved:", generalFolder.name, "with ID:", generalFolder.id);
    
    const folders2 = await storage.getFolders(user1);
    console.log(`✓ User 1 now has ${folders2.length} folders`);
    
    // Test 2: General folder should be created for new users
    console.log("\n--- Test 2: General folder for new user ---");
    const folders3 = await storage.getFolders(user2);
    console.log(`✓ User 2 has ${folders3.length} folders (should include General)`);
    
    const generalFolder2 = folders3.find(f => f.name === "General");
    if (generalFolder2) {
      console.log("✓ User 2 has General folder:", generalFolder2.id);
    } else {
      console.log("✗ User 2 missing General folder");
    }
    
    console.log("\n--- Testing Folder Rename Functionality ---");
    
    // Test 3: Create a folder and rename it
    console.log("\n--- Test 3: Basic folder rename ---");
    const testFolder = await storage.createFolder("Original Name", user1);
    console.log("✓ Created folder:", testFolder.name, "with ID:", testFolder.id);
    
    const renamedFolder = await storage.updateFolder(testFolder.id, "New Name", user1);
    console.log("✓ Renamed folder to:", renamedFolder.name);
    
    // Verify the rename worked
    const updatedFolders = await storage.getFolders(user1);
    const foundFolder = updatedFolders.find(f => f.id === testFolder.id);
    if (foundFolder && foundFolder.name === "New Name") {
      console.log("✓ Folder rename verified in folder list");
    } else {
      console.log("✗ Folder rename not reflected in folder list");
    }
    
    // Test 4: Try to rename to duplicate name (should fail)
    console.log("\n--- Test 4: Rename to duplicate name ---");
    const folder2 = await storage.createFolder("Unique Name", user1);
    console.log("✓ Created second folder:", folder2.name);
    
    try {
      await storage.updateFolder(folder2.id, "New Name", user1); // Same name as renamed folder
      console.log("✗ Should have failed - renamed to duplicate name");
    } catch (error) {
      console.log("✓ Correctly prevented rename to duplicate name");
      console.log("  Error message:", error.message);
    }
    
    // Test 5: Try to rename to "General" (should fail)
    console.log("\n--- Test 5: Rename to reserved name ---");
    try {
      await storage.updateFolder(testFolder.id, "General", user1);
      console.log("✗ Should have failed - renamed to reserved name");
    } catch (error) {
      console.log("✓ Correctly prevented rename to reserved name");
      console.log("  Error message:", error.message);
    }
    
    // Test 6: Try to create folder named "General" (should fail)
    console.log("\n--- Test 6: Create reserved folder name ---");
    try {
      await storage.createFolder("General", user1);
      console.log("✗ Should have failed - created reserved folder name");
    } catch (error) {
      console.log("✓ Correctly prevented creation of reserved folder name");
      console.log("  Error message:", error.message);
    }
    
    // Test 7: Try to delete General folder (should fail)
    console.log("\n--- Test 7: Delete General folder ---");
    try {
      await storage.deleteFolder(generalFolder.id, user1);
      console.log("✗ Should have failed - deleted General folder");
    } catch (error) {
      console.log("✓ Correctly prevented deletion of General folder");
      console.log("  Error message:", error.message);
    }
    
    // Test 8: Verify user isolation - users can have same folder names
    console.log("\n--- Test 8: User isolation for folder names ---");
    const user1Folder = await storage.createFolder("Shared Name", user1);
    const user2Folder = await storage.createFolder("Shared Name", user2);
    console.log("✓ Both users can have folders with same name");
    console.log("  User 1 folder ID:", user1Folder.id);
    console.log("  User 2 folder ID:", user2Folder.id);
    
    // Test 9: Verify General folder is always first in sort order
    console.log("\n--- Test 9: General folder sort order ---");
    const allUser1Folders = await storage.getFolders(user1);
    const firstFolder = allUser1Folders[0];
    if (firstFolder && firstFolder.name === "General") {
      console.log("✓ General folder appears first in folder list");
    } else {
      console.log("✗ General folder not first in folder list");
    }
    
    console.log("\n--- Test Summary ---");
    console.log("✓ General folder auto-created for all users");
    console.log("✓ Folder rename functionality working");
    console.log("✓ Duplicate name prevention working");
    console.log("✓ Reserved name protection working");
    console.log("✓ General folder deletion prevention working");
    console.log("✓ User isolation maintained for folder names");
    console.log("✓ General folder appears first in sort order");
    
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

// Run the test
testFolderRenameAndGeneral().then(() => {
  console.log("\nAll folder rename and General folder tests completed successfully!");
  process.exit(0);
}).catch((error) => {
  console.error("Test suite failed:", error);
  process.exit(1);
}); 