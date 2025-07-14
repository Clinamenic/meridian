import { ModuleBase } from './ModuleBase.js';

export class UploadManager extends ModuleBase {
  constructor(app) {
    super(app, 'uploadManager');
    this.selectedFile = null;
    this.uploadTags = [];
    this.targetResource = null; // Resource to associate uploads with
    this.eventsSetup = false;
    this.isUploading = false;
  }

  async uploadFile() {
    try {
      // Check if wallet is configured first
      const isWalletConfigured = await window.electronAPI.archive.isWalletConfigured();
      if (!isWalletConfigured) {
        this.app.showError('Please setup your Arweave wallet before uploading files.');
        return;
      }

      const filePath = await window.electronAPI.selectFile([
        { name: 'All Files', extensions: ['*'] }
      ]);
      
      if (!filePath) return;

      // Open upload modal with selected file
      await this.openUploadModal(filePath);
    } catch (error) {
      console.error('Failed to select file for upload:', error);
      this.app.showError(`Failed to select file: ${error.message}`);
    }
  }

  async openUploadModal(filePath) {
    try {
      // Clear any existing resource context
      this.targetResource = null;

      // Get file stats
      const stats = await window.electronAPI.getFileStats(filePath);
      const fileName = filePath.split('/').pop();
      
      // Estimate upload cost
      const costEstimate = await window.electronAPI.archive.estimateCost(stats.size);

      // Get UUID and metadata information
      let uuidInfo = null;
      let registryEntry = null;
      try {
        uuidInfo = await window.electronAPI.archive.resolveUUID(filePath);
        if (uuidInfo.uuid) {
          registryEntry = await window.electronAPI.archive.getFileByUUID(uuidInfo.uuid);
        }
      } catch (error) {
        console.warn('Failed to resolve UUID:', error);
      }

      // Store file info for upload
      this.selectedFile = {
        path: filePath,
        name: fileName,
        size: stats.size,
        cost: costEstimate,
        uuid: uuidInfo?.uuid,
        uuidSource: uuidInfo?.source,
        registryEntry: registryEntry
      };

      // Initialize tags from registry entry if available
      this.uploadTags = [];
      if (registryEntry) {
        // Add existing tags from registry
        for (const tag of registryEntry.tags) {
          this.uploadTags.push({ key: 'tag', value: tag });
        }
        // Add metadata as tags
        if (registryEntry.metadata.author) {
          this.uploadTags.push({ key: 'author', value: registryEntry.metadata.author });
        }
      }

      // Update modal content
      this.updateUploadModal();
      
      // Setup event listeners for the modal buttons
      this.setupUploadEvents();
      
      // Show modal
      this.app.openModal('upload-modal');
    } catch (error) {
      console.error('Failed to open upload modal:', error);
      this.app.showError('Failed to load file information');
    }
  }

  async openModalForResource(resource) {
    try {
      console.log(`[UploadManager] Opening upload modal for resource: ${resource.id}`);
      
      // Store the target resource for upload association
      this.targetResource = resource;

      // Check if wallet is configured first
      const isWalletConfigured = await window.electronAPI.archive.isWalletConfigured();
      if (!isWalletConfigured) {
        this.app.showError('Please setup your Arweave wallet before uploading files.');
        return;
      }

      // Clear any existing file selection
      this.selectedFile = null;
      this.uploadTags = [];

      // Initialize tags with resource information
      const resourceTitle = resource.properties["dc:title"] || "Untitled";
      const resourceTags = resource.properties["meridian:tags"] || [];
      
      // Add resource title as initial tag
      this.uploadTags.push({ key: 'title', value: resourceTitle });
      
      // Add resource tags
      resourceTags.forEach(tag => {
        this.uploadTags.push({ key: 'tag', value: tag });
      });

      // Add resource ID for association
      this.uploadTags.push({ key: 'meridian:resource-id', value: resource.id });

      // Check if resource has a file path and auto-select it
      if (resource.locations?.primary?.type === 'file-path' && resource.locations.primary.value) {
        await this.selectResourceFile(resource.locations.primary.value);
      } else {
        // Update modal content for file selection mode
        this.updateUploadModalForResource();
      }
      
      // Setup event listeners for the modal buttons
      this.setupUploadEvents();
      
      // Show modal
      this.app.openModal('upload-modal');
    } catch (error) {
      console.error('[UploadManager] Failed to open upload modal for resource:', error);
      this.app.showError('Failed to open upload modal');
    }
  }

  updateUploadModal() {
    if (!this.selectedFile) return;

    const fileInfo = document.getElementById('upload-file-info');
    const tagsContainer = document.getElementById('upload-tags-container');
    
    // Build UUID information display
    let uuidDisplay = '';
    if (this.selectedFile.uuid) {
      const sourceLabel = {
        'frontmatter': 'Markdown frontmatter',
        'xattr': 'Extended attributes',
        'registry': 'File registry',
        'content-based': 'Content hash',
        'generated': 'Newly generated'
      }[this.selectedFile.uuidSource] || this.selectedFile.uuidSource;
      
      uuidDisplay = `
        <div class="uuid-info">
          <p><strong>UUID:</strong> <code>${this.selectedFile.uuid}</code></p>
          <p><strong>Source:</strong> ${sourceLabel}</p>
        </div>
      `;
    }

    // Build registry information display
    let registryDisplay = '';
    if (this.selectedFile.registryEntry) {
      const entry = this.selectedFile.registryEntry;
      registryDisplay = `
        <div class="registry-info">
          <h5>Registry Information</h5>
          <p><strong>Title:</strong> ${this.escapeHtml(entry.title)}</p>
          ${entry.metadata.author ? `<p><strong>Author:</strong> ${this.escapeHtml(entry.metadata.author)}</p>` : ''}
          <p><strong>Content Type:</strong> ${entry.mimeType}</p>
          ${entry.arweave_hashes.length > 0 ? `<p><strong>Previous Uploads:</strong> ${entry.arweave_hashes.length}</p>` : ''}
        </div>
      `;
    }
    
    // Update file information
    fileInfo.innerHTML = `
      <div class="file-details">
        <h4>File Information</h4>
        <p><strong>Name:</strong> ${this.selectedFile.name}</p>
        <p><strong>Size:</strong> ${this.formatFileSize(this.selectedFile.size)}</p>
        <p><strong>Estimated Cost:</strong> ${this.selectedFile.cost.ar} AR ${this.selectedFile.cost.usd ? `($${this.selectedFile.cost.usd})` : ''}</p>
        ${uuidDisplay}
        ${registryDisplay}
      </div>
    `;

    // Update tags display
    this.renderUploadTags();
  }

  updateUploadModalForResource() {
    const fileInfo = document.getElementById('upload-file-info');
    
    if (!this.targetResource) return;

    // Update file information for resource context
    fileInfo.innerHTML = `
      <div class="resource-upload-info">
        <h4>Upload File for Resource</h4>
        <div class="resource-context">
          <p><strong>Resource:</strong> ${this.escapeHtml(this.targetResource.properties["dc:title"] || "Untitled")}</p>
          <p><strong>Resource ID:</strong> <code>${this.targetResource.id}</code></p>
        </div>
        <div class="file-selection">
          <button type="button" id="select-file-btn" class="btn btn-primary">
            Choose File to Upload
          </button>
          <p class="file-selection-help">Select a file to upload and associate with this resource.</p>
        </div>
      </div>
    `;

    // Add file selection event listener
    const selectFileBtn = document.getElementById('select-file-btn');
    if (selectFileBtn) {
      selectFileBtn.addEventListener('click', async () => {
        await this.selectFileForResource();
      });
    }

    // Update tags display
    this.renderUploadTags();
  }

  async selectResourceFile(filePath) {
    try {
      console.log(`[UploadManager] Auto-selecting file from resource: ${filePath}`);
      
      // Get file stats and cost estimate
      const stats = await window.electronAPI.getFileStats(filePath);
      const fileName = filePath.split('/').pop();
      const costEstimate = await window.electronAPI.archive.estimateCost(stats.size);

      // Store file info for upload
      this.selectedFile = {
        path: filePath,
        name: fileName,
        size: stats.size,
        cost: costEstimate,
        uuid: null, // Will be generated during upload
        uuidSource: 'generated',
        registryEntry: null
      };

      // Switch to standard upload modal view
      this.updateUploadModal();
      
      // Setup event listeners for the modal buttons
      this.setupUploadEvents();

    } catch (error) {
      console.error('[UploadManager] Failed to auto-select resource file:', error);
      this.app.showError(`Failed to load resource file: ${error.message}`);
      // Fall back to file selection mode
      this.updateUploadModalForResource();
    }
  }

  async selectFileForResource() {
    try {
      const filePath = await window.electronAPI.selectFile([
        { name: 'All Files', extensions: ['*'] }
      ]);
      
      if (!filePath) return;

      await this.selectResourceFile(filePath);

    } catch (error) {
      console.error('[UploadManager] Failed to select file:', error);
      this.app.showError(`Failed to select file: ${error.message}`);
    }
  }

  renderUploadTags() {
    const tagsContainer = document.getElementById('upload-tags-list');
    
    if (this.uploadTags.length === 0) {
      tagsContainer.innerHTML = '<p class="no-tags">No tags added yet</p>';
      return;
    }

    tagsContainer.innerHTML = this.uploadTags.map((tag, index) => `
      <div class="upload-tag-item">
        <span class="tag-key">${this.escapeHtml(tag.key)}:</span>
        <span class="tag-value">${this.escapeHtml(tag.value)}</span>
        <button type="button" class="remove-tag-btn" data-tag-index="${index}">×</button>
      </div>
    `).join('');

    // Add click events to remove buttons
    tagsContainer.querySelectorAll('.remove-tag-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.tagIndex);
        this.removeUploadTag(index);
      });
    });
  }

  addUploadTag() {
    const keyInput = document.getElementById('upload-tag-key');
    const valueInput = document.getElementById('upload-tag-value');
    
    let key = keyInput.value.trim();
    const value = valueInput.value.trim();
    
    if (!key || !value) {
      this.app.showError('Both tag key and value are required');
      return;
    }

    // Clean up tag key - replace spaces with dashes, keep alphanumeric and common chars
    key = key.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');
    
    if (!key) {
      this.app.showError('Tag key must contain at least some alphanumeric characters');
      return;
    }

    // Check for duplicate keys
    if (this.uploadTags.some(tag => tag.key === key)) {
      this.app.showError(`Tag key "${key}" already exists`);
      return;
    }

    this.uploadTags.push({ key, value });
    
    // Clear inputs
    keyInput.value = '';
    valueInput.value = '';
    
    this.renderUploadTags();
  }

  removeUploadTag(index) {
    this.uploadTags.splice(index, 1);
    this.renderUploadTags();
  }

  async confirmUpload() {
    try {
      if (!this.selectedFile) {
        this.app.showError('No file selected');
        return;
      }

      // Prevent multiple uploads
      if (this.isUploading) {
        console.log('[UploadManager] Upload already in progress, ignoring duplicate call');
        return;
      }
      this.isUploading = true;

      // Close modal
      this.app.closeModal();

      // Convert tags to Arweave format (array of "key:value" strings)
      const arweaveTags = this.uploadTags.map(tag => `${tag.key}:${tag.value}`);
      
      // Show progress message
      this.app.showSuccess('Uploading file to Arweave...');

      // Upload the file
      const result = await window.electronAPI.archive.uploadFile(this.selectedFile.path, arweaveTags);
      
      if (result.success) {
        this.app.showSuccess(`File uploaded successfully! Transaction ID: ${result.transactionId}`);
        
        // If uploaded for a specific resource, check if it needs manual association
        if (this.targetResource) {
          console.log('[UploadManager] Upload completed, checking association needs...');
          
          // Check if target resource has a file path - if so, main process handles association
          const hasFilePath = this.targetResource.locations?.primary?.type === 'file-path' && 
                             this.targetResource.locations.primary.value;
          
          if (hasFilePath) {
            console.log('[UploadManager] Resource has file path - main upload process handles association automatically, skipping manual association');
          } else {
            console.log('[UploadManager] Resource has no file path - manually associating upload with resource');
            await this.associateUploadWithResource(result.transactionId, result.arweaveTags);
          }
        }
        
        // Verify the upload after a short delay
        setTimeout(async () => {
          try {
            const status = await window.electronAPI.archive.checkTransactionStatus(result.transactionId);
            if (status === 'confirmed') {
              this.app.showSuccess(`Upload confirmed on Arweave! View at: https://arweave.net/${result.transactionId}`);
            } else if (status === 'pending') {
              this.app.showSuccess(`Upload is pending confirmation. Check status later.`);
            } else {
              this.app.showError(`Upload may have failed. Transaction not found on network.`);
            }
          } catch (error) {
            console.warn('Could not verify upload status:', error);
          }
        }, 2000);
        
        // Refresh the resource list to show updated uploads
        const resourceManager = this.app.getModule('ResourceManager');
        if (resourceManager) {
          await resourceManager.loadResources();
          resourceManager.updateUI();
        }
      } else {
        this.app.showError(`Upload failed: ${result.error}`);
      }

      // Clear selected file and target resource
      this.selectedFile = null;
      this.uploadTags = [];
      this.targetResource = null;
      this.eventsSetup = false;
      this.isUploading = false;
    } catch (error) {
      console.error('Failed to upload file:', error);
      this.app.showError(`Failed to upload file: ${error.message}`);
      this.isUploading = false;
    }
  }

  async associateUploadWithResource(transactionId, arweaveTags) {
    try {
      if (!this.targetResource) {
        console.warn('[UploadManager] No target resource for upload association');
        return;
      }

      console.log(`[UploadManager] Associating upload ${transactionId} with resource ${this.targetResource.id}`);

      // Create the upload record for the resource
      const uploadRecord = {
        hash: transactionId,
        timestamp: new Date().toISOString(),
        link: `https://www.arweave.net/${transactionId}`,
        tags: arweaveTags || []
      };

      // Add the upload to the resource via the main process
      const result = await window.electronAPI.resource.addArweaveUploadToResource(
        this.targetResource.id,
        uploadRecord
      );

      if (result.success) {
        console.log('[UploadManager] Successfully associated upload with resource');
        this.app.showSuccess(`Upload associated with resource: ${this.targetResource.properties["dc:title"] || "Untitled"}`);
      } else {
        console.error('[UploadManager] Failed to associate upload with resource:', result.error);
        this.app.showError('Upload successful, but failed to associate with resource');
      }

    } catch (error) {
      console.error('[UploadManager] Error associating upload with resource:', error);
      this.app.showError('Upload successful, but failed to associate with resource');
    }
  }

  async checkBalance() {
    try {
      const balance = await window.electronAPI.archive.getWalletBalance();
      const balanceValue = document.querySelector('.balance-value');
      
      if (balance) {
        balanceValue.textContent = `${balance.balance} AR`;
      } else {
        balanceValue.textContent = 'Unable to fetch balance';
      }
    } catch (error) {
      console.error('Failed to check balance:', error);
      this.app.showError('Failed to check wallet balance');
    }
  }

  setupUploadEvents() {
    // Prevent multiple event listener attachments
    if (this.eventsSetup) {
      return;
    }
    this.eventsSetup = true;

    const addTagBtn = document.getElementById('add-tag-btn');
    if (addTagBtn) {
      addTagBtn.addEventListener('click', () => {
        this.addUploadTag();
      });
    }

    const confirmUploadBtn = document.getElementById('confirm-upload-btn');
    if (confirmUploadBtn) {
      confirmUploadBtn.addEventListener('click', () => {
        this.confirmUpload();
      });
    }

    // Allow Enter key to add tags
    const tagKeyInput = document.getElementById('upload-tag-key');
    const tagValueInput = document.getElementById('upload-tag-value');
    
    if (tagKeyInput && tagValueInput) {
      [tagKeyInput, tagValueInput].forEach(input => {
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.addUploadTag();
          }
        });
      });
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
} 