const { db } = require('../server/db');
const { folders, snippets } = require('../shared/schema');

async function testUserFolders() {
  console.log('Testing user-specific folder system...');
  
  try {
    // Test user 1
    const user1 = 'user1@example.com';
    const user2 = 'user2@example.com';
    
    // Create folders for user 1
    const [folder1] = await db.insert(folders).values({
      name: 'React',
      userId: user1,
      parentId: null,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    const [folder2] = await db.insert(folders).values({
      name: 'JavaScript',
      userId: user1,
      parentId: null,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    // Create folders for user 2
    const [folder3] = await db.insert(folders).values({
      name: 'Python',
      userId: user2,
      parentId: null,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    // Test that users only see their own folders
    const user1Folders = await db.select().from(folders).where(eq(folders.userId, user1));
    const user2Folders = await db.select().from(folders).where(eq(folders.userId, user2));
    
    console.log('User 1 folders:', user1Folders.map(f => f.name));
    console.log('User 2 folders:', user2Folders.map(f => f.name));
    
    // Verify isolation
    const user1HasPython = user1Folders.some(f => f.name === 'Python');
    const user2HasReact = user2Folders.some(f => f.name === 'React');
    
    console.log('User 1 has Python folder:', user1HasPython);
    console.log('User 2 has React folder:', user2HasReact);
    
    if (!user1HasPython && !user2HasReact) {
      console.log('✅ User folder isolation working correctly!');
    } else {
      console.log('❌ User folder isolation failed!');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testUserFolders(); 