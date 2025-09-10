# Collate-Archive Panel Synthesis: Scoping Document

## Executive Summary

This document analyzes the current functionality of Meridian's Collate and Archive panels and proposes approaches to synthesize them into a unified indexing tool that can handle both web resources (URLs) and local file uploads.

## Current State Analysis

### Collate Panel Functionality

**Core Purpose**: Web resource management and curation

- **Data Model**: Resources with URL, title, description, tags, metadata
- **Key Features**:
  - Add web resources via URL input
  - Bulk URL import with metadata extraction
  - Tag-based organization and filtering
  - Export functionality (various formats)
  - Collapse/expand resource details
  - Search and filter capabilities
  - Tag autocomplete and management

**Technical Implementation**:

- Managed by `ResourceManager` module
- Data stored in `.meridian/collate.json`
- Metadata extraction from web pages
- Tag-based filtering with AND/OR logic
- Export to various formats (JSON, CSV, etc.)

### Archive Panel Functionality

**Core Purpose**: Local file management and Arweave uploads

- **Data Model**: Files with UUID, filePath, metadata, Arweave uploads
- **Key Features**:
  - Local file upload and management
  - Arweave blockchain uploads
  - File metadata extraction and editing
  - UUID-based file identification
  - Tag-based organization
  - File status tracking (virtual vs physical)
  - Upload history and transaction tracking
  - Wallet management for Arweave

**Technical Implementation**:

- Managed by `ArchiveManager` module
- Data stored in `.meridian/archive.json`
- UUID resolution from multiple sources (frontmatter, xattr, registry)
- Arweave integration via arkb CLI
- File registry for deduplication
- Multi-account wallet management

## Synthesis Opportunities

### 1. Unified Data Model

**Proposed Unified Resource Model**:

```typescript
interface UnifiedResource {
  id: string; // Unique identifier
  type: "web" | "file" | "upload"; // Resource type
  title: string;
  description?: string;
  tags: string[];
  metadata: {
    author?: string;
    created?: string;
    modified?: string;
    size?: number;
    mimeType?: string;
    // Web-specific
    url?: string;
    imageUrl?: string;
    // File-specific
    filePath?: string;
    uuid?: string;
    // Upload-specific
    arweaveHashes?: ArweaveUploadRecord[];
  };
  createdAt: string;
  modifiedAt: string;
}
```

### 2. Unified Indexing Interface

**Proposed UI Structure**:

```
┌─────────────────────────────────────────────────────────────┐
│ [Index] Panel Header                                        │
├─────────────────────────────────────────────────────────────┤
│ Add Resource: [URL] [Upload File] [Bulk Import] [Export]   │
├─────────────────────────────────────────────────────────────┤
│ Resource List (Unified)                                     │
│ ├─ Web Resource: "Article Title" (example.com) [tags]      │
│ ├─ Local File: "document.pdf" (2.3MB) [tags]              │
│ └─ Uploaded: "image.jpg" (Arweave: abc123...) [tags]       │
├─────────────────────────────────────────────────────────────┤
│ Tag Filters Sidebar                                         │
└─────────────────────────────────────────────────────────────┘
```

### 3. Synthesis Approaches

#### Approach A: Gradual Integration (Recommended)

**Phase 1: Shared Infrastructure**

- Create unified `IndexManager` module
- Implement shared tag management system
- Unify filtering and search capabilities
- Create common resource rendering components

**Phase 2: Data Model Convergence**

- Extend existing data models to support both types
- Implement resource type detection and conversion
- Create unified storage layer

**Phase 3: UI Unification**

- Merge panel interfaces
- Implement unified resource actions
- Create type-specific action menus

**Phase 4: Advanced Features**

- Cross-type tagging and relationships
- Unified export capabilities
- Advanced search across all resource types

#### Approach B: Complete Rewrite

**Pros**:

- Clean slate for optimal design
- No legacy code constraints
- Unified architecture from start

**Cons**:

- High development effort
- Risk of losing existing functionality
- Longer time to market

#### Approach C: Hybrid Approach

**Core Strategy**:

- Keep existing panels as "legacy mode"
- Build new unified interface alongside
- Gradual migration with toggle option
- Eventual deprecation of separate panels

## Technical Implementation Plan

### 1. Unified Manager Architecture

```typescript
class IndexManager extends ModuleBase {
  // Unified resource management
  async addResource(
    resourceData: UnifiedResourceInput
  ): Promise<UnifiedResource>;
  async updateResource(
    id: string,
    updates: Partial<UnifiedResource>
  ): Promise<void>;
  async removeResource(id: string): Promise<void>;

  // Type-specific operations
  async addWebResource(url: string, metadata?: any): Promise<UnifiedResource>;
  async addLocalFile(
    filePath: string,
    metadata?: any
  ): Promise<UnifiedResource>;
  async uploadToArweave(resourceId: string): Promise<ArweaveUploadRecord>;

  // Unified operations
  async searchResources(
    query: string,
    filters?: SearchFilters
  ): Promise<UnifiedResource[]>;
  async exportResources(
    format: ExportFormat,
    filters?: ExportFilters
  ): Promise<void>;
  async manageTags(resourceId: string, tags: string[]): Promise<void>;
}
```

### 2. Data Storage Strategy

**Option 1: Single File**

```json
{
  "resources": [
    {
      "id": "web_123",
      "type": "web",
      "url": "https://example.com",
      "title": "Example Article",
      "tags": ["article", "web"],
      "metadata": { ... }
    },
    {
      "id": "file_456",
      "type": "file",
      "filePath": "/path/to/file.pdf",
      "title": "Document",
      "tags": ["document", "pdf"],
      "metadata": { ... }
    }
  ],
  "tags": { "article": 1, "web": 1, "document": 1, "pdf": 1 },
  "settings": { ... }
}
```

**Option 2: Separate Files with Unified Index**

- Keep existing `collate.json` and `archive.json`
- Create new `index.json` with unified references
- Implement sync mechanisms between files

### 3. UI Component Architecture

```typescript
// Unified resource list component
class UnifiedResourceList {
  renderResource(resource: UnifiedResource): HTMLElement;
  renderResourceActions(resource: UnifiedResource): HTMLElement;
  renderResourceMetadata(resource: UnifiedResource): HTMLElement;
}

// Type-specific action menus
class ResourceActionMenu {
  getActions(resource: UnifiedResource): Action[];
  executeAction(action: Action, resource: UnifiedResource): Promise<void>;
}
```

## Migration Strategy

### 1. Data Migration

**Step 1: Create Migration Script**

```typescript
async function migrateExistingData() {
  // Migrate collate resources
  const collateData = await loadCollateData();
  for (const resource of collateData.resources) {
    await addUnifiedResource({
      type: 'web',
      url: resource.url,
      title: resource.title,
      description: resource.description,
      tags: resource.tags,
      metadata: { ... }
    });
  }

  // Migrate archive files
  const archiveData = await loadArchiveData();
  for (const file of archiveData.files) {
    await addUnifiedResource({
      type: 'file',
      filePath: file.filePath,
      title: file.title,
      tags: file.tags,
      metadata: { ... }
    });
  }
}
```

**Step 2: Backward Compatibility**

- Maintain existing API endpoints during transition
- Implement data sync between old and new formats
- Provide migration status indicators

### 2. Feature Parity

**Collate Features to Preserve**:

- Bulk URL import
- Metadata extraction from web pages
- Export functionality
- Tag autocomplete

**Archive Features to Preserve**:

- File upload and management
- Arweave integration
- UUID resolution
- Upload history tracking

**New Unified Features**:

- Cross-type search and filtering
- Unified tagging system
- Resource relationships
- Advanced export options

## Implementation Timeline

### Phase 1: Foundation (2-3 weeks)

- [ ] Create `IndexManager` module
- [ ] Design unified data model
- [ ] Implement basic resource CRUD operations
- [ ] Create unified storage layer

### Phase 2: Core Features (3-4 weeks)

- [ ] Implement unified resource rendering
- [ ] Create type-specific action menus
- [ ] Implement unified search and filtering
- [ ] Add tag management system

### Phase 3: Advanced Features (2-3 weeks)

- [ ] Implement cross-type relationships
- [ ] Add unified export functionality
- [ ] Create migration tools
- [ ] Add backward compatibility layer

### Phase 4: UI Integration (2-3 weeks)

- [ ] Create unified panel interface
- [ ] Implement resource type indicators
- [ ] Add unified action buttons
- [ ] Create settings for panel preferences

### Phase 5: Testing & Polish (1-2 weeks)

- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] User documentation
- [ ] Migration guide

## Risk Assessment

### Technical Risks

- **Data Migration Complexity**: Existing data structures may be incompatible
- **Performance Impact**: Unified system may be slower than specialized panels
- **Feature Loss**: Risk of losing specific functionality during unification

### Mitigation Strategies

- **Incremental Migration**: Implement changes gradually with rollback options
- **Performance Testing**: Benchmark unified system against existing panels
- **Feature Preservation**: Maintain all existing functionality during transition

### User Experience Risks

- **Learning Curve**: Users may need to adapt to new interface
- **Workflow Disruption**: Existing workflows may be affected

### Mitigation Strategies

- **Legacy Mode**: Keep existing panels available during transition
- **User Training**: Provide documentation and tutorials
- **Feedback Loops**: Gather user feedback throughout development

## Success Metrics

### Technical Metrics

- [ ] All existing functionality preserved
- [ ] Performance maintained or improved
- [ ] Zero data loss during migration
- [ ] Successful backward compatibility

### User Experience Metrics

- [ ] Reduced cognitive load (fewer panels to manage)
- [ ] Improved resource discovery (unified search)
- [ ] Increased tagging consistency
- [ ] Positive user feedback

### Business Metrics

- [ ] Reduced maintenance overhead
- [ ] Improved feature development velocity
- [ ] Enhanced user engagement
- [ ] Simplified onboarding process

## Conclusion

The synthesis of Collate and Archive panels into a unified indexing tool presents significant opportunities for improving user experience and reducing complexity. The recommended gradual integration approach minimizes risk while maximizing the benefits of unification.

Key recommendations:

1. **Start with shared infrastructure** to establish foundation
2. **Maintain backward compatibility** throughout transition
3. **Preserve all existing functionality** during migration
4. **Implement unified features incrementally**
5. **Provide clear migration path** for users

This synthesis will create a more powerful and intuitive resource management system while maintaining the specialized capabilities that users currently rely on.
