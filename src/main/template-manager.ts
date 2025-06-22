import { PostTemplate, TemplateVariable, TemplateFilters, MarkdownFile, StagedPost, Platform } from '../types';
import { TemplateEngine } from './template-engine';
import { DataManager } from './data-manager';

export class TemplateManager {
  private templateEngine: TemplateEngine;
  private dataManager: DataManager;

  constructor(dataManager: DataManager) {
    this.templateEngine = new TemplateEngine();
    this.dataManager = dataManager;
  }

  /**
   * Create a new template
   */
  async createTemplate(
    template: Omit<PostTemplate, "id" | "createdAt" | "updatedAt">
  ): Promise<PostTemplate> {
    const newTemplate: PostTemplate = {
      ...template,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Validate template syntax
    const validation = this.templateEngine.validateTemplate(template.template);
    if (!validation.isValid) {
      throw new Error(`Invalid template syntax: ${validation.errors.join(', ')}`);
    }

    // Save template
    const broadcastData = await this.dataManager.loadBroadcastDataV2();
    broadcastData.templates.push(newTemplate);
    await this.dataManager.saveBroadcastDataV2(broadcastData);

    return newTemplate;
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    id: string,
    updates: Partial<PostTemplate>
  ): Promise<PostTemplate> {
    const broadcastData = await this.dataManager.loadBroadcastDataV2();
    const templateIndex = broadcastData.templates.findIndex(t => t.id === id);
    
    if (templateIndex === -1) {
      throw new Error(`Template with id ${id} not found`);
    }

    // Validate template syntax if template string is being updated
    if (updates.template) {
      const validation = this.templateEngine.validateTemplate(updates.template);
      if (!validation.isValid) {
        throw new Error(`Invalid template syntax: ${validation.errors.join(', ')}`);
      }
    }

    const currentTemplate = broadcastData.templates[templateIndex];
    if (!currentTemplate) {
      throw new Error(`Template with id ${id} not found`);
    }

    const updatedTemplate: PostTemplate = {
      ...currentTemplate,
      ...updates,
      id: currentTemplate.id,
      updatedAt: new Date().toISOString(),
    };

    broadcastData.templates[templateIndex] = updatedTemplate;
    await this.dataManager.saveBroadcastDataV2(broadcastData);

    return updatedTemplate;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<void> {
    const broadcastData = await this.dataManager.loadBroadcastDataV2();
    const initialLength = broadcastData.templates.length;
    
    broadcastData.templates = broadcastData.templates.filter(t => t.id !== id);
    
    if (broadcastData.templates.length === initialLength) {
      throw new Error(`Template with id ${id} not found`);
    }

    await this.dataManager.saveBroadcastDataV2(broadcastData);
  }

  /**
   * Get a template by ID
   */
  async getTemplate(id: string): Promise<PostTemplate | null> {
    const broadcastData = await this.dataManager.loadBroadcastDataV2();
    return broadcastData.templates.find(t => t.id === id) || null;
  }

  /**
   * List templates with optional filters
   */
  async listTemplates(filters?: TemplateFilters): Promise<PostTemplate[]> {
    const broadcastData = await this.dataManager.loadBroadcastDataV2();
    let templates = [...broadcastData.templates];

    if (filters) {
      if (filters.tags && filters.tags.length > 0) {
        templates = templates.filter(template =>
          filters.tags!.some(tag => template.tags.includes(tag))
        );
      }

      if (filters.platforms && filters.platforms.length > 0) {
        templates = templates.filter(template =>
          filters.platforms!.some(platform => template.platforms.includes(platform))
        );
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        templates = templates.filter(template =>
          template.name.toLowerCase().includes(searchLower) ||
          template.description.toLowerCase().includes(searchLower) ||
          template.template.toLowerCase().includes(searchLower)
        );
      }
    }

    // Sort by updated date, newest first
    return templates.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Apply template to a markdown file to create a staged post
   */
  async applyTemplate(
    templateId: string,
    markdownFile: MarkdownFile
  ): Promise<StagedPost> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template with id ${templateId} not found`);
    }

    // Extract variables from frontmatter
    const frontmatterVariables = await this.templateEngine.extractFrontmatterVariables(markdownFile.filePath);
    
    // Prepare variables with computed values
    const variables: Record<string, string> = { ...frontmatterVariables };
    
    // Add computed variables
    if (!variables.url) {
      variables.url = this.templateEngine.generateFileUrl(markdownFile.filePath);
    }
    
    // Format date if present
    if (variables.date) {
      const date = new Date(variables.date);
      if (!isNaN(date.getTime())) {
        variables.date = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    }

    // Render template with variables
    const baseContent = this.templateEngine.renderTemplate(template.template, variables);

    // Create platform-specific content
    const platformContent = {} as StagedPost['platformContent'];
    
    // Initialize all platforms
    const allPlatforms: Platform[] = ['bluesky', 'farcaster', 'twitter', 'x'];
    for (const platform of allPlatforms) {
      platformContent[platform] = {
        content: baseContent,
        enabled: template.platforms.includes(platform),
      };
    }

    // Create staged post
    const stagedPost: StagedPost = {
      id: this.generateId(),
      sourceType: 'template',
      sourceData: {
        filePath: markdownFile.filePath,
        templateId: template.id,
        variables,
      },
      platformContent,
      baseContent,
      title: markdownFile.title,
      description: frontmatterVariables.description || frontmatterVariables.subtitle || '',
      tags: this.extractTags(frontmatterVariables.tags),
      status: 'staged',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return stagedPost;
  }

  /**
   * Preview template with variables
   */
  previewTemplate(
    templateId: string,
    variables: Record<string, string>
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const template = await this.getTemplate(templateId);
        if (!template) {
          reject(new Error(`Template with id ${templateId} not found`));
          return;
        }

        const preview = this.templateEngine.renderTemplate(template.template, variables);
        resolve(preview);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get default templates
   */
  getDefaultTemplates(): PostTemplate[] {
    return [
      {
        id: 'article-announcement',
        name: 'Article Announcement',
        description: 'Announce a new article or blog post',
        template: `{{title}} by {{author}}, published {{date}}

{{description}}

{{url}}`,
        variables: [
          { key: 'title', label: 'Title', type: 'text', required: true, source: 'frontmatter', frontmatterKey: 'title' },
          { key: 'author', label: 'Author', type: 'text', required: false, source: 'frontmatter', frontmatterKey: 'author' },
          { key: 'date', label: 'Date', type: 'date', required: true, source: 'frontmatter', frontmatterKey: 'date' },
          { key: 'description', label: 'Description', type: 'text', required: true, source: 'frontmatter', frontmatterKey: 'description' },
          { key: 'url', label: 'URL', type: 'url', required: true, source: 'computed' }
        ],
        platforms: ['bluesky', 'farcaster', 'twitter'] as Platform[],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ['article', 'announcement']
      },
      {
        id: 'project-update',
        name: 'Project Update',
        description: 'Share updates about ongoing projects',
        template: `🚀 {{title}}

{{description}}

{{url}}`,
        variables: [
          { key: 'title', label: 'Update Title', type: 'text', required: true, source: 'frontmatter', frontmatterKey: 'title' },
          { key: 'description', label: 'Description', type: 'text', required: true, source: 'frontmatter', frontmatterKey: 'subtitle' },
          { key: 'url', label: 'URL', type: 'url', required: false, source: 'computed' }
        ],
        platforms: ['bluesky', 'farcaster', 'twitter'] as Platform[],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ['project', 'update']
      }
    ];
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  /**
   * Extract tags from frontmatter tags field
   */
  private extractTags(tagsValue: string | string[] | undefined): string[] {
    if (!tagsValue) return [];
    
    if (Array.isArray(tagsValue)) {
      return tagsValue.filter(tag => typeof tag === 'string');
    }
    
    if (typeof tagsValue === 'string') {
      // Handle comma-separated or space-separated tags
      return tagsValue.split(/[,\s]+/).filter(tag => tag.trim().length > 0);
    }
    
    return [];
  }
} 