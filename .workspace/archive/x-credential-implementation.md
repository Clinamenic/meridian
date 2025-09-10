# X (Twitter) Credential Management Implementation Plan

## Overview

This document outlines the implementation of X (formerly Twitter) credential management in Cosmo, following the established patterns from the Bluesky AT Protocol integration. The goal is to create a robust, secure, and user-friendly credential management system that supports multiple X accounts and integrates seamlessly with the broadcast tool for social media posting.

## Current Bluesky Implementation Analysis

### Architecture Pattern (Established)

The Bluesky implementation follows a proven multi-layered approach:

1. **CredentialManager (Core)**: Centralized credential storage using Electron's safeStorage
2. **XManager (New)**: X-specific account and API management
3. **UI Integration**: Modal-based account management with real-time status updates
4. **Broadcast Integration**: Direct posting with session validation and error handling

## X API Authentication Methods

X offers several authentication approaches, each with different capabilities and requirements:

### 1. **OAuth 2.0 with PKCE** (Recommended)

- **Pros**: Most secure, user-friendly, supports all API endpoints
- **Cons**: Requires web browser flow, more complex implementation
- **Use Case**: Full-featured posting, reading, user management
- **Scopes Needed**: `tweet.read`, `tweet.write`, `users.read`

### 2. **OAuth 1.0a** (Legacy but Reliable)

- **Pros**: Well-established, works without browser flow
- **Cons**: More complex signature process, older standard
- **Use Case**: Posting, basic user info
- **Credentials**: API Key, API Secret, Access Token, Access Token Secret

### 3. **Bearer Token** (Read-only)

- **Pros**: Simple implementation
- **Cons**: Read-only access, no posting capability
- **Use Case**: Not suitable for our posting needs

## Recommended Implementation: OAuth 1.0a

For Cosmo's use case, **OAuth 1.0a** is recommended because:

- ✅ Supports posting (tweet.write)
- ✅ No browser flow required (can use app-specific credentials)
- ✅ Established pattern with good library support
- ✅ Similar complexity to Bluesky implementation
- ✅ Works well for desktop applications

## Technical Implementation Plan

### Phase 1: Core X Manager

#### XManager Class Structure

```typescript
export interface XAccount {
  id: string;
  nickname: string;
  username: string;
  userId: string;
  authMethod: "oauth1";
  createdAt: string;
  lastUsed: string;
}

export interface XCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export class XManager {
  // Account Management
  async addAccount(
    apiKey: string,
    apiSecret: string,
    accessToken: string,
    accessTokenSecret: string,
    nickname: string
  ): Promise<XAccount>;
  async removeAccount(accountId: string): Promise<void>;
  async listAccounts(): Promise<XAccount[]>;
  async switchAccount(accountId: string): Promise<void>;
  async getActiveAccount(): Promise<XAccount | null>;
  async updateAccountNickname(
    accountId: string,
    nickname: string
  ): Promise<void>;

  // Authentication & Validation
  async validateCredentials(accountId: string): Promise<boolean>;
  async refreshUserInfo(accountId: string): Promise<void>;

  // API Integration
  async postTweet(content: string, accountId?: string): Promise<string | null>;
  async getUserInfo(accountId?: string): Promise<XUserInfo | null>;
  async isAvailable(): Promise<boolean>;
}
```

#### Credential Storage Pattern

Following the established pattern:

```
x:accounts → JSON array of account metadata
x:activeAccount → active account ID
x:apiKey:{accountId} → encrypted API key
x:apiSecret:{accountId} → encrypted API secret
x:accessToken:{accountId} → encrypted access token
x:accessTokenSecret:{accountId} → encrypted access token secret
```

### Phase 2: UI Integration

#### Account Management Modal

- **Modal ID**: `x-accounts-modal`
- **Structure**: Mirror the Bluesky modal layout
- **Form Fields**:
  - Account Nickname
  - API Key
  - API Secret
  - Access Token
  - Access Token Secret

#### Help Documentation

```html
<details>
  <summary>How to get your X API credentials</summary>
  <div class="help-content">
    <ol>
      <li>
        Go to
        <a href="https://developer.twitter.com" target="_blank"
          >X Developer Portal</a
        >
      </li>
      <li>Create a new app or use existing app</li>
      <li>Generate API Key & Secret</li>
      <li>Generate Access Token & Secret</li>
      <li>Copy all four credentials</li>
    </ol>
    <p><strong>Required Permissions:</strong> Read and Write</p>
    <p>
      <strong>Security Note:</strong> Credentials are encrypted and stored
      securely.
    </p>
  </div>
</details>
```

### Phase 3: API Integration

#### Library Selection

**Recommended**: `twitter-api-v2` npm package

- ✅ Modern TypeScript support
- ✅ OAuth 1.0a support
- ✅ Comprehensive API coverage
- ✅ Good error handling
- ✅ Active maintenance

#### Implementation Example

```typescript
import { TwitterApi } from 'twitter-api-v2';

private async getClient(accountId?: string): Promise<TwitterApi | null> {
  const account = accountId ?
    await this.getAccountById(accountId) :
    await this.getActiveAccount();

  if (!account) return null;

  const credentials = await this.getCredentials(account.id);

  return new TwitterApi({
    appKey: credentials.apiKey,
    appSecret: credentials.apiSecret,
    accessToken: credentials.accessToken,
    accessSecret: credentials.accessTokenSecret,
  });
}

async postTweet(content: string, accountId?: string): Promise<string | null> {
  const client = await this.getClient(accountId);
  if (!client) throw new Error('No authenticated client available');

  const tweet = await client.v2.tweet(content);

  if (tweet.data?.id) {
    const account = await this.getActiveAccount();
    return `https://x.com/${account.username}/status/${tweet.data.id}`;
  }

  return null;
}
```

### Phase 4: Broadcast Integration

#### Platform Integration

- **Platform ID**: `x` (update from `twitter`)
- **Character Limit**: 280 characters
- **Posting Logic**: Integrate with existing `handleNewPost` method
- **Status Updates**: Follow Bluesky pattern for connection status

#### Error Handling

- **Rate Limiting**: X has strict rate limits - implement queuing
- **Authentication Errors**: Handle expired tokens gracefully
- **Content Validation**: Check character limits, forbidden content
- **Network Errors**: Retry logic with exponential backoff

## Implementation Steps

### Step 1: Backend Implementation

1. **Install Dependencies**:

   ```bash
   npm install twitter-api-v2
   npm install --save-dev @types/twitter-api-v2
   ```

2. **Create XManager**: `src/main/x-manager.ts`
3. **Add IPC Handlers**: Update `src/main/main.ts`
4. **Update Preload**: Add X APIs to `src/main/preload.ts`

### Step 2: Frontend Implementation

1. **Create X Account Modal**: Update `src/renderer/index.html`
2. **Add Event Handlers**: Update `src/renderer/app.js`
3. **Update Footer/Broadcast**: Integrate status indicators
4. **Add Platform Support**: Update broadcast posting logic

### Step 3: Testing & Validation

1. **Credential Validation**: Test with real X developer credentials
2. **Posting Tests**: Verify tweets are posted correctly
3. **Error Handling**: Test rate limits, invalid credentials
4. **UI Synchronization**: Ensure status updates work correctly

## Security Considerations

### Credential Protection

- **Encryption**: All credentials stored using Electron's safeStorage
- **No Logging**: Never log actual credential values
- **Secure Transmission**: Credentials only in memory during API calls
- **User Control**: Easy credential removal and account switching

### API Best Practices

- **Rate Limiting**: Respect X's rate limits (300 tweets per 3 hours)
- **Error Handling**: Graceful degradation on API failures
- **Content Validation**: Pre-validate content before API calls
- **User Consent**: Clear indication when posting to X

## Differences from Bluesky Implementation

### Complexity Differences

- **More Credentials**: X requires 4 credentials vs Bluesky's 2
- **OAuth 1.0a**: More complex signature process than JWT tokens
- **Rate Limits**: X has stricter rate limiting than Bluesky
- **API Stability**: X API changes more frequently

### UI Adaptations

- **Credential Form**: More fields for X credentials
- **Help Documentation**: Different setup process
- **Error Messages**: X-specific error handling
- **Status Indicators**: Account for X's rate limiting

## Migration Strategy

### From Existing Twitter References

1. **Update Platform Names**: Change "twitter" to "x" throughout codebase
2. **Maintain Backward Compatibility**: Support existing "twitter" references
3. **Update UI Labels**: Change "Twitter" to "X" in user-facing text
4. **Icon Updates**: Use X logo instead of Twitter bird

### Gradual Rollout

1. **Phase 1**: Implement alongside existing Twitter references
2. **Phase 2**: Migrate existing users (if any)
3. **Phase 3**: Remove old Twitter references
4. **Phase 4**: Full X integration

## Future Enhancements

### Advanced Features (Post-MVP)

- **Thread Support**: Multi-tweet threads for longer content
- **Media Attachments**: Image and video posting
- **Scheduled Tweets**: Integration with Cosmo's scheduling system
- **Analytics**: Basic engagement metrics
- **List Management**: Post to specific X lists

### Integration Opportunities

- **Cross-Platform Threads**: Split long content across X and Bluesky
- **Content Adaptation**: Automatically adjust content for platform limits
- **Unified Analytics**: Combined metrics across all platforms
- **Smart Scheduling**: Optimal posting times per platform

## Dependencies

### Required Packages

```json
{
  "dependencies": {
    "twitter-api-v2": "^1.15.0"
  },
  "devDependencies": {
    "@types/twitter-api-v2": "^1.15.0"
  }
}
```

### X Developer Requirements

- **X Developer Account**: Required for API access
- **App Creation**: Must create app in X Developer Portal
- **API Tier**: Basic tier sufficient for posting
- **Rate Limits**: 300 tweets per 3-hour window (Basic tier)

## Success Metrics

### Technical Metrics

- **Authentication Success Rate**: >95% successful credential validation
- **Posting Success Rate**: >98% successful tweet posting
- **Error Recovery**: <5 second recovery from network errors
- **UI Responsiveness**: <200ms status updates

### User Experience Metrics

- **Setup Time**: <5 minutes from start to first tweet
- **Error Clarity**: Clear error messages for all failure modes
- **Status Accuracy**: Real-time connection status updates
- **Multi-Account**: Seamless switching between accounts

This implementation plan provides a comprehensive roadmap for X integration that follows the proven patterns established with Bluesky while accounting for X's unique requirements and constraints.
