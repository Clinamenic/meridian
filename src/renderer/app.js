// Main Application Logic
class MeridianApp {
  constructor() {
    this.currentTool = 'collate';
    this.workspacePath = null;
    this.data = {
      collate: null,
      archive: null,
      broadcast: null,
    };
    
    // Filter state management
    this.activeTagFilters = new Set(); // Track active tag filters
    this.currentSearchTerm = ''; // Track current search term
    this.filterLogic = 'any'; // Default to 'any' (OR logic)
    
    // Collapse state management
    this.collateCollapseState = {
      globalState: 'expanded', // 'expanded' or 'collapsed'
      collapsedItems: new Set() // Track individually collapsed items
    };
    
    this.archiveCollapseState = {
      globalState: 'expanded', // 'expanded' or 'collapsed'
      collapsedItems: new Set() // Track individually collapsed items
    };
    
    // Marbling background renderer
    this.marblingRenderer = null;

    this.init();
  }

  async init() {
    await this.setupEventListeners();
    await this.checkWorkspace();
    
    // Show landing page if no workspace is selected
    if (!this.workspacePath) {
      document.getElementById('landing-page').style.display = 'flex';
      this.initializeMarblingBackground();
      await this.loadAppVersion();
      document.getElementById('landing-workspace-btn').addEventListener('click', async () => {
        await this.selectWorkspace();
        if (this.workspacePath) {
          document.getElementById('landing-page').style.display = 'none';
          this.cleanupMarblingBackground();
          await this.loadToolData();
          // Account state will be automatically initialized by workspace selection
          await this.waitForAccountStateInitialization();
          this.updateFooterWorkspace();
          this.updateFooterStatus('Ready');
        }
      });
      return;
    }
    
    // If workspace exists, proceed with normal initialization
    document.getElementById('landing-page').style.display = 'none';
    await this.loadToolData();
    
    // Check if account state is already initialized, if not wait for it
    try {
      console.log('[AccountState] Checking if account state is initialized...');
      const isInitialized = await window.electronAPI.accountState.isInitialized();
      console.log('[AccountState] Is initialized:', isInitialized);
      
      if (!isInitialized) {
        console.log('[AccountState] Not initialized, waiting...');
        await this.waitForAccountStateInitialization();
      } else {
        console.log('[AccountState] Already initialized, updating UI...');
        await this.updateUIFromAccountState();
      }
    } catch (error) {
      console.error('[AccountState] Error during initialization check:', error);
      // Fallback: try to update UI anyway
      try {
        await this.updateUIFromAccountState();
      } catch (uiError) {
        console.error('[AccountState] Fallback UI update failed:', uiError);
      }
    }
    
    this.updateFooterWorkspace();
    this.updateFooterStatus('Ready');
  }

  // Event Listeners
  async setupEventListeners() {
    // Global search button
    document.getElementById('global-search-btn').addEventListener('click', () => {
      this.openGlobalSearchModal();
    });

    // Info button
    document.getElementById('info-btn').addEventListener('click', () => {
      this.openModal('info-modal');
    });

    // Workspace dropdown
    this.setupWorkspaceDropdown();

    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const tool = e.currentTarget.dataset.tool;
        console.log(`[Tab] User clicked ${tool} tab`);
        await this.switchTool(tool);
      });
    });

    // Modal controls
    this.setupModalEvents();
    
    // Setup modal tab events
    this.setupModalTabEvents();

    // Tool-specific events
    this.setupCollateEvents();
    this.setupArchiveEvents();
    this.setupBroadcastEvents();
    this.setupUploadEvents();
    this.setupGlobalSearchEvents();
    
    // Account management events
    this.setupAccountManagementEvents();
    this.setupATProtoAccountManagementEvents();
    this.setupXAccountManagementEvents();
  }

  setupModalEvents() {
    const overlay = document.getElementById('modal-overlay');
    
    if (!overlay) {
      console.error('Modal overlay element not found during setup');
      return;
    }
    
    // Close modal events
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeModal();
      });
    });

    // Click overlay to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeModal();
      }
    });

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });
  }

  setupModalTabEvents() {
    // Set up tab switching for the combined add resources modal
    document.querySelectorAll('.modal-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchModalTab(tabName);
      });
    });
  }

  setupCollateEvents() {
    // Add resources button (combined modal)
    document.getElementById('add-resources-btn').addEventListener('click', () => {
      this.openAddResourcesModal();
    });

    // Add resource form
    document.getElementById('add-resource-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleAddResource();
    });

    // Extract metadata button
    document.getElementById('extract-metadata-btn').addEventListener('click', async () => {
      await this.extractMetadata();
    });

    // Setup tag autocomplete for resource tags input
    this.setupResourceTagsAutocomplete();

    // Search functionality
    document.getElementById('resource-search').addEventListener('input', (e) => {
      this.currentSearchTerm = e.target.value;
      this.applyAllFilters();
    });

    // Filter logic control
    this.initializeFilterLogic();

    // Clear filters button
    document.getElementById('clear-filters-btn').addEventListener('click', () => {
      this.clearAllFilters();
    });

    // Global collapse/expand button
    document.getElementById('collapse-all-btn').addEventListener('click', () => {
      this.toggleAllResourcesCollapse();
    });

    // Bulk add events
    this.setupBulkAddEvents();

    // Export events
    this.setupExportEvents();
  }

  setupArchiveEvents() {
    // Upload file button
    document.getElementById('upload-file-btn').addEventListener('click', async () => {
      await this.uploadFile();
    });

    // Setup wallet button - now opens account management modal
    document.getElementById('setup-wallet-btn').addEventListener('click', () => {
      this.openArweaveAccountsModal();
    });

    // Archive search functionality
    document.getElementById('archive-search').addEventListener('input', (e) => {
      this.currentArchiveSearchTerm = e.target.value;
      this.applyArchiveFilters();
    });

    // Archive filter logic control
    this.initializeArchiveFilterLogic();

    // Archive clear filters button
    document.getElementById('archive-clear-filters-btn').addEventListener('click', () => {
      this.clearAllArchiveFilters();
    });

    // Archive actions dropdown handling
    document.addEventListener('click', (e) => {
      if (e.target.closest('.archive-actions-btn')) {
        const fileUuid = e.target.closest('.archive-actions-btn').dataset.fileUuid;
        this.toggleArchiveActionsDropdown(fileUuid);
        e.stopPropagation();
      } else if (e.target.classList.contains('archive-actions-item')) {
        const fileUuid = e.target.dataset.fileUuid;
        let action = 'view';
        if (e.target.classList.contains('edit-option')) action = 'edit';
        else if (e.target.classList.contains('upload-option')) action = 'upload';
        else if (e.target.classList.contains('locate-option')) action = 'locate';
        else if (e.target.classList.contains('refresh-option')) action = 'refresh';
        
        this.handleArchiveAction(fileUuid, action);
        this.hideAllArchiveActionsDropdowns();
        e.stopPropagation();
      } else {
        this.hideAllArchiveActionsDropdowns();
      }
    });

    // Initialize archive filter state
    this.activeArchiveTagFilters = new Set();
    this.currentArchiveSearchTerm = '';
    this.archiveFilterLogic = 'any'; // Default to 'any' (OR logic)

    // Account management modal events
    this.setupAccountManagementEvents();

    // Setup archive tag input events
    this.setupArchiveTagInputEvents();

    // Archive collapse/expand functionality
    document.getElementById('archive-collapse-all-btn').addEventListener('click', () => {
      this.toggleAllArchiveFilesCollapse();
    });

    // Setup individual archive collapse events after rendering
    this.setupArchiveCollapseEvents();

    // Edit archive item form
    document.getElementById('edit-archive-item-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleEditArchiveItem();
    });
  }

  setupBroadcastEvents() {
    // New post button
    document.getElementById('new-post-btn').addEventListener('click', () => {
      this.openModal('new-post-modal');
    });

    // New template button
    document.getElementById('new-template-btn').addEventListener('click', () => {
      this.openModal('new-template-modal');
    });

    // Manage templates button
    document.getElementById('manage-templates-btn').addEventListener('click', () => {
      this.openManageTemplatesModal();
    });

    // New post form
    document.getElementById('new-post-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleNewPost(e);
    });

    // New template form
    document.getElementById('new-template-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleNewTemplate(e);
    });

    // Character count for posts
    document.getElementById('post-content').addEventListener('input', (e) => {
      this.updateCharacterCount(e.target.value);
    });

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
          this.openATProtoAccountsModal();
        } else if (platform === 'x') {
          this.openXAccountsModal();
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
    document.getElementById('template-select').addEventListener('change', () => {
      this.updateTemplatePreview();
    });

    document.getElementById('markdown-file-select').addEventListener('change', () => {
      this.updateTemplatePreview();
    });

    document.getElementById('apply-template-btn').addEventListener('click', () => {
      this.applyTemplateToMarkdown();
    });
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

  // Workspace Management
  setupWorkspaceDropdown() {
    const dropdownBtn = document.getElementById('workspace-dropdown-btn');

    // Direct workspace selection - no dropdown menu
    dropdownBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.selectWorkspace();
    });

    // Setup other footer dropdowns
    this.setupFooterDropdowns();
  }

  setupFooterDropdowns() {
    // Setup placeholder dropdowns for other footer items (excluding status which is just informational)
    const dropdownIds = ['arweave-dropdown-btn', 'farcaster-dropdown-btn', 'bluesky-dropdown-btn', 'x-dropdown-btn'];
    
    dropdownIds.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          // For now, just show a placeholder - you can implement specific functionality later
          this.showFooterDropdownPlaceholder(id);
        });
      }
    });
  }

  showFooterDropdownPlaceholder(buttonId) {
    // Handle specific footer dropdown actions
    if (buttonId === 'arweave-dropdown-btn') {
      this.openArweaveAccountsModal();
      return;
    }
    
    if (buttonId === 'bluesky-dropdown-btn') {
      this.openATProtoAccountsModal();
      return;
    }
    
    if (buttonId === 'x-dropdown-btn') {
      this.openXAccountsModal();
      return;
    }
    
    // Placeholder for other footer dropdowns
    const buttonMap = {
      'farcaster-dropdown-btn': 'Farcaster account settings'
    };
    
    const feature = buttonMap[buttonId] || 'Feature';
    console.log(`${feature} dropdown clicked - functionality to be implemented`);
  }

  hideAllFooterDropdowns() {
    // Hide any footer dropdowns (for future implementation)
    const allDropdownBtns = document.querySelectorAll('.footer-dropdown-btn');
    const allDropdownMenus = document.querySelectorAll('.footer-dropdown-menu');
    
    allDropdownBtns.forEach(btn => btn.classList.remove('active'));
    allDropdownMenus.forEach(menu => menu.style.display = 'none');
  }

  async selectWorkspace() {
    try {
      this.updateFooterStatus('Selecting workspace...', false);
      
      const result = await window.electronAPI.selectWorkspace();
      if (result.success) {
        this.workspacePath = result.path;
        await this.updateWorkspaceIndicator();
        this.updateFooterStatus('Loading workspace data...', false);
        await this.loadToolData();
        
        // Account state initialization happens automatically in the backend
        this.updateFooterStatus('Detecting accounts...', false);
        await this.waitForAccountStateInitialization();
        
        this.updateFooterStatus('Ready', false);
      } else {
        this.updateFooterStatus('Workspace selection cancelled', false);
      }
    } catch (error) {
      console.error('Failed to select workspace:', error);
      this.showError('Failed to select workspace');
      this.updateFooterStatus('Error selecting workspace', true);
    }
  }

  async checkWorkspace() {
    try {
      const path = await window.electronAPI.getWorkspace();
      if (path) {
        this.workspacePath = path;
        await this.updateWorkspaceIndicator();
      }
    } catch (error) {
      console.error('Failed to check workspace:', error);
    }
  }

  async updateWorkspaceIndicator() {
    // Update footer workspace status (workspace indicator in subheader removed)
    this.updateFooterWorkspace();
  }

  // Footer status updates
  updateFooterWorkspace() {
    const footerPath = document.getElementById('footer-workspace-path');
    if (this.workspacePath) {
      const folderName = this.workspacePath.split('/').pop();
      footerPath.textContent = folderName;
      footerPath.title = this.workspacePath;
      footerPath.classList.add('connected');
      footerPath.classList.remove('error');
    } else {
      footerPath.textContent = 'Not selected';
      footerPath.title = '';
      footerPath.classList.remove('connected');
      footerPath.classList.add('error');
    }
  }

  updateFooterArweave(address = null, isConnected = false) {
    console.log('[AccountState] updateFooterArweave called with:', { address, isConnected });
    
    const footerArweave = document.getElementById('footer-arweave-address');
    console.log('[AccountState] Footer Arweave element found:', !!footerArweave);
    
    if (!footerArweave) {
      console.error('[AccountState] Footer Arweave element not found!');
      return;
    }
    
    if (isConnected && address) {
      // Show first 6 and last 4 characters of address
      const shortAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
      console.log('[AccountState] Setting Arweave footer to connected:', shortAddress);
      footerArweave.textContent = shortAddress;
      footerArweave.title = address;
      footerArweave.classList.add('connected');
      footerArweave.classList.remove('error');
    } else {
      console.log('[AccountState] Setting Arweave footer to not connected');
      footerArweave.textContent = 'Not connected';
      footerArweave.title = '';
      footerArweave.classList.remove('connected');
      footerArweave.classList.add('error');
    }
    
    console.log('[AccountState] Footer Arweave final state:', {
      text: footerArweave.textContent,
      title: footerArweave.title,
      classes: footerArweave.className
    });
  }

  updateFooterFarcaster(isConnected = false, username = null) {
    const footerFarcaster = document.getElementById('footer-farcaster-status');
    if (isConnected && username) {
      footerFarcaster.textContent = `@${username}`;
      footerFarcaster.title = `Connected as @${username}`;
      footerFarcaster.classList.add('connected');
      footerFarcaster.classList.remove('error');
    } else {
      footerFarcaster.textContent = 'Not connected';
      footerFarcaster.title = '';
      footerFarcaster.classList.remove('connected');
      footerFarcaster.classList.add('error');
    }
  }

  updateFooterBluesky(isConnected = false, handle = null) {
    console.log('[AccountState] updateFooterBluesky called with:', { isConnected, handle });
    
    const footerBluesky = document.getElementById('footer-bluesky-status');
    console.log('[AccountState] Footer Bluesky element found:', !!footerBluesky);
    
    if (!footerBluesky) {
      console.error('[AccountState] Footer Bluesky element not found!');
      return;
    }
    
    if (isConnected && handle) {
      console.log('[AccountState] Setting Bluesky footer to connected:', handle);
      footerBluesky.textContent = handle;
      footerBluesky.title = `Connected as ${handle}`;
      footerBluesky.classList.add('connected');
      footerBluesky.classList.remove('error');
    } else {
      console.log('[AccountState] Setting Bluesky footer to not connected');
      footerBluesky.textContent = 'Not connected';
      footerBluesky.title = '';
      footerBluesky.classList.remove('connected');
      footerBluesky.classList.add('error');
    }
    
    console.log('[AccountState] Footer Bluesky final state:', {
      text: footerBluesky.textContent,
      title: footerBluesky.title,
      classes: footerBluesky.className
    });
  }

  updateFooterStatus(status = 'Ready', isError = false) {
    const footerStatus = document.getElementById('footer-connection-status');
    footerStatus.textContent = status;
    
    if (isError) {
      footerStatus.classList.add('error');
      footerStatus.classList.remove('connected');
    } else {
      footerStatus.classList.remove('error');
      footerStatus.classList.add('connected');
    }
  }

  // Tool Management
  async switchTool(toolName) {
    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    });

    // Update active panel
    document.querySelectorAll('.tool-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `${toolName}-panel`);
    });

    this.currentTool = toolName;
    
    // Load data for the selected tool
    console.log(`[Tool] Switching to ${toolName}, loading data...`);
    try {
      switch (toolName) {
        case 'collate':
          await this.loadCollateData();
          break;
        case 'archive':
          await this.loadArchiveData();
          break;
        case 'broadcast':
          await this.loadBroadcastData();
          break;
      }
      console.log(`[Tool] Successfully loaded ${toolName} data`);
    } catch (error) {
      console.error(`[Tool] Failed to load ${toolName} data:`, error);
      this.showError(`Failed to load ${toolName} data`);
    }
  }

  async loadToolData() {
    // Check current active tool and load its data
    const activeTab = document.querySelector('.tab-btn.active');
    const toolName = activeTab ? activeTab.dataset.tool : 'collate';
    
    switch (toolName) {
      case 'collate':
        await this.loadCollateData();
        break;
      case 'archive':
        await this.loadArchiveData();
        break;
      case 'broadcast':
        await this.loadBroadcastData();
        break;
    }
    
    // Immediately try to update account state UI
    console.log('[AccountState] loadToolData complete, immediately checking account state...');
    try {
      await this.updateUIFromAccountState();
      console.log('[AccountState] Successfully updated UI from account state in loadToolData');
    } catch (error) {
      console.warn('[AccountState] Could not update UI from account state in loadToolData:', error);
    }
  }

  // Collate Tool
  async loadCollateData() {
    try {
      this.data.collate = await window.electronAPI.collate.loadData();
      this.renderResources();
      this.renderTagFilters();
    } catch (error) {
      console.error('Failed to load collate data:', error);
      this.showError('Failed to load resources');
    }
  }

  renderResources() {
    const container = document.getElementById('resource-list');
    if (!this.data.collate || !this.data.collate.resources) {
      container.innerHTML = '<div class="loading-state">No resources found</div>';
      return;
    }

    if (this.data.collate.resources.length === 0) {
      container.innerHTML = '<div class="loading-state">No resources yet. Add your first resource!</div>';
      return;
    }

    container.innerHTML = this.data.collate.resources.map(resource => `
      <div class="resource-item" data-id="${resource.id}">
        <div class="resource-header">
          ${resource.imageUrl ? `<img src="${resource.imageUrl}" alt="" class="resource-favicon">` : ''}
          <div class="resource-info">
            <h4 class="resource-title">${this.escapeHtml(resource.title)}</h4>
            <a href="${resource.url}" class="resource-url" target="_blank">${this.escapeHtml(resource.url)}</a>
          </div>
          <div class="resource-actions">
            <button class="resource-collapse-btn" data-resource-id="${resource.id}" title="Toggle details">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="resource-actions-dropdown">
              <button class="resource-actions-btn" data-resource-id="${resource.id}" title="Resource options">⋮</button>
              <div class="resource-actions-menu" data-resource-id="${resource.id}">
                <button class="resource-actions-item edit-option" data-resource-id="${resource.id}">Edit</button>
                <button class="resource-actions-item remove-option" data-resource-id="${resource.id}">Remove</button>
              </div>
            </div>
          </div>
        </div>
        ${resource.description ? `<p class="resource-description">${this.escapeHtml(resource.description)}</p>` : ''}
        <div class="resource-tags">
          <div class="resource-tag-input">
            <div class="tag-input-container">
              <input 
                type="text" 
                class="tag-input" 
                placeholder="add tag..." 
                data-resource-id="${resource.id}"
              />
              <button class="add-tag-btn" data-resource-id="${resource.id}" disabled>+</button>
            </div>
            <div class="tag-autocomplete" id="autocomplete-${resource.id}" style="display: none;"></div>
          </div>
          ${resource.tags.map(tag => `
            <span class="resource-tag">
              ${this.escapeHtml(tag)}
              <button class="remove-tag-btn" data-resource-id="${resource.id}" data-tag="${this.escapeHtml(tag)}" title="Remove tag">×</button>
            </span>
          `).join('')}
        </div>
      </div>
    `).join('');

    // Setup event listeners for resource tag inputs after rendering
    this.setupTagInputEvents();
    
    // Setup resource collapse events
    this.setupResourceCollapseEvents();
    
    // Restore collapse state after rendering
    this.restoreResourceCollapseState();
    
    // Apply current filters after rendering
    this.applyAllFilters();
    
    // Update resource count after initial render
    this.updateResourceCount();
  }

  renderTagFilters() {
    console.log('renderTagFilters called');
    
    const container = document.getElementById('tag-filter-list');
    if (!this.data.collate || !this.data.collate.tags) {
      container.innerHTML = '';
      return;
    }

    const tags = Object.entries(this.data.collate.tags)
      .sort(([a], [b]) => a.localeCompare(b)); // Sort alphabetically by tag name
      
    console.log('Rendering tags:', tags);

    container.innerHTML = tags.map(([tag, count]) => `
      <div class="tag-filter-container">
        <button class="tag-filter" data-tag="${tag}">
          ${this.escapeHtml(tag)} (${count})
        </button>
        <div class="tag-dropdown-menu" data-tag="${tag}">
          <button class="tag-dropdown-item edit-tag-option" data-tag="${tag}">Edit</button>
          <button class="tag-dropdown-item delete-tag-option" data-tag="${tag}">Remove</button>
        </div>
      </div>
    `).join('');

    // Add click and context menu events to tag filters
    container.querySelectorAll('.tag-filter').forEach(btn => {
      // Left click to toggle filter
      btn.addEventListener('click', (e) => {
        const tag = e.target.dataset.tag;
        this.toggleTagFilter(tag);
        e.target.classList.toggle('active');
      });

      // Right click to show context menu
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tag = e.target.dataset.tag;
        console.log('Right click on tag filter:', tag);
        this.showTagContextMenu(tag, e.clientX, e.clientY);
      });
      
      // Restore active state if this tag is currently filtered
      const tag = btn.dataset.tag;
      if (this.activeTagFilters.has(tag)) {
        btn.classList.add('active');
      }
    });

    // Add click events to dropdown options (these are now shown via context menu)
    const editOptions = container.querySelectorAll('.edit-tag-option');
    const deleteOptions = container.querySelectorAll('.delete-tag-option');
    
    editOptions.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const tag = e.target.dataset.tag;
        console.log('Edit option clicked for tag:', tag);
        this.hideTagContextMenu();
        this.openEditTagModal(tag);
      });
    });

    deleteOptions.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const tag = e.target.dataset.tag;
        console.log('Delete option clicked for tag:', tag);
        this.hideTagContextMenu();
        this.confirmDeleteTag(tag);
      });
    });
  }

  toggleTagFilter(tag) {
    if (this.activeTagFilters.has(tag)) {
      this.activeTagFilters.delete(tag);
    } else {
      this.activeTagFilters.add(tag);
    }
    this.applyAllFilters();
  }

  applyAllFilters() {
    if (!this.data.collate) return;

    const items = document.querySelectorAll('.resource-item');
    
    items.forEach(item => {
      const resourceId = item.dataset.id;
      const resource = this.data.collate.resources.find(r => r.id === resourceId);
      
      if (!resource) {
        item.style.display = 'none';
        return;
      }

      // Check search term filter
      let matchesSearch = true;
      if (this.currentSearchTerm.trim()) {
        const term = this.currentSearchTerm.toLowerCase();
        const title = resource.title.toLowerCase();
        const description = (resource.description || '').toLowerCase();
        const url = resource.url.toLowerCase();
        
        matchesSearch = title.includes(term) || description.includes(term) || url.includes(term);
      }

      // Check tag filters
      let matchesTags = true;
      if (this.activeTagFilters.size > 0) {
        if (this.filterLogic === 'all') {
          // ALL logic: Resource must have ALL of the selected tags
          matchesTags = Array.from(this.activeTagFilters).every(tag => 
            resource.tags.includes(tag)
          );
        } else {
          // ANY logic (default): Resource must have at least one of the selected tags
          matchesTags = Array.from(this.activeTagFilters).some(tag => 
            resource.tags.includes(tag)
          );
        }
      }

      // Show item only if it matches both search and tag filters
      item.style.display = (matchesSearch && matchesTags) ? 'block' : 'none';
    });

    // Show/hide clear filters button
    this.updateClearFiltersButton();
    
    // Update resource count display
    this.updateResourceCount();
  }

  updateClearFiltersButton() {
    const clearBtn = document.getElementById('clear-filters-btn');
    const hasFilters = this.activeTagFilters.size > 0 || this.currentSearchTerm.trim();
    
    if (clearBtn) {
      if (hasFilters) {
        clearBtn.classList.remove('inactive');
        clearBtn.disabled = false;
      } else {
        clearBtn.classList.add('inactive');
        clearBtn.disabled = true;
      }
    }
  }

  updateResourceCount() {
    const countElement = document.getElementById('resource-count-text');
    if (!countElement) return;
    
    // Count visible resource items
    const visibleItems = document.querySelectorAll('.resource-item[style*="display: block"], .resource-item:not([style*="display: none"])');
    const count = visibleItems.length;
    
    // Update the count text with proper pluralization
    const resourceText = count === 1 ? 'Resource' : 'Resources';
    countElement.textContent = `${count} ${resourceText} Listed`;
  }

  // Collapse/Expand functionality
  setupResourceCollapseEvents() {
    // Set up individual resource collapse buttons
    document.querySelectorAll('.resource-collapse-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const resourceId = e.target.closest('button').dataset.resourceId;
        this.toggleResourceCollapse(resourceId);
      });
    });
  }

  toggleResourceCollapse(resourceId) {
    const resourceItem = document.querySelector(`.resource-item[data-id="${resourceId}"]`);
    if (!resourceItem) return;

    resourceItem.classList.toggle('collapsed');
    
    // Update state tracking
    if (resourceItem.classList.contains('collapsed')) {
      this.collateCollapseState.collapsedItems.add(resourceId);
    } else {
      this.collateCollapseState.collapsedItems.delete(resourceId);
    }
  }

  toggleAllResourcesCollapse() {
    const collapseBtn = document.getElementById('collapse-all-btn');
    const currentState = collapseBtn.dataset.state;
    const newState = currentState === 'expanded' ? 'collapsed' : 'expanded';
    
    // Update button state
    collapseBtn.dataset.state = newState;
    collapseBtn.title = newState === 'collapsed' ? 'Expand All Resources' : 'Collapse All Resources';
    
    // Update global state tracking
    this.collateCollapseState.globalState = newState;
    
    // Apply state to all resource items and update individual tracking
    const resourceItems = document.querySelectorAll('.resource-item');
    if (newState === 'collapsed') {
      // Collapse all items and add them to collapsed set
      resourceItems.forEach(item => {
        item.classList.add('collapsed');
        this.collateCollapseState.collapsedItems.add(item.dataset.id);
      });
    } else {
      // Expand all items and clear collapsed set
      resourceItems.forEach(item => {
        item.classList.remove('collapsed');
      });
      this.collateCollapseState.collapsedItems.clear();
    }
  }

  clearAllFilters() {
    const clearBtn = document.getElementById('clear-filters-btn');
    
    // Don't do anything if button is disabled
    if (clearBtn && clearBtn.disabled) {
      return;
    }
    
    this.activeTagFilters.clear();
    this.currentSearchTerm = '';
    
    // Clear search input
    const searchInput = document.getElementById('resource-search');
    if (searchInput) {
      searchInput.value = '';
    }
    
    // Clear active tag filters
    document.querySelectorAll('.tag-filter.active').forEach(btn => {
      btn.classList.remove('active');
    });
    
    this.applyAllFilters();
  }

  initializeFilterLogic() {
    const filterLogicBtn = document.getElementById('filter-logic-btn');
    
    if (!filterLogicBtn) return;
    
    // Load saved preference or use default
    const savedLogic = localStorage.getItem('collate-filter-logic') || 'any';
    this.filterLogic = savedLogic;
    
    // Set initial button state
    this.updateFilterLogicButton();
    
    // Add event listener for button clicks
    filterLogicBtn.addEventListener('click', () => {
      // Toggle between 'any' and 'all'
      this.filterLogic = this.filterLogic === 'any' ? 'all' : 'any';
      localStorage.setItem('collate-filter-logic', this.filterLogic);
      
      // Update button appearance and reapply filters
      this.updateFilterLogicButton();
      this.applyAllFilters();
    });
  }

  updateFilterLogicButton() {
    const filterLogicBtn = document.getElementById('filter-logic-btn');
    if (!filterLogicBtn) return;
    
    // Set data attribute for CSS styling
    filterLogicBtn.setAttribute('data-logic', this.filterLogic);
    
    // Update tooltip
    const tooltipText = this.filterLogic === 'any' 
      ? 'Toggle Filter Logic: ANY of these tags' 
      : 'Toggle Filter Logic: ALL of these tags';
    filterLogicBtn.setAttribute('title', tooltipText);
  }

  async handleAddResource() {
    try {
      const url = document.getElementById('resource-url').value;
      const title = document.getElementById('resource-title').value;
      const description = document.getElementById('resource-description').value;
      
      // Use tags from modal tags array
      const tags = [...(this.modalTags || [])];

      const resourceData = {
        url,
        title,
        description,
        tags,
      };

      if (this.editingResourceId) {
        // Update existing resource
        await window.electronAPI.collate.updateResource(this.editingResourceId, resourceData);
        this.showSuccess('Resource updated successfully');
        this.editingResourceId = null;
      } else {
        // Add new resource
        await window.electronAPI.collate.addResource(resourceData);
        this.showSuccess('Resource added successfully');
      }

      await this.loadCollateData();
      this.closeModal();
      
      // Clear form and reset modal
      this.resetResourceModal();
    } catch (error) {
      console.error('Failed to save resource:', error);
      this.showError(this.editingResourceId ? 'Failed to update resource' : 'Failed to add resource');
    }
  }

  resetResourceModal() {
    // Clear form
    document.getElementById('add-resource-form').reset();
    
    // Show tabs (in case they were hidden for edit mode)
    const tabNavigation = document.querySelector('#add-resources-modal .modal-tab-navigation');
    if (tabNavigation) {
      tabNavigation.style.display = 'flex';
    }
    
    // Restore normal padding for modal tab content
    const modalTabContent = document.querySelector('#add-resources-modal .modal-tab-content');
    if (modalTabContent) {
      modalTabContent.style.paddingTop = '';
    }
    
    // Clear modal tags
    if (this.modalTags) {
      this.modalTags = [];
      this.renderModalTags();
    }
    
    // Reset add tag button state
    const input = document.getElementById('modal-tag-input');
    if (input) {
      this.updateModalAddTagButtonState(input);
    }
    
    // Reset modal state
    this.editingResourceId = null;
    document.querySelector('#add-resources-modal .modal-header h3').textContent = 'Add Resources';
    document.querySelector('#add-resource-form button[type="submit"]').textContent = 'Add Resource';
  }

  async extractMetadata() {
    try {
      const url = document.getElementById('resource-url').value;
      if (!url) {
        this.showError('Please enter a URL first');
        return;
      }

      const btn = document.getElementById('extract-metadata-btn');
      btn.textContent = 'Extracting...';
      btn.disabled = true;

      const metadata = await window.electronAPI.collate.extractMetadata(url);
      
      if (metadata.title) {
        document.getElementById('resource-title').value = metadata.title;
      }
      if (metadata.description) {
        document.getElementById('resource-description').value = metadata.description;
      }

      btn.textContent = 'Extract Metadata';
      btn.disabled = false;
    } catch (error) {
      console.error('Failed to extract metadata:', error);
      this.showError('Failed to extract metadata');
      
      const btn = document.getElementById('extract-metadata-btn');
      btn.textContent = 'Extract Metadata';
      btn.disabled = false;
    }
  }

  setupResourceTagsAutocomplete() {
    const input = document.getElementById('modal-tag-input');
    const addBtn = document.getElementById('modal-add-tag-btn');
    const autocompleteContainer = document.getElementById('modal-tag-autocomplete');
    
    if (!input || !addBtn || !autocompleteContainer) return;

    // Initialize modal tags array
    this.modalTags = [];

    // Setup input events
    input.addEventListener('input', (e) => {
      this.showModalTagAutocomplete(e.target);
      this.updateModalAddTagButtonState(e.target);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const tagValue = e.target.value.trim();
        if (tagValue) {
          this.addModalTag(tagValue);
        }
      } else if (e.key === 'Escape') {
        this.hideModalTagAutocomplete();
      }
    });

    input.addEventListener('blur', (e) => {
      // Delay hiding to allow click on autocomplete items
      setTimeout(() => {
        this.hideModalTagAutocomplete();
      }, 200);
    });

    // Setup add button event
    addBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const tagValue = input.value.trim();
      if (tagValue) {
        this.addModalTag(tagValue);
      }
    });
  }

  showModalTagAutocomplete(input) {
    const value = input.value.trim().toLowerCase();
    const autocompleteDiv = document.getElementById('modal-tag-autocomplete');

    if (value.length === 0) {
      this.hideModalTagAutocomplete();
      return;
    }

    // Get all existing tags across all resources
    const allTags = this.getAllExistingTags();
    
    // Filter tags based on input and exclude already added tags
    const suggestions = allTags
      .filter(tag => 
        tag.toLowerCase().includes(value) && 
        tag.toLowerCase() !== value &&
        !this.modalTags.includes(tag)
      )
      .slice(0, 8); // Limit to 8 suggestions

    if (suggestions.length === 0) {
      this.hideModalTagAutocomplete();
      return;
    }

    // Show autocomplete dropdown
    autocompleteDiv.innerHTML = suggestions
      .map(tag => `
        <div class="autocomplete-item" data-tag="${this.escapeHtml(tag)}">
          ${this.escapeHtml(tag)}
        </div>
      `).join('');

    // Add click events to autocomplete items
    autocompleteDiv.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const tag = e.target.dataset.tag;
        this.addModalTag(tag);
      });
    });

    autocompleteDiv.style.display = 'block';
  }

  hideModalTagAutocomplete() {
    const autocompleteDiv = document.getElementById('modal-tag-autocomplete');
    if (autocompleteDiv) {
      autocompleteDiv.style.display = 'none';
    }
  }

  updateModalAddTagButtonState(input) {
    const btn = document.getElementById('modal-add-tag-btn');
    const value = input.value.trim();
    
    if (btn) {
      btn.disabled = value.length === 0 || this.modalTags.includes(value);
    }
  }

  addModalTag(tagValue) {
    if (!tagValue || this.modalTags.includes(tagValue)) {
      return;
    }

    // Add tag to array
    this.modalTags.push(tagValue);
    
    // Clear input
    const input = document.getElementById('modal-tag-input');
    if (input) {
      input.value = '';
      this.updateModalAddTagButtonState(input);
    }
    
    // Hide autocomplete
    this.hideModalTagAutocomplete();
    
    // Re-render tags
    this.renderModalTags();
  }

  removeModalTag(tagValue) {
    const index = this.modalTags.indexOf(tagValue);
    if (index > -1) {
      this.modalTags.splice(index, 1);
      this.renderModalTags();
      
      // Update button state
      const input = document.getElementById('modal-tag-input');
      if (input) {
        this.updateModalAddTagButtonState(input);
      }
    }
  }

  renderModalTags() {
    const container = document.getElementById('modal-tags-list');
    if (!container) return;

    container.innerHTML = this.modalTags.map(tag => `
      <span class="resource-tag">
        ${this.escapeHtml(tag)}
        <button type="button" class="remove-tag-btn" data-tag="${this.escapeHtml(tag)}" title="Remove tag">×</button>
      </span>
    `).join('');

    // Add remove tag events
    container.querySelectorAll('.remove-tag-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tag = e.target.dataset.tag;
        this.removeModalTag(tag);
      });
    });
  }

  renderEditArchiveItemTags() {
    const container = document.getElementById('edit-archive-tags-list');
    if (!container) return;

    if (!this.editArchiveItemTags || this.editArchiveItemTags.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = this.editArchiveItemTags.map(tag => `
      <span class="resource-tag">
        ${this.escapeHtml(tag)}
        <button type="button" class="remove-tag-btn" data-tag="${this.escapeHtml(tag)}" title="Remove tag">×</button>
      </span>
    `).join('');

    // Add remove tag events
    container.querySelectorAll('.remove-tag-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tag = e.target.dataset.tag;
        this.removeEditArchiveItemTag(tag);
      });
    });
  }

  setupEditArchiveItemTagEvents() {
    const tagInput = document.getElementById('edit-archive-tag-input');
    const addTagBtn = document.getElementById('edit-archive-add-tag-btn');

    if (!tagInput || !addTagBtn) return;

    // Clear existing event listeners
    tagInput.replaceWith(tagInput.cloneNode(true));
    addTagBtn.replaceWith(addTagBtn.cloneNode(true));

    // Get fresh references
    const newTagInput = document.getElementById('edit-archive-tag-input');
    const newAddTagBtn = document.getElementById('edit-archive-add-tag-btn');

    newTagInput.addEventListener('input', (e) => {
      this.showEditArchiveItemTagAutocomplete(e.target);
      this.updateEditArchiveItemAddTagButtonState(e.target);
    });

    newTagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const tagValue = e.target.value.trim();
        if (tagValue) {
          this.addEditArchiveItemTag(tagValue);
        }
      } else if (e.key === 'Escape') {
        this.hideEditArchiveItemTagAutocomplete();
      }
    });

    newTagInput.addEventListener('blur', (e) => {
      // Delay hiding to allow click on autocomplete items
      setTimeout(() => {
        this.hideEditArchiveItemTagAutocomplete();
      }, 200);
    });

    newAddTagBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const tagValue = newTagInput.value.trim();
      if (tagValue) {
        this.addEditArchiveItemTag(tagValue);
      }
    });
  }

  addEditArchiveItemTag(tagValue) {
    if (!this.editArchiveItemTags) {
      this.editArchiveItemTags = [];
    }

    const trimmedTag = tagValue.trim();
    if (trimmedTag && !this.editArchiveItemTags.includes(trimmedTag)) {
      this.editArchiveItemTags.push(trimmedTag);
      this.renderEditArchiveItemTags();
      
      // Clear input and update button state
      const input = document.getElementById('edit-archive-tag-input');
      if (input) {
        input.value = '';
        this.updateEditArchiveItemAddTagButtonState(input);
        this.hideEditArchiveItemTagAutocomplete();
      }
    }
  }

  removeEditArchiveItemTag(tagValue) {
    if (!this.editArchiveItemTags) return;
    
    this.editArchiveItemTags = this.editArchiveItemTags.filter(tag => tag !== tagValue);
    this.renderEditArchiveItemTags();
  }

  updateEditArchiveItemAddTagButtonState(input) {
    const btn = document.getElementById('edit-archive-add-tag-btn');
    if (!btn) return;
    
    const hasValue = input.value.trim().length > 0;
    btn.disabled = !hasValue;
  }

  showEditArchiveItemTagAutocomplete(input) {
    const value = input.value.trim();
    const autocompleteDiv = document.getElementById('edit-archive-tag-autocomplete');

    if (value.length === 0) {
      this.hideEditArchiveItemTagAutocomplete();
      return;
    }

    // Get existing tags to exclude from suggestions
    const excludeTags = this.editArchiveItemTags || [];

    // Get intelligent tag suggestions from archive data
    const suggestions = this.getIntelligentArchiveTagSuggestions(value, excludeTags, 5);

    if (suggestions.length === 0) {
      this.hideEditArchiveItemTagAutocomplete();
      return;
    }

    // Show autocomplete dropdown
    autocompleteDiv.innerHTML = suggestions
      .map((tag, index) => `
        <div class="autocomplete-item" data-tag="${this.escapeHtml(tag)}" data-index="${index}">
          <span class="autocomplete-tag-name">${this.escapeHtml(tag)}</span>
        </div>
      `).join('');

    // Add click events to autocomplete items
    autocompleteDiv.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const tag = e.target.closest('.autocomplete-item').dataset.tag;
        this.addEditArchiveItemTag(tag);
      });
    });

    autocompleteDiv.style.display = 'block';
  }

  hideEditArchiveItemTagAutocomplete() {
    const autocompleteDiv = document.getElementById('edit-archive-tag-autocomplete');
    if (autocompleteDiv) {
      autocompleteDiv.style.display = 'none';
    }
  }

  // Tag Management functionality
  setupTagInputEvents() {
    // Only select tag inputs that are NOT archive tag inputs
    const tagInputs = document.querySelectorAll('.tag-input:not(.archive-tag-input)');
    const addTagBtns = document.querySelectorAll('.add-tag-btn:not(.archive-add-tag-btn)');
    const resourceActionsBtns = document.querySelectorAll('.resource-actions-btn');
    const editOptions = document.querySelectorAll('.edit-option');
    const removeOptions = document.querySelectorAll('.remove-option');
    const removeTagBtns = document.querySelectorAll('.remove-tag-btn:not(.archive-tag .remove-tag-btn)');

    // Set up input events for autocomplete and button state
    tagInputs.forEach(input => {
      input.addEventListener('input', (e) => {
        this.showTagAutocomplete(e.target);
        this.updateAddTagButtonState(e.target);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const tagValue = e.target.value.trim();
          if (tagValue) {
            this.addTagToResource(e.target.dataset.resourceId, tagValue);
          }
        } else if (e.key === 'Escape') {
          this.hideTagAutocomplete(e.target.dataset.resourceId);
        }
      });

      input.addEventListener('blur', (e) => {
        // Delay hiding to allow click on autocomplete items
        setTimeout(() => {
          this.hideTagAutocomplete(e.target.dataset.resourceId);
        }, 200);
      });
    });

    // Set up add button events
    addTagBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const resourceId = e.target.dataset.resourceId;
        const input = document.querySelector(`input[data-resource-id="${resourceId}"]`);
        const tagValue = input.value.trim();
        if (tagValue) {
          this.addTagToResource(resourceId, tagValue);
        }
      });
    });

    // Set up resource actions dropdown button events
    resourceActionsBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const resourceId = e.target.dataset.resourceId;
        this.toggleResourceActionsDropdown(resourceId);
      });
    });

    // Set up edit option events
    editOptions.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const resourceId = e.target.dataset.resourceId;
        this.hideAllResourceActionsDropdowns();
        this.openEditResourceModal(resourceId);
      });
    });

    // Set up remove option events
    removeOptions.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const resourceId = e.target.dataset.resourceId;
        this.hideAllResourceActionsDropdowns();
        this.confirmRemoveResource(resourceId);
      });
    });

    // Set up remove tag button events
    removeTagBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const resourceId = e.target.dataset.resourceId;
        const tag = e.target.dataset.tag;
        this.removeTagFromResource(resourceId, tag);
      });
    });
  }

  showTagAutocomplete(input) {
    const resourceId = input.dataset.resourceId;
    const value = input.value.trim();
    const autocompleteDiv = document.getElementById(`autocomplete-${resourceId}`);

    if (value.length === 0) {
      this.hideTagAutocomplete(resourceId);
      return;
    }

    // Get current resource's existing tags to exclude from suggestions
    const resource = this.data.collate?.resources?.find(r => r.id === resourceId);
    const excludeTags = resource ? resource.tags : [];

    // Get intelligent tag suggestions using best practices
    const suggestions = this.getIntelligentTagSuggestions(value, excludeTags, 5);

    if (suggestions.length === 0) {
      this.hideTagAutocomplete(resourceId);
      return;
    }

    // Show autocomplete dropdown with enhanced styling
    autocompleteDiv.innerHTML = suggestions
      .map((tag, index) => `
        <div class="autocomplete-item" data-tag="${this.escapeHtml(tag)}" data-index="${index}">
          <span class="autocomplete-tag-name">${this.escapeHtml(tag)}</span>
        </div>
      `).join('');

    // Add click events to autocomplete items
    autocompleteDiv.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const tag = e.target.closest('.autocomplete-item').dataset.tag;
        this.addTagToResource(resourceId, tag);
      });
    });

    autocompleteDiv.style.display = 'block';
  }

  hideTagAutocomplete(resourceId) {
    const autocompleteDiv = document.getElementById(`autocomplete-${resourceId}`);
    if (autocompleteDiv) {
      autocompleteDiv.style.display = 'none';
    }
  }

  getAllExistingTags() {
    if (!this.data.collate || !this.data.collate.resources) {
      return [];
    }

    const allTags = new Set();
    this.data.collate.resources.forEach(resource => {
      resource.tags.forEach(tag => allTags.add(tag));
    });

    return Array.from(allTags).sort();
  }

  /**
   * Get intelligently ranked tag suggestions based on best practices
   * Prioritizes: prefix matches first (by frequency), then contains matches (by frequency)
   */
  getIntelligentTagSuggestions(input, excludeTags = [], limit = 5) {
    if (!this.data.collate || !this.data.collate.resources) {
      return [];
    }

    const inputLower = input.trim().toLowerCase();
    if (inputLower.length === 0) {
      return [];
    }

    // Calculate tag frequency and usage stats
    const tagStats = new Map();
    this.data.collate.resources.forEach(resource => {
      resource.tags.forEach(tag => {
        if (!tagStats.has(tag)) {
          tagStats.set(tag, {
            name: tag,
            frequency: 0,
            resourceCount: 0,
            lastUsed: new Date(0) // Default to epoch
          });
        }
        const stats = tagStats.get(tag);
        stats.frequency++;
        stats.resourceCount++;
        // Use resource creation date as proxy for tag usage
        if (resource.created) {
          const resourceDate = new Date(resource.created);
          if (resourceDate > stats.lastUsed) {
            stats.lastUsed = resourceDate;
          }
        }
      });
    });

    // Separate prefix matches from contains matches
    const prefixMatches = [];
    const containsMatches = [];

    Array.from(tagStats.values()).forEach(tagInfo => {
      // Exclude already applied tags
      if (excludeTags.includes(tagInfo.name)) {
        return;
      }
      
      const tagLower = tagInfo.name.toLowerCase();
      
      // Must match input and not be identical
      if (tagLower === inputLower) {
        return;
      }
      
      if (tagLower.startsWith(inputLower)) {
        prefixMatches.push(tagInfo);
      } else if (tagLower.includes(inputLower)) {
        containsMatches.push(tagInfo);
      }
    });

    // Sort each group by frequency (descending), then alphabetically
    const sortByFrequency = (a, b) => {
      if (a.frequency !== b.frequency) {
        return b.frequency - a.frequency; // Higher frequency first
      }
      return a.name.localeCompare(b.name); // Alphabetical for ties
    };

    prefixMatches.sort(sortByFrequency);
    containsMatches.sort(sortByFrequency);

    // Combine: prefix matches first, then contains matches
    const allSuggestions = [...prefixMatches, ...containsMatches].slice(0, limit);

    // Debug logging in development
    if (allSuggestions.length > 0) {
      console.log(`[TagSuggestion] Top ${allSuggestions.length} suggestions for "${input}":`, 
        allSuggestions.map((s, index) => ({
          rank: index + 1,
          tag: s.name,
          freq: s.frequency,
          type: s.name.toLowerCase().startsWith(inputLower) ? 'prefix' : 'contains'
        }))
      );
    }

    return allSuggestions.map(s => s.name);
  }

  async addTagToResource(resourceId, tagValue) {
    if (!tagValue || tagValue.length === 0) {
      return;
    }

    try {
      // Find the resource
      const resource = this.data.collate.resources.find(r => r.id === resourceId);
      if (!resource) {
        this.showError('Resource not found');
        return;
      }

      // Check if tag already exists on this resource
      if (resource.tags.includes(tagValue)) {
        this.showError('Tag already exists on this resource');
        return;
      }

      // Add tag via IPC
      await window.electronAPI.collate.addTagToResource(resourceId, tagValue);
      
      // Reload data to reflect changes
      await this.loadCollateData();
      
      // Clear the input and reset button state
      const input = document.querySelector(`input[data-resource-id="${resourceId}"]`);
      if (input) {
        input.value = '';
        this.updateAddTagButtonState(input);
      }
      
      // Hide autocomplete
      this.hideTagAutocomplete(resourceId);

      this.showSuccess('Tag added successfully');
    } catch (error) {
      console.error('Failed to add tag:', error);
      this.showError('Failed to add tag');
    }
  }

  updateAddTagButtonState(input) {
    const resourceId = input.dataset.resourceId;
    const button = document.querySelector(`button[data-resource-id="${resourceId}"].add-tag-btn`);
    const hasText = input.value.trim().length > 0;
    
    if (button) {
      button.disabled = !hasText;
    }
  }

  // Archive Tag Management functionality
  setupArchiveTagInputEvents() {
    const archiveTagInputs = document.querySelectorAll('.archive-tag-input');
    const archiveAddTagBtns = document.querySelectorAll('.archive-add-tag-btn');
    const archiveRemoveTagBtns = document.querySelectorAll('.archive-tag .remove-tag-btn');

    // Set up input events for autocomplete and button state
    archiveTagInputs.forEach(input => {
      input.addEventListener('input', (e) => {
        this.showArchiveTagAutocomplete(e.target);
        this.updateArchiveAddTagButtonState(e.target);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const tagValue = e.target.value.trim();
          if (tagValue) {
            this.addTagToArchiveFile(e.target.dataset.fileUuid, tagValue);
          }
        } else if (e.key === 'Escape') {
          this.hideArchiveTagAutocomplete(e.target.dataset.fileUuid);
        }
      });

      input.addEventListener('blur', (e) => {
        // Delay hiding to allow click on autocomplete items
        setTimeout(() => {
          this.hideArchiveTagAutocomplete(e.target.dataset.fileUuid);
        }, 200);
      });
    });

    // Set up add button events
    archiveAddTagBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fileUuid = e.target.dataset.fileUuid;
        const input = document.querySelector(`input[data-file-uuid="${fileUuid}"]`);
        const tagValue = input?.value.trim();
        if (tagValue) {
          this.addTagToArchiveFile(fileUuid, tagValue);
        }
      });
    });

    // Set up remove tag button events
    archiveRemoveTagBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fileUuid = e.target.dataset.fileUuid;
        const tag = e.target.dataset.tag;
        this.removeTagFromArchiveFile(fileUuid, tag);
      });
    });
  }

  showArchiveTagAutocomplete(input) {
    const fileUuid = input.dataset.fileUuid;
    const value = input.value.trim();
    const autocompleteDiv = document.getElementById(`archive-autocomplete-${fileUuid}`);

    if (value.length === 0) {
      this.hideArchiveTagAutocomplete(fileUuid);
      return;
    }

    // Get current file's existing tags to exclude from suggestions
    const file = this.data.archive?.files?.find(f => f.uuid === fileUuid);
    const excludeTags = file?.tags || [];

    // Get intelligent tag suggestions using best practices
    const suggestions = this.getIntelligentArchiveTagSuggestions(value, excludeTags, 5);

    if (suggestions.length === 0) {
      this.hideArchiveTagAutocomplete(fileUuid);
      return;
    }

    // Show autocomplete dropdown with enhanced styling
    autocompleteDiv.innerHTML = suggestions
      .map((tag, index) => `
        <div class="autocomplete-item" data-tag="${this.escapeHtml(tag)}" data-index="${index}">
          <span class="autocomplete-tag-name">${this.escapeHtml(tag)}</span>
        </div>
      `).join('');

    // Add click events to autocomplete items
    autocompleteDiv.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const tag = e.target.closest('.autocomplete-item').dataset.tag;
        this.addTagToArchiveFile(fileUuid, tag);
      });
    });

    autocompleteDiv.style.display = 'block';
  }

  hideArchiveTagAutocomplete(fileUuid) {
    const autocompleteDiv = document.getElementById(`archive-autocomplete-${fileUuid}`);
    if (autocompleteDiv) {
      autocompleteDiv.style.display = 'none';
    }
  }

  getAllExistingArchiveTags() {
    if (!this.data.archive || !this.data.archive.files) {
      return [];
    }

    const allTags = new Set();
    this.data.archive.files.forEach(file => {
      if (file.tags) {
        file.tags.forEach(tag => allTags.add(tag));
      }
    });

    return Array.from(allTags).sort();
  }

  /**
   * Get intelligently ranked archive tag suggestions
   */
  getIntelligentArchiveTagSuggestions(input, excludeTags = [], limit = 5) {
    if (!this.data.archive || !this.data.archive.files) {
      return [];
    }

    const inputLower = input.trim().toLowerCase();
    if (inputLower.length === 0) {
      return [];
    }

    // Calculate tag frequency and usage stats for archive files
    const tagStats = new Map();
    this.data.archive.files.forEach(file => {
      if (file.tags) {
        file.tags.forEach(tag => {
          if (!tagStats.has(tag)) {
            tagStats.set(tag, {
              name: tag,
              frequency: 0,
              fileCount: 0,
              lastUsed: new Date(0)
            });
          }
          const stats = tagStats.get(tag);
          stats.frequency++;
          stats.fileCount++;
          // Use file modification date as proxy for tag usage
          if (file.modified) {
            const fileDate = new Date(file.modified);
            if (fileDate > stats.lastUsed) {
              stats.lastUsed = fileDate;
            }
          }
        });
      }
    });

    // Separate prefix matches from contains matches
    const prefixMatches = [];
    const containsMatches = [];

    Array.from(tagStats.values()).forEach(tagInfo => {
      // Exclude already applied tags
      if (excludeTags.includes(tagInfo.name)) {
        return;
      }
      
      const tagLower = tagInfo.name.toLowerCase();
      
      // Must match input and not be identical
      if (tagLower === inputLower) {
        return;
      }
      
      if (tagLower.startsWith(inputLower)) {
        prefixMatches.push(tagInfo);
      } else if (tagLower.includes(inputLower)) {
        containsMatches.push(tagInfo);
      }
    });

    // Sort each group by frequency (descending), then alphabetically
    const sortByFrequency = (a, b) => {
      if (a.frequency !== b.frequency) {
        return b.frequency - a.frequency; // Higher frequency first
      }
      return a.name.localeCompare(b.name); // Alphabetical for ties
    };

    prefixMatches.sort(sortByFrequency);
    containsMatches.sort(sortByFrequency);

    // Combine: prefix matches first, then contains matches
    const allSuggestions = [...prefixMatches, ...containsMatches].slice(0, limit);

    // Debug logging in development
    if (allSuggestions.length > 0) {
      console.log(`[ArchiveTagSuggestion] Top ${allSuggestions.length} suggestions for "${input}":`, 
        allSuggestions.map((s, index) => ({
          rank: index + 1,
          tag: s.name,
          freq: s.frequency,
          type: s.name.toLowerCase().startsWith(inputLower) ? 'prefix' : 'contains'
        }))
      );
    }

    return allSuggestions.map(s => s.name);
  }

  async addTagToArchiveFile(fileUuid, tagValue) {
    if (!tagValue || tagValue.length === 0) {
      return;
    }

    try {
      // Find the file
      const file = this.data.archive.files.find(f => f.uuid === fileUuid);
      if (!file) {
        this.showError('File not found');
        return;
      }

      // Check if tag already exists on this file
      if (file.tags && file.tags.includes(tagValue)) {
        this.showError('Tag already exists on this file');
        return;
      }

      // Initialize tags array if it doesn't exist
      if (!file.tags) {
        file.tags = [];
      }

      // Add tag to the file
      file.tags.push(tagValue);

      // Save the updated archive data
      await window.electronAPI.archive.saveData(this.data.archive);
      
      // Reload archive data to reflect changes
      await this.loadArchiveData();
      
      // Clear the input and reset button state
      const input = document.querySelector(`input[data-file-uuid="${fileUuid}"].archive-tag-input`);
      if (input) {
        input.value = '';
        this.updateArchiveAddTagButtonState(input);
      }
      
      // Hide autocomplete
      this.hideArchiveTagAutocomplete(fileUuid);

      this.showSuccess('Tag added successfully');
    } catch (error) {
      console.error('Failed to add tag to archive file:', error);
      this.showError('Failed to add tag');
    }
  }

  async removeTagFromArchiveFile(fileUuid, tag) {
    try {
      // Find the file
      const file = this.data.archive.files.find(f => f.uuid === fileUuid);
      if (!file) {
        this.showError('File not found');
        return;
      }

      // Check if tag exists on this file
      if (!file.tags || !file.tags.includes(tag)) {
        this.showError('Tag does not exist on this file');
        return;
      }

      // Remove tag from the file
      file.tags = file.tags.filter(t => t !== tag);

      // Save the updated archive data
      await window.electronAPI.archive.saveData(this.data.archive);
      
      // Reload archive data to reflect changes
      await this.loadArchiveData();

      this.showSuccess('Tag removed successfully');
    } catch (error) {
      console.error('Failed to remove tag from archive file:', error);
      this.showError('Failed to remove tag');
    }
  }

  updateArchiveAddTagButtonState(input) {
    const fileUuid = input.dataset.fileUuid;
    const button = document.querySelector(`button[data-file-uuid="${fileUuid}"].archive-add-tag-btn`);
    const hasText = input.value.trim().length > 0;
    
    if (button) {
      button.disabled = !hasText;
    }
  }

  setupArchiveHashToggleEvents() {
    const toggleButtons = document.querySelectorAll('.archive-hash-toggle');
    const toggleHeaders = document.querySelectorAll('.archive-hash-header');

    // Add click events to toggle buttons
    toggleButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleArchiveHashList(button.dataset.fileUuid);
      });
    });

    // Add click events to headers (for convenience)
    toggleHeaders.forEach(header => {
      header.addEventListener('click', (e) => {
        // Only toggle if clicking on the header itself, not the button
        if (!e.target.closest('.archive-hash-toggle')) {
          this.toggleArchiveHashList(header.dataset.fileUuid);
        }
      });
    });
  }

  toggleArchiveHashList(fileUuid) {
    const hashList = document.querySelector(`.archive-hash-list[data-file-uuid="${fileUuid}"]`);
    const toggleButton = document.querySelector(`.archive-hash-toggle[data-file-uuid="${fileUuid}"]`);
    
    if (!hashList || !toggleButton) return;

    const isCollapsed = hashList.classList.contains('collapsed');
    
    if (isCollapsed) {
      // Expand
      hashList.classList.remove('collapsed');
      toggleButton.classList.add('expanded');
    } else {
      // Collapse
      hashList.classList.add('collapsed');
      toggleButton.classList.remove('expanded');
    }
  }

  async removeTagFromResource(resourceId, tag) {
    try {
      // Find the resource
      const resource = this.data.collate.resources.find(r => r.id === resourceId);
      if (!resource) {
        this.showError('Resource not found');
        return;
      }

      // Check if tag exists on this resource
      if (!resource.tags.includes(tag)) {
        this.showError('Tag does not exist on this resource');
        return;
      }

      // Remove tag via IPC
      await window.electronAPI.collate.removeTagFromResource(resourceId, tag);
      
      // Reload data to reflect changes
      await this.loadCollateData();

      this.showSuccess('Tag removed successfully');
    } catch (error) {
      console.error('Failed to remove tag:', error);
      this.showError('Failed to remove tag');
    }
  }

  openEditTagModal(tag) {
    console.log('Opening edit modal for tag:', tag);
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Edit Tag</h3>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-content">
          <p>Rename the tag "<strong>${this.escapeHtml(tag)}</strong>" across all resources:</p>
          <div class="form-group">
            <label for="edit-tag-input">New tag name:</label>
            <input type="text" id="edit-tag-input" value="${tag}" placeholder="Enter new tag name">
          </div>
          <div class="form-actions">
            <button class="secondary-btn cancel-btn">Cancel</button>
            <button class="primary-btn rename-btn">Rename Tag</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    
    // Add the active class to make it visible
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);
    
    // Set up event listeners
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const renameBtn = modal.querySelector('.rename-btn');
    const input = modal.querySelector('#edit-tag-input');

    // Close handlers
    const closeModal = () => {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 200); // Wait for transition
    };
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    // Rename handler
    renameBtn.addEventListener('click', () => {
      this.handleRenameTag(tag, input.value);
    });

    // Focus and select the input
    input.focus();
    input.select();

    // Handle Enter key
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleRenameTag(tag, input.value);
      } else if (e.key === 'Escape') {
        closeModal();
      }
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  async handleRenameTag(oldTag, newTag) {
    console.log('handleRenameTag called with:', { oldTag, newTag });
    
    try {
      // Close the modal
      const modal = document.querySelector('.modal-overlay');
      if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 200);
      }

      // Validate input
      const trimmedNewTag = newTag.trim();
      console.log('Trimmed new tag:', trimmedNewTag);
      
      if (!trimmedNewTag) {
        this.showError('New tag name cannot be empty');
        return;
      }

      if (trimmedNewTag === oldTag) {
        this.showError('New tag name must be different from the current name');
        return;
      }

      console.log('Calling IPC rename tag:', { oldTag, newTag: trimmedNewTag });

      // Rename tag via IPC
      await window.electronAPI.collate.renameTag(oldTag, trimmedNewTag);
      
      console.log('Tag rename completed, reloading data...');
      
      // Reload data to reflect changes
      await this.loadCollateData();

      this.showSuccess(`Tag renamed from "${oldTag}" to "${trimmedNewTag}"`);
    } catch (error) {
      console.error('Failed to rename tag:', error);
      this.showError('Failed to rename tag: ' + error.message);
    }
  }

  // Legacy method kept for compatibility but now unused
  toggleTagDropdown(tag) {
    // This method is deprecated - right-click context menu is now used instead
    console.warn('toggleTagDropdown is deprecated, use right-click context menu instead');
  }

  hideAllDropdowns() {
    // This method now only handles the context menu hiding
    this.hideTagContextMenu();
  }

  showTagContextMenu(tag, x, y) {
    // Hide any existing context menus first
    this.hideTagContextMenu();
    this.hideAllResourceActionsDropdowns();
    
    const menu = document.querySelector(`.tag-dropdown-menu[data-tag="${tag}"]`);
    if (!menu) return;

    // Position the menu at cursor position
    menu.style.position = 'fixed';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = 'block';
    menu.style.zIndex = '2000';

    // Adjust position if menu would go off screen
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (rect.right > viewportWidth) {
      menu.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > viewportHeight) {
      menu.style.top = `${y - rect.height}px`;
    }

    // Add document click listener to close menu
    setTimeout(() => {
      document.addEventListener('click', this.handleTagContextMenuClick.bind(this), { once: true });
    }, 10);
  }

  hideTagContextMenu() {
    const menus = document.querySelectorAll('.tag-dropdown-menu');
    menus.forEach(menu => {
      menu.style.display = 'none';
      menu.style.position = '';
      menu.style.left = '';
      menu.style.top = '';
      menu.style.zIndex = '';
    });
  }

  handleTagContextMenuClick(e) {
    // Don't close if clicking on the menu itself
    if (!e.target.closest('.tag-dropdown-menu')) {
      this.hideTagContextMenu();
    }
  }

  handleDocumentClick(e) {
    // Close all dropdowns if clicking outside
    if (!e.target.closest('.resource-actions-dropdown')) {
      this.hideAllResourceActionsDropdowns();
    }
    if (!e.target.closest('.tag-dropdown-menu')) {
      this.hideTagContextMenu();
    }
  }

  toggleResourceActionsDropdown(resourceId) {
    const dropdown = document.querySelector(`.resource-actions-menu[data-resource-id="${resourceId}"]`);
    if (!dropdown) return;

    // Hide all other dropdowns first
    this.hideAllResourceActionsDropdowns();
    
    // Toggle this dropdown
    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';
    
    // Add click outside listener to close dropdown
    if (!isVisible) {
      setTimeout(() => {
        document.addEventListener('click', this.handleDocumentClick.bind(this), { once: true });
      }, 10);
    }
  }

  hideAllResourceActionsDropdowns() {
    const dropdowns = document.querySelectorAll('.resource-actions-menu');
    dropdowns.forEach(dropdown => {
      dropdown.style.display = 'none';
    });
  }

  confirmDeleteTag(tag) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Remove Tag</h3>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-content">
          <p>Are you sure you want to remove the tag "<strong>${this.escapeHtml(tag)}</strong>" from all resources?</p>
          <p><small>This action cannot be undone.</small></p>
          <div class="form-actions">
            <button class="secondary-btn cancel-btn">Cancel</button>
            <button class="primary-btn delete-btn" style="background-color: var(--error-color);">Remove Tag</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    
    // Add the active class to make it visible
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);

    // Set up event listeners
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const deleteBtn = modal.querySelector('.delete-btn');

    // Close handlers
    const closeModal = () => {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 200);
    };
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    // Delete handler
    deleteBtn.addEventListener('click', () => {
      this.handleDeleteTag(tag);
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  async handleDeleteTag(tag) {
    console.log('handleDeleteTag called with tag:', tag);
    
    try {
      // Close the modal
      const modal = document.querySelector('.modal-overlay');
      if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 200);
      }

      console.log('Calling IPC delete tag:', tag);

      // Delete tag via IPC
      await window.electronAPI.collate.deleteTag(tag);
      
      console.log('Tag delete completed, reloading data...');
      
      // Reload data to reflect changes
      await this.loadCollateData();

      this.showSuccess(`Tag "${tag}" removed from all resources`);
    } catch (error) {
      console.error('Failed to delete tag:', error);
      this.showError('Failed to delete tag: ' + error.message);
    }
  }

  async openEditResourceModal(resourceId) {
    try {
      // Find the resource data
      const resource = this.data.collate.resources.find(r => r.id === resourceId);
      if (!resource) {
        this.showError('Resource not found');
        return;
      }

      // Open the modal and wait for it to be ready, default to single tab
      await this.openAddResourcesModal('single');

      // Hide the subheader for edit mode
      const subheader = document.querySelector('#add-resources-modal .modal-subheader');
      if (subheader) {
        subheader.style.display = 'none';
      }

      // Now populate the form with existing data
      document.getElementById('resource-url').value = resource.url;
      document.getElementById('resource-title').value = resource.title;
      document.getElementById('resource-description').value = resource.description || '';
      
      // Populate modal tags with existing resource tags
      this.modalTags = [...(resource.tags || [])];
      this.renderModalTags();

      // Store the resource ID for editing
      this.editingResourceId = resourceId;

      // Change modal title and button text
      document.querySelector('#add-resources-modal .modal-header h3').textContent = 'Edit Resource';
      document.querySelector('#add-resource-form button[type="submit"]').textContent = 'Update Resource';
    } catch (error) {
      console.error('Failed to open edit modal:', error);
      this.showError('Failed to open edit dialog');
    }
  }

  async openEditArchiveItemModal(fileUuid) {
    const file = this.data.archive.files.find(f => f.uuid === fileUuid);
    if (!file) {
      this.showError('Archive file not found');
      return;
    }

    // Populate read-only file information fields
    document.getElementById('edit-archive-uuid').value = file.uuid;
    document.getElementById('edit-archive-filepath').value = file.filePath;
    document.getElementById('edit-archive-filesize').value = this.formatFileSize(file.fileSize);
    document.getElementById('edit-archive-mimetype-display').value = file.mimeType;
    document.getElementById('edit-archive-created').value = new Date(file.created).toLocaleString();
    document.getElementById('edit-archive-modified').value = new Date(file.modified).toLocaleString();

    // Populate editable metadata fields
    document.getElementById('edit-archive-title').value = file.title || '';
    document.getElementById('edit-archive-author').value = file.metadata.author || '';
    
    // Check if file is virtual and show/hide MIME type field
    const isVirtual = file.filePath.startsWith('[VIRTUAL]');
    const mimeTypeGroup = document.querySelector('#edit-archive-item-modal .virtual-only');
    if (isVirtual) {
      mimeTypeGroup.style.display = 'block';
      document.getElementById('edit-archive-mimetype').value = file.mimeType || '';
    } else {
      mimeTypeGroup.style.display = 'none';
    }

    // Handle Arweave uploads section
    const arweaveSection = document.getElementById('edit-archive-arweave-section');
    const arweaveList = document.getElementById('edit-archive-arweave-list');
    
    if (file.arweave_hashes && file.arweave_hashes.length > 0) {
      arweaveSection.style.display = 'block';
      arweaveList.innerHTML = file.arweave_hashes.map(upload => `
        <div class="arweave-upload-item">
          <a href="${upload.link}" target="_blank" class="arweave-upload-link">
            ${upload.hash}
          </a>
          <span class="arweave-upload-timestamp">
            ${new Date(upload.timestamp).toLocaleString()}
          </span>
        </div>
      `).join('');
    } else {
      arweaveSection.style.display = 'none';
    }

    // Store the file UUID for the update
    document.getElementById('edit-archive-item-form').dataset.fileUuid = fileUuid;

    // Clear and populate tags
    this.editArchiveItemTags = [...(file.tags || [])];
    this.renderEditArchiveItemTags();

    // Setup tag input events for this modal
    this.setupEditArchiveItemTagEvents();

    // Show the modal
    this.openModal('edit-archive-item-modal');
  }

  confirmRemoveResource(resourceId) {
    // Find the resource for confirmation message
    const resource = this.data.collate.resources.find(r => r.id === resourceId);
    if (!resource) {
      this.showError('Resource not found');
      return;
    }

    // Show confirmation dialog
    const confirmed = confirm(
      `Are you sure you want to remove this resource?\n\n"${resource.title}"\n\nThis action cannot be undone.`
    );

    if (confirmed) {
      this.removeResource(resourceId);
    }
  }

  async removeResource(resourceId) {
    try {
      await window.electronAPI.collate.removeResource(resourceId);
      await this.loadCollateData();
      this.showSuccess('Resource removed successfully');
    } catch (error) {
      console.error('Failed to remove resource:', error);
      this.showError('Failed to remove resource');
    }
  }

  async handleEditArchiveItem() {
    try {
      const form = document.getElementById('edit-archive-item-form');
      const fileUuid = form.dataset.fileUuid;
      
      if (!fileUuid) {
        this.showError('No file selected for editing');
        return;
      }

      // Collect form data
      const title = document.getElementById('edit-archive-title').value.trim();
      const author = document.getElementById('edit-archive-author').value.trim();
      const mimeType = document.getElementById('edit-archive-mimetype').value.trim();
      
      if (!title) {
        this.showError('Title is required');
        return;
      }

      // Prepare updates object
      const updates = {
        title,
        tags: this.editArchiveItemTags || [],
        author: author || undefined,
      };

      // Add MIME type for virtual files only
      const file = this.data.archive.files.find(f => f.uuid === fileUuid);
      if (file && file.filePath.startsWith('[VIRTUAL]') && mimeType) {
        updates.mimeType = mimeType;
      }

      // Update the file metadata
      await window.electronAPI.archive.updateFileMetadata(fileUuid, updates);
      
      // Reload archive data to refresh the display
      await this.loadArchiveData();
      
      // Close modal and show success message
      this.closeModal();
      this.showSuccess('Archive item updated successfully');
      
    } catch (error) {
      console.error('Failed to update archive item:', error);
      this.showError('Failed to update archive item: ' + error.message);
    }
  }

  // Bulk Add functionality
  setupBulkAddEvents() {
    // Extract URLs button
    document.getElementById('extract-urls-btn').addEventListener('click', () => {
      this.extractUrlsFromText();
    });

    // Back to paste button
    document.getElementById('back-to-paste-btn').addEventListener('click', () => {
      this.showBulkStep('paste');
    });

    // Proceed to tagging button
    document.getElementById('proceed-to-tagging-btn').addEventListener('click', () => {
      this.proceedToBulkTagging();
    });

    // Back to review button
    document.getElementById('back-to-review-btn').addEventListener('click', () => {
      this.showBulkStep('review');
    });

    // Process URLs button
    document.getElementById('process-urls-btn').addEventListener('click', async () => {
      await this.processSelectedUrls();
    });

    // Setup bulk tag input functionality
    this.setupBulkTagEvents();
  }

  openAddResourcesModal(defaultTab = 'single') {
    this.resetAddResourcesModal();
    this.openModal('add-resources-modal');
    this.switchModalTab(defaultTab);
  }

  resetAddResourcesModal() {
    // Reset single resource form
    document.getElementById('add-resource-form').reset();
    this.editingResourceId = null;
    document.querySelector('#add-resources-modal .modal-header h3').textContent = 'Add Resources';
    document.querySelector('#add-resource-form button[type="submit"]').textContent = 'Add Resource';
    
    // Show subheader with tabs (in case it was hidden for edit mode)
    const subheader = document.querySelector('#add-resources-modal .modal-subheader');
    if (subheader) {
      subheader.style.display = 'block';
    }
    
    // Clear modal tags
    if (this.modalTags) {
      this.modalTags = [];
      this.renderModalTags();
    }
    
    // Reset add tag button state
    const input = document.getElementById('modal-tag-input');
    if (input) {
      this.updateModalAddTagButtonState(input);
    }
    
    // Reset bulk add
    this.showBulkStep('paste');
    document.getElementById('bulk-text-input').value = '';
    document.getElementById('url-review-list').innerHTML = '';
    document.getElementById('processing-log').innerHTML = '';
    document.getElementById('results-summary').innerHTML = '';
    document.getElementById('bulk-progress-fill').style.width = '0%';
    document.getElementById('bulk-progress-text').textContent = '0 / 0 processed';
    this.bulkUrls = [];
    
    // Reset bulk tags
    if (this.bulkTags) {
      this.bulkTags = [];
      this.renderBulkTags();
    }
    
    // Reset bulk tag input
    const bulkTagInput = document.getElementById('bulk-tag-input');
    if (bulkTagInput) {
      bulkTagInput.value = '';
      this.updateBulkAddTagButtonState(bulkTagInput);
    }
    
    // Reset phase cards to initial state
    this.updateBulkPhaseCards('paste');
    
    // Reset to single tab
    this.switchModalTab('single');
  }

  switchModalTab(tabName) {
    // Remove active class from all tabs and panels
    document.querySelectorAll('.modal-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.modal-tab-panel').forEach(panel => panel.classList.remove('active'));
    
    // Activate the selected tab and panel
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
  }

  showBulkStep(stepName) {
    // Hide all steps
    document.querySelectorAll('.bulk-step').forEach(step => {
      step.classList.remove('active');
    });
    
    // Show target step
    document.getElementById(`bulk-step-${stepName}`).classList.add('active');
    
    // Update phase cards
    this.updateBulkPhaseCards(stepName);
  }

  updateBulkPhaseCards(currentPhase) {
    const phaseCards = document.querySelectorAll('#bulk-phase-cards .modal-tab-phase-card');
    const phases = ['paste', 'review', 'bulk-tags', 'processing', 'results'];
    const currentIndex = phases.indexOf(currentPhase);
    
    phaseCards.forEach((card, index) => {
      card.classList.remove('active', 'completed');
      
      if (index < currentIndex) {
        card.classList.add('completed');
      } else if (index === currentIndex) {
        card.classList.add('active');
      }
    });
  }

  extractUrlsFromText() {
    const text = document.getElementById('bulk-text-input').value.trim();
    
    if (!text) {
      this.showError('Please paste some text containing URLs');
      return;
    }

    // URL detection regex - based on research, using a safe performance regex
    const urlRegex = /https?:\/\/[^\s()<>]+|www\.[^\s()<>]+\.[a-z]{2,}/gi;
    
    const matches = text.match(urlRegex) || [];
    
    if (matches.length === 0) {
      this.showError('No URLs found in the text');
      return;
    }

    // Normalize URLs (add http:// to www. URLs)
    const normalizedUrls = matches.map(url => {
      if (url.startsWith('www.')) {
        return 'http://' + url;
      }
      return url;
    });

    // Remove duplicates and check against existing resources
    const uniqueUrls = [...new Set(normalizedUrls)];
    
    this.bulkUrls = uniqueUrls.map(url => ({
      url,
      selected: true,
      isDuplicate: this.isUrlDuplicate(url)
    }));

    this.renderUrlReview();
    this.showBulkStep('review');
  }

  isUrlDuplicate(url) {
    if (!this.data.collate || !this.data.collate.resources) {
      return false;
    }
    return this.data.collate.resources.some(resource => resource.url === url);
  }

  renderUrlReview() {
    const container = document.getElementById('url-review-list');
    
    if (this.bulkUrls.length === 0) {
      container.innerHTML = '<div class="loading-state">No URLs to review</div>';
      return;
    }

    container.innerHTML = this.bulkUrls.map((urlData, index) => `
      <div class="url-review-item ${urlData.isDuplicate ? 'duplicate' : ''}">
        <input 
          type="checkbox" 
          id="url-${index}"
          ${urlData.selected && !urlData.isDuplicate ? 'checked' : ''}
          ${urlData.isDuplicate ? 'disabled' : ''}
        />
        <label for="url-${index}" class="url-review-text">${this.escapeHtml(urlData.url)}</label>
      </div>
    `).join('');

    // Add event listeners to checkboxes
    container.querySelectorAll('input[type="checkbox"]').forEach((checkbox, index) => {
      checkbox.addEventListener('change', () => {
        this.bulkUrls[index].selected = checkbox.checked;
      });
    });

    // Update the process button text
    const selectedCount = this.bulkUrls.filter(u => u.selected && !u.isDuplicate).length;
    const duplicateCount = this.bulkUrls.filter(u => u.isDuplicate).length;
    
    document.getElementById('process-urls-btn').textContent = 
      `Process ${selectedCount} Selected URLs`;
    
    if (duplicateCount > 0) {
      const container = document.getElementById('url-review-list');
      const notice = document.createElement('div');
      notice.className = 'form-group';
      notice.innerHTML = `
        <p style="color: var(--text-secondary); font-size: var(--font-size-sm); margin-top: var(--spacing-md);">
          <em>${duplicateCount} duplicate URL${duplicateCount > 1 ? 's' : ''} found and disabled.</em>
        </p>
      `;
      container.appendChild(notice);
    }
  }

  async processSelectedUrls() {
    const selectedUrls = this.bulkUrls.filter(u => u.selected && !u.isDuplicate);
    
    if (selectedUrls.length === 0) {
      this.showError('Please select at least one URL to process');
      return;
    }

    this.showBulkStep('processing');
    
    const progressFill = document.getElementById('bulk-progress-fill');
    const progressText = document.getElementById('bulk-progress-text');
    const processingLog = document.getElementById('processing-log');
    
    let processed = 0;
    let successful = 0;
    let failed = 0;
    const results = [];

    for (const urlData of selectedUrls) {
      try {
        this.addLogEntry(`Processing: ${urlData.url}`, 'info');
        
        // Extract metadata
        const metadata = await window.electronAPI.collate.extractMetadata(urlData.url);
        
        // Create resource data
        const resourceData = {
          url: urlData.url,
          title: metadata.title || urlData.url,
          description: metadata.description || '',
          tags: [...(this.bulkTags || [])], // Apply bulk tags
        };

        // Add the resource
        await window.electronAPI.collate.addResource(resourceData);
        
        successful++;
        results.push({ url: urlData.url, success: true, title: resourceData.title });
        this.addLogEntry(`✓ Added: ${resourceData.title}`, 'success');
        
      } catch (error) {
        failed++;
        results.push({ url: urlData.url, success: false, error: error.message });
        this.addLogEntry(`✗ Failed: ${urlData.url} - ${error.message}`, 'error');
      }
      
      processed++;
      
      // Update progress
      const percentage = (processed / selectedUrls.length) * 100;
      progressFill.style.width = `${percentage}%`;
      progressText.textContent = `${processed} / ${selectedUrls.length} processed`;
      
      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Show results
    setTimeout(() => {
      this.showBulkResults(results, successful, failed);
      this.loadCollateData(); // Refresh the collate view
    }, 500);
  }

  proceedToBulkTagging() {
    const selectedCount = this.bulkUrls.filter(u => u.selected && !u.isDuplicate).length;
    
    if (selectedCount === 0) {
      this.showError('Please select at least one URL to proceed');
      return;
    }

    // Initialize bulk tags if not already initialized
    if (!this.bulkTags) {
      this.bulkTags = [];
    }

    this.showBulkStep('bulk-tags');
  }

  setupBulkTagEvents() {
    // Initialize bulk tags array
    this.bulkTags = [];

    // Setup bulk tag input functionality
    const bulkTagInput = document.getElementById('bulk-tag-input');
    const bulkAddTagBtn = document.getElementById('bulk-add-tag-btn');
    
    if (bulkTagInput && bulkAddTagBtn) {
      // Input events
      bulkTagInput.addEventListener('input', (e) => {
        this.updateBulkAddTagButtonState(e.target);
        this.showBulkTagAutocomplete(e.target);
      });

      bulkTagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.addBulkTag(bulkTagInput.value.trim());
        } else if (e.key === 'Escape') {
          this.hideBulkTagAutocomplete();
        }
      });

      bulkTagInput.addEventListener('blur', () => {
        // Delay hiding to allow for click on autocomplete
        setTimeout(() => this.hideBulkTagAutocomplete(), 150);
      });

      // Button click
      bulkAddTagBtn.addEventListener('click', () => {
        this.addBulkTag(bulkTagInput.value.trim());
      });
    }
  }

  showBulkTagAutocomplete(input) {
    const value = input.value.trim().toLowerCase();
    if (value.length < 1) {
      this.hideBulkTagAutocomplete();
      return;
    }

    const existingTags = this.getAllExistingTags();
    const suggestions = this.getIntelligentTagSuggestions(value, this.bulkTags, 8);
    
    if (suggestions.length === 0) {
      this.hideBulkTagAutocomplete();
      return;
    }

    const autocompleteEl = document.getElementById('bulk-tag-autocomplete');
    autocompleteEl.innerHTML = suggestions.map(tag => `
      <div class="autocomplete-item" data-tag="${this.escapeHtml(tag)}">
        ${this.escapeHtml(tag)}
      </div>
    `).join('');

    // Add click handlers
    autocompleteEl.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        this.addBulkTag(item.dataset.tag);
      });
    });

    autocompleteEl.style.display = 'block';
  }

  hideBulkTagAutocomplete() {
    const autocompleteEl = document.getElementById('bulk-tag-autocomplete');
    if (autocompleteEl) {
      autocompleteEl.style.display = 'none';
    }
  }

  updateBulkAddTagButtonState(input) {
    const bulkAddTagBtn = document.getElementById('bulk-add-tag-btn');
    if (bulkAddTagBtn) {
      const hasValue = input.value.trim().length > 0;
      bulkAddTagBtn.disabled = !hasValue;
    }
  }

  addBulkTag(tagValue) {
    if (!tagValue || this.bulkTags.includes(tagValue)) {
      return;
    }

    this.bulkTags.push(tagValue);
    this.renderBulkTags();
    
    // Clear input
    const bulkTagInput = document.getElementById('bulk-tag-input');
    if (bulkTagInput) {
      bulkTagInput.value = '';
      this.updateBulkAddTagButtonState(bulkTagInput);
    }
    
    this.hideBulkTagAutocomplete();
  }

  removeBulkTag(tagValue) {
    this.bulkTags = this.bulkTags.filter(tag => tag !== tagValue);
    this.renderBulkTags();
  }

  renderBulkTags() {
    const container = document.getElementById('bulk-tags-list');
    if (!container) return;

    if (this.bulkTags.length === 0) {
      container.innerHTML = '<div class="no-tags">No tags added yet</div>';
      return;
    }

    container.innerHTML = this.bulkTags.map(tag => `
      <span class="resource-tag">
        ${this.escapeHtml(tag)}
        <button class="remove-tag-btn" onclick="app.removeBulkTag('${this.escapeHtml(tag)}')" title="Remove tag">
          ×
        </button>
      </span>
    `).join('');
  }

  addLogEntry(message, type = 'info') {
    const log = document.getElementById('processing-log');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  showBulkResults(results, successful, failed) {
    const summary = document.getElementById('results-summary');
    
    summary.innerHTML = `
      <div class="result-stat">
        <span class="result-label">Total URLs processed:</span>
        <span class="result-value">${results.length}</span>
      </div>
      <div class="result-stat">
        <span class="result-label">Successfully added:</span>
        <span class="result-value" style="color: var(--success-color)">${successful}</span>
      </div>
      <div class="result-stat">
        <span class="result-label">Failed:</span>
        <span class="result-value" style="color: var(--error-color)">${failed}</span>
      </div>
    `;

    this.showBulkStep('results');
    
    if (successful > 0) {
      this.showSuccess(`Successfully added ${successful} resource${successful > 1 ? 's' : ''}`);
    }
  }

  // Export functionality
  setupExportEvents() {
    const exportBtn = document.getElementById('export-btn');
    const exportOptions = document.querySelectorAll('.export-option-btn');

    // Show export modal
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openExportModal();
    });

    // Handle export format selection
    exportOptions.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const format = e.currentTarget.dataset.format;
        await this.handleExport(format);
        this.closeModal();
      });
    });
  }

  openExportModal() {
    const filteredResources = this.getFilteredResources();
    const hasResources = filteredResources.length > 0;

    if (!hasResources) {
      this.showError('No resources to export with current filters');
      return;
    }

    // Update modal content
    this.updateExportModalContent(filteredResources);
    
    // Show modal
    this.openModal('export-modal');
  }

  updateExportModalContent(filteredResources) {
    const resourceCountEl = document.getElementById('export-resource-count');
    const filterInfoEl = document.getElementById('export-filter-info');
    const exportOptions = document.querySelectorAll('.export-option-btn');

    // Update resource count
    const count = filteredResources.length;
    resourceCountEl.textContent = `Ready to export ${count} resource${count !== 1 ? 's' : ''}`;

    // Update filter information
    const filterParts = [];
    if (this.currentSearchTerm.trim()) {
      filterParts.push(`Search: "${this.currentSearchTerm.trim()}"`);
    }
    if (this.activeTagFilters.size > 0) {
      const tags = Array.from(this.activeTagFilters).join(', ');
      filterParts.push(`Tags: ${tags}`);
    }

    if (filterParts.length > 0) {
      filterInfoEl.textContent = `Applied filters: ${filterParts.join(' | ')}`;
      filterInfoEl.style.display = 'block';
    } else {
      filterInfoEl.textContent = 'All resources (no filters applied)';
      filterInfoEl.style.display = 'block';
    }

    // Enable all export options
    exportOptions.forEach(btn => {
      btn.disabled = false;
    });
  }

  getFilteredResources() {
    if (!this.data.collate) return [];
    
    return this.data.collate.resources.filter(resource => {
      // Apply same filtering logic as applyAllFilters()
      let matchesSearch = true;
      if (this.currentSearchTerm.trim()) {
        const term = this.currentSearchTerm.toLowerCase();
        const title = resource.title.toLowerCase();
        const description = (resource.description || '').toLowerCase();
        const url = resource.url.toLowerCase();
        
        matchesSearch = title.includes(term) || description.includes(term) || url.includes(term);
      }

      let matchesTags = true;
      if (this.activeTagFilters.size > 0) {
        if (this.filterLogic === 'all') {
          // ALL logic: Resource must have ALL of the selected tags
          matchesTags = Array.from(this.activeTagFilters).every(tag => 
            resource.tags.includes(tag)
          );
        } else {
          // ANY logic (default): Resource must have at least one of the selected tags
          matchesTags = Array.from(this.activeTagFilters).some(tag => 
            resource.tags.includes(tag)
          );
        }
      }

      return matchesSearch && matchesTags;
    });
  }

  async handleExport(format) {
    try {
      const filteredResources = this.getFilteredResources();
      
      if (filteredResources.length === 0) {
        this.showError('No resources to export with current filters');
        return;
      }

      // Generate export data
      const exportData = this.generateExportData(filteredResources, format);
      
      // Generate suggested filename
      const filename = this.generateExportFilename(format);
      
      // Show progress
      this.updateFooterStatus('Exporting...', false);
      
      // Call backend export
      const result = await window.electronAPI.collate.exportResources(format, exportData, filename);
      
      if (result.success) {
        const formatNames = {
          json: 'JSON',
          text: 'text file',
          bookmarks: 'bookmarks file'
        };
        const formatName = formatNames[format] || format;
        this.showSuccess(`Successfully exported ${filteredResources.length} resources as ${formatName}`);
        this.updateFooterStatus('Export completed', false);
      } else {
        if (result.error === 'Export cancelled by user') {
          this.updateFooterStatus('Export cancelled', false);
        } else {
          this.showError(`Export failed: ${result.error || 'Unknown error'}`);
          this.updateFooterStatus('Export failed', true);
        }
      }
      
    } catch (error) {
      console.error('Export error:', error);
      this.showError('Failed to export resources');
      this.updateFooterStatus('Export failed', true);
    }
  }

  generateExportData(resources, format) {
    const baseData = {
      resources: resources,
      exportedAt: new Date().toISOString(),
      filters: {
        searchTerm: this.currentSearchTerm,
        activeTags: Array.from(this.activeTagFilters)
      },
      count: resources.length,
      exportFormat: format
    };

    switch (format) {
      case 'json':
        return baseData;
      case 'text':
        return {
          ...baseData,
          urls: resources.map(r => r.url)
        };
      case 'bookmarks':
        return baseData;
      default:
        return baseData;
    }
  }

  generateExportFilename(format) {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
          let baseFilename = `meridian-resources-${timestamp}`;
    
    // Add filter information to filename
    const filterParts = [];
    
    if (this.currentSearchTerm.trim()) {
      const searchSlug = this.currentSearchTerm.trim().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      filterParts.push(`search-${searchSlug}`);
    }
    
    if (this.activeTagFilters.size > 0) {
      const tagSlug = Array.from(this.activeTagFilters).join('-').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
      filterParts.push(`tags-${tagSlug}`);
    }
    
    if (filterParts.length > 0) {
      baseFilename += `-${filterParts.join('-')}`;
    }
    
    // Add appropriate extension
    switch (format) {
      case 'json':
        return `${baseFilename}.json`;
      case 'text':
        return `${baseFilename}.txt`;
      case 'bookmarks':
        return `${baseFilename}.html`;
      default:
        return `${baseFilename}.txt`;
    }
  }

  // Archive Tool
  async loadArchiveData() {
    console.log('[Archive] Loading archive data...');
    
    try {
      // Check if workspace is connected
      console.log('[Archive] Checking workspace...');
      const workspacePath = await window.electronAPI.getWorkspace();
      console.log('[Archive] Workspace path:', workspacePath);
      
      if (!workspacePath) {
        console.log('[Archive] No workspace, rendering no workspace state');
        this.renderArchiveNoWorkspace();
        return;
      }

      console.log('[Archive] Loading archive data from backend...');
      this.data.archive = await window.electronAPI.archive.loadData();
      console.log('[Archive] Archive data loaded:', this.data.archive);
      
      console.log('[Archive] Rendering archive files...');
      this.renderArchiveFiles();
      
      console.log('[Archive] Rendering archive tag filters...');
      this.renderArchiveTagFilters();
      
      console.log('[Archive] Updating wallet display...');
      await this.updateWalletDisplay();
      
      console.log('[Archive] Archive data loading complete');
    } catch (error) {
      console.error('[Archive] Failed to load archive data:', error);
      console.error('[Archive] Error stack:', error.stack);
      
      // Show error in UI
      const container = document.getElementById('archive-list');
      container.innerHTML = `<div class="loading-state error">Failed to load archive: ${error.message}</div>`;
    }
  }

  renderArchiveNoWorkspace() {
    const archiveContainer = document.getElementById('archive-list');
    archiveContainer.innerHTML = `
      <div class="workspace-required">
        <h3>Workspace Required</h3>
        <p>The Archive tool requires a connected workspace to store credentials and manage uploads.</p>
        <p>Please select a workspace to continue.</p>
        <button onclick="app.selectWorkspace()" class="primary-btn">Select Workspace</button>
      </div>
    `;

    // Hide wallet display
    const walletAddressEl = document.getElementById('wallet-address');
    const balanceValue = document.querySelector('.balance-value');
    walletAddressEl.textContent = 'Workspace required';
    walletAddressEl.className = 'wallet-value';
    balanceValue.textContent = '--';
  }

  renderArchiveFiles() {
    const container = document.getElementById('archive-list');
    
    if (!this.data.archive || !this.data.archive.files) {
      container.innerHTML = '<div class="loading-state">No archive files found</div>';
      return;
    }

    if (this.data.archive.files.length === 0) {
      container.innerHTML = '<div class="loading-state">No files in archive yet. Upload your first file!</div>';
      return;
    }

    container.innerHTML = this.data.archive.files.map(file => `
      <div class="archive-item" data-uuid="${file.uuid}">
        <div class="archive-header">
          <div class="archive-info">
            <h4 class="archive-title">${this.escapeHtml(file.title)}</h4>
            <div class="archive-path-container">
              <span class="archive-path ${this.getFilePathStatus(file.filePath)}">${this.escapeHtml(file.filePath)}</span>
              ${this.getFileStatusIndicator(file.filePath)}
            </div>
          </div>
          <div class="archive-actions">
            ${this.needsRelocation(file.filePath) ? `
              <button class="archive-locate-btn" data-file-uuid="${file.uuid}" title="Locate file in workspace">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"></path>
                </svg>
                Locate
              </button>
            ` : ''}
            <div class="archive-actions-dropdown">
              <button class="archive-collapse-btn" data-file-uuid="${file.uuid}" title="Toggle details">
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button class="archive-actions-btn" data-file-uuid="${file.uuid}" title="File options">⋮</button>
              <div class="archive-actions-menu" data-file-uuid="${file.uuid}">
                <button class="archive-actions-item edit-option" data-file-uuid="${file.uuid}">Edit</button>
                <button class="archive-actions-item upload-option" data-file-uuid="${file.uuid}">Upload to Arweave</button>
                <button class="archive-actions-item locate-option" data-file-uuid="${file.uuid}">Locate File...</button>
                <button class="archive-actions-item refresh-option" data-file-uuid="${file.uuid}">Refresh Metadata</button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="archive-metadata">
          <div class="archive-metadata-item">
            <span class="archive-metadata-label">Size:</span>
            <span class="archive-metadata-value">${this.formatFileSize(file.fileSize)}</span>
          </div>
          <div class="archive-metadata-item">
            <span class="archive-metadata-label">Type:</span>
            <span class="archive-metadata-value">${file.mimeType}</span>
          </div>
          <div class="archive-metadata-item">
            <span class="archive-metadata-label">Modified:</span>
            <span class="archive-metadata-value">${new Date(file.modified).toLocaleDateString()}</span>
          </div>
          ${file.metadata.author ? `
            <div class="archive-metadata-item">
              <span class="archive-metadata-label">Author:</span>
              <span class="archive-metadata-value">${this.escapeHtml(file.metadata.author)}</span>
            </div>
          ` : ''}
        </div>

        ${file.arweave_hashes && file.arweave_hashes.length > 0 ? `
          <div class="archive-arweave-hashes">
            <div class="archive-hash-header" data-file-uuid="${file.uuid}">
              <span class="archive-hash-count">Arweave Uploads (${file.arweave_hashes.length})</span>
              <button class="archive-hash-toggle" data-file-uuid="${file.uuid}" title="Toggle upload history">
                <svg class="archive-hash-toggle-icon" width="12" height="12" viewBox="0 0 12 12">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="archive-hash-list collapsed" data-file-uuid="${file.uuid}">
              ${file.arweave_hashes.map(hash => `
                <div class="archive-hash-item">
                  <a href="${hash.link}" class="archive-hash-link" target="_blank" title="View on Arweave">
                    ${hash.hash}
                  </a>
                  <span class="archive-hash-timestamp"> - ${new Date(hash.timestamp).toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit', 
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                    timeZoneName: 'short'
                  })}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="archive-tags">
          <div class="resource-tag-input">
            <div class="tag-input-container">
              <input
                type="text"
                class="tag-input archive-tag-input"
                placeholder="add tag..."
                data-file-uuid="${file.uuid}"
              />
              <button
                type="button"
                class="add-tag-btn archive-add-tag-btn"
                data-file-uuid="${file.uuid}"
                disabled
              >
                +
              </button>
            </div>
            <div
              class="tag-autocomplete"
              id="archive-autocomplete-${file.uuid}"
              style="display: none"
            ></div>
          </div>
          ${file.tags && file.tags.length > 0 ? file.tags.map(tag => `
            <span class="archive-tag">
              ${this.escapeHtml(tag)}
              <button class="remove-tag-btn" data-file-uuid="${file.uuid}" data-tag="${this.escapeHtml(tag)}" title="Remove tag">×</button>
            </span>
          `).join('') : ''}
        </div>

      </div>
    `).join('');

    // Setup event listeners for archive tag inputs after rendering
    this.setupArchiveTagInputEvents();
    
    // Setup archive hash toggle event listeners
    this.setupArchiveHashToggleEvents();
    
    // Setup archive collapse events
    this.setupArchiveCollapseEvents();
    
    // Restore collapse state after rendering
    this.restoreArchiveCollapseState();
    
    // Apply current filters after rendering
    this.applyArchiveFilters();
    
    // Update archive count after initial render
    this.updateArchiveCount();
  }

  setupArchiveCollapseEvents() {
    // Set up individual archive collapse buttons
    document.querySelectorAll('.archive-collapse-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fileUuid = e.target.closest('button').dataset.fileUuid;
        this.toggleArchiveFileCollapse(fileUuid);
      });
    });
  }

  toggleArchiveFileCollapse(fileUuid) {
    const archiveItem = document.querySelector(`.archive-item[data-uuid="${fileUuid}"]`);
    if (!archiveItem) return;

    archiveItem.classList.toggle('collapsed');
    
    // Update state tracking
    if (archiveItem.classList.contains('collapsed')) {
      this.archiveCollapseState.collapsedItems.add(fileUuid);
    } else {
      this.archiveCollapseState.collapsedItems.delete(fileUuid);
    }
  }

  toggleAllArchiveFilesCollapse() {
    const collapseBtn = document.getElementById('archive-collapse-all-btn');
    const currentState = collapseBtn.dataset.state;
    const newState = currentState === 'expanded' ? 'collapsed' : 'expanded';
    
    // Update button state
    collapseBtn.dataset.state = newState;
    collapseBtn.title = newState === 'collapsed' ? 'Expand All Files' : 'Collapse All Files';
    
    // Update global state tracking
    this.archiveCollapseState.globalState = newState;
    
    // Apply state to all archive items and update individual tracking
    const archiveItems = document.querySelectorAll('.archive-item');
    if (newState === 'collapsed') {
      // Collapse all items and add them to collapsed set
      archiveItems.forEach(item => {
        item.classList.add('collapsed');
        this.archiveCollapseState.collapsedItems.add(item.dataset.uuid);
      });
    } else {
      // Expand all items and clear collapsed set
      archiveItems.forEach(item => {
        item.classList.remove('collapsed');
      });
      this.archiveCollapseState.collapsedItems.clear();
    }
  }

  renderArchiveTagFilters() {
    const container = document.getElementById('archive-tag-filter-list');
    if (!this.data.archive || !this.data.archive.files) {
      container.innerHTML = '';
      return;
    }

    // Extract all unique tags from archive files
    const tagCounts = {};
    this.data.archive.files.forEach(file => {
      if (file.tags) {
        file.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    const tags = Object.entries(tagCounts)
      .sort(([a], [b]) => a.localeCompare(b)); // Sort alphabetically by tag name
    
    if (tags.length === 0) {
      container.innerHTML = '<div class="no-tags">No tags found</div>';
      return;
    }

    container.innerHTML = tags.map(([tag, count]) => `
      <div class="archive-tag-filter-container">
        <button class="archive-tag-filter" data-tag="${tag}">
          ${this.escapeHtml(tag)} (${count})
        </button>
        <div class="archive-tag-dropdown-menu" data-tag="${tag}">
          <button class="archive-tag-dropdown-item edit-archive-tag-option" data-tag="${tag}">Edit</button>
          <button class="archive-tag-dropdown-item delete-archive-tag-option" data-tag="${tag}">Remove</button>
        </div>
      </div>
    `).join('');

    // Add click and context menu events to archive tag filters
    container.querySelectorAll('.archive-tag-filter').forEach(btn => {
      // Left click to toggle filter
      btn.addEventListener('click', (e) => {
        const tag = e.target.dataset.tag;
        this.toggleArchiveTagFilter(tag);
      });

      // Right click to show context menu
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tag = e.target.dataset.tag;
        console.log('Right click on archive tag filter:', tag);
        this.showArchiveTagContextMenu(tag, e.clientX, e.clientY);
      });
      
      // Restore active state if this tag is currently filtered
      const tag = btn.dataset.tag;
      if (this.activeArchiveTagFilters.has(tag)) {
        btn.classList.add('active');
      }
    });

    // Add click events to dropdown options
    const editOptions = container.querySelectorAll('.edit-archive-tag-option');
    const deleteOptions = container.querySelectorAll('.delete-archive-tag-option');

    editOptions.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tag = e.target.dataset.tag;
        this.hideAllArchiveTagDropdowns();
        this.openEditArchiveTagModal(tag);
      });
    });

    deleteOptions.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tag = e.target.dataset.tag;
        this.hideAllArchiveTagDropdowns();
        this.confirmDeleteArchiveTag(tag);
      });
    });
  }

  updateArchiveCount() {
    const countElement = document.getElementById('archive-count-text');
    if (!countElement) return;
    
    // Count visible archive items
    const visibleItems = document.querySelectorAll('.archive-item[style*="display: block"], .archive-item:not([style*="display: none"])');
    const count = visibleItems.length;
    
    // Update the count text with proper pluralization
    const fileText = count === 1 ? 'File' : 'Files';
    countElement.textContent = `${count} ${fileText} Listed`;
  }

  toggleArchiveTagFilter(tag) {
    if (this.activeArchiveTagFilters.has(tag)) {
      this.activeArchiveTagFilters.delete(tag);
    } else {
      this.activeArchiveTagFilters.add(tag);
    }
    
    this.applyArchiveFilters();
    this.updateArchiveTagFilterButtons();
  }

  applyArchiveFilters() {
    if (!this.data.archive) return;

    const items = document.querySelectorAll('.archive-item');
    
    items.forEach(item => {
      const fileUuid = item.dataset.uuid;
      const file = this.data.archive.files.find(f => f.uuid === fileUuid);
      
      if (!file) {
        item.style.display = 'none';
        return;
      }

      // Check search term filter
      let matchesSearch = true;
      if (this.currentArchiveSearchTerm.trim()) {
        const term = this.currentArchiveSearchTerm.toLowerCase();
        const title = file.title.toLowerCase();
        const filePath = file.filePath.toLowerCase();
        const author = (file.metadata.author || '').toLowerCase();
        
        matchesSearch = title.includes(term) || filePath.includes(term) || author.includes(term);
      }

      // Check tag filters
      let matchesTags = true;
      if (this.activeArchiveTagFilters.size > 0) {
        if (this.archiveFilterLogic === 'all') {
          // ALL logic: File must have ALL of the selected tags
          matchesTags = Array.from(this.activeArchiveTagFilters).every(tag => 
            file.tags && file.tags.includes(tag)
          );
        } else {
          // ANY logic (default): File must have at least one of the selected tags
          matchesTags = Array.from(this.activeArchiveTagFilters).some(tag => 
            file.tags && file.tags.includes(tag)
          );
        }
      }

      // Show item only if it matches both search and tag filters
      item.style.display = (matchesSearch && matchesTags) ? 'block' : 'none';
    });

    // Show/hide clear filters button
    this.updateArchiveClearFiltersButton();

    // Update count display
    this.updateArchiveCount();
  }

  updateArchiveTagFilterButtons() {
    const filterItems = document.querySelectorAll('#archive-tag-filter-list .archive-tag-filter');
    filterItems.forEach(item => {
      const tag = item.dataset.tag;
      if (this.activeArchiveTagFilters.has(tag)) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  initializeArchiveFilterLogic() {
    const filterLogicBtn = document.getElementById('archive-filter-logic-btn');
    
    if (!filterLogicBtn) return;
    
    // Load saved preference or use default
    const savedLogic = localStorage.getItem('archive-filter-logic') || 'any';
    this.archiveFilterLogic = savedLogic;
    
    // Set initial button state
    this.updateArchiveFilterLogicButton();
    
    // Add event listener for button clicks
    filterLogicBtn.addEventListener('click', () => {
      // Toggle between 'any' and 'all'
      this.archiveFilterLogic = this.archiveFilterLogic === 'any' ? 'all' : 'any';
      localStorage.setItem('archive-filter-logic', this.archiveFilterLogic);
      
      // Update button appearance and reapply filters
      this.updateArchiveFilterLogicButton();
      this.applyArchiveFilters();
    });
  }

  updateArchiveFilterLogicButton() {
    const filterLogicBtn = document.getElementById('archive-filter-logic-btn');
    if (!filterLogicBtn) return;
    
    // Set data attribute for CSS styling
    filterLogicBtn.setAttribute('data-logic', this.archiveFilterLogic);
    
    // Update tooltip
    const tooltipText = this.archiveFilterLogic === 'any' 
      ? 'Toggle Filter Logic: ANY of these tags' 
      : 'Toggle Filter Logic: ALL of these tags';
    filterLogicBtn.setAttribute('title', tooltipText);
  }

  updateArchiveClearFiltersButton() {
    const clearBtn = document.getElementById('archive-clear-filters-btn');
    const hasFilters = this.activeArchiveTagFilters.size > 0 || this.currentArchiveSearchTerm.trim();
    
    if (clearBtn) {
      if (hasFilters) {
        clearBtn.classList.remove('inactive');
        clearBtn.disabled = false;
      } else {
        clearBtn.classList.add('inactive');
        clearBtn.disabled = true;
      }
    }
  }

  clearAllArchiveFilters() {
    const clearBtn = document.getElementById('archive-clear-filters-btn');
    
    // Don't do anything if button is disabled
    if (clearBtn && clearBtn.disabled) {
      return;
    }
    
    this.activeArchiveTagFilters.clear();
    this.currentArchiveSearchTerm = '';
    
    // Clear search input
    const searchInput = document.getElementById('archive-search');
    if (searchInput) {
      searchInput.value = '';
    }
    
    // Clear active tag filters
    document.querySelectorAll('#archive-tag-filter-list .archive-tag-filter.active').forEach(btn => {
      btn.classList.remove('active');
    });
    
    this.applyArchiveFilters();
  }

  toggleArchiveActionsDropdown(fileUuid) {
    this.hideAllArchiveActionsDropdowns();
    
    const menu = document.querySelector(`.archive-actions-menu[data-file-uuid="${fileUuid}"]`);
    if (menu) {
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
  }

  hideAllArchiveActionsDropdowns() {
    const allMenus = document.querySelectorAll('.archive-actions-menu');
    allMenus.forEach(menu => {
      menu.style.display = 'none';
    });
  }

  async handleArchiveAction(fileUuid, action) {
    const file = this.data.archive.files.find(f => f.uuid === fileUuid);
    if (!file) {
      this.showError('File not found in archive');
      return;
    }

    switch (action) {
      case 'edit':
        await this.openEditArchiveItemModal(fileUuid);
        break;

      case 'upload':
        try {
          // Check if file still exists
          const fileExists = await window.electronAPI.fileExists(file.filePath);
          if (!fileExists) {
            this.showError(`File not found: ${file.filePath}`);
            return;
          }

          // Open upload modal with the file
          await this.openUploadModal(file.filePath);
        } catch (error) {
          console.error('Failed to upload file:', error);
          this.showError('Failed to initiate upload');
        }
        break;

      case 'locate':
        await this.locateArchiveFile(fileUuid);
        break;

      case 'refresh':
        await this.refreshArchiveFileMetadata(fileUuid);
        break;

      default:
        console.warn('Unknown archive action:', action);
    }
  }

  // Helper functions for file status and relocation
  getFilePathStatus(filePath) {
    if (filePath.startsWith('[VIRTUAL]')) {
      return 'virtual';
    } else if (filePath.startsWith('/')) {
      return 'absolute';
    } else {
      return 'relative';
    }
  }

  getFileStatusIndicator(filePath) {
    if (filePath.startsWith('[VIRTUAL]')) {
      return '<span class="file-status-indicator virtual" title="Virtual file - needs to be located">⚠</span>';
    } else {
      return '<span class="file-status-indicator physical" title="Physical file path"></span>';
    }
  }

  needsRelocation(filePath) {
    return filePath.startsWith('[VIRTUAL]') || filePath.includes('VIRTUAL');
  }

  async locateArchiveFile(fileUuid) {
    try {
      const file = this.data.archive.files.find(f => f.uuid === fileUuid);
      if (!file) {
        this.showError('File not found in archive');
        return;
      }

      // Open file picker dialog
      const newFilePath = await window.electronAPI.selectFile([
        { name: 'All Files', extensions: ['*'] },
        { name: 'Markdown Files', extensions: ['md', 'markdown'] },
        { name: 'Text Files', extensions: ['txt'] }
      ]);

      if (!newFilePath) return; // User cancelled

      // Update the file entry with new path and refresh metadata
      await this.updateArchiveFilePath(fileUuid, newFilePath);
      await this.refreshArchiveFileMetadata(fileUuid);

      this.showSuccess(`File relocated successfully: ${file.title}`);
      
      // Refresh the archive display
      await this.loadArchiveData();
    } catch (error) {
      console.error('Failed to locate file:', error);
      this.showError('Failed to locate file');
    }
  }

  async refreshArchiveFileMetadata(fileUuid) {
    try {
      const file = this.data.archive.files.find(f => f.uuid === fileUuid);
      if (!file) {
        this.showError('File not found in archive');
        return;
      }

      // Check if file exists
      const fileExists = await window.electronAPI.fileExists(file.filePath);
      if (!fileExists) {
        this.showError(`File not found: ${file.filePath}`);
        return;
      }

      // Get fresh file stats and metadata
      const stats = await window.electronAPI.getFileStats(file.filePath);
      
      // Update basic file information
      file.fileSize = stats.size;
      file.modified = new Date(stats.mtime || Date.now()).toISOString();

      // Try to extract metadata from the file
      const metadata = await this.extractFileMetadata(file.filePath);
      if (metadata) {
        if (metadata.title) file.title = metadata.title;
        if (metadata.author) file.metadata.author = metadata.author;
        if (metadata.tags && metadata.tags.length > 0) {
          // Merge tags, avoiding duplicates
          const existingTags = new Set(file.tags);
          for (const tag of metadata.tags) {
            existingTags.add(tag);
          }
          file.tags = Array.from(existingTags);
        }
      }

      // Save updated archive data
      await this.saveArchiveData();
      
      this.showSuccess(`Metadata refreshed for: ${file.title}`);
      
      // Refresh the display
      await this.loadArchiveData();
    } catch (error) {
      console.error('Failed to refresh metadata:', error);
      this.showError('Failed to refresh file metadata');
    }
  }

  async updateArchiveFilePath(fileUuid, newFilePath) {
    try {
      const archiveData = this.data.archive;
      const file = archiveData.files.find(f => f.uuid === fileUuid);
      if (!file) {
        throw new Error('File not found in archive');
      }

      // Update the file path
      file.filePath = newFilePath;
      
      // Remove virtual indicators from metadata if present
      if (file.metadata.customFields?.isVirtual) {
        delete file.metadata.customFields.isVirtual;
      }
      if (file.metadata.customFields?.migratedFrom) {
        delete file.metadata.customFields.migratedFrom;
      }
      
      // Remove virtual tag if present
      file.tags = file.tags.filter(tag => tag !== 'virtual');

      // Save the updated archive data
      await this.saveArchiveData();
    } catch (error) {
      console.error('Failed to update archive file path:', error);
      throw error;
    }
  }

  async extractFileMetadata(filePath) {
    try {
      // For now, handle markdown files with frontmatter
      if (filePath.toLowerCase().endsWith('.md') || filePath.toLowerCase().endsWith('.markdown')) {
        const content = await window.electronAPI.readFile(filePath);
        return this.extractMarkdownMetadata(content);
      }
      return null;
    } catch (error) {
      console.warn('Failed to extract file metadata:', error);
      return null;
    }
  }

  extractMarkdownMetadata(content) {
    try {
      // Extract YAML frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) return null;

      // Parse YAML (basic parsing - in a real app you'd use a proper YAML parser)
      const frontmatter = {};
      const lines = frontmatterMatch[1].split('\n');
      
      for (const line of lines) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          const [, key, value] = match;
          if (key === 'tags') {
            // Handle tags array
            if (value.startsWith('[') && value.endsWith(']')) {
              frontmatter[key] = value.slice(1, -1).split(',').map(t => t.trim().replace(/^["']|["']$/g, ''));
            }
          } else {
            frontmatter[key] = value.replace(/^["']|["']$/g, ''); // Remove quotes
          }
        }
      }

      return frontmatter;
    } catch (error) {
      console.warn('Failed to parse frontmatter:', error);
      return null;
    }
  }

  async saveArchiveData() {
    try {
      await window.electronAPI.archive.saveData(this.data.archive);
    } catch (error) {
      console.error('Failed to save archive data:', error);
      throw new Error('Failed to save archive data');
    }
  }

  async uploadFile() {
    try {
      // Check if wallet is configured first
      const isWalletConfigured = await window.electronAPI.archive.isWalletConfigured();
      if (!isWalletConfigured) {
        this.showError('Please setup your Arweave wallet before uploading files.');
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
      this.showError(`Failed to select file: ${error.message}`);
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
      this.openModal('upload-modal');
    } catch (error) {
      console.error('Failed to open upload modal:', error);
      this.showError('Failed to load file information');
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
      this.showError('Both tag key and value are required');
      return;
    }

    // Clean up tag key - replace spaces with dashes, keep alphanumeric and common chars
    key = key.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');
    
    if (!key) {
      this.showError('Tag key must contain at least some alphanumeric characters');
      return;
    }

    // Check for duplicate keys
    if (this.uploadTags.some(tag => tag.key === key)) {
      this.showError(`Tag key "${key}" already exists`);
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
        this.showError('No file selected');
        return;
      }

      // Close modal
      this.closeModal();

      // Convert tags to Arweave format (array of "key:value" strings)
      const arweaveTags = this.uploadTags.map(tag => `${tag.key}:${tag.value}`);
      
      // Show progress message
      this.showSuccess('Uploading file to Arweave...');

      // Upload the file
      const result = await window.electronAPI.archive.uploadFile(this.selectedFile.path, arweaveTags);
      
      if (result.success) {
        this.showSuccess(`File uploaded successfully! Transaction ID: ${result.transactionId}`);
        
        // Verify the upload after a short delay
        setTimeout(async () => {
          try {
            const status = await window.electronAPI.archive.checkTransactionStatus(result.transactionId);
            if (status === 'confirmed') {
              this.showSuccess(`Upload confirmed on Arweave! View at: https://arweave.net/${result.transactionId}`);
            } else if (status === 'pending') {
              this.showSuccess(`Upload is pending confirmation. Check status later.`);
            } else {
              this.showError(`Upload may have failed. Transaction not found on network.`);
            }
          } catch (error) {
            console.warn('Could not verify upload status:', error);
          }
        }, 2000);
        
        // Refresh the uploads list
        await this.loadArchiveData();
      } else {
        this.showError(`Upload failed: ${result.error}`);
      }

      // Clear selected file
      this.selectedFile = null;
      this.uploadTags = [];
    } catch (error) {
      console.error('Failed to upload file:', error);
      this.showError(`Failed to upload file: ${error.message}`);
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
      this.showError('Failed to check wallet balance');
    }
  }

  // ===== AT PROTOCOL ACCOUNT MANAGEMENT =====

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

  async openATProtoAccountsModal() {
    try {
      // Check if workspace is connected first
      const workspacePath = await window.electronAPI.getWorkspace();
      if (!workspacePath) {
        this.showError('Please select a workspace before managing Bluesky accounts.');
        return;
      }

      await this.loadAndRenderATProtoAccounts();
      this.openModal('atproto-accounts-modal');
      
      // Force refresh status when modal is opened to ensure UI is in sync
      setTimeout(async () => {
        await this.forceRefreshATProtoStatus();
      }, 200);
    } catch (error) {
      console.error('Failed to open AT Protocol accounts modal:', error);
      this.showError('Failed to load account information');
    }
  }

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
                      ${!isActive ? `<button class="account-action-btn switch-btn" onclick="meridianApp.switchATProtoAccount('${account.id}')">Switch</button>` : ''}
          <button class="account-action-btn edit-btn" onclick="meridianApp.editATProtoAccountNickname('${account.id}', '${this.escapeHtml(account.nickname)}')">Rename</button>
          <button class="account-action-btn remove-btn" onclick="meridianApp.removeATProtoAccount('${account.id}')">Remove</button>
          </div>
        </div>
      `;
    }).join('');

    accountsList.innerHTML = accountsHTML;
  }

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

  async editATProtoAccountNickname(accountId, currentNickname) {
    // Store the account ID for the modal form
    this.renameATProtoAccountData = { accountId, currentNickname };
    
    // Set the current nickname in the input field
    const nicknameInput = document.getElementById('atproto-rename-account-nickname');
    nicknameInput.value = currentNickname;
    
    // Open the rename modal
    this.openModal('atproto-rename-account-modal');
    
    // Focus the input field and select all text
    setTimeout(() => {
      nicknameInput.focus();
      nicknameInput.select();
    }, 100);
  }

  async handleRenameATProtoAccountSubmit(e) {
    e.preventDefault();
    
    if (!this.renameATProtoAccountData) {
      this.showError('No account selected for renaming');
      return;
    }
    
    const newNickname = document.getElementById('atproto-rename-account-nickname').value.trim();
    
    if (!newNickname || newNickname === this.renameATProtoAccountData.currentNickname) {
      this.closeModal();
      return;
    }
    
    try {
      await window.electronAPI.atproto.updateAccountNickname(this.renameATProtoAccountData.accountId, newNickname);
      this.showSuccess('Account nickname updated successfully!');
      
      // Reload accounts
      await this.loadAndRenderATProtoAccounts();
      this.closeModal();
      
    } catch (error) {
      console.error('Failed to update AT Protocol account nickname:', error);
      this.showError(`Failed to update nickname: ${error.message}`);
    } finally {
      // Clear the stored data
      this.renameATProtoAccountData = null;
    }
  }

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

  async updateATProtoStatus(forceRefresh = false) {
    console.log('[ATProto] Updating AT Protocol status...', forceRefresh ? '(forced refresh)' : '');
    
    try {
      // Clear any cached agents if forcing refresh
      if (forceRefresh) {
        console.log('[ATProto] Forcing refresh - clearing cached state');
      }
      
      const activeAccount = await window.electronAPI.atproto.getActiveAccount();
      
      if (activeAccount) {
        console.log('[ATProto] Active account found:', activeAccount.nickname, activeAccount.handle);
        
        // Validate the session
        const isSessionValid = await window.electronAPI.atproto.validateSession(activeAccount.id);
        console.log('[ATProto] Session validation result:', isSessionValid);
        
        if (isSessionValid) {
          // Update footer
          this.updateFooterBluesky(true, activeAccount.handle);
          
          // Update broadcast panel indicator
          const indicator = document.querySelector('[data-platform="bluesky"] .connection-status');
          if (indicator) {
            indicator.textContent = 'Connected';
            indicator.className = 'connection-status connected';
          }
          console.log('[ATProto] Status updated: Connected');
        } else {
          console.log('[ATProto] Session invalid, showing as disconnected');
          // Session is invalid
          this.updateFooterBluesky(false);
          
          const indicator = document.querySelector('[data-platform="bluesky"] .connection-status');
          if (indicator) {
            indicator.textContent = 'Session Expired';
            indicator.className = 'connection-status';
          }
        }
      } else {
        console.log('[ATProto] No active account found');
        // Update footer
        this.updateFooterBluesky(false);
        
        // Update broadcast panel indicator
        const indicator = document.querySelector('[data-platform="bluesky"] .connection-status');
        if (indicator) {
          indicator.textContent = 'Disconnected';
          indicator.className = 'connection-status';
        }
      }
    } catch (error) {
      console.error('[ATProto] Failed to update AT Protocol status:', error);
      
      // Update with error state
      this.updateFooterBluesky(false);
      const indicator = document.querySelector('[data-platform="bluesky"] .connection-status');
      if (indicator) {
        indicator.textContent = 'Error';
        indicator.className = 'connection-status';
      }
    }
  }

  // Force refresh AT Protocol status (clears caches)
  async forceRefreshATProtoStatus() {
    await this.updateATProtoStatus(true);
  }

  // ===== X ACCOUNT MANAGEMENT =====

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

  async openXAccountsModal() {
    try {
      // Check if workspace is connected first
      const workspacePath = await window.electronAPI.getWorkspace();
      if (!workspacePath) {
        this.showError('Please select a workspace before managing X accounts.');
        return;
      }

      await this.loadAndRenderXAccounts();
      this.openModal('x-accounts-modal');
      
      // Force refresh status when modal is opened to ensure UI is in sync
      setTimeout(async () => {
        await this.forceRefreshXStatus();
      }, 200);
    } catch (error) {
      console.error('Failed to open X accounts modal:', error);
      this.showError('Failed to load account information');
    }
  }

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
                      ${!isActive ? `<button class="account-action-btn switch-btn" onclick="meridianApp.switchXAccount('${account.id}')">Switch</button>` : ''}
          <button class="account-action-btn edit-btn" onclick="meridianApp.editXAccountNickname('${account.id}', '${this.escapeHtml(account.nickname)}')">Rename</button>
          <button class="account-action-btn remove-btn" onclick="meridianApp.removeXAccount('${account.id}')">Remove</button>
          </div>
        </div>
      `;
    }).join('');

    accountsList.innerHTML = accountsHTML;
  }

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

  async editXAccountNickname(accountId, currentNickname) {
    // Store the account ID for the modal form
    this.renameXAccountData = { accountId, currentNickname };
    
    // Set the current nickname in the input field
    const nicknameInput = document.getElementById('x-rename-account-nickname');
    nicknameInput.value = currentNickname;
    
    // Open the rename modal
    this.openModal('x-rename-account-modal');
    
    // Focus the input field and select all text
    setTimeout(() => {
      nicknameInput.focus();
      nicknameInput.select();
    }, 100);
  }

  async handleRenameXAccountSubmit(e) {
    e.preventDefault();
    
    if (!this.renameXAccountData) {
      this.showError('No account selected for renaming');
      return;
    }
    
    const newNickname = document.getElementById('x-rename-account-nickname').value.trim();
    
    if (!newNickname || newNickname === this.renameXAccountData.currentNickname) {
      this.closeModal();
      return;
    }
    
    try {
      await window.electronAPI.x.updateAccountNickname(this.renameXAccountData.accountId, newNickname);
      this.showSuccess('Account nickname updated successfully!');
      
      // Reload accounts
      await this.loadAndRenderXAccounts();
      this.closeModal();
      
    } catch (error) {
      console.error('Failed to update X account nickname:', error);
      this.showError(`Failed to update nickname: ${error.message}`);
    } finally {
      // Clear the stored data
      this.renameXAccountData = null;
    }
  }

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

  async updateXStatus(forceRefresh = false) {
    console.log('[X] Updating X status...', forceRefresh ? '(forced refresh)' : '');
    
    try {
      // Clear any cached agents if forcing refresh
      if (forceRefresh) {
        console.log('[X] Forcing refresh - clearing cached state');
      }
      
      const activeAccount = await window.electronAPI.x.getActiveAccount();
      
      if (activeAccount) {
        console.log('[X] Active account found:', activeAccount.nickname, activeAccount.username);
        
        // Validate the credentials
        const isValid = await window.electronAPI.x.validateCredentials(activeAccount.id);
        console.log('[X] Credential validation result:', isValid);
        
        if (isValid) {
          // Update footer
          this.updateFooterX(true, activeAccount.username);
          
          // Update broadcast panel indicator
          const indicator = document.querySelector('[data-platform="x"] .connection-status');
          if (indicator) {
            indicator.textContent = 'Connected';
            indicator.className = 'connection-status connected';
          }
          console.log('[X] Status updated: Connected');
        } else {
          console.log('[X] Credentials invalid, showing as disconnected');
          // Credentials are invalid
          this.updateFooterX(false);
          
          const indicator = document.querySelector('[data-platform="x"] .connection-status');
          if (indicator) {
            indicator.textContent = 'Invalid Credentials';
            indicator.className = 'connection-status';
          }
        }
      } else {
        console.log('[X] No active account found');
        // Update footer
        this.updateFooterX(false);
        
        // Update broadcast panel indicator
        const indicator = document.querySelector('[data-platform="x"] .connection-status');
        if (indicator) {
          indicator.textContent = 'Disconnected';
          indicator.className = 'connection-status';
        }
      }
    } catch (error) {
      console.error('[X] Failed to update X status:', error);
      
      // Update with error state
      this.updateFooterX(false);
      const indicator = document.querySelector('[data-platform="x"] .connection-status');
      if (indicator) {
        indicator.textContent = 'Error';
        indicator.className = 'connection-status';
      }
    }
  }

  // Force refresh X status (clears caches)
  async forceRefreshXStatus() {
    await this.updateXStatus(true);
  }

  updateFooterX(isConnected = false, username = null) {
    const footerX = document.getElementById('footer-x-status');
    if (isConnected && username) {
      footerX.textContent = `@${username}`;
      footerX.title = `Connected as @${username}`;
      footerX.classList.add('connected');
      footerX.classList.remove('error');
    } else {
      footerX.textContent = 'Not connected';
      footerX.title = '';
      footerX.classList.remove('connected');
      footerX.classList.add('error');
    }
  }

  async checkXPermissions() {
    const resultDiv = document.getElementById('x-permissions-result');
    const button = document.getElementById('x-check-permissions-btn');
    
    try {
      button.textContent = 'Checking...';
      button.disabled = true;
      resultDiv.innerHTML = '<p style="color: #666;">Checking API permissions...</p>';
      
      const activeAccount = await window.electronAPI.x.getActiveAccount();
      if (!activeAccount) {
        resultDiv.innerHTML = '<p style="color: #f44336;">No active X account found. Please add and select an account first.</p>';
        return;
      }
      
      const permissions = await window.electronAPI.x.checkAppPermissions(activeAccount.id);
      
      let resultHtml = '<div style="padding: 10px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9;">';
      resultHtml += `<h5 style="margin: 0 0 10px 0;">Permissions Check for @${activeAccount.username}</h5>`;
      
      // Read permissions
      if (permissions.canRead) {
        resultHtml += '<p style="color: #4caf50; margin: 5px 0;">✓ Read permissions: Working</p>';
      } else {
        resultHtml += '<p style="color: #f44336; margin: 5px 0;">✗ Read permissions: Failed</p>';
      }
      
      // Write permissions (assumed)
      if (permissions.canWrite) {
        resultHtml += '<p style="color: #ff9800; margin: 5px 0;">? Write permissions: Assumed working (test by posting)</p>';
      } else {
        resultHtml += '<p style="color: #f44336; margin: 5px 0;">✗ Write permissions: Likely failed</p>';
      }
      
      // Troubleshooting tips
      if (!permissions.canRead || !permissions.canWrite) {
        resultHtml += '<div style="margin-top: 15px; padding: 10px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px;">';
        resultHtml += '<h6 style="margin: 0 0 10px 0; color: #856404;">Troubleshooting Tips:</h6>';
        resultHtml += '<ol style="margin: 0; padding-left: 20px; color: #856404;">';
        resultHtml += '<li>Ensure your X app has "Read and Write" permissions</li>';
        resultHtml += '<li>Regenerate your Access Token & Secret after changing permissions</li>';
        resultHtml += '<li>Verify you have a paid X API plan (Basic or higher)</li>';
        resultHtml += '<li>Check that your app is not restricted or suspended</li>';
        resultHtml += '</ol>';
        resultHtml += '</div>';
      }
      
      if (permissions.details?.error) {
        resultHtml += `<p style="color: #f44336; margin: 10px 0 0 0; font-size: 0.8em;">Error: ${permissions.details.error}</p>`;
      }
      
      resultHtml += '</div>';
      resultDiv.innerHTML = resultHtml;
      
    } catch (error) {
      console.error('Failed to check X permissions:', error);
      resultDiv.innerHTML = `<p style="color: #f44336;">Failed to check permissions: ${error.message}</p>`;
    } finally {
      button.textContent = 'Check API Permissions';
      button.disabled = false;
    }
  }

  // ===== ARWEAVE ACCOUNT MANAGEMENT =====

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

  async openArweaveAccountsModal() {
    try {
      // Check if workspace is connected first
      const workspacePath = await window.electronAPI.getWorkspace();
      if (!workspacePath) {
        this.showError('Please select a workspace before managing Arweave accounts.');
        return;
      }

      await this.loadAndRenderAccounts();
      this.openModal('arweave-accounts-modal');
    } catch (error) {
      console.error('Failed to open Arweave accounts modal:', error);
      this.showError('Failed to load account information');
    }
  }

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
                      ${!isActive ? `<button class="account-action-btn switch-btn" onclick="meridianApp.switchAccount('${account.id}')">Switch</button>` : ''}
          <button class="account-action-btn edit-btn" onclick="meridianApp.editAccountNickname('${account.id}', '${this.escapeHtml(account.nickname)}')">Rename</button>
          <button class="account-action-btn remove-btn" onclick="meridianApp.removeAccount('${account.id}')">Remove</button>
          </div>
        </div>
      `;
    }).join('');

    accountsList.innerHTML = accountsHTML;
  }

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

  async editAccountNickname(accountId, currentNickname) {
    // Store the account ID for the modal form
    this.renameAccountData = { accountId, currentNickname };
    
    // Set the current nickname in the input field
    const nicknameInput = document.getElementById('rename-account-nickname');
    nicknameInput.value = currentNickname;
    
    // Open the rename modal
    this.openModal('rename-account-modal');
    
    // Focus the input field and select all text
    setTimeout(() => {
      nicknameInput.focus();
      nicknameInput.select();
    }, 100);
  }

  async handleRenameAccountSubmit(e) {
    e.preventDefault();
    
    if (!this.renameAccountData) {
      this.showError('No account selected for renaming');
      return;
    }
    
    const newNickname = document.getElementById('rename-account-nickname').value.trim();
    
    if (!newNickname || newNickname === this.renameAccountData.currentNickname) {
      this.closeModal();
      return;
    }
    
    try {
      await window.electronAPI.archive.updateAccountNickname(this.renameAccountData.accountId, newNickname);
      this.showSuccess('Account nickname updated successfully!');
      
      // Reload accounts
      await this.loadAndRenderAccounts();
      this.closeModal();
      
    } catch (error) {
      console.error('Failed to update account nickname:', error);
      this.showError(`Failed to update nickname: ${error.message}`);
    } finally {
      // Clear the stored data
      this.renameAccountData = null;
    }
  }

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

  async updateWalletDisplay() {
    // This method now uses centralized account state
    try {
      const arweaveState = await window.electronAPI.accountState.getPlatformState('arweave');
      this.updateArweaveUI(arweaveState);
    } catch (error) {
      console.error('Failed to update wallet display:', error);
      
      // Fallback to showing error state
      const walletAddressElement = document.getElementById('wallet-address');
      const balanceElement = document.querySelector('.balance-value');
      
      walletAddressElement.textContent = 'Error loading wallet';
      walletAddressElement.classList.remove('configured');
      balanceElement.textContent = '--';
      
      // Update footer
      this.updateFooterArweave(null, false);
    }
  }

  // Broadcast Tool
  async loadBroadcastData() {
    try {
      this.data.broadcast = await window.electronAPI.broadcast.loadData();
      this.renderPosts();
      this.updatePlatformStatus();
    } catch (error) {
      console.error('Failed to load broadcast data:', error);
    }
  }

  renderPosts() {
    const container = document.getElementById('post-calendar');
    if (!this.data.broadcast) {
      container.innerHTML = '<div class="loading-state">No posts found</div>';
      return;
    }

    const allPosts = [...this.data.broadcast.posts, ...this.data.broadcast.drafts];
    
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
          // For now, we'll just show connected/disconnected - later we can get the username
          this.updateFooterFarcaster(isAuthenticated, isAuthenticated ? 'user' : null);
        } else if (platform === 'bluesky') {
          // For now, we'll just show connected/disconnected - later we can get the handle
          this.updateFooterBluesky(isAuthenticated, isAuthenticated ? '@user.bsky.social' : null);
        }
      } catch (error) {
        console.error(`Failed to check ${platform} status:`, error);
        
        // Update footer with error state
        if (platform === 'farcaster') {
          this.updateFooterFarcaster(false);
        } else if (platform === 'bluesky') {
          this.updateFooterBluesky(false);
        }
      }
    }
  }

  // Template Management Methods
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
            <button class="secondary-btn apply-to-file-btn" data-file-path="${file.path}">
              Apply Template
            </button>
          </div>
        </div>
        
        ${file.frontmatter ? `
          <div class="markdown-frontmatter">${this.escapeHtml(JSON.stringify(file.frontmatter, null, 2))}</div>
        ` : ''}
      </div>
    `).join('');

    // Add event listeners
    container.querySelectorAll('.apply-to-file-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const filePath = e.target.dataset.filePath;
        this.openApplyTemplateModal(null, filePath);
      });
    });
  }

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
      
      this.closeModal();
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

  resetTemplateForm() {
    const form = document.getElementById('new-template-form');
    form.reset();
    delete form.dataset.editingId;
    
    // Reset modal title and button text
    document.querySelector('#new-template-modal .modal-header h3').textContent = 'Create New Template';
    document.querySelector('#new-template-form button[type="submit"]').textContent = 'Create Template';
  }

  async openManageTemplatesModal() {
    this.openModal('manage-templates-modal');
    await this.loadTemplatesForManagement();
  }

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

  renderTemplatesForManagement(templates) {
    const container = document.getElementById('templates-list');
    
    if (templates.length === 0) {
      container.innerHTML = '<div class="loading-state">No templates yet. Create your first template!</div>';
      return;
    }

    // Reuse the same template rendering logic
    this.renderTemplates(templates);
  }

  async openApplyTemplateModal(templateId = null, filePath = null) {
    this.openModal('apply-template-modal');
    
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
      this.closeModal();
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
      
      this.openModal('new-template-modal');
    } catch (error) {
      console.error('Failed to load template for editing:', error);
      this.showError('Failed to load template');
    }
  }

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

  // ===== CENTRALIZED ACCOUNT STATE MANAGEMENT =====

  /**
   * Wait for account state initialization to complete
   */
  async waitForAccountStateInitialization() {
    console.log('[AccountState] Waiting for account state initialization...');
    
    try {
      // First, try to get the account state immediately
      console.log('[AccountState] First attempt: checking if state is already available...');
      try {
        const accountState = await window.electronAPI.accountState.getState();
        console.log('[AccountState] Initial state check result:', JSON.stringify(accountState, null, 2));
        
        if (accountState && (accountState.arweave || accountState.atproto || accountState.x)) {
          console.log('[AccountState] Account state is immediately available, updating UI');
          await this.updateUIFromAccountState();
          return;
        }
      } catch (immediateError) {
        console.log('[AccountState] Initial state check failed, proceeding to poll:', immediateError.message);
      }
      
      // Poll until initialized (with timeout)
      const maxWaitTime = 30000; // 30 seconds
      const pollInterval = 200; // 200ms for faster response
      const startTime = Date.now();
      let pollCount = 0;
      
      console.log('[AccountState] Starting polling...');
      
      while (Date.now() - startTime < maxWaitTime) {
        pollCount++;
        
        try {
          // Check if officially initialized
          const isInitialized = await window.electronAPI.accountState.isInitialized();
          console.log(`[AccountState] Poll #${pollCount}: Initialization check:`, isInitialized);
          
          if (isInitialized) {
            console.log('[AccountState] Account state initialization complete');
            await this.updateUIFromAccountState();
            return;
          }
          
          // Also try to get the state even if not officially "initialized"
          // This helps with timing issues
          try {
            const accountState = await window.electronAPI.accountState.getState();
            if (accountState) {
              const hasArweave = accountState.arweave && accountState.arweave.hasAccount;
              const hasATProto = accountState.atproto && accountState.atproto.hasAccount;
              const hasX = accountState.x && accountState.x.hasAccount;
              
              console.log(`[AccountState] Poll #${pollCount}: State available - Arweave: ${hasArweave}, ATProto: ${hasATProto}, X: ${hasX}`);
              
              if (hasArweave || hasATProto || hasX) {
                console.log('[AccountState] Found account state before official initialization, updating UI');
                await this.updateUIFromAccountState();
                return;
              }
            }
          } catch (stateError) {
            console.log(`[AccountState] Poll #${pollCount}: State check error:`, stateError.message);
          }
          
        } catch (pollError) {
          console.warn(`[AccountState] Poll #${pollCount}: Polling error:`, pollError.message);
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
      
      console.warn(`[AccountState] Account state initialization timed out after ${pollCount} polls`);
      
      // Try to update UI anyway with whatever state we have
      console.log('[AccountState] Attempting final UI update after timeout...');
      try {
        await this.updateUIFromAccountState();
        console.log('[AccountState] Final UI update succeeded');
      } catch (error) {
        console.error('[AccountState] Failed to update UI after timeout:', error);
      }
      
    } catch (error) {
      console.error('[AccountState] Failed to wait for account state initialization:', error);
      console.error('[AccountState] Error stack:', error.stack);
      
      // Try to update UI anyway
      console.log('[AccountState] Attempting fallback UI update...');
      try {
        await this.updateUIFromAccountState();
        console.log('[AccountState] Fallback UI update succeeded');
      } catch (uiError) {
        console.error('[AccountState] Failed to update UI after error:', uiError);
      }
    }
  }

  /**
   * Update all UI elements based on centralized account state
   */
  async updateUIFromAccountState() {
    console.log('[AccountState] Updating UI from centralized account state...');
    
    try {
      console.log('[AccountState] Requesting account state from backend...');
      const accountState = await window.electronAPI.accountState.getState();
      console.log('[AccountState] Received account state:', JSON.stringify(accountState, null, 2));
      
      if (!accountState) {
        console.warn('[AccountState] No account state available, trying platform-specific calls...');
        
        // Fallback: try to get platform states individually
        try {
          const [arweaveState, atprotoState, xState] = await Promise.allSettled([
            window.electronAPI.accountState.getPlatformState('arweave'),
            window.electronAPI.accountState.getPlatformState('atproto'),
            window.electronAPI.accountState.getPlatformState('x')
          ]);
          
          if (arweaveState.status === 'fulfilled' && arweaveState.value) {
            console.log('[AccountState] Fallback: Got Arweave state:', arweaveState.value);
            this.updateArweaveUI(arweaveState.value);
          }
          
          if (atprotoState.status === 'fulfilled' && atprotoState.value) {
            console.log('[AccountState] Fallback: Got AT Protocol state:', atprotoState.value);
            this.updateATProtoUI(atprotoState.value);
          }
          
          if (xState.status === 'fulfilled' && xState.value) {
            console.log('[AccountState] Fallback: Got X state:', xState.value);
            this.updateXUI(xState.value);
          }
        } catch (fallbackError) {
          console.error('[AccountState] Fallback platform state calls failed:', fallbackError);
        }
        
        // Also update Farcaster footer (not centrally managed yet)
        this.updateFooterFarcaster();
        return;
      }
      
      // Update Arweave display
      if (accountState.arweave) {
        console.log('[AccountState] Updating Arweave UI with state:', accountState.arweave);
        this.updateArweaveUI(accountState.arweave);
      } else {
        console.log('[AccountState] No Arweave state available');
        this.updateArweaveUI({ hasAccount: false, isValid: false });
      }
      
      // Update AT Protocol display
      if (accountState.atproto) {
        console.log('[AccountState] Updating AT Protocol UI with state:', accountState.atproto);
        this.updateATProtoUI(accountState.atproto);
      } else {
        console.log('[AccountState] No AT Protocol state available');
        this.updateATProtoUI({ hasAccount: false, isValid: false });
      }
      
      // Update X display
      if (accountState.x) {
        console.log('[AccountState] Updating X UI with state:', accountState.x);
        this.updateXUI(accountState.x);
      } else {
        console.log('[AccountState] No X state available');
        this.updateXUI({ hasAccount: false, isValid: false });
      }
      
      // Also update Farcaster footer (not centrally managed yet)
      this.updateFooterFarcaster();
      
      console.log('[AccountState] UI updated from centralized state successfully');
      
    } catch (error) {
      console.error('[AccountState] Failed to update UI from account state:', error);
      console.error('[AccountState] Error details:', error.message, error.stack);
      
      // Final fallback: try to update individual components with default states
      console.log('[AccountState] Attempting final fallback with default states...');
      try {
        this.updateArweaveUI({ hasAccount: false, isValid: false });
        this.updateATProtoUI({ hasAccount: false, isValid: false });
        this.updateXUI({ hasAccount: false, isValid: false });
        this.updateFooterFarcaster();
      } catch (fallbackError) {
        console.error('[AccountState] Final fallback also failed:', fallbackError);
      }
    }
  }

  /**
   * Update Arweave UI elements
   */
  updateArweaveUI(arweaveState) {
    console.log('[AccountState] updateArweaveUI called with:', arweaveState);
    
    const walletAddressElement = document.getElementById('wallet-address');
    const balanceElement = document.querySelector('.balance-value');
    
    if (!walletAddressElement || !balanceElement) {
      console.warn('[AccountState] Arweave UI elements not found');
      return;
    }
    
    if (arweaveState.hasAccount && arweaveState.isValid && arweaveState.address) {
      console.log('[AccountState] Displaying connected Arweave account:', arweaveState.address);
      
      // Show shortened address
      const shortAddress = `${arweaveState.address.substring(0, 6)}...${arweaveState.address.substring(arweaveState.address.length - 4)}`;
      walletAddressElement.textContent = shortAddress;
      walletAddressElement.title = arweaveState.address;
      walletAddressElement.classList.add('configured');
      
      // Update footer
      console.log('[AccountState] Updating footer Arweave with:', arweaveState.address);
      this.updateFooterArweave(arweaveState.address, true);
      
      // Update balance
      if (arweaveState.balance !== null && arweaveState.balance !== undefined) {
        const formattedBalance = `${parseFloat(arweaveState.balance).toFixed(4)} AR`;
        console.log('[AccountState] Setting balance to:', formattedBalance);
        balanceElement.textContent = formattedBalance;
      } else {
        console.log('[AccountState] No balance available, showing loading...');
        balanceElement.textContent = 'Loading...';
      }
    } else {
      console.log('[AccountState] No valid Arweave account, showing disconnected state');
      walletAddressElement.textContent = arweaveState.error || 'Not configured';
      walletAddressElement.title = '';
      walletAddressElement.classList.remove('configured');
      balanceElement.textContent = '--';
      
      // Update footer
      this.updateFooterArweave(null, false);
    }
  }

  /**
   * Update AT Protocol UI elements
   */
  updateATProtoUI(atprotoState) {
    console.log('[AccountState] updateATProtoUI called with:', atprotoState);
    
    if (atprotoState.hasAccount && atprotoState.isValid && atprotoState.handle) {
      console.log('[AccountState] Displaying connected AT Protocol account:', atprotoState.handle);
      
      // Update footer
      console.log('[AccountState] Updating footer Bluesky with:', atprotoState.handle);
      this.updateFooterBluesky(true, atprotoState.handle);
      
      // Update broadcast panel indicator
      const indicator = document.querySelector('[data-platform="bluesky"] .connection-status');
      if (indicator) {
        indicator.textContent = 'Connected';
        indicator.className = 'connection-status connected';
        console.log('[AccountState] Updated broadcast panel indicator for Bluesky: Connected');
      } else {
        console.warn('[AccountState] Bluesky broadcast panel indicator not found');
      }
    } else {
      console.log('[AccountState] No valid AT Protocol account, showing disconnected state. Error:', atprotoState.error);
      
      // Update footer
      this.updateFooterBluesky(false);
      
      // Update broadcast panel indicator
      const indicator = document.querySelector('[data-platform="bluesky"] .connection-status');
      if (indicator) {
        const statusText = atprotoState.error || 'Disconnected';
        indicator.textContent = statusText;
        indicator.className = 'connection-status';
        console.log('[AccountState] Updated broadcast panel indicator for Bluesky:', statusText);
      }
    }
  }

  /**
   * Update X UI elements
   */
  updateXUI(xState) {
    if (xState.hasAccount && xState.isValid && xState.username) {
      // Update footer
      this.updateFooterX(true, xState.username);
      
      // Update broadcast panel indicator
      const indicator = document.querySelector('[data-platform="x"] .connection-status');
      if (indicator) {
        indicator.textContent = 'Connected';
        indicator.className = 'connection-status connected';
      }
    } else {
      // Update footer
      this.updateFooterX(false);
      
      // Update broadcast panel indicator
      const indicator = document.querySelector('[data-platform="x"] .connection-status');
      if (indicator) {
        const statusText = xState.error || 'Disconnected';
        indicator.textContent = statusText;
        indicator.className = 'connection-status';
      }
    }
  }

  /**
   * Refresh account state for all platforms
   */
  async refreshAllAccountStates() {
    console.log('[AccountState] Refreshing all account states...');
    this.updateFooterStatus('Refreshing accounts...', false);
    
    try {
      await window.electronAPI.accountState.refreshAll();
      await this.updateUIFromAccountState();
      this.updateFooterStatus('Accounts refreshed', false);
      setTimeout(() => this.updateFooterStatus('Ready', false), 2000);
    } catch (error) {
      console.error('[AccountState] Failed to refresh account states:', error);
      this.showError('Failed to refresh account information');
      this.updateFooterStatus('Error refreshing accounts', true);
    }
  }

  /**
   * Refresh account state for a specific platform
   */
  async refreshPlatformAccountState(platform) {
    console.log(`[AccountState] Refreshing ${platform} account state...`);
    
    try {
      await window.electronAPI.accountState.refreshPlatform(platform);
      await this.updateUIFromAccountState();
    } catch (error) {
      console.error(`[AccountState] Failed to refresh ${platform} account state:`, error);
      this.showError(`Failed to refresh ${platform} account information`);
    }
  }

  // Add a method to update all platform status including footer (kept for backward compatibility)
  async updateAllPlatformStatus() {
    // Use centralized account state instead
    await this.updateUIFromAccountState();
  }

  async handleNewPost(e) {
    console.log('[Broadcast] Handling new post...');
    
    try {
      const action = e.submitter.dataset.action;
      const content = document.getElementById('post-content').value;
      const platforms = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
        .map(cb => cb.value);
      const scheduledFor = document.getElementById('post-schedule').value || undefined;

      console.log('[Broadcast] Post details:', { action, platforms, contentLength: content.length, scheduledFor });

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
        console.log('[Broadcast] Attempting to post to platforms immediately');
        
        const postResults = {};
        let hasErrors = false;
        
        for (const platform of platforms) {
          console.log(`[Broadcast] Posting to ${platform}...`);
          
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
                console.log(`[Broadcast] Successfully posted to ${platform}:`, postUrl);
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
                console.log(`[Broadcast] Successfully posted to ${platform}:`, postUrl);
              } else {
                throw new Error('Post returned no URL');
              }
            } else {
              // Handle other platforms here in the future
              console.log(`[Broadcast] Platform ${platform} not yet implemented`);
              postResults[platform] = { success: false, error: 'Platform not implemented' };
            }
          } catch (error) {
            console.error(`[Broadcast] Failed to post to ${platform}:`, error);
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
      this.closeModal();
      
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
      console.error('[Broadcast] Failed to create post:', error);
      this.showError('Failed to create post');
    }
  }

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

  // Global Search Methods
  setupGlobalSearchEvents() {
    const searchInput = document.getElementById('global-search-input');
    const searchResults = document.getElementById('global-search-results');

    // Handle search input
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.performGlobalSearch(e.target.value);
      }, 300); // Debounce search
    });

    // Handle keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.openGlobalSearchModal();
      }
    });
  }

  openGlobalSearchModal() {
    this.openModal('global-search-modal');
    // Focus the search input after a brief delay to ensure modal is visible
    setTimeout(() => {
      const searchInput = document.getElementById('global-search-input');
      if (searchInput) {
        searchInput.focus();
        searchInput.value = ''; // Clear previous search
        this.clearGlobalSearchResults();
      }
    }, 100);
  }

  async performGlobalSearch(query) {
    const resultsContainer = document.getElementById('global-search-results');
    
    if (!query.trim()) {
      this.clearGlobalSearchResults();
      return;
    }

    // Show loading state
    resultsContainer.innerHTML = '<div class="search-results-empty">Searching...</div>';

    try {
      const results = await this.searchAllData(query);
      this.renderGlobalSearchResults(results);
    } catch (error) {
      console.error('Global search error:', error);
      resultsContainer.innerHTML = '<div class="search-results-empty">Search error occurred</div>';
    }
  }

  async searchAllData(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    // Search Collate resources
    if (this.data.collate && this.data.collate.resources) {
      this.data.collate.resources.forEach(resource => {
        const titleMatch = resource.title.toLowerCase().includes(lowerQuery);
        const descMatch = (resource.description || '').toLowerCase().includes(lowerQuery);
        const urlMatch = resource.url.toLowerCase().includes(lowerQuery);
        const tagMatch = resource.tags.some(tag => tag.toLowerCase().includes(lowerQuery));

        if (titleMatch || descMatch || urlMatch || tagMatch) {
          results.push({
            type: 'resource',
            title: resource.title,
            description: resource.description || resource.url,
            source: 'Collate',
            data: resource
          });
        }
      });
    }

    // Search Archive uploads (if available)
    if (this.data.archive && this.data.archive.uploads) {
      this.data.archive.uploads.forEach(upload => {
        const nameMatch = upload.filename.toLowerCase().includes(lowerQuery);
        const idMatch = upload.id.toLowerCase().includes(lowerQuery);

        if (nameMatch || idMatch) {
          results.push({
            type: 'upload',
            title: upload.filename,
            description: `Uploaded: ${new Date(upload.uploadedAt).toLocaleDateString()}`,
            source: 'Archive',
            data: upload
          });
        }
      });
    }

    // Search Broadcast posts (if available)
    if (this.data.broadcast && this.data.broadcast.posts) {
      this.data.broadcast.posts.forEach(post => {
        const contentMatch = post.content.toLowerCase().includes(lowerQuery);

        if (contentMatch) {
          results.push({
            type: 'post',
            title: post.content.substring(0, 50) + (post.content.length > 50 ? '...' : ''),
            description: `${post.status} • ${post.platforms.join(', ')}`,
            source: 'Broadcast',
            data: post
          });
        }
      });
    }

    return results;
  }

  renderGlobalSearchResults(results) {
    const resultsContainer = document.getElementById('global-search-results');

    if (results.length === 0) {
      resultsContainer.innerHTML = '<div class="search-results-empty">No results found</div>';
      return;
    }

    const resultsHtml = results.map(result => `
      <div class="search-result-item" data-type="${result.type}" data-source="${result.source}">
        <div class="search-result-title">${this.escapeHtml(result.title)}</div>
        <div class="search-result-description">${this.escapeHtml(result.description)}</div>
        <div class="search-result-source">${result.source} • ${result.type}</div>
      </div>
    `).join('');

    resultsContainer.innerHTML = resultsHtml;

    // Add click handlers for search results
    resultsContainer.querySelectorAll('.search-result-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        this.handleGlobalSearchResultClick(results[index]);
      });
    });
  }

  async handleGlobalSearchResultClick(result) {
    this.closeModal();

    // Switch to the appropriate tool and highlight the result
    switch (result.source.toLowerCase()) {
      case 'collate':
        await this.switchTool('collate');
        // Optionally highlight the specific resource
        break;
      case 'archive':
        await this.switchTool('archive');
        break;
      case 'broadcast':
        await this.switchTool('broadcast');
        break;
    }
  }

  clearGlobalSearchResults() {
    const resultsContainer = document.getElementById('global-search-results');
    resultsContainer.innerHTML = '<div class="search-results-empty">Type to search across all tools and resources...</div>';
  }

  // Modal Management
  openModal(modalId) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('modal-overlay');
      const modal = document.getElementById(modalId);
      
      // Check if required elements exist
      if (!overlay) {
        console.error('Modal overlay element not found');
        return resolve();
      }
      
      if (!modal) {
        console.error(`Modal element '${modalId}' not found`);
        return resolve();
      }
      
      // Hide all modals
      document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
      
      // Show target modal
      modal.style.display = 'block';
      overlay.classList.add('active');
      
      // Give the browser a moment to render the modal
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
  }

  closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) {
      console.error('Modal overlay element not found');
      return;
    }
    
    overlay.classList.remove('active');
    
    // Reset resource modal if it was being used for editing
    if (this.editingResourceId) {
      this.resetResourceModal();
    }
    
    // Reset template form if the template modal is closing
    const templateModal = document.getElementById('new-template-modal');
    if (templateModal && templateModal.style.display !== 'none') {
      this.resetTemplateForm();
    }
  }

  // Utility Methods
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showNotification(message, type) {
    // Simple notification system
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      animation: slideIn 0.3s ease;
      background-color: ${type === 'success' ? 'var(--success-color)' : 'var(--error-color)'};
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  updateArchiveTagFilterButtons() {
    const filterItems = document.querySelectorAll('#archive-tag-filter-list .archive-tag-filter');
    filterItems.forEach(item => {
      const tag = item.dataset.tag;
      if (this.activeArchiveTagFilters.has(tag)) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  showArchiveTagContextMenu(tag, x, y) {
    // Hide any existing menus first
    this.hideAllArchiveTagDropdowns();
    
    const menu = document.querySelector(`#archive-tag-filter-list .archive-tag-dropdown-menu[data-tag="${tag}"]`);
    if (menu) {
      menu.style.display = 'block';
      menu.style.position = 'fixed';
      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;
      menu.style.zIndex = '1001';
      
      // Hide menu after a delay or on document click
      setTimeout(() => {
        document.addEventListener('click', this.handleArchiveTagContextMenuClick.bind(this), { once: true });
      }, 10);
    }
  }

  hideAllArchiveTagDropdowns() {
    const menus = document.querySelectorAll('.archive-tag-dropdown-menu');
    menus.forEach(menu => {
      menu.style.display = 'none';
      menu.style.position = '';
      menu.style.left = '';
      menu.style.top = '';
    });
  }

  handleArchiveTagContextMenuClick(e) {
    // Don't hide if clicking within a menu
    if (e.target.closest('.archive-tag-dropdown-menu')) {
      return;
    }
    this.hideAllArchiveTagDropdowns();
  }

  openEditArchiveTagModal(tag) {
    console.log('Opening edit modal for archive tag:', tag);
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Edit Archive Tag</h3>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-content">
          <p>Rename the tag "<strong>${this.escapeHtml(tag)}</strong>" across all archive files:</p>
          <div class="form-group">
            <label for="edit-archive-tag-input">New tag name:</label>
            <input type="text" id="edit-archive-tag-input" value="${tag}" placeholder="Enter new tag name">
          </div>
          <div class="form-actions">
            <button class="secondary-btn cancel-btn">Cancel</button>
            <button class="primary-btn rename-btn">Rename Tag</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    
    // Add the active class to make it visible
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);
    
    // Set up event listeners
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const renameBtn = modal.querySelector('.rename-btn');
    const input = modal.querySelector('#edit-archive-tag-input');

    // Close handlers
    const closeModal = () => {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 200); // Wait for transition
    };
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    // Rename handler
    renameBtn.addEventListener('click', () => {
      this.handleRenameArchiveTag(tag, input.value);
    });

    // Focus and select the input
    input.focus();
    input.select();

    // Handle Enter key
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleRenameArchiveTag(tag, input.value);
      } else if (e.key === 'Escape') {
        closeModal();
      }
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  async handleRenameArchiveTag(oldTag, newTag) {
    console.log('handleRenameArchiveTag called with:', { oldTag, newTag });
    
    try {
      // Close the modal
      const modal = document.querySelector('.modal-overlay');
      if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 200);
      }

      // Validate input
      const trimmedNewTag = newTag.trim();
      console.log('Trimmed new tag:', trimmedNewTag);
      
      if (!trimmedNewTag) {
        this.showError('New tag name cannot be empty');
        return;
      }

      if (trimmedNewTag === oldTag) {
        this.showError('New tag name must be different from the current name');
        return;
      }

      console.log('Renaming archive tag:', { oldTag, newTag: trimmedNewTag });

      // Find all files that have the old tag and rename it
      let filesUpdated = 0;
      
      if (this.data.archive && this.data.archive.files) {
        this.data.archive.files.forEach(file => {
          if (file.tags && file.tags.includes(oldTag)) {
            // Replace old tag with new tag
            file.tags = file.tags.map(tag => tag === oldTag ? trimmedNewTag : tag);
            
            // If the new tag already exists on this file, remove duplicates
            file.tags = [...new Set(file.tags)];
            
            filesUpdated++;
          }
        });
      }

      if (filesUpdated === 0) {
        this.showError(`Tag "${oldTag}" was not found on any files`);
        return;
      }

      // Save the updated archive data
      await window.electronAPI.archive.saveData(this.data.archive);
      
      console.log('Archive tag rename completed, reloading data...');
      
      // Reload archive data to reflect changes
      await this.loadArchiveData();

      this.showSuccess(`Tag renamed from "${oldTag}" to "${trimmedNewTag}" on ${filesUpdated} file${filesUpdated === 1 ? '' : 's'}`);
    } catch (error) {
      console.error('Failed to rename archive tag:', error);
      this.showError('Failed to rename archive tag: ' + error.message);
    }
  }

  confirmDeleteArchiveTag(tag) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Remove Archive Tag</h3>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-content">
          <p>Are you sure you want to remove the tag "<strong>${this.escapeHtml(tag)}</strong>" from all archive files?</p>
          <p><small>This action cannot be undone.</small></p>
          <div class="form-actions">
            <button class="secondary-btn cancel-btn">Cancel</button>
            <button class="primary-btn delete-btn" style="background-color: var(--error-color);">Remove Tag</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    
    // Add the active class to make it visible
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);

    // Set up event listeners
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const deleteBtn = modal.querySelector('.delete-btn');

    // Close handlers
    const closeModal = () => {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 200);
    };
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    // Delete handler
    deleteBtn.addEventListener('click', () => {
      this.handleDeleteArchiveTag(tag);
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  async handleDeleteArchiveTag(tag) {
    console.log('handleDeleteArchiveTag called with tag:', tag);
    
    try {
      // Close the modal
      const modal = document.querySelector('.modal-overlay');
      if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 200);
      }

      console.log('Deleting archive tag:', tag);

      // Find all files that have this tag and remove it
      let filesUpdated = 0;
      
      if (this.data.archive && this.data.archive.files) {
        this.data.archive.files.forEach(file => {
          if (file.tags && file.tags.includes(tag)) {
            file.tags = file.tags.filter(t => t !== tag);
            filesUpdated++;
          }
        });
      }

      if (filesUpdated === 0) {
        this.showError(`Tag "${tag}" was not found on any files`);
        return;
      }

      // Save the updated archive data
      await window.electronAPI.archive.saveData(this.data.archive);
      
      console.log('Archive tag delete completed, reloading data...');
      
      // Reload archive data to reflect changes
      await this.loadArchiveData();

      this.showSuccess(`Tag "${tag}" removed from ${filesUpdated} file${filesUpdated === 1 ? '' : 's'}`);
    } catch (error) {
      console.error('Failed to delete archive tag:', error);
      this.showError('Failed to delete archive tag: ' + error.message);
    }
  }

  // Marbling Background Management
  initializeMarblingBackground() {
    const canvas = document.getElementById('marbling-canvas');
    if (!canvas) {
      console.warn('Marbling canvas not found');
      return;
    }

    try {
          // Use the meridianDefault preset for professional appearance
    this.marblingRenderer = new OrganicWaveRenderer(canvas, OrganicWaveRenderer.presets.meridianDefault);
      console.log('Marbling background initialized successfully');
    } catch (error) {
      console.error('Failed to initialize marbling background:', error);
    }
  }

  cleanupMarblingBackground() {
    if (this.marblingRenderer) {
      this.marblingRenderer.stop();
      this.marblingRenderer = null;
      console.log('Marbling background cleaned up');
    }
  }

  restoreResourceCollapseState() {
    // Restore global button state
    const globalBtn = document.getElementById('collapse-all-btn');
    if (globalBtn) {
      globalBtn.dataset.state = this.collateCollapseState.globalState;
      globalBtn.title = this.collateCollapseState.globalState === 'collapsed' ? 'Expand All Resources' : 'Collapse All Resources';
    }
    
    // Restore individual item states
    document.querySelectorAll('.resource-item').forEach(item => {
      const resourceId = item.dataset.id;
      if (this.collateCollapseState.collapsedItems.has(resourceId)) {
        item.classList.add('collapsed');
      }
    });
  }

  restoreArchiveCollapseState() {
    // Restore global button state
    const globalBtn = document.getElementById('archive-collapse-all-btn');
    if (globalBtn) {
      globalBtn.dataset.state = this.archiveCollapseState.globalState;
      globalBtn.title = this.archiveCollapseState.globalState === 'collapsed' ? 'Expand All Files' : 'Collapse All Files';
    }
    
    // Restore individual item states
    document.querySelectorAll('.archive-item').forEach(item => {
      const fileUuid = item.dataset.uuid;
      if (this.archiveCollapseState.collapsedItems.has(fileUuid)) {
        item.classList.add('collapsed');
      }
    });
  }

  async loadAppVersion() {
    try {
      const version = await window.electronAPI.getAppVersion();
      const versionDisplay = document.getElementById('version-display');
      if (versionDisplay) {
        versionDisplay.textContent = `v${version}`;
      }
    } catch (error) {
      console.error('Failed to load app version:', error);
      // Fallback to hardcoded version if API fails
      const versionDisplay = document.getElementById('version-display');
      if (versionDisplay) {
        versionDisplay.textContent = 'v0.1.0';
      }
    }
  }
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  
  .post-item {
    padding: var(--spacing-md);
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius);
    background-color: var(--surface-bg-elevated);
    margin-bottom: var(--spacing-md);
  }
  
  .post-content {
    margin-bottom: var(--spacing-sm);
    font-size: var(--font-size-base);
  }
  
  .post-meta {
    display: flex;
    gap: var(--spacing-md);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
  
  .post-status {
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
    background-color: var(--surface-border);
    color: var(--text-primary);
  }
`;
document.head.appendChild(style);

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  const meridianApp = new MeridianApp();
window.meridianApp = meridianApp;
}); 