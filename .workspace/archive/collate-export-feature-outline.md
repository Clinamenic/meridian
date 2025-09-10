# Collate Export Feature Implementation Outline

## Feature Overview

Add an Export button to the Collate panel header that allows users to export currently filtered resources in multiple formats:

- JSON format (direct resources data)
- Plain text URLs
- Browser bookmarks format

## Architecture Analysis

### Current State

- Collate panel has filtering via tags (`activeTagFilters`) and search (`currentSearchTerm`)
- Filtering logic in `applyAllFilters()` shows/hides DOM elements based on filters
- Resources are stored in `this.data.collate.resources` array
- Panel header structure: `panel-actions` (Add Resource, Bulk Add) and `panel-search` (search input, clear filters)

### Key Components to Modify

1. **Frontend (src/renderer/)**

   - `index.html`: Add Export button to panel header
   - `styles.css`: Style export button and dropdown
   - `app.js`: Add export functionality and filtered resource logic

2. **Backend (src/main/)**
   - `main.ts`: Add IPC handlers for export operations
   - `data-manager.ts`: Add export file writing methods
   - `preload.ts`: Expose export APIs to renderer

## Implementation Plan

### Phase 1: Frontend UI Components

#### 1.1 HTML Structure

- Add Export button to `.panel-actions` in Collate panel
- Create export dropdown menu with format options:
  - Export as JSON
  - Export URLs as Text
  - Export as Bookmarks

#### 1.2 CSS Styling

- Style export button consistent with existing secondary buttons
- Add dropdown menu styling similar to existing tag dropdowns
- Ensure responsive design compatibility

#### 1.3 JavaScript Functionality

- Add `getFilteredResources()` method to extract currently visible resources
- Add export dropdown toggle functionality
- Add export handlers for each format

### Phase 2: Export Logic

#### 2.1 Filtered Resources Logic

```javascript
getFilteredResources() {
  if (!this.data.collate) return [];

  return this.data.collate.resources.filter(resource => {
    // Apply same filtering logic as applyAllFilters()
    let matchesSearch = true;
    if (this.currentSearchTerm.trim()) {
      const term = this.currentSearchTerm.toLowerCase();
      matchesSearch = /* search logic */;
    }

    let matchesTags = true;
    if (this.activeTagFilters.size > 0) {
      matchesTags = /* tag filter logic */;
    }

    return matchesSearch && matchesTags;
  });
}
```

#### 2.2 Export Format Generators

```javascript
// JSON export - direct resource data
generateJsonExport(resources) {
  return {
    resources: resources,
    exportedAt: new Date().toISOString(),
    filters: {
      searchTerm: this.currentSearchTerm,
      activeTags: Array.from(this.activeTagFilters)
    }
  };
}

// Plain text URLs
generateTextExport(resources) {
  return resources.map(r => r.url).join('\n');
}

// Browser bookmarks format (Netscape Bookmark Format)
generateBookmarksExport(resources) {
  // HTML format compatible with most browsers
}
```

### Phase 3: Backend File Operations

#### 3.1 IPC Handlers (main.ts)

```typescript
ipcMain.handle(
  "collate:export-resources",
  async (_, format, data, filename) => {
    return await this.dataManager.exportResources(format, data, filename);
  }
);
```

#### 3.2 File Writing (data-manager.ts)

```typescript
public async exportResources(format: string, data: any, filename: string): Promise<{success: boolean, filepath?: string}> {
  // Use dialog.showSaveDialog to get save location
  // Write file based on format
  // Return success status and file path
}
```

#### 3.3 Preload API (preload.ts)

```typescript
collate: {
  // ... existing methods
  exportResources: (format: string, data: any, filename: string) =>
    ipcRenderer.invoke("collate:export-resources", format, data, filename);
}
```

### Phase 4: Export Format Specifications

#### 4.1 JSON Format

- Include filtered resources array
- Add metadata: export timestamp, applied filters
- Maintain original resource structure for re-import compatibility

#### 4.2 Text Format

- One URL per line
- Optional: Include titles as comments
- Simple, clipboard-friendly format

#### 4.3 Bookmarks Format

- Netscape Bookmark File Format (HTML)
- Organize by tags as folders (if applicable)
- Include titles and descriptions
- Compatible with Chrome, Firefox, Safari, Edge

### Phase 5: User Experience Enhancements

#### 5.1 Export Feedback

- Show export progress for large datasets
- Success/error notifications
- File location indication after export

#### 5.2 Export Naming

- Default filename with timestamp
- Include filter info in filename (e.g., "resources-tool-tag-2024-01-15.json")
- Allow custom naming via save dialog

#### 5.3 Export Validation

- Check for empty filtered results
- Warn if no filters applied (exporting all resources)
- Validate export data before writing

## File Changes Summary

### New Files

- None (functionality integrated into existing files)

### Modified Files

1. `src/renderer/index.html` - Add export button and dropdown
2. `src/renderer/styles.css` - Export button and dropdown styling
3. `src/renderer/app.js` - Export functionality and UI handlers
4. `src/main/main.ts` - IPC handler for export
5. `src/main/data-manager.ts` - Export file operations
6. `src/main/preload.ts` - Export API exposure

## Testing Strategy

### Manual Testing

1. Test export with no filters (all resources)
2. Test export with tag filters only
3. Test export with search filter only
4. Test export with combined filters
5. Test each export format
6. Test file save dialog and file creation
7. Test import of exported bookmarks in browsers

### Edge Cases

- Empty filtered results
- Special characters in filenames
- Large datasets
- Disk space issues
- File permission issues

## Future Enhancements

### Potential Additions

- Export scheduling/automation
- Cloud export (Google Drive, Dropbox)
- Custom export templates
- Batch export operations
- Export history tracking

### Integration Points

- Archive panel export (uploaded files)
- Broadcast panel export (posts)
- Cross-tool export (combined data)

## Implementation Priority

1. **High Priority**: JSON and Text exports with basic UI
2. **Medium Priority**: Bookmarks export and enhanced UX
3. **Low Priority**: Advanced features and integrations

This outline provides a comprehensive roadmap for implementing the export feature while maintaining consistency with the existing codebase architecture and user experience patterns.
