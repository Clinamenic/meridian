# Arweave Deployment Research for Meridian

## Executive Summary

This document explores strategies for implementing Arweave deployment capabilities in Meridian, complementing the existing GitHub Pages deployment workflow. The research focuses on manifest-based deployment approaches that align with Meridian's modular architecture and existing Arweave integration.

## Current State Analysis

### Existing Arweave Integration

Meridian already has robust Arweave capabilities through:

1. **ArweaveManager** (`src/main/arweave-manager.ts`)

   - Individual file uploads with `arkb` CLI
   - Bundle uploads for multiple files
   - Wallet management and account switching
   - Cost estimation and transaction verification
   - Tag-based metadata system
   - Integration with UnifiedDatabaseManager for resource tracking

2. **Resource Integration**

   - Arweave uploads integrated into unified resource management
   - File registry with Arweave hash tracking via `UnifiedResource` interface
   - Upload status monitoring and verification
   - UUID-based file identification and tracking

3. **Deployment Infrastructure**
   - GitHub Pages deployment via `DeployManager` (`src/main/site-deploy-manager.ts`)
   - Quartz site building and static export
   - GitHub Actions workflow generation
   - Modular architecture with clear separation of concerns

### Current Limitations

- No systematic site-wide Arweave deployment
- Individual file uploads only (no manifest-based approach)
- No integration between Quartz build process and Arweave deployment
- Limited coordination between GitHub Pages and Arweave deployments

## Meridian Architecture Compatibility Analysis

### Existing Manager Pattern

Meridian follows a consistent manager pattern:

```typescript
// Pattern: Manager classes with dependency injection
class ManagerName {
  private dependencyManager: DependencyManager;

  constructor(dependencyManager: DependencyManager) {
    this.dependencyManager = dependencyManager;
  }

  // Public methods with clear interfaces
  async publicMethod(): Promise<ResultType> {
    // Implementation
  }
}
```

### Current Manager Dependencies

From `src/main/main.ts`:

```typescript
// ArweaveManager dependencies
this.arweaveManager = new ArweaveManager(
  this.dataManager,
  this.unifiedDatabaseManager
);

// DeployManager dependencies
this.deployManager = new DeployManager(); // Currently standalone

// GitHubManager dependencies
this.githubManager = new GitHubManager(); // Currently standalone
```

### IPC Handler Pattern

All managers register IPC handlers in their constructors:

```typescript
private registerIpcHandlers(): void {
  ipcMain.handle('manager:method', (_, ...args) => this.method(...args));
}
```

## Arweave Deployment Strategy Options

### Option 1: Manifest-Based Bundle Deployment (RECOMMENDED)

**Approach**: Create a deployment manifest that defines the entire site structure and uploads all files as a coordinated bundle.

**Implementation Strategy**:

```typescript
interface ArweaveDeployManifest {
  version: string;
  timestamp: string;
  siteId: string;
  baseUrl: string;
  files: ArweaveDeployFile[];
  metadata: {
    title: string;
    description: string;
    tags: string[];
  };
}

interface ArweaveDeployFile {
  path: string;
  hash: string;
  size: number;
  contentType: string;
  tags: Record<string, string>;
}
```

**Benefits**:

- Atomic deployment (all files succeed or fail together)
- Clear site structure documentation
- Easy rollback and version management
- Cost-effective bundle pricing
- Compatible with existing ArweaveManager bundle functionality

**Integration Points**:

- Extend `DeployManager` with Arweave deployment methods
- Integrate with existing Quartz build process
- Add manifest generation to build pipeline
- Leverage existing ArweaveManager bundle upload capabilities

### Option 2: Incremental Deployment with Manifest Tracking

**Approach**: Maintain a deployment manifest that tracks all uploaded files, enabling incremental updates and change detection.

**Implementation Strategy**:

```typescript
interface ArweaveDeployState {
  lastDeployHash: string;
  deployedFiles: Map<string, ArweaveDeployFile>;
  siteManifestHash: string;
  deploymentHistory: ArweaveDeployRecord[];
}

interface ArweaveDeployRecord {
  timestamp: string;
  manifestHash: string;
  filesAdded: string[];
  filesModified: string[];
  filesRemoved: string[];
  totalCost: string;
}
```

**Benefits**:

- Efficient incremental updates
- Change detection and selective uploads
- Deployment history and audit trail
- Cost optimization through minimal uploads
- Compatible with existing UnifiedDatabaseManager for state persistence

**Integration Points**:

- Extend `DataManager` with deployment state tracking
- Add file change detection to build process
- Integrate with existing Arweave upload infrastructure
- Use UnifiedDatabaseManager for deployment state persistence

### Option 3: Hybrid GitHub Pages + Arweave Deployment

**Approach**: Deploy to both GitHub Pages and Arweave simultaneously, with Arweave serving as a decentralized backup/mirror.

**Implementation Strategy**:

```typescript
interface HybridDeployConfig {
  githubPages: GitHubDeployConfig;
  arweave: ArweaveDeployConfig;
  syncStrategy: "parallel" | "sequential" | "fallback";
  crossReference: boolean; // Link GitHub Pages to Arweave hashes
}
```

**Benefits**:

- Redundant deployment for reliability
- Decentralized backup of site content
- Cross-platform content verification
- Enhanced content permanence
- Leverages existing GitHub deployment infrastructure

**Integration Points**:

- Extend `DeployManager` with hybrid deployment options
- Add Arweave hash references to GitHub Pages metadata
- Implement cross-platform content verification
- Use existing GitHubManager and ArweaveManager coordination

## Recommended Implementation: Option 1 + 2 Hybrid

### Phase 1: Manifest-Based Deployment

1. **Extend DeployManager with Arweave Capabilities**

   ```typescript
   // Add to existing DeployManager class
   class DeployManager {
     private arweaveManager: ArweaveManager;
     private dataManager: DataManager;
     private unifiedDatabaseManager: UnifiedDatabaseManager;

     constructor() {
       // Existing constructor logic
       this.registerArweaveIpcHandlers();
     }

     private registerArweaveIpcHandlers(): void {
       ipcMain.handle("deploy:arweave-manifest", (_, config) =>
         this.generateArweaveManifest(config)
       );
       ipcMain.handle("deploy:arweave-deploy", (_, config) =>
         this.deployToArweave(config)
       );
       ipcMain.handle("deploy:arweave-verify", (_, manifestHash) =>
         this.verifyArweaveDeployment(manifestHash)
       );
       ipcMain.handle("deploy:hybrid-deploy", (_, config) =>
         this.deployHybrid(config)
       );
     }

     async generateArweaveManifest(
       config: ArweaveDeployConfig
     ): Promise<ArweaveDeployManifest>;
     async deployToArweave(
       config: ArweaveDeployConfig
     ): Promise<ArweaveDeployResult>;
     async verifyArweaveDeployment(
       manifestHash: string
     ): Promise<DeploymentVerification>;
     async deployHybrid(
       config: HybridDeployConfig
     ): Promise<HybridDeployResult>;
   }
   ```

2. **Extend ArweaveManager with Site Deployment Methods**

   ```typescript
   // Add to existing ArweaveManager class
   class ArweaveManager {
     // Existing methods...

     async uploadSiteManifest(
       manifest: ArweaveDeployManifest
     ): Promise<UploadResult> {
       // Implementation using existing bundle upload capabilities
     }

     async uploadSiteBundle(
       buildPath: string,
       manifest: ArweaveDeployManifest
     ): Promise<UploadResult> {
       // Implementation using existing bundle upload capabilities
     }

     async estimateSiteDeploymentCost(
       manifest: ArweaveDeployManifest
     ): Promise<DeploymentCostEstimate> {
       // Implementation using existing cost estimation
     }
   }
   ```

3. **Add Deployment State Management**

   ```typescript
   // Extend DataManager with deployment state tracking
   class DataManager {
     // Existing methods...

     async saveArweaveDeploymentState(
       state: ArweaveDeployState
     ): Promise<void> {
       // Implementation using existing data persistence
     }

     async getArweaveDeploymentState(
       siteId: string
     ): Promise<ArweaveDeployState | null> {
       // Implementation using existing data retrieval
     }

     async updateArweaveDeploymentHistory(
       siteId: string,
       record: ArweaveDeployRecord
     ): Promise<void> {
       // Implementation using existing data persistence
     }
   }
   ```

### Phase 2: Incremental Deployment

1. **Deployment State Management**

   ```typescript
   interface DeploymentState {
     siteId: string;
     currentManifest: ArweaveDeployManifest;
     deploymentHistory: ArweaveDeployRecord[];
     lastDeployTimestamp: string;
   }
   ```

2. **Change Detection**

   - Compare current build with last deployment
   - Identify added, modified, and removed files
   - Generate incremental manifest for changes only
   - Leverage existing file scanning capabilities from DeployManager

3. **Cost Optimization**
   - Estimate costs for incremental vs. full deployment
   - Provide user choice between deployment strategies
   - Track deployment costs and history using existing cost estimation

## Technical Implementation Details

### Manifest Structure

```json
{
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00Z",
  "siteId": "meridian-site-abc123",
  "baseUrl": "https://arweave.net/abc123...",
  "files": [
    {
      "path": "/index.html",
      "hash": "def456...",
      "size": 1234,
      "contentType": "text/html",
      "tags": {
        "Content-Type": "text/html",
        "meridian:site-id": "meridian-site-abc123",
        "meridian:file-path": "/index.html",
        "meridian:deploy-version": "1.0.0"
      }
    }
  ],
  "metadata": {
    "title": "My Meridian Site",
    "description": "Personal digital garden",
    "tags": ["meridian", "quartz", "digital-garden"],
    "generator": "Meridian Quartz",
    "deployTimestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Integration with Existing Architecture

1. **Extend Existing Managers**

   ```typescript
   // Add to ArweaveManager (existing class)
   async uploadManifest(manifest: ArweaveDeployManifest): Promise<UploadResult>
   async uploadSiteBundle(buildPath: string, manifest: ArweaveDeployManifest): Promise<UploadResult>
   async estimateSiteDeploymentCost(manifest: ArweaveDeployManifest): Promise<DeploymentCostEstimate>

   // Add to DeployManager (existing class)
   async buildAndDeployToArweave(config: ArweaveDeployConfig): Promise<DeployResult>
   async deployToBothPlatforms(config: HybridDeployConfig): Promise<HybridDeployResult>
   async generateArweaveManifest(config: ArweaveDeployConfig): Promise<ArweaveDeployManifest>
   ```

2. **Extend Existing Types**

   ```typescript
   // Add to src/types/index.ts
   export interface ArweaveDeployConfig {
     workspacePath: string;
     siteId: string;
     manifestOnly?: boolean;
     incremental?: boolean;
     costEstimate?: boolean;
   }

   export interface ArweaveDeployResult extends DeployResult {
     manifestHash: string;
     totalCost: { ar: string; usd?: string };
     fileCount: number;
     totalSize: number;
   }

   export interface HybridDeployConfig {
     githubPages: GitHubDeployConfig;
     arweave: ArweaveDeployConfig;
     syncStrategy: "parallel" | "sequential" | "fallback";
     crossReference: boolean;
   }

   export interface HybridDeployResult {
     githubPages: DeployResult;
     arweave: ArweaveDeployResult;
     crossReferences: {
       githubUrl: string;
       arweaveUrl: string;
     };
   }
   ```

3. **UI Integration**
   - Add Arweave deployment options to existing deploy panel
   - Show deployment progress and cost estimation
   - Display deployment history and verification status
   - Extend existing DeployManager.js renderer module

### Deployment Workflow

1. **Build Phase**

   - Build Quartz site (existing functionality)
   - Generate deployment manifest
   - Calculate costs and show user confirmation

2. **Deploy Phase**

   - Upload site bundle to Arweave using existing ArweaveManager
   - Generate site manifest with all file references
   - Upload manifest as site entry point

3. **Verification Phase**

   - Verify all files are accessible
   - Test site functionality
   - Update deployment state using existing data management

4. **Integration Phase**
   - Link GitHub Pages deployment with Arweave hashes
   - Update site metadata with cross-references
   - Provide user with both deployment URLs

## Cost Considerations

### Current Arweave Pricing

- Storage: ~2.43 AR per GiB
- Transaction fees: Minimal
- Bundle uploads: More cost-effective than individual uploads

### Cost Optimization Strategies

1. **Incremental Deployments**: Only upload changed files
2. **Bundle Uploads**: Use existing arkb bundle functionality
3. **Compression**: Compress assets before upload
4. **Selective Deployment**: Allow users to exclude certain file types

### Cost Estimation

```typescript
interface DeploymentCostEstimate {
  totalSize: number;
  arCost: string;
  usdCost?: string;
  breakdown: {
    html: number;
    css: number;
    js: number;
    images: number;
    other: number;
  };
}
```

## Security and Reliability

### Security Considerations

1. **Wallet Management**: Use existing secure wallet storage via CredentialManager
2. **Transaction Verification**: Verify all uploads before marking complete
3. **Content Integrity**: Hash verification for all uploaded files
4. **Access Control**: Consider future access control mechanisms

### Reliability Features

1. **Retry Logic**: Automatic retry for failed uploads
2. **Verification**: Post-upload verification of all files
3. **Rollback**: Ability to rollback to previous deployment
4. **Monitoring**: Track deployment status and health

## User Experience Design

### Deployment Options UI

```typescript
interface DeployOptions {
  platform: "github-pages" | "arweave" | "both";
  strategy: "full" | "incremental";
  costEstimate: DeploymentCostEstimate;
  verification: boolean;
  crossReference: boolean;
}
```

### Progress Tracking

- Real-time upload progress
- Cost tracking during deployment
- Verification status updates
- Deployment completion summary

### Deployment History

- View previous deployments
- Compare deployment costs
- Access deployment manifests
- Rollback to previous versions

## Implementation Timeline

### Phase 1: Foundation (2-3 weeks)

1. Extend `ArweaveManager` with site deployment methods
2. Extend `DeployManager` with Arweave deployment capabilities
3. Add manifest generation functionality
4. Integrate with existing build process

### Phase 2: Enhancement (2-3 weeks)

1. Add incremental deployment capabilities
2. Implement deployment state tracking via DataManager
3. Add cost estimation and optimization
4. Create deployment history management

### Phase 3: Integration (1-2 weeks)

1. Add UI components for Arweave deployment
2. Integrate with existing deploy panel
3. Add deployment verification and monitoring
4. Implement cross-platform deployment options

### Phase 4: Polish (1 week)

1. Add comprehensive error handling
2. Implement retry logic and rollback
3. Add deployment analytics and reporting
4. Documentation and user guides

## Risk Assessment

### Technical Risks

1. **Arweave Network Issues**: Network congestion or downtime
2. **Cost Fluctuation**: AR price volatility affecting deployment costs
3. **Bundle Size Limits**: Large sites may exceed practical upload limits
4. **Verification Complexity**: Ensuring all files are properly uploaded

### Mitigation Strategies

1. **Network Monitoring**: Check Arweave network status before deployment
2. **Cost Estimation**: Provide conservative cost estimates with buffers
3. **Chunked Uploads**: Split large deployments into manageable chunks
4. **Comprehensive Verification**: Multi-stage verification process

## Success Metrics

### Technical Metrics

- Deployment success rate > 95%
- Average deployment time < 10 minutes
- Cost accuracy within 10% of estimates
- Zero data loss in deployments

### User Experience Metrics

- User adoption rate of Arweave deployment
- Reduction in deployment-related support requests
- User satisfaction with deployment process
- Time saved in deployment workflows

## Conclusion

The recommended manifest-based Arweave deployment strategy provides a robust foundation for decentralized site hosting while maintaining full compatibility with Meridian's existing modular architecture. The implementation leverages existing Arweave infrastructure and integrates seamlessly with the current deployment workflow, providing users with additional deployment options without disrupting existing functionality.

The proposed approach follows Meridian's established patterns:

- Manager-based architecture with dependency injection
- IPC handler registration for renderer communication
- Integration with existing data management systems
- Extension of existing types and interfaces
- Modular separation of concerns

## Next Steps

1. **Architecture Review**: Review proposed architecture with development team
2. **Prototype Development**: Create proof-of-concept manifest generation
3. **Cost Analysis**: Conduct detailed cost analysis for typical site sizes
4. **User Research**: Gather feedback on deployment preferences and requirements
5. **Implementation Planning**: Create detailed implementation plan with milestones
