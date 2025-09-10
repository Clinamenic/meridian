#!/usr/bin/env node

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseInspector {
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
  }

  async getResourceTypes() {
    console.log('\n=== RESOURCE TYPES ===');
    
    const types = await this.runQuery(`
      SELECT resource_type, COUNT(*) as count 
      FROM resources 
      GROUP BY resource_type 
      ORDER BY count DESC
    `);
    
    types.forEach(type => {
      console.log(`${type.resource_type}: ${type.count}`);
    });
  }

  async getTopTags(limit = 20) {
    console.log(`\n=== TOP ${limit} TAGS ===`);
    
    const tags = await this.runQuery(`
      SELECT tag, COUNT(*) as count 
      FROM resource_tags 
      GROUP BY tag 
      ORDER BY count DESC 
      LIMIT ?
    `, [limit]);
    
    tags.forEach((tag, index) => {
      console.log(`${index + 1}. ${tag.tag}: ${tag.count}`);
    });
  }

  async getRecentResources(limit = 10) {
    console.log(`\n=== RECENT RESOURCES (Last ${limit}) ===`);
    
    const resources = await this.runQuery(`
      SELECT id, title, resource_type, created_at 
      FROM resources 
      ORDER BY created_at_timestamp DESC 
      LIMIT ?
    `, [limit]);
    
    resources.forEach((resource, index) => {
      console.log(`${index + 1}. ${resource.title} (${resource.resource_type})`);
      console.log(`   ID: ${resource.id}`);
      console.log(`   Created: ${resource.created_at}`);
      console.log('');
    });
  }

  async getResourceWithTags(resourceId) {
    console.log(`\n=== RESOURCE DETAILS: ${resourceId} ===`);
    
    const resource = await this.runQuery(`
      SELECT 
        r.*,
        GROUP_CONCAT(rt.tag) as tags
      FROM resources r
      LEFT JOIN resource_tags rt ON r.id = rt.resource_id
      WHERE r.id = ?
      GROUP BY r.id
    `, [resourceId]);
    
    if (resource.length === 0) {
      console.log('Resource not found');
      return;
    }
    
    const r = resource[0];
    console.log(`Title: ${r.title}`);
    console.log(`Type: ${r.resource_type}`);
    console.log(`Description: ${r.description || 'N/A'}`);
    console.log(`URI: ${r.uri}`);
    console.log(`Tags: ${r.tags || 'None'}`);
    console.log(`Created: ${r.created_at}`);
    console.log(`Modified: ${r.modified_at}`);
    console.log(`Location: ${r.location_type} - ${r.location_value}`);
    console.log(`State: ${r.state_type} (${r.state_verification_status})`);
  }

  async searchResources(searchTerm, limit = 10) {
    console.log(`\n=== SEARCH RESULTS FOR: "${searchTerm}" ===`);
    
    const resources = await this.runQuery(`
      SELECT id, title, resource_type, description
      FROM resources 
      WHERE title LIKE ? OR description LIKE ?
      ORDER BY created_at_timestamp DESC 
      LIMIT ?
    `, [`%${searchTerm}%`, `%${searchTerm}%`, limit]);
    
    if (resources.length === 0) {
      console.log('No resources found');
      return;
    }
    
    resources.forEach((resource, index) => {
      console.log(`${index + 1}. ${resource.title} (${resource.resource_type})`);
      console.log(`   ID: ${resource.id}`);
      if (resource.description) {
        console.log(`   Description: ${resource.description.substring(0, 100)}...`);
      }
      console.log('');
    });
  }

  async getResourcesByTag(tag, limit = 10) {
    console.log(`\n=== RESOURCES WITH TAG: "${tag}" ===`);
    
    const resources = await this.runQuery(`
      SELECT r.id, r.title, r.resource_type, r.created_at
      FROM resources r
      JOIN resource_tags rt ON r.id = rt.resource_id
      WHERE rt.tag = ?
      ORDER BY r.created_at_timestamp DESC 
      LIMIT ?
    `, [tag, limit]);
    
    if (resources.length === 0) {
      console.log('No resources found with this tag');
      return;
    }
    
    resources.forEach((resource, index) => {
      console.log(`${index + 1}. ${resource.title} (${resource.resource_type})`);
      console.log(`   ID: ${resource.id}`);
      console.log(`   Created: ${resource.created_at}`);
      console.log('');
    });
  }

  async exportSampleData(limit = 5) {
    console.log(`\n=== EXPORTING SAMPLE DATA (${limit} resources) ===`);
    
    const resources = await this.runQuery(`
      SELECT 
        r.*,
        GROUP_CONCAT(rt.tag) as tags
      FROM resources r
      LEFT JOIN resource_tags rt ON r.id = rt.resource_id
      GROUP BY r.id
      ORDER BY r.created_at_timestamp DESC 
      LIMIT ?
    `, [limit]);
    
    console.log(JSON.stringify(resources, null, 2));
  }
}

async function main() {
  const dbPath = path.join(__dirname, '.meridian', 'data', 'unified_resources.db');
  const inspector = new DatabaseInspector(dbPath);
  
  try {
    await inspector.connect();
    
    // Basic statistics
    await inspector.getStats();
    
    // Resource types breakdown
    await inspector.getResourceTypes();
    
    // Top tags
    await inspector.getTopTags(15);
    
    // Recent resources
    await inspector.getRecentResources(5);
    
    // Example: Get details for a specific resource
    await inspector.getResourceWithTags('ur_mcm8pssgylvamsfwzkf');
    
    // Example: Search for resources
    await inspector.searchResources('AI', 3);
    
    // Example: Get resources by tag
    await inspector.getResourcesByTag('ai', 3);
    
    // Export sample data
    await inspector.exportSampleData(2);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await inspector.disconnect();
  }
}

// Run the main function
main(); 