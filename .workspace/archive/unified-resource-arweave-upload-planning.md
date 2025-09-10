# Unified Resource Arweave Upload Integration Planning

## Overview

This document outlines the implementation plan for adding Arweave upload functionality to the Add Internal Resources tab of the UnifiedResourceManager modal. The goal is to integrate Arweave upload capabilities seamlessly into the existing 3-phase modal workflow, allowing users to upload local files to Arweave and index the resulting hashes similar to how ArchiveManager handles them.

## Current Architecture Analysis

### Existing Components

1. **UnifiedResourceManager** (`src/renderer/modules/UnifiedResourceManager.js`)

   - Manages unified resource lifecycle
   - Has 3-phase modal system: Selection → Metadata → Review
   - Currently only creates local resource entries

2. **UploadManager** (`src/renderer/modules/UploadManager.js`)

   - Handles individual file uploads to Arweave
   - Has upload modal with cost estimation and tag management
   - Integrates with ArweaveManager backend
   - **Key Feature**: Manages Arweave upload tags with key-value pairs

3. **ArweaveManager** (`src/main/arweave-manager.ts`)

   - Backend Arweave operations
   - File upload, cost estimation, transaction status checking
   - UUID resolution and file registry integration
   - **Key Feature**: `prepareUploadTags()` method that combines system tags with user tags

4. **ArchiveManager** (`src/renderer/modules/ArchiveManager.js`)
   - Shows how Arweave hashes are displayed and managed
   - Has collapse/expand functionality for upload history
   - Demonstrates the UI patterns we should follow

### Current Modal Flow

```
Internal Resources Tab:
Phase 1: Select Files → Phase 2: Edit Metadata → Phase 3: Review & Confirm
```

## Proposed Enhancement

### New Modal Flow

```
Internal Resources Tab:
Phase 1: Select Files → Phase 2: Edit Metadata → Phase 3: Arweave Upload → Phase 4: Review & Confirm
```

### Phase 3: Arweave Upload

Add a new phase between metadata editing and review that allows users to:

1. Choose which files to upload to Arweave
2. Configure upload settings (tags, cost estimation)
3. **Manage Arweave upload tags with key-value pairs** (from existing UploadManager)
4. Execute uploads with progress tracking
5. View upload results and transaction IDs

## Implementation Plan

### 1. Modal Structure Updates

#### 1.1 Update Phase Cards

```javascript
// In openAddUnifiedResourceModal()
<div class="modal-tab-phase-cards">
  <div class="modal-tab-phase-card active" data-phase="selection">
    <div class="phase-number">1</div>
    <div class="phase-title">Select Files</div>
  </div>
  <div class="modal-tab-phase-card" data-phase="metadata">
    <div class="phase-number">2</div>
    <div class="phase-title">Edit Metadata</div>
  </div>
  <div class="modal-tab-phase-card" data-phase="arweave">
    <div class="phase-number">3</div>
    <div class="phase-title">Arweave Upload</div>
  </div>
  <div class="modal-tab-phase-card" data-phase="review">
    <div class="phase-number">4</div>
    <div class="phase-title">Review & Confirm</div>
  </div>
</div>
```

#### 1.2 Add Arweave Upload Phase Content

```html
<!-- Phase 3: Arweave Upload (hidden initially) -->
<div
  class="modal-tab-content"
  id="internal-arweave-phase"
  style="display: none;"
>
  <h4>Upload to Arweave</h4>
  <p>Choose which files to upload to Arweave and configure upload settings.</p>

  <div class="arweave-upload-settings">
    <h5>Upload Settings</h5>
    <div class="form-group">
      <label>
        <input type="checkbox" id="enable-arweave-upload" />
        Enable Arweave upload for selected files
      </label>
    </div>
  </div>

  <!-- Arweave Tags Section (based on UploadManager) -->
  <div
    class="arweave-tags-section"
    id="arweave-tags-section"
    style="display: none;"
  >
    <h5>Arweave Upload Tags</h5>
    <p>
      Add custom tags to help categorize and identify your uploads on Arweave.
    </p>

    <div class="tags-input">
      <div class="form-group-inline">
        <input
          type="text"
          id="arweave-tag-key"
          placeholder="Tag key (e.g., title, author, category)"
        />
        <input
          type="text"
          id="arweave-tag-value"
          placeholder="Tag value (e.g., My Document, John Doe, personal)"
        />
        <button type="button" id="add-arweave-tag-btn" class="secondary-btn">
          Add Tag
        </button>
      </div>
    </div>

    <div class="arweave-tags-list" id="arweave-tags-list">
      <p class="no-tags">No tags added yet</p>
    </div>
  </div>

  <div class="file-upload-list" id="file-upload-list">
    <!-- Individual file upload controls will be generated here -->
  </div>

  <div class="upload-summary" id="upload-summary" style="display: none;">
    <h5>Upload Summary</h5>
    <div class="total-cost">
      Total Estimated Cost: <span id="total-cost">0 AR</span>
    </div>
    <div class="upload-progress" id="upload-progress" style="display: none;">
      <div class="progress-bar">
        <div class="progress-fill" id="upload-progress-fill"></div>
      </div>
      <div class="progress-text" id="upload-progress-text">0%</div>
    </div>
  </div>
</div>
```

### 2. State Management Updates

#### 2.1 Extend Modal State

```javascript
this.modalState = {
  activeTab: "internal",
  internal: {
    selectedFiles: [],
    bulkMetadata: {
      title: "",
      description: "",
      tags: [],
    },
    individualMetadata: {},
    arweaveSettings: {
      enabled: false,
      uploadTags: [], // Array of {key, value} objects (from UploadManager pattern)
      selectedFiles: new Set(), // Which files to upload
      uploadResults: [], // Results from uploads
      totalCost: { ar: "0", usd: "0" },
    },
    phase: "selection",
  },
  external: {
    urls: [],
    processingResults: [],
    phase: "input",
  },
};
```

### 3. Arweave Tag Management (Based on UploadManager)

#### 3.1 Add Arweave Tag Methods

```javascript
// Add Arweave upload tag (based on UploadManager.addUploadTag)
addArweaveUploadTag() {
  const keyInput = document.getElementById('arweave-tag-key');
  const valueInput = document.getElementById('arweave-tag-value');

  let key = keyInput.value.trim();
  const value = valueInput.value.trim();

  if (!key || !value) {
    this.showError('Both tag key and value are required');
    return;
  }

  // Clean up tag key - replace spaces with dashes, keep alphanumeric and common chars
  key = key.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');

  if (!key) {
    this.showError('Tag key must contain at least some alphanumeric characters');
    return;
  }

  // Check for duplicate keys
  if (this.modalState.internal.arweaveSettings.uploadTags.some(tag => tag.key === key)) {
    this.showError(`Tag key "${key}" already exists`);
    return;
  }

  this.modalState.internal.arweaveSettings.uploadTags.push({ key, value });

  // Clear inputs
  keyInput.value = '';
  valueInput.value = '';

  this.renderArweaveUploadTags();
}

// Remove Arweave upload tag (based on UploadManager.removeUploadTag)
removeArweaveUploadTag(index) {
  this.modalState.internal.arweaveSettings.uploadTags.splice(index, 1);
  this.renderArweaveUploadTags();
}

// Render Arweave upload tags (based on UploadManager.renderUploadTags)
renderArweaveUploadTags() {
  const tagsContainer = document.getElementById('arweave-tags-list');
  const tags = this.modalState.internal.arweaveSettings.uploadTags;

  if (tags.length === 0) {
    tagsContainer.innerHTML = '<p class="no-tags">No tags added yet</p>';
    return;
  }

  tagsContainer.innerHTML = tags.map((tag, index) => `
    <div class="upload-tag-item">
      <span class="tag-key">${this.escapeHtml(tag.key)}:</span>
      <span class="tag-value">${this.escapeHtml(tag.value)}</span>
      <button type="button" class="remove-tag-btn" data-tag-index="${index}">×</button>
    </div>
  `).join('');

  // Add click events to remove buttons
  tagsContainer.querySelectorAll('.remove-tag-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.tagIndex);
      this.removeArweaveUploadTag(index);
    });
  });
}
```

#### 3.2 Setup Arweave Tag Event Listeners

```javascript
setupArweaveUploadEventListeners() {
  const modal = document.getElementById('unified-resource-modal');
  if (!modal) return;

  // Enable/disable upload checkbox
  const enableUploadCheckbox = modal.querySelector('#enable-arweave-upload');
  if (enableUploadCheckbox) {
    enableUploadCheckbox.addEventListener('change', (e) => {
      this.modalState.internal.arweaveSettings.enabled = e.target.checked;
      this.updateArweaveUploadUI();
    });
  }

  // Arweave tag management (based on UploadManager.setupUploadEvents)
  const addTagBtn = modal.querySelector('#add-arweave-tag-btn');
  if (addTagBtn) {
    addTagBtn.addEventListener('click', () => {
      this.addArweaveUploadTag();
    });
  }

  // Allow Enter key to add tags
  const tagKeyInput = modal.querySelector('#arweave-tag-key');
  const tagValueInput = modal.querySelector('#arweave-tag-value');

  if (tagKeyInput && tagValueInput) {
    [tagKeyInput, tagValueInput].forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.addArweaveUploadTag();
        }
      });
    });
  }

  // Individual file upload checkboxes
  modal.querySelectorAll('.file-upload-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const fileIndex = parseInt(e.target.dataset.fileIndex);
      if (e.target.checked) {
        this.modalState.internal.arweaveSettings.selectedFiles.add(fileIndex);
      } else {
        this.modalState.internal.arweaveSettings.selectedFiles.delete(fileIndex);
      }
      this.updateArweaveUploadSummary();
    });
  });
}
```

#### 3.3 Update Arweave Upload UI

```javascript
updateArweaveUploadUI() {
  const modal = document.getElementById('unified-resource-modal');
  if (!modal) return;

  const tagsSection = modal.querySelector('#arweave-tags-section');
  const fileUploadList = modal.querySelector('#file-upload-list');

  if (this.modalState.internal.arweaveSettings.enabled) {
    tagsSection.style.display = 'block';
    fileUploadList.style.display = 'block';
  } else {
    tagsSection.style.display = 'none';
    fileUploadList.style.display = 'none';
    modal.querySelector('#upload-summary').style.display = 'none';
  }
}
```

### 4. Upload Execution with Tags

#### 4.1 Execute Uploads with Tags

```javascript
async executeArweaveUploads() {
  const modal = document.getElementById('unified-resource-modal');
  if (!modal) return;

  const selectedFiles = this.modalState.internal.arweaveSettings.selectedFiles;
  const files = this.modalState.internal.selectedFiles;
  const uploadTags = this.modalState.internal.arweaveSettings.uploadTags;

  if (selectedFiles.size === 0) {
    this.showError('No files selected for upload');
    return;
  }

  // Convert tags to Arweave format (array of "key:value" strings)
  const arweaveTags = uploadTags.map(tag => `${tag.key}:${tag.value}`);

  // Show progress UI
  modal.querySelector('#upload-progress').style.display = 'block';

  const selectedFileArray = Array.from(selectedFiles);
  let completedUploads = 0;

  for (const fileIndex of selectedFileArray) {
    const file = files[fileIndex];

    try {
      // Update progress
      const progress = ((completedUploads + 1) / selectedFileArray.length) * 100;
      modal.querySelector('#upload-progress-fill').style.width = `${progress}%`;
      modal.querySelector('#upload-progress-text').textContent = `${Math.round(progress)}%`;

      // Update status
      const statusElement = modal.querySelector(`.upload-status[data-file-index="${fileIndex}"]`);
      if (statusElement) {
        statusElement.textContent = 'Uploading...';
      }

      // Execute upload with tags
      const result = await window.electronAPI.archive.uploadFile(file.path, arweaveTags);

      if (result.success) {
        // Store upload result
        this.modalState.internal.arweaveSettings.uploadResults[fileIndex] = {
          success: true,
          transactionId: result.transactionId,
          cost: this.modalState.internal.arweaveSettings.fileCosts[fileIndex],
          tags: arweaveTags // Store the tags used for this upload
        };

        // Update status
        if (statusElement) {
          statusElement.textContent = `Uploaded: ${result.transactionId.substring(0, 8)}...`;
          statusElement.className = 'upload-status success';
        }
      } else {
        // Handle upload failure
        this.modalState.internal.arweaveSettings.uploadResults[fileIndex] = {
          success: false,
          error: result.error
        };

        if (statusElement) {
          statusElement.textContent = `Failed: ${result.error}`;
          statusElement.className = 'upload-status error';
        }
      }

      completedUploads++;

    } catch (error) {
      console.error(`Failed to upload file ${file.name}:`, error);

      this.modalState.internal.arweaveSettings.uploadResults[fileIndex] = {
        success: false,
        error: error.message
      };

      const statusElement = modal.querySelector(`.upload-status[data-file-index="${fileIndex}"]`);
      if (statusElement) {
        statusElement.textContent = `Error: ${error.message}`;
        statusElement.className = 'upload-status error';
      }

      completedUploads++;
    }
  }

  // Hide progress after completion
  setTimeout(() => {
    modal.querySelector('#upload-progress').style.display = 'none';
  }, 2000);
}
```

### 5. Resource Creation with Arweave Data and Tags

#### 5.1 Update addInternalResources Method

```javascript
async addInternalResources() {
  const files = this.modalState.internal.selectedFiles;
  const bulkMetadata = this.modalState.internal.bulkMetadata;
  const arweaveSettings = this.modalState.internal.arweaveSettings;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const resourceId = await this.generateResourceId();
    const contentHash = await this.generateContentHash(file.name);
    const now = new Date().toISOString();

    // Check if this file was uploaded to Arweave
    const arweaveResult = arweaveSettings.uploadResults[i];
    const arweaveHashes = [];

    if (arweaveResult && arweaveResult.success) {
      arweaveHashes.push({
        hash: arweaveResult.transactionId,
        timestamp: now,
        link: `https://www.arweave.net/${arweaveResult.transactionId}`,
        tags: arweaveResult.tags || [] // Include the tags used for upload
      });
    }

    const resource = {
      id: resourceId,
      uri: `urn:meridian:resource:${resourceId}`,
      contentHash: contentHash,
      properties: {
        'dc:title': bulkMetadata.title || file.name,
        'dc:type': 'document',
        'meridian:tags': bulkMetadata.tags || [],
        'meridian:description': bulkMetadata.description || '',
        'meridian:arweave_hashes': arweaveHashes // Add Arweave hashes with tags
      },
      locations: {
        primary: {
          type: 'file-path',
          value: file.path || file.name,
          accessible: true,
          lastVerified: now,
        },
        alternatives: arweaveHashes.map(hash => ({
          type: 'arweave-hash',
          value: hash.hash,
          accessible: true,
          lastVerified: now,
        }))
      },
      state: {
        type: 'internal',
        accessible: true,
        lastVerified: now,
        verificationStatus: 'verified',
      },
      timestamps: {
        created: now,
        modified: now,
        lastAccessed: now,
      },
    };

    await this.addUnifiedResource(resource);
  }
}
```

### 6. Backend Integration with Tag Support

#### 6.1 Extend Unified API for Tags

```typescript
// In src/main/unified-database-manager.ts
export interface ArweaveUploadRecord {
  hash: string;
  timestamp: string;
  link: string;
  tags: string[]; // Array of "key:value" strings
}

export interface UnifiedResource {
  // ... existing properties ...
  properties: {
    // ... existing properties ...
    "meridian:arweave_hashes"?: ArweaveUploadRecord[];
  };
  locations: {
    primary: LocationInfo;
    alternatives: LocationInfo[]; // Include Arweave hashes as alternative locations
  };
}
```

#### 6.2 Add Arweave Upload Methods with Tags

```typescript
// In src/main/unified-database-manager.ts
public async addArweaveUploadToResource(resourceId: string, upload: ArweaveUploadRecord): Promise<void> {
  const resource = await this.getResource(resourceId);
  if (!resource) {
    throw new Error(`Resource with ID ${resourceId} not found`);
  }

  if (!resource.properties['meridian:arweave_hashes']) {
    resource.properties['meridian:arweave_hashes'] = [];
  }

  // Check for duplicate hash
  const existingUpload = resource.properties['meridian:arweave_hashes'].find(u => u.hash === upload.hash);
  if (!existingUpload) {
    resource.properties['meridian:arweave_hashes'].push(upload);

    // Add as alternative location
    resource.locations.alternatives.push({
      type: 'arweave-hash',
      value: upload.hash,
      accessible: true,
      lastVerified: new Date().toISOString(),
    });

    await this.updateResource(resourceId, resource);
  }
}
```

### 7. CSS Styling for Tag Management

#### 7.1 Add Arweave Tag Styles

```css
/* Arweave upload phase styles */
.arweave-upload-settings {
  margin-bottom: 20px;
  padding: 15px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.arweave-tags-section {
  margin-bottom: 20px;
  padding: 15px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.tags-input {
  margin-bottom: 15px;
}

.form-group-inline {
  display: flex;
  gap: 10px;
  align-items: center;
}

.form-group-inline input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.form-group-inline button {
  white-space: nowrap;
}

.arweave-tags-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 10px;
  background: var(--bg-primary);
}

.upload-tag-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  margin-bottom: 4px;
  background: var(--bg-secondary);
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.upload-tag-item:last-child {
  margin-bottom: 0;
}

.tag-key {
  font-weight: 600;
  color: var(--primary-color);
}

.tag-value {
  flex: 1;
  color: var(--text-primary);
}

.remove-tag-btn {
  background: none;
  border: none;
  color: var(--error-color);
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.remove-tag-btn:hover {
  background: var(--error-color);
  color: white;
}

.no-tags {
  color: var(--text-secondary);
  font-style: italic;
  text-align: center;
  margin: 0;
}

.file-upload-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.file-upload-item {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
}

.file-upload-item:last-child {
  border-bottom: none;
}

.file-upload-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.file-upload-header label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.file-upload-details {
  margin-left: 24px;
  font-size: 0.9em;
  color: var(--text-secondary);
}

.upload-status {
  margin-top: 4px;
}

.upload-status.success {
  color: var(--success-color);
}

.upload-status.error {
  color: var(--error-color);
}

.upload-summary {
  margin-top: 20px;
  padding: 15px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.total-cost {
  font-weight: 600;
  margin-bottom: 10px;
}

.upload-progress {
  margin-top: 15px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color);
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  margin-top: 5px;
  font-size: 0.9em;
  color: var(--text-secondary);
}
```

## Implementation Phases

### Phase 1: Modal Structure Updates

1. Update phase cards to include Arweave upload phase
2. Add Arweave upload phase HTML content with tag management
3. Update phase navigation logic
4. Extend modal state management with upload tags

### Phase 2: Arweave Tag Management

1. Implement Arweave tag input UI (based on UploadManager)
2. Add tag validation and management methods
3. Create tag rendering and removal functionality
4. Setup tag event listeners

### Phase 3: Arweave Upload UI

1. Implement file upload list rendering
2. Add cost calculation and display
3. Create upload settings controls
4. Add progress tracking UI

### Phase 4: Upload Execution with Tags

1. Implement cost estimation
2. Add upload execution logic with tag support
3. Handle upload results and errors
4. Update resource creation with Arweave data and tags

### Phase 5: Resource Display

1. Update resource rendering to show Arweave hashes with tags
2. Add Arweave hash collapse/expand functionality
3. Implement hash actions (copy hash, copy URL)
4. Add Arweave hash styling

### Phase 6: Backend Integration

1. Extend unified resource schema with tag support
2. Add Arweave upload methods to backend
3. Update resource creation to include Arweave data and tags
4. Test end-to-end functionality

## Testing Strategy

### Unit Tests

1. Test phase navigation logic
2. Test Arweave tag management (add, remove, validation)
3. Test cost calculation
4. Test upload execution with tags
5. Test resource creation with Arweave data and tags

### Integration Tests

1. Test modal workflow end-to-end with tag management
2. Test Arweave upload integration with tags
3. Test resource display with Arweave hashes and tags
4. Test error handling for tag validation

### User Acceptance Tests

1. Test complete workflow from file selection to resource creation with tags
2. Test tag validation and error messages
3. Test upload cancellation and error recovery
4. Test UI responsiveness and usability
5. Test integration with existing Arweave functionality

## Dependencies

### Frontend Dependencies

- Existing UnifiedResourceManager module
- Existing UploadManager for Arweave operations and tag patterns
- Existing ModalManager for modal handling
- Existing TagAutocomplete component

### Backend Dependencies

- Existing ArweaveManager for upload operations with tag support
- Existing DataManager for resource storage
- Existing unified database schema

### External Dependencies

- Arweave network access
- Arweave wallet configuration
- arkb CLI tool for uploads with tags

## Risk Assessment

### Technical Risks

1. **Arweave upload failures**: Implement proper error handling and retry logic
2. **Tag validation complexity**: Ensure robust tag key validation and formatting
3. **Cost estimation accuracy**: Use conservative estimates and show actual costs
4. **Modal state complexity**: Maintain clear state management patterns
5. **Performance with large files**: Add progress indicators and timeout handling

### User Experience Risks

1. **Complex workflow**: Ensure clear phase progression and help text
2. **Tag management confusion**: Provide clear guidance on tag key-value format
3. **Upload timeouts**: Provide clear feedback and allow cancellation
4. **Cost surprises**: Show detailed cost breakdowns before upload
5. **Error recovery**: Provide clear error messages and recovery options

## Success Criteria

1. **Functional**: Users can successfully upload files to Arweave with custom tags during resource creation
2. **Usable**: The workflow is intuitive and provides clear feedback for tag management
3. **Integrated**: Arweave hashes and tags are properly stored and displayed in unified resources
4. **Reliable**: Upload failures are handled gracefully with proper error recovery
5. **Consistent**: UI patterns match existing UploadManager tag management
6. **Validated**: Tag input follows proper validation rules and formatting

## Future Enhancements

1. **Tag templates**: Save and reuse common tag combinations
2. **Batch upload optimization**: Upload multiple files as a single bundle with shared tags
3. **Upload scheduling**: Allow users to schedule uploads for off-peak times
4. **Tag analytics**: Track tag usage patterns and suggest common tags
5. **Alternative storage**: Support other decentralized storage networks with tag support

## Conclusion

This implementation plan provides a comprehensive approach to integrating Arweave upload functionality with tag management into the UnifiedResourceManager modal workflow. The plan maintains consistency with existing architecture patterns while adding powerful new capabilities for decentralized storage integration with proper metadata tagging.

The phased implementation approach allows for incremental development and testing, reducing risk while ensuring quality. The modular design ensures that the new functionality integrates seamlessly with existing components while maintaining the clean separation of concerns that characterizes the Meridian architecture.

The tag management functionality is based on the proven patterns from UploadManager, ensuring consistency and reliability while providing users with the same powerful tagging capabilities they're already familiar with in the Archive tab.
