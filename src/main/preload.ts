import { contextBridge, ipcRenderer } from 'electron';
import { Platform, Resource, ArweaveUpload, SocialPost, ArweaveAccount } from '../types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Workspace management
  selectWorkspace: () => ipcRenderer.invoke('select-workspace'),
  getWorkspace: () => ipcRenderer.invoke('get-workspace'),

  // Collate APIs
  collate: {
    loadData: () => ipcRenderer.invoke('collate:load-data'),
    addResource: (resourceData: Omit<Resource, 'id' | 'createdAt' | 'modifiedAt'>) => 
      ipcRenderer.invoke('collate:add-resource', resourceData),
    updateResource: (id: string, updates: Partial<Resource>) => 
      ipcRenderer.invoke('collate:update-resource', id, updates),
    addTagToResource: (resourceId: string, tag: string) => 
      ipcRenderer.invoke('collate:add-tag-to-resource', resourceId, tag),
    removeTagFromResource: (resourceId: string, tag: string) => 
      ipcRenderer.invoke('collate:remove-tag-from-resource', resourceId, tag),
    renameTag: (oldTag: string, newTag: string) => 
      ipcRenderer.invoke('collate:rename-tag', oldTag, newTag),
    deleteTag: (tag: string) => 
      ipcRenderer.invoke('collate:delete-tag', tag),
    removeResource: (resourceId: string) => 
      ipcRenderer.invoke('collate:remove-resource', resourceId),
    extractMetadata: (url: string) => 
      ipcRenderer.invoke('collate:extract-metadata', url),
    exportResources: (format: string, data: any, filename: string) => 
      ipcRenderer.invoke('collate:export-resources', format, data, filename),
  },

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
});

// Type definitions for the exposed API
export interface ElectronAPI {
  selectWorkspace: () => Promise<{ success: boolean; path?: string }>;
  getWorkspace: () => Promise<string | null>;
  
  collate: {
    loadData: () => Promise<any>;
    addResource: (resourceData: Omit<Resource, 'id' | 'createdAt' | 'modifiedAt'>) => Promise<Resource>;
    updateResource: (id: string, updates: Partial<Resource>) => Promise<Resource>;
    addTagToResource: (resourceId: string, tag: string) => Promise<Resource>;
    removeTagFromResource: (resourceId: string, tag: string) => Promise<Resource>;
    renameTag: (oldTag: string, newTag: string) => Promise<void>;
    deleteTag: (tag: string) => Promise<void>;
    removeResource: (resourceId: string) => Promise<void>;
    extractMetadata: (url: string) => Promise<any>;
  };
  
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
  
  showItemInFolder: (filePath: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
  getFileStats: (filePath: string) => Promise<{ size: number; name: string }>;
  fileExists: (filePath: string) => Promise<boolean>;
  readFile: (filePath: string) => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
} 