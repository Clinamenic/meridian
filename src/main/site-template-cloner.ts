import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { TemplateSource, TemplateCloneResult } from '../types/site-template-types';

/**
 * Site Template Cloner
 * 
 * Handles cloning of Quartz templates from multiple sources:
 * - GitHub repositories
 * - Protocol.land repositories (via git-remote-proland)
 * - Generic Git repositories
 */
export class SiteTemplateCloner {
  private static instance: SiteTemplateCloner;

  /**
   * Get singleton instance
   */
  static getInstance(): SiteTemplateCloner {
    if (!SiteTemplateCloner.instance) {
      SiteTemplateCloner.instance = new SiteTemplateCloner();
    }
    return SiteTemplateCloner.instance;
  }

  /**
   * Clone a template repository to the specified destination
   */
  async cloneTemplate(source: TemplateSource, destination: string): Promise<TemplateCloneResult> {
    console.log(`[SiteTemplateCloner] Cloning template: ${source.name} (${source.type})`);
    console.log(`[SiteTemplateCloner] Source URL: ${source.url}`);
    console.log(`[SiteTemplateCloner] Destination: ${destination}`);

    try {
      // Ensure destination directory is clean
      await this.cleanDestination(destination);

      // Clone based on template type
      switch (source.type) {
        case 'github':
          await this.cloneGitHub(source, destination);
          break;
        case 'protocol-land':
          await this.cloneProtocolLand(source, destination);
          break;
        case 'custom-git':
          await this.cloneCustomGit(source, destination);
          break;
        default:
          throw new Error(`Unsupported template type: ${source.type}`);
      }

      // Verify clone was successful
      await this.verifyClone(destination);

      console.log(`[SiteTemplateCloner] Successfully cloned template to ${destination}`);

      return {
        success: true,
        path: destination,
        templateSource: source,
      };

    } catch (error: any) {
      console.error(`[SiteTemplateCloner] Failed to clone template:`, error);
      
      // Cleanup on failure
      try {
        await this.cleanDestination(destination);
      } catch (cleanupError) {
        console.error(`[SiteTemplateCloner] Failed to cleanup after error:`, cleanupError);
      }

      return {
        success: false,
        error: error.message,
        templateSource: source,
      };
    }
  }

  /**
   * Clone from GitHub repository
   */
  private async cloneGitHub(source: TemplateSource, destination: string): Promise<void> {
    const gitUrl = this.normalizeGitHubUrl(source.url);
    const branch = source.branch || 'main';

    console.log(`[SiteTemplateCloner] Cloning GitHub repo: ${gitUrl} (branch: ${branch})`);

    await this.executeGitClone(gitUrl, destination, branch);
  }

  /**
   * Clone from Protocol.land repository
   */
  private async cloneProtocolLand(source: TemplateSource, destination: string): Promise<void> {
    const prolandUrl = source.url;
    const branch = source.branch || 'main';

    console.log(`[SiteTemplateCloner] Cloning Protocol.land repo: ${prolandUrl} (branch: ${branch})`);

    // Check if Protocol.land git remote helper is available
    await this.checkProtocolLandSupport();

    await this.executeGitClone(prolandUrl, destination, branch);
  }

  /**
   * Clone from custom Git repository
   */
  private async cloneCustomGit(source: TemplateSource, destination: string): Promise<void> {
    const gitUrl = source.url;
    const branch = source.branch || 'main';

    console.log(`[SiteTemplateCloner] Cloning custom Git repo: ${gitUrl} (branch: ${branch})`);

    await this.executeGitClone(gitUrl, destination, branch);
  }

  /**
   * Execute git clone command
   */
  private async executeGitClone(url: string, destination: string, branch: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        'clone',
        '--branch', branch,
        '--single-branch',
        '--depth', '1', // Shallow clone for faster downloads
        url,
        destination
      ];

      console.log(`[SiteTemplateCloner] Executing: git ${args.join(' ')}`);

      const child = spawn('git', args, {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log(`[SiteTemplateCloner] Git clone completed successfully`);
          resolve();
        } else {
          const errorMessage = `Git clone failed with code ${code}. Stderr: ${stderr}. Stdout: ${stdout}`;
          console.error(`[SiteTemplateCloner] ${errorMessage}`);
          reject(new Error(errorMessage));
        }
      });

      child.on('error', (error) => {
        const errorMessage = `Failed to execute git clone: ${error.message}`;
        console.error(`[SiteTemplateCloner] ${errorMessage}`);
        reject(new Error(errorMessage));
      });
    });
  }

  /**
   * Normalize GitHub URL for git clone
   */
  private normalizeGitHubUrl(url: string): string {
    // Convert various GitHub URL formats to HTTPS clone URL
    if (url.startsWith('git@github.com:')) {
      // Convert SSH to HTTPS
      return url.replace('git@github.com:', 'https://github.com/');
    } else if (url.startsWith('github.com/')) {
      // Add https:// prefix
      return 'https://' + url;
    } else if (url.includes('github.com') && !url.endsWith('.git')) {
      // Add .git suffix if missing
      return url + '.git';
    }
    
    return url;
  }

  /**
   * Check if Protocol.land git remote helper is available
   */
  private async checkProtocolLandSupport(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Try to run git-remote-proland --version to check if it's installed
      const child = spawn('git', ['remote-proland', '--version'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log(`[SiteTemplateCloner] Protocol.land git support available`);
          resolve();
        } else {
          reject(new Error(
            'Protocol.land git remote helper not found. Please install with: npm install -g @protocol.land/git-remote-helper'
          ));
        }
      });

      child.on('error', (error) => {
        reject(new Error(
          `Failed to check Protocol.land support: ${error.message}. Please install with: npm install -g @protocol.land/git-remote-helper`
        ));
      });
    });
  }

  /**
   * Clean destination directory before cloning
   */
  private async cleanDestination(destination: string): Promise<void> {
    try {
      await fs.rm(destination, { recursive: true, force: true });
      console.log(`[SiteTemplateCloner] Cleaned destination: ${destination}`);
    } catch (error) {
      // Ignore errors if directory doesn't exist
      console.log(`[SiteTemplateCloner] Destination clean (ignoring errors): ${destination}`);
    }
  }

  /**
   * Verify that clone was successful by checking for required files
   */
  private async verifyClone(destination: string): Promise<void> {
    const requiredFiles = ['quartz.config.ts', 'package.json'];
    
    for (const file of requiredFiles) {
      const filePath = `${destination}/${file}`;
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new Error(`Template validation failed: missing required file ${file}`);
      }
    }

    console.log(`[SiteTemplateCloner] Template validation passed`);
  }
} 