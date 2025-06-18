import { BskyAgent } from '@atproto/api';
import { randomUUID } from 'crypto';
import { CredentialManager } from './credential-manager';
import { DataManager } from './data-manager';

export interface ATProtoAccount {
  id: string;
  nickname: string;
  handle: string;
  did: string;
  authMethod: 'api';
  createdAt: string;
  lastUsed: string;
}

export interface ATProtoSession {
  accessJwt: string;
  refreshJwt: string;
  did: string;
  handle: string;
}

export interface ATProtoProfile {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
}

export class ATProtoManager {
  private credentialManager: CredentialManager;
  private dataManager: DataManager;
  private agents: Map<string, BskyAgent> = new Map();
  
  private log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [ATProtoManager] ${level.toUpperCase()}: ${message}`;
    
    if (data) {
      console.log(logMessage, data);
    } else {
      console.log(logMessage);
    }
  }

  constructor(dataManager: DataManager) {
    this.credentialManager = CredentialManager.getInstance();
    this.dataManager = dataManager;
  }

  /**
   * Add a new AT Protocol account
   */
  public async addAccount(handle: string, password: string, nickname: string): Promise<ATProtoAccount> {
    this.log('info', `Adding AT Protocol account for handle: ${handle}`);
    
    try {
      // Validate credentials by attempting authentication
      const agent = new BskyAgent({
        service: 'https://bsky.social',
      });

      this.log('info', 'Attempting authentication with AT Protocol');
      await agent.login({
        identifier: handle,
        password: password,
      });

      const session = agent.session;
      if (!session) {
        this.log('error', 'Failed to establish session after login');
        throw new Error('Failed to establish session');
      }
      
      this.log('info', `Authentication successful for DID: ${session.did}`, {
        handle: session.handle,
        did: session.did
      });

      // Check for duplicate handles
      const existingAccounts = await this.listAccounts();
      const duplicateAccount = existingAccounts.find(account => account.handle === handle);
      if (duplicateAccount) {
        throw new Error(`Account with handle ${handle} already exists as "${duplicateAccount.nickname}"`);
      }

      // Create new account
      const accountId = randomUUID();
      const now = new Date().toISOString();
      const account: ATProtoAccount = {
        id: accountId,
        nickname: nickname.trim(),
        handle: session.handle,
        did: session.did,
        authMethod: 'api',
        createdAt: now,
        lastUsed: now
      };

      // Store account metadata
      const accounts = await this.listAccounts();
      accounts.push(account);
      await this.credentialManager.setCredential('bluesky', 'accounts', JSON.stringify(accounts));

      // Store credentials with account-specific keys
      await this.credentialManager.setCredential('bluesky', `handle:${accountId}`, session.handle);
      await this.credentialManager.setCredential('bluesky', `password:${accountId}`, password);
      await this.credentialManager.setCredential('bluesky', `jwt:${accountId}`, session.accessJwt);
      await this.credentialManager.setCredential('bluesky', `refreshToken:${accountId}`, session.refreshJwt);
      await this.credentialManager.setCredential('bluesky', `did:${accountId}`, session.did);

      // Store agent for reuse
      this.agents.set(accountId, agent);

      // If this is the first account, make it active
      const activeAccount = await this.getActiveAccount();
      if (!activeAccount) {
        await this.switchAccount(accountId);
      }

      console.log(`AT Protocol account added: ${account.nickname} (${account.handle})`);
      return account;

    } catch (error) {
      console.error('Failed to add AT Protocol account:', error);
      throw error;
    }
  }

  /**
   * Remove an AT Protocol account
   */
  public async removeAccount(accountId: string): Promise<void> {
    try {
      const accounts = await this.listAccounts();
      const accountIndex = accounts.findIndex(account => account.id === accountId);
      
      if (accountIndex === -1) {
        throw new Error('Account not found');
      }

      const account = accounts[accountIndex]!;
      
      // Remove account from list
      accounts.splice(accountIndex, 1);
      await this.credentialManager.setCredential('bluesky', 'accounts', JSON.stringify(accounts));

      // Remove all credentials for this account
      await this.credentialManager.removeCredential('bluesky', `handle:${accountId}`);
      await this.credentialManager.removeCredential('bluesky', `password:${accountId}`);
      await this.credentialManager.removeCredential('bluesky', `jwt:${accountId}`);
      await this.credentialManager.removeCredential('bluesky', `refreshToken:${accountId}`);
      await this.credentialManager.removeCredential('bluesky', `did:${accountId}`);

      // Remove agent
      this.agents.delete(accountId);

      // If this was the active account, switch to another or clear active
      const activeAccount = await this.getActiveAccount();
      if (activeAccount && activeAccount.id === accountId) {
        if (accounts.length > 0) {
          await this.switchAccount(accounts[0]!.id);
        } else {
          await this.credentialManager.removeCredential('bluesky', 'activeAccount');
        }
      }

      console.log(`AT Protocol account removed: ${account.nickname} (${account.handle})`);
    } catch (error) {
      console.error('Failed to remove AT Protocol account:', error);
      throw error;
    }
  }

  /**
   * List all AT Protocol accounts
   */
  public async listAccounts(): Promise<ATProtoAccount[]> {
    try {
      const accountsData = await this.credentialManager.getCredential('bluesky', 'accounts');
      if (!accountsData) {
        return [];
      }
      return JSON.parse(accountsData);
    } catch (error) {
      console.error('Failed to list AT Protocol accounts:', error);
      return [];
    }
  }

  /**
   * Switch to a different AT Protocol account
   */
  public async switchAccount(accountId: string): Promise<void> {
    try {
      const accounts = await this.listAccounts();
      const account = accounts.find(acc => acc.id === accountId);
      
      if (!account) {
        throw new Error('Account not found');
      }

      // Update last used timestamp
      account.lastUsed = new Date().toISOString();
      await this.credentialManager.setCredential('bluesky', 'accounts', JSON.stringify(accounts));

      // Set as active account
      await this.credentialManager.setCredential('bluesky', 'activeAccount', accountId);

      console.log(`Switched to AT Protocol account: ${account.nickname} (${account.handle})`);
    } catch (error) {
      console.error('Failed to switch AT Protocol account:', error);
      throw error;
    }
  }

  /**
   * Get the currently active AT Protocol account
   */
  public async getActiveAccount(): Promise<ATProtoAccount | null> {
    try {
      const activeAccountId = await this.credentialManager.getCredential('bluesky', 'activeAccount');
      if (!activeAccountId) {
        return null;
      }

      const accounts = await this.listAccounts();
      return accounts.find(account => account.id === activeAccountId) || null;
    } catch (error) {
      console.error('Failed to get active AT Protocol account:', error);
      return null;
    }
  }

  /**
   * Update account nickname
   */
  public async updateAccountNickname(accountId: string, nickname: string): Promise<void> {
    try {
      const accounts = await this.listAccounts();
      const account = accounts.find(acc => acc.id === accountId);
      
      if (!account) {
        throw new Error('Account not found');
      }

      account.nickname = nickname.trim();
      await this.credentialManager.setCredential('bluesky', 'accounts', JSON.stringify(accounts));

      console.log(`Updated AT Protocol account nickname: ${account.handle} -> ${nickname}`);
    } catch (error) {
      console.error('Failed to update AT Protocol account nickname:', error);
      throw error;
    }
  }

  /**
   * Get or create agent for account
   */
  private async getAgent(accountId?: string): Promise<BskyAgent | null> {
    this.log('info', `Getting agent for account`, { accountId: accountId || 'active' });
    
    try {
      const activeAccount = accountId ? 
        await this.listAccounts().then(accounts => accounts.find(acc => acc.id === accountId)) :
        await this.getActiveAccount();
      
      if (!activeAccount) {
        this.log('warn', 'No active account found');
        return null;
      }

      this.log('info', `Found account: ${activeAccount.nickname} (${activeAccount.handle})`);

      // Return cached agent if available
      if (this.agents.has(activeAccount.id)) {
        const cachedAgent = this.agents.get(activeAccount.id)!;
        this.log('info', 'Returning cached agent', {
          hasSession: !!cachedAgent.session,
          sessionDid: cachedAgent.session?.did
        });
        return cachedAgent;
      }

      this.log('info', 'Creating new agent and restoring session');

      // Create new agent and restore session
      const agent = new BskyAgent({
        service: 'https://bsky.social',
      });

      const jwt = await this.credentialManager.getCredential('bluesky', `jwt:${activeAccount.id}`);
      const refreshToken = await this.credentialManager.getCredential('bluesky', `refreshToken:${activeAccount.id}`);
      
      this.log('info', 'Retrieved credentials', {
        hasJwt: !!jwt,
        hasRefreshToken: !!refreshToken,
        jwtLength: jwt?.length || 0,
        refreshTokenLength: refreshToken?.length || 0
      });
      
      if (!jwt || !refreshToken) {
        this.log('error', 'Session tokens not found in credential store');
        throw new Error('Session tokens not found');
      }

      this.log('info', 'Attempting to resume session');
      await agent.resumeSession({
        did: activeAccount.did,
        handle: activeAccount.handle,
        accessJwt: jwt,
        refreshJwt: refreshToken,
        active: true,
      });

      this.log('info', 'Session resumed successfully', {
        sessionDid: agent.session?.did,
        sessionHandle: agent.session?.handle,
        sessionActive: agent.session?.active
      });

      // Cache agent
      this.agents.set(activeAccount.id, agent);
      
      return agent;
    } catch (error) {
      this.log('error', 'Failed to get AT Protocol agent', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
  }

  /**
   * Refresh authentication for account
   */
  public async refreshAuthentication(accountId: string): Promise<boolean> {
    try {
      const agent = await this.getAgent(accountId);
      if (!agent) {
        return false;
      }

      // Try to refresh the session
      const newSession = await agent.session;
      if (newSession) {
        // Update stored tokens
        await this.credentialManager.setCredential('bluesky', `jwt:${accountId}`, newSession.accessJwt);
        await this.credentialManager.setCredential('bluesky', `refreshToken:${accountId}`, newSession.refreshJwt);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to refresh AT Protocol authentication:', error);
      return false;
    }
  }

  /**
   * Validate account session
   */
  public async validateSession(accountId: string): Promise<boolean> {
    this.log('info', `Validating session for account: ${accountId}`);
    
    try {
      const agent = await this.getAgent(accountId);
      if (!agent) {
        this.log('warn', 'No agent available for session validation');
        return false;
      }

      if (!agent.session) {
        this.log('warn', 'Agent has no session to validate');
        return false;
      }

      this.log('info', 'Testing session by fetching profile');
      // Try to get profile to validate session
      const profile = await agent.getProfile({ actor: agent.session.did });
      
      const isValid = !!profile.success;
      this.log('info', `Session validation result: ${isValid}`, {
        profileSuccess: profile.success,
        profileData: profile.success ? { handle: profile.data.handle, did: profile.data.did } : null
      });
      
      return isValid;
    } catch (error) {
      this.log('error', 'Failed to validate AT Protocol session', {
        error: error instanceof Error ? error.message : error,
        accountId
      });
      return false;
    }
  }

  /**
   * Get profile information for account
   */
  public async getProfile(accountId?: string): Promise<ATProtoProfile | null> {
    try {
      const agent = await this.getAgent(accountId);
      if (!agent || !agent.session) {
        return null;
      }

      const response = await agent.getProfile({ actor: agent.session.did });
      if (response.success) {
        return {
          did: response.data.did,
          handle: response.data.handle,
          displayName: response.data.displayName,
          description: response.data.description,
          avatar: response.data.avatar,
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to get AT Protocol profile:', error);
      return null;
    }
  }

  /**
   * Post content to AT Protocol
   */
  public async postContent(content: string, accountId?: string): Promise<string | null> {
    this.log('info', `Attempting to post content`, { 
      contentLength: content.length, 
      accountId: accountId || 'active' 
    });
    
    try {
      const agent = await this.getAgent(accountId);
      if (!agent) {
        this.log('error', 'No authenticated agent available for posting');
        throw new Error('No authenticated agent available');
      }

      this.log('info', 'Agent obtained, checking session status', {
        hasSession: !!agent.session,
        sessionDid: agent.session?.did,
        sessionHandle: agent.session?.handle
      });

      if (!agent.session) {
        this.log('error', 'Agent has no active session');
        throw new Error('Agent has no active session');
      }

      this.log('info', 'Posting content to AT Protocol');
      const response = await agent.post({
        text: content,
        createdAt: new Date().toISOString(),
      });

      this.log('info', 'Post response received', {
        hasUri: !!response.uri,
        uri: response.uri,
        cid: response.cid
      });

      if (response.uri) {
        // Convert AT URI to web URL
        const parts = response.uri.split('/');
        if (parts.length >= 4) {
          const did = parts[2];
          const postId = parts[4];
          
          // Get handle for URL construction
          const activeAccount = accountId ? 
            await this.listAccounts().then(accounts => accounts.find(acc => acc.id === accountId)) :
            await this.getActiveAccount();
          
          if (activeAccount) {
            const webUrl = `https://bsky.app/profile/${activeAccount.handle}/post/${postId}`;
            this.log('info', 'Post successful, returning web URL', { webUrl });
            return webUrl;
          }
        }
        
        // Fallback to AT URI
        this.log('info', 'Post successful, returning AT URI', { uri: response.uri });
        return response.uri;
      }

      this.log('warn', 'Post response had no URI');
      return null;
    } catch (error) {
      this.log('error', 'Failed to post to AT Protocol', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Check if AT Protocol is available (agent can be created)
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const activeAccount = await this.getActiveAccount();
      if (!activeAccount) {
        return false;
      }

      const agent = await this.getAgent(activeAccount.id);
      return !!agent;
    } catch (error) {
      console.error('Failed to check AT Protocol availability:', error);
      return false;
    }
  }
} 