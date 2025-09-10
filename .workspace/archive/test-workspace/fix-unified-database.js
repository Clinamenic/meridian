#!/usr/bin/env node

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class UnifiedDatabaseFixer {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err.message);
          reject(err);
        } else {
          console.log('Connected to database:', this.dbPath);
          resolve();
        }
      });
    });
  }

  async disconnect() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err.message);
          }
          resolve();
        });
      });
    }
  }

  async runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async runUpdate(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes, lastID: this.lastID });
      });
    });
  }

  async getStats() {
    console.log('\n=== DATABASE STATISTICS ===');
    
    const stats = await this.runQuery(`
      SELECT 
        (SELECT COUNT(*) FROM resources) as total_resources,
        (SELECT COUNT(*) FROM resource_tags) as total_tags,
        (SELECT COUNT(DISTINCT tag) FROM resource_tags) as unique_tags
    `);
    
    console.log(`Total Resources: ${stats[0].total_resources}`);
    console.log(`Total Tags: ${stats[0].total_tags}`);
    console.log(`Unique Tags: ${stats[0].unique_tags}`);

    const types = await this.runQuery(`
      SELECT resource_type, COUNT(*) as count 
      FROM resources 
      GROUP BY resource_type 
      ORDER BY count DESC
    `);
    
    console.log('\nResource Types:');
    types.forEach(type => {
      console.log(`  ${type.resource_type}: ${type.count}`);
    });

    // Check for resources with Arweave hashes
    const arweaveStats = await this.runQuery(`
      SELECT 
        COUNT(*) as total_resources,
        COUNT(CASE WHEN arweave_hashes IS NOT NULL AND arweave_hashes != '' THEN 1 END) as with_arweave_hashes
      FROM resources
    `);
    
    console.log('\nArweave Hash Stats:');
    console.log(`  Resources with Arweave hashes: ${arweaveStats[0].with_arweave_hashes}`);
    console.log(`  Total resources: ${arweaveStats[0].total_resources}`);
  }

  async getArweaveStats() {
    const stats = await this.runQuery(`
      SELECT 
        COUNT(*) as total_resources,
        COUNT(CASE WHEN arweave_hashes IS NOT NULL AND arweave_hashes != '' THEN 1 END) as with_arweave_hashes
      FROM resources
    `);
    
    console.log('\nArweave Hash Stats:');
    console.log(`  Resources with Arweave hashes: ${stats[0].with_arweave_hashes}`);
    console.log(`  Total resources: ${stats[0].total_resources}`);
  }

  async findAndRemoveDuplicates() {
    console.log('\n=== FINDING AND REMOVING DUPLICATES ===');
    
    // Find titles with duplicates
    const duplicates = await this.runQuery(`
      SELECT title, COUNT(*) as count 
      FROM resources 
      GROUP BY title 
      HAVING count > 1
    `);
    
    console.log(`Found ${duplicates.length} titles with duplicates`);
    
    let totalRemoved = 0;
    
    for (const dup of duplicates) {
      // Get all resources with this title, ordered by creation time (keep oldest)
      const resources = await this.runQuery(`
        SELECT id, created_at_timestamp 
        FROM resources 
        WHERE title = ? 
        ORDER BY created_at_timestamp ASC
      `, [dup.title]);
      
      // Keep the first (oldest) one, remove the rest
      const toRemove = resources.slice(1);
      
      for (const resource of toRemove) {
        await this.runUpdate('DELETE FROM resources WHERE id = ?', [resource.id]);
        totalRemoved++;
      }
    }
    
    console.log(`Total duplicates removed: ${totalRemoved}`);
  }

  async addArweaveHashesColumn() {
    console.log('\n=== ADDING ARWEAVE HASHES COLUMN ===');
    
    try {
      // Check if column exists
      const columns = await this.runQuery("PRAGMA table_info(resources)");
      const hasColumn = columns.some(col => col.name === 'arweave_hashes');
      
      if (!hasColumn) {
        await this.runUpdate('ALTER TABLE resources ADD COLUMN arweave_hashes TEXT');
        console.log('Added arweave_hashes column to resources table');
      } else {
        console.log('arweave_hashes column already exists');
      }
    } catch (error) {
      console.error('Error adding arweave_hashes column:', error);
    }
  }

  async migrateArweaveHashesFromArchive() {
    console.log('\n=== MIGRATING ARWEAVE HASHES FROM ARCHIVE ===');
    
    const archivePath = path.join(__dirname, 'to-import-archive.json');
    
    if (!fs.existsSync(archivePath)) {
      console.log('Archive file not found, skipping Arweave hash migration');
      return;
    }
    
    const archiveData = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
    
    // Build a map of file paths to Arweave hashes
    const arweaveMap = new Map();
    
    // Process files from archive
    if (archiveData.files && Array.isArray(archiveData.files)) {
      console.log(`Processing ${archiveData.files.length} files for Arweave hash migration`);
      
      for (const file of archiveData.files) {
        if (file.arweave_hashes && Array.isArray(file.arweave_hashes) && file.arweave_hashes.length > 0) {
          // Try to match by file path or other properties
          const key = this.normalizePath(file.filePath || file.path || '');
          arweaveMap.set(key, file.arweave_hashes);
          console.log(`  Found Arweave hashes for: ${file.title} (${file.arweave_hashes.length} hashes)`);
        }
      }
    }
    
    // Process uploads from archive
    if (archiveData.uploads && Array.isArray(archiveData.uploads)) {
      console.log(`Processing ${archiveData.uploads.length} uploads for Arweave hash migration`);
      
      for (const upload of archiveData.uploads) {
        // For uploads, we need to create a hash entry from the upload data
        if (upload.transactionId) {
          const arweaveHash = {
            hash: upload.transactionId,
            timestamp: upload.uploadedAt || new Date().toISOString(),
            link: `https://www.arweave.net/${upload.transactionId}`,
            tags: upload.tags || []
          };
          
          const key = this.normalizePath(upload.filePath || upload.filename || '');
          arweaveMap.set(key, [arweaveHash]);
          console.log(`  Found Arweave upload for: ${upload.filename} (${upload.transactionId})`);
        }
      }
    }
    
    console.log(`Found ${arweaveMap.size} items with Arweave hashes to migrate`);
    
    // Get all resources from database
    const resources = await this.runQuery('SELECT id, location_value, title FROM resources');
    
    let updatedCount = 0;
    
    for (const resource of resources) {
      const normalizedPath = this.normalizePath(resource.location_value);
      
                // Try to match by normalized path
          if (arweaveMap.has(normalizedPath)) {
            const arweaveHashes = arweaveMap.get(normalizedPath);
            
            // Filter out migration artifacts from tags
            const cleanedHashes = arweaveHashes.map(hash => ({
              ...hash,
              tags: (hash.tags || []).filter(tag => 
                !tag.startsWith('uuid:') && 
                !tag.startsWith('timestamp:') &&
                tag !== 'migrated'
              )
            }));
            
            // Update the resource with cleaned Arweave hashes
            await this.runUpdate(
              'UPDATE resources SET arweave_hashes = ? WHERE id = ?',
              [JSON.stringify(cleanedHashes), resource.id]
            );
        
        updatedCount++;
        console.log(`Updated resource "${resource.title}" with ${arweaveHashes.length} Arweave hashes`);
      }
    }
    
    console.log(`\nTotal resources updated with Arweave hashes: ${updatedCount}`);
  }

  normalizePath(filePath) {
    if (!filePath) return '';
    
    // Normalize path separators and case
    let normalized = filePath.replace(/\\/g, '/').toLowerCase();
    
    // Remove common prefixes that might differ between systems
    normalized = normalized.replace(/^\/users\/[^\/]+\/desktop\//, '');
    normalized = normalized.replace(/^\/users\/[^\/]+\/hub\/public\/website\/content\//, '');
    normalized = normalized.replace(/^\/users\/[^\/]+\/hub\/private\/projects\//, '');
    
    // Remove file extension for more flexible matching
    normalized = normalized.replace(/\.[^\/]+$/, '');
    
    return normalized;
  }

  async showSampleArweaveData() {
    console.log('\n=== SAMPLE ARWEAVE DATA ===');
    
    const resourcesWithArweave = await this.runQuery(`
      SELECT id, title, arweave_hashes 
      FROM resources 
      WHERE arweave_hashes IS NOT NULL AND arweave_hashes != ''
      LIMIT 5
    `);
    
    if (resourcesWithArweave.length === 0) {
      console.log('No resources with Arweave hashes found');
      return;
    }
    
    console.log(`Found ${resourcesWithArweave.length} resources with Arweave hashes:`);
    
    for (const resource of resourcesWithArweave) {
      try {
        const hashes = JSON.parse(resource.arweave_hashes);
        console.log(`\n"${resource.title}" (${resource.id}):`);
        console.log(`  Arweave hashes: ${hashes.length}`);
        hashes.forEach((hash, index) => {
          console.log(`    ${index + 1}. ${hash.hash} (${hash.timestamp})`);
        });
      } catch (error) {
        console.log(`Error parsing Arweave hashes for ${resource.title}:`, error.message);
      }
    }
  }
}

async function main() {
  const fixer = new UnifiedDatabaseFixer('.meridian/data/unified_resources.db');
  
  try {
    await fixer.connect();
    
    // Show initial stats
    await fixer.getStats();
    await fixer.getArweaveStats();
    
    // Remove duplicates
    await fixer.findAndRemoveDuplicates();
    
    // Add Arweave hashes column if needed
    await fixer.addArweaveHashesColumn();
    
    // Migrate Arweave hashes from archive
    await fixer.migrateArweaveHashesFromArchive();
    
    // Show final stats
    console.log('\n=== AFTER FIXES ===');
    await fixer.getStats();
    await fixer.getArweaveStats();
    
    // Show sample Arweave data
    await fixer.showSampleArweaveData();
    
  } catch (error) {
    console.error('Error during database fix:', error);
  } finally {
    await fixer.disconnect();
    console.log('Database connection closed');
  }
}

main(); 