# Multiple Arweave Accounts Implementation Outline

## Overview

Implement support for multiple Arweave accounts with secure credential management, allowing users to:

- Add multiple Arweave wallets with custom nicknames
- Switch between accounts seamlessly
- Manage accounts through a unified modal interface
- Maintain Electron's industry-grade security for credential storage

## Current State Analysis

### Existing Architecture

- **Single Account Model**: Current system stores one wallet per workspace
- **Credential Storage**: Uses `CredentialManager` with encrypted workspace-specific storage
- **Storage Keys**: `arweave:walletJWK` and `arweave:walletAddress`
- **UI Integration**: Setup Wallet button and footer Arweave dropdown
- **Security**: Leverages Electron's secure credential storage (Keychain/Credential Manager)

### Current Limitations

- Only one Arweave account per workspace
- No account switching capability
- No account nicknames or management
- Footer dropdown is placeholder functionality

## Implementation Plan

### Phase 1: Backend Architecture Updates

#### 1.1 Enhanced Credential Storage Schema

**File**: `src/main/credential-manager.ts`

- **New Storage Pattern**:
  - `arweave:accounts` → JSON array of account metadata
  - `arweave:wallet:{accountId}` → Individual wallet JWK storage
  - `arweave:activeAccount` → Currently selected account ID
- **Account Metadata Structure**:
  ```typescript
  interface ArweaveAccount {
    id: string; // UUID for account
    nickname: string; // User-defined name
    address: string; // Wallet address
    createdAt: string; // ISO timestamp
    lastUsed: string; // ISO timestamp
  }
  ```

#### 1.2 ArweaveManager Enhancements

**File**: `src/main/arweave-manager.ts`

- **New Methods**:
  - `addAccount(walletJWK: string, nickname: string): Promise<ArweaveAccount>`
  - `removeAccount(accountId: string): Promise<void>`
  - `listAccounts(): Promise<ArweaveAccount[]>`
  - `switchAccount(accountId: string): Promise<void>`
  - `getActiveAccount(): Promise<ArweaveAccount | null>`
  - `updateAccountNickname(accountId: string, nickname: string): Promise<void>`
- **Modified Methods**:
  - Update existing methods to work with active account concept
  - Maintain backward compatibility during migration

#### 1.3 Migration Strategy

- **Automatic Migration**: Convert existing single wallet to first account
- **Default Nickname**: "Primary Wallet" for migrated accounts
- **Seamless Transition**: No user intervention required

### Phase 2: IPC Interface Updates

#### 2.1 New IPC Handlers

**File**: `src/main/main.ts`

- `archive:add-account` → Add new Arweave account
- `archive:remove-account` → Remove specific account
- `archive:list-accounts` → Get all accounts for workspace
- `archive:switch-account` → Change active account
- `archive:get-active-account` → Get currently active account
- `archive:update-account-nickname` → Rename account

#### 2.2 Enhanced Preload API

**File**: `src/main/preload.ts`

- Expose new account management methods
- Maintain existing API for backward compatibility

### Phase 3: Frontend UI Implementation

#### 3.1 Unified Account Management Modal

**File**: `src/renderer/index.html`

- **Modal ID**: `arweave-accounts-modal`
- **Sections**:
  - Account List (with active indicator)
  - Add New Account form
  - Account actions (switch, rename, remove)
- **Responsive Design**: Handle multiple accounts gracefully

#### 3.2 Modal Structure

```html
<div id="arweave-accounts-modal" class="modal large-modal">
  <div class="modal-header">
    <h3>Arweave Account Management</h3>
    <button class="modal-close">&times;</button>
  </div>
  <div class="modal-content">
    <!-- Active Account Section -->
    <div class="active-account-section">
      <h4>Active Account</h4>
      <div class="active-account-display">
        <!-- Current active account info -->
      </div>
    </div>

    <!-- Account List Section -->
    <div class="accounts-list-section">
      <h4>All Accounts</h4>
      <div class="accounts-list">
        <!-- Account items with switch/edit/delete actions -->
      </div>
    </div>

    <!-- Add Account Section -->
    <div class="add-account-section">
      <h4>Add New Account</h4>
      <form id="add-account-form">
        <div class="form-group">
          <label for="account-nickname">Account Nickname</label>
          <input
            type="text"
            id="account-nickname"
            placeholder="e.g., Personal Wallet"
            required
          />
        </div>
        <div class="form-group">
          <label for="account-jwk">Wallet JWK JSON</label>
          <textarea
            id="account-jwk"
            rows="6"
            placeholder='{"kty":"RSA",...}'
            required
          ></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="primary-btn">Add Account</button>
        </div>
      </form>
    </div>
  </div>
</div>
```

#### 3.3 CSS Styling

**File**: `src/renderer/styles.css`

- **Account List Items**: Card-based layout with actions
- **Active Indicator**: Visual highlight for current account
- **Action Buttons**: Consistent with existing button styling
- **Responsive Layout**: Adapt to different screen sizes

### Phase 4: Event Handling & Logic

#### 4.1 Modal Integration

**File**: `src/renderer/app.js`

- **Unified Entry Point**: Both "Setup Wallet" button and footer dropdown open same modal
- **Dynamic Content**: Modal adapts based on current account state
- **Event Handlers**:
  - Account switching
  - Account addition
  - Account removal
  - Nickname editing

#### 4.2 Footer Integration

- **Enhanced Dropdown**: Show account switcher when multiple accounts exist
- **Quick Switch**: Allow rapid account switching from footer
- **Status Updates**: Reflect active account in footer display

### Phase 5: Security Considerations

#### 5.1 Credential Isolation

- **Separate Storage**: Each account's JWK stored with unique key
- **Secure Deletion**: Proper cleanup when accounts are removed
- **Access Control**: Only active account accessible for operations

#### 5.2 Validation & Error Handling

- **JWK Validation**: Comprehensive validation before storage
- **Duplicate Prevention**: Check for existing accounts with same address
- **Error Recovery**: Graceful handling of corrupted account data

#### 5.3 Audit Trail

- **Account Activity**: Track account creation, switching, and removal
- **Security Logging**: Log security-relevant events
- **Data Integrity**: Validate account data on load

### Phase 6: User Experience Enhancements

#### 6.1 Account Indicators

- **Visual Cues**: Clear indication of active account throughout UI
- **Balance Display**: Show balance for active account
- **Quick Info**: Tooltip with full address on hover

#### 6.2 Account Management Features

- **Nickname Editing**: Inline editing of account nicknames
- **Account Sorting**: Order by last used, creation date, or nickname
- **Search/Filter**: Find accounts quickly in large lists

#### 6.3 Import/Export

- **Bulk Import**: Support for importing multiple accounts
- **Account Export**: Export account metadata (not JWKs) for backup
- **Migration Tools**: Easy workspace-to-workspace account transfer

## Implementation Sequence

### Step 1: Backend Foundation (Day 1)

1. Update `CredentialManager` for multi-account storage
2. Enhance `ArweaveManager` with account management methods
3. Implement migration logic for existing single accounts
4. Add comprehensive error handling and validation

### Step 2: IPC & API Layer (Day 1)

1. Add new IPC handlers in `main.ts`
2. Update preload API with new methods
3. Ensure backward compatibility with existing calls
4. Add proper TypeScript interfaces

### Step 3: Frontend Modal (Day 2)

1. Create unified account management modal HTML
2. Implement CSS styling for account management UI
3. Add modal opening logic from both entry points
4. Create account list rendering functionality

### Step 4: Account Operations (Day 2)

1. Implement account addition workflow
2. Add account switching functionality
3. Create account removal with confirmation
4. Implement nickname editing capabilities

### Step 5: Integration & Polish (Day 3)

1. Update footer dropdown with account switching
2. Enhance UI feedback and loading states
3. Add comprehensive error handling
4. Implement security audit logging

### Step 6: Testing & Validation (Day 3)

1. Test migration from single to multi-account
2. Validate security of credential storage
3. Test account switching across all operations
4. Verify UI responsiveness and accessibility

## Security Architecture

### Credential Storage Security

- **Encryption**: Leverage Electron's built-in credential encryption
- **Isolation**: Each account's JWK stored separately
- **Access Control**: Only active account accessible for operations
- **Secure Cleanup**: Proper deletion of credentials on account removal

### Data Validation

- **JWK Validation**: Comprehensive validation before storage
- **Address Verification**: Derive and verify wallet addresses
- **Duplicate Detection**: Prevent duplicate accounts
- **Input Sanitization**: Sanitize all user inputs

### Audit & Monitoring

- **Security Events**: Log account management operations
- **Error Tracking**: Monitor and log security-relevant errors
- **Data Integrity**: Regular validation of stored account data

## Migration Strategy

### Backward Compatibility

- **Existing Workspaces**: Automatically migrate single wallet to first account
- **API Compatibility**: Maintain existing method signatures
- **Graceful Degradation**: Handle missing or corrupted account data

### Data Migration

1. **Detection**: Check for existing single wallet configuration
2. **Migration**: Convert to multi-account format with default nickname
3. **Validation**: Verify migration success
4. **Cleanup**: Remove old single-wallet storage keys

## Testing Strategy

### Unit Tests

- **Credential Manager**: Test multi-account storage and retrieval
- **Arweave Manager**: Test account management operations
- **Migration Logic**: Test single-to-multi account migration

### Integration Tests

- **IPC Communication**: Test frontend-backend account operations
- **UI Interactions**: Test modal functionality and account switching
- **Security**: Test credential isolation and secure deletion

### User Acceptance Tests

- **Workflow Testing**: Test complete account management workflows
- **Error Scenarios**: Test error handling and recovery
- **Performance**: Test with multiple accounts and large datasets

## Future Enhancements

### Advanced Features

- **Account Groups**: Organize accounts into categories
- **Account Sharing**: Share account metadata across workspaces
- **Advanced Security**: Hardware wallet integration
- **Account Analytics**: Track usage patterns and balances

### Integration Opportunities

- **Cross-Platform Sync**: Sync account configurations across devices
- **Team Collaboration**: Share accounts within team workspaces
- **External Integrations**: Connect with external Arweave tools

This implementation provides a robust, secure, and user-friendly multi-account management system while maintaining the security standards expected from Electron applications.
