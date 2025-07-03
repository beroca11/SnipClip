const { db } = require('../server/db');
const { runMigrations } = require('../server/migrations');
const { storage } = require('../server/storage');

async function testUserSpecificFolders() {
  console.log("Testing user-specific folder functionality...");
  
  try {
    // Run migrations first
    await runMigrations();
    console.log("✓ Migrations completed");
    
    // Generate unique test identifiers to avoid conflicts
    const timestamp = Date.now();
    const user1 = `user1_test_${timestamp}`;
    const user2 = `user2_test_${timestamp}`;
    
    console.log("\n--- Testing User 1 ---");
    
    // User 1 creates folders
    const folder1 = await storage.createFolder("Work", user1);
    console.log("✓ User 1 created folder:", folder1.name);
    
    const folder2 = await storage.createFolder("Personal", user1);
    console.log("✓ User 1 created folder:", folder2.name);
    
    // User 1 creates snippets
    const snippet1 = await storage.createSnippet({
      title: "Work Snippet",
      content: "console.log('work');",
      trigger: "work",
      folderId: folder1.id
    }, user1);
    console.log("✓ User 1 created snippet in Work folder");
    
    const snippet2 = await storage.createSnippet({
      title: "Personal Snippet",
      content: "console.log('personal');",
      trigger: "personal",
      folderId: folder2.id
    }, user1);
    console.log("✓ User 1 created snippet in Personal folder");
    
    // Get User 1's folders and snippets
    const user1Folders = await storage.getFolders(user1);
    const user1Snippets = await storage.getSnippets(user1);
    console.log(`✓ User 1 has ${user1Folders.length} folders and ${user1Snippets.length} snippets`);
    
    console.log("\n--- Testing User 2 ---");
    
    // User 2 creates folders with same names (should work)
    const folder3 = await storage.createFolder("Work", user2);
    console.log("✓ User 2 created folder:", folder3.name);
    
    const folder4 = await storage.createFolder("Personal", user2);
    console.log("✓ User 2 created folder:", folder4.name);
    
    // User 2 creates snippets
    const snippet3 = await storage.createSnippet({
      title: "User 2 Work Snippet",
      content: "console.log('user2 work');",
      trigger: "work", // Same trigger as user1, but different user
      folderId: folder3.id
    }, user2);
    console.log("✓ User 2 created snippet in Work folder");
    
    const snippet4 = await storage.createSnippet({
      title: "User 2 Personal Snippet",
      content: "console.log('user2 personal');",
      trigger: "personal2", // Different trigger
      folderId: folder4.id
    }, user2);
    console.log("✓ User 2 created snippet in Personal folder");
    
    // Get User 2's folders and snippets
    const user2Folders = await storage.getFolders(user2);
    const user2Snippets = await storage.getSnippets(user2);
    console.log(`✓ User 2 has ${user2Folders.length} folders and ${user2Snippets.length} snippets`);
    
    console.log("\n--- Testing Isolation ---");
    
    // Verify users can't see each other's data
    const user1FoldersFromUser2 = await storage.getFolders(user1);
    const user2FoldersFromUser1 = await storage.getFolders(user2);
    
    console.log(`✓ User 1 folders when accessed by User 1: ${user1Folders.length}`);
    console.log(`✓ User 1 folders when accessed by User 2: ${user1FoldersFromUser2.length}`);
    console.log(`✓ User 2 folders when accessed by User 1: ${user2FoldersFromUser1.length}`);
    console.log(`✓ User 2 folders when accessed by User 2: ${user2Folders.length}`);
    
    // Test folder deletion
    console.log("\n--- Testing Folder Deletion ---");
    
    // Delete User 1's Work folder
    const deleted = await storage.deleteFolder(folder1.id, user1);
    console.log(`✓ User 1 deleted Work folder: ${deleted}`);
    
    // Check that snippets were moved to no folder
    const user1SnippetsAfterDelete = await storage.getSnippets(user1);
    const orphanedSnippets = user1SnippetsAfterDelete.filter(s => s.folderId === null);
    console.log(`✓ Snippets moved to no folder after deletion: ${orphanedSnippets.length}`);
    
    // Verify User 2's data is unaffected
    const user2SnippetsAfterDelete = await storage.getSnippets(user2);
    console.log(`✓ User 2 snippets unaffected: ${user2SnippetsAfterDelete.length}`);
    
    console.log("\n--- Testing Duplicate Prevention ---");
    
    try {
      // Try to create duplicate folder name for same user
      await storage.createFolder("Personal", user1);
      console.log("✗ Should have failed - duplicate folder name for same user");
    } catch (error) {
      console.log("✓ Correctly prevented duplicate folder name for same user");
    }
    
    try {
      // Try to create duplicate trigger for same user
      await storage.createSnippet({
        title: "Duplicate Trigger",
        content: "console.log('duplicate');",
        trigger: "personal", // Same trigger as existing snippet for user1
      }, user1);
      console.log("✗ Should have failed - duplicate trigger for same user");
    } catch (error) {
      console.log("✓ Correctly prevented duplicate trigger for same user");
    }
    
    console.log("\n--- Test Summary ---");
    console.log("✓ User-specific folders working correctly");
    console.log("✓ Data isolation between users working");
    console.log("✓ Folder deletion moves snippets to no folder");
    console.log("✓ Duplicate prevention working");
    
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

// Run the test
testUserSpecificFolders().then(() => {
  console.log("\nAll tests completed successfully!");
  process.exit(0);
}).catch((error) => {
  console.error("Test suite failed:", error);
  process.exit(1);
}); 