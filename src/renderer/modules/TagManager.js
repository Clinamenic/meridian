import { ModuleBase } from './ModuleBase.js';
import { TagAutocomplete } from '../components/TagAutocomplete.js';

/**
 * TagManager module - handles all tag-related operations across Meridian
 * Manages: Resource tags, Archive tags, Bulk tags, Tag filtering, Tag autocomplete
 */
export class TagManager extends ModuleBase {
  constructor(app) {
    super(app);
    
    // Tag autocomplete instances
    this.resourceTagAutocompletes = [];
    this.archiveTagAutocompletes = [];
    this.editArchiveItemTagAutocomplete = null;
    this.bulkTagAutocomplete = null;
    
    // Tag state management
    this.activeTagFilters = new Set();
    this.activeArchiveTagFilters = new Set();
    this.currentSearchTerm = '';
    this.currentArchiveSearchTerm = '';
    this.filterLogic = 'any'; // Default to 'any' (OR logic)
    this.archiveFilterLogic = 'any';
    
    // Bulk tag state
    this.bulkTags = [];
    this.editArchiveItemTags = [];
  }

  async onInit() {
    console.log('[TagManager] Initializing...');
    
    // Set up event listeners for tag-related functionality
    this.setupTagEventListeners();
    
    // Initialize tag autocomplete systems
    this.initializeTagAutocompleteSystems();
    
    console.log('[TagManager] Initialized successfully');
  }

  async onCleanup() {
    console.log('[TagManager] Cleaning up...');
    
    // Clean up autocomplete instances
    this.cleanupAutocompleteInstances();
    
    console.log('[TagManager] Cleaned up successfully');
  }

  // ===== RESOURCE TAG MANAGEMENT =====

  /**
   * Get all existing tags from collate resources
   */
  getAllExistingTags() {
    if (!this.getData().collate || !this.getData().collate.resources) {
      return [];
    }

    const allTags = new Set();
    this.getData().collate.resources.forEach(resource => {
      resource.tags.forEach(tag => allTags.add(tag));
    });

    return Array.from(allTags).sort();
  }

  /**
   * Get intelligently ranked tag suggestions for resources
   */
  getIntelligentTagSuggestions(input, excludeTags = [], limit = 5) {
    if (!this.getData().collate || !this.getData().collate.resources) {
      return [];
    }

    const inputLower = input.trim().toLowerCase();
    if (inputLower.length === 0) {
      return [];
    }

    // Calculate tag frequency and usage stats
    const tagStats = new Map();
    this.getData().collate.resources.forEach(resource => {
      resource.tags.forEach(tag => {
        if (!tagStats.has(tag)) {
          tagStats.set(tag, {
            name: tag,
            frequency: 0,
            resourceCount: 0,
            lastUsed: new Date(0)
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

  /**
   * Add tag to a resource
   */
  async addTagToResource(resourceId, tagValue) {
    try {
      // Add tag via IPC
      await window.electronAPI.collate.addTagToResource(resourceId, tagValue);
      
      // Reload data to reflect changes
      await this.getApp().loadCollateData();
      
      // Clear input and update button state
      const input = document.querySelector(`input[data-resource-id="${resourceId}"]`);
      if (input) {
        input.value = '';
        this.updateAddTagButtonState(input);
      }
      
      // Hide autocomplete using unified system
      const autocompleteInstance = this.resourceTagAutocompletes?.find(instance => 
        instance.inputSelector.includes(`data-resource-id="${resourceId}"`)
      );
      if (autocompleteInstance) {
        autocompleteInstance.hide();
      }

      this.showSuccess('Tag added successfully');
      
      // Emit event for other modules
      this.emit('tagAdded', { resourceId, tagValue, type: 'resource' });
    } catch (error) {
      console.error('Failed to add tag:', error);
      this.showError('Failed to add tag');
    }
  }

  /**
   * Remove tag from a resource
   */
  async removeTagFromResource(resourceId, tag) {
    try {
      // Find the resource
      const resource = this.getData().collate.resources.find(r => r.id === resourceId);
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
      await this.getApp().loadCollateData();

      this.showSuccess('Tag removed successfully');
      
      // Emit event for other modules
      this.emit('tagRemoved', { resourceId, tag, type: 'resource' });
    } catch (error) {
      console.error('Failed to remove tag:', error);
      this.showError('Failed to remove tag');
    }
  }

  /**
   * Update add tag button state
   */
  updateAddTagButtonState(input) {
    const resourceId = input.dataset.resourceId;
    const button = document.querySelector(`button[data-resource-id="${resourceId}"].add-tag-btn`);
    const hasText = input.value.trim().length > 0;
    
    if (button) {
      button.disabled = !hasText;
    }
  }

  // ===== ARCHIVE TAG MANAGEMENT =====

  /**
   * Get all existing tags from archive files
   */
  getAllExistingArchiveTags() {
    if (!this.getData().archive || !this.getData().archive.files) {
      return [];
    }

    const allTags = new Set();
    this.getData().archive.files.forEach(file => {
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
    if (!this.getData().archive || !this.getData().archive.files) {
      return [];
    }

    const inputLower = input.trim().toLowerCase();
    if (inputLower.length === 0) {
      return [];
    }

    // Calculate tag frequency and usage stats for archive files
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

  /**
   * Add tag to an archive file
   */
  async addTagToArchiveFile(fileUuid, tagValue) {
    try {
      // Find the file
      const file = this.getData().archive.files.find(f => f.uuid === fileUuid);
      if (!file) {
        this.showError('File not found');
        return;
      }

      // Check if tag already exists on this file
      if (file.tags && file.tags.includes(tagValue)) {
        this.showError('Tag already exists on this file');
        return;
      }

      // Add tag to the file
      if (!file.tags) {
        file.tags = [];
      }
      file.tags.push(tagValue);

      // Save the updated archive data
      await window.electronAPI.archive.saveData(this.getData().archive);
      
      // Reload archive data to reflect changes
      await this.getApp().loadArchiveData();
      
      // Clear the input and reset button state
      const input = document.querySelector(`input[data-file-uuid="${fileUuid}"].archive-tag-input`);
      if (input) {
        input.value = '';
        this.updateArchiveAddTagButtonState(input);
      }
      
      // Hide autocomplete using unified system
      const autocompleteInstance = this.archiveTagAutocompletes?.find(instance => 
        instance.inputSelector.includes(`data-file-uuid="${fileUuid}"`)
      );
      if (autocompleteInstance) {
        autocompleteInstance.hide();
      }

      this.showSuccess('Tag added successfully');
      
      // Emit event for other modules
      this.emit('tagAdded', { fileUuid, tagValue, type: 'archive' });
    } catch (error) {
      console.error('Failed to add tag to archive file:', error);
      this.showError('Failed to add tag');
    }
  }

  /**
   * Remove tag from an archive file
   */
  async removeTagFromArchiveFile(fileUuid, tag) {
    try {
      // Find the file
      const file = this.getData().archive.files.find(f => f.uuid === fileUuid);
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
      await window.electronAPI.archive.saveData(this.getData().archive);
      
      // Reload archive data to reflect changes
      await this.getApp().loadArchiveData();

      this.showSuccess('Tag removed successfully');
      
      // Emit event for other modules
      this.emit('tagRemoved', { fileUuid, tag, type: 'archive' });
    } catch (error) {
      console.error('Failed to remove tag from archive file:', error);
      this.showError('Failed to remove tag');
    }
  }

  /**
   * Update archive add tag button state
   */
  updateArchiveAddTagButtonState(input) {
    const fileUuid = input.dataset.fileUuid;
    const button = document.querySelector(`button[data-file-uuid="${fileUuid}"].archive-add-tag-btn`);
    const hasText = input.value.trim().length > 0;
    
    if (button) {
      button.disabled = !hasText;
    }
  }

  // ===== BULK TAG MANAGEMENT =====

  /**
   * Add bulk tag
   */
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
    
    // Hide autocomplete using unified system
    if (this.bulkTagAutocomplete) {
      this.bulkTagAutocomplete.hide();
    }
    
    // Emit event for other modules
    this.emit('bulkTagAdded', { tagValue });
  }

  /**
   * Remove bulk tag
   */
  removeBulkTag(tagValue) {
    this.bulkTags = this.bulkTags.filter(tag => tag !== tagValue);
    this.renderBulkTags();
    
    // Emit event for other modules
    this.emit('bulkTagRemoved', { tagValue });
  }

  /**
   * Render bulk tags
   */
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
        <button class="remove-tag-btn" onclick="app.tagManager.removeBulkTag('${this.escapeHtml(tag)}')" title="Remove tag">
          ×
        </button>
      </span>
    `).join('');
  }

  /**
   * Update bulk add tag button state
   */
  updateBulkAddTagButtonState(input) {
    const btn = document.getElementById('bulk-add-tag-btn');
    if (!btn) return;
    
    const hasValue = input.value.trim().length > 0;
    btn.disabled = !hasValue;
  }

  // ===== EDIT ARCHIVE ITEM TAG MANAGEMENT =====

  /**
   * Add tag to edit archive item
   */
  addEditArchiveItemTag(tagValue) {
    if (!tagValue || this.editArchiveItemTags.includes(tagValue)) {
      return;
    }

    this.editArchiveItemTags.push(tagValue);
    this.renderEditArchiveItemTags();
    
    // Clear input and update button state
    const input = document.getElementById('edit-archive-tag-input');
    if (input) {
      input.value = '';
      this.updateEditArchiveItemAddTagButtonState(input);
      // Hide autocomplete using unified system
      if (this.editArchiveItemTagAutocomplete) {
        this.editArchiveItemTagAutocomplete.hide();
      }
    }
  }

  /**
   * Remove tag from edit archive item
   */
  removeEditArchiveItemTag(tagValue) {
    if (!this.editArchiveItemTags) return;
    
    this.editArchiveItemTags = this.editArchiveItemTags.filter(tag => tag !== tagValue);
    this.renderEditArchiveItemTags();
  }

  /**
   * Update edit archive item add tag button state
   */
  updateEditArchiveItemAddTagButtonState(input) {
    const btn = document.getElementById('edit-archive-add-tag-btn');
    if (!btn) return;
    
    const hasValue = input.value.trim().length > 0;
    btn.disabled = !hasValue;
  }

  /**
   * Render edit archive item tags
   */
  renderEditArchiveItemTags() {
    const container = document.getElementById('edit-archive-tags-list');
    if (!container) return;

    if (!this.editArchiveItemTags || this.editArchiveItemTags.length === 0) {
      container.innerHTML = '<div class="no-tags">No tags added yet</div>';
      return;
    }

    container.innerHTML = this.editArchiveItemTags.map(tag => `
      <span class="resource-tag">
        ${this.escapeHtml(tag)}
        <button class="remove-tag-btn" onclick="app.tagManager.removeEditArchiveItemTag('${this.escapeHtml(tag)}')" title="Remove tag">
          ×
        </button>
      </span>
    `).join('');
  }

  // ===== TAG FILTERING =====

  /**
   * Toggle tag filter
   */
  toggleTagFilter(tag) {
    if (this.activeTagFilters.has(tag)) {
      this.activeTagFilters.delete(tag);
    } else {
      this.activeTagFilters.add(tag);
    }
    
    this.applyAllFilters();
    this.updateClearFiltersButton();
  }

  /**
   * Apply all filters
   */
  applyAllFilters() {
    const resources = this.getData().collate?.resources || [];
    const resourceItems = document.querySelectorAll('.resource-item');
    
    resourceItems.forEach(item => {
      const resourceId = item.dataset.resourceId;
      const resource = resources.find(r => r.id === resourceId);
      
      if (!resource) {
        item.style.display = 'none';
        return;
      }
      
      let matchesSearch = true;
      let matchesTags = true;
      
      // Apply search filter
      if (this.currentSearchTerm.trim()) {
        const term = this.currentSearchTerm.toLowerCase();
        const title = resource.title.toLowerCase();
        const description = (resource.description || '').toLowerCase();
        const url = resource.url.toLowerCase();
        
        matchesSearch = title.includes(term) || description.includes(term) || url.includes(term);
      }
      
      // Apply tag filters
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
      
      // Show/hide based on filters
      item.style.display = (matchesSearch && matchesTags) ? 'block' : 'none';
    });
    
    this.updateResourceCount();
  }

  /**
   * Clear all filters
   */
  clearAllFilters() {
    this.activeTagFilters.clear();
    this.currentSearchTerm = '';
    
    // Clear search input
    const searchInput = document.getElementById('resource-search');
    if (searchInput) {
      searchInput.value = '';
    }
    
    // Update filter buttons
    document.querySelectorAll('.tag-filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Show all resources
    document.querySelectorAll('.resource-item').forEach(item => {
      item.style.display = 'block';
    });
    
    this.updateResourceCount();
    this.updateClearFiltersButton();
  }

  /**
   * Update clear filters button
   */
  updateClearFiltersButton() {
    const clearBtn = document.getElementById('clear-filters-btn');
    if (!clearBtn) return;
    
    const hasActiveFilters = this.activeTagFilters.size > 0 || this.currentSearchTerm.trim().length > 0;
    clearBtn.disabled = !hasActiveFilters;
  }

  /**
   * Update resource count
   */
  updateResourceCount() {
    const visibleCount = document.querySelectorAll('.resource-item[style*="block"], .resource-item:not([style*="none"])').length;
    const totalCount = this.getData().collate?.resources?.length || 0;
    
    const countElement = document.getElementById('resource-count');
    if (countElement) {
      countElement.textContent = `${visibleCount} of ${totalCount} resources`;
    }
  }

  // ===== ARCHIVE TAG FILTERING =====

  /**
   * Toggle archive tag filter
   */
  toggleArchiveTagFilter(tag) {
    if (this.activeArchiveTagFilters.has(tag)) {
      this.activeArchiveTagFilters.delete(tag);
    } else {
      this.activeArchiveTagFilters.add(tag);
    }
    
    this.applyArchiveFilters();
    this.updateArchiveClearFiltersButton();
  }

  /**
   * Apply archive filters
   */
  applyArchiveFilters() {
    const files = this.getData().archive?.files || [];
    const fileItems = document.querySelectorAll('.archive-file-item');
    
    fileItems.forEach(item => {
      const fileUuid = item.dataset.fileUuid;
      const file = files.find(f => f.uuid === fileUuid);
      
      if (!file) {
        item.style.display = 'none';
        return;
      }
      
      let matchesSearch = true;
      let matchesTags = true;
      
      // Apply search filter
      if (this.currentArchiveSearchTerm.trim()) {
        const term = this.currentArchiveSearchTerm.toLowerCase();
        const name = file.name.toLowerCase();
        const path = file.path.toLowerCase();
        
        matchesSearch = name.includes(term) || path.includes(term);
      }
      
      // Apply tag filters
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
      
      // Show/hide based on filters
      item.style.display = (matchesSearch && matchesTags) ? 'block' : 'none';
    });
    
    this.updateArchiveCount();
  }

  /**
   * Clear all archive filters
   */
  clearAllArchiveFilters() {
    this.activeArchiveTagFilters.clear();
    this.currentArchiveSearchTerm = '';
    
    // Clear search input
    const searchInput = document.getElementById('archive-search');
    if (searchInput) {
      searchInput.value = '';
    }
    
    // Update filter buttons
    document.querySelectorAll('.archive-tag-filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Show all files
    document.querySelectorAll('.archive-file-item').forEach(item => {
      item.style.display = 'block';
    });
    
    this.updateArchiveCount();
    this.updateArchiveClearFiltersButton();
  }

  /**
   * Update archive clear filters button
   */
  updateArchiveClearFiltersButton() {
    const clearBtn = document.getElementById('archive-clear-filters-btn');
    if (!clearBtn) return;
    
    const hasActiveFilters = this.activeArchiveTagFilters.size > 0 || this.currentArchiveSearchTerm.trim().length > 0;
    clearBtn.disabled = !hasActiveFilters;
  }

  /**
   * Update archive count
   */
  updateArchiveCount() {
    const visibleCount = document.querySelectorAll('.archive-file-item[style*="block"], .archive-file-item:not([style*="none"])').length;
    const totalCount = this.getData().archive?.files?.length || 0;
    
    const countElement = document.getElementById('archive-count');
    if (countElement) {
      countElement.textContent = `${visibleCount} of ${totalCount} files`;
    }
  }

  // ===== TAG AUTОCOMPLETE INITIALIZATION =====

  /**
   * Initialize all tag autocomplete systems
   */
  initializeTagAutocompleteSystems() {
    this.initializeResourceTagAutocompletion();
    this.initializeArchiveTagAutocompletion();
    this.initializeBulkTagAutocompletion();
    this.initializeEditArchiveItemTagAutocompletion();
  }

  /**
   * Initialize resource tag autocompletion
   */
  initializeResourceTagAutocompletion() {
    // Clean up any existing resource tag autocomplete instances
    if (this.resourceTagAutocompletes) {
      this.resourceTagAutocompletes.forEach(instance => instance.cleanup && instance.cleanup());
    }
    this.resourceTagAutocompletes = [];

    // Set up autocomplete for each resource tag input
    const resourceTagInputs = document.querySelectorAll('input[data-resource-id].tag-input');
    resourceTagInputs.forEach(input => {
      const resourceId = input.dataset.resourceId;
      
      const autocomplete = new TagAutocomplete({
        inputSelector: `input[data-resource-id="${resourceId}"].tag-input`,
        autocompleteSelector: `#tag-autocomplete-${resourceId}`,
        getSuggestions: (inputValue) => {
          // Get current resource's existing tags to exclude from suggestions
          const resource = this.getData().collate?.resources?.find(r => r.id === resourceId);
          const excludeTags = resource?.tags || [];
          return this.getIntelligentTagSuggestions(inputValue, excludeTags, 5);
        },
        onTagSelect: (tagValue) => {
          this.addTagToResource(resourceId, tagValue);
        },
        onInputChange: (input) => {
          this.updateAddTagButtonState(input);
        }
      });

      this.resourceTagAutocompletes.push(autocomplete);
    });
  }

  /**
   * Initialize archive tag autocompletion
   */
  initializeArchiveTagAutocompletion() {
    // Clean up any existing archive tag autocomplete instances
    if (this.archiveTagAutocompletes) {
      this.archiveTagAutocompletes.forEach(instance => instance.cleanup && instance.cleanup());
    }
    this.archiveTagAutocompletes = [];

    // Set up autocomplete for each archive tag input
    const archiveTagInputs = document.querySelectorAll('.archive-tag-input');
    archiveTagInputs.forEach(input => {
      const fileUuid = input.dataset.fileUuid;
      
      const autocomplete = new TagAutocomplete({
        inputSelector: `input[data-file-uuid="${fileUuid}"].archive-tag-input`,
        autocompleteSelector: `#archive-autocomplete-${fileUuid}`,
        getSuggestions: (inputValue) => {
          // Get current file's existing tags to exclude from suggestions
          const file = this.getData().archive?.files?.find(f => f.uuid === fileUuid);
          const excludeTags = file?.tags || [];
          return this.getIntelligentArchiveTagSuggestions(inputValue, excludeTags, 5);
        },
        onTagSelect: (tagValue) => {
          this.addTagToArchiveFile(fileUuid, tagValue);
        },
        onInputChange: (input) => {
          this.updateArchiveAddTagButtonState(input);
        }
      });

      this.archiveTagAutocompletes.push(autocomplete);
    });
  }

  /**
   * Initialize bulk tag autocompletion
   */
  initializeBulkTagAutocompletion() {
    // Clean up existing bulk tag autocomplete
    if (this.bulkTagAutocomplete) {
      this.bulkTagAutocomplete.cleanup && this.bulkTagAutocomplete.cleanup();
    }

    const bulkTagInput = document.getElementById('bulk-tag-input');
    if (!bulkTagInput) return;

    this.bulkTagAutocomplete = new TagAutocomplete({
      inputSelector: '#bulk-tag-input',
      autocompleteSelector: '#bulk-tag-autocomplete',
      getSuggestions: (inputValue) => {
        return this.getIntelligentTagSuggestions(inputValue, this.bulkTags, 8);
      },
      onTagSelect: (tagValue) => {
        this.addBulkTag(tagValue);
      },
      onInputChange: (input) => {
        this.updateBulkAddTagButtonState(input);
      }
    });
  }

  /**
   * Initialize edit archive item tag autocompletion
   */
  initializeEditArchiveItemTagAutocompletion() {
    // Clean up existing edit archive item tag autocomplete
    if (this.editArchiveItemTagAutocomplete) {
      this.editArchiveItemTagAutocomplete.cleanup && this.editArchiveItemTagAutocomplete.cleanup();
    }

    const editArchiveTagInput = document.getElementById('edit-archive-tag-input');
    if (!editArchiveTagInput) return;

    this.editArchiveItemTagAutocomplete = new TagAutocomplete({
      inputSelector: '#edit-archive-tag-input',
      autocompleteSelector: '#edit-archive-tag-autocomplete',
      getSuggestions: (inputValue) => {
        return this.getIntelligentArchiveTagSuggestions(inputValue, this.editArchiveItemTags, 5);
      },
      onTagSelect: (tagValue) => {
        this.addEditArchiveItemTag(tagValue);
      },
      onInputChange: (input) => {
        this.updateEditArchiveItemAddTagButtonState(input);
      }
    });
  }

  // ===== TAG MANAGEMENT MODALS =====

  /**
   * Open edit tag modal
   */
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

  /**
   * Handle tag rename
   */
  async handleRenameTag(oldTag, newTag) {
    try {
      // Validate new tag name
      if (!newTag.trim()) {
        this.showError('Tag name cannot be empty');
        return;
      }

      if (newTag.trim() === oldTag) {
        this.showError('New tag name must be different');
        return;
      }

      // Rename tag via IPC
      await window.electronAPI.collate.renameTag(oldTag, newTag);
      
      // Reload data to reflect changes
      await this.getApp().loadCollateData();

      this.showSuccess(`Tag "${oldTag}" renamed to "${newTag}"`);
      
      // Emit event for other modules
      this.emit('tagRenamed', { oldTag, newTag });
    } catch (error) {
      console.error('Failed to rename tag:', error);
      this.showError('Failed to rename tag');
    }
  }

  /**
   * Confirm delete tag
   */
  confirmDeleteTag(tag) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Delete Tag</h3>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-content">
          <p>Are you sure you want to delete the tag "<strong>${this.escapeHtml(tag)}</strong>"?</p>
          <p class="warning">This will remove the tag from all resources that use it.</p>
          <div class="form-actions">
            <button class="secondary-btn cancel-btn">Cancel</button>
            <button class="danger-btn delete-btn">Delete Tag</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);
    
    const closeModal = () => {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 200);
    };
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.cancel-btn').addEventListener('click', closeModal);
    modal.querySelector('.delete-btn').addEventListener('click', () => {
      this.handleDeleteTag(tag);
      closeModal();
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  /**
   * Handle tag deletion
   */
  async handleDeleteTag(tag) {
    try {
      // Delete tag via IPC
      await window.electronAPI.collate.deleteTag(tag);
      
      // Reload data to reflect changes
      await this.getApp().loadCollateData();

      this.showSuccess(`Tag "${tag}" deleted successfully`);
      
      // Emit event for other modules
      this.emit('tagDeleted', { tag });
    } catch (error) {
      console.error('Failed to delete tag:', error);
      this.showError('Failed to delete tag');
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Clean up autocomplete instances
   */
  cleanupAutocompleteInstances() {
    // Clean up resource tag autocompletes
    if (this.resourceTagAutocompletes) {
      this.resourceTagAutocompletes.forEach(instance => {
        if (instance.cleanup) instance.cleanup();
      });
      this.resourceTagAutocompletes = [];
    }

    // Clean up archive tag autocompletes
    if (this.archiveTagAutocompletes) {
      this.archiveTagAutocompletes.forEach(instance => {
        if (instance.cleanup) instance.cleanup();
      });
      this.archiveTagAutocompletes = [];
    }

    // Clean up other autocomplete instances
    if (this.editArchiveItemTagAutocomplete) {
      this.editArchiveItemTagAutocomplete.cleanup && this.editArchiveItemTagAutocomplete.cleanup();
      this.editArchiveItemTagAutocomplete = null;
    }

    if (this.bulkTagAutocomplete) {
      this.bulkTagAutocomplete.cleanup && this.bulkTagAutocomplete.cleanup();
      this.bulkTagAutocomplete = null;
    }
  }

  /**
   * Set up tag event listeners
   */
  setupTagEventListeners() {
    // This method will be called during initialization
    // to set up any necessary event listeners for tag functionality
    console.log('[TagManager] Setting up tag event listeners...');
  }

  /**
   * Get tag statistics
   */
  getTagStatistics() {
    const resourceTags = this.getAllExistingTags();
    const archiveTags = this.getAllExistingArchiveTags();
    
    return {
      resourceTags: {
        total: resourceTags.length,
        tags: resourceTags
      },
      archiveTags: {
        total: archiveTags.length,
        tags: archiveTags
      },
      activeFilters: {
        resource: Array.from(this.activeTagFilters),
        archive: Array.from(this.activeArchiveTagFilters)
      }
    };
  }
} 