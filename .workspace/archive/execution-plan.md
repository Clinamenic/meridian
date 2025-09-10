# Legacy Module Cleanup - Execution Plan

## Pre-Execution Checklist

- [ ] Create feature branch: `git checkout -b cleanup/legacy-modules`
- [ ] Backup current state: `git commit -am "Pre-cleanup backup"`
- [ ] Run existing tests to establish baseline
- [ ] Verify UnifiedResourceManager is working correctly

## Phase 1: Safe Removals (5 minutes, No Risk)

### Step 1.1: Remove Test Workspace Files

```bash
cd /Users/gideon/Hub/private/projects/Meridian
rm -rf ../test-workspace/migrate-*.js
rm -rf ../test-workspace/fix-*.js
rm -rf ../test-workspace/*.cjs
```

### Step 1.2: Remove Legacy Backup File

```bash
rm src/renderer/app.js.modularization-backup
```

### Step 1.3: Commit Safe Removals

```bash
git add .
git commit -m "Remove legacy test files and backup files"
```

## Phase 2: Frontend API Migration (15 minutes, Low Risk)

### Step 2.1: Add Unified Metadata API Handler

**File**: `src/main/main.ts`
**Add after line ~230** (after existing IPC handlers):

```typescript
// Unified metadata extraction
ipcMain.handle("metadata:extract", async (_, url) => {
  return await this.metadataExtractor.extractMetadata(url);
});
```

### Step 2.2: Update Frontend API Calls

#### Update UnifiedResourceManager.js

**File**: `src/renderer/modules/UnifiedResourceManager.js`
**Line ~1948**:

```javascript
// BEFORE
const metadata = await window.electronAPI.collate.extractMetadata(url);

// AFTER
const metadata = await window.electronAPI.metadata.extract(url);
```

#### Update app.js (Call 1)

**File**: `src/renderer/app.js`
**Line ~940**:

```javascript
// BEFORE
const metadata = await window.electronAPI.collate.extractMetadata(urlData.url);

// AFTER
const metadata = await window.electronAPI.metadata.extract(urlData.url);
```

#### Update app.js (Call 2)

**File**: `src/renderer/app.js`
**Line ~953**:

```javascript
// BEFORE
await window.electronAPI.collate.addResource(resourceData);

// AFTER
await window.electronAPI.unified.addResource(resourceData);
```

### Step 2.3: Test Frontend Changes

```bash
npm run dev
# Test adding external resources via URL
# Test metadata extraction functionality
# Verify no console errors
```

### Step 2.4: Commit Frontend Changes

```bash
git add .
git commit -m "Migrate frontend API calls from collate to unified/metadata"
```

## Phase 3: Backend Cleanup (10 minutes, Medium Risk)

### Step 3.1: Remove Unused Collate IPC Handlers

**File**: `src/main/main.ts`
**Remove these handlers** (after confirming no active usage):

```typescript
// Remove these lines
ipcMain.handle("collate:load-data", async () => {
  return await this.dataManager.loadCollateData();
});

ipcMain.handle("collate:add-resource", async (_, resourceData) => {
  return await this.dataManager.addResource(resourceData);
});

ipcMain.handle("collate:update-resource", async (_, id, updates) => {
  return await this.dataManager.updateResource(id, updates);
});

ipcMain.handle("collate:add-tag-to-resource", async (_, resourceId, tag) => {
  return await this.dataManager.addTagToResource(resourceId, tag);
});

ipcMain.handle(
  "collate:remove-tag-from-resource",
  async (_, resourceId, tag) => {
    return await this.dataManager.removeTagFromResource(resourceId, tag);
  }
);

ipcMain.handle("collate:rename-tag", async (_, oldTag, newTag) => {
  return await this.dataManager.renameTag(oldTag, newTag);
});

ipcMain.handle("collate:delete-tag", async (_, tag) => {
  return await this.dataManager.deleteTag(tag);
});

ipcMain.handle("collate:remove-resource", async (_, resourceId) => {
  return await this.dataManager.removeResource(resourceId);
});

ipcMain.handle("collate:extract-metadata", async (_, url) => {
  return await this.metadataExtractor.extractMetadata(url);
});

ipcMain.handle(
  "collate:export-resources",
  async (_, format, data, filename) => {
    return await this.dataManager.exportResources(format, data, filename);
  }
);
```

### Step 3.2: Test Backend Changes

```bash
npm run dev
# Test all UnifiedResourceManager functionality
# Verify metadata extraction still works
# Verify resource addition still works
```

### Step 3.3: Commit Backend Changes

```bash
git add .
git commit -m "Remove unused collate IPC handlers"
```

## Phase 4: DataManager Cleanup (10 minutes, Medium Risk)

### Step 4.1: Remove CollateData Methods

**File**: `src/main/data-manager.ts`
**Remove these methods** (lines ~149-409):

- `loadCollateData()`
- `saveCollateData()`
- `addResource()`
- `updateResource()`
- `addTagToResource()`
- `removeTagFromResource()`
- `renameTag()`
- `deleteTag()`
- `removeResource()`

### Step 4.2: Update Type Imports

**File**: `src/main/data-manager.ts`
**Line 2**:

```typescript
// BEFORE
import {
  CollateData,
  ArchiveData,
  BroadcastData,
  UnifiedData,
  Resource,
  UnifiedResource,
  ArweaveUpload,
  SocialPost,
  FileRegistryEntry,
  ArweaveUploadRecord,
} from "../types";

// AFTER
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

### Step 4.3: Test DataManager Changes

```bash
npm run dev
# Test all functionality
# Verify no TypeScript compilation errors
```

### Step 4.4: Commit DataManager Changes

```bash
git add .
git commit -m "Remove CollateData methods and update type imports"
```

## Phase 5: Type System Cleanup (5 minutes, Low Risk)

### Step 5.1: Remove Legacy Type Definitions

**File**: `src/types/index.ts`
**Remove these interfaces**:

```typescript
// Remove lines 2-10
export interface Resource {
  id: string;
  url: string;
  title: string;
  description: string;
  imageUrl?: string;
  tags: string[];
  createdAt: string;
  modifiedAt: string;
}

// Remove lines 12-16
export interface CollateData {
  resources: Resource[];
  tags: { [tag: string]: number }; // tag usage count
  lastModified: string;
}
```

### Step 5.2: Test Type Changes

```bash
npm run build
# Verify no TypeScript compilation errors
```

### Step 5.3: Commit Type Changes

```bash
git add .
git commit -m "Remove legacy CollateData and Resource type definitions"
```

## Phase 6: Verification (5 minutes)

### Step 6.1: Run Verification Script

```bash
npx ts-node .cursor/docs/temp/verify-cleanup.ts
```

### Step 6.2: Manual Testing Checklist

- [ ] Add external resource via URL
- [ ] Verify metadata extraction works
- [ ] Add internal file resource
- [ ] Test Arweave upload (if configured)
- [ ] Test tag management
- [ ] Test resource search and filtering
- [ ] Test resource export

### Step 6.3: Final Commit

```bash
git add .
git commit -m "Complete legacy module cleanup"
```

## Post-Execution Tasks

### Create Pull Request

```bash
git push origin cleanup/legacy-modules
# Create PR with title: "Remove legacy Collate and Archive module references"
```

### Update Documentation

- [ ] Update any remaining documentation that references CollateData
- [ ] Update API documentation if needed

## Rollback Plan (If Issues Found)

### Quick Rollback

```bash
git reset --hard HEAD~6  # Reset to before cleanup started
```

### Selective Rollback

```bash
# If only specific commits cause issues
git revert <commit-hash>
```

## Success Verification

### Automated Checks

- [ ] All tests pass
- [ ] No TypeScript compilation errors
- [ ] Verification script passes

### Manual Verification

- [ ] All resource management features work
- [ ] Metadata extraction works
- [ ] Arweave functionality works (if available)
- [ ] No console errors in browser
- [ ] No functionality regression

## Estimated Total Time: 50 minutes

- Phase 1: 5 minutes
- Phase 2: 15 minutes
- Phase 3: 10 minutes
- Phase 4: 10 minutes
- Phase 5: 5 minutes
- Phase 6: 5 minutes

## Risk Mitigation

### Low Risk Items (Phases 1, 5, 6)

- Safe to execute without extensive testing

### Medium Risk Items (Phases 2, 3, 4)

- Test after each phase
- Have rollback plan ready
- Verify core functionality works

### Critical Preservation

- Metadata extraction from URLs
- Arweave file upload functionality
- Resource CRUD operations
- Tag management

## Notes

- Keep `window.electronAPI.archive.*` calls - they're legitimate Arweave functionality
- The UnifiedResourceManager is well-designed and shouldn't need major changes
- Most of the cleanup is removing unused code rather than changing functionality
