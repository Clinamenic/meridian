/**
 * Site Template System Type Definitions
 * 
 * Core types for Meridian's site template management system supporting
 * GitHub, Protocol.land, and custom git repositories.
 */

/**
 * Supported template source types
 */
export type TemplateSourceType = 'github' | 'protocol-land' | 'custom-git';

/**
 * Template source definition
 */
export interface TemplateSource {
  id: string;
  name: string;
  type: TemplateSourceType;
  url: string;
  branch?: string;
  description: string;
  isDefault?: boolean; // Flag for vanilla Quartz template
}

/**
 * Template URL validation result
 */
export interface TemplateValidation {
  isValid: boolean;
  error?: string;
  detectedType?: TemplateSourceType;
  repoInfo?: {
    owner?: string;
    repo?: string;
    branch?: string;
  };
}

/**
 * Template cloning operation result
 */
export interface TemplateCloneResult {
  success: boolean;
  error?: string;
  path?: string;
  templateSource: TemplateSource;
}

/**
 * Template repository validation result
 */
export interface TemplateRepositoryValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  hasRequiredFiles: boolean;
  requiredFiles: {
    'quartz.config.ts': boolean;
    'quartz.layout.ts': boolean;
    'package.json': boolean;
  };
  optionalFiles: {
    'quartz/': boolean;
    'static/': boolean;
  };
}

/**
 * Protocol.land specific configuration
 */
export interface ProtocolLandConfig {
  walletPath?: string;
  thresholdCost?: number;
  repoId?: string;
  username?: string;
}

/**
 * Site configuration change categorization
 */
export interface ConfigurationChanges {
  safeChanges: ConfigurationChange[];
  destructiveChanges: ConfigurationChange[];
}

/**
 * Individual configuration change
 */
export interface ConfigurationChange {
  field: string;
  oldValue: any;
  newValue: any;
  requiresReinitialization: boolean;
  description: string;
}

/**
 * Template initialization options
 */
export interface TemplateInitializationOptions {
  templateSource: TemplateSource;
  workspacePath: string;
  siteSettings: any; // Will reference SiteSettings from main types
  forceReinitialization?: boolean;
} 