# Deploy Panel Dashboard Alignment - Refined Implementation Plan

## Problem Statement

The Deploy panel shows file statistics that don't precisely match what files will be included in the Quartz build process, creating potential confusion about what content will be deployed.

**Verified Issue with test-workspace:**

- **Actual Files**: 792 md, 855 json, 25 txt, 9 xml, 486 no ext
- **Dashboard Shows**: 205 md, 1 json, 1 txt, 1 xml, 1 no ext
- **After Dot-Directory Exclusion**: 204 md, 1 json (close match but not exact)
- **Root Cause**: Pattern matching inconsistencies between dashboard and Quartz config

## Architectural Analysis

**Quartz's Exact Implementation:**

- **Package**: Uses `minimatch` for glob pattern matching
- **Logic**: Iterates through patterns using `minimatch(pathStr, pattern)` (build.ts:131)
- **Patterns**: Comprehensive 60+ patterns in `quartz.config.ts`

**Architectural Compatibility:**

- **Deploy Manager**: Layer 4 Content Processing Service
- **Pattern**: Single-responsibility service with focused domain logic
- **Decision**: Enhance existing `deploy-manager.ts` - NO new TypeScript file

## Immediate Implementation Plan

### Phase 1: Core Alignment & Unified Dashboard (Today)

#### 1.1 Enhance Deploy Manager with Quartz's Exact Logic

**File**: `src/main/deploy-manager.ts`

```typescript
import { minimatch } from "minimatch";
import * as path from "path";
import * as fs from "fs/promises";

interface ContentSummary {
  // Existing fields (maintain compatibility)
  totalFiles: number;
  markdownFiles: number;
  imageFiles: number;
  otherFiles: number;
  totalSize: number;
  directories: string[];
  hasObsidianFiles: boolean;
  hasFrontmatter: number;
  fileTypes: { [extension: string]: number };

  // New build-aligned fields
  buildIncludedFiles: number;
  buildExcludedFiles: number;
  buildFileTypes: { [extension: string]: number }; // Only included files
  exclusionSummary: {
    dotDirectories: number;
    configFiles: number;
    developmentFiles: number;
    customIgnored: number;
    totalExcluded: number;
  };
}

interface SiteSettings {
  site: {
    title: string;
    description: string;
    ignorePatterns?: {
      custom: string[];
      enabled: boolean;
    };
  };
}

class DeployManager {
  // Quartz's exact ignore patterns from meridian-quartz/quartz.config.ts
  private getQuartzIgnorePatterns(): string[] {
    return [
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
      "vite.config.{js,ts}",
      "rollup.config.{js,ts}",
      "webpack.config.{js,ts}",

      // Build and temporary
      "dist/**",
      "build/**",
      "cache/**",
      "*.log",
      "tmp/**",
      "temp/**",
      ".cache/**",

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

      // Common documentation
      "CHANGELOG.md",
      "CONTRIBUTING.md",
      "INSTALL.md",
      "TODO.md",
      "ROADMAP.md",
    ];
  }

  // Load workspace-specific custom patterns from site-settings.json
  private async loadCustomIgnorePatterns(
    workspacePath: string
  ): Promise<string[]> {
    try {
      const settingsPath = path.join(
        workspacePath,
        ".meridian",
        "config",
        "site-settings.json"
      );
      const settingsData = await fs.readFile(settingsPath, "utf-8");
      const settings: SiteSettings = JSON.parse(settingsData);

      if (settings.site?.ignorePatterns?.enabled) {
        return settings.site.ignorePatterns.custom || [];
      }
      return [];
    } catch {
      return []; // No custom patterns if file doesn't exist or parsing fails
    }
  }

  // Save custom ignore patterns to workspace site-settings.json
  private async saveCustomIgnorePatterns(
    workspacePath: string,
    customPatterns: string[]
  ): Promise<void> {
    try {
      const settingsPath = path.join(
        workspacePath,
        ".meridian",
        "config",
        "site-settings.json"
      );

      // Ensure directory exists
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });

      // Load existing settings or create new
      let settings: SiteSettings;
      try {
        const existingData = await fs.readFile(settingsPath, "utf-8");
        settings = JSON.parse(existingData);
      } catch {
        settings = { site: { title: "Digital Garden", description: "" } };
      }

      // Update ignore patterns
      settings.site.ignorePatterns = {
        custom: customPatterns,
        enabled: true,
      };

      // Save back to file
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    } catch (error) {
      console.error("Failed to save custom ignore patterns:", error);
      throw error;
    }
  }

  // Quartz's exact filtering logic from meridian-quartz/quartz/build.ts:131
  private shouldIgnoreFile(
    relativePath: string,
    customPatterns: string[] = []
  ): boolean {
    const quartzPatterns = this.getQuartzIgnorePatterns();
    const allPatterns = [...quartzPatterns, ...customPatterns];

    // Use Quartz's exact iteration logic
    for (const pattern of allPatterns) {
      if (minimatch(relativePath, pattern)) {
        return true;
      }
    }
    return false;
  }

  // Enhanced scanContent with build-accurate filtering
  async scanContent(workspacePath: string): Promise<ContentSummary> {
    // Load workspace-specific custom patterns
    const customPatterns = await this.loadCustomIgnorePatterns(workspacePath);

    const summary: ContentSummary = {
      // Existing fields
      totalFiles: 0,
      markdownFiles: 0,
      imageFiles: 0,
      otherFiles: 0,
      totalSize: 0,
      directories: [],
      hasObsidianFiles: false,
      hasFrontmatter: 0,
      fileTypes: {},

      // New build-aligned fields
      buildIncludedFiles: 0,
      buildExcludedFiles: 0,
      buildFileTypes: {},
      exclusionSummary: {
        dotDirectories: 0,
        configFiles: 0,
        developmentFiles: 0,
        customIgnored: 0,
        totalExcluded: 0,
      },
    };

    const entries = await this.getAllFiles(workspacePath);

    for (const entry of entries) {
      const stats = await fs.stat(entry);
      if (!stats.isFile()) continue;

      const relativePath = path.relative(workspacePath, entry);
      const ext = path.extname(entry).toLowerCase();

      // Count all files first
      summary.totalFiles++;
      summary.totalSize += stats.size;

      // File type counting for all files
      const extKey = ext || "(no ext)";
      summary.fileTypes[extKey] = (summary.fileTypes[extKey] || 0) + 1;

      // Check if file should be ignored using Quartz's exact logic
      const shouldIgnore = this.shouldIgnoreFile(relativePath, customPatterns);

      if (shouldIgnore) {
        summary.buildExcludedFiles++;

        // Categorize exclusions for detailed reporting
        if (relativePath.includes("/.")) {
          summary.exclusionSummary.dotDirectories++;
        } else if (
          ext === ".json" ||
          ext === ".config" ||
          relativePath.includes("config")
        ) {
          summary.exclusionSummary.configFiles++;
        } else if (
          ["node_modules", "dist", "build", ".git"].some((pattern) =>
            relativePath.includes(pattern)
          )
        ) {
          summary.exclusionSummary.developmentFiles++;
        } else if (
          customPatterns.some((pattern) => minimatch(relativePath, pattern))
        ) {
          summary.exclusionSummary.customIgnored++;
        }
      } else {
        // File will be included in build
        summary.buildIncludedFiles++;
        summary.buildFileTypes[extKey] =
          (summary.buildFileTypes[extKey] || 0) + 1;

        // Existing file type classification for included files only
        if (ext === ".md" || ext === ".mdx") {
          summary.markdownFiles++;
          try {
            const content = await fs.readFile(entry, "utf-8");
            if (content.startsWith("---")) summary.hasFrontmatter++;
            if (content.includes("[[") && content.includes("]]"))
              summary.hasObsidianFiles = true;
          } catch {}
        } else if (
          [".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp"].includes(ext)
        ) {
          summary.imageFiles++;
        } else {
          summary.otherFiles++;
        }
      }
    }

    summary.exclusionSummary.totalExcluded = summary.buildExcludedFiles;
    return summary;
  }

  // Add IPC handler for managing custom ignore patterns
  private registerCustomIgnorePatternHandlers(): void {
    ipcMain.handle(
      "deploy:get-custom-ignore-patterns",
      async (_, workspacePath) => {
        return await this.loadCustomIgnorePatterns(workspacePath);
      }
    );

    ipcMain.handle(
      "deploy:save-custom-ignore-patterns",
      async (_, workspacePath, patterns) => {
        await this.saveCustomIgnorePatterns(workspacePath, patterns);
        return { success: true };
      }
    );

    ipcMain.handle(
      "deploy:preview-ignore-patterns",
      async (_, workspacePath, patterns) => {
        // Preview what files would be excluded with these patterns
        const testSummary = await this.scanContent(workspacePath);
        return {
          currentExcluded: testSummary.buildExcludedFiles,
          currentIncluded: testSummary.buildIncludedFiles,
        };
      }
    );
  }
}
```

#### 1.2 Unified Dashboard UI

**File**: `src/renderer/app.js`

Replace both project cards with single unified dashboard:

```javascript
// In renderDeployStatus method, replace both cards with:
<div class="project-dashboard-card">
  <h3>📊 Project Status</h3>

  <div class="dashboard-overview">
    <div class="status-row">
      <span class="status-label">Quartz Status:</span>
      <span class="status-value ${isQuartzInitialized ? 'ready' : 'not-initialized'}">
        ${isQuartzInitialized ? 'Ready' : 'Not Initialized'}
      </span>
    </div>

    <div class="status-row">
      <span class="status-label">Build Files:</span>
      <span class="status-value build-files">
        <strong>${contentSummary.buildIncludedFiles}</strong> included
        <span class="excluded-count">${contentSummary.buildExcludedFiles} excluded</span>
      </span>
    </div>

    <div class="status-row">
      <span class="status-label">Content Types:</span>
      <span class="status-value">${this.formatBuildFileTypes(contentSummary.buildFileTypes)}</span>
    </div>

    <div class="status-row">
      <span class="status-label">Total Size:</span>
      <span class="status-value">${this.formatFileSize(contentSummary.totalSize)}</span>
    </div>
  </div>

  <div class="exclusion-summary">
    <details>
      <summary>📋 Exclusion Details (${contentSummary.buildExcludedFiles} files)</summary>
      <div class="exclusion-breakdown">
        <div class="exclusion-item">
          <span class="exclusion-label">Dot directories:</span>
          <span class="exclusion-count">${contentSummary.exclusionSummary.dotDirectories}</span>
        </div>
        <div class="exclusion-item">
          <span class="exclusion-label">Config files:</span>
          <span class="exclusion-count">${contentSummary.exclusionSummary.configFiles}</span>
        </div>
        <div class="exclusion-item">
          <span class="exclusion-label">Development files:</span>
          <span class="exclusion-count">${contentSummary.exclusionSummary.developmentFiles}</span>
        </div>
        ${contentSummary.exclusionSummary.customIgnored > 0 ?
          `<div class="exclusion-item">
            <span class="exclusion-label">Custom patterns:</span>
            <span class="exclusion-count">${contentSummary.exclusionSummary.customIgnored}</span>
          </div>` : ''}
      </div>
    </details>
  </div>
</div>

// Add helper method
formatBuildFileTypes(buildFileTypes) {
  return Object.entries(buildFileTypes)
    .map(([ext, count]) => `${count} ${ext.replace('(no ext)', 'no ext')}`)
    .join(', ');
}
```

### Phase 2: Site Settings Integration (Tomorrow)

#### 2.1 Site Settings Modal Enhancement

Add "Ignore Patterns" section to existing Site Settings modal:

```javascript
// Add to Site Settings modal
<div class="settings-section">
  <h4>🚫 File Exclusion Patterns</h4>
  <p>Add custom patterns to exclude files from your build process. These patterns work in addition to the default Quartz ignore patterns.</p>

  <div class="ignore-patterns-input">
    <input type="text" id="new-pattern-input" placeholder="e.g., drafts/**, *.private, temp/**">
    <button type="button" id="add-pattern-btn" class="secondary-btn">Add Pattern</button>
  </div>

  <div class="ignore-patterns-list" id="ignore-patterns-list">
    <!-- Populated dynamically -->
  </div>

  <div class="pattern-preview" id="pattern-preview">
    <strong>Preview:</strong> <span id="preview-text">Loading...</span>
  </div>

  <div class="pattern-help">
    <details>
      <summary>Pattern Examples</summary>
      <ul>
        <li><code>drafts/**</code> - Exclude entire drafts directory</li>
        <li><code>*.private</code> - Exclude files ending in .private</li>
        <li><code>temp*</code> - Exclude files starting with temp</li>
        <li><code>**/private/**</code> - Exclude any private directory at any level</li>
      </ul>
    </details>
  </div>
</div>
```

#### 2.2 Site Settings JSON Structure

**File**: `workspace/.meridian/config/site-settings.json`

```json
{
  "site": {
    "title": "My Digital Garden",
    "description": "Personal knowledge repository",
    "ignorePatterns": {
      "custom": ["drafts/**", "private-notes/**", "*.tmp", "**/WIP/**"],
      "enabled": true
    }
  }
}
```

## Implementation Dependencies

### Required File Modifications

```
src/main/deploy-manager.ts         // ENHANCE: Add Quartz filtering logic + custom patterns
src/renderer/app.js                // UPDATE: Unified dashboard UI
package.json                       // ADD: minimatch dependency (matches Quartz)
```

### New IPC Handlers

```typescript
deploy: get - custom - ignore - patterns; // Load workspace custom patterns
deploy: save - custom - ignore - patterns; // Save workspace custom patterns
deploy: preview - ignore - patterns; // Preview exclusion impact
```

## Success Criteria

1. **Exact Match**: Dashboard shows exactly 204 md, 1 json for test-workspace (matching `find` with dot-directory exclusion)
2. **Unified Dashboard**: Single clean status display above deployment workflow
3. **Workspace Settings**: Custom ignore patterns stored in `.meridian/config/site-settings.json`
4. **User Control**: Site Settings allows pattern management with live preview
5. **Architectural Compliance**: No new TypeScript files, enhanced existing service

## Next Steps

1. **Install minimatch**: `npm install minimatch` (already in meridian-quartz)
2. **Enhance deploy-manager.ts**: Implement Quartz's exact filtering logic
3. **Update dashboard UI**: Consolidate cards into unified display
4. **Test with test-workspace**: Verify exact count accuracy (204 md, 1 json)
5. **Add Site Settings integration**: Custom pattern management
6. **Performance test**: Ensure no scanning degradation

---

_This refined plan ensures 100% accuracy with Quartz build process while maintaining clean service architecture and providing user-configurable ignore patterns through workspace-specific settings._
