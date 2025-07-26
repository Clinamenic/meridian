import { TemplateSource, TemplateValidation, TemplateSourceType } from '../types/site-template-types';

/**
 * Site Template Manager
 * 
 * Manages Quartz templates for Meridian sites, supporting:
 * - Default vanilla Quartz template
 * - Custom GitHub repositories
 * - Protocol.land repositories
 * - Generic Git repositories
 */
export class SiteTemplateManager {
  private static instance: SiteTemplateManager;

  /**
   * Get singleton instance
   */
  static getInstance(): SiteTemplateManager {
    if (!SiteTemplateManager.instance) {
      SiteTemplateManager.instance = new SiteTemplateManager();
    }
    return SiteTemplateManager.instance;
  }

  /**
   * Get default vanilla Quartz template
   */
  async getDefaultTemplate(): Promise<TemplateSource> {
    return {
      id: 'vanilla-quartz',
      name: 'Vanilla Quartz',
      type: 'github' as const,
      url: 'https://github.com/Clinamenic/meridian-quartz.git',
      branch: 'meridian-main',
      description: 'Default Meridian-Quartz template',
      isDefault: true,
    };
  }

  /**
   * Get Clinamenic Quartz template
   */
  async getClinamenicTemplate(): Promise<TemplateSource> {
    return {
      id: 'clinamenic-quartz',
      name: 'Clinamenic Quartz',
      type: 'github' as const,
      url: 'https://github.com/Clinamenic/meridian-quartz-clinamenic.git',
      branch: 'meridian-main',
      description: 'Clinamenic-optimized Meridian-Quartz template with enhanced features',
      isDefault: false,
    };
  }

  /**
   * Get template by ID
   */
  async getTemplateById(templateId: string): Promise<TemplateSource | null> {
    switch (templateId) {
      case 'vanilla-quartz':
        return await this.getDefaultTemplate();
      case 'clinamenic-quartz':
        return await this.getClinamenicTemplate();
      default:
        return null;
    }
  }

  /**
   * Validate and parse a custom template URL
   */
  async validateCustomUrl(url: string): Promise<TemplateValidation> {
    if (!url || url.trim().length === 0) {
      return {
        isValid: false,
        error: 'URL cannot be empty',
      };
    }

    const trimmedUrl = url.trim();

    try {
      // Detect URL type and validate
      if (this.isGitHubUrl(trimmedUrl)) {
        return await this.validateGitHubUrl(trimmedUrl);
      } else if (this.isProtocolLandUrl(trimmedUrl)) {
        return await this.validateProtocolLandUrl(trimmedUrl);
      } else if (this.isGenericGitUrl(trimmedUrl)) {
        return await this.validateGenericGitUrl(trimmedUrl);
      } else {
        return {
          isValid: false,
          error: 'Unsupported URL format. Please use GitHub, Protocol.land (proland://), or generic Git URLs.',
        };
      }
    } catch (error: any) {
      console.error('[SiteTemplateManager] URL validation error:', error);
      return {
        isValid: false,
        error: `Validation failed: ${error.message}`,
      };
    }
  }

  /**
   * Parse a validated URL into a TemplateSource
   */
  async parseRepositoryUrl(url: string): Promise<TemplateSource> {
    const validation = await this.validateCustomUrl(url);
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid URL');
    }

    const trimmedUrl = url.trim();
    const detectedType = validation.detectedType!;
    const repoInfo = validation.repoInfo!;

    // Generate template ID and name
    const templateId = this.generateTemplateId(trimmedUrl, detectedType);
    const templateName = this.generateTemplateName(repoInfo, detectedType);

    return {
      id: templateId,
      name: templateName,
      type: detectedType,
      url: trimmedUrl,
      branch: repoInfo.branch || 'main',
      description: `Custom ${detectedType} template`,
      isDefault: false,
    };
  }

  /**
   * Check if URL is a GitHub repository
   */
  private isGitHubUrl(url: string): boolean {
    const githubPatterns = [
      /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+/,
      /^git@github\.com:[\w\-\.]+\/[\w\-\.]+/,
      /^github\.com\/[\w\-\.]+\/[\w\-\.]+/,
    ];

    return githubPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Check if URL is a Protocol.land repository
   */
  private isProtocolLandUrl(url: string): boolean {
    const protocolLandPatterns = [
      /^proland:\/\/[\w\-]+\/[\w\-]+/, // proland://username/repo
      /^proland:\/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/, // proland://repo-id
    ];

    return protocolLandPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Check if URL is a generic Git repository
   */
  private isGenericGitUrl(url: string): boolean {
    const gitPatterns = [
      /^https:\/\/.*\.git$/,
      /^git:\/\//,
      /^ssh:\/\/git@/,
      /\.git$/,
    ];

    return gitPatterns.some(pattern => pattern.test(url)) && 
           !this.isGitHubUrl(url) && 
           !this.isProtocolLandUrl(url);
  }

  /**
   * Validate GitHub URL format and extract repository information
   */
  private async validateGitHubUrl(url: string): Promise<TemplateValidation> {
    const githubRegex = /^(?:https:\/\/github\.com\/|git@github\.com:|github\.com\/)?([\w\-\.]+)\/([\w\-\.]+)(?:\.git)?(?:\/tree\/([\w\-\/\.]+))?/;
    const match = url.match(githubRegex);

    if (!match) {
      return {
        isValid: false,
        error: 'Invalid GitHub URL format. Expected: https://github.com/owner/repo',
      };
    }

    const [, owner, repo, branch] = match;

    return {
      isValid: true,
      detectedType: 'github',
      repoInfo: {
        owner,
        repo,
        branch: branch || 'main',
      },
    };
  }

  /**
   * Validate Protocol.land URL format and extract repository information
   */
  private async validateProtocolLandUrl(url: string): Promise<TemplateValidation> {
    // Handle username/repo format
    const usernameRepoRegex = /^proland:\/\/([\w\-]+)\/([\w\-]+)/;
    const usernameRepoMatch = url.match(usernameRepoRegex);

    if (usernameRepoMatch) {
      const [, username, repo] = usernameRepoMatch;
      return {
        isValid: true,
        detectedType: 'protocol-land',
        repoInfo: {
          owner: username,
          repo,
          branch: 'main',
        },
      };
    }

    // Handle repo ID format
    const repoIdRegex = /^proland:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;
    const repoIdMatch = url.match(repoIdRegex);

    if (repoIdMatch) {
      const [, repoId] = repoIdMatch;
      return {
        isValid: true,
        detectedType: 'protocol-land',
        repoInfo: {
          repo: repoId,
          branch: 'main',
        },
      };
    }

    return {
      isValid: false,
      error: 'Invalid Protocol.land URL format. Expected: proland://username/repo or proland://repo-id',
    };
  }

  /**
   * Validate generic Git URL format
   */
  private async validateGenericGitUrl(url: string): Promise<TemplateValidation> {
    try {
      const parsedUrl = new URL(url);
      const pathParts = parsedUrl.pathname.split('/').filter(part => part.length > 0);
      
      if (pathParts.length < 1) {
        return {
          isValid: false,
          error: 'Invalid Git URL: cannot determine repository name',
        };
      }

      const lastPart = pathParts[pathParts.length - 1];
      if (!lastPart) {
        return {
          isValid: false,
          error: 'Invalid Git URL: cannot determine repository name',
        };
      }

      const repoName = lastPart.replace(/\.git$/, '');

      return {
        isValid: true,
        detectedType: 'custom-git',
        repoInfo: {
          repo: repoName,
          branch: 'main',
        },
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid URL format',
      };
    }
  }

  /**
   * Generate unique template ID from URL and type
   */
  private generateTemplateId(url: string, type: TemplateSourceType): string {
    const urlHash = Buffer.from(url).toString('base64').slice(0, 8);
    return `custom-${type}-${urlHash}`;
  }

  /**
   * Generate human-readable template name from repository info
   */
  private generateTemplateName(repoInfo: any, type: TemplateSourceType): string {
    if (!repoInfo) {
      return `Custom ${type} template`;
    }
    
    if (repoInfo.owner && repoInfo.repo) {
      return `${repoInfo.owner}/${repoInfo.repo}`;
    } else if (repoInfo.repo) {
      return repoInfo.repo;
    } else {
      return `Custom ${type} template`;
    }
  }
} 