import { randomUUID } from 'crypto';
import { CredentialManager } from './credential-manager';
import { GitHubAccount, TokenValidationResult } from '../types';

export class GitHubManager {
  private credentialManager: CredentialManager;

  constructor() {
    this.credentialManager = CredentialManager.getInstance();
  }

  /**
   * Generate a pre-configured GitHub token request URL
   * This creates a link that will pre-fill all the necessary permissions
   * and settings when the user creates their token.
   */
  generateTokenRequestUrl(repositoryName?: string): string {
    // Base URL for fine-grained token creation
    const baseUrl = 'https://github.com/settings/personal-access-tokens/new';

    // Required permissions for Meridian deployment
    const permissions = {
      contents: 'write',      // Required for pushing content
      pages: 'write',         // Required for GitHub Pages configuration
      metadata: 'read',       // Required for repository information
      workflows: 'write'      // Required for GitHub Actions setup
    };

    // Build the query parameters
    const params = new URLSearchParams({
      description: 'Meridian Quartz Deployment',
      scopes: JSON.stringify(permissions),
      repository_ids: repositoryName || '',  // If provided, pre-select the repository
      type: 'fine-grained',
      name: 'Meridian Deploy Token'
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Start the GitHub account addition process
   * Returns a URL for the user to create a properly configured token
   */
  async startAccountAddition(repositoryName?: string): Promise<{
    url: string;
    message: string;
  }> {
    const url = this.generateTokenRequestUrl(repositoryName);
    
    return {
      url,
      message: `Please follow these steps:
1. Click the link to open GitHub's token creation page
2. Review the pre-configured permissions (they're the minimum required for deployment)
3. Select the repository you want to deploy to
4. Set an expiration date (recommended: 90 days)
5. Click "Generate token"
6. Copy the generated token and paste it back in Meridian`
    };
  }

  /**
   * Add a new GitHub account with validation
   */
  async addAccount(
    token: string, 
    nickname?: string,
    repositoryName?: string
  ): Promise<GitHubAccount> {
    try {
      console.log('Adding GitHub account...');
      
      // Validate token and get user info
      const validation = await this.validateToken(token);
      
      if (!validation.isValid) {
        throw new Error('Invalid GitHub token');
      }

      // Verify this is a fine-grained token
      if (validation.tokenType !== "fine-grained") {
        throw new Error(
          'Please use the "Create Token" button to generate a fine-grained token. ' +
          'Classic tokens are not recommended for security reasons.'
        );
      }

      // If repository was specified, verify it's accessible
      if (repositoryName && !validation.repositories.includes(repositoryName)) {
        throw new Error(
          `Token does not have access to repository "${repositoryName}". ` +
          'Please ensure you selected the correct repository when creating the token.'
        );
      }

      // Generate nickname if not provided
      const accountNickname = nickname || `${validation.username} (${validation.repositories[0] || 'No repos'})`;
      
      // Check for duplicate accounts
      const existingAccounts = await this.listAccounts();
      const duplicateAccount = existingAccounts.find(account => account.username === validation.username);
      if (duplicateAccount) {
        throw new Error(`GitHub account @${validation.username} already exists as "${duplicateAccount.nickname}"`);
      }

      // Create account object
      const accountId = randomUUID();
      const now = new Date().toISOString();
      const account: GitHubAccount = {
        id: accountId,
        nickname: accountNickname,
        username: validation.username,
        tokenType: "fine-grained",
        repositories: validation.repositories,
        expiresAt: validation.expiresAt,
        createdAt: now,
        lastUsed: now,
      };

      // Store account metadata
      const accounts = await this.listAccounts();
      accounts.push(account);
      await this.credentialManager.setCredential("github", "accounts", JSON.stringify(accounts));

      // Store credentials with account-specific keys
      await this.credentialManager.setCredential("github", `token:${accountId}`, token);
      await this.credentialManager.setCredential("github", `account:${accountId}`, JSON.stringify(account));

      console.log(`GitHub account added: ${account.nickname} (@${account.username})`);
      return account;

    } catch (error) {
      console.error('Failed to add GitHub account:', error);
      throw error;
    }
  }

  /**
   * Validate GitHub token and determine type
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      console.log('Validating GitHub token...');
      
      // Test token validity and get user info
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Invalid GitHub token: ${response.status} ${errorText}`);
      }

      const user = await response.json();

      // Get token metadata to properly detect fine-grained tokens
      const metaResponse = await fetch("https://api.github.com/meta/public_keys/token_scanning", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      });

      // Detect token type by checking scopes header and response
      const scopes = response.headers.get("X-OAuth-Scopes") || "";
      const tokenScopes = scopes.split(',').map(s => s.trim()).filter(Boolean);
      
      // Fine-grained tokens have a different format in the OAuth scopes header
      // They typically show repository-specific permissions instead of broad scopes
      const isFineGrained = tokenScopes.length === 0 || 
                           !tokenScopes.includes("repo") ||
                           tokenScopes.some(s => s.includes(':'));
      
      const tokenType = isFineGrained ? "fine-grained" : "classic";
      console.log(`Detected token type: ${tokenType}`);
      console.log(`Token scopes: ${tokenScopes.join(', ') || 'none (fine-grained)'}`);

      // Get accessible repositories
      let repositories: string[] = [];
      try {
        repositories = await this.getAccessibleRepositories(token);
        console.log(`Found ${repositories.length} accessible repositories`);
      } catch (error) {
        console.warn('Could not fetch repositories:', error);
        repositories = [];
      }

      // Generate security warnings and recommendations
      const securityWarnings = this.generateSecurityWarnings(tokenType, tokenScopes);
      const recommendations = this.generateRecommendations(tokenType, tokenScopes);

      return {
        isValid: true,
        tokenType,
        username: user.login,
        scopes: tokenScopes,
        repositories,
        expiresAt: undefined, // GitHub doesn't expose expiration in API
        securityWarnings,
        recommendations,
      };

    } catch (error) {
      console.error('Token validation failed:', error);
      return {
        isValid: false,
        tokenType: "classic",
        username: "",
        scopes: [],
        repositories: [],
        securityWarnings: [error instanceof Error ? error.message : "Unknown error"],
        recommendations: [],
      };
    }
  }

  /**
   * Get accessible repositories for fine-grained tokens
   */
  private async getAccessibleRepositories(token: string): Promise<string[]> {
    try {
      console.log('Fetching accessible repositories...');
      
      // For fine-grained tokens, get repository permissions directly
      const response = await fetch("https://api.github.com/user/repos?type=all&sort=updated&per_page=100", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      });

      if (!response.ok) {
        console.warn('Failed to fetch repositories:', response.status, await response.text());
        return [];
      }

      const repos = await response.json();
      console.log(`Found ${repos.length} total repositories`);

      const accessibleRepos: string[] = [];

      // Check each repository's permissions
      for (const repo of repos) {
        try {
          // Get specific repository permissions
          const permResponse = await fetch(`https://api.github.com/repos/${repo.full_name}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github.v3+json",
              "X-GitHub-Api-Version": "2022-11-28"
            }
          });

          if (permResponse.ok) {
            const repoData = await permResponse.json();
            // Check if we have any write permissions
            if (repoData.permissions && (repoData.permissions.push || repoData.permissions.admin)) {
              console.log(`Found accessible repository: ${repo.full_name}`);
              accessibleRepos.push(repo.full_name);
            }
          }
        } catch (error) {
          console.warn(`Failed to check permissions for ${repo.full_name}:`, error);
          continue;
        }
      }

      console.log(`Found ${accessibleRepos.length} accessible repositories`);
      return accessibleRepos;

    } catch (error) {
      console.error('Could not get accessible repositories:', error);
      return [];
    }
  }

  /**
   * Get user repositories for classic tokens
   */
  private async getUserRepositories(token: string): Promise<string[]> {
    try {
      const response = await fetch("https://api.github.com/user/repos?type=all&sort=updated&per_page=50", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      });

      if (!response.ok) {
        return [];
      }

      const repos = await response.json();
      return repos.map((repo: any) => repo.full_name);

    } catch (error) {
      console.warn('Could not get user repositories:', error);
      return [];
    }
  }

  /**
   * Generate security warnings based on token type and scopes
   */
  private generateSecurityWarnings(tokenType: string, scopes: string[]): string[] {
    const warnings = [];

    if (tokenType === "classic") {
      warnings.push("Classic token grants access to ALL your repositories");

      if (scopes.includes("admin:repo_hook")) {
        warnings.push("Token can modify repository webhooks");
      }

      if (scopes.includes("delete_repo")) {
        warnings.push("Token can delete repositories");
      }

      if (scopes.includes("admin:org")) {
        warnings.push("Token has organization admin permissions");
      }
    }

    return warnings;
  }

  /**
   * Generate recommendations based on token analysis
   */
  private generateRecommendations(tokenType: string, scopes: string[]): string[] {
    const recommendations = [];

    if (tokenType === "classic") {
      recommendations.push("Consider using fine-grained PAT for better security");
      recommendations.push("Limit token to specific repositories");
      recommendations.push("Set shorter expiration period");
    } else {
      recommendations.push("Good choice! Fine-grained tokens provide better security");
      recommendations.push("Consider setting a 90-day expiration");
    }

    return recommendations;
  }

  /**
   * List all GitHub accounts
   */
  async listAccounts(): Promise<GitHubAccount[]> {
    try {
      const accountsData = await this.credentialManager.getCredential("github", "accounts");
      if (!accountsData) {
        return [];
      }

      const accounts: GitHubAccount[] = JSON.parse(accountsData);
      return accounts;

    } catch (error) {
      console.error('Failed to list GitHub accounts:', error);
      return [];
    }
  }

  /**
   * Get specific GitHub account by ID
   */
  async getAccount(accountId: string): Promise<GitHubAccount | null> {
    try {
      const accountData = await this.credentialManager.getCredential("github", `account:${accountId}`);
      if (!accountData) {
        return null;
      }

      return JSON.parse(accountData);

    } catch (error) {
      console.error('Failed to get GitHub account:', error);
      return null;
    }
  }

  /**
   * Get token for specific account
   */
  async getToken(accountId: string): Promise<string | null> {
    try {
      return await this.credentialManager.getCredential("github", `token:${accountId}`);
    } catch (error) {
      console.error('Failed to get GitHub token:', error);
      return null;
    }
  }

  /**
   * Remove GitHub account
   */
  async removeAccount(accountId: string): Promise<void> {
    try {
      // Remove from accounts list
      const accounts = await this.listAccounts();
      const filteredAccounts = accounts.filter(account => account.id !== accountId);
      await this.credentialManager.setCredential("github", "accounts", JSON.stringify(filteredAccounts));

      // Remove individual credentials
      await this.credentialManager.removeCredential("github", `token:${accountId}`);
      await this.credentialManager.removeCredential("github", `account:${accountId}`);

      console.log(`GitHub account removed: ${accountId}`);

    } catch (error) {
      console.error('Failed to remove GitHub account:', error);
      throw error;
    }
  }

  /**
   * Create a new GitHub repository
   */
  async createRepository(owner: string, repoName: string, token: string, isPrivate: boolean = false): Promise<void> {
    try {
      const response = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28"
        },
        body: JSON.stringify({
          name: repoName,
          description: "Meridian Quartz site",
          private: isPrivate,
          has_pages: true,
          auto_init: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create repository: ${errorData.message || response.statusText}`);
      }

      console.log(`Repository created: ${owner}/${repoName}`);

    } catch (error) {
      console.error('Failed to create repository:', error);
      throw error;
    }
  }

  /**
   * Check if repository exists
   */
  async repositoryExists(owner: string, repoName: string, token: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      });

      return response.ok;

    } catch (error) {
      return false;
    }
  }

  /**
   * Validate account token before use
   */
  async validateAccountToken(accountId: string): Promise<{
    isValid: boolean;
    tokenType: "classic" | "fine-grained";
    expirationWarning?: string;
    securityWarning?: string;
  }> {
    try {
      const token = await this.getToken(accountId);
      if (!token) {
        return { isValid: false, tokenType: "classic" };
      }

      const validation = await this.validateToken(token);

      const warnings = [];
      if (validation.tokenType === "classic") {
        warnings.push("Classic token grants broad access - consider fine-grained PAT");
      }

             // Filter token type to match return type expectations
       const tokenType = validation.tokenType === "github-app" ? "classic" : validation.tokenType;
       
       return {
         isValid: validation.isValid,
         tokenType,
         securityWarning: validation.tokenType === "classic" ? warnings[0] : undefined,
         expirationWarning: undefined // GitHub doesn't expose expiration
       };

    } catch (error) {
      console.error('Failed to validate account token:', error);
      return { isValid: false, tokenType: "classic" };
    }
  }
} 