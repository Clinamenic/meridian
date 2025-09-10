# Arweave Upload Tagging Enhancement Plan

## Overview

Enhance the existing Arweave upload functionality in the Archive tab to support advanced metadata tagging, with emphasis on extracting UUIDs from markdown frontmatter and improving upload indexing to match the `reference-archive.json` pattern.

## Current State Analysis

### Existing Architecture

- **Frontend**: `src/renderer/app.js` (lines 2223-2422) - Upload modal with basic tag management
- **Backend**: `src/main/arweave-manager.ts` - File upload using arkb CLI
- **Data Structure**: Current `archive.json` uses simple upload array structure
- **Tag Format**: Current tags converted to "key:value" strings for Arweave

### Current Limitations

1. No automatic metadata extraction from files
2. Simple upload tracking without version management
3. No UUID-based content identity tracking
4. Tags are manually entered without intelligent defaults
5. Archive structure doesn't match the rich `reference-archive.json` pattern

## Enhanced Architecture Plan

### 1. Universal File Identification System

#### 1.1 Multi-Layer UUID Resolution Strategy

**Challenge**: Non-markdown files (images, PDFs, videos) lack standardized metadata embedding capabilities, requiring robust UUID association independent of file format while maintaining semantic interoperability and portability.

**Solution**: Implement a **hierarchical fallback system** based on industry standards:

##### **Layer 1: Frontmatter Extraction** (Markdown files)

- Parse YAML frontmatter for existing UUID v4
- Extract semantic metadata (title, author, created, tags)
- Validate UUID format and uniqueness

##### **Layer 2: Extended Attributes** (Primary for binary files)

- **Standard**: [POSIX.1e xattr](https://en.wikipedia.org/wiki/Extended_file_attributes) + [freedesktop.org guidelines](https://freedesktop.org/wiki/CommonExtendedAttributes/)
- **Namespace**: `user.cosmo.uuid` for UUID, `user.cosmo.metadata` for rich metadata
- **Cross-platform**: Linux (`setfattr`/`getfattr`), macOS (`xattr`), Windows (NTFS ADS)
- **Advantages**: Self-contained, travels with file operations (`mv`, `cp --preserve=xattr`)
- **Limitations**: Not all filesystems support (NFS, FAT32), can be lost in some transfer scenarios

##### **Layer 3: Centralized File Registry** (Primary system of record)

- **Location**: `.cosmo/data/file-registry.json`
- **Purpose**: Authoritative UUID→file mapping with rich metadata
- **Schema**: Matches `reference-archive.json` pattern for consistency
  ```json
  {
    "files": [
      {
        "uuid": "550e8400-e29b-41d4-a716-446655440000",
        "title": "Document Title",
        "filePath": "/path/to/file.pdf",
        "contentHash": "sha256:abcd1234...",
        "fileSize": 1024000,
        "mimeType": "application/pdf",
        "created": "2024-01-15T10:30:00Z",
        "modified": "2024-01-15T10:30:00Z",
        "tags": ["tag1", "tag2"],
        "metadata": {
          "author": "Creator Name",
          "customFields": {}
        },
        "arweave_hashes": [
          {
            "hash": "ABC123...",
            "timestamp": "2024-01-15T10:30:00Z",
            "link": "https://www.arweave.net/ABC123...",
            "tags": [
              "uuid:550e8400-e29b-41d4-a716-446655440000",
              "title:Document Title"
            ]
          }
        ]
      }
    ],
    "lastUpdated": "2024-01-15T10:30:00Z",
    "version": "1.0"
  }
  ```

**Advantages of Centralized Approach**:

- ✅ **No filesystem clutter** - single metadata file
- ✅ **Cross-platform compatibility** - works on all filesystems
- ✅ **Atomic operations** - consistent state management
- ✅ **Rich querying** - complex metadata searches
- ✅ **Version control friendly** - single file to track
- ✅ **Migration ready** - easy to import existing archives
- ✅ **Performance** - indexed lookups, batch operations
- ✅ **Backup/sync** - single file contains all metadata

##### **Layer 4: Content-Addressable UUID** (Deterministic fallback)

- **Standard**: [RFC 4122](https://www.rfc-editor.org/rfc/rfc4122) UUID v5 (namespace + content hash)
- **Namespace**: Custom UUID namespace for Cosmo project: `6ba7b810-9dad-11d1-80b4-00c04fd430c8`
- **Algorithm**: `UUIDv5(COSMO_NAMESPACE, SHA256(file_content))`
- **Advantages**: Mathematically reproducible, no storage overhead, enables deduplication
- **Use cases**: When files lack explicit UUIDs, verification, backup systems

#### 1.2 File Registry Management Implementation

**Location**: `src/main/file-registry-manager.ts`

```typescript
interface FileRegistryEntry {
  uuid: string;
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
    customFields: Record<string, any>;
  };
  arweave_hashes: ArweaveUpload[];
}

interface UUIDResolutionResult {
  uuid: string;
  source: "frontmatter" | "xattr" | "registry" | "content-based" | "generated";
  confidence: "high" | "medium" | "low";
  registryEntry?: FileRegistryEntry;
}

class FileRegistryManager {
  private registryPath = ".cosmo/data/file-registry.json";

  // Primary resolution method - tries all layers
  resolveUUID(filePath: string): Promise<UUIDResolutionResult>;

  // Registry operations
  getFileByUUID(uuid: string): Promise<FileRegistryEntry | null>;
  getFileByPath(filePath: string): Promise<FileRegistryEntry | null>;
  addOrUpdateFile(entry: FileRegistryEntry): Promise<void>;
  removeFile(uuid: string): Promise<void>;

  // Path management (handle file moves)
  updateFilePath(uuid: string, newPath: string): Promise<void>;
  findOrphanedEntries(): Promise<FileRegistryEntry[]>;

  // Extended attributes operations (fallback)
  getXAttrUUID(filePath: string): Promise<string | null>;
  setXAttrUUID(filePath: string, uuid: string): Promise<boolean>;

  // Content-based UUID generation
  generateContentBasedUUID(filePath: string): Promise<string>;

  // Registry maintenance
  validateRegistry(): Promise<ValidationResult>;
  rebuildRegistry(scanPaths: string[]): Promise<void>;
  exportRegistry(): Promise<string>;
  importRegistry(data: string): Promise<void>;
}
```

#### 1.3 Semantic Interoperability Considerations

**Standards Compliance**:

- Use [Dublin Core](http://purl.org/dc/elements/1.1/) metadata terms where applicable
- Follow [IPTC Video Metadata Hub](https://iptc.org/std/videometadatahub/userguide/) patterns for rich metadata
- Implement [JSON-LD](https://json-ld.org/) context for semantic web compatibility

**Cross-System Compatibility**:

- Export capability to [DASL MASL](https://dasl.ing/masl.html) format for decentralized systems
- Support [UCID](https://github.com/IABTechLab/ucid) (Universal Creative Identification) standards
- Maintain compatibility with git-based workflows

### 2. File Metadata Extraction System

#### 2.1 Practical Implementation Considerations

##### **Robustness and Failure Handling**

**Extended Attributes Reliability**:

- Monitor for filesystems that don't support xattrs (detect and fallback gracefully)
- Implement automatic repair when xattrs are lost (e.g., after file transfers)
- Use copy hooks to preserve xattrs during file operations
- Periodic consistency checks between layers

**Sidecar File Management**:

- Atomic writes to prevent corruption during concurrent access
- Automatic cleanup of orphaned sidecar files
- Conflict resolution when multiple sidecar files exist
- Integration with `.gitignore` patterns for version control

**Performance Optimizations**:

- Lazy UUID resolution (only when needed)
- Batch operations for bulk file processing
- Caching layer with invalidation on file changes
- Background consistency checking

##### **Migration and Backwards Compatibility**

**Existing File Integration**:

- Scan existing files and establish UUID mappings using best available method
- Migration wizard for upgrading from path-based to UUID-based system
- Export/import functionality for cross-system migration
- Graceful degradation when advanced features are unavailable

**Version Control Considerations**:

- Sidecar files should be gitignored by default (content-based UUIDs provide git compatibility)
- Optional: track sidecar files for collaboration scenarios
- Handle UUID conflicts when merging repositories
- Tool to regenerate UUIDs after git operations if needed

##### **Scalability Analysis**

**Advantages of This Approach**:

1. **Self-Healing**: Multiple fallback layers ensure UUID persistence
2. **Cross-Platform**: Works across Windows, macOS, Linux with graceful degradation
3. **Standards-Based**: Built on established metadata and identification standards
4. **Future-Proof**: Extensible architecture supports new metadata types
5. **Performance**: Cached lookups with lazy evaluation
6. **Portability**: Content-based UUIDs work anywhere, sidecar files are portable

**Potential Limitations**:

1. **Complexity**: More complex than simple path-based mapping
2. **Storage Overhead**: Sidecar files add filesystem entries
3. **Consistency**: Multiple sources of truth require careful synchronization
4. **Learning Curve**: Users need to understand the layered system

**Recommended Default Behavior**:

- **For new files**: Set both xattrs and generate content-based UUID as backup
- **For existing files**: Use content-based UUID initially, upgrade to xattrs when modified
- **For collaboration**: Prefer content-based UUIDs to avoid conflicts
- **For archives**: Always create sidecar files for maximum preservation

#### 2.2 Frontmatter Parser Module

**Location**: `src/main/metadata-extractor.ts`

**Capabilities**:

- Parse YAML/TOML frontmatter from markdown files
- Extract structured metadata (title, uuid, author, date, tags, etc.)
- Support multiple frontmatter formats
- Validate UUID v4 format
- Extract content hash for change detection

**Key Functions**:

```typescript
interface ParsedMetadata {
  uuid?: string; // UUID v4 from frontmatter
  title?: string; // Document title
  author?: string; // Content author
  created?: string; // Creation date
  modified?: string; // Last modified date
  tags?: string[]; // Content tags
  contentType: string; // File MIME type
  contentHash: string; // SHA-256 of content
  customFields: Record<string, any>; // Additional frontmatter fields
}

class MetadataExtractor {
  extractFromFile(filePath: string): Promise<ParsedMetadata>;
  extractFromMarkdown(content: string): ParsedMetadata;
  validateUUID(uuid: string): boolean;
  generateContentHash(content: string): string;
}
```

#### 1.2 Auto-Tag Generation

**Smart tag suggestions based on:**

- File extension and MIME type
- Frontmatter metadata
- File naming patterns
- Content analysis (keywords, language detection)
- Directory structure context

### 2. Enhanced Data Structure

#### 2.1 New Archive Data Model

Transform `archive.json` to match `reference-archive.json` pattern:

```typescript
interface EnhancedArchiveData {
  files: ContentFile[];
  wallet: WalletInfo;
  lastUpdated: string;
  version: string; // Schema version for migration
}

interface ContentFile {
  uuid: string; // Primary identifier (from frontmatter or generated)
  title: string; // Human-readable title
  filePath?: string; // Local file path (if applicable)
  contentType: string; // MIME type
  contentHash: string; // SHA-256 hash for change detection
  metadata: ParsedMetadata; // Extracted metadata
  arweave_hashes: ArweaveUpload[]; // Multiple versions/uploads
}

interface ArweaveUpload {
  hash: string; // Arweave transaction ID
  timestamp: string; // Upload timestamp (ISO 8601)
  link: string; // Full Arweave URL
  tags: ArweaveTag[]; // Structured tags
  status: "pending" | "confirmed" | "failed";
  cost: { ar: string; usd?: string };
  uploader?: string; // Wallet address that uploaded
}

interface ArweaveTag {
  key: string;
  value: string;
  source: "manual" | "auto" | "frontmatter" | "system";
}
```

#### 2.2 Migration Strategy

- Detect existing `archive.json` format
- Migrate old upload records to new structure
- Preserve backward compatibility
- Add version field for future migrations

### 3. Enhanced Upload Workflow

#### 3.1 Pre-Upload Analysis

**Location**: Enhanced `openUploadModal()` function

**Process**:

1. **File Analysis**:

   - Extract metadata using new MetadataExtractor
   - Generate content hash
   - Check for existing UUID in archive
   - Detect file changes (hash comparison)

2. **Smart Tag Population**:

   - Auto-populate UUID tag if found in frontmatter
   - Suggest content-type tags
   - Add system tags (upload-date, file-size, etc.)
   - Present frontmatter fields as tag suggestions

3. **Version Detection**:
   - If UUID exists in archive, present as new version
   - Show diff/changes from previous version
   - Allow version notes/comments

#### 3.2 Enhanced Upload Modal

**UI Improvements**:

- **Metadata Preview Section**: Display extracted frontmatter
- **Smart Tag Suggestions**: Auto-populated tags with source indicators
- **Version Management**: Show existing versions if UUID exists
- **Tag Categories**: Group tags by source (manual, auto, frontmatter, system)
- **Validation**: Real-time tag validation and conflict detection

#### 3.3 Arweave Tag Strategy

**Standard Tags Applied to Every Upload**:

```
Content-Type: [MIME type]
UUID: [UUID from frontmatter or generated]
Title: [Document title]
Upload-Date: [ISO timestamp]
Client: Cosmo-Archive
Version: [version number for this UUID]
```

**Optional/Conditional Tags**:

```
Author: [from frontmatter]
Created-Date: [from frontmatter]
Keywords: [comma-separated tags]
Language: [detected language]
File-Hash: [SHA-256 content hash]
```

### 4. Upload Processing Enhancements

#### 4.1 Enhanced ArweaveManager

**New Methods**:

```typescript
class ArweaveManager {
  // Enhanced upload with metadata
  uploadFileWithMetadata(
    filePath: string,
    metadata: ParsedMetadata,
    userTags: ArweaveTag[],
    versionNotes?: string
  ): Promise<UploadResult>;

  // Check for existing content by UUID
  findExistingContentByUUID(uuid: string): Promise<ContentFile | null>;

  // Generate comprehensive tag set
  generateUploadTags(
    metadata: ParsedMetadata,
    userTags: ArweaveTag[]
  ): string[];

  // Query Arweave by tags
  queryArweaveByTags(
    tags: Record<string, string>
  ): Promise<ArweaveQueryResult[]>;
}
```

#### 4.2 Upload Process Flow

1. **Pre-Upload Validation**:

   - Validate all tags
   - Check wallet balance
   - Confirm metadata accuracy

2. **Upload Execution**:

   - Upload to Arweave with comprehensive tag set
   - Save upload record to enhanced archive structure
   - Update existing ContentFile or create new one

3. **Post-Upload Processing**:
   - Monitor transaction status
   - Update archive with confirmed transaction
   - Trigger optional webhook/notification

### 5. Archive Management Features

#### 5.1 Content Versioning

- Track multiple uploads of same UUID
- Version comparison and diff viewing
- Rollback capabilities
- Version metadata (notes, timestamp, uploader)

#### 5.2 Query and Search

- Search by UUID, title, tags, content hash
- Filter by upload date, status, wallet
- Export filtered results
- Bulk operations on search results

#### 5.3 Archive Maintenance

- Detect and flag duplicate content (by hash)
- Identify orphaned uploads (no local file)
- Bulk re-tagging operations
- Archive statistics and analytics

### 6. Implementation Phases

#### Phase 1: Core Infrastructure

1. Create MetadataExtractor module
2. Implement enhanced data structures
3. Add migration logic for existing archives
4. Basic UUID extraction and validation

#### Phase 2: Enhanced Upload Flow

1. Enhance upload modal with metadata preview
2. Implement smart tag generation
3. Add version detection and management
4. Enhanced ArweaveManager methods

#### Phase 3: Advanced Features

1. Content versioning UI
2. Advanced search and filter capabilities
3. Bulk operations and management tools
4. Archive analytics and reporting

#### Phase 4: Integration and Polish

1. Query Arweave network by tags
2. Export/import archive data
3. Performance optimizations
4. Comprehensive testing and documentation

### 7. Technical Considerations

#### 7.1 Dependencies

- Add YAML parser for frontmatter (e.g., `js-yaml`)
- Content hashing utilities (built-in Node.js `crypto`)
- UUID validation library
- Markdown parser for content extraction

#### 7.2 Performance

- Lazy loading of large archives
- Efficient content hashing
- Cached metadata extraction
- Background processing for bulk operations

#### 7.3 Security

- Validate all extracted metadata
- Sanitize user-generated tags
- Secure handling of wallet operations
- Rate limiting for Arweave queries

### 8. Testing Strategy

#### 8.1 Unit Tests

- MetadataExtractor functionality
- Data structure migration
- Tag generation and validation
- Archive operations

#### 8.2 Integration Tests

- Full upload workflow
- Version management
- Query operations
- Cross-platform compatibility

#### 8.3 User Acceptance Tests

- Upload flow with various file types
- Metadata extraction accuracy
- Version management usability
- Search and filter functionality

### 9. Documentation Requirements

#### 9.1 User Documentation

- Enhanced upload workflow guide
- Metadata and tagging best practices
- Version management tutorial
- Search and archive management

#### 9.2 Developer Documentation

- MetadataExtractor API reference
- Data structure specifications
- Migration procedures
- Extension and customization guide

## Success Metrics

1. **Accuracy**: >95% successful UUID extraction from frontmatter
2. **Usability**: <30 seconds for typical upload with auto-tags
3. **Reliability**: <1% failed uploads due to tagging issues
4. **Adoption**: 80% of uploads use auto-generated tags
5. **Performance**: <2 seconds for metadata extraction on typical files

This enhancement plan transforms the Archive tab into a sophisticated content management system while maintaining the simplicity of the current interface.
