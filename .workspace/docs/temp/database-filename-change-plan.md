# Database Filename Change: unified-resources.db → resources.db

## Overview

This document outlines the plan to rename the database file from `unified-resources.db` to `resources.db` in the Meridian workspace initialization process. This change will simplify the database naming convention and make it more intuitive for users.

## Current Architecture Analysis

### Database Initialization Flow

1. **Workspace Selection** (`src/main/main.ts:171-210`)

   - User selects workspace directory via dialog
   - `dataManager.setWorkspace()` initializes `.meridian/` directory structure
   - `unifiedDatabaseManager.initialize()` creates database file

2. **Database Manager** (`src/main/unified-database-manager.ts`)

   - **Current filename**: `unified_resources.db` (line 25)
   - **Location**: `{workspace}/.meridian/data/unified_resources.db`
   - **Initialization**: Creates SQLite database with comprehensive schema

3. **Frontend Integration** (`src/renderer/modules/ResourceManager.js`)
   - Uses `window.api.database` for database operations
   - Graceful fallback to JSON storage if database unavailable
   - Database operations: CRUD, custom properties, alternative locations

### Current Database Schema

The database includes these main tables:

- `resources` - Core resource data
- `resource_tags` - Tag associations
- `global_property_keys` - Custom property definitions
- `global_property_values` - Property value suggestions
- `resource_custom_properties` - Resource-specific properties
- `resource_alternative_locations` - Multi-location support

## Required Changes

### 1. Backend Changes

#### A. Database Manager (`src/main/unified-database-manager.ts`)

- **Line 25**: Change `'unified_resources.db'` → `'resources.db'`
- **Line 901**: Update export filename from `unified-resources-${timestamp}.db` → `resources-${timestamp}.db`

#### B. Migration Strategy

- **Automatic Migration**: Check for existing `unified_resources.db` on initialization
- **File Rename**: Rename existing database file to new name
- **Backward Compatibility**: Handle both filenames during transition period

### 2. Frontend Changes

#### A. ResourceManager.js

- **No direct changes needed** - Frontend uses `window.api.database` interface
- **Graceful handling**: Existing error handling for database unavailability will work

#### B. Export Functionality

- **Line 3841**: Update export database filename references
- **Line 3881**: Update export method documentation/comments

### 3. Documentation Updates

#### A. README.md

- **Line 91**: Update workspace structure documentation
- **Line 127**: Update directory structure example

#### B. Code Comments

- Update class and method documentation to reflect new naming
- Update inline comments referencing the old filename

## Implementation Plan

### Phase 1: Backend Database Manager Update

1. **Modify `UnifiedDatabaseManager.initialize()`**

   - Change database filename constant
   - Add migration logic for existing databases
   - Update export filename generation

2. **Add Migration Logic**
   ```typescript
   private async migrateDatabaseFilename(): Promise<void> {
     const oldPath = path.join(this.workspacePath!, '.meridian', 'data', 'unified_resources.db');
     const newPath = path.join(this.workspacePath!, '.meridian', 'data', 'resources.db');

     if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
       await fs.rename(oldPath, newPath);
       console.log('[UnifiedDatabaseManager] Migrated database filename');
     }
   }
   ```

### Phase 2: Export Functionality Update

1. **Update export database filename generation**
2. **Update export method documentation**
3. **Test export functionality with new naming**

### Phase 3: Documentation Updates

1. **Update README.md workspace structure**
2. **Update code comments and documentation**
3. **Update any configuration examples**

### Phase 4: Testing & Validation

1. **Test with fresh workspace** - Verify new filename is created
2. **Test with existing workspace** - Verify migration works correctly
3. **Test export functionality** - Verify exports use new naming
4. **Test frontend integration** - Verify no breaking changes

## Risk Assessment

### Low Risk

- **Frontend Integration**: Uses abstracted API, no direct filename dependencies
- **Database Schema**: No schema changes, only filename change
- **Migration Path**: Simple file rename operation

### Mitigation Strategies

- **Backward Compatibility**: Check for both filenames during transition
- **Error Handling**: Existing error handling will catch any issues
- **Rollback Plan**: Keep old filename as fallback during transition period

## Success Criteria

1. ✅ New workspaces create `resources.db` instead of `unified_resources.db`
2. ✅ Existing workspaces automatically migrate to new filename
3. ✅ All database operations continue to work normally
4. ✅ Export functionality uses new naming convention
5. ✅ No breaking changes to frontend functionality
6. ✅ Documentation reflects new naming convention

## Files to Modify

### Primary Changes

- `src/main/unified-database-manager.ts` - Database filename and migration logic
- `README.md` - Documentation updates

### Secondary Changes

- `src/main/main.ts` - Update any hardcoded references (if any)
- Code comments and documentation throughout codebase

## Timeline

- **Phase 1**: 1-2 hours (Backend changes)
- **Phase 2**: 30 minutes (Export updates)
- **Phase 3**: 30 minutes (Documentation)
- **Phase 4**: 1 hour (Testing)

**Total Estimated Time**: 3-4 hours

## Notes

- This is a **non-breaking change** for existing functionality
- The change is **purely cosmetic** - improves naming consistency
- **Migration is automatic** - no user action required
- **Backward compatibility** maintained during transition period
