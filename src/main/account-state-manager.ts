import { EventEmitter } from 'events';
import { CredentialManager } from './credential-manager';
import { ArweaveManager } from './arweave-manager';
import { ATProtoManager } from './atproto-manager';
import { XManager } from './x-manager';

export interface AccountState {
  arweave: {
    hasAccount: boolean;
    activeAccount: any | null;
    balance: number | null;
    address: string | null;
    isValid: boolean;
    lastUpdated: string;
    error: string | null;
  };
  atproto: {
    hasAccount: boolean;
    activeAccount: any | null;
    handle: string | null;
    isValid: boolean;
    lastUpdated: string;
    error: string | null;
  };
  x: {
    hasAccount: boolean;
    activeAccount: any | null;
    username: string | null;
    isValid: boolean;
    lastUpdated: string;
    error: string | null;
  };
}

export interface AccountStateUpdate {
  platform: keyof AccountState;
  state: AccountState[keyof AccountState];
  timestamp: string;
}

/**
 * Centralized account state management system
 * Handles detection, validation, and state tracking for all platforms
 */
export class AccountStateManager extends EventEmitter {
  private static instance: AccountStateManager;
  private currentState: AccountState;
  private isInitialized = false;
  private workspacePath: string | null = null;
  
  private credentialManager: CredentialManager;
  private arweaveManager: ArweaveManager;
  private atprotoManager: ATProtoManager;
  private xManager: XManager;

  private constructor(
    credentialManager: CredentialManager,
    arweaveManager: ArweaveManager,
    atprotoManager: ATProtoManager,
    xManager: XManager
  ) {
    super();
    this.credentialManager = credentialManager;
    this.arweaveManager = arweaveManager;
    this.atprotoManager = atprotoManager;
    this.xManager = xManager;

    this.currentState = this.getInitialState();
  }

  public static getInstance(
    credentialManager?: CredentialManager,
    arweaveManager?: ArweaveManager,
    atprotoManager?: ATProtoManager,
    xManager?: XManager
  ): AccountStateManager {
    if (!AccountStateManager.instance) {
      if (!credentialManager || !arweaveManager || !atprotoManager || !xManager) {
        throw new Error('Managers must be provided when creating AccountStateManager instance');
      }
      AccountStateManager.instance = new AccountStateManager(
        credentialManager,
        arweaveManager,
        atprotoManager,
        xManager
      );
    }
    return AccountStateManager.instance;
  }

  /**
   * Initialize account state detection for a workspace
   * This is called once when workspace is selected
   */
  public async initializeForWorkspace(workspacePath: string): Promise<void> {
    console.log(`[AccountStateManager] Initializing account state for workspace: ${workspacePath}`);
    
    this.workspacePath = workspacePath;
    this.currentState = this.getInitialState();
    
    try {
      console.log('[AccountStateManager] Starting parallel account detection for all platforms...');
      
      // Detect and validate all accounts in parallel
      const [arweaveState, atprotoState, xState] = await Promise.allSettled([
        this.detectArweaveAccounts(),
        this.detectATProtoAccounts(),
        this.detectXAccounts()
      ]);

      console.log('[AccountStateManager] All account detection completed. Processing results...');

      // Update state with results
      if (arweaveState.status === 'fulfilled') {
        console.log('[AccountStateManager] Arweave detection succeeded, updating state');
        this.updatePlatformState('arweave', arweaveState.value);
      } else {
        console.error('[AccountStateManager] Arweave detection failed:', arweaveState.reason);
        this.updatePlatformState('arweave', {
          hasAccount: false,
          activeAccount: null,
          balance: null,
          address: null,
          isValid: false,
          lastUpdated: new Date().toISOString(),
          error: arweaveState.reason?.message || 'Failed to detect Arweave accounts'
        });
      }

      if (atprotoState.status === 'fulfilled') {
        console.log('[AccountStateManager] AT Protocol detection succeeded, updating state');
        this.updatePlatformState('atproto', atprotoState.value);
      } else {
        console.error('[AccountStateManager] AT Protocol detection failed:', atprotoState.reason);
        this.updatePlatformState('atproto', {
          hasAccount: false,
          activeAccount: null,
          handle: null,
          isValid: false,
          lastUpdated: new Date().toISOString(),
          error: atprotoState.reason?.message || 'Failed to detect AT Protocol accounts'
        });
      }

      if (xState.status === 'fulfilled') {
        console.log('[AccountStateManager] X detection succeeded, updating state');
        this.updatePlatformState('x', xState.value);
      } else {
        console.error('[AccountStateManager] X detection failed:', xState.reason);
        this.updatePlatformState('x', {
          hasAccount: false,
          activeAccount: null,
          username: null,
          isValid: false,
          lastUpdated: new Date().toISOString(),
          error: xState.reason?.message || 'Failed to detect X accounts'
        });
      }

      this.isInitialized = true;
      console.log('[AccountStateManager] Account state initialization complete. Final state:', this.currentState);
      
      // Emit initialization complete event
      this.emit('initialized', this.currentState);
      
    } catch (error) {
      console.error('[AccountStateManager] Failed to initialize account state:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get current account state
   */
  public getState(): AccountState {
    return { ...this.currentState };
  }

  /**
   * Get state for a specific platform
   */
  public getPlatformState<T extends keyof AccountState>(platform: T): AccountState[T] {
    return { ...this.currentState[platform] };
  }

  /**
   * Check if manager is initialized
   */
  public isStateInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Refresh account state for all platforms
   */
  public async refreshAllPlatforms(): Promise<void> {
    if (!this.workspacePath) {
      throw new Error('No workspace set - cannot refresh account state');
    }

    console.log('[AccountStateManager] Refreshing all platform states');
    await this.initializeForWorkspace(this.workspacePath);
  }

  /**
   * Refresh account state for a specific platform
   */
  public async refreshPlatform(platform: keyof AccountState): Promise<void> {
    console.log(`[AccountStateManager] Refreshing ${platform} platform state`);
    
    try {
      let state;
      switch (platform) {
        case 'arweave':
          state = await this.detectArweaveAccounts();
          break;
        case 'atproto':
          state = await this.detectATProtoAccounts();
          break;
        case 'x':
          state = await this.detectXAccounts();
          break;
        default:
          throw new Error(`Unknown platform: ${platform}`);
      }
      
      this.updatePlatformState(platform, state);
         } catch (error) {
       console.error(`[AccountStateManager] Failed to refresh ${platform} state:`, error);
       // Create platform-specific error state
       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
       switch (platform) {
         case 'arweave':
           this.updatePlatformState(platform, {
             hasAccount: false,
             activeAccount: null,
             balance: null,
             address: null,
             isValid: false,
             lastUpdated: new Date().toISOString(),
             error: errorMessage
           });
           break;
         case 'atproto':
           this.updatePlatformState(platform, {
             hasAccount: false,
             activeAccount: null,
             handle: null,
             isValid: false,
             lastUpdated: new Date().toISOString(),
             error: errorMessage
           });
           break;
         case 'x':
           this.updatePlatformState(platform, {
             hasAccount: false,
             activeAccount: null,
             username: null,
             isValid: false,
             lastUpdated: new Date().toISOString(),
             error: errorMessage
           });
           break;
       }
     }
  }

  /**
   * Handle account switch for a platform
   */
  public async handleAccountSwitch(platform: keyof AccountState, accountId: string): Promise<void> {
    console.log(`[AccountStateManager] Handling account switch for ${platform}: ${accountId}`);
    
    try {
      switch (platform) {
        case 'arweave':
          await this.arweaveManager.switchAccount(accountId);
          break;
        case 'atproto':
          await this.atprotoManager.switchAccount(accountId);
          break;
        case 'x':
          await this.xManager.switchAccount(accountId);
          break;
        default:
          throw new Error(`Unknown platform: ${platform}`);
      }
      
      // Refresh the platform state after switching
      await this.refreshPlatform(platform);
      
    } catch (error) {
      console.error(`[AccountStateManager] Failed to switch ${platform} account:`, error);
      throw error;
    }
  }

  /**
   * Detect and validate Arweave accounts
   */
  private async detectArweaveAccounts(): Promise<AccountState['arweave']> {
    const state = this.getInitialPlatformState() as AccountState['arweave'];
    
    console.log('[AccountStateManager] Starting Arweave account detection...');
    
    try {
      // Check if wallet is configured
      console.log('[AccountStateManager] Checking if Arweave wallet is configured...');
      const isConfigured = await this.arweaveManager.isWalletConfigured();
      console.log('[AccountStateManager] Arweave wallet configured:', isConfigured);
      
      if (!isConfigured) {
        console.log('[AccountStateManager] No Arweave wallet configured, returning empty state');
        return state;
      }

      // Get active account
      console.log('[AccountStateManager] Getting active Arweave account...');
      const activeAccount = await this.arweaveManager.getActiveAccount();
      console.log('[AccountStateManager] Active Arweave account:', activeAccount);
      
      if (!activeAccount) {
        console.log('[AccountStateManager] No active Arweave account found');
        return state;
      }

      // Get wallet info and balance
      console.log('[AccountStateManager] Getting Arweave wallet info and balance...');
      const [walletInfo, balanceInfo] = await Promise.allSettled([
        this.arweaveManager.getWalletInfo(),
        this.arweaveManager.getWalletBalance()
      ]);

      console.log('[AccountStateManager] Wallet info result:', walletInfo);
      console.log('[AccountStateManager] Balance info result:', balanceInfo);

      if (walletInfo.status === 'fulfilled' && walletInfo.value) {
        console.log('[AccountStateManager] Setting Arweave account as valid with address:', walletInfo.value.address);
        
        state.hasAccount = true;
        state.activeAccount = activeAccount;
        state.address = walletInfo.value.address;
        state.isValid = true;
        
        if (balanceInfo.status === 'fulfilled' && balanceInfo.value) {
          const balance = parseFloat(balanceInfo.value.balance || '0');
          console.log('[AccountStateManager] Setting Arweave balance:', balance);
          state.balance = balance;
        } else {
          console.log('[AccountStateManager] Could not get Arweave balance:', balanceInfo.status === 'rejected' ? balanceInfo.reason : 'No balance value');
        }
      } else {
        console.log('[AccountStateManager] Failed to get valid wallet info:', walletInfo.status === 'rejected' ? walletInfo.reason : 'No wallet value');
      }

    } catch (error) {
      console.error('[AccountStateManager] Error during Arweave account detection:', error);
      state.error = error instanceof Error ? error.message : 'Unknown error';
    }

    state.lastUpdated = new Date().toISOString();
    console.log('[AccountStateManager] Final Arweave state:', state);
    return state;
  }

  /**
   * Detect and validate AT Protocol accounts
   */
  private async detectATProtoAccounts(): Promise<AccountState['atproto']> {
    const state = this.getInitialPlatformState() as AccountState['atproto'];
    
    console.log('[AccountStateManager] Starting AT Protocol account detection...');
    
    try {
      // Get active account
      console.log('[AccountStateManager] Getting active AT Protocol account...');
      const activeAccount = await this.atprotoManager.getActiveAccount();
      console.log('[AccountStateManager] Active AT Protocol account:', activeAccount);
      
      if (!activeAccount) {
        console.log('[AccountStateManager] No active AT Protocol account found');
        return state;
      }

      // Validate session
      console.log('[AccountStateManager] Validating AT Protocol session for account:', activeAccount.id);
      const isSessionValid = await this.atprotoManager.validateSession(activeAccount.id);
      console.log('[AccountStateManager] AT Protocol session valid:', isSessionValid);
      
      state.hasAccount = true;
      state.activeAccount = activeAccount;
      state.handle = activeAccount.handle;
      state.isValid = isSessionValid;
      
      if (!isSessionValid) {
        console.log('[AccountStateManager] AT Protocol session expired');
        state.error = 'Session expired';
      } else {
        console.log('[AccountStateManager] AT Protocol account is valid and connected');
      }

    } catch (error) {
      console.error('[AccountStateManager] Error during AT Protocol account detection:', error);
      state.error = error instanceof Error ? error.message : 'Unknown error';
    }

    state.lastUpdated = new Date().toISOString();
    console.log('[AccountStateManager] Final AT Protocol state:', state);
    return state;
  }

  /**
   * Detect and validate X accounts
   */
  private async detectXAccounts(): Promise<AccountState['x']> {
    const state = this.getInitialPlatformState() as AccountState['x'];
    
    try {
      // Get active account
      const activeAccount = await this.xManager.getActiveAccount();
      if (!activeAccount) {
        return state;
      }

      // Validate credentials
      const isValid = await this.xManager.validateCredentials(activeAccount.id);
      
      state.hasAccount = true;
      state.activeAccount = activeAccount;
      state.username = activeAccount.username;
      state.isValid = isValid;
      
      if (!isValid) {
        state.error = 'Invalid credentials';
      }

    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Unknown error';
    }

    state.lastUpdated = new Date().toISOString();
    return state;
  }

  /**
   * Update platform state and emit change event
   */
  private updatePlatformState<T extends keyof AccountState>(
    platform: T, 
    newState: AccountState[T]
  ): void {
    const previousState = { ...this.currentState[platform] };
    this.currentState[platform] = newState;
    
    // Emit platform-specific change event
    this.emit('platformChange', {
      platform,
      state: newState,
      timestamp: new Date().toISOString()
    } as AccountStateUpdate);
    
    // Emit general state change event
    this.emit('stateChange', this.currentState);
    
    console.log(`[AccountStateManager] Updated ${platform} state:`, {
      hasAccount: newState.hasAccount,
      isValid: newState.isValid,
      error: newState.error
    });
  }

  /**
   * Get initial state structure
   */
  private getInitialState(): AccountState {
    return {
      arweave: {
        hasAccount: false,
        activeAccount: null,
        balance: null,
        address: null,
        isValid: false,
        lastUpdated: new Date().toISOString(),
        error: null
      },
      atproto: {
        hasAccount: false,
        activeAccount: null,
        handle: null,
        isValid: false,
        lastUpdated: new Date().toISOString(),
        error: null
      },
      x: {
        hasAccount: false,
        activeAccount: null,
        username: null,
        isValid: false,
        lastUpdated: new Date().toISOString(),
        error: null
      }
    };
  }

  /**
   * Get initial platform state
   */
  private getInitialPlatformState() {
    return {
      hasAccount: false,
      activeAccount: null,
      isValid: false,
      lastUpdated: new Date().toISOString(),
      error: null
    };
  }

  /**
   * Reset state (for workspace changes)
   */
  public reset(): void {
    this.currentState = this.getInitialState();
    this.isInitialized = false;
    this.workspacePath = null;
    this.emit('reset');
  }
} 