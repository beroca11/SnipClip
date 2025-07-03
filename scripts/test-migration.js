import { db } from '../server/db.ts';
import { runMigrations } from '../server/migrations.ts';
import { folders, foldersSQLite } from '../shared/schema.js';

async function testMigration() {
  try {
    console.log('Testing migration...');
    await runMigrations();
    console.log('Migration completed successfully!');
    
    // Test if we can query the folders table
    const isSQLite = db.dialect && db.dialect.name === 'sqlite';
    const foldersTable = isSQLite ? foldersSQLite : folders;
    
    const foldersResult = await db.select().from(foldersTable).limit(1);
    console.log('Folders table query successful:', foldersResult);
    
    process.exit(0);
  } catch (error) {
    console.error('Migration test failed:', error);
    process.exit(1);
  }
}

testMigration(); 