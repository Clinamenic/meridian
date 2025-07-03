/**
 * Base module class providing common functionality for all Meridian modules
 * Follows the same pattern as the TypeScript backend managers
 */
export class ModuleBase {
  constructor(app, modules = null) {
    this.app = app;
    this.eventBus = app.eventBus || new EventTarget();
    this.modules = modules || app.modules || new Map();
    this.initialized = false;
  }

  /**
   * Initialize the module
   * Override in subclasses to add initialization logic
   */
  async init() {
    if (this.initialized) {
      console.warn(`[${this.constructor.name}] Already initialized`);
      return;
    }

    try {
      await this.onInit();
      this.initialized = true;
      console.log(`[${this.constructor.name}] Initialized successfully`);
    } catch (error) {
      console.error(`[${this.constructor.name}] Initialization failed:`, error);
      throw error;
    }
  }

  /**
   * Override this method in subclasses for custom initialization
   */
  async onInit() {
    // Default implementation - override in subclasses
  }

  /**
   * Cleanup the module
   * Override in subclasses to add cleanup logic
   */
  async cleanup() {
    if (!this.initialized) {
      return;
    }

    try {
      await this.onCleanup();
      this.initialized = false;
      console.log(`[${this.constructor.name}] Cleaned up successfully`);
    } catch (error) {
      console.error(`[${this.constructor.name}] Cleanup failed:`, error);
      throw error;
    }
  }

  /**
   * Override this method in subclasses for custom cleanup
   */
  async onCleanup() {
    // Default implementation - override in subclasses
  }

  /**
   * Emit an event to other modules
   */
  emit(event, data) {
    const customEvent = new CustomEvent(event, { detail: data });
    this.eventBus.dispatchEvent(customEvent);
  }

  /**
   * Listen for events from other modules
   */
  on(event, handler) {
    this.eventBus.addEventListener(event, (e) => handler(e.detail));
  }

  /**
   * Remove event listener
   */
  off(event, handler) {
    this.eventBus.removeEventListener(event, (e) => handler(e.detail));
  }

  /**
   * Get another module instance
   */
  getModule(name) {
    return this.modules.get(name);
  }

  /**
   * Check if another module is available
   */
  hasModule(name) {
    return this.modules.has(name);
  }

  /**
   * Get the main app instance
   */
  getApp() {
    return this.app;
  }

  /**
   * Get the current workspace path
   */
  getWorkspacePath() {
    return this.app.workspacePath;
  }

  /**
   * Get the current tool
   */
  getCurrentTool() {
    return this.app.currentTool;
  }

  /**
   * Get application data
   */
  getData() {
    return this.app.data;
  }

  /**
   * Show success notification
   */
  showSuccess(message) {
    if (this.app.showSuccess) {
      this.app.showSuccess(message);
    } else {
      console.log(`[SUCCESS] ${message}`);
    }
  }

  /**
   * Show error notification
   */
  showError(message) {
    if (this.app.showError) {
      this.app.showError(message);
    } else {
      console.error(`[ERROR] ${message}`);
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    if (this.app.showNotification) {
      this.app.showNotification(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Utility method for HTML escaping
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Utility method for copying to clipboard
   */
  async copyToClipboard(text, successMessage = 'Copied to clipboard') {
    if (this.app.copyToClipboard) {
      return this.app.copyToClipboard(text, successMessage);
    } else {
      try {
        await navigator.clipboard.writeText(text);
        this.showSuccess(successMessage);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        this.showError('Failed to copy to clipboard');
      }
    }
  }

  /**
   * Debug logging helper
   */
  debug(message, data = null) {
    if (this.app.debugMode) {
      console.log(`[${this.constructor.name}] ${message}`, data);
    }
  }

  /**
   * Check if module is initialized
   */
  isInitialized() {
    return this.initialized;
  }
} 