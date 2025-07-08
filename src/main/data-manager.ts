import { promises as fs } from 'fs';
import * as path from 'path';
import { ArchiveData, BroadcastData, UnifiedData, Resource, UnifiedResource, ArweaveUpload, SocialPost, FileRegistryEntry, ArweaveUploadRecord } from '../types';

export interface MeridianWorkspaceStructure {
  meridianPath: string;       // .meridian/
  configPath: string;      // .meridian/config/
  dataPath: string;        // .meridian/data/
  attachmentsPath: string; // .meridian/attachments/
  logsPath: string;        // .meridian/logs/
  tempPath: string;        // .meridian/temp/
}

export class DataManager {
  private workspacePath: string | null = null;
  private meridianStructure: MeridianWorkspaceStructure | null = null;

  constructor() {}

  /**
   * Set the workspace path and initialize .meridian directory structure
   */
  public async setWorkspace(workspacePath: string): Promise<void> {
    this.workspacePath = workspacePath;
    
    // Define .meridian structure  
    const meridianPath = path.join(workspacePath, '.meridian');
    this.meridianStructure = {
      meridianPath,
      configPath: path.join(meridianPath, 'config'),
      dataPath: path.join(meridianPath, 'data'),
      attachmentsPath: path.join(meridianPath, 'attachments'),
      logsPath: path.join(meridianPath, 'logs'),
      tempPath: path.join(meridianPath, 'temp')
    };

    // Check for migration from old structure
    await this.migrateFromLegacyStructure();
    
    // Ensure .meridian directory structure exists
    await this.ensureMeridianDirectory();
    console.log(`Workspace set to: ${workspacePath}`);
    console.log(`Meridian directory: ${meridianPath}`);
  }

  /**
   * Get the current workspace path
   */
  public getWorkspacePath(): string | null {
    return this.workspacePath;
  }

  /**
   * Migrate from legacy structure (data/ and attachments/ in root) to .meridian/ structure
   */
  private async migrateFromLegacyStructure(): Promise<void> {
    if (!this.workspacePath || !this.meridianStructure) return;

    const legacyDataPath = path.join(this.workspacePath, 'data');
    const legacyAttachmentsPath = path.join(this.workspacePath, 'attachments');

    try {
      // Check if legacy structure exists
      const legacyDataExists = await this.pathExists(legacyDataPath);
      const legacyAttachmentsExists = await this.pathExists(legacyAttachmentsPath);

      if (legacyDataExists || legacyAttachmentsExists) {
        console.log('Migrating from legacy workspace structure...');

        // Ensure new structure exists
        await this.ensureMeridianDirectory();

        // Migrate data directory
        if (legacyDataExists) {
          await this.moveDirectory(legacyDataPath, this.meridianStructure.dataPath);
          console.log('Migrated data/ to .meridian/data/');
        }

        // Migrate attachments directory
        if (legacyAttachmentsExists) {
          await this.moveDirectory(legacyAttachmentsPath, this.meridianStructure.attachmentsPath);
          console.log('Migrated attachments/ to .meridian/attachments/');
        }

        console.log('Migration completed successfully');
      }
    } catch (error) {
      console.error('Failed to migrate legacy structure:', error);
      // Don't throw - continue with new structure
    }
  }

  /**
   * Ensure .meridian directory structure exists
   */
  private async ensureMeridianDirectory(): Promise<void> {
    if (!this.meridianStructure) return;

    try {
      // Create all necessary directories
      await fs.mkdir(this.meridianStructure.meridianPath, { recursive: true });
      await fs.mkdir(this.meridianStructure.configPath, { recursive: true });
      await fs.mkdir(this.meridianStructure.dataPath, { recursive: true });
      await fs.mkdir(this.meridianStructure.attachmentsPath, { recursive: true });
      await fs.mkdir(this.meridianStructure.logsPath, { recursive: true });
      await fs.mkdir(this.meridianStructure.tempPath, { recursive: true });

      // Create subdirectories in attachments
      await fs.mkdir(path.join(this.meridianStructure.attachmentsPath, 'images'), { recursive: true });
      await fs.mkdir(path.join(this.meridianStructure.attachmentsPath, 'documents'), { recursive: true });
      await fs.mkdir(path.join(this.meridianStructure.attachmentsPath, 'cache'), { recursive: true });
    } catch (error) {
      console.error('Failed to create .meridian directory structure:', error);
      throw error;
    }
  }

  /**
   * Check if a path exists
   */
  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Move directory from source to destination
   */
  private async moveDirectory(source: string, destination: string): Promise<void> {
    try {
      // Ensure destination parent exists
      await fs.mkdir(path.dirname(destination), { recursive: true });
      
      // Move the directory
      await fs.rename(source, destination);
    } catch (error) {
      console.error(`Failed to move directory from ${source} to ${destination}:`, error);
      throw error;
    }
  }







  // ARCHIVE DATA MANAGEMENT
  /**
   * Load archive data from workspace
   */
  public async loadArchiveData(): Promise<ArchiveData> {
    const filePath = this.getDataFilePath('archive.json');
    return await this.loadDataFile<ArchiveData>(filePath, {
      uploads: [],
      wallet: { address: '' },
      files: [],
      lastUpdated: new Date().toISOString(),
      version: '2.0'
    });
  }

  /**
   * Save archive data to workspace
   */
  public async saveArchiveData(data: ArchiveData): Promise<void> {
    const filePath = this.getDataFilePath('archive.json');
    data.lastUpdated = new Date().toISOString();
    data.version = data.version || '2.0';
    await this.saveDataFile(filePath, data);
  }

  /**
   * Add an upload record to archive data (legacy method for backward compatibility)
   */
  public async addUpload(upload: Omit<ArweaveUpload, 'id' | 'uploadedAt'>): Promise<ArweaveUpload> {
    const data = await this.loadArchiveData();
    
    const newUpload: ArweaveUpload = {
      ...upload,
      id: this.generateId(),
      uploadedAt: new Date().toISOString()
    };

    data.uploads.push(newUpload);
    await this.saveArchiveData(data);
    return newUpload;
  }

  /**
   * Update upload status (legacy method for backward compatibility)
   */
  public async updateUploadStatus(id: string, status: ArweaveUpload['status'], confirmedAt?: string): Promise<void> {
    const data = await this.loadArchiveData();
    const upload = data.uploads.find(u => u.id === id);
    
    if (!upload) {
      throw new Error(`Upload with id ${id} not found`);
    }

    upload.status = status;
    if (confirmedAt && status === 'confirmed') {
      upload.confirmedAt = confirmedAt;
    }

    await this.saveArchiveData(data);
  }

  // FILE REGISTRY METHODS (UUID-based file management)
  
  /**
   * Add or update a file in the registry
   */
  public async addOrUpdateFile(file: FileRegistryEntry): Promise<void> {
    const data = await this.loadArchiveData();
    
    const existingIndex = data.files.findIndex(f => f.uuid === file.uuid);
    if (existingIndex >= 0) {
      data.files[existingIndex] = file;
    } else {
      data.files.push(file);
    }
    
    await this.saveArchiveData(data);
  }

  /**
   * Get file by UUID
   */
  public async getFileByUUID(uuid: string): Promise<FileRegistryEntry | null> {
    const data = await this.loadArchiveData();
    return data.files.find(f => f.uuid === uuid) || null;
  }

  /**
   * Get all files in registry
   */
  public async getAllFiles(): Promise<FileRegistryEntry[]> {
    const data = await this.loadArchiveData();
    return data.files;
  }

  /**
   * Remove file from registry
   */
  public async removeFile(uuid: string): Promise<void> {
    const data = await this.loadArchiveData();
    data.files = data.files.filter(f => f.uuid !== uuid);
    await this.saveArchiveData(data);
  }

  /**
   * Add Arweave upload record to a file
   */
  public async addArweaveUpload(uuid: string, upload: ArweaveUploadRecord): Promise<void> {
    const data = await this.loadArchiveData();
    const file = data.files.find(f => f.uuid === uuid);
    
    if (!file) {
      throw new Error(`File with UUID ${uuid} not found`);
    }

    // Check for duplicate hash
    const existingUpload = file.arweave_hashes.find(u => u.hash === upload.hash);
    if (!existingUpload) {
      file.arweave_hashes.push(upload);
      await this.saveArchiveData(data);
    }
  }

  /**
   * Search files by various criteria
   */
  public async searchFiles(query: {
    uuid?: string;
    title?: string;
    tags?: string[];
    filePath?: string;
    isVirtual?: boolean;
  }): Promise<FileRegistryEntry[]> {
    const data = await this.loadArchiveData();
    
    return data.files.filter(file => {
      if (query.uuid && file.uuid !== query.uuid) return false;
      if (query.title && !file.title.toLowerCase().includes(query.title.toLowerCase())) return false;
      if (query.filePath && !file.filePath.includes(query.filePath)) return false;
      if (query.isVirtual !== undefined) {
        const isVirtual = file.filePath.startsWith('[VIRTUAL]');
        if (query.isVirtual !== isVirtual) return false;
      }
      if (query.tags && query.tags.length > 0) {
        const hasAllTags = query.tags.every(tag => file.tags.includes(tag));
        if (!hasAllTags) return false;
      }
      
      return true;
    });
  }

  /**
   * Update editable metadata for an archive file
   */
  public async updateEditableMetadata(uuid: string, updates: import('../types').EditableMetadata): Promise<FileRegistryEntry> {
    const file = await this.getFileByUUID(uuid);
    if (!file) {
      throw new Error(`File with UUID ${uuid} not found`);
    }

    // Update editable fields
    if (updates.title !== undefined) {
      file.title = updates.title;
    }
    if (updates.tags !== undefined) {
      file.tags = updates.tags;
    }
    if (updates.author !== undefined) {
      file.metadata.author = updates.author;
    }
    if (updates.customFields !== undefined) {
      file.metadata.customFields = { ...file.metadata.customFields, ...updates.customFields };
    }

    // Virtual-only fields
    const isVirtual = file.filePath.startsWith('[VIRTUAL]');
    if (isVirtual && updates.mimeType !== undefined) {
      file.mimeType = updates.mimeType;
    }

    // Update modification timestamp
    file.modified = new Date().toISOString();

    // Save the updated file
    await this.addOrUpdateFile(file);
    return file;
  }

  // BROADCAST DATA MANAGEMENT
  /**
   * Load broadcast data from workspace
   */
  public async loadBroadcastData(): Promise<BroadcastData> {
    const filePath = this.getDataFilePath('broadcast.json');
    return await this.loadDataFile<BroadcastData>(filePath, {
      posts: [],
      drafts: [],
      accounts: {}
    });
  }

  /**
   * Load broadcast data V2 from workspace (with migration support)
   */
  public async loadBroadcastDataV2(): Promise<import('../types').BroadcastDataV2> {
    const filePath = this.getDataFilePath('broadcast.json');
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      // Check if this is already V2 format
      if (data.version === '2.0' && data.templates) {
        return data as import('../types').BroadcastDataV2;
      }
      
      // Migrate from V1 to V2
      return await this.migrateBroadcastDataToV2(data as BroadcastData);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, create new V2 format
        const defaultData: import('../types').BroadcastDataV2 = {
          posts: [],
          templates: [],
          accounts: {},
          settings: {
            contentDirectory: 'content',
            autoDetectMarkdown: true,
            defaultPlatforms: ['bluesky', 'farcaster', 'twitter']
          },
          version: '2.0'
        };
        await this.saveBroadcastDataV2(defaultData);
        return defaultData;
      }
      throw error;
    }
  }

  /**
   * Save broadcast data V2 to workspace
   */
  public async saveBroadcastDataV2(data: import('../types').BroadcastDataV2): Promise<void> {
    const filePath = this.getDataFilePath('broadcast.json');
    await this.saveDataFile(filePath, data);
  }

  /**
   * Migrate V1 broadcast data to V2 format
   */
  private async migrateBroadcastDataToV2(oldData: BroadcastData): Promise<import('../types').BroadcastDataV2> {
    const { TemplateManager } = await import('./template-manager');
    const templateManager = new TemplateManager(this);
    
    // Convert old SocialPost to StagedPost format
    const migratedPosts: import('../types').StagedPost[] = [];
    
         // Migrate posts and drafts
     const allOldPosts = [...oldData.posts, ...oldData.drafts];
     for (const oldPost of allOldPosts) {
       const platformContent = {} as import('../types').StagedPost['platformContent'];
       
       // Initialize all platforms as disabled first
       const allPlatforms: import('../types').Platform[] = ['bluesky', 'farcaster', 'twitter', 'x'];
       for (const platform of allPlatforms) {
         platformContent[platform] = {
           content: oldPost.content,
           enabled: false,
         };
       }
       
       // Enable only the platforms that were selected
       for (const platform of oldPost.platforms) {
         if (platform in platformContent) {
           platformContent[platform].enabled = true;
         }
       }
      
      const migratedPost: import('../types').StagedPost = {
        id: oldPost.id,
        sourceType: 'manual',
        platformContent,
        baseContent: oldPost.content,
        tags: [],
        status: this.mapLegacyStatus(oldPost.status),
        createdAt: oldPost.createdAt,
        updatedAt: oldPost.createdAt,
        scheduledFor: oldPost.scheduledFor,
        ...(oldPost.postedAt && { postResults: this.mapLegacyPostResults(oldPost.postedAt) })
      };
      
      migratedPosts.push(migratedPost);
    }

    const newData: import('../types').BroadcastDataV2 = {
      posts: migratedPosts,
      templates: templateManager.getDefaultTemplates(),
      accounts: oldData.accounts,
      settings: {
        contentDirectory: 'content',
        autoDetectMarkdown: true,
        defaultPlatforms: ['bluesky', 'farcaster', 'twitter']
      },
      version: '2.0'
    };

    // Save migrated data
    await this.saveBroadcastDataV2(newData);
    
    return newData;
  }

  /**
   * Map legacy post status to new format
   */
  private mapLegacyStatus(status: SocialPost['status']): import('../types').StagedPost['status'] {
    switch (status) {
      case 'draft': return 'staged';
      case 'scheduled': return 'scheduled';
      case 'posted': return 'posted';
      case 'failed': return 'failed';
      default: return 'staged';
    }
  }

  /**
   * Map legacy post results to new format
   */
  private mapLegacyPostResults(postedAt: { [platform: string]: string }): import('../types').StagedPost['postResults'] {
    const results: import('../types').StagedPost['postResults'] = {};
    
    for (const [platform, timestamp] of Object.entries(postedAt)) {
      results[platform] = {
        success: true,
        postedAt: timestamp,
      };
    }
    
    return results;
  }

  /**
   * Save broadcast data to workspace
   */
  public async saveBroadcastData(data: BroadcastData): Promise<void> {
    const filePath = this.getDataFilePath('broadcast.json');
    await this.saveDataFile(filePath, data);
  }

  /**
   * Add a social post
   */
  public async addPost(post: Omit<SocialPost, 'id' | 'createdAt'>): Promise<SocialPost> {
    const data = await this.loadBroadcastData();
    
    const newPost: SocialPost = {
      ...post,
      id: this.generateId(),
      createdAt: new Date().toISOString()
    };

    if (post.status === 'draft') {
      data.drafts.push(newPost);
    } else {
      data.posts.push(newPost);
    }

    await this.saveBroadcastData(data);
    return newPost;
  }

  /**
   * Update post status
   */
  public async updatePostStatus(id: string, status: SocialPost['status'], postedAt?: { [platform: string]: string }): Promise<void> {
    const data = await this.loadBroadcastData();
    
    // Find post in either drafts or posts
    let post = data.drafts.find(p => p.id === id);
    let isDraft = true;
    
    if (!post) {
      post = data.posts.find(p => p.id === id);
      isDraft = false;
    }

    if (!post) {
      throw new Error(`Post with id ${id} not found`);
    }

    post.status = status;
    if (postedAt) {
      post.postedAt = { ...post.postedAt, ...postedAt };
    }

    // Move from drafts to posts if status changed from draft
    if (isDraft && status !== 'draft') {
      data.drafts = data.drafts.filter(p => p.id !== id);
      data.posts.push(post);
    }

    await this.saveBroadcastData(data);
  }

  // UNIFIED DATA MANAGEMENT
  /**
   * Load unified data from workspace (legacy JSON fallback)
   */
  public async loadUnifiedData(): Promise<UnifiedData> {
    const filePath = this.getDataFilePath('resources.json');
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(fileContent) as UnifiedData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, return empty data without creating file
        return {
          resources: [],
          tags: {},
          lastModified: new Date().toISOString(),
          version: '1.0'
        };
      }
      console.error(`Failed to load unified data file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Save unified data to workspace
   */
  public async saveUnifiedData(data: UnifiedData): Promise<void> {
    const filePath = this.getDataFilePath('resources.json');
    data.lastModified = new Date().toISOString();
    data.version = data.version || '1.0';
    await this.saveDataFile(filePath, data);
  }

  /**
   * Add a unified resource
   */
  public async addUnifiedResource(resource: Omit<UnifiedResource, 'id'>): Promise<UnifiedResource> {
    const data = await this.loadUnifiedData();
    
    const newResource: UnifiedResource = {
      ...resource,
      id: this.generateId()
    };

    data.resources.push(newResource);
    
    // Update tag counts
    const tags = resource.properties['meridian:tags'] || [];
    for (const tag of tags) {
      data.tags[tag] = (data.tags[tag] || 0) + 1;
    }

    await this.saveUnifiedData(data);
    return newResource;
  }

  /**
   * Update a unified resource
   */
  public async updateUnifiedResource(id: string, updates: Partial<UnifiedResource>): Promise<UnifiedResource> {
    const data = await this.loadUnifiedData();
    
    const resourceIndex = data.resources.findIndex(r => r.id === id);
    if (resourceIndex === -1) {
      throw new Error(`Unified resource with ID ${id} not found`);
    }

    const oldResource = data.resources[resourceIndex]!;
    const updatedResource: UnifiedResource = {
      ...oldResource,
      ...updates,
      id: oldResource.id, // Ensure id is preserved
      timestamps: {
        ...oldResource.timestamps,
        modified: new Date().toISOString()
      }
    };

    data.resources[resourceIndex] = updatedResource;

    // Update tag counts if tags changed
    const oldTags = new Set(oldResource.properties['meridian:tags'] || []);
    const newTags = new Set(updatedResource.properties['meridian:tags'] || []);
    
    // Remove old tags
    for (const tag of oldTags) {
      if (!newTags.has(tag)) {
        data.tags[tag] = Math.max(0, (data.tags[tag] || 0) - 1);
        if (data.tags[tag] === 0) {
          delete data.tags[tag];
        }
      }
    }
    
    // Add new tags
    for (const tag of newTags) {
      if (!oldTags.has(tag)) {
        data.tags[tag] = (data.tags[tag] || 0) + 1;
      }
    }

    await this.saveUnifiedData(data);
    return updatedResource;
  }

  /**
   * Remove a unified resource
   */
  public async removeUnifiedResource(id: string): Promise<void> {
    const data = await this.loadUnifiedData();
    
    const resourceIndex = data.resources.findIndex(r => r.id === id);
    if (resourceIndex === -1) {
      throw new Error(`Unified resource with ID ${id} not found`);
    }

    const resource = data.resources[resourceIndex]!;
    
    // Update tag counts
    const tags = resource.properties['meridian:tags'] || [];
    for (const tag of tags) {
      data.tags[tag] = Math.max(0, (data.tags[tag] || 0) - 1);
      if (data.tags[tag] === 0) {
        delete data.tags[tag];
      }
    }

    data.resources.splice(resourceIndex, 1);
    await this.saveUnifiedData(data);
  }

  /**
   * Add a tag to a unified resource
   */
  public async addTagToUnifiedResource(resourceId: string, tag: string): Promise<UnifiedResource> {
    const data = await this.loadUnifiedData();
    
    const resource = data.resources.find(r => r.id === resourceId);
    if (!resource) {
      throw new Error(`Unified resource with ID ${resourceId} not found`);
    }

    const currentTags = resource.properties['meridian:tags'] || [];
    if (currentTags.includes(tag)) {
      return resource; // Tag already exists
    }

    const updatedTags = [...currentTags, tag];
    const updatedResource = await this.updateUnifiedResource(resourceId, {
      properties: {
        ...resource.properties,
        'meridian:tags': updatedTags
      }
    });

    return updatedResource;
  }

  /**
   * Remove a tag from a unified resource
   */
  public async removeTagFromUnifiedResource(resourceId: string, tag: string): Promise<UnifiedResource> {
    const data = await this.loadUnifiedData();
    
    const resource = data.resources.find(r => r.id === resourceId);
    if (!resource) {
      throw new Error(`Unified resource with ID ${resourceId} not found`);
    }

    const currentTags = resource.properties['meridian:tags'] || [];
    if (!currentTags.includes(tag)) {
      return resource; // Tag doesn't exist
    }

    const updatedTags = currentTags.filter(t => t !== tag);
    const updatedResource = await this.updateUnifiedResource(resourceId, {
      properties: {
        ...resource.properties,
        'meridian:tags': updatedTags
      }
    });

    return updatedResource;
  }

  // UTILITY METHODS
  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Get full path to data file
   */
  private getDataFilePath(filename: string): string {
    if (!this.meridianStructure) {
      throw new Error('Workspace not set');
    }
    return path.join(this.meridianStructure.dataPath, filename);
  }

  /**
   * Load data file with default fallback
   */
  private async loadDataFile<T>(filePath: string, defaultData: T): Promise<T> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(fileContent) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, return default
        await this.saveDataFile(filePath, defaultData);
        return defaultData;
      }
      console.error(`Failed to load data file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Save data file with atomic write
   */
  private async saveDataFile<T>(filePath: string, data: T): Promise<void> {
    try {
      const tempPath = `${filePath}.tmp`;
      const jsonData = JSON.stringify(data, null, 2);
      
      await fs.writeFile(tempPath, jsonData, 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      console.error(`Failed to save data file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Check if workspace is set
   */
  public isWorkspaceSet(): boolean {
    return this.workspacePath !== null && this.meridianStructure !== null;
  }

  /**
   * Get cosmo workspace structure
   */
  public getMeridianStructure(): MeridianWorkspaceStructure | null {
    return this.meridianStructure;
  }

  /**
   * Export resources to file
   */
  public async exportResources(format: string, data: any, suggestedFilename: string): Promise<{success: boolean, filepath?: string, error?: string}> {
    try {
      const { dialog } = await import('electron');
      const { BrowserWindow } = await import('electron');
      
      // Get the main window
      const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (!mainWindow) {
        throw new Error('No main window available');
      }

      // Determine file extension and filter based on format
      let defaultExtension: string;
      let fileFilters: Array<{name: string, extensions: string[]}>;
      
      switch (format) {
        case 'json':
          defaultExtension = 'json';
          fileFilters = [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
          ];
          break;
        case 'text':
          defaultExtension = 'txt';
          fileFilters = [
            { name: 'Text Files', extensions: ['txt'] },
            { name: 'All Files', extensions: ['*'] }
          ];
          break;
        case 'bookmarks':
          defaultExtension = 'html';
          fileFilters = [
            { name: 'HTML Files', extensions: ['html'] },
            { name: 'All Files', extensions: ['*'] }
          ];
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      // Show save dialog
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Resources',
        defaultPath: suggestedFilename.endsWith(`.${defaultExtension}`) 
          ? suggestedFilename 
          : `${suggestedFilename}.${defaultExtension}`,
        filters: fileFilters
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Export cancelled by user' };
      }

      // Prepare content based on format
      let content: string;
      
      switch (format) {
        case 'json':
          content = JSON.stringify(data, null, 2);
          break;
          
        case 'text':
          if (Array.isArray(data.resources)) {
            content = data.resources.map((resource: any) => resource.url).join('\n');
          } else {
            content = 'No resources to export';
          }
          break;
          
        case 'bookmarks':
          content = this.generateBookmarksHtml(data);
          break;
          
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      // Write file
      await fs.writeFile(result.filePath, content, 'utf-8');
      
      return { 
        success: true, 
        filepath: result.filePath 
      };
      
    } catch (error) {
      console.error('Export resources error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown export error' 
      };
    }
  }

  /**
   * Generate bookmarks HTML content
   */
  private generateBookmarksHtml(data: any): string {
    const resources = Array.isArray(data.resources) ? data.resources : [];
    const exportedAt = data.exportedAt || new Date().toISOString();
    
    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3>Meridian Export - ${new Date(exportedAt).toLocaleDateString()}</H3>
    <DL><p>
`;

    // Group resources by tags for better organization
    const tagGroups: {[tag: string]: any[]} = {};
    const untaggedResources: any[] = [];

    resources.forEach((resource: any) => {
      if (resource.tags && resource.tags.length > 0) {
        resource.tags.forEach((tag: string) => {
          if (!tagGroups[tag]) {
            tagGroups[tag] = [];
          }
          tagGroups[tag].push(resource);
        });
      } else {
        untaggedResources.push(resource);
      }
    });

    // Add tagged resources
    Object.entries(tagGroups).forEach(([tag, tagResources]) => {
      html += `        <DT><H3>${this.escapeHtml(tag)}</H3>\n`;
      html += `        <DL><p>\n`;
      
      tagResources.forEach((resource: any) => {
        const title = resource.title || resource.url;
        const description = resource.description ? ` - ${resource.description}` : '';
        html += `            <DT><A HREF="${this.escapeHtml(resource.url)}">${this.escapeHtml(title)}</A>\n`;
        if (description) {
          html += `            <DD>${this.escapeHtml(description)}\n`;
        }
      });
      
      html += `        </DL><p>\n`;
    });

    // Add untagged resources
    if (untaggedResources.length > 0) {
      html += `        <DT><H3>Untagged</H3>\n`;
      html += `        <DL><p>\n`;
      
      untaggedResources.forEach((resource: any) => {
        const title = resource.title || resource.url;
        const description = resource.description ? ` - ${resource.description}` : '';
        html += `            <DT><A HREF="${this.escapeHtml(resource.url)}">${this.escapeHtml(title)}</A>\n`;
        if (description) {
          html += `            <DD>${this.escapeHtml(description)}\n`;
        }
      });
      
      html += `        </DL><p>\n`;
    }

    html += `    </DL><p>
</DL><p>`;

    return html;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
} 