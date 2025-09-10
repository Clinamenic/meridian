# Deploy Tool - Technical Outline

## Overview

The Deploy tool is the fourth tab in Meridian that enables users to transform their workspace content into a deployed Quartz static site. This tool bridges the gap between content creation/curation and web publishing, allowing users to generate and deploy beautiful digital gardens from their Markdown files.

## Core Concept

The Deploy tool treats the selected workspace as a potential Quartz site source, scanning for Markdown files and providing a streamlined deployment pipeline to various hosting platforms. It leverages the existing workspace structure while adding Quartz-specific configuration and build processes.

## Architecture Integration

### Following Existing Patterns

The Deploy tool follows the established Meridian architecture patterns:

```typescript
// Tool integration in app.js
case 'deploy':
  await this.loadDeployData();
  break;

// Panel structure in index.html
<div id="deploy-panel" class="tool-panel">
  <div class="panel-header">
    <!-- Deploy-specific header -->
  </div>
  <div class="panel-content">
    <!-- Deploy-specific content -->
  </div>
</div>
```

### Main Process Integration

New backend manager: `src/main/deploy-manager.ts`

- Handles Quartz project initialization
- Manages build processes
- Coordinates with hosting providers
- Integrates with existing workspace structure

## Feature Specification

### Phase 1: Core Functionality

#### 1. Workspace Analysis

- **Content Discovery**: Scan workspace for `.md` files
- **Structure Analysis**: Detect existing folder hierarchies
- **Asset Detection**: Identify images, attachments, and other resources
- **Compatibility Check**: Validate content for Quartz compatibility

#### 2. Quartz Project Setup

- **Project Initialization**: Copy complete Quartz template to `.quartz/` directory
- **Dependency Installation**: Run `npm install` to install all Quartz dependencies (~80+ packages)
- **Configuration Generation**: Create customized `quartz.config.ts` based on workspace content
- **Layout Configuration**: Generate `quartz.layout.ts` with appropriate component layout
- **Content Synchronization**: Create symlink or copy workspace content to `content/` directory
- **TypeScript Setup**: Ensure proper TypeScript configuration and declarations
- **Asset Management**: Handle images and attachments in Quartz-compatible structure

#### 3. Build Process

- **Quartz Build**: Execute `npx quartz build` to generate static site in `public/` directory
- **Preview Mode**: Run `npx quartz build --serve` for local development server (default port 8080)
- **Build Validation**: Parse build output for errors, warnings, and broken links
- **Cache Management**: Handle `.quartz-cache/` directory for faster rebuilds
- **Output Processing**: Process generated `public/` directory with proper asset handling
- **Hot Reload**: Support live updates during development with WebSocket server (port 3001)

#### 4. Deployment Options

- **GitHub Pages**: Direct integration with GitHub repositories
- **Netlify**: Automated deployment via Netlify API
- **Cloudflare Pages**: Deploy to Cloudflare's edge network
- **Manual Export**: Generate deployable static files

### Phase 2: Advanced Features

#### 1. Content Synchronization

- **Incremental Updates**: Only rebuild changed content
- **Asset Optimization**: Compress images, minify resources
- **Link Validation**: Ensure internal links work correctly
- **Content Filtering**: Exclude drafts, private notes

#### 2. Customization Options

- **Theme Selection**: Multiple Quartz theme options
- **Component Configuration**: Enable/disable Quartz components
- **Layout Customization**: Adjust sidebar, navigation, footer
- **Styling Options**: Basic color/font customizations

#### 3. Publishing Workflow

- **Draft Mode**: Preview before publishing
- **Scheduled Deployment**: Automated publishing schedules
- **Version Control**: Track deployment history
- **Rollback Capability**: Revert to previous deployments

## User Interface Design

### Panel Layout

Following the established two-column layout pattern used in Collate and Archive:

```
┌─────────────────────────────────────────┬──────────────┐
│ Main Content Area                       │ Sidebar      │
├─────────────────────────────────────────┼──────────────┤
│ • Project Status                        │ • Filters    │
│ • Content Preview                       │ • Settings   │
│ • Build Logs                           │ • Templates  │
│ • Deployment Status                     │ • History    │
└─────────────────────────────────────────┴──────────────┘
```

### Panel Header Actions

```html
<div class="panel-actions">
  <button
    id="init-quartz-btn"
    class="panel-header-icon-btn"
    title="Initialize Quartz"
  >
    <!-- Quartz icon -->
  </button>
  <button id="build-site-btn" class="panel-header-icon-btn" title="Build Site">
    <!-- Build icon -->
  </button>
  <button
    id="preview-site-btn"
    class="panel-header-icon-btn"
    title="Preview Site"
  >
    <!-- Preview icon -->
  </button>
  <button
    id="deploy-site-btn"
    class="panel-header-icon-btn"
    title="Deploy Site"
  >
    <!-- Deploy icon -->
  </button>
</div>
```

### Status Displays

#### Project Status Card

```
┌─────────────────────────────────────────────────────┐
│ 📄 Quartz Project Status                            │
├─────────────────────────────────────────────────────┤
│ Status: [Not Initialized | Ready | Building | Live] │
│ Content: 45 Markdown files detected                 │
│ Last Build: 2 minutes ago                          │
│ Deployment: https://my-site.netlify.app            │
└─────────────────────────────────────────────────────┘
```

#### Content Summary

```
┌─────────────────────────────────────────────────────┐
│ 📊 Content Analysis                                 │
├─────────────────────────────────────────────────────┤
│ • 45 Markdown files                                 │
│ • 12 Images (2.3MB total)                          │
│ • 3 Subdirectories                                 │
│ • 8 Files with frontmatter                         │
│ • 2 Files with broken links                        │
└─────────────────────────────────────────────────────┘
```

### Deployment Workflow UI

#### Step-by-Step Wizard

```
┌─────────────────────────────────────────────────────┐
│ 🚀 Deploy Your Site                                │
├─────────────────────────────────────────────────────┤
│ Step 1: Choose Hosting Provider                     │
│ ○ GitHub Pages  ○ Netlify  ○ Cloudflare Pages      │
│                                                     │
│ Step 2: Configure Settings                          │
│ Site Name: [my-digital-garden]                      │
│ Domain: [optional custom domain]                    │
│                                                     │
│ Step 3: Deploy                                      │
│ [Deploy Now] [Save as Draft]                       │
└─────────────────────────────────────────────────────┘
```

## System Requirements

### Node.js and NPM Requirements

Based on the vanilla Quartz repository analysis:

```json
{
  "engines": {
    "npm": ">=9.3.1",
    "node": ">=20"
  }
}
```

- **Node.js**: Minimum version 20 required
- **NPM**: Minimum version 9.3.1 required
- **Dependencies**: ~80+ packages including TypeScript, esbuild, Preact, D3, and many remark/rehype plugins
- **Installation Size**: ~200MB for complete Quartz project with dependencies

### Prerequisites Validation

The Deploy tool must validate that the user's system meets these requirements before attempting Quartz initialization:

```typescript
interface SystemRequirements {
  nodeVersion: string; // Minimum "20.0.0"
  npmVersion: string; // Minimum "9.3.1"
  availableSpace: number; // Minimum 500MB
  internetConnection: boolean; // Required for npm install
}

async function validateSystemRequirements(): Promise<ValidationResult> {
  // Check Node.js version
  // Check NPM version
  // Check available disk space
  // Test internet connectivity
}
```

## Technical Implementation

### File Structure Integration

```
workspace/
├── .meridian/              # Meridian data (renamed from data/ for consistency)
│   ├── collate.json        # Resource collections - accessible to Quartz plugins
│   ├── archive.json        # Arweave uploads - can generate site pages
│   ├── broadcast.json      # Social posts - for metadata generation
│   └── deploy.json         # Deploy configuration and history
├── attachments/            # User attachments - copied to Quartz assets
├── content/                # User's markdown files - primary Quartz content
└── .quartz/               # Quartz project files
    ├── quartz.config.ts    # Generated Quartz configuration with Meridian integration
    ├── quartz.layout.ts    # Generated layout configuration
    ├── package.json        # Quartz dependencies + custom Meridian plugins
    ├── package-lock.json   # Locked dependencies
    ├── tsconfig.json       # TypeScript configuration
    ├── .gitignore          # Quartz-specific gitignore
    ├── globals.d.ts        # TypeScript declarations
    ├── index.d.ts         # TypeScript declarations
    ├── quartz/            # Quartz framework code (copied from template)
    ├── plugins/           # Custom Meridian-Quartz integration plugins
    │   ├── meridian-collate.ts    # Plugin to read .meridian/collate.json
    │   ├── meridian-archive.ts    # Plugin to read .meridian/archive.json
    │   └── meridian-broadcast.ts  # Plugin to read .meridian/broadcast.json
    ├── content/           # Symlink/copy of workspace content + generated pages
    ├── node_modules/      # NPM dependencies (gitignored)
    ├── .quartz-cache/     # Build cache (gitignored)
    └── public/            # Generated static site (gitignored)
```

### Deploy Configuration Schema

```typescript
interface DeployConfig {
  id: string;
  projectName: string;
  status: "not-initialized" | "ready" | "building" | "deployed" | "error";

  // Quartz configuration
  quartzConfig: {
    theme: string;
    components: string[];
    customizations: Record<string, any>;
  };

  // Content settings
  contentSettings: {
    includePatterns: string[];
    excludePatterns: string[];
    processImages: boolean;
    validateLinks: boolean;
  };

  // Deployment settings
  deployment: {
    provider: "github-pages" | "netlify" | "cloudflare-pages" | "manual";
    url?: string;
    repository?: string;
    branch?: string;
    buildCommand?: string;
    outputDirectory?: string;
    customDomain?: string;
  };

  // Build history
  builds: BuildRecord[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastBuildAt?: string;
  lastDeployAt?: string;
}

interface BuildRecord {
  id: string;
  timestamp: string;
  status: "success" | "error" | "cancelled";
  duration: number;
  filesProcessed: number;
  outputSize: number;
  errors?: string[];
  warnings?: string[];
}

interface QuartzConfigOptions {
  pageTitle: string;
  baseUrl: string;
  enableSPA: boolean;
  enablePopovers: boolean;
  theme: QuartzThemeConfig;
  plugins: QuartzPluginConfig;
  ignorePatterns: string[];
  locale: string;
}

interface QuartzThemeConfig {
  fontOrigin: "googleFonts" | "local";
  cdnCaching: boolean;
  typography: {
    header: string;
    body: string;
    code: string;
  };
  colors: {
    lightMode: Record<string, string>;
    darkMode: Record<string, string>;
  };
}

interface QuartzPluginConfig {
  transformers: string[];
  filters: string[];
  emitters: string[];
}

interface LayoutOptions {
  components: {
    left: string[];
    right: string[];
    beforeBody: string[];
    afterBody: string[];
  };
  sharedComponents: {
    head: string;
    header: string[];
    footer: string;
  };
}

interface BuildOptions {
  serve: boolean;
  port?: number;
  concurrency?: number;
  verbose?: boolean;
}

interface ContentSummary {
  totalFiles: number;
  markdownFiles: number;
  imageFiles: number;
  otherFiles: number;
  totalSize: number;
  directories: string[];
  hasObsidianFiles: boolean;
  hasFrontmatter: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: ContentSummary;
}

interface ValidationError {
  type:
    | "broken-link"
    | "missing-asset"
    | "invalid-frontmatter"
    | "syntax-error";
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
}

interface ValidationWarning {
  type: "missing-title" | "large-file" | "unused-asset";
  file: string;
  message: string;
}

interface DeploymentResult {
  success: boolean;
  url?: string;
  deploymentId?: string;
  message: string;
  error?: string;
}
```

### Core Methods

```typescript
class DeployManager {
  // Project lifecycle
  async initializeQuartzProject(workspacePath: string): Promise<void>;
  async installQuartzDependencies(quartzPath: string): Promise<void>;
  async buildSite(config: DeployConfig): Promise<BuildRecord>;
  async previewSite(config: DeployConfig): Promise<string>; // Returns local URL

  // Content management
  async scanWorkspaceContent(workspacePath: string): Promise<ContentSummary>;
  async validateContent(workspacePath: string): Promise<ValidationResult>;
  async syncContentToQuartz(
    workspacePath: string,
    quartzPath: string
  ): Promise<void>;
  async processAssets(workspacePath: string): Promise<void>;

  // Quartz configuration
  async generateQuartzConfig(
    workspacePath: string,
    options: QuartzConfigOptions
  ): Promise<void>;
  async generateQuartzLayout(options: LayoutOptions): Promise<void>;
  async updateQuartzConfig(config: DeployConfig): Promise<void>;

  // Build process (following Quartz architecture)
  async runQuartzBuild(
    quartzPath: string,
    options?: BuildOptions
  ): Promise<BuildRecord>;
  async runQuartzServe(quartzPath: string, port?: number): Promise<string>;
  async runQuartzSync(quartzPath: string): Promise<void>;

  // Deployment
  async deployToGitHubPages(config: DeployConfig): Promise<DeploymentResult>;
  async deployToNetlify(config: DeployConfig): Promise<DeploymentResult>;
  async deployToCloudflarePages(
    config: DeployConfig
  ): Promise<DeploymentResult>;
  async exportStaticFiles(config: DeployConfig): Promise<string>; // Returns export path

  // Monitoring
  async getBuildStatus(buildId: string): Promise<BuildStatus>;
  async getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus>;
  async getBuildLogs(buildId: string): Promise<string[]>;
}
```

## Meridian-Quartz Integration Architecture

### Core Integration Philosophy

The Deploy tool creates a seamless bridge between Meridian's data-driven content management and Quartz's static site generation. Both `.meridian/` and `.quartz/` directories coexist in the workspace root, enabling powerful cross-system integrations through custom Quartz plugins that read Meridian's JSON data files.

### Custom Meridian-Quartz Plugins

#### Collate Integration Plugin (`meridian-collate.ts`)

```typescript
// Custom Quartz plugin that reads .meridian/collate.json
import { QuartzPlugin } from "quartz/plugins/types";
import { readFileSync } from "fs";
import { join } from "path";

export const MeridianCollatePlugin: QuartzPlugin = {
  name: "MeridianCollate",
  markdownPlugins() {
    return [];
  },
  htmlPlugins() {
    return [];
  },
  externalResources() {
    return {};
  },
  emitters: [
    {
      name: "collate-gallery",
      emit: async (cfg, content, resources, emit) => {
        // Read Meridian collate data
        const collatePath = join(
          cfg.configuration.baseDir,
          "../.meridian/collate.json"
        );
        const collateData = JSON.parse(readFileSync(collatePath, "utf-8"));

        // Generate gallery pages from selected/filtered resources
        const galleryPages = await generateGalleryPages(collateData.resources);

        // Emit gallery pages as part of the site
        for (const page of galleryPages) {
          await emit({
            content: page.content,
            slug: page.slug,
            ext: ".html",
          });
        }
      },
    },
  ],
};

async function generateGalleryPages(
  resources: CollateResource[]
): Promise<GalleryPage[]> {
  // Transform Meridian resources into Quartz-compatible gallery pages
  return resources
    .filter((r) => r.selected || r.tags.includes("featured"))
    .map((resource) => ({
      slug: `gallery/${resource.id}`,
      content: `
        <div class="resource-gallery-item">
          <h2>${resource.title}</h2>
          <div class="resource-meta">
            <span class="domain">${resource.domain}</span>
            <span class="tags">${resource.tags.join(", ")}</span>
          </div>
          <div class="resource-content">
            ${resource.description}
            <a href="${resource.url}" target="_blank">Visit Resource</a>
          </div>
        </div>
      `,
    }));
}
```

#### Archive Integration Plugin (`meridian-archive.ts`)

```typescript
// Custom Quartz plugin that reads .meridian/archive.json
export const MeridianArchivePlugin: QuartzPlugin = {
  name: "MeridianArchive",
  emitters: [
    {
      name: "archive-index",
      emit: async (cfg, content, resources, emit) => {
        const archivePath = join(
          cfg.configuration.baseDir,
          "../.meridian/archive.json"
        );
        const archiveData = JSON.parse(readFileSync(archivePath, "utf-8"));

        // Generate archive index page
        const archiveIndex = generateArchiveIndex(archiveData.uploads);

        await emit({
          content: archiveIndex,
          slug: "archive/index",
          ext: ".html",
        });

        // Generate individual archive item pages
        for (const upload of archiveData.uploads) {
          if (upload.status === "confirmed") {
            const itemPage = generateArchiveItemPage(upload);
            await emit({
              content: itemPage,
              slug: `archive/${upload.txId}`,
              ext: ".html",
            });
          }
        }
      },
    },
  ],
};
```

#### Broadcast Integration Plugin (`meridian-broadcast.ts`)

```typescript
// Custom Quartz plugin that reads .meridian/broadcast.json for metadata
export const MeridianBroadcastPlugin: QuartzPlugin = {
  name: "MeridianBroadcast",
  htmlPlugins() {
    return [
      () => (tree, file) => {
        // Read broadcast data for social metadata
        const broadcastPath = join(process.cwd(), ".meridian/broadcast.json");
        const broadcastData = JSON.parse(readFileSync(broadcastPath, "utf-8"));

        // Enhance pages with social metadata from broadcast configurations
        const socialMeta = generateSocialMetadata(
          broadcastData.posts,
          file.data.slug
        );
        addSocialMetaTags(tree, socialMeta);
      },
    ];
  },
};
```

### Integration Points

#### Workspace Manager Integration

```typescript
// Enhanced workspace selection with Meridian-Quartz awareness
if (selectedWorkspace) {
  // Check for both deployable content and Meridian data
  const contentSummary = await deployManager.scanWorkspaceContent(
    selectedWorkspace
  );
  const meridianData = await deployManager.scanMeridianData(selectedWorkspace);

  // Update deploy panel with integrated analysis
  this.updateDeployPanel({
    content: contentSummary,
    meridianIntegrations: meridianData,
    availableFeatures: calculateAvailableFeatures(meridianData),
  });
}

interface MeridianDataSummary {
  collate: {
    totalResources: number;
    selectedResources: number;
    featuredResources: number;
    canGenerateGallery: boolean;
  };
  archive: {
    totalUploads: number;
    confirmedUploads: number;
    canGenerateArchive: boolean;
  };
  broadcast: {
    totalPosts: number;
    platformsConfigured: string[];
    canGenerateMetadata: boolean;
  };
}
```

### Cross-Tool Integration Features

#### Enhanced Collate Integration

**Gallery Generation from Filtered Resources**

```typescript
interface CollateIntegrationFeatures {
  // Export selected resources to Quartz gallery pages
  exportFilteredToGallery: {
    enabled: boolean;
    filters: {
      selectedOnly: boolean;
      byTags: string[];
      byDomain: string[];
      byDateRange: [string, string];
    };
    layout: "grid" | "list" | "cards";
    groupBy: "domain" | "tags" | "date" | "none";
  };

  // Generate resource index pages
  generateResourceIndex: {
    enabled: boolean;
    includeStats: boolean;
    includeTimeline: boolean;
    includeTagCloud: boolean;
  };

  // Create reference pages from bookmarks
  generateReferencePages: {
    enabled: boolean;
    autoSummary: boolean;
    includeThumbnails: boolean;
    linkValidation: boolean;
  };
}
```

**Example Generated Gallery Page**

```html
<!-- Generated from .meridian/collate.json -->
<div class="meridian-gallery">
  <h1>Resource Collection: AI Research Papers</h1>
  <div class="gallery-filters">
    <button data-filter="arxiv">ArXiv Papers</button>
    <button data-filter="recent">Recent Additions</button>
    <button data-filter="featured">Featured</button>
  </div>

  <div class="resource-grid">
    <!-- Each resource from collate.json becomes a card -->
    <div class="resource-card" data-tags="machine-learning,nlp">
      <h3>
        <a href="https://arxiv.org/abs/2024.00001"
          >Advanced Transformer Architecture</a
        >
      </h3>
      <div class="resource-meta">
        <span class="domain">arxiv.org</span>
        <span class="date">Added: March 2024</span>
      </div>
      <p class="resource-description">
        Revolutionary approach to attention mechanisms...
      </p>
      <div class="resource-tags">
        <span class="tag">machine-learning</span>
        <span class="tag">nlp</span>
      </div>
    </div>
  </div>
</div>
```

#### Enhanced Archive Integration

**Permanent Archive Showcase**

```typescript
interface ArchiveIntegrationFeatures {
  // Generate archive showcase pages
  showcaseArchive: {
    enabled: boolean;
    includeArweaveLinks: boolean;
    includeTxDetails: boolean;
    showTimeline: boolean;
    showFileTypes: boolean;
  };

  // Create digital preservation pages
  preservationPages: {
    enabled: boolean;
    includeMetadata: boolean;
    includeProvenance: boolean;
    showVerification: boolean;
  };

  // Archive statistics and insights
  archiveAnalytics: {
    enabled: boolean;
    storageStats: boolean;
    uploadTimeline: boolean;
    fileTypeBreakdown: boolean;
  };
}
```

#### Enhanced Broadcast Integration

**Social Metadata Enhancement**

```typescript
interface BroadcastIntegrationFeatures {
  // Enhance pages with social metadata
  socialMetadata: {
    enabled: boolean;
    useConfiguredPlatforms: boolean;
    generateOpenGraph: boolean;
    generateTwitterCards: boolean;
    includePlatformSpecific: boolean;
  };

  // Generate announcement pages
  announcementPages: {
    enabled: boolean;
    includeBroadcastHistory: boolean;
    showPlatformStatus: boolean;
    autoGenerateUpdates: boolean;
  };

  // Cross-platform sharing optimization
  shareOptimization: {
    enabled: boolean;
    customThumbnails: boolean;
    platformSpecificContent: boolean;
    trackingIntegration: boolean;
  };
}
```

### Integrated Build Process

#### Enhanced Build Pipeline

```typescript
class EnhancedDeployManager extends DeployManager {
  async buildSiteWithMeridianIntegration(
    config: DeployConfig
  ): Promise<BuildRecord> {
    // Phase 1: Standard content preparation
    await this.syncContentToQuartz(config.workspacePath, config.quartzPath);

    // Phase 2: Meridian data integration
    await this.integrateMeridianData(config);

    // Phase 3: Generate Meridian-enhanced pages
    await this.generateMeridianPages(config);

    // Phase 4: Configure custom plugins
    await this.configureMeridianPlugins(config);

    // Phase 5: Standard Quartz build with enhancements
    return await this.runQuartzBuild(config.quartzPath, {
      plugins: [
        ...standardQuartzPlugins,
        MeridianCollatePlugin,
        MeridianArchivePlugin,
        MeridianBroadcastPlugin,
      ],
    });
  }

  private async integrateMeridianData(config: DeployConfig): Promise<void> {
    const meridianPath = join(config.workspacePath, ".meridian");
    const quartzPath = join(config.workspacePath, ".quartz");

    // Read all Meridian data files
    const [collateData, archiveData, broadcastData] = await Promise.all([
      this.readMeridianFile(meridianPath, "collate.json"),
      this.readMeridianFile(meridianPath, "archive.json"),
      this.readMeridianFile(meridianPath, "broadcast.json"),
    ]);

    // Generate integration manifest for Quartz plugins
    const integrationManifest = {
      collate: {
        hasData: !!collateData,
        resourceCount: collateData?.resources?.length || 0,
        selectedCount:
          collateData?.resources?.filter((r) => r.selected)?.length || 0,
        features: config.collateIntegration,
      },
      archive: {
        hasData: !!archiveData,
        uploadCount: archiveData?.uploads?.length || 0,
        confirmedCount:
          archiveData?.uploads?.filter((u) => u.status === "confirmed")
            ?.length || 0,
        features: config.archiveIntegration,
      },
      broadcast: {
        hasData: !!broadcastData,
        postCount: broadcastData?.posts?.length || 0,
        platformCount: Object.keys(broadcastData?.platforms || {}).length,
        features: config.broadcastIntegration,
      },
    };

    // Write manifest for plugins to consume
    await writeFile(
      join(quartzPath, "meridian-integration.json"),
      JSON.stringify(integrationManifest, null, 2)
    );
  }
}
```

#### Advanced Integration Scenarios

**Scenario 1: Research Publication Workflow**

```typescript
// A researcher using Meridian to collect papers (Collate),
// archive important documents (Archive), and share findings (Broadcast)
// can generate a comprehensive research site with:

const researchSiteFeatures = {
  collate: {
    // Generate bibliography from collected papers
    bibliography: true,
    // Create topic-based resource pages
    topicPages: true,
    // Research timeline from bookmark dates
    researchTimeline: true,
  },
  archive: {
    // Permanent storage showcase for key documents
    documentArchive: true,
    // Verification links for archived papers
    verificationPages: true,
  },
  broadcast: {
    // Enhanced social sharing for research updates
    researchAnnouncements: true,
    // Academic platform optimization
    academicMetadata: true,
  },
};
```

**Scenario 2: Digital Portfolio Creation**

```typescript
// A creative professional using Meridian can generate:
const portfolioFeatures = {
  collate: {
    // Portfolio gallery from bookmarked inspirations
    inspirationGallery: true,
    // Client work showcase from collected references
    workShowcase: true,
  },
  archive: {
    // Permanent portfolio pieces on Arweave
    portfolioArchive: true,
    // Proof of creation timestamps
    provenanceDisplay: true,
  },
  broadcast: {
    // Multi-platform portfolio promotion
    portfolioSharing: true,
    // Client-specific landing pages
    customLandingPages: true,
  },
};
```

### UI Integration Enhancements

#### Deploy Panel with Meridian Integration

```html
<div class="deploy-integration-section">
  <h3>🔗 Meridian Integration Features</h3>

  <!-- Collate Integration -->
  <div class="integration-card collate-integration">
    <div class="integration-header">
      <h4>📊 Collate Integration</h4>
      <span class="resource-count">45 resources • 12 selected</span>
    </div>
    <div class="integration-options">
      <label>
        <input type="checkbox" checked /> Generate resource gallery
      </label>
      <label> <input type="checkbox" /> Create topic index pages </label>
      <label> <input type="checkbox" /> Include research timeline </label>
    </div>
  </div>

  <!-- Archive Integration -->
  <div class="integration-card archive-integration">
    <div class="integration-header">
      <h4>🗄️ Archive Integration</h4>
      <span class="archive-count">8 files archived • 2.3 MB</span>
    </div>
    <div class="integration-options">
      <label>
        <input type="checkbox" checked /> Showcase archived content
      </label>
      <label> <input type="checkbox" /> Include verification links </label>
    </div>
  </div>

  <!-- Broadcast Integration -->
  <div class="integration-card broadcast-integration">
    <div class="integration-header">
      <h4>📢 Broadcast Integration</h4>
      <span class="platform-count">3 platforms configured</span>
    </div>
    <div class="integration-options">
      <label>
        <input type="checkbox" checked /> Enhanced social metadata
      </label>
      <label> <input type="checkbox" /> Generate announcement pages </label>
    </div>
  </div>
</div>
```

This comprehensive integration architecture transforms the Deploy tool from a simple static site generator into a powerful content publication system that leverages all of Meridian's data-driven capabilities, creating rich, interconnected web experiences from the user's curated content.

## Deployment Providers

### GitHub Pages Integration

```typescript
interface GitHubPagesConfig {
  repository: string; // username/repo-name
  branch: string; // gh-pages or main
  customDomain?: string; // CNAME configuration
  buildWorkflow: boolean; // Use GitHub Actions
}

// Deployment process (following official Quartz docs):
// 1. Create GitHub repository
// 2. Create .github/workflows/deploy.yml with Quartz build workflow
// 3. Push Quartz project to repository (v4 branch)
// 4. Configure GitHub Pages to use GitHub Actions as source
// 5. Monitor deployment via GitHub Actions
//
// Example workflow (from Quartz docs):
// - Uses ubuntu-22.04 runner
// - Node.js 22 with npm ci
// - Runs npx quartz build
// - Uploads artifact to GitHub Pages
// - Deploys using actions/deploy-pages@v4
```

### Netlify Integration

```typescript
interface NetlifyConfig {
  siteName: string;
  customDomain?: string;
  buildSettings: {
    command: string; // npx quartz build
    publishDir: string; // public
    environment: Record<string, string>;
  };
}

// Deployment process:
// 1. Create Netlify site
// 2. Configure build settings
// 3. Deploy via API or Git integration
// 4. Setup custom domain if specified
// 5. Monitor build status
```

### Cloudflare Pages Integration

```typescript
interface CloudflarePagesConfig {
  projectName: string;
  customDomain?: string;
  buildConfiguration: {
    buildCommand: string;
    buildOutputDirectory: string;
    rootDirectory: string;
  };
}
```

## Error Handling & Validation

### Content Validation

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: {
    totalFiles: number;
    validFiles: number;
    brokenLinks: number;
    missingAssets: number;
  };
}

interface ValidationError {
  type:
    | "broken-link"
    | "missing-asset"
    | "invalid-frontmatter"
    | "syntax-error";
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
}
```

### Build Error Handling

```typescript
interface QuartzBuildError {
  type: "system" | "dependency" | "content" | "configuration" | "resource";
  message: string;
  file?: string;
  line?: number;
  solution: string;
}

// Common Quartz build errors and their handling:
const commonQuartzErrors = {
  // System-level errors
  node_version_too_old: {
    type: "system",
    message: "Node.js version is below minimum requirement (20)",
    solution: "Please upgrade Node.js to version 20 or higher",
  },
  npm_version_incompatible: {
    type: "system",
    message: "NPM version is below minimum requirement (9.3.1)",
    solution: "Please upgrade NPM: npm install -g npm@latest",
  },

  // Dependency errors
  npm_install_failed: {
    type: "dependency",
    message: "Failed to install Quartz dependencies",
    solution: "Check internet connection and npm registry access",
  },
  typescript_compilation_error: {
    type: "dependency",
    message: "TypeScript compilation failed",
    solution: "Check quartz.config.ts and quartz.layout.ts syntax",
  },

  // Content errors (from Quartz architecture docs)
  broken_wikilink: {
    type: "content",
    message: "Broken wikilink found in content",
    solution: "Fix or remove broken [[links]] in markdown files",
  },
  invalid_frontmatter: {
    type: "content",
    message: "Invalid YAML frontmatter",
    solution: "Check YAML syntax in file frontmatter",
  },

  // Configuration errors
  invalid_quartz_config: {
    type: "configuration",
    message: "Invalid quartz.config.ts configuration",
    solution: "Verify plugin configuration and baseUrl settings",
  },
  missing_required_files: {
    type: "configuration",
    message: "Required Quartz files missing",
    solution: "Reinitialize Quartz project or restore missing files",
  },

  // Resource errors
  insufficient_memory: {
    type: "resource",
    message: "Insufficient memory for build process",
    solution: "Close other applications or increase system memory",
  },
  disk_space_full: {
    type: "resource",
    message: "Insufficient disk space for build",
    solution: "Free up disk space (build requires ~500MB)",
  },
};
```

## Security Considerations

### Credential Management

```typescript
// Secure storage of deployment credentials
interface DeploymentCredentials {
  provider: string;
  encrypted: boolean;
  credentials: {
    github?: {
      token: string; // GitHub Personal Access Token
      repository: string;
    };
    netlify?: {
      accessToken: string; // Netlify Access Token
      siteId?: string;
    };
    cloudflare?: {
      apiToken: string; // Cloudflare API Token
      accountId: string;
    };
  };
}
```

### Content Security

- Sanitize user content before building
- Validate external links and resources
- Prevent inclusion of sensitive files
- Handle private/draft content appropriately

## Performance Considerations

### Build Optimization

```typescript
interface BuildOptimization {
  // Incremental builds
  incrementalBuild: boolean;
  changedFilesOnly: boolean;

  // Asset optimization
  compressImages: boolean;
  minifyCSS: boolean;
  minifyJS: boolean;

  // Caching
  buildCache: boolean;
  assetCache: boolean;

  // Parallelization
  parallelProcessing: boolean;
  maxWorkers: number;
}
```

### Resource Management

- Monitor build process memory usage
- Implement build timeouts
- Handle large workspaces efficiently
- Cache build artifacts when possible

## User Experience Flow

### First-Time Setup

1. **Workspace Detection**: "We found 45 Markdown files in your workspace"
2. **Project Initialization**: "Initialize Quartz project?"
3. **Theme Selection**: Choose from available themes
4. **Content Review**: Preview what will be included
5. **Build & Preview**: Generate and preview locally
6. **Deployment Setup**: Choose hosting provider
7. **Deploy**: Push to live site

### Ongoing Usage

1. **Content Updates**: Detect changes in workspace
2. **Incremental Builds**: Only rebuild changed content
3. **Preview Changes**: Test before deploying
4. **Deploy Updates**: Push changes to live site
5. **Monitor Status**: Track deployment health

## Testing Strategy

### Unit Tests

```typescript
// Test core functionality
describe("DeployManager", () => {
  test("should scan workspace content correctly");
  test("should initialize Quartz project");
  test("should build site successfully");
  test("should handle deployment errors");
});
```

### Integration Tests

```typescript
// Test with actual Quartz builds
describe("Quartz Integration", () => {
  test("should build sample workspace");
  test("should handle various content types");
  test("should process assets correctly");
});
```

### End-to-End Tests

```typescript
// Test full deployment pipeline
describe("Deployment Pipeline", () => {
  test("should deploy to GitHub Pages");
  test("should deploy to Netlify");
  test("should handle deployment failures");
});
```

## Future Enhancements

### Phase 3: Advanced Features

1. **Multi-Site Management**: Deploy multiple sites from one workspace
2. **Custom Themes**: Upload and use custom Quartz themes
3. **Plugin System**: Extend functionality with Quartz plugins
4. **Analytics Integration**: Built-in site analytics
5. **SEO Optimization**: Automated SEO improvements
6. **Content Scheduling**: Scheduled content publication
7. **Collaboration**: Multi-user deployment workflows

### Phase 4: Enterprise Features

1. **Team Management**: Collaborative deployment workflows
2. **Advanced Analytics**: Detailed site performance metrics
3. **Custom Domains**: Advanced domain management
4. **CDN Integration**: Global content delivery optimization
5. **Backup & Recovery**: Automated site backups
6. **A/B Testing**: Content variation testing
7. **API Access**: Programmatic deployment control

## Success Metrics

### Technical Metrics

- Build success rate (target: >95%)
- Average build time (target: <2 minutes)
- Deployment success rate (target: >98%)
- Site performance scores (target: >90)

### User Experience Metrics

- Time from workspace to deployed site (target: <10 minutes)
- User completion rate for first deployment (target: >80%)
- User satisfaction with generated sites (target: >4.5/5)
- Support ticket volume (target: <5% of users)

## Implementation Timeline

### Milestone 1: Core Infrastructure (4 weeks)

- Deploy panel UI implementation
- DeployManager backend class
- Workspace content scanning
- Basic Quartz project initialization

### Milestone 2: Build System (3 weeks)

- Quartz build integration
- Local preview server
- Build validation and error handling
- Asset processing pipeline

### Milestone 3: Deployment Integration (4 weeks)

- GitHub Pages deployment
- Netlify deployment
- Cloudflare Pages deployment
- Manual export functionality

### Milestone 4: Polish & Testing (2 weeks)

- UI/UX refinements
- Comprehensive testing
- Documentation
- Performance optimization

### Milestone 5: Advanced Features (3 weeks)

- Theme selection
- Incremental builds
- Deployment monitoring
- Error recovery systems

**Total Estimated Timeline: 16 weeks**

## Conclusion

The Deploy tool represents a significant expansion of Meridian's capabilities, transforming it from a content management application into a complete digital publishing platform. By integrating Quartz's powerful static site generation with Meridian's workspace-centric approach, users can seamlessly transition from content creation to web publication.

The tool maintains consistency with Meridian's existing architecture while adding sophisticated new capabilities. The phased implementation approach ensures that core functionality is delivered quickly while leaving room for advanced features in future iterations.

This implementation will position Meridian as a comprehensive solution for digital content creators, researchers, and knowledge workers who want to publish their work online without the complexity of traditional web development workflows.
