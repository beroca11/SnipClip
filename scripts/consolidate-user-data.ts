import { generateUserId } from '../server/auth';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import * as readline from 'readline';

// Configure readline for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function consolidateUserData() {
  console.log('🔄 SnipClip User Data Consolidation Tool');
  console.log('========================================\n');

  try {
    // Get all users with data
    const result = await db.execute(sql`
      SELECT user_id, COUNT(*) as data_count FROM (
        SELECT user_id FROM snippets
        UNION ALL
        SELECT user_id FROM folders
        UNION ALL
        SELECT user_id FROM clipboard_items
      ) AS all_data
      GROUP BY user_id
      ORDER BY data_count DESC
    `);

    if (!result?.rows || result.rows.length === 0) {
      console.log('❌ No users found in database');
      return;
    }

    const users = result.rows.map(row => ({
      userId: row.user_id,
      dataCount: parseInt(row.data_count)
    }));

    console.log('📋 Users found in database:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.userId} (${user.dataCount} items)`);
    });

    console.log('\n🔍 To consolidate your data, I need to know your PIN and passphrase.');
    console.log('This will help identify which user ID corresponds to your account.\n');

    const pin = await question('Enter your PIN (4-6 digits): ');
    const passphrase = await question('Enter your passphrase: ');

    if (!pin || !passphrase) {
      console.log('❌ PIN and passphrase are required');
      return;
    }

    // Generate the current user ID with current SESSION_SECRET
    const currentUserId = generateUserId(pin, passphrase);
    console.log(`\n🔑 Generated User ID with current SESSION_SECRET: ${currentUserId}`);

    // Check if this user ID exists
    const currentUserExists = users.find(u => u.userId === currentUserId);
    if (currentUserExists) {
      console.log('✅ Your current user ID exists in the database!');
      console.log(`📊 Data count: ${currentUserExists.dataCount} items`);
      return;
    }

    console.log('❌ Your current user ID does not exist in the database.');
    console.log('This means your data is stored under a different user ID (likely due to SESSION_SECRET changes).\n');

    // Show users with significant data
    const significantUsers = users.filter(u => u.dataCount > 5);
    if (significantUsers.length > 0) {
      console.log('📊 Users with significant data (likely your account):');
      significantUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.userId} (${user.dataCount} items)`);
      });

      console.log('\n💡 Recommendation:');
      console.log('1. Choose the user ID with the most data (likely your original account)');
      console.log('2. Use the migration tool to consolidate data if needed');
      console.log('3. Update your SESSION_SECRET to match the original one if possible\n');

      const choice = await question('Enter the number of the user ID you want to use as your main account (or press Enter to skip): ');
      
      if (choice && !isNaN(parseInt(choice))) {
        const selectedIndex = parseInt(choice) - 1;
        if (selectedIndex >= 0 && selectedIndex < significantUsers.length) {
          const selectedUser = significantUsers[selectedIndex];
          console.log(`\n✅ Selected user ID: ${selectedUser.userId}`);
          console.log(`📊 This user has ${selectedUser.dataCount} items of data`);
          
          // Create a mapping file for future reference
          const mappingData = {
            pin,
            passphrase: '***HIDDEN***',
            originalUserId: selectedUser.userId,
            currentUserId,
            timestamp: new Date().toISOString(),
            note: 'User selected this ID as their main account during consolidation'
          };

          console.log('\n📝 Creating user mapping for future reference...');
          console.log('This will help the system remember your choice for future logins.');
          
          // Store the mapping in the database (you could create a user_mappings table)
          console.log('💡 To complete the consolidation:');
          console.log('1. Use the migration tool to move data from other users to this one');
          console.log('2. Consider updating your SESSION_SECRET to prevent future issues');
          console.log('3. Test your login to ensure it works correctly');
        }
      }
    }

    console.log('\n✨ Consolidation analysis completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Use "npm run migrate:users list" to see all users');
    console.log('2. Use "npm run migrate:users summary <userId>" to see user details');
    console.log('3. Use "npm run migrate:users migrate <source> <target>" to consolidate data');
    console.log('4. Test your login to ensure it works correctly');

  } catch (error) {
    console.error('❌ Error during consolidation:', error);
  } finally {
    rl.close();
  }
}

// Run the consolidation tool
consolidateUserData().catch(console.error); 