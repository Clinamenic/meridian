# Archive and Collate Panel Cleanup Plan

## Overview

Following the successful integration of Archive and Collate functionality into the UnifiedResourceManager, this plan details the systematic removal of the legacy Archive and Collate panels and their associated styling while preserving reusable components.

## Current State Analysis

### HTML Structure (index.html)

Currently has 5 tabs:

- `collate` (Active by default) - **TO REMOVE**
- `archive` - **TO REMOVE**
- `unified` - **TO KEEP & MAKE DEFAULT**
- `deploy` - **TO KEEP**
- `broadcast` - **TO KEEP**

### JavaScript Modules

- `ArchiveManager.js` - **TO REMOVE**
- `ResourceManager.js` (Collate functionality) - **TO REMOVE**
- `UnifiedResourceManager.js` - **TO KEEP**

### App.js Integration

- Contains switch cases for `collate` and `archive` tools - **TO REMOVE**
- References to archive/collate data loading - **TO REMOVE**
- Default tool is `collate` - **CHANGE TO unified**

## Phase 1: HTML Structure Cleanup

### Tab Navigation Changes

**File: `src/renderer/index.html`**

**Remove tabs:**

```html
<!-- REMOVE: Lines ~85-90 -->
<button class="tab-btn active" data-tool="collate">
  <span class="tab-icon"></span>
  <span class="tab-label">Collate</span>
</button>
<button class="tab-btn" data-tool="archive">
  <span class="tab-icon"></span>
  <span class="tab-label">Archive</span>
</button>
```

**Make unified tab default:**

```html
<!-- MODIFY: Remove 'active' from collate/archive, add to unified -->
<button class="tab-btn active" data-tool="unified">
  <span class="tab-icon"></span>
  <span class="tab-label">Unified</span>
</button>
```

**Note:** After streamlining, consider renaming the tab label from "Unified" to "Resources" since it will be the primary resource management interface.

### Panel Container Removal

**Remove entire panels:**

- `#collate-panel` (Lines ~95-275)
- `#archive-panel` (Lines ~275-510)

**Keep:**

- `#unified-panel` (Lines ~510-515) - Already minimal, populated by UnifiedResourceManager

## Phase 2: JavaScript Module Cleanup

### Files to Remove Completely

1. `src/renderer/modules/ArchiveManager.js`
2. `src/renderer/modules/ResourceManager.js`

### ModuleLoader.js Updates

**File: `src/renderer/modules/ModuleLoader.js`**

**Remove imports and registrations:**

```javascript
// REMOVE Lines ~99-118:
const { ResourceManager } = await import("./ResourceManager.js");
const { ArchiveManager } = await import("./ArchiveManager.js");

// REMOVE registrations:
await this.registerModule("resourceManager", ResourceManager);
await this.registerModule("archiveManager", ArchiveManager);
```

**Keep:**

```javascript
// KEEP - UnifiedResourceManager dependency comment should be updated:
// UnifiedResourceManager depends on TagManager only (remove ResourceManager, ArchiveManager references)
```

### App.js Cleanup

**File: `src/renderer/app.js`**

**Remove data properties:**

```javascript
// REMOVE Lines ~13-14:
collate: null,
archive: null,
```

**Remove collapse state:**

```javascript
// REMOVE Lines ~25-35:
this.collateCollapseState = { ... };
this.archiveCollapseState = { ... };
```

**Remove event setup:**

```javascript
// REMOVE Lines ~155-156:
this.setupCollateEvents();
this.setupArchiveEvents();

// REMOVE entire methods Lines ~167-251:
setupCollateEvents() { ... }

// REMOVE Lines ~252-278:
setupArchiveEvents() { ... }
```

**Update default tool:**

```javascript
// CHANGE Line ~10:
this.currentTool = "unified"; // was 'collate'
```

**Remove switch cases:**

```javascript
// REMOVE from switchTool method Lines ~622-630:
case 'collate':
case 'archive':
```

**Remove load methods:**

```javascript
// REMOVE Lines ~740-770:
async loadCollateData() { ... }

// REMOVE Lines ~1394-1412:
async loadArchiveData() { ... }

// REMOVE getArchiveManager() method Lines ~786-787
```

**Update search functionality:**

```javascript
// REMOVE Lines ~2088-2125 (collate/archive search integration)
// Keep only unified search if implemented
```

## Phase 3: CSS Cleanup Strategy

### Safe-to-Remove Selectors

**Panel-specific selectors (REMOVE):**

```css
/* Panel header layouts */
#collate-panel .panel-header {
  ...;
}
#archive-panel .panel-header {
  ...;
}
#collate-panel .panel-content {
  ...;
}
#archive-panel .panel-content {
  ...;
}

/* Filter logic buttons */
#archive-filter-logic-btn[data-logic="any"] .filter-logic-any {
  ...;
}
#archive-filter-logic-btn[data-logic="any"] .filter-logic-all {
  ...;
}
#archive-filter-logic-btn[data-logic="all"] .filter-logic-any {
  ...;
}
#archive-filter-logic-btn[data-logic="all"] .filter-logic-all {
  ...;
}

/* Archive-specific collapse buttons */
#archive-collapse-all-btn .collapse-down {
  ...;
}
#archive-collapse-all-btn .collapse-up {
  ...;
}
#archive-collapse-all-btn[data-state="expanded"] .collapse-down {
  ...;
}
#archive-collapse-all-btn[data-state="expanded"] .collapse-up {
  ...;
}
#archive-collapse-all-btn[data-state="collapsed"] .collapse-down {
  ...;
}
#archive-collapse-all-btn[data-state="collapsed"] .collapse-up {
  ...;
}
```

**Archive-specific component styles (REMOVE):**

```css
/* Archive file management */
.archive-path-container {
  ...;
}
.archive-path.virtual {
  ...;
}
.archive-path.absolute,
.archive-path.relative {
  ...;
}
.archive-locate-btn {
  ...;
}

/* Archive list and items */
.archive-list {
  ...;
}
.archive-item {
  ...;
}
.archive-header {
  ...;
}
.archive-info {
  ...;
}
.archive-title {
  ...;
}
.archive-path {
  ...;
}
.archive-metadata {
  ...;
}
.archive-metadata-item {
  ...;
}
.archive-metadata-label {
  ...;
}
.archive-metadata-value {
  ...;
}

/* Archive Arweave hash display */
.archive-arweave-hashes {
  ...;
}
.archive-hash-header {
  ...;
}
.archive-hash-count {
  ...;
}
.archive-hash-toggle {
  ...;
}
.archive-hash-toggle-icon {
  ...;
}
.archive-hash-list {
  ...;
}
.archive-hash-item {
  ...;
}
.archive-hash-content {
  ...;
}
.archive-hash-link {
  ...;
}
.archive-hash-timestamp {
  ...;
}
.archive-hash-actions {
  ...;
}
.archive-hash-action-btn {
  ...;
}

/* Archive tags */
.archive-tags {
  ...;
}
.archive-tag {
  ...;
}
.archive-tag .remove-tag-btn {
  ...;
}

/* Archive actions dropdown */
.archive-actions-dropdown {
  ...;
}
.archive-actions-btn {
  ...;
}
.archive-actions-menu {
  ...;
}
.archive-actions-item {
  ...;
}

/* Archive tag filters */
.archive-tag-filter-container {
  ...;
}
.archive-tag-filter {
  ...;
}
.archive-tag-filter-label {
  ...;
}
.archive-tag-filter-count {
  ...;
}
.archive-tag-dropdown-menu {
  ...;
}
.archive-tag-dropdown-item {
  ...;
}

/* Archive collapse states */
.archive-item.collapsed .archive-metadata {
  ...;
}
.archive-item.collapsed .archive-arweave-hashes {
  ...;
}
.archive-item.collapsed .archive-tags {
  ...;
}
.archive-collapse-btn {
  ...;
}
```

**Archive modal styles (REMOVE):**

```css
.modal#edit-archive-item-modal .form-group label {
  ...;
}
```

### KEEP - Reusable Component Styles

**These are used by UnifiedResourceManager:**

```css
/* Base component styles - KEEP */
.resource-list {
  ...;
}
.resource-item {
  ...;
}
.resource-header {
  ...;
}
.resource-info {
  ...;
}
.resource-title {
  ...;
}
.resource-url {
  ...;
}
.resource-description {
  ...;
}
.resource-tags {
  ...;
}
.resource-tag {
  ...;
}
.resource-actions-dropdown {
  ...;
}
.resource-actions-btn {
  ...;
}
.resource-actions-menu {
  ...;
}
.resource-actions-item {
  ...;
}

/* Tag filtering - KEEP */
.tag-filter-list {
  ...;
}
.tag-filter-container {
  ...;
}
.tag-filter {
  ...;
}
.tag-filter-label {
  ...;
}
.tag-filter-count {
  ...;
}
.tag-dropdown-menu {
  ...;
}
.tag-dropdown-item {
  ...;
}

/* Form components - KEEP */
.resource-tag-input {
  ...;
}
.tag-input-container {
  ...;
}
.tag-input {
  ...;
}
.add-tag-btn {
  ...;
}
.tag-autocomplete {
  ...;
}
.autocomplete-item {
  ...;
}

/* Modal components - KEEP */
.modal-resource-tags {
  ...;
}
.modal-resource-tag-input {
  ...;
}
.modal-tags-list {
  ...;
}
.modal-tag-autocomplete {
  ...;
}

/* Panel layouts - KEEP (used by unified) */
.panel-header {
  ...;
}
.panel-content {
  ...;
}
.main-content-area {
  ...;
}
.filters-sidebar {
  ...;
}
.panel-actions {
  ...;
}
.panel-search {
  ...;
}
.resource-count {
  ...;
}

/* Buttons - KEEP */
.panel-header-btn {
  ...;
}
.panel-header-icon-btn {
  ...;
}
.filter-logic-control {
  ...;
}
.filter-logic-select {
  ...;
}

/* Collapse functionality - KEEP (used by unified) */
.resource-collapse-btn {
  ...;
}
.resource-item.collapsed .resource-description {
  ...;
}
.resource-item.collapsed .resource-tags {
  ...;
}
```

## Phase 4: Streamline Unified System Naming

After removing the legacy panels, we should streamline the unified system's element and style names to remove the "unified-" prefixes, while keeping arweave-specific naming.

### HTML/JavaScript Changes

**File: `src/renderer/index.html` & `UnifiedResourceManager.js`**

**Rename elements:**

```html
<!-- CHANGE: -->
<div id="unified-panel" class="tool-panel">
  <!-- TO: -->
  <div id="resource-panel" class="tool-panel">
    <!-- CHANGE: -->
    <div class="unified-resource-list">
      <!-- TO: -->
      <div class="resource-list"></div>
    </div>
  </div>
</div>
```

**Button ID updates:**

```
id="unified-filter-logic-btn" → id="filter-logic-btn"
id="unified-collapse-all-btn" → id="collapse-all-btn"
id="unified-clear-filters-btn" → id="clear-filters-btn"
```

### CSS Renaming

**File: `src/renderer/styles.css`**

**Update selectors:**

```css
/* CHANGE: */
#unified-panel .panel-header → #resource-panel .panel-header
#unified-panel .panel-content → #resource-panel .panel-content
#unified-panel .main-content-area → #resource-panel .main-content-area
.unified-resource-list → .resource-list
#unified-filter-logic-btn → #filter-logic-btn
#unified-collapse-all-btn → #collapse-all-btn

/* KEEP arweave-specific naming: */
.archive-arweave-hashes {
  ...;
}
.archive-hash-* {
  ...;
}
/* These stay as-is since they're specifically for Arweave functionality */
```

### JavaScript Updates

**File: `src/renderer/modules/UnifiedResourceManager.js`**

**Update DOM selectors:**

```javascript
// CHANGE all instances:
document.getElementById('unified-panel') → document.getElementById('resource-panel')
getElementById('unified-filter-logic-btn') → getElementById('filter-logic-btn')
getElementById('unified-collapse-all-btn') → getElementById('collapse-all-btn')
querySelector('.unified-resource-list') → querySelector('.resource-list')
```

## Phase 5: Implementation Steps

### Step 1: Create Feature Branch

```bash
git checkout -b cleanup/remove-archive-collate-panels
```

### Step 2: Update HTML Structure

1. Remove collate and archive tab buttons
2. Remove collate and archive panel containers
3. Set unified tab as active/default

### Step 3: Update JavaScript

1. Remove ArchiveManager.js and ResourceManager.js files
2. Update ModuleLoader.js to remove imports and registrations
3. Clean up App.js:
   - Remove data properties
   - Remove event handlers
   - Remove load methods
   - Update default tool
   - Remove switch cases
   - Clean up search functionality

### Step 4: CSS Cleanup

1. Remove all archive-specific selectors (Lines ~1737-2180, ~3329-3420, ~3518-3585)
2. Remove all collate-specific panel selectors (Lines ~796-930)
3. Keep all reusable component styles that UnifiedResourceManager uses
4. Verify unified panel styles are complete

### Step 5: Streamline Unified Naming

1. Rename `#unified-panel` to `#resource-panel` in HTML and JavaScript
2. Rename `.unified-resource-list` to `.resource-list`
3. Update all CSS selectors from unified-specific to generic resource panel selectors
4. Update all JavaScript DOM selectors in UnifiedResourceManager.js
5. Keep arweave-specific naming (`.archive-hash-*`, etc.)

### Step 6: Testing

1. Verify app launches with unified tab as default
2. Test all unified functionality works
3. Test deploy and broadcast panels still work
4. Verify no console errors
5. Test responsive layout
6. Test all collapse/expand functionality
7. Test tag filtering
8. Test modal workflows

### Step 7: Final Verification

1. Search codebase for any remaining references to:
   - `collate`
   - `archive` (except for arweave-related functionality in unified)
   - `ArchiveManager`
   - `ResourceManager`
2. Test that no styling is broken
3. Verify all functionality is preserved in unified system

## Risk Assessment

### Low Risk

- Removing HTML panels and tab buttons
- Removing CSS selectors with specific IDs
- Removing JavaScript files not imported elsewhere

### Medium Risk

- CSS class selectors that might be reused
- App.js data structure changes
- Default tool switching

### High Risk

- Removing shared component styles used by UnifiedResourceManager
- Modal-related styles that might be reused

## Migration Status ✅

Based on user confirmation:

1. **Archive/Collate features migrated to unified system** ✅
2. **Arweave wallet setup available in footer** ✅ (can remove from archive panel)
3. **Tag filter logic working in unified system** ✅ (can remove old filter logic)
4. **Modal workflows migrated** ✅
5. **Search functionality handled** ✅

## Outstanding Questions for Review

1. **Are there any external dependencies or integrations that rely on the old panel structure?**
2. **Do we need to update any user documentation or help content?**
3. **Are there any automated tests that need updating?**
4. **Should we implement any migration notices for users upgrading?**
5. **Should we rename UnifiedResourceManager.js to ResourceManager.js after cleanup?**

## Success Criteria

- [ ] Application launches with unified tab as default
- [ ] All unified functionality works as expected
- [ ] Deploy and broadcast panels remain functional
- [ ] No console errors or broken styling
- [ ] Codebase is clean of legacy archive/collate references
- [ ] File size reduction achieved through removed code
- [ ] Performance improved due to fewer loaded modules

## Rollback Plan

1. Keep feature branch until thoroughly tested in production
2. Have backup of current working state
3. Document any configuration changes needed
4. Plan staged rollout if possible
