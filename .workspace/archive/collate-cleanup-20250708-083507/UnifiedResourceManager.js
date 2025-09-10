import { ModuleBase } from './ModuleBase.js';
import { TagAutocomplete } from '../components/TagAutocomplete.js';

/**
 * UnifiedResourceManager - manages both internal (local) and external (web) resources
 * Foundation for unified resource management in Meridian
 * Follows Meridian modular architecture pattern with ModuleBase inheritance
 */
export class UnifiedResourceManager extends ModuleBase {
  constructor(app) {
    super(app);
    
    // Meridian-compliant unified state management
    this.state = {
      resources: [],
      filters: {
        searchTerm: '',
        activeTags: new Set(),
        filterLogic: 'any' // 'any' or 'all'
      },
      collapse: {
        globalState: 'expanded',
        collapsedItems: new Set()
      },
      ui: {
        loading: false,
        error: null
      }
    };
    
    // Modal state
    this.editingResourceId = null;
    this.modalTags = [];
    
    // Tag autocomplete instances for cleanup
    this.tagAutocompletes = [];
    
    // Legacy state properties (to be removed after migration)
    this.unifiedResources = this.state.resources; // Alias for backward compatibility
    this.activeTagFilters = this.state.filters.activeTags; // Alias for backward compatibility
    this.currentSearchTerm = this.state.filters.searchTerm; // Alias for backward compatibility
    this.filterLogic = this.state.filters.filterLogic; // Alias for backward compatibility
    this.unifiedCollapseState = this.state.collapse; // Alias for backward compatibility
  }

  async onInit() {
    console.log('[UnifiedResourceManager] ===== INITIALIZING UNIFIED RESOURCE MANAGER =====');
    
    // Emit initialization event for module coordination
    this.emit('unifiedResourceManagerInitializing');
    
    // Load filter state first (before rendering panel)
    console.log('[UnifiedResourceManager] Loading filter state...');
    this.loadFilterState();
    
    // Don't load resources yet - wait for workspace to be selected
    console.log('[UnifiedResourceManager] Setting up panel and event listeners...');
    this.renderUnifiedPanel();
    console.log('[UnifiedResourceManager] Panel rendered and event listeners set up, initializing collapse state...');
    this.initializeCollapseState();
    
    // Emit initialization complete event
    this.emit('unifiedResourceManagerInitialized', { 
      moduleName: 'UnifiedResourceManager',
      state: this.state 
    });
    
    console.log('[UnifiedResourceManager] ===== UNIFIED RESOURCE MANAGER INITIALIZED SUCCESSFULLY =====');
  }

  async onCleanup() {
    console.log('[UnifiedResourceManager] Cleaning up...');
    
    // Clean up tag autocomplete instances
    this.cleanupTagAutocompletes();
    
    // Save collapse state
    this.saveCollapseState();
    
    // Emit cleanup event
    this.emit('unifiedResourceManagerCleanedUp');
    
    console.log('[UnifiedResourceManager] Cleaned up successfully');
  }

  /**
   * Clean up tag autocomplete instances
   */
  cleanupTagAutocompletes() {
    if (this.tagAutocompletes) {
      this.tagAutocompletes.forEach(instance => {
        if (instance && typeof instance.cleanup === 'function') {
          instance.cleanup();
        }
      });
      this.tagAutocompletes = [];
    }
  }

  /**
   * Get unified state (for external access)
   */
  getState() {
    return this.state;
  }

  /**
   * Update state and emit change events
   */
  updateState(updates, emitEvent = true) {
    const oldState = JSON.parse(JSON.stringify(this.state));
    
    // Deep merge updates into state
    this.mergeState(this.state, updates);
    
    // Update legacy aliases for backward compatibility
    this.updateLegacyAliases();
    
    // Emit state change event if requested
    if (emitEvent) {
      this.emit('unifiedResourceStateChanged', {
        oldState,
        newState: this.state,
        updates
      });
    }
  }

  /**
   * Deep merge state updates
   */
  mergeState(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        // Handle Set objects specially
        if (source[key] instanceof Set) {
          target[key] = new Set(source[key]);
        } else {
          if (!target[key]) target[key] = {};
          this.mergeState(target[key], source[key]);
        }
      } else {
        target[key] = source[key];
      }
    }
  }

  /**
   * Update legacy aliases for backward compatibility
   */
  updateLegacyAliases() {
    this.unifiedResources = this.state.resources;
    this.activeTagFilters = this.state.filters.activeTags;
    this.currentSearchTerm = this.state.filters.searchTerm;
    this.filterLogic = this.state.filters.filterLogic;
    this.unifiedCollapseState = this.state.collapse;
  }

  /**
   * Render the unified resource panel
   */
  renderUnifiedPanel() {
    const container = document.getElementById('unified-panel');
    if (!container) return;

    // Create panel header following existing patterns
    const html = `
      <div class="panel-header">
        <div class="panel-header-left">
          <div class="panel-actions">
            <button
              id="add-unified-resource-btn"
              class="panel-header-icon-btn"
              title="Add Unified Resource"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
              </svg>
            </button>
            <button
              id="unified-collapse-all-btn"
              class="panel-header-icon-btn"
              title="${this.unifiedCollapseState.globalState === 'expanded' ? 'Collapse All Resources' : 'Expand All Resources'}"
              data-state="${this.unifiedCollapseState.globalState}"
            >
              <svg class="collapse-icon collapse-down" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 2L8 6L12 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M4 14L8 10L12 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg class="collapse-icon collapse-up" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 6L8 2L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M4 10L8 14L12 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button
              id="unified-export-btn"
              class="panel-header-icon-btn"
              title="Export Resources"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M23,12L19,8V11H10V13H19V16M1,18V6C1,4.89 1.9,4 3,4H15A2,2 0 0,1 17,6V9H15V6H3V18H15V15H17V18A2,2 0 0,1 15,20H3A2,2 0 0,1 1,18Z"
                />
              </svg>
            </button>
          </div>
          <div class="resource-count">
            <span id="unified-count-text">${this.getFilteredResources().length} Resources Listed</span>
          </div>
        </div>
        <div class="panel-header-right">
          <input
            type="text"
            id="unified-search"
            class="search-input"
            placeholder="Search"
            value="${this.currentSearchTerm}"
          />
          <button
            id="unified-filter-logic-btn"
            class="panel-header-icon-btn"
            data-logic="${this.filterLogic}"
            title="Toggle Filter Logic: ${this.filterLogic === 'any' ? 'ANY' : 'ALL'} of these tags"
          >
            <svg class="filter-logic-icon filter-logic-${this.filterLogic}" width="20" height="20" viewBox="0 0 21 21" fill="currentColor">
              <circle cx="13.5" cy="10.5" r="5" />
              <circle cx="7.5" cy="10.5" r="5" />
            </svg>
          </button>
          <button
            id="unified-clear-filters-btn"
            class="panel-header-icon-btn"
            title="Clear All Filters"
          >
            <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" stroke="currentColor" stroke-width="0.5">
              <polygon points="30 11.414 28.586 10 24 14.586 19.414 10 18 11.414 22.586 16 18 20.585 19.415 22 24 17.414 28.587 22 30 20.587 25.414 16 30 11.414" stroke-width="0.8"/>
              <path d="M4,4A2,2,0,0,0,2,6V9.1709a2,2,0,0,0,.5859,1.4145L10,18v8a2,2,0,0,0,2,2h4a2,2,0,0,0,2-2V24H16v2H12V17.1709l-.5859-.5855L4,9.1709V6H24V8h2V6a2,2,0,0,0-2-2Z" stroke-width="0.8"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="panel-content">
        <div class="main-content-area">
          <div class="unified-resource-list" id="unified-resource-list">
            ${this.renderUnifiedResourceList()}
          </div>
        </div>
        <div class="filters-sidebar">
          <div class="tag-filter-list" id="unified-tag-filter-list">
            ${this.renderTagFilters()}
          </div>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
    
    // Restore search input value from state
    const searchInput = container.querySelector('#unified-search');
    if (searchInput) {
      searchInput.value = this.state.filters.searchTerm;
    }
    
    // Restore filter logic button state
    const filterLogicBtn = container.querySelector('#unified-filter-logic-btn');
    if (filterLogicBtn) {
      filterLogicBtn.setAttribute('data-logic', this.state.filters.filterLogic);
      filterLogicBtn.setAttribute('title', `Toggle Filter Logic: ${this.state.filters.filterLogic === 'any' ? 'ANY' : 'ALL'} of these tags`);
    }
    
    // Always set up event listeners after rendering
    this.setupUnifiedEventListeners();
    this.setupResourceEventListeners();
  }

  /**
   * Render the unified resource list
   */
  renderUnifiedResourceList() {
    // Get filtered resources based on current search and tag filters
    const filteredResources = this.getFilteredResources();
    
    if (filteredResources.length === 0) {
      if (this.state.resources.length === 0) {
        return '<div class="loading-state">No resources yet. Click "Add Resource" to get started!</div>';
      } else {
        const filterInfo = this.getFilterInfo();
        return `<div class="loading-state">No resources match your current filters.${filterInfo ? ` (${filterInfo})` : ''}</div>`;
      }
    }

    return filteredResources.map(resource => {
      const isCollapsed = this.state.collapse.collapsedItems.has(resource.id);
      const arweaveHashes = resource.properties["meridian:arweave_hashes"] || [];
      
      return `
        <div class="resource-item ${isCollapsed ? 'collapsed' : ''}" data-id="${resource.id}">
          <div class="resource-header">
            <div class="resource-info">
              <h4 class="resource-title">${this.escapeHtml(resource.properties["dc:title"] || "Untitled")}</h4>
              <div class="resource-path">
                <span class="file-status-indicator ${this.getResourceStatusIndicator(resource)}"></span>
                ${this.escapeHtml(resource.locations.primary.value)}
              </div>
              ${!isCollapsed && resource.properties["meridian:description"] ? `
                <p class="resource-description">${this.escapeHtml(resource.properties["meridian:description"])}</p>
              ` : ''}
              
              ${!isCollapsed ? `
                <div class="resource-metadata">
                  <span class="resource-metadata-item">
                    <span class="resource-metadata-label">Type:</span>
                    <span class="resource-metadata-value">${this.escapeHtml(resource.state.type)}</span>
                  </span>
                  <span class="resource-metadata-item">
                    <span class="resource-metadata-label">Created:</span>
                    <span class="resource-metadata-value">${this.formatDate(resource.timestamps.created)}</span>
                  </span>
                  ${arweaveHashes.length > 0 ? `
                    <span class="resource-metadata-item">
                      <span class="resource-metadata-label">Arweave Uploads:</span>
                      <span class="resource-metadata-value">${arweaveHashes.length}</span>
                    </span>
                  ` : ''}
                </div>
              ` : ''}
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
          
          ${!isCollapsed && arweaveHashes.length > 0 ? `
            <div class="resource-arweave-hashes">
              <div class="resource-hash-header" data-resource-id="${resource.id}">
                <span class="resource-hash-count">${arweaveHashes.length} Arweave Upload${arweaveHashes.length > 1 ? 's' : ''}</span>
                <button class="resource-hash-toggle" data-resource-id="${resource.id}" title="Toggle upload history">
                  <svg class="resource-hash-toggle-icon" width="12" height="12" viewBox="0 0 12 12">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
              <div class="resource-hash-list collapsed" data-resource-id="${resource.id}">
                ${arweaveHashes.map(hash => `
                  <div class="resource-hash-item">
                    <div class="resource-hash-content">
                      <a href="${hash.link}" class="resource-hash-link" target="_blank" title="${hash.hash}">
                        ${this.truncateHash(hash.hash)}
                      </a>
                      <span class="resource-hash-timestamp">${this.formatDate(hash.timestamp)}</span>
                      ${hash.tags && hash.tags.length > 0 ? `
                        <div class="resource-hash-tags">
                          ${hash.tags.map(tag => `
                            <span class="resource-hash-tag" title="${this.escapeHtml(tag)}">${this.escapeHtml(tag)}</span>
                          `).join('')}
                        </div>
                      ` : ''}
                    </div>
                    <div class="resource-hash-actions">
                      <button class="resource-hash-action-btn copy-hash-btn" data-hash="${hash.hash}" title="Copy Hash">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                      <button class="resource-hash-action-btn copy-url-btn" data-url="${hash.link}" title="Copy URL">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          ${!isCollapsed ? `
            <div class="resource-tags">
              <div class="resource-tag-input">
                <div class="tag-input-container">
                  <input type="text" class="tag-input" placeholder="add tag..." data-resource-id="${resource.id}">
                  <button class="add-tag-btn" data-resource-id="${resource.id}" disabled="">+</button>
                </div>
                <div class="tag-autocomplete" id="autocomplete-${resource.id}" style="display: none;"></div>
              </div>
              
              ${resource.properties["meridian:tags"] && resource.properties["meridian:tags"].length > 0 ? 
                resource.properties["meridian:tags"].map(tag => `
                  <span class="resource-tag">
                    ${this.escapeHtml(tag)}
                    <button class="remove-tag-btn" data-resource-id="${resource.id}" data-tag="${this.escapeHtml(tag)}" title="Remove tag">×</button>
                  </span>
                `).join('') : ''
              }
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * Get filtered resources based on search and tag filters (Meridian-compliant)
   */
  getFilteredResources() {
    let filtered = this.state.resources;

    // Apply search filter
    if (this.state.filters.searchTerm) {
      const searchTerm = this.state.filters.searchTerm.toLowerCase();
      filtered = filtered.filter(resource => {
        const title = (resource.properties["dc:title"] || "").toLowerCase();
        const description = (resource.properties["meridian:description"] || "").toLowerCase();
        const url = resource.locations.primary.value.toLowerCase();
        const tags = (resource.properties["meridian:tags"] || []).join(" ").toLowerCase();
        
        return title.includes(searchTerm) || 
               description.includes(searchTerm) || 
               url.includes(searchTerm) || 
               tags.includes(searchTerm);
      });
    }

    // Apply tag filters
    if (this.state.filters.activeTags.size > 0) {
      const activeTagsArray = Array.from(this.state.filters.activeTags);
      
      filtered = filtered.filter(resource => {
        const resourceTags = new Set(resource.properties["meridian:tags"] || []);
        
        if (this.state.filters.filterLogic === 'any') {
          // Show if ANY of the active filters match
          return activeTagsArray.some(tag => resourceTags.has(tag));
        } else {
          // Show if ALL of the active filters match
          return activeTagsArray.every(tag => resourceTags.has(tag));
        }
      });
    }

    return filtered;
  }

  /**
   * Render tag filters (Meridian-compliant)
   */
  renderTagFilters() {
    const allTags = this.getAllTags();
    
    if (allTags.length === 0) {
      return '<div class="no-tags">No tags yet</div>';
    }

    return allTags.map(tag => {
      const isActive = this.state.filters.activeTags.has(tag);
      return `
        <div class="tag-filter-container">
          <button 
            class="tag-filter ${isActive ? 'active' : ''}" 
            data-tag="${this.escapeHtml(tag)}"
            title="${this.getTagCount(tag)} resources"
          >
            <span class="tag-filter-label">${this.escapeHtml(tag)}</span>
            <span class="tag-filter-count">${this.getTagCount(tag)}</span>
          </button>
        </div>
      `;
    }).join('');
  }

  /**
   * Get all unique tags from resources
   */
  getAllTags() {
    const tagSet = new Set();
    this.state.resources.forEach(resource => {
      const tags = resource.properties["meridian:tags"] || [];
      tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }

  /**
   * Get count of resources with a specific tag (Meridian-compliant)
   */
  getTagCount(tag) {
    return this.state.resources.filter(resource => 
      (resource.properties["meridian:tags"] || []).includes(tag)
    ).length;
  }

  /**
   * Get resource status indicator class
   */
  getResourceStatusIndicator(resource) {
    switch (resource.state.type) {
      case 'external':
        return 'virtual';
      case 'internal':
        return 'physical';
      case 'arweave':
        return 'arweave';
      default:
        return 'unknown';
    }
  }

  /**
   * Setup event listeners for resource items (collapsed from setupUnifiedEventListeners)
   */
  setupResourceEventListeners() {
    // Resource collapse buttons
    document.querySelectorAll('.resource-collapse-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const resourceId = btn.dataset.resourceId;
        this.toggleResourceCollapse(resourceId);
      });
    });

    // Resource actions dropdown
    document.querySelectorAll('.resource-actions-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const resourceId = btn.dataset.resourceId;
        const menu = document.querySelector(`.resource-actions-menu[data-resource-id="${resourceId}"]`);
        if (menu) {
          menu.classList.toggle('show');
        }
      });
    });

    // Resource action items
    document.querySelectorAll('.resource-actions-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const resourceId = item.dataset.resourceId;
        
        if (item.classList.contains('edit-option')) {
          this.editUnifiedResource(resourceId);
        } else if (item.classList.contains('remove-option')) {
          this.removeUnifiedResource(resourceId);
        }
      });
    });

    // Arweave hash toggle buttons
    document.querySelectorAll('.resource-hash-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const resourceId = btn.dataset.resourceId;
        this.toggleArweaveHashList(resourceId);
      });
    });

    // Arweave hash links
    document.querySelectorAll('.resource-hash-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });

    // Copy hash buttons
    document.querySelectorAll('.copy-hash-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const hash = btn.dataset.hash;
        await this.copyToClipboard(hash);
      });
    });
  }

  /**
   * Setup event listeners for unified panel
   */
  setupUnifiedEventListeners() {
    const unifiedPanel = document.getElementById('unified-panel');
    if (!unifiedPanel) {
      console.warn('[UnifiedResourceManager] Unified panel not found');
      return;
    }

    console.log('[UnifiedResourceManager] Setting up unified event listeners');

    // Add resource button
    const addBtn = unifiedPanel.querySelector('#add-unified-resource-btn');
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        await this.openAddUnifiedResourceModal();
      });
    }

    // Search functionality (Meridian-compliant)
    const searchInput = unifiedPanel.querySelector('#unified-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        // Update state
        this.updateState({
          filters: {
            searchTerm: e.target.value
          }
        });
        
        // Apply filters
        this.applyFilters();
        
        // Save filter state
        this.saveFilterState();
        
        // Emit search change event
        this.emit('searchChanged', {
          searchTerm: this.state.filters.searchTerm,
          filteredCount: this.getFilteredResources().length
        });
      });
    }

    // Filter logic toggle (Meridian-compliant)
    const filterLogicBtn = unifiedPanel.querySelector('#unified-filter-logic-btn');
    if (filterLogicBtn) {
      filterLogicBtn.addEventListener('click', () => {
        const newLogic = this.state.filters.filterLogic === 'any' ? 'all' : 'any';
        
        // Update state
        this.updateState({
          filters: {
            filterLogic: newLogic
          }
        });
        
        // Update button appearance
        filterLogicBtn.setAttribute('data-logic', newLogic);
        filterLogicBtn.setAttribute('title', `Toggle Filter Logic: ${newLogic === 'any' ? 'ANY' : 'ALL'} of these tags`);
        
        // Apply filters
        this.applyFilters();
        
        // Save filter state
        this.saveFilterState();
        
        // Emit filter logic change event
        this.emit('filterLogicChanged', {
          filterLogic: newLogic,
          filteredCount: this.getFilteredResources().length
        });
      });
    }

    // Clear filters
    const clearFiltersBtn = unifiedPanel.querySelector('#unified-clear-filters-btn');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => {
        this.clearAllFilters();
      });
    }

    // Collapse all button
    const collapseAllBtn = unifiedPanel.querySelector('#unified-collapse-all-btn');
    if (collapseAllBtn) {
      collapseAllBtn.addEventListener('click', () => {
        this.toggleCollapseAll();
      });
    }

    // Export button
    const exportBtn = unifiedPanel.querySelector('#unified-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.openUnifiedExportModal();
      });
    }

    // Tag filter buttons (event delegation)
    unifiedPanel.addEventListener('click', (e) => {
      const tagFilterBtn = e.target.closest('.tag-filter');
      if (tagFilterBtn) {
        const tag = tagFilterBtn.dataset.tag;
        this.toggleTagFilter(tag);
      }
    });

    // Resource actions (event delegation)
    unifiedPanel.addEventListener('click', (e) => {
      if (e.target.classList.contains('edit-option')) {
        const resourceId = e.target.dataset.resourceId;
        this.editUnifiedResource(resourceId);
      } else if (e.target.classList.contains('remove-option')) {
        const resourceId = e.target.dataset.resourceId;
        this.removeUnifiedResource(resourceId);
      } else if (e.target.closest('.resource-collapse-btn')) {
        const resourceId = e.target.closest('.resource-collapse-btn').dataset.resourceId;
        this.toggleResourceCollapse(resourceId);
      }
    });

    // Arweave hash interactions (event delegation)
    unifiedPanel.addEventListener('click', (e) => {
      // Arweave hash toggle
      if (e.target.closest('.resource-hash-toggle')) {
        const resourceId = e.target.closest('.resource-hash-toggle').dataset.resourceId;
        this.toggleArweaveHashList(resourceId);
      }
      
      // Copy hash button
      if (e.target.closest('.copy-hash-btn')) {
        const hash = e.target.closest('.copy-hash-btn').dataset.hash;
        this.copyToClipboard(hash);
        this.showSuccess('Hash copied to clipboard');
      }
      
      // Copy URL button
      if (e.target.closest('.copy-url-btn')) {
        const url = e.target.closest('.copy-url-btn').dataset.url;
        this.copyToClipboard(url);
        this.showSuccess('URL copied to clipboard');
      }
    });

    // Tag input functionality (event delegation)
    unifiedPanel.addEventListener('click', (e) => {
      const addTagBtn = e.target.closest('.add-tag-btn');
      if (addTagBtn) {
        const resourceId = addTagBtn.dataset.resourceId;
        const input = addTagBtn.parentElement.querySelector('.tag-input');
        const tagValue = input.value.trim();
        if (tagValue) {
          this.addTagToResource(resourceId, tagValue);
          input.value = '';
          addTagBtn.disabled = true;
        }
      }

      const removeTagBtn = e.target.closest('.remove-tag-btn');
      if (removeTagBtn) {
        const resourceId = removeTagBtn.dataset.resourceId;
        const tag = removeTagBtn.dataset.tag;
        this.removeTagFromResource(resourceId, tag);
      }
    });

    // Tag input change events
    unifiedPanel.addEventListener('input', (e) => {
      if (e.target.classList.contains('tag-input')) {
        const addBtn = e.target.parentElement.querySelector('.add-tag-btn');
        if (addBtn) {
          addBtn.disabled = !e.target.value.trim();
        }
      }
    });
  }

  /**
   * Toggle Arweave hash list visibility
   */
  toggleArweaveHashList(resourceId) {
    const hashList = document.querySelector(`.resource-hash-list[data-resource-id="${resourceId}"]`);
    if (hashList) {
      hashList.classList.toggle('collapsed');
    }
  }

  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  /**
   * Truncate hash for display with ellipsis in the middle
   */
  truncateHash(hash, prefixLength = 5, suffixLength = 5) {
    if (hash.length <= prefixLength + suffixLength + 3) return hash;
    return hash.substring(0, prefixLength) + '...' + hash.substring(hash.length - suffixLength);
  }

  /**
   * Toggle collapse all functionality (Meridian-compliant)
   */
  toggleCollapseAll() {
    const newState = this.state.collapse.globalState === 'expanded' ? 'collapsed' : 'expanded';
    
    // Update state
    this.updateState({
      collapse: {
        globalState: newState,
        collapsedItems: newState === 'collapsed' 
          ? new Set(this.state.resources.map(r => r.id))
          : new Set()
      }
    });
    
    // Optimized UI update - only update collapse-related elements
    this.updateCollapseStateOnly();
    
    // Save collapse state
    this.saveCollapseState();
    
    // Emit event for other modules
    this.emit('collapseStateChanged', { 
      globalState: newState, 
      collapsedItems: Array.from(this.state.collapse.collapsedItems) 
    });
  }

  /**
   * Toggle individual resource collapse (Meridian-compliant)
   */
  toggleResourceCollapse(resourceId) {
    const newCollapsedItems = new Set(this.state.collapse.collapsedItems);
    
    if (newCollapsedItems.has(resourceId)) {
      newCollapsedItems.delete(resourceId);
    } else {
      newCollapsedItems.add(resourceId);
    }
    
    // Update state
    this.updateState({
      collapse: {
        collapsedItems: newCollapsedItems
      }
    });
    
    // Optimized UI update - only update the specific resource
    this.updateResourceCollapseOnly(resourceId);
    
    // Save collapse state
    this.saveCollapseState();
    
    // Emit event for UI updates
    this.emit('resourceCollapseChanged', { 
      resourceId, 
      isCollapsed: this.state.collapse.collapsedItems.has(resourceId) 
    });
  }

  /**
   * Unified UI update method (Meridian-compliant)
   */
  updateUI() {
    this.updateTagFilters(); // Update tag filters first
    this.updateResourceList(); // Then update resource list
    this.updateButtonStates(); // Then update other button states
    this.updateCounts(); // Finally update counts
  }

  /**
   * Update only the resource list without affecting the sidebar
   */
  updateResourceListOnly() {
    const resourceList = document.getElementById('unified-resource-list');
    if (resourceList) {
      resourceList.innerHTML = this.renderUnifiedResourceList();
    }
  }

  /**
   * Update button states (Meridian-compliant)
   */
  updateButtonStates() {
    // Update collapse all button
    const collapseAllBtn = document.getElementById('unified-collapse-all-btn');
    if (collapseAllBtn) {
      collapseAllBtn.setAttribute('data-state', this.state.collapse.globalState);
      collapseAllBtn.setAttribute('title', 
        this.state.collapse.globalState === 'expanded' ? 'Collapse All Resources' : 'Expand All Resources'
      );
    }
    
    // Update individual collapse buttons and resource items
    document.querySelectorAll('.resource-collapse-btn').forEach(btn => {
      const resourceId = btn.dataset.resourceId;
      const resourceItem = btn.closest('.resource-item');
      if (resourceItem) {
        const isCollapsed = this.state.collapse.collapsedItems.has(resourceId);
        resourceItem.classList.toggle('collapsed', isCollapsed);
      }
    });
    
    // Note: Tag filter buttons are now handled by updateTagFilters() to avoid conflicts
  }

  /**
   * Optimized update for collapse state only (no re-rendering)
   */
  updateCollapseStateOnly() {
    // Update collapse all button
    const collapseAllBtn = document.getElementById('unified-collapse-all-btn');
    if (collapseAllBtn) {
      collapseAllBtn.setAttribute('data-state', this.state.collapse.globalState);
      collapseAllBtn.setAttribute('title', 
        this.state.collapse.globalState === 'expanded' ? 'Collapse All Resources' : 'Expand All Resources'
      );
    }
    
    // Update all resource items' collapse state
    document.querySelectorAll('.resource-item').forEach(item => {
      const resourceId = item.dataset.id;
      const isCollapsed = this.state.collapse.collapsedItems.has(resourceId);
      item.classList.toggle('collapsed', isCollapsed);
    });
  }

  /**
   * Optimized update for single resource collapse only
   */
  updateResourceCollapseOnly(resourceId) {
    const resourceItem = document.querySelector(`.resource-item[data-id="${resourceId}"]`);
    if (resourceItem) {
      const isCollapsed = this.state.collapse.collapsedItems.has(resourceId);
      resourceItem.classList.toggle('collapsed', isCollapsed);
    }
  }

  /**
   * Update resource list
   */
  updateResourceList() {
    const resourceList = document.getElementById('unified-resource-list');
    if (resourceList) {
      resourceList.innerHTML = this.renderUnifiedResourceList();
      
      // Re-setup event listeners for the updated DOM
      this.setupResourceEventListeners();
    }
  }

  /**
   * Update tag filters
   */
  updateTagFilters() {
    const container = document.getElementById('unified-tag-filter-list');
    if (container) {
      const newHtml = this.renderTagFilters();
      container.innerHTML = newHtml;
    }
  }

  /**
   * Update counts (Meridian-compliant)
   */
  updateCounts() {
    const filteredResources = this.getFilteredResources();
    const visibleCount = filteredResources.length;
    const totalCount = this.state.resources.length;
    
    const countElement = document.getElementById('unified-count-text');
    if (countElement) {
      // Calculate the number of digits needed for zero-padding
      const totalDigits = totalCount.toString().length;
      
      // Format the visible count with leading zeros to match total count digits
      const paddedVisibleCount = visibleCount.toString().padStart(totalDigits, '0');
      
      countElement.textContent = `${paddedVisibleCount}/${totalCount}`;
    }
  }

  /**
   * Get filter information for display
   */
  getFilterInfo() {
    const parts = [];
    
    if (this.state.filters.searchTerm.trim()) {
      parts.push(`Search: "${this.state.filters.searchTerm}"`);
    }
    
    if (this.state.filters.activeTags.size > 0) {
      const tags = Array.from(this.state.filters.activeTags).join(', ');
      parts.push(`Tags: ${tags} (${this.state.filters.filterLogic.toUpperCase()})`);
    }
    
    return parts.length > 0 ? parts.join(' | ') : '';
  }

  /**
   * Toggle tag filter (Meridian-compliant)
   */
  toggleTagFilter(tag) {
    const newActiveTags = new Set(this.state.filters.activeTags);
    
    if (newActiveTags.has(tag)) {
      newActiveTags.delete(tag);
    } else {
      newActiveTags.add(tag);
    }
    
    // Update state
    this.updateState({
      filters: {
        activeTags: newActiveTags
      }
    });
    
    // Update UI to reflect the new filter state
    this.updateUI();
    
    // Save filter state
    this.saveFilterState();
    
    // Emit filter change event
    this.emit('filtersApplied', {
      searchTerm: this.state.filters.searchTerm,
      activeTags: Array.from(this.state.filters.activeTags),
      filterLogic: this.state.filters.filterLogic,
      filteredCount: this.getFilteredResources().length
    });
  }

  /**
   * Apply unified filters (Meridian-compliant)
   * This method now only triggers UI updates - filtering is done in renderUnifiedResourceList
   */
  applyFilters() {
    // Update the resource list to reflect current filters
    this.updateResourceList();
    
    // Update counts
    this.updateCounts();
  }

  /**
   * Apply unified filters (legacy method for backward compatibility)
   */
  applyUnifiedFilters() {
    this.applyFilters();
  }

  /**
   * Update unified tag filter buttons (legacy method - now handled by updateButtonStates)
   */
  updateUnifiedTagFilterButtons() {
    this.updateButtonStates();
  }

  /**
   * Update tag filter list (re-render tag filters)
   */
  updateTagFilterList() {
    const container = document.getElementById('unified-tag-filter-list');
    if (container) {
      container.innerHTML = this.renderTagFilters();
    }
  }

  /**
   * Update unified count (legacy method for backward compatibility)
   */
  updateUnifiedCount() {
    this.updateCounts();
  }

  /**
   * Clear all filters (Meridian-compliant)
   */
  clearAllFilters() {
    // Update state
    this.updateState({
      filters: {
        searchTerm: '',
        activeTags: new Set(),
        filterLogic: 'any'
      }
    });
    
    // Clear search input
    const searchInput = document.getElementById('unified-search');
    if (searchInput) {
      searchInput.value = '';
    }
    
    // Update filter logic button
    const filterLogicBtn = document.getElementById('unified-filter-logic-btn');
    if (filterLogicBtn) {
      filterLogicBtn.setAttribute('data-logic', 'any');
      filterLogicBtn.setAttribute('title', 'Toggle Filter Logic: ANY of these tags');
    }
    
    // Clear filter state from localStorage
    try {
      localStorage.removeItem('unifiedFilterState');
      console.log('[UnifiedResourceManager] Cleared filter state from localStorage');
    } catch (error) {
      console.warn('[UnifiedResourceManager] Failed to clear filter state from localStorage:', error);
    }
    
    // Update UI to reflect cleared filters
    this.updateUI();
    
    // Emit clear filters event
    this.emit('filtersCleared', {
      filteredCount: this.state.resources.length
    });
  }

  /**
   * Add tag to resource (Meridian-compliant)
   */
  async addTagToResource(resourceId, tagValue) {
    try {
      // Get ModalManager for user feedback
      const modalManager = this.getApp().getModule('ModalManager');
      
      // Add tag via backend API
      const updatedResource = await window.electronAPI.unified.addTagToResource(resourceId, tagValue);
      
      // Update local state
      const resourceIndex = this.state.resources.findIndex(r => r.id === resourceId);
      if (resourceIndex !== -1) {
        this.updateState({
          resources: this.state.resources.map((r, i) => 
            i === resourceIndex ? updatedResource : r
          )
        });
      }
      
      // Update UI
      this.updateUI();
      
      // Show success message
      if (modalManager && typeof modalManager.showSuccess === 'function') {
        modalManager.showSuccess('Tag added successfully');
      } else {
        this.showSuccess('Tag added successfully');
      }
      
      // Emit event
      this.emit('tagAdded', { resourceId, tagValue });
      
    } catch (error) {
      console.error('[UnifiedResourceManager] Error adding tag:', error);
      this.emit('error', { operation: 'addTag', error: error.message });
      this.showError('Failed to add tag');
    }
  }

  /**
   * Remove tag from resource (Meridian-compliant)
   */
  async removeTagFromResource(resourceId, tag) {
    try {
      // Get ModalManager for user feedback
      const modalManager = this.getApp().getModule('ModalManager');
      
      // Remove tag via backend API
      const updatedResource = await window.electronAPI.unified.removeTagFromResource(resourceId, tag);
      
      // Update local state
      const resourceIndex = this.state.resources.findIndex(r => r.id === resourceId);
      if (resourceIndex !== -1) {
        this.updateState({
          resources: this.state.resources.map((r, i) => 
            i === resourceIndex ? updatedResource : r
          )
        });
      }
      
      // Update UI
      this.updateUI();
      
      // Show success message
      if (modalManager && typeof modalManager.showSuccess === 'function') {
        modalManager.showSuccess('Tag removed successfully');
      } else {
        this.showSuccess('Tag removed successfully');
      }
      
      // Emit event
      this.emit('tagRemoved', { resourceId, tag });
      
    } catch (error) {
      console.error('[UnifiedResourceManager] Error removing tag:', error);
      this.emit('error', { operation: 'removeTag', error: error.message });
      this.showError('Failed to remove tag');
    }
  }

  /**
   * Initialize collapse state (Meridian-compliant)
   */
  initializeCollapseState() {
    try {
      const saved = localStorage.getItem('unifiedCollapseState');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.updateState({
          collapse: {
            globalState: parsed.globalState || 'expanded',
            collapsedItems: new Set(parsed.collapsedItems || [])
          }
        }, false); // Don't emit event during initialization
      }
    } catch (error) {
      console.warn('[UnifiedResourceManager] Failed to load collapse state:', error);
    }
  }

  /**
   * Save collapse state (Meridian-compliant)
   */
  saveCollapseState() {
    try {
      const state = {
        globalState: this.state.collapse.globalState,
        collapsedItems: Array.from(this.state.collapse.collapsedItems)
      };
      localStorage.setItem('unifiedCollapseState', JSON.stringify(state));
    } catch (error) {
      console.warn('[UnifiedResourceManager] Failed to save collapse state:', error);
    }
  }

  /**
   * Load filter state from localStorage (Meridian-compliant)
   */
  loadFilterState() {
    try {
      const saved = localStorage.getItem('unifiedFilterState');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.updateState({
          filters: {
            searchTerm: parsed.searchTerm || '',
            activeTags: new Set(parsed.activeTags || []),
            filterLogic: parsed.filterLogic || 'any'
          }
        }, false); // Don't emit event during initialization
        console.log('[UnifiedResourceManager] Loaded filter state:', parsed);
      }
    } catch (error) {
      console.warn('[UnifiedResourceManager] Failed to load filter state:', error);
    }
  }

  /**
   * Save filter state to localStorage (Meridian-compliant)
   */
  saveFilterState() {
    try {
      const filterState = {
        searchTerm: this.state.filters.searchTerm,
        activeTags: Array.from(this.state.filters.activeTags),
        filterLogic: this.state.filters.filterLogic
      };
      localStorage.setItem('unifiedFilterState', JSON.stringify(filterState));
      console.log('[UnifiedResourceManager] Saved filter state:', filterState);
    } catch (error) {
      console.warn('[UnifiedResourceManager] Failed to save filter state:', error);
    }
  }

  /**
   * Open modal for adding unified resource
   */
  async openAddUnifiedResourceModal() {
    console.log('[UnifiedResourceManager] ===== OPENING ADD UNIFIED RESOURCE MODAL =====');
    this.editingResourceId = null;
    this.modalTags = [];
    
    // Create modal HTML content (without modal-overlay wrapper)
    const modalContent = `
      <div class="modal-header">
        <h3>Add Unified Resource</h3>
        <button class="modal-close">&times;</button>
      </div>
      
      <div class="modal-subheader">
        <div class="modal-tab-navigation">
          <button class="modal-tab-btn active" data-tab="internal">Internal Resources</button>
          <button class="modal-tab-btn" data-tab="external">External Resources</button>
        </div>
      </div>
      
      <div class="modal-content">
        <!-- Internal Resources Tab -->
        <div class="modal-tab-panel active" id="internal-tab">
          <div class="modal-tab-phase-cards">
            <div class="modal-tab-phase-card active" data-phase="selection">
              <div class="phase-number">1</div>
              <div class="phase-title">Select Files</div>
            </div>
            <div class="modal-tab-phase-card" data-phase="metadata">
              <div class="phase-number">2</div>
              <div class="phase-title">Edit Metadata</div>
            </div>
            <div class="modal-tab-phase-card" data-phase="arweave">
              <div class="phase-number">3</div>
              <div class="phase-title">Arweave Upload</div>
            </div>
            <div class="modal-tab-phase-card" data-phase="review">
              <div class="phase-number">4</div>
              <div class="phase-title">Review & Confirm</div>
            </div>
          </div>
          
          <!-- Phase 1: File Selection -->
          <div class="modal-tab-content" id="internal-selection-phase">
            <h4>Select Local Files</h4>
            <p>Choose files from your local system to add to the unified resource system.</p>
            
            <div class="file-selection-area">
              <button type="button" id="choose-files-btn" class="primary-btn">Choose Files</button>
              <p>or drag files here</p>
              
              <div id="selected-files-list" class="selected-files-list">
                <!-- Selected files will appear here -->
              </div>
              
              <button type="button" id="clear-selection-btn" class="secondary-btn" style="display: none;">Clear Selection</button>
            </div>
          </div>
          
          <!-- Phase 2: Metadata (hidden initially) -->
          <div class="modal-tab-content" id="internal-metadata-phase" style="display: none;">
            <h4>Edit Resource Metadata</h4>
            <p>Configure metadata for the selected files.</p>
            
            <div class="bulk-settings">
              <h5>Bulk Settings</h5>
              <div class="form-group">
                <label for="bulk-title">Title:</label>
                <input type="text" id="bulk-title" placeholder="My Documents" />
              </div>
              <div class="form-group">
                <label for="bulk-description">Description:</label>
                <textarea id="bulk-description" rows="2" placeholder="Personal files"></textarea>
              </div>
              <div class="form-group">
                <label for="bulk-tags">Tags:</label>
                <input type="text" id="bulk-tags" placeholder="personal, documents" />
              </div>
            </div>
            
            <div id="individual-files-metadata">
              <!-- Individual file metadata will appear here -->
            </div>
          </div>
          
          <!-- Phase 3: Arweave Upload (hidden initially) -->
          <div class="modal-tab-content" id="internal-arweave-phase" style="display: none;">
            <h4>Upload to Arweave (Optional)</h4>
            <p>Would you like to upload your files to Arweave for permanent storage? This is optional - your files will be added to the database regardless.</p>
            
            <div class="arweave-choice-section">
              <div class="arweave-choice-option">
                <label class="arweave-choice-label">
                  <input type="radio" name="arweave-choice" value="yes" id="arweave-yes" />
                  <div class="arweave-choice-content">
                    <div class="arweave-choice-header">
                      <span class="arweave-choice-title">Yes, upload to Arweave</span>
                      <span class="arweave-choice-subtitle">Files will be permanently stored on Arweave blockchain</span>
                    </div>
                    <div class="arweave-choice-benefits">
                      <ul>
                        <li>Permanent, decentralized storage</li>
                        <li>Arweave hashes indexed in database</li>
                        <li>Files accessible via Arweave gateway</li>
                      </ul>
                    </div>
                  </div>
                </label>
              </div>
              
              <div class="arweave-choice-option">
                <label class="arweave-choice-label">
                  <input type="radio" name="arweave-choice" value="no" id="arweave-no" checked />
                  <div class="arweave-choice-content">
                    <div class="arweave-choice-header">
                      <span class="arweave-choice-title">No, just add to database</span>
                      <span class="arweave-choice-subtitle">Files will only be indexed locally</span>
                    </div>
                    <div class="arweave-choice-benefits">
                      <ul>
                        <li>Fast, no upload required</li>
                        <li>No additional cost</li>
                        <li>Local file references only</li>
                      </ul>
                    </div>
                  </div>
                </label>
              </div>
            </div>
            
            <!-- Arweave Upload Configuration (shown only when "Yes" is selected) -->
            <div class="arweave-upload-config" id="arweave-upload-config" style="display: none;">
              <h5>Upload Configuration</h5>
              
              <!-- File Selection -->
              <div class="file-selection-section">
                <h6>Select Files to Upload</h6>
                <div class="file-upload-controls">
                  <div class="file-upload-header-controls">
                    <span class="file-upload-title">Choose which files to upload:</span>
                    <div class="file-upload-buttons">
                      <button type="button" class="secondary-btn select-all-files-btn">Select All</button>
                      <button type="button" class="secondary-btn deselect-all-files-btn">Deselect All</button>
                    </div>
                  </div>
                </div>
                <div class="file-upload-list" id="file-upload-list">
                  <!-- Individual file upload controls will be generated here -->
                </div>
              </div>
              
              <!-- Tags Section -->
              <div class="arweave-tags-section" id="arweave-tags-section">
                <h6>Upload Tags (Optional)</h6>
                <p>Add custom tags to help categorize and identify your uploads on Arweave.</p>
                
                <div class="tags-input">
                  <div class="form-group-inline">
                    <input
                      type="text"
                      id="arweave-tag-key"
                      placeholder="Tag key (e.g., title, author, category)"
                    />
                    <input
                      type="text"
                      id="arweave-tag-value"
                      placeholder="Tag value (e.g., My Document, John Doe, personal)"
                    />
                    <button type="button" id="add-arweave-tag-btn" class="secondary-btn">
                      Add Tag
                    </button>
                  </div>
                </div>
                
                <div class="arweave-tags-list" id="arweave-tags-list">
                  <p class="no-tags">No tags added yet</p>
                </div>
              </div>
              
              <!-- Upload Summary -->
              <div class="upload-summary" id="upload-summary" style="display: none;">
                <h6>Upload Summary</h6>
                <div class="total-cost">Total Estimated Cost: <span id="total-cost">0 AR</span></div>
                <div class="upload-progress" id="upload-progress" style="display: none;">
                  <div class="progress-bar">
                    <div class="progress-fill" id="upload-progress-fill"></div>
                  </div>
                  <div class="progress-text" id="upload-progress-text">0%</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Phase 4: Review (hidden initially) -->
          <div class="modal-tab-content" id="internal-review-phase" style="display: none;">
            <h4>Review & Confirm</h4>
            <p>Review the files and metadata before adding them.</p>
            
            <!-- Bulk Tag Management -->
            <div class="bulk-tag-management">
              <h5>Bulk Tags</h5>
              <p>Add tags to all resources being added:</p>
              <div class="bulk-tag-input">
                <div class="tag-input-container">
                  <input type="text" class="tag-input" id="bulk-tag-input" placeholder="add tag to all resources...">
                  <button type="button" class="add-tag-btn" id="bulk-add-tag-btn" disabled>+</button>
                </div>
                <div class="tag-autocomplete" id="bulk-tag-autocomplete" style="display: none;"></div>
              </div>
              <div class="bulk-tags-list" id="bulk-tags-list">
                <!-- Bulk tags will appear here -->
              </div>
            </div>
            
            <!-- Resource Previews -->
            <div class="resource-previews-section">
              <h5>Resource Previews</h5>
              <div id="internal-resource-previews">
                <!-- Resource previews will appear here -->
              </div>
            </div>
            
            <div id="review-summary">
              <!-- Additional review summary will appear here -->
            </div>
          </div>
        </div>
        
        <!-- External Resources Tab -->
        <div class="modal-tab-panel" id="external-tab">
          <div class="modal-tab-phase-cards">
            <div class="modal-tab-phase-card active" data-phase="input">
              <div class="phase-number">1</div>
              <div class="phase-title">Enter URLs</div>
            </div>
            <div class="modal-tab-phase-card" data-phase="processing">
              <div class="phase-number">2</div>
              <div class="phase-title">Processing</div>
            </div>
            <div class="modal-tab-phase-card" data-phase="review">
              <div class="phase-number">3</div>
              <div class="phase-title">Review & Confirm</div>
            </div>
          </div>
          
          <!-- Phase 1: URL Input -->
          <div class="modal-tab-content" id="external-input-phase">
            <h4>Enter URLs</h4>
            <p>Add web resources by entering their URLs.</p>
            
            <div class="form-group">
              <label for="external-urls">URLs (one per line):</label>
              <textarea id="external-urls" rows="5" placeholder="https://example.com&#10;https://another-example.com"></textarea>
            </div>
            
            <div class="form-actions">
              <button type="button" id="process-urls-btn" class="primary-btn">Process URLs</button>
            </div>
          </div>
          
          <!-- Phase 2: Processing (hidden initially) -->
          <div class="modal-tab-content" id="external-processing-phase" style="display: none;">
            <h4>Processing URLs</h4>
            <p>Extracting metadata from the provided URLs...</p>
            
            <div class="progress-container">
              <div class="progress-bar">
                <div class="progress-fill" id="processing-progress"></div>
              </div>
              <div class="progress-text" id="processing-text">0%</div>
            </div>
            
            <div id="processing-log" class="processing-log">
              <!-- Processing log will appear here -->
            </div>
          </div>
          
          <!-- Phase 3: Review (hidden initially) -->
          <div class="modal-tab-content" id="external-review-phase" style="display: none;">
            <h4>Review & Confirm</h4>
            <p>Review the extracted metadata before adding resources.</p>
            
            <!-- Bulk Tag Management -->
            <div class="bulk-tag-management">
              <h5>Bulk Tags</h5>
              <p>Add tags to all resources being added:</p>
              <div class="bulk-tag-input">
                <div class="tag-input-container">
                  <input type="text" class="tag-input" id="external-bulk-tag-input" placeholder="add tag to all resources...">
                  <button type="button" class="add-tag-btn" id="external-bulk-add-tag-btn" disabled>+</button>
                </div>
                <div class="tag-autocomplete" id="external-bulk-tag-autocomplete" style="display: none;"></div>
              </div>
              <div class="bulk-tags-list" id="external-bulk-tags-list">
                <!-- Bulk tags will appear here -->
              </div>
            </div>
            
            <!-- Resource Previews -->
            <div class="resource-previews-section">
              <h5>Resource Previews</h5>
              <div id="external-resource-previews">
                <!-- Resource previews will appear here -->
              </div>
            </div>
            

          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <div class="footer-left">
          <button type="button" class="secondary-btn modal-cancel">Cancel</button>
        </div>
        <div class="footer-right">
          <button type="button" id="modal-back-btn" class="secondary-btn" style="display: none;">Back</button>
          <button type="button" id="modal-next-btn" class="primary-btn">Next</button>
          <button type="button" id="modal-add-btn" class="primary-btn" style="display: none;">Add Resources</button>
        </div>
      </div>
    `;
    
    // Create the modal using ModalManager
    const modalManager = this.getApp().getModalManager();
    if (!modalManager) {
      console.error('[UnifiedResourceManager] ModalManager not available');
      return;
    }
    
    // Create dynamic modal
    const modal = modalManager.createDynamicModal('unified-resource-modal', modalContent, {
      size: 'large'
    });
    
    // Add large-modal class
    modal.classList.add('large-modal');
    
    // Setup modal event listeners
    this.setupModalEventListeners();
    
    // Open the modal
    await modalManager.openModal('unified-resource-modal');
  }

  /**
   * Setup modal event listeners
   */
  setupModalEventListeners() {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) {
      console.error('[UnifiedResourceManager] Modal not found!');
      return;
    }

    console.log('[UnifiedResourceManager] Setting up modal event listeners...');

    // Modal state
    this.modalState = {
      activeTab: 'internal',
      internal: {
        selectedFiles: [],
        bulkMetadata: {
          title: '',
          description: '',
          tags: []
        },
        individualMetadata: {},
        resourcePreviews: [], // NEW: Generated previews for review phase
        bulkTags: [], // NEW: Tags applied to all resources
        individualTags: {}, // NEW: Tags per resource {resourceId: [tags]}
        arweaveSettings: {
          enabled: false,
          uploadTags: [], // Array of {key, value} objects (from UploadManager pattern)
          selectedFiles: new Set(), // Which files to upload
          uploadResults: [], // Results from uploads
          fileCosts: {}, // Cost estimates for each file
          totalCost: { ar: '0', usd: '0' }
        },
        phase: 'selection'
      },
      external: {
        urls: [],
        processingResults: [],
        resourcePreviews: [], // NEW: Generated previews for review phase
        bulkTags: [], // NEW: Tags applied to all resources
        individualTags: {}, // NEW: Tags per resource
        phase: 'input'
      }
    };

    // Tab navigation
    const tabBtns = modal.querySelectorAll('.modal-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchModalTab(tab);
      });
    });

    // Internal tab - File selection
    const chooseFilesBtn = modal.querySelector('#choose-files-btn');
    if (chooseFilesBtn) {
      chooseFilesBtn.addEventListener('click', () => {
        this.chooseFiles();
      });
    }

    const clearSelectionBtn = modal.querySelector('#clear-selection-btn');
    if (clearSelectionBtn) {
      clearSelectionBtn.addEventListener('click', () => {
        this.clearFileSelection();
      });
    }

    // External tab - URL processing
    const processUrlsBtn = modal.querySelector('#process-urls-btn');
    if (processUrlsBtn) {
      processUrlsBtn.addEventListener('click', () => {
        this.processUrls();
      });
    }

    // Modal navigation buttons
    const nextBtn = modal.querySelector('#modal-next-btn');
    const backBtn = modal.querySelector('#modal-back-btn');
    const addBtn = modal.querySelector('#modal-add-btn');

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.nextModalPhase();
      });
    }

    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.previousModalPhase();
      });
    }

    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.addModalResources();
      });
    }

    // Close modal
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const modalManager = this.getApp().getModalManager();
        if (modalManager) {
          modalManager.closeModal('unified-resource-modal');
        }
      });
    }

    // Arweave upload settings - updated for radio button approach
    const arweaveYesRadio = modal.querySelector('#arweave-yes');
    const arweaveNoRadio = modal.querySelector('#arweave-no');
    
    if (arweaveYesRadio) {
      arweaveYesRadio.addEventListener('change', (e) => {
        console.log('[UnifiedResourceManager] Arweave upload selected: YES');
        this.modalState.internal.arweaveSettings.enabled = true;
        this.updateArweaveUploadUI();
      });
    }
    
    if (arweaveNoRadio) {
      arweaveNoRadio.addEventListener('change', (e) => {
        console.log('[UnifiedResourceManager] Arweave upload selected: NO');
        this.modalState.internal.arweaveSettings.enabled = false;
        this.updateArweaveUploadUI();
      });
    }

    // Arweave tag management (based on UploadManager.setupUploadEvents)
    const addTagBtn = modal.querySelector('#add-arweave-tag-btn');
    if (addTagBtn) {
      addTagBtn.addEventListener('click', () => {
        this.addArweaveUploadTag();
      });
    }

    // Allow Enter key to add tags
    const tagKeyInput = modal.querySelector('#arweave-tag-key');
    const tagValueInput = modal.querySelector('#arweave-tag-value');
    
    if (tagKeyInput && tagValueInput) {
      [tagKeyInput, tagValueInput].forEach(input => {
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.addArweaveUploadTag();
          }
        });
      });
    }

    console.log('[UnifiedResourceManager] Modal event listeners set up successfully');
  }

  /**
   * Switch between modal tabs
   */
  switchModalTab(tab) {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    this.modalState.activeTab = tab;

    // Update tab buttons
    modal.querySelectorAll('.modal-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Update tab panels
    modal.querySelectorAll('.modal-tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tab}-tab`);
    });

    // Reset phase for the new tab
    if (tab === 'internal') {
      this.modalState.internal.phase = 'selection';
      this.showInternalPhase('selection');
    } else {
      this.modalState.external.phase = 'input';
      this.showExternalPhase('input');
    }

    this.updateModalButtons();
  }

  /**
   * Show internal tab phase
   */
  showInternalPhase(phase) {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    console.log('[UnifiedResourceManager] showInternalPhase called with phase:', phase);

    // Hide all phases
    modal.querySelectorAll('#internal-tab .modal-tab-content').forEach(content => {
      content.style.display = 'none';
    });

    // Show selected phase
    const phaseElement = modal.querySelector(`#internal-${phase}-phase`);
    if (phaseElement) {
      phaseElement.style.display = 'block';
    }

    // Update phase cards
    modal.querySelectorAll('#internal-tab .modal-tab-phase-card').forEach(card => {
      card.classList.toggle('active', card.dataset.phase === phase);
    });

    this.modalState.internal.phase = phase;
    
    // Special handling for different phases
    if (phase === 'metadata') {
      console.log('[UnifiedResourceManager] Showing metadata phase, setting up metadata capture');
      this.setupMetadataCapture();
    } else if (phase === 'arweave') {
      console.log('[UnifiedResourceManager] Showing Arweave phase, calling renderArweaveUploadPhase');
      this.renderArweaveUploadPhase();
      
      // Check if the enable checkbox is visible
      setTimeout(() => {
        const enableCheckbox = modal.querySelector('#enable-arweave-upload');
        console.log('[UnifiedResourceManager] Arweave phase - enable checkbox found:', enableCheckbox);
        if (enableCheckbox) {
          console.log('[UnifiedResourceManager] Enable checkbox visible:', enableCheckbox.offsetParent !== null);
          console.log('[UnifiedResourceManager] Enable checkbox checked:', enableCheckbox.checked);
        }
      }, 100);
    } else if (phase === 'review') {
      console.log('[UnifiedResourceManager] Showing review phase, generating previews and setting up tag management');
      this.generateInternalResourcePreviews();
      this.renderBulkTags('internal');
      this.setupBulkTagEventListeners();
      this.renderReviewPhase();
    }
    
    this.updateModalButtons();
  }

  /**
   * Show external tab phase
   */
  showExternalPhase(phase) {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    // Hide all phases
    modal.querySelectorAll('#external-tab .modal-tab-content').forEach(content => {
      content.style.display = 'none';
    });

    // Show selected phase
    const phaseElement = modal.querySelector(`#external-${phase}-phase`);
    if (phaseElement) {
      phaseElement.style.display = 'block';
    }

    // Update phase cards
    modal.querySelectorAll('#external-tab .modal-tab-phase-card').forEach(card => {
      card.classList.toggle('active', card.dataset.phase === phase);
    });

    this.modalState.external.phase = phase;
    
    // Generate previews when entering review phase
    if (phase === 'review') {
      this.generateExternalResourcePreviews();
      this.renderBulkTags('external');
      this.setupBulkTagEventListeners();
    }
    
    this.updateModalButtons();
  }

  /**
   * Update modal navigation buttons
   */
  updateModalButtons() {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    const nextBtn = modal.querySelector('#modal-next-btn');
    const backBtn = modal.querySelector('#modal-back-btn');
    const addBtn = modal.querySelector('#modal-add-btn');

    if (this.modalState.activeTab === 'internal') {
      const phase = this.modalState.internal.phase;
      const hasFiles = this.modalState.internal.selectedFiles.length > 0;

      backBtn.style.display = phase === 'selection' ? 'none' : 'inline-block';
      nextBtn.style.display = (phase === 'review' || !hasFiles) ? 'none' : 'inline-block';
      addBtn.style.display = phase === 'review' && hasFiles ? 'inline-block' : 'none';

      if (phase === 'selection') {
        nextBtn.textContent = 'Next';
        nextBtn.disabled = !hasFiles;
      } else if (phase === 'metadata') {
        nextBtn.textContent = 'Next';
        nextBtn.disabled = false;
      }
    } else {
      const phase = this.modalState.external.phase;
      const hasUrls = this.modalState.external.urls.length > 0;

      backBtn.style.display = phase === 'input' ? 'none' : 'inline-block';
      nextBtn.style.display = (phase === 'review' || !hasUrls) ? 'none' : 'inline-block';
      addBtn.style.display = phase === 'review' && hasUrls ? 'inline-block' : 'none';

      if (phase === 'input') {
        nextBtn.textContent = 'Process URLs';
        nextBtn.disabled = !hasUrls;
      } else if (phase === 'processing') {
        nextBtn.textContent = 'Next';
        nextBtn.disabled = true;
      }
    }
  }

  /**
   * Next modal phase
   */
  nextModalPhase() {
    console.log('[UnifiedResourceManager] nextModalPhase called');
    console.log('[UnifiedResourceManager] Current modal state:', this.modalState);
    
    if (this.modalState.activeTab === 'internal') {
      const currentPhase = this.modalState.internal.phase;
      console.log('[UnifiedResourceManager] Current internal phase:', currentPhase);
      
      if (currentPhase === 'selection') {
        console.log('[UnifiedResourceManager] Moving from selection to metadata');
        this.showInternalPhase('metadata');
      } else if (currentPhase === 'metadata') {
        console.log('[UnifiedResourceManager] Moving from metadata to arweave');
        this.showInternalPhase('arweave');
      } else if (currentPhase === 'arweave') {
        console.log('[UnifiedResourceManager] Moving from arweave to review - executing uploads first');
        this.executeArweaveUploadsAndContinue();
      }
    } else {
      const currentPhase = this.modalState.external.phase;
      if (currentPhase === 'input') {
        this.processUrls();
      } else if (currentPhase === 'processing') {
        this.showExternalPhase('review');
      }
    }
  }

  /**
   * Previous modal phase
   */
  previousModalPhase() {
    if (this.modalState.activeTab === 'internal') {
      const currentPhase = this.modalState.internal.phase;
      if (currentPhase === 'metadata') {
        this.showInternalPhase('selection');
      } else if (currentPhase === 'arweave') {
        this.showInternalPhase('metadata');
      } else if (currentPhase === 'review') {
        this.showInternalPhase('arweave');
      }
    } else {
      const currentPhase = this.modalState.external.phase;
      if (currentPhase === 'processing') {
        this.showExternalPhase('input');
      } else if (currentPhase === 'review') {
        this.showExternalPhase('processing');
      }
    }
  }

  /**
   * Choose files for internal resources
   */
  async chooseFiles() {
    try {
      // For now, use a simple file input
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      
      input.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        console.log('[UnifiedResourceManager] Files selected:', files);
        this.modalState.internal.selectedFiles = files;
        console.log('[UnifiedResourceManager] Files stored in modal state:', this.modalState.internal.selectedFiles);
        this.updateFileSelectionDisplay();
        this.updateModalButtons();
      });
      
      input.click();
    } catch (error) {
      console.error('[UnifiedResourceManager] Error choosing files:', error);
      this.showError('Failed to choose files');
    }
  }

  /**
   * Update file selection display
   */
  updateFileSelectionDisplay() {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    const filesList = modal.querySelector('#selected-files-list');
    const clearBtn = modal.querySelector('#clear-selection-btn');
    const files = this.modalState.internal.selectedFiles;

    if (files.length === 0) {
      filesList.innerHTML = '<p>No files selected</p>';
      clearBtn.style.display = 'none';
    } else {
      filesList.innerHTML = files.map(file => `
        <div class="selected-file">
          <span class="file-name">${this.escapeHtml(file.name)}</span>
          <span class="file-size">(${this.formatFileSize(file.size)})</span>
        </div>
      `).join('');
      clearBtn.style.display = 'inline-block';
    }
  }

  /**
   * Clear file selection
   */
  clearFileSelection() {
    this.modalState.internal.selectedFiles = [];
    this.updateFileSelectionDisplay();
    this.updateModalButtons();
  }

  /**
   * Process URLs for external resources
   */
  async processUrls() {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    const urlsText = modal.querySelector('#external-urls').value;
    const urls = urlsText.split('\n').filter(url => url.trim());
    
    if (urls.length === 0) {
      this.showError('Please enter at least one URL');
      return;
    }

    this.modalState.external.urls = urls;
    this.modalState.external.processingResults = [];
    this.showExternalPhase('processing');

    // Process each URL and extract metadata
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i].trim();
      const progress = ((i + 1) / urls.length) * 100;
      
      // Update progress
      const progressFill = modal.querySelector('#processing-progress');
      const progressText = modal.querySelector('#processing-text');
      if (progressFill) progressFill.style.width = `${progress}%`;
      if (progressText) progressText.textContent = `${Math.round(progress)}%`;

      // Add to processing log
      this.addProcessingLog(`Processing: ${url}`);

      try {
        // Extract metadata using the same method as ResourceManager
        const metadata = await window.electronAPI.collate.extractMetadata(url);
        
        // Add result with extracted metadata
        this.modalState.external.processingResults.push({
          url: url,
          title: metadata.title || `Page from ${new URL(url).hostname}`,
          description: metadata.description || `Web page from ${url}`,
          tags: ['web', 'external']
        });

        this.addProcessingLog(`✓ Extracted metadata for: ${metadata.title || url}`);
      } catch (error) {
        console.error(`Failed to extract metadata for ${url}:`, error);
        
        // Fallback to basic metadata
        this.modalState.external.processingResults.push({
          url: url,
          title: `Page from ${new URL(url).hostname}`,
          description: `Web page from ${url}`,
          tags: ['web', 'external']
        });

        this.addProcessingLog(`⚠ Could not extract metadata for: ${url}, using fallback`);
      }
    }

    this.showExternalPhase('review');
  }

  /**
   * Add processing log entry
   */
  addProcessingLog(message) {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    const log = modal.querySelector('#processing-log');
    if (log) {
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.textContent = message;
      log.appendChild(entry);
      log.scrollTop = log.scrollHeight;
    }
  }



  /**
   * Add modal resources
   */
  async addModalResources() {
    try {
      if (this.modalState.activeTab === 'internal') {
        await this.addInternalResources();
      } else {
        await this.addExternalResources();
      }

      const modal = document.getElementById('unified-resource-modal');
      if (modal) {
        modal.remove();
      }
      
      this.showSuccess('Resources added successfully');
    } catch (error) {
      console.error('[UnifiedResourceManager] Error adding resources:', error);
      this.showError('Failed to add resources');
    }
  }

  /**
   * Add internal resources
   */
  async addInternalResources() {
    const files = this.modalState.internal.selectedFiles;
    const bulkMetadata = this.modalState.internal.bulkMetadata;
    const arweaveSettings = this.modalState.internal.arweaveSettings;

    // Uploads are now executed during the modal flow, so we just use the results
    console.log('[UnifiedResourceManager] Adding internal resources with upload results:', arweaveSettings.uploadResults);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const previewId = `preview-${i}`;
      const resourceId = await this.generateResourceId();
      const contentHash = await this.generateContentHash(file.name);
      const now = new Date().toISOString();

      // Get accumulated tags for this resource
      const accumulatedTags = this.accumulateResourceTags(previewId);

      // Check if this file was uploaded to Arweave during the modal flow
      const arweaveResult = arweaveSettings.uploadResults[i];
      const arweaveHashes = [];
      
      if (arweaveResult && arweaveResult.success) {
        arweaveHashes.push({
          hash: arweaveResult.transactionId,
          timestamp: now,
          link: `https://www.arweave.net/${arweaveResult.transactionId}`,
          tags: arweaveResult.tags || [] // Include the tags used for upload
        });
      }

      const resource = {
        id: resourceId,
        uri: `urn:meridian:resource:${resourceId}`,
        contentHash: contentHash,
        properties: {
          'dc:title': bulkMetadata.title || file.name,
          'dc:type': 'document',
          'meridian:tags': accumulatedTags,
          'meridian:description': bulkMetadata.description || '',
          'meridian:arweave_hashes': arweaveHashes // Add Arweave hashes with tags
        },
        locations: {
          primary: {
            type: 'file-path',
            value: file.path || file.name,
            accessible: true,
            lastVerified: now,
          },
          alternatives: arweaveHashes.map(hash => ({
            type: 'arweave-hash',
            value: hash.hash,
            accessible: true,
            lastVerified: now,
          }))
        },
        state: {
          type: 'internal',
          accessible: true,
          lastVerified: now,
          verificationStatus: 'verified',
        },
        timestamps: {
          created: now,
          modified: now,
          lastAccessed: now,
        },
      };

      await this.addUnifiedResource(resource);
    }
  }

  /**
   * Add external resources
   */
  async addExternalResources() {
    const results = this.modalState.external.processingResults;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const previewId = `preview-${i}`;
      const resourceId = await this.generateResourceId();
      const contentHash = await this.generateContentHash(result.url);
      const now = new Date().toISOString();

      // Get accumulated tags for this resource
      const accumulatedTags = this.accumulateResourceTags(previewId);

      const resource = {
        id: resourceId,
        uri: `urn:meridian:resource:${resourceId}`,
        contentHash: contentHash,
        properties: {
          'dc:title': result.title,
          'dc:type': 'web-page',
          'meridian:tags': accumulatedTags,
          'meridian:description': result.description,
        },
        locations: {
          primary: {
            type: 'http-url',
            value: result.url,
            accessible: true,
            lastVerified: now,
          },
          alternatives: [],
        },
        state: {
          type: 'external',
          accessible: true,
          lastVerified: now,
          verificationStatus: 'verified',
        },
        timestamps: {
          created: now,
          modified: now,
          lastAccessed: now,
        },
      };

      await this.addUnifiedResource(resource);
    }
  }

  /**
   * Format file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Show tag suggestions based on existing tags
   */
  showTagSuggestions(input) {
    const suggestions = this.getTagSuggestions(input);
    const display = document.getElementById('modal-tags-display');
    
    if (suggestions.length > 0 && input) {
      display.innerHTML = `
        <div class="tag-suggestions">
          ${suggestions.map(tag => `
            <button type="button" class="tag-suggestion" onclick="this.closest('.modal').querySelector('#resource-tag-input').value='${tag}'; this.closest('.tag-suggestions').remove();">
              ${this.escapeHtml(tag)}
            </button>
          `).join('')}
        </div>
      `;
    } else {
      this.hideTagSuggestions();
    }
  }

  /**
   * Hide tag suggestions
   */
  hideTagSuggestions() {
    const display = document.getElementById('modal-tags-display');
    if (display) {
      display.innerHTML = '';
    }
  }

  /**
   * Get tag suggestions based on input
   */
  getTagSuggestions(input) {
    if (!input) return [];
    
    const allTags = this.getAllTags();
    const inputLower = input.toLowerCase();
    
    return allTags
      .filter(tag => tag.toLowerCase().includes(inputLower))
      .slice(0, 5); // Limit to 5 suggestions
  }

  /**
   * Handle adding unified resource
   */
  async handleAddUnifiedResource() {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    const type = modal.querySelector('#resource-type').value;
    const url = modal.querySelector('#resource-url').value;
    const filePath = modal.querySelector('#resource-file-path').value;
    const title = modal.querySelector('#resource-title').value;
    const description = modal.querySelector('#resource-description').value;
    const tags = [...this.modalTags];

    // Validate required fields
    if (!title) {
      this.showError('Title is required');
      return;
    }

    if (type === 'external' && !url) {
      this.showError('URL is required for external resources');
      return;
    }

    if (type === 'internal' && !filePath) {
      this.showError('File path is required for internal resources');
      return;
    }

    // TODO: Generate UUID and content hash via backend
    const resourceId = await this.generateResourceId();
    const contentHash = await this.generateContentHash(type === 'external' ? url : filePath);

    // Create resource
    const now = new Date().toISOString();
    const resource = {
      id: resourceId,
      uri: `urn:meridian:resource:${resourceId}`,
      contentHash: contentHash,
      properties: {
        'dc:title': title,
        'dc:type': type === 'external' ? 'web-page' : 'document',
        'meridian:tags': tags,
        'meridian:description': description,
      },
      locations: {
        primary: {
          type: type === 'external' ? 'http-url' : 'file-path',
          value: type === 'external' ? url : filePath,
          accessible: true,
          lastVerified: now,
        },
        alternatives: [],
      },
      state: {
        type: type,
        accessible: true,
        lastVerified: now,
        verificationStatus: 'verified',
      },
      timestamps: {
        created: now,
        modified: now,
        lastAccessed: now,
      },
    };

    await this.addUnifiedResource(resource);
    
    // Close modal
    modal.remove();
    this.showSuccess('Resource added successfully');
  }

  /**
   * Generate resource ID using backend
   */
  async generateResourceId() {
    // The backend DataManager.generateId() method is used when adding resources
    // This method is kept for compatibility but the actual ID generation
    // happens in the backend when calling addUnifiedResource
    return 'temp-' + Math.random().toString(36).slice(2);
  }

  /**
   * Generate content hash using backend
   */
  async generateContentHash(content) {
    // For now, use a simple hash since we don't have a dedicated backend method
    // In the future, this could call a backend method for proper SHA-256 hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return 'sha256:' + hashHex;
  }

  /**
   * Add tag to modal
   */
  addModalTag(tagValue) {
    if (!this.modalTags.includes(tagValue)) {
      this.modalTags.push(tagValue);
      this.renderModalTags();
    }
  }

  /**
   * Render modal tags
   */
  renderModalTags() {
    const display = document.getElementById('modal-tags-display');
    if (display) {
      display.innerHTML = this.modalTags.map(tag => `
        <span class="modal-tag">
          ${this.escapeHtml(tag)}
          <button type="button" onclick="this.parentElement.remove(); this.closest('.modal-tag').remove();" title="Remove tag">×</button>
        </span>
      `).join('');
    }
  }

  /**
   * Edit unified resource - opens dynamic modal with full editing capabilities
   */
  async editUnifiedResource(resourceId) {
    console.log(`[UnifiedResourceManager] Opening edit modal for resource: ${resourceId}`);
    
    try {
      // Find the resource in our state
      const resource = this.state.resources.find(r => r.id === resourceId);
      if (!resource) {
        throw new Error(`Resource not found: ${resourceId}`);
      }

      // Load additional data from database if available
      let customProperties = {};
      let alternativeLocations = [];
      
      try {
        // Try to load from database (will fail gracefully if not available)
        if (window.api && window.api.database) {
          customProperties = await window.api.database.getCustomProperties(resourceId);
          alternativeLocations = await window.api.database.getAlternativeLocations(resourceId);
        }
      } catch (error) {
        console.log('[UnifiedResourceManager] Database not available, using basic editing mode');
      }

      this.editingResourceId = resourceId;
      
      // Initialize modal tags with current resource tags
      this.modalTags = [...(resource.properties['meridian:tags'] || [])];
      
      const modalContent = this.generateEditModalContent(resource, customProperties, alternativeLocations);

      // Get ModalManager using the correct pattern
      const modalManager = this.getApp().getModalManager();
      if (!modalManager) {
        console.error('[UnifiedResourceManager] ModalManager not available');
        this.showError('Modal system not available');
        return;
      }

      // Create dynamic modal
      const modal = modalManager.createDynamicModal(
        'edit-resource-dynamic',
        modalContent,
        {
          onClose: () => this.handleEditModalClose(resourceId),
          className: 'edit-resource-modal large-modal'
        }
      );

      // Setup modal event listeners after creation
      this.setupEditModalEventListeners();

      // Open the modal
      await modalManager.openModal('edit-resource-dynamic');

      console.log(`[UnifiedResourceManager] Edit modal opened for resource: ${resourceId}`);
      
    } catch (error) {
      console.error('[UnifiedResourceManager] Failed to open edit modal:', error);
      this.showError('Failed to open edit modal: ' + error.message);
    }
  }

  /**
   * Generate dynamic modal content for editing resources
   */
  generateEditModalContent(resource, customProperties, alternativeLocations) {
    const tags = resource.properties['meridian:tags'] || [];
    
    return `
      <div class="modal-header">
        <h3>Edit Resource</h3>
        <div class="resource-type-indicator">
          <span class="type-badge" id="resource-type-badge">${resource.state.type === 'internal' ? 'Internal' : 'External'} Resource</span>
        </div>
        <button class="modal-close" type="button">×</button>
      </div>

      <div class="modal-content">
        ${this.generateBasicInfoSection(resource)}
        ${this.generateUnifiedLocationSection(resource)}
        ${this.generateCustomPropertiesSection(customProperties)}
        ${this.generateTagsSection(tags)}
      </div>

      <div class="modal-footer">
        <div class="footer-left">
          <button type="button" class="secondary-btn" id="edit-resource-cancel">Cancel</button>
        </div>
        <div class="footer-right">
          <button type="button" class="primary-btn" id="edit-resource-save">Save Changes</button>
        </div>
      </div>
    `;
  }

  /**
   * Generate basic resource information section
   */
  generateBasicInfoSection(resource) {
    return `
      <div class="form-section">
        <h4>Basic Information</h4>
        <div class="form-row">
          <div class="form-group">
            <label for="edit-resource-title">Title</label>
            <input 
              type="text" 
              id="edit-resource-title" 
              value="${this.escapeHtml(resource.properties['dc:title'] || '')}"
              placeholder="Resource title"
            />
          </div>
          <div class="form-group">
            <label for="edit-resource-type">Type</label>
            <select id="edit-resource-type">
              <option value="document" ${resource.properties['dc:type'] === 'document' ? 'selected' : ''}>Document</option>
              <option value="image" ${resource.properties['dc:type'] === 'image' ? 'selected' : ''}>Image</option>
              <option value="video" ${resource.properties['dc:type'] === 'video' ? 'selected' : ''}>Video</option>
              <option value="audio" ${resource.properties['dc:type'] === 'audio' ? 'selected' : ''}>Audio</option>
              <option value="dataset" ${resource.properties['dc:type'] === 'dataset' ? 'selected' : ''}>Dataset</option>
              <option value="software" ${resource.properties['dc:type'] === 'software' ? 'selected' : ''}>Software</option>
              <option value="other" ${resource.properties['dc:type'] === 'other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="edit-resource-description">Description</label>
          <textarea 
            id="edit-resource-description" 
            placeholder="Resource description"
            rows="3"
          >${this.escapeHtml(resource.properties['meridian:description'] || '')}</textarea>
        </div>
      </div>
    `;
  }

  /**
   * Generate unified location section with hierarchical organization
   */
  generateUnifiedLocationSection(resource, customProperties, alternativeLocations) {
    const currentValue = resource.locations.primary.value || '';
    
    return `
      <div class="form-section">
        <h4>Resource Location</h4>
        
        <!-- Internal Section -->
        <div class="location-section internal-section">
          <h5>Internal</h5>
          <div class="form-group">
            <label for="edit-file-path">File Path</label>
            <div class="file-path-browser">
              <input 
                type="text" 
                id="edit-file-path" 
                class="readonly-field"
                value="${resource.locations.primary.type === 'file-path' ? this.escapeHtml(currentValue) : ''}"
                readonly
                placeholder="No file selected"
              />
              <button type="button" class="secondary-btn" id="browse-file-btn">Browse</button>
            </div>
            <div class="file-status" id="file-status">
              ${resource.locations.primary.type === 'file-path' ? this.generateFileStatusIndicator(resource) : ''}
            </div>
          </div>
        </div>
        
        <!-- External Section -->
        <div class="location-section external-section">
          <h5>External</h5>
          
          <!-- Primary URL -->
          <div class="form-group">
            <label for="edit-primary-url">Primary URL</label>
            <input 
              type="url" 
              id="edit-primary-url" 
              value="${resource.locations.primary.type === 'http-url' ? this.escapeHtml(currentValue) : ''}"
              placeholder="https://example.com/resource"
            />
            <div class="url-validation" id="url-validation">
              ${resource.locations.primary.type === 'http-url' ? this.generateUrlValidationIndicator(resource) : ''}
            </div>
          </div>
          
          <!-- Alternative Locations Subsection -->
          <div class="alternative-locations-subsection">
            <h6>Alternative URLs</h6>
            <div class="alternative-locations-list" id="alternative-locations-list">
              ${this.generateAlternativeLocationsList(alternativeLocations)}
            </div>
            <div class="alternative-url-input">
              <input 
                type="url" 
                id="alternative-url-input" 
                placeholder="https://example.com/alternative"
                class="alternative-url-field"
              />
              <button type="button" class="add-alternative-url-btn" id="add-alternative-url-btn" title="Add Alternative URL">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2V10M2 6H10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Arweave Uploads Subsection -->
          <div class="arweave-uploads-subsection">
            <h6>Arweave Uploads</h6>
            <div class="arweave-uploads-list" id="arweave-uploads-list">
              ${this.generateArweaveUploadsList(resource)}
            </div>
            <div class="arweave-hash-input">
              <input 
                type="text" 
                id="arweave-hash-input" 
                placeholder="Arweave hash (43 characters)"
                class="arweave-hash-field"
              />
              <button type="button" class="add-arweave-hash-btn" id="add-arweave-hash-btn" title="Add Arweave Hash">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2V10M2 6H10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        <div class="location-help">
          <p class="help-text">
            <strong>Resource Type Logic:</strong><br>
            • If a local file path is specified → <strong>Internal Resource</strong><br>
            • If only an external URL is specified → <strong>External Resource</strong><br>
            • Both can be specified (file path takes precedence for type determination)
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Generate custom properties section
   */
  generateCustomPropertiesSection(customProperties) {
    const propertiesArray = Object.entries(customProperties);
    
    return `
      <div class="form-section">
        <h4>Index Metadata Properties</h4>
        <div id="custom-properties-container">
          ${propertiesArray.map((prop, index) => this.generateCustomPropertyItem(prop[0], prop[1], index)).join('')}
          <div class="custom-property-item" id="new-property-template">
            <div class="form-row">
              <div class="form-group">
                <input 
                  type="text" 
                  class="property-key-input" 
                  placeholder="Property name"
                />
                <div class="property-key-autocomplete" style="display: none;"></div>
              </div>
              <div class="form-group">
                <input 
                  type="text" 
                  class="property-value-input" 
                  placeholder="Property value"
                />
                <div class="property-value-autocomplete" style="display: none;"></div>
              </div>
              <div class="form-group">
                <button type="button" class="secondary-btn add-property-btn">Add</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate a custom property item
   */
  generateCustomPropertyItem(key, value, index) {
    return `
      <div class="custom-property-item" data-index="${index}">
        <div class="form-row">
          <div class="form-group">
            <input 
              type="text" 
              class="property-key-input" 
              value="${this.escapeHtml(key)}"
              placeholder="Property name"
              readonly
            />
          </div>
          <div class="form-group">
            <input 
              type="text" 
              class="property-value-input" 
              value="${this.escapeHtml(value)}"
              placeholder="Property value"
            />
          </div>
          <div class="form-group">
            <button type="button" class="secondary-btn remove-property-btn">Remove</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate alternative locations list for the external section
   */
  generateAlternativeLocationsList(alternativeLocations) {
    if (!alternativeLocations || alternativeLocations.length === 0) {
      return '<p class="no-alternative-locations">No alternative URLs added yet</p>';
    }

    return alternativeLocations.map((location, index) => 
      this.generateAlternativeLocationItem(location, index)
    ).join('');
  }

  /**
   * Generate Arweave uploads list for the external section
   */
  generateArweaveUploadsList(resource) {
    const arweaveHashes = resource.provenance
      ?.filter(entry => entry.toLocation.type === 'http-url' && entry.toLocation.value.includes('arweave.net'))
      .map(entry => ({
        hash: entry.toLocation.value.split('/').pop(),
        timestamp: entry.timestamp,
        link: entry.toLocation.value
      })) || [];

    if (arweaveHashes.length === 0) {
      return '<p class="no-arweave-uploads">No Arweave uploads found</p>';
    }

    return arweaveHashes.map((upload, index) => `
      <div class="arweave-upload-item">
        <div class="arweave-upload-info">
          <a href="${this.escapeHtml(upload.link)}" target="_blank" class="arweave-upload-link">
            ${this.escapeHtml(upload.hash)}
          </a>
          <span class="arweave-upload-timestamp">${this.formatDate(upload.timestamp)}</span>
        </div>
        <div class="arweave-upload-actions">
          <button type="button" class="secondary-btn" onclick="unifiedResourceManager.copyToClipboard('${this.escapeHtml(upload.link)}')">
            Copy Link
          </button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Generate alternative locations section
   */
  generateAlternativeLocationsSection(alternativeLocations) {
    return `
      <div class="form-section">
        <h4>Alternative Locations</h4>
        <div id="alternative-locations-container">
          ${alternativeLocations.map((location, index) => this.generateAlternativeLocationItem(location, index)).join('')}
          <div class="alternative-location-actions">
            <button type="button" class="secondary-btn" id="add-url-location-btn">Add URL</button>
            <button type="button" class="secondary-btn" id="add-arweave-hash-btn">Add Arweave Hash</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate an alternative location item
   */
  generateAlternativeLocationItem(location, index) {
    const typeLabel = location.locationType === 'arweave-hash' ? 'Arweave' : 'URL';
    const isExternal = location.isExternalArweave ? ' (External)' : '';
    
    return `
      <div class="alternative-location-item" data-location-id="${location.id}">
        <div class="location-header">
          <span class="location-type">${typeLabel}${isExternal}</span>
          <button type="button" class="secondary-btn remove-location-btn">Remove</button>
        </div>
        <div class="location-content">
          <input 
            type="text" 
            class="location-value-input" 
            value="${this.escapeHtml(location.locationValue)}"
            ${location.isExternalArweave ? '' : 'readonly'}
            placeholder="${location.locationType === 'arweave-hash' ? 'Arweave transaction hash' : 'Alternative URL'}"
          />
          ${this.generateLocationStatusIndicator(location)}
        </div>
      </div>
    `;
  }

  /**
   * Generate tags section
   */
  generateTagsSection(tags) {
    return `
      <div class="form-section">
        <h4>Index Tags</h4>
        <div class="resource-tag-input">
          <input 
            type="text" 
            id="edit-resource-tag-input" 
            placeholder="Add a tag..."
            class="tag-input"
          />
          <button type="button" class="add-tag-btn" id="edit-add-tag-btn" title="Add Tag">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 2V10M2 6H10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          <div class="tag-autocomplete" style="display: none;"></div>
        </div>
        <div class="resource-tags" id="edit-resource-tags-list">
          ${tags.map(tag => `
            <span class="resource-tag" data-tag="${this.escapeHtml(tag)}">
              ${this.escapeHtml(tag)}
              <button type="button" class="remove-tag-btn">×</button>
            </span>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Generate file status indicator
   */
  generateFileStatusIndicator(resource) {
    const isAccessible = resource.locations.primary.accessible;
    const lastVerified = resource.locations.primary.lastVerified;
    
    return `
      <div class="file-status-indicator ${isAccessible ? 'accessible' : 'inaccessible'}">
        <span class="status-icon">${isAccessible ? '✓' : '⚠'}</span>
        <span class="status-text">
          ${isAccessible ? 'File accessible' : 'File not found'}
          ${lastVerified ? ` (verified ${this.formatDate(lastVerified)})` : ''}
        </span>
      </div>
    `;
  }

  /**
   * Generate URL validation indicator
   */
  generateUrlValidationIndicator(resource) {
    const isAccessible = resource.locations.primary.accessible;
    const lastVerified = resource.locations.primary.lastVerified;
    
    return `
      <div class="url-validation ${isAccessible ? 'valid' : 'invalid'}">
        <span class="validation-icon">${isAccessible ? '✓' : '⚠'}</span>
        <span class="validation-text">
          ${isAccessible ? 'URL accessible' : 'URL not accessible'}
          ${lastVerified ? ` (verified ${this.formatDate(lastVerified)})` : ''}
        </span>
      </div>
    `;
  }

  /**
   * Generate location status indicator
   */
  generateLocationStatusIndicator(location) {
    if (location.isAccessible === null) {
      return '<div class="location-status pending">Not verified</div>';
    }
    
    return `
      <div class="location-status ${location.isAccessible ? 'accessible' : 'inaccessible'}">
        <span class="status-icon">${location.isAccessible ? '✓' : '⚠'}</span>
        <span class="status-text">
          ${location.isAccessible ? 'Accessible' : 'Not accessible'}
          ${location.lastVerified ? ` (${this.formatDate(location.lastVerified)})` : ''}
        </span>
      </div>
    `;
  }

  /**
   * Remove unified resource
   */
  async removeUnifiedResource(resourceId) {
    if (confirm('Are you sure you want to remove this resource?')) {
      await this.removeUnifiedResourceById(resourceId);
      this.showSuccess('Resource removed successfully');
    }
  }

  /**
   * Format date for display in UTC
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }) + ' UTC';
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      successDiv.remove();
    }, 3000);
  }

  /**
   * Show error message
   */
  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.remove();
    }, 3000);
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get module by name
   */
  getModule(name) {
    return this.app.modules[name];
  }

  /**
   * Get workspace path
   */
  getWorkspacePath() {
    return this.app.workspacePath;
  }

  /**
   * Load unified resources from backend (Meridian-compliant)
   */
  async loadUnifiedResources() {
    try {
      console.log('[UnifiedResourceManager] Loading unified resources from backend...');
      
      // Check if workspace is selected
      if (!this.getWorkspacePath()) {
        console.log('[UnifiedResourceManager] No workspace selected, showing no workspace state');
        this.renderUnifiedNoWorkspace();
        return;
      }

      // Load unified data from backend - this will create resources.json if it doesn't exist
      const unifiedData = await window.electronAPI.unified.loadData();
      
      // Update state
      this.updateState({
        resources: unifiedData.resources || []
      });
      
      // Update UI
      this.updateUI();
      
      // Ensure collapse state is properly applied after UI update
      this.updateCollapseStateOnly();
      
      console.log(`[UnifiedResourceManager] Loaded ${this.state.resources.length} resources from backend`);
      
      // Emit resources loaded event
      this.emit('resourcesLoaded', {
        count: this.state.resources.length
      });
      
    } catch (error) {
      console.error('[UnifiedResourceManager] Error loading resources:', error);
      this.updateState({
        resources: []
      });
      this.emit('error', { operation: 'loadResources', error: error.message });
      this.showError('Failed to load unified resources');
    }
  }

  /**
   * Render no workspace state for unified resources
   */
  renderUnifiedNoWorkspace() {
    const container = document.getElementById('unified-panel');
    if (!container) return;

    container.innerHTML = `
      <div class="no-workspace-state">
        <div class="no-workspace-icon">📁</div>
        <h3>No Workspace Selected</h3>
        <p>Please select a workspace directory to view unified resources.</p>
        <button id="unified-workspace-btn" class="primary-btn">Select Workspace</button>
      </div>
    `;

    // Add event listener for workspace selection
    const workspaceBtn = document.getElementById('unified-workspace-btn');
    if (workspaceBtn) {
      workspaceBtn.addEventListener('click', async () => {
        await this.getApp().selectWorkspace();
      });
    }
  }

  /**
   * Save unified resources to backend
   */
  async saveUnifiedResources() {
    try {
      console.log('[UnifiedResourceManager] Saving unified resources to backend...');
      
      // Check if workspace is selected
      if (!this.getWorkspacePath()) {
        console.error('[UnifiedResourceManager] No workspace selected, cannot save');
        return;
      }

      // Prepare unified data structure
      const unifiedData = {
        resources: this.unifiedResources,
        tags: this.calculateTagCounts(),
        lastModified: new Date().toISOString(),
        version: '1.0'
      };

      // Save to backend
      await window.electronAPI.unified.saveData(unifiedData);
      console.log(`[UnifiedResourceManager] Saved ${this.unifiedResources.length} resources to backend`);
    } catch (error) {
      console.error('[UnifiedResourceManager] Error saving resources:', error);
      this.showError('Failed to save unified resources');
    }
  }

  /**
   * Calculate tag counts from current resources (Meridian-compliant)
   */
  calculateTagCounts() {
    const tagCounts = {};
    this.state.resources.forEach(resource => {
      const tags = resource.properties["meridian:tags"] || [];
      tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    return tagCounts;
  }

  /**
   * Add resource to unified list and save (Meridian-compliant)
   */
  async addUnifiedResource(resource) {
    try {
      console.log('[UnifiedResourceManager] Adding unified resource:', resource);
      
      // Add resource via backend API
      const addedResource = await window.electronAPI.unified.addResource(resource);
      
      // Update state
      this.updateState({
        resources: [...this.state.resources, addedResource]
      });
      
      // Update UI
      this.updateUI();
      
      console.log('[UnifiedResourceManager] Resource added successfully');
      
      // Emit resource added event
      this.emit('resourceAdded', { resource: addedResource });
      
    } catch (error) {
      console.error('[UnifiedResourceManager] Error adding resource:', error);
      this.emit('error', { operation: 'addResource', error: error.message });
      this.showError('Failed to add resource');
    }
  }

  /**
   * Remove resource from unified list and save (Meridian-compliant)
   */
  async removeUnifiedResourceById(resourceId) {
    try {
      console.log('[UnifiedResourceManager] Removing unified resource:', resourceId);
      
      // Remove resource via backend API
      await window.electronAPI.unified.removeResource(resourceId);
      
      // Update state
      this.updateState({
        resources: this.state.resources.filter(r => r.id !== resourceId)
      });
      
      // Update UI
      this.updateUI();
      
      console.log('[UnifiedResourceManager] Resource removed successfully');
      
      // Emit resource removed event
      this.emit('resourceRemoved', { resourceId });
      
    } catch (error) {
      console.error('[UnifiedResourceManager] Error removing resource:', error);
      this.emit('error', { operation: 'removeResource', error: error.message });
      this.showError('Failed to remove resource');
    }
  }

  /**
   * Open unified export modal
   */
  async openUnifiedExportModal() {
    console.log('[UnifiedResourceManager] Opening unified export modal');
    
    // Get filtered resources for export
    const filteredResources = this.getFilteredResources();
    
    // Update modal content
    const resourceCountEl = document.getElementById('unified-export-resource-count');
    const filterInfoEl = document.getElementById('unified-export-filter-info');
    
    if (resourceCountEl) {
      resourceCountEl.textContent = `Ready to export ${filteredResources.length} unified resources`;
    }
    
    if (filterInfoEl) {
      const filterInfo = this.getExportFilterInfo();
      filterInfoEl.textContent = filterInfo;
      filterInfoEl.style.display = filterInfo ? 'block' : 'none';
    }
    
    // Use ModalManager to show the modal
    const modalManager = this.getApp().getModalManager();
    if (modalManager) {
      await modalManager.openModal('unified-export-modal');
      this.setupUnifiedExportModalListeners();
    } else {
      console.error('[UnifiedResourceManager] ModalManager not available');
    }
  }

  /**
   * Setup unified export modal event listeners
   */
  setupUnifiedExportModalListeners() {
    const modal = document.getElementById('unified-export-modal');
    if (!modal) return;

    // Export option buttons
    const exportOptions = modal.querySelectorAll('.export-option-btn');
    exportOptions.forEach(btn => {
      btn.onclick = async () => {
        const format = btn.dataset.format;
        await this.handleUnifiedExport(format);
      };
    });
  }

  /**
   * Get export filter information (Meridian-compliant)
   */
  getExportFilterInfo() {
    const parts = [];
    
    if (this.state.filters.searchTerm) {
      parts.push(`Search: "${this.state.filters.searchTerm}"`);
    }
    
    if (this.state.filters.activeTags.size > 0) {
      const tags = Array.from(this.state.filters.activeTags).join(', ');
      parts.push(`Tags: ${tags} (${this.state.filters.filterLogic.toUpperCase()})`);
    }
    
    return parts.length > 0 ? parts.join(' | ') : '';
  }

  /**
   * Handle unified export
   */
  async handleUnifiedExport(format) {
    try {
      console.log('[UnifiedResourceManager] Handling unified export:', format);
      
      const filteredResources = this.getFilteredResources();
      
      if (filteredResources.length === 0) {
        this.showError('No resources to export');
        return;
      }

      // Close modal using ModalManager
      const modalManager = this.getApp().getModalManager();
      if (modalManager) {
        modalManager.closeModal('unified-export-modal');
      }

      // Generate export data based on format
      let exportData;
      let filename;
      let mimeType;

      switch (format) {
        case 'db':
          // For database export, we'll use the backend
          await this.exportToDatabase();
          return;
          
        case 'json':
          exportData = this.generateJsonExport(filteredResources);
          filename = `unified-resources-${new Date().toISOString().split('T')[0]}.json`;
          mimeType = 'application/json';
          break;
          
        case 'txt':
          exportData = this.generateTextExport(filteredResources);
          filename = `unified-resources-${new Date().toISOString().split('T')[0]}.txt`;
          mimeType = 'text/plain';
          break;
          
        case 'html':
          exportData = this.generateHtmlExport(filteredResources);
          filename = `unified-resources-${new Date().toISOString().split('T')[0]}.html`;
          mimeType = 'text/html';
          break;
          
        default:
          this.showError(`Unsupported export format: ${format}`);
          return;
      }

      // Trigger download
      this.downloadFile(exportData, filename, mimeType);
      
      this.showSuccess(`Exported ${filteredResources.length} resources as ${format.toUpperCase()}`);
      
    } catch (error) {
      console.error('[UnifiedResourceManager] Export error:', error);
      this.showError('Export failed');
    }
  }

  /**
   * Export to database (backend operation)
   */
  async exportToDatabase() {
    try {
      console.log('[UnifiedResourceManager] Exporting to database');
      
      const filteredResources = this.getFilteredResources();
      
      // Call backend to export database
      const result = await window.electronAPI.unified.exportToDatabase({
        resources: filteredResources,
        filters: {
          searchTerm: this.currentSearchTerm,
          activeTags: Array.from(this.activeTagFilters),
          filterLogic: this.filterLogic
        }
      });
      
      if (result.success) {
        this.showSuccess(`Database exported successfully to: ${result.filePath}`);
      } else {
        this.showError('Database export failed');
      }
      
    } catch (error) {
      console.error('[UnifiedResourceManager] Database export error:', error);
      this.showError('Database export failed');
    }
  }

  /**
   * Generate JSON export data
   */
  generateJsonExport(resources) {
    const exportData = {
      resources: resources,
      tags: this.calculateTagCounts(),
      filters: {
        searchTerm: this.currentSearchTerm,
        activeTags: Array.from(this.activeTagFilters),
        filterLogic: this.filterLogic
      },
      exportInfo: {
        exportedAt: new Date().toISOString(),
        totalResources: resources.length,
        format: 'json'
      }
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Generate text export data
   */
  generateTextExport(resources) {
    return resources.map(resource => resource.locations.primary.value).join('\n');
  }

  /**
   * Generate HTML bookmarks export data
   */
  generateHtmlExport(resources) {
    const tags = this.getAllTags();
    let html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n';
    html += '<!-- This is an automatically generated file.\n';
    html += '     It will be read and overwritten.\n';
    html += '     DO NOT EDIT! -->\n';
    html += '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n';
    html += '<TITLE>Bookmarks</TITLE>\n';
    html += '<H1>Bookmarks</H1>\n';
    html += '<DL><p>\n';
    
    // Group resources by tags
    const resourcesByTag = {};
    resources.forEach(resource => {
      const resourceTags = resource.properties["meridian:tags"] || [];
      if (resourceTags.length === 0) {
        if (!resourcesByTag['Untagged']) {
          resourcesByTag['Untagged'] = [];
        }
        resourcesByTag['Untagged'].push(resource);
      } else {
        resourceTags.forEach(tag => {
          if (!resourcesByTag[tag]) {
            resourcesByTag[tag] = [];
          }
          resourcesByTag[tag].push(resource);
        });
      }
    });
    
    // Generate HTML for each tag group
    Object.keys(resourcesByTag).sort().forEach(tag => {
      html += `    <DT><H3>${this.escapeHtml(tag)}</H3>\n`;
      html += '    <DL><p>\n';
      
      resourcesByTag[tag].forEach(resource => {
        const title = resource.properties["dc:title"] || "Untitled";
        const url = resource.locations.primary.value;
        const description = resource.properties["meridian:description"] || "";
        
        html += `        <DT><A HREF="${this.escapeHtml(url)}" ADD_DATE="${Math.floor(new Date(resource.timestamps.created).getTime() / 1000)}">${this.escapeHtml(title)}</A>\n`;
        
        if (description) {
          html += `        <DD>${this.escapeHtml(description)}\n`;
        }
      });
      
      html += '    </DL><p>\n';
    });
    
    html += '</DL><p>\n';
    return html;
  }

  /**
   * Download file helper
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Add Arweave upload tag (based on UploadManager.addUploadTag)
   */
  addArweaveUploadTag() {
    const keyInput = document.getElementById('arweave-tag-key');
    const valueInput = document.getElementById('arweave-tag-value');
    
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
    if (this.modalState.internal.arweaveSettings.uploadTags.some(tag => tag.key === key)) {
      this.showError(`Tag key "${key}" already exists`);
      return;
    }

    this.modalState.internal.arweaveSettings.uploadTags.push({ key, value });
    
    // Clear inputs
    keyInput.value = '';
    valueInput.value = '';
    
    this.renderArweaveUploadTags();
  }

  /**
   * Remove Arweave upload tag (based on UploadManager.removeUploadTag)
   */
  removeArweaveUploadTag(index) {
    this.modalState.internal.arweaveSettings.uploadTags.splice(index, 1);
    this.renderArweaveUploadTags();
  }

  /**
   * Render Arweave upload tags (based on UploadManager.renderUploadTags)
   */
  renderArweaveUploadTags() {
    const tagsContainer = document.getElementById('arweave-tags-list');
    const tags = this.modalState.internal.arweaveSettings.uploadTags;
    
    if (tags.length === 0) {
      tagsContainer.innerHTML = '<p class="no-tags">No tags added yet</p>';
      return;
    }

    tagsContainer.innerHTML = tags.map((tag, index) => `
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
        this.removeArweaveUploadTag(index);
      });
    });
  }

  /**
   * Update Arweave upload UI
   */
  updateArweaveUploadUI() {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    const uploadConfig = modal.querySelector('#arweave-upload-config');
    
    if (this.modalState.internal.arweaveSettings.enabled) {
      console.log('[UnifiedResourceManager] Showing Arweave upload configuration');
      uploadConfig.style.display = 'block';
      this.renderArweaveUploadPhase();
      
      // Auto-select all files when upload is enabled
      const files = this.modalState.internal.selectedFiles;
      this.modalState.internal.arweaveSettings.selectedFiles.clear();
      for (let i = 0; i < files.length; i++) {
        this.modalState.internal.arweaveSettings.selectedFiles.add(i);
      }
      
      // Update checkboxes to reflect the auto-selection - use a longer delay to ensure DOM is ready
      setTimeout(() => {
        const checkboxes = modal.querySelectorAll('.file-upload-checkbox');
        console.log('[UnifiedResourceManager] Found', checkboxes.length, 'checkboxes to update');
        checkboxes.forEach((checkbox, index) => {
          checkbox.checked = true;
          console.log('[UnifiedResourceManager] Set checkbox', index, 'to checked');
        });
        this.updateArweaveUploadSummary();
      }, 200);
    } else {
      console.log('[UnifiedResourceManager] Hiding Arweave upload configuration');
      uploadConfig.style.display = 'none';
      
      // Clear selected files when upload is disabled
      this.modalState.internal.arweaveSettings.selectedFiles.clear();
    }
  }

  /**
   * Render Arweave upload phase
   */
  renderArweaveUploadPhase() {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    const files = this.modalState.internal.selectedFiles;
    const fileUploadList = modal.querySelector('#file-upload-list');
    
    console.log('[UnifiedResourceManager] renderArweaveUploadPhase called');
    console.log('[UnifiedResourceManager] Files in modal state:', files);
    console.log('[UnifiedResourceManager] Modal state:', this.modalState.internal);
    
    if (files.length === 0) {
      console.log('[UnifiedResourceManager] No files found, showing empty message');
      fileUploadList.innerHTML = '<p>No files selected for upload</p>';
      return;
    }

    console.log('[UnifiedResourceManager] Rendering', files.length, 'files for upload');

    // Generate file upload controls with Select All/Deselect All buttons
    fileUploadList.innerHTML = `
      <div class="file-upload-controls">
        <div class="file-upload-header-controls">
          <span class="file-upload-title">Select files to upload to Arweave:</span>
          <div class="file-upload-buttons">
            <button type="button" class="secondary-btn select-all-files-btn">Select All</button>
            <button type="button" class="secondary-btn deselect-all-files-btn">Deselect All</button>
          </div>
        </div>
      </div>
      ${files.map((file, index) => `
        <div class="file-upload-item" data-file-index="${index}">
          <div class="file-upload-header">
            <label>
              <input type="checkbox" class="file-upload-checkbox" data-file-index="${index}" />
              <span class="file-name">${this.escapeHtml(file.name)}</span>
            </label>
            <span class="file-size">(${this.formatFileSize(file.size)})</span>
          </div>
          <div class="file-upload-details">
            <div class="estimated-cost">Estimated Cost: <span class="cost-amount" data-file-index="${index}">Calculating...</span></div>
            <div class="upload-status" data-file-index="${index}">Not uploaded</div>
          </div>
        </div>
      `).join('')}
    `;

    // Setup event listeners for Select All/Deselect All buttons
    const selectAllBtn = modal.querySelector('.select-all-files-btn');
    const deselectAllBtn = modal.querySelector('.deselect-all-files-btn');
    
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        this.selectAllFilesForUpload();
      });
    }
    
    if (deselectAllBtn) {
      deselectAllBtn.addEventListener('click', () => {
        this.deselectAllFilesForUpload();
      });
    }

    // Setup event listeners for file upload checkboxes
    modal.querySelectorAll('.file-upload-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const fileIndex = parseInt(e.target.dataset.fileIndex);
        if (e.target.checked) {
          this.modalState.internal.arweaveSettings.selectedFiles.add(fileIndex);
        } else {
          this.modalState.internal.arweaveSettings.selectedFiles.delete(fileIndex);
        }
        this.updateArweaveUploadSummary();
      });
    });

    // Calculate costs for selected files
    this.calculateArweaveUploadCosts();
  }

  /**
   * Calculate Arweave upload costs
   */
  async calculateArweaveUploadCosts() {
    const files = this.modalState.internal.selectedFiles;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Estimate cost via backend
        const costEstimate = await window.electronAPI.archive.estimateCost(file.size);

        // Update UI
        const costElement = document.querySelector(`.cost-amount[data-file-index="${i}"]`);
        if (costElement) {
          costElement.textContent = `${costEstimate.ar} AR ${costEstimate.usd ? `($${costEstimate.usd})` : ''}`;
        }

        // Store cost in state
        this.modalState.internal.arweaveSettings.fileCosts[i] = costEstimate;

      } catch (error) {
        console.error(`Failed to estimate cost for file ${file.name}:`, error);
        const costElement = document.querySelector(`.cost-amount[data-file-index="${i}"]`);
        if (costElement) {
          costElement.textContent = 'Error calculating cost';
        }
      }
    }

    this.updateArweaveUploadSummary();
  }

  /**
   * Update Arweave upload summary
   */
  updateArweaveUploadSummary() {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    const selectedFiles = this.modalState.internal.arweaveSettings.selectedFiles;
    const fileCosts = this.modalState.internal.arweaveSettings.fileCosts || {};

    if (selectedFiles.size === 0) {
      modal.querySelector('#upload-summary').style.display = 'none';
      return;
    }

    // Calculate total cost
    let totalAr = 0;
    let totalUsd = 0;

    selectedFiles.forEach(fileIndex => {
      const cost = fileCosts[fileIndex];
      if (cost) {
        totalAr += parseFloat(cost.ar);
        if (cost.usd) {
          totalUsd += parseFloat(cost.usd);
        }
      }
    });

    // Update summary
    const totalCostElement = modal.querySelector('#total-cost');
    if (totalCostElement) {
      totalCostElement.textContent = `${totalAr.toFixed(8)} AR ${totalUsd > 0 ? `($${totalUsd.toFixed(2)})` : ''}`;
    }

    modal.querySelector('#upload-summary').style.display = 'block';
  }

  /**
   * Execute Arweave uploads with tags
   */
  async executeArweaveUploads() {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    const selectedFiles = this.modalState.internal.arweaveSettings.selectedFiles;
    const files = this.modalState.internal.selectedFiles;
    const uploadTags = this.modalState.internal.arweaveSettings.uploadTags;
    
    if (selectedFiles.size === 0) {
      this.showError('No files selected for upload');
      return;
    }

    // Convert tags to Arweave format (array of "key:value" strings)
    const arweaveTags = uploadTags.map(tag => `${tag.key}:${tag.value}`);
    
    // Show progress UI
    modal.querySelector('#upload-progress').style.display = 'block';
    
    const selectedFileArray = Array.from(selectedFiles);
    let completedUploads = 0;
    
    for (const fileIndex of selectedFileArray) {
      const file = files[fileIndex];
      
      try {
        // Update progress
        const progress = ((completedUploads + 1) / selectedFileArray.length) * 100;
        modal.querySelector('#upload-progress-fill').style.width = `${progress}%`;
        modal.querySelector('#upload-progress-text').textContent = `${Math.round(progress)}%`;
        
        // Update status
        const statusElement = modal.querySelector(`.upload-status[data-file-index="${fileIndex}"]`);
        if (statusElement) {
          statusElement.textContent = 'Uploading...';
        }

        // Execute upload with tags
        const result = await window.electronAPI.archive.uploadFile(file.path, arweaveTags);
        
        if (result.success) {
          // Store upload result
          this.modalState.internal.arweaveSettings.uploadResults[fileIndex] = {
            success: true,
            transactionId: result.transactionId,
            cost: this.modalState.internal.arweaveSettings.fileCosts[fileIndex],
            tags: arweaveTags // Store the tags used for this upload
          };
          
          // Update status
          if (statusElement) {
            statusElement.textContent = `Uploaded: ${result.transactionId.substring(0, 8)}...`;
            statusElement.className = 'upload-status success';
          }
        } else {
          // Handle upload failure
          this.modalState.internal.arweaveSettings.uploadResults[fileIndex] = {
            success: false,
            error: result.error
          };
          
          if (statusElement) {
            statusElement.textContent = `Failed: ${result.error}`;
            statusElement.className = 'upload-status error';
          }
        }
        
        completedUploads++;
        
      } catch (error) {
        console.error(`Failed to upload file ${file.name}:`, error);
        
        this.modalState.internal.arweaveSettings.uploadResults[fileIndex] = {
          success: false,
          error: error.message
        };
        
        const statusElement = modal.querySelector(`.upload-status[data-file-index="${fileIndex}"]`);
        if (statusElement) {
          statusElement.textContent = `Error: ${error.message}`;
          statusElement.className = 'upload-status error';
        }
        
        completedUploads++;
      }
    }
    
    // Hide progress after completion
    setTimeout(() => {
      modal.querySelector('#upload-progress').style.display = 'none';
    }, 2000);
  }

  /**
   * Execute Arweave uploads during modal flow and continue to review
   */
  async executeArweaveUploadsAndContinue() {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    const arweaveSettings = this.modalState.internal.arweaveSettings;
    
    console.log('[UnifiedResourceManager] executeArweaveUploadsAndContinue called');
    console.log('[UnifiedResourceManager] Upload enabled:', arweaveSettings.enabled);
    console.log('[UnifiedResourceManager] Selected files count:', arweaveSettings.selectedFiles.size);
    console.log('[UnifiedResourceManager] Selected files:', Array.from(arweaveSettings.selectedFiles));
    
    // Check if upload is enabled and files are selected
    if (!arweaveSettings.enabled || arweaveSettings.selectedFiles.size === 0) {
      console.log('[UnifiedResourceManager] No uploads to execute, proceeding to review');
      this.showInternalPhase('review');
      return;
    }

    console.log('[UnifiedResourceManager] Executing Arweave uploads during modal flow');

    // Disable the Next button during upload
    const nextBtn = modal.querySelector('#modal-next-btn');
    if (nextBtn) {
      nextBtn.disabled = true;
      nextBtn.textContent = 'Uploading...';
    }

    // Show progress UI
    const progressContainer = modal.querySelector('#upload-progress');
    if (progressContainer) {
      progressContainer.style.display = 'block';
    }

    try {
      // Execute the uploads
      await this.executeArweaveUploads();
      
      // Show completion message briefly
      const progressText = modal.querySelector('#upload-progress-text');
      if (progressText) {
        progressText.textContent = 'Uploads completed!';
      }
      
      // Wait a moment to show completion
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Hide progress
      if (progressContainer) {
        progressContainer.style.display = 'none';
      }
      
      // Re-enable and update Next button
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.textContent = 'Next';
      }
      
      // Continue to review phase
      this.showInternalPhase('review');
      
    } catch (error) {
      console.error('[UnifiedResourceManager] Error during upload execution:', error);
      
      // Show error message
      const progressText = modal.querySelector('#upload-progress-text');
      if (progressText) {
        progressText.textContent = 'Upload failed!';
      }
      
      // Re-enable Next button
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.textContent = 'Next';
      }
      
      // Still continue to review phase to show what happened
      this.showInternalPhase('review');
    }
  }

  /**
   * Render review phase with upload results and resource summary
   */
  renderReviewPhase() {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    const files = this.modalState.internal.selectedFiles;
    const bulkMetadata = this.modalState.internal.bulkMetadata;
    const arweaveSettings = this.modalState.internal.arweaveSettings;
    const reviewSummary = modal.querySelector('#review-summary');

    let html = `
      <div class="review-section">
        <h5>Selected Files (${files.length})</h5>
        <div class="review-files-list">
          ${files.map(file => `
            <div class="review-file-item">
              <span class="file-name">${this.escapeHtml(file.name)}</span>
              <span class="file-size">(${this.formatFileSize(file.size)})</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="review-section">
        <h5>Metadata</h5>
        <div class="review-metadata">
          <p><strong>Title:</strong> ${this.escapeHtml(bulkMetadata.title || 'Auto-generated from filenames')}</p>
          <p><strong>Description:</strong> ${this.escapeHtml(bulkMetadata.description || 'No description provided')}</p>
          <p><strong>Tags:</strong> ${(bulkMetadata.tags || []).length > 0 ? bulkMetadata.tags.join(', ') : 'No tags'}</p>
        </div>
      </div>
    `;

    // Add Arweave upload results if any
    if (arweaveSettings.enabled && arweaveSettings.uploadResults.length > 0) {
      const uploadResults = arweaveSettings.uploadResults;
      const successfulUploads = uploadResults.filter(result => result && result.success);
      const failedUploads = uploadResults.filter(result => result && !result.success);

      html += `
        <div class="review-section">
          <h5>Arweave Upload Results</h5>
          ${successfulUploads.length > 0 ? `
            <div class="upload-successes">
              <h6>✅ Successful Uploads (${successfulUploads.length})</h6>
              ${successfulUploads.map((result, index) => {
                const fileIndex = uploadResults.findIndex(r => r === result);
                const file = files[fileIndex];
                return `
                  <div class="upload-result-item success">
                    <span class="file-name">${this.escapeHtml(file.name)}</span>
                    <span class="transaction-id">${this.truncateHash(result.transactionId)}</span>
                    <a href="https://www.arweave.net/${result.transactionId}" target="_blank" class="arweave-link">View on Arweave</a>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}
          
          ${failedUploads.length > 0 ? `
            <div class="upload-failures">
              <h6>❌ Failed Uploads (${failedUploads.length})</h6>
              ${failedUploads.map((result, index) => {
                const fileIndex = uploadResults.findIndex(r => r === result);
                const file = files[fileIndex];
                return `
                  <div class="upload-result-item failure">
                    <span class="file-name">${this.escapeHtml(file.name)}</span>
                    <span class="error-message">${this.escapeHtml(result.error)}</span>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}
        </div>
      `;
    } else if (arweaveSettings.enabled && arweaveSettings.selectedFiles.size === 0) {
      html += `
        <div class="review-section">
          <h5>Arweave Upload</h5>
          <p class="upload-info">⚠️ Arweave upload was enabled but no files were selected for upload.</p>
        </div>
      `;
    } else if (arweaveSettings.enabled) {
      html += `
        <div class="review-section">
          <h5>Arweave Upload</h5>
          <p class="upload-info">✅ Arweave upload is enabled and will be executed when you confirm.</p>
        </div>
      `;
    } else {
      html += `
        <div class="review-section">
          <h5>Arweave Upload</h5>
          <p class="upload-info">ℹ️ Arweave upload was not selected. Files will be added to the database only.</p>
        </div>
      `;
    }

    reviewSummary.innerHTML = html;
  }

  /**
   * Generate internal resource previews for review phase
   */
  generateInternalResourcePreviews() {
    const files = this.modalState.internal.selectedFiles;
    const bulkMetadata = this.modalState.internal.bulkMetadata;
    const bulkTags = this.modalState.internal.bulkTags;
    const individualTags = this.modalState.internal.individualTags;
    
    // Generate preview data for each file
    this.modalState.internal.resourcePreviews = files.map((file, index) => {
      const resourceId = `preview-${index}`;
      const combinedTags = [...bulkTags, ...(individualTags[resourceId] || [])];
      
      return {
        id: resourceId,
        file: file,
        title: bulkMetadata.title || file.name,
        description: bulkMetadata.description || '',
        tags: combinedTags,
        type: 'internal',
        path: file.path || file.name,
        size: file.size
      };
    });
    
    this.renderInternalResourcePreviews();
  }

  /**
   * Render internal resource previews
   */
  renderInternalResourcePreviews() {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    const previewsContainer = modal.querySelector('#internal-resource-previews');
    const previews = this.modalState.internal.resourcePreviews;

    if (previews.length === 0) {
      previewsContainer.innerHTML = '<p>No resources to preview</p>';
      return;
    }

    previewsContainer.innerHTML = previews.map(preview => `
      <div class="review-resource-item" data-resource-id="${preview.id}">
        <div class="resource-header">
          <div class="resource-info">
            <h4 class="resource-title">${this.escapeHtml(preview.title)}</h4>
            <div class="resource-path">
              <span class="file-status-indicator physical"></span>
              ${this.escapeHtml(preview.path)}
            </div>
            ${preview.description ? `
              <p class="resource-description">${this.escapeHtml(preview.description)}</p>
            ` : ''}
            <div class="resource-metadata">
              <span class="resource-metadata-item">
                <span class="resource-metadata-label">Type:</span>
                <span class="resource-metadata-value">${preview.type}</span>
              </span>
              <span class="resource-metadata-item">
                <span class="resource-metadata-label">Size:</span>
                <span class="resource-metadata-value">${this.formatFileSize(preview.size)}</span>
              </span>
            </div>
          </div>
        </div>
        
        <div class="resource-tags">
          <div class="resource-tag-input">
            <div class="tag-input-container">
              <input type="text" class="tag-input" placeholder="add tag..." data-resource-id="${preview.id}">
              <button class="add-tag-btn" data-resource-id="${preview.id}" disabled>+</button>
            </div>
            <div class="tag-autocomplete" id="autocomplete-${preview.id}" style="display: none;"></div>
          </div>
          
          ${preview.tags && preview.tags.length > 0 ? 
            preview.tags.map(tag => `
              <span class="resource-tag">
                ${this.escapeHtml(tag)}
                <button class="remove-tag-btn" data-resource-id="${preview.id}" data-tag="${this.escapeHtml(tag)}" title="Remove tag">×</button>
              </span>
            `).join('') : ''
          }
        </div>
      </div>
    `).join('');

    // Setup individual tag event listeners for previews
    this.setupIndividualTagEventListeners();
  }

  /**
   * Generate external resource previews for review phase
   */
  generateExternalResourcePreviews() {
    const results = this.modalState.external.processingResults;
    const bulkTags = this.modalState.external.bulkTags;
    const individualTags = this.modalState.external.individualTags;
    
    // Generate preview data for each result
    this.modalState.external.resourcePreviews = results.map((result, index) => {
      const resourceId = `preview-${index}`;
      const combinedTags = [...bulkTags, ...(individualTags[resourceId] || [])];
      
      return {
        id: resourceId,
        title: result.title,
        description: result.description,
        url: result.url,
        tags: combinedTags,
        type: 'external'
      };
    });
    
    this.renderExternalResourcePreviews();
  }

  /**
   * Render external resource previews
   */
  renderExternalResourcePreviews() {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    const previewsContainer = modal.querySelector('#external-resource-previews');
    const previews = this.modalState.external.resourcePreviews;

    if (previews.length === 0) {
      previewsContainer.innerHTML = '<p>No resources to preview</p>';
      return;
    }

    previewsContainer.innerHTML = previews.map(preview => `
      <div class="review-resource-item" data-resource-id="${preview.id}">
        <div class="resource-header">
          <div class="resource-info">
            <h4 class="resource-title">${this.escapeHtml(preview.title)}</h4>
            <div class="resource-path">
              <span class="file-status-indicator external"></span>
              ${this.escapeHtml(preview.url)}
            </div>
            ${preview.description ? `
              <p class="resource-description">${this.escapeHtml(preview.description)}</p>
            ` : ''}
            <div class="resource-metadata">
              <span class="resource-metadata-item">
                <span class="resource-metadata-label">Type:</span>
                <span class="resource-metadata-value">${preview.type}</span>
              </span>
            </div>
          </div>
        </div>
        
        <div class="resource-tags">
          <div class="resource-tag-input">
            <div class="tag-input-container">
              <input type="text" class="tag-input" placeholder="add tag..." data-resource-id="${preview.id}">
              <button class="add-tag-btn" data-resource-id="${preview.id}" disabled>+</button>
            </div>
            <div class="tag-autocomplete" id="autocomplete-${preview.id}" style="display: none;"></div>
          </div>
          
          ${preview.tags && preview.tags.length > 0 ? 
            preview.tags.map(tag => `
              <span class="resource-tag">
                ${this.escapeHtml(tag)}
                <button class="remove-tag-btn" data-resource-id="${preview.id}" data-tag="${this.escapeHtml(tag)}" title="Remove tag">×</button>
              </span>
            `).join('') : ''
          }
        </div>
      </div>
    `).join('');

    // Setup individual tag event listeners for previews
    this.setupIndividualTagEventListeners();
  }

  /**
   * Setup bulk tag event listeners
   */
  setupBulkTagEventListeners() {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    // Internal bulk tag management
    const internalBulkTagInput = modal.querySelector('#bulk-tag-input');
    const internalBulkAddTagBtn = modal.querySelector('#bulk-add-tag-btn');
    const internalBulkTagAutocomplete = modal.querySelector('#bulk-tag-autocomplete');

    if (internalBulkTagInput && internalBulkAddTagBtn) {
      // Input event for enabling/disabling add button
      internalBulkTagInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        internalBulkAddTagBtn.disabled = !value;
      });

      // Add tag button click
      internalBulkAddTagBtn.addEventListener('click', () => {
        const value = internalBulkTagInput.value.trim();
        if (value) {
          this.addBulkTag(value, 'internal');
          internalBulkTagInput.value = '';
          internalBulkAddTagBtn.disabled = true;
        }
      });

      // Enter key to add tag
      internalBulkTagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const value = e.target.value.trim();
          if (value) {
            this.addBulkTag(value, 'internal');
            e.target.value = '';
            internalBulkAddTagBtn.disabled = true;
          }
        }
      });

      // Setup autocomplete for internal bulk tags
      this.setupBulkTagAutocomplete(internalBulkTagInput, internalBulkTagAutocomplete, 'internal');
    }

    // External bulk tag management
    const externalBulkTagInput = modal.querySelector('#external-bulk-tag-input');
    const externalBulkAddTagBtn = modal.querySelector('#external-bulk-add-tag-btn');
    const externalBulkTagAutocomplete = modal.querySelector('#external-bulk-tag-autocomplete');

    if (externalBulkTagInput && externalBulkAddTagBtn) {
      // Input event for enabling/disabling add button
      externalBulkTagInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        externalBulkAddTagBtn.disabled = !value;
      });

      // Add tag button click
      externalBulkAddTagBtn.addEventListener('click', () => {
        const value = externalBulkTagInput.value.trim();
        if (value) {
          this.addBulkTag(value, 'external');
          externalBulkTagInput.value = '';
          externalBulkAddTagBtn.disabled = true;
        }
      });

      // Enter key to add tag
      externalBulkTagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const value = e.target.value.trim();
          if (value) {
            this.addBulkTag(value, 'external');
            e.target.value = '';
            externalBulkAddTagBtn.disabled = true;
          }
        }
      });

      // Setup autocomplete for external bulk tags
      this.setupBulkTagAutocomplete(externalBulkTagInput, externalBulkTagAutocomplete, 'external');
    }
  }

  /**
   * Setup bulk tag autocomplete
   */
  setupBulkTagAutocomplete(input, autocompleteContainer, tabType) {
    if (!input || !autocompleteContainer) return;

    const tagManager = this.getModule('TagManager');
    if (!tagManager) return;

    const autocomplete = new TagAutocomplete({
      inputSelector: `#${input.id}`,
      autocompleteSelector: `#${autocompleteContainer.id}`,
      getSuggestions: (inputValue) => tagManager.getIntelligentResourceTagSuggestions(inputValue, [], 8),
      onTagSelect: (tag) => {
        this.addBulkTag(tag, tabType);
        input.value = '';
        input.parentElement.querySelector('.add-tag-btn').disabled = true;
      },
      onInputChange: (inputElement) => {
        const value = inputElement.value.trim();
        inputElement.parentElement.querySelector('.add-tag-btn').disabled = !value;
      }
    });
  }

  /**
   * Add bulk tag to all resources
   */
  addBulkTag(tagValue, tabType) {
    const tag = tagValue.trim().toLowerCase();
    if (!tag) return;

    const state = this.modalState[tabType];
    if (!state.bulkTags.includes(tag)) {
      state.bulkTags.push(tag);
      this.renderBulkTags(tabType);
      this.updateResourcePreviews(tabType);
    }
  }

  /**
   * Remove bulk tag from all resources
   */
  removeBulkTag(tagValue, tabType) {
    const tag = tagValue.trim().toLowerCase();
    if (!tag) return;

    const state = this.modalState[tabType];
    const index = state.bulkTags.indexOf(tag);
    if (index > -1) {
      state.bulkTags.splice(index, 1);
      this.renderBulkTags(tabType);
      this.updateResourcePreviews(tabType);
    }
  }

  /**
   * Render bulk tags
   */
  renderBulkTags(tabType) {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    const bulkTagsList = modal.querySelector(`#${tabType === 'internal' ? '' : 'external-'}bulk-tags-list`);
    const bulkTags = this.modalState[tabType].bulkTags;

    if (bulkTags.length === 0) {
      bulkTagsList.innerHTML = '<p class="no-tags">No bulk tags added yet</p>';
    } else {
      bulkTagsList.innerHTML = bulkTags.map(tag => `
        <span class="resource-tag">
          ${this.escapeHtml(tag)}
          <button class="remove-tag-btn" data-bulk-tag="${this.escapeHtml(tag)}" data-tab-type="${tabType}" title="Remove bulk tag">×</button>
        </span>
      `).join('');

      // Add event listeners for remove buttons
      bulkTagsList.querySelectorAll('.remove-tag-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const tag = e.target.dataset.bulkTag;
          const tabType = e.target.dataset.tabType;
          this.removeBulkTag(tag, tabType);
        });
      });
    }
  }

  /**
   * Update resource previews when tags change
   */
  updateResourcePreviews(tabType) {
    if (tabType === 'internal') {
      this.generateInternalResourcePreviews();
    } else {
      this.generateExternalResourcePreviews();
    }
  }

  /**
   * Setup individual tag event listeners for preview resources
   */
  setupIndividualTagEventListeners() {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    // Setup tag inputs for individual resources
    modal.querySelectorAll('.review-resource-item .tag-input').forEach(input => {
      const resourceId = input.dataset.resourceId;
      const addTagBtn = input.parentElement.querySelector('.add-tag-btn');
      const autocompleteContainer = modal.querySelector(`#autocomplete-${resourceId}`);

      // Input event for enabling/disabling add button
      input.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        addTagBtn.disabled = !value;
      });

      // Add tag button click
      addTagBtn.addEventListener('click', () => {
        const value = input.value.trim();
        if (value) {
          this.addIndividualTag(resourceId, value);
          input.value = '';
          addTagBtn.disabled = true;
        }
      });

      // Enter key to add tag
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const value = e.target.value.trim();
          if (value) {
            this.addIndividualTag(resourceId, value);
            e.target.value = '';
            addTagBtn.disabled = true;
          }
        }
      });

      // Setup autocomplete for individual tags
      this.setupIndividualTagAutocomplete(input, autocompleteContainer, resourceId);
    });

    // Setup remove tag buttons
    modal.querySelectorAll('.review-resource-item .remove-tag-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const resourceId = e.target.dataset.resourceId;
        const tag = e.target.dataset.tag;
        this.removeIndividualTag(resourceId, tag);
      });
    });
  }

  /**
   * Setup individual tag autocomplete
   */
  setupIndividualTagAutocomplete(input, autocompleteContainer, resourceId) {
    if (!input || !autocompleteContainer) return;

    const tagManager = this.getModule('TagManager');
    if (!tagManager) return;

    const autocomplete = new TagAutocomplete({
      inputSelector: `input[data-resource-id="${resourceId}"]`,
      autocompleteSelector: `#autocomplete-${resourceId}`,
      getSuggestions: (inputValue) => tagManager.getIntelligentResourceTagSuggestions(inputValue, [], 8),
      onTagSelect: (tag) => {
        this.addIndividualTag(resourceId, tag);
        input.value = '';
        input.parentElement.querySelector('.add-tag-btn').disabled = true;
      },
      onInputChange: (inputElement) => {
        const value = inputElement.value.trim();
        inputElement.parentElement.querySelector('.add-tag-btn').disabled = !value;
      }
    });
  }

  /**
   * Add individual tag to specific resource
   */
  addIndividualTag(resourceId, tagValue) {
    const tag = tagValue.trim().toLowerCase();
    if (!tag) return;

    // Determine which tab this resource belongs to
    const internalPreview = this.modalState.internal.resourcePreviews.find(p => p.id === resourceId);
    const externalPreview = this.modalState.external.resourcePreviews.find(p => p.id === resourceId);

    if (internalPreview) {
      if (!this.modalState.internal.individualTags[resourceId]) {
        this.modalState.internal.individualTags[resourceId] = [];
      }
      if (!this.modalState.internal.individualTags[resourceId].includes(tag)) {
        this.modalState.internal.individualTags[resourceId].push(tag);
        this.generateInternalResourcePreviews();
      }
    } else if (externalPreview) {
      if (!this.modalState.external.individualTags[resourceId]) {
        this.modalState.external.individualTags[resourceId] = [];
      }
      if (!this.modalState.external.individualTags[resourceId].includes(tag)) {
        this.modalState.external.individualTags[resourceId].push(tag);
        this.generateExternalResourcePreviews();
      }
    }
  }

  /**
   * Remove individual tag from specific resource
   */
  removeIndividualTag(resourceId, tagValue) {
    const tag = tagValue.trim().toLowerCase();
    if (!tag) return;

    // Determine which tab this resource belongs to
    const internalPreview = this.modalState.internal.resourcePreviews.find(p => p.id === resourceId);
    const externalPreview = this.modalState.external.resourcePreviews.find(p => p.id === resourceId);

    if (internalPreview && this.modalState.internal.individualTags[resourceId]) {
      const index = this.modalState.internal.individualTags[resourceId].indexOf(tag);
      if (index > -1) {
        this.modalState.internal.individualTags[resourceId].splice(index, 1);
        this.generateInternalResourcePreviews();
      }
    } else if (externalPreview && this.modalState.external.individualTags[resourceId]) {
      const index = this.modalState.external.individualTags[resourceId].indexOf(tag);
      if (index > -1) {
        this.modalState.external.individualTags[resourceId].splice(index, 1);
        this.generateExternalResourcePreviews();
      }
    }
  }

  /**
   * Accumulate tags for a specific resource
   */
  accumulateResourceTags(resourceId) {
    // Determine which tab this resource belongs to
    const internalPreview = this.modalState.internal.resourcePreviews.find(p => p.id === resourceId);
    const externalPreview = this.modalState.external.resourcePreviews.find(p => p.id === resourceId);

    if (internalPreview) {
      const bulkTags = this.modalState.internal.bulkTags;
      const individualTags = this.modalState.internal.individualTags[resourceId] || [];
      return [...new Set([...bulkTags, ...individualTags])]; // Remove duplicates
    } else if (externalPreview) {
      const bulkTags = this.modalState.external.bulkTags;
      const individualTags = this.modalState.external.individualTags[resourceId] || [];
      return [...new Set([...bulkTags, ...individualTags])]; // Remove duplicates
    }

    return [];
  }

  /**
   * Setup metadata capture for the metadata phase
   */
  setupMetadataCapture() {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    // Get metadata inputs
    const titleInput = modal.querySelector('#bulk-title');
    const descriptionInput = modal.querySelector('#bulk-description');
    const tagsInput = modal.querySelector('#bulk-tags');

    // Set current values
    if (titleInput) {
      titleInput.value = this.modalState.internal.bulkMetadata.title || '';
    }
    if (descriptionInput) {
      descriptionInput.value = this.modalState.internal.bulkMetadata.description || '';
    }
    if (tagsInput) {
      tagsInput.value = (this.modalState.internal.bulkMetadata.tags || []).join(', ');
    }

    // Add event listeners to capture changes
    if (titleInput) {
      titleInput.addEventListener('input', (e) => {
        this.modalState.internal.bulkMetadata.title = e.target.value;
      });
    }

    if (descriptionInput) {
      descriptionInput.addEventListener('input', (e) => {
        this.modalState.internal.bulkMetadata.description = e.target.value;
      });
    }

    if (tagsInput) {
      tagsInput.addEventListener('input', (e) => {
        const tags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
        this.modalState.internal.bulkMetadata.tags = tags;
      });
    }
  }

  /**
   * Select all files for Arweave upload
   */
  selectAllFilesForUpload() {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    const files = this.modalState.internal.selectedFiles;
    this.modalState.internal.arweaveSettings.selectedFiles.clear();
    
    for (let i = 0; i < files.length; i++) {
      this.modalState.internal.arweaveSettings.selectedFiles.add(i);
    }
    
    // Update checkboxes
    modal.querySelectorAll('.file-upload-checkbox').forEach((checkbox, index) => {
      checkbox.checked = true;
    });
    
    this.updateArweaveUploadSummary();
  }

  /**
   * Deselect all files for Arweave upload
   */
  deselectAllFilesForUpload() {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    this.modalState.internal.arweaveSettings.selectedFiles.clear();
    
    // Update checkboxes
    modal.querySelectorAll('.file-upload-checkbox').forEach(checkbox => {
      checkbox.checked = false;
    });
    
    this.updateArweaveUploadSummary();
  }

  /**
   * Setup event listeners for the edit modal
   */
  setupEditModalEventListeners() {
    // Close button in header
    const closeBtn = document.querySelector('#edit-resource-dynamic .modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const modalManager = this.getApp().getModalManager();
        if (modalManager) {
          modalManager.closeModal('edit-resource-dynamic');
        }
      });
    }

    // Cancel button
    const cancelBtn = document.getElementById('edit-resource-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        const modalManager = this.getApp().getModalManager();
        if (modalManager) {
          modalManager.closeModal('edit-resource-dynamic');
        }
      });
    }

    // Save button
    const saveBtn = document.getElementById('edit-resource-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.handleEditSubmit();
      });
    }



    // File browser button
    const browseBtn = document.getElementById('browse-file-btn');
    if (browseBtn) {
      browseBtn.addEventListener('click', () => {
        this.browseForFile();
      });
    }

    // Real-time type badge updates
    const urlInput = document.getElementById('edit-primary-url');
    const filePathInput = document.getElementById('edit-file-path');
    const typeBadge = document.getElementById('resource-type-badge');
    
    if (urlInput && filePathInput && typeBadge) {
      const updateTypeBadge = () => {
        const hasFilePath = filePathInput.value.trim();
        const hasUrl = urlInput.value.trim();
        
        if (hasFilePath) {
          typeBadge.textContent = 'Internal Resource';
          typeBadge.className = 'type-badge internal';
        } else if (hasUrl) {
          typeBadge.textContent = 'External Resource';
          typeBadge.className = 'type-badge external';
        } else {
          typeBadge.textContent = 'Undefined Resource';
          typeBadge.className = 'type-badge undefined';
        }
      };
      
      urlInput.addEventListener('input', updateTypeBadge);
      filePathInput.addEventListener('input', updateTypeBadge);
      
      // Initial update
      updateTypeBadge();
    }

    // Custom property management
    this.setupCustomPropertyEventListeners();

    // Alternative location management
    this.setupAlternativeLocationEventListeners();

    // Tags management
    this.setupEditTagEventListeners();
  }

  /**
   * Setup custom property event listeners
   */
  setupCustomPropertyEventListeners() {
    const container = document.getElementById('custom-properties-container');
    if (!container) return;

    // Add property button
    const addBtn = container.querySelector('.add-property-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.addCustomProperty();
      });
    }

    // Remove property buttons
    container.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-property-btn')) {
        this.removeCustomProperty(e.target.closest('.custom-property-item'));
      }
    });

    // Property key autocomplete
    const keyInputs = container.querySelectorAll('.property-key-input:not([readonly])');
    keyInputs.forEach(input => {
      this.setupPropertyKeyAutocomplete(input);
    });

    // Property value autocomplete
    const valueInputs = container.querySelectorAll('.property-value-input');
    valueInputs.forEach(input => {
      this.setupPropertyValueAutocomplete(input);
    });
  }

  /**
   * Setup alternative location event listeners
   */
  setupAlternativeLocationEventListeners() {
    // Alternative URL input and button
    const alternativeUrlInput = document.getElementById('alternative-url-input');
    const addUrlBtn = document.getElementById('add-alternative-url-btn');
    
    if (addUrlBtn && alternativeUrlInput) {
      const addAlternativeUrl = () => {
        const url = alternativeUrlInput.value.trim();
        if (url && this.isValidUrl(url)) {
          const currentAlternativeLocations = this.getAlternativeLocationsFromModal();
          if (!currentAlternativeLocations.some(loc => loc.url === url)) {
            currentAlternativeLocations.push({ url, type: 'url' });
            this.updateAlternativeLocationsList(currentAlternativeLocations);
            alternativeUrlInput.value = '';
          }
        }
      };
      
      addUrlBtn.addEventListener('click', addAlternativeUrl);
      alternativeUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          addAlternativeUrl();
        }
      });
    }

    // Arweave Hash input and button
    const arweaveHashInput = document.getElementById('arweave-hash-input');
    const addArweaveBtn = document.getElementById('add-arweave-hash-btn');
    
    if (addArweaveBtn && arweaveHashInput) {
      const addArweaveHash = () => {
        const hash = arweaveHashInput.value.trim();
        if (hash && this.isValidArweaveHash(hash)) {
          const currentAlternativeLocations = this.getAlternativeLocationsFromModal();
          if (!currentAlternativeLocations.some(loc => loc.url === hash)) {
            currentAlternativeLocations.push({ url: hash, type: 'arweave' });
            this.updateAlternativeLocationsList(currentAlternativeLocations);
            arweaveHashInput.value = '';
          }
        }
      };
      
      addArweaveBtn.addEventListener('click', addArweaveHash);
      arweaveHashInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          addArweaveHash();
        }
      });
    }

    // Remove location buttons (now in alternative-locations-list)
    const locationsList = document.getElementById('alternative-locations-list');
    if (locationsList) {
      locationsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-location-btn')) {
          this.removeAlternativeLocation(e.target.closest('.alternative-location-item'));
        }
      });
    }
  }

  /**
   * Setup tag editing event listeners
   */
  setupEditTagEventListeners() {
    const tagInput = document.getElementById('edit-resource-tag-input');
    const addTagBtn = document.getElementById('edit-add-tag-btn');
    const tagsList = document.getElementById('edit-resource-tags-list');

    if (tagInput && addTagBtn) {
      const addTag = () => {
        const tagValue = tagInput.value.trim();
        if (tagValue) {
          this.addEditTag(tagValue);
          tagInput.value = '';
        }
      };

      // Add tag button click
      addTagBtn.addEventListener('click', addTag);

      // Tag input handling (Enter key)
      tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          addTag();
          e.preventDefault();
        }
      });

      // Tag autocomplete setup
      this.setupTagAutocomplete(tagInput);
    }

    if (tagsList) {
      // Tag removal
      tagsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-tag-btn')) {
          const tagElement = e.target.closest('.resource-tag');
          const tag = tagElement?.getAttribute('data-tag');
          if (tag) {
            this.removeEditTag(tag);
          }
        }
      });
    }
  }

  /**
   * Handle edit modal close
   */
  handleEditModalClose(resourceId) {
    console.log(`[UnifiedResourceManager] Edit modal closed for resource: ${resourceId}`);
    this.editingResourceId = null;
    
    // Clean up any event listeners or temporary state
    this.cleanupEditModal();
  }

  /**
   * Clean up edit modal
   */
  cleanupEditModal() {
    // Clean up any autocomplete instances or other resources
    if (this.editModalAutocompletes) {
      this.editModalAutocompletes.forEach(instance => {
        if (instance && typeof instance.cleanup === 'function') {
          instance.cleanup();
        }
      });
      this.editModalAutocompletes = [];
    }
  }

  // ===== EDIT MODAL FUNCTIONALITY =====



  /**
   * Handle edit form submission
   */
  async handleEditSubmit() {
    console.log('[UnifiedResourceManager] Handling edit form submission');
    
    try {
      if (!this.editingResourceId) {
        throw new Error('No resource being edited');
      }

      // Collect form data
      const formData = this.collectEditFormData();
      
      // Validate form data
      const validation = this.validateEditFormData(formData);
      if (!validation.isValid) {
        this.showError(validation.message);
        return;
      }

      // Update resource
      await this.updateResourceFromForm(this.editingResourceId, formData);
      
      // Close modal and refresh
      const modalManager = this.getApp().getModalManager();
      if (modalManager) {
        modalManager.closeModal('edit-resource-dynamic');
      }
      this.showSuccess('Resource updated successfully');
      
      // Refresh the resource list
      await this.loadUnifiedResources();
      
    } catch (error) {
      console.error('[UnifiedResourceManager] Failed to submit edit form:', error);
      this.showError('Failed to save changes: ' + error.message);
    }
  }

  /**
   * Collect edit form data
   */
  collectEditFormData() {
    const formData = {
      title: document.getElementById('edit-resource-title')?.value?.trim() || '',
      type: document.getElementById('edit-resource-type')?.value || 'document',
      description: document.getElementById('edit-resource-description')?.value?.trim() || '',
      customProperties: {},
      alternativeLocations: [],
      tags: []
    };

    // Collect both location fields
    formData.filePath = document.getElementById('edit-file-path')?.value?.trim() || '';
    formData.primaryUrl = document.getElementById('edit-primary-url')?.value?.trim() || '';

    // Collect custom properties
    const propertyItems = document.querySelectorAll('.custom-property-item:not(#new-property-template)');
    propertyItems.forEach(item => {
      const keyInput = item.querySelector('.property-key-input');
      const valueInput = item.querySelector('.property-value-input');
      if (keyInput && valueInput && keyInput.value.trim() && valueInput.value.trim()) {
        formData.customProperties[keyInput.value.trim()] = valueInput.value.trim();
      }
    });

    // Collect alternative locations
    const locationItems = document.querySelectorAll('.alternative-location-item');
    locationItems.forEach(item => {
      const locationId = item.dataset.locationId;
      const valueInput = item.querySelector('.location-value-input');
      if (valueInput && valueInput.value.trim()) {
        formData.alternativeLocations.push({
          id: locationId,
          value: valueInput.value.trim()
        });
      }
    });

    // Collect tags from modalTags array
    formData.tags = [...(this.modalTags || [])];

    return formData;
  }

  /**
   * Validate edit form data
   */
  validateEditFormData(formData) {
    if (!formData.title) {
      return { isValid: false, message: 'Title is required' };
    }

    // Check if we have either a file path or URL
    const hasFilePath = formData.filePath && formData.filePath.trim();
    const hasUrl = formData.primaryUrl && formData.primaryUrl.trim();
    
    if (!hasFilePath && !hasUrl) {
      return { isValid: false, message: 'Either a file path or URL is required' };
    }

    // Validate URL if provided
    if (hasUrl) {
      try {
        new URL(formData.primaryUrl);
      } catch (e) {
        return { isValid: false, message: 'Invalid URL format' };
      }
    }

    // Validate file path if provided
    if (hasFilePath && !formData.filePath.trim()) {
      return { isValid: false, message: 'File path cannot be empty' };
    }

    return { isValid: true };
  }

  /**
   * Update resource from form data
   */
  async updateResourceFromForm(resourceId, formData) {
    // Find resource in state
    const resourceIndex = this.state.resources.findIndex(r => r.id === resourceId);
    if (resourceIndex === -1) {
      throw new Error('Resource not found in state');
    }

    const resource = this.state.resources[resourceIndex];
    
    // Update basic properties
    resource.properties['dc:title'] = formData.title;
    resource.properties['dc:type'] = formData.type;
    resource.properties['meridian:description'] = formData.description;
    resource.properties['meridian:tags'] = formData.tags;

    // Update location and type based on form data
    const hasFilePath = formData.filePath && formData.filePath.trim();
    const hasUrl = formData.primaryUrl && formData.primaryUrl.trim();
    
    if (hasFilePath) {
      // Internal resource (file path takes precedence)
      resource.state.type = 'internal';
      resource.locations.primary.type = 'file-path';
      resource.locations.primary.value = formData.filePath;
    } else if (hasUrl) {
      // External resource (only URL provided)
      resource.state.type = 'external';
      resource.locations.primary.type = 'http-url';
      resource.locations.primary.value = formData.primaryUrl;
    }
    // If neither is provided, validation should have caught this

    // Update timestamps
    const now = new Date().toISOString();
    resource.metadata['meridian:modified'] = now;

    // Update in database if available
    if (window.api && window.api.database) {
      try {
        // Update main resource
        await window.api.database.updateResource(resourceId, {
          title: formData.title,
          description: formData.description,
          location_value: formData.filePath || formData.primaryUrl || resource.locations.primary.value,
          state_type: resource.state.type, // Update the resource type
          modified_at: now,
          modified_at_timestamp: Date.now()
        });

        // Update custom properties
        const existingProperties = await window.api.database.getCustomProperties(resourceId);
        
        // Remove properties that were deleted
        for (const key of Object.keys(existingProperties)) {
          if (!(key in formData.customProperties)) {
            await window.api.database.removeCustomProperty(resourceId, key);
          }
        }

        // Add or update properties
        for (const [key, value] of Object.entries(formData.customProperties)) {
          await window.api.database.addCustomProperty(resourceId, key, value);
        }

        // Update tags
        const currentTags = resource.properties['meridian:tags'] || [];
        
        // Remove old tags
        for (const tag of currentTags) {
          if (!formData.tags.includes(tag)) {
            await window.api.database.removeTagFromResource(resourceId, tag);
          }
        }

        // Add new tags
        for (const tag of formData.tags) {
          if (!currentTags.includes(tag)) {
            await window.api.database.addTagToResource(resourceId, tag);
          }
        }

      } catch (error) {
        console.error('[UnifiedResourceManager] Database update failed:', error);
        // Continue with in-memory update even if database fails
      }
    }

    // Update state
    this.updateState({ 
      resources: [...this.state.resources.slice(0, resourceIndex), resource, ...this.state.resources.slice(resourceIndex + 1)]
    });

    // Save to JSON if no database
    if (!window.api || !window.api.database) {
      await this.saveUnifiedResources();
    }
  }

  /**
   * Browse for file (internal resources)
   */
  async browseForFile() {
    console.log('[UnifiedResourceManager] Opening file browser');
    
    try {
      if (!window.api || !window.api.openFileDialog) {
        this.showError('File browser not available');
        return;
      }

      const result = await window.api.openFileDialog({
        title: 'Select Resource File',
        buttonLabel: 'Select',
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Documents', extensions: ['txt', 'md', 'pdf', 'doc', 'docx'] },
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'svg'] },
          { name: 'Videos', extensions: ['mp4', 'avi', 'mov', 'mkv'] },
          { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac'] }
        ],
        properties: ['openFile']
      });

      if (result && result.filePaths && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        
        // Update file path input
        const filePathInput = document.getElementById('edit-file-path');
        if (filePathInput) {
          filePathInput.value = selectedPath;
        }

        // Update file status
        this.updateFileStatus(selectedPath);
      }
      
    } catch (error) {
      console.error('[UnifiedResourceManager] File browser failed:', error);
      this.showError('Failed to open file browser: ' + error.message);
    }
  }

  /**
   * Update file status indicator
   */
  async updateFileStatus(filePath) {
    const statusContainer = document.getElementById('file-status');
    if (!statusContainer) return;

    try {
      // Check if file exists
      const exists = window.api && window.api.fs ? await window.api.fs.exists(filePath) : true;
      
      statusContainer.innerHTML = `
        <div class="file-status-indicator ${exists ? 'accessible' : 'inaccessible'}">
          <span class="status-icon">${exists ? '✓' : '⚠'}</span>
          <span class="status-text">
            ${exists ? 'File accessible' : 'File not found'}
            (updated ${this.formatDate(new Date().toISOString())})
          </span>
        </div>
      `;
    } catch (error) {
      console.error('[UnifiedResourceManager] Failed to check file status:', error);
    }
  }

  /**
   * Add custom property
   */
  async addCustomProperty() {
    console.log('[UnifiedResourceManager] Adding custom property');
    
    const template = document.getElementById('new-property-template');
    if (!template) return;

    const keyInput = template.querySelector('.property-key-input');
    const valueInput = template.querySelector('.property-value-input');
    
    const key = keyInput?.value?.trim();
    const value = valueInput?.value?.trim();

    if (!key || !value) {
      this.showError('Both property name and value are required');
      return;
    }

    // Check for duplicates
    const existingKeys = Array.from(document.querySelectorAll('.custom-property-item:not(#new-property-template) .property-key-input'))
      .map(input => input.value.trim());
    
    if (existingKeys.includes(key)) {
      this.showError('Property name already exists');
      return;
    }

    // Create new property item
    const container = document.getElementById('custom-properties-container');
    const newIndex = container.querySelectorAll('.custom-property-item:not(#new-property-template)').length;
    
    const newItem = document.createElement('div');
    newItem.innerHTML = this.generateCustomPropertyItem(key, value, newIndex);
    newItem.className = 'custom-property-item';
    newItem.dataset.index = newIndex;

    // Insert before template
    container.insertBefore(newItem.firstElementChild, template);

    // Clear template inputs
    keyInput.value = '';
    valueInput.value = '';

    // Setup autocomplete for the new item
    const newKeyInput = newItem.querySelector('.property-key-input');
    const newValueInput = newItem.querySelector('.property-value-input');
    
    if (!newKeyInput.readOnly) {
      this.setupPropertyKeyAutocomplete(newKeyInput);
    }
    this.setupPropertyValueAutocomplete(newValueInput);

    console.log(`[UnifiedResourceManager] Added custom property: ${key} = ${value}`);
  }

  /**
   * Remove custom property
   */
  removeCustomProperty(propertyItem) {
    if (!propertyItem) return;

    const keyInput = propertyItem.querySelector('.property-key-input');
    const key = keyInput?.value?.trim();
    
    console.log(`[UnifiedResourceManager] Removing custom property: ${key}`);
    propertyItem.remove();
  }

  /**
   * Setup property key autocomplete
   */
  async setupPropertyKeyAutocomplete(input) {
    if (!input) return;

    try {
      const suggestions = window.api && window.api.database ? 
        await window.api.database.getPropertyKeySuggestions() : 
        this.getLocalPropertyKeySuggestions();

      const autocomplete = new TagAutocomplete(input, {
        suggestions: suggestions || [],
        placeholder: 'Enter property name...',
        caseSensitive: false,
        allowCustomValues: true,
        maxSuggestions: 10
      });

      this.tagAutocompletes.push(autocomplete);
      
    } catch (error) {
      console.error('[UnifiedResourceManager] Failed to setup property key autocomplete:', error);
    }
  }

  /**
   * Setup property value autocomplete
   */
  async setupPropertyValueAutocomplete(input) {
    if (!input) return;

    const keyInput = input.closest('.custom-property-item')?.querySelector('.property-key-input');
    const key = keyInput?.value?.trim();

    if (!key) return;

    try {
      const suggestions = window.api && window.api.database ? 
        await window.api.database.getPropertyValueSuggestions(key) : 
        this.getLocalPropertyValueSuggestions(key);

      const autocomplete = new TagAutocomplete(input, {
        suggestions: suggestions || [],
        placeholder: 'Enter property value...',
        caseSensitive: false,
        allowCustomValues: true,
        maxSuggestions: 10
      });

      this.tagAutocompletes.push(autocomplete);
      
    } catch (error) {
      console.error('[UnifiedResourceManager] Failed to setup property value autocomplete:', error);
    }
  }

  /**
   * Get local property key suggestions from existing resources
   */
  getLocalPropertyKeySuggestions() {
    const keys = new Set();
    
    this.state.resources.forEach(resource => {
      if (resource.customProperties) {
        Object.keys(resource.customProperties).forEach(key => keys.add(key));
      }
    });

    return Array.from(keys).sort();
  }

  /**
   * Get local property value suggestions for a specific key
   */
  getLocalPropertyValueSuggestions(key) {
    const values = new Set();
    
    this.state.resources.forEach(resource => {
      if (resource.customProperties && resource.customProperties[key]) {
        values.add(resource.customProperties[key]);
      }
    });

    return Array.from(values).sort();
  }

  /**
   * Validate URL format
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate Arweave hash format
   */
  isValidArweaveHash(hash) {
    return /^[A-Za-z0-9_-]{43}$/.test(hash);
  }

  /**
   * Get alternative locations from modal
   */
  getAlternativeLocationsFromModal() {
    const locationsList = document.getElementById('alternative-locations-list');
    if (!locationsList) return [];

    const locationItems = locationsList.querySelectorAll('.alternative-location-item');
    return Array.from(locationItems).map(item => {
      const url = item.querySelector('.location-value')?.textContent?.trim();
      const type = item.querySelector('.location-type')?.textContent?.trim() === 'Arweave' ? 'arweave' : 'url';
      return { url, type };
    }).filter(loc => loc.url);
  }

  /**
   * Update alternative locations list in modal
   */
  updateAlternativeLocationsList(alternativeLocations) {
    const locationsList = document.getElementById('alternative-locations-list');
    if (!locationsList) return;

    locationsList.innerHTML = this.generateAlternativeLocationsList(alternativeLocations);
  }

  /**
   * Add alternative URL location (legacy method - kept for compatibility)
   */
  async addAlternativeUrl() {
    console.log('[UnifiedResourceManager] Adding alternative URL');
    
    const urlInput = document.getElementById('new-alternative-url');
    if (!urlInput) return;

    const url = urlInput.value.trim();
    if (!url) {
      this.showError('URL is required');
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch (error) {
      this.showError('Please enter a valid URL');
      return;
    }

    // Check for duplicates
    const existingUrls = Array.from(document.querySelectorAll('.alternative-location-item .location-value'))
      .map(el => el.textContent.trim());
    
    if (existingUrls.includes(url)) {
      this.showError('This URL already exists in alternative locations');
      return;
    }

    // Create new alternative location item
    const container = document.getElementById('alternative-locations-container');
    const newIndex = container.querySelectorAll('.alternative-location-item').length;
    
    const newItem = document.createElement('div');
    newItem.innerHTML = this.generateAlternativeLocationItem({
      type: 'external_url',
      value: url,
      accessibility: {
        status: 'unknown',
        lastChecked: new Date().toISOString()
      }
    }, newIndex);
    newItem.className = 'alternative-location-item';
    newItem.dataset.index = newIndex;

    container.appendChild(newItem.firstElementChild);

    // Clear input
    urlInput.value = '';

    // Check URL accessibility
    this.checkUrlAccessibility(url, newIndex);

    console.log(`[UnifiedResourceManager] Added alternative URL: ${url}`);
  }

  /**
   * Add external Arweave hash location
   */
  async addExternalArweaveHash() {
    console.log('[UnifiedResourceManager] Adding external Arweave hash');
    
    const hashInput = document.getElementById('new-arweave-hash');
    if (!hashInput) return;

    const hash = hashInput.value.trim();
    if (!hash) {
      this.showError('Arweave hash is required');
      return;
    }

    // Basic Arweave hash validation (43 characters, base64url)
    if (!/^[A-Za-z0-9_-]{43}$/.test(hash)) {
      this.showError('Please enter a valid Arweave transaction hash (43 characters)');
      return;
    }

    // Check for duplicates
    const existingHashes = Array.from(document.querySelectorAll('.alternative-location-item .location-value'))
      .map(el => el.textContent.trim());
    
    if (existingHashes.includes(hash)) {
      this.showError('This Arweave hash already exists in alternative locations');
      return;
    }

    // Create new alternative location item
    const container = document.getElementById('alternative-locations-container');
    const newIndex = container.querySelectorAll('.alternative-location-item').length;
    
    const arweaveUrl = `https://arweave.net/${hash}`;
    const newItem = document.createElement('div');
    newItem.innerHTML = this.generateAlternativeLocationItem({
      type: 'external_arweave',
      value: arweaveUrl,
      accessibility: {
        status: 'unknown',
        lastChecked: new Date().toISOString()
      }
    }, newIndex);
    newItem.className = 'alternative-location-item';
    newItem.dataset.index = newIndex;

    container.appendChild(newItem.firstElementChild);

    // Clear input
    hashInput.value = '';

    // Check Arweave accessibility
    this.checkUrlAccessibility(arweaveUrl, newIndex);

    console.log(`[UnifiedResourceManager] Added external Arweave hash: ${hash}`);
  }

  /**
   * Remove alternative location
   */
  removeAlternativeLocation(locationItem) {
    if (!locationItem) return;

    const locationValue = locationItem.querySelector('.location-value')?.textContent?.trim();
    console.log(`[UnifiedResourceManager] Removing alternative location: ${locationValue}`);
    
    locationItem.remove();
  }

  /**
   * Check URL accessibility
   */
  async checkUrlAccessibility(url, index) {
    try {
      const statusElement = document.querySelector(`[data-index="${index}"] .location-status`);
      if (!statusElement) return;

      statusElement.innerHTML = '<span class="status-checking">Checking...</span>';

      // Use a simple fetch to check accessibility
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors' // Handle CORS issues
      });

      clearTimeout(timeoutId);

      // For no-cors mode, we can only check if the request didn't fail
      statusElement.innerHTML = this.generateLocationStatusIndicator({
        accessibility: {
          status: 'accessible',
          lastChecked: new Date().toISOString()
        }
      });

    } catch (error) {
      console.warn(`[UnifiedResourceManager] URL check failed for ${url}:`, error);
      
      const statusElement = document.querySelector(`[data-index="${index}"] .location-status`);
      if (statusElement) {
        statusElement.innerHTML = this.generateLocationStatusIndicator({
          accessibility: {
            status: 'inaccessible',
            lastChecked: new Date().toISOString(),
            error: error.message
          }
        });
      }
    }
  }

  /**
   * Add tag to edit form
   */
  async addEditTag() {
    console.log('[UnifiedResourceManager] Adding tag to edit form');
    
    const tagInput = document.getElementById('edit-resource-tag-input');
    if (!tagInput) return;

    const tagValue = tagInput.value.trim();
    if (!tagValue) {
      this.showError('Tag value is required');
      return;
    }

    // Check for duplicates
    const existingTags = Array.from(document.querySelectorAll('.modal-tags-list .modal-tag'))
      .map(tag => tag.textContent.replace('×', '').trim());
    
    if (existingTags.includes(tagValue)) {
      this.showError('Tag already exists');
      return;
    }

    // Add to modal tags array
    if (!this.modalTags.includes(tagValue)) {
      this.modalTags.push(tagValue);
    }

    // Update UI
    this.renderEditModalTags();

    // Clear input
    tagInput.value = '';

    console.log(`[UnifiedResourceManager] Added tag: ${tagValue}`);
  }

  /**
   * Remove tag from edit form
   */
  removeEditTag(tagValue) {
    if (!tagValue) return;

    console.log(`[UnifiedResourceManager] Removing tag: ${tagValue}`);
    
    // Remove from modal tags array
    const index = this.modalTags.indexOf(tagValue);
    if (index > -1) {
      this.modalTags.splice(index, 1);
    }

    // Update UI
    this.renderEditModalTags();
  }

  /**
   * Render edit modal tags
   */
  renderEditModalTags() {
    const container = document.querySelector('.modal-tags-list');
    if (!container) return;

    container.innerHTML = this.modalTags.map(tag => `
      <span class="modal-tag">
        ${this.escapeHtml(tag)}
        <button 
          type="button" 
          data-tag="${this.escapeHtml(tag)}" 
          title="Remove tag"
        >×</button>
      </span>
    `).join('');
  }

  /**
   * Setup tag autocomplete for edit modal
   */
  async setupTagAutocomplete(input) {
    if (!input) return;

    try {
      const allTags = this.getAllTags();
      
      const autocomplete = new TagAutocomplete(input, {
        suggestions: allTags,
        placeholder: 'Enter tag...',
        caseSensitive: false,
        allowCustomValues: true,
        maxSuggestions: 10,
        onSelect: (tag) => {
          // Auto-add tag when selected from autocomplete
          input.value = tag;
          this.addEditTag();
        }
      });

      this.tagAutocompletes.push(autocomplete);
      
    } catch (error) {
      console.error('[UnifiedResourceManager] Failed to setup tag autocomplete:', error);
    }
  }
} 