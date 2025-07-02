import { ModuleBase } from './ModuleBase.js';

/**
 * ModalManager module - handles all modal and dialog operations in Meridian
 * Manages: Modal opening/closing, modal events, tab switching, modal state
 */
export class ModalManager extends ModuleBase {
  constructor(app) {
    super(app);
    
    // Modal state management
    this.activeModal = null;
    this.modalHistory = [];
    this.modalCallbacks = new Map();
  }

  async onInit() {
    console.log('[ModalManager] Initializing...');
    
    // Set up modal event listeners
    this.setupModalEvents();
    this.setupModalTabEvents();
    
    console.log('[ModalManager] Initialized successfully');
  }

  async onCleanup() {
    console.log('[ModalManager] Cleaning up...');
    
    // Close any open modals
    this.closeAllModals();
    
    // Clear callbacks
    this.modalCallbacks.clear();
    
    console.log('[ModalManager] Cleaned up successfully');
  }

  // ===== CORE MODAL OPERATIONS =====

  /**
   * Open a modal by ID
   */
  openModal(modalId, options = {}) {
    return new Promise((resolve) => {
      console.log(`[ModalManager] Opening modal: ${modalId}`);
      
      // Add small delay to ensure DOM is stable
      setTimeout(() => {
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById(modalId);
        
        // Check if required elements exist
        if (!overlay) {
          console.error('[ModalManager] Modal overlay element not found');
          return resolve();
        }
        
        if (!modal) {
          console.error(`[ModalManager] Modal element '${modalId}' not found`);
          // Log available modals for debugging
          const availableModals = Array.from(document.querySelectorAll('.modal')).map(m => m.id);
          console.log('[ModalManager] Available modals:', availableModals);
          return resolve();
        }
        
        // Store callback if provided
        if (options.onClose) {
          this.modalCallbacks.set(modalId, options.onClose);
        }
        
        // Hide all modals first
        this.hideAllModals();
        
        // Show target modal
        modal.style.display = 'flex'; // Use flex to match our CSS
        overlay.classList.add('active');
        
        // Update active modal state
        this.activeModal = modalId;
        this.modalHistory.push(modalId);
        
        // Give the browser a moment to render the modal
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            console.log(`[ModalManager] Modal opened: ${modalId}`);
            resolve();
          });
        });
      }, 10);
    });
  }

  /**
   * Close the currently active modal
   */
  closeModal(modalId = null) {
    const targetModal = modalId || this.activeModal;
    
    if (!targetModal) {
      console.warn('[ModalManager] No modal to close');
      return;
    }
    
    console.log(`[ModalManager] Closing modal: ${targetModal}`);
    
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) {
      console.error('[ModalManager] Modal overlay element not found');
      return;
    }
    
    // Execute callback if exists
    const callback = this.modalCallbacks.get(targetModal);
    if (callback) {
      try {
        callback();
      } catch (error) {
        console.error('[ModalManager] Error in modal close callback:', error);
      }
      this.modalCallbacks.delete(targetModal);
    }
    
    overlay.classList.remove('active');
    
    // Hide all modals and reset their display property
    document.querySelectorAll('.modal').forEach(modal => {
      modal.style.display = 'none';
    });
    
    // Update active modal state
    if (this.activeModal === targetModal) {
      this.activeModal = null;
    }
    
    // Remove from history
    this.modalHistory = this.modalHistory.filter(id => id !== targetModal);
    
    // Reset to previous modal if available
    if (this.modalHistory.length > 0) {
      this.activeModal = this.modalHistory[this.modalHistory.length - 1];
    }
    
    console.log(`[ModalManager] Modal closed: ${targetModal}`);
  }

  /**
   * Close all open modals
   */
  closeAllModals() {
    console.log('[ModalManager] Closing all modals');
    
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
    
    // Hide all modals
    document.querySelectorAll('.modal').forEach(modal => {
      modal.style.display = 'none';
    });
    
    // Clear state
    this.activeModal = null;
    this.modalHistory = [];
    this.modalCallbacks.clear();
  }

  /**
   * Hide all modals without closing them
   */
  hideAllModals() {
    document.querySelectorAll('.modal').forEach(m => {
      m.style.display = 'none';
    });
  }

  // ===== MODAL EVENT MANAGEMENT =====

  /**
   * Setup modal event listeners
   */
  setupModalEvents() {
    const overlay = document.getElementById('modal-overlay');
    
    if (!overlay) {
      console.error('[ModalManager] Modal overlay element not found during setup');
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
      if (e.key === 'Escape' && this.activeModal) {
        this.closeModal();
      }
    });
  }

  /**
   * Setup modal tab events
   */
  setupModalTabEvents() {
    // Set up tab switching for modals with tabs
    document.querySelectorAll('.modal-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchModalTab(tabName);
      });
    });
  }

  /**
   * Switch modal tab
   */
  switchModalTab(tabName) {
    console.log(`[ModalManager] Switching to tab: ${tabName}`);
    
    // Remove active class from all tab buttons and panels
    document.querySelectorAll('.modal-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.modal-tab-panel').forEach(panel => panel.classList.remove('active'));
    
    // Add active class to selected tab button
    const activeTabBtn = document.querySelector(`.modal-tab-btn[data-tab="${tabName}"]`);
    if (activeTabBtn) {
      activeTabBtn.classList.add('active');
    }
    
    // Add active class to selected tab panel
    const activeTabPanel = document.querySelector(`.modal-tab-panel[data-tab="${tabName}"]`);
    if (activeTabPanel) {
      activeTabPanel.classList.add('active');
    }
  }

  // ===== MODAL UTILITIES =====

  /**
   * Check if a modal is currently open
   */
  isModalOpen(modalId = null) {
    if (modalId) {
      return this.activeModal === modalId;
    }
    return this.activeModal !== null;
  }

  /**
   * Get the currently active modal
   */
  getActiveModal() {
    return this.activeModal;
  }

  /**
   * Get modal history
   */
  getModalHistory() {
    return [...this.modalHistory];
  }

  /**
   * Create a dynamic modal
   */
  createDynamicModal(modalId, content, options = {}) {
    console.log(`[ModalManager] Creating dynamic modal: ${modalId}`);
    
    // Remove existing modal if it exists
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
      existingModal.remove();
    }
    
    // Create modal element
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal';
    modal.innerHTML = content;
    
    // Add to modal overlay
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.appendChild(modal);
    }
    
    // Setup events for the new modal
    this.setupModalEvents();
    
    return modal;
  }

  /**
   * Remove a dynamic modal
   */
  removeDynamicModal(modalId) {
    console.log(`[ModalManager] Removing dynamic modal: ${modalId}`);
    
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.remove();
      
      // Clear callback if exists
      this.modalCallbacks.delete(modalId);
      
      // Update state if this was the active modal
      if (this.activeModal === modalId) {
        this.activeModal = null;
        this.modalHistory = this.modalHistory.filter(id => id !== modalId);
      }
    }
  }

  // ===== MODAL STATE MANAGEMENT =====

  /**
   * Save modal state
   */
  saveModalState() {
    return {
      activeModal: this.activeModal,
      modalHistory: [...this.modalHistory],
      callbacks: Array.from(this.modalCallbacks.keys())
    };
  }

  /**
   * Restore modal state
   */
  restoreModalState(state) {
    if (!state) return;
    
    this.activeModal = state.activeModal;
    this.modalHistory = [...state.modalHistory];
    
    // Note: Callbacks cannot be restored, they need to be re-registered
    console.log('[ModalManager] Modal state restored');
  }

  // ===== MODAL VALIDATION =====

  /**
   * Validate modal exists
   */
  validateModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      console.error(`[ModalManager] Modal '${modalId}' not found`);
      return false;
    }
    return true;
  }

  /**
   * Get all available modals
   */
  getAvailableModals() {
    return Array.from(document.querySelectorAll('.modal')).map(m => m.id);
  }

  // ===== MODAL ANIMATION HELPERS =====

  /**
   * Show modal with animation
   */
  showModalWithAnimation(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // Add animation classes
    modal.classList.add('modal-enter');
    
    // Remove animation class after animation completes
    setTimeout(() => {
      modal.classList.remove('modal-enter');
    }, 300);
  }

  /**
   * Hide modal with animation
   */
  hideModalWithAnimation(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // Add animation classes
    modal.classList.add('modal-exit');
    
    // Hide modal after animation completes
    setTimeout(() => {
      modal.style.display = 'none';
      modal.classList.remove('modal-exit');
    }, 300);
  }

  // ===== MODAL CONTENT HELPERS =====

  /**
   * Update modal content
   */
  updateModalContent(modalId, content) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      console.error(`[ModalManager] Modal '${modalId}' not found for content update`);
      return;
    }
    
    modal.innerHTML = content;
    
    // Re-setup events for updated content
    this.setupModalEvents();
  }

  /**
   * Get modal content
   */
  getModalContent(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      console.error(`[ModalManager] Modal '${modalId}' not found for content retrieval`);
      return null;
    }
    
    return modal.innerHTML;
  }

  // ===== MODAL FOCUS MANAGEMENT =====

  /**
   * Focus first focusable element in modal
   */
  focusFirstElement(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }

  /**
   * Trap focus within modal
   */
  trapFocus(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    // Handle tab key
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    });
  }

  // ===== MODAL DEBUGGING =====

  /**
   * Debug modal state
   */
  debugModalState() {
    console.log('[ModalManager] Debug Info:', {
      activeModal: this.activeModal,
      modalHistory: this.modalHistory,
      availableModals: this.getAvailableModals(),
      callbacks: Array.from(this.modalCallbacks.keys())
    });
  }

  /**
   * Log modal operations
   */
  logModalOperation(operation, modalId, details = {}) {
    console.log(`[ModalManager] ${operation}:`, {
      modalId,
      activeModal: this.activeModal,
      ...details
    });
  }
} 