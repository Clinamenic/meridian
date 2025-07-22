import { promises as fs } from 'fs';
import * as path from 'path';
import { TemplateRepositoryValidation } from '../types/site-template-types';

/**
 * Site Template Validator
 * 
 * Validates Quartz template repositories to ensure they contain
 * the required files and structure for Meridian compatibility.
 */
export class SiteTemplateValidator {
  private static instance: SiteTemplateValidator;

  /**
   * Get singleton instance
   */
  static getInstance(): SiteTemplateValidator {
    if (!SiteTemplateValidator.instance) {
      SiteTemplateValidator.instance = new SiteTemplateValidator();
    }
    return SiteTemplateValidator.instance;
  }

  /**
   * Validate a template repository structure
   */
  async validateTemplate(templatePath: string): Promise<TemplateRepositoryValidation> {
    console.log(`[SiteTemplateValidator] Validating template at: ${templatePath}`);

    const validation: TemplateRepositoryValidation = {
      isValid: true,
      errors: [],
      warnings: [],
      hasRequiredFiles: true,
      requiredFiles: {
        'quartz.config.ts': false,
        'quartz.layout.ts': false,
        'package.json': false,
      },
      optionalFiles: {
        'quartz/': false,
        'static/': false,
      },
    };

    try {
      // Check if template directory exists
      try {
        await fs.access(templatePath);
      } catch (error) {
        validation.isValid = false;
        validation.errors.push(`Template directory does not exist: ${templatePath}`);
        return validation;
      }

      // Check required files
      await this.checkRequiredFiles(templatePath, validation);
      
      // Check optional files/directories
      await this.checkOptionalFiles(templatePath, validation);
      
      // Validate package.json if it exists
      if (validation.requiredFiles['package.json']) {
        await this.validatePackageJson(templatePath, validation);
      }

      // Validate quartz.config.ts if it exists
      if (validation.requiredFiles['quartz.config.ts']) {
        await this.validateQuartzConfig(templatePath, validation);
      }

      // Final validation status
      validation.hasRequiredFiles = Object.values(validation.requiredFiles).every(exists => exists);
      validation.isValid = validation.hasRequiredFiles && validation.errors.length === 0;

      if (validation.isValid) {
        console.log(`[SiteTemplateValidator] Template validation passed`);
      } else {
        console.log(`[SiteTemplateValidator] Template validation failed:`, validation.errors);
      }

      return validation;

    } catch (error: any) {
      console.error(`[SiteTemplateValidator] Validation error:`, error);
      validation.isValid = false;
      validation.errors.push(`Validation failed: ${error.message}`);
      return validation;
    }
  }

  /**
   * Check for required files
   */
  private async checkRequiredFiles(templatePath: string, validation: TemplateRepositoryValidation): Promise<void> {
    const requiredFiles = Object.keys(validation.requiredFiles);

    for (const file of requiredFiles) {
      const filePath = path.join(templatePath, file);
      try {
        await fs.access(filePath);
        validation.requiredFiles[file as keyof typeof validation.requiredFiles] = true;
        console.log(`[SiteTemplateValidator] Found required file: ${file}`);
      } catch (error) {
        validation.requiredFiles[file as keyof typeof validation.requiredFiles] = false;
        validation.errors.push(`Missing required file: ${file}`);
        console.log(`[SiteTemplateValidator] Missing required file: ${file}`);
      }
    }
  }

  /**
   * Check for optional files and directories
   */
  private async checkOptionalFiles(templatePath: string, validation: TemplateRepositoryValidation): Promise<void> {
    const optionalFiles = Object.keys(validation.optionalFiles);

    for (const file of optionalFiles) {
      const filePath = path.join(templatePath, file);
      try {
        const stats = await fs.stat(filePath);
        validation.optionalFiles[file as keyof typeof validation.optionalFiles] = true;
        
        if (stats.isDirectory()) {
          console.log(`[SiteTemplateValidator] Found optional directory: ${file}`);
        } else {
          console.log(`[SiteTemplateValidator] Found optional file: ${file}`);
        }
      } catch (error) {
        validation.optionalFiles[file as keyof typeof validation.optionalFiles] = false;
        validation.warnings.push(`Optional file/directory not found: ${file}`);
      }
    }
  }

  /**
   * Validate package.json structure
   */
  private async validatePackageJson(templatePath: string, validation: TemplateRepositoryValidation): Promise<void> {
    const packageJsonPath = path.join(templatePath, 'package.json');
    
    try {
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      // Check for basic required fields
      if (!packageJson.name) {
        validation.warnings.push('package.json missing name field');
      }

      if (!packageJson.scripts) {
        validation.warnings.push('package.json missing scripts section');
      } else {
        // Check for common Quartz scripts
        const expectedScripts = ['build', 'preview'];
        for (const script of expectedScripts) {
          if (!packageJson.scripts[script]) {
            validation.warnings.push(`package.json missing '${script}' script`);
          }
        }
      }

      if (!packageJson.dependencies && !packageJson.devDependencies) {
        validation.warnings.push('package.json missing dependencies sections');
      }

      console.log(`[SiteTemplateValidator] package.json validation completed`);

    } catch (error: any) {
      validation.errors.push(`Invalid package.json: ${error.message}`);
    }
  }

  /**
   * Validate quartz.config.ts structure
   */
  private async validateQuartzConfig(templatePath: string, validation: TemplateRepositoryValidation): Promise<void> {
    const configPath = path.join(templatePath, 'quartz.config.ts');
    
    try {
      const configContent = await fs.readFile(configPath, 'utf-8');

      // Basic syntax checks for Quartz config
      if (!configContent.includes('QuartzConfig')) {
        validation.warnings.push('quartz.config.ts may not be a valid Quartz configuration');
      }

      if (!configContent.includes('configuration')) {
        validation.warnings.push('quartz.config.ts missing configuration export');
      }

      if (!configContent.includes('plugins')) {
        validation.warnings.push('quartz.config.ts missing plugins configuration');
      }

      console.log(`[SiteTemplateValidator] quartz.config.ts validation completed`);

    } catch (error: any) {
      validation.errors.push(`Failed to read quartz.config.ts: ${error.message}`);
    }
  }

  /**
   * Quick validation check - just verify required files exist
   */
  async quickValidate(templatePath: string): Promise<boolean> {
    const requiredFiles = ['quartz.config.ts', 'package.json'];
    
    try {
      for (const file of requiredFiles) {
        const filePath = path.join(templatePath, file);
        await fs.access(filePath);
      }
      return true;
    } catch (error) {
      return false;
    }
  }
} 