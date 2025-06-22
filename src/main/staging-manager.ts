import { StagedPost, CreateStagedPostData, StagingFilters, Platform, PostResult } from '../types';
import { DataManager } from './data-manager';
import { SocialManager } from './social-manager';

export class StagingManager {
  private dataManager: DataManager;
  private socialManager: SocialManager;

  constructor(dataManager: DataManager, socialManager: SocialManager) {
    this.dataManager = dataManager;
    this.socialManager = socialManager;
  }

  /**
   * Create a new staged post
   */
  async createStagedPost(data: CreateStagedPostData): Promise<StagedPost> {
    // Initialize platform content for all platforms
    const platformContent = {} as StagedPost['platformContent'];
    const allPlatforms: Platform[] = ['bluesky', 'farcaster', 'twitter', 'x'];
    
    for (const platform of allPlatforms) {
      platformContent[platform] = {
        content: data.baseContent,
        enabled: data.platforms.includes(platform),
      };
    }

    const stagedPost: StagedPost = {
      id: this.generateId(),
      sourceType: data.sourceType,
      sourceData: data.sourceData,
      platformContent,
      baseContent: data.baseContent,
      title: data.title,
      description: data.description,
      tags: data.tags,
      status: 'staged',
      scheduledFor: data.scheduledFor,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to data store
    const broadcastData = await this.dataManager.loadBroadcastDataV2();
    broadcastData.posts.push(stagedPost);
    await this.dataManager.saveBroadcastDataV2(broadcastData);

    return stagedPost;
  }

  /**
   * Update a staged post
   */
  async updateStagedPost(
    id: string,
    updates: Partial<StagedPost>
  ): Promise<StagedPost> {
    const broadcastData = await this.dataManager.loadBroadcastDataV2();
    const postIndex = broadcastData.posts.findIndex(p => p.id === id);
    
    if (postIndex === -1) {
      throw new Error(`Staged post with id ${id} not found`);
    }

    const currentPost = broadcastData.posts[postIndex];
    if (!currentPost) {
      throw new Error(`Staged post with id ${id} not found`);
    }
    
    const updatedPost: StagedPost = {
      ...currentPost,
      ...updates,
      id: currentPost.id,
      sourceType: currentPost.sourceType,
      platformContent: currentPost.platformContent,
      baseContent: currentPost.baseContent,
      tags: currentPost.tags,
      status: currentPost.status,
      createdAt: currentPost.createdAt,
      updatedAt: new Date().toISOString(),
    };

    broadcastData.posts[postIndex] = updatedPost;
    await this.dataManager.saveBroadcastDataV2(broadcastData);

    return updatedPost;
  }

  /**
   * Delete a staged post
   */
  async deleteStagedPost(id: string): Promise<void> {
    const broadcastData = await this.dataManager.loadBroadcastDataV2();
    const initialLength = broadcastData.posts.length;
    
    broadcastData.posts = broadcastData.posts.filter(p => p.id !== id);
    
    if (broadcastData.posts.length === initialLength) {
      throw new Error(`Staged post with id ${id} not found`);
    }

    await this.dataManager.saveBroadcastDataV2(broadcastData);
  }

  /**
   * Get a staged post by ID
   */
  async getStagedPost(id: string): Promise<StagedPost | null> {
    const broadcastData = await this.dataManager.loadBroadcastDataV2();
    return broadcastData.posts.find(p => p.id === id) || null;
  }

  /**
   * List staged posts with optional filters
   */
  async listStagedPosts(filters?: StagingFilters): Promise<StagedPost[]> {
    const broadcastData = await this.dataManager.loadBroadcastDataV2();
    let posts = [...broadcastData.posts];

    if (filters) {
      if (filters.status && filters.status.length > 0) {
        posts = posts.filter(post => filters.status!.includes(post.status));
      }

      if (filters.platforms && filters.platforms.length > 0) {
        posts = posts.filter(post =>
          filters.platforms!.some(platform => 
            post.platformContent[platform]?.enabled
          )
        );
      }

      if (filters.tags && filters.tags.length > 0) {
        posts = posts.filter(post =>
          filters.tags!.some(tag => post.tags.includes(tag))
        );
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        posts = posts.filter(post =>
          post.baseContent.toLowerCase().includes(searchLower) ||
          post.title?.toLowerCase().includes(searchLower) ||
          post.description?.toLowerCase().includes(searchLower)
        );
      }

      if (filters.dateRange) {
        const startDate = new Date(filters.dateRange.start);
        const endDate = new Date(filters.dateRange.end);
        posts = posts.filter(post => {
          const postDate = new Date(post.createdAt);
          return postDate >= startDate && postDate <= endDate;
        });
      }
    }

    // Sort by updated date, newest first
    return posts.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Update platform-specific content
   */
  async updatePlatformContent(
    postId: string,
    platform: Platform,
    content: string
  ): Promise<void> {
    const post = await this.getStagedPost(postId);
    if (!post) {
      throw new Error(`Staged post with id ${postId} not found`);
    }

    post.platformContent[platform].content = content;
    await this.updateStagedPost(postId, { platformContent: post.platformContent });
  }

  /**
   * Toggle platform enabled/disabled
   */
  async togglePlatform(
    postId: string,
    platform: Platform,
    enabled: boolean
  ): Promise<void> {
    const post = await this.getStagedPost(postId);
    if (!post) {
      throw new Error(`Staged post with id ${postId} not found`);
    }

    post.platformContent[platform].enabled = enabled;
    await this.updateStagedPost(postId, { platformContent: post.platformContent });
  }

  /**
   * Bulk schedule posts
   */
  async bulkSchedule(postIds: string[], scheduledFor: string): Promise<void> {
    const broadcastData = await this.dataManager.loadBroadcastDataV2();
    
    for (const postId of postIds) {
      const postIndex = broadcastData.posts.findIndex(p => p.id === postId);
      if (postIndex !== -1) {
        const post = broadcastData.posts[postIndex];
        if (post) {
          post.scheduledFor = scheduledFor;
          post.status = 'scheduled';
          post.updatedAt = new Date().toISOString();
        }
      }
    }

    await this.dataManager.saveBroadcastDataV2(broadcastData);
  }

  /**
   * Bulk publish posts
   */
  async bulkPublish(postIds: string[]): Promise<PostResult[]> {
    const results: PostResult[] = [];
    
    for (const postId of postIds) {
      const post = await this.getStagedPost(postId);
      if (!post) {
        results.push({
          success: false,
          error: `Post ${postId} not found`,
          platform: 'bluesky', // Default platform for error
        });
        continue;
      }

      // Get enabled platforms
      const enabledPlatforms = Object.entries(post.platformContent)
        .filter(([_, config]) => config.enabled)
        .map(([platform]) => platform as Platform);

      // Post to each enabled platform
      for (const platform of enabledPlatforms) {
        try {
          const content = post.platformContent[platform].content;
          const result = await this.socialManager.postToPlatform(postId, platform);
          
          results.push({
            success: result.success,
            postId: result.postId,
            error: result.error,
            platform,
          });

          // Update post results
          if (!post.postResults) post.postResults = {};
          post.postResults[platform] = {
            success: result.success,
            postId: result.postId,
            error: result.error,
            postedAt: result.success ? new Date().toISOString() : undefined,
          };
        } catch (error) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            platform,
          });
        }
      }

      // Update post status
      const hasSuccessfulPosts = results.some(r => r.success);
      const hasFailedPosts = results.some(r => !r.success);
      
      let newStatus: StagedPost['status'] = 'posted';
      if (hasFailedPosts && !hasSuccessfulPosts) {
        newStatus = 'failed';
      } else if (hasFailedPosts && hasSuccessfulPosts) {
        newStatus = 'posted'; // Partial success still counts as posted
      }

      await this.updateStagedPost(postId, {
        status: newStatus,
        postResults: post.postResults,
      });
    }

    return results;
  }

  /**
   * Bulk delete posts
   */
  async bulkDelete(postIds: string[]): Promise<void> {
    const broadcastData = await this.dataManager.loadBroadcastDataV2();
    
    broadcastData.posts = broadcastData.posts.filter(
      post => !postIds.includes(post.id)
    );

    await this.dataManager.saveBroadcastDataV2(broadcastData);
  }

  /**
   * Get post statistics
   */
  async getPostStats(): Promise<{
    total: number;
    staged: number;
    scheduled: number;
    posted: number;
    failed: number;
    byPlatform: Record<Platform, number>;
  }> {
    const posts = await this.listStagedPosts();
    
    const stats = {
      total: posts.length,
      staged: 0,
      scheduled: 0,
      posted: 0,
      failed: 0,
      byPlatform: {
        bluesky: 0,
        farcaster: 0,
        twitter: 0,
        x: 0,
      } as Record<Platform, number>,
    };

    for (const post of posts) {
      // Count by status
      if (post.status in stats) {
        (stats as any)[post.status]++;
      }

      // Count by platform
      for (const [platform, config] of Object.entries(post.platformContent)) {
        if (config.enabled) {
          stats.byPlatform[platform as Platform]++;
        }
      }
    }

    return stats;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }
} 