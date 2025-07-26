import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { ArweaveUpload, UploadStatus, ArweaveAccount, FileRegistryEntry, ArweaveUploadRecord, UnifiedResource } from '../types';
import { CredentialManager } from './credential-manager';
import { DataManager } from './data-manager';
import { UnifiedDatabaseManager } from './unified-database-manager';

const execAsync = promisify(exec);

export interface UploadResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  cost?: { ar: string; usd?: string };
}

export interface WalletInfo {
  address: string;
  balance: string;
  isValid: boolean;
}

export interface UUIDResolutionResult {
  uuid: string;
  source: 'frontmatter' | 'registry' | 'content-based' | 'generated';
  confidence: 'high' | 'medium' | 'low';
}

export class ArweaveManager {
  private arkbPath: string;
  private credentialManager: CredentialManager;
  private dataManager: DataManager;  
  private unifiedDatabaseManager: UnifiedDatabaseManager;
  private tempWalletPath?: string;

  constructor(dataManager: DataManager, unifiedDatabaseManager: UnifiedDatabaseManager) {
    // arkb should be available in node_modules
    this.arkbPath = 'arkb';
    this.credentialManager = CredentialManager.getInstance();
    this.dataManager = dataManager;
    this.unifiedDatabaseManager = unifiedDatabaseManager;
  }

  /**
   * Set up Arweave wallet from JWK file or JSON string
   */
  public async setupWallet(walletJWK: string): Promise<WalletInfo> {
    try {
      // Validate JWK format
      let walletData;
      try {
        walletData = typeof walletJWK === 'string' ? JSON.parse(walletJWK) : walletJWK;
      } catch (error) {
        throw new Error('Invalid JWK format - must be valid JSON');
      }

      // Validate required JWK fields
      const requiredFields = ['kty', 'n', 'e', 'd', 'p', 'q', 'dp', 'dq', 'qi'];
      const missingFields = requiredFields.filter(field => !walletData[field]);
      if (missingFields.length > 0) {
        throw new Error(`Invalid JWK - missing fields: ${missingFields.join(', ')}`);
      }

      // Create temporary wallet file for arkb
      const tempPath = await this.createTempWalletFile(JSON.stringify(walletData));
      
      // Get wallet address and balance to validate
      const walletInfo = await this.getWalletInfoFromFile(tempPath);
      
      if (!walletInfo.isValid) {
        throw new Error('Invalid wallet - unable to derive address');
      }

      // Store wallet securely if validation succeeds
      await this.credentialManager.setCredential('arweave', 'walletJWK', JSON.stringify(walletData));
      await this.credentialManager.setCredential('arweave', 'walletAddress', walletInfo.address);

      // Clean up temp file
      await this.cleanupTempWallet();
      
      console.log(`Arweave wallet configured: ${walletInfo.address}`);
      return walletInfo;
      
    } catch (error) {
      await this.cleanupTempWallet();
      console.error('Failed to setup Arweave wallet:', error);
      throw error;
    }
  }

  /**
   * Get current wallet information
   */
  public async getWalletInfo(): Promise<WalletInfo | null> {
    try {
      // Try migration first
      await this.migrateLegacyWallet();

      const walletJWK = await this.getActiveWalletJWK();
      
      if (!walletJWK) {
        return null;
      }

      // Create temp wallet file
      const tempPath = await this.createTempWalletFile(walletJWK);
      const walletInfo = await this.getWalletInfoFromFile(tempPath);
      await this.cleanupTempWallet();
      
      return walletInfo;
    } catch (error) {
      await this.cleanupTempWallet();
      console.error('Failed to get wallet info:', error);
      return null;
    }
  }

  /**
   * Check if wallet is configured
   */
  public async isWalletConfigured(): Promise<boolean> {
    // Try migration first
    await this.migrateLegacyWallet();
    
    const walletJWK = await this.getActiveWalletJWK();
    return walletJWK !== null;
  }

  /**
   * Remove wallet configuration
   */
  public async removeWallet(): Promise<void> {
    await this.credentialManager.removeCredential('arweave', 'walletJWK');
    await this.credentialManager.removeCredential('arweave', 'walletAddress');
    await this.cleanupTempWallet();
    console.log('Arweave wallet configuration removed');
  }

  // ===== MULTI-ACCOUNT MANAGEMENT METHODS =====

  /**
   * Add a new Arweave account
   */
  public async addAccount(walletJWK: string, nickname: string): Promise<ArweaveAccount> {
    try {
      // Validate JWK format
      let walletData;
      try {
        walletData = typeof walletJWK === 'string' ? JSON.parse(walletJWK) : walletJWK;
      } catch (error) {
        throw new Error('Invalid JWK format - must be valid JSON');
      }

      // Validate required JWK fields
      const requiredFields = ['kty', 'n', 'e', 'd', 'p', 'q', 'dp', 'dq', 'qi'];
      const missingFields = requiredFields.filter(field => !walletData[field]);
      if (missingFields.length > 0) {
        throw new Error(`Invalid JWK - missing fields: ${missingFields.join(', ')}`);
      }

      // Create temporary wallet file to validate and get address
      const tempPath = await this.createTempWalletFile(JSON.stringify(walletData));
      const walletInfo = await this.getWalletInfoFromFile(tempPath);
      await this.cleanupTempWallet();

      if (!walletInfo.isValid) {
        throw new Error('Invalid wallet - unable to derive address');
      }

      // Check for duplicate addresses
      const existingAccounts = await this.listAccounts();
      const duplicateAccount = existingAccounts.find(account => account.address === walletInfo.address);
      if (duplicateAccount) {
        throw new Error(`Account with address ${walletInfo.address} already exists as "${duplicateAccount.nickname}"`);
      }

      // Create new account
      const accountId = randomUUID();
      const now = new Date().toISOString();
      const account: ArweaveAccount = {
        id: accountId,
        nickname: nickname.trim(),
        address: walletInfo.address,
        createdAt: now,
        lastUsed: now
      };

      // Store account metadata
      const accounts = await this.listAccounts();
      accounts.push(account);
      await this.credentialManager.setCredential('arweave', 'accounts', JSON.stringify(accounts));

      // Store wallet JWK with account-specific key
      await this.credentialManager.setCredential('arweave', `wallet:${accountId}`, JSON.stringify(walletData));

      // If this is the first account, make it active
      const activeAccount = await this.getActiveAccount();
      if (!activeAccount) {
        await this.switchAccount(accountId);
      }

      console.log(`Arweave account added: ${account.nickname} (${account.address})`);
      return account;

    } catch (error) {
      await this.cleanupTempWallet();
      console.error('Failed to add Arweave account:', error);
      throw error;
    }
  }

  /**
   * Remove an Arweave account
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
       await this.credentialManager.setCredential('arweave', 'accounts', JSON.stringify(accounts));

       // Remove wallet JWK
       await this.credentialManager.removeCredential('arweave', `wallet:${accountId}`);

       // If this was the active account, switch to another or clear active
       const activeAccount = await this.getActiveAccount();
       if (activeAccount && activeAccount.id === accountId) {
         if (accounts.length > 0) {
           await this.switchAccount(accounts[0]!.id);
         } else {
           await this.credentialManager.removeCredential('arweave', 'activeAccount');
         }
       }

       console.log(`Arweave account removed: ${account.nickname} (${account.address})`);
    } catch (error) {
      console.error('Failed to remove Arweave account:', error);
      throw error;
    }
  }

  /**
   * List all Arweave accounts
   */
  public async listAccounts(): Promise<ArweaveAccount[]> {
    try {
      const accountsData = await this.credentialManager.getCredential('arweave', 'accounts');
      if (!accountsData) {
        return [];
      }
      return JSON.parse(accountsData);
    } catch (error) {
      console.error('Failed to list Arweave accounts:', error);
      return [];
    }
  }

  /**
   * Switch to a different Arweave account
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
      await this.credentialManager.setCredential('arweave', 'accounts', JSON.stringify(accounts));

      // Set as active account
      await this.credentialManager.setCredential('arweave', 'activeAccount', accountId);

      console.log(`Switched to Arweave account: ${account.nickname} (${account.address})`);
    } catch (error) {
      console.error('Failed to switch Arweave account:', error);
      throw error;
    }
  }

  /**
   * Get the currently active Arweave account
   */
  public async getActiveAccount(): Promise<ArweaveAccount | null> {
    try {
      const activeAccountId = await this.credentialManager.getCredential('arweave', 'activeAccount');
      if (!activeAccountId) {
        return null;
      }

      const accounts = await this.listAccounts();
      return accounts.find(account => account.id === activeAccountId) || null;
    } catch (error) {
      console.error('Failed to get active Arweave account:', error);
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
      await this.credentialManager.setCredential('arweave', 'accounts', JSON.stringify(accounts));

      console.log(`Updated account nickname: ${account.address} -> ${nickname}`);
    } catch (error) {
      console.error('Failed to update account nickname:', error);
      throw error;
    }
  }

  /**
   * Get wallet JWK for active account (for backward compatibility)
   */
  private async getActiveWalletJWK(): Promise<string | null> {
    try {
      const activeAccount = await this.getActiveAccount();
      if (!activeAccount) {
        // Fallback to legacy single wallet for backward compatibility
        return await this.credentialManager.getCredential('arweave', 'walletJWK');
      }

      return await this.credentialManager.getCredential('arweave', `wallet:${activeAccount.id}`);
    } catch (error) {
      console.error('Failed to get active wallet JWK:', error);
      return null;
    }
  }

  /**
   * Migrate legacy single wallet to multi-account format
   */
  public async migrateLegacyWallet(): Promise<void> {
    try {
      // Check if already migrated
      const accounts = await this.listAccounts();
      if (accounts.length > 0) {
        return; // Already migrated
      }

      // Check for legacy wallet
      const legacyJWK = await this.credentialManager.getCredential('arweave', 'walletJWK');
      const legacyAddress = await this.credentialManager.getCredential('arweave', 'walletAddress');
      
      if (!legacyJWK) {
        return; // No legacy wallet to migrate
      }

      console.log('Migrating legacy Arweave wallet to multi-account format...');

      // Create account from legacy wallet
      const accountId = randomUUID();
      const now = new Date().toISOString();
      const account: ArweaveAccount = {
        id: accountId,
        nickname: 'Primary Wallet',
        address: legacyAddress || 'Unknown',
        createdAt: now,
        lastUsed: now
      };

      // If we don't have the address, derive it
      if (!legacyAddress) {
        const tempPath = await this.createTempWalletFile(legacyJWK);
        const walletInfo = await this.getWalletInfoFromFile(tempPath);
        await this.cleanupTempWallet();
        account.address = walletInfo.address;
      }

      // Store in new format
      await this.credentialManager.setCredential('arweave', 'accounts', JSON.stringify([account]));
      await this.credentialManager.setCredential('arweave', `wallet:${accountId}`, legacyJWK);
      await this.credentialManager.setCredential('arweave', 'activeAccount', accountId);

      // Remove legacy credentials
      await this.credentialManager.removeCredential('arweave', 'walletJWK');
      await this.credentialManager.removeCredential('arweave', 'walletAddress');

      console.log(`Legacy wallet migrated successfully: ${account.nickname} (${account.address})`);
    } catch (error) {
      console.error('Failed to migrate legacy wallet:', error);
      // Don't throw - migration failure shouldn't break the app
    }
  }

  /**
   * Create temporary wallet file for arkb commands
   */
  private async createTempWalletFile(walletJWK: string): Promise<string> {
    if (this.tempWalletPath && fs.existsSync(this.tempWalletPath)) {
      return this.tempWalletPath;
    }

    const tempDir = tmpdir();
    const tempPath = path.join(tempDir, `meridian-wallet-${Date.now()}.json`);
    
    await fs.promises.writeFile(tempPath, walletJWK, { mode: 0o600 }); // Restrict permissions
    this.tempWalletPath = tempPath;
    
    return tempPath;
  }

  /**
   * Clean up temporary wallet file
   */
  private async cleanupTempWallet(): Promise<void> {
    if (this.tempWalletPath && fs.existsSync(this.tempWalletPath)) {
      try {
        await fs.promises.unlink(this.tempWalletPath);
        this.tempWalletPath = undefined;
      } catch (error) {
        console.warn('Failed to cleanup temp wallet file:', error);
      }
    }
  }

  /**
   * Get wallet info from wallet file
   */
  private async getWalletInfoFromFile(walletPath: string): Promise<WalletInfo> {
    try {
      console.log(`[ArweaveManager] Getting wallet info from file: ${walletPath}`);
      
      // Read and parse the JWK file
      const walletData = await fs.promises.readFile(walletPath, 'utf8');
      const jwk = JSON.parse(walletData);

      // Derive wallet address from JWK
      const address = await this.jwkToAddress(jwk);
      if (!address) {
        throw new Error('Could not derive address from JWK');
      }

      console.log(`[ArweaveManager] Wallet address: ${address}`);

      // Try to get balance using arkb (optional, if it fails we just don't show balance)
      let balance = '0';
      try {
        console.log('[ArweaveManager] Attempting to get balance via HTTP API...');
        const balanceResult = await this.getBalanceFromAPI(address);
        if (balanceResult) {
          balance = balanceResult;
          console.log(`[ArweaveManager] Balance: ${balance} AR`);
        }
      } catch (error) {
        console.log('[ArweaveManager] Could not get balance (non-critical):', error);
      }

      return {
        address,
        balance,
        isValid: true,
      };
      
    } catch (error) {
      console.error('[ArweaveManager] Failed to get wallet info from file:', error);
      return {
        address: '',
        balance: '0',
        isValid: false,
      };
    }
  }

  /**
   * Convert JWK to Arweave wallet address
   * Address is SHA-256 hash of the public key (n value) encoded as Base64URL
   */
  private async jwkToAddress(jwk: any): Promise<string | null> {
    try {
      if (!jwk.n) {
        throw new Error('JWK missing public key modulus (n)');
      }

      const crypto = require('crypto');
      
      // Decode the Base64URL encoded public key modulus
      const nBuffer = Buffer.from(jwk.n, 'base64url');
      
      // Create SHA-256 hash
      const hash = crypto.createHash('sha256').update(nBuffer).digest();
      
      // Encode as Base64URL (replace + with -, / with _, remove padding =)
      const address = hash.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      return address;
    } catch (error) {
      console.error('[ArweaveManager] Error converting JWK to address:', error);
      return null;
    }
  }

  /**
   * Get balance from Arweave HTTP API
   */
  private async getBalanceFromAPI(address: string): Promise<string | null> {
    try {
      const https = require('https');
      const url = `https://arweave.net/wallet/${address}/balance`;
      
      return new Promise((resolve, reject) => {
        const req = https.get(url, (res: any) => {
          let data = '';
          res.on('data', (chunk: any) => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              const winstonBalance = data.trim();
              const arBalance = this.winstonToAR(winstonBalance);
              resolve(arBalance);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          });
        });
        
        req.on('error', reject);
        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
      });
    } catch (error) {
      console.error('[ArweaveManager] Error getting balance from API:', error);
      return null;
    }
  }

  /**
   * Convert winston to AR
   * 1 AR = 1,000,000,000,000 winston (12 zeros)
   */
  private winstonToAR(winston: string): string {
    try {
      const winstonAmount = BigInt(winston);
      const arAmount = Number(winstonAmount) / 1000000000000; // 12 zeros
      return arAmount.toFixed(6); // Show up to 6 decimal places
    } catch (error) {
      console.error('[ArweaveManager] Error converting winston to AR:', error);
      return '0';
    }
  }

  /**
   * Upload a file to Arweave using arkb
   */
  public async uploadFile(filePath: string, tags: string[] = []): Promise<UploadResult> {
    try {
      // Validate file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Get file stats
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      // Estimate cost before upload
      const costEstimate = await this.estimateUploadCost(fileSize);
      
      // Get wallet file for command
      const walletJWK = await this.getActiveWalletJWK();
      if (!walletJWK) {
        throw new Error('No Arweave wallet configured. Please set up your wallet first.');
      }

      const walletPath = await this.createTempWalletFile(walletJWK);

      // Resolve UUID and prepare enhanced tags
      const uuidResult = await this.resolveUUID(filePath);
      const enhancedTags = await this.prepareUploadTags(filePath, uuidResult.uuid, tags);

      // Build arkb command arguments array
      const args = ['deploy', filePath, '--wallet', walletPath];
      
      // Add enhanced tags using the working --tag-name/--tag-value format
      for (const tag of enhancedTags) {
        const [key, value] = tag.split(':', 2);
        if (key && value) {
          args.push('--tag-name', key.trim(), '--tag-value', value.trim());
        } else {
          console.warn(`Skipping malformed tag: ${tag}`);
        }
      }
      
      // Add final flags for direct file upload 
      args.push('--bundle', '--force', '--auto-confirm');

      console.log('Enhanced tags being processed:', enhancedTags);
      console.log(`Executing arkb command: ${this.arkbPath} ${args.join(' ')}`);

      // Execute upload using spawn for better argument handling
      const { spawn } = require('child_process');
      const spawnResult = await new Promise<{ stdout: string; stderr: string; }>((resolve, reject) => {
        const process = spawn(this.arkbPath, args, { timeout: 300000 });
        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        process.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        process.on('close', (code: number) => {
          if (code === 0) {
            resolve({ stdout, stderr });
          } else {
            reject(new Error(`arkb process exited with code ${code}: ${stderr}`));
          }
        });

        process.on('error', (error: Error) => {
          reject(error);
        });
      });

      const { stdout, stderr } = spawnResult;

      if (stderr) {
        console.warn('arkb stderr:', stderr);
      }

      // Parse arkb output
      const parseResult = this.parseArkbOutput(stdout);
      
      // Save upload record to workspace data and file registry
      if (parseResult.transactionId && this.dataManager) {
        try {
          const fileName = path.basename(filePath);
          const contentType = this.getContentType(filePath);
          
          await this.dataManager.addUpload({
            filename: fileName,
            filePath: filePath,
            fileSize: fileSize,
            contentType: contentType,
            tags: enhancedTags,
            transactionId: parseResult.transactionId,
            status: 'pending' as const,
            cost: costEstimate
          });

          // Add to file registry and record Arweave upload
          await this.recordArweaveUpload(filePath, uuidResult.uuid, parseResult.transactionId, enhancedTags);
          
          console.log(`Upload record saved for transaction: ${parseResult.transactionId}`);
        } catch (saveError) {
          console.warn('Failed to save upload record:', saveError);
          // Don't fail the upload because of this
        }
      }
      
      return {
        success: true,
        transactionId: parseResult.transactionId,
        cost: costEstimate,
      };
    } catch (error) {
      console.error('Failed to upload file to Arweave:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      await this.cleanupTempWallet();
    }
  }

  /**
   * Upload multiple files as a bundle
   */
  public async uploadBundle(filePaths: string[], tags: string[] = []): Promise<UploadResult> {
    try {
      // Validate all files exist
      for (const filePath of filePaths) {
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }
      }

      // Calculate total size
      const totalSize = filePaths.reduce((sum, filePath) => {
        return sum + fs.statSync(filePath).size;
      }, 0);

      // Estimate cost
      const costEstimate = await this.estimateUploadCost(totalSize);

      // Get wallet file for command
      const walletJWK = await this.credentialManager.getCredential('arweave', 'walletJWK');
      if (!walletJWK) {
        throw new Error('No Arweave wallet configured. Please set up your wallet first.');
      }

      const walletPath = await this.createTempWalletFile(walletJWK);

      // Build file list for arkb
      const fileList = filePaths.map(f => `"${f}"`).join(' ');
      
      // Build tag arguments using the working --tag-name/--tag-value format
      let tagArgs = '';
      if (tags.length > 0) {
        const tagPairs: string[] = [];
        for (const tag of tags) {
          const [key, value] = tag.split(':', 2);
          if (key && value) {
            tagPairs.push(`--tag-name "${key.trim()}" --tag-value "${value.trim()}"`);
          } else {
            console.warn(`Skipping malformed tag in bundle: ${tag}`);
          }
        }
        tagArgs = tagPairs.join(' ');
      }
      
      const command = `${this.arkbPath} deploy ${fileList} --wallet "${walletPath}" ${tagArgs} --auto-confirm`;

      console.log(`Executing arkb bundle command: ${command}`);

      // Execute upload
      const { stdout, stderr } = await execAsync(command, {
        timeout: 600000, // 10 minutes timeout for bundles
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large uploads
      });

      if (stderr) {
        console.warn('arkb stderr:', stderr);
      }

      const result = this.parseArkbOutput(stdout);
      
      return {
        success: true,
        transactionId: result.transactionId,
        cost: costEstimate,
      };
    } catch (error) {
      console.error('Failed to upload bundle to Arweave:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      await this.cleanupTempWallet();
    }
  }

  /**
   * Get wallet balance (alias for getWalletInfo for backward compatibility)
   */
  public async getWalletBalance(): Promise<{ balance: string; address: string } | null> {
    const walletInfo = await this.getWalletInfo();
    return walletInfo ? {
      balance: walletInfo.balance,
      address: walletInfo.address,
    } : null;
  }

  /**
   * Estimate upload cost for a given file size
   */
  public async estimateUploadCost(sizeInBytes: number): Promise<{ ar: string; usd?: string }> {
    try {
      // Get current AR price
      const arPrice = await this.getArPrice();
      
      // More accurate cost calculation based on current network pricing
      // Convert bytes to GiB (1 GiB = 1024^3 bytes)
      const sizeInGiB = sizeInBytes / (1024 * 1024 * 1024);
      
      // Current storage cost is approximately 2.43 AR/GiB (from viewblock data)
      // Add some buffer for fees and fluctuation
      const arCostPerGiB = 2.5; // slightly higher than current rate for safety
      const arCost = (sizeInGiB * arCostPerGiB).toFixed(8);
      const usdCost = arPrice ? (parseFloat(arCost) * arPrice).toFixed(2) : undefined;

      return {
        ar: arCost,
        usd: usdCost,
      };
    } catch (error) {
      console.error('Failed to estimate upload cost:', error);
      return { ar: '0.00000000' };
    }
  }

  /**
   * Check transaction status on Arweave
   */
  public async checkTransactionStatus(transactionId: string): Promise<UploadStatus> {
    try {
      // Use GraphQL API for more reliable status checking
      const query = `
        query {
          transactions(ids: ["${transactionId}"]) {
            edges {
              node {
                id
                block {
                  height
                  timestamp
                }
              }
            }
          }
        }
      `;

      try {
        const response = await fetch('https://arweave.net/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });

        const data = await response.json();
        const transaction = data.data?.transactions?.edges?.[0]?.node;

        if (transaction && transaction.block) {
          return 'confirmed';
        } else if (transaction) {
          return 'pending';
        } else {
          // Transaction not found in GraphQL, try HTTP API
          return await this.checkTransactionStatusHTTP(transactionId);
        }
      } catch (graphqlError) {
        console.warn('GraphQL status check failed, trying HTTP API:', graphqlError);
        return await this.checkTransactionStatusHTTP(transactionId);
      }
    } catch (error) {
      console.error('Failed to check transaction status:', error);
      return 'failed';
    }
  }

  /**
   * Fallback HTTP status check
   */
  private async checkTransactionStatusHTTP(transactionId: string): Promise<UploadStatus> {
    const https = require('https');
    const url = `https://arweave.net/tx/${transactionId}/status`;
    
    return new Promise((resolve) => {
      const req = https.get(url, (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const result = JSON.parse(data);
              if (result.block_height && result.block_height > 0) {
                resolve('confirmed');
              } else {
                resolve('pending');
              }
            } else if (res.statusCode === 404) {
              resolve('failed');
            } else {
              resolve('pending');
            }
          } catch {
            resolve('pending'); // Default to pending if we can't parse response
          }
        });
      });
      
      req.on('error', () => resolve('pending')); // Default to pending on error
      req.setTimeout(5000, () => {
        req.destroy();
        resolve('pending'); // Default to pending on timeout
      });
    });
  }

  /**
   * Verify a transaction exists on the network
   */
  public async verifyTransaction(transactionId: string): Promise<{ exists: boolean; accessible: boolean }> {
    try {
      const https = require('https');
      
      // Check if transaction metadata exists
      const statusUrl = `https://arweave.net/tx/${transactionId}/status`;
      const statusExists = await new Promise<boolean>((resolve) => {
        const req = https.get(statusUrl, (res: any) => {
          resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(5000, () => {
          req.destroy();
          resolve(false);
        });
      });

      // Check if data is accessible
      const dataUrl = `https://arweave.net/${transactionId}`;
      const dataAccessible = await new Promise<boolean>((resolve) => {
        const req = https.get(dataUrl, (res: any) => {
          resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(5000, () => {
          req.destroy();
          resolve(false);
        });
      });

      return {
        exists: statusExists,
        accessible: dataAccessible
      };
    } catch (error) {
      console.error('Failed to verify transaction:', error);
      return { exists: false, accessible: false };
    }
  }

  /**
   * Get current AR price in USD
   */
  private async getArPrice(): Promise<number | null> {
    try {
      // This would typically fetch from a price API
      // For now, return a static value
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd');
      const data = await response.json();
      return data.arweave?.usd || null;
    } catch (error) {
      console.warn('Failed to fetch AR price:', error);
      return null;
    }
  }

  /**
   * Get content type from file extension
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Parse arkb output
   */
  private parseArkbOutput(output: string): { transactionId: string } {
    try {
      const parsed = JSON.parse(output);
      return {
        transactionId: parsed.id || parsed.transactionId || '',
      };
    } catch (error) {
      // Try to extract transaction ID from non-JSON output
      const match = output.match(/([a-zA-Z0-9_-]{43})/);
      return {
        transactionId: match ? match[1]! : '',
      };
    }
  }

  /**
   * Validate arkb installation
   */
  public async validateArkbInstallation(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`${this.arkbPath} --version`);
      console.log(`arkb version: ${stdout.trim()}`);
      return true;
    } catch (error) {
      console.error('arkb not found or not working:', error);
      return false;
    }
  }

  /**
   * Get Arweave network info
   */
  public async getNetworkInfo(): Promise<{ height: number; current: string } | null> {
    try {
      const command = `${this.arkbPath} network-info --json`;
      const { stdout } = await execAsync(command);
      
      const result = JSON.parse(stdout);
      return {
        height: result.height || 0,
        current: result.current || '',
      };
    } catch (error) {
      console.error('Failed to get network info:', error);
      return null;
    }
  }

  /**
   * Prepare enhanced tags for Arweave upload including UUID and metadata
   */
  private async prepareUploadTags(filePath: string, uuid: string, userTags: string[] = []): Promise<string[]> {
    const tags: string[] = [];
    
    // Add UUID tag (critical for querying)
    tags.push(`uuid:${uuid}`);
    
    // Try to get existing registry entry or create one
    let registryEntry = await this.createRegistryEntry(filePath, uuid);
    
    // Add title tag if available
    if (registryEntry.title) {
      tags.push(`title:${registryEntry.title}`);
    }
    
    // Add author tag if available
    if (registryEntry.metadata.author) {
      tags.push(`author:${registryEntry.metadata.author}`);
    }
    
    // Add content type tag
    tags.push(`content-type:${registryEntry.mimeType}`);
    
    // Add file size tag
    tags.push(`file-size:${registryEntry.fileSize}`);
    
    // Add content hash tag for verification
    tags.push(`content-hash:${registryEntry.contentHash}`);
    
    // Add timestamp tag
    tags.push(`upload-timestamp:${new Date().toISOString()}`);
    
    // Add registry tags
    for (const tag of registryEntry.tags) {
      tags.push(`tag:${tag}`);
    }
    
    // Add user-provided tags
    for (const tag of userTags) {
      // Avoid duplicates and ensure proper formatting
      if (!tags.includes(tag) && !tags.includes(`tag:${tag}`)) {
        tags.push(tag.includes(':') ? tag : `tag:${tag}`);
      }
    }
    
    return tags;
  }

  /**
   * Find or create resource in unified database by file path
   */
  private async findOrCreateResourceByPath(filePath: string, uuid: string): Promise<string> {
    try {
      // First try to find existing resource by file path
      const existingResources = await this.unifiedDatabaseManager.getAllResources();
      
      // Search for a resource with matching file path in location
      for (const resource of existingResources) {
        if (resource.locations.primary.value === filePath) {
          console.log(`Found existing resource by path: ${resource.id}`);
          return resource.id;
        }
      }
      
      // If not found, create a new resource
      const title = await this.extractTitle(filePath);
      const author = await this.extractAuthor(filePath);
      const mimeType = this.getMimeType(filePath);
      
      const stats = await fs.promises.stat(filePath);
      const content = await fs.promises.readFile(filePath);
      const contentHash = createHash('sha256').update(content).digest('hex');
      
      const now = new Date().toISOString();
      
      const newResource: Omit<UnifiedResource, 'id'> = {
        uri: `file://${filePath}`,
        contentHash: `sha256:${contentHash}`,
        properties: {
          'dc:title': title,
          'dc:type': 'file',
          'meridian:description': `File uploaded to Arweave`,
          'meridian:tags': [],
          'meridian:arweave_hashes': []
        },
        locations: {
          primary: {
            type: 'file-path',
            value: filePath,
            accessible: true,
            lastVerified: now
          },
          alternatives: []
        },
        provenance: [],
        state: {
          type: 'internal',
          accessible: true,
          lastVerified: now,
          verificationStatus: 'verified'
        },
        timestamps: {
          created: now,
          modified: now,
          lastAccessed: now
        }
      };
      
      const createdResource = await this.unifiedDatabaseManager.addResource(newResource);
      console.log(`Created new resource for upload: ${createdResource.id}`);
      return createdResource.id;
    } catch (error) {
      console.error('Failed to find or create resource:', error);
      throw error;
    }
  }

  /**
   * Record Arweave upload in unified database
   */
  private async recordArweaveUpload(filePath: string, uuid: string, transactionId: string, tags: string[]): Promise<void> {
    try {
      // Find or create resource in unified database
      const resourceId = await this.findOrCreateResourceByPath(filePath, uuid);
      
      // Get the current resource to update its arweave_hashes
      const resource = await this.unifiedDatabaseManager.getResourceById(resourceId);
      if (!resource) {
        throw new Error(`Resource not found: ${resourceId}`);
      }
      
      // Create new Arweave upload record
      const arweaveUpload: ArweaveUploadRecord = {
        hash: transactionId,
        timestamp: new Date().toISOString(),
        link: `https://www.arweave.net/${transactionId}`,
        tags: tags
      };
      
      // Get existing arweave_hashes and add the new one
      const existingHashes = resource.properties['meridian:arweave_hashes'] || [];
      const updatedHashes = [...existingHashes, arweaveUpload];
      
      // Update the resource with the new arweave_hashes
      const updates: Partial<UnifiedResource> = {
        properties: {
          ...resource.properties,
          'meridian:arweave_hashes': updatedHashes
        }
      };
      
      await this.unifiedDatabaseManager.updateResource(resourceId, updates);
      
      console.log(`Arweave upload recorded in unified database: ${resourceId} -> ${transactionId}`);
      
      // Also record in old registry for backward compatibility
      try {
        let registryEntry = await this.dataManager.getFileByUUID(uuid);
        if (!registryEntry) {
          registryEntry = await this.createRegistryEntry(filePath, uuid);
          await this.dataManager.addOrUpdateFile(registryEntry);
        }
        await this.dataManager.addArweaveUpload(uuid, arweaveUpload);
      } catch (legacyError) {
        console.warn('Failed to record in legacy registry (non-critical):', legacyError);
      }
    } catch (error) {
      console.error('Failed to record Arweave upload in unified database:', error);
      // Don't throw - this is not critical for the upload itself
    }
  }

  /**
   * Resolve UUID for a file using multiple strategies
   */
  public async resolveUUID(filePath: string): Promise<UUIDResolutionResult> {
    // Strategy 1: Check frontmatter for UUID
    const frontmatterUUID = await this.extractUUIDFromFrontmatter(filePath);
    if (frontmatterUUID) {
      return {
        uuid: frontmatterUUID,
        source: 'frontmatter',
        confidence: 'high'
      };
    }

    // Strategy 2: Check registry by file path
    const registryFiles = await this.dataManager.searchFiles({ filePath });
    if (registryFiles && registryFiles.length > 0 && registryFiles[0]) {
      return {
        uuid: registryFiles[0].uuid,
        source: 'registry',
        confidence: 'high'
      };
    }

    // Strategy 3: Generate content-based UUID
    const contentUUID = await this.generateContentBasedUUID(filePath);
    if (contentUUID) {
      return {
        uuid: contentUUID,
        source: 'content-based',
        confidence: 'medium'
      };
    }

    // Strategy 4: Generate new UUID
    return {
      uuid: randomUUID(),
      source: 'generated',
      confidence: 'low'
    };
  }

  /**
   * Extract UUID from markdown frontmatter
   */
  private async extractUUIDFromFrontmatter(filePath: string): Promise<string | null> {
    try {
      if (!filePath.toLowerCase().endsWith('.md')) {
        return null;
      }

      const content = await fs.promises.readFile(filePath, 'utf-8');
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      
      if (frontmatterMatch && frontmatterMatch[1]) {
        const yaml = require('js-yaml');
        const frontmatter = yaml.load(frontmatterMatch[1]) as any;
        
        if (frontmatter && typeof frontmatter.uuid === 'string') {
          // Validate UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(frontmatter.uuid)) {
            return frontmatter.uuid;
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to extract UUID from frontmatter in ${filePath}:`, error);
    }
    
    return null;
  }

  /**
   * Generate content-based UUID using file hash
   */
  private async generateContentBasedUUID(filePath: string): Promise<string | null> {
    try {
      const content = await fs.promises.readFile(filePath);
      const hash = createHash('sha256').update(content).digest('hex');
      
      // Create a deterministic UUID from the hash
      // This ensures the same file content always gets the same UUID
      const uuid = [
        hash.substring(0, 8),
        hash.substring(8, 12),
        '4' + hash.substring(13, 16), // Version 4 UUID
        '8' + hash.substring(17, 20), // Variant bits
        hash.substring(20, 32)
      ].join('-');
      
      return uuid;
    } catch (error) {
      console.warn(`Failed to generate content-based UUID for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Create or update file registry entry
   */
  public async createRegistryEntry(filePath: string, uuid?: string): Promise<FileRegistryEntry> {
    const stats = await fs.promises.stat(filePath);
    const content = await fs.promises.readFile(filePath);
    const contentHash = createHash('sha256').update(content).digest('hex');
    
    // Extract metadata
    const title = await this.extractTitle(filePath);
    const author = await this.extractAuthor(filePath);
    const mimeType = this.getMimeType(filePath);
    
    const entry: FileRegistryEntry = {
      uuid: uuid || randomUUID(),
      title,
      filePath,
      contentHash: `sha256:${contentHash}`,
      fileSize: stats.size,
      mimeType,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      tags: [],
      metadata: {
        ...(author && { author }),
        customFields: {}
      },
      arweave_hashes: []
    };

    return entry;
  }

  /**
   * Extract title from file
   */
  private async extractTitle(filePath: string): Promise<string> {
    try {
      if (filePath.toLowerCase().endsWith('.md')) {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        
        // Try frontmatter first
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatterMatch && frontmatterMatch[1]) {
          const yaml = require('js-yaml');
          const frontmatter = yaml.load(frontmatterMatch[1]) as any;
          if (frontmatter && frontmatter.title) {
            return frontmatter.title;
          }
        }
        
        // Try first H1 heading
        const h1Match = content.match(/^#\s+(.+)$/m);
        if (h1Match && h1Match[1]) {
          return h1Match[1].trim();
        }
      }
    } catch (error) {
      console.warn(`Failed to extract title from ${filePath}:`, error);
    }
    
    // Fallback to filename without extension
    return path.basename(filePath, path.extname(filePath));
  }

  /**
   * Extract author from file
   */
  private async extractAuthor(filePath: string): Promise<string | undefined> {
    try {
      if (filePath.toLowerCase().endsWith('.md')) {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        
        if (frontmatterMatch && frontmatterMatch[1]) {
          const yaml = require('js-yaml');
          const frontmatter = yaml.load(frontmatterMatch[1]) as any;
          if (frontmatter && frontmatter.author) {
            return frontmatter.author;
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to extract author from ${filePath}:`, error);
    }
    
    return undefined;
  }

  /**
   * Get MIME type for file
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.pdf': 'application/pdf',
      '.json': 'application/json',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Validate if a file can be uploaded to Arweave based on UUID
   */
  public async validateForUpload(uuid: string): Promise<{ canUpload: boolean; reason?: string }> {
    try {
      const file = await this.dataManager.getFileByUUID(uuid);
      if (!file) {
        return { canUpload: false, reason: 'File not found in registry' };
      }

      // Check if file is virtual
      const isVirtual = file.filePath.startsWith('[VIRTUAL]');
      if (isVirtual) {
        return { canUpload: false, reason: 'Virtual files cannot be uploaded to Arweave' };
      }

      // Check if local file exists
      if (!fs.existsSync(file.filePath)) {
        return { canUpload: false, reason: 'Local file not found on disk' };
      }

      // File is valid for upload
      return { canUpload: true };
    } catch (error) {
      console.error('Error validating file for upload:', error);
      return { canUpload: false, reason: 'Validation error: ' + (error as Error).message };
    }
  }
} 