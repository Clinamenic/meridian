# Meridian-Quartz Implementation Plan

## Baseline Knowledge

### Existing Service Interfaces

```typescript
// Current DeployManager interface
class DeployManager {
  private workspacePath: string;

  async initializeQuartz(workspacePath: string): Promise<void>;
  async buildSite(config: any): Promise<any>;
  async previewSite(config: any): Promise<string>;
  private async createQuartzProject(quartzPath: string): Promise<void>;
  private async customizeQuartzForMeridian(quartzPath: string): Promise<void>;
  private async createMeridianPlugins(pluginsDir: string): Promise<void>;
  private async installQuartzDependencies(quartzPath: string): Promise<void>;
}
```

### Implementation Dependencies

```
src/main/deploy-manager.ts        // Core integration point - simplify methods
.cursor/docs/temp/                // Planning documentation
meridian-quartz/ (new repo)      // Fork creation and customization
```

### Required File Modifications

- **src/main/deploy-manager.ts**: Update clone URL, remove customization methods
- **meridian-quartz repository**: Fork creation, plugin integration, configuration
- **README updates**: Attribution and Meridian-specific documentation

## Type Definitions

### New Types

```typescript
interface MeridianQuartzConfig {
  version: string;
  repository: string;
  branch: string;
  plugins: {
    collate: boolean;
    archive: boolean;
    broadcast: boolean;
  };
}

interface ForkValidation {
  isValid: boolean;
  version: string;
  errors: string[];
  warnings: string[];
}
```

### Extended Types

```typescript
interface DeployConfig extends ExistingConfig {
  quartzVersion?: string; // Track meridian-quartz version
  customPlugins?: string[]; // Additional Meridian plugins
}

interface BuildResult extends ExistingBuildResult {
  quartzVersion: string; // Version used for build
  pluginsLoaded: string[]; // Meridian plugins loaded
}
```

### Validation Types

```typescript
interface RepositoryValidation {
  isAccessible: boolean;
  hasRequiredFiles: boolean;
  errors: Error[];
}
```

## Implementation Order

### Phase 1: Repository Creation

```
Fork Quartz Repository
└─> Initial Cleanup (remove docs, content, examples)
    └─> Update README and Attribution
        └─> Modify package.json for Meridian
```

### Phase 2: Core Configuration

```
Update quartz.config.ts
└─> Configure Content Sourcing (../ instead of ./content)
    └─> Update Ignore Patterns
        └─> Set Meridian Defaults
```

### Phase 3: Plugin Integration

```
Create plugins/meridian/ Directory
└─> Port Collate Plugin
    └─> Port Archive Plugin
        └─> Create Broadcast Plugin
            └─> Register in Default Config
```

### Phase 4: Deploy Manager Integration

```
Update Clone URL
└─> Remove Customization Methods
    └─> Add Version Validation
        └─> Update Error Handling
```

## Integration Points

### Repository Fork Creation

```bash
# Manual steps for repository creation
git clone https://github.com/jackyzha0/quartz.git meridian-quartz
cd meridian-quartz
git remote set-url origin https://github.com/Clinamenic/meridian-quartz.git
# Apply customizations
# Push to new repository
```

### Deploy Manager Integration

```typescript
class DeployManager {
  private readonly MERIDIAN_QUARTZ_REPO =
    "https://github.com/Clinamenic/meridian-quartz.git";

  private async createQuartzProject(quartzPath: string): Promise<void> {
    // Simplified - no runtime customization needed
    return this.cloneMeridianQuartz(quartzPath);
  }

  private async cloneMeridianQuartz(quartzPath: string): Promise<void> {
    // Clone pre-configured meridian-quartz
  }

  // Remove these methods (no longer needed):
  // - customizeQuartzForMeridian()
  // - createMeridianPlugins()
  // - createMeridianReadme()
}
```

### Error Handling

```typescript
try {
  await this.cloneMeridianQuartz(quartzPath);
} catch (error) {
  // Fallback or detailed error reporting
  throw new Error(`Failed to initialize Meridian-Quartz: ${error.message}`);
}
```

## Success Criteria

### Functionality Requirements

- [ ] Repository successfully forked with proper attribution
- [ ] Content sourcing from workspace root (not ./content)
- [ ] All three Meridian plugins functional (Collate, Archive, Broadcast)
- [ ] Deploy manager integration complete with error handling
- [ ] Build process 50%+ faster due to eliminated customization

### Performance Metrics

- [ ] Initialization time: <30 seconds (vs current ~60+ seconds)
- [ ] Build time: No regression from current performance
- [ ] Memory usage: Reduced due to smaller dependency tree

### Reliability Standards

- [ ] Zero runtime customization failures
- [ ] Graceful handling of repository unavailability
- [ ] Consistent builds across different workspace structures
- [ ] Proper version tracking and compatibility

## Detailed Implementation Steps

### Step 1: Create Meridian-Quartz Repository

#### 1.1 Fork and Initial Setup

```bash
# Create fork
git clone https://github.com/jackyzha0/quartz.git meridian-quartz
cd meridian-quartz
git remote set-url origin https://github.com/Clinamenic/meridian-quartz.git

# Create initial branch structure
git checkout -b meridian-main
```

#### 1.2 Remove Vanilla Components

```bash
# Remove unnecessary directories
rm -rf docs/
rm -rf content/
rm -rf .github/
rm -f CNAME
rm -f README.md
```

#### 1.3 Create Meridian README

```markdown
# Meridian-Quartz

A specialized fork of [Quartz](https://github.com/jackyzha0/quartz) optimized for Meridian Digital Garden deployments.

## Attribution

This project is based on Quartz by @jackyzha0. Original license and attribution preserved.

## Meridian-Specific Features

- Pre-configured for workspace root content sourcing
- Built-in Meridian integration plugins
- Optimized ignore patterns for Meridian workflow
- Streamlined initialization process
```

### Step 2: Core Configuration Updates

#### 2.1 Update quartz.config.ts

```typescript
import { QuartzConfig } from "./quartz/cfg";
import * as Plugin from "./quartz/plugins";
import * as MeridianPlugin from "./plugins/meridian";

const config: QuartzConfig = {
  configuration: {
    pageTitle: "Digital Garden",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "en-US",
    baseUrl: undefined,
    ignorePatterns: [
      // Quartz infrastructure
      ".quartz/**",
      ".quartz-cache/**",

      // Meridian infrastructure
      ".meridian/**",

      // Development infrastructure
      ".git/**",
      ".gitignore",
      "node_modules/**",
      "package*.json",
      "yarn.lock",
      "tsconfig*.json",
      "*.config.{js,ts}",

      // Build and temporary
      "dist/**",
      "build/**",
      "cache/**",
      "*.log",
      "tmp/**",
      "temp/**",

      // IDE and system
      ".vscode/**",
      ".idea/**",
      "*.swp",
      "*.swo",
      ".DS_Store",
      "Thumbs.db",

      // Backup files
      "*~",
      "*.bak",
      "*.tmp",

      // Private content
      "private/**",
      "templates/**",
      ".obsidian/**",
    ],
    // Key change: source from parent directory (workspace root)
    defaultDateType: "created",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Schibsted Grotesk",
        body: "Source Sans Pro",
        code: "IBM Plex Mono",
      },
      colors: {
        lightMode: {
          light: "#faf8f8",
          lightgray: "#e5e5e5",
          gray: "#b8b8b8",
          darkgray: "#4e4e4e",
          dark: "#2b2b2b",
          secondary: "#284b63",
          tertiary: "#84a59d",
          highlight: "rgba(143, 159, 169, 0.15)",
        },
        darkMode: {
          light: "#161618",
          lightgray: "#393639",
          gray: "#646464",
          darkgray: "#d4d4d4",
          dark: "#ebebec",
          secondary: "#7b97aa",
          tertiary: "#84a59d",
          highlight: "rgba(143, 159, 169, 0.15)",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({ priority: ["frontmatter", "filesystem"] }),
      Plugin.Latex({ renderEngine: "katex" }),
      Plugin.SyntaxHighlighting({
        theme: { light: "github-light", dark: "github-dark" },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({ enableSiteMap: true, enableRSS: true }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.NotFoundPage(),
      // Meridian-specific plugins
      MeridianPlugin.CollatePlugin(),
      MeridianPlugin.ArchivePlugin(),
      MeridianPlugin.BroadcastPlugin(),
    ],
  },
};

export default config;
```

### Step 3: Create Meridian Plugins

#### 3.1 Create plugins/meridian/ Directory Structure

```
plugins/
└── meridian/
    ├── index.ts          # Plugin exports
    ├── collate.ts        # Resource gallery generation
    ├── archive.ts        # Arweave showcase
    ├── broadcast.ts      # Social metadata enhancement
    └── types.ts          # Shared types
```

#### 3.2 Port Existing Plugin Logic

Move the plugin code from `deploy-manager.ts` into dedicated plugin files within the meridian-quartz repository.

### Step 4: Update Deploy Manager

#### 4.1 Simplify DeployManager Class

```typescript
class DeployManager {
  private readonly MERIDIAN_QUARTZ_REPO =
    "https://github.com/Clinamenic/meridian-quartz.git";
  private readonly MERIDIAN_QUARTZ_BRANCH = "meridian-main";

  private async createQuartzProject(quartzPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Cloning Meridian-Quartz repository to ${quartzPath}...`);

      const child = spawn(
        "git",
        [
          "clone",
          "--branch",
          this.MERIDIAN_QUARTZ_BRANCH,
          this.MERIDIAN_QUARTZ_REPO,
          ".",
        ],
        {
          cwd: quartzPath,
          stdio: ["inherit", "pipe", "pipe"],
        }
      );

      // Handle clone process...
      child.on("close", async (code) => {
        if (code === 0) {
          try {
            console.log(
              "Meridian-Quartz cloned successfully, installing dependencies..."
            );
            await this.installQuartzDependencies(quartzPath);
            resolve();
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`Git clone failed with code ${code}`));
        }
      });
    });
  }

  // Remove these methods (no longer needed):
  // - customizeQuartzForMeridian()
  // - createMeridianPlugins()
  // - createMeridianReadme()
}
```

## Testing Strategy

### Integration Tests

- [ ] Test workspace initialization with meridian-quartz
- [ ] Verify build process with various workspace structures
- [ ] Validate plugin functionality (Collate, Archive, Broadcast)
- [ ] Test error handling for repository unavailability

### Performance Tests

- [ ] Benchmark initialization times (current vs new)
- [ ] Memory usage comparison
- [ ] Build time regression testing

### Compatibility Tests

- [ ] Test with different Node.js versions
- [ ] Cross-platform testing (macOS, Windows, Linux)
- [ ] Various workspace content types

## Risk Mitigation

### Repository Availability

- Monitor repository access and implement health checks
- Consider mirroring strategy if primary repository becomes unavailable
- Graceful degradation with clear error messages

### Version Compatibility

- Implement version checking and compatibility warnings
- Document breaking changes between versions
- Provide migration guides for major updates

### Plugin Functionality

- Comprehensive testing of Meridian plugin integrations
- Fallback behavior when plugins fail to load
- Clear error reporting for plugin issues
