import { ModuleBase } from './ModuleBase.js';

/**
 * UnifiedResourceManager - manages both internal (local) and external (web) resources
 * Foundation for unified resource management in Meridian
 */
export class UnifiedResourceManager extends ModuleBase {
  constructor(app) {
    super(app);
    // In-memory resource list
    this.unifiedResources = [];
    
    // Modal state
    this.editingResourceId = null;
    this.modalTags = [];
    
    // Filter and search state
    this.activeTagFilters = new Set();
    this.currentSearchTerm = '';
    this.filterLogic = 'any'; // 'any' or 'all'
    
    // Collapse state management
    this.unifiedCollapseState = {
      globalState: 'expanded',
      collapsedItems: new Set()
    };
  }

  async onInit() {
    console.log('[UnifiedResourceManager] ===== INITIALIZING UNIFIED RESOURCE MANAGER =====');
    // Don't load resources yet - wait for workspace to be selected
    console.log('[UnifiedResourceManager] Setting up panel and event listeners...');
    this.renderUnifiedPanel();
    console.log('[UnifiedResourceManager] Panel rendered and event listeners set up, initializing collapse state...');
    this.initializeCollapseState();
    console.log('[UnifiedResourceManager] ===== UNIFIED RESOURCE MANAGER INITIALIZED SUCCESSFULLY =====');
  }

  async onCleanup() {
    console.log('[UnifiedResourceManager] Cleaning up...');
    this.saveCollapseState();
    console.log('[UnifiedResourceManager] Cleaned up successfully');
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
    
    // Always set up event listeners after rendering
    this.setupUnifiedEventListeners();
  }

  /**
   * Render the unified resource list
   */
  renderUnifiedResourceList() {
    const filteredResources = this.getFilteredResources();
    
    if (filteredResources.length === 0) {
      if (this.unifiedResources.length === 0) {
        return '<div class="loading-state">No resources yet. Click "Add Resource" to get started!</div>';
      } else {
        return '<div class="loading-state">No resources match your current filters.</div>';
      }
    }

    return filteredResources.map(resource => {
      const isCollapsed = this.unifiedCollapseState.collapsedItems.has(resource.id);
      const arweaveHashes = resource.properties["meridian:arweave_hashes"] || [];
      
      return `
        <div class="archive-item ${isCollapsed ? 'collapsed' : ''}" data-id="${resource.id}">
          <div class="archive-header">
            <div class="archive-info">
              <h4 class="archive-title">${this.escapeHtml(resource.properties["dc:title"] || "Untitled")}</h4>
              <div class="archive-path">
                <span class="file-status-indicator ${this.getResourceStatusIndicator(resource)}"></span>
                ${this.escapeHtml(resource.locations.primary.value)}
              </div>
              ${!isCollapsed && resource.properties["meridian:description"] ? `
                <p class="archive-description">${this.escapeHtml(resource.properties["meridian:description"])}</p>
              ` : ''}
              ${!isCollapsed ? `
                <div class="archive-metadata">
                  <span class="archive-metadata-item">
                    <span class="archive-metadata-label">Type:</span>
                    <span class="archive-metadata-value">${this.escapeHtml(resource.state.type)}</span>
                  </span>
                  <span class="archive-metadata-item">
                    <span class="archive-metadata-label">Created:</span>
                    <span class="archive-metadata-value">${this.formatDate(resource.timestamps.created)}</span>
                  </span>
                  ${arweaveHashes.length > 0 ? `
                    <span class="archive-metadata-item">
                      <span class="archive-metadata-label">Arweave Uploads:</span>
                      <span class="archive-metadata-value">${arweaveHashes.length}</span>
                    </span>
                  ` : ''}
                </div>
              ` : ''}
            </div>
            <div class="archive-actions">
              <button class="archive-collapse-btn" data-resource-id="${resource.id}" title="Toggle details">
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <div class="archive-actions-dropdown">
                <button class="archive-actions-btn" data-resource-id="${resource.id}" title="Resource options">⋮</button>
                <div class="archive-actions-menu" data-resource-id="${resource.id}">
                  <button class="archive-actions-item edit-option" data-resource-id="${resource.id}">Edit</button>
                  <button class="archive-actions-item remove-option" data-resource-id="${resource.id}">Remove</button>
                </div>
              </div>
            </div>
          </div>
          
          ${!isCollapsed && arweaveHashes.length > 0 ? `
            <div class="archive-arweave-hashes">
              <div class="archive-hash-header" data-resource-id="${resource.id}">
                <span class="archive-hash-count">${arweaveHashes.length} Arweave Upload${arweaveHashes.length > 1 ? 's' : ''}</span>
                <button class="archive-hash-toggle" data-resource-id="${resource.id}" title="Toggle upload history">
                  <svg class="archive-hash-toggle-icon" width="12" height="12" viewBox="0 0 12 12">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
              <div class="archive-hash-list collapsed" data-resource-id="${resource.id}">
                ${arweaveHashes.map(hash => `
                  <div class="archive-hash-item">
                    <div class="archive-hash-content">
                      <a href="${hash.link}" class="archive-hash-link" target="_blank" title="${hash.hash}">
                        ${this.truncateHash(hash.hash)}
                      </a>
                      <span class="archive-hash-timestamp">${this.formatDate(hash.timestamp)}</span>
                      ${hash.tags && hash.tags.length > 0 ? `
                        <div class="archive-hash-tags">
                          ${hash.tags.map(tag => `
                            <span class="archive-hash-tag" title="${this.escapeHtml(tag)}">${this.escapeHtml(tag)}</span>
                          `).join('')}
                        </div>
                      ` : ''}
                    </div>
                    <div class="archive-hash-actions">
                      <button class="archive-hash-action-btn copy-hash-btn" data-hash="${hash.hash}" title="Copy Hash">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                      <button class="archive-hash-action-btn copy-url-btn" data-url="${hash.link}" title="Copy URL">
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
            <div class="archive-tags">
              <div class="archive-tag-input">
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
              ${(resource.properties["meridian:tags"] || []).map(tag => `
                <span class="archive-tag">
                  ${this.escapeHtml(tag)}
                  <button class="remove-tag-btn" data-resource-id="${resource.id}" data-tag="${this.escapeHtml(tag)}" title="Remove tag">×</button>
                </span>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * Get filtered resources based on search and tag filters
   */
  getFilteredResources() {
    let filtered = this.unifiedResources;

    // Apply search filter
    if (this.currentSearchTerm) {
      const searchTerm = this.currentSearchTerm.toLowerCase();
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
    if (this.activeTagFilters.size > 0) {
      filtered = filtered.filter(resource => {
        const resourceTags = new Set(resource.properties["meridian:tags"] || []);
        
        if (this.filterLogic === 'any') {
          // Show if ANY of the active filters match
          return Array.from(this.activeTagFilters).some(tag => resourceTags.has(tag));
        } else {
          // Show if ALL of the active filters match
          return Array.from(this.activeTagFilters).every(tag => resourceTags.has(tag));
        }
      });
    }

    return filtered;
  }

  /**
   * Render tag filters
   */
  renderTagFilters() {
    const allTags = this.getAllTags();
    
    if (allTags.length === 0) {
      return '<div class="no-tags">No tags yet</div>';
    }

    return allTags.map(tag => `
      <div class="tag-filter-container">
        <button 
          class="tag-filter ${this.activeTagFilters.has(tag) ? 'active' : ''}" 
          data-tag="${this.escapeHtml(tag)}"
          title="${this.getTagCount(tag)} resources"
        >
          <span class="tag-filter-label">${this.escapeHtml(tag)}</span>
          <span class="tag-filter-count">${this.getTagCount(tag)}</span>
        </button>
      </div>
    `).join('');
  }

  /**
   * Get all unique tags from resources
   */
  getAllTags() {
    const tagSet = new Set();
    this.unifiedResources.forEach(resource => {
      (resource.properties["meridian:tags"] || []).forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }

  /**
   * Get count of resources with a specific tag
   */
  getTagCount(tag) {
    return this.unifiedResources.filter(resource => 
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
   * Setup event listeners for unified panel
   */
  setupUnifiedEventListeners() {
    const unifiedPanel = document.getElementById('unified-panel');
    if (!unifiedPanel) {
      console.warn('[UnifiedResourceManager] Unified panel not found');
      return;
    }

    // Add resource button
    const addBtn = unifiedPanel.querySelector('#add-unified-resource-btn');
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        await this.openAddUnifiedResourceModal();
      });
    }

    // Search functionality
    const searchInput = unifiedPanel.querySelector('#unified-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.currentSearchTerm = e.target.value;
        this.applyUnifiedFilters();
      });
    }

    // Filter logic toggle
    const filterLogicBtn = unifiedPanel.querySelector('#unified-filter-logic-btn');
    if (filterLogicBtn) {
      filterLogicBtn.addEventListener('click', () => {
        this.filterLogic = this.filterLogic === 'any' ? 'all' : 'any';
        filterLogicBtn.setAttribute('data-logic', this.filterLogic);
        filterLogicBtn.setAttribute('title', `Toggle Filter Logic: ${this.filterLogic === 'any' ? 'ANY' : 'ALL'} of these tags`);
        this.applyUnifiedFilters();
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
      } else if (e.target.closest('.archive-collapse-btn')) {
        const resourceId = e.target.closest('.archive-collapse-btn').dataset.resourceId;
        this.toggleResourceCollapse(resourceId);
      }
    });

    // Arweave hash interactions (event delegation)
    unifiedPanel.addEventListener('click', (e) => {
      // Arweave hash toggle
      if (e.target.closest('.archive-hash-toggle')) {
        const resourceId = e.target.closest('.archive-hash-toggle').dataset.resourceId;
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
    const hashList = document.querySelector(`.archive-hash-list[data-resource-id="${resourceId}"]`);
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
   * Toggle collapse all functionality
   */
  toggleCollapseAll() {
    const collapseBtn = document.getElementById('unified-collapse-all-btn');
    if (!collapseBtn) return;

    if (this.unifiedCollapseState.globalState === 'expanded') {
      this.unifiedCollapseState.globalState = 'collapsed';
      this.unifiedCollapseState.collapsedItems = new Set(this.unifiedResources.map(r => r.id));
      collapseBtn.setAttribute('data-state', 'collapsed');
    } else {
      this.unifiedCollapseState.globalState = 'expanded';
      this.unifiedCollapseState.collapsedItems.clear();
      collapseBtn.setAttribute('data-state', 'expanded');
    }

    this.updateResourceListOnly();
    this.saveCollapseState();
  }

  /**
   * Toggle individual resource collapse
   */
  toggleResourceCollapse(resourceId) {
    if (this.unifiedCollapseState.collapsedItems.has(resourceId)) {
      this.unifiedCollapseState.collapsedItems.delete(resourceId);
    } else {
      this.unifiedCollapseState.collapsedItems.add(resourceId);
    }

    this.updateResourceListOnly();
    this.saveCollapseState();
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
   * Toggle tag filter
   */
  toggleTagFilter(tag) {
    if (this.activeTagFilters.has(tag)) {
      this.activeTagFilters.delete(tag);
    } else {
      this.activeTagFilters.add(tag);
    }
    this.applyUnifiedFilters();
    this.updateUnifiedTagFilterButtons();
  }

  /**
   * Apply unified filters
   */
  applyUnifiedFilters() {
    const resourceItems = document.querySelectorAll('.archive-item');
    
    resourceItems.forEach(item => {
      const resourceId = item.dataset.id;
      const resource = this.unifiedResources.find(r => r.id === resourceId);
      
      if (!resource) {
        item.style.display = 'none';
        return;
      }
      
      let matchesSearch = true;
      let matchesTags = true;
      
      // Apply search filter
      if (this.currentSearchTerm.trim()) {
        const term = this.currentSearchTerm.toLowerCase();
        const title = (resource.properties["dc:title"] || "").toLowerCase();
        const description = (resource.properties["meridian:description"] || "").toLowerCase();
        const url = resource.locations.primary.value.toLowerCase();
        const tags = (resource.properties["meridian:tags"] || []).join(" ").toLowerCase();
        
        matchesSearch = title.includes(term) || 
                       description.includes(term) || 
                       url.includes(term) || 
                       tags.includes(term);
      }
      
      // Apply tag filters
      if (this.activeTagFilters.size > 0) {
        const resourceTags = new Set(resource.properties["meridian:tags"] || []);
        
        if (this.filterLogic === 'all') {
          // ALL logic: Resource must have ALL of the selected tags
          matchesTags = Array.from(this.activeTagFilters).every(tag => resourceTags.has(tag));
        } else {
          // ANY logic (default): Resource must have at least one of the selected tags
          matchesTags = Array.from(this.activeTagFilters).some(tag => resourceTags.has(tag));
        }
      }
      
      // Show/hide based on filters
      item.style.display = (matchesSearch && matchesTags) ? 'block' : 'none';
    });
    
    this.updateUnifiedCount();
  }

  /**
   * Update unified tag filter buttons
   */
  updateUnifiedTagFilterButtons() {
    document.querySelectorAll('.tag-filter').forEach(btn => {
      const tag = btn.dataset.tag;
      if (this.activeTagFilters.has(tag)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
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
   * Update unified count
   */
  updateUnifiedCount() {
    const visibleCount = document.querySelectorAll('.archive-item[style*="block"], .archive-item:not([style*="none"])').length;
    const totalCount = this.unifiedResources.length;
    
    const countElement = document.getElementById('unified-count-text');
    if (countElement) {
      const resourceText = visibleCount === 1 ? 'Resource' : 'Resources';
      countElement.textContent = `${visibleCount} of ${totalCount} ${resourceText}`;
    }
  }

  /**
   * Clear all filters
   */
  clearAllFilters() {
    this.activeTagFilters.clear();
    this.currentSearchTerm = '';
    this.filterLogic = 'any';
    
    // Clear search input
    const searchInput = document.getElementById('unified-search');
    if (searchInput) {
      searchInput.value = '';
    }
    
    // Update filter buttons
    document.querySelectorAll('.tag-filter').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Show all resources
    document.querySelectorAll('.archive-item').forEach(item => {
      item.style.display = 'block';
    });
    
    this.updateUnifiedCount();
  }

  /**
   * Add tag to resource
   */
  async addTagToResource(resourceId, tagValue) {
    try {
      // Add tag via backend API
      const updatedResource = await window.electronAPI.unified.addTagToResource(resourceId, tagValue);
      
      // Update local resource
      const resourceIndex = this.unifiedResources.findIndex(r => r.id === resourceId);
      if (resourceIndex !== -1) {
        this.unifiedResources[resourceIndex] = updatedResource;
      }
      
      // Update the specific resource item in the DOM
      const resourceItem = document.querySelector(`[data-id="${resourceId}"]`);
      if (resourceItem) {
        const tagsContainer = resourceItem.querySelector('.archive-tags');
        if (tagsContainer) {
          // Add the new tag to the display
          const tagSpan = document.createElement('span');
          tagSpan.className = 'archive-tag';
          tagSpan.innerHTML = `
            ${this.escapeHtml(tagValue)}
            <button class="remove-tag-btn" data-resource-id="${resourceId}" data-tag="${this.escapeHtml(tagValue)}" title="Remove tag">×</button>
          `;
          tagsContainer.appendChild(tagSpan);
        }
      }
      
      // Update tag filter list and re-apply filters
      this.updateTagFilterList();
      this.applyUnifiedFilters();
      this.showSuccess('Tag added successfully');
    } catch (error) {
      console.error('[UnifiedResourceManager] Error adding tag:', error);
      this.showError('Failed to add tag');
    }
  }

  /**
   * Remove tag from resource
   */
  async removeTagFromResource(resourceId, tag) {
    try {
      // Remove tag via backend API
      const updatedResource = await window.electronAPI.unified.removeTagFromResource(resourceId, tag);
      
      // Update local resource
      const resourceIndex = this.unifiedResources.findIndex(r => r.id === resourceId);
      if (resourceIndex !== -1) {
        this.unifiedResources[resourceIndex] = updatedResource;
      }
      
      // Remove the tag from the DOM
      const tagElement = document.querySelector(`[data-resource-id="${resourceId}"][data-tag="${this.escapeHtml(tag)}"]`);
      if (tagElement) {
        tagElement.closest('.archive-tag').remove();
      }
      
      // Update tag filter list and re-apply filters
      this.updateTagFilterList();
      this.applyUnifiedFilters();
      this.showSuccess('Tag removed successfully');
    } catch (error) {
      console.error('[UnifiedResourceManager] Error removing tag:', error);
      this.showError('Failed to remove tag');
    }
  }

  /**
   * Initialize collapse state
   */
  initializeCollapseState() {
    try {
      const saved = localStorage.getItem('unifiedCollapseState');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.unifiedCollapseState.globalState = parsed.globalState || 'expanded';
        this.unifiedCollapseState.collapsedItems = new Set(parsed.collapsedItems || []);
      }
    } catch (error) {
      console.warn('[UnifiedResourceManager] Failed to load collapse state:', error);
    }
  }

  /**
   * Save collapse state
   */
  saveCollapseState() {
    try {
      const state = {
        globalState: this.unifiedCollapseState.globalState,
        collapsedItems: Array.from(this.unifiedCollapseState.collapsedItems)
      };
      localStorage.setItem('unifiedCollapseState', JSON.stringify(state));
    } catch (error) {
      console.warn('[UnifiedResourceManager] Failed to save collapse state:', error);
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
            
            <div id="review-summary">
              <!-- Review summary will appear here -->
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
            
            <div id="external-review-list">
              <!-- External resources review will appear here -->
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
      console.log('[UnifiedResourceManager] Showing review phase, calling renderReviewPhase');
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
    this.updateExternalReviewDisplay();
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
   * Update external review display
   */
  updateExternalReviewDisplay() {
    const modal = document.getElementById('unified-resource-modal');
    if (!modal) return;

    const reviewList = modal.querySelector('#external-review-list');
    const results = this.modalState.external.processingResults;

    if (results.length === 0) {
      reviewList.innerHTML = '<p>No resources to review</p>';
    } else {
      reviewList.innerHTML = results.map(result => `
        <div class="review-item">
          <h5>${this.escapeHtml(result.title)}</h5>
          <p>${this.escapeHtml(result.description)}</p>
          <p><strong>URL:</strong> ${this.escapeHtml(result.url)}</p>
          <p><strong>Tags:</strong> ${result.tags.join(', ')}</p>
        </div>
      `).join('');
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
      const resourceId = await this.generateResourceId();
      const contentHash = await this.generateContentHash(file.name);
      const now = new Date().toISOString();

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
          'meridian:tags': bulkMetadata.tags || [],
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

    for (const result of results) {
      const resourceId = await this.generateResourceId();
      const contentHash = await this.generateContentHash(result.url);
      const now = new Date().toISOString();

      const resource = {
        id: resourceId,
        uri: `urn:meridian:resource:${resourceId}`,
        contentHash: contentHash,
        properties: {
          'dc:title': result.title,
          'dc:type': 'web-page',
          'meridian:tags': result.tags,
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
   * Edit unified resource
   */
  editUnifiedResource(resourceId) {
    // TODO: Implement edit functionality
    console.log('Edit resource:', resourceId);
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
   * Load unified resources from backend
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
      this.unifiedResources = unifiedData.resources || [];
      
      console.log(`[UnifiedResourceManager] Loaded ${this.unifiedResources.length} resources from backend`);
    } catch (error) {
      console.error('[UnifiedResourceManager] Error loading resources:', error);
      this.unifiedResources = [];
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
   * Calculate tag counts from current resources
   */
  calculateTagCounts() {
    const tagCounts = {};
    this.unifiedResources.forEach(resource => {
      const tags = resource.properties["meridian:tags"] || [];
      tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    return tagCounts;
  }

  /**
   * Add resource to unified list and save
   */
  async addUnifiedResource(resource) {
    try {
      console.log('[UnifiedResourceManager] Adding unified resource:', resource);
      
      // Add resource via backend API
      const addedResource = await window.electronAPI.unified.addResource(resource);
      
      // Add to local list
      this.unifiedResources.push(addedResource);
      
      // Re-render panel
      this.renderUnifiedPanel();
      
      console.log('[UnifiedResourceManager] Resource added successfully');
    } catch (error) {
      console.error('[UnifiedResourceManager] Error adding resource:', error);
      this.showError('Failed to add resource');
    }
  }

  /**
   * Remove resource from unified list and save
   */
  async removeUnifiedResourceById(resourceId) {
    try {
      console.log('[UnifiedResourceManager] Removing unified resource:', resourceId);
      
      // Remove resource via backend API
      await window.electronAPI.unified.removeResource(resourceId);
      
      // Remove from local list
      this.unifiedResources = this.unifiedResources.filter(r => r.id !== resourceId);
      
      // Re-render panel
      this.renderUnifiedPanel();
      
      console.log('[UnifiedResourceManager] Resource removed successfully');
    } catch (error) {
      console.error('[UnifiedResourceManager] Error removing resource:', error);
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
   * Get export filter information
   */
  getExportFilterInfo() {
    const parts = [];
    
    if (this.currentSearchTerm) {
      parts.push(`Search: "${this.currentSearchTerm}"`);
    }
    
    if (this.activeTagFilters.size > 0) {
      const tags = Array.from(this.activeTagFilters).join(', ');
      parts.push(`Tags: ${tags} (${this.filterLogic.toUpperCase()})`);
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
} 