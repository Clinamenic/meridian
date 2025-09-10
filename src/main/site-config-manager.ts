import { promises as fs } from 'fs';
import * as path from 'path';
import { SiteSettings, ValidationResult, ValidationError } from '../types';

class ConfigManager {
  private static instance: ConfigManager;
  private configCache: Map<string, SiteSettings> = new Map();

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  async loadSiteSettings(workspacePath: string): Promise<SiteSettings> {
    try {
      // Check cache first
      const cacheKey = workspacePath;
      if (this.configCache.has(cacheKey)) {
        return this.configCache.get(cacheKey)!;
      }

      const configPath = path.join(workspacePath, '.meridian', 'config', 'site-settings.json');
      
      try {
        const data = await fs.readFile(configPath, 'utf-8');
        const settings: SiteSettings = JSON.parse(data);
        
        // Validate and migrate if necessary
        const validatedSettings = await this.validateAndMigrateSettings(settings, workspacePath);
        
        // Cache the validated settings
        this.configCache.set(cacheKey, validatedSettings);
        
        return validatedSettings;
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          // Create default settings if file doesn't exist
          const defaultSettings = this.createDefaultSettings(workspacePath);
          await this.saveSiteSettings(workspacePath, defaultSettings);
          return defaultSettings;
        }
        throw error;
      }
    } catch (error: any) {
      console.error('Failed to load site settings:', error);
      throw new Error(`Failed to load site settings: ${error.message}`);
    }
  }

  async saveSiteSettings(
    workspacePath: string,
    settings: SiteSettings
  ): Promise<void> {
    try {
      // Validate settings before saving
      const validation = this.validateSettings(settings);
      if (!validation.isValid) {
        throw new Error(`Invalid settings: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Update metadata
      settings.lastModified = new Date().toISOString();
      settings.metadata.workspacePath = workspacePath;

      // Ensure directory exists
      const configDir = path.join(workspacePath, '.meridian', 'config');
      await fs.mkdir(configDir, { recursive: true });

      // Save settings
      const configPath = path.join(configDir, 'site-settings.json');
      await fs.writeFile(configPath, JSON.stringify(settings, null, 2));

      // Update cache
      this.configCache.set(workspacePath, settings);

      // Sync with Quartz configuration
      await this.syncWithQuartz(workspacePath, settings);

      // Handle CNAME file
      if (settings.deployment?.customCNAME && settings.site.baseUrl) {
        const domain = this.extractDomain(settings.site.baseUrl);
        if (domain) {
          await this.generateCNAME(workspacePath, domain);
        }
      } else {
        await this.removeCNAME(workspacePath);
      }
    } catch (error: any) {
      console.error('Failed to save site settings:', error);
      throw new Error(`Failed to save site settings: ${error.message}`);
    }
  }

  async syncWithQuartz(
    workspacePath: string,
    settings: SiteSettings
  ): Promise<void> {
    try {
      const quartzConfigPath = path.join(workspacePath, '.quartz', 'quartz.config.ts');
      
      // Check if Quartz is initialized
      try {
        await fs.access(quartzConfigPath);
      } catch {
        // Quartz not initialized, skip sync
        console.log('Quartz not initialized, skipping configuration sync');
        return;
      }

      // Read current config
      let configContent = await fs.readFile(quartzConfigPath, 'utf-8');

      // Update key fields
      configContent = this.updateConfigField(configContent, 'pageTitle', settings.site.title);
      configContent = this.updateConfigField(configContent, 'baseUrl', settings.site.baseUrl || undefined);
      configContent = this.updateConfigField(configContent, 'enableSPA', settings.quartz.enableSPA);
      configContent = this.updateConfigField(configContent, 'enablePopovers', settings.quartz.enablePopovers);

      // Write updated config
      await fs.writeFile(quartzConfigPath, configContent);
    } catch (error: any) {
      console.error('Failed to sync with Quartz config:', error);
      // Don't throw here - settings should still be saved even if Quartz sync fails
    }
  }

  async generateCNAME(workspacePath: string, domain: string): Promise<void> {
    try {
      const cnameDir = path.join(workspacePath, '.quartz');
      await fs.mkdir(cnameDir, { recursive: true });
      
      const cnamePath = path.join(cnameDir, 'CNAME');
      await fs.writeFile(cnamePath, domain);
    } catch (error: any) {
      console.error('Failed to generate CNAME file:', error);
      throw new Error(`Failed to generate CNAME file: ${error.message}`);
    }
  }

  async removeCNAME(workspacePath: string): Promise<void> {
    try {
      const cnamePath = path.join(workspacePath, '.quartz', 'CNAME');
      await fs.unlink(cnamePath);
    } catch (error: any) {
      // Ignore if file doesn't exist
      if (error.code !== 'ENOENT') {
        console.error('Failed to remove CNAME file:', error);
      }
    }
  }

  private validateSettings(settings: SiteSettings): ValidationResult {
    const errors: ValidationError[] = [];

    // Version validation
    if (!settings.version) {
      errors.push({
        field: 'version',
        message: 'Version is required',
        code: 'MISSING_VERSION'
      });
    }

    // Site title validation
    if (!settings.site.title || settings.site.title.trim().length === 0) {
      errors.push({
        field: 'site.title',
        message: 'Site title is required',
        code: 'MISSING_TITLE'
      });
    } else if (settings.site.title.length > 100) {
      errors.push({
        field: 'site.title',
        message: 'Site title must be 100 characters or less',
        code: 'TITLE_TOO_LONG'
      });
    }

    // Base URL validation
    if (settings.site.baseUrl) {
      const urlValidation = this.validateUrl(settings.site.baseUrl);
      if (!urlValidation.isValid) {
        errors.push({
          field: 'site.baseUrl',
          message: urlValidation.message || 'Invalid base URL format',
          code: 'INVALID_BASE_URL'
        });
      }
    }

    // Description validation
    if (settings.site.description && settings.site.description.length > 500) {
      errors.push({
        field: 'site.description',
        message: 'Description must be 500 characters or less',
        code: 'DESCRIPTION_TOO_LONG'
      });
    }

    // Author validation
    if (settings.site.author && settings.site.author.length > 100) {
      errors.push({
        field: 'site.author',
        message: 'Author name must be 100 characters or less',
        code: 'AUTHOR_TOO_LONG'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateUrl(url: string): { isValid: boolean; message?: string } {
    try {
      const parsed = new URL(url);
      
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return {
          isValid: false,
          message: 'URL must use http or https protocol'
        };
      }

      // Ensure hostname exists
      if (!parsed.hostname) {
        return {
          isValid: false,
          message: 'URL must include a valid hostname'
        };
      }

      return { isValid: true };
    } catch {
      return {
        isValid: false,
        message: 'Invalid URL format'
      };
    }
  }

  private extractDomain(url: string): string | null {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return null;
    }
  }

  private createDefaultSettings(workspacePath: string): SiteSettings {
    return {
      version: '1.0.0',
      lastModified: new Date().toISOString(),
      site: {
        title: 'Digital Garden',
        description: '',
        author: ''
      },
      quartz: {
        enableSPA: true,
        enablePopovers: true,
        theme: {
          mode: 'auto',
          primaryColor: '#284b63'
        }
      },
      deployment: {
        provider: null,
        repository: null,
        branch: 'main',
        customCNAME: true
      },
      metadata: {
        createdAt: new Date().toISOString(),
        workspacePath
      }
    };
  }

  private async validateAndMigrateSettings(
    settings: SiteSettings,
    workspacePath: string
  ): Promise<SiteSettings> {
    // Create a new settings object with defaults
    const defaultSettings = this.createDefaultSettings(workspacePath);
    
    // Merge with existing settings, preserving user data
    const mergedSettings: SiteSettings = {
      ...defaultSettings,
      ...settings,
      site: {
        ...defaultSettings.site,
        ...settings.site
      },
      quartz: {
        ...defaultSettings.quartz,
        ...settings.quartz,
        theme: {
          ...defaultSettings.quartz.theme,
          ...settings.quartz?.theme
        }
      },
      deployment: {
        ...defaultSettings.deployment,
        ...settings.deployment
      },
      metadata: {
        ...defaultSettings.metadata,
        ...settings.metadata,
        workspacePath // Always update workspace path
      }
    };

    // Update version if migrated
    if (settings.version !== defaultSettings.version) {
      mergedSettings.version = defaultSettings.version;
      mergedSettings.lastModified = new Date().toISOString();
    }

    return mergedSettings;
  }

  private updateConfigField(
    configContent: string,
    fieldName: string,
    value: any
  ): string {
    const fieldRegex = new RegExp(`(${fieldName}:\\s*)([^,\\n}]+)`, 'g');
    const replacement = value === undefined ? 'undefined' : 
                       typeof value === 'string' ? `"${value}"` : 
                       String(value);
    
    return configContent.replace(fieldRegex, `$1${replacement}`);
  }

  // Clear cache when needed
  clearCache(workspacePath?: string): void {
    if (workspacePath) {
      this.configCache.delete(workspacePath);
    } else {
      this.configCache.clear();
    }
  }
}

export default ConfigManager; 