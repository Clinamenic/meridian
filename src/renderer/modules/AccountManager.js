/**
 * AccountManager - Handles all account management functionality
 * Manages Arweave, ATProto, X, and GitHub account operations
 */
import { ModuleBase } from './ModuleBase.js';

export class AccountManager extends ModuleBase {
  constructor(app) {
    super(app);
    this.platforms = ['arweave', 'atproto', 'x', 'github'];
    this.accountData = new Map();
    this.renameAccountData = new Map();
  }

  /**
   * Initialize the AccountManager
   */
  async onInit() {
    console.log('[AccountManager] Initializing account management...');
    
    // Setup event listeners for all platforms
    this.setupAccountManagementEvents();
    this.setupATProtoAccountManagementEvents();
    this.setupXAccountManagementEvents();
    this.setupGitHubAccountManagementEvents();
    
    console.log('[AccountManager] Account management initialized successfully');
  }

  /**
   * Setup Arweave account management events
   */
  setupAccountManagementEvents() {
    // Add account form
    const addAccountForm = document.getElementById('add-account-form');
    if (addAccountForm) {
      addAccountForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleAddAccount();
      });
    }

    // Rename account form
    const renameAccountForm = document.getElementById('rename-account-form');
    if (renameAccountForm) {
      renameAccountForm.addEventListener('submit', async (e) => {
        await this.handleRenameAccountSubmit(e);
      });
    }
  }

  /**
   * Setup ATProto account management events
   */
  setupATProtoAccountManagementEvents() {
    // Add account form
    const addAccountForm = document.getElementById('atproto-add-account-form');
    if (addAccountForm) {
      addAccountForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleAddATProtoAccount();
      });
    }

    // Rename account form
    const renameAccountForm = document.getElementById('atproto-rename-account-form');
    if (renameAccountForm) {
      renameAccountForm.addEventListener('submit', async (e) => {
        await this.handleRenameATProtoAccountSubmit(e);
      });
    }
  }

  /**
   * Setup X account management events
   */
  setupXAccountManagementEvents() {
    // Add account form
    const addAccountForm = document.getElementById('x-add-account-form');
    if (addAccountForm) {
      addAccountForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleAddXAccount();
      });
    }

    // Rename account form
    const renameAccountForm = document.getElementById('x-rename-account-form');
    if (renameAccountForm) {
      renameAccountForm.addEventListener('submit', async (e) => {
        await this.handleRenameXAccountSubmit(e);
      });
    }

    // Check permissions button
    const checkPermissionsBtn = document.getElementById('x-check-permissions-btn');
    if (checkPermissionsBtn) {
      checkPermissionsBtn.addEventListener('click', async () => {
        await this.checkXPermissions();
      });
    }
  }

  /**
   * Setup GitHub account management events
   */
  setupGitHubAccountManagementEvents() {
    // GitHub footer dropdown
    const githubDropdownBtn = document.getElementById('github-dropdown-btn');
    if (githubDropdownBtn) {
      githubDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openGitHubAccountsModal();
      });
    }
  }

  // ===== ARWEAVE ACCOUNT MANAGEMENT =====

  /**
   * Open Arweave accounts modal
   */
  async openArweaveAccountsModal() {
    try {
      // Check if workspace is connected first
      const workspacePath = await window.electronAPI.getWorkspace();
      if (!workspacePath) {
        this.showError('Please select a workspace before managing Arweave accounts.');
        return;
      }

      await this.loadAndRenderAccounts();
      this.getApp().openModal('arweave-accounts-modal');
    } catch (error) {
      console.error('Failed to open Arweave accounts modal:', error);
      this.showError('Failed to load account information');
    }
  }

  /**
   * Load and render Arweave accounts
   */
  async loadAndRenderAccounts() {
    try {
      // Load accounts and active account
      const [accounts, activeAccount] = await Promise.all([
        window.electronAPI.archive.listAccounts(),
        window.electronAPI.archive.getActiveAccount()
      ]);

      this.renderActiveAccount(activeAccount);
      this.renderAccountsList(accounts, activeAccount);
    } catch (error) {
      console.error('Failed to load accounts:', error);
      this.showError('Failed to load accounts');
    }
  }

  /**
   * Render active Arweave account
   */
  renderActiveAccount(activeAccount) {
    const activeAccountDisplay = document.getElementById('active-account-display');
    
    if (activeAccount) {
      activeAccountDisplay.innerHTML = `
        <div class="active-account-info">
          <div class="account-nickname">${this.escapeHtml(activeAccount.nickname)}</div>
          <div class="account-address" title="${activeAccount.address}">${activeAccount.address}</div>
          <div class="account-balance">Loading balance...</div>
        </div>
      `;
      
      // Load balance for active account
      this.loadAccountBalance(activeAccount.address);
    } else {
      activeAccountDisplay.innerHTML = '<p>No account selected</p>';
    }
  }

  /**
   * Load Arweave account balance
   */
  async loadAccountBalance(address) {
    try {
      const walletInfo = await window.electronAPI.archive.getWalletInfo();
      if (walletInfo && walletInfo.address === address) {
        const balanceElement = document.querySelector('.account-balance');
        if (balanceElement) {
          balanceElement.textContent = `${parseFloat(walletInfo.balance).toFixed(4)} AR`;
        }
      }
    } catch (error) {
      console.error('Failed to load account balance:', error);
      const balanceElement = document.querySelector('.account-balance');
      if (balanceElement) {
        balanceElement.textContent = 'Error loading balance';
      }
    }
  }

  /**
   * Render Arweave accounts list
   */
  renderAccountsList(accounts, activeAccount) {
    const accountsList = document.getElementById('accounts-list');
    
    if (accounts.length === 0) {
      accountsList.innerHTML = '<div class="loading-state">No accounts found. Add your first account below.</div>';
      return;
    }

    const accountsHTML = accounts.map(account => {
      const isActive = activeAccount && activeAccount.id === account.id;
      const shortAddress = `${account.address.substring(0, 6)}...${account.address.substring(account.address.length - 4)}`;
      
      return `
        <div class="account-item ${isActive ? 'active' : ''}" data-account-id="${account.id}">
          <div class="account-status-indicator"></div>
          <div class="account-info">
            <div class="account-nickname">${this.escapeHtml(account.nickname)}</div>
            <div class="account-address" title="${account.address}">${shortAddress}</div>
          </div>
          <div class="account-actions">
                      ${!isActive ? `<button class="account-action-btn switch-btn" onclick="meridianApp.getModule('accountManager').switchAccount('${account.id}')">Switch</button>` : ''}
          <button class="account-action-btn edit-btn" onclick="meridianApp.getModule('accountManager').editAccountNickname('${account.id}', '${this.escapeHtml(account.nickname)}')">Rename</button>
          <button class="account-action-btn remove-btn" onclick="meridianApp.getModule('accountManager').removeAccount('${account.id}')">Remove</button>
          </div>
        </div>
      `;
    }).join('');

    accountsList.innerHTML = accountsHTML;
  }

  /**
   * Handle adding Arweave account
   */
  async handleAddAccount() {
    try {
      const nickname = document.getElementById('account-nickname').value.trim();
      const walletJWK = document.getElementById('account-jwk').value.trim();
      
      if (!nickname) {
        this.showError('Please enter an account nickname');
        return;
      }

      if (!walletJWK) {
        this.showError('Please enter your wallet JWK');
        return;
      }
      
      this.showSuccess('Adding account...');
      
      const account = await window.electronAPI.archive.addAccount(walletJWK, nickname);
      this.showSuccess(`Account "${account.nickname}" added successfully!`);
      
      // Clear form
      document.getElementById('account-nickname').value = '';
      document.getElementById('account-jwk').value = '';
      
      // Reload accounts
      await this.loadAndRenderAccounts();
      await this.updateWalletDisplay();
      
    } catch (error) {
      console.error('Failed to add account:', error);
      this.showError(`Failed to add account: ${error.message}`);
    }
  }

  /**
   * Switch Arweave account
   */
  async switchAccount(accountId) {
    try {
      this.showSuccess('Switching account...');
      
      // Use centralized account switching
      await window.electronAPI.accountState.handleSwitch('arweave', accountId);
      
      this.showSuccess('Account switched successfully!');
      
      // Reload accounts and update displays
      await this.loadAndRenderAccounts();
      
    } catch (error) {
      console.error('Failed to switch account:', error);
      this.showError(`Failed to switch account: ${error.message}`);
    }
  }

  /**
   * Edit Arweave account nickname
   */
  async editAccountNickname(accountId, currentNickname) {
    // Store the account ID for the modal form
    this.renameAccountData.set('arweave', { accountId, currentNickname });
    
    // Set the current nickname in the input field
    const nicknameInput = document.getElementById('rename-account-nickname');
    nicknameInput.value = currentNickname;
    
    // Open the rename modal
    this.getApp().openModal('rename-account-modal');
    
    // Focus the input field and select all text
    setTimeout(() => {
      nicknameInput.focus();
      nicknameInput.select();
    }, 100);
  }

  /**
   * Handle Arweave account rename submit
   */
  async handleRenameAccountSubmit(e) {
    e.preventDefault();
    
    const renameData = this.renameAccountData.get('arweave');
    if (!renameData) {
      this.showError('No account selected for renaming');
      return;
    }
    
    const newNickname = document.getElementById('rename-account-nickname').value.trim();
    
    if (!newNickname || newNickname === renameData.currentNickname) {
        this.getApp().closeModal();
      return;
    }
    
    try {
      await window.electronAPI.archive.updateAccountNickname(renameData.accountId, newNickname);
      this.showSuccess('Account nickname updated successfully!');
      
      // Reload accounts
      await this.loadAndRenderAccounts();
      this.getApp().closeModal();
      
      } catch (error) {
      console.error('Failed to update account nickname:', error);
      this.showError(`Failed to update nickname: ${error.message}`);
    } finally {
      // Clear the stored data
      this.renameAccountData.delete('arweave');
    }
  }

  /**
   * Remove Arweave account
   */
  async removeAccount(accountId) {
    if (!confirm('Are you sure you want to remove this account? This will delete the wallet from this application but will not affect your actual wallet.')) {
      return;
    }
    
    try {
      await window.electronAPI.archive.removeAccount(accountId);
      this.showSuccess('Account removed successfully!');
      
      // Reload accounts and update displays
      await this.loadAndRenderAccounts();
      await this.updateWalletDisplay();
      
    } catch (error) {
      console.error('Failed to remove account:', error);
      this.showError(`Failed to remove account: ${error.message}`);
    }
  }

  /**
   * Update wallet display
   */
  async updateWalletDisplay() {
    // This method now uses centralized account state
    try {
      const arweaveState = await window.electronAPI.accountState.getPlatformState('arweave');
      this.getApp().updateArweaveUI(arweaveState);
    } catch (error) {
      console.error('Failed to update wallet display:', error);
    }
  }

  // ===== ATPROTO ACCOUNT MANAGEMENT =====

  /**
   * Open ATProto accounts modal
   */
  async openATProtoAccountsModal() {
    try {
      // Check if workspace is connected first
      const workspacePath = await window.electronAPI.getWorkspace();
      if (!workspacePath) {
        this.showError('Please select a workspace before managing Bluesky accounts.');
        return;
      }

      await this.loadAndRenderATProtoAccounts();
      this.getApp().openModal('atproto-accounts-modal');
      
      // Force refresh status when modal is opened to ensure UI is in sync
      setTimeout(async () => {
        await this.forceRefreshATProtoStatus();
      }, 200);
    } catch (error) {
      console.error('Failed to open AT Protocol accounts modal:', error);
      this.showError('Failed to load account information');
    }
  }

  /**
   * Load and render ATProto accounts
   */
  async loadAndRenderATProtoAccounts() {
    try {
      // Load accounts and active account
      const [accounts, activeAccount] = await Promise.all([
        window.electronAPI.atproto.listAccounts(),
        window.electronAPI.atproto.getActiveAccount()
      ]);

      this.renderActiveATProtoAccount(activeAccount);
      this.renderATProtoAccountsList(accounts, activeAccount);
    } catch (error) {
      console.error('Failed to load AT Protocol accounts:', error);
      this.showError('Failed to load accounts');
    }
  }

  /**
   * Render active ATProto account
   */
  renderActiveATProtoAccount(activeAccount) {
    const activeAccountDisplay = document.getElementById('atproto-active-account-display');
    
    if (activeAccount) {
      activeAccountDisplay.innerHTML = `
        <div class="active-account-info">
          <div class="account-nickname">${this.escapeHtml(activeAccount.nickname)}</div>
          <div class="account-address" title="${activeAccount.handle}">@${activeAccount.handle}</div>
          <div class="account-balance">Connected</div>
        </div>
      `;
    } else {
      activeAccountDisplay.innerHTML = '<p>No account selected</p>';
    }
  }

  /**
   * Render ATProto accounts list
   */
  renderATProtoAccountsList(accounts, activeAccount) {
    const accountsList = document.getElementById('atproto-accounts-list');
    
    if (accounts.length === 0) {
      accountsList.innerHTML = '<div class="loading-state">No accounts found. Add your first account below.</div>';
      return;
    }

    const accountsHTML = accounts.map(account => {
      const isActive = activeAccount && activeAccount.id === account.id;
      
      return `
        <div class="account-item ${isActive ? 'active' : ''}" data-account-id="${account.id}">
          <div class="account-status-indicator"></div>
          <div class="account-info">
            <div class="account-nickname">${this.escapeHtml(account.nickname)}</div>
            <div class="account-address" title="${account.handle}">@${account.handle}</div>
          </div>
          <div class="account-actions">
                      ${!isActive ? `<button class="account-action-btn switch-btn" onclick="meridianApp.getModule('accountManager').switchATProtoAccount('${account.id}')">Switch</button>` : ''}
          <button class="account-action-btn edit-btn" onclick="meridianApp.getModule('accountManager').editATProtoAccountNickname('${account.id}', '${this.escapeHtml(account.nickname)}')">Rename</button>
          <button class="account-action-btn remove-btn" onclick="meridianApp.getModule('accountManager').removeATProtoAccount('${account.id}')">Remove</button>
          </div>
        </div>
      `;
    }).join('');

    accountsList.innerHTML = accountsHTML;
  }

  /**
   * Handle adding ATProto account
   */
  async handleAddATProtoAccount() {
    try {
      const nickname = document.getElementById('atproto-account-nickname').value.trim();
      const handle = document.getElementById('atproto-account-handle').value.trim();
      const password = document.getElementById('atproto-account-password').value.trim();
      
      if (!nickname) {
        this.showError('Please enter an account nickname');
        return;
      }
      
      if (!handle) {
        this.showError('Please enter your Bluesky handle');
        return;
      }
      
      if (!password) {
        this.showError('Please enter your app password');
        return;
      }
      
      this.showSuccess('Adding account...');
      
      const account = await window.electronAPI.atproto.addAccount(handle, password, nickname);
      this.showSuccess(`Account "${account.nickname}" added successfully!`);
      
      // Clear form
      document.getElementById('atproto-account-nickname').value = '';
      document.getElementById('atproto-account-handle').value = '';
      document.getElementById('atproto-account-password').value = '';
      
      // Reload accounts and update status
      await this.loadAndRenderATProtoAccounts();
      
      // Force refresh status to ensure UI is updated
      setTimeout(async () => {
        await this.forceRefreshATProtoStatus();
      }, 100);
      
    } catch (error) {
      console.error('Failed to add AT Protocol account:', error);
      this.showError(`Failed to add account: ${error.message}`);
    }
  }

  /**
   * Switch ATProto account
   */
  async switchATProtoAccount(accountId) {
    try {
      this.showSuccess('Switching account...');
      
      // Use centralized account switching
      await window.electronAPI.accountState.handleSwitch('atproto', accountId);
      
      this.showSuccess('Account switched successfully!');
      
      // Reload accounts
      await this.loadAndRenderATProtoAccounts();
      
    } catch (error) {
      console.error('Failed to switch AT Protocol account:', error);
      this.showError(`Failed to switch account: ${error.message}`);
    }
  }

  /**
   * Edit ATProto account nickname
   */
  async editATProtoAccountNickname(accountId, currentNickname) {
    // Store the account ID for the modal form
    this.renameAccountData.set('atproto', { accountId, currentNickname });
    
    // Set the current nickname in the input field
    const nicknameInput = document.getElementById('atproto-rename-account-nickname');
    nicknameInput.value = currentNickname;
    
    // Open the rename modal
    this.getApp().openModal('atproto-rename-account-modal');
    
    // Focus the input field and select all text
    setTimeout(() => {
      nicknameInput.focus();
      nicknameInput.select();
    }, 100);
  }

  /**
   * Handle ATProto account rename submit
   */
  async handleRenameATProtoAccountSubmit(e) {
    e.preventDefault();
    
    const renameData = this.renameAccountData.get('atproto');
    if (!renameData) {
      this.showError('No account selected for renaming');
      return;
    }
    
    const newNickname = document.getElementById('atproto-rename-account-nickname').value.trim();
    
    if (!newNickname || newNickname === renameData.currentNickname) {
      this.getApp().closeModal();
      return;
    }
    
    try {
      await window.electronAPI.atproto.updateAccountNickname(renameData.accountId, newNickname);
      this.showSuccess('Account nickname updated successfully!');
      
      // Reload accounts
      await this.loadAndRenderATProtoAccounts();
      this.getApp().closeModal();
      
    } catch (error) {
      console.error('Failed to update AT Protocol account nickname:', error);
      this.showError(`Failed to update nickname: ${error.message}`);
    } finally {
      // Clear the stored data
      this.renameAccountData.delete('atproto');
    }
  }

  /**
   * Remove ATProto account
   */
  async removeATProtoAccount(accountId) {
    if (!confirm('Are you sure you want to remove this Bluesky account? This will delete the account from this application but will not affect your actual Bluesky account.')) {
      return;
    }
    
    try {
      await window.electronAPI.atproto.removeAccount(accountId);
      this.showSuccess('Account removed successfully!');
      
      // Reload accounts and update displays
      await this.loadAndRenderATProtoAccounts();
      
      // Force refresh status to ensure UI is updated
      setTimeout(async () => {
        await this.forceRefreshATProtoStatus();
      }, 100);
      
    } catch (error) {
      console.error('Failed to remove AT Protocol account:', error);
      this.showError(`Failed to remove account: ${error.message}`);
    }
  }

  /**
   * Update ATProto status
   */
  async updateATProtoStatus(forceRefresh = false) {
    console.log('[ATProto] Updating AT Protocol status...', forceRefresh ? '(forced refresh)' : '');
    
    try {
      // Clear any cached agents if forcing refresh
      if (forceRefresh) {
        console.log('[ATProto] Forcing refresh - clearing cached state');
      }
      
      const activeAccount = await window.electronAPI.atproto.getActiveAccount();
      
      if (activeAccount) {
        console.log('[ATProto] Active account found:', activeAccount.nickname);
        
        // Update UI with account state
        const atprotoState = {
          isConnected: true,
          username: activeAccount.handle,
          nickname: activeAccount.nickname
        };
        
        this.getApp().updateATProtoUI(atprotoState);
      } else {
        console.log('[ATProto] No active account found');
        
        // Update UI with disconnected state
        const atprotoState = {
          isConnected: false,
          username: null,
          nickname: null
        };
        
        this.getApp().updateATProtoUI(atprotoState);
      }
    } catch (error) {
      console.error('[ATProto] Failed to update status:', error);
      
      // Update UI with error state
      const atprotoState = {
        isConnected: false,
        username: null,
        nickname: null,
        error: error.message
      };
      
      this.getApp().updateATProtoUI(atprotoState);
    }
  }

  /**
   * Force refresh ATProto status
   */
  async forceRefreshATProtoStatus() {
    await this.updateATProtoStatus(true);
  }

  // ===== X ACCOUNT MANAGEMENT =====

  /**
   * Open X accounts modal
   */
  async openXAccountsModal() {
    try {
      // Check if workspace is connected first
      const workspacePath = await window.electronAPI.getWorkspace();
      if (!workspacePath) {
        this.showError('Please select a workspace before managing X accounts.');
        return;
      }

      await this.loadAndRenderXAccounts();
      this.getApp().openModal('x-accounts-modal');
      
      // Force refresh status when modal is opened to ensure UI is in sync
      setTimeout(async () => {
        await this.forceRefreshXStatus();
      }, 200);
    } catch (error) {
      console.error('Failed to open X accounts modal:', error);
      this.showError('Failed to load account information');
    }
  }

  /**
   * Load and render X accounts
   */
  async loadAndRenderXAccounts() {
    try {
      // Load accounts and active account
      const [accounts, activeAccount] = await Promise.all([
        window.electronAPI.x.listAccounts(),
        window.electronAPI.x.getActiveAccount()
      ]);

      this.renderActiveXAccount(activeAccount);
      this.renderXAccountsList(accounts, activeAccount);
    } catch (error) {
      console.error('Failed to load X accounts:', error);
      this.showError('Failed to load accounts');
    }
  }

  /**
   * Render active X account
   */
  renderActiveXAccount(activeAccount) {
    const activeAccountDisplay = document.getElementById('x-active-account-display');
    
    if (activeAccount) {
      activeAccountDisplay.innerHTML = `
        <div class="active-account-info">
          <div class="account-nickname">${this.escapeHtml(activeAccount.nickname)}</div>
          <div class="account-address" title="${activeAccount.username}">@${activeAccount.username}</div>
          <div class="account-balance">Connected</div>
        </div>
      `;
    } else {
      activeAccountDisplay.innerHTML = '<p>No account selected</p>';
    }
  }

  /**
   * Render X accounts list
   */
  renderXAccountsList(accounts, activeAccount) {
    const accountsList = document.getElementById('x-accounts-list');
    
    if (accounts.length === 0) {
      accountsList.innerHTML = '<div class="loading-state">No accounts found. Add your first account below.</div>';
      return;
    }

    const accountsHTML = accounts.map(account => {
      const isActive = activeAccount && activeAccount.id === account.id;
      
      return `
        <div class="account-item ${isActive ? 'active' : ''}" data-account-id="${account.id}">
          <div class="account-status-indicator"></div>
          <div class="account-info">
            <div class="account-nickname">${this.escapeHtml(account.nickname)}</div>
            <div class="account-address" title="${account.username}">@${account.username}</div>
          </div>
          <div class="account-actions">
                      ${!isActive ? `<button class="account-action-btn switch-btn" onclick="meridianApp.getModule('accountManager').switchXAccount('${account.id}')">Switch</button>` : ''}
          <button class="account-action-btn edit-btn" onclick="meridianApp.getModule('accountManager').editXAccountNickname('${account.id}', '${this.escapeHtml(account.nickname)}')">Rename</button>
          <button class="account-action-btn remove-btn" onclick="meridianApp.getModule('accountManager').removeXAccount('${account.id}')">Remove</button>
          </div>
        </div>
      `;
    }).join('');

    accountsList.innerHTML = accountsHTML;
  }

  /**
   * Handle adding X account
   */
  async handleAddXAccount() {
    try {
      const nickname = document.getElementById('x-account-nickname').value.trim();
      const apiKey = document.getElementById('x-account-api-key').value.trim();
      const apiSecret = document.getElementById('x-account-api-secret').value.trim();
      const accessToken = document.getElementById('x-account-access-token').value.trim();
      const accessTokenSecret = document.getElementById('x-account-access-token-secret').value.trim();
      
      if (!nickname) {
        this.showError('Please enter an account nickname');
        return;
      }
      
      if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
        this.showError('Please enter all four X API credentials');
        return;
      }
      
      this.showSuccess('Adding account...');
      
      const account = await window.electronAPI.x.addAccount(apiKey, apiSecret, accessToken, accessTokenSecret, nickname);
      this.showSuccess(`Account "${account.nickname}" added successfully!`);
      
      // Clear form
      document.getElementById('x-account-nickname').value = '';
      document.getElementById('x-account-api-key').value = '';
      document.getElementById('x-account-api-secret').value = '';
      document.getElementById('x-account-access-token').value = '';
      document.getElementById('x-account-access-token-secret').value = '';
      
      // Reload accounts and update status
      await this.loadAndRenderXAccounts();
      
      // Force refresh status to ensure UI is updated
      setTimeout(async () => {
        await this.forceRefreshXStatus();
      }, 100);
      
    } catch (error) {
      console.error('Failed to add X account:', error);
      this.showError(`Failed to add account: ${error.message}`);
    }
  }

  /**
   * Switch X account
   */
  async switchXAccount(accountId) {
    try {
      this.showSuccess('Switching account...');
      
      // Use centralized account switching
      await window.electronAPI.accountState.handleSwitch('x', accountId);
      
      this.showSuccess('Account switched successfully!');
      
      // Reload accounts
      await this.loadAndRenderXAccounts();
      
    } catch (error) {
      console.error('Failed to switch X account:', error);
      this.showError(`Failed to switch account: ${error.message}`);
    }
  }

  /**
   * Edit X account nickname
   */
  async editXAccountNickname(accountId, currentNickname) {
    // Store the account ID for the modal form
    this.renameAccountData.set('x', { accountId, currentNickname });
    
    // Set the current nickname in the input field
    const nicknameInput = document.getElementById('x-rename-account-nickname');
    nicknameInput.value = currentNickname;
    
    // Open the rename modal
    this.getApp().openModal('x-rename-account-modal');
    
    // Focus the input field and select all text
    setTimeout(() => {
      nicknameInput.focus();
      nicknameInput.select();
    }, 100);
  }

  /**
   * Handle X account rename submit
   */
  async handleRenameXAccountSubmit(e) {
    e.preventDefault();
    
    const renameData = this.renameAccountData.get('x');
    if (!renameData) {
      this.showError('No account selected for renaming');
      return;
    }
    
    const newNickname = document.getElementById('x-rename-account-nickname').value.trim();
    
    if (!newNickname || newNickname === renameData.currentNickname) {
      this.getApp().closeModal();
      return;
    }
    
    try {
      await window.electronAPI.x.updateAccountNickname(renameData.accountId, newNickname);
      this.showSuccess('Account nickname updated successfully!');
      
      // Reload accounts
      await this.loadAndRenderXAccounts();
      this.getApp().closeModal();
      
    } catch (error) {
      console.error('Failed to update X account nickname:', error);
      this.showError(`Failed to update nickname: ${error.message}`);
    } finally {
      // Clear the stored data
      this.renameAccountData.delete('x');
    }
  }

  /**
   * Remove X account
   */
  async removeXAccount(accountId) {
    if (!confirm('Are you sure you want to remove this X account? This will delete the account from this application but will not affect your actual X account.')) {
      return;
    }
    
    try {
      await window.electronAPI.x.removeAccount(accountId);
      this.showSuccess('Account removed successfully!');
      
      // Reload accounts and update displays
      await this.loadAndRenderXAccounts();
      
      // Force refresh status to ensure UI is updated
      setTimeout(async () => {
        await this.forceRefreshXStatus();
      }, 100);
      
    } catch (error) {
      console.error('Failed to remove X account:', error);
      this.showError(`Failed to remove account: ${error.message}`);
    }
  }

  /**
   * Update X status
   */
  async updateXStatus(forceRefresh = false) {
    console.log('[X] Updating X status...', forceRefresh ? '(forced refresh)' : '');
    
    try {
      // Clear any cached agents if forcing refresh
      if (forceRefresh) {
        console.log('[X] Forcing refresh - clearing cached state');
      }
      
      const activeAccount = await window.electronAPI.x.getActiveAccount();
      
      if (activeAccount) {
        console.log('[X] Active account found:', activeAccount.nickname);
        
        // Update UI with account state
        const xState = {
          isConnected: true,
          username: activeAccount.username,
          nickname: activeAccount.nickname
        };
        
        this.getApp().updateXUI(xState);
      } else {
        console.log('[X] No active account found');
        
        // Update UI with disconnected state
        const xState = {
          isConnected: false,
          username: null,
          nickname: null
        };
        
        this.getApp().updateXUI(xState);
      }
    } catch (error) {
      console.error('[X] Failed to update status:', error);
      
      // Update UI with error state
      const xState = {
        isConnected: false,
        username: null,
        nickname: null,
        error: error.message
      };
      
      this.getApp().updateXUI(xState);
    }
  }

  /**
   * Force refresh X status
   */
  async forceRefreshXStatus() {
    await this.updateXStatus(true);
  }

  /**
   * Check X permissions
   */
  async checkXPermissions() {
    try {
      this.showSuccess('Checking X permissions...');
      
      const permissions = await window.electronAPI.x.checkPermissions();
      
      if (permissions.isValid) {
        this.showSuccess('X permissions are valid!');
      } else {
        this.showError(`X permissions check failed: ${permissions.error}`);
      }
    } catch (error) {
      console.error('Failed to check X permissions:', error);
      this.showError(`Failed to check permissions: ${error.message}`);
    }
  }

  // ===== GITHUB ACCOUNT MANAGEMENT =====

  /**
   * Open GitHub accounts modal
   */
  async openGitHubAccountsModal() {
    try {
      // Check if workspace is connected first
      const workspacePath = await window.electronAPI.getWorkspace();
      if (!workspacePath) {
        this.showError('Please select a workspace before managing GitHub accounts.');
        return;
      }

      const addButtonSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
      
      // Create the modal element if it doesn't exist
      let modalElement = document.getElementById('github-accounts-modal');
      if (!modalElement) {
        modalElement = document.createElement('div');
        modalElement.id = 'github-accounts-modal';
        modalElement.className = 'modal';
        document.body.appendChild(modalElement);
      }

      // Set the modal content
      modalElement.innerHTML = `
        <div class="modal-header">
          <h3>GitHub Accounts</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-content">
          <div class="accounts-list-section">
            <div id="github-accounts-list">
              Loading accounts...
            </div>
          </div>
          
          <div class="add-account-section">
            <button id="add-github-account-btn" class="primary-btn">
              ${addButtonSvg}
              Add GitHub Account
            </button>
          </div>
        </div>
      `;

      // Show the modal
      await this.getApp().openModal('github-accounts-modal');

      // Load and display accounts
      await this.loadGitHubAccounts();

      // Setup event listeners
      document.getElementById('add-github-account-btn').addEventListener('click', () => {
        this.showAddGitHubAccountModal();
      });

      // Setup close button event listener
      const closeButton = modalElement.querySelector('.modal-close');
      if (closeButton) {
        closeButton.addEventListener('click', () => this.getApp().closeModal());
      }
    } catch (error) {
      console.error('Failed to open GitHub accounts modal:', error);
      this.showError('Failed to load GitHub accounts');
    }
  }

  /**
   * Load GitHub accounts
   */
  async loadGitHubAccounts() {
    try {
      const accounts = await window.electronAPI.deploy.getGitHubAccounts();
      const accountsList = document.getElementById('github-accounts-list');
      
      if (!accounts || accounts.length === 0) {
        accountsList.innerHTML = `
          <div class="loading-state">
            <p>No GitHub accounts found. Add your first account below.</p>
          </div>
        `;
        return;
      }

      const accountItems = accounts.map(account => {
        const tokenTypeClass = account.tokenType === 'fine-grained' ? 'secure' : 'warning';
        const tokenTypeLabel = account.tokenType === 'fine-grained' ? 'Fine-grained' : 'Classic';
        const repoCount = account.repositories?.length || 0;
        const expirationDate = account.expiresAt ? new Date(account.expiresAt).toLocaleDateString() : '';
        const expirationSpan = account.expiresAt ? `<span class="account-expiration">Expires: ${expirationDate}</span>` : '';

        return `
          <div class="account-item">
            <div class="account-status-indicator"></div>
            <div class="account-info">
              <div class="account-nickname">
                ${account.nickname || `@${account.username}`}
                <span class="token-type ${tokenTypeClass}">
                  ${tokenTypeLabel}
                </span>
              </div>
              <div class="account-details">
                <span class="account-address">${repoCount} repositories</span>
                ${expirationSpan}
              </div>
            </div>
            <div class="account-actions">
              <button class="account-action-btn remove-btn" onclick="meridianApp.getModule('accountManager').removeGitHubAccount('${account.id}')">
                Remove
              </button>
            </div>
          </div>
        `;
      }).join('');

      accountsList.innerHTML = accountItems;
    } catch (error) {
      console.error('Failed to load GitHub accounts:', error);
      const accountsList = document.getElementById('github-accounts-list');
      if (accountsList) {
        accountsList.innerHTML = `
          <div class="error-state">
            <p>Failed to load GitHub accounts</p>
          </div>
        `;
      }
    }
  }

  /**
   * Show add GitHub account modal
   */
  async showAddGitHubAccountModal() {
    const modalHtml = `
      <div class="modal-header">
        <h3>Add GitHub Account</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-content">
        <div class="form-section">
          <div class="token-info">
            <div class="security-badge">🔒 Secure Token Creation</div>
            <p>We'll help you create a secure fine-grained token with only the necessary permissions.</p>
          </div>
          
          <div class="form-group">
            <label for="repository-name">Repository Name (Optional)</label>
            <input type="text" id="repository-name" placeholder="owner/repo">
            <small>Pre-select a repository for deployment</small>
          </div>
          
          <div class="token-instructions">
            <h4>Steps to Add Account:</h4>
            <ol>
              <li>Click "Create Token" below to open GitHub's token creation page</li>
              <li>The required permissions will be pre-selected</li>
              <li>Set an expiration date (recommended: 90 days)</li>
              <li>Click "Generate token" on GitHub</li>
              <li>Copy the generated token</li>
              <li>Return here and paste the token</li>
            </ol>
          </div>

          <div class="form-actions">
            <button id="create-token-btn" class="primary-btn">Create Token</button>
          </div>

          <div class="token-input" style="display: none;">
            <div class="form-group">
              <label for="github-token">GitHub Token</label>
              <input type="password" id="github-token" placeholder="Paste your GitHub token">
              <small>Your token will be securely stored and used only for GitHub Pages deployments</small>
            </div>
            
            <div class="form-group">
              <label for="account-nickname">Account Nickname (Optional)</label>
              <input type="text" id="account-nickname" placeholder="e.g., Work Account">
              <small>A friendly name to help you identify this account</small>
            </div>

            <div class="form-actions">
              <button id="add-account-btn" class="primary-btn">Add Account</button>
              <button id="cancel-btn" class="secondary-btn">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Use ModalManager to create and open the modal
    const modalManager = this.getModalManager();
    modalManager.createDynamicModal('add-github-account-modal', modalHtml);
    modalManager.openModal('add-github-account-modal');

    // Setup event listeners
    const createTokenBtn = document.getElementById('create-token-btn');
    const addAccountBtn = document.getElementById('add-account-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const closeBtn = document.querySelector('.modal-close');
    const tokenInput = document.querySelector('.token-input');
    const repoNameInput = document.getElementById('repository-name');

    if (createTokenBtn) {
      createTokenBtn.addEventListener('click', async () => {
        const repoName = repoNameInput.value.trim();
        window.electronAPI.openExternal(this.getTokenCreationUrl(repoName));
        createTokenBtn.style.display = 'none';
        tokenInput.style.display = 'block';
      });
    }

    if (addAccountBtn) {
      addAccountBtn.addEventListener('click', async () => {
        await this.handleAddGitHubAccount();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.getApp().closeModal();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.getApp().closeModal();
      });
    }
  }

  /**
   * Get token creation URL
   */
  getTokenCreationUrl(repoName = '') {
    const baseUrl = 'https://github.com/settings/personal-access-tokens/new';
    const params = new URLSearchParams({
      name: 'Meridian Deployment Token',
      description: 'Token for deploying sites via Meridian',
      repositories: repoName || '',
      permissions: JSON.stringify({
        contents: 'write',
        metadata: 'read',
        'pull-requests': 'read',
        actions: 'write',
        pages: 'write'
      })
    });
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Handle adding GitHub account
   */
  async handleAddGitHubAccount() {
    try {
      const token = document.getElementById('github-token').value.trim();
      const nickname = document.getElementById('account-nickname').value.trim();
      
      if (!token) {
        this.showError('Please enter your GitHub token');
        return;
      }
      
      this.showSuccess('Adding GitHub account...');
      
      const account = await window.electronAPI.deploy.addGitHubAccount(token, nickname);
      this.showSuccess(`GitHub account "${account.nickname || account.username}" added successfully!`);
      
      // Close modal and refresh accounts list
      this.getApp().closeModal();
      await this.loadGitHubAccounts();
      
      // Refresh the main GitHub accounts modal
      await this.openGitHubAccountsModal(); // Refresh the accounts list
      
    } catch (error) {
      console.error('Failed to add GitHub account:', error);
      this.showError(`Failed to add GitHub account: ${error.message}`);
    }
  }

  /**
   * Edit GitHub account nickname
   */
  async editGitHubAccountNickname(accountId, currentNickname) {
    // Store the account ID for the modal form
    this.renameAccountData.set('github', { accountId, currentNickname });
    
    // Set the current nickname in the input field
    const nicknameInput = document.getElementById('github-rename-account-nickname');
    nicknameInput.value = currentNickname;
    
    // Open the rename modal
    this.getApp().openModal('github-rename-account-modal');
    
    // Focus the input field and select all text
    setTimeout(() => {
      nicknameInput.focus();
      nicknameInput.select();
    }, 100);
  }

  /**
   * Remove GitHub account
   */
  async removeGitHubAccount(accountId) {
    if (!confirm('Are you sure you want to remove this GitHub account? This will delete the account from this application but will not affect your actual GitHub account.')) {
      return;
    }
    
    try {
      await window.electronAPI.deploy.removeGitHubAccount(accountId);
      this.showSuccess('GitHub account removed successfully!');
      
      // Reload accounts
      await this.loadGitHubAccounts();
      
    } catch (error) {
      console.error('Failed to remove GitHub account:', error);
      this.showError(`Failed to remove GitHub account: ${error.message}`);
    }
  }

  /**
   * Show security guide
   */
  showSecurityGuide() {
    const modalHtml = `
      <div class="modal-header">
        <h3>GitHub Security Guide</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-content">
        <div class="security-guide">
          <h4>🔒 Fine-Grained Personal Access Tokens</h4>
          <p>For enhanced security, we recommend using fine-grained personal access tokens instead of classic tokens.</p>
          
          <h5>Why Fine-Grained Tokens?</h5>
          <ul>
            <li><strong>Repository-specific:</strong> Limit access to specific repositories</li>
            <li><strong>Permission-specific:</strong> Grant only the permissions needed</li>
            <li><strong>Expiration dates:</strong> Set automatic expiration for better security</li>
            <li><strong>Better audit trail:</strong> More detailed logging of token usage</li>
          </ul>
          
          <h5>Required Permissions for Meridian:</h5>
          <ul>
            <li><strong>Contents:</strong> Read and write access to repository contents</li>
            <li><strong>Metadata:</strong> Read access to repository metadata</li>
            <li><strong>Pull requests:</strong> Read access to pull requests</li>
            <li><strong>Actions:</strong> Read and write access to GitHub Actions</li>
            <li><strong>Pages:</strong> Read and write access to GitHub Pages</li>
          </ul>
          
          <h5>Security Best Practices:</h5>
          <ul>
            <li>Set an expiration date (recommended: 90 days)</li>
            <li>Limit access to specific repositories when possible</li>
            <li>Regularly review and rotate tokens</li>
            <li>Never share tokens or commit them to version control</li>
            <li>Use descriptive names for easy identification</li>
          </ul>
          
          <div class="form-actions">
            <button id="create-fine-grained-token" class="primary-btn">Create Fine-Grained Token</button>
            <button id="create-classic-token" class="secondary-btn">Create Classic Token</button>
          </div>
        </div>
      </div>
    `;

    // Use ModalManager to create and open the modal
    const modalManager = this.getModalManager();
    modalManager.createDynamicModal('security-guide-modal', modalHtml);
    modalManager.openModal('security-guide-modal');

    // Setup event listeners
    const fineGrainedBtn = document.getElementById('create-fine-grained-token');
    const classicBtn = document.getElementById('create-classic-token');
    const closeBtn = document.querySelector('.modal-close');

    if (fineGrainedBtn) {
      fineGrainedBtn.addEventListener('click', () => {
        window.electronAPI.openExternal('https://github.com/settings/personal-access-tokens/new');
        this.getApp().closeModal();
      });
    }

    if (classicBtn) {
      classicBtn.addEventListener('click', () => {
        window.electronAPI.openExternal('https://github.com/settings/tokens/new');
        this.getApp().closeModal();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.getApp().closeModal();
      });
    }
  }

  getModalManager() {
    return this.app.getModule('modalManager');
  }
} 