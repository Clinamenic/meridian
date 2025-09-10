# Unified Resource Manager Export Modal Planning

## Overview

Add an Export modal to the Unified Resource Manager that allows users to export resources in multiple formats (JSON, text, HTML bookmarks, and SQLite database), following the same pattern as the existing Collate export functionality.

## Current State Analysis

### Existing Collate Export Functionality

The Collate tab has a complete export system with:

1. **Export Button**: Located in the panel header with export icon
2. **Export Modal**: HTML modal with format selection options
3. **Export Formats**: JSON, text URLs, and HTML bookmarks
4. **Backend Support**: `DataManager.exportResources()` method
5. **Frontend Logic**: Export event handling in `app.js`

### Unified Resource Manager Current State

- Uses SQLite database instead of JSON files
- Has `UnifiedDatabaseManager` for data operations
- Needs export functionality for the new unified data format

## Implementation Plan

### Phase 1: Frontend Export Modal

#### 1.1 Add Export Button to Unified Resource Panel Header

**File**: `src/renderer/index.html`
**Location**: Unified resource panel header (similar to collate panel)

```html
<button
  id="unified-export-btn"
  class="panel-header-icon-btn"
  title="Export Resources"
>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path
      d="M23,12L19,8V11H10V13H19V16M1,18V6C1,4.89 1.9,4 3,4H15A2,2 0 0,1 17,6V9H15V6H3V18H15V15H17V18A2,2 0 0,1 15,20H3A2,2 0 0,1 1,18Z"
    />
  </svg>
</button>
```

#### 1.2 Add Export Modal HTML

**File**: `src/renderer/index.html`
**Location**: After existing modals

```html
<!-- Unified Resource Export Modal -->
<div id="unified-export-modal" class="modal">
  <div class="modal-header">
    <h3>Export Unified Resources</h3>
    <button class="modal-close">&times;</button>
  </div>
  <div class="modal-content">
    <div class="export-info">
      <p id="unified-export-resource-count">Ready to export resources</p>
      <p id="unified-export-filter-info" class="export-filter-description"></p>
    </div>

    <div class="export-options">
      <h4>Select Export Format:</h4>

      <div class="export-option">
        <button class="export-option-btn" data-format="json">
          <div class="export-option-header">
            <strong>JSON Export</strong>
          </div>
          <div class="export-option-description">
            Complete unified resource data with metadata, filters, and
            timestamps. Best for backup or re-importing.
          </div>
        </button>
      </div>

      <div class="export-option">
        <button class="export-option-btn" data-format="text">
          <div class="export-option-header">
            <strong>Text URLs</strong>
          </div>
          <div class="export-option-description">
            Simple text file with one URL per line. Perfect for sharing or
            importing into other tools.
          </div>
        </button>
      </div>

      <div class="export-option">
        <button class="export-option-btn" data-format="bookmarks">
          <div class="export-option-header">
            <strong>Browser Bookmarks</strong>
          </div>
          <div class="export-option-description">
            HTML bookmarks file compatible with Chrome, Firefox, Safari, and
            Edge. Organized by tags.
          </div>
        </button>
      </div>

      <div class="export-option">
        <button class="export-option-btn" data-format="sqlite">
          <div class="export-option-header">
            <strong>SQLite Database</strong>
          </div>
          <div class="export-option-description">
            Complete SQLite database file with all resources, tags, and
            metadata. Best for backup or transferring to another workspace.
          </div>
        </button>
      </div>
    </div>
  </div>
</div>
```

### Phase 2: Frontend Export Logic

#### 2.1 Add Export Methods to UnifiedResourceManager

**File**: `src/renderer/modules/UnifiedResourceManager.js`

```javascript
/**
 * Setup export events
 */
setupExportEvents() {
  const exportBtn = document.getElementById('unified-export-btn');
  const exportOptions = document.querySelectorAll('#unified-export-modal .export-option-btn');

  // Show export modal
  if (exportBtn) {
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openExportModal();
    });
  }

  // Handle export format selection
  exportOptions.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const format = e.currentTarget.dataset.format;
      await this.handleExport(format);
      this.closeModal();
    });
  });
}

/**
 * Open export modal
 */
openExportModal() {
  const filteredResources = this.getFilteredResources();
  const hasResources = filteredResources.length > 0;

  if (!hasResources) {
    this.showError('No resources to export with current filters');
    return;
  }

  // Update modal content
  this.updateExportModalContent(filteredResources);

  // Show modal
  this.openModal('unified-export-modal');
}

/**
 * Update export modal content
 */
updateExportModalContent(filteredResources) {
  const resourceCountEl = document.getElementById('unified-export-resource-count');
  const filterInfoEl = document.getElementById('unified-export-filter-info');
  const exportOptions = document.querySelectorAll('#unified-export-modal .export-option-btn');

  // Update resource count
  const count = filteredResources.length;
  resourceCountEl.textContent = `Ready to export ${count} resource${count !== 1 ? 's' : ''}`;

  // Update filter information
  const filterParts = [];
  if (this.currentSearchTerm?.trim()) {
    filterParts.push(`Search: "${this.currentSearchTerm.trim()}"`);
  }
  if (this.activeTagFilters?.size > 0) {
    const tags = Array.from(this.activeTagFilters).join(', ');
    filterParts.push(`Tags: ${tags}`);
  }

  if (filterParts.length > 0) {
    filterInfoEl.textContent = `Applied filters: ${filterParts.join(' | ')}`;
    filterInfoEl.style.display = 'block';
  } else {
    filterInfoEl.textContent = 'All resources (no filters applied)';
    filterInfoEl.style.display = 'block';
  }

  // Enable all export options
  exportOptions.forEach(btn => {
    btn.disabled = false;
  });
}

/**
 * Get filtered resources for export
 */
getFilteredResources() {
  if (!this.unifiedResources) return [];

  return Array.from(this.unifiedResources.values()).filter(resource => {
    // Apply same filtering logic as applyAllFilters()
    let matchesSearch = true;
    if (this.currentSearchTerm?.trim()) {
      const term = this.currentSearchTerm.toLowerCase();
      const title = resource.properties['dc:title']?.toLowerCase() || '';
      const description = resource.properties['meridian:description']?.toLowerCase() || '';
      const url = resource.locations.primary.value.toLowerCase();

      matchesSearch = title.includes(term) || description.includes(term) || url.includes(term);
    }

    let matchesTags = true;
    if (this.activeTagFilters?.size > 0) {
      if (this.filterLogic === 'all') {
        // ALL logic: Resource must have ALL of the selected tags
        matchesTags = Array.from(this.activeTagFilters).every(tag =>
          resource.properties['meridian:tags']?.includes(tag)
        );
      } else {
        // ANY logic (default): Resource must have at least one of the selected tags
        matchesTags = Array.from(this.activeTagFilters).some(tag =>
          resource.properties['meridian:tags']?.includes(tag)
        );
      }
    }

    return matchesSearch && matchesTags;
  });
}

/**
 * Handle export
 */
async handleExport(format) {
  try {
    const filteredResources = this.getFilteredResources();

    if (filteredResources.length === 0) {
      this.showError('No resources to export with current filters');
      return;
    }

    // Generate export data
    const exportData = this.generateExportData(filteredResources, format);

    // Generate suggested filename
    const filename = this.generateExportFilename(format);

    // Show progress
    this.updateFooterStatus('Exporting...', false);

    // Call backend export
    const result = await window.electronAPI.unified.exportResources(format, exportData, filename);

    if (result.success) {
      const formatNames = {
        json: 'JSON',
        text: 'text file',
        bookmarks: 'bookmarks file',
        sqlite: 'SQLite database'
      };
      const formatName = formatNames[format] || format;
      this.showSuccess(`Successfully exported ${filteredResources.length} resources as ${formatName}`);
      this.updateFooterStatus('Export completed', false);
    } else {
      if (result.error === 'Export cancelled by user') {
        this.updateFooterStatus('Export cancelled', false);
      } else {
        this.showError(`Export failed: ${result.error || 'Unknown error'}`);
        this.updateFooterStatus('Export failed', true);
      }
    }

  } catch (error) {
    console.error('Export error:', error);
    this.showError('Failed to export resources');
    this.updateFooterStatus('Export failed', true);
  }
}

/**
 * Generate export data
 */
generateExportData(resources, format) {
  const baseData = {
    resources: resources,
    exportedAt: new Date().toISOString(),
    filters: {
      searchTerm: this.currentSearchTerm,
      activeTags: Array.from(this.activeTagFilters || [])
    },
    count: resources.length,
    exportFormat: format
  };

  switch (format) {
    case 'json':
      return baseData;
    case 'text':
      return {
        ...baseData,
        urls: resources.map(r => r.locations.primary.value)
      };
    case 'bookmarks':
      return baseData;
    case 'sqlite':
      return baseData; // Will be handled specially in backend
    default:
      return baseData;
  }
}

/**
 * Generate export filename
 */
generateExportFilename(format) {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  let baseFilename = `meridian-unified-resources-${timestamp}`;

  // Add filter information to filename
  const filterParts = [];

  if (this.currentSearchTerm?.trim()) {
    const searchSlug = this.currentSearchTerm.trim().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    filterParts.push(`search-${searchSlug}`);
  }

  if (this.activeTagFilters?.size > 0) {
    const tagSlug = Array.from(this.activeTagFilters).join('-').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    filterParts.push(`tags-${tagSlug}`);
  }

  if (filterParts.length > 0) {
    baseFilename += `-${filterParts.join('-')}`;
  }

  return baseFilename;
}
```

#### 2.2 Update UnifiedResourceManager Constructor

Add export event setup to the constructor:

```javascript
async onInit() {
  console.log("[UnifiedResourceManager] Initializing...");

  // Set up event listeners
  this.setupUnifiedResourceEventListeners();
  this.setupExportEvents(); // Add this line

  // Initialize from existing data
  await this.migrateExistingData();

  // Initialize collapse state
  this.initializeCollapseState();

  console.log("[UnifiedResourceManager] Initialized successfully");
}
```

### Phase 3: Backend Export Support

#### 3.1 Add Unified Export IPC Handler

**File**: `src/main/main.ts`

```typescript
// Add to existing IPC handlers
ipcMain.handle(
  "unified:exportResources",
  async (event, format: string, data: any, filename: string) => {
    return await this.unifiedDatabaseManager.exportResources(
      format,
      data,
      filename
    );
  }
);
```

#### 3.2 Add Export Method to UnifiedDatabaseManager

**File**: `src/main/unified-database-manager.ts`

```typescript
/**
 * Export resources to file
 */
async exportResources(format: string, data: any, suggestedFilename: string): Promise<{success: boolean, filepath?: string, error?: string}> {
  try {
    const { dialog } = await import('electron');
    const { BrowserWindow } = await import('electron');

    // Get the main window
    const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (!mainWindow) {
      throw new Error('No main window available');
    }

    // Determine file extension and filter based on format
    let defaultExtension: string;
    let fileFilters: Array<{name: string, extensions: string[]}>;

    switch (format) {
      case 'json':
        defaultExtension = 'json';
        fileFilters = [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ];
        break;
      case 'text':
        defaultExtension = 'txt';
        fileFilters = [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ];
        break;
      case 'bookmarks':
        defaultExtension = 'html';
        fileFilters = [
          { name: 'HTML Files', extensions: ['html'] },
          { name: 'All Files', extensions: ['*'] }
        ];
        break;
      case 'sqlite':
        defaultExtension = 'db';
        fileFilters = [
          { name: 'SQLite Database Files', extensions: ['db', 'sqlite'] },
          { name: 'All Files', extensions: ['*'] }
        ];
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Unified Resources',
      defaultPath: suggestedFilename.endsWith(`.${defaultExtension}`)
        ? suggestedFilename
        : `${suggestedFilename}.${defaultExtension}`,
      filters: fileFilters
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Export cancelled by user' };
    }

    // Prepare content based on format
    let content: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(data, null, 2);
        break;

      case 'text':
        if (Array.isArray(data.resources)) {
          content = data.resources.map((resource: any) => resource.locations.primary.value).join('\n');
        } else {
          content = 'No resources to export';
        }
        break;

      case 'bookmarks':
        content = this.generateBookmarksHtml(data);
        break;

      case 'sqlite':
        // For SQLite, we need to copy the database file
        await this.exportSqliteDatabase(result.filePath, data);
        return { success: true, filepath: result.filePath };

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    // Write file
    await fs.writeFile(result.filePath, content, 'utf-8');

    return {
      success: true,
      filepath: result.filePath
    };

  } catch (error) {
    console.error('Export resources error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown export error'
    };
  }
}

/**
 * Export SQLite database
 */
private async exportSqliteDatabase(targetPath: string, data: any): Promise<void> {
  if (!this.dbPath) {
    throw new Error('Database not initialized');
  }

  // Close current database connection
  await this.close();

  // Copy database file
  await fs.copyFile(this.dbPath, targetPath);

  // Reinitialize database
  await this.initialize(path.dirname(this.dbPath));
}

/**
 * Generate bookmarks HTML content for unified resources
 */
private generateBookmarksHtml(data: any): string {
  const resources = Array.isArray(data.resources) ? data.resources : [];
  const exportedAt = data.exportedAt || new Date().toISOString();

  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3>Meridian Unified Resources Export - ${new Date(exportedAt).toLocaleDateString()}</H3>
    <DL><p>
`;

  // Group resources by tags for better organization
  const tagGroups: {[tag: string]: any[]} = {};
  const untaggedResources: any[] = [];

  resources.forEach((resource: any) => {
    const tags = resource.properties['meridian:tags'] || [];
    if (tags.length > 0) {
      tags.forEach((tag: string) => {
        if (!tagGroups[tag]) {
          tagGroups[tag] = [];
        }
        tagGroups[tag].push(resource);
      });
    } else {
      untaggedResources.push(resource);
    }
  });

  // Add tagged resources
  Object.entries(tagGroups).forEach(([tag, tagResources]) => {
    html += `        <DT><H3>${this.escapeHtml(tag)}</H3>\n`;
    html += `        <DL><p>\n`;

    tagResources.forEach((resource: any) => {
      const title = resource.properties['dc:title'] || resource.locations.primary.value;
      const description = resource.properties['meridian:description'] ? ` - ${resource.properties['meridian:description']}` : '';
      const url = resource.locations.primary.value;
      html += `            <DT><A HREF="${this.escapeHtml(url)}">${this.escapeHtml(title)}</A>\n`;
      if (description) {
        html += `            <DD>${this.escapeHtml(description)}\n`;
      }
    });

    html += `        </DL><p>\n`;
  });

  // Add untagged resources
  if (untaggedResources.length > 0) {
    html += `        <DT><H3>Untagged</H3>\n`;
    html += `        <DL><p>\n`;

    untaggedResources.forEach((resource: any) => {
      const title = resource.properties['dc:title'] || resource.locations.primary.value;
      const description = resource.properties['meridian:description'] ? ` - ${resource.properties['meridian:description']}` : '';
      const url = resource.locations.primary.value;
      html += `            <DT><A HREF="${this.escapeHtml(url)}">${this.escapeHtml(title)}</A>\n`;
      if (description) {
        html += `            <DD>${this.escapeHtml(description)}\n`;
      }
    });

    html += `        </DL><p>\n`;
  }

  html += `    </DL><p>
</DL><p>`;

  return html;
}

/**
 * Escape HTML special characters
 */
private escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

#### 3.3 Add IPC Handler to Preload

**File**: `src/main/preload.ts`

```typescript
// Add to existing API
unified: {
  // ... existing methods ...
  exportResources: (format: string, data: any, filename: string) =>
    ipcRenderer.invoke('unified:exportResources', format, data, filename),
}
```

### Phase 4: Integration and Testing

#### 4.1 Update UnifiedResourceManager Module Loading

Ensure the export events are set up when the module is loaded.

#### 4.2 Test Export Functionality

1. Test JSON export with filtered resources
2. Test text export with URL extraction
3. Test HTML bookmarks export with tag organization
4. Test SQLite database export
5. Test export with various filter combinations

## Implementation Order

1. **Phase 1**: Add export button and modal HTML
2. **Phase 2**: Implement frontend export logic in UnifiedResourceManager
3. **Phase 3**: Add backend export support to UnifiedDatabaseManager
4. **Phase 4**: Test and refine export functionality

## Success Criteria

- [ ] Export button appears in unified resource panel header
- [ ] Export modal opens with correct resource count and filter info
- [ ] All four export formats work correctly
- [ ] Filtered resources are properly exported
- [ ] Export filenames include filter information
- [ ] Error handling works for all export scenarios
- [ ] Progress feedback is shown during export
- [ ] Success/error messages are displayed appropriately

## Notes

- The SQLite export format is unique to the unified resource manager
- The export functionality should respect current filters and search terms
- Export filenames should include filter information for better organization
- The bookmarks export should work with the new unified resource structure
- Error handling should be comprehensive for all export scenarios
