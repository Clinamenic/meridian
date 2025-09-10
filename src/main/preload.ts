import { contextBridge, ipcRenderer } from 'electron';
import { Platform, ArweaveUpload, SocialPost, ArweaveAccount } from '../types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Workspace management
  selectWorkspace: () => ipcRenderer.invoke('select-workspace'),
  getWorkspace: () => ipcRenderer.invoke('get-workspace'),
  
  // Window management for landing page transition
  transitionToMainApp: () => ipcRenderer.invoke('transitionToMainApp'),
  
  // Window control methods
  closeWindow: () => ipcRenderer.invoke('window:close'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),



  // Archive APIs
  archive: {
    loadData: () => ipcRenderer.invoke('archive:load-data'),
    saveData: (data: any) => ipcRenderer.invoke('archive:save-data', data),
    uploadFile: (filePath: string, tags: string[]) => 
      ipcRenderer.invoke('archive:upload-file', filePath, tags),
    getWalletBalance: () => ipcRenderer.invoke('archive:get-wallet-balance'),
    estimateCost: (fileSize: number) => 
      ipcRenderer.invoke('archive:estimate-cost', fileSize),
    setupWallet: (walletJWK: string) => 
      ipcRenderer.invoke('archive:setup-wallet', walletJWK),
    getWalletInfo: () => ipcRenderer.invoke('archive:get-wallet-info'),
    isWalletConfigured: () => ipcRenderer.invoke('archive:is-wallet-configured'),
    removeWallet: () => ipcRenderer.invoke('archive:remove-wallet'),
    checkTransactionStatus: (transactionId: string) => ipcRenderer.invoke('archive:check-transaction-status', transactionId),
    // Multi-account methods
    addAccount: (walletJWK: string, nickname: string) => ipcRenderer.invoke('archive:add-account', walletJWK, nickname),
    removeAccount: (accountId: string) => ipcRenderer.invoke('archive:remove-account', accountId),
    listAccounts: () => ipcRenderer.invoke('archive:list-accounts'),
    switchAccount: (accountId: string) => ipcRenderer.invoke('archive:switch-account', accountId),
    getActiveAccount: () => ipcRenderer.invoke('archive:get-active-account'),
    updateAccountNickname: (accountId: string, nickname: string) => ipcRenderer.invoke('archive:update-account-nickname', accountId, nickname),
    resolveUUID: (filePath: string) => ipcRenderer.invoke('registry:resolve-uuid', filePath),
    getFileByUUID: (uuid: string) => ipcRenderer.invoke('registry:get-file-by-uuid', uuid),
    // Archive metadata editing
    updateFileMetadata: (uuid: string, updates: any) => ipcRenderer.invoke('archive:update-file-metadata', uuid, updates),
  },

  // Resource APIs (was Unified APIs)
  resource: {
    loadData: () => ipcRenderer.invoke('resource:load-data'),
    saveData: (data: any) => ipcRenderer.invoke('resource:save-data', data),
    addResource: (resource: any) => ipcRenderer.invoke('resource:add-resource', resource),
    updateResource: (id: string, updates: any) => ipcRenderer.invoke('resource:update-resource', id, updates),
    removeResource: (id: string) => ipcRenderer.invoke('resource:remove-resource', id),
    addTagToResource: (resourceId: string, tag: string) => ipcRenderer.invoke('resource:add-tag-to-resource', resourceId, tag),
    removeTagFromResource: (resourceId: string, tag: string) => ipcRenderer.invoke('resource:remove-tag-from-resource', resourceId, tag),
    extractMetadata: (url: string) => ipcRenderer.invoke('resource:extract-metadata', url),
    // Database-specific APIs
    exportToJSON: () => ipcRenderer.invoke('resource:export-to-json'),
    exportToDatabase: (exportData: any) => ipcRenderer.invoke('resource:export-to-database', exportData),
    getStats: () => ipcRenderer.invoke('resource:get-stats'),
    searchResources: (criteria: any) => ipcRenderer.invoke('resource:search-resources', criteria),
    addArweaveUploadToResource: (resourceId: string, uploadRecord: any) => 
      ipcRenderer.invoke('resource:add-arweave-upload-to-resource', resourceId, uploadRecord),
  },

  // Deploy APIs
  deploy: {
    loadData: () => ipcRenderer.invoke('deploy:load-data'),
    saveConfig: (config: any) => ipcRenderer.invoke('deploy:save-config', config),
    initializeQuartz: (workspacePath: string, templateSource?: any) => ipcRenderer.invoke('deploy:initialize-quartz', workspacePath, templateSource),
    buildSite: (config: any) => ipcRenderer.invoke('deploy:build-site', config),
    previewSite: (config: any) => ipcRenderer.invoke('deploy:preview-site', config),
    scanContent: (workspacePath: string) => ipcRenderer.invoke('deploy:scan-content', workspacePath),
    validateContent: (workspacePath: string) => ipcRenderer.invoke('deploy:validate-content', workspacePath),
    validateSystem: () => ipcRenderer.invoke('deploy:validate-system'),
    deployGitHub: (config: any) => ipcRenderer.invoke('deploy:deploy-github', config),
    exportStatic: (config: any) => ipcRenderer.invoke('deploy:export-static', config),
    checkInitialized: (workspacePath: string) => ipcRenderer.invoke('deploy:check-initialized', workspacePath),
    
    // GitHub-specific APIs
    githubAccounts: () => ipcRenderer.invoke('deploy:github-accounts'),
    addGitHubAccount: (token: string, nickname?: string, repoName?: string) => ipcRenderer.invoke('deploy:add-github-account', token, nickname, repoName),
    validateGitHubToken: (token: string) => ipcRenderer.invoke('deploy:validate-github-token', token),
    getGitHubAccount: (accountId: string) => ipcRenderer.invoke('deploy:get-github-account', accountId),
    removeGitHubAccount: (accountId: string) => ipcRenderer.invoke('deploy:remove-github-account', accountId),
    deployToGitHubPages: (config: any) => ipcRenderer.invoke('deploy:deploy-to-github-pages', config),
    generateTokenRequestUrl: (repositoryName?: string) => ipcRenderer.invoke('deploy:generate-token-request-url', repositoryName),
            generateGitHubWorkflow: () => ipcRenderer.invoke('deploy:generate-github-workflow'),
        removeGitHubWorkflow: () => ipcRenderer.invoke('deploy:remove-github-workflow'),
        checkWorkflowFileExists: () => ipcRenderer.invoke('deploy:check-workflow-file-exists'),
    startGitHubAccountAddition: (repoName?: string) => 
      ipcRenderer.invoke('deploy:start-github-account-addition', repoName),
    generateGitHubTokenUrl: (repoName?: string) => 
      ipcRenderer.invoke('deploy:generate-github-token-url', repoName),
    getGitHubAccounts: () => 
      ipcRenderer.invoke('deploy:github-accounts'),
    
    // Arweave deployment APIs
    arweaveDeploy: (config: any) => ipcRenderer.invoke('deploy:arweave-deploy', config),
    arweaveCostEstimate: (config: any) => ipcRenderer.invoke('deploy:arweave-cost-estimate', config),
    hybridDeploy: (config: any) => ipcRenderer.invoke('deploy:hybrid-deploy', config),
    deployToGitHub: (config: any) => ipcRenderer.invoke('deploy:deploy-to-github', config),
  },

  // Site template APIs
  template: {
    getDefault: () => ipcRenderer.invoke('template:getDefault'),
    getClinamenic: () => ipcRenderer.invoke('template:getClinamenic'),
    validateCustomUrl: (url: string) => ipcRenderer.invoke('template:validateCustomUrl', url),
    parseUrl: (url: string) => ipcRenderer.invoke('template:parseUrl', url),
    cloneTemplate: (source: any, destination: string) => ipcRenderer.invoke('template:cloneTemplate', source, destination),
    validateTemplate: (templatePath: string) => ipcRenderer.invoke('template:validateTemplate', templatePath),
    quickValidate: (templatePath: string) => ipcRenderer.invoke('template:quickValidate', templatePath),
  },

  // Broadcast APIs
  broadcast: {
    loadData: () => ipcRenderer.invoke('broadcast:load-data'),
    addPost: (postData: Omit<SocialPost, 'id' | 'createdAt'>) => 
      ipcRenderer.invoke('broadcast:add-post', postData),
    updatePostStatus: (id: string, status: SocialPost['status'], postedAt?: { [platform: string]: string }) => 
      ipcRenderer.invoke('broadcast:update-post-status', id, status, postedAt),
    postToPlatform: (postId: string, platform: Platform) => 
      ipcRenderer.invoke('broadcast:post-to-platform', postId, platform),
    authenticatePlatform: (platform: Platform, credentials: Record<string, string>) => 
      ipcRenderer.invoke('broadcast:authenticate-platform', platform, credentials),
  },

  // AT Protocol APIs
  atproto: {
    addAccount: (handle: string, password: string, nickname: string) => 
      ipcRenderer.invoke('atproto:add-account', handle, password, nickname),
    removeAccount: (accountId: string) => 
      ipcRenderer.invoke('atproto:remove-account', accountId),
    listAccounts: () => 
      ipcRenderer.invoke('atproto:list-accounts'),
    switchAccount: (accountId: string) => 
      ipcRenderer.invoke('atproto:switch-account', accountId),
    getActiveAccount: () => 
      ipcRenderer.invoke('atproto:get-active-account'),
    updateAccountNickname: (accountId: string, nickname: string) => 
      ipcRenderer.invoke('atproto:update-account-nickname', accountId, nickname),
    getProfile: (accountId?: string) => 
      ipcRenderer.invoke('atproto:get-profile', accountId),
    validateSession: (accountId: string) => 
      ipcRenderer.invoke('atproto:validate-session', accountId),
    postContent: (content: string, accountId?: string) => 
      ipcRenderer.invoke('atproto:post-content', content, accountId),
    isAvailable: () => 
      ipcRenderer.invoke('atproto:is-available'),
  },

  // X (Twitter) APIs
  x: {
    addAccount: (apiKey: string, apiSecret: string, accessToken: string, accessTokenSecret: string, nickname: string) => 
      ipcRenderer.invoke('x:add-account', apiKey, apiSecret, accessToken, accessTokenSecret, nickname),
    removeAccount: (accountId: string) => 
      ipcRenderer.invoke('x:remove-account', accountId),
    listAccounts: () => 
      ipcRenderer.invoke('x:list-accounts'),
    switchAccount: (accountId: string) => 
      ipcRenderer.invoke('x:switch-account', accountId),
    getActiveAccount: () => 
      ipcRenderer.invoke('x:get-active-account'),
    updateAccountNickname: (accountId: string, nickname: string) => 
      ipcRenderer.invoke('x:update-account-nickname', accountId, nickname),
    getUserInfo: (accountId?: string) => 
      ipcRenderer.invoke('x:get-user-info', accountId),
    validateCredentials: (accountId: string) => 
      ipcRenderer.invoke('x:validate-credentials', accountId),
    postTweet: (content: string, accountId?: string) => 
      ipcRenderer.invoke('x:post-tweet', content, accountId),
    isAvailable: () => 
      ipcRenderer.invoke('x:is-available'),
    checkAppPermissions: (accountId?: string) => 
      ipcRenderer.invoke('x:check-app-permissions', accountId),
  },

  // Centralized Account State APIs
  accountState: {
    getState: () => 
      ipcRenderer.invoke('account-state:get-state'),
    getPlatformState: (platform: string) => 
      ipcRenderer.invoke('account-state:get-platform-state', platform),
    refreshAll: () => 
      ipcRenderer.invoke('account-state:refresh-all'),
    refreshPlatform: (platform: string) => 
      ipcRenderer.invoke('account-state:refresh-platform', platform),
    isInitialized: () => 
      ipcRenderer.invoke('account-state:is-initialized'),
    handleSwitch: (platform: string, accountId: string) => 
      ipcRenderer.invoke('account-state:handle-switch', platform, accountId),
  },

  // Configuration APIs
  config: {
    loadSiteSettings: (workspacePath: string) => 
      ipcRenderer.invoke('config:load-site-settings', workspacePath),
    saveSiteSettings: (workspacePath: string, settings: any) => 
      ipcRenderer.invoke('config:save-site-settings', workspacePath, settings),
  },

  // Credential APIs
  credentials: {
    set: (service: Platform | 'arweave', key: string, value: string) => 
      ipcRenderer.invoke('credentials:set', service, key, value),
    get: (service: Platform | 'arweave', key: string) => 
      ipcRenderer.invoke('credentials:get', service, key),
    validatePlatform: (platform: Platform) => 
      ipcRenderer.invoke('credentials:validate-platform', platform),
  },

  // Utility APIs
  showItemInFolder: (filePath: string) => 
    ipcRenderer.invoke('show-item-in-folder', filePath),
  openExternal: (url: string) => 
    ipcRenderer.invoke('open-external', url),
  selectFile: (filters?: { name: string; extensions: string[] }[]) => 
    ipcRenderer.invoke('select-file', filters),
  getFileStats: (filePath: string) => 
    ipcRenderer.invoke('get-file-stats', filePath),
  fileExists: (filePath: string) => 
    ipcRenderer.invoke('file-exists', filePath),
  readFile: (filePath: string) => 
    ipcRenderer.invoke('read-file', filePath),
  getAppVersion: () => 
    ipcRenderer.invoke('get-app-version'),
});

// Type definitions for the exposed API
export interface ElectronAPI {
  selectWorkspace: () => Promise<{ success: boolean; path?: string }>;
  getWorkspace: () => Promise<string | null>;
  transitionToMainApp: () => Promise<{ success: boolean; error?: string }>;
  

  
  archive: {
    loadData: () => Promise<any>;
    uploadFile: (filePath: string, tags: string[]) => Promise<any>;
    getWalletBalance: () => Promise<any>;
    estimateCost: (fileSize: number) => Promise<any>;
    setupWallet: (walletJWK: string) => Promise<any>;
    getWalletInfo: () => Promise<any>;
    isWalletConfigured: () => Promise<boolean>;
    removeWallet: () => Promise<void>;
    checkTransactionStatus: (transactionId: string) => Promise<'pending' | 'confirmed' | 'failed'>;
    // Multi-account methods
    addAccount: (walletJWK: string, nickname: string) => Promise<ArweaveAccount>;
    removeAccount: (accountId: string) => Promise<void>;
    listAccounts: () => Promise<ArweaveAccount[]>;
    switchAccount: (accountId: string) => Promise<void>;
    getActiveAccount: () => Promise<ArweaveAccount | null>;
    updateAccountNickname: (accountId: string, nickname: string) => Promise<void>;
    resolveUUID: (filePath: string) => Promise<any>;
    getFileByUUID: (uuid: string) => Promise<any>;
    updateFileMetadata: (uuid: string, updates: any) => Promise<void>;
  };

  resource: {
    loadData: () => Promise<any>;
    saveData: (data: any) => Promise<void>;
    addResource: (resource: any) => Promise<any>;
    updateResource: (id: string, updates: any) => Promise<any>;
    removeResource: (id: string) => Promise<void>;
    addTagToResource: (resourceId: string, tag: string) => Promise<any>;
    removeTagFromResource: (resourceId: string, tag: string) => Promise<any>;
    extractMetadata: (url: string) => Promise<any>;
    exportToJSON: () => Promise<any>;
    exportToDatabase: (exportData: any) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    getStats: () => Promise<any>;
    searchResources: (criteria: any) => Promise<any>;
    addArweaveUploadToResource: (resourceId: string, uploadRecord: any) => Promise<{ success: boolean; error?: string }>;
  };

  deploy: {
    loadData: () => Promise<any>;
    saveConfig: (config: any) => Promise<void>;
    initializeQuartz: (workspacePath: string, templateSource?: any) => Promise<void>;
    buildSite: (config: any) => Promise<any>;
    previewSite: (config: any) => Promise<string>;
    scanContent: (workspacePath: string) => Promise<any>;
    validateContent: (workspacePath: string) => Promise<any>;
    validateSystem: () => Promise<any>;
    deployGitHub: (config: any) => Promise<any>;
    exportStatic: (config: any) => Promise<string>;
    checkInitialized: (workspacePath: string) => Promise<boolean>;
    
    // GitHub-specific APIs
    githubAccounts: () => Promise<any[]>;
    addGitHubAccount: (token: string, nickname?: string, repoName?: string) => Promise<any>;
    validateGitHubToken: (token: string) => Promise<any>;
    getGitHubAccount: (accountId: string) => Promise<any>;
    removeGitHubAccount: (accountId: string) => Promise<void>;
    deployToGitHubPages: (config: any) => Promise<any>;
    generateTokenRequestUrl: (repositoryName?: string) => Promise<string>;
    generateGitHubWorkflow: () => Promise<{success: boolean, error?: string}>;
    removeGitHubWorkflow: () => Promise<{success: boolean, error?: string}>;
    checkWorkflowFileExists: () => Promise<{exists: boolean, error?: string}>;
    startGitHubAccountAddition: (repoName?: string) => Promise<void>;
    generateGitHubTokenUrl: (repoName?: string) => Promise<string>;
    getGitHubAccounts: () => Promise<any[]>;
    
    // Arweave deployment APIs
    arweaveDeploy: (config: any) => Promise<any>;
    arweaveCostEstimate: (config: any) => Promise<any>;
    hybridDeploy: (config: any) => Promise<any>;
    deployToGitHub: (config: any) => Promise<any>;
  };

  template: {
    getDefault: () => Promise<any>;
    getClinamenic: () => Promise<any>;
    validateCustomUrl: (url: string) => Promise<any>;
    parseUrl: (url: string) => Promise<any>;
    cloneTemplate: (source: any, destination: string) => Promise<any>;
    validateTemplate: (templatePath: string) => Promise<any>;
    quickValidate: (templatePath: string) => Promise<boolean>;
  };
  
  broadcast: {
    loadData: () => Promise<any>;
    addPost: (postData: Omit<SocialPost, 'id' | 'createdAt'>) => Promise<SocialPost>;
    updatePostStatus: (id: string, status: SocialPost['status'], postedAt?: { [platform: string]: string }) => Promise<void>;
    postToPlatform: (postId: string, platform: Platform) => Promise<any>;
    authenticatePlatform: (platform: Platform, credentials: Record<string, string>) => Promise<boolean>;
  };

  atproto: {
    addAccount: (handle: string, password: string, nickname: string) => Promise<any>;
    removeAccount: (accountId: string) => Promise<void>;
    listAccounts: () => Promise<any[]>;
    switchAccount: (accountId: string) => Promise<void>;
    getActiveAccount: () => Promise<any | null>;
    updateAccountNickname: (accountId: string, nickname: string) => Promise<void>;
    getProfile: (accountId?: string) => Promise<any | null>;
    validateSession: (accountId: string) => Promise<boolean>;
    postContent: (content: string, accountId?: string) => Promise<string | null>;
    isAvailable: () => Promise<boolean>;
  };

  x: {
    addAccount: (apiKey: string, apiSecret: string, accessToken: string, accessTokenSecret: string, nickname: string) => Promise<any>;
    removeAccount: (accountId: string) => Promise<void>;
    listAccounts: () => Promise<any[]>;
    switchAccount: (accountId: string) => Promise<void>;
    getActiveAccount: () => Promise<any | null>;
    updateAccountNickname: (accountId: string, nickname: string) => Promise<void>;
    getUserInfo: (accountId?: string) => Promise<any | null>;
    validateCredentials: (accountId: string) => Promise<boolean>;
    postTweet: (content: string, accountId?: string) => Promise<string | null>;
    isAvailable: () => Promise<boolean>;
    checkAppPermissions: (accountId?: string) => Promise<{ canRead: boolean; canWrite: boolean; details: any }>;
  };

  accountState: {
    getState: () => Promise<any>;
    getPlatformState: (platform: string) => Promise<any>;
    refreshAll: () => Promise<void>;
    refreshPlatform: (platform: string) => Promise<void>;
    isInitialized: () => Promise<boolean>;
    handleSwitch: (platform: string, accountId: string) => Promise<void>;
  };
  
  credentials: {
    set: (service: Platform | 'arweave', key: string, value: string) => Promise<void>;
    get: (service: Platform | 'arweave', key: string) => Promise<string | null>;
    validatePlatform: (platform: Platform) => Promise<boolean>;
  };

  config: {
    loadSiteSettings: (workspacePath: string) => Promise<any>;
    saveSiteSettings: (workspacePath: string, settings: any) => Promise<void>;
  };
  
  showItemInFolder: (filePath: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
  getFileStats: (filePath: string) => Promise<{ size: number; name: string }>;
  fileExists: (filePath: string) => Promise<boolean>;
  readFile: (filePath: string) => Promise<string>;
  getAppVersion: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
} 