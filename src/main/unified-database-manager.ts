import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { UnifiedResource, UnifiedData } from '../types';

/**
 * SQLite Database Manager for Unified Resources
 * Handles all database operations with JSON export functionality
 */
export class UnifiedDatabaseManager {
  private db: sqlite3.Database | null = null;
  private workspacePath: string | null = null;
  private dbPath: string | null = null;

  constructor() {
    // Initialize with better error handling
    sqlite3.verbose();
  }

  /**
   * Initialize database for a workspace
   */
  async initialize(workspacePath: string): Promise<void> {
    this.workspacePath = workspacePath;
    this.dbPath = path.join(workspacePath, '.meridian', 'data', 'unified_resources.db');
    
    // Ensure .meridian/data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath!, (err: Error | null) => {
        if (err) {
          console.error('[UnifiedDatabaseManager] Failed to open database:', err);
          reject(err);
          return;
        }

        console.log('[UnifiedDatabaseManager] Database opened successfully');
        this.createTables()
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
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
          last_accessed_timestamp INTEGER NOT NULL,
          arweave_hashes TEXT
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

      this.db!.serialize(() => {
        this.db!.run(createResourcesTable, (err: Error | null) => {
          if (err) {
            console.error('[UnifiedDatabaseManager] Failed to create resources table:', err);
            reject(err);
            return;
          }
        });

        this.db!.run(createTagsTable, (err: Error | null) => {
          if (err) {
            console.error('[UnifiedDatabaseManager] Failed to create tags table:', err);
            reject(err);
            return;
          }
        });

        this.db!.run(createIndexes, (err: Error | null) => {
          if (err) {
            console.error('[UnifiedDatabaseManager] Failed to create indexes:', err);
            reject(err);
            return;
          }
          
          console.log('[UnifiedDatabaseManager] Database tables created successfully');
          resolve();
        });
      });
    });
  }

  /**
   * Add a unified resource
   */
  async addResource(resource: Omit<UnifiedResource, 'id'>): Promise<UnifiedResource> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const id = this.generateId();
    const now = new Date().toISOString();
    const nowTimestamp = Date.now();

    // Serialize arweave_hashes if present
    const arweaveHashes = resource.properties['meridian:arweave_hashes']
      ? JSON.stringify(resource.properties['meridian:arweave_hashes'])
      : null;

    const newResource: UnifiedResource = {
      ...resource,
      id,
      provenance: [],
      timestamps: {
        created: now,
        modified: now,
        lastAccessed: now
      }
    };

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        // Insert resource
        const insertResource = `
          INSERT INTO resources (
            id, uri, content_hash, title, description, resource_type,
            location_type, location_value, location_accessible, location_last_verified,
            state_type, state_accessible, state_last_verified, state_verification_status,
            created_at, modified_at, last_accessed,
            created_at_timestamp, modified_at_timestamp, last_accessed_timestamp,
            arweave_hashes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?)
        `;

        const resourceValues = [
          id,
          newResource.uri,
          newResource.contentHash,
          newResource.properties['dc:title'] || 'Untitled',
          newResource.properties['meridian:description'] || null,
          newResource.properties['dc:type'] || 'document',
          newResource.locations.primary.type,
          newResource.locations.primary.value,
          newResource.locations.primary.accessible ? 1 : 0,
          newResource.locations.primary.lastVerified,
          newResource.state.type,
          newResource.state.accessible ? 1 : 0,
          newResource.state.lastVerified,
          newResource.state.verificationStatus,
          now,
          now,
          now,
          nowTimestamp,
          nowTimestamp,
          nowTimestamp,
          arweaveHashes
        ];

        this.db!.run(insertResource, resourceValues, (err: Error | null) => {
          if (err) {
            console.error('[UnifiedDatabaseManager] Failed to insert resource:', err);
            reject(err);
            return;
          }

          // Insert tags
          const tags = newResource.properties['meridian:tags'] || [];
          if (tags.length > 0) {
            const insertTag = 'INSERT INTO resource_tags (resource_id, tag, created_at) VALUES (?, ?, ?)';
            const tagStmt = this.db!.prepare(insertTag);
            tags.forEach((tag: string) => {
              tagStmt.run([id, tag, now]);
            });
            tagStmt.finalize((err: Error | null) => {
              if (err) {
                console.error('[UnifiedDatabaseManager] Failed to insert tags:', err);
                reject(err);
                return;
              }
              resolve(newResource);
            });
          } else {
            resolve(newResource);
          }
        });
      });
    });
  }

  /**
   * Get all resources
   */
  async getAllResources(): Promise<UnifiedResource[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          r.*,
          GROUP_CONCAT(rt.tag) as tags
        FROM resources r
        LEFT JOIN resource_tags rt ON r.id = rt.resource_id
        GROUP BY r.id
        ORDER BY r.created_at_timestamp DESC
      `;

      this.db!.all(query, [], (err: Error | null, rows: any[]) => {
        if (err) {
          console.error('[UnifiedDatabaseManager] Failed to get resources:', err);
          reject(err);
          return;
        }

        const resources: UnifiedResource[] = rows.map((row: any) => {
          let arweaveHashes: any[] = [];
          if (row.arweave_hashes) {
            try {
              arweaveHashes = JSON.parse(row.arweave_hashes);
            } catch (e) {
              arweaveHashes = [];
            }
          }
          return {
            id: row.id,
            uri: row.uri,
            contentHash: row.content_hash,
            provenance: [],
            properties: {
              'dc:title': row.title,
              'dc:type': row.resource_type,
              'meridian:description': row.description,
              'meridian:tags': row.tags ? row.tags.split(',') : [],
              'meridian:arweave_hashes': arweaveHashes
            },
            locations: {
              primary: {
                type: row.location_type,
                value: row.location_value,
                accessible: Boolean(row.location_accessible),
                lastVerified: row.location_last_verified
              },
              alternatives: []
            },
            state: {
              type: row.state_type,
              accessible: Boolean(row.state_accessible),
              lastVerified: row.state_last_verified,
              verificationStatus: row.state_verification_status
            },
            timestamps: {
              created: row.created_at,
              modified: row.modified_at,
              lastAccessed: row.last_accessed
            }
          };
        });

        resolve(resources);
      });
    });
  }

  /**
   * Get resource by ID
   */
  async getResourceById(id: string): Promise<UnifiedResource | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          r.*,
          GROUP_CONCAT(rt.tag) as tags
        FROM resources r
        LEFT JOIN resource_tags rt ON r.id = rt.resource_id
        WHERE r.id = ?
        GROUP BY r.id
      `;

      this.db!.get(query, [id], (err: Error | null, row: any) => {
        if (err) {
          console.error('[UnifiedDatabaseManager] Failed to get resource:', err);
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        let arweaveHashes: any[] = [];
        if (row.arweave_hashes) {
          try {
            arweaveHashes = JSON.parse(row.arweave_hashes);
          } catch (e) {
            arweaveHashes = [];
          }
        }

        const resource: UnifiedResource = {
          id: row.id,
          uri: row.uri,
          contentHash: row.content_hash,
          provenance: [],
          properties: {
            'dc:title': row.title,
            'dc:type': row.resource_type,
            'meridian:description': row.description,
            'meridian:tags': row.tags ? row.tags.split(',') : [],
            'meridian:arweave_hashes': arweaveHashes
          },
          locations: {
            primary: {
              type: row.location_type,
              value: row.location_value,
              accessible: Boolean(row.location_accessible),
              lastVerified: row.location_last_verified
            },
            alternatives: []
          },
          state: {
            type: row.state_type,
            accessible: Boolean(row.state_accessible),
            lastVerified: row.state_last_verified,
            verificationStatus: row.state_verification_status
          },
          timestamps: {
            created: row.created_at,
            modified: row.modified_at,
            lastAccessed: row.last_accessed
          }
        };

        resolve(resource);
      });
    });
  }

  /**
   * Update a resource
   */
  async updateResource(id: string, updates: Partial<UnifiedResource>): Promise<UnifiedResource> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const existingResource = await this.getResourceById(id);
    if (!existingResource) {
      throw new Error(`Resource with ID ${id} not found`);
    }

    // Serialize arweave_hashes if present
    const arweaveHashes = updates.properties && updates.properties['meridian:arweave_hashes']
      ? JSON.stringify(updates.properties['meridian:arweave_hashes'])
      : (existingResource.properties['meridian:arweave_hashes'] ? JSON.stringify(existingResource.properties['meridian:arweave_hashes']) : null);

    const updatedResource: UnifiedResource = {
      ...existingResource,
      ...updates,
      id: existingResource.id, // Ensure id is preserved
      timestamps: {
        ...existingResource.timestamps,
        modified: new Date().toISOString()
      }
    };

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        // Update resource
        const updateResource = `
          UPDATE resources SET
            uri = ?, content_hash = ?, title = ?, description = ?, resource_type = ?,
            location_type = ?, location_value = ?, location_accessible = ?, location_last_verified = ?,
            state_type = ?, state_accessible = ?, state_last_verified = ?, state_verification_status = ?,
            modified_at = ?, modified_at_timestamp = ?,
            arweave_hashes = ?
          WHERE id = ?
        `;

        const resourceValues = [
          updatedResource.uri,
          updatedResource.contentHash,
          updatedResource.properties['dc:title'] || 'Untitled',
          updatedResource.properties['meridian:description'] || null,
          updatedResource.properties['dc:type'] || 'document',
          updatedResource.locations.primary.type,
          updatedResource.locations.primary.value,
          updatedResource.locations.primary.accessible ? 1 : 0,
          updatedResource.locations.primary.lastVerified,
          updatedResource.state.type,
          updatedResource.state.accessible ? 1 : 0,
          updatedResource.state.lastVerified,
          updatedResource.state.verificationStatus,
          updatedResource.timestamps.modified,
          Date.now(),
          arweaveHashes,
          id
        ];

        this.db!.run(updateResource, resourceValues, (err: Error | null) => {
          if (err) {
            console.error('[UnifiedDatabaseManager] Failed to update resource:', err);
            reject(err);
            return;
          }

          // Update tags if they changed
          const oldTags = new Set(existingResource.properties['meridian:tags'] || []);
          const newTags = new Set(updatedResource.properties['meridian:tags'] || []);

          // Remove old tags that are no longer present
          const tagsToRemove = Array.from(oldTags).filter(tag => !newTags.has(tag));
          if (tagsToRemove.length > 0) {
            const deleteTags = 'DELETE FROM resource_tags WHERE resource_id = ? AND tag IN (' + tagsToRemove.map(() => '?').join(',') + ')';
            this.db!.run(deleteTags, [id, ...tagsToRemove]);
          }

          // Add new tags that weren't present before
          const tagsToAdd = Array.from(newTags).filter(tag => !oldTags.has(tag));
          if (tagsToAdd.length > 0) {
            const insertTag = 'INSERT INTO resource_tags (resource_id, tag, created_at) VALUES (?, ?, ?)';
            const tagStmt = this.db!.prepare(insertTag);
            
            tagsToAdd.forEach(tag => {
              tagStmt.run([id, tag, new Date().toISOString()]);
            });
            
            tagStmt.finalize((err: Error | null) => {
              if (err) {
                console.error('[UnifiedDatabaseManager] Failed to update tags:', err);
                reject(err);
                return;
              }
              resolve(updatedResource);
            });
          } else {
            resolve(updatedResource);
          }
        });
      });
    });
  }

  /**
   * Remove a resource
   */
  async removeResource(id: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      // Tags will be automatically deleted due to CASCADE
      const deleteResource = 'DELETE FROM resources WHERE id = ?';
      
      this.db!.run(deleteResource, [id], function(this: sqlite3.RunResult, err: Error | null) {
        if (err) {
          console.error('[UnifiedDatabaseManager] Failed to remove resource:', err);
          reject(err);
          return;
        }

        if (this.changes === 0) {
          reject(new Error(`Resource with ID ${id} not found`));
          return;
        }

        resolve();
      });
    });
  }

  /**
   * Add tag to resource
   */
  async addTagToResource(resourceId: string, tag: string): Promise<UnifiedResource> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const insertTag = 'INSERT OR IGNORE INTO resource_tags (resource_id, tag, created_at) VALUES (?, ?, ?)';
      
      this.db!.run(insertTag, [resourceId, tag, new Date().toISOString()], async (err: Error | null) => {
        if (err) {
          console.error('[UnifiedDatabaseManager] Failed to add tag:', err);
          reject(err);
          return;
        }

        // Get updated resource
        try {
          const updatedResource = await this.getResourceById(resourceId);
          if (!updatedResource) {
            reject(new Error(`Resource with ID ${resourceId} not found`));
            return;
          }
          resolve(updatedResource);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Remove tag from resource
   */
  async removeTagFromResource(resourceId: string, tag: string): Promise<UnifiedResource> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const deleteTag = 'DELETE FROM resource_tags WHERE resource_id = ? AND tag = ?';
      
      this.db!.run(deleteTag, [resourceId, tag], async (err: Error | null) => {
        if (err) {
          console.error('[UnifiedDatabaseManager] Failed to remove tag:', err);
          reject(err);
          return;
        }

        // Get updated resource
        try {
          const updatedResource = await this.getResourceById(resourceId);
          if (!updatedResource) {
            reject(new Error(`Resource with ID ${resourceId} not found`));
            return;
          }
          resolve(updatedResource);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Get all tags with counts
   */
  async getTagCounts(): Promise<{ [tag: string]: number }> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const query = 'SELECT tag, COUNT(*) as count FROM resource_tags GROUP BY tag ORDER BY count DESC';
      
      this.db!.all(query, [], (err: Error | null, rows: any[]) => {
        if (err) {
          console.error('[UnifiedDatabaseManager] Failed to get tag counts:', err);
          reject(err);
          return;
        }

        const tagCounts: { [tag: string]: number } = {};
        rows.forEach((row: any) => {
          tagCounts[row.tag] = row.count;
        });

        resolve(tagCounts);
      });
    });
  }

  /**
   * Search resources by various criteria
   */
  async searchResources(criteria: {
    title?: string;
    tags?: string[];
    type?: string;
    stateType?: string;
    limit?: number;
    offset?: number;
  }): Promise<UnifiedResource[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const conditions: string[] = [];
    const params: any[] = [];

    if (criteria.title) {
      conditions.push('r.title LIKE ?');
      params.push(`%${criteria.title}%`);
    }

    if (criteria.type) {
      conditions.push('r.resource_type = ?');
      params.push(criteria.type);
    }

    if (criteria.stateType) {
      conditions.push('r.state_type = ?');
      params.push(criteria.stateType);
    }

    let query = `
      SELECT 
        r.*,
        GROUP_CONCAT(rt.tag) as tags
      FROM resources r
      LEFT JOIN resource_tags rt ON r.id = rt.resource_id
    `;

    if (criteria.tags && criteria.tags.length > 0) {
      query += `
        WHERE r.id IN (
          SELECT DISTINCT resource_id 
          FROM resource_tags 
          WHERE tag IN (${criteria.tags.map(() => '?').join(',')})
        )
      `;
      params.push(...criteria.tags);
    }

    if (conditions.length > 0) {
      query += criteria.tags && criteria.tags.length > 0 ? ' AND ' : ' WHERE ';
      query += conditions.join(' AND ');
    }

    query += ' GROUP BY r.id ORDER BY r.created_at_timestamp DESC';

    if (criteria.limit) {
      query += ' LIMIT ?';
      params.push(criteria.limit);
    }

    if (criteria.offset) {
      query += ' OFFSET ?';
      params.push(criteria.offset);
    }

    return new Promise((resolve, reject) => {
      this.db!.all(query, params, (err: Error | null, rows: any[]) => {
        if (err) {
          console.error('[UnifiedDatabaseManager] Failed to search resources:', err);
          reject(err);
          return;
        }

        const resources: UnifiedResource[] = rows.map((row: any) => ({
          id: row.id,
          uri: row.uri,
          contentHash: row.content_hash,
          provenance: [],
          properties: {
            'dc:title': row.title,
            'dc:type': row.resource_type,
            'meridian:description': row.description,
            'meridian:tags': row.tags ? row.tags.split(',') : []
          },
          locations: {
            primary: {
              type: row.location_type,
              value: row.location_value,
              accessible: Boolean(row.location_accessible),
              lastVerified: row.location_last_verified
            },
            alternatives: []
          },
          state: {
            type: row.state_type,
            accessible: Boolean(row.state_accessible),
            lastVerified: row.state_last_verified,
            verificationStatus: row.state_verification_status
          },
          timestamps: {
            created: row.created_at,
            modified: row.modified_at,
            lastAccessed: row.last_accessed
          }
        }));

        resolve(resources);
      });
    });
  }

  /**
   * Export data to JSON format
   */
  async exportToJSON(): Promise<UnifiedData> {
    const resources = await this.getAllResources();
    const tags = await this.getTagCounts();

    return {
      resources,
      tags,
      lastModified: new Date().toISOString(),
      version: '2.0'
    };
  }

  /**
   * Export database to a new SQLite file
   */
  async exportToDatabase(exportData: {
    resources: any[];
    filters: {
      searchTerm: string;
      activeTags: string[];
      filterLogic: string;
    };
  }): Promise<{ success: boolean; filePath?: string; error?: string }> {
    if (!this.db) {
      return { success: false, error: 'Database not initialized' };
    }

    try {
      // Generate export filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const exportDir = path.join(this.workspacePath!, '.meridian', 'exports');
      const exportPath = path.join(exportDir, `unified-resources-${timestamp}.db`);

      // Ensure export directory exists
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      // Create a new database for export
      const exportDb = new sqlite3.Database(exportPath);
      
      // Create tables in export database
      await this.createExportTables(exportDb);

      // Export filtered resources
      const resourcesToExport = exportData.resources;
      
      // Insert resources into export database
      for (const resource of resourcesToExport) {
        await this.insertResourceIntoExportDb(exportDb, resource);
      }

      // Close export database
      await new Promise<void>((resolve, reject) => {
        exportDb.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log(`[UnifiedDatabaseManager] Database exported to: ${exportPath}`);
      return { success: true, filePath: exportPath };

    } catch (error) {
      console.error('[UnifiedDatabaseManager] Export database error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Create tables in export database
   */
  private async createExportTables(exportDb: sqlite3.Database): Promise<void> {
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
          last_accessed_timestamp INTEGER NOT NULL,
          arweave_hashes TEXT
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

      exportDb.serialize(() => {
        exportDb.run(createResourcesTable, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        exportDb.run(createTagsTable, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  }

  /**
   * Insert resource into export database
   */
  private async insertResourceIntoExportDb(exportDb: sqlite3.Database, resource: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const insertResource = `
        INSERT INTO resources (
          id, uri, content_hash, title, description, resource_type,
          location_type, location_value, location_accessible, location_last_verified,
          state_type, state_accessible, state_last_verified, state_verification_status,
          created_at, modified_at, last_accessed,
          created_at_timestamp, modified_at_timestamp, last_accessed_timestamp,
          arweave_hashes
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

      exportDb.run(insertResource, resourceValues, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Insert tags
        const tags = resource.properties['meridian:tags'] || [];
        if (tags.length > 0) {
          const insertTag = 'INSERT INTO resource_tags (resource_id, tag, created_at) VALUES (?, ?, ?)';
          const tagStmt = exportDb.prepare(insertTag);
          
          tags.forEach((tag: string) => {
            tagStmt.run([resource.id, tag, new Date().toISOString()]);
          });
          
          tagStmt.finalize((err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Import data from JSON format
   */
  async importFromJSON(data: UnifiedData): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        // Clear existing data
        this.db!.run('DELETE FROM resource_tags', (err: Error | null) => {
          if (err) {
            console.error('[UnifiedDatabaseManager] Failed to clear tags:', err);
            reject(err);
            return;
          }
        });

        this.db!.run('DELETE FROM resources', (err: Error | null) => {
          if (err) {
            console.error('[UnifiedDatabaseManager] Failed to clear resources:', err);
            reject(err);
            return;
          }

          // Import new data
          const insertResource = `
            INSERT INTO resources (
              id, uri, content_hash, title, description, resource_type,
              location_type, location_value, location_accessible, location_last_verified,
              state_type, state_accessible, state_last_verified, state_verification_status,
              created_at, modified_at, last_accessed,
              created_at_timestamp, modified_at_timestamp, last_accessed_timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          const resourceStmt = this.db!.prepare(insertResource);
          const tagStmt = this.db!.prepare('INSERT INTO resource_tags (resource_id, tag, created_at) VALUES (?, ?, ?)');

          let processedCount = 0;
          const totalCount = data.resources.length;

          data.resources.forEach((resource: UnifiedResource) => {
            const now = new Date().toISOString();
            const nowTimestamp = Date.now();

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

            resourceStmt.run(resourceValues, (err: Error | null) => {
              if (err) {
                console.error('[UnifiedDatabaseManager] Failed to insert resource during import:', err);
                reject(err);
                return;
              }

              // Insert tags
              const tags = resource.properties['meridian:tags'] || [];
              tags.forEach((tag: string) => {
                tagStmt.run([resource.id, tag, now]);
              });

              processedCount++;
              if (processedCount === totalCount) {
                resourceStmt.finalize((err: Error | null) => {
                  if (err) {
                    console.error('[UnifiedDatabaseManager] Failed to finalize resource import:', err);
                    reject(err);
                    return;
                  }

                  tagStmt.finalize((err: Error | null) => {
                    if (err) {
                      console.error('[UnifiedDatabaseManager] Failed to finalize tag import:', err);
                      reject(err);
                      return;
                    }

                    console.log(`[UnifiedDatabaseManager] Successfully imported ${totalCount} resources`);
                    resolve();
                  });
                });
              }
            });
          });
        });
      });
    });
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalResources: number;
    totalTags: number;
    uniqueTags: number;
    resourcesByType: { [type: string]: number };
    resourcesByState: { [state: string]: number };
  }> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const queries = {
        totalResources: 'SELECT COUNT(*) as count FROM resources',
        totalTags: 'SELECT COUNT(*) as count FROM resource_tags',
        uniqueTags: 'SELECT COUNT(DISTINCT tag) as count FROM resource_tags',
        resourcesByType: 'SELECT resource_type, COUNT(*) as count FROM resources GROUP BY resource_type',
        resourcesByState: 'SELECT state_type, COUNT(*) as count FROM resources GROUP BY state_type'
      };

      const stats: any = {};

      this.db!.get(queries.totalResources, [], (err: Error | null, row: any) => {
        if (err) {
          reject(err);
          return;
        }
        stats.totalResources = row.count;

        this.db!.get(queries.totalTags, [], (err: Error | null, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          stats.totalTags = row.count;

          this.db!.get(queries.uniqueTags, [], (err: Error | null, row: any) => {
            if (err) {
              reject(err);
              return;
            }
            stats.uniqueTags = row.count;

            this.db!.all(queries.resourcesByType, [], (err: Error | null, rows: any[]) => {
              if (err) {
                reject(err);
                return;
              }
              stats.resourcesByType = {};
              rows.forEach((row: any) => {
                stats.resourcesByType[row.resource_type] = row.count;
              });

              this.db!.all(queries.resourcesByState, [], (err: Error | null, rows: any[]) => {
                if (err) {
                  reject(err);
                  return;
                }
                stats.resourcesByState = {};
                rows.forEach((row: any) => {
                  stats.resourcesByState[row.state_type] = row.count;
                });

                resolve(stats);
              });
            });
          });
        });
      });
    });
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err: Error | null) => {
          if (err) {
            console.error('[UnifiedDatabaseManager] Failed to close database:', err);
            reject(err);
            return;
          }
          console.log('[UnifiedDatabaseManager] Database closed successfully');
          this.db = null;
          resolve();
        });
      });
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return 'ur_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
} 