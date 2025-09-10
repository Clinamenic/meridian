const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Configuration
const DATA_DIR = '.meridian/data';
const ARCHIVE_FILE = path.join(DATA_DIR, 'archive.json');
const DATABASE_FILE = path.join(DATA_DIR, 'unified_resources.db');

console.log('🔍 Starting Arweave data migration (by title)...');
console.log(`📁 Archive file: ${ARCHIVE_FILE}`);
console.log(`🗄️  Database file: ${DATABASE_FILE}`);

// Check if files exist
if (!fs.existsSync(ARCHIVE_FILE)) {
  console.error('❌ Archive file not found!');
  process.exit(1);
}

if (!fs.existsSync(DATABASE_FILE)) {
  console.error('❌ Database file not found!');
  process.exit(1);
}

// Read archive data
console.log('📖 Reading archive data...');
const archiveData = JSON.parse(fs.readFileSync(ARCHIVE_FILE, 'utf8'));

// Find files with Arweave uploads
const filesWithArweave = archiveData.files.filter(file => 
  file.arweave_hashes && file.arweave_hashes.length > 0
);

console.log(`📊 Found ${filesWithArweave.length} files with Arweave uploads`);

if (filesWithArweave.length === 0) {
  console.log('✅ No Arweave data to migrate');
  process.exit(0);
}

// Open database
const db = new sqlite3.Database(DATABASE_FILE);

// Migration function
async function migrateArweaveData() {
  return new Promise((resolve, reject) => {
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    console.log('🔄 Starting migration...');

    // Process each file with Arweave uploads
    filesWithArweave.forEach((file, index) => {
      console.log(`\n📄 Processing file ${index + 1}/${filesWithArweave.length}: ${file.title}`);
      console.log(`   UUID: ${file.uuid}`);
      console.log(`   Arweave uploads: ${file.arweave_hashes.length}`);

      // Find corresponding resource in database by title
      const query = 'SELECT id, arweave_hashes FROM resources WHERE title = ?';
      
      db.get(query, [file.title], (err, row) => {
        if (err) {
          console.error(`❌ Database error for ${file.title}:`, err.message);
          errorCount++;
          return;
        }

        if (!row) {
          console.log(`⚠️  Resource not found in database: ${file.title}`);
          skippedCount++;
          return;
        }

        console.log(`   ✅ Found matching resource: ${row.id}`);

        // Check if Arweave hashes already exist
        let existingHashes = [];
        if (row.arweave_hashes) {
          try {
            existingHashes = JSON.parse(row.arweave_hashes);
          } catch (e) {
            console.log(`⚠️  Invalid existing Arweave hashes for ${file.title}, resetting`);
            existingHashes = [];
          }
        }

        // Merge existing and new Arweave hashes (avoid duplicates)
        const newHashes = file.arweave_hashes;
        const mergedHashes = [...existingHashes];
        
        newHashes.forEach(newHash => {
          const exists = mergedHashes.some(existing => existing.hash === newHash.hash);
          if (!exists) {
            mergedHashes.push(newHash);
            console.log(`   ➕ Adding Arweave hash: ${newHash.hash}`);
          } else {
            console.log(`   ⏭️  Skipping duplicate hash: ${newHash.hash}`);
          }
        });

        // Update database
        const updateQuery = 'UPDATE resources SET arweave_hashes = ? WHERE id = ?';
        const arweaveHashesJson = JSON.stringify(mergedHashes);
        
        db.run(updateQuery, [arweaveHashesJson, row.id], function(err) {
          if (err) {
            console.error(`❌ Failed to update ${file.title}:`, err.message);
            errorCount++;
          } else {
            console.log(`✅ Successfully migrated ${mergedHashes.length} Arweave hashes for ${file.title}`);
            migratedCount++;
          }

          // Check if this was the last file
          if (migratedCount + skippedCount + errorCount === filesWithArweave.length) {
            console.log('\n📊 Migration Summary:');
            console.log(`✅ Successfully migrated: ${migratedCount} files`);
            console.log(`⚠️  Skipped (not found): ${skippedCount} files`);
            console.log(`❌ Errors: ${errorCount} files`);
            console.log(`📄 Total processed: ${filesWithArweave.length} files`);
            
            db.close((err) => {
              if (err) {
                console.error('❌ Error closing database:', err.message);
                reject(err);
              } else {
                console.log('✅ Migration completed successfully!');
                resolve();
              }
            });
          }
        });
      });
    });
  });
}

// Run migration
migrateArweaveData()
  .then(() => {
    console.log('\n🎉 Arweave data migration completed!');
    console.log('💡 The Arweave upload lists should now be visible in the resource items.');
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }); 