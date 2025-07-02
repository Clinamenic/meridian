import { ModuleBase } from './ModuleBase.js';

/**
 * ResourceManager module - handles all resource-related operations in Meridian
 * Manages: Resource rendering, CRUD operations, filtering, collapse state, metadata extraction
 */
export class ResourceManager extends ModuleBase {
  constructor(app) {
    super(app);
    
    // Resource state management
    this.editingResourceId = null;
    this.modalTags = [];
    this.collateCollapseState = {
      globalState: 'expanded', // 'expanded' or 'collapsed'
      collapsedItems: new Set()
    };
  }

  async onInit() {
    console.log('[ResourceManager] Initializing...');
    
    // Set up event listeners for resource-related functionality
    this.setupResourceEventListeners();
    
    // Initialize collapse state from localStorage
    this.initializeCollapseState();
    
    console.log('[ResourceManager] Initialized successfully');
  }

  async onCleanup() {
    console.log('[ResourceManager] Cleaning up...');
    
    // Save collapse state to localStorage
    this.saveCollapseState();
    
    console.log('[ResourceManager] Cleaned up successfully');
  }

  // ===== RESOURCE RENDERING =====

  /**
   * Render all resources in the resource list
   */
  renderResources() {
    console.log('[ResourceManager] renderResources called');
    
    const container = document.getElementById('resource-list');
    console.log('[ResourceManager] Container:', container);
    
    const data = this.getData();
    console.log('[ResourceManager] Data:', data);
    
    if (!data.collate || !data.collate.resources) {
      console.log('[ResourceManager] No collate data or resources found');
      if (container) {
        container.innerHTML = '<div class="loading-state">No resources found</div>';
      }
      return;
    }

    console.log('[ResourceManager] Resources found:', data.collate.resources.length);
    
    if (data.collate.resources.length === 0) {
      console.log('[ResourceManager] No resources in array');
      if (container) {
        container.innerHTML = '<div class="loading-state">No resources yet. Add your first resource!</div>';
      }
      return;
    }

    console.log('[ResourceManager] Starting to generate HTML for resources...');
    console.log('[ResourceManager] First resource sample:', data.collate.resources[0]);

    const html = data.collate.resources.map(resource => {
      console.log('[ResourceManager] Processing resource:', resource.id, resource.title);
      return `
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
    `;
    }).join('');

    console.log('[ResourceManager] Generated HTML length:', html.length);
    console.log('[ResourceManager] Setting container innerHTML...');
    
    container.innerHTML = html;

    // Setup event listeners for resource tag inputs after rendering
    this.setupResourceTagInputEvents();
    
    // Setup resource collapse events
    this.setupResourceCollapseEvents();
    
    // Restore collapse state after rendering
    this.restoreResourceCollapseState();
    
    // Apply current filters after rendering (delegate to TagManager)
    const tagManager = this.getApp().getTagManager();
    if (tagManager) {
      console.log('[ResourceManager] Applying filters after rendering...');
      tagManager.applyAllFilters();
    }
    
    console.log('[ResourceManager] Resource rendering complete. Checking final state...');
    const finalResourceItems = document.querySelectorAll('.resource-item');
    console.log('[ResourceManager] Final resource items found:', finalResourceItems.length);
    
    // Check visibility of first few items
    for (let i = 0; i < Math.min(3, finalResourceItems.length); i++) {
      const item = finalResourceItems[i];
      const display = window.getComputedStyle(item).display;
      console.log(`[ResourceManager] Resource ${i + 1} display:`, display, 'id:', item.dataset.id);
    }
    
    // Update resource count after initial render
    this.updateResourceCount();
  }

  // ===== RESOURCE CRUD OPERATIONS =====

  /**
   * Handle adding a new resource or updating existing one
   */
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

      await this.getApp().loadCollateData();
      this.closeModal();
      
      // Clear form and reset modal
      this.resetResourceModal();
    } catch (error) {
      console.error('Failed to save resource:', error);
      this.showError(this.editingResourceId ? 'Failed to update resource' : 'Failed to add resource');
    }
  }

  /**
   * Open edit resource modal
   */
  async openEditResourceModal(resourceId) {
    try {
      // Find the resource data
      const resource = this.getData().collate.resources.find(r => r.id === resourceId);
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

  /**
   * Confirm resource removal
   */
  confirmRemoveResource(resourceId) {
    // Find the resource for confirmation message
    const resource = this.getData().collate.resources.find(r => r.id === resourceId);
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

  /**
   * Remove resource
   */
  async removeResource(resourceId) {
    try {
      await window.electronAPI.collate.removeResource(resourceId);
      await this.getApp().loadCollateData();
      this.showSuccess('Resource removed successfully');
    } catch (error) {
      console.error('Failed to remove resource:', error);
      this.showError('Failed to remove resource');
    }
  }

  /**
   * Reset resource modal form
   */
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

  // ===== METADATA EXTRACTION =====

  /**
   * Extract metadata from URL
   */
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

      if (metadata.title || metadata.description) {
        this.showSuccess('Metadata extracted successfully');
      } else {
        this.showError('No metadata found for this URL');
      }
    } catch (error) {
      console.error('Failed to extract metadata:', error);
      this.showError('Failed to extract metadata');
      
      const btn = document.getElementById('extract-metadata-btn');
      btn.textContent = 'Extract Metadata';
      btn.disabled = false;
    }
  }

  // ===== RESOURCE COLLAPSE FUNCTIONALITY =====

  /**
   * Setup resource collapse events
   */
  setupResourceCollapseEvents() {
    // Set up individual resource collapse buttons
    document.querySelectorAll('.resource-collapse-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const resourceId = e.target.closest('.resource-collapse-btn').dataset.resourceId;
        this.toggleResourceCollapse(resourceId);
      });
    });

    // Set up collapse all button
    const collapseAllBtn = document.getElementById('collapse-all-btn');
    if (collapseAllBtn) {
      collapseAllBtn.addEventListener('click', () => {
        this.toggleAllResourcesCollapse();
      });
    }
  }

  /**
   * Toggle individual resource collapse
   */
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

  /**
   * Toggle all resources collapse
   */
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

  /**
   * Restore resource collapse state
   */
  restoreResourceCollapseState() {
    // Apply global state first
    const collapseBtn = document.getElementById('collapse-all-btn');
    if (collapseBtn) {
      collapseBtn.dataset.state = this.collateCollapseState.globalState;
      collapseBtn.title = this.collateCollapseState.globalState === 'collapsed' 
        ? 'Expand All Resources' 
        : 'Collapse All Resources';
    }

    // Apply individual collapse states
    const resourceItems = document.querySelectorAll('.resource-item');
    resourceItems.forEach(item => {
      const resourceId = item.dataset.id;
      if (this.collateCollapseState.collapsedItems.has(resourceId)) {
        item.classList.add('collapsed');
      } else {
        item.classList.remove('collapsed');
      }
    });
  }

  // ===== RESOURCE TAG INPUT EVENTS =====

  /**
   * Setup resource tag input events
   */
  setupResourceTagInputEvents() {
    // Set up tag input events for each resource
    document.querySelectorAll('.tag-input[data-resource-id]').forEach(input => {
      const resourceId = input.dataset.resourceId;
      
      // Input event for real-time validation
      input.addEventListener('input', (e) => {
        this.updateAddTagButtonState(e.target);
      });

      // Keydown event for Enter key submission
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const tagValue = e.target.value.trim();
          if (tagValue) {
            this.addTagToResource(resourceId, tagValue);
          }
        }
      });

      // Click event for add button
      const addBtn = input.parentElement.querySelector('.add-tag-btn');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          const tagValue = input.value.trim();
          if (tagValue) {
            this.addTagToResource(resourceId, tagValue);
          }
        });
      }
    });

    // Set up remove tag button events
    document.querySelectorAll('.remove-tag-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const resourceId = e.target.dataset.resourceId;
        const tag = e.target.dataset.tag;
        this.removeTagFromResource(resourceId, tag);
      });
    });
  }

  /**
   * Update add tag button state
   */
  updateAddTagButtonState(input) {
    const addBtn = input.parentElement.querySelector('.add-tag-btn');
    if (!addBtn) return;

    const tagValue = input.value.trim();
    const resourceId = input.dataset.resourceId;
    
    // Check if tag is valid and not already applied
    const resource = this.getData().collate.resources.find(r => r.id === resourceId);
    const isValid = tagValue.length > 0 && 
                   tagValue.length <= 50 && 
                   !resource.tags.includes(tagValue);
    
    addBtn.disabled = !isValid;
  }

  /**
   * Add tag to resource (delegate to TagManager)
   */
  async addTagToResource(resourceId, tagValue) {
    const tagManager = this.getApp().getTagManager();
    if (tagManager) {
      await tagManager.addTagToResource(resourceId, tagValue);
    }
  }

  /**
   * Remove tag from resource (delegate to TagManager)
   */
  async removeTagFromResource(resourceId, tag) {
    const tagManager = this.getApp().getTagManager();
    if (tagManager) {
      await tagManager.removeTagFromResource(resourceId, tag);
    }
  }

  // ===== MODAL TAG MANAGEMENT =====

  /**
   * Update modal add tag button state
   */
  updateModalAddTagButtonState(input) {
    const addBtn = document.getElementById('modal-add-tag-btn');
    if (!addBtn) return;

    const tagValue = input.value.trim();
    const isValid = tagValue.length > 0 && 
                   tagValue.length <= 50 && 
                   !this.modalTags.includes(tagValue);
    
    addBtn.disabled = !isValid;
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
   * Remove tag from modal
   */
  removeModalTag(tagValue) {
    const index = this.modalTags.indexOf(tagValue);
    if (index > -1) {
      this.modalTags.splice(index, 1);
      this.renderModalTags();
    }
  }

  /**
   * Render modal tags
   */
  renderModalTags() {
    const container = document.getElementById('modal-tags-container');
    if (!container) return;

    container.innerHTML = this.modalTags.map(tag => `
      <span class="modal-tag">
        ${this.escapeHtml(tag)}
        <button class="remove-modal-tag-btn" data-tag="${this.escapeHtml(tag)}" title="Remove tag">×</button>
      </span>
    `).join('');

    // Add event listeners for remove buttons
    container.querySelectorAll('.remove-modal-tag-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tag = e.target.dataset.tag;
        this.removeModalTag(tag);
      });
    });
  }

  // ===== UTILITY METHODS =====

  /**
   * Update resource count display
   */
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

  /**
   * Initialize collapse state from localStorage
   */
  initializeCollapseState() {
    try {
      const savedState = localStorage.getItem('collate-collapse-state');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        this.collateCollapseState.globalState = parsed.globalState || 'expanded';
        this.collateCollapseState.collapsedItems = new Set(parsed.collapsedItems || []);
      }
    } catch (error) {
      console.error('Failed to load collapse state:', error);
    }
  }

  /**
   * Save collapse state to localStorage
   */
  saveCollapseState() {
    try {
      const stateToSave = {
        globalState: this.collateCollapseState.globalState,
        collapsedItems: Array.from(this.collateCollapseState.collapsedItems)
      };
      localStorage.setItem('collate-collapse-state', JSON.stringify(stateToSave));
    } catch (error) {
      console.error('Failed to save collapse state:', error);
    }
  }

  /**
   * Setup resource event listeners
   */
  setupResourceEventListeners() {
    // Resource actions dropdown events
    document.addEventListener('click', (e) => {
      // Handle resource actions dropdown toggle
      if (e.target.classList.contains('resource-actions-btn')) {
        e.stopPropagation();
        const resourceId = e.target.dataset.resourceId;
        this.toggleResourceActionsDropdown(resourceId);
      }
      
      // Handle resource action clicks
      if (e.target.classList.contains('edit-option')) {
        e.stopPropagation();
        const resourceId = e.target.dataset.resourceId;
        this.openEditResourceModal(resourceId);
        this.hideAllResourceActionsDropdowns();
      }
      
      if (e.target.classList.contains('remove-option')) {
        e.stopPropagation();
        const resourceId = e.target.dataset.resourceId;
        this.confirmRemoveResource(resourceId);
        this.hideAllResourceActionsDropdowns();
      }
    });

    // Hide dropdowns when clicking outside
    document.addEventListener('click', () => {
      this.hideAllResourceActionsDropdowns();
    });
  }

  /**
   * Toggle resource actions dropdown
   */
  toggleResourceActionsDropdown(resourceId) {
    const dropdown = document.querySelector(`.resource-actions-menu[data-resource-id="${resourceId}"]`);
    if (!dropdown) return;

    // Hide all other dropdowns first
    this.hideAllResourceActionsDropdowns();

    // Toggle this dropdown
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
  }

  /**
   * Hide all resource actions dropdowns
   */
  hideAllResourceActionsDropdowns() {
    document.querySelectorAll('.resource-actions-menu').forEach(dropdown => {
      dropdown.style.display = 'none';
    });
  }

  /**
   * Open add resources modal
   */
  async openAddResourcesModal(defaultTab = 'single') {
    console.log('[ResourceManager] openAddResourcesModal called with defaultTab:', defaultTab);
    
    // Reset modal state
    this.resetResourceModal();
    
    // Show the modal using ModalManager
    const modalManager = this.getApp().getModalManager();
    console.log('[ResourceManager] ModalManager:', modalManager);
    
    if (modalManager) {
      console.log('[ResourceManager] Opening modal: add-resources-modal');
      await modalManager.openModal('add-resources-modal');
      
      console.log('[ResourceManager] Switching to tab:', defaultTab);
      // Switch to default tab using ModalManager
      modalManager.switchModalTab(defaultTab);
    } else {
      console.error('[ResourceManager] ModalManager not available');
    }
  }

  /**
   * Switch modal tab - delegate to ModalManager
   */
  switchModalTab(tabName) {
    const modalManager = this.getApp().getModalManager();
    if (modalManager) {
      modalManager.switchModalTab(tabName);
    } else {
      console.error('[ResourceManager] ModalManager not available');
    }
  }

  /**
   * Open modal - delegate to ModalManager
   */
  openModal(modalId) {
    const modalManager = this.getApp().getModalManager();
    if (modalManager) {
      modalManager.openModal(modalId);
    } else {
      console.error('[ResourceManager] ModalManager not available');
    }
  }

  /**
   * Close modal - delegate to ModalManager
   */
  closeModal() {
    const modalManager = this.getApp().getModalManager();
    if (modalManager) {
      modalManager.closeModal();
    } else {
      console.error('[ResourceManager] ModalManager not available');
    }
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    this.getApp().showSuccess(message);
  }

  /**
   * Show error message
   */
  showError(message) {
    this.getApp().showError(message);
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
} 