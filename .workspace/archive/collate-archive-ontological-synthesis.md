# Ontological Synthesis: URL-Based Unified Index

## Executive Summary

This document explores the ontological synthesis of Meridian's Collate and Archive panels through a unified URL-based addressing system. The goal is to create a coherent knowledge management framework where all resources (web pages, local files, and uploaded content) can be treated as addressable entities through consistent URL-based identifiers, following semantic web best practices.

## Current Meridian Architecture Integration

### Existing Modular Architecture Analysis

Meridian uses a well-structured modular architecture that must be considered in this synthesis:

#### Module System

- **ModuleBase**: Abstract base class providing common functionality (event system, module access, utilities)
- **ModuleLoader**: Centralized module lifecycle management with dependency ordering
- **Specialized Managers**: ResourceManager, ArchiveManager, TagManager, ModalManager, UploadManager
- **Event System**: Inter-module communication via EventTarget

#### Current Resource Management

- **ResourceManager**: Handles web resources (URLs) with metadata extraction, tag management, collapse state
- **ArchiveManager**: Handles local files with Arweave upload capabilities, file operations, metadata
- **TagManager**: Centralized tag management across both systems
- **ModalManager**: UI modal management for forms and dialogs
- **UploadManager**: Arweave upload functionality

#### Current Data Models

**ResourceManager (Collate)**

```typescript
interface CollateResource {
  id: string; // Time-based hash
  url: string; // HTTP/HTTPS URL
  title: string; // Extracted or manual title
  description?: string; // Extracted or manual description
  tags: string[]; // User-defined tags
  createdAt: string; // Creation timestamp
  modifiedAt: string; // Last modification timestamp
}
```

**ArchiveManager (Archive)**

```typescript
interface ArchiveFile {
  uuid: string; // UUID v4 or content-based deterministic UUID
  filePath: string; // Local file path
  title: string; // File title
  fileSize: number; // File size in bytes
  mimeType: string; // MIME type
  tags: string[]; // User-defined tags
  metadata: {
    // Extracted metadata
    author?: string;
    // ... other metadata
  };
  arweaveHashes: {
    // Arweave upload records
    hash: string;
    link: string;
    timestamp: string;
  }[];
  created: string; // Creation timestamp
  modified: string; // Last modification timestamp
}
```

### Integration Strategy

Instead of replacing existing modules, the ontological synthesis should:

1. **Create a new UnifiedResourceManager** that extends ModuleBase
2. **Integrate with existing services** (TagManager, ModalManager, UploadManager)
3. **Maintain backward compatibility** with existing data and workflows
4. **Follow established patterns** for module initialization, event handling, and UI rendering

#### Proposed UnifiedResourceManager Integration

```typescript
import { ModuleBase } from "./ModuleBase.js";

/**
 * UnifiedResourceManager - Handles semantic web-compliant resource management
 * Integrates web resources and local files under unified ontological framework
 */
export class UnifiedResourceManager extends ModuleBase {
  constructor(app) {
    super(app);

    // Unified resource state management
    this.unifiedResources = new Map(); // UUID -> SemanticResource
    this.resourceCollapseState = {
      globalState: "expanded",
      collapsedItems: new Set(),
    };

    // Filter state
    this.activeTagFilters = new Set();
    this.currentSearchTerm = "";
    this.filterLogic = "any";
  }

  async onInit() {
    console.log("[UnifiedResourceManager] Initializing...");

    // Set up event listeners
    this.setupUnifiedResourceEventListeners();

    // Initialize from existing data
    await this.migrateExistingData();

    // Initialize collapse state
    this.initializeCollapseState();

    console.log("[UnifiedResourceManager] Initialized successfully");
  }

  async onCleanup() {
    console.log("[UnifiedResourceManager] Cleaning up...");

    // Save collapse state
    this.saveCollapseState();

    console.log("[UnifiedResourceManager] Cleaned up successfully");
  }

  /**
   * Migrate existing collate and archive data to unified format
   */
  async migrateExistingData() {
    // Get existing data from app
    const collateData = this.getData().collate;
    const archiveData = this.getData().archive;

    // Migrate collate resources
    if (collateData?.resources) {
      for (const resource of collateData.resources) {
        const semanticResource = await this.migrateCollateResource(resource);
        this.unifiedResources.set(semanticResource.id, semanticResource);
      }
    }

    // Migrate archive files
    if (archiveData?.files) {
      for (const file of archiveData.files) {
        const semanticResource = await this.migrateArchiveFile(file);
        this.unifiedResources.set(semanticResource.id, semanticResource);
      }
    }

    console.log(
      `[UnifiedResourceManager] Migrated ${this.unifiedResources.size} resources`
    );
  }

  /**
   * Use existing TagManager for tag operations
   */
  async addTagToUnifiedResource(resourceId: string, tagValue: string) {
    const tagManager = this.getModule("tagManager");
    if (tagManager) {
      // Use existing tag manager logic
      await tagManager.addTagToUnifiedResource(resourceId, tagValue);
    }
  }

  /**
   * Use existing UploadManager for Arweave operations
   */
  async uploadToArweave(content: string, tags: string[]) {
    const uploadManager = this.getModule("uploadManager");
    if (uploadManager) {
      return await uploadManager.uploadToArweave(content, tags);
    }
  }

  /**
   * Use existing ModalManager for UI operations
   */
  openEditUnifiedResourceModal(resourceId: string) {
    const modalManager = this.getModule("modalManager");
    if (modalManager) {
      modalManager.openModal("edit-unified-resource-modal");
      // Populate modal with resource data
    }
  }

  // ... additional methods following ModuleBase patterns
}
```

#### ModuleLoader Integration

```typescript
// In ModuleLoader.js - add to loadAllModules()
async loadAllModules() {
  // ... existing imports ...
  const { UnifiedResourceManager } = await import('./UnifiedResourceManager.js');

  // ... existing module registrations ...

  // UnifiedResourceManager depends on TagManager and UploadManager
  await this.registerModule('unifiedResourceManager', UnifiedResourceManager);
}
```

### Migration Strategy

#### Phase 1: Parallel Development

- Keep existing ResourceManager and ArchiveManager functional
- Develop UnifiedResourceManager alongside existing modules
- Implement data synchronization between old and new systems

#### Phase 2: Gradual Migration

- Add unified resource tab/panel to UI
- Provide migration tools for users to move data
- Maintain feature parity during transition

#### Phase 3: Consolidation

- Once unified system is stable, gradually deprecate old panels
- Migrate remaining users and data
- Remove old modules after full migration

### Backward Compatibility

The synthesis must maintain:

1. **Existing API compatibility** - Current IPC calls should continue working
2. **Data format compatibility** - Existing data should be readable
3. **UI pattern consistency** - New interface should follow existing patterns
4. **Feature parity** - All current functionality should be available

### UI Styling Requirements

The unified resource index should use the same styling as the current archive items, with the addition of description display:

#### Archive-Item Based Styling

- **Container**: Use `archive-item` class for consistent styling
- **Header**: Use `archive-header` with `archive-info` and `archive-actions`
- **Title**: Use `archive-title` class for resource titles
- **Path/Location**: Use `archive-path` with status indicators
- **Description**: Add `archive-description` class for resource descriptions (new addition)
- **Metadata**: Use `archive-metadata` with `archive-metadata-item` structure
- **Actions**: Use `archive-actions` with dropdown menus
- **Tags**: Use `archive-tags` with `archive-tag-input` and `archive-tag` classes
- **Arweave Hashes**: Use `archive-arweave-hashes` for upload history

#### Description Integration

```typescript
// In the renderUnifiedResources method
${resource.properties["meridian:description"] ? `
  <p class="archive-description">${this.escapeHtml(resource.properties["meridian:description"])}</p>
` : ''}
```

#### Status Indicators

- **Virtual**: For web URLs (http-url type)
- **Physical**: For local file paths (file-path type)
- **Arweave**: For Arweave URLs (arweave-url type)

#### Example Unified Resource Item Structure

```html
<div class="archive-item" data-id="${resource.id}">
  <div class="archive-header">
    <div class="archive-info">
      <h4 class="archive-title">${resource.properties["dc:title"]}</h4>
      <div class="archive-path">
        <span class="file-status-indicator ${resourceStatus}"></span>
        ${resource.locations.primary.value}
      </div>
      <!-- Description from collate resources -->
      ${resource.properties["meridian:description"] ? `
      <p class="archive-description">
        ${resource.properties["meridian:description"]}
      </p>
      ` : ''}
      <div class="archive-metadata">
        <!-- Type, State, Modified timestamps -->
      </div>
    </div>
    <div class="archive-actions">
      <!-- Locate, Collapse, Actions dropdown -->
    </div>
  </div>

  <!-- Arweave uploads section -->
  <div class="archive-arweave-hashes">
    <!-- Upload history -->
  </div>

  <!-- Tags section -->
  <div class="archive-tags">
    <!-- Tag input and existing tags -->
  </div>
</div>
```

## Current Identifier Systems Analysis

### Collate Panel Identifiers

- **Resource ID**: Time-based hash (`Date.now().toString(36) + Math.random().toString(36).substr(2)`)
- **Primary Address**: HTTP/HTTPS URLs (e.g., `https://example.com/article`)
- **Deduplication**: URL-based uniqueness check
- **Metadata**: Extracted from web page content

### Archive Panel Identifiers

- **File UUID**: UUID v4 or content-based deterministic UUID
- **Primary Address**: Local file paths (e.g., `/path/to/document.pdf`)
- **Secondary Address**: Arweave URLs after upload (e.g., `https://arweave.net/abc123...`)
- **Deduplication**: Content-based hash for deterministic UUIDs

## Ontological Synthesis: Semantic Web Compliant Approach

### Core Ontological Principle

**All resources are addressable through URLs, whether they originate as web resources, local files, or uploaded content, while maintaining proper separation between identity (what it is) and location (where to find it).**

### Internal/External Distinction with Universal Arweave Capability

**Key Insight**: All resources can be categorized as either **internal** (having a local file path within the workspace) or **external** (existing only as URLs outside the workspace), but **all resources can be uploaded to Arweave** to create persistent, self-contained versions.

#### Resource Categories

```typescript
interface SemanticResource {
  // Identity (what it is - never changes)
  id: string; // UUID v4: "550e8400-e29b-41d4-a716-446655440000"
  uri: string; // "urn:meridian:resource:550e8400-e29b-41d4-a716-446655440000"
  contentHash: string; // SHA-256 of content

  // Properties (RDF-like metadata)
  properties: {
    "dc:title": string;
    "dc:creator"?: string;
    "dc:type": "web-page" | "document" | "image" | "archive";
    "dc:language"?: string;
    "dc:format"?: string;
    "meridian:tags": string[];
    "meridian:description"?: string;
  };

  // Location management (where to find it - can change)
  locations: {
    primary: ResourceLocation; // Best current access method
    alternatives: ResourceLocation[]; // Backup access methods
  };

  // Provenance chain (where it came from)
  provenance: ProvenanceRecord[];

  // Current state
  state: ResourceState;

  // Timestamps
  timestamps: {
    created: string;
    modified: string;
    lastAccessed: string;
  };
}

interface ResourceLocation {
  type: "http-url" | "file-path" | "arweave-url" | "urn";
  value: string;
  accessible: boolean;
  lastVerified: string;
  metadata?: {
    size?: number;
    mimeType?: string;
    encoding?: string;
  };
}

interface ProvenanceRecord {
  timestamp: string;
  action: "created" | "moved" | "uploaded" | "packaged" | "downloaded";
  fromLocation?: ResourceLocation;
  toLocation?: ResourceLocation;
  method:
    | "web-scrape"
    | "file-upload"
    | "arweave-upload"
    | "html-packaging"
    | "manual-entry";
  metadata?: Record<string, any>;
}

interface ResourceState {
  type: "external" | "internal" | "arweave" | "hybrid";
  accessible: boolean;
  lastVerified: string;
  verificationStatus: "verified" | "failed" | "pending" | "unknown";
}
```

### Identity vs. Location Distinction

#### **Identity (Stable)**

- **UUID v4**: Globally unique identifier that never changes
- **URI**: Semantic identifier following URN format
- **Content Hash**: SHA-256 hash of content for deduplication

#### **Location (Flexible)**

- **Primary Location**: Best current access method
- **Alternative Locations**: Backup access methods
- **Location History**: Preserved in provenance chain

#### **Example: Identity vs. Location**

```typescript
// External resource with changing location
const resource: SemanticResource = {
  // Identity (never changes)
  id: "550e8400-e29b-41d4-a716-446655440000",
  uri: "urn:meridian:resource:550e8400-e29b-41d4-a716-446655440000",
  contentHash: "sha256:def456789...",

  // Location (can change)
  locations: {
    primary: {
      type: "http-url",
      value: "https://example.com/new-location/article", // Changed!
      accessible: true,
      lastVerified: "2024-01-16T14:20:00Z",
    },
    alternatives: [
      {
        type: "http-url",
        value: "https://example.com/article", // Old location
        accessible: false,
        lastVerified: "2024-01-16T14:20:00Z",
      },
    ],
  },
};
```

### Universal Arweave Upload Strategy

#### 1. Internal Files → Arweave

- **Process**: Direct upload of internal file content
- **Result**: Permanent Arweave URL with original file metadata
- **Benefits**: Content persistence, global accessibility

#### 2. External Resources → Self-Contained HTML → Arweave

- **Process**:
  1. Fetch web page content
  2. Package as self-contained HTML (inline CSS, JS, images)
  3. Upload to Arweave
- **Result**: Permanent, self-contained version of external resource
- **Benefits**: Content preservation, offline access, link rot prevention

#### 3. External Resources → Arweave

- **Process**: Convert external references to actual content on Arweave
- **Result**: External resources become permanently accessible
- **Benefits**: Eliminates dependency on original sources

## Web Resource Packaging Strategy

### Self-Contained HTML Generation

```typescript
class ExternalResourcePackager {
  /**
   * Convert external resource to self-contained HTML file
   */
  async packageExternalResource(
    url: string
  ): Promise<PackagedExternalResource> {
    // 1. Fetch the web page
    const pageContent = await this.fetchWebPage(url);

    // 2. Extract and inline all resources
    const selfContainedHtml = await this.createSelfContainedHtml(pageContent);

    // 3. Generate metadata
    const metadata = {
      originalUrl: url,
      packagedAt: new Date().toISOString(),
      contentHash: await this.generateContentHash(selfContainedHtml),
      size: Buffer.byteLength(selfContainedHtml, "utf8"),
    };

    return {
      html: selfContainedHtml,
      metadata,
      filename: this.generateFilename(url),
    };
  }

  /**
   * Create self-contained HTML with all resources inlined
   */
  private async createSelfContainedHtml(
    pageContent: WebPageContent
  ): Promise<string> {
    let html = pageContent.html;

    // Inline CSS
    html = await this.inlineStylesheets(html, pageContent.baseUrl);

    // Inline JavaScript
    html = await this.inlineScripts(html, pageContent.baseUrl);

    // Inline images (convert to base64)
    html = await this.inlineImages(html, pageContent.baseUrl);

    // Inline fonts
    html = await this.inlineFonts(html, pageContent.baseUrl);

    // Add metadata and packaging info
    html = this.addPackagingMetadata(html, pageContent);

    return html;
  }

  /**
   * Inline external stylesheets
   */
  private async inlineStylesheets(
    html: string,
    baseUrl: string
  ): Promise<string> {
    const cssRegex =
      /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;

    return html.replace(cssRegex, async (match, cssUrl) => {
      try {
        const absoluteUrl = new URL(cssUrl, baseUrl).href;
        const cssContent = await this.fetchResource(absoluteUrl);
        return `<style>${cssContent}</style>`;
      } catch (error) {
        console.warn(`Failed to inline CSS: ${cssUrl}`, error);
        return match; // Keep original link if inlining fails
      }
    });
  }

  /**
   * Inline external images as base64
   */
  private async inlineImages(html: string, baseUrl: string): Promise<string> {
    const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;

    return html.replace(imgRegex, async (match, imgUrl) => {
      try {
        const absoluteUrl = new URL(imgUrl, baseUrl).href;
        const imageBuffer = await this.fetchImage(absoluteUrl);
        const base64 = imageBuffer.toString("base64");
        const mimeType = this.detectMimeType(imageBuffer);

        return match.replace(imgUrl, `data:${mimeType};base64,${base64}`);
      } catch (error) {
        console.warn(`Failed to inline image: ${imgUrl}`, error);
        return match; // Keep original src if inlining fails
      }
    });
  }
}
```

### Resource Lifecycle Management

```typescript
class ResourceLifecycleManager {
  /**
   * Manage resource transitions between external, internal, and Arweave states
   */
  async manageResourceLifecycle(resource: SemanticResource): Promise<void> {
    switch (resource.state.type) {
      case "external":
        await this.handleExternalResource(resource);
        break;
      case "internal":
        await this.handleInternalResource(resource);
        break;
      case "arweave":
        await this.handleArweaveResource(resource);
        break;
    }
  }

  /**
   * Handle external resources (web URLs without internal copies)
   */
  private async handleExternalResource(
    resource: SemanticResource
  ): Promise<void> {
    // Option 1: Package and upload to Arweave
    if (resource.locations.primary.type === "http-url") {
      const packaged = await this.packager.packageWebResource(
        resource.locations.primary.value
      );
      const arweaveUrl = await this.uploadToArweave(
        packaged.html,
        resource.properties["meridian:tags"]
      );

      // Add Arweave location
      resource.locations.alternatives.push({
        type: "arweave-url",
        value: arweaveUrl,
        accessible: true,
        lastVerified: new Date().toISOString(),
      });

      // Update provenance
      resource.provenance.push({
        timestamp: new Date().toISOString(),
        action: "uploaded",
        fromLocation: resource.locations.primary,
        toLocation:
          resource.locations.alternatives[
            resource.locations.alternatives.length - 1
          ],
        method: "html-packaging",
      });
    }
  }

  /**
   * Handle internal resources (files within workspace)
   */
  private async handleInternalResource(
    resource: SemanticResource
  ): Promise<void> {
    // Upload to Arweave if not already uploaded
    if (resource.locations.alternatives.length === 0) {
      const arweaveUrl = await this.uploadLocalFile(
        resource.locations.primary.value,
        resource.properties["meridian:tags"]
      );
      resource.locations.alternatives.push({
        type: "arweave-url",
        value: arweaveUrl,
        accessible: true,
        lastVerified: new Date().toISOString(),
      });
    }
  }

  /**
   * Handle Arweave resources (already uploaded)
   */
  private async handleArweaveResource(
    resource: SemanticResource
  ): Promise<void> {
    // Verify Arweave uploads are still accessible
    await this.verifyArweaveUploads(resource.locations.alternatives);

    // Optionally download to internal for offline access
    if (
      !resource.locations.primary.value &&
      resource.locations.alternatives.length > 0
    ) {
      const internalPath = await this.downloadFromArweave(
        resource.locations.alternatives[0].value
      );
      resource.locations.primary.value = internalPath;
    }
  }
}
```

## Enhanced Unified Resource Model

### Complete Resource Ontology

```typescript
interface SemanticResource {
  // Identity (what it is)
  id: string; // UUID v4
  uri: string; // Semantic URI
  contentHash: string; // Content-based identity

  // Properties (RDF-like metadata)
  properties: {
    "dc:title": string;
    "dc:creator"?: string;
    "dc:type": "web-page" | "document" | "image" | "archive";
    "dc:language"?: string;
    "dc:format"?: string;
    "meridian:tags": string[];
    "meridian:description"?: string;
  };

  // Location management (where to find it)
  locations: {
    primary: ResourceLocation; // Best current access method
    alternatives: ResourceLocation[]; // Backup access methods
  };

  // Provenance chain (where it came from)
  provenance: ProvenanceRecord[];

  // Current state
  state: ResourceState;

  // Timestamps
  timestamps: {
    created: string;
    modified: string;
    lastAccessed: string;
  };
}
```

### Resource State Transitions

```typescript
enum ResourceState {
  EXTERNAL_WEB = "external-web", // Web URL only
  EXTERNAL_PACKAGED = "external-packaged", // Web URL + Arweave package
  INTERNAL_FILE = "internal-file", // Internal file only
  INTERNAL_UPLOADED = "internal-uploaded", // Internal file + Arweave upload
  ARWEAVE_ONLY = "arweave-only", // Arweave upload only
  ARWEAVE_INTERNAL = "arweave-internal", // Arweave upload + internal copy
}

class ResourceStateManager {
  /**
   * Get current state of resource
   */
  getResourceState(resource: SemanticResource): ResourceState {
    const hasInternal =
      resource.locations.alternatives.some((loc) => loc.type === "file-path") ||
      resource.locations.primary.type === "file-path";
    const hasArweave =
      resource.locations.alternatives.some(
        (loc) => loc.type === "arweave-url"
      ) || resource.locations.primary.type === "arweave-url";
    const isWeb = resource.locations.primary.type === "http-url";

    if (isWeb && !hasInternal && !hasArweave) return ResourceState.EXTERNAL_WEB;
    if (isWeb && !hasInternal && hasArweave)
      return ResourceState.EXTERNAL_PACKAGED;
    if (!isWeb && hasInternal && !hasArweave)
      return ResourceState.INTERNAL_FILE;
    if (!isWeb && hasInternal && hasArweave)
      return ResourceState.INTERNAL_UPLOADED;
    if (!hasInternal && hasArweave) return ResourceState.ARWEAVE_ONLY;
    if (hasInternal && hasArweave) return ResourceState.ARWEAVE_INTERNAL;

    return ResourceState.EXTERNAL_WEB; // Default fallback
  }
}
```

## Implementation Architecture

### 1. UUID v4 ID Generator

```typescript
class ResourceIdGenerator {
  /**
   * Generate UUID v4 for resource ID
   */
  generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate URI from UUID
   */
  generateUri(uuid: string): string {
    return `urn:meridian:resource:${uuid}`;
  }

  /**
   * Generate complete resource identity
   */
  generateResourceIdentity(): { id: string; uri: string } {
    const id = this.generateId();
    const uri = this.generateUri(id);

    return { id, uri };
  }
}
```

### 2. Resource Creation Service

```typescript
class ResourceCreationService {
  /**
   * Create external resource (starts as external)
   */
  async createExternalResource(
    url: string,
    metadata?: Partial<ResourceProperties>
  ): Promise<SemanticResource> {
    const idGenerator = new ResourceIdGenerator();
    const { id, uri } = idGenerator.generateResourceIdentity();

    // Fetch and hash content
    const content = await this.fetchWebContent(url);
    const contentHash = await this.generateContentHash(content);

    // Check for existing content
    const existing = await this.findByContentHash(contentHash);
    if (existing) {
      return this.handleDuplicateContent(existing, url, metadata);
    }

    const resource: SemanticResource = {
      id,
      uri,
      contentHash,
      properties: {
        "dc:title": metadata?.title || (await this.extractTitle(content)),
        "dc:type": "web-page",
        "meridian:tags": metadata?.tags || [],
        "meridian:description":
          metadata?.description || (await this.extractDescription(content)),
        ...metadata,
      },
      locations: {
        primary: {
          type: "http-url",
          value: url,
          accessible: true,
          lastVerified: new Date().toISOString(),
        },
        alternatives: [],
      },
      provenance: [
        {
          timestamp: new Date().toISOString(),
          action: "created",
          method: "web-scrape",
          toLocation: {
            type: "http-url",
            value: url,
            accessible: true,
            lastVerified: new Date().toISOString(),
          },
        },
      ],
      state: {
        type: "virtual",
        accessible: true,
        lastVerified: new Date().toISOString(),
        verificationStatus: "verified",
      },
      timestamps: {
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
      },
    };

    await this.saveResource(resource);
    return resource;
  }

  /**
   * Create internal file resource
   */
  async createInternalResource(
    filePath: string,
    metadata?: Partial<ResourceProperties>
  ): Promise<SemanticResource> {
    const idGenerator = new ResourceIdGenerator();
    const { id, uri } = idGenerator.generateResourceIdentity();

    // Read and hash file
    const content = await fs.readFile(filePath);
    const contentHash = await this.generateContentHash(content);

    // Check for existing content
    const existing = await this.findByContentHash(contentHash);
    if (existing) {
      return this.handleDuplicateContent(existing, filePath, metadata);
    }

    const resource: SemanticResource = {
      id,
      uri,
      contentHash,
      properties: {
        "dc:title": metadata?.title || path.basename(filePath),
        "dc:type": this.detectResourceType(filePath),
        "meridian:tags": metadata?.tags || [],
        "dc:format": this.detectMimeType(filePath),
        ...metadata,
      },
      locations: {
        primary: {
          type: "file-path",
          value: filePath,
          accessible: true,
          lastVerified: new Date().toISOString(),
          metadata: {
            size: content.length,
            mimeType: this.detectMimeType(filePath),
          },
        },
        alternatives: [],
      },
      provenance: [
        {
          timestamp: new Date().toISOString(),
          action: "created",
          method: "file-upload",
          toLocation: {
            type: "file-path",
            value: filePath,
            accessible: true,
            lastVerified: new Date().toISOString(),
          },
        },
      ],
      state: {
        type: "internal",
        accessible: true,
        lastVerified: new Date().toISOString(),
        verificationStatus: "verified",
      },
      timestamps: {
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
      },
    };

    await this.saveResource(resource);
    return resource;
  }
}
```

### 3. Migration Strategy

#### Phase 1: UUID v4 Migration

```typescript
class ResourceMigrationService {
  /**
   * Migrate collate resource to unified schema
   */
  async migrateCollateResource(oldResource: any): Promise<SemanticResource> {
    const idGenerator = new ResourceIdGenerator();
    const { id, uri } = idGenerator.generateResourceIdentity();

    // Generate content hash from URL (or fetch if needed)
    const contentHash = await this.generateContentHashFromUrl(oldResource.url);

    return {
      id, // New UUID v4
      uri, // New URI
      contentHash, // Content-based identity

      properties: {
        "dc:title": oldResource.title,
        "dc:type": "web-page",
        "meridian:tags": oldResource.tags,
        "meridian:description": oldResource.description,
      },

      locations: {
        primary: {
          type: "http-url",
          value: oldResource.url,
          accessible: true,
          lastVerified: new Date().toISOString(),
        },
        alternatives: [],
      },

      provenance: [
        {
          timestamp: oldResource.createdAt,
          action: "created",
          method: "web-scrape",
          toLocation: {
            type: "http-url",
            value: oldResource.url,
            accessible: true,
            lastVerified: new Date().toISOString(),
          },
        },
      ],

      state: {
        type: "virtual",
        accessible: true,
        lastVerified: new Date().toISOString(),
        verificationStatus: "verified",
      },

      timestamps: {
        created: oldResource.createdAt,
        modified: oldResource.modifiedAt,
        lastAccessed: new Date().toISOString(),
      },
    };
  }

  /**
   * Migrate archive file to unified schema
   */
  async migrateArchiveFile(oldFile: any): Promise<SemanticResource> {
    const idGenerator = new ResourceIdGenerator();
    const { id, uri } = idGenerator.generateResourceIdentity();

    // Use existing UUID as content hash if available, otherwise generate from file
    const contentHash =
      oldFile.uuid ||
      (await this.generateContentHashFromFile(oldFile.filePath));

    return {
      id, // New UUID v4
      uri, // New URI
      contentHash, // Content-based identity

      properties: {
        "dc:title": oldFile.title,
        "dc:type": this.detectResourceType(oldFile.filePath),
        "meridian:tags": oldFile.tags,
        "dc:format": oldFile.mimeType,
      },

      locations: {
        primary: {
          type: "file-path",
          value: oldFile.filePath,
          accessible: true,
          lastVerified: new Date().toISOString(),
          metadata: {
            size: oldFile.fileSize,
            mimeType: oldFile.mimeType,
          },
        },
        alternatives:
          oldFile.arweave_hashes?.map((hash) => ({
            type: "arweave-url",
            value: hash.link,
            accessible: true,
            lastVerified: new Date().toISOString(),
          })) || [],
      },

      provenance: [
        {
          timestamp: oldFile.created,
          action: "created",
          method: "file-upload",
          toLocation: {
            type: "file-path",
            value: oldFile.filePath,
            accessible: true,
            lastVerified: new Date().toISOString(),
          },
        },
      ],

      state: {
        type: oldFile.arweave_hashes?.length > 0 ? "hybrid" : "local",
        accessible: true,
        lastVerified: new Date().toISOString(),
        verificationStatus: "verified",
      },

      timestamps: {
        created: oldFile.created,
        modified: oldFile.modified,
        lastAccessed: new Date().toISOString(),
      },
    };
  }
}
```

## Benefits of Semantic Web Compliant Approach

### 1. Universal Persistence

- **Web resources** can be preserved as self-contained HTML packages
- **Local files** can be uploaded to Arweave for global access
- **Virtual resources** can be materialized as needed

### 2. Link Rot Prevention

- Web resources packaged as self-contained HTML eliminate dependency on original servers
- All resources become permanently accessible through Arweave
- Content preservation regardless of original source availability

### 3. Offline Capability

- Self-contained HTML packages work offline
- Local copies provide immediate access
- Arweave uploads provide global accessibility

### 4. Content Integrity

- Content hashing ensures authenticity
- Self-contained packages preserve original appearance
- Arweave provides immutable storage

### 5. Semantic Web Compliance

- Proper URI/URL distinction
- RDF-like metadata structure
- Identity/location separation
- Provenance tracking

## Implementation Strategy & Timeline

### Implementation Approach

Based on user requirements and software development best practices, the implementation will follow this approach:

1. **Parallel Development**: Create `UnifiedResourceManager` alongside existing modules
2. **New UI Tab**: Add unified resource tab before removing existing Collate/Archive tabs
3. **Backend-First**: Generate UUIDs and handle content hashing on the backend
4. **Incremental Features**: Start with core functionality, add advanced features progressively
5. **Data Migration**: Handle existing data migration separately via dedicated Python script

### Phase 1: Foundation & Core Structure (1-2 weeks)

- [ ] Create `UnifiedResourceManager` module extending `ModuleBase`
- [ ] Implement semantic resource schema with UUID v4 backend generation
- [ ] Add unified resource tab to UI navigation
- [ ] Create basic resource creation and display functionality
- [ ] Integrate with existing `TagManager` for tag operations
- [ ] Implement SHA-256 content hashing on backend

### Phase 2: Resource Management Features (2-3 weeks)

- [ ] Implement resource CRUD operations (Create, Read, Update, Delete)
- [ ] Add resource filtering and search functionality
- [ ] Implement collapse state management
- [ ] Create resource action menus (edit, remove, upload to Arweave)
- [ ] Add resource status indicators (virtual, local, arweave)

### Phase 3: Advanced Integration (2-3 weeks)

- [ ] Integrate with `UploadManager` for Arweave operations
- [ ] Implement web resource packaging as self-contained HTML
- [ ] Add content deduplication based on SHA-256 hashing
- [ ] Create resource state transitions (virtual → local → arweave)
- [ ] Implement provenance tracking for resource lifecycle

### Phase 4: UI Polish & Testing (1-2 weeks)

- [ ] Refine unified resource interface styling
- [ ] Add resource state indicators and visual feedback
- [ ] Implement comprehensive error handling
- [ ] Add performance optimizations
- [ ] Create user documentation

### Phase 5: Migration & Cleanup (1 week)

- [ ] Create data migration Python script for existing data
- [ ] Test migration process with sample data
- [ ] Remove old Collate and Archive tabs
- [ ] Clean up deprecated modules and code
- [ ] Final testing and validation

### Technical Implementation Details

#### UUID Generation Strategy

- **Location**: Backend (main process)
- **Method**: Node.js `crypto.randomUUID()` for UUID v4 generation
- **Integration**: Expose via IPC for frontend consumption

#### Content Hashing Strategy

- **Algorithm**: SHA-256
- **Location**: Backend for consistency and performance
- **Purpose**: Content-based deduplication and identity verification
- **Implementation**: Use Node.js `crypto.createHash('sha256')`

#### Module Integration Pattern

```typescript
// UnifiedResourceManager extends ModuleBase
export class UnifiedResourceManager extends ModuleBase {
  constructor(app) {
    super(app);
    // Integrate with existing services
    this.tagManager = this.getModule("tagManager");
    this.uploadManager = this.getModule("uploadManager");
    this.modalManager = this.getModule("modalManager");
  }
}
```

#### UI Integration Strategy

- **New Tab**: Add "Unified" tab to existing navigation
- **Styling**: Use archive-item based styling for consistency
- **Progressive Enhancement**: Start with basic functionality, add features incrementally
- **Backward Compatibility**: Maintain existing tabs until unified system is stable

#### Data Migration Strategy

- **Separate Process**: Dedicated Python script for data migration
- **No Automatic Migration**: Manual migration to avoid data corruption
- **Schema Mapping**: Map existing data structures to new semantic schema
- **Validation**: Comprehensive validation of migrated data

### Success Criteria

#### Phase 1 Success

- [ ] UnifiedResourceManager loads without errors
- [ ] New unified tab appears in navigation
- [ ] Basic resource creation works
- [ ] Resource display follows archive-item styling

#### Phase 2 Success

- [ ] Full CRUD operations functional
- [ ] Tag management integrated with existing TagManager
- [ ] Search and filtering work correctly
- [ ] Collapse state persists across sessions

#### Phase 3 Success

- [ ] Arweave upload integration functional
- [ ] Web resource packaging creates valid self-contained HTML
- [ ] Content deduplication prevents duplicate resources
- [ ] Resource state transitions work smoothly

#### Phase 4 Success

- [ ] UI is polished and responsive
- [ ] Error handling is comprehensive
- [ ] Performance meets or exceeds existing panels
- [ ] User experience is intuitive

#### Phase 5 Success

- [ ] Data migration script works correctly
- [ ] Old tabs removed without breaking functionality
- [ ] No deprecated code remains
- [ ] System is production-ready

## Success Metrics

### Content Preservation

- [ ] Web resources successfully packaged as self-contained HTML
- [ ] All resource types uploadable to Arweave
- [ ] Content integrity maintained through transitions

### Accessibility

- [ ] Offline access to packaged web resources
- [ ] Global access through Arweave URLs
- [ ] Seamless transitions between virtual/local/Arweave states

### User Experience

- [ ] Transparent resource state management
- [ ] Clear indication of persistence type
- [ ] Intuitive controls for state transitions

### Semantic Web Compliance

- [ ] Proper URI/URL distinction maintained
- [ ] RDF-like metadata structure implemented
- [ ] Identity/location separation preserved
- [ ] Provenance tracking complete

This enhanced ontological framework creates a truly unified system where all resources can exist in multiple persistence states while maintaining consistent addressing and access patterns. The virtual/local distinction with universal Arweave capability provides maximum flexibility for content preservation and accessibility, all while following semantic web best practices and integrating seamlessly with Meridian's existing modular architecture.
