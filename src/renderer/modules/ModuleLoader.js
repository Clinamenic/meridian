/**
 * ModuleLoader - Manages the initialization and lifecycle of all Meridian modules
 * Provides a centralized way to load, initialize, and manage modules
 */
export class ModuleLoader {
  constructor(app) {
    this.app = app;
    this.modules = new Map();
    this.eventBus = new EventTarget();
    this.initialized = false;
  }

  /**
   * Register a module
   */
  async registerModule(name, ModuleClass) {
    try {
      console.log(`[ModuleLoader] Registering module: ${name}`);
      
      // Create module instance
      console.log(`[ModuleLoader] Creating instance of ${name}...`);
      // Pass the modules map so modules can access each other
      const module = new ModuleClass(this.app, this.modules);
      console.log(`[ModuleLoader] Instance of ${name} created successfully`);
      
      // Store module reference
      this.modules.set(name, module);
      console.log(`[ModuleLoader] Module ${name} stored in modules map`);
      
      // Initialize module
      console.log(`[ModuleLoader] Initializing module ${name}...`);
      await module.init();
      console.log(`[ModuleLoader] Module ${name} initialization completed`);
      
      console.log(`[ModuleLoader] Module ${name} registered and initialized successfully`);
      return module;
    } catch (error) {
      console.error(`[ModuleLoader] Failed to register module ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get a module by name
   */
  getModule(name) {
    return this.modules.get(name);
  }

  /**
   * Check if a module exists
   */
  hasModule(name) {
    return this.modules.has(name);
  }

  /**
   * Get all registered modules
   */
  getAllModules() {
    return Array.from(this.modules.values());
  }

  /**
   * Get all module names
   */
  getModuleNames() {
    return Array.from(this.modules.keys());
  }

  /**
   * Initialize all modules
   */
  async initializeAll() {
    if (this.initialized) {
      console.warn('[ModuleLoader] Already initialized');
      return;
    }

    console.log('[ModuleLoader] Initializing all modules...');
    
    try {
      // Load all modules in dependency order
      await this.loadAllModules();
      
      this.initialized = true;
      console.log('[ModuleLoader] All modules initialized successfully');
    } catch (error) {
      console.error('[ModuleLoader] Failed to initialize modules:', error);
      throw error;
    }
  }

  /**
   * Load all modules in the correct order
   */
  async loadAllModules() {
    // Import all modules
    const { TagManager } = await import('./TagManager.js');
          // ResourceManager and ArchiveManager replaced by UnifiedResourceManager
    const { ModalManager } = await import('./ModalManager.js');
    const { AccountManager } = await import('./AccountManager.js');
    const { BroadcastManager } = await import('./BroadcastManager.js');
    const { DeployManager } = await import('./DeployManager.js');
    const { UploadManager } = await import('./UploadManager.js');
    console.log('[ModuleLoader] Importing UnifiedResourceManager...');
    const { UnifiedResourceManager } = await import('./UnifiedResourceManager.js');
    console.log('[ModuleLoader] UnifiedResourceManager imported:', UnifiedResourceManager);
    
    // Register modules in dependency order
    // TagManager has no dependencies, so it can be loaded first
    await this.registerModule('tagManager', TagManager);
    
          // ResourceManager and ArchiveManager replaced by UnifiedResourceManager
    
          // UnifiedResourceManager depends on TagManager
    console.log('[ModuleLoader] About to register UnifiedResourceManager...');
    await this.registerModule('unifiedResourceManager', UnifiedResourceManager);
    console.log('[ModuleLoader] UnifiedResourceManager registered successfully');
    
    // ModalManager has no dependencies, can be loaded anytime
    await this.registerModule('modalManager', ModalManager);
    
    // AccountManager has no dependencies, can be loaded anytime
    await this.registerModule('accountManager', AccountManager);
    
    // BroadcastManager depends on ModalManager for modal operations
    await this.registerModule('broadcastManager', BroadcastManager);
    
    // DeployManager depends on AccountManager for deploy operations
    await this.registerModule('deployManager', DeployManager);
    
    // UploadManager has no dependencies, can be loaded anytime
    await this.registerModule('uploadManager', UploadManager);
    
    // Future modules will be added here in dependency order
    // etc.
  }

  /**
   * Cleanup all modules
   */
  async cleanupAll() {
    if (!this.initialized) {
      return;
    }

    console.log('[ModuleLoader] Cleaning up all modules...');
    
    try {
      // Cleanup modules in reverse dependency order
      const modules = Array.from(this.modules.values()).reverse();
      
      for (const module of modules) {
        if (module.cleanup) {
          await module.cleanup();
        }
      }
      
      this.modules.clear();
      this.initialized = false;
      
      console.log('[ModuleLoader] All modules cleaned up successfully');
    } catch (error) {
      console.error('[ModuleLoader] Failed to cleanup modules:', error);
      throw error;
    }
  }

  /**
   * Emit an event to all modules
   */
  emit(event, data) {
    const customEvent = new CustomEvent(event, { detail: data });
    this.eventBus.dispatchEvent(customEvent);
  }

  /**
   * Listen for events from modules
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
   * Get module statistics
   */
  getModuleStatistics() {
    const stats = {
      total: this.modules.size,
      initialized: this.initialized,
      modules: {}
    };

    for (const [name, module] of this.modules) {
      stats.modules[name] = {
        name: name,
        initialized: module.isInitialized ? module.isInitialized() : false,
        constructor: module.constructor.name
      };
    }

    return stats;
  }

  /**
   * Reload a specific module
   */
  async reloadModule(name) {
    if (!this.modules.has(name)) {
      throw new Error(`Module ${name} not found`);
    }

    console.log(`[ModuleLoader] Reloading module: ${name}`);
    
    try {
      // Cleanup existing module
      const existingModule = this.modules.get(name);
      if (existingModule.cleanup) {
        await existingModule.cleanup();
      }
      
      // Remove from modules map
      this.modules.delete(name);
      
      // Re-register module
      await this.registerModule(name, existingModule.constructor);
      
      console.log(`[ModuleLoader] Module ${name} reloaded successfully`);
    } catch (error) {
      console.error(`[ModuleLoader] Failed to reload module ${name}:`, error);
      throw error;
    }
  }

  /**
   * Check if all modules are healthy
   */
  async healthCheck() {
    const results = {
      healthy: true,
      modules: {}
    };

    for (const [name, module] of this.modules) {
      const moduleHealth = {
        name: name,
        initialized: module.isInitialized ? module.isInitialized() : false,
        healthy: true,
        errors: []
      };

      // Basic health checks
      if (!moduleHealth.initialized) {
        moduleHealth.healthy = false;
        moduleHealth.errors.push('Module not initialized');
      }

      // Add module-specific health checks here
      // if (module.healthCheck) {
      //   try {
      //     await module.healthCheck();
      //   } catch (error) {
      //     moduleHealth.healthy = false;
      //     moduleHealth.errors.push(error.message);
      //   }
      // }

      results.modules[name] = moduleHealth;
      
      if (!moduleHealth.healthy) {
        results.healthy = false;
      }
    }

    return results;
  }
} 