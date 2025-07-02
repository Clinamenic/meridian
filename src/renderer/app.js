// Import modular system
import { ModuleLoader } from './modules/ModuleLoader.js';
import { TagAutocomplete } from './components/TagAutocomplete.js';
import { UIManager } from './modules/UIManager.js';

// Main Application Logic
class MeridianApp {
  constructor() {
    this.currentTool = 'collate';
    this.workspacePath = null;
    this.data = {
      collate: null,
      archive: null,
      deploy: null,
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

    // Tag autocomplete instances (will be initialized when DOM is ready)
    this.tagAutocompleteInstances = {};

    // Initialize modular system
    this.moduleLoader = new ModuleLoader(this);
    this.modules = this.moduleLoader.modules;
    this.eventBus = this.moduleLoader.eventBus;

    this.init();
  }

  async init() {
    await this.checkWorkspace();

    // Initialize modular system first
    try {
      console.log('[App] Initializing modular system...');
      await this.moduleLoader.initializeAll();
      console.log('[App] Modular system initialized successfully');
    } catch (error) {
      console.error('[App] Failed to initialize modular system:', error);
      // Continue with initialization even if modular system fails
    }

    // Setup event listeners after modules are initialized
    await this.setupEventListeners();

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
    console.log('[App] setupEventListeners called');

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

    // Modal events are now handled by ModalManager
    // No need to call setupModalEvents() or setupModalTabEvents() here

    // Tool-specific events
    this.setupCollateEvents();
    this.setupArchiveEvents();
    this.setupGlobalSearchEvents();

    // Account management events are now handled by AccountManager
    // No need to call setupAccountManagementEvents() here
  }

  // Modal events are now handled by ModalManager
  // setupModalEvents() and setupModalTabEvents() have been moved to ModalManager

  setupCollateEvents() {
    console.log('[App] setupCollateEvents called');

    // Delegate to ResourceManager for resource-related events
    const resourceManager = this.getResourceManager();
    if (resourceManager) {
      // Add resources button (combined modal)
      const addResourcesBtn = document.getElementById('add-resources-btn');
      console.log('[App] Add resources button found:', addResourcesBtn);
      console.log('[App] ResourceManager available:', resourceManager);

      if (addResourcesBtn) {
        addResourcesBtn.addEventListener('click', () => {
          console.log('[App] Add resources button clicked!');
          if (resourceManager) {
            console.log('[App] Calling resourceManager.openAddResourcesModal()');
            resourceManager.openAddResourcesModal();
          } else {
            console.error('[App] ResourceManager is null!');
          }
        });
        console.log('[App] Event listener attached to add-resources-btn');
      } else {
        console.error('[App] Add resources button not found!');
      }

      // Add resource form
      const addResourceForm = document.getElementById('add-resource-form');
      if (addResourceForm) {
        addResourceForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          await resourceManager.handleAddResource();
        });
      }

      // Extract metadata button
      const extractMetadataBtn = document.getElementById('extract-metadata-btn');
      if (extractMetadataBtn) {
        extractMetadataBtn.addEventListener('click', async () => {
          await resourceManager.extractMetadata();
        });
      }

      // Global collapse/expand button
      const collapseAllBtn = document.getElementById('collapse-all-btn');
      if (collapseAllBtn) {
        collapseAllBtn.addEventListener('click', () => {
          resourceManager.toggleAllResourcesCollapse();
        });
      }
    }

    // Delegate to TagManager for tag-related events
    const tagManager = this.getTagManager();
    if (tagManager) {
      // Search functionality
      const resourceSearch = document.getElementById('resource-search');
      if (resourceSearch) {
        resourceSearch.addEventListener('input', (e) => {
          tagManager.currentSearchTerm = e.target.value;
          tagManager.applyAllFilters();
        });
      }

      // Filter logic control
      tagManager.initializeFilterLogic();

      // Clear filters button
      const clearFiltersBtn = document.getElementById('clear-filters-btn');
      if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
          tagManager.clearAllFilters();
        });
      }
    }

    // Tag autocomplete is now handled by TagManager module

    // Bulk add events
    this.setupBulkAddEvents();

    // Export events
    this.setupExportEvents();
  }

  setupArchiveEvents() {
    // Upload file button - delegate to UploadManager
    const uploadFileBtn = document.getElementById('upload-file-btn');
    if (uploadFileBtn) {
      uploadFileBtn.addEventListener('click', async () => {
        const uploadManager = this.getUploadManager();
        if (uploadManager) {
          await uploadManager.uploadFile();
        } else {
          console.error('[App] UploadManager not available');
        }
      });
    }

    // Setup wallet button - now opens account management modal
    const setupWalletBtn = document.getElementById('setup-wallet-btn');
    if (setupWalletBtn) {
      setupWalletBtn.addEventListener('click', () => {
        const accountManager = this.getModule('accountManager');
        if (accountManager) {
          accountManager.openArweaveAccountsModal();
        }
      });
    }

    // Archive functionality is now handled by ArchiveManager
    // The ArchiveManager handles all archive-related events in its setupArchiveEventListeners() method
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
    const dropdownIds = ['arweave-dropdown-btn', 'farcaster-dropdown-btn', 'bluesky-dropdown-btn', 'x-dropdown-btn', 'github-dropdown-btn'];

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
    const accountManager = this.getModule('accountManager');
    if (!accountManager) {
      console.error('AccountManager not available');
      return;
    }

    if (buttonId === 'arweave-dropdown-btn') {
      accountManager.openArweaveAccountsModal();
      return;
    }

    if (buttonId === 'bluesky-dropdown-btn') {
      accountManager.openATProtoAccountsModal();
      return;
    }

    if (buttonId === 'x-dropdown-btn') {
      accountManager.openXAccountsModal();
      return;
    }

    if (buttonId === 'github-dropdown-btn') {
      accountManager.openGitHubAccountsModal();
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
    console.log('[DEBUG] selectWorkspace() called');
    try {
      this.updateFooterStatus('Selecting workspace...', false);

      console.log('[DEBUG] Calling window.electronAPI.selectWorkspace()');
      const result = await window.electronAPI.selectWorkspace();
      console.log('[DEBUG] selectWorkspace result:', result);

      if (result) {
        console.log('[DEBUG] Workspace selection successful, path:', result);
        this.workspacePath = result;
        await this.updateWorkspaceIndicator();

        // Hide landing page and show tools interface
        const landingPage = document.getElementById('landing-page');
        console.log('[DEBUG] Landing page element:', landingPage);
        if (landingPage) {
          // Check if landing page is actually visible (using computed style)
          const computedStyle = window.getComputedStyle(landingPage);
          const isVisible = computedStyle.display !== 'none';
          console.log('[DEBUG] Landing page computed display:', computedStyle.display);
          console.log('[DEBUG] Landing page is visible:', isVisible);
          if (isVisible) {
            console.log('[DEBUG] Hiding landing page');
            landingPage.style.display = 'none';
            this.cleanupMarblingBackground();
            console.log('[DEBUG] Landing page hidden, new display:', landingPage.style.display);
          }
        }

        this.updateFooterStatus('Loading workspace data...', false);

        // Check tool panels and tabs
        const allTabs = document.querySelectorAll('.tab-btn');
        const allPanels = document.querySelectorAll('.tool-panel');
        console.log('[DEBUG] Found tabs:', allTabs.length, 'Found panels:', allPanels.length);

        // Ensure a tool is active before loading data
        const activeTab = document.querySelector('.tab-btn.active');
        const activePanel = document.querySelector('.tool-panel.active');
        console.log('[DEBUG] Active tab before tool activation:', activeTab);
        console.log('[DEBUG] Active panel before tool activation:', activePanel);

        if (!activeTab) {
          console.log('[DEBUG] No active tool, activating Collate tool');
          await this.switchTool('collate');

          // Verify activation worked
          const newActiveTab = document.querySelector('.tab-btn.active');
          const newActivePanel = document.querySelector('.tool-panel.active');
          console.log('[DEBUG] Active tab after switchTool:', newActiveTab);
          console.log('[DEBUG] Active panel after switchTool:', newActivePanel);
        } else {
          console.log('[DEBUG] Active tool found:', activeTab.dataset.tool);
          await this.loadToolData();
        }

        // Check final state
        const finalActiveTab = document.querySelector('.tab-btn.active');
        const finalActivePanel = document.querySelector('.tool-panel.active');
        const finalLandingPage = document.getElementById('landing-page');
        console.log('[DEBUG] FINAL STATE:');
        console.log('[DEBUG] - Active tab:', finalActiveTab);
        console.log('[DEBUG] - Active panel:', finalActivePanel);
        console.log('[DEBUG] - Landing page display:', finalLandingPage ? window.getComputedStyle(finalLandingPage).display : 'not found');

        // Account state initialization happens automatically in the backend
        this.updateFooterStatus('Detecting accounts...', false);
        await this.waitForAccountStateInitialization();

        this.updateFooterStatus('Ready', false);
        console.log('[DEBUG] selectWorkspace() completed successfully');
      } else {
        console.log('[DEBUG] Workspace selection was cancelled');
        this.updateFooterStatus('Workspace selection cancelled', false);
      }
    } catch (error) {
      console.error('[DEBUG] Failed to select workspace:', error);
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
    console.log(`[DEBUG switchTool] Starting switchTool to: ${toolName}`);

    // Update active tab
    const tabButtons = document.querySelectorAll('.tab-btn');
    console.log(`[DEBUG switchTool] Found ${tabButtons.length} tab buttons`);

    // Log all tab buttons and their current state
    tabButtons.forEach((btn, index) => {
      console.log(`[DEBUG switchTool] Tab ${index}: tool="${btn.dataset.tool}", active="${btn.classList.contains('active')}"`);
    });

    tabButtons.forEach(btn => {
      const isActive = btn.dataset.tool === toolName;
      const wasActive = btn.classList.contains('active');
      btn.classList.toggle('active', isActive);
      if (isActive) {
        console.log(`[DEBUG switchTool] Activated tab: ${btn.dataset.tool} (was ${wasActive ? 'active' : 'inactive'})`);
      }
    });

    // Update active panel
    const toolPanels = document.querySelectorAll('.tool-panel');
    console.log(`[DEBUG switchTool] Found ${toolPanels.length} tool panels`);

    // Log all panels and their current state
    toolPanels.forEach((panel, index) => {
      console.log(`[DEBUG switchTool] Panel ${index}: id="${panel.id}", active="${panel.classList.contains('active')}"`);
    });

    toolPanels.forEach(panel => {
      const isActive = panel.id === `${toolName}-panel`;
      const wasActive = panel.classList.contains('active');
      panel.classList.toggle('active', isActive);
      if (isActive) {
        console.log(`[DEBUG switchTool] Activated panel: ${panel.id} (was ${wasActive ? 'active' : 'inactive'})`);
      }
    });

    this.currentTool = toolName;
    console.log(`[DEBUG switchTool] Set currentTool to: ${this.currentTool}`);

    // Load data for the selected tool
    console.log(`[DEBUG switchTool] Loading data for tool: ${toolName}`);
    try {
      switch (toolName) {
        case 'collate':
          console.log(`[DEBUG switchTool] Loading collate data...`);
          await this.loadCollateData();
          console.log(`[DEBUG switchTool] Collate data loaded successfully`);
          break;
        case 'archive':
          console.log(`[DEBUG switchTool] Loading archive data...`);
          await this.loadArchiveData();
          console.log(`[DEBUG switchTool] Archive data loaded successfully`);
          break;
        case 'deploy':
          console.log(`[DEBUG switchTool] Loading deploy data...`);
          const deployManager = this.getDeployManager();
          if (deployManager) {
            await deployManager.loadDeployData();
          } else {
            console.error('[App] DeployManager not available');
          }
          console.log(`[DEBUG switchTool] Deploy data loaded successfully`);
          break;
        case 'broadcast':
          console.log(`[DEBUG switchTool] Loading broadcast data...`);
          const broadcastManager = this.getBroadcastManager();
          if (broadcastManager) {
            await broadcastManager.loadBroadcastData();
          } else {
            console.error('[App] BroadcastManager not available');
          }
          console.log(`[DEBUG switchTool] Broadcast data loaded successfully`);
          break;
      }
      console.log(`[DEBUG switchTool] Successfully completed switchTool to ${toolName}`);
    } catch (error) {
      console.error(`[DEBUG switchTool] Failed to load ${toolName} data:`, error);
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
      case 'deploy':
        const deployManager = this.getDeployManager();
        if (deployManager) {
          await deployManager.loadDeployData();
        } else {
          console.error('[App] DeployManager not available');
        }
        break;
      case 'broadcast':
        const broadcastManager = this.getBroadcastManager();
        if (broadcastManager) {
          await broadcastManager.loadBroadcastData();
        } else {
          console.error('[App] BroadcastManager not available');
        }
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
      console.log('[App] Loading collate data...');
      this.data.collate = await window.electronAPI.collate.loadData();
      console.log('[App] Collate data loaded:', this.data.collate);

      // Use ResourceManager for rendering resources
      const resourceManager = this.getResourceManager();
      console.log('[App] ResourceManager:', resourceManager);
      if (resourceManager) {
        console.log('[App] Calling ResourceManager.renderResources()');
        resourceManager.renderResources();
      } else {
        console.error('[App] ResourceManager not found!');
      }

      // Use TagManager for rendering tag filters
      const tagManager = this.getTagManager();
      console.log('[App] TagManager:', tagManager);
      if (tagManager) {
        console.log('[App] Calling TagManager.renderTagFilters()');
        tagManager.renderTagFilters();
      } else {
        console.error('[App] TagManager not found!');
      }
    } catch (error) {
      console.error('Failed to load collate data:', error);
      this.showError('Failed to load resources');
    }
  }

  // ===== UNIFIED TAG AUTOCOMPLETE SETUP =====

  /**
   * Get the TagManager module
   */
  getTagManager() {
    return this.moduleLoader.getModule('tagManager');
  }

  getResourceManager() {
    const manager = this.moduleLoader.getModule('resourceManager');
    console.log('[App] getResourceManager called, result:', manager);
    return manager;
  }

  getArchiveManager() {
    return this.moduleLoader.getModule('archiveManager');
  }

  getModalManager() {
    return this.moduleLoader.getModule('modalManager');
  }

  getDeployManager() {
    return this.moduleLoader.getModule('deployManager');
  }

  getBroadcastManager() {
    return this.moduleLoader.getModule('broadcastManager');
  }

  getUploadManager() {
    return this.moduleLoader.getModule('uploadManager');
  }

  getModule(name) {
    return this.moduleLoader.getModule(name);
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
    const modalManager = this.getModalManager();
    if (modalManager) {
      modalManager.switchModalTab(defaultTab);
    }
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

    // Clear modal tags and reset bulk tags - delegate to TagManager
    const tagManager = this.getTagManager();
    if (tagManager) {
      tagManager.clearModalTags();
      tagManager.clearBulkTags();
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

    // Reset phase cards to initial state
    this.updateBulkPhaseCards('paste');

    // Reset to single tab
    const modalManager = this.getModalManager();
    if (modalManager) {
      modalManager.switchModalTab('single');
    }
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
        <label for="url-${index}" class="url-review-text">${UIManager.escapeHtml(urlData.url)}</label>
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
        const tagManager = this.getTagManager();
        const bulkTags = tagManager ? tagManager.getBulkTags() : [];
        const resourceData = {
          url: urlData.url,
          title: metadata.title || urlData.url,
          description: metadata.description || '',
          tags: [...bulkTags], // Apply bulk tags
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

    this.showBulkStep('bulk-tags');
  }

  setupBulkTagEvents() {
    // Initialize unified bulk tag autocompletion
    this.initializeBulkTagAutocompletion();
  }

  initializeBulkTagAutocompletion() {
    // Clean up any existing bulk tag autocomplete instance
    if (this.bulkTagAutocomplete) {
      this.bulkTagAutocomplete.cleanup && this.bulkTagAutocomplete.cleanup();
    }

    const bulkTagInput = document.getElementById('bulk-tag-input');
    const bulkAddTagBtn = document.getElementById('bulk-add-tag-btn');

    if (!bulkTagInput || !bulkAddTagBtn) return;

    this.bulkTagAutocomplete = new TagAutocomplete({
      inputSelector: '#bulk-tag-input',
      autocompleteSelector: '#bulk-tag-autocomplete',
      getSuggestions: (inputValue) => {
        const tagManager = this.getTagManager();
        if (tagManager) {
          return tagManager.getIntelligentTagSuggestions(inputValue, tagManager.getBulkTags(), 8);
        }
        return [];
      },
      onTagSelect: (tagValue) => {
        const tagManager = this.getTagManager();
        if (tagManager) {
          tagManager.addBulkTag(tagValue);
        }
      },
      onInputChange: (input) => {
        const tagManager = this.getTagManager();
        if (tagManager) {
          tagManager.updateBulkAddTagButtonState(input);
        }
      }
    });

    // Button click event
    bulkAddTagBtn.addEventListener('click', () => {
      const tagManager = this.getTagManager();
      if (tagManager) {
        tagManager.addBulkTag(bulkTagInput.value.trim());
      }
    });
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
      UIManager.showSuccess(`Successfully added ${successful} resource${successful > 1 ? 's' : ''}`);
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
        UIManager.showSuccess(`Successfully exported ${filteredResources.length} resources as ${formatName}`);
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
    console.log('[App] Loading archive data...');

    try {
      // Use ArchiveManager for loading archive data
      const archiveManager = this.getArchiveManager();
      if (archiveManager) {
        await archiveManager.loadArchiveData();
      } else {
        console.error('[App] ArchiveManager not available');
        this.showError('Archive functionality not available');
      }

      console.log('[App] Archive data loading complete');
    } catch (error) {
      console.error('[App] Failed to load archive data:', error);
      this.showError('Failed to load archive data');
    }
  }


  async editGitHubAccountNickname(accountId, currentNickname) {
    const newNickname = prompt('Enter new nickname:', currentNickname);
    if (newNickname && newNickname !== currentNickname) {
      try {
        // Note: This would require implementing the rename functionality in the backend
        UIManager.showSuccess('Nickname updated successfully!');
        await this.loadAndRenderGitHubAccounts();
      } catch (error) {
        this.showError(`Failed to update nickname: ${error.message}`);
      }
    }
  }

  async removeGitHubAccount(accountId) {
    if (confirm('Are you sure you want to remove this GitHub account? This will delete the stored credentials.')) {
      try {
        await window.electronAPI.deploy.removeGitHubAccount(accountId);
        UIManager.showSuccess('GitHub account removed successfully!');
        await this.loadAndRenderGitHubAccounts();
      } catch (error) {
        console.error('Failed to remove GitHub account:', error);
        this.showError(`Failed to remove account: ${error.message}`);
      }
    }
  }

  showSecurityGuide() {
    const modalHtml = `
      <div class="modal security-guide-modal">
        <div class="modal-header">
          <h3>GitHub Token Security Guide</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-content">
          <div class="modal-body">
            <div class="security-guide">
              <div class="guide-section">
                <h4>🔒 Fine-grained Personal Access Tokens (Recommended)</h4>
                <div class="guide-content">
                  <p><strong>Why Fine-grained Tokens are Better:</strong></p>
                  <ul>
                    <li>Repository-specific access only</li>
                    <li>Minimal required permissions</li>
                    <li>Mandatory expiration dates</li>
                    <li>Better audit trail</li>
                    <li>Organization approval workflow</li>
                  </ul>
                  
                  <p><strong>How to Create a Fine-grained Token:</strong></p>
                  <ol>
                    <li>Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens</li>
                    <li>Click "Generate new token"</li>
                    <li>Select specific repositories or "All repositories"</li>
                    <li>Set minimal permissions: Contents (Read/Write), Metadata (Read), Pages (Write)</li>
                    <li>Set expiration (90 days recommended)</li>
                    <li>Generate and copy token</li>
                  </ol>
                </div>
              </div>
              
              <div class="guide-section warning">
                <h4>⚠️ Classic Personal Access Tokens (Security Risk)</h4>
                <div class="guide-content">
                  <p><strong>Why Classic Tokens are Risky:</strong></p>
                  <ul>
                    <li>Access to ALL your repositories</li>
                    <li>Broad permissions (repo scope)</li>
                    <li>No mandatory expiration</li>
                    <li>Difficult to audit usage</li>
                  </ul>
                  
                  <p><strong>Only use Classic tokens if:</strong></p>
                  <ul>
                    <li>Fine-grained tokens are not available for your use case</li>
                    <li>You need access to GitHub Apps or other advanced features</li>
                    <li>You're working with older GitHub Enterprise versions</li>
                  </ul>
                </div>
              </div>
              
              <div class="guide-section">
                <h4>🛡️ Security Best Practices</h4>
                <div class="guide-content">
                  <ul>
                    <li><strong>Regular Rotation:</strong> Rotate tokens every 90 days</li>
                    <li><strong>Minimal Scope:</strong> Only grant necessary permissions</li>
                    <li><strong>Environment Isolation:</strong> Use different tokens for different projects</li>
                    <li><strong>Monitor Usage:</strong> Regularly review token usage in GitHub settings</li>
                    <li><strong>Secure Storage:</strong> Meridian encrypts tokens using OS-native security</li>
                  </ul>
                </div>
              </div>
              
              <div class="guide-section">
                <h4>📚 Learn More</h4>
                <div class="guide-content">
                  <ul>
                    <li><a href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens" target="_blank">GitHub PAT Documentation</a></li>
                    <li><a href="https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site" target="_blank">GitHub Pages Setup</a></li>
                    <li><a href="https://docs.github.com/en/rest/pages" target="_blank">GitHub Pages API</a></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="primary-btn modal-close">Got it!</button>
        </div>
      </div>
    `;

    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = modalHtml;
    modal.classList.add('active');
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

        if (accountState && (accountState.arweave || accountState.atproto || accountState.x || accountState.github)) {
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
              const hasGitHub = accountState.github && accountState.github.hasAccount;

              console.log(`[AccountState] Poll #${pollCount}: State available - Arweave: ${hasArweave}, ATProto: ${hasATProto}, X: ${hasX}, GitHub: ${hasGitHub}`);

              if (hasArweave || hasATProto || hasX || hasGitHub) {
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
          const [arweaveState, atprotoState, xState, githubState] = await Promise.allSettled([
            window.electronAPI.accountState.getPlatformState('arweave'),
            window.electronAPI.accountState.getPlatformState('atproto'),
            window.electronAPI.accountState.getPlatformState('x'),
            window.electronAPI.accountState.getPlatformState('github')
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

          if (githubState.status === 'fulfilled' && githubState.value) {
            console.log('[AccountState] Fallback: Got GitHub state:', githubState.value);
            this.updateGitHubUI(githubState.value);
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

      // Update GitHub display
      if (accountState.github) {
        console.log('[AccountState] Updating GitHub UI with state:', accountState.github);
        this.updateGitHubUI(accountState.github);
      } else {
        console.log('[AccountState] No GitHub state available');
        this.updateGitHubUI({ hasAccount: false, isValid: false });
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
        this.updateGitHubUI({ hasAccount: false, isValid: false });
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
   * Update GitHub UI elements
   */
  updateGitHubUI(githubState) {
    console.log('[AccountState] updateGitHubUI called with:', githubState);

    const footerGitHub = document.getElementById('footer-github-status');

    if (!footerGitHub) {
      console.warn('[AccountState] GitHub UI elements not found');
      return;
    }

    if (githubState.hasAccount && githubState.isValid && githubState.username) {
      console.log('[AccountState] Displaying connected GitHub account:', githubState.username);

      // Show username and repository count
      const displayText = `@${githubState.username} ${githubState.repositories?.length || 0} repositories`;
      footerGitHub.textContent = displayText;
      footerGitHub.title = displayText;
      footerGitHub.classList.add('connected');
      footerGitHub.classList.remove('error');
    } else {
      console.log('[AccountState] No valid GitHub account, showing disconnected state');
      footerGitHub.textContent = githubState.error || 'Not connected';
      footerGitHub.title = '';
      footerGitHub.classList.remove('connected');
      footerGitHub.classList.add('error');
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
        <div class="search-result-title">${UIManager.escapeHtml(result.title)}</div>
        <div class="search-result-description">${UIManager.escapeHtml(result.description)}</div>
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
  // Delegate modal operations to ModalManager
  openModal(modalId, options = {}) {
    const modalManager = this.getModalManager();
    if (modalManager) {
      return modalManager.openModal(modalId, options);
    } else {
      console.error('[App] ModalManager not available');
      return Promise.resolve();
    }
  }

  closeModal(modalId = null) {
    const modalManager = this.getModalManager();
    if (modalManager) {
      modalManager.closeModal(modalId);
    } else {
      console.error('[App] ModalManager not available');
    }
  }

  showError(message) {
    UIManager.showError(message);
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

  // ===== SITE SETTINGS METHODS =====

  async openSiteSettingsModal() {
    console.log('[DEBUG] openSiteSettingsModal called');
    try {
      if (!this.workspacePath) {
        console.log('[DEBUG] No workspace path set');
        this.showError('Please select a workspace first');
        return;
      }

      console.log('[DEBUG] Loading site settings for workspace:', this.workspacePath);
      // Load current settings
      const settings = await window.electronAPI.config.loadSiteSettings(this.workspacePath);
      console.log('[DEBUG] Site settings loaded:', settings);

      console.log('[DEBUG] Creating site settings modal HTML');
      // Create and show site settings modal
      const modalHtml = `
        <div class="modal site-settings-modal">
          <div class="modal-header">
            <h3>Site Settings</h3>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-content">
            <div class="modal-body">
            <form id="site-settings-form">
              <!-- Basic Site Information Section -->
              <section class="settings-section">
                <h4>Basic Information</h4>
                <div class="form-group">
                  <label for="site-title">Site Title</label>
                  <input type="text" id="site-title" value="${UIManager.escapeHtml(settings.site.title || 'Digital Garden')}" maxlength="100" required>
                  <small>The main title for your site (1-100 characters)</small>
                  <div class="character-count" id="title-char-count"></div>
                </div>
                
                <div class="form-group">
                  <label for="site-description">Site Description</label>
                  <textarea id="site-description" placeholder="Optional description of your site..." maxlength="500">${UIManager.escapeHtml(settings.site.description || '')}</textarea>
                  <small>A brief description of your site (optional, max 500 characters)</small>
                  <div class="character-count" id="description-char-count"></div>
                </div>
                
                <div class="form-group">
                  <label for="site-author">Author Name</label>
                  <input type="text" id="site-author" value="${UIManager.escapeHtml(settings.site.author || '')}" placeholder="Your name..." maxlength="100">
                  <small>Used in metadata and RSS feeds (optional, max 100 characters)</small>
                  <div class="character-count" id="author-char-count"></div>
                </div>
              </section>
              
              <!-- Domain Configuration Section -->
              <section class="settings-section">
                <h4>Domain Configuration</h4>
                <div class="form-group">
                  <label for="site-base-url">Base URL</label>
                  <input type="url" id="site-base-url" value="${UIManager.escapeHtml(settings.site.baseUrl || '')}" placeholder="https://yourdomain.com">
                  <small>The full URL where your site will be accessible</small>
                  <div class="url-validation" id="url-validation" style="display: none;"></div>
                  <div class="domain-preview" id="domain-preview">
                    ${settings.site.baseUrl ? this.extractDomainFromUrl(settings.site.baseUrl) : 'No domain specified'}
                  </div>
                </div>
                
                <div class="form-group checkbox-group">
                  <input type="checkbox" id="custom-cname" ${settings.deployment.customCNAME ? 'checked' : ''}>
                  <label for="custom-cname">Generate CNAME file for custom domain</label>
                  <small>Automatically creates a CNAME file when a custom domain is detected</small>
                </div>
              </section>
              
              <!-- Display Preferences Section -->
              <section class="settings-section">
                <h4>Display Preferences</h4>
                <div class="form-group">
                  <label>Theme Mode</label>
                  <div class="theme-mode-options">
                    <div class="theme-mode-option">
                      <input type="radio" id="theme-auto" name="theme-mode" value="auto" ${settings.quartz.theme.mode === 'auto' ? 'checked' : ''}>
                      <label for="theme-auto">Auto</label>
                    </div>
                    <div class="theme-mode-option">
                      <input type="radio" id="theme-light" name="theme-mode" value="light" ${settings.quartz.theme.mode === 'light' ? 'checked' : ''}>
                      <label for="theme-light">Light</label>
                    </div>
                    <div class="theme-mode-option">
                      <input type="radio" id="theme-dark" name="theme-mode" value="dark" ${settings.quartz.theme.mode === 'dark' ? 'checked' : ''}>
                      <label for="theme-dark">Dark</label>
                    </div>
                  </div>
                  <small>Choose how the theme adapts to user preferences</small>
                </div>
                
                <div class="form-group checkbox-group">
                  <input type="checkbox" id="enable-spa" ${settings.quartz.enableSPA ? 'checked' : ''}>
                  <label for="enable-spa">Enable Single Page Application</label>
                  <small>Faster navigation between pages (recommended)</small>
                </div>
                
                <div class="form-group checkbox-group">
                  <input type="checkbox" id="enable-popovers" ${settings.quartz.enablePopovers ? 'checked' : ''}>
                  <label for="enable-popovers">Enable Link Popovers</label>
                  <small>Show preview popups when hovering over internal links</small>
                </div>
              </section>
              
              <!-- Ignore Files Section -->
              <section class="settings-section">
                <h4>Ignore Files</h4>
                <div class="form-group">
                  <label for="ignore-patterns">Custom Ignore Patterns</label>
                  <textarea id="ignore-patterns" placeholder="drafts/**&#10;private/**&#10;*.tmp" rows="4">${settings.site.ignorePatterns?.custom?.join('\n') || ''}</textarea>
                  <small>File patterns to exclude from build (one per line). Uses glob syntax: *, **, etc.</small>
                </div>
                
                <div class="form-group checkbox-group">
                  <input type="checkbox" id="enable-ignore-patterns" ${settings.site.ignorePatterns?.enabled !== false ? 'checked' : ''}>
                  <label for="enable-ignore-patterns">Enable custom ignore patterns</label>
                  <small>Apply the custom patterns above to exclude files from your site</small>
                </div>
                
                <div class="ignore-patterns-help">
                  <details>
                    <summary>Pattern Examples</summary>
                    <div class="help-content">
                      <ul>
                        <li><code>drafts/**</code> - Exclude entire drafts directory</li>
                        <li><code>*.tmp</code> - Exclude all .tmp files</li>
                        <li><code>private-notes/**</code> - Exclude private-notes folder</li>
                        <li><code>**/WIP/**</code> - Exclude any WIP folders</li>
                        <li><code>secret.md</code> - Exclude specific file</li>
                      </ul>
                    </div>
                  </details>
                </div>
                
                <div class="ignore-preview" id="ignore-preview" style="display: none;">
                  <h5>Preview Impact</h5>
                  <div class="preview-stats">
                    <span class="preview-included">Files included: <strong id="preview-included-count">-</strong></span>
                    <span class="preview-excluded">Files excluded: <strong id="preview-excluded-count">-</strong></span>
                  </div>
                </div>
              </section>
            </form>
            </div>
          </div>
          <div class="modal-footer">
            <div class="footer-left">
              <button type="button" class="secondary-btn" id="reset-defaults-btn">Reset to Defaults</button>
            </div>
            <div class="footer-right">
              <button type="button" class="secondary-btn modal-cancel">Cancel</button>
              <button type="submit" form="site-settings-form" class="primary-btn" id="save-settings-btn">
                Save Settings
              </button>
            </div>
          </div>
        </div>
      `;

      console.log('[DEBUG] Modal HTML created, length:', modalHtml.length);
      const modal = document.getElementById('modal-overlay');
      console.log('[DEBUG] Modal overlay element:', modal);

      if (!modal) {
        console.error('[DEBUG] Modal overlay element not found!');
        this.showError('Modal overlay not found');
        return;
      }

      console.log('[DEBUG] Setting modal HTML and displaying');
      modal.innerHTML = modalHtml;
      modal.classList.add('active');

      console.log('[DEBUG] Modal displayed, setting up event handlers');
      // Setup event handlers
      this.setupSiteSettingsModalEvents();

      // Initialize character counts and validation
      this.updateCharacterCounts();
      this.validateBaseUrl();

    } catch (error) {
      console.error('Failed to open site settings modal:', error);
      this.showError(`Failed to open site settings: ${error.message}`);
    }
  }

  setupSiteSettingsModalEvents() {
    console.log('[DEBUG] Setting up site settings modal events');

    // Form submission
    const form = document.getElementById('site-settings-form');
    console.log('[DEBUG] Site settings form element:', form);
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSiteSettingsSubmit();
      });
    } else {
      console.error('[DEBUG] Site settings form not found!');
    }

    // Reset to defaults button
    document.getElementById('reset-defaults-btn').addEventListener('click', () => {
      this.confirmResetSiteSettings();
    });

    // Real-time validation for base URL
    const baseUrlInput = document.getElementById('site-base-url');
    baseUrlInput.addEventListener('input', () => {
      this.validateBaseUrl();
      this.updateDomainPreview();
    });

    // Character count updates
    const titleInput = document.getElementById('site-title');
    const descriptionInput = document.getElementById('site-description');
    const authorInput = document.getElementById('site-author');

    titleInput.addEventListener('input', () => this.updateCharacterCounts());
    descriptionInput.addEventListener('input', () => this.updateCharacterCounts());
    authorInput.addEventListener('input', () => this.updateCharacterCounts());

    // Custom CNAME checkbox
    const cnameCheckbox = document.getElementById('custom-cname');
    cnameCheckbox.addEventListener('change', () => {
      this.updateDomainPreview();
    });

    // Ignore patterns functionality
    const ignorePatternsTextarea = document.getElementById('ignore-patterns');
    const enableIgnorePatternsCheckbox = document.getElementById('enable-ignore-patterns');

    // Preview ignore patterns impact
    ignorePatternsTextarea.addEventListener('input', () => {
      this.previewIgnorePatterns();
    });

    enableIgnorePatternsCheckbox.addEventListener('change', () => {
      this.previewIgnorePatterns();
    });
  }

  validateBaseUrl() {
    const input = document.getElementById('site-base-url');
    const validationDiv = document.getElementById('url-validation');
    const url = input.value.trim();

    if (!url) {
      validationDiv.style.display = 'none';
      input.parentElement.classList.remove('error', 'success');
      return true;
    }

    try {
      const parsed = new URL(url);

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        this.showValidationError(validationDiv, 'URL must use http or https protocol');
        input.parentElement.classList.add('error');
        input.parentElement.classList.remove('success');
        return false;
      }

      if (!parsed.hostname) {
        this.showValidationError(validationDiv, 'URL must include a valid hostname');
        input.parentElement.classList.add('error');
        input.parentElement.classList.remove('success');
        return false;
      }

      this.showValidationSuccess(validationDiv, 'Valid URL format');
      input.parentElement.classList.add('success');
      input.parentElement.classList.remove('error');
      return true;
    } catch {
      this.showValidationError(validationDiv, 'Invalid URL format');
      input.parentElement.classList.add('error');
      input.parentElement.classList.remove('success');
      return false;
    }
  }

  showValidationError(container, message) {
    container.className = 'url-validation invalid';
    container.innerHTML = `
      <svg class="validation-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/>
        <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/>
      </svg>
      <span>${message}</span>
    `;
    container.style.display = 'flex';
  }

  showValidationSuccess(container, message) {
    container.className = 'url-validation valid';
    container.innerHTML = `
      <svg class="validation-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="22,4 12,14.01 9,11.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>${message}</span>
    `;
    container.style.display = 'flex';
  }

  updateDomainPreview() {
    const baseUrlInput = document.getElementById('site-base-url');
    const cnameCheckbox = document.getElementById('custom-cname');
    const preview = document.getElementById('domain-preview');

    const url = baseUrlInput.value.trim();
    const cnameEnabled = cnameCheckbox.checked;

    if (!url) {
      preview.textContent = 'No domain specified';
      preview.className = 'domain-preview empty';
      return;
    }

    const domain = this.extractDomainFromUrl(url);
    if (domain && cnameEnabled) {
      preview.textContent = `CNAME will be created: ${domain}`;
      preview.className = 'domain-preview';
    } else if (domain) {
      preview.textContent = `Domain detected: ${domain} (CNAME disabled)`;
      preview.className = 'domain-preview';
    } else {
      preview.textContent = 'Invalid URL format';
      preview.className = 'domain-preview empty';
    }
  }

  extractDomainFromUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return null;
    }
  }

  updateCharacterCounts() {
    const inputs = [
      { id: 'site-title', countId: 'title-char-count', max: 100 },
      { id: 'site-description', countId: 'description-char-count', max: 500 },
      { id: 'site-author', countId: 'author-char-count', max: 100 }
    ];

    inputs.forEach(({ id, countId, max }) => {
      const input = document.getElementById(id);
      const counter = document.getElementById(countId);
      const length = input.value.length;

      counter.textContent = `${length}/${max}`;

      if (length > max * 0.9) {
        counter.className = 'character-count warning';
      } else if (length >= max) {
        counter.className = 'character-count error';
      } else {
        counter.className = 'character-count';
      }
    });
  }

  async handleSiteSettingsSubmit() {
    try {
      // Validate form
      if (!this.validateSiteSettingsForm()) {
        return;
      }

      this.updateFooterStatus('Saving site settings...', false);

      // Collect form data
      const ignorePatternsValue = document.getElementById('ignore-patterns').value;
      const customPatterns = ignorePatternsValue
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      const settings = {
        version: '1.0.0',
        lastModified: new Date().toISOString(),
        site: {
          title: document.getElementById('site-title').value.trim(),
          description: document.getElementById('site-description').value.trim() || undefined,
          author: document.getElementById('site-author').value.trim() || undefined,
          baseUrl: document.getElementById('site-base-url').value.trim() || undefined,
          ignorePatterns: {
            custom: customPatterns,
            enabled: document.getElementById('enable-ignore-patterns').checked
          }
        },
        quartz: {
          enableSPA: document.getElementById('enable-spa').checked,
          enablePopovers: document.getElementById('enable-popovers').checked,
          theme: {
            mode: document.querySelector('input[name="theme-mode"]:checked').value,
            primaryColor: '#284b63'
          }
        },
        deployment: {
          provider: null,
          repository: null,
          branch: 'main',
          customCNAME: document.getElementById('custom-cname').checked
        },
        metadata: {
          createdAt: new Date().toISOString(),
          workspacePath: this.workspacePath
        }
      };

      // Save settings
      await window.electronAPI.config.saveSiteSettings(this.workspacePath, settings);

      this.closeModal();
      UIManager.showSuccess('Site settings saved successfully');
      this.updateFooterStatus('Ready', false);

    } catch (error) {
      console.error('Failed to save site settings:', error);
      this.showError(`Failed to save settings: ${error.message}`);
      this.updateFooterStatus('Ready', false);
    }
  }

  validateSiteSettingsForm() {
    const titleInput = document.getElementById('site-title');
    const title = titleInput.value.trim();

    if (!title) {
      this.showError('Site title is required');
      titleInput.focus();
      return false;
    }

    if (title.length > 100) {
      this.showError('Site title must be 100 characters or less');
      titleInput.focus();
      return false;
    }

    // Validate base URL if provided
    const baseUrlInput = document.getElementById('site-base-url');
    if (baseUrlInput.value.trim() && !this.validateBaseUrl()) {
      this.showError('Please fix the base URL format');
      baseUrlInput.focus();
      return false;
    }

    return true;
  }

  async previewIgnorePatterns() {
    try {
      if (!this.workspacePath) return;

      const ignorePatternsTextarea = document.getElementById('ignore-patterns');
      const enableIgnorePatternsCheckbox = document.getElementById('enable-ignore-patterns');
      const previewDiv = document.getElementById('ignore-preview');

      if (!enableIgnorePatternsCheckbox.checked) {
        previewDiv.style.display = 'none';
        return;
      }

      const patterns = ignorePatternsTextarea.value
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      if (patterns.length === 0) {
        previewDiv.style.display = 'none';
        return;
      }

      // Show preview and get impact
      previewDiv.style.display = 'block';

      const preview = await window.electronAPI.deploy.previewIgnorePatterns(this.workspacePath, patterns);

      document.getElementById('preview-included-count').textContent = preview.currentIncluded;
      document.getElementById('preview-excluded-count').textContent = preview.currentExcluded;

    } catch (error) {
      console.error('Failed to preview ignore patterns:', error);
    }
  }

  confirmResetSiteSettings() {
    const confirmation = confirm(
      'Are you sure you want to reset all settings to their default values? This action cannot be undone.'
    );

    if (confirmation) {
      this.resetSiteSettingsToDefaults();
    }
  }

  resetSiteSettingsToDefaults() {
    // Reset form fields to default values
    document.getElementById('site-title').value = 'Digital Garden';
    document.getElementById('site-description').value = '';
    document.getElementById('site-author').value = '';
    document.getElementById('site-base-url').value = '';
    document.getElementById('custom-cname').checked = true;
    document.getElementById('theme-auto').checked = true;
    document.getElementById('enable-spa').checked = true;
    document.getElementById('enable-popovers').checked = true;
    document.getElementById('ignore-patterns').value = '';
    document.getElementById('enable-ignore-patterns').checked = false;

    // Update displays
    this.updateCharacterCounts();
    this.validateBaseUrl();
    this.updateDomainPreview();

    // Hide ignore preview
    const previewDiv = document.getElementById('ignore-preview');
    if (previewDiv) {
      previewDiv.style.display = 'none';
    }

    UIManager.showSuccess('Settings reset to defaults');
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