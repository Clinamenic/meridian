import { TwitterApi, TwitterApiReadWrite } from 'twitter-api-v2';
import { randomUUID } from 'crypto';
import { CredentialManager } from './credential-manager';
import { DataManager } from './data-manager';

export interface XAccount {
  id: string;
  nickname: string;
  username: string;
  userId: string;
  authMethod: 'oauth1';
  createdAt: string;
  lastUsed: string;
}

export interface XCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export interface XUserInfo {
  id: string;
  username: string;
  name: string;
  profileImageUrl?: string;
  verified?: boolean;
}

export class XManager {
  private credentialManager: CredentialManager;
  private dataManager: DataManager;
  private clients: Map<string, TwitterApiReadWrite> = new Map();
  
  private log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [XManager] ${level.toUpperCase()}: ${message}`;
    
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
   * Add a new X account
   */
  public async addAccount(
    apiKey: string, 
    apiSecret: string, 
    accessToken: string, 
    accessTokenSecret: string, 
    nickname: string
  ): Promise<XAccount> {
    this.log('info', `Adding X account with nickname: ${nickname}`);
    
    try {
      // Validate credentials by attempting authentication
      const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessTokenSecret,
      });

      this.log('info', 'Attempting authentication with X API');
      
      // Test the credentials by getting user info
      const userInfo = await client.v2.me({
        'user.fields': ['id', 'username', 'name', 'profile_image_url', 'verified']
      });

      if (!userInfo.data) {
        this.log('error', 'Failed to get user info from X API');
        throw new Error('Failed to authenticate with X API');
      }

      this.log('info', `Authentication successful for user: @${userInfo.data.username}`, {
        userId: userInfo.data.id,
        username: userInfo.data.username,
        name: userInfo.data.name
      });

      // Check for duplicate accounts
      const existingAccounts = await this.listAccounts();
      const duplicateAccount = existingAccounts.find(account => account.userId === userInfo.data.id);
      if (duplicateAccount) {
        throw new Error(`Account @${userInfo.data.username} already exists as "${duplicateAccount.nickname}"`);
      }

      // Create new account
      const accountId = randomUUID();
      const now = new Date().toISOString();
      const account: XAccount = {
        id: accountId,
        nickname: nickname.trim(),
        username: userInfo.data.username,
        userId: userInfo.data.id,
        authMethod: 'oauth1',
        createdAt: now,
        lastUsed: now
      };

      // Store account metadata
      const accounts = await this.listAccounts();
      accounts.push(account);
      await this.credentialManager.setCredential('x', 'accounts', JSON.stringify(accounts));

      // Store credentials with account-specific keys
      await this.credentialManager.setCredential('x', `apiKey:${accountId}`, apiKey);
      await this.credentialManager.setCredential('x', `apiSecret:${accountId}`, apiSecret);
      await this.credentialManager.setCredential('x', `accessToken:${accountId}`, accessToken);
      await this.credentialManager.setCredential('x', `accessTokenSecret:${accountId}`, accessTokenSecret);

      // Store client for reuse
      this.clients.set(accountId, client.readWrite);

      // If this is the first account, make it active
      const activeAccount = await this.getActiveAccount();
      if (!activeAccount) {
        await this.switchAccount(accountId);
      }

      this.log('info', `X account added successfully: ${account.nickname} (@${account.username})`);
      return account;

    } catch (error) {
      this.log('error', 'Failed to add X account', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  /**
   * Remove an X account
   */
  public async removeAccount(accountId: string): Promise<void> {
    this.log('info', `Removing X account: ${accountId}`);
    
    try {
      const accounts = await this.listAccounts();
      const accountIndex = accounts.findIndex(account => account.id === accountId);
      
      if (accountIndex === -1) {
        throw new Error('Account not found');
      }

      const account = accounts[accountIndex]!;
      
      // Remove account from list
      accounts.splice(accountIndex, 1);
      await this.credentialManager.setCredential('x', 'accounts', JSON.stringify(accounts));

      // Remove all credentials for this account
      await this.credentialManager.removeCredential('x', `apiKey:${accountId}`);
      await this.credentialManager.removeCredential('x', `apiSecret:${accountId}`);
      await this.credentialManager.removeCredential('x', `accessToken:${accountId}`);
      await this.credentialManager.removeCredential('x', `accessTokenSecret:${accountId}`);

      // Remove client
      this.clients.delete(accountId);

      // If this was the active account, switch to another or clear active
      const activeAccount = await this.getActiveAccount();
      if (activeAccount && activeAccount.id === accountId) {
        if (accounts.length > 0) {
          await this.switchAccount(accounts[0]!.id);
        } else {
          await this.credentialManager.removeCredential('x', 'activeAccount');
        }
      }

      this.log('info', `X account removed: ${account.nickname} (@${account.username})`);
    } catch (error) {
      this.log('error', 'Failed to remove X account', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * List all X accounts
   */
  public async listAccounts(): Promise<XAccount[]> {
    try {
      const accountsData = await this.credentialManager.getCredential('x', 'accounts');
      if (!accountsData) {
        return [];
      }
      return JSON.parse(accountsData);
    } catch (error) {
      this.log('error', 'Failed to list X accounts', { error: error instanceof Error ? error.message : error });
      return [];
    }
  }

  /**
   * Switch to a different X account
   */
  public async switchAccount(accountId: string): Promise<void> {
    this.log('info', `Switching to X account: ${accountId}`);
    
    try {
      const accounts = await this.listAccounts();
      const account = accounts.find(acc => acc.id === accountId);
      
      if (!account) {
        throw new Error('Account not found');
      }

      // Update last used timestamp
      account.lastUsed = new Date().toISOString();
      await this.credentialManager.setCredential('x', 'accounts', JSON.stringify(accounts));

      // Set as active account
      await this.credentialManager.setCredential('x', 'activeAccount', accountId);

      this.log('info', `Switched to X account: ${account.nickname} (@${account.username})`);
    } catch (error) {
      this.log('error', 'Failed to switch X account', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Get the currently active X account
   */
  public async getActiveAccount(): Promise<XAccount | null> {
    try {
      const activeAccountId = await this.credentialManager.getCredential('x', 'activeAccount');
      if (!activeAccountId) {
        return null;
      }

      const accounts = await this.listAccounts();
      return accounts.find(account => account.id === activeAccountId) || null;
    } catch (error) {
      this.log('error', 'Failed to get active X account', { error: error instanceof Error ? error.message : error });
      return null;
    }
  }

  /**
   * Update account nickname
   */
  public async updateAccountNickname(accountId: string, nickname: string): Promise<void> {
    this.log('info', `Updating X account nickname: ${accountId} -> ${nickname}`);
    
    try {
      const accounts = await this.listAccounts();
      const account = accounts.find(acc => acc.id === accountId);
      
      if (!account) {
        throw new Error('Account not found');
      }

      account.nickname = nickname.trim();
      await this.credentialManager.setCredential('x', 'accounts', JSON.stringify(accounts));

      this.log('info', `Updated X account nickname: @${account.username} -> ${nickname}`);
    } catch (error) {
      this.log('error', 'Failed to update X account nickname', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Get or create client for account
   */
  private async getClient(accountId?: string): Promise<TwitterApiReadWrite | null> {
    this.log('info', `Getting X client for account`, { accountId: accountId || 'active' });
    
    try {
      const activeAccount = accountId ? 
        await this.listAccounts().then(accounts => accounts.find(acc => acc.id === accountId)) :
        await this.getActiveAccount();
      
      if (!activeAccount) {
        this.log('warn', 'No active X account found');
        return null;
      }

      this.log('info', `Found account: ${activeAccount.nickname} (@${activeAccount.username})`);

      // Return cached client if available
      if (this.clients.has(activeAccount.id)) {
        const cachedClient = this.clients.get(activeAccount.id)!;
        this.log('info', 'Returning cached X client');
        return cachedClient;
      }

      this.log('info', 'Creating new X client');

      // Get credentials
      const apiKey = await this.credentialManager.getCredential('x', `apiKey:${activeAccount.id}`);
      const apiSecret = await this.credentialManager.getCredential('x', `apiSecret:${activeAccount.id}`);
      const accessToken = await this.credentialManager.getCredential('x', `accessToken:${activeAccount.id}`);
      const accessTokenSecret = await this.credentialManager.getCredential('x', `accessTokenSecret:${activeAccount.id}`);
      
      this.log('info', 'Retrieved credentials', {
        hasApiKey: !!apiKey,
        hasApiSecret: !!apiSecret,
        hasAccessToken: !!accessToken,
        hasAccessTokenSecret: !!accessTokenSecret
      });
      
      if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
        this.log('error', 'Missing credentials for X account');
        throw new Error('Missing credentials for X account');
      }

      // Create new client
      const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessTokenSecret,
      });

      const readWriteClient = client.readWrite;

      // Cache client
      this.clients.set(activeAccount.id, readWriteClient);
      
      this.log('info', 'X client created successfully');
      return readWriteClient;
    } catch (error) {
      this.log('error', 'Failed to get X client', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
  }

  /**
   * Validate account credentials
   */
  public async validateCredentials(accountId: string): Promise<boolean> {
    this.log('info', `Validating credentials for X account: ${accountId}`);
    
    try {
      const client = await this.getClient(accountId);
      if (!client) {
        this.log('warn', 'No client available for credential validation');
        return false;
      }

      this.log('info', 'Testing credentials by fetching user info');
      // Try to get user info to validate credentials
      const userInfo = await client.v2.me();
      
      const isValid = !!userInfo.data;
      this.log('info', `Credential validation result: ${isValid}`, {
        userId: userInfo.data?.id,
        username: userInfo.data?.username
      });
      
      return isValid;
    } catch (error) {
      this.log('error', 'Failed to validate X credentials', {
        error: error instanceof Error ? error.message : error,
        accountId
      });
      return false;
    }
  }

  /**
   * Get user information for account
   */
  public async getUserInfo(accountId?: string): Promise<XUserInfo | null> {
    this.log('info', `Getting user info for X account`, { accountId: accountId || 'active' });
    
    try {
      const client = await this.getClient(accountId);
      if (!client) {
        return null;
      }

      const response = await client.v2.me({
        'user.fields': ['id', 'username', 'name', 'profile_image_url', 'verified']
      });

      if (response.data) {
        return {
          id: response.data.id,
          username: response.data.username,
          name: response.data.name,
          profileImageUrl: response.data.profile_image_url,
          verified: response.data.verified,
        };
      }

      return null;
    } catch (error) {
      this.log('error', 'Failed to get X user info', { error: error instanceof Error ? error.message : error });
      return null;
    }
  }

  /**
   * Post content to X
   */
  public async postTweet(content: string, accountId?: string): Promise<string | null> {
    this.log('info', `Attempting to post tweet`, { 
      contentLength: content.length, 
      accountId: accountId || 'active' 
    });
    
    try {
      const client = await this.getClient(accountId);
      if (!client) {
        this.log('error', 'No authenticated client available for posting');
        throw new Error('No authenticated client available');
      }

      this.log('info', 'Client obtained, posting tweet to X');
      
      // First, let's verify we can access the user info to check permissions
      try {
        const userInfo = await client.v2.me();
        this.log('info', 'User verification successful before posting', {
          userId: userInfo.data?.id,
          username: userInfo.data?.username
        });
      } catch (verifyError) {
        this.log('error', 'Failed to verify user before posting', {
          error: verifyError instanceof Error ? verifyError.message : verifyError
        });
        throw new Error(`Authentication verification failed: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`);
      }

      const response = await client.v2.tweet(content);

      this.log('info', 'Tweet response received', {
        hasData: !!response.data,
        tweetId: response.data?.id
      });

      if (response.data?.id) {
        // Get account info for URL construction
        const activeAccount = accountId ? 
          await this.listAccounts().then(accounts => accounts.find(acc => acc.id === accountId)) :
          await this.getActiveAccount();
        
        if (activeAccount) {
          const tweetUrl = `https://x.com/${activeAccount.username}/status/${response.data.id}`;
          this.log('info', 'Tweet posted successfully, returning URL', { tweetUrl });
          return tweetUrl;
        }
        
        // Fallback - just return the tweet ID
        this.log('info', 'Tweet posted successfully, returning tweet ID', { tweetId: response.data.id });
        return `https://x.com/i/status/${response.data.id}`;
      }

      this.log('warn', 'Tweet response had no data');
      return null;
    } catch (error: any) {
      // Enhanced error logging for API errors
      if (error?.code === 403) {
        this.log('error', 'X API 403 Forbidden - Check app permissions and access token scopes', {
          errorCode: error.code,
          errorMessage: error.message,
          errorData: error.data || error.errors
        });
        throw new Error('X API access denied (403). Please check that your X app has "Read and Write" permissions and your access token has the correct scopes. You may need to regenerate your access token after changing permissions.');
      } else if (error?.code === 401) {
        this.log('error', 'X API 401 Unauthorized - Invalid credentials', {
          errorCode: error.code,
          errorMessage: error.message
        });
        throw new Error('X API authentication failed (401). Please check your API credentials.');
      } else if (error?.code === 429) {
        this.log('error', 'X API 429 Rate Limited', {
          errorCode: error.code,
          errorMessage: error.message
        });
        throw new Error('X API rate limit exceeded (429). Please wait before trying again.');
      } else {
        this.log('error', 'Failed to post tweet to X', { 
          error: error instanceof Error ? error.message : error,
          errorCode: error?.code,
          errorData: error?.data || error?.errors,
          stack: error instanceof Error ? error.stack : undefined
        });
        throw new Error(`Failed to post to X: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Check app permissions and capabilities
   */
  public async checkAppPermissions(accountId?: string): Promise<{ canRead: boolean; canWrite: boolean; details: any }> {
    this.log('info', 'Checking X app permissions', { accountId: accountId || 'active' });
    
    try {
      const client = await this.getClient(accountId);
      if (!client) {
        return { canRead: false, canWrite: false, details: { error: 'No client available' } };
      }

      // Test read permissions
      let canRead = false;
      let readError = null;
      try {
        const userInfo = await client.v2.me();
        canRead = !!userInfo.data;
        this.log('info', 'Read permission test successful', { userId: userInfo.data?.id });
      } catch (error: any) {
        readError = error;
        this.log('warn', 'Read permission test failed', { error: error.message });
      }

      // Test write permissions (without actually posting)
      let canWrite = false;
      let writeError = null;
      try {
        // We can't easily test write permissions without posting, so we'll check the error from read
        // If read works, write permissions depend on the access token scopes
        canWrite = canRead; // Assume write works if read works, actual posting will reveal the truth
      } catch (error: any) {
        writeError = error;
        this.log('warn', 'Write permission assumption failed', { error: error.message });
      }

      return {
        canRead,
        canWrite,
        details: {
          readError: readError?.message,
          writeError: writeError?.message,
          note: 'Write permission is assumed based on read success. Actual posting will reveal true write permissions.'
        }
      };
    } catch (error) {
      this.log('error', 'Failed to check app permissions', { error: error instanceof Error ? error.message : error });
      return { 
        canRead: false, 
        canWrite: false, 
        details: { error: error instanceof Error ? error.message : 'Unknown error' } 
      };
    }
  }

  /**
   * Check if X is available (client can be created)
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const activeAccount = await this.getActiveAccount();
      if (!activeAccount) {
        return false;
      }

      const client = await this.getClient(activeAccount.id);
      return !!client;
    } catch (error) {
      this.log('error', 'Failed to check X availability', { error: error instanceof Error ? error.message : error });
      return false;
    }
  }
} 