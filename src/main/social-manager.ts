import { BskyAgent } from '@atproto/api';
import { Platform, SocialPost, PostStatus } from '../types';
import { CredentialManager } from './credential-manager';

export interface PostResult {
  success: boolean;
  postId?: string;
  error?: string;
}

export class SocialManager {
  private credentialManager: CredentialManager;
  private blueskyAgent?: BskyAgent;

  constructor() {
    this.credentialManager = CredentialManager.getInstance();
  }

  /**
   * Authenticate with a platform
   */
  public async authenticatePlatform(platform: Platform, credentials: Record<string, string>): Promise<boolean> {
    try {
      await this.credentialManager.setPlatformCredentials(platform, credentials);
      
      switch (platform) {
        case 'bluesky':
          return await this.authenticateBluesky(credentials);
        case 'farcaster':
          return await this.authenticateFarcaster(credentials);
        case 'twitter':
          return await this.authenticateTwitter(credentials);
        default:
          return false;
      }
    } catch (error) {
      console.error(`Failed to authenticate with ${platform}:`, error);
      return false;
    }
  }

  /**
   * Post content to a specific platform
   */
  public async postToPlatform(postId: string, platform: Platform): Promise<PostResult> {
    try {
      // This would load the post from data manager
      // For now, we'll accept the post content directly
      switch (platform) {
        case 'bluesky':
          return await this.postToBluesky(postId);
        case 'farcaster':
          return await this.postToFarcaster(postId);
        case 'twitter':
          return await this.postToTwitter(postId);
        default:
          return { success: false, error: `Unsupported platform: ${platform}` };
      }
    } catch (error) {
      console.error(`Failed to post to ${platform}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Post to multiple platforms
   */
  public async postToMultiplePlatforms(postId: string, platforms: Platform[]): Promise<{ [platform: string]: PostResult }> {
    const results: { [platform: string]: PostResult } = {};
    
    for (const platform of platforms) {
      results[platform] = await this.postToPlatform(postId, platform);
    }

    return results;
  }

  // BLUESKY INTEGRATION
  private async authenticateBluesky(credentials: Record<string, string>): Promise<boolean> {
    try {
      this.blueskyAgent = new BskyAgent({
        service: 'https://bsky.social',
      });

      if (credentials.jwt && credentials.did && credentials.handle && credentials.refreshToken) {
        // Use existing JWT
        await this.blueskyAgent.resumeSession({
          did: credentials.did,
          handle: credentials.handle,
          accessJwt: credentials.jwt,
          refreshJwt: credentials.refreshToken,
          active: true,
        });
      } else if (credentials.identifier && credentials.password) {
        // Login with identifier and password
        await this.blueskyAgent.login({
          identifier: credentials.identifier,
          password: credentials.password,
        });

        // Store session tokens
        const session = this.blueskyAgent.session;
        if (session) {
          await this.credentialManager.setPlatformCredentials('bluesky', {
            jwt: session.accessJwt,
            refreshToken: session.refreshJwt,
            did: session.did,
            handle: session.handle,
          });
        }
      } else {
        throw new Error('Invalid credentials provided');
      }

      return true;
    } catch (error) {
      console.error('Bluesky authentication failed:', error);
      return false;
    }
  }

  private async postToBluesky(postId: string): Promise<PostResult> {
    try {
      if (!this.blueskyAgent) {
        // Try to authenticate with stored credentials
        const credentials = await this.credentialManager.getPlatformCredentials('bluesky');
        if (!credentials.jwt) {
          throw new Error('Bluesky not authenticated');
        }
        
        await this.authenticateBluesky(credentials);
      }

      // This would load post content from data manager
      // For now, using placeholder
      const postContent = {
        text: 'Test post from Meridian',
        createdAt: new Date().toISOString(),
      };

      const response = await this.blueskyAgent!.post(postContent);
      
      return {
        success: true,
        postId: response.uri,
      };
    } catch (error) {
      console.error('Failed to post to Bluesky:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // FARCASTER INTEGRATION
  private async authenticateFarcaster(credentials: Record<string, string>): Promise<boolean> {
    try {
      // Farcaster authentication would go here
      // This is a placeholder implementation
      console.log('Farcaster authentication not yet implemented');
      return false;
    } catch (error) {
      console.error('Farcaster authentication failed:', error);
      return false;
    }
  }

  private async postToFarcaster(postId: string): Promise<PostResult> {
    try {
      // Farcaster posting would go here
      console.log('Farcaster posting not yet implemented');
      return {
        success: false,
        error: 'Farcaster integration not yet implemented',
      };
    } catch (error) {
      console.error('Failed to post to Farcaster:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // TWITTER INTEGRATION
  private async authenticateTwitter(credentials: Record<string, string>): Promise<boolean> {
    try {
      // Twitter authentication would go here
      console.log('Twitter authentication not yet implemented');
      return false;
    } catch (error) {
      console.error('Twitter authentication failed:', error);
      return false;
    }
  }

  private async postToTwitter(postId: string): Promise<PostResult> {
    try {
      // Twitter posting would go here
      console.log('Twitter posting not yet implemented');
      return {
        success: false,
        error: 'Twitter integration not yet implemented',
      };
    } catch (error) {
      console.error('Failed to post to Twitter:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if a platform is authenticated
   */
  public async isPlatformAuthenticated(platform: Platform): Promise<boolean> {
    return await this.credentialManager.validatePlatformCredentials(platform);
  }

  /**
   * Get platform account info
   */
  public async getPlatformAccountInfo(platform: Platform): Promise<Record<string, string> | null> {
    try {
      const credentials = await this.credentialManager.getPlatformCredentials(platform);
      
      switch (platform) {
        case 'bluesky':
          return {
            handle: credentials.handle || '',
            did: credentials.did || '',
          };
        case 'farcaster':
          return {
            username: credentials.username || '',
            fid: credentials.fid || '',
          };
        case 'twitter':
          return {
            username: credentials.username || '',
            userId: credentials.userId || '',
          };
        default:
          return null;
      }
    } catch (error) {
      console.error(`Failed to get account info for ${platform}:`, error);
      return null;
    }
  }

  /**
   * Logout from a platform
   */
  public async logoutFromPlatform(platform: Platform): Promise<void> {
    try {
      const keys = await this.credentialManager.listCredentials(platform);
      for (const key of keys) {
        await this.credentialManager.removeCredential(platform, key);
      }

      // Clear local references
      if (platform === 'bluesky') {
        this.blueskyAgent = undefined as any;
      }

      console.log(`Logged out from ${platform}`);
    } catch (error) {
      console.error(`Failed to logout from ${platform}:`, error);
    }
  }
} 