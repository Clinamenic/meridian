# Main Process Architecture Overview

## Executive Summary

This document provides a comprehensive architectural overview of the Meridian Electron application's main process, detailing the relationships, dependencies, and responsibilities of all 14 TypeScript modules. The architecture follows a layered service-oriented pattern with clear separation of concerns and well-defined integration points.

**Architecture Pattern**: Layered Service Architecture with Event-Driven Coordination
**Total Components**: 14 TypeScript modules
**Core Pattern**: Dependency Injection with Singleton Coordination

## Architecture Layers

### Layer 1: Application Bootstrap

**Purpose**: Application lifecycle, window management, and process coordination

```
main.ts (MeridianApp)
├─> preload.ts (Security Bridge)
└─> All Service Managers
```

### Layer 2: Core Infrastructure Services

**Purpose**: Foundational services for data management and security

```
data-manager.ts (Central Data Store)
credential-manager.ts (Secure Credential Storage)
```

### Layer 3: Platform Integration Services

**Purpose**: External platform and protocol integrations

```
arweave-manager.ts (Arweave Blockchain)
atproto-manager.ts (AT Protocol/Bluesky)
x-manager.ts (Twitter/X API)
social-manager.ts (Social Platform Coordinator)
```

### Layer 4: Content Processing Services

**Purpose**: Content creation, templating, and processing

```
template-manager.ts (Content Templates)
template-engine.ts (Template Processing)
staging-manager.ts (Content Staging)
markdown-processor.ts (Markdown Processing)
metadata-extractor.ts (Web Metadata)
```

### Layer 5: Coordination Services

**Purpose**: Cross-service coordination and state management

```
account-state-manager.ts (Centralized State)
```

## Detailed Component Analysis

### 1. main.ts - Application Controller

**Role**: Application lifecycle and dependency orchestration
**Pattern**: Composite Root / Application Controller

```typescript
class MeridianApp {
  // Dependency Graph
  private credentialManager: CredentialManager; // → Layer 2
  private dataManager: DataManager; // → Layer 2
  private arweaveManager: ArweaveManager; // → Layer 3
  private atprotoManager: ATProtoManager; // → Layer 3
  private xManager: XManager; // → Layer 3
  private socialManager: SocialManager; // → Layer 3
  private templateManager: TemplateManager; // → Layer 4
  private stagingManager: StagingManager; // → Layer 4
  private markdownProcessor: MarkdownProcessor; // → Layer 4
  private metadataExtractor: MetadataExtractor; // → Layer 4
  private accountStateManager: AccountStateManager; // → Layer 5
}
```

**Key Responsibilities**:

- Bootstrap all service dependencies
- Create and manage BrowserWindow
- Setup IPC communication handlers
- Coordinate workspace initialization

**Dependencies**: All other modules (Dependency Root)
**Integration Points**: Electron app lifecycle, IPC system

### 2. preload.ts - Security Bridge

**Role**: Secure API bridge between main and renderer processes
**Pattern**: Facade / API Gateway

```typescript
interface ElectronAPI {
  // Workspace Management
  selectWorkspace(): Promise<{ success: boolean; path?: string }>;

  // Feature-Specific APIs
  collate: CollateAPI;
  archive: ArchiveAPI;
  broadcast: BroadcastAPI;
  atproto: ATProtoAPI;
  x: XAPI;
  accountState: AccountStateAPI;
  credentials: CredentialsAPI;
}
```

**Key Responsibilities**:

- Expose secure API surface to renderer
- Type-safe IPC communication
- Context isolation compliance

**Dependencies**: None (Pure bridge)
**Integration Points**: contextBridge, ipcRenderer

### 3. data-manager.ts - Central Data Repository

**Role**: Unified data persistence and workspace management
**Pattern**: Repository / Data Access Layer

```typescript
class DataManager {
  // Workspace Structure Management
  private workspacePath: string | null;
  private meridianStructure: MeridianWorkspaceStructure | null;

  // Data Operations
  loadCollateData(): Promise<CollateData>;
  saveCollateData(data: CollateData): Promise<void>;
  loadArchiveData(): Promise<ArchiveData>;
  loadBroadcastDataV2(): Promise<BroadcastDataV2>;
}
```

**Key Responsibilities**:

- Workspace structure management (.meridian/ directory)
- File-based data persistence (JSON)
- Legacy data migration
- Export/import operations

**Dependencies**: File System APIs
**Integration Points**: All managers requiring data persistence

### 4. credential-manager.ts - Security Service

**Role**: Encrypted credential storage and management
**Pattern**: Singleton Service / Security Manager

```typescript
class CredentialManager {
  // Secure Storage Operations
  setCredential(
    service: Platform | "arweave",
    key: string,
    value: string
  ): Promise<void>;
  getCredential(
    service: Platform | "arweave",
    key: string
  ): Promise<string | null>;

  // Platform Management
  setPlatformCredentials(
    service: Platform,
    credentials: Record<string, string>
  ): Promise<void>;
  validatePlatformCredentials(service: Platform): Promise<boolean>;
}
```

**Key Responsibilities**:

- Encrypted credential storage using Electron safeStorage
- Platform-specific credential management
- Workspace-isolated security context

**Dependencies**: Electron safeStorage, DataManager (workspace)
**Integration Points**: All platform managers requiring authentication

### 5. account-state-manager.ts - State Coordinator

**Role**: Centralized account state tracking and event coordination
**Pattern**: Event-Driven Coordinator / State Manager

```typescript
class AccountStateManager extends EventEmitter {
  // State Management
  initializeForWorkspace(workspacePath: string): Promise<void>;
  getState(): AccountState;
  refreshPlatform(platform: keyof AccountState): Promise<void>;

  // Event Coordination
  emit('platformChange', update: AccountStateUpdate);
  emit('stateChange', state: AccountState);
}
```

**Key Responsibilities**:

- Cross-platform account state coordination
- Real-time state validation and updates
- Event-driven state change notifications
- Account switching coordination

**Dependencies**: CredentialManager, ArweaveManager, ATProtoManager, XManager
**Integration Points**: All platform managers, UI state synchronization

### 6. arweave-manager.ts - Blockchain Service

**Role**: Arweave blockchain integration and file archiving
**Pattern**: Platform Service / External Integration

```typescript
class ArweaveManager {
  // Account Management
  addAccount(walletJWK: string, nickname: string): Promise<ArweaveAccount>;
  switchAccount(accountId: string): Promise<void>;

  // Blockchain Operations
  uploadFile(filePath: string, tags: string[]): Promise<string>;
  getWalletBalance(): Promise<{ balance: string; currency: string }>;
  checkTransactionStatus(
    transactionId: string
  ): Promise<"pending" | "confirmed" | "failed">;
}
```

**Key Responsibilities**:

- Multi-account Arweave wallet management
- File upload to Arweave network
- Transaction monitoring and confirmation
- Balance and cost estimation

**Dependencies**: DataManager, Arweave SDK
**Integration Points**: Archive feature, file registry

### 7. atproto-manager.ts - AT Protocol Service

**Role**: AT Protocol (Bluesky) integration
**Pattern**: Platform Service / Social Protocol Integration

```typescript
class ATProtoManager {
  // Account Management
  addAccount(
    handle: string,
    password: string,
    nickname: string
  ): Promise<ATProtoAccount>;
  validateSession(accountId: string): Promise<boolean>;

  // Social Operations
  postContent(content: string, accountId?: string): Promise<string | null>;
  getProfile(accountId?: string): Promise<Profile | null>;
}
```

**Key Responsibilities**:

- AT Protocol authentication and session management
- Multi-account Bluesky integration
- Content posting and profile management
- Session validation and refresh

**Dependencies**: DataManager, @atproto/api
**Integration Points**: Social posting, account state management

### 8. x-manager.ts - Twitter/X Service

**Role**: Twitter/X API integration
**Pattern**: Platform Service / Social API Integration

```typescript
class XManager {
  // Account Management
  addAccount(
    apiKey: string,
    apiSecret: string,
    accessToken: string,
    accessTokenSecret: string,
    nickname: string
  ): Promise<XAccount>;

  // Social Operations
  postTweet(content: string, accountId?: string): Promise<string | null>;
  checkAppPermissions(
    accountId?: string
  ): Promise<{ canRead: boolean; canWrite: boolean }>;
}
```

**Key Responsibilities**:

- OAuth 1.0a authentication for Twitter API
- Multi-account Twitter integration
- Tweet posting and permission validation
- API rate limiting and error handling

**Dependencies**: DataManager, Twitter API libraries
**Integration Points**: Social posting, account state management

### 9. social-manager.ts - Social Coordinator

**Role**: Cross-platform social media coordination
**Pattern**: Facade / Multi-Platform Coordinator

```typescript
class SocialManager {
  // Platform Coordination
  authenticatePlatform(
    platform: Platform,
    credentials: Record<string, string>
  ): Promise<boolean>;
  postToPlatform(postId: string, platform: Platform): Promise<PostResult>;
  postToMultiplePlatforms(
    postId: string,
    platforms: Platform[]
  ): Promise<{ [platform: string]: PostResult }>;
}
```

**Key Responsibilities**:

- Unified social platform authentication
- Cross-platform posting coordination
- Platform-specific result aggregation
- Social account management facade

**Dependencies**: CredentialManager, platform-specific APIs
**Integration Points**: Staging manager, broadcast features

### 10. template-manager.ts - Template Service

**Role**: Content template management and application
**Pattern**: Service / Template Management

```typescript
class TemplateManager {
  // Template CRUD
  createTemplate(
    template: Omit<PostTemplate, "id" | "createdAt" | "updatedAt">
  ): Promise<PostTemplate>;
  applyTemplate(
    templateId: string,
    markdownFile: MarkdownFile
  ): Promise<StagedPost>;

  // Template Operations
  listTemplates(filters?: TemplateFilters): Promise<PostTemplate[]>;
  previewTemplate(
    templateId: string,
    variables: Record<string, string>
  ): Promise<string>;
}
```

**Key Responsibilities**:

- Template creation, storage, and management
- Template application to markdown content
- Variable substitution and processing
- Template validation and preview

**Dependencies**: DataManager, TemplateEngine
**Integration Points**: Content creation workflow, staging

### 11. template-engine.ts - Template Processor

**Role**: Template rendering and variable processing
**Pattern**: Processing Engine / Template Processor

```typescript
class TemplateEngine {
  // Template Processing
  renderTemplate(template: string, variables: Record<string, string>): string;
  validateTemplate(template: string): ValidationResult;
  extractFrontmatterVariables(
    filePath: string
  ): Promise<Record<string, string>>;
}
```

**Key Responsibilities**:

- Template syntax processing and validation
- Variable substitution engine
- Frontmatter parsing and extraction
- URL generation utilities

**Dependencies**: File System APIs, YAML parser
**Integration Points**: Template Manager, content processing

### 12. staging-manager.ts - Content Staging Service

**Role**: Content staging and publishing workflow
**Pattern**: Workflow Manager / Content Pipeline

```typescript
class StagingManager {
  // Content Staging
  createStagedPost(data: CreateStagedPostData): Promise<StagedPost>;
  updatePlatformContent(
    postId: string,
    platform: Platform,
    content: string
  ): Promise<void>;

  // Publishing Operations
  bulkPublish(postIds: string[]): Promise<PostResult[]>;
  bulkSchedule(postIds: string[], scheduledFor: string): Promise<void>;
}
```

**Key Responsibilities**:

- Content staging and preview
- Platform-specific content customization
- Bulk operations for publishing
- Scheduling and workflow management

**Dependencies**: DataManager, SocialManager
**Integration Points**: Content creation, social posting

### 13. markdown-processor.ts - Content Processor

**Role**: Markdown file processing and monitoring
**Pattern**: File Processor / Content Scanner

```typescript
class MarkdownProcessor {
  // File Processing
  scanContentDirectory(directory: string): Promise<MarkdownFile[]>;
  parseMarkdownFile(filePath: string): Promise<MarkdownFile>;

  // File Watching
  watchContentDirectory(
    directory: string,
    callback: (files: MarkdownFile[]) => void
  ): void;
  extractFrontmatter(content: string): Record<string, any>;
}
```

**Key Responsibilities**:

- Markdown file discovery and parsing
- Frontmatter extraction and processing
- File system monitoring and change detection
- Content directory scanning

**Dependencies**: File System APIs, YAML parser
**Integration Points**: Content workflow, template application

### 14. metadata-extractor.ts - Web Metadata Service

**Role**: Web content metadata extraction
**Pattern**: External Content Processor / Metadata Service

```typescript
class MetadataExtractor {
  // Metadata Extraction
  extractMetadata(url: string): Promise<ExtractedMetadata>;

  // Content Processing
  private parseMetadata(html: string, url: URL): ExtractedMetadata;
  private extractTitle($: cheerio.CheerioAPI): string;
  private extractDescription($: cheerio.CheerioAPI): string;
}
```

**Key Responsibilities**:

- Web page metadata extraction
- Open Graph and Twitter Card parsing
- Image and favicon extraction
- URL validation and processing

**Dependencies**: HTTP client, Cheerio HTML parser
**Integration Points**: Collate feature, resource management

## Dependency Graph

### Core Dependencies Flow

```
main.ts (Root)
├─> credential-manager.ts (Singleton)
├─> data-manager.ts (Repository)
├─> account-state-manager.ts (Coordinator)
│   ├─> credential-manager.ts
│   ├─> arweave-manager.ts
│   ├─> atproto-manager.ts
│   └─> x-manager.ts
├─> social-manager.ts (Facade)
│   └─> credential-manager.ts
├─> template-manager.ts (Service)
│   ├─> data-manager.ts
│   └─> template-engine.ts
├─> staging-manager.ts (Workflow)
│   ├─> data-manager.ts
│   └─> social-manager.ts
├─> arweave-manager.ts (Platform)
│   └─> data-manager.ts
├─> atproto-manager.ts (Platform)
│   └─> data-manager.ts
├─> x-manager.ts (Platform)
│   └─> data-manager.ts
├─> markdown-processor.ts (Processor)
└─> metadata-extractor.ts (Processor)
```

### Integration Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    main.ts (Application Root)                │
├─────────────────────────────────────────────────────────────┤
│                   preload.ts (Security Bridge)               │
├─────────────────────────────────────────────────────────────┤
│              account-state-manager.ts (Coordinator)          │
├─────────────────────────────────────────────────────────────┤
│    social-manager.ts │ staging-manager.ts │ template-manager.ts │
├─────────────────────────────────────────────────────────────┤
│ arweave-manager.ts │ atproto-manager.ts │ x-manager.ts      │
├─────────────────────────────────────────────────────────────┤
│ template-engine.ts │ markdown-processor.ts │ metadata-extractor.ts │
├─────────────────────────────────────────────────────────────┤
│          data-manager.ts │ credential-manager.ts             │
└─────────────────────────────────────────────────────────────┘
```

## Cross-Cutting Concerns

### 1. Error Handling

- **Pattern**: Centralized error logging with contextual information
- **Implementation**: Try-catch blocks with console.error logging
- **Propagation**: Errors bubble up to main.ts for IPC response handling

### 2. Configuration Management

- **Pattern**: Workspace-based configuration isolation
- **Implementation**: DataManager handles .meridian/ structure
- **Scope**: Per-workspace configuration and credentials

### 3. Security

- **Pattern**: Layered security with encrypted storage
- **Implementation**:
  - Context isolation in preload.ts
  - Encrypted credential storage in credential-manager.ts
  - Secure IPC communication patterns

### 4. Event Coordination

- **Pattern**: Event-driven architecture with centralized state
- **Implementation**: EventEmitter patterns in account-state-manager.ts
- **Flow**: Platform changes → State updates → UI notifications

### 5. Data Persistence

- **Pattern**: JSON-based file storage with migration support
- **Implementation**: DataManager with .meridian/ workspace structure
- **Features**: Legacy migration, atomic writes, backup handling

## Performance Considerations

### 1. Singleton Pattern Usage

- **credential-manager.ts**: Prevents multiple encryption contexts
- **account-state-manager.ts**: Ensures single source of truth for state

### 2. Lazy Loading

- Platform managers initialize on first use
- Template engine validates on template creation

### 3. Caching Strategies

- Account state caching with refresh mechanisms
- Template validation result caching
- Metadata extraction result caching

### 4. Batch Operations

- Bulk publishing in staging-manager.ts
- Bulk file operations in data-manager.ts

## Future Architecture Considerations

### 1. Plugin Architecture

- **Current State**: Hardcoded platform integrations
- **Future**: Plugin-based platform extensibility
- **Impact**: New platform integrations without core changes

### 2. Service Discovery

- **Current State**: Direct dependency injection
- **Future**: Service registry pattern
- **Impact**: Dynamic service registration and discovery

### 3. Event Bus

- **Current State**: Direct EventEmitter usage
- **Future**: Centralized event bus
- **Impact**: Improved event coordination and debugging

### 4. Configuration Service

- **Current State**: Distributed configuration
- **Future**: Centralized configuration manager
- **Impact**: Better configuration management and validation

## Conclusion

The Meridian main process architecture demonstrates a well-structured, layered approach to Electron application development. The clear separation of concerns, dependency injection patterns, and service-oriented design provide a solid foundation for maintainability and extensibility.

**Key Strengths**:

- Clear architectural layers with defined responsibilities
- Proper dependency management and injection
- Security-first approach with encrypted storage
- Event-driven coordination for real-time updates
- Modular design supporting independent development

**Recommended Improvements**:

- Implement interface abstractions for better testability
- Add comprehensive error handling strategies
- Consider plugin architecture for platform extensibility
- Enhance performance monitoring and metrics

## 0.8.0 - 2025-01-08

### Added
- **Arweave Deployment System**: New comprehensive deployment functionality for static sites to Arweave network
- **Hybrid Deployment Support**: Combined GitHub Pages and Arweave deployment capabilities
- **Enhanced Site Deploy Manager**: Extended with Arweave integration and deployment cost estimation
- **Deployment Verification**: New verification system for deployed sites with accessibility checks
- **Cost Estimation**: Real-time deployment cost calculation for Arweave uploads

### Changed
- **Site Deploy Manager Architecture**: Enhanced with ArweaveManager integration and unified deployment workflow
- **Type System Extensions**: New interfaces for Arweave deployment configuration and results
- **Deployment Configuration**: Restructured site settings to support multiple deployment providers

### Technical Impact
- **New Dependencies**: Enhanced ArweaveManager with deployment-specific methods
- **API Extensions**: New IPC handlers for Arweave deployment operations
- **Data Flow**: Integrated deployment verification and cost estimation into site deployment workflow
- **Storage**: Extended configuration schema to support hybrid deployment options

---

**Document Version**: 1.1  
**Last Updated**: January 2025  
**Architecture Review**: Required every 6 months
