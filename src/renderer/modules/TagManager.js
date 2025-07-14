import { ModuleBase } from './ModuleBase.js';
import { TagAutocomplete } from '../components/TagAutocomplete.js';

/**
 * TagManager module - handles all tag-related operations across Meridian
 * Manages: Resource tags, Resource tags, Bulk tags, Tag filtering, Tag autocomplete
 */
export class TagManager extends ModuleBase {
  constructor(app) {
    super(app);
    
    // Tag autocomplete instances
    this.resourceTagAutocompletes = [];
    this.editResourceItemTagAutocomplete = null;
    
    // Tag filtering state
    this.activeResourceTagFilters = new Set();
    this.currentResourceSearchTerm = '';
    this.resourceFilterLogic = 'any';
    
    // Edit modal state
    this.editResourceItemTags = [];
    
    // Event listeners
    this.boundEventListeners = new Map();
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
   * Get all existing tags from resource files
   */
  getAllExistingResourceTags() {
    if (!this.getData().archive || !this.getData().archive.files) {
      return [];
    }

    const tagSet = new Set();
    this.getData().archive.files.forEach(file => {
      if (file.tags) {
        file.tags.forEach(tag => tagSet.add(tag));
      }
    });

    return Array.from(tagSet).sort();
  }

  /**
   * Get intelligently ranked resource tag suggestions
   */
  getIntelligentResourceTagSuggestions(input, excludeTags = [], limit = 5) {
    if (!this.getData().archive || !this.getData().archive.files) {
      return [];
    }

    const inputLower = input.toLowerCase();
    const suggestions = new Map(); // tag -> score

    // Calculate tag frequency and usage stats for resource files
    const tagStats = {};
    this.getData().archive.files.forEach(file => {
      if (file.tags) {
        file.tags.forEach(tag => {
          if (!tagStats[tag]) {
            tagStats[tag] = { count: 0, files: new Set() };
          }
          tagStats[tag].count++;
          tagStats[tag].files.add(file.uuid);
        });
      }
    });

    // Score each tag based on multiple factors
    Object.entries(tagStats).forEach(([tag, stats]) => {
      if (excludeTags.includes(tag)) return;

      let score = 0;

      // 1. Exact prefix match (highest priority)
      if (tag.toLowerCase().startsWith(inputLower)) {
        score += 1000;
        // Bonus for exact case match
        if (tag.startsWith(input)) {
          score += 500;
        }
      }
      // 2. Contains input anywhere
      else if (tag.toLowerCase().includes(inputLower)) {
        score += 100;
      }
      // 3. Fuzzy match (words starting with input)
      else {
        const words = tag.toLowerCase().split(/[-_\s]+/);
        const hasMatchingWord = words.some(word => word.startsWith(inputLower));
        if (hasMatchingWord) {
          score += 50;
        }
      }

      // 4. Frequency bonus (more used tags get higher scores)
      score += Math.min(stats.count * 10, 100);

      // 5. Recency bonus (tags from recently modified files)
      const recentFiles = this.getData().archive.files
        .filter(f => f.modified && new Date(f.modified) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .map(f => f.uuid);
      
      const recentUsage = Array.from(stats.files).filter(uuid => recentFiles.includes(uuid)).length;
      score += recentUsage * 5;

      if (score > 0) {
        suggestions.set(tag, score);
      }
    });

    // Sort by score and return top results
    const sortedSuggestions = Array.from(suggestions.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([tag]) => tag);

    console.log(`[ResourceTagSuggestion] Top ${sortedSuggestions.length} suggestions for "${input}":`,
      sortedSuggestions.map(tag => `${tag} (${suggestions.get(tag)})`));

    return sortedSuggestions;
  }

  /**
   * Add tag to a resource file
   */
  async addTagToResourceFile(fileUuid, tagValue) {
    try {
      // Find the file
      const file = this.getData().archive.files.find(f => f.uuid === fileUuid);
      if (!file) {
        throw new Error('File not found');
      }

      // Normalize tag value
      tagValue = tagValue.trim().toLowerCase();
      if (!tagValue) {
        throw new Error('Tag cannot be empty');
      }

      // Initialize tags array if it doesn't exist
      if (!file.tags) {
        file.tags = [];
      }

      // Check if tag already exists
      if (file.tags.includes(tagValue)) {
        throw new Error('Tag already exists');
      }

      // Add the tag
      file.tags.push(tagValue);
      file.tags.sort(); // Keep tags sorted

      // Save the updated resource data
      await window.electronAPI.archive.saveData(this.getData().archive);
      
      // Reload resource data to reflect changes
      await this.getApp().loadArchiveData();

      // Update the UI
      this.updateResourceTagDisplay(fileUuid);
      this.updateResourceTagFilterList();

      // Emit event
      this.emit('tagAdded', { fileUuid, tagValue, type: 'resource' });

      console.log(`[TagManager] Added tag "${tagValue}" to resource file ${fileUuid}`);
    } catch (error) {
      console.error('Failed to add tag to resource file:', error);
      throw error;
    }
  }

  /**
   * Remove tag from a resource file
   */
  async removeTagFromResourceFile(fileUuid, tag) {
    try {
      // Find the file
      const file = this.getData().archive.files.find(f => f.uuid === fileUuid);
      if (!file) {
        throw new Error('File not found');
      }

      // Remove the tag
      if (file.tags) {
        file.tags = file.tags.filter(t => t !== tag);
      }

      // Save the updated resource data
      await window.electronAPI.archive.saveData(this.getData().archive);
      
      // Reload resource data to reflect changes
      await this.getApp().loadArchiveData();

      // Update the UI
      this.updateResourceTagDisplay(fileUuid);
      this.updateResourceTagFilterList();

      // Emit event
      this.emit('tagRemoved', { fileUuid, tag, type: 'resource' });

      console.log(`[TagManager] Removed tag "${tag}" from resource file ${fileUuid}`);
    } catch (error) {
      console.error('Failed to remove tag from resource file:', error);
      throw error;
    }
  }

  // ===== EDIT RESOURCE ITEM TAG MANAGEMENT =====

  /**
   * Add tag to edit resource item
   */
  addEditResourceItemTag(tagValue) {
    if (!tagValue || this.editResourceItemTags.includes(tagValue)) {
      return;
    }

    this.editResourceItemTags.push(tagValue);
    this.renderEditResourceItemTags();

    // Clear input and update button state
    const input = document.getElementById('edit-resource-tag-input');
    if (input) {
      input.value = '';
      this.updateEditResourceItemAddTagButtonState(input);
    }

    if (this.editResourceItemTagAutocomplete) {
      this.editResourceItemTagAutocomplete.hide();
    }
  }

  /**
   * Remove tag from edit resource item
   */
  removeEditResourceItemTag(tagValue) {
    if (!this.editResourceItemTags) return;

    this.editResourceItemTags = this.editResourceItemTags.filter(tag => tag !== tagValue);
    this.renderEditResourceItemTags();
  }

  /**
   * Update edit resource item add tag button state
   */
  updateEditResourceItemAddTagButtonState(input) {
    const btn = document.getElementById('edit-resource-add-tag-btn');
    if (!btn || !input) return;

    const value = input.value.trim();
    btn.disabled = !value || this.editResourceItemTags.includes(value);
  }

  /**
   * Render edit resource item tags
   */
  renderEditResourceItemTags() {
    const container = document.getElementById('edit-resource-tags-list');
    if (!container) return;

    if (!this.editResourceItemTags || this.editResourceItemTags.length === 0) {
      container.innerHTML = '<div class="no-tags">No tags added</div>';
      return;
    }

    container.innerHTML = this.editResourceItemTags.map(tag => `
      <span class="modal-tag">
        ${this.escapeHtml(tag)}
        <button class="remove-tag-btn" onclick="app.tagManager.removeEditResourceItemTag('${this.escapeHtml(tag)}')" title="Remove tag">
          ×
        </button>
      </span>
    `).join('');
  }

  // ===== RESOURCE TAG FILTERING =====

  /**
   * Toggle resource tag filter
   */
  toggleResourceTagFilter(tag) {
    if (this.activeResourceTagFilters.has(tag)) {
      this.activeResourceTagFilters.delete(tag);
    } else {
      this.activeResourceTagFilters.add(tag);
    }

    this.updateResourceTagFilterButtons();
    this.applyResourceFilters();
  }

  /**
   * Apply resource filters
   */
  applyResourceFilters() {
    const files = this.getData().archive?.files || [];
    
    files.forEach(file => {
      const item = document.querySelector(`.resource-item[data-uuid="${file.uuid}"]`);
      if (!item) return;

      let shouldShow = true;

      // Apply search filter
      if (this.currentResourceSearchTerm) {
        const searchTerm = this.currentResourceSearchTerm.toLowerCase();
        const title = (file.title || '').toLowerCase();
        const filePath = (file.filePath || '').toLowerCase();
        const author = (file.metadata?.author || '').toLowerCase();
        
        shouldShow = title.includes(searchTerm) || 
                    filePath.includes(searchTerm) || 
                    author.includes(searchTerm);
      }

      // Apply tag filters
      if (shouldShow && this.activeResourceTagFilters.size > 0) {
        const fileTags = new Set(file.tags || []);
        
        if (this.resourceFilterLogic === 'all') {
          // Show if ALL of the active filters match
          shouldShow = Array.from(this.activeResourceTagFilters).every(tag => fileTags.has(tag));
        } else {
          // Show if ANY of the active filters match
          shouldShow = Array.from(this.activeResourceTagFilters).some(tag => fileTags.has(tag));
        }
      }

      item.style.display = shouldShow ? 'block' : 'none';
    });

    this.updateResourceCount();
  }

  /**
   * Update resource count display
   */
  updateResourceCount() {
    const totalCount = this.getData().archive?.files?.length || 0;
    const visibleCount = document.querySelectorAll('.resource-item[style*="display: block"], .resource-item:not([style*="display: none"])').length;
    
    const countElement = document.getElementById('resource-count-text');
    if (countElement) {
      countElement.textContent = `${visibleCount} of ${totalCount} Resources Listed`;
    }
  }

  /**
   * Initialize edit resource item tag autocompletion
   */
  initializeEditResourceItemTagAutocompletion() {
    // Clean up existing edit resource item tag autocomplete
    if (this.editResourceItemTagAutocomplete) {
      this.editResourceItemTagAutocomplete.cleanup && this.editResourceItemTagAutocomplete.cleanup();
    }

    const editResourceTagInput = document.getElementById('edit-resource-tag-input');
    if (!editResourceTagInput) return;

    this.editResourceItemTagAutocomplete = new TagAutocomplete({
      inputSelector: '#edit-resource-tag-input',
      autocompleteSelector: '#edit-resource-tag-autocomplete',
      getSuggestions: (inputValue) => {
        return this.getIntelligentResourceTagSuggestions(inputValue, this.editResourceItemTags, 5);
      },
      onSelect: (tagValue) => {
        this.addEditResourceItemTag(tagValue);
      },
      onInputChange: (input) => {
        this.updateEditResourceItemAddTagButtonState(input);
      }
    });
  }

  // ===== TAG AUTОCOMPLETE INITIALIZATION =====

  /**
   * Initialize all tag autocomplete systems
   */
  initializeTagAutocompleteSystems() {
    this.initializeResourceTagAutocompletion();
    this.initializeEditResourceItemTagAutocompletion();
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
          const unifiedManager = this.app.getResourceManager();
          const resource = unifiedManager ? unifiedManager.getResourceById(resourceId) : null;
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

    // Clean up other autocomplete instances
    if (this.editResourceItemTagAutocomplete) {
      this.editResourceItemTagAutocomplete.cleanup && this.editResourceItemTagAutocomplete.cleanup();
      this.editResourceItemTagAutocomplete = null;
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
   * Initialize filter logic controls
   */
  initializeFilterLogic() {
    const filterLogicBtn = document.getElementById('filter-logic-btn');
    
    if (!filterLogicBtn) return;
    
    // Load saved preference or use default
    const savedLogic = localStorage.getItem('resource-filter-logic') || 'any';
    this.resourceFilterLogic = savedLogic;
    
    // Set initial button state
    this.updateFilterLogicButton();
    
    // Add event listener for button clicks
    filterLogicBtn.addEventListener('click', () => {
      // Toggle between 'any' and 'all'
      this.resourceFilterLogic = this.resourceFilterLogic === 'any' ? 'all' : 'any';
      localStorage.setItem('resource-filter-logic', this.resourceFilterLogic);
      
      // Update button appearance and reapply filters
      this.updateFilterLogicButton();
      this.applyResourceFilters();
    });
  }

  /**
   * Update filter logic button appearance
   */
  updateFilterLogicButton() {
    const filterLogicBtn = document.getElementById('filter-logic-btn');
    if (!filterLogicBtn) return;
    
    // Set data attribute for CSS styling
    filterLogicBtn.setAttribute('data-logic', this.resourceFilterLogic);
    
    // Update tooltip
    const tooltipText = this.resourceFilterLogic === 'any' 
      ? 'Toggle Filter Logic: ANY of these tags' 
      : 'Toggle Filter Logic: ALL of these tags';
    filterLogicBtn.setAttribute('title', tooltipText);
  }

  /**
   * Update resource tag filter buttons
   */
  updateResourceTagFilterButtons() {
    document.querySelectorAll('.tag-filter').forEach(btn => {
      const tag = btn.dataset.tag;
      if (this.activeResourceTagFilters.has(tag)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  /**
   * Update resource tag filter list
   */
  updateResourceTagFilterList() {
    // This method would update the tag filter list display
    // Implementation depends on how the filter list is rendered
    console.log('[TagManager] updateResourceTagFilterList called');
  }

  /**
   * Apply all filters (legacy method for backward compatibility)
   */
  applyAllFilters() {
    console.log('[TagManager] applyAllFilters called - delegating to applyResourceFilters');
    this.applyResourceFilters();
  }

  /**
   * Clear all filters (legacy method for backward compatibility)
   */
  clearAllFilters() {
    console.log('[TagManager] clearAllFilters called');
    
    // Clear resource tag filters
    this.activeResourceTagFilters.clear();
    this.currentResourceSearchTerm = '';
    
    // Clear search input
    const searchInput = document.getElementById('resource-search');
    if (searchInput) {
      searchInput.value = '';
    }
    
    // Update filter buttons
    document.querySelectorAll('.tag-filter').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Show all resources
    document.querySelectorAll('.resource-item').forEach(item => {
      item.style.display = 'block';
    });
    
    this.updateResourceCount();
    this.updateResourceTagFilterButtons();
  }

  /**
   * Update resource count display
   */
  updateResourceCount() {
    const visibleResources = document.querySelectorAll('.resource-item[style*="display: block"], .resource-item:not([style*="display: none"])').length;
    const totalResources = document.querySelectorAll('.resource-item').length;
    
    const countElement = document.getElementById('resource-count');
    if (countElement) {
      if (visibleResources === totalResources) {
        countElement.textContent = `${totalResources} resource${totalResources !== 1 ? 's' : ''}`;
      } else {
        countElement.textContent = `${visibleResources} of ${totalResources} resource${totalResources !== 1 ? 's' : ''}`;
      }
    }
  }

  /**
   * Get tag statistics
   */
  getTagStats() {
    const resourceTags = this.getAllExistingResourceTags();
    
    return {
      resourceTags: {
        total: resourceTags.length,
        tags: resourceTags
      },
      activeFilters: {
        resource: Array.from(this.activeResourceTagFilters)
      }
    };
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
} 