import { ModuleBase } from './ModuleBase.js';

export class UploadManager extends ModuleBase {
  constructor(app) {
    super(app, 'uploadManager');
    this.selectedFile = null;
    this.uploadTags = [];
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
      
      // Show modal
      this.app.openModal('upload-modal');
    } catch (error) {
      console.error('Failed to open upload modal:', error);
      this.app.showError('Failed to load file information');
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
          <p><strong>Title:</strong> ${this.app.escapeHtml(entry.title)}</p>
          ${entry.metadata.author ? `<p><strong>Author:</strong> ${this.app.escapeHtml(entry.metadata.author)}</p>` : ''}
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
        <p><strong>Size:</strong> ${this.app.formatFileSize(this.selectedFile.size)}</p>
        <p><strong>Estimated Cost:</strong> ${this.selectedFile.cost.ar} AR ${this.selectedFile.cost.usd ? `($${this.selectedFile.cost.usd})` : ''}</p>
        ${uuidDisplay}
        ${registryDisplay}
      </div>
    `;

    // Update tags display
    this.renderUploadTags();
  }

  renderUploadTags() {
    const tagsContainer = document.getElementById('upload-tags-list');
    
    if (this.uploadTags.length === 0) {
      tagsContainer.innerHTML = '<p class="no-tags">No tags added yet</p>';
      return;
    }

    tagsContainer.innerHTML = this.uploadTags.map((tag, index) => `
      <div class="upload-tag-item">
        <span class="tag-key">${this.app.escapeHtml(tag.key)}:</span>
        <span class="tag-value">${this.app.escapeHtml(tag.value)}</span>
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
        
        // Refresh the uploads list
        await this.app.loadArchiveData();
      } else {
        this.app.showError(`Upload failed: ${result.error}`);
      }

      // Clear selected file
      this.selectedFile = null;
      this.uploadTags = [];
    } catch (error) {
      console.error('Failed to upload file:', error);
      this.app.showError(`Failed to upload file: ${error.message}`);
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
} 