# Broadcast Tool Expansion - Implementation Outline

## Overview

This document outlines the implementation plan for expanding the Broadcast tool with advanced staging, platform-specific variations, and markdown-driven template functionality.

## Current Architecture Analysis

### Existing Components

- **SocialManager**: Handles authentication and posting to platforms (Bluesky, Farcaster, Twitter)
- **DataManager**: Manages broadcast data persistence in `.cosmo/data/broadcast.json`
- **CredentialManager**: Secure credential storage and management
- **UI Components**: Post creation modal, platform indicators, post calendar

### Current Data Models

```typescript
interface SocialPost {
  id: string;
  content: string;
  platforms: Platform[];
  scheduledFor?: string;
  status: "draft" | "scheduled" | "posted" | "failed";
  mediaAttachments?: string[];
  createdAt: string;
  postedAt?: { [platform: string]: string };
}

interface BroadcastData {
  posts: SocialPost[];
  drafts: SocialPost[];
  accounts: AccountInfo;
}
```

## New Feature Requirements

### 1. Post Staging System

- Multi-step post creation workflow
- Draft/staging area for posts before scheduling or publishing
- Platform-specific content variations
- Batch operations on staged posts

### 2. Platform Variations

- Per-platform content customization
- Platform-specific formatting (character limits, hashtags, mentions)
- Preview system for each platform
- Conflict resolution for platform-specific requirements

### 3. Template System

- Markdown frontmatter-driven templates
- Variable substitution system
- Template library management
- Auto-detection of markdown files in content directory

## Implementation Plan

### Phase 1: Data Model Extensions

#### Enhanced Post Data Structure

```typescript
interface StagedPost {
  id: string;
  sourceType: "manual" | "template" | "markdown";
  sourceData?: {
    filePath?: string;
    templateId?: string;
    variables?: Record<string, string>;
  };

  // Platform-specific content variations
  platformContent: {
    [platform in Platform]: {
      content: string;
      enabled: boolean;
      customizations?: {
        hashtags?: string[];
        mentions?: string[];
        mediaAttachments?: string[];
      };
    };
  };

  // Base content and metadata
  baseContent: string;
  title?: string;
  description?: string;
  tags: string[];

  // Scheduling and status
  scheduledFor?: string;
  status: "staged" | "scheduled" | "posting" | "posted" | "failed";
  createdAt: string;
  updatedAt: string;

  // Results tracking
  postResults?: {
    [platform: string]: {
      success: boolean;
      postId?: string;
      url?: string;
      error?: string;
      postedAt?: string;
    };
  };
}

interface PostTemplate {
  id: string;
  name: string;
  description: string;
  template: string; // Template string with {{variable}} placeholders
  variables: TemplateVariable[];
  platforms: Platform[];
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

interface TemplateVariable {
  key: string;
  label: string;
  type: "text" | "url" | "date" | "number" | "select";
  required: boolean;
  defaultValue?: string;
  options?: string[]; // For select type
  source?: "frontmatter" | "file" | "computed" | "user";
  frontmatterKey?: string; // For frontmatter source
}

interface BroadcastDataV2 {
  posts: StagedPost[];
  templates: PostTemplate[];
  accounts: AccountInfo;
  settings: {
    contentDirectory: string;
    autoDetectMarkdown: boolean;
    defaultPlatforms: Platform[];
  };
  version: string;
}
```

### Phase 2: Template Engine Implementation

#### Template Parser

```typescript
class TemplateEngine {
  // Parse template string and extract variables
  parseTemplate(template: string): TemplateVariable[];

  // Render template with provided variables
  renderTemplate(template: string, variables: Record<string, string>): string;

  // Extract variables from markdown frontmatter
  extractFrontmatterVariables(filePath: string): Record<string, string>;

  // Generate URL for markdown file (assuming Quartz integration)
  generateFileUrl(filePath: string, baseUrl?: string): string;

  // Validate template syntax
  validateTemplate(template: string): { valid: boolean; errors: string[] };
}
```

#### Markdown Integration

```typescript
interface MarkdownFile {
  filePath: string;
  relativePath: string;
  frontmatter: Record<string, any>;
  title: string;
  content: string;
  lastModified: string;
  url?: string; // Generated URL for published content
}

class MarkdownProcessor {
  // Scan content directory for markdown files
  scanContentDirectory(directory: string): Promise<MarkdownFile[]>;

  // Parse single markdown file
  parseMarkdownFile(filePath: string): Promise<MarkdownFile>;

  // Watch for changes in content directory
  watchContentDirectory(
    directory: string,
    callback: (files: MarkdownFile[]) => void
  ): void;

  // Extract frontmatter with js-yaml
  extractFrontmatter(content: string): Record<string, any>;
}
```

### Phase 3: Enhanced UI Components

#### Staging Interface

- **Post Staging Dashboard**: List of staged posts with batch operations
- **Platform Variation Editor**: Side-by-side content editing for each platform
- **Template Selector**: Choose template when creating posts from markdown
- **Template Editor**: Create and manage post templates

#### Template Management UI

```typescript
interface TemplateFormData {
  name: string;
  description: string;
  template: string;
  platforms: Platform[];
  variables: TemplateVariable[];
  tags: string[];
}
```

#### Markdown File Browser

- File tree showing content directory structure
- Quick actions to create posts from markdown files
- Template selection when creating posts
- Preview of generated content

### Phase 4: Service Layer Implementation

#### Enhanced Social Manager

```typescript
class SocialManagerV2 extends SocialManager {
  // Post staged content with platform-specific variations
  postStagedContent(stagedPost: StagedPost): Promise<PostResult[]>;

  // Validate content for platform requirements
  validatePlatformContent(
    platform: Platform,
    content: string
  ): ValidationResult;

  // Get platform-specific formatting suggestions
  getPlatformSuggestions(
    platform: Platform,
    content: string
  ): FormattingSuggestion[];
}
```

#### Template Manager

```typescript
class TemplateManager {
  // CRUD operations for templates
  createTemplate(
    template: Omit<PostTemplate, "id" | "createdAt" | "updatedAt">
  ): Promise<PostTemplate>;
  updateTemplate(
    id: string,
    updates: Partial<PostTemplate>
  ): Promise<PostTemplate>;
  deleteTemplate(id: string): Promise<void>;
  getTemplate(id: string): Promise<PostTemplate | null>;
  listTemplates(filters?: TemplateFilters): Promise<PostTemplate[]>;

  // Template application
  applyTemplate(
    templateId: string,
    markdownFile: MarkdownFile
  ): Promise<StagedPost>;
  previewTemplate(
    templateId: string,
    variables: Record<string, string>
  ): string;
}
```

#### Staging Manager

```typescript
class StagingManager {
  // Staged post management
  createStagedPost(data: CreateStagedPostData): Promise<StagedPost>;
  updateStagedPost(
    id: string,
    updates: Partial<StagedPost>
  ): Promise<StagedPost>;
  deleteStagedPost(id: string): Promise<void>;
  getStagedPost(id: string): Promise<StagedPost | null>;
  listStagedPosts(filters?: StagingFilters): Promise<StagedPost[]>;

  // Platform variations
  updatePlatformContent(
    postId: string,
    platform: Platform,
    content: string
  ): Promise<void>;
  togglePlatform(
    postId: string,
    platform: Platform,
    enabled: boolean
  ): Promise<void>;

  // Batch operations
  bulkSchedule(postIds: string[], scheduledFor: string): Promise<void>;
  bulkPublish(postIds: string[]): Promise<PostResult[]>;
  bulkDelete(postIds: string[]): Promise<void>;
}
```

### Phase 5: Integration Points

#### File System Integration

```typescript
// Add to main.ts IPC handlers
ipcMain.handle('broadcast:scan-content-directory', async (_, directory) => {
  return await markdownProcessor.scanContentDirectory(directory);
});

ipcMain.handle('broadcast:parse-markdown-file', async (_, filePath) => {
  return await markdownProcessor.parseMarkdownFile(filePath);
});

// Add to preload.ts
broadcast: {
  // ... existing methods
  scanContentDirectory: (directory: string) =>
    ipcRenderer.invoke('broadcast:scan-content-directory', directory),
  parseMarkdownFile: (filePath: string) =>
    ipcRenderer.invoke('broadcast:parse-markdown-file', filePath),
}
```

#### Template Engine Integration

```typescript
// Add template-related IPC handlers
ipcMain.handle("broadcast:create-template", async (_, templateData) => {
  return await templateManager.createTemplate(templateData);
});

ipcMain.handle(
  "broadcast:apply-template",
  async (_, templateId, markdownFile) => {
    return await templateManager.applyTemplate(templateId, markdownFile);
  }
);

ipcMain.handle(
  "broadcast:preview-template",
  async (_, templateId, variables) => {
    return await templateManager.previewTemplate(templateId, variables);
  }
);
```

### Phase 6: Default Templates

#### Article Announcement Template

```typescript
const articleTemplate: PostTemplate = {
  id: 'article-announcement',
  name: 'Article Announcement',
  description: 'Announce a new article or blog post',
  template: `{{title}} by {{author}}${{{author} ? ', published' : 'Published'}} {{date}}

{{description}}

{{url}}`,
  variables: [
    { key: 'title', label: 'Title', type: 'text', required: true, source: 'frontmatter', frontmatterKey: 'title' },
    { key: 'author', label: 'Author', type: 'text', required: false, source: 'frontmatter', frontmatterKey: 'author' },
    { key: 'date', label: 'Date', type: 'date', required: true, source: 'frontmatter', frontmatterKey: 'date' },
    { key: 'description', label: 'Description', type: 'text', required: true, source: 'frontmatter', frontmatterKey: 'description' },
    { key: 'url', label: 'URL', type: 'url', required: true, source: 'computed' }
  ],
  platforms: ['bluesky', 'farcaster', 'twitter'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  tags: ['article', 'announcement']
};
```

#### Project Update Template

```typescript
const projectUpdateTemplate: PostTemplate = {
  id: "project-update",
  name: "Project Update",
  description: "Share updates about ongoing projects",
  template: `🚀 {{title}}

{{description}}

{{#tags}}#{{.}} {{/tags}}

{{url}}`,
  variables: [
    {
      key: "title",
      label: "Update Title",
      type: "text",
      required: true,
      source: "frontmatter",
      frontmatterKey: "title",
    },
    {
      key: "description",
      label: "Description",
      type: "text",
      required: true,
      source: "frontmatter",
      frontmatterKey: "subtitle",
    },
    {
      key: "tags",
      label: "Tags",
      type: "text",
      required: false,
      source: "frontmatter",
      frontmatterKey: "tags",
    },
    {
      key: "url",
      label: "URL",
      type: "url",
      required: false,
      source: "computed",
    },
  ],
  platforms: ["bluesky", "farcaster", "twitter"],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  tags: ["project", "update"],
};
```

### Phase 7: UI/UX Enhancements

#### Staging Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Broadcast Tool - Staging Dashboard                          │
├─────────────────────────────────────────────────────────────┤
│ [New Post ▼] [From Template] [Batch Actions ▼]             │
├─────────────────────────────────────────────────────────────┤
│ Filters: [All] [Staged] [Scheduled] [Posted] [Failed]      │
│ Search: [________________] Platforms: [B][F][T]             │
├─────────────────────────────────────────────────────────────┤
│ ┌─ Post Title ─────────────────── Status ─ Actions ─────┐   │
│ │ Article: "A Rhapsody on..."     Staged   [Edit] [⚡]   │   │
│ │ Platforms: B F T                         [📅] [🗑]     │   │
│ │ Created: 2024-01-15 10:30                             │   │
│ └───────────────────────────────────────────────────────┘   │
│ ┌─ Post Title ─────────────────── Status ─ Actions ─────┐   │
│ │ Update: "Font Tool Progress"    Scheduled [Edit] [⚡]   │   │
│ │ Platforms: B F    📅 Jan 16 2PM          [📅] [🗑]     │   │
│ │ Created: 2024-01-15 11:45                             │   │
│ └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### Platform Variation Editor

```
┌─────────────────────────────────────────────────────────────┐
│ Edit Post: "A Rhapsody on Neurodiversity"                   │
├─────────────────────────────────────────────────────────────┤
│ [Bluesky] [Farcaster] [Twitter]                            │
├─────────────────────────────────────────────────────────────┤
│ Bluesky (280/300 chars) ✓                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ A Rhapsody on Neurodiversity by Spencer Saar           │ │
│ │ Cavanaugh, published 2023-01-17                        │ │
│ │                                                         │ │
│ │ Reflections on auto-didacticism and neurodiversity.    │ │
│ │                                                         │ │
│ │ https://meridian.example.com/neurodiversity-rhapsody   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Twitter (240/280 chars) ✓                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🧠 A Rhapsody on Neurodiversity                         │ │
│ │                                                         │ │
│ │ Reflections on auto-didacticism and neurodiversity     │ │
│ │                                                         │ │
│ │ #neurodiversity #autodidactic                          │ │
│ │ https://meridian.example.com/neurodiversity-rhapsody   │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ [Preview All] [Save Draft] [Schedule] [Post Now]           │
└─────────────────────────────────────────────────────────────┘
```

### Phase 8: Migration Strategy

#### Data Migration

```typescript
class BroadcastMigration {
  // Migrate existing broadcast.json to new format
  async migrateToV2(): Promise<void> {
    const oldData = await this.loadLegacyBroadcastData();
    const newData: BroadcastDataV2 = {
      posts: oldData.posts.map(this.migrateLegacyPost),
      templates: this.getDefaultTemplates(),
      accounts: oldData.accounts,
      settings: {
        contentDirectory: "content",
        autoDetectMarkdown: true,
        defaultPlatforms: ["bluesky", "farcaster", "twitter"],
      },
      version: "2.0",
    };

    await this.saveBroadcastData(newData);
  }

  private migrateLegacyPost(oldPost: SocialPost): StagedPost {
    return {
      id: oldPost.id,
      sourceType: "manual",
      platformContent: this.createPlatformVariations(oldPost),
      baseContent: oldPost.content,
      tags: [],
      status: this.mapLegacyStatus(oldPost.status),
      createdAt: oldPost.createdAt,
      updatedAt: oldPost.createdAt,
      scheduledFor: oldPost.scheduledFor,
    };
  }

  private createPlatformVariations(
    oldPost: SocialPost
  ): StagedPost["platformContent"] {
    const variations: StagedPost["platformContent"] = {};

    oldPost.platforms.forEach((platform) => {
      variations[platform] = {
        content: oldPost.content,
        enabled: true,
      };
    });

    return variations;
  }
}
```

## Implementation Timeline

### Week 1-2: Data Model & Core Services

- Implement new data structures
- Create template engine
- Build markdown processor
- Set up migration system

### Week 3-4: Backend Integration

- Extend SocialManager for platform variations
- Implement TemplateManager and StagingManager
- Add IPC handlers for new functionality
- Create default templates

### Week 5-6: UI Components

- Build staging dashboard
- Create platform variation editor
- Implement template management UI
- Add markdown file browser

### Week 7-8: Integration & Testing

- Connect UI to backend services
- Implement file watching for content directory
- Add batch operations
- Testing and bug fixes

### Week 9-10: Polish & Documentation

- UI/UX improvements
- Performance optimizations
- Documentation and examples
- Migration testing

## Technical Considerations

### Performance

- Lazy loading of markdown files
- Debounced file system watching
- Efficient template parsing and caching
- Background processing for batch operations

### Error Handling

- Graceful degradation when content directory is unavailable
- Template parsing error recovery
- Platform-specific posting error handling
- Migration rollback capabilities

### Security

- Safe template variable substitution (prevent XSS)
- File path validation for markdown scanning
- Credential validation for enhanced posting features

### Extensibility

- Plugin architecture for custom template functions
- Platform-specific formatting plugins
- Custom variable sources
- Webhook integration for automated posting

## Future Enhancements

1. **AI-Powered Variations**: Use AI to automatically generate platform-specific variations
2. **Analytics Integration**: Track post performance across platforms
3. **Collaboration Features**: Multi-user post staging and approval workflows
4. **Advanced Scheduling**: Recurring posts, optimal timing suggestions
5. **Content Calendar**: Visual calendar interface for post management
6. **A/B Testing**: Test different variations of posts
7. **Rich Media Support**: Image optimization and platform-specific media handling
