# Unified Resources SQLite Migration Plan

## Overview

This document outlines the migration of unified resources from JSON-based storage to SQLite database for improved performance, scalability, and query capabilities.

## Current State

- **Storage**: Single `resources.json` file in `.meridian/data/`
- **Structure**: Array of resource objects with nested properties
- **Performance**: Linear search, full file loading, memory intensive
- **Limitations**: No indexing, slow queries, poor scalability

## Target State

- **Storage**: SQLite database file `resources.db` in `.meridian/data/`
- **Structure**: Normalized tables with proper relationships
- **Performance**: Indexed queries, pagination, efficient filtering
- **Benefits**: ACID compliance, fast searches, scalable architecture

## Database Schema Design

### Core Tables

#### 1. Resources Table

```sql
CREATE TABLE resources (
    id TEXT PRIMARY KEY,                    -- Unique resource identifier
    uri TEXT NOT NULL,                      -- Resource URI
    content_hash TEXT,                      -- Content hash for deduplication
    title TEXT NOT NULL,                    -- Resource title
    description TEXT,                       -- Resource description
    resource_type TEXT NOT NULL,            -- 'internal', 'external', 'arweave'
    dc_type TEXT,                           -- Dublin Core type
    created_at DATETIME NOT NULL,           -- Creation timestamp
    modified_at DATETIME NOT NULL,          -- Last modification timestamp
    last_accessed_at DATETIME,              -- Last access timestamp
    accessible BOOLEAN DEFAULT 1,           -- Resource accessibility status
    verification_status TEXT DEFAULT 'verified' -- 'verified', 'unverified', 'failed'
);
```

#### 2. Locations Table

```sql
CREATE TABLE resource_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT NOT NULL,              -- Foreign key to resources
    location_type TEXT NOT NULL,            -- 'file-path', 'http-url', 'arweave-hash'
    location_value TEXT NOT NULL,           -- Actual location value
    is_primary BOOLEAN DEFAULT 0,           -- Primary vs alternative location
    accessible BOOLEAN DEFAULT 1,           -- Location accessibility
    last_verified DATETIME,                 -- Last verification timestamp
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
);
```

#### 3. Tags Table

```sql
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,              -- Tag name
    usage_count INTEGER DEFAULT 0,          -- Number of resources using this tag
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. Resource Tags Junction Table

```sql
CREATE TABLE resource_tags (
    resource_id TEXT NOT NULL,              -- Foreign key to resources
    tag_id INTEGER NOT NULL,                -- Foreign key to tags
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (resource_id, tag_id),
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

#### 5. Properties Table (for extensible metadata)

```sql
CREATE TABLE resource_properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT NOT NULL,              -- Foreign key to resources
    property_key TEXT NOT NULL,             -- Property name (e.g., 'dc:creator')
    property_value TEXT,                    -- Property value
    property_type TEXT DEFAULT 'text',      -- 'text', 'number', 'date', 'json'
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
);
```

### Indexes for Performance

```sql
-- Resource queries
CREATE INDEX idx_resources_type ON resources(resource_type);
CREATE INDEX idx_resources_created ON resources(created_at);
CREATE INDEX idx_resources_modified ON resources(modified_at);
CREATE INDEX idx_resources_title ON resources(title);

-- Location queries
CREATE INDEX idx_locations_resource ON resource_locations(resource_id);
CREATE INDEX idx_locations_type ON resource_locations(location_type);
CREATE INDEX idx_locations_primary ON resource_locations(is_primary);

-- Tag queries
CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_resource_tags_resource ON resource_tags(resource_id);
CREATE INDEX idx_resource_tags_tag ON resource_tags(tag_id);

-- Property queries
CREATE INDEX idx_properties_resource ON resource_properties(resource_id);
CREATE INDEX idx_properties_key ON resource_properties(property_key);
```

## Migration Strategy

### Phase 1: Database Infrastructure

1. **Add SQLite Dependencies**

   - Install `better-sqlite3` package
   - Add database initialization to DataManager
   - Create database schema creation scripts

2. **Database Manager Class**
   - Create `DatabaseManager` class for SQLite operations
   - Implement connection management
   - Add migration utilities

### Phase 2: Data Migration

1. **JSON to SQLite Migration**

   - Create migration script to convert existing `resources.json`
   - Preserve all existing data and relationships
   - Validate data integrity after migration

2. **Backward Compatibility**
   - Keep JSON loading as fallback
   - Implement automatic migration on first load
   - Maintain JSON export capability

### Phase 3: API Updates

1. **Backend API Changes**

   - Update DataManager methods to use SQLite
   - Implement new query methods (search, filter, paginate)
   - Add transaction support for data integrity

2. **Frontend Integration**
   - Update UnifiedResourceManager to use new API
   - Implement pagination and virtual scrolling
   - Add advanced search capabilities

### Phase 4: Performance Optimization

1. **Query Optimization**

   - Implement efficient search algorithms
   - Add result caching
   - Optimize database indexes

2. **UI Improvements**
   - Add loading states for large datasets
   - Implement progressive loading
   - Add search result highlighting

## Implementation Steps

### Step 1: Database Setup

```bash
npm install better-sqlite3
npm install @types/better-sqlite3 --save-dev
```

### Step 2: Create Database Manager

- `src/main/database-manager.ts` - Core database operations
- `src/main/migrations/` - Database schema and migration scripts
- `src/main/queries/` - Predefined SQL queries

### Step 3: Update DataManager

- Add SQLite support alongside JSON
- Implement automatic migration detection
- Add database health checks

### Step 4: Update UnifiedResourceManager

- Replace JSON operations with database queries
- Add pagination support
- Implement efficient filtering

### Step 5: Testing and Validation

- Test with existing data
- Performance benchmarking
- Data integrity validation

## File Structure Changes

```
src/
├── main/
│   ├── database-manager.ts          # New: SQLite database management
│   ├── migrations/
│   │   ├── 001_create_resources_schema.sql
│   │   └── 002_add_indexes.sql
│   ├── queries/
│   │   ├── resources.ts             # Resource-related queries
│   │   ├── tags.ts                  # Tag-related queries
│   │   └── search.ts                # Search queries
│   └── data-manager.ts              # Updated: Add SQLite support
├── renderer/
│   └── modules/
│       └── UnifiedResourceManager.js # Updated: Use database API
└── types/
    └── index.ts                     # Updated: Add database types
```

## API Changes

### New Database Methods

```typescript
// DataManager additions
async initializeDatabase(): Promise<void>
async migrateFromJson(): Promise<void>
async searchResources(query: SearchQuery): Promise<PaginatedResults>
async getResourcesByTag(tag: string, limit?: number): Promise<Resource[]>
async getResourceCount(): Promise<number>
async exportToJson(): Promise<void> // For backup/export
```

### Updated UnifiedResourceManager Methods

```typescript
// Pagination support
async loadUnifiedResources(page: number = 1, limit: number = 50): Promise<void>
async searchResources(query: string): Promise<void>
async getFilteredResources(filters: FilterOptions): Promise<Resource[]>
```

## Performance Benefits

### Query Performance

- **Search**: O(log n) vs O(n) for JSON
- **Filtering**: Indexed queries vs linear scan
- **Sorting**: Database sorting vs JavaScript sort
- **Pagination**: Efficient LIMIT/OFFSET vs array slicing

### Memory Usage

- **Loading**: Load only visible resources vs entire dataset
- **Caching**: Database-level caching vs application memory
- **Garbage Collection**: Better memory management

### Scalability

- **10,000+ resources**: Feasible with proper indexing
- **Concurrent access**: SQLite handles multiple readers
- **Data integrity**: ACID compliance prevents corruption

## Migration Timeline

### Week 1: Infrastructure

- Database setup and schema design
- Basic CRUD operations
- Migration utilities

### Week 2: Data Migration

- JSON to SQLite migration
- Data validation and testing
- Backward compatibility

### Week 3: API Integration

- Update DataManager
- Update UnifiedResourceManager
- Performance testing

### Week 4: UI Improvements

- Pagination implementation
- Search optimization
- User experience polish

## Risk Mitigation

### Data Safety

- **Backup Strategy**: Keep JSON as backup during migration
- **Rollback Plan**: Ability to revert to JSON if issues arise
- **Validation**: Comprehensive data integrity checks

### Performance

- **Benchmarking**: Test with large datasets before deployment
- **Monitoring**: Add performance metrics
- **Optimization**: Continuous query optimization

### Compatibility

- **Gradual Migration**: Support both JSON and SQLite during transition
- **Export Options**: Maintain JSON export for portability
- **Version Control**: Track database schema changes

## Success Metrics

### Performance

- **Load Time**: < 100ms for 1000 resources
- **Search Time**: < 50ms for complex queries
- **Memory Usage**: < 50MB for 10,000 resources

### Functionality

- **Data Integrity**: 100% data preservation during migration
- **Feature Parity**: All existing features work with SQLite
- **User Experience**: No degradation in UI responsiveness

### Scalability

- **Resource Count**: Support 10,000+ resources efficiently
- **Query Complexity**: Handle complex multi-criteria searches
- **Concurrent Usage**: Support multiple simultaneous operations

## Conclusion

This migration will transform the unified resources system from a simple JSON-based storage to a robust, scalable database solution. The benefits include improved performance, better data integrity, and enhanced query capabilities while maintaining backward compatibility and user experience.

The phased approach ensures minimal disruption and allows for thorough testing at each stage. The SQLite implementation provides a solid foundation for future enhancements and can easily scale to handle thousands of resources efficiently.
