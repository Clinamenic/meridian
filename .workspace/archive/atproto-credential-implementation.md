# AT Protocol Credential Management Implementation Plan

## Overview

This document outlines the implementation of AT Protocol (Bluesky) credential management in Cosmo, following the established patterns from the Arweave wallet management system. The goal is to create a robust, secure, and user-friendly credential management system that supports multiple AT Protocol accounts and integrates seamlessly with the broadcast tool for social media posting.

## Current Arweave Implementation Analysis

### Architecture Pattern

The current Arweave implementation follows a multi-layered approach:

1. **CredentialManager (Core)**: Centralized credential storage using Electron's safeStorage
2. **ArweaveManager (Service)**: Service-specific logic for wallet operations
3. **Multi-Account Support**: Multiple wallets with nicknames and switching capability
4. **UI Integration**: Modal-based account management in the renderer process

### Key Features Analyzed

- **Secure Storage**: Uses Electron's `safeStorage` with encryption when available
- **Workspace-Scoped**: Credentials are tied to specific workspaces
- **Account Management**: Add, remove, rename, switch between accounts
- **Validation**: JWK validation and address derivation
- **Legacy Migration**: Backward compatibility for single-wallet setups
- **UI Patterns**: Modal dialogs for account management with real-time updates

### Storage Structure

```
workspace/.cosmo/credentials.json (encrypted)
├── arweave:accounts → JSON array of account metadata
├── arweave:activeAccount → active account ID
├── arweave:wallet:{accountId} → encrypted JWK for each account
└── bluesky:* → (proposed AT Protocol keys)
```

## AT Protocol Implementation Design

### Authentication Mechanisms

AT Protocol authentication will use direct API integration following the existing social manager patterns:

1. **Direct API Authentication** (Primary method)

   - Direct AT Protocol API integration using @atproto/api
   - JWT token management with automatic refresh
   - Session persistence across app restarts
   - Follows existing SocialManager patterns for consistency

2. **CLI-Based Authentication** (Future option)
   - Could be added later for users who prefer CLI workflow
   - Not prioritized for initial implementation

### Account Structure

```typescript
interface ATProtoAccount {
  id: string;
  nickname: string;
  handle: string; // e.g., "user.bsky.social"
  did?: string; // Decentralized identifier
  authMethod: "api"; // Only API method for now
  createdAt: string;
  lastUsed: string;
  isActive?: boolean;
}
```

### Credential Storage Design

```
Credential Keys:
├── bluesky:accounts → JSON array of ATProtoAccount[]
├── bluesky:activeAccount → active account ID
├── bluesky:handle:{accountId} → account handle
├── bluesky:password:{accountId} → encrypted password (for login)
├── bluesky:jwt:{accountId} → JWT access token
├── bluesky:refreshToken:{accountId} → JWT refresh token
└── bluesky:did:{accountId} → DID (decentralized identifier)
```

## Implementation Phases

### Phase 1: Core AT Protocol Manager

**Objective**: Create the foundation service layer

**Components**:

- `ATProtoManager` class (similar to `ArweaveManager`)
- Multi-account support with direct API authentication
- Integration with existing `CredentialManager`
- Extension of existing `SocialManager` for AT Protocol support

**Key Methods**:

```typescript
class ATProtoManager {
  // Account Management
  async addAccount(
    handle: string,
    password: string,
    nickname: string
  ): Promise<ATProtoAccount>;
  async removeAccount(accountId: string): Promise<void>;
  async listAccounts(): Promise<ATProtoAccount[]>;
  async switchAccount(accountId: string): Promise<void>;
  async getActiveAccount(): Promise<ATProtoAccount | null>;
  async updateAccountNickname(
    accountId: string,
    nickname: string
  ): Promise<void>;

  // Authentication & Validation
  async validateAccount(accountId: string): Promise<boolean>;
  async authenticateWithCredentials(
    handle: string,
    password: string
  ): Promise<{ jwt: string; refreshToken: string; did: string }>;
  async refreshAuthentication(accountId: string): Promise<boolean>;

  // API Integration
  async postContent(
    content: string,
    accountId?: string
  ): Promise<string | null>;
  async getProfile(accountId?: string): Promise<ATProtoProfile | null>;
  async validateSession(accountId: string): Promise<boolean>;
}
```

### Phase 2: UI Integration

**Objective**: Create user interface for AT Protocol account management

**Components**:

- AT Protocol accounts modal (similar to Arweave accounts modal)
- Account switcher in footer
- Connection status indicators
- Authentication flow UI

**UI Elements**:

- `atproto-accounts-modal` (parallel to `arweave-accounts-modal`)
- Add account form with handle/password fields
- Account list with switch/rename/remove actions
- Active account display with handle and connection status

### Phase 3: Broadcast Integration

**Objective**: Integrate AT Protocol with the broadcast tool

**Features**:

- AT Protocol posting from broadcast panel
- Account selection per post
- Content preparation and validation
- Post status tracking

**Integration Points**:

- Extend broadcast tool to support AT Protocol
- Add AT Protocol checkbox to post creation modal
- Character limit validation for Bluesky (300 characters)
- Handle posting errors and success states

### Phase 4: Advanced Features (Future)

**Objective**: Enhanced functionality for power users

**Features**:

- Markdown-to-social-post workflow
- Advanced post scheduling and queuing
- Thread support for longer content
- Media attachment handling
- Cross-platform simultaneous posting

**Note**: This phase is deprioritized in favor of robust multi-platform broadcast staging.

## Technical Specifications

### API Integration Strategy

Following the existing SocialManager pattern for direct AT Protocol API integration:

```typescript
// AT Protocol API integration using @atproto/api
import { BskyAgent } from '@atproto/api';

// Authentication with handle/password
async authenticateATProto(handle: string, password: string): Promise<ATProtoSession>

// Session management
async resumeSession(session: ATProtoSession): Promise<boolean>
async refreshSession(refreshToken: string): Promise<ATProtoSession>

// Post operations
async createPost(content: string, agent: BskyAgent): Promise<{uri: string, cid: string}>
```

### Error Handling

- **Authentication Failed**: Handle invalid credentials, prompt for re-authentication
- **Session Expired**: Automatic token refresh, fallback to re-login
- **Network Errors**: Retry logic with exponential backoff
- **Invalid Content**: Content validation before posting (length, format)
- **Rate Limiting**: Respect AT Protocol rate limits with queuing

### Security Considerations

- Store passwords using Electron's `safeStorage`
- Never log sensitive credentials
- Secure cleanup of temporary authentication data
- Workspace-scoped credential isolation

## Integration with Existing Systems

### CredentialManager Extension

Add AT Protocol support to existing credential validation:

```typescript
private getRequiredCredentialKeys(service: Platform): string[] {
  switch (service) {
    case 'bluesky':
      return ['jwt', 'refreshToken', 'did', 'handle']; // API method
    // ... existing cases
  }
}
```

### Footer Status Updates

Extend footer status indicators:

- Show active AT Protocol handle
- Connection status (connected/disconnected)
- Account switching dropdown

### Broadcast Tool Enhancement

- Add AT Protocol to platform selection
- Implement character counting for Bluesky
- Handle AT Protocol-specific post formatting

## Migration Considerations

### From jasper_atproto.py

- Port credential loading logic
- Adapt CLI execution patterns
- Maintain compatibility with existing data structures

### User Experience

- Smooth onboarding for AT Protocol accounts
- Clear authentication status indicators
- Intuitive account switching interface

## Testing Strategy

### Unit Tests

- Credential storage and retrieval
- Account management operations
- CLI command construction and execution

### Integration Tests

- End-to-end posting workflow
- Account switching functionality
- Error handling scenarios

### User Acceptance Tests

- Account setup workflow
- Posting from markdown files
- Multi-account management

## Future Enhancements

### Advanced Features

- Direct AT Protocol API integration (bypass CLI)
- Advanced post scheduling
- Thread support for longer content
- Media attachment handling

### Analytics & Monitoring

- Post success/failure tracking
- Account usage analytics
- Performance monitoring

## Implementation Priority

Based on clarifications, the implementation will prioritize:

1. **Phase 1**: Core AT Protocol Manager with direct API integration
2. **Phase 2**: UI Integration for account management
3. **Phase 3**: Broadcast tool integration for multi-platform posting
4. **Phase 4**: Advanced features (deprioritized)

### Key Decisions Made

- **Direct API Integration**: Using @atproto/api instead of CLI approach
- **Multi-Platform Focus**: AT Protocol as one of many social platforms in broadcast tool
- **Account Purpose Agnostic**: Support multiple handles without presuming use cases
- **Staging Workflow**: Focus on draft/preview system for social posts

## Next Steps

1. Implement `ATProtoManager` class following `ArweaveManager` patterns
2. Extend existing `SocialManager` to include AT Protocol support
3. Add AT Protocol account management UI (modal system)
4. Integrate with broadcast tool for multi-platform posting
5. Add AT Protocol to footer status indicators

This implementation plan provides a roadmap for creating a robust AT Protocol credential management system that follows the established patterns while meeting the specific needs of social media content staging and markdown integration.
