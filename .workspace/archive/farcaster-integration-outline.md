# Farcaster Integration Outline for Cosmo

## Overview

This document outlines the integration of Farcaster (a decentralized social protocol) into Cosmo's local-first multi-tool interface, mirroring the established patterns used for Bluesky and X (Twitter) integrations.

## Architecture Analysis

### Current Integration Patterns

Based on the existing codebase, Cosmo follows a consistent pattern for social media integrations:

1. **Manager Classes**: Platform-specific managers (`atproto-manager.ts`, `x-manager.ts`)
2. **Account Management**: Multi-account support with secure credential storage
3. **UI Components**: Modal-based account setup and management
4. **IPC Layer**: Electron IPC handlers for renderer-main communication
5. **Credential Security**: System keychain/credential manager integration

### Farcaster Protocol Characteristics

From research and the mast-cli reference:

- **Authentication**: Uses FID (Farcaster ID) + Signer Private Key
- **Protocol**: Decentralized, uses Hubble nodes and Warpcast client
- **Signing Flow**: Requires QR code scanning for signer approval
- **APIs Available**:
  - Farcaster Client API (`api.farcaster.xyz`)
  - Hubble Hub APIs (HTTP/gRPC)
  - Neynar managed signers
  - Direct protocol message submission

## Proposed Integration Approach

### 1. Farcaster Manager (`farcaster-manager.ts`)

```typescript
export interface FarcasterAccount {
  id: string;
  nickname: string;
  fid: number;
  username?: string;
  displayName?: string;
  profileImage?: string;
  authMethod: "managed-signer" | "self-hosted-signer";
  createdAt: string;
  lastUsed: string;
  signerUuid?: string; // For managed signers
  publicKey?: string; // For self-hosted signers
}

export class FarcasterManager {
  // Account management
  addAccount(
    credentials: FarcasterCredentials,
    nickname: string
  ): Promise<FarcasterAccount>;
  removeAccount(accountId: string): Promise<void>;
  listAccounts(): Promise<FarcasterAccount[]>;
  switchAccount(accountId: string): Promise<void>;
  getActiveAccount(): Promise<FarcasterAccount | null>;

  // Authentication & signing
  initiateManagedSigner(fid: number): Promise<SignerRequest>;
  pollSignerApproval(signerUuid: string): Promise<boolean>;
  validateCredentials(accountId: string): Promise<boolean>;

  // Content operations
  publishCast(
    content: string,
    channelId?: string,
    parentCast?: string
  ): Promise<string>;
  getUserProfile(accountId?: string): Promise<FarcasterProfile | null>;
  getChannels(): Promise<FarcasterChannel[]>;

  // Utilities
  isAvailable(): Promise<boolean>;
}
```

### 2. Authentication Flow Options

#### Option A: Neynar Managed Signers (Recommended)

- **Pros**: Simpler for users, no private key management, sponsored transactions
- **Cons**: Dependency on Neynar service
- **Flow**:
  1. User provides FID
  2. Generate managed signer via Neynar API
  3. QR code displayed for Warpcast approval
  4. Poll for approval status
  5. Store signer UUID and tokens

#### Option B: Self-Hosted Signers

- **Pros**: Full decentralization, no third-party dependency
- **Cons**: More complex key management, user pays gas fees
- **Flow**:
  1. Generate Ed25519 key pair locally
  2. Create signed key request using app FID
  3. Submit to Farcaster Client API
  4. QR code for user approval
  5. Store private key securely

#### Option C: Hybrid Approach (CLI Integration)

- **Assessment of mast-cli**: The existing CLI tool could be integrated but has limitations:
  - Requires separate installation and setup
  - CLI-based interaction doesn't fit Cosmo's GUI paradigm
  - Would need wrapper/bridge implementation
  - Not recommended as primary approach

### 3. UI Components

#### Farcaster Account Management Modal

```html
<!-- Mirror existing atproto-accounts-modal structure -->
<div id="farcaster-accounts-modal" class="modal large-modal">
  <div class="modal-header">
    <h3>Farcaster Account Management</h3>
  </div>
  <div class="modal-content">
    <!-- Active Account Section -->
    <div class="active-account-section">
      <h4>Active Account</h4>
      <div id="farcaster-active-account-display">
        <!-- Account info display -->
      </div>
    </div>

    <!-- Account List Section -->
    <div class="accounts-list-section">
      <h4>All Accounts</h4>
      <div id="farcaster-accounts-list">
        <!-- Account list with switch/remove options -->
      </div>
    </div>

    <!-- Add Account Section -->
    <div class="add-account-section">
      <h4>Connect Farcaster Account</h4>
      <form id="farcaster-add-account-form">
        <div class="form-group">
          <label for="farcaster-account-nickname">Account Nickname</label>
          <input type="text" id="farcaster-account-nickname" required />
        </div>
        <div class="form-group">
          <label for="farcaster-fid">Farcaster ID (FID)</label>
          <input type="number" id="farcaster-fid" required />
        </div>
        <!-- Authentication method selection -->
        <div class="form-group">
          <label>Authentication Method</label>
          <select id="farcaster-auth-method">
            <option value="managed">Managed Signer (Recommended)</option>
            <option value="self-hosted">Self-Hosted Signer</option>
          </select>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- Signer Approval Modal -->
<div id="farcaster-signer-modal" class="modal">
  <div class="modal-header">
    <h3>Approve Farcaster Signer</h3>
  </div>
  <div class="modal-content">
    <div class="signer-approval-content">
      <p>Scan this QR code with Warpcast to approve the signer:</p>
      <div id="farcaster-qr-code"></div>
      <div class="approval-status">
        <span id="approval-status-text">Waiting for approval...</span>
      </div>
    </div>
  </div>
</div>
```

### 4. Integration Points

#### IPC Handlers (main.ts)

```typescript
// Farcaster IPC handlers
ipcMain.handle("farcaster:add-account", async (_, credentials, nickname) => {
  return await this.farcasterManager.addAccount(credentials, nickname);
});

ipcMain.handle("farcaster:remove-account", async (_, accountId) => {
  return await this.farcasterManager.removeAccount(accountId);
});

ipcMain.handle("farcaster:list-accounts", async () => {
  return await this.farcasterManager.listAccounts();
});

ipcMain.handle("farcaster:publish-cast", async (_, content, options) => {
  return await this.farcasterManager.publishCast(content, options);
});

// Additional handlers for channels, profiles, etc.
```

#### Preload API (preload.ts)

```typescript
farcaster: {
  addAccount: (credentials: any, nickname: string) =>
    ipcRenderer.invoke('farcaster:add-account', credentials, nickname),
  removeAccount: (accountId: string) =>
    ipcRenderer.invoke('farcaster:remove-account', accountId),
  listAccounts: () =>
    ipcRenderer.invoke('farcaster:list-accounts'),
  switchAccount: (accountId: string) =>
    ipcRenderer.invoke('farcaster:switch-account', accountId),
  getActiveAccount: () =>
    ipcRenderer.invoke('farcaster:get-active-account'),
  publishCast: (content: string, options?: any) =>
    ipcRenderer.invoke('farcaster:publish-cast', content, options),
  getUserProfile: (accountId?: string) =>
    ipcRenderer.invoke('farcaster:get-user-profile', accountId),
  getChannels: () =>
    ipcRenderer.invoke('farcaster:get-channels'),
  isAvailable: () =>
    ipcRenderer.invoke('farcaster:is-available'),
}
```

### 5. Dependencies

#### Required NPM Packages

```json
{
  "@farcaster/hub-nodejs": "^0.11.x", // Core protocol types and utilities
  "@neynar/nodejs-sdk": "^1.x", // Managed signer support
  "qrcode": "^1.5.x", // QR code generation
  "viem": "^1.x" // Ethereum utilities for signing
}
```

### 6. Configuration & Security

#### Credential Storage Pattern

- **Platform identifier**: `farcaster`
- **Account metadata**: `farcaster:accounts` (JSON array)
- **Active account**: `farcaster:activeAccount`
- **Account-specific keys**:
  - `farcaster:signerUuid:{accountId}` (for managed signers)
  - `farcaster:privateKey:{accountId}` (for self-hosted, encrypted)
  - `farcaster:publicKey:{accountId}`
  - `farcaster:fid:{accountId}`

#### Environment Variables

```bash
FARCASTER_APP_FID=      # Your app's registered FID
FARCASTER_APP_MNEMONIC= # App custody wallet mnemonic
NEYNAR_API_KEY=         # If using Neynar services
```

### 7. Implementation Phases

#### Phase 1: Core Infrastructure

- [ ] Create `FarcasterManager` class
- [ ] Implement basic account management
- [ ] Add IPC layer
- [ ] Create UI modals and forms

#### Phase 2: Authentication Flows

- [ ] Implement Neynar managed signer flow
- [ ] Add QR code generation and polling
- [ ] Implement signer approval workflow
- [ ] Add credential validation

#### Phase 3: Content Operations

- [ ] Implement cast publishing
- [ ] Add channel support
- [ ] Implement user profile fetching
- [ ] Add cast reply/thread support

#### Phase 4: Advanced Features

- [ ] Add frame interaction support
- [ ] Implement cast scheduling
- [ ] Add media attachment support
- [ ] Implement feed reading capabilities

### 8. Comparison with Existing Integrations

| Aspect                 | Bluesky       | X (Twitter)       | Farcaster (Proposed) |
| ---------------------- | ------------- | ----------------- | -------------------- |
| **Auth Method**        | App passwords | OAuth 1.0a tokens | Ed25519 signers      |
| **Multi-account**      | ✅            | ✅                | ✅                   |
| **Credential Storage** | Keychain      | Keychain          | Keychain             |
| **Content Format**     | AT Protocol   | Twitter API v2    | Farcaster messages   |
| **Approval Flow**      | Simple login  | API key setup     | QR code + Warpcast   |
| **Rate Limits**        | Generous      | Strict (300/3h)   | Protocol-defined     |
| **Decentralization**   | Federated     | Centralized       | Fully decentralized  |

### 9. Risk Assessment & Mitigations

#### Technical Risks

- **Signer Key Management**: Use system keychain, encrypt at rest
- **API Dependencies**: Implement fallbacks (Neynar → direct protocol)
- **Protocol Evolution**: Design with abstraction layer for future changes

#### User Experience Risks

- **Complex Setup**: Provide clear onboarding flow with help documentation
- **Warpcast Dependency**: Clearly communicate requirement, provide alternatives
- **Gas Fees**: Default to sponsored signers, warn users about self-hosted costs

#### Security Considerations

- **Private Key Storage**: Never log or transmit private keys
- **Signer Scope**: Limit signer permissions where possible
- **Account Verification**: Verify FID ownership during setup

### 10. Success Metrics

- **Adoption**: Number of connected Farcaster accounts
- **Engagement**: Number of casts published through Cosmo
- **Reliability**: Success rate of cast publishing
- **User Satisfaction**: Feedback on setup and usage experience

### 11. Future Enhancements

- **Frame Development**: Tools for creating and testing Farcaster frames
- **Analytics Dashboard**: Cast performance and engagement metrics
- **Automation**: Scheduled posting and cross-platform syndication
- **Advanced Features**: Cast threads, reactions, and frame interactions

## Conclusion

The proposed Farcaster integration follows Cosmo's established patterns while accommodating the unique characteristics of the Farcaster protocol. The hybrid approach supporting both managed and self-hosted signers provides flexibility for different user needs while maintaining the local-first philosophy.

The integration leverages existing infrastructure (credential management, UI patterns, IPC layer) to provide a consistent user experience across all supported social platforms.
