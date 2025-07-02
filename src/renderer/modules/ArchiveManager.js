import { ModuleBase } from './ModuleBase.js';
import { TagAutocomplete } from '../components/TagAutocomplete.js';

/**
 * ArchiveManager module - handles all archive-related operations in Meridian
 * Manages: Archive file operations, metadata extraction, tagging, filtering, collapse state
 */
export class ArchiveManager extends ModuleBase {
  constructor(app) {
    super(app);
    
    // Archive state management
    this.editArchiveItemTags = [];
    this.editArchiveItemTagAutocomplete = null;
    this.archiveTagAutocompletes = [];
    this.archiveCollapseState = {
      globalState: 'expanded', // 'expanded' or 'collapsed'
      collapsedItems: new Set() // Track individually collapsed items
    };
    
    // Archive filter state
    this.activeArchiveTagFilters = new Set();
    this.currentArchiveSearchTerm = '';
    this.archiveFilterLogic = 'any'; // Default to 'any' (OR logic)
  }

  async onInit() {
    console.log('[ArchiveManager] Initializing...');
    
    // Set up event listeners for archive-related functionality
    this.setupArchiveEventListeners();
    
    // Initialize collapse state from localStorage
    this.initializeArchiveCollapseState();
    
    console.log('[ArchiveManager] Initialized successfully');
  }

  async onCleanup() {
    console.log('[ArchiveManager] Cleaning up...');
    
    // Save collapse state to localStorage
    this.saveArchiveCollapseState();
    
    // Clean up autocomplete instances
    if (this.editArchiveItemTagAutocomplete) {
      this.editArchiveItemTagAutocomplete.cleanup && this.editArchiveItemTagAutocomplete.cleanup();
      this.editArchiveItemTagAutocomplete = null;
    }
    
    console.log('[ArchiveManager] Cleaned up successfully');
  }

  // ===== ARCHIVE DATA LOADING =====

  /**
   * Load archive data and render UI
   */
  async loadArchiveData() {
    try {
      console.log('[ArchiveManager] Loading archive data...');
      
      // Check if workspace is selected
      if (!this.getWorkspacePath()) {
        console.log('[ArchiveManager] No workspace selected, showing no workspace state');
        this.renderArchiveNoWorkspace();
        return;
      }

      // Load archive data from backend
      this.getData().archive = await window.electronAPI.archive.loadData();
      console.log('[ArchiveManager] Archive data loaded:', this.getData().archive);

      // Render archive files
      this.renderArchiveFiles();
      
      // Render archive tag filters
      this.renderArchiveTagFilters();
      
      // Setup archive collapse events
      this.setupArchiveCollapseEvents();
      
      // Restore archive collapse state
      this.restoreArchiveCollapseState();
      
    } catch (error) {
      console.error('[ArchiveManager] Failed to load archive data:', error);
      this.showError('Failed to load archive data');
    }
  }

  // ===== ARCHIVE RENDERING =====

  /**
   * Render no workspace state for archive
   */
  renderArchiveNoWorkspace() {
    const archiveContainer = document.getElementById('archive-list');
    if (!archiveContainer) return;

    archiveContainer.innerHTML = `
      <div class="no-workspace-state">
        <div class="no-workspace-icon">📁</div>
        <h3>No Workspace Selected</h3>
        <p>Please select a workspace directory to view archived files.</p>
        <button id="archive-workspace-btn" class="primary-btn">Select Workspace</button>
      </div>
    `;

    // Add event listener for workspace selection
    const workspaceBtn = document.getElementById('archive-workspace-btn');
    if (workspaceBtn) {
      workspaceBtn.addEventListener('click', async () => {
        await this.getApp().selectWorkspace();
      });
    }
  }

  /**
   * Render all archive files
   */
  renderArchiveFiles() {
    const container = document.getElementById('archive-list');
    if (!container || !this.getData().archive || !this.getData().archive.files) {
      return;
    }

    if (this.getData().archive.files.length === 0) {
      container.innerHTML = '<div class="loading-state">No archived files found</div>';
      return;
    }

    container.innerHTML = this.getData().archive.files.map(file => `
      <div class="archive-item" data-uuid="${file.uuid}">
        <div class="archive-header">
          <div class="archive-info">
            <h4 class="archive-title">${this.escapeHtml(file.title || file.name)}</h4>
            <div class="archive-path">
              <span class="file-status-indicator ${this.getFileStatusIndicator(file.filePath)}"></span>
              ${this.escapeHtml(file.filePath)}
            </div>
            <div class="archive-metadata">
              <span class="archive-metadata-item">
                <span class="archive-metadata-label">Size:</span>
                <span class="archive-metadata-value">${this.formatFileSize(file.fileSize)}</span>
              </span>
              <span class="archive-metadata-item">
                <span class="archive-metadata-label">Type:</span>
                <span class="archive-metadata-value">${this.escapeHtml(file.mimeType)}</span>
              </span>
              <span class="archive-metadata-item">
                <span class="archive-metadata-label">Modified:</span>
                <span class="archive-metadata-value">${this.formatUTCTimestamp(file.modified)}</span>
              </span>
            </div>
          </div>
          <div class="archive-actions">
            <button class="archive-locate-btn" data-file-uuid="${file.uuid}" title="Locate file in workspace">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 1C3.24 1 1 3.24 1 6s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 9c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
                <path d="M6 3c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
            </button>
            <button class="archive-collapse-btn" data-file-uuid="${file.uuid}" title="Toggle details">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="archive-actions-dropdown">
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
        
        <div class="archive-arweave-hashes">
          <div class="archive-hash-header" data-file-uuid="${file.uuid}">
            <span class="archive-hash-count">${file.arweaveHashes ? file.arweaveHashes.length : 0} Uploads</span>
            <button class="archive-hash-toggle" data-file-uuid="${file.uuid}" title="Toggle upload history">
              <svg class="archive-hash-toggle-icon" width="12" height="12" viewBox="0 0 12 12">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="archive-hash-list collapsed" data-file-uuid="${file.uuid}">
            ${file.arweaveHashes ? file.arweaveHashes.map(hash => `
              <div class="archive-hash-item">
                <div class="archive-hash-content">
                  <a href="${hash.link}" class="archive-hash-link" target="_blank" title="${hash.hash}">
                    ${this.truncateHash(hash.hash)}
                  </a>
                  <span class="archive-hash-timestamp">${this.formatUTCTimestamp(hash.timestamp)}</span>
                </div>
                <div class="archive-hash-actions">
                  <button class="archive-hash-action-btn copy-hash-btn" data-hash="${hash.hash}" title="Copy Hash">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M4 2h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/>
                      <path d="M2 4h1v6a2 2 0 0 0 2 2h6v1a1 1 0 0 1-1 1H3a2 2 0 0 1-2-2V4z"/>
                    </svg>
                  </button>
                  <button class="archive-hash-action-btn copy-url-btn" data-url="${hash.link}" title="Copy URL">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M4 2h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/>
                      <path d="M2 4h1v6a2 2 0 0 0 2 2h6v1a1 1 0 0 1-1 1H3a2 2 0 0 1-2-2V4z"/>
                    </svg>
                  </button>
                </div>
              </div>
            `).join('') : ''}
          </div>
        </div>
        
        <div class="archive-tags">
          <div class="archive-tag-input">
            <div class="tag-input-container">
              <input 
                type="text" 
                class="tag-input archive-tag-input" 
                placeholder="add tag..." 
                data-file-uuid="${file.uuid}"
              />
              <button class="add-tag-btn archive-add-tag-btn" data-file-uuid="${file.uuid}" disabled>+</button>
            </div>
            <div class="tag-autocomplete" id="archive-autocomplete-${file.uuid}" style="display: none;"></div>
          </div>
          ${file.tags ? file.tags.map(tag => `
            <span class="archive-tag">
              ${this.escapeHtml(tag)}
              <button class="remove-tag-btn" data-file-uuid="${file.uuid}" data-tag="${this.escapeHtml(tag)}" title="Remove tag">×</button>
            </span>
          `).join('') : ''}
        </div>
      </div>
    `).join('');

    // Setup archive tag input events after rendering
    this.setupArchiveTagInputEvents();
  }

  /**
   * Render archive tag filters
   */
  renderArchiveTagFilters() {
    const container = document.getElementById('archive-tag-filter-list');
    if (!container || !this.getData().archive || !this.getData().archive.files) {
      container.innerHTML = '';
      return;
    }

    // Extract all unique tags from archive files
    const tagCounts = {};
    this.getData().archive.files.forEach(file => {
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
          <span class="archive-tag-filter-text">${this.escapeHtml(tag)}</span>
          <span class="archive-tag-filter-count">${count}</span>
        </button>
      </div>
    `).join('');

    // Add click events for tag filters
    container.querySelectorAll('.archive-tag-filter').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tag = e.target.closest('.archive-tag-filter').dataset.tag;
        this.toggleArchiveTagFilter(tag);
      });
    });
  }

  /**
   * Toggle archive tag filter
   */
  toggleArchiveTagFilter(tag) {
    if (!this.activeArchiveTagFilters) {
      this.activeArchiveTagFilters = new Set();
    }

    if (this.activeArchiveTagFilters.has(tag)) {
      this.activeArchiveTagFilters.delete(tag);
    } else {
      this.activeArchiveTagFilters.add(tag);
    }
    
    this.applyArchiveFilters();
    this.updateArchiveTagFilterButtons();
  }

  /**
   * Apply archive filters
   */
  applyArchiveFilters() {
    if (!this.getData().archive) return;

    const items = document.querySelectorAll('.archive-item');
    
    items.forEach(item => {
      const fileUuid = item.dataset.uuid;
      const file = this.getData().archive.files.find(f => f.uuid === fileUuid);
      
      if (!file) {
        item.style.display = 'none';
        return;
      }

      // Check search term filter
      let matchesSearch = true;
      if (this.currentArchiveSearchTerm && this.currentArchiveSearchTerm.trim()) {
        const term = this.currentArchiveSearchTerm.toLowerCase();
        const title = file.title.toLowerCase();
        const filePath = file.filePath.toLowerCase();
        const author = (file.metadata?.author || '').toLowerCase();
        
        matchesSearch = title.includes(term) || filePath.includes(term) || author.includes(term);
      }

      // Check tag filters
      let matchesTags = true;
      if (this.activeArchiveTagFilters && this.activeArchiveTagFilters.size > 0) {
        if (this.archiveFilterLogic === 'all') {
          // ALL logic: file must have ALL selected tags
          matchesTags = Array.from(this.activeArchiveTagFilters).every(tag => 
            file.tags && file.tags.includes(tag)
          );
        } else {
          // ANY logic: file must have ANY of the selected tags
          matchesTags = Array.from(this.activeArchiveTagFilters).some(tag => 
            file.tags && file.tags.includes(tag)
          );
        }
      }

      // Show/hide item based on filters
      if (matchesSearch && matchesTags) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    });

    // Update filter button states
    this.updateArchiveTagFilterButtons();
    this.updateArchiveCount();
  }

  /**
   * Update archive tag filter buttons
   */
  updateArchiveTagFilterButtons() {
    if (!this.activeArchiveTagFilters) return;

    document.querySelectorAll('.archive-tag-filter').forEach(btn => {
      const tag = btn.dataset.tag;
      if (this.activeArchiveTagFilters.has(tag)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  /**
   * Update archive count
   */
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

  /**
   * Clear all archive filters
   */
  clearAllArchiveFilters() {
    if (!this.activeArchiveTagFilters) {
      this.activeArchiveTagFilters = new Set();
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

  // ===== ARCHIVE COLLAPSE MANAGEMENT =====

  /**
   * Setup archive collapse events
   */
  setupArchiveCollapseEvents() {
    // Individual archive item collapse
    document.querySelectorAll('.archive-collapse-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fileUuid = e.target.dataset.fileUuid;
        this.toggleArchiveFileCollapse(fileUuid);
      });
    });

    // Archive collapse all button
    const archiveCollapseAllBtn = document.getElementById('archive-collapse-all-btn');
    if (archiveCollapseAllBtn) {
      archiveCollapseAllBtn.addEventListener('click', () => {
        this.toggleAllArchiveFilesCollapse();
      });
    }
  }

  /**
   * Toggle individual archive file collapse
   */
  toggleArchiveFileCollapse(fileUuid) {
    const archiveItem = document.querySelector(`.archive-item[data-uuid="${fileUuid}"]`);
    if (!archiveItem) return;

    const isCollapsed = archiveItem.classList.contains('collapsed');
    
    if (isCollapsed) {
      archiveItem.classList.remove('collapsed');
      this.archiveCollapseState.collapsedItems.delete(fileUuid);
    } else {
      archiveItem.classList.add('collapsed');
      this.archiveCollapseState.collapsedItems.add(fileUuid);
    }

    // Update collapse all button state
    this.updateArchiveCollapseAllButton();
  }

  /**
   * Toggle all archive files collapse
   */
  toggleAllArchiveFilesCollapse() {
    const newState = this.archiveCollapseState.globalState === 'expanded' ? 'collapsed' : 'expanded';
    this.archiveCollapseState.globalState = newState;

    const archiveItems = document.querySelectorAll('.archive-item');
    
    if (newState === 'collapsed') {
      archiveItems.forEach(item => {
        item.classList.add('collapsed');
        this.archiveCollapseState.collapsedItems.add(item.dataset.uuid);
      });
    } else {
      archiveItems.forEach(item => {
        item.classList.remove('collapsed');
        this.archiveCollapseState.collapsedItems.delete(item.dataset.uuid);
      });
    }

    this.updateArchiveCollapseAllButton();
  }

  /**
   * Update archive collapse all button state
   */
  updateArchiveCollapseAllButton() {
    const btn = document.getElementById('archive-collapse-all-btn');
    if (!btn) return;

    const totalItems = document.querySelectorAll('.archive-item').length;
    const collapsedItems = this.archiveCollapseState.collapsedItems.size;

    if (collapsedItems === 0) {
      btn.dataset.state = 'expanded';
      btn.title = 'Collapse All Files';
    } else if (collapsedItems === totalItems) {
      btn.dataset.state = 'collapsed';
      btn.title = 'Expand All Files';
    } else {
      btn.dataset.state = 'mixed';
      btn.title = 'Toggle All Files';
    }
  }

  /**
   * Restore archive collapse state
   */
  restoreArchiveCollapseState() {
    const archiveItems = document.querySelectorAll('.archive-item');
    
    archiveItems.forEach(item => {
      const fileUuid = item.dataset.uuid;
      if (this.archiveCollapseState.collapsedItems.has(fileUuid)) {
        item.classList.add('collapsed');
      }
    });

    this.updateArchiveCollapseAllButton();
  }

  // ===== ARCHIVE TAG MANAGEMENT =====

  /**
   * Setup archive tag input events
   */
  setupArchiveTagInputEvents() {
    const archiveAddTagBtns = document.querySelectorAll('.archive-add-tag-btn');
    const archiveRemoveTagBtns = document.querySelectorAll('.archive-tag .remove-tag-btn');

    // Clean up existing autocomplete instances
    this.archiveTagAutocompletes.forEach(instance => instance.cleanup && instance.cleanup());
    this.archiveTagAutocompletes = [];

    // Setup tag inputs
    const archiveTagInputs = document.querySelectorAll('.archive-tag-input');
    archiveTagInputs.forEach(input => {
      const fileUuid = input.dataset.fileUuid;
      if (!fileUuid) return;

      // Create autocomplete instance
      const autocompleteInstance = new TagAutocomplete({
        inputSelector: `input[data-file-uuid="${fileUuid}"]`,
        autocompleteSelector: `#archive-autocomplete-${fileUuid}`,
        getSuggestions: (value, excludeTags, limit) => {
          const file = this.getData().archive?.files?.find(f => f.uuid === fileUuid);
          const fileTags = file ? file.tags : [];
          return this.getIntelligentArchiveTagSuggestions(value, [...excludeTags, ...fileTags], limit);
        },
        onTagSelect: (tag) => {
          this.addTagToArchiveFile(fileUuid, tag);
        },
        maxSuggestions: 5,
        minInputLength: 1
      });

      this.archiveTagAutocompletes.push(autocompleteInstance);

      // Setup button state management
      input.addEventListener('input', (e) => {
        this.updateArchiveAddTagButtonState(e.target);
      });
    });

    // Add tag buttons
    archiveAddTagBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const fileUuid = e.target.dataset.fileUuid;
        const input = document.querySelector(`input[data-file-uuid="${fileUuid}"]`);
        const tagValue = input?.value.trim();
        if (tagValue) {
          this.addTagToArchiveFile(fileUuid, tagValue);
        }
      });
    });

    // Remove tag buttons
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

  /**
   * Get intelligent archive tag suggestions
   */
  getIntelligentArchiveTagSuggestions(input, excludeTags = [], limit = 5) {
    if (!this.getData().archive || !this.getData().archive.files) {
      return [];
    }

    const inputLower = input.trim().toLowerCase();
    if (inputLower.length === 0) {
      return [];
    }

    // Calculate tag frequency and usage stats
    const tagStats = new Map();
    this.getData().archive.files.forEach(file => {
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

    return allSuggestions.map(s => s.name);
  }

  /**
   * Add tag to archive file
   */
  async addTagToArchiveFile(fileUuid, tagValue) {
    try {
      // Add tag via IPC
      await window.electronAPI.archive.addTagToFile(fileUuid, tagValue);
      
      // Reload data to reflect changes
      await this.getApp().loadArchiveData();
      
      // Clear input and update button state
      const input = document.querySelector(`input[data-file-uuid="${fileUuid}"]`);
      if (input) {
        input.value = '';
        this.updateArchiveAddTagButtonState(input);
      }
      
      // Hide autocomplete
      const autocompleteInstance = this.archiveTagAutocompletes?.find(instance =>
        instance.inputSelector.includes(`data-file-uuid="${fileUuid}"`)
      );
      if (autocompleteInstance) {
        autocompleteInstance.hide();
      }

      this.showSuccess('Tag added successfully');
      
      // Emit event for other modules
      this.emit('archiveTagAdded', { fileUuid, tagValue });
    } catch (error) {
      console.error('Failed to add archive tag:', error);
      this.showError('Failed to add tag');
    }
  }

  /**
   * Remove tag from archive file
   */
  async removeTagFromArchiveFile(fileUuid, tag) {
    try {
      // Remove tag via IPC
      await window.electronAPI.archive.removeTagFromFile(fileUuid, tag);
      
      // Reload data to reflect changes
      await this.getApp().loadArchiveData();

      this.showSuccess('Tag removed successfully');
      
      // Emit event for other modules
      this.emit('archiveTagRemoved', { fileUuid, tag });
    } catch (error) {
      console.error('Failed to remove archive tag:', error);
      this.showError('Failed to remove tag');
    }
  }

  /**
   * Update archive add tag button state
   */
  updateArchiveAddTagButtonState(input) {
    const fileUuid = input.dataset.fileUuid;
    const btn = document.querySelector(`.archive-add-tag-btn[data-file-uuid="${fileUuid}"]`);
    const value = input.value.trim();
    
    if (btn) {
      // Check if tag already exists on this file
      const file = this.getData().archive?.files?.find(f => f.uuid === fileUuid);
      const fileTags = file ? file.tags : [];
      const isDuplicate = fileTags.includes(value);
      
      btn.disabled = value.length === 0 || isDuplicate;
    }
  }

  // ===== ARCHIVE FILE OPERATIONS =====

  /**
   * Open edit archive item modal
   */
  async openEditArchiveItemModal(fileUuid) {
    try {
      const file = this.getData().archive.files.find(f => f.uuid === fileUuid);
      if (!file) {
        this.showError('File not found');
        return;
      }

      // Open the modal
      this.openModal('edit-archive-item-modal');

      // Populate form fields
      document.getElementById('edit-archive-uuid').value = file.uuid;
      document.getElementById('edit-archive-filepath').value = file.filePath;
      document.getElementById('edit-archive-filesize').value = this.formatFileSize(file.fileSize);
      document.getElementById('edit-archive-mimetype-display').value = file.mimeType;
      document.getElementById('edit-archive-created').value = this.formatUTCTimestamp(file.created);
      document.getElementById('edit-archive-modified').value = this.formatUTCTimestamp(file.modified);

      // Populate editable fields
      document.getElementById('edit-archive-title').value = file.title || '';
      document.getElementById('edit-archive-author').value = file.metadata?.author || '';

      // Handle MIME type editing (only for virtual files)
      const mimetypeField = document.getElementById('edit-archive-mimetype');
      const mimetypeDisplay = document.getElementById('edit-archive-mimetype-display');
      const virtualOnlySection = document.querySelector('.virtual-only');
      
      if (this.needsRelocation(file.filePath)) {
        // Virtual file - allow MIME type editing
        virtualOnlySection.style.display = 'block';
        mimetypeField.value = file.mimeType || '';
      } else {
        // Physical file - hide MIME type editing
        virtualOnlySection.style.display = 'none';
      }

      // Store file UUID for form submission
      document.getElementById('edit-archive-item-form').dataset.fileUuid = fileUuid;

      // Initialize tags
      this.editArchiveItemTags = [...(file.tags || [])];
      this.renderEditArchiveItemTags();

      // Initialize tag autocomplete
      this.initializeEditArchiveItemTagAutocompletion();

    } catch (error) {
      console.error('Failed to open edit archive modal:', error);
      this.showError('Failed to open edit dialog');
    }
  }

  /**
   * Handle edit archive item form submission
   */
  async handleEditArchiveItem() {
    try {
      const form = document.getElementById('edit-archive-item-form');
      const fileUuid = form.dataset.fileUuid;
      
      if (!fileUuid) {
        this.showError('No file selected for editing');
        return;
      }

      const file = this.getData().archive.files.find(f => f.uuid === fileUuid);
      if (!file) {
        this.showError('File not found');
        return;
      }

      // Get form data
      const title = document.getElementById('edit-archive-title').value.trim();
      const author = document.getElementById('edit-archive-author').value.trim();
      const tags = [...this.editArchiveItemTags];

      // Prepare update data
      const updateData = {
        title: title || file.name, // Fallback to filename if no title
        metadata: {
          ...file.metadata,
          author: author || undefined
        },
        tags: tags
      };

      // Handle MIME type for virtual files
      if (this.needsRelocation(file.filePath)) {
        const mimetype = document.getElementById('edit-archive-mimetype').value.trim();
        if (mimetype) {
          updateData.mimeType = mimetype;
        }
      }

      // Update file via IPC
      await window.electronAPI.archive.updateFile(fileUuid, updateData);
      
      // Reload data to reflect changes
      await this.getApp().loadArchiveData();

      this.showSuccess('File updated successfully');
      this.closeModal('edit-archive-item-modal');
      
      // Emit event for other modules
      this.emit('archiveFileUpdated', { fileUuid, updateData });
    } catch (error) {
      console.error('Failed to update archive file:', error);
      this.showError('Failed to update file');
    }
  }

  /**
   * Handle archive action (edit, upload, locate, refresh)
   */
  async handleArchiveAction(fileUuid, action) {
    try {
      const file = this.getData().archive.files.find(f => f.uuid === fileUuid);
      if (!file) {
        this.showError('File not found');
        return;
      }

      switch (action) {
        case 'edit':
          await this.openEditArchiveItemModal(fileUuid);
          break;
          
        case 'upload':
          // Delegate to upload manager
          const uploadManager = this.getApp().getUploadManager();
          if (uploadManager) {
            await uploadManager.openUploadModal(file.filePath);
          } else {
            this.showError('Upload functionality not available');
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
    } catch (error) {
      console.error('Failed to handle archive action:', error);
      this.showError('Failed to perform action');
    }
  }

  /**
   * Locate archive file in workspace
   */
  async locateArchiveFile(fileUuid) {
    try {
      const file = this.getData().archive.files.find(f => f.uuid === fileUuid);
      if (!file) {
        this.showError('File not found');
        return;
      }

      // Use IPC to locate file
      const result = await window.electronAPI.archive.locateFile(fileUuid);
      
      if (result.success) {
        this.showSuccess('File located successfully');
        // Reload data to reflect any changes
        await this.getApp().loadArchiveData();
      } else {
        this.showError(result.error || 'Failed to locate file');
      }
    } catch (error) {
      console.error('Failed to locate archive file:', error);
      this.showError('Failed to locate file');
    }
  }

  /**
   * Refresh archive file metadata
   */
  async refreshArchiveFileMetadata(fileUuid) {
    try {
      const file = this.getData().archive.files.find(f => f.uuid === fileUuid);
      if (!file) {
        this.showError('File not found');
        return;
      }

      // Use IPC to refresh metadata
      const result = await window.electronAPI.archive.refreshFileMetadata(fileUuid);
      
      if (result.success) {
        this.showSuccess('Metadata refreshed successfully');
        // Reload data to reflect changes
        await this.getApp().loadArchiveData();
      } else {
        this.showError(result.error || 'Failed to refresh metadata');
      }
    } catch (error) {
      console.error('Failed to refresh archive file metadata:', error);
      this.showError('Failed to refresh metadata');
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Get file path status
   */
  getFilePathStatus(filePath) {
    if (this.needsRelocation(filePath)) {
      return 'virtual';
    }
    return 'physical';
  }

  /**
   * Get file status indicator class
   */
  getFileStatusIndicator(filePath) {
    return this.getFilePathStatus(filePath);
  }

  /**
   * Check if file needs relocation
   */
  needsRelocation(filePath) {
    return filePath.startsWith('virtual://');
  }

  /**
   * Initialize archive collapse state
   */
  initializeArchiveCollapseState() {
    try {
      const savedState = localStorage.getItem('meridian-archive-collapse-state');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        this.archiveCollapseState.globalState = parsed.globalState || 'expanded';
        this.archiveCollapseState.collapsedItems = new Set(parsed.collapsedItems || []);
      }
    } catch (error) {
      console.warn('[ArchiveManager] Failed to load collapse state:', error);
    }
  }

  /**
   * Save archive collapse state
   */
  saveArchiveCollapseState() {
    try {
      const state = {
        globalState: this.archiveCollapseState.globalState,
        collapsedItems: Array.from(this.archiveCollapseState.collapsedItems)
      };
      localStorage.setItem('meridian-archive-collapse-state', JSON.stringify(state));
    } catch (error) {
      console.warn('[ArchiveManager] Failed to save collapse state:', error);
    }
  }

  /**
   * Setup archive event listeners
   */
  setupArchiveEventListeners() {
    // Archive search functionality
    const archiveSearch = document.getElementById('archive-search');
    if (archiveSearch) {
      archiveSearch.addEventListener('input', (e) => {
        this.currentArchiveSearchTerm = e.target.value;
        const tagManager = this.getApp().getTagManager();
        if (tagManager) {
          tagManager.applyArchiveFilters();
        }
      });
    }

    // Archive clear filters button
    const archiveClearFiltersBtn = document.getElementById('archive-clear-filters-btn');
    if (archiveClearFiltersBtn) {
      archiveClearFiltersBtn.addEventListener('click', () => {
        const tagManager = this.getApp().getTagManager();
        if (tagManager) {
          tagManager.clearAllArchiveFilters();
        }
      });
    }

    // Archive actions dropdown
    document.addEventListener('click', (e) => {
      if (e.target.matches('.archive-actions-btn')) {
        e.preventDefault();
        const fileUuid = e.target.dataset.fileUuid;
        this.toggleArchiveActionsDropdown(fileUuid);
      } else if (!e.target.closest('.archive-actions-menu')) {
        this.hideAllArchiveActionsDropdowns();
      }
    });

    // Archive actions menu items
    document.addEventListener('click', (e) => {
      if (e.target.matches('.archive-actions-item')) {
        e.preventDefault();
        const fileUuid = e.target.dataset.fileUuid;
        const action = e.target.classList.contains('edit-option') ? 'edit' :
                      e.target.classList.contains('upload-option') ? 'upload' :
                      e.target.classList.contains('locate-option') ? 'locate' :
                      e.target.classList.contains('refresh-option') ? 'refresh' : null;
        
        if (action) {
          this.handleArchiveAction(fileUuid, action);
        }
        
        this.hideAllArchiveActionsDropdowns();
      }
    });

    // Archive hash toggle
    document.addEventListener('click', (e) => {
      if (e.target.matches('.archive-hash-toggle')) {
        e.preventDefault();
        const fileUuid = e.target.dataset.fileUuid;
        this.toggleArchiveHashList(fileUuid);
      }
    });

    // Archive hash actions
    document.addEventListener('click', (e) => {
      if (e.target.matches('.copy-hash-btn')) {
        e.preventDefault();
        const hash = e.target.dataset.hash;
        this.copyToClipboard(hash, 'Hash copied to clipboard');
      } else if (e.target.matches('.copy-url-btn')) {
        e.preventDefault();
        const url = e.target.dataset.url;
        this.copyToClipboard(url, 'URL copied to clipboard');
      }
    });

    // Edit archive item form
    const editArchiveItemForm = document.getElementById('edit-archive-item-form');
    if (editArchiveItemForm) {
      editArchiveItemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleEditArchiveItem();
      });
    }
  }

  /**
   * Toggle archive actions dropdown
   */
  toggleArchiveActionsDropdown(fileUuid) {
    const dropdown = document.querySelector(`.archive-actions-menu[data-file-uuid="${fileUuid}"]`);
    if (!dropdown) return;

    // Hide all other dropdowns first
    this.hideAllArchiveActionsDropdowns();
    
    // Toggle this dropdown
    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';
  }

  /**
   * Hide all archive actions dropdowns
   */
  hideAllArchiveActionsDropdowns() {
    const dropdowns = document.querySelectorAll('.archive-actions-menu');
    dropdowns.forEach(dropdown => {
      dropdown.style.display = 'none';
    });
  }

  /**
   * Toggle archive hash list
   */
  toggleArchiveHashList(fileUuid) {
    const hashList = document.querySelector(`.archive-hash-list[data-file-uuid="${fileUuid}"]`);
    const toggleButton = document.querySelector(`.archive-hash-toggle[data-file-uuid="${fileUuid}"]`);
    
    if (!hashList || !toggleButton) return;

    const isCollapsed = hashList.classList.contains('collapsed');
    
    if (isCollapsed) {
      hashList.classList.remove('collapsed');
      toggleButton.classList.add('expanded');
    } else {
      hashList.classList.add('collapsed');
      toggleButton.classList.remove('expanded');
    }
  }

  /**
   * Initialize edit archive item tag autocompletion
   */
  initializeEditArchiveItemTagAutocompletion() {
    // Clean up existing instance
    if (this.editArchiveItemTagAutocomplete) {
      this.editArchiveItemTagAutocomplete.cleanup && this.editArchiveItemTagAutocomplete.cleanup();
    }

    // Create new autocomplete instance
    this.editArchiveItemTagAutocomplete = new TagAutocomplete({
      inputSelector: '#edit-archive-tag-input',
      autocompleteSelector: '#edit-archive-tag-autocomplete',
      getSuggestions: (value, excludeTags, limit) => {
        return this.getIntelligentArchiveTagSuggestions(value, [...excludeTags, ...this.editArchiveItemTags], limit);
      },
      onTagSelect: (tag) => {
        this.addEditArchiveItemTag(tag);
      },
      maxSuggestions: 8,
      minInputLength: 1
    });

    // Setup button state management
    const tagInput = document.getElementById('edit-archive-tag-input');
    if (tagInput) {
      tagInput.addEventListener('input', (e) => {
        this.updateEditArchiveItemAddTagButtonState(e.target);
      });
    }
  }

  /**
   * Add tag to edit archive item
   */
  addEditArchiveItemTag(tagValue) {
    if (!tagValue || this.editArchiveItemTags.includes(tagValue)) {
      return;
    }

    this.editArchiveItemTags.push(tagValue);
    
    // Clear input
    const input = document.getElementById('edit-archive-tag-input');
    if (input) {
      input.value = '';
      this.updateEditArchiveItemAddTagButtonState(input);
    }
    
    // Re-render tags
    this.renderEditArchiveItemTags();
  }

  /**
   * Remove tag from edit archive item
   */
  removeEditArchiveItemTag(tagValue) {
    this.editArchiveItemTags = this.editArchiveItemTags.filter(tag => tag !== tagValue);
    this.renderEditArchiveItemTags();
    
    // Update button state
    const input = document.getElementById('edit-archive-tag-input');
    if (input) {
      this.updateEditArchiveItemAddTagButtonState(input);
    }
  }

  /**
   * Update edit archive item add tag button state
   */
  updateEditArchiveItemAddTagButtonState(input) {
    const btn = document.getElementById('edit-archive-add-tag-btn');
    const value = input.value.trim();
    
    if (btn) {
      btn.disabled = value.length === 0 || this.editArchiveItemTags.includes(value);
    }
  }

  /**
   * Render edit archive item tags
   */
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

  /**
   * Open modal - delegate to ModalManager
   */
  openModal(modalId) {
    const modalManager = this.getApp().getModalManager();
    if (modalManager) {
      modalManager.openModal(modalId);
    } else {
      console.error('[ArchiveManager] ModalManager not available');
    }
  }

  /**
   * Close modal - delegate to ModalManager
   */
  closeModal(modalId) {
    const modalManager = this.getApp().getModalManager();
    if (modalManager) {
      modalManager.closeModal(modalId);
    } else {
      console.error('[ArchiveManager] ModalManager not available');
    }
  }

  /**
   * Format file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Format UTC timestamp
   */
  formatUTCTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (error) {
      return 'Invalid date';
    }
  }

  /**
   * Truncate hash for display
   */
  truncateHash(hash) {
    if (!hash) return '';
    return hash.length > 12 ? hash.substring(0, 6) + '...' + hash.substring(hash.length - 6) : hash;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
} 