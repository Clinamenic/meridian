import { ModuleBase } from './ModuleBase.js';

/**
 * BroadcastManager module - handles all broadcast-related operations across Meridian
 * Manages: Social media posts, templates, platform integration, character limits
 */
export class BroadcastManager extends ModuleBase {
  constructor(app) {
    super(app);
    
    // Broadcast state
    this.currentTab = 'posts';
    this.templates = [];
    this.markdownFiles = [];
    this.posts = [];
    this.drafts = [];
    
    // Platform status
    this.platformStatus = {
      bluesky: { connected: false, username: null },
      farcaster: { connected: false, username: null },
      x: { connected: false, username: null }
    };
  }

  async onInit() {
    console.log('[BroadcastManager] Initializing...');
    
    // Set up event listeners for broadcast functionality
    this.setupBroadcastEventListeners();
    
    console.log('[BroadcastManager] Initialized successfully');
  }

  async onCleanup() {
    console.log('[BroadcastManager] Cleaning up...');
    
    // Clean up any event listeners or resources
    console.log('[BroadcastManager] Cleaned up successfully');
  }

  // ===== BROADCAST EVENT SETUP =====

  /**
   * Set up all broadcast-related event listeners
   */
  setupBroadcastEventListeners() {
    console.log('[BroadcastManager] Setting up broadcast event listeners...');
    
    // New post button
    const newPostBtn = document.getElementById('new-post-btn');
    if (newPostBtn) {
      newPostBtn.addEventListener('click', () => {
        this.getModalManager().openModal('new-post-modal');
      });
    }

    // New template button
    const newTemplateBtn = document.getElementById('new-template-btn');
    if (newTemplateBtn) {
      newTemplateBtn.addEventListener('click', () => {
        this.getModalManager().openModal('new-template-modal');
      });
    }

    // Manage templates button
    const manageTemplatesBtn = document.getElementById('manage-templates-btn');
    if (manageTemplatesBtn) {
      manageTemplatesBtn.addEventListener('click', () => {
        this.openManageTemplatesModal();
      });
    }

    // New post form
    const newPostForm = document.getElementById('new-post-form');
    if (newPostForm) {
      newPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleNewPost(e);
      });
    }

    // New template form
    const newTemplateForm = document.getElementById('new-template-form');
    if (newTemplateForm) {
      newTemplateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleNewTemplate(e);
      });
    }

    // Character count for posts
    const postContent = document.getElementById('post-content');
    if (postContent) {
      postContent.addEventListener('input', (e) => {
        this.updateCharacterCount(e.target.value);
      });
    }

    // Platform checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.updateCharacterLimit();
      });
    });

    // Platform indicator click handlers
    document.querySelectorAll('.platform-indicator').forEach(indicator => {
      indicator.addEventListener('click', (e) => {
        const platform = e.currentTarget.dataset.platform;
        if (platform === 'bluesky') {
          this.getApp().openATProtoAccountsModal();
        } else if (platform === 'x') {
          this.getApp().openXAccountsModal();
        }
        // Add other platform handlers as needed
      });
    });

    // Broadcast tabs
    document.querySelectorAll('.broadcast-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchBroadcastTab(tabName);
      });
    });

    // Apply template modal events
    const templateSelect = document.getElementById('template-select');
    if (templateSelect) {
      templateSelect.addEventListener('change', () => {
        this.updateTemplatePreview();
      });
    }

    const markdownFileSelect = document.getElementById('markdown-file-select');
    if (markdownFileSelect) {
      markdownFileSelect.addEventListener('change', () => {
        this.updateTemplatePreview();
      });
    }

    const applyTemplateBtn = document.getElementById('apply-template-btn');
    if (applyTemplateBtn) {
      applyTemplateBtn.addEventListener('click', () => {
        this.applyTemplateToMarkdown();
      });
    }
  }

  // ===== BROADCAST DATA MANAGEMENT =====

  /**
   * Load broadcast data from backend
   */
  async loadBroadcastData() {
    try {
      this.getData().broadcast = await window.electronAPI.broadcast.loadData();
      this.renderPosts();
      this.updatePlatformStatus();
    } catch (error) {
      console.error('Failed to load broadcast data:', error);
    }
  }

  /**
   * Render posts in the post calendar
   */
  renderPosts() {
    const container = document.getElementById('post-calendar');
    if (!this.getData().broadcast) {
      container.innerHTML = '<div class="loading-state">No posts found</div>';
      return;
    }

    const allPosts = [...this.getData().broadcast.posts, ...this.getData().broadcast.drafts];
    
    if (allPosts.length === 0) {
      container.innerHTML = '<div class="loading-state">No posts yet. Create your first post!</div>';
      return;
    }

    // Simple list view for now
    container.innerHTML = allPosts.map(post => `
      <div class="post-item">
        <div class="post-content">${this.escapeHtml(post.content.substring(0, 100))}${post.content.length > 100 ? '...' : ''}</div>
        <div class="post-meta">
          <span class="post-status">${post.status}</span>
          <span class="post-platforms">${post.platforms.join(', ')}</span>
          <span class="post-date">${new Date(post.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    `).join('');
  }

  /**
   * Update platform connection status
   */
  async updatePlatformStatus() {
    const platforms = ['bluesky', 'farcaster', 'twitter'];
    
    for (const platform of platforms) {
      try {
        const isAuthenticated = await window.electronAPI.credentials.validatePlatform(platform);
        const indicator = document.querySelector(`[data-platform="${platform}"] .connection-status`);
        
        if (indicator) {
          indicator.textContent = isAuthenticated ? 'Connected' : 'Disconnected';
          indicator.className = `connection-status ${isAuthenticated ? 'connected' : ''}`;
        }
        
        // Update footer status
        if (platform === 'farcaster') {
          this.getApp().updateFooterFarcaster(isAuthenticated, isAuthenticated ? 'user' : null);
        } else if (platform === 'bluesky') {
          this.getApp().updateFooterBluesky(isAuthenticated, isAuthenticated ? '@user.bsky.social' : null);
        }
      } catch (error) {
        console.error(`Failed to check ${platform} status:`, error);
        
        // Update footer with error state
        if (platform === 'farcaster') {
          this.getApp().updateFooterFarcaster(false);
        } else if (platform === 'bluesky') {
          this.getApp().updateFooterBluesky(false);
        }
      }
    }
  }

  // ===== BROADCAST TAB MANAGEMENT =====

  /**
   * Switch between broadcast tabs
   */
  switchBroadcastTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.broadcast-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update views
    document.querySelectorAll('.broadcast-view').forEach(view => {
      view.classList.remove('active');
    });
    document.getElementById(`${tabName}-view`).classList.add('active');

    // Load data for the selected tab
    if (tabName === 'templates') {
      this.loadTemplatesData();
    } else if (tabName === 'markdown') {
      this.loadMarkdownFilesData();
    }
  }

  // ===== TEMPLATE MANAGEMENT =====

  /**
   * Load templates data
   */
  async loadTemplatesData() {
    const container = document.getElementById('templates-container');
    try {
      const templates = await window.electronAPI.invoke('broadcast:list-templates');
      this.renderTemplates(templates);
    } catch (error) {
      console.error('Failed to load templates:', error);
      container.innerHTML = '<div class="loading-state">Failed to load templates</div>';
    }
  }

  /**
   * Render templates in the templates container
   */
  renderTemplates(templates) {
    const container = document.getElementById('templates-container');
    
    if (templates.length === 0) {
      container.innerHTML = '<div class="loading-state">No templates yet. Create your first template!</div>';
      return;
    }

    container.innerHTML = templates.map(template => `
      <div class="template-item" data-template-id="${template.id}">
        <div class="template-header">
          <div class="template-info">
            <h4>${this.escapeHtml(template.name)}</h4>
            <p class="template-description">${this.escapeHtml(template.description || '')}</p>
          </div>
          <div class="template-actions">
            <button class="secondary-btn apply-template-btn" data-template-id="${template.id}">
              Apply
            </button>
            <button class="secondary-btn edit-template-btn" data-template-id="${template.id}">
              Edit
            </button>
            <button class="secondary-btn delete-template-btn" data-template-id="${template.id}">
              Delete
            </button>
          </div>
        </div>
        
        <div class="template-content">${this.escapeHtml(template.content)}</div>
        
        <div class="template-platforms">
          ${template.platforms.map(platform => 
            `<span class="template-platform">${platform}</span>`
          ).join('')}
        </div>
        
        ${template.tags && template.tags.length > 0 ? `
          <div class="template-tags">
            ${template.tags.map(tag => 
              `<span class="template-tag">${this.escapeHtml(tag)}</span>`
            ).join('')}
          </div>
        ` : ''}
      </div>
    `).join('');

    // Add event listeners for template actions
    container.querySelectorAll('.apply-template-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const templateId = e.target.dataset.templateId;
        this.openApplyTemplateModal(templateId);
      });
    });

    container.querySelectorAll('.edit-template-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const templateId = e.target.dataset.templateId;
        this.editTemplate(templateId);
      });
    });

    container.querySelectorAll('.delete-template-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const templateId = e.target.dataset.templateId;
        this.deleteTemplate(templateId);
      });
    });
  }

  /**
   * Load markdown files data
   */
  async loadMarkdownFilesData() {
    const container = document.getElementById('markdown-container');
    try {
      const files = await window.electronAPI.invoke('broadcast:scan-content-directory', 'content');
      this.renderMarkdownFiles(files);
    } catch (error) {
      console.error('Failed to load markdown files:', error);
      container.innerHTML = '<div class="loading-state">Failed to load markdown files</div>';
    }
  }

  /**
   * Render markdown files in the markdown container
   */
  renderMarkdownFiles(files) {
    const container = document.getElementById('markdown-container');
    
    if (files.length === 0) {
      container.innerHTML = '<div class="loading-state">No markdown files found in content/ directory</div>';
      return;
    }

    container.innerHTML = files.map(file => `
      <div class="markdown-file-item" data-file-path="${file.path}">
        <div class="markdown-file-header">
          <div class="markdown-file-info">
            <h4>${this.escapeHtml(file.title || file.name)}</h4>
            <p class="markdown-file-path">${this.escapeHtml(file.path)}</p>
          </div>
          <div class="markdown-file-actions">
            <button class="secondary-btn apply-template-btn" data-file-path="${file.path}">
              Apply Template
            </button>
          </div>
        </div>
      </div>
    `).join('');

    // Add event listeners for markdown file actions
    container.querySelectorAll('.apply-template-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const filePath = e.target.dataset.filePath;
        this.openApplyTemplateModal(null, filePath);
      });
    });
  }

  // ===== TEMPLATE CRUD OPERATIONS =====

  /**
   * Handle new template creation/editing
   */
  async handleNewTemplate(e) {
    try {
      const formData = new FormData(e.target);
      const platforms = Array.from(e.target.querySelectorAll('input[name="platforms"]:checked'))
        .map(input => input.value);
      
      const tags = formData.get('template-tags')
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const templateData = {
        name: formData.get('template-name'),
        description: formData.get('template-description'),
        content: formData.get('template-content'),
        platforms,
        tags
      };

      const editingId = e.target.dataset.editingId;
      
      if (editingId) {
        // Update existing template
        await window.electronAPI.invoke('broadcast:update-template', editingId, templateData);
        this.showSuccess('Template updated successfully!');
      } else {
        // Create new template
        await window.electronAPI.invoke('broadcast:create-template', templateData);
        this.showSuccess('Template created successfully!');
      }
      
      this.getModalManager().closeModal();
      this.resetTemplateForm();
      
      // Refresh templates if we're on the templates tab
      if (document.querySelector('.broadcast-tab[data-tab="templates"]').classList.contains('active')) {
        this.loadTemplatesData();
      }
      
      // Refresh management modal if open
      if (document.getElementById('manage-templates-modal').style.display !== 'none') {
        this.loadTemplatesForManagement();
      }
    } catch (error) {
      console.error('Failed to save template:', error);
      this.showError('Failed to save template');
    }
  }

  /**
   * Reset template form
   */
  resetTemplateForm() {
    const form = document.getElementById('new-template-form');
    form.reset();
    delete form.dataset.editingId;
    
    // Reset modal title and button text
    document.querySelector('#new-template-modal .modal-header h3').textContent = 'Create New Template';
    document.querySelector('#new-template-form button[type="submit"]').textContent = 'Create Template';
  }

  /**
   * Open manage templates modal
   */
  async openManageTemplatesModal() {
    this.getModalManager().openModal('manage-templates-modal');
    await this.loadTemplatesForManagement();
  }

  /**
   * Load templates for management
   */
  async loadTemplatesForManagement() {
    const container = document.getElementById('templates-list');
    try {
      const templates = await window.electronAPI.invoke('broadcast:list-templates');
      this.renderTemplatesForManagement(templates);
    } catch (error) {
      console.error('Failed to load templates for management:', error);
      container.innerHTML = '<div class="loading-state">Failed to load templates</div>';
    }
  }

  /**
   * Render templates for management
   */
  renderTemplatesForManagement(templates) {
    const container = document.getElementById('templates-list');
    
    if (templates.length === 0) {
      container.innerHTML = '<div class="loading-state">No templates yet. Create your first template!</div>';
      return;
    }

    // Reuse the same template rendering logic
    this.renderTemplates(templates);
  }

  /**
   * Open apply template modal
   */
  async openApplyTemplateModal(templateId = null, filePath = null) {
    this.getModalManager().openModal('apply-template-modal');
    
    // Load templates and markdown files
    try {
      const [templates, files] = await Promise.all([
        window.electronAPI.invoke('broadcast:list-templates'),
        window.electronAPI.invoke('broadcast:scan-content-directory', 'content')
      ]);

      // Populate template select
      const templateSelect = document.getElementById('template-select');
      templateSelect.innerHTML = '<option value="">Choose a template...</option>' +
        templates.map(template => 
          `<option value="${template.id}" ${templateId === template.id ? 'selected' : ''}>
            ${this.escapeHtml(template.name)}
          </option>`
        ).join('');

      // Populate markdown file select
      const fileSelect = document.getElementById('markdown-file-select');
      fileSelect.innerHTML = '<option value="">Choose a markdown file...</option>' +
        files.map(file => 
          `<option value="${file.path}" ${filePath === file.path ? 'selected' : ''}>
            ${this.escapeHtml(file.title || file.name)}
          </option>`
        ).join('');

      // Update preview if both are selected
      this.updateTemplatePreview();
    } catch (error) {
      console.error('Failed to load data for apply template modal:', error);
      this.showError('Failed to load template data');
    }
  }

  /**
   * Update template preview
   */
  async updateTemplatePreview() {
    const templateSelect = document.getElementById('template-select');
    const fileSelect = document.getElementById('markdown-file-select');
    const previewDiv = document.getElementById('template-preview');
    const previewContent = document.getElementById('preview-content');
    const applyBtn = document.getElementById('apply-template-btn');

    const templateId = templateSelect.value;
    const filePath = fileSelect.value;

    if (!templateId || !filePath) {
      previewDiv.style.display = 'none';
      applyBtn.disabled = true;
      return;
    }

    try {
      const preview = await window.electronAPI.invoke('broadcast:preview-template', templateId, { filePath });
      previewContent.textContent = preview.content;
      previewDiv.style.display = 'block';
      applyBtn.disabled = false;
    } catch (error) {
      console.error('Failed to generate preview:', error);
      previewContent.textContent = 'Failed to generate preview';
      previewDiv.style.display = 'block';
      applyBtn.disabled = true;
    }
  }

  /**
   * Apply template to markdown
   */
  async applyTemplateToMarkdown() {
    const templateSelect = document.getElementById('template-select');
    const fileSelect = document.getElementById('markdown-file-select');

    const templateId = templateSelect.value;
    const filePath = fileSelect.value;

    if (!templateId || !filePath) {
      this.showError('Please select both a template and a markdown file');
      return;
    }

    try {
      const stagedPost = await window.electronAPI.invoke('broadcast:apply-template', templateId, filePath);
      this.getModalManager().closeModal();
      this.showSuccess('Staged post created successfully!');
      
      // Refresh posts if we're on the posts tab
      if (document.querySelector('.broadcast-tab[data-tab="posts"]').classList.contains('active')) {
        this.loadBroadcastData();
      }
    } catch (error) {
      console.error('Failed to apply template:', error);
      this.showError('Failed to create staged post');
    }
  }

  /**
   * Edit template
   */
  async editTemplate(templateId) {
    try {
      const template = await window.electronAPI.invoke('broadcast:get-template', templateId);
      
      // Populate the new template form with existing data
      document.getElementById('template-name').value = template.name;
      document.getElementById('template-description').value = template.description || '';
      document.getElementById('template-content').value = template.content;
      document.getElementById('template-tags').value = template.tags ? template.tags.join(', ') : '';
      
      // Set platform checkboxes
      document.querySelectorAll('input[name="platforms"]').forEach(checkbox => {
        checkbox.checked = template.platforms.includes(checkbox.value);
      });

      // Store the template ID for updating
      document.getElementById('new-template-form').dataset.editingId = templateId;
      
      // Change modal title and button text
      document.querySelector('#new-template-modal .modal-header h3').textContent = 'Edit Template';
      document.querySelector('#new-template-form button[type="submit"]').textContent = 'Update Template';
      
      this.getModalManager().openModal('new-template-modal');
    } catch (error) {
      console.error('Failed to load template for editing:', error);
      this.showError('Failed to load template');
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId) {
    if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
      return;
    }

    try {
      await window.electronAPI.invoke('broadcast:delete-template', templateId);
      this.showSuccess('Template deleted successfully!');
      
      // Refresh templates
      if (document.querySelector('.broadcast-tab[data-tab="templates"]').classList.contains('active')) {
        this.loadTemplatesData();
      }
      
      // Refresh management modal if open
      if (document.getElementById('manage-templates-modal').style.display !== 'none') {
        this.loadTemplatesForManagement();
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
      this.showError('Failed to delete template');
    }
  }

  // ===== POST MANAGEMENT =====

  /**
   * Handle new post creation
   */
  async handleNewPost(e) {
    console.log('[BroadcastManager] Handling new post...');
    
    try {
      const action = e.submitter.dataset.action;
      const content = document.getElementById('post-content').value;
      const platforms = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
        .map(cb => cb.value);
      const scheduledFor = document.getElementById('post-schedule').value || undefined;

      console.log('[BroadcastManager] Post details:', { action, platforms, contentLength: content.length, scheduledFor });

      if (platforms.length === 0) {
        this.showError('Please select at least one platform');
        return;
      }

      const postData = {
        content,
        platforms,
        scheduledFor,
        status: action === 'draft' ? 'draft' : (scheduledFor ? 'scheduled' : 'posted'),
      };

      // If this is an immediate post (not draft or scheduled), try to post to platforms
      if (action === 'post' && !scheduledFor) {
        console.log('[BroadcastManager] Attempting to post to platforms immediately');
        
        const postResults = {};
        let hasErrors = false;
        
        for (const platform of platforms) {
          console.log(`[BroadcastManager] Posting to ${platform}...`);
          
          try {
            if (platform === 'bluesky') {
              // Validate session first
              const activeAccount = await window.electronAPI.atproto.getActiveAccount();
              if (!activeAccount) {
                throw new Error('No active Bluesky account');
              }
              
              const isSessionValid = await window.electronAPI.atproto.validateSession(activeAccount.id);
              if (!isSessionValid) {
                throw new Error('Bluesky session expired. Please reconnect your account.');
              }
              
              const postUrl = await window.electronAPI.atproto.postContent(content);
              if (postUrl) {
                postResults[platform] = { success: true, url: postUrl };
                console.log(`[BroadcastManager] Successfully posted to ${platform}:`, postUrl);
              } else {
                throw new Error('Post returned no URL');
              }
            } else if (platform === 'x') {
              // Validate session first
              const activeAccount = await window.electronAPI.x.getActiveAccount();
              if (!activeAccount) {
                throw new Error('No active X account');
              }
              
              const isValid = await window.electronAPI.x.validateCredentials(activeAccount.id);
              if (!isValid) {
                throw new Error('X credentials invalid. Please reconnect your account.');
              }
              
              const postUrl = await window.electronAPI.x.postTweet(content);
              if (postUrl) {
                postResults[platform] = { success: true, url: postUrl };
                console.log(`[BroadcastManager] Successfully posted to ${platform}:`, postUrl);
              } else {
                throw new Error('Post returned no URL');
              }
            } else {
              // Handle other platforms here in the future
              console.log(`[BroadcastManager] Platform ${platform} not yet implemented`);
              postResults[platform] = { success: false, error: 'Platform not implemented' };
            }
          } catch (error) {
            console.error(`[BroadcastManager] Failed to post to ${platform}:`, error);
            postResults[platform] = { success: false, error: error.message };
            hasErrors = true;
          }
        }
        
        // Update post data with results
        postData.postResults = postResults;
        
        // Show results to user
        const successfulPosts = Object.entries(postResults).filter(([_, result]) => result.success);
        const failedPosts = Object.entries(postResults).filter(([_, result]) => !result.success);
        
        if (successfulPosts.length > 0) {
          const successPlatforms = successfulPosts.map(([platform]) => platform).join(', ');
          this.showSuccess(`Successfully posted to: ${successPlatforms}`);
        }
        
        if (failedPosts.length > 0) {
          const failedPlatforms = failedPosts.map(([platform, result]) => `${platform}: ${result.error}`).join('; ');
          this.showError(`Failed to post to: ${failedPlatforms}`);
          
          // Update status to reflect partial failure
          if (successfulPosts.length === 0) {
            postData.status = 'failed';
          } else {
            postData.status = 'partial';
          }
        }
        
        // Update AT Protocol and X status after posting attempt
        await this.updateATProtoStatus();
        await this.updateXStatus();
      }

      await window.electronAPI.broadcast.addPost(postData);
      await this.loadBroadcastData();
      this.getModalManager().closeModal();
      
      if (action === 'draft') {
        this.showSuccess('Post saved as draft');
      } else if (scheduledFor) {
        this.showSuccess('Post scheduled successfully');
      } else if (!postData.postResults || Object.values(postData.postResults).some(r => r.success)) {
        // Only show generic success if we haven't already shown specific results
        if (!postData.postResults) {
          this.showSuccess('Post created successfully');
        }
      }
      
      // Clear form
      document.getElementById('new-post-form').reset();
    } catch (error) {
      console.error('[BroadcastManager] Failed to create post:', error);
      this.showError('Failed to create post');
    }
  }

  // ===== CHARACTER COUNT MANAGEMENT =====

  /**
   * Update character count for post content
   */
  updateCharacterCount(content) {
    const charCount = document.getElementById('char-count');
    charCount.textContent = content.length;
    
    // Update color based on limit
    const limit = parseInt(document.getElementById('char-limit').textContent);
    if (content.length > limit) {
      charCount.style.color = 'var(--error-color)';
    } else if (content.length > limit * 0.9) {
      charCount.style.color = 'var(--warning-color)';
    } else {
      charCount.style.color = 'var(--text-secondary)';
    }
  }

  /**
   * Update character limit based on selected platforms
   */
  updateCharacterLimit() {
    const selectedPlatforms = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
      .map(cb => cb.value);
    
    let limit = 280; // Default Twitter limit
    
    if (selectedPlatforms.includes('bluesky')) {
      limit = Math.min(limit, 300); // Bluesky limit
    }
    if (selectedPlatforms.includes('farcaster')) {
      limit = Math.min(limit, 320); // Farcaster limit
    }
    
    document.getElementById('char-limit').textContent = limit;
    
    // Update current count color
    const content = document.getElementById('post-content').value;
    this.updateCharacterCount(content);
  }

  // ===== PLATFORM STATUS MANAGEMENT =====

  /**
   * Update AT Protocol status
   */
  async updateATProtoStatus() {
    try {
      const activeAccount = await window.electronAPI.atproto.getActiveAccount();
      if (activeAccount) {
        const isSessionValid = await window.electronAPI.atproto.validateSession(activeAccount.id);
        this.platformStatus.bluesky = {
          connected: isSessionValid,
          username: isSessionValid ? activeAccount.handle : null
        };
      } else {
        this.platformStatus.bluesky = { connected: false, username: null };
      }
    } catch (error) {
      console.error('Failed to update AT Protocol status:', error);
      this.platformStatus.bluesky = { connected: false, username: null };
    }
  }

  /**
   * Update X status
   */
  async updateXStatus() {
    try {
      const activeAccount = await window.electronAPI.x.getActiveAccount();
      if (activeAccount) {
        const isValid = await window.electronAPI.x.validateCredentials(activeAccount.id);
        this.platformStatus.x = {
          connected: isValid,
          username: isValid ? activeAccount.username : null
        };
      } else {
        this.platformStatus.x = { connected: false, username: null };
      }
    } catch (error) {
      console.error('Failed to update X status:', error);
      this.platformStatus.x = { connected: false, username: null };
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get modal manager
   */
  getModalManager() {
    return this.getApp().getModalManager();
  }
} 