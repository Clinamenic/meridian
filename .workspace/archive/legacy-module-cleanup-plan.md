# Legacy Module Cleanup Planning Document

## Executive Summary

This document outlines the architectural analysis and cleanup plan for removing legacy Collate and Archive module references from the Meridian codebase, while preserving all functionality through the new UnifiedResourceManager system.

## Current Architecture Analysis

### UnifiedResourceManager.js Dependencies

The UnifiedResourceManager has the following architectural dependencies:

#### Direct Dependencies

- `ModuleBase.js` - Base class for module pattern
- `TagAutocomplete.js` - Component for tag input functionality
- `ModuleLoader.js` - Module lifecycle management (via inheritance)

#### Backend API Dependencies

- `window.electronAPI.unified.*` - Primary unified resource operations
- `window.electronAPI.collate.extractMetadata` - Metadata extraction (still used)
- `window.electronAPI.archive.*` - Arweave upload functionality (still used)

#### State Management

- Uses unified state pattern with:
  - `resources` - Array of UnifiedResource objects
  - `filters` - Search and tag filtering state
  - `collapse` - UI collapse state
  - `ui` - Loading and error states

### UnifiedDatabaseManager.ts Dependencies

The UnifiedDatabaseManager has the following dependencies:

#### Direct Dependencies

- `sqlite3` - Database operations
- `UnifiedResource` type from `../types`
- `UnifiedData` type from `../types`

#### Functionality

- SQLite database operations for unified resources
- JSON export/import capabilities
- Resource CRUD operations
- Tag management
- Search functionality

## Legacy References Analysis

### Still Active Legacy References

#### 1. CollateData References

**Location**: `data-manager.ts` (lines 149-409)

- `loadCollateData()` - Still exposed via IPC
- `saveCollateData()` - Still exposed via IPC
- Multiple resource and tag management methods
- **Status**: USED by old parts of the system

#### 2. ArchiveData References

**Location**: `data-manager.ts` (lines 416-545)

- `loadArchiveData()` - Still exposed via IPC
- `saveArchiveData()` - Still exposed via IPC
- File registry management methods
- **Status**: USED by TagManager and UploadManager

#### 3. Frontend API Usage

**CollateAPI Usage**:

- `app.js` - 2 references (metadata extraction, resource addition)
- `UnifiedResourceManager.js` - 1 reference (metadata extraction)
- `app.js.modularization-backup` - 11 references (legacy backup file)

**ArchiveAPI Usage**:

- `UnifiedResourceManager.js` - 2 references (cost estimation, file upload)
- `TagManager.js` - 2 references (saving archive data)
- `UploadManager.js` - 5 references (various upload operations)
- `AccountManager.js` - 5 references (account management)

## Cleanup Strategy

### Phase 1: Identify Safe Removal Candidates

#### Completely Safe to Remove

1. **Test workspace files** (already outside main codebase)

   - `test-workspace/migrate-*.js` files
   - `test-workspace/fix-*.js` files

2. **Backup files**

   - `app.js.modularization-backup` (legacy backup)

3. **Legacy type definitions** (after migration)
   - `CollateData` interface in `types/index.ts`
   - `ArchiveData` interface in `types/index.ts`

#### Requires Careful Migration

1. **Main.ts IPC handlers**

   - `collate:*` handlers - migrate to `unified:*`
   - `archive:*` handlers - keep but analyze usage

2. **DataManager methods**

   - CollateData methods - migrate functionality to UnifiedDatabaseManager
   - ArchiveData methods - analyze if still needed

3. **Frontend API calls**
   - Replace `window.electronAPI.collate.*` with `window.electronAPI.unified.*`
   - Analyze `window.electronAPI.archive.*` usage

### Phase 2: Migration Plan

#### Step 1: Audit Current Usage

- [ ] Map all active collate API calls to unified equivalents
- [ ] Identify which archive API calls are still needed
- [ ] Document any functionality gaps

#### Step 2: Update Frontend Modules

- [ ] Update `app.js` to use unified APIs
- [ ] Update `UnifiedResourceManager.js` to use only unified APIs
- [ ] Update other modules that still use legacy APIs

#### Step 3: Backend API Cleanup

- [ ] Remove unused collate IPC handlers
- [ ] Consolidate archive functionality
- [ ] Remove legacy DataManager methods

#### Step 4: Type System Cleanup

- [ ] Remove CollateData interface
- [ ] Remove ArchiveData interface (if no longer needed)
- [ ] Update imports throughout codebase

### Phase 3: Critical Preserved Functionality

#### UnifiedResourceManager Must Retain

1. **Metadata Extraction**

   - Currently uses `window.electronAPI.collate.extractMetadata`
   - Need to migrate to unified system or keep as utility

2. **Arweave Upload Integration**

   - Currently uses `window.electronAPI.archive.estimateCost`
   - Currently uses `window.electronAPI.archive.uploadFile`
   - These are core features that must be preserved

3. **Tag Management**
   - All tag operations now go through unified system
   - No legacy dependencies

#### UnifiedDatabaseManager Must Retain

1. **All current functionality** (no legacy dependencies)
2. **JSON export/import** for migration compatibility
3. **SQLite operations** for performance

## Implementation Recommendations

### Immediate Actions (Safe)

1. **Delete test workspace files** - No impact on main codebase
2. **Delete backup files** - No impact on functionality
3. **Remove unused imports** - Clean up type imports

### Careful Actions (Requires Testing)

1. **Replace metadata extraction calls**

   - Create unified metadata extraction API
   - Update all callers to use new API
   - Test thoroughly

2. **Consolidate Arweave functionality**

   - Keep archive API for Arweave operations
   - Ensure UnifiedResourceManager can still upload files
   - Maintain cost estimation functionality

3. **Remove legacy IPC handlers**
   - Only after confirming no active usage
   - Maintain backward compatibility during transition

### Final Actions (After Migration)

1. **Remove type definitions** - Only after all references removed
2. **Remove DataManager methods** - Only after functionality migrated
3. **Clean up main.ts** - Remove unused handlers

## Risk Assessment

### High Risk

- **Metadata extraction** - Critical for resource addition
- **Arweave uploads** - Core functionality for file archival
- **Tag management** - Essential for resource organization

### Medium Risk

- **Legacy API handlers** - May break existing workflows
- **Type system changes** - Could cause compilation errors

### Low Risk

- **Test files** - Outside main codebase
- **Backup files** - Not in active use
- **Unused imports** - Safe to remove

## Next Steps

1. **Create feature branch** for cleanup work
2. **Start with low-risk items** (test files, backups)
3. **Audit and document** all remaining legacy API usage
4. **Implement unified metadata extraction** API
5. **Migrate frontend calls** one module at a time
6. **Test thoroughly** after each migration
7. **Remove legacy backend code** only after frontend is fully migrated

## Detailed Action Items

### Phase 1: Immediate Safe Removals

#### Delete Test Workspace Files

```bash
# These are outside the main codebase and safe to remove
rm -rf test-workspace/migrate-*.js
rm -rf test-workspace/fix-*.js
rm -rf test-workspace/*.cjs
```

#### Remove Legacy Backup File

```bash
# This is a backup file and safe to remove
rm src/renderer/app.js.modularization-backup
```

### Phase 2: Update Frontend API Calls

#### Replace Metadata Extraction Calls

**Files to update**:

- `src/renderer/app.js` (line 940)
- `src/renderer/modules/UnifiedResourceManager.js` (line 1948)

**Change from**:

```javascript
const metadata = await window.electronAPI.collate.extractMetadata(url);
```

**Change to**:

```javascript
const metadata = await window.electronAPI.metadata.extract(url);
```

#### Replace Resource Addition Calls

**Files to update**:

- `src/renderer/app.js` (line 953)

**Change from**:

```javascript
await window.electronAPI.collate.addResource(resourceData);
```

**Change to**:

```javascript
await window.electronAPI.unified.addResource(resourceData);
```

### Phase 3: Backend API Migration

#### Add Unified Metadata Handler

**Add to `main.ts`**:

```typescript
// Metadata extraction (unified)
ipcMain.handle("metadata:extract", async (_, url) => {
  return await this.metadataExtractor.extractMetadata(url);
});
```

#### Remove Collate IPC Handlers

**Remove from `main.ts`** (after frontend migration):

- `collate:load-data`
- `collate:add-resource`
- `collate:update-resource`
- `collate:add-tag-to-resource`
- `collate:remove-tag-from-resource`
- `collate:rename-tag`
- `collate:delete-tag`
- `collate:remove-resource`
- `collate:extract-metadata`
- `collate:export-resources`

#### Remove CollateData Methods from DataManager

**Remove from `data-manager.ts`** (after migration):

- `loadCollateData()` (line 149)
- `saveCollateData()` (line 161)
- `addResource()` (line 171)
- `updateResource()` (line 201)
- `addTagToResource()` (line 244)
- `removeTagFromResource()` (line 273)
- `renameTag()` (line 307)
- `deleteTag()` (line 355)
- `removeResource()` (line 387)

### Phase 4: Type System Cleanup

#### Remove Legacy Type Definitions

**Remove from `types/index.ts`**:

- `Resource` interface (lines 2-10)
- `CollateData` interface (lines 12-16)

#### Update Type Imports

**Update `data-manager.ts`**:

```typescript
// Remove from import statement
import { CollateData, Resource } from "../types";

// Keep only needed types
import {
  ArchiveData,
  BroadcastData,
  UnifiedData,
  UnifiedResource,
  ArweaveUpload,
  SocialPost,
  FileRegistryEntry,
  ArweaveUploadRecord,
} from "../types";
```

## Migration Script Template

```typescript
// migration-script.ts
// Run this to verify no broken references after cleanup

import { execSync } from "child_process";

const searchPatterns = [
  "CollateData",
  "window.electronAPI.collate",
  "loadCollateData",
  "saveCollateData",
];

function verifyCleanup() {
  for (const pattern of searchPatterns) {
    try {
      const result = execSync(`grep -r "${pattern}" src/`, {
        encoding: "utf8",
      });
      if (result.trim()) {
        console.error(`Still found references to ${pattern}:`);
        console.error(result);
        return false;
      }
    } catch (error) {
      // No matches found (grep returns non-zero when no matches)
      console.log(`✓ No references to ${pattern} found`);
    }
  }
  return true;
}

if (verifyCleanup()) {
  console.log("✅ Cleanup verification passed");
} else {
  console.log("❌ Cleanup verification failed");
  process.exit(1);
}
```

## Critical Preservation Checklist

### Must Verify These Still Work After Cleanup:

- [ ] Adding external resources via URL
- [ ] Extracting metadata from web pages
- [ ] Adding internal file resources
- [ ] Uploading files to Arweave
- [ ] Estimating Arweave upload costs
- [ ] Tag management in unified resources
- [ ] Resource search and filtering
- [ ] Resource export functionality
- [ ] Account management for Arweave

### Archive Functionality to Preserve:

- [ ] File registry with UUID tracking
- [ ] Arweave upload functionality
- [ ] Cost estimation
- [ ] Multi-account support
- [ ] Transaction status checking

## Success Criteria

- [ ] No references to `CollateData` in active code
- [ ] No references to legacy `Resource` interface in active code
- [ ] No references to `ArchiveData` in active code (or minimal, well-documented)
- [ ] All UnifiedResourceManager functionality preserved
- [ ] All UnifiedDatabaseManager functionality preserved
- [ ] All tests passing
- [ ] No regression in user functionality
- [ ] Metadata extraction still works
- [ ] Arweave uploads still work
- [ ] File cost estimation still works
