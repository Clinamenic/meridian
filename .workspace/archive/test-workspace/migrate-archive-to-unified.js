#!/usr/bin/env node

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ArchiveMigrationManager {
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
          } else {
            console.log('Database connection closed');
          }
          resolve();
        });
      });
    }
  }

  async runQuery(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async runStatement(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async checkExistingResource(id) {
    const result = await this.runQuery('SELECT id FROM resources WHERE id = ?', [id]);
    return result.length > 0;
  }

  async migrateArchiveData() {
    console.log('\n=== MIGRATING ARCHIVE DATA TO UNIFIED DATABASE ===');
    
    // Load archive data
    const archivePath = path.join(__dirname, 'to-import-archive.json');
    if (!fs.existsSync(archivePath)) {
      console.error('Archive file not found:', archivePath);
      return;
    }

    const archiveData = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
    console.log(`Archive contains ${archiveData.uploads.length} uploads and ${archiveData.files.length} files`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Migrate uploads (Arweave uploads)
    console.log('\n--- Migrating Uploads ---');
    for (const upload of archiveData.uploads) {
      try {
        const exists = await this.checkExistingResource(upload.id);
        if (exists) {
          console.log(`  Skipping existing upload: ${upload.filename}`);
          skippedCount++;
          continue;
        }

        const resource = this.convertUploadToResource(upload);
        await this.insertResource(resource);
        console.log(`  ✓ Migrated upload: ${upload.filename}`);
        migratedCount++;
      } catch (error) {
        console.error(`  ✗ Failed to migrate upload ${upload.filename}:`, error.message);
        errorCount++;
      }
    }

    // Migrate files (local files with Arweave hashes)
    console.log('\n--- Migrating Files ---');
    for (const file of archiveData.files) {
      try {
        const exists = await this.checkExistingResource(file.uuid);
        if (exists) {
          console.log(`  Skipping existing file: ${file.title}`);
          skippedCount++;
          continue;
        }

        const resource = this.convertFileToResource(file);
        await this.insertResource(resource);
        console.log(`  ✓ Migrated file: ${file.title}`);
        migratedCount++;
      } catch (error) {
        console.error(`  ✗ Failed to migrate file ${file.title}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n=== MIGRATION SUMMARY ===');
    console.log(`Total items in archive: ${archiveData.uploads.length + archiveData.files.length}`);
    console.log(`Successfully migrated: ${migratedCount}`);
    console.log(`Skipped (already exists): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
  }

  convertUploadToResource(upload) {
    const now = new Date().toISOString();
    const nowTimestamp = Date.now();

    // Extract tags from upload tags array
    const tags = upload.tags
      .filter(tag => !tag.startsWith('uuid:') && !tag.startsWith('title:') && !tag.startsWith('content-type:') && !tag.startsWith('file-size:') && !tag.startsWith('content-hash:') && !tag.startsWith('upload-timestamp:'))
      .map(tag => tag.replace(/^[^:]+:/, ''));

    return {
      id: upload.id,
      uri: `urn:meridian:resource:${upload.id}`,
      contentHash: upload.tags.find(t => t.startsWith('content-hash:'))?.replace('content-hash:', '') || 'unknown',
      properties: {
        'dc:title': upload.filename,
        'dc:type': 'document',
        'meridian:description': `Arweave upload: ${upload.filename}`,
        'meridian:tags': tags,
        'meridian:fileSize': upload.fileSize,
        'meridian:contentType': upload.contentType,
        'meridian:transactionId': upload.transactionId,
        'meridian:status': upload.status,
        'meridian:cost': upload.cost
      },
      locations: {
        primary: {
          type: 'arweave',
          value: upload.transactionId,
          accessible: true,
          lastVerified: upload.uploadedAt
        },
        alternatives: []
      },
      state: {
        type: 'external',
        accessible: true,
        lastVerified: upload.uploadedAt,
        verificationStatus: 'verified'
      },
      timestamps: {
        created: upload.uploadedAt,
        modified: upload.uploadedAt,
        lastAccessed: upload.uploadedAt
      }
    };
  }

  convertFileToResource(file) {
    const now = new Date().toISOString();
    const nowTimestamp = Date.now();

    // Determine resource type based on MIME type
    let resourceType = 'document';
    if (file.mimeType.startsWith('image/')) {
      resourceType = 'image';
    } else if (file.mimeType === 'text/markdown') {
      resourceType = 'document';
    }

    // Get the most recent Arweave hash
    const latestHash = file.arweave_hashes && file.arweave_hashes.length > 0 
      ? file.arweave_hashes[file.arweave_hashes.length - 1] 
      : null;

    return {
      id: file.uuid,
      uri: `urn:meridian:resource:${file.uuid}`,
      contentHash: file.contentHash !== 'virtual:unknown' ? file.contentHash : 'unknown',
      properties: {
        'dc:title': file.title,
        'dc:type': resourceType,
        'meridian:description': file.metadata?.customFields?.description || null,
        'meridian:tags': file.tags || [],
        'meridian:fileSize': file.fileSize,
        'meridian:mimeType': file.mimeType,
        'meridian:author': file.metadata?.author || null,
        'meridian:customFields': file.metadata?.customFields || {},
        'meridian:arweaveHashes': file.arweave_hashes || []
      },
      locations: {
        primary: {
          type: 'file-path',
          value: file.filePath,
          accessible: true,
          lastVerified: file.modified
        },
        alternatives: latestHash ? [{
          type: 'arweave',
          value: latestHash.hash,
          accessible: true,
          lastVerified: latestHash.timestamp
        }] : []
      },
      state: {
        type: 'internal',
        accessible: true,
        lastVerified: file.modified,
        verificationStatus: 'verified'
      },
      timestamps: {
        created: file.created,
        modified: file.modified,
        lastAccessed: file.modified
      }
    };
  }

  async insertResource(resource) {
    const now = new Date().toISOString();
    const nowTimestamp = Date.now();

    // Insert resource
    const insertResource = `
      INSERT INTO resources (
        id, uri, content_hash, title, description, resource_type,
        location_type, location_value, location_accessible, location_last_verified,
        state_type, state_accessible, state_last_verified, state_verification_status,
        created_at, modified_at, last_accessed,
        created_at_timestamp, modified_at_timestamp, last_accessed_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const resourceValues = [
      resource.id,
      resource.uri,
      resource.contentHash,
      resource.properties['dc:title'] || 'Untitled',
      resource.properties['meridian:description'] || null,
      resource.properties['dc:type'] || 'document',
      resource.locations.primary.type,
      resource.locations.primary.value,
      resource.locations.primary.accessible ? 1 : 0,
      resource.locations.primary.lastVerified,
      resource.state.type,
      resource.state.accessible ? 1 : 0,
      resource.state.lastVerified,
      resource.state.verificationStatus,
      resource.timestamps.created,
      resource.timestamps.modified,
      resource.timestamps.lastAccessed,
      new Date(resource.timestamps.created).getTime(),
      new Date(resource.timestamps.modified).getTime(),
      new Date(resource.timestamps.lastAccessed).getTime()
    ];

    await this.runStatement(insertResource, resourceValues);

    // Insert tags
    const tags = resource.properties['meridian:tags'] || [];
    if (tags.length > 0) {
      const insertTag = 'INSERT INTO resource_tags (resource_id, tag, created_at) VALUES (?, ?, ?)';
      for (const tag of tags) {
        await this.runStatement(insertTag, [resource.id, tag, now]);
      }
    }
  }

  async getMigrationStats() {
    console.log('\n=== CURRENT DATABASE STATS ===');
    
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
  }
}

async function main() {
  const dbPath = path.join(__dirname, '.meridian', 'data', 'unified_resources.db');
  const migrationManager = new ArchiveMigrationManager(dbPath);
  
  try {
    await migrationManager.connect();
    
    // Show current stats
    await migrationManager.getMigrationStats();
    
    // Perform migration
    await migrationManager.migrateArchiveData();
    
    // Show updated stats
    console.log('\n=== AFTER MIGRATION ===');
    await migrationManager.getMigrationStats();
    
  } catch (error) {
    console.error('Migration error:', error.message);
  } finally {
    await migrationManager.disconnect();
  }
}

// Run the migration
main(); 