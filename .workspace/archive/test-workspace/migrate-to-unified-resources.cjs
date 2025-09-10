#!/usr/bin/env node

/**
 * One-time migration script to convert existing JSON data to unified SQLite format
 * 
 * This script reads the existing collate.json and archive.json files from
 * .meridian/data/ and imports them into the new unified_resources.db database
 * using the UnifiedDatabaseManager architecture.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Mock the sqlite3 module for this script
const sqlite3 = require('sqlite3').verbose();

// Simplified UnifiedDatabaseManager for migration
class MigrationDatabaseManager {
  constructor() {
    this.db = null;
  }

  async initialize(dbPath) {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Failed to open database:', err);
          reject(err);
          return;
        }
        console.log('Database opened successfully');
        this.createTables()
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  async createTables() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const createResourcesTable = `
        CREATE TABLE IF NOT EXISTS resources (
          id TEXT PRIMARY KEY,
          uri TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          resource_type TEXT NOT NULL,
          location_type TEXT NOT NULL,
          location_value TEXT NOT NULL,
          location_accessible BOOLEAN DEFAULT 1,
          location_last_verified TEXT,
          state_type TEXT NOT NULL,
          state_accessible BOOLEAN DEFAULT 1,
          state_last_verified TEXT,
          state_verification_status TEXT DEFAULT 'verified',
          created_at TEXT NOT NULL,
          modified_at TEXT NOT NULL,
          last_accessed TEXT NOT NULL,
          created_at_timestamp INTEGER NOT NULL,
          modified_at_timestamp INTEGER NOT NULL,
          last_accessed_timestamp INTEGER NOT NULL
        )
      `;

      const createTagsTable = `
        CREATE TABLE IF NOT EXISTS resource_tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          resource_id TEXT NOT NULL,
          tag TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (resource_id) REFERENCES resources (id) ON DELETE CASCADE,
          UNIQUE(resource_id, tag)
        )
      `;

      const createIndexes = `
        CREATE INDEX IF NOT EXISTS idx_resources_title ON resources (title);
        CREATE INDEX IF NOT EXISTS idx_resources_type ON resources (resource_type);
        CREATE INDEX IF NOT EXISTS idx_resources_state_type ON resources (state_type);
        CREATE INDEX IF NOT EXISTS idx_resources_created_at ON resources (created_at_timestamp);
        CREATE INDEX IF NOT EXISTS idx_resources_modified_at ON resources (modified_at_timestamp);
        CREATE INDEX IF NOT EXISTS idx_resource_tags_resource_id ON resource_tags (resource_id);
        CREATE INDEX IF NOT EXISTS idx_resource_tags_tag ON resource_tags (tag);
      `;

      this.db.serialize(() => {
        this.db.run(createResourcesTable, (err) => {
          if (err) {
            console.error('Failed to create resources table:', err);
            reject(err);
            return;
          }
        });

        this.db.run(createTagsTable, (err) => {
          if (err) {
            console.error('Failed to create tags table:', err);
            reject(err);
            return;
          }
        });

        this.db.run(createIndexes, (err) => {
          if (err) {
            console.error('Failed to create indexes:', err);
            reject(err);
            return;
          }
          
          console.log('Database tables created successfully');
          resolve();
        });
      });
    });
  }

  async addResource(resource) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
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

        this.db.run(insertResource, resourceValues, (err) => {
          if (err) {
            console.error('Failed to insert resource:', err);
            reject(err);
            return;
          }

          // Insert tags
          const tags = resource.properties['meridian:tags'] || [];
          if (tags.length > 0) {
            const insertTag = 'INSERT INTO resource_tags (resource_id, tag, created_at) VALUES (?, ?, ?)';
            const tagStmt = this.db.prepare(insertTag);
            tags.forEach((tag) => {
              tagStmt.run([resource.id, tag, resource.timestamps.created]);
            });
            tagStmt.finalize((err) => {
              if (err) {
                console.error('Failed to insert tags:', err);
                reject(err);
                return;
              }
              resolve(resource);
            });
          } else {
            resolve(resource);
          }
        });
      });
    });
  }

  async close() {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) {
            console.error('Failed to close database:', err);
            reject(err);
            return;
          }
          console.log('Database closed successfully');
          this.db = null;
          resolve();
        });
      });
    }
  }
}

// Migration functions
function generateUUID() {
  return crypto.randomUUID();
}

function generateContentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function migrateCollateResource(oldResource) {
  const id = generateUUID();
  const contentHash = generateContentHash(oldResource.url + oldResource.title);
  
  return {
    id,
    uri: `urn:meridian:resource:${id}`,
    contentHash: `sha256:${contentHash}`,
    properties: {
      'dc:title': oldResource.title,
      'dc:type': 'web-page',
      'meridian:tags': oldResource.tags || [],
      'meridian:description': oldResource.description
    },
    locations: {
      primary: {
        type: 'http-url',
        value: oldResource.url,
        accessible: true,
        lastVerified: new Date().toISOString()
      },
      alternatives: []
    },
    provenance: [
      {
        timestamp: oldResource.createdAt,
        action: 'created',
        method: 'web-scrape',
        toLocation: {
          type: 'http-url',
          value: oldResource.url,
          accessible: true,
          lastVerified: new Date().toISOString()
        }
      }
    ],
    state: {
      type: 'external',
      accessible: true,
      lastVerified: new Date().toISOString(),
      verificationStatus: 'verified'
    },
    timestamps: {
      created: oldResource.createdAt,
      modified: oldResource.modifiedAt,
      lastAccessed: new Date().toISOString()
    }
  };
}

function migrateArchiveFile(oldFile) {
  const id = generateUUID();
  const contentHash = oldFile.contentHash !== 'virtual:unknown' 
    ? oldFile.contentHash 
    : `sha256:${generateContentHash(oldFile.filePath + oldFile.title)}`;
  
  return {
    id,
    uri: `urn:meridian:resource:${id}`,
    contentHash,
    properties: {
      'dc:title': oldFile.title,
      'dc:type': detectResourceType(oldFile.filePath),
      'meridian:tags': oldFile.tags || [],
      'dc:format': oldFile.mimeType
    },
    locations: {
      primary: {
        type: 'file-path',
        value: oldFile.filePath,
        accessible: true,
        lastVerified: new Date().toISOString()
      },
      alternatives: oldFile.arweave_hashes?.map(hash => ({
        type: 'http-url',
        value: hash.link,
        accessible: true,
        lastVerified: new Date().toISOString()
      })) || []
    },
    provenance: [
      {
        timestamp: oldFile.created,
        action: 'created',
        method: 'file-upload',
        toLocation: {
          type: 'file-path',
          value: oldFile.filePath,
          accessible: true,
          lastVerified: new Date().toISOString()
        }
      }
    ],
    state: {
      type: oldFile.arweave_hashes?.length > 0 ? 'internal' : 'internal',
      accessible: true,
      lastVerified: new Date().toISOString(),
      verificationStatus: 'verified'
    },
    timestamps: {
      created: oldFile.created,
      modified: oldFile.modified,
      lastAccessed: new Date().toISOString()
    }
  };
}

function detectResourceType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const typeMap = {
    '.md': 'document',
    '.txt': 'document',
    '.pdf': 'document',
    '.doc': 'document',
    '.docx': 'document',
    '.jpg': 'image',
    '.jpeg': 'image',
    '.png': 'image',
    '.gif': 'image',
    '.svg': 'image',
    '.mp4': 'video',
    '.avi': 'video',
    '.mov': 'video',
    '.mp3': 'audio',
    '.wav': 'audio',
    '.zip': 'archive',
    '.tar': 'archive',
    '.gz': 'archive'
  };
  return typeMap[ext] || 'document';
}

async function loadJSONFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Failed to load ${filePath}:`, error.message);
    return null;
  }
}

async function main() {
  const workspacePath = process.cwd();
  const dataDir = path.join(workspacePath, '.meridian', 'data');
  const dbPath = path.join(dataDir, 'unified_resources.db');
  
  console.log('Starting migration to unified resources...');
  console.log(`Workspace: ${workspacePath}`);
  console.log(`Database: ${dbPath}`);
  
  // Initialize database
  const dbManager = new MigrationDatabaseManager();
  await dbManager.initialize(dbPath);
  
  let totalMigrated = 0;
  
  // Migrate collate resources (look in current directory)
  const collatePath = path.join(workspacePath, 'to-import-collate.json');
  if (fs.existsSync(collatePath)) {
    console.log('\nMigrating collate resources...');
    const collateData = await loadJSONFile(collatePath);
    
    if (collateData && collateData.resources) {
      for (const oldResource of collateData.resources) {
        try {
          const newResource = migrateCollateResource(oldResource);
          await dbManager.addResource(newResource);
          console.log(`  ✓ Migrated: ${newResource.properties['dc:title']}`);
          totalMigrated++;
        } catch (error) {
          console.error(`  ✗ Failed to migrate: ${oldResource.title}`, error.message);
        }
      }
      console.log(`Migrated ${collateData.resources.length} collate resources`);
    }
  } else {
    console.log('No to-import-collate.json found, skipping...');
  }
  
  // Migrate archive files (look in current directory)
  const archivePath = path.join(workspacePath, 'to-import-archive.json');
  if (fs.existsSync(archivePath)) {
    console.log('\nMigrating archive files...');
    const archiveData = await loadJSONFile(archivePath);
    
    if (archiveData && archiveData.files) {
      for (const oldFile of archiveData.files) {
        try {
          const newResource = migrateArchiveFile(oldFile);
          await dbManager.addResource(newResource);
          console.log(`  ✓ Migrated: ${newResource.properties['dc:title']}`);
          totalMigrated++;
        } catch (error) {
          console.error(`  ✗ Failed to migrate: ${oldFile.title}`, error.message);
        }
      }
      console.log(`Migrated ${archiveData.files.length} archive files`);
    }
  } else {
    console.log('No to-import-archive.json found, skipping...');
  }
  
  // Close database
  await dbManager.close();
  
  console.log(`\nMigration completed! Total resources migrated: ${totalMigrated}`);
  console.log('You can now use the unified resources tab in Meridian.');
}

// Run migration
if (require.main === module) {
  main().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = { MigrationDatabaseManager, migrateCollateResource, migrateArchiveFile }; 