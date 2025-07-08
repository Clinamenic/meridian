import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as packageJson from '../../package.json';
import { CredentialManager } from './credential-manager';
import { DataManager } from './data-manager';
import { MetadataExtractor } from './metadata-extractor';
import { ArweaveManager } from './arweave-manager';
import { ATProtoManager } from './atproto-manager';
import { XManager } from './x-manager';
import { SocialManager } from './social-manager';
import { AccountStateManager } from './account-state-manager';
import { TemplateManager } from './template-manager';
import { StagingManager } from './staging-manager';
import { MarkdownProcessor } from './markdown-processor';
import DeployManager from './deploy-manager';
import ConfigManager from './config-manager';
import { GitHubManager } from './github-manager';
import { UnifiedDatabaseManager } from './unified-database-manager';
import { 
  UnifiedResource 
} from '../types';

class MeridianApp {
  private mainWindow: BrowserWindow | null = null;
  private credentialManager: CredentialManager;
  private dataManager: DataManager;
  private metadataExtractor: MetadataExtractor;
  private arweaveManager: ArweaveManager;
  private atprotoManager: ATProtoManager;
  private xManager: XManager;
  private socialManager: SocialManager;
  private accountStateManager: AccountStateManager;
  private templateManager: TemplateManager;
  private stagingManager: StagingManager;
  private markdownProcessor: MarkdownProcessor;
  private deployManager: DeployManager;
  private configManager: ConfigManager;
  private githubManager: GitHubManager;
  private unifiedDatabaseManager: UnifiedDatabaseManager;

  constructor() {
    this.credentialManager = CredentialManager.getInstance();
    this.dataManager = new DataManager();
    this.metadataExtractor = new MetadataExtractor();
    this.arweaveManager = new ArweaveManager(this.dataManager);
    this.atprotoManager = new ATProtoManager(this.dataManager);
    this.xManager = new XManager(this.dataManager);
    this.socialManager = new SocialManager();
    this.templateManager = new TemplateManager(this.dataManager);
    this.stagingManager = new StagingManager(this.dataManager, this.socialManager);
    this.markdownProcessor = new MarkdownProcessor();
    this.deployManager = new DeployManager();
    this.configManager = ConfigManager.getInstance();
    this.githubManager = new GitHubManager();
    this.unifiedDatabaseManager = new UnifiedDatabaseManager();

    // Initialize centralized account state manager
    this.accountStateManager = AccountStateManager.getInstance(
      this.credentialManager,
      this.arweaveManager,
      this.atprotoManager,
      this.xManager
    );

    this.setupApp();
    this.setupIPC();
  }

  private setupApp(): void {
    // Set security policies
    app.setAsDefaultProtocolClient('meridian');
    
    // Ready event
    app.whenReady().then(() => {
      this.createWindow();
      
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createWindow();
        }
      });
    });

    // All windows closed
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

        // App quit - cleanup database connections
    app.on('before-quit', async () => {
      try {
        await this.unifiedDatabaseManager.close();
        console.log('[Main] Database connections closed successfully');
      } catch (error) {
        console.error('[Main] Failed to close database connections:', error);
      }
    });

    // Security: Prevent new window creation
    app.on('web-contents-created', (_, contents) => {
      contents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
      });
    });
  }

  private createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 900,
      height: 800,
      minWidth: 700,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,

        preload: path.join(__dirname, 'preload.js'),
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false
      },
      titleBarStyle: 'hiddenInset',
      show: false
    });

    // Load the renderer
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadFile(path.join(__dirname, '../../src/renderer/index.html'));
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../../src/renderer/index.html'));
    }

    // Show when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // Handle close
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private setupIPC(): void {
    // Workspace management
    ipcMain.handle('select-workspace', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        properties: ['openDirectory'],
        title: 'Select Workspace Directory'
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const workspacePath = result.filePaths[0]!;
        await this.dataManager.setWorkspace(workspacePath);
        await this.credentialManager.setWorkspace(workspacePath);
        this.deployManager.setWorkspace(workspacePath);
        
        // Initialize unified database for the workspace
        try {
          await this.unifiedDatabaseManager.initialize(workspacePath);
          console.log('[Main] Unified database initialized successfully');
          
          // Check if there's existing JSON data to migrate
          try {
            const existingData = await this.dataManager.loadUnifiedData();
            if (existingData.resources.length > 0) {
              console.log(`[Main] Migrating ${existingData.resources.length} resources from JSON to SQLite...`);
              await this.unifiedDatabaseManager.importFromJSON(existingData);
              console.log('[Main] Migration completed successfully');
            }
          } catch (error) {
            console.log('[Main] No existing JSON data to migrate');
          }
        } catch (error) {
          console.error('[Main] Failed to initialize unified database:', error);
        }
        
        // Initialize centralized account state detection
        await this.accountStateManager.initializeForWorkspace(workspacePath);
        
        return workspacePath;
      }

      return null;
    });

    ipcMain.handle('get-workspace', () => {
      return this.dataManager.getWorkspacePath();
    });



    // Unified IPC handlers
    ipcMain.handle('unified:load-data', async () => {
      try {
        const resources = await this.unifiedDatabaseManager.getAllResources();
        const tags = await this.unifiedDatabaseManager.getTagCounts();
        return {
          resources,
          tags,
          lastModified: new Date().toISOString(),
          version: '2.0'
        };
      } catch (error) {
        console.error('[Main] Failed to load unified data from database:', error);
        // Fallback to JSON if database fails
        return await this.dataManager.loadUnifiedData();
      }
    });

    ipcMain.handle('unified:save-data', async (_, data) => {
      try {
        await this.unifiedDatabaseManager.importFromJSON(data);
        return { success: true };
      } catch (error) {
        console.error('[Main] Failed to save unified data to database:', error);
        // Fallback to JSON if database fails
        return await this.dataManager.saveUnifiedData(data);
      }
    });

    ipcMain.handle('unified:add-resource', async (_, resource) => {
      try {
        return await this.unifiedDatabaseManager.addResource(resource);
      } catch (error) {
        console.error('[Main] Failed to add unified resource to database:', error);
        // Fallback to JSON if database fails
        return await this.dataManager.addUnifiedResource(resource);
      }
    });

    ipcMain.handle('unified:update-resource', async (_, id, updates) => {
      try {
        return await this.unifiedDatabaseManager.updateResource(id, updates);
      } catch (error) {
        console.error('[Main] Failed to update unified resource in database:', error);
        // Fallback to JSON if database fails
        return await this.dataManager.updateUnifiedResource(id, updates);
      }
    });

    ipcMain.handle('unified:remove-resource', async (_, id) => {
      try {
        await this.unifiedDatabaseManager.removeResource(id);
        return { success: true };
      } catch (error) {
        console.error('[Main] Failed to remove unified resource from database:', error);
        // Fallback to JSON if database fails
        return await this.dataManager.removeUnifiedResource(id);
      }
    });

    ipcMain.handle('unified:add-tag-to-resource', async (_, resourceId, tag) => {
      try {
        return await this.unifiedDatabaseManager.addTagToResource(resourceId, tag);
      } catch (error) {
        console.error('[Main] Failed to add tag to unified resource in database:', error);
        // Fallback to JSON if database fails
        return await this.dataManager.addTagToUnifiedResource(resourceId, tag);
      }
    });

    ipcMain.handle('unified:remove-tag-from-resource', async (_, resourceId, tag) => {
      try {
        return await this.unifiedDatabaseManager.removeTagFromResource(resourceId, tag);
      } catch (error) {
        console.error('[Main] Failed to remove tag from unified resource in database:', error);
        // Fallback to JSON if database fails
        return await this.dataManager.removeTagFromUnifiedResource(resourceId, tag);
      }
    });

    // New unified database-specific handlers
    ipcMain.handle('unified:export-to-json', async () => {
      try {
        return await this.unifiedDatabaseManager.exportToJSON();
      } catch (error) {
        console.error('[Main] Failed to export unified data to JSON:', error);
        throw error;
      }
    });

    ipcMain.handle('unified:export-to-database', async (_, exportData) => {
      try {
        return await this.unifiedDatabaseManager.exportToDatabase(exportData);
      } catch (error) {
        console.error('[Main] Failed to export unified database:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('unified:get-stats', async () => {
      try {
        return await this.unifiedDatabaseManager.getStats();
      } catch (error) {
        console.error('[Main] Failed to get unified database stats:', error);
        throw error;
      }
    });

    ipcMain.handle('unified:search-resources', async (_, criteria) => {
      try {
        return await this.unifiedDatabaseManager.searchResources(criteria);
      } catch (error) {
        console.error('[Main] Failed to search unified resources:', error);
        throw error;
      }
    });

    // Archive IPC handlers
    ipcMain.handle('archive:load-data', async () => {
      return await this.dataManager.loadArchiveData();
    });

    ipcMain.handle('archive:save-data', async (_, data) => {
      return await this.dataManager.saveArchiveData(data);
    });

    ipcMain.handle('archive:upload-file', async (_, filePath, tags) => {
      return await this.arweaveManager.uploadFile(filePath, tags);
    });

    ipcMain.handle('archive:get-wallet-balance', async () => {
      return await this.arweaveManager.getWalletBalance();
    });

    ipcMain.handle('archive:estimate-cost', async (_, fileSize) => {
      return await this.arweaveManager.estimateUploadCost(fileSize);
    });

    ipcMain.handle('archive:setup-wallet', async (_, walletJWK) => {
      return await this.arweaveManager.setupWallet(walletJWK);
    });

    ipcMain.handle('archive:get-wallet-info', async () => {
      return await this.arweaveManager.getWalletInfo();
    });

    ipcMain.handle('archive:is-wallet-configured', async () => {
      return await this.arweaveManager.isWalletConfigured();
    });

    ipcMain.handle('archive:remove-wallet', async () => {
      return await this.arweaveManager.removeWallet();
    });

    ipcMain.handle('archive:check-transaction-status', async (_, transactionId) => {
      return await this.arweaveManager.checkTransactionStatus(transactionId);
    });

    // Multi-account Arweave IPC handlers
    ipcMain.handle('archive:add-account', async (_, walletJWK, nickname) => {
      return await this.arweaveManager.addAccount(walletJWK, nickname);
    });

    ipcMain.handle('archive:remove-account', async (_, accountId) => {
      return await this.arweaveManager.removeAccount(accountId);
    });

    ipcMain.handle('archive:list-accounts', async () => {
      return await this.arweaveManager.listAccounts();
    });

    ipcMain.handle('archive:switch-account', async (_, accountId) => {
      return await this.arweaveManager.switchAccount(accountId);
    });

    ipcMain.handle('archive:get-active-account', async () => {
      return await this.arweaveManager.getActiveAccount();
    });

    ipcMain.handle('archive:update-account-nickname', async (_, accountId, nickname) => {
      return await this.arweaveManager.updateAccountNickname(accountId, nickname);
    });

    // File Registry IPC handlers (UUID-based file management)
    ipcMain.handle('registry:resolve-uuid', async (_, filePath) => {
      return await this.arweaveManager.resolveUUID(filePath);
    });

    ipcMain.handle('registry:get-file-by-uuid', async (_, uuid) => {
      return await this.dataManager.getFileByUUID(uuid);
    });

    ipcMain.handle('registry:get-file-by-path', async (_, filePath) => {
      const files = await this.dataManager.searchFiles({ filePath });
      return files.length > 0 ? files[0] : null;
    });

    ipcMain.handle('registry:add-or-update-file', async (_, entry) => {
      return await this.dataManager.addOrUpdateFile(entry);
    });

    ipcMain.handle('registry:get-all-files', async () => {
      return await this.dataManager.getAllFiles();
    });

    ipcMain.handle('registry:search-by-tags', async (_, tags) => {
      return await this.dataManager.searchFiles({ tags });
    });

    ipcMain.handle('registry:search-by-title', async (_, query) => {
      return await this.dataManager.searchFiles({ title: query });
    });

    ipcMain.handle('registry:validate-registry', async () => {
      // This functionality would need to be implemented in DataManager if needed
      return { valid: true, issues: [] };
    });

    ipcMain.handle('registry:rebuild-registry', async (_, scanPaths) => {
      // This functionality would need to be implemented in DataManager if needed
      return { success: true, filesProcessed: 0 };
    });

    // Archive metadata editing IPC handler
    ipcMain.handle('archive:update-file-metadata', async (_, uuid, updates) => {
      return await this.dataManager.updateEditableMetadata(uuid, updates);
    });

    // AT Protocol IPC handlers
    ipcMain.handle('atproto:add-account', async (_, handle, password, nickname) => {
      return await this.atprotoManager.addAccount(handle, password, nickname);
    });

    ipcMain.handle('atproto:remove-account', async (_, accountId) => {
      return await this.atprotoManager.removeAccount(accountId);
    });

    ipcMain.handle('atproto:list-accounts', async () => {
      return await this.atprotoManager.listAccounts();
    });

    ipcMain.handle('atproto:switch-account', async (_, accountId) => {
      return await this.atprotoManager.switchAccount(accountId);
    });

    ipcMain.handle('atproto:get-active-account', async () => {
      return await this.atprotoManager.getActiveAccount();
    });

    ipcMain.handle('atproto:update-account-nickname', async (_, accountId, nickname) => {
      return await this.atprotoManager.updateAccountNickname(accountId, nickname);
    });

    ipcMain.handle('atproto:get-profile', async (_, accountId) => {
      return await this.atprotoManager.getProfile(accountId);
    });

    ipcMain.handle('atproto:validate-session', async (_, accountId) => {
      return await this.atprotoManager.validateSession(accountId);
    });

    ipcMain.handle('atproto:post-content', async (_, content, accountId) => {
      return await this.atprotoManager.postContent(content, accountId);
    });

    ipcMain.handle('atproto:is-available', async () => {
      return await this.atprotoManager.isAvailable();
    });

    // X (Twitter) IPC handlers
    ipcMain.handle('x:add-account', async (_, apiKey, apiSecret, accessToken, accessTokenSecret, nickname) => {
      return await this.xManager.addAccount(apiKey, apiSecret, accessToken, accessTokenSecret, nickname);
    });

    ipcMain.handle('x:remove-account', async (_, accountId) => {
      return await this.xManager.removeAccount(accountId);
    });

    ipcMain.handle('x:list-accounts', async () => {
      return await this.xManager.listAccounts();
    });

    ipcMain.handle('x:switch-account', async (_, accountId) => {
      return await this.xManager.switchAccount(accountId);
    });

    ipcMain.handle('x:get-active-account', async () => {
      return await this.xManager.getActiveAccount();
    });

    ipcMain.handle('x:update-account-nickname', async (_, accountId, nickname) => {
      return await this.xManager.updateAccountNickname(accountId, nickname);
    });

    ipcMain.handle('x:get-user-info', async (_, accountId) => {
      return await this.xManager.getUserInfo(accountId);
    });

    ipcMain.handle('x:validate-credentials', async (_, accountId) => {
      return await this.xManager.validateCredentials(accountId);
    });

    ipcMain.handle('x:post-tweet', async (_, content, accountId) => {
      return await this.xManager.postTweet(content, accountId);
    });

    ipcMain.handle('x:is-available', async () => {
      return await this.xManager.isAvailable();
    });

    ipcMain.handle('x:check-app-permissions', async (_, accountId) => {
      return await this.xManager.checkAppPermissions(accountId);
    });

    // Broadcast IPC handlers
    ipcMain.handle('broadcast:load-data', async () => {
      return await this.dataManager.loadBroadcastData();
    });

    ipcMain.handle('broadcast:add-post', async (_, postData) => {
      return await this.dataManager.addPost(postData);
    });

    ipcMain.handle('broadcast:update-post-status', async (_, id, status, postedAt) => {
      return await this.dataManager.updatePostStatus(id, status, postedAt);
    });

    ipcMain.handle('broadcast:post-to-platform', async (_, postId, platform) => {
      return await this.socialManager.postToPlatform(postId, platform);
    });

    ipcMain.handle('broadcast:authenticate-platform', async (_, platform, credentials) => {
      return await this.socialManager.authenticatePlatform(platform, credentials);
    });

    // Enhanced Broadcast V2 IPC handlers
    ipcMain.handle('broadcast:load-data-v2', async () => {
      return await this.dataManager.loadBroadcastDataV2();
    });

    // Template management
    ipcMain.handle('broadcast:create-template', async (_, templateData) => {
      return await this.templateManager.createTemplate(templateData);
    });

    ipcMain.handle('broadcast:update-template', async (_, id, updates) => {
      return await this.templateManager.updateTemplate(id, updates);
    });

    ipcMain.handle('broadcast:delete-template', async (_, id) => {
      return await this.templateManager.deleteTemplate(id);
    });

    ipcMain.handle('broadcast:get-template', async (_, id) => {
      return await this.templateManager.getTemplate(id);
    });

    ipcMain.handle('broadcast:list-templates', async (_, filters) => {
      return await this.templateManager.listTemplates(filters);
    });

    ipcMain.handle('broadcast:apply-template', async (_, templateId, markdownFile) => {
      return await this.templateManager.applyTemplate(templateId, markdownFile);
    });

    ipcMain.handle('broadcast:preview-template', async (_, templateId, variables) => {
      return await this.templateManager.previewTemplate(templateId, variables);
    });

    // Staging management
    ipcMain.handle('broadcast:create-staged-post', async (_, data) => {
      return await this.stagingManager.createStagedPost(data);
    });

    ipcMain.handle('broadcast:update-staged-post', async (_, id, updates) => {
      return await this.stagingManager.updateStagedPost(id, updates);
    });

    ipcMain.handle('broadcast:delete-staged-post', async (_, id) => {
      return await this.stagingManager.deleteStagedPost(id);
    });

    ipcMain.handle('broadcast:get-staged-post', async (_, id) => {
      return await this.stagingManager.getStagedPost(id);
    });

    ipcMain.handle('broadcast:list-staged-posts', async (_, filters) => {
      return await this.stagingManager.listStagedPosts(filters);
    });

    ipcMain.handle('broadcast:update-platform-content', async (_, postId, platform, content) => {
      return await this.stagingManager.updatePlatformContent(postId, platform, content);
    });

    ipcMain.handle('broadcast:toggle-platform', async (_, postId, platform, enabled) => {
      return await this.stagingManager.togglePlatform(postId, platform, enabled);
    });

    ipcMain.handle('broadcast:bulk-schedule', async (_, postIds, scheduledFor) => {
      return await this.stagingManager.bulkSchedule(postIds, scheduledFor);
    });

    ipcMain.handle('broadcast:bulk-publish', async (_, postIds) => {
      return await this.stagingManager.bulkPublish(postIds);
    });

    ipcMain.handle('broadcast:bulk-delete', async (_, postIds) => {
      return await this.stagingManager.bulkDelete(postIds);
    });

    ipcMain.handle('broadcast:get-post-stats', async () => {
      return await this.stagingManager.getPostStats();
    });

    // Markdown processing
    ipcMain.handle('broadcast:scan-content-directory', async (_, directory) => {
      return await this.markdownProcessor.scanContentDirectory(directory);
    });

    ipcMain.handle('broadcast:parse-markdown-file', async (_, filePath) => {
      return await this.markdownProcessor.parseMarkdownFile(filePath);
    });

    ipcMain.handle('broadcast:watch-content-directory', async (_, directory) => {
      // Note: This would need to handle the callback appropriately in a real implementation
      // For now, we'll just return success
      return { success: true };
    });

    // Centralized Account State Management IPC handlers
    ipcMain.handle('account-state:get-state', async () => {
      return this.accountStateManager.getState();
    });

    ipcMain.handle('account-state:get-platform-state', async (_, platform) => {
      return this.accountStateManager.getPlatformState(platform);
    });

    ipcMain.handle('account-state:refresh-all', async () => {
      return await this.accountStateManager.refreshAllPlatforms();
    });

    ipcMain.handle('account-state:refresh-platform', async (_, platform) => {
      return await this.accountStateManager.refreshPlatform(platform);
    });

    ipcMain.handle('account-state:is-initialized', async () => {
      return this.accountStateManager.isStateInitialized();
    });

    ipcMain.handle('account-state:handle-switch', async (_, platform, accountId) => {
      return await this.accountStateManager.handleAccountSwitch(platform, accountId);
    });

    // Configuration management IPC handlers
    ipcMain.handle('config:load-site-settings', async (_, workspacePath) => {
      return await this.configManager.loadSiteSettings(workspacePath);
    });

    ipcMain.handle('config:save-site-settings', async (_, workspacePath, settings) => {
      return await this.configManager.saveSiteSettings(workspacePath, settings);
    });

    // Credential management
    ipcMain.handle('credentials:set', async (_, service, key, value) => {
      return await this.credentialManager.setCredential(service, key, value);
    });

    ipcMain.handle('credentials:get', async (_, service, key) => {
      return await this.credentialManager.getCredential(service, key);
    });

    ipcMain.handle('credentials:validate-platform', async (_, platform) => {
      return await this.credentialManager.validatePlatformCredentials(platform);
    });

    // Utility handlers
    ipcMain.handle('show-item-in-folder', async (_, filePath) => {
      shell.showItemInFolder(filePath);
    });

    ipcMain.handle('open-external', async (_, url) => {
      shell.openExternal(url);
    });

    ipcMain.handle('select-file', async (_, filters) => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        properties: ['openFile'],
        filters: filters || [{ name: 'All Files', extensions: ['*'] }]
      });

      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
      }

      return null;
    });

    ipcMain.handle('get-file-stats', async (_, filePath) => {
      const fs = require('fs');
      const path = require('path');
      
      try {
        const stats = fs.statSync(filePath);
        return {
          size: stats.size,
          name: path.basename(filePath)
        };
      } catch (error) {
        throw new Error(`Failed to get file stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('file-exists', async (_, filePath) => {
      const fs = require('fs');
      
      try {
        return fs.existsSync(filePath);
      } catch (error) {
        return false;
      }
    });

    ipcMain.handle('read-file', async (_, filePath) => {
      const fs = require('fs');
      
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        return content;
      } catch (error) {
        throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('get-app-version', async () => {
      return packageJson.version;
    });
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

// Initialize the application
new MeridianApp(); 