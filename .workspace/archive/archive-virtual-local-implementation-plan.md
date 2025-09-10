# Archive Tool: Virtual/Local Item Implementation Plan

## Overview

This document outlines the implementation plan for introducing a virtual/local distinction in the Archive tool, allowing the system to track both local files and virtual-only items while maintaining Arweave upload tracking and metadata management.

## Current Architecture Analysis

### Existing Data Structures

The current Archive tool uses:

1. **FileRegistryEntry** - Core data structure for file tracking
2. **ArweaveUploadRecord** - Tracks individual Arweave uploads per file
3. **ArchiveData** - Container for all archive data including files array
4. **ArweaveManager** - Handles uploads and file operations

Key observations:

- Virtual items already exist (indicated by `[VIRTUAL]` filepath prefix)
- Virtual items use `"virtual:unknown"` contentHash and `0` fileSize
- Virtual items have `isVirtual: true` in customFields
- Both virtual and local items support tagging and Arweave upload tracking

## Requirements Analysis

### Core Distinctions

**Local Items:**

- Associated with actual filesystem files
- Can be re-uploaded to Arweave
- Metadata synced with file properties (size, hash, modified date)
- Support automatic UUID resolution from frontmatter
- Can be validated against filesystem

**Virtual Items:**

- No local file association
- Cannot be re-uploaded (only tracked uploads)
- User-editable metadata (title, tags, custom fields)
- Arweave uploads tracked for reference only
- Exist purely for organizational/archival purposes

### Editable vs Fixed Metadata

**Editable for Both Types:**

- `title` - User can always modify
- `tags` - User can add/remove tags
- `metadata.customFields` - User can add arbitrary metadata
- `metadata.author` - User can override

**Fixed for Local Items (synced from file):**

- `filePath` - Must match actual file location
- `contentHash` - Calculated from file content
- `fileSize` - Actual file size
- `mimeType` - Derived from file extension
- `created` - File creation timestamp
- `modified` - File modification timestamp

**Fixed for Virtual Items:**

- `filePath` - Always prefixed with `[VIRTUAL]`
- `contentHash` - Always `"virtual:unknown"`
- `fileSize` - Always `0`
- `mimeType` - Can be user-specified or default
- `created` - Creation timestamp in registry
- `modified` - Last metadata update timestamp

## Implementation Plan

### Integration Points and File Modifications

#### Required File Modifications (Building on Existing Architecture)

```
src/types/index.ts                    // EXTEND: Add type field and EditableMetadata interface
src/main/data-manager.ts              // EXTEND: Add updateEditableMetadata method
src/main/arweave-manager.ts          // EXTEND: Add validateForUpload and uploadFileByUUID
src/main/main.ts                     // EXTEND: Add registry:update-metadata IPC handler
src/main/preload.ts                  // EXTEND: Add updateFileMetadata to archive API
src/renderer/app.js                  // EXTEND: Add edit modal functionality (reuse pattern)
src/renderer/index.html              // EXTEND: Add edit archive modal to existing modals
src/renderer/styles.css              // EXTEND: Add edit archive modal styles
```

#### Leveraging Existing Architecture

**✅ Already Available:**

- FileRegistryEntry type with UUID-based tracking
- DataManager.addOrUpdateFile(), getFileByUUID(), searchFiles()
- Virtual file detection via `[VIRTUAL]` prefix and `isVirtual` flag
- IPC handlers for registry operations (registry:\*)
- Modal system with edit resource pattern to follow
- Archive list rendering with dropdown actions
- Tag management system for archive files

**✅ Existing Patterns to Reuse:**

- Edit Resource Modal → Edit Archive Item Modal
- Resource Actions Dropdown → Archive Actions Dropdown
- Tag input/autocomplete system
- Modal state management in app.js
- Form validation and submission patterns

#### Extending Existing Services (No New Files Needed)

```typescript
// DataManager - extend existing methods
class DataManager {
  // ✅ ALREADY EXISTS - will enhance
  async addOrUpdateFile(file: FileRegistryEntry): Promise<void>
  async getFileByUUID(uuid: string): Promise<FileRegistryEntry | null>
  async searchFiles(query: SearchQuery): Promise<FileRegistryEntry[]>
  async removeFile(uuid: string): Promise<void>

  // 🆕 ADD TO EXISTING CLASS - for edit functionality
  async updateEditableMetadata(
    uuid: string,
    updates: EditableMetadata
  ): Promise<FileRegistryEntry> {
    const file = await this.getFileByUUID(uuid);
    if (!file) throw new Error('File not found');

    const isVirtual = file.filePath.startsWith('[VIRTUAL]');

    // Update editable fields
    file.title = updates.title ?? file.title;
    file.tags = updates.tags ?? file.tags;
    file.metadata.author = updates.author ?? file.metadata.author;
    file.metadata.customFields = { ...file.metadata.customFields, ...updates.customFields };

    // Virtual-only fields
    if (isVirtual && updates.mimeType) {
      file.mimeType = updates.mimeType;
    }

    file.modified = new Date().toISOString();

    await this.addOrUpdateFile(file);
    return file;
  }
}

// ArweaveManager - extend existing methods
class ArweaveManager {
  // ✅ ALREADY EXISTS - will enhance
  async uploadFile(filePath: string): Promise<UploadResult>
  async createRegistryEntry(filePath: string): Promise<FileRegistryEntry>
  async resolveUUID(filePath: string): Promise<UUIDResolutionResult>
  async recordArweaveUpload(filePath: string, uuid: string, ...): Promise<void>

  // 🆕 ADD TO EXISTING CLASS - for UUID-based operations
  async validateForUpload(uuid: string): Promise<{canUpload: boolean, reason?: string}> {
    const file = await this.dataManager.getFileByUUID(uuid);
    if (!file) return { canUpload: false, reason: 'File not found' };

    const isVirtual = file.filePath.startsWith('[VIRTUAL]');
    if (isVirtual) return { canUpload: false, reason: 'Virtual files cannot be uploaded' };

    const fs = require('fs');
    if (!fs.existsSync(file.filePath)) {
      return { canUpload: false, reason: 'Local file not found' };
    }

    return { canUpload: true };
  }

  async uploadFileByUUID(uuid: string, tags?: string[]): Promise<UploadResult> {
    const validation = await this.validateForUpload(uuid);
    if (!validation.canUpload) {
      throw new Error(validation.reason);
    }

    const file = await this.dataManager.getFileByUUID(uuid);
    return await this.uploadFile(file.filePath, tags);
  }
}
```

### Phase 1: Type System Enhancement

#### 1.1 Enhanced Type Definitions

```typescript
// Enhanced FileRegistryEntry with explicit type distinction
export interface FileRegistryEntry {
  uuid: string;
  type: "local" | "virtual"; // NEW: Explicit type field
  title: string;
  filePath: string;
  contentHash: string;
  fileSize: number;
  mimeType: string;
  created: string;
  modified: string;
  tags: string[];
  metadata: {
    author?: string;
    customFields: { [key: string]: any };
    // NEW: Virtual-specific metadata
    isVirtual?: boolean; // Deprecated, use type field
    virtualSourceInfo?: {
      originalSource?: string;
      importDate?: string;
      externalReferences?: string[];
    };
  };
  arweave_hashes: ArweaveUploadRecord[];
}

// NEW: Validation result for file operations
export interface FileValidationResult {
  isValid: boolean;
  type: "local" | "virtual";
  errors: string[];
  warnings: string[];
  canUpload: boolean;
  canSync: boolean;
}
```

#### 1.2 Migration Strategy

```typescript
// Migration function for existing data
async function migrateToTypedEntries(data: ArchiveData): Promise<ArchiveData> {
  for (const file of data.files) {
    // Determine type based on existing patterns
    if (
      file.filePath.startsWith("[VIRTUAL]") ||
      file.metadata.customFields?.isVirtual
    ) {
      file.type = "virtual";
    } else {
      file.type = "local";
    }
  }
  return data;
}
```

### Phase 2: Simple Extensions to Existing Classes

#### 2.1 Essential New Interfaces (src/types/index.ts)

```typescript
// Add to existing types - minimal interface for edit functionality
interface EditableMetadata {
  title?: string;
  tags?: string[];
  author?: string;
  customFields?: { [key: string]: any };
  mimeType?: string; // Virtual files only
}
```

#### 2.2 Backend Method Extensions

**🔹 Add to DataManager class (src/main/data-manager.ts)**

```javascript
// Single method addition - reuses existing infrastructure
async updateEditableMetadata(uuid, updates) {
  const file = await this.getFileByUUID(uuid);
  if (!file) throw new Error('File not found');

  // Update editable fields
  if (updates.title !== undefined) file.title = updates.title;
  if (updates.tags !== undefined) file.tags = updates.tags;
  if (updates.author !== undefined) {
    file.metadata.author = updates.author;
  }
  if (updates.customFields !== undefined) {
    file.metadata.customFields = { ...file.metadata.customFields, ...updates.customFields };
  }

  // Virtual-only fields
  const isVirtual = file.filePath.startsWith('[VIRTUAL]');
  if (isVirtual && updates.mimeType !== undefined) {
    file.mimeType = updates.mimeType;
  }

  file.modified = new Date().toISOString();
  await this.addOrUpdateFile(file);
  return file;
}
```

**🔹 Add to ArweaveManager class (src/main/arweave-manager.ts)**

```javascript
// Single method addition for upload validation
async validateForUpload(uuid) {
  const file = await this.dataManager.getFileByUUID(uuid);
  if (!file) return { canUpload: false, reason: 'File not found' };

  const isVirtual = file.filePath.startsWith('[VIRTUAL]');
  if (isVirtual) return { canUpload: false, reason: 'Virtual files cannot be uploaded' };

  const fs = require('fs');
  if (!fs.existsSync(file.filePath)) {
    return { canUpload: false, reason: 'Local file not found' };
  }

  return { canUpload: true };
}
```

**🔹 Add IPC Handler (src/main/main.ts)**

```javascript
// Single IPC handler addition
ipcMain.handle("archive:update-file-metadata", async (_, uuid, updates) => {
  return await dataManager.updateEditableMetadata(uuid, updates);
});
```

**🔹 Add to Preload API (src/main/preload.ts)**

```javascript
// Add to existing archive API object
archive: {
  // ... existing methods ...
  updateFileMetadata: (uuid: string, updates: any) =>
    ipcRenderer.invoke('archive:update-file-metadata', uuid, updates),
}
```

#### 2.3 Frontend Extensions - Follow Existing Patterns

**🔹 Add Edit Option to Archive Actions Menu (src/renderer/app.js)**

```javascript
// Modify existing archive actions dropdown in renderArchiveFiles()
<div class="archive-actions-menu" data-file-uuid="${file.uuid}">
  <button class="archive-actions-item edit-option" data-file-uuid="${file.uuid}">Edit</button>
  <button class="archive-actions-item upload-option" data-file-uuid="${file.uuid}">Upload to Arweave</button>
  <!-- ... existing options ... -->
</div>
```

**🔹 Add Edit Archive Modal to HTML (src/renderer/index.html)**

```html
<!-- Add after existing modals -->
<div id="edit-archive-item-modal" class="modal">
  <div class="modal-header">
    <h3>Edit Archive Item</h3>
    <button class="modal-close">&times;</button>
  </div>
  <div class="modal-content">
    <form id="edit-archive-item-form">
      <div class="form-group">
        <input
          type="text"
          id="edit-archive-title"
          placeholder="Title"
          required
        />
      </div>
      <div class="form-group">
        <input
          type="text"
          id="edit-archive-author"
          placeholder="Author (optional)"
        />
      </div>
      <div class="form-group virtual-only" style="display: none;">
        <input type="text" id="edit-archive-mimetype" placeholder="MIME Type" />
      </div>
      <div class="modal-resource-tags">
        <!-- Reuse existing tag input system -->
        <div class="modal-resource-tag-input">
          <input
            type="text"
            id="edit-archive-tag-input"
            class="tag-input"
            placeholder="add tag..."
          />
          <button
            type="button"
            class="add-tag-btn"
            id="edit-archive-add-tag-btn"
            disabled
          >
            +
          </button>
        </div>
        <div class="modal-tags-list" id="edit-archive-tags-list">
          <!-- Tags rendered here -->
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-btn" onclick="app.closeModal()">
          Cancel
        </button>
        <button type="submit" class="primary-btn">Update Item</button>
      </div>
    </form>
  </div>
</div>
```

**🔹 Add Methods to MeridianApp class (src/renderer/app.js)**

```javascript
// Add to existing class - follows Edit Resource pattern
async openEditArchiveItemModal(fileUuid) {
  const file = this.data.archive.files.find(f => f.uuid === fileUuid);
  if (!file) return this.showError('Archive item not found');

  this.openModal('edit-archive-item-modal');

  // Populate form (same pattern as openEditResourceModal)
  document.getElementById('edit-archive-title').value = file.title;
  document.getElementById('edit-archive-author').value = file.metadata.author || '';

  // Handle virtual-only fields
  const isVirtual = file.filePath.startsWith('[VIRTUAL]');
  const virtualFields = document.querySelector('.virtual-only');
  if (isVirtual) {
    virtualFields.style.display = 'block';
    document.getElementById('edit-archive-mimetype').value = file.mimeType || '';
  } else {
    virtualFields.style.display = 'none';
  }

  // Setup tags (reuse existing system)
  this.editArchiveTags = [...file.tags];
  this.renderEditArchiveTags();

  this.editingArchiveFileUuid = fileUuid;
}

async handleEditArchiveItemSubmit(e) {
  e.preventDefault();
  if (!this.editingArchiveFileUuid) return;

  try {
    const updates = {
      title: document.getElementById('edit-archive-title').value,
      author: document.getElementById('edit-archive-author').value || undefined,
      tags: this.editArchiveTags || []
    };

    // Add mimeType for virtual files
    const mimeTypeField = document.getElementById('edit-archive-mimetype');
    if (mimeTypeField.parentElement.style.display !== 'none') {
      updates.mimeType = mimeTypeField.value;
    }

    await window.electronAPI.archive.updateFileMetadata(this.editingArchiveFileUuid, updates);

    this.closeModal();
    await this.loadArchiveData();
    this.showSuccess('Archive item updated successfully');

  } catch (error) {
    this.showError('Failed to update archive item: ' + error.message);
  }
}
```

### Phase 3: Complete Implementation

#### 3.1 Enhanced Archive Actions Integration

// Visual indicators
const TypeIndicator = ({ type }: { type: "local" | "virtual" }) => (
<Badge variant={type === "local" ? "success" : "info"}>
{type === "local" ? "📁 Local" : "☁️ Virtual"}
</Badge>
);

````

#### 4.2 Metadata Editing Interface

##### 4.2.1 Edit Modal Integration

```typescript
// Edit Archive Item Modal (similar to Edit Resource modal)
interface EditArchiveItemModalProps {
  file: FileRegistryEntry;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: EditableMetadata) => Promise<void>;
}

const EditArchiveItemModal = ({
  file,
  isOpen,
  onClose,
  onSave,
}: EditArchiveItemModalProps) => {
  const [formData, setFormData] = useState<EditableMetadata>({
    title: file.title,
    tags: [...file.tags],
    author: file.metadata.author,
    customFields: { ...file.metadata.customFields },
    ...(file.type === "virtual" && { mimeType: file.mimeType }),
  });

  const handleSave = async () => {
    await onSave(formData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Archive Item">
      <MetadataEditor
        file={file}
        formData={formData}
        onChange={setFormData}
        onSave={handleSave}
        onCancel={onClose}
      />
    </Modal>
  );
};
````

##### 4.2.2 Dropdown Menu Integration

```typescript
// Archive item dropdown menu with Edit option
interface ArchiveItemDropdownProps {
  file: FileRegistryEntry;
  onEdit: () => void;
  onUpload?: () => void;
  onSync?: () => void;
  onDelete: () => void;
}

const ArchiveItemDropdown = ({
  file,
  onEdit,
  onUpload,
  onSync,
  onDelete,
}: ArchiveItemDropdownProps) => {
  const canUpload = file.type === "local" && fileExists(file.filePath);
  const canSync = file.type === "local";

  return (
    <DropdownMenu>
      <DropdownMenuItem onClick={onEdit}>
        <EditIcon className="w-4 h-4 mr-2" />
        Edit
      </DropdownMenuItem>

      {canUpload && (
        <DropdownMenuItem onClick={onUpload}>
          <UploadIcon className="w-4 h-4 mr-2" />
          Upload to Arweave
        </DropdownMenuItem>
      )}

      {canSync && (
        <DropdownMenuItem onClick={onSync}>
          <SyncIcon className="w-4 h-4 mr-2" />
          Sync from File
        </DropdownMenuItem>
      )}

      <DropdownMenuSeparator />

      <DropdownMenuItem onClick={onDelete} className="text-destructive">
        <DeleteIcon className="w-4 h-4 mr-2" />
        Remove from Archive
      </DropdownMenuItem>
    </DropdownMenu>
  );
};
```

##### 4.2.3 Archive List Integration

```typescript
// Archive list component with edit modal integration
const ArchiveListItem = ({ file }: { file: FileRegistryEntry }) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  const handleSave = async (updates: EditableMetadata) => {
    await archiveService.updateEditableMetadata(file.uuid, updates);
    // Refresh the list or update local state
  };

  return (
    <div className="archive-list-item">
      <div className="item-info">
        <TypeIndicator type={file.type} />
        <h3>{file.title}</h3>
        <p>{file.filePath}</p>
        <TagList tags={file.tags} />
      </div>

      <div className="item-actions">
        <ArchiveItemDropdown
          file={file}
          onEdit={handleEdit}
          onUpload={() => handleUpload(file.uuid)}
          onSync={() => handleSync(file.uuid)}
          onDelete={() => handleDelete(file.uuid)}
        />
      </div>

      <EditArchiveItemModal
        file={file}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
};
```

##### 4.2.4 Form Component Implementation

```typescript
interface MetadataEditorProps {
  file: FileRegistryEntry;
  formData: EditableMetadata;
  onChange: (data: EditableMetadata) => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
}

// Different editing modes based on file type
const MetadataEditor = ({
  file,
  formData,
  onChange,
  onSave,
  onCancel,
}: MetadataEditorProps) => {
  const isVirtual = file.type === "virtual";
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSave();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title Field - Always editable */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium">
          Title *
        </label>
        <input
          id="title"
          type="text"
          value={formData.title || ""}
          onChange={(e) => onChange({ ...formData, title: e.target.value })}
          required
          className="mt-1 block w-full rounded-md border-gray-300"
        />
      </div>

      {/* Tags Field - Always editable */}
      <div>
        <label className="block text-sm font-medium">Tags</label>
        <TagsEditor
          tags={formData.tags || []}
          onChange={(tags) => onChange({ ...formData, tags })}
        />
      </div>

      {/* Author Field - Always editable */}
      <div>
        <label htmlFor="author" className="block text-sm font-medium">
          Author
        </label>
        <input
          id="author"
          type="text"
          value={formData.author || ""}
          onChange={(e) => onChange({ ...formData, author: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300"
        />
      </div>

      {/* Virtual-only fields */}
      {isVirtual && (
        <>
          <div>
            <label htmlFor="mimeType" className="block text-sm font-medium">
              MIME Type
            </label>
            <input
              id="mimeType"
              type="text"
              value={formData.mimeType || ""}
              onChange={(e) =>
                onChange({ ...formData, mimeType: e.target.value })
              }
              placeholder="e.g., text/markdown"
              className="mt-1 block w-full rounded-md border-gray-300"
            />
          </div>

          <CustomFieldsEditor
            fields={formData.customFields || {}}
            onChange={(customFields) => onChange({ ...formData, customFields })}
          />
        </>
      )}

      {/* Read-only fields for local files */}
      {!isVirtual && <ReadOnlyFileInfo file={file} />}

      {/* Action buttons */}
      <div className="flex justify-end space-x-2 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          {isLoading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
};
```

#### 4.3 Upload Action Filtering

```typescript
// Context-aware action buttons
const FileActions = ({ file }: { file: FileRegistryEntry }) => {
  const canUpload = file.type === "local" && fileExists(file.filePath);
  const canEditMetadata = true; // Both types support this
  const canSync = file.type === "local";

  return (
    <div className="file-actions">
      {canUpload && <UploadButton fileUUID={file.uuid} />}
      {canEditMetadata && <EditMetadataButton fileUUID={file.uuid} />}
      {canSync && <SyncButton fileUUID={file.uuid} />}
      <ViewArweaveUploadsButton fileUUID={file.uuid} />
    </div>
  );
};
```

### Phase 5: Advanced Features

#### 5.1 Batch Operations

```typescript
// Batch operations service
export class BatchOperationService {
  async syncAllLocalFiles(): Promise<BatchResult>;
  async validateAllFiles(): Promise<BatchResult>;
  async bulkUpdateTags(
    uuids: string[],
    tagsUpdate: TagsUpdate
  ): Promise<BatchResult>;
  async bulkUpload(uuids: string[]): Promise<BatchResult>;
}

interface TagsUpdate {
  add?: string[];
  remove?: string[];
  replace?: string[];
}

interface BatchResult {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    uuid: string;
    status: "success" | "error";
    message?: string;
  }>;
}
```

#### 5.2 Import/Export Utilities

```typescript
// Virtual file creation from external sources
export class VirtualFileImporter {
  async importFromArweaveHash(
    hash: string,
    metadata?: Partial<FileRegistryEntry>
  ): Promise<FileRegistryEntry>;
  async importFromURL(
    url: string,
    metadata?: Partial<FileRegistryEntry>
  ): Promise<FileRegistryEntry>;
  async importFromJSON(data: any[]): Promise<FileRegistryEntry[]>;

  async exportVirtualFiles(format: "json" | "csv"): Promise<string>;
}
```

#### 5.3 Validation and Health Checks

```typescript
// Registry health monitoring
export class RegistryHealthService {
  async performHealthCheck(): Promise<HealthReport>;
  async repairInconsistencies(): Promise<RepairReport>;
  async cleanupOrphanedEntries(): Promise<CleanupReport>;
}

interface HealthReport {
  timestamp: string;
  totalFiles: number;
  localFiles: {
    total: number;
    valid: number;
    missing: number;
    outdated: number;
  };
  virtualFiles: {
    total: number;
    valid: number;
    malformed: number;
  };
  issues: HealthIssue[];
}

interface HealthIssue {
  type:
    | "missing_file"
    | "outdated_metadata"
    | "malformed_entry"
    | "duplicate_uuid";
  severity: "warning" | "error";
  description: string;
  affectedUUIDs: string[];
  suggestedAction: string;
}
```

## Migration and Backwards Compatibility

### Data Migration Strategy

1. **Automatic Detection**: Existing entries automatically classified based on filepath patterns
2. **Gradual Migration**: New `type` field added alongside existing `isVirtual` flag
3. **Validation Phase**: Run health checks to ensure all entries are properly classified
4. **Legacy Support**: Continue supporting old patterns while encouraging new structure

### API Compatibility

- All existing API methods remain functional
- New type-specific methods added alongside existing ones
- Deprecation warnings for old patterns without breaking changes
- Migration utilities provided for external integrations

## Testing Strategy

### Unit Tests

- File type detection and classification
- Metadata validation and editing rules
- Upload eligibility checking
- UUID resolution for both types

### Integration Tests

- End-to-end file addition workflows
- Metadata synchronization for local files
- Arweave upload tracking for both types
- Batch operation reliability

### User Acceptance Tests

- Virtual file creation and management
- Local file synchronization accuracy
- Mixed archive browsing and filtering
- Migration from existing archives

## Simplified Implementation Timeline ⚡️

**MAJOR REVISION**: After reviewing the existing architecture, this can be implemented much faster by leveraging existing patterns rather than creating new infrastructure.

### ✅ **Phase 1: Backend Extensions (1-2 days)**

- Add `EditableMetadata` interface to src/types/index.ts
- Add `updateEditableMetadata()` method to DataManager class
- Add `validateForUpload()` method to ArweaveManager class
- Add IPC handler in main.ts and preload API method
- Test backend functionality

### ✅ **Phase 2: Edit Modal Implementation (2-3 days)**

- Add Edit Archive Item modal HTML (reuse existing modal structure)
- Add "Edit" option to archive actions dropdown
- Implement `openEditArchiveItemModal()` in app.js (follows `openEditResourceModal()` pattern)
- Setup tag management (reuse existing tag input system)
- Add form validation and submission handling

### ✅ **Phase 3: Integration & Testing (1-2 days)**

- Connect edit functionality to archive list UI
- Test virtual vs local file type handling
- Add error handling and user feedback
- Final polish and bug fixing

### **Total Implementation Time: 4-7 days** 🚀

**Why So Much Faster?**

- ✅ **Reusing Edit Resource Modal Pattern** - No new modal framework needed
- ✅ **Extending Existing Classes** - No new service layer required
- ✅ **Leveraging Tag System** - Tag management already works for archive items
- ✅ **Using Existing IPC Infrastructure** - Minimal backend additions needed
- ✅ **Building on Virtual File Detection** - `[VIRTUAL]` prefix system already exists

### **Streamlined Critical Path**

```
EditableMetadata Interface (Day 1)
└─> Backend Methods (Day 1)
    └─> IPC Setup (Day 1)
        └─> Edit Modal HTML (Day 2)
            └─> JavaScript Integration (Day 2-3)
                └─> Testing & Polish (Day 4)
```

### **Implementation Priority - REVISED**

1. **Day 1**: Backend infrastructure (types + DataManager + ArweaveManager)
2. **Day 2**: Frontend modal and form structure
3. **Day 3**: JavaScript integration and dropdown connection
4. **Day 4**: Testing, validation, and final polish

**Next Steps**: Focus on Phase 1 backend extensions first, then quickly build the UI using the established Edit Resource modal pattern.

---

## 🎯 **Key Architectural Decisions - REVISED**

### ✅ **What We're NOT Building (Avoided Redundancy)**

- ❌ **New Service Layer** - Extend existing DataManager and ArweaveManager classes
- ❌ **New Modal Framework** - Reuse existing modal system with Edit Resource pattern
- ❌ **New Tag Management** - Archive tag system already works perfectly
- ❌ **New Type System** - Virtual detection via `[VIRTUAL]` prefix already exists
- ❌ **New IPC Infrastructure** - Add one method to existing archive API

### ✅ **What We're Building (Minimal Extensions)**

- ✅ **One Interface** - `EditableMetadata` for form data
- ✅ **Two Methods** - `updateEditableMetadata()` and `validateForUpload()`
- ✅ **One Modal** - Edit Archive Item (copy of Edit Resource)
- ✅ **One Dropdown Option** - "Edit" in existing actions menu
- ✅ **One IPC Handler** - `archive:update-file-metadata`

### 🚀 **Efficiency Gains from Architecture Review**

- **10x faster implementation** (weeks → days)
- **90% code reuse** from existing patterns
- **Zero new dependencies** or frameworks
- **Consistent UX** with existing edit functionality
- **Minimal testing scope** due to pattern reuse

This approach demonstrates how **understanding existing architecture first** leads to much more efficient feature development by building on established foundations rather than creating redundant solutions.

## Success Metrics

1. **Functionality**: Both local and virtual files can be managed effectively
2. **Performance**: No degradation in existing workflows
3. **Usability**: Clear distinction between file types in UI
4. **Reliability**: Robust metadata synchronization for local files
5. **Migration**: Seamless upgrade from existing archives

## Risk Mitigation

1. **Data Loss**: Comprehensive backup and migration testing
2. **Performance Impact**: Careful indexing and caching strategies
3. **User Confusion**: Clear UI indicators and documentation
4. **Compatibility Issues**: Extensive backwards compatibility testing

This implementation plan provides a comprehensive roadmap for introducing virtual/local distinction while maintaining the robust architecture and user experience of the existing Archive tool.
