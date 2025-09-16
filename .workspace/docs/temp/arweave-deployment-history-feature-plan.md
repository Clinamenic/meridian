# Arweave Deployment History Feature Implementation Plan

## Overview

This document outlines the implementation of a comprehensive Arweave deployment history tracking system that stores deployment records in `.meridian/data/site-history.json` and provides a UI to view previous deployments.

## Current Architecture Analysis

### Existing Components

1. **DeployManager.js** (Frontend)
   - Handles Arweave deployment UI and form submission
   - Currently stores `lastArweaveDeployment` in memory only
   - Contains deployment flow in `handleArweaveDeploySubmit()`

2. **ArweaveManager.ts** (Backend)
   - Manages actual Arweave deployment operations
   - Returns `ArweaveDeployResult` with deployment details
   - Handles wallet management and cost estimation

3. **DataManager.ts** (Backend)
   - Manages workspace structure (`.meridian/` directories)
   - Already handles JSON file storage in `.meridian/data/`
   - Provides consistent file management patterns

4. **Existing Data Flow**
   ```
   UI Form → DeployManager → IPC → SiteDeployManager → ArweaveManager → Arweave Network
                ↓
   ArweaveDeployResult → Display in UI (memory only)
   ```

### Current Deployment Data Structure

```typescript
interface ArweaveDeployResult {
  success: boolean;
  url?: string;
  manifestUrl?: string;
  manifestHash?: string;
  transactionId?: string;
  totalCost: { ar: string; usd?: string };
  fileCount?: number;
  totalSize?: number;
  uploadedFiles?: ArweaveDeployFile[];
  indexFile?: { url: string; hash: string };
  error?: string;
}
```

## Feature Requirements

### 1. Data Storage

- **Location**: `.meridian/data/site-history.json`
- **Format**: JSON array of deployment records
- **Persistence**: Survives app restarts and workspace changes
- **Migration**: Handle existing deployments gracefully

### 2. UI Components

- **History List**: Display previous deployments in Deploy to Arweave section
- **Deployment Cards**: Show key details for each deployment
- **Actions**: View deployment, copy URL, open in browser
- **Timestamps**: Human-readable deployment dates
- **Status Indicators**: Success/failure states

### 3. Data Management

- **Automatic Recording**: Save every successful deployment
- **Error Handling**: Handle corrupted/missing history files
- **Cleanup**: Optional pruning of old deployments
- **Export**: Ability to export history data

## Implementation Plan

### Phase 1: Backend Data Layer

#### 1.1 Define History Data Types
```typescript
// Add to src/types/index.ts
export interface ArweaveDeploymentHistoryRecord {
  id: string;                    // Unique deployment ID
  timestamp: string;             // ISO 8601 timestamp
  siteId: string;               // Site ID used for deployment
  manifestHash: string;         // Arweave manifest transaction ID
  url: string;                  // Primary site URL
  manifestUrl?: string;         // Manifest URL
  indexFileUrl?: string;        // Index file URL
  totalCost: {
    ar: string;
    usd?: string;
  };
  fileCount: number;
  totalSize: number;
  deploymentStrategy: 'full' | 'incremental';
  status: 'success' | 'failed';
  error?: string;               // Error message if failed
  uploadedFiles?: ArweaveDeployFile[];
  metadata?: {
    userAgent?: string;
    version?: string;
  };
}

export interface ArweaveDeploymentHistory {
  version: string;              // Schema version for migrations
  deployments: ArweaveDeploymentHistoryRecord[];
  lastUpdated: string;
}
```

#### 1.2 Create History Manager
```typescript
// New file: src/main/arweave-history-manager.ts
export class ArweaveHistoryManager {
  private workspacePath: string;
  private historyFilePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.historyFilePath = path.join(workspacePath, '.meridian', 'data', 'site-history.json');
  }

  async loadHistory(): Promise<ArweaveDeploymentHistory>
  async saveHistory(history: ArweaveDeploymentHistory): Promise<void>
  async addDeployment(record: ArweaveDeploymentHistoryRecord): Promise<void>
  async getDeploymentById(id: string): Promise<ArweaveDeploymentHistoryRecord | null>
  async getDeploymentsBySiteId(siteId: string): Promise<ArweaveDeploymentHistoryRecord[]>
  async getAllDeployments(): Promise<ArweaveDeploymentHistoryRecord[]>
  async deleteDeployment(id: string): Promise<boolean>
  async pruneHistory(maxAge: number): Promise<number> // Delete deployments older than maxAge days
  private ensureHistoryFile(): Promise<void>
  private migrateHistorySchema(history: any): ArweaveDeploymentHistory
}
```

#### 1.3 Integrate with Existing Deployment Flow
- Modify `SiteDeployManager.deployToArweave()` to record successful deployments
- Add IPC handlers for history operations
- Update preload.ts with history API methods

### Phase 2: Frontend UI Components

#### 2.1 History UI Component Structure
```html
<!-- Add to Deploy to Arweave section -->
<div class="deployment-history-section" id="arweave-deployment-history">
  <div class="history-header">
    <h5>Deployment History</h5>
    <div class="history-actions">
      <button class="secondary-btn" id="refresh-history-btn">↻ Refresh</button>
      <button class="secondary-btn" id="export-history-btn">↓ Export</button>
    </div>
  </div>
  
  <div class="history-list" id="deployment-history-list">
    <!-- Dynamic content -->
  </div>
  
  <div class="history-pagination" id="history-pagination" style="display: none;">
    <!-- Pagination controls if needed -->
  </div>
</div>
```

#### 2.2 Deployment Card Template
```html
<div class="deployment-card" data-deployment-id="{id}">
  <div class="deployment-header">
    <div class="deployment-info">
      <h6 class="deployment-site-id">{siteId}</h6>
      <span class="deployment-timestamp">{timestamp}</span>
    </div>
    <div class="deployment-status">
      <span class="status-badge {status}">{status}</span>
    </div>
  </div>
  
  <div class="deployment-details">
    <div class="deployment-stats">
      <span class="stat">📁 {fileCount} files</span>
      <span class="stat">💾 {totalSize}</span>
      <span class="stat">💰 {cost} AR</span>
    </div>
    
    <div class="deployment-actions">
      <button class="action-btn" data-action="view" data-url="{url}">🌐 View Site</button>
      <button class="action-btn" data-action="copy" data-url="{url}">📋 Copy URL</button>
      <button class="action-btn" data-action="manifest" data-url="{manifestUrl}">📄 Manifest</button>
      <button class="action-btn" data-action="details" data-id="{id}">ℹ️ Details</button>
    </div>
  </div>
</div>
```

#### 2.3 Enhanced DeployManager Methods
```javascript
// Add to DeployManager.js
async loadDeploymentHistory()
async refreshDeploymentHistory()
renderDeploymentHistory(deployments)
renderDeploymentCard(deployment)
handleHistoryAction(action, data)
showDeploymentDetails(deploymentId)
exportDeploymentHistory()
formatDeploymentTimestamp(timestamp)
```

### Phase 3: Integration Points

#### 3.1 Modify Existing Deployment Flow
1. **handleArweaveDeploySubmit()**: Add history recording after successful deployment
2. **checkArweaveWalletStatus()**: Load and display recent deployment
3. **generateUnifiedDeployContent()**: Include history section in UI
4. **setupArweaveEvents()**: Add history event listeners

#### 3.2 IPC API Extensions
```typescript
// Add to preload.ts
deploy: {
  // ... existing methods
  getDeploymentHistory: () => Promise<ArweaveDeploymentHistoryRecord[]>;
  getDeploymentById: (id: string) => Promise<ArweaveDeploymentHistoryRecord | null>;
  exportDeploymentHistory: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
  deleteDeployment: (id: string) => Promise<boolean>;
}
```

### Phase 4: Styling and UX

#### 4.1 CSS Classes
```css
/* Add to deploy-manager.css */
.deployment-history-section { /* Container styling */ }
.history-header { /* Header with title and actions */ }
.history-list { /* Scrollable list container */ }
.deployment-card { /* Individual deployment card */ }
.deployment-header { /* Card header with title and status */ }
.deployment-details { /* Card details section */ }
.deployment-stats { /* Statistics display */ }
.deployment-actions { /* Action buttons */ }
.status-badge { /* Success/failure indicator */ }
.action-btn { /* Action button styling */ }
```

#### 4.2 Responsive Design
- Collapsible deployment cards for mobile
- Horizontal scrolling for action buttons
- Adaptive text sizing
- Touch-friendly targets

### Phase 5: Error Handling and Edge Cases

#### 5.1 Data Integrity
- Handle corrupted history files
- Validate deployment record structure
- Automatic backup before modifications
- Graceful degradation when history unavailable

#### 5.2 Performance Considerations
- Paginate large deployment lists
- Lazy load deployment details
- Cache recently accessed records
- Optimize JSON file size

#### 5.3 User Experience
- Loading states for async operations
- Error messages for failed operations
- Confirmation dialogs for destructive actions
- Keyboard navigation support

## File Changes Required

### New Files
- `src/main/arweave-history-manager.ts` - History data management
- `src/renderer/styles/modules/deployment-history.css` - History UI styling

### Modified Files
- `src/types/index.ts` - Add history data types
- `src/main/site-deploy-manager.ts` - Integrate history recording
- `src/main/preload.ts` - Add history IPC methods
- `src/renderer/modules/DeployManager.js` - Add history UI and logic
- `src/renderer/styles/modules/deploy-manager.css` - Update existing styles

### Configuration Files
- Update package.json if new dependencies needed
- Update tsconfig.json if new compile options required

## Testing Strategy

### Unit Tests
- ArweaveHistoryManager data operations
- History record validation
- Migration logic testing

### Integration Tests
- End-to-end deployment recording
- UI interaction testing
- File system integration testing

### Manual Testing
- Create multiple deployments
- Test history display and actions
- Verify data persistence
- Test error scenarios

## Migration Strategy

### Existing Users
1. Create empty history file on first load
2. Optionally import `lastArweaveDeployment` if present
3. Provide option to manually add previous deployments

### Schema Versioning
- Version 1.0: Initial schema
- Migration path for future schema changes
- Backward compatibility considerations

## Future Enhancements

### Phase 6: Advanced Features
- Deployment comparison tool
- Cost analytics and trends
- Deployment scheduling
- Batch operations on history
- Integration with external analytics

### Phase 7: Collaboration Features
- Shared deployment history
- Team notifications
- Deployment comments/notes
- Role-based access control

## Success Criteria

1. ✅ All deployments automatically recorded
2. ✅ History persists across app restarts
3. ✅ UI provides easy access to previous deployments
4. ✅ Action buttons work reliably (view, copy, etc.)
5. ✅ Performance remains good with 100+ deployments
6. ✅ Error handling prevents data loss
7. ✅ Export functionality works correctly
8. ✅ Code follows existing patterns and standards

## Implementation Timeline

- **Week 1**: Backend data layer (Phase 1)
- **Week 2**: Frontend UI components (Phase 2)
- **Week 3**: Integration and styling (Phases 3-4)
- **Week 4**: Testing and polish (Phase 5)

## Risk Assessment

### Technical Risks
- **Medium**: File system permissions issues
- **Low**: JSON parsing/corruption
- **Low**: UI performance with large datasets

### Mitigation Strategies
- Comprehensive error handling
- Regular automated backups
- Performance testing with large datasets
- Progressive loading for large histories

This implementation will provide users with a comprehensive view of their Arweave deployment history while maintaining the existing user experience and following established patterns in the Meridian codebase.

