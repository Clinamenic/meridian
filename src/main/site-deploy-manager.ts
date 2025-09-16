import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import { minimatch } from 'minimatch';
import { ArweaveManager } from './arweave-manager';
import { ArweaveHistoryManager } from './arweave-history-manager';
import { DataManager } from './data-manager';
import { UnifiedDatabaseManager } from './unified-database-manager';
import {
  DeployResult,
  ArweaveDeployConfig,
  ArweaveDeployResult,
  ArweaveDeployManifest,
  ArweaveDeployFile,
  DeploymentVerification,
  DeploymentCostEstimate,
  ArweaveDeploymentHistory,
  ArweaveDeploymentHistoryRecord
} from '../types';

const execAsync = promisify(exec);

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
  buildExcludedSize: number; // Total size of excluded files
  buildIncludedSize: number; // Total size of included files (build output)
  buildFileTypes: { [extension: string]: number }; // Only included files
  exclusionSummary: {
    dotDirectories: number;
    configFiles: number;
    developmentFiles: number;
    customIgnored: number;
    totalExcluded: number;
  };
  // Detailed exclusion breakdown
  detailedExclusions?: {
    dotDirectories: { [dirName: string]: number }; // e.g., { ".git": 45, ".vscode": 12 }
    customPatterns: { [pattern: string]: number }; // e.g., { "*.tmp": 5, "private/**": 23 }
  };
}

interface SystemCheck {
  isValid: boolean;
  issues: string[];
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

/**
 * Deploy Manager for Meridian Digital Gardens
 * 
 * Uses the Meridian-Quartz fork (https://github.com/Clinamenic/meridian-quartz)
 * which is pre-configured for Meridian workflow and eliminates runtime customization.
 */
class DeployManager {
  private workspacePath: string = '';
  private arweaveManager: ArweaveManager;
  private arweaveHistoryManager: ArweaveHistoryManager | null = null;
  private dataManager: DataManager;
  private unifiedDatabaseManager: UnifiedDatabaseManager;

  constructor() {
    this.dataManager = new DataManager();
    this.unifiedDatabaseManager = new UnifiedDatabaseManager();
    this.arweaveManager = new ArweaveManager(this.dataManager, this.unifiedDatabaseManager);
    this.registerIpcHandlers();
  }

  private registerIpcHandlers(): void {
    ipcMain.handle('deploy:load-data', () => this.loadDeployData());
    ipcMain.handle('deploy:save-config', (_, config) => this.saveDeployConfig(config));
    ipcMain.handle('deploy:initialize-quartz', (_, workspacePath, templateSource) => this.initializeQuartz(workspacePath, templateSource));
    ipcMain.handle('deploy:build-site', (_, config) => this.buildSite(config));
    ipcMain.handle('deploy:preview-site', (_, config) => this.previewSite(config));
    ipcMain.handle('deploy:scan-content', (_, workspacePath) => this.scanContent(workspacePath));
    ipcMain.handle('deploy:validate-system', () => this.validateSystem());
    ipcMain.handle('deploy:export-static', (_, config) => this.exportStatic(config));
    ipcMain.handle('deploy:check-initialized', (_, workspacePath) => this.checkQuartzInitialized(workspacePath));

    // GitHub workflow generation handlers (for configuration phase only)
    ipcMain.handle("deploy:generate-github-workflow", () =>
      this.generateGitHubWorkflow());
    ipcMain.handle("deploy:remove-github-workflow", () =>
      this.removeGitHubWorkflow());
    ipcMain.handle("deploy:check-workflow-file-exists", () =>
      this.checkWorkflowFileExists());

    // Arweave deployment handlers
    ipcMain.handle("deploy:arweave-manifest", (_, config) =>
      this.generateArweaveManifest(config)
    );
    ipcMain.handle("deploy:arweave-deploy", (_, config) =>
      this.deployToArweave(config)
    );
    ipcMain.handle("deploy:arweave-verify", (_, manifestHash) =>
      this.verifyArweaveDeployment(manifestHash)
    );
    ipcMain.handle("deploy:arweave-cost-estimate", (_, config) =>
      this.estimateArweaveDeploymentCost(config)
    );

    // Arweave deployment history handlers
    ipcMain.handle("deploy:get-deployment-history", () =>
      this.getDeploymentHistory()
    );
    ipcMain.handle("deploy:get-deployment-by-id", (_, id) =>
      this.getDeploymentById(id)
    );
    ipcMain.handle("deploy:get-recent-deployments", (_, limit) =>
      this.getRecentDeployments(limit)
    );
    ipcMain.handle("deploy:delete-deployment", (_, id) =>
      this.deleteDeployment(id)
    );
    ipcMain.handle("deploy:export-deployment-history", () =>
      this.exportDeploymentHistory()
    );
    ipcMain.handle("deploy:get-deployment-stats", () =>
      this.getDeploymentStats()
    );

    // Custom ignore pattern handlers
    this.registerCustomIgnorePatternHandlers();
  }

  // Add IPC handlers for managing custom ignore patterns
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

  async validateSystem(): Promise<SystemCheck> {
    const issues: string[] = [];
    const warnings: string[] = [];

    try {
      const { stdout: nodeVersion } = await execAsync('node --version');
      const nodeVersionNumber = nodeVersion.trim().replace('v', '');
      const nodeMajor = parseInt(nodeVersionNumber.split('.')[0] || '0');

      if (nodeMajor < 22) {
        issues.push(`Node.js version ${nodeVersionNumber} is below minimum requirement (22.0.0)`);
      }

      const { stdout: npmVersion } = await execAsync('npm --version');
      const npmVersionNumber = npmVersion.trim();
      const versionParts = npmVersionNumber.split('.').map(n => parseInt(n || '0'));
      const npmMajor = versionParts[0] || 0;
      const npmMinor = versionParts[1] || 0;
      const npmPatch = versionParts[2] || 0;

      // Check for npm >= 10.9.2, but be lenient with minor differences
      if (npmMajor < 10) {
        issues.push(`NPM version ${npmVersionNumber} is significantly below minimum requirement (10.9.2). Please run: npm install -g npm@latest`);
      } else if (npmMajor === 10 && npmMinor < 9) {
        issues.push(`NPM version ${npmVersionNumber} is below minimum requirement (10.9.2). Please run: npm install -g npm@latest`);
      } else if (npmMajor === 10 && npmMinor === 9 && npmPatch < 2) {
        // For very minor version differences (like 10.9.0 vs 10.9.2), show warning but allow
        warnings.push(`NPM version ${npmVersionNumber} is slightly below recommended (10.9.2), but should work. Consider upgrading: npm install -g npm@latest`);
      }

      // Check for git
      try {
        await execAsync('git --version');
      } catch {
        issues.push('Git is not installed or not available in PATH');
      }

    } catch {
      issues.push('System validation failed: Unable to check Node.js/NPM versions');
    }

    return {
      isValid: issues.length === 0,
      issues: [...issues, ...warnings]
    };
  }

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
      buildExcludedSize: 0,
      buildIncludedSize: 0,
      buildFileTypes: {},
      exclusionSummary: {
        dotDirectories: 0,
        configFiles: 0,
        developmentFiles: 0,
        customIgnored: 0,
        totalExcluded: 0,
      },
      detailedExclusions: {
        dotDirectories: {},
        customPatterns: {},
      },
    };

    try {
      // Always scan input files to determine exclusions and get workspace file info
      console.log('Scanning workspace input files for exclusions and predictions...');
      await this.scanInputFiles(workspacePath, customPatterns, summary);

      // Check if build output exists and use it to override included file data (more accurate)
      const buildOutputPath = path.join(workspacePath, '.quartz', 'public');
      const hasBuildOutput = await this.checkBuildOutputExists(buildOutputPath);

      if (hasBuildOutput) {
        console.log('Build output found, using actual build data for included files...');
        await this.overlayBuildOutput(buildOutputPath, summary);
      } else {
        console.log('No build output found, using workspace predictions for included files');
      }

      return summary;
    } catch {
      throw new Error('Failed to scan workspace content');
    }
  }

  private async checkBuildOutputExists(buildOutputPath: string): Promise<boolean> {
    try {
      await fs.access(buildOutputPath);
      // Check if there are actually built files (not just an empty directory)
      const files = await fs.readdir(buildOutputPath);
      return files.length > 0;
    } catch {
      return false;
    }
  }

  private async overlayBuildOutput(buildOutputPath: string, summary: ContentSummary): Promise<void> {
    const buildFiles = await this.getAllFiles(buildOutputPath);

    // Reset included file counts to use actual build data
    summary.buildIncludedFiles = 0;
    summary.buildFileTypes = {};

    // Reset legacy fields that represent included files (we'll recalculate from build output)
    let buildMarkdownFiles = 0;
    let buildImageFiles = 0;
    let buildOtherFiles = 0;
    let buildTotalSize = 0;
    const buildFileTypes: { [extension: string]: number } = {};

    for (const filePath of buildFiles) {
      try {
        const stats = await fs.stat(filePath);

        if (stats.isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const extKey = ext || "(no ext)";

          // Count in build types (these are the actual generated files)
          summary.buildIncludedFiles++;
          summary.buildFileTypes[extKey] = (summary.buildFileTypes[extKey] || 0) + 1;

          // Count for legacy fields
          buildTotalSize += stats.size;
          buildFileTypes[extKey] = (buildFileTypes[extKey] || 0) + 1;

          // Classify file types for legacy fields
          if (ext === ".html") {
            // HTML files are generated from markdown, so count as markdown files
            buildMarkdownFiles++;
          } else if (
            [".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp"].includes(ext)
          ) {
            buildImageFiles++;
          } else {
            buildOtherFiles++;
          }
        }
      } catch {
        // Skip files we can't access
      }
    }

    // Update legacy fields with build data
    summary.markdownFiles = buildMarkdownFiles;
    summary.imageFiles = buildImageFiles;
    summary.otherFiles = buildOtherFiles;
    summary.fileTypes = buildFileTypes;

    // Set the build output size for included files display
    summary.buildIncludedSize = buildTotalSize;

    // Fix totalSize calculation: should be excluded files size + build output size
    summary.totalSize = summary.buildExcludedSize + buildTotalSize;

    // Preserve exclusion data - do NOT reset it (this is the key difference from old scanBuildOutput)
    // summary.buildExcludedFiles, summary.exclusionSummary, and summary.detailedExclusions are preserved
  }

  private async scanInputFiles(workspacePath: string, customPatterns: string[], summary: ContentSummary): Promise<void> {
    const entries = await this.getAllFiles(workspacePath);

    for (const entry of entries) {
      try {
        const stats = await fs.stat(entry);

        if (stats.isFile()) {
          const relativePath = path.relative(workspacePath, entry);
          const ext = path.extname(entry).toLowerCase();

          // Check if file should be ignored using Quartz's exact logic FIRST
          const shouldIgnore = this.shouldIgnoreFile(relativePath, customPatterns);

          // Count all files (but file types only for non-ignored files)
          summary.totalFiles++;
          summary.totalSize += stats.size;

          // File type counting for all files
          const extKey = ext || "(no ext)";
          if (!shouldIgnore) {
            // Only count file types for files that will be included in build
            summary.fileTypes[extKey] = (summary.fileTypes[extKey] || 0) + 1;
          }

          if (shouldIgnore) {
            summary.buildExcludedFiles++;
            summary.buildExcludedSize += stats.size;

            // Track detailed exclusions
            this.trackDetailedExclusion(relativePath, customPatterns, summary, ext);
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
              } catch { }
            } else if (
              [".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp"].includes(ext)
            ) {
              summary.imageFiles++;
            } else {
              summary.otherFiles++;
            }
          }
        } else if (stats.isDirectory()) {
          const relativePath = path.relative(workspacePath, entry);
          if (!this.shouldIgnoreFile(relativePath, customPatterns) && relativePath !== '') {
            summary.directories.push(relativePath);
          }
        }
      } catch {
        // Skip files/directories we can't access
      }
    }

    summary.exclusionSummary.totalExcluded = summary.buildExcludedFiles;
  }

  private trackDetailedExclusion(
    relativePath: string,
    customPatterns: string[],
    summary: ContentSummary,
    ext: string
  ): void {
    const quartzPatterns = this.getQuartzIgnorePatterns();
    let matched = false;

    // Check for dot directories
    if (relativePath.startsWith(".") || relativePath.includes("/.")) {
      const dotDir = this.extractDotDirectory(relativePath);
      if (dotDir) {
        summary.detailedExclusions!.dotDirectories[dotDir] =
          (summary.detailedExclusions!.dotDirectories[dotDir] || 0) + 1;
        summary.exclusionSummary.dotDirectories++;
        matched = true;
      }
    }

    // Check for custom patterns first (more specific than Quartz patterns)
    if (!matched) {
      for (const pattern of customPatterns) {
        if (minimatch(relativePath, pattern)) {
          summary.detailedExclusions!.customPatterns[pattern] =
            (summary.detailedExclusions!.customPatterns[pattern] || 0) + 1;
          summary.exclusionSummary.customIgnored++;
          matched = true;
          break;
        }
      }
    }

    // If not matched by custom patterns, categorize by Quartz patterns
    if (!matched) {
      if (
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
      } else {
        // Find which Quartz pattern matched for tracking
        for (const pattern of quartzPatterns) {
          if (minimatch(relativePath, pattern)) {
            // For common development patterns, categorize appropriately
            if (pattern.includes("node_modules") || pattern.includes("dist") ||
              pattern.includes("build") || pattern.includes(".git")) {
              summary.exclusionSummary.developmentFiles++;
            } else if (pattern.includes("config") || pattern.includes(".json")) {
              summary.exclusionSummary.configFiles++;
            } else {
              // Other Quartz patterns (like .quartz, .meridian, etc.)
              summary.exclusionSummary.developmentFiles++;
            }
            break;
          }
        }
      }
    }
  }

  private extractDotDirectory(relativePath: string): string | null {
    // Extract the dot directory name from the path
    const parts = relativePath.split('/');
    for (const part of parts) {
      if (part.startsWith('.') && part !== '.' && part !== '..') {
        return part;
      }
    }
    return null;
  }

  private async getAllFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          files.push(fullPath);
          files.push(...await this.getAllFiles(fullPath));
        } else {
          files.push(fullPath);
        }
      }
    } catch {
      // Skip directories we can't read
    }

    return files;
  }

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
  private async loadCustomIgnorePatterns(workspacePath: string): Promise<string[]> {
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

  // Inject custom ignore patterns into Quartz config before building
  private async injectCustomIgnorePatterns(workspacePath: string, quartzPath: string): Promise<void> {
    try {
      const customPatterns = await this.loadCustomIgnorePatterns(workspacePath);

      if (customPatterns.length === 0) {
        console.log('No custom ignore patterns to inject');
        return;
      }

      const configPath = path.join(quartzPath, 'quartz.config.ts');

      // Read current config
      const configContent = await fs.readFile(configPath, 'utf-8');

      // Create backup
      await fs.writeFile(configPath + '.backup', configContent);

      // Find the ignorePatterns array and inject custom patterns
      const patternsString = customPatterns.map(pattern => `      "${pattern}",`).join('\n');

      // Insert custom patterns after the comment "// Common documentation that shouldn't be published"
      const updatedConfig = configContent.replace(
        /(\s*\/\/ Common documentation that shouldn't be published\s*\n)/,
        `$1${patternsString}\n      \n      // Custom user patterns (injected dynamically)\n`
      );

      // Write updated config
      await fs.writeFile(configPath, updatedConfig);

      console.log(`Injected ${customPatterns.length} custom ignore patterns into Quartz config`);
    } catch (error) {
      console.error('Failed to inject custom ignore patterns:', error);
      // Don't throw - continue with build using default patterns
    }
  }

  // Restore original Quartz config after building
  private async restoreQuartzConfig(quartzPath: string): Promise<void> {
    try {
      const configPath = path.join(quartzPath, 'quartz.config.ts');
      const backupPath = configPath + '.backup';

      // Check if backup exists
      try {
        await fs.access(backupPath);
        // Restore from backup
        const backupContent = await fs.readFile(backupPath, 'utf-8');
        await fs.writeFile(configPath, backupContent);

        // Remove backup file
        await fs.unlink(backupPath);

        console.log('Restored original Quartz config');
      } catch {
        // No backup to restore
      }
    } catch (error) {
      console.error('Failed to restore Quartz config:', error);
      // Don't throw - this is cleanup
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

  async initializeQuartz(workspacePath: string, templateSource?: any): Promise<void> {
    try {
      const quartzPath = path.join(workspacePath, '.quartz');

      // Get template source - load from settings if not provided
      let template = templateSource;
      if (!template) {
        try {
          const settings = await this.loadSiteSettings(workspacePath);
          template = settings.quartz?.template;
        } catch (error) {
          console.log('No existing site settings found, using default template');
        }
      }

      // If still no template, use default
      if (!template) {
        const { SiteTemplateManager } = await import('./site-template-manager');
        const templateManager = SiteTemplateManager.getInstance();
        template = await templateManager.getDefaultTemplate();
      }

      // Validate template has required fields
      if (!template || !template.type || !template.url) {
        console.error('Invalid template object:', template);
        throw new Error('Template object is missing required fields (type, url)');
      }

      console.log(`Initializing Quartz with template: ${template.name} (${template.type})`);

      // Clean up existing .quartz directory if it exists
      try {
        await fs.rm(quartzPath, { recursive: true, force: true });
      } catch {
        // Ignore if directory doesn't exist
      }

      // Create .quartz directory
      await fs.mkdir(quartzPath, { recursive: true });

      // Clone the selected template
      await this.cloneTemplate(template, quartzPath);

      // Install dependencies in the Quartz directory (not workspace)
      await this.installQuartzDependencies(quartzPath);

      // Apply workspace-specific configurations
      await this.applyWorkspaceSettings(workspacePath);

      // Create workspace package.json with all Quartz dependencies
      await this.createWorkspacePackageJson(workspacePath);

      // Install dependencies in workspace (for GitHub Actions compatibility)
      await this.installWorkspaceDependencies(workspacePath);

      // Update .gitignore to exclude build artifacts
      await this.updateGitignore(workspacePath);

      // Save template info in site settings
      await this.updateSiteSettingsWithTemplate(workspacePath, template);

      // Create GitHub Actions workflow by default (since githubPages is now true by default)
      try {
        console.log('Creating default GitHub Actions workflow...');
        await this.generateGitHubWorkflow();
        console.log('Default GitHub Actions workflow created successfully');
      } catch (workflowError) {
        console.warn('Failed to create default GitHub Actions workflow:', workflowError);
        // Don't fail the entire initialization if workflow creation fails
      }

    } catch (error: any) {
      console.error('Site template initialization error:', error);
      throw new Error(`Failed to initialize site template: ${error.message}`);
    }
  }





  private async installQuartzDependencies(quartzPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Installing Meridian-Quartz dependencies in: ${quartzPath}`);

      // Check if package.json exists
      const packageJsonPath = path.join(quartzPath, 'package.json');
      if (!require('fs').existsSync(packageJsonPath)) {
        const errorMessage = `package.json not found in ${quartzPath}`;
        console.error(errorMessage);
        reject(new Error(errorMessage));
        return;
      }

      console.log('package.json found, proceeding with npm install...');

      // Use --force to bypass engine checks if needed
      const child = spawn('npm', ['install', '--force'], {
        cwd: quartzPath,
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log(`[npm install stdout] ${output}`);
      });

      child.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log(`[npm install stderr] ${output}`);
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log('Dependencies installed successfully');

          // Verify that node_modules was created
          const nodeModulesPath = path.join(quartzPath, 'node_modules');
          if (require('fs').existsSync(nodeModulesPath)) {
            console.log('node_modules directory created successfully');
            resolve();
          } else {
            const errorMessage = 'npm install completed but node_modules directory not found';
            console.error(errorMessage);
            reject(new Error(errorMessage));
          }
        } else {
          const errorMessage = `npm install failed with code ${code}. Stdout: ${stdout}. Stderr: ${stderr}`;
          console.error(errorMessage);
          reject(new Error(errorMessage));
        }
      });

      child.on('error', (error) => {
        const errorMessage = `Failed to install Quartz dependencies: ${error.message}`;
        console.error(errorMessage);
        reject(new Error(errorMessage));
      });
    });
  }

  private async installWorkspaceDependencies(workspacePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Installing workspace dependencies...');

      // Use --force to bypass engine checks if needed
      const child = spawn('npm', ['install', '--force'], {
        cwd: workspacePath,
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
          console.log('Workspace dependencies installed successfully');
          resolve();
        } else {
          const errorMessage = `npm install failed with code ${code}. Stdout: ${stdout}. Stderr: ${stderr}`;
          console.error(errorMessage);
          reject(new Error(errorMessage));
        }
      });

      child.on('error', (error) => {
        const errorMessage = `Failed to install workspace dependencies: ${error.message}`;
        console.error(errorMessage);
        reject(new Error(errorMessage));
      });
    });
  }

  private async createWorkspacePackageJson(workspacePath: string): Promise<void> {
    try {
      const quartzPath = path.join(workspacePath, '.quartz');
      const quartzPackageJsonPath = path.join(quartzPath, 'package.json');
      const workspacePackageJsonPath = path.join(workspacePath, 'package.json');

      // Read the Quartz package.json to get engine requirements
      const quartzPackageJson = JSON.parse(await fs.readFile(quartzPackageJsonPath, 'utf-8'));

      // Create a minimal workspace package.json with delegation pattern
      const workspacePackageJson = {
        "name": "meridian-digital-garden",
        "version": "1.0.0",
        "description": "Website built with custom Quartz framework",
        "type": "module",
        "engines": quartzPackageJson.engines || {
          "node": ">=22",
          "npm": ">=10.9.2"
        },
        "scripts": {
          "build": "cd .quartz && npm run build",
          "serve": "cd .quartz && npm run serve",
          "quartz": "cd .quartz && tsx ./quartz/bootstrap-cli.mjs"
        }
        // No dependencies - all handled in .quartz/package.json
      };

      await fs.writeFile(
        workspacePackageJsonPath,
        JSON.stringify(workspacePackageJson, null, 2)
      );

      console.log('Created minimal workspace package.json with delegation pattern');
    } catch (error: any) {
      console.error('Failed to create workspace package.json:', error);
      throw new Error(`Failed to create workspace package.json: ${error.message}`);
    }
  }



  private async loadSiteSettings(workspacePath: string): Promise<any> {
    const ConfigManager = (await import('./site-config-manager')).default;
    const configManager = ConfigManager.getInstance();
    return await configManager.loadSiteSettings(workspacePath);
  }

  private async cloneTemplate(template: any, destination: string): Promise<void> {
    const { SiteTemplateCloner } = await import('./site-template-cloner');
    const cloner = SiteTemplateCloner.getInstance();
    const result = await cloner.cloneTemplate(template, destination);

    if (!result.success) {
      throw new Error(result.error || 'Template cloning failed');
    }

    console.log(`Successfully cloned template to ${destination}`);
  }

  private async applyWorkspaceSettings(workspacePath: string): Promise<void> {
    try {
      const settings = await this.loadSiteSettings(workspacePath);
      const quartzPath = path.join(workspacePath, '.quartz');

      // Apply any workspace-specific configurations to the template
      // For now, this is a placeholder for future workspace customizations
      console.log('Applied workspace-specific settings');
    } catch (error) {
      // Ignore if no settings exist yet
      console.log('No workspace settings to apply');
    }
  }

  private async updateSiteSettingsWithTemplate(workspacePath: string, template: any): Promise<void> {
    try {
      const ConfigManager = (await import('./site-config-manager')).default;
      const configManager = ConfigManager.getInstance();

      // Load existing settings or create new ones
      let settings;
      try {
        settings = await configManager.loadSiteSettings(workspacePath);
      } catch (error) {
        // Create default settings if none exist
        settings = {
          version: '1.0.0',
          lastModified: new Date().toISOString(),
          site: {
            title: 'My Digital Garden',
            description: 'A collection of my thoughts and notes',
            author: '',
          },
          quartz: {
            enableSPA: true,
            enablePopovers: true,
            theme: {
              mode: 'auto' as const,
            },
          },
          deployment: {
            branch: 'main',
            customCNAME: false,
            githubPages: true,
          },
          metadata: {
            createdAt: new Date().toISOString(),
            workspacePath: workspacePath,
          },
        };
      }

      // Update template and initialization status
      if (!settings.quartz.template) {
        settings.quartz.template = template;
      }
      if (!settings.metadata.initialized) {
        settings.metadata.initialized = true;
      }
      settings.lastModified = new Date().toISOString();

      // Save updated settings
      await configManager.saveSiteSettings(workspacePath, settings);
      console.log('Updated site settings with template information');
    } catch (error) {
      console.error('Failed to update site settings with template:', error);
      // Don't throw - this is not critical for initialization
    }
  }

  private async updateGitignore(workspacePath: string): Promise<void> {
    const gitignoreContent = `# Quartz build artifacts
.quartz/
.quartz-cache/
public/

# Node.js
node_modules/
package-lock.json

# Meridian local data
.meridian/

# System files
.DS_Store
Thumbs.db

# IDE files
.vscode/
.idea/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*`;

    try {
      const gitignorePath = path.join(workspacePath, '.gitignore');

      // Check if .gitignore already exists
      try {
        const existingContent = await fs.readFile(gitignorePath, 'utf-8');

        // Only add our content if it's not already there
        if (!existingContent.includes('.quartz/')) {
          const updatedContent = existingContent.trim() + '\n\n# Added by Meridian Deploy Tool\n' + gitignoreContent;
          await fs.writeFile(gitignorePath, updatedContent);
        }
      } catch {
        // File doesn't exist, create it
        await fs.writeFile(gitignorePath, gitignoreContent);
      }
    } catch {
      // Ignore if we can't write .gitignore
    }
  }

  async buildSite(config: any): Promise<any> {
    const startTime = Date.now();
    const workspacePath = config.workspacePath || this.workspacePath;
    const quartzPath = path.join(workspacePath, '.quartz');

    try {

      console.log(`Starting Meridian-Quartz build for workspace: ${workspacePath}`);
      console.log(`Build timeout: 5 minutes, Buffer size: 10MB`);

      // Inject custom ignore patterns into Quartz config before building
      await this.injectCustomIgnorePatterns(workspacePath, quartzPath);

      let stdout: string, stderr: string;

      try {
        // Verify dependencies are installed in the quartz directory only
        console.log('Verifying dependencies in quartz directory...');
        try {
          await execAsync('npm list async-mutex', { cwd: quartzPath });
          console.log('Dependencies verified in quartz directory');
        } catch (listError) {
          console.log('Installing dependencies in quartz directory...');
          await this.installQuartzDependencies(quartzPath);
        }

        // Build with Meridian-Quartz reading directly from workspace root
        console.log('Running quartz build command...');
        const result = await execAsync(`npx quartz build --directory "${workspacePath}" --output "${path.join(quartzPath, 'public')}"`, {
          cwd: quartzPath,
          env: { ...process.env },
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large builds
          timeout: 300000 // 5 minutes timeout for large builds
        });
        stdout = result.stdout;
        stderr = result.stderr;
      } finally {
        // Always restore config, even if build fails
        await this.restoreQuartzConfig(quartzPath);
      }

      const duration = Date.now() - startTime;

      // Count files processed from public directory
      const publicPath = path.join(quartzPath, 'public');
      let filesProcessed = 0;
      try {
        const files = await fs.readdir(publicPath, { recursive: true });
        filesProcessed = files.filter(file => typeof file === 'string' && file.endsWith('.html')).length;
      } catch (e) {
        filesProcessed = 0;
      }

      // Format build output for logs
      let buildOutput = `Build completed successfully in ${duration}ms\n`;
      buildOutput += `Generated ${filesProcessed} HTML files\n\n`;

      if (stdout && stdout.trim()) {
        buildOutput += `--- Build Output ---\n${stdout.trim()}\n\n`;
      }

      if (stderr && stderr.trim()) {
        buildOutput += `--- Build Warnings ---\n${stderr.trim()}\n`;
      }

      console.log(`Build completed in ${duration}ms. Generated ${filesProcessed} files.`);

      return {
        status: 'success',
        filesProcessed,
        duration,
        output: buildOutput
      };
    } catch (error: any) {
      // Ensure config is restored even if there's an error outside the try block
      await this.restoreQuartzConfig(quartzPath);

      const duration = Date.now() - startTime;
      console.error(`Build failed after ${duration}ms:`, error);

      // Check for specific error types and provide helpful messages
      let errorMessage = error.message;
      if (error.message.includes('maxBuffer')) {
        errorMessage = 'Build output exceeded buffer size (10MB). This may indicate a very large site or build process issue. Consider reducing the number of files or checking for build errors.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Build timed out after 5 minutes. This may indicate a very large site or build process hanging. Consider reducing the number of files or checking for build errors.';
      }

      // Format error output
      let errorOutput = `Build failed after ${duration}ms\n`;
      errorOutput += `Error: ${errorMessage}\n\n`;

      if (error.stdout && error.stdout.trim()) {
        errorOutput += `--- Partial Output ---\n${error.stdout.trim()}\n\n`;
      }

      if (error.stderr && error.stderr.trim()) {
        errorOutput += `--- Error Details ---\n${error.stderr.trim()}\n`;
      }

      return {
        status: 'error',
        filesProcessed: 0,
        duration,
        errors: [errorMessage],
        output: errorOutput
      };
    }
  }

  async previewSite(config: any): Promise<string> {
    const workspacePath = config.workspacePath || this.workspacePath;
    const quartzPath = path.join(workspacePath, '.quartz');

    console.log(`🌐 Starting preview server for workspace: ${workspacePath}`);

    // First, ensure the site is built
    await this.buildSite(config);

    // Use our reliable static server by default to avoid file system issues
    console.log(`Starting optimized static server (avoids macOS file watching limits)...`);
    return await this.startStaticServer(quartzPath);
  }

  // Optional method to try Quartz dev server (with file watching) if needed
  async previewSiteWithQuartzServer(config: any): Promise<string> {
    const workspacePath = config.workspacePath || this.workspacePath;
    const quartzPath = path.join(workspacePath, '.quartz');

    console.log(`🌐 Starting Quartz dev server for workspace: ${workspacePath}`);

    // First, ensure the site is built
    await this.buildSite(config);

    // Check if Quartz CLI is available
    try {
      const { stdout } = await execAsync('npx quartz --version', { cwd: quartzPath });
      console.log(`📦 Quartz version: ${stdout.trim()}`);
    } catch (error) {
      console.log(`Warning: Quartz CLI check failed, using fallback server`);
      return await this.startStaticServer(quartzPath);
    }

    // Start preview server with Quartz reading from workspace root
    console.log(`Executing: npx quartz build --serve --directory "${workspacePath}"`);

    const serverProcess = spawn('npx', ['quartz', 'build', '--serve', '--directory', workspacePath], {
      cwd: quartzPath,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let serverStarted = false;
    let serverUrl = 'http://localhost:8080';
    let shouldUseFallback = false;

    // Log server output for debugging
    serverProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log(`[Quartz Server] ${output}`);

      // Look for server start confirmation
      if (output.includes('Serving at') || output.includes('http://localhost:')) {
        serverStarted = true;
        const match = output.match(/http:\/\/localhost:\d+/);
        if (match) {
          serverUrl = match[0];
        }
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      console.log(`[Quartz Server Error] ${output}`);

      // Check for file system errors that indicate we should use fallback
      if (output.includes('EMFILE') || output.includes('too many open files') ||
        output.includes('ENOSPC') || output.includes('watch')) {
        console.log(`🔄 Detected file system limitation, switching to fallback server...`);
        shouldUseFallback = true;
        serverProcess.kill();
      }
    });

    serverProcess.on('error', (error) => {
      console.error('Failed to start preview server:', error);
      shouldUseFallback = true;
    });

    serverProcess.on('exit', (code) => {
      console.log(`[Quartz Server] Process exited with code: ${code}`);
      if (code !== 0) {
        shouldUseFallback = true;
      }
    });

    // Wait for server to start (with timeout)
    const maxWaitTime = 8000; // 8 seconds
    const checkInterval = 500; // 500ms
    let waitTime = 0;

    while (!serverStarted && !shouldUseFallback && waitTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waitTime += checkInterval;

      // Also try to fetch the URL to see if server is responding
      try {
        const response = await fetch(serverUrl);
        if (response.ok) {
          serverStarted = true;
          break;
        }
      } catch (e) {
        // Server not ready yet
      }
    }

    if (!serverStarted || shouldUseFallback) {
      console.log(`Warning: Quartz server issues detected, using reliable static server`);
      try {
        serverProcess.kill();
      } catch (e) {
        // Process might already be dead
      }
      return await this.startStaticServer(quartzPath);
    }

    console.log(`Quartz dev server confirmed running at: ${serverUrl}`);
    return serverUrl;
  }

  private async startStaticServer(quartzPath: string): Promise<string> {
    const http = require('http');
    const fs = require('fs');
    const path = require('path');

    const publicPath = path.join(quartzPath, 'public');
    const port = 8081; // Use alternative port

    console.log(`🔄 Starting fallback static server on port ${port}...`);

    const server = http.createServer((req: any, res: any) => {
      try {
        let requestUrl = req.url;

        // Remove query parameters and fragments
        const urlParts = requestUrl.split('?')[0].split('#')[0];

        // Handle root path
        if (urlParts === '/') {
          requestUrl = '/index.html';
        } else {
          requestUrl = urlParts;
        }

        let filePath = path.join(publicPath, requestUrl);

        // Quartz URL resolution logic:
        // 1. Try exact path first
        if (!fs.existsSync(filePath)) {
          // 2. Try adding .html extension (for pages like /test-page -> test-page.html)
          const htmlPath = filePath + '.html';
          if (fs.existsSync(htmlPath)) {
            filePath = htmlPath;
          } else {
            // 3. Try treating as directory with index.html (for folder pages)
            const indexPath = path.join(filePath, 'index.html');
            if (fs.existsSync(indexPath)) {
              filePath = indexPath;
            } else {
              // 4. Serve 404 page if available, otherwise generic 404
              const notFoundPath = path.join(publicPath, '404.html');
              if (fs.existsSync(notFoundPath)) {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                fs.createReadStream(notFoundPath).pipe(res);
                return;
              } else {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - Page Not Found</h1>');
                return;
              }
            }
          }
        }

        // Serve the file
        if (fs.existsSync(filePath)) {
          // Check if it's a directory
          const stats = fs.statSync(filePath);
          if (stats.isDirectory()) {
            // If it's a directory, try to serve index.html from it
            const indexPath = path.join(filePath, 'index.html');
            if (fs.existsSync(indexPath)) {
              filePath = indexPath;
            } else {
              res.writeHead(404, { 'Content-Type': 'text/html' });
              res.end('<h1>404 - Directory listing not available</h1>');
              return;
            }
          }

          // Ensure we're serving a file, not a directory
          const finalStats = fs.statSync(filePath);
          if (!finalStats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 - Not a file</h1>');
            return;
          }

          const ext = path.extname(filePath);
          const mimeTypes: { [key: string]: string } = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'text/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.ico': 'image/x-icon'
          };

          // Add CORS headers for local development
          res.writeHead(200, {
            'Content-Type': mimeTypes[ext] || 'text/plain',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          });

          // Use a safer file reading approach
          try {
            fs.createReadStream(filePath).pipe(res);
          } catch (error: any) {
            console.error('Error serving file:', error);
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('<h1>500 - Error reading file</h1>');
          }
        } else {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('<h1>404 - File not found</h1>');
        }
      } catch (error: any) {
        console.error('Server request error:', error);
        try {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<h1>500 - Internal Server Error</h1>');
        } catch (e) {
          // Response might already be sent
          console.error('Could not send error response:', e);
        }
      }
    });

    server.on('error', (error: any) => {
      console.error('Server error:', error);
    });

    server.listen(port, () => {
      console.log(`Fallback static server running at: http://localhost:${port}`);
    });

    return `http://localhost:${port}`;
  }





  /**
   * Generate GitHub Actions workflow for manual deployment
   */
  async generateGitHubWorkflow(): Promise<{ success: boolean, error?: string }> {
    try {
      const workspacePath = this.workspacePath;
      if (!workspacePath) {
        return { success: false, error: 'No workspace selected' };
      }

      // Create the workflow directory
      const workflowDir = path.join(workspacePath, '.github', 'workflows');
      await fs.mkdir(workflowDir, { recursive: true });

      // Generate the workflow content
      const workflowContent = `name: Deploy Quartz site to GitHub Pages

on:
  push:
    branches:
      - main

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Fetch all history for git info
      - uses: actions/setup-node@v4
        with:
          node-version: 22 # Match the Node version requirement from package.json
      - name: Install Dependencies
        run: cd .quartz && npm install
      - name: Build Quartz
        run: npm run build
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: .quartz/public

  deploy:
    needs: build
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4`;

      // Write the workflow file
      await fs.writeFile(path.join(workflowDir, 'deploy.yml'), workflowContent);

      console.log('GitHub Actions workflow created successfully');
      return { success: true };
    } catch (error: any) {
      console.error('Failed to generate GitHub workflow:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if GitHub Actions workflow file exists
   */
  async checkWorkflowFileExists(): Promise<{ exists: boolean, error?: string }> {
    try {
      const workspacePath = this.workspacePath;
      if (!workspacePath) {
        return { exists: false, error: 'No workspace selected' };
      }

      const workflowPath = path.join(workspacePath, '.github', 'workflows', 'deploy.yml');
      try {
        await fs.access(workflowPath);
        return { exists: true };
      } catch (error) {
        return { exists: false };
      }
    } catch (error: any) {
      console.error('Failed to check workflow file existence:', error);
      return { exists: false, error: error.message };
    }
  }

  /**
   * Remove GitHub Actions workflow for manual deployment
   */
  async removeGitHubWorkflow(): Promise<{ success: boolean, error?: string }> {
    try {
      const workspacePath = this.workspacePath;
      if (!workspacePath) {
        return { success: false, error: 'No workspace selected' };
      }

      const workflowPath = path.join(workspacePath, '.github', 'workflows', 'deploy.yml');

      // Check if the workflow file exists
      try {
        await fs.access(workflowPath);
      } catch (error) {
        // File doesn't exist, which is fine
        return { success: true };
      }

      // Remove the workflow file
      await fs.unlink(workflowPath);

      // Remove the workflows directory if it's empty
      const workflowsDir = path.join(workspacePath, '.github', 'workflows');
      try {
        const files = await fs.readdir(workflowsDir);
        if (files.length === 0) {
          await fs.rmdir(workflowsDir);

          // Remove the .github directory if it's empty
          const githubDir = path.join(workspacePath, '.github');
          try {
            const githubFiles = await fs.readdir(githubDir);
            if (githubFiles.length === 0) {
              await fs.rmdir(githubDir);
            }
          } catch (error) {
            // Directory not empty or doesn't exist, which is fine
          }
        }
      } catch (error) {
        // Directory doesn't exist or can't be read, which is fine
      }

      console.log('GitHub Actions workflow removed successfully');
      return { success: true };
    } catch (error: any) {
      console.error('Failed to remove GitHub workflow:', error);
      return { success: false, error: error.message };
    }
  }

  private async generateGitHubActionsWorkflow(workspacePath: string, config: any): Promise<void> {
    const workflowContent = `name: Deploy Quartz site to GitHub Pages

on:
  push:
    branches:
      - ${config.branch || 'main'}

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Fetch all history for git info
      - uses: actions/setup-node@v4
        with:
          node-version: 22 # Match the Node version requirement from package.json
      - name: Install Dependencies
        run: cd .quartz && npm install
      - name: Build Quartz
        run: npm run build
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: .quartz/public

  deploy:
    needs: build
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4`;

    const workflowDir = path.join(workspacePath, '.github', 'workflows');
    await fs.mkdir(workflowDir, { recursive: true });
    await fs.writeFile(path.join(workflowDir, 'deploy.yml'), workflowContent);
  }

  async exportStatic(config: any): Promise<string> {
    try {
      const workspacePath = config.workspacePath || this.workspacePath;
      const publicPath = path.join(workspacePath, '.quartz', 'public');

      await this.buildSite(config);

      return publicPath;
    } catch {
      throw new Error('Static export failed');
    }
  }

  async loadDeployData(): Promise<any> {
    try {
      const configPath = path.join(this.workspacePath, '.meridian', 'deploy.json');
      const data = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {
        configs: [],
        lastUsed: null
      };
    }
  }

  async saveDeployConfig(config: any): Promise<void> {
    try {
      const configDir = path.join(this.workspacePath, '.meridian');
      await fs.mkdir(configDir, { recursive: true });

      const configPath = path.join(configDir, 'deploy.json');
      await fs.writeFile(configPath, JSON.stringify({ config }, null, 2));
    } catch {
      throw new Error('Failed to save deploy configuration');
    }
  }

  setWorkspace(workspacePath: string): void {
    this.workspacePath = workspacePath;
    // Initialize history manager for this workspace
    this.arweaveHistoryManager = new ArweaveHistoryManager(workspacePath);
  }

  async checkQuartzInitialized(workspacePath: string): Promise<boolean> {
    try {
      const quartzPath = path.join(workspacePath, '.quartz');

      // Check if .quartz directory exists
      try {
        await fs.access(quartzPath);
      } catch {
        return false;
      }

      // Check if critical Quartz files exist
      const criticalFiles = [
        'package.json',
        'quartz.config.ts',
        'quartz/cfg.ts'
      ];

      for (const file of criticalFiles) {
        try {
          await fs.access(path.join(quartzPath, file));
        } catch {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error checking Quartz initialization:', error);
      return false;
    }
  }



  // ===== ARWEAVE DEPLOYMENT METHODS =====

  /**
   * Generate Arweave deployment manifest from build output
   */
  async generateArweaveManifest(
    config: ArweaveDeployConfig
  ): Promise<ArweaveDeployManifest> {
    try {
      const buildPath = path.join(config.workspacePath, '.quartz', 'public');

      // Check if build output exists
      if (!await this.checkBuildOutputExists(buildPath)) {
        throw new Error('Build output not found. Please build the site first.');
      }

      // Load site settings for metadata
      const siteSettings = await this.loadSiteSettings(config.workspacePath);

      // Collect all files from build directory
      const files: ArweaveDeployFile[] = [];
      await this.collectBuildFilesForManifest(buildPath, files);

      const manifest: ArweaveDeployManifest = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        siteId: config.siteId,
        baseUrl: `https://arweave.net/`, // Will be updated after manifest upload
        files,
        metadata: {
          title: siteSettings.site?.title || 'Meridian Site',
          description: siteSettings.site?.description || 'Personal digital garden',
          tags: ['meridian', 'quartz', 'digital-garden'],
          generator: 'Meridian Quartz',
          deployTimestamp: new Date().toISOString()
        }
      };

      return manifest;
    } catch (error) {
      console.error('Failed to generate Arweave manifest:', error);
      throw error;
    }
  }

  /**
   * Deploy site to Arweave
   */
  async deployToArweave(
    config: ArweaveDeployConfig
  ): Promise<ArweaveDeployResult> {
    try {
      // Check if Arweave wallet is configured
      if (!await this.arweaveManager.isWalletConfigured()) {
        return {
          success: false,
          error: 'Arweave wallet not configured. Please set up your wallet first.',
          manifestHash: '',
          manifestUrl: '',
          totalCost: { ar: '0' },
          fileCount: 0,
          totalSize: 0,
          uploadedFiles: []
        };
      }

      // Generate manifest
      const manifest = await this.generateArweaveManifest(config);

      // Build site if not already built
      const buildResult = await this.buildSite({ workspacePath: config.workspacePath });
      if (buildResult.status !== 'success') {
        return {
          success: false,
          error: `Site build failed: ${buildResult.errors?.join(', ') || 'Unknown build error'}`,
          manifestHash: '',
          manifestUrl: '',
          totalCost: { ar: '0' },
          fileCount: 0,
          totalSize: 0,
          uploadedFiles: []
        };
      }

      const buildPath = path.join(config.workspacePath, '.quartz', 'public');

      // Set workspace for DataManager to avoid "Workspace not set" errors
      await this.dataManager.setWorkspace(config.workspacePath);

      // Upload site bundle (this now includes manifest upload and returns complete result)
      const bundleResult = await this.arweaveManager.uploadSiteBundle(buildPath, manifest);

      // Record successful deployment in history
      if (bundleResult.success && this.arweaveHistoryManager) {
        try {
          const deploymentStrategy = 'full';
          await this.arweaveHistoryManager.addDeployment(bundleResult, config.siteId, deploymentStrategy);
          console.log('[DeployManager] Recorded deployment in history');
        } catch (historyError) {
          console.error('[DeployManager] Failed to record deployment in history:', historyError);
          // Don't fail the deployment if history recording fails
        }
      }

      // The bundleResult now contains all the required fields including manifestUrl and uploadedFiles
      return bundleResult;
    } catch (error) {
      console.error('Arweave deployment failed:', error);
      return {
        success: false,
        error: `Arweave deployment failed: ${(error as Error).message}`,
        manifestHash: '',
        manifestUrl: '',
        totalCost: { ar: '0' },
        fileCount: 0,
        totalSize: 0,
        uploadedFiles: []
      };
    }
  }

  /**
   * Verify Arweave deployment
   */
  async verifyArweaveDeployment(
    manifestHash: string
  ): Promise<DeploymentVerification> {
    try {
      return await this.arweaveManager.verifySiteDeployment(manifestHash);
    } catch (error) {
      console.error('Failed to verify Arweave deployment:', error);
      return {
        isValid: false,
        errors: [`Verification failed: ${(error as Error).message}`],
        verifiedFiles: 0,
        totalFiles: 0,
        manifestAccessible: false
      };
    }
  }


  /**
   * Estimate Arweave deployment cost
   */
  async estimateArweaveDeploymentCost(
    config: ArweaveDeployConfig
  ): Promise<DeploymentCostEstimate> {
    try {
      const manifest = await this.generateArweaveManifest(config);
      return await this.arweaveManager.estimateSiteDeploymentCost(manifest);
    } catch (error) {
      console.error('Failed to estimate Arweave deployment cost:', error);
      return {
        totalSize: 0,
        arCost: '0',
        breakdown: {
          html: 0,
          css: 0,
          js: 0,
          images: 0,
          other: 0
        }
      };
    }
  }

  /**
   * Collect build files for manifest generation
   */
  private async collectBuildFilesForManifest(
    buildPath: string,
    files: ArweaveDeployFile[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(buildPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(buildPath, entry.name);

        if (entry.isDirectory()) {
          // Skip hidden directories and node_modules
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await this.collectBuildFilesForManifest(fullPath, files);
          }
        } else if (entry.isFile()) {
          // Skip hidden files and temporary files
          if (!entry.name.startsWith('.') && !entry.name.endsWith('.tmp')) {
            const relativePath = path.relative(buildPath, fullPath);
            const stats = await fs.stat(fullPath);

            // Generate content hash
            const content = await fs.readFile(fullPath);
            const crypto = require('crypto');
            const hash = crypto.createHash('sha256').update(content).digest('hex');

            files.push({
              path: `/${relativePath.replace(/\\/g, '/')}`,
              hash,
              size: stats.size,
              contentType: this.getContentType(fullPath),
              tags: {
                'Content-Type': this.getContentType(fullPath),
                'meridian:file-path': `/${relativePath.replace(/\\/g, '/')}`,
                'meridian:file-size': stats.size.toString()
              }
            });
          }
        }
      }
    } catch (error) {
      console.error(`Failed to collect files from ${buildPath}:`, error);
    }
  }

  /**
   * Get content type for file
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.html': 'text/html',
      '.htm': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.otf': 'font/otf'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  // ===== ARWEAVE DEPLOYMENT HISTORY METHODS =====

  /**
   * Get all deployment history records
   */
  async getDeploymentHistory(): Promise<ArweaveDeploymentHistoryRecord[]> {
    try {
      if (!this.arweaveHistoryManager) {
        console.warn('[DeployManager] History manager not initialized');
        return [];
      }
      return await this.arweaveHistoryManager.getAllDeployments();
    } catch (error) {
      console.error('[DeployManager] Failed to get deployment history:', error);
      return [];
    }
  }

  /**
   * Get deployment record by ID
   */
  async getDeploymentById(id: string): Promise<ArweaveDeploymentHistoryRecord | null> {
    try {
      if (!this.arweaveHistoryManager) {
        console.warn('[DeployManager] History manager not initialized');
        return null;
      }
      return await this.arweaveHistoryManager.getDeploymentById(id);
    } catch (error) {
      console.error('[DeployManager] Failed to get deployment by ID:', error);
      return null;
    }
  }

  /**
   * Get recent deployments
   */
  async getRecentDeployments(limit: number = 10): Promise<ArweaveDeploymentHistoryRecord[]> {
    try {
      if (!this.arweaveHistoryManager) {
        console.warn('[DeployManager] History manager not initialized');
        return [];
      }
      return await this.arweaveHistoryManager.getRecentDeployments(limit);
    } catch (error) {
      console.error('[DeployManager] Failed to get recent deployments:', error);
      return [];
    }
  }

  /**
   * Delete deployment record
   */
  async deleteDeployment(id: string): Promise<boolean> {
    try {
      if (!this.arweaveHistoryManager) {
        console.warn('[DeployManager] History manager not initialized');
        return false;
      }
      return await this.arweaveHistoryManager.deleteDeployment(id);
    } catch (error) {
      console.error('[DeployManager] Failed to delete deployment:', error);
      return false;
    }
  }

  /**
   * Export deployment history
   */
  async exportDeploymentHistory(): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      if (!this.arweaveHistoryManager) {
        console.warn('[DeployManager] History manager not initialized');
        return { success: false, error: 'History manager not initialized' };
      }
      return await this.arweaveHistoryManager.exportHistory();
    } catch (error) {
      console.error('[DeployManager] Failed to export deployment history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get deployment statistics
   */
  async getDeploymentStats(): Promise<{
    totalDeployments: number;
    successfulDeployments: number;
    failedDeployments: number;
    totalCostAR: string;
    totalFiles: number;
    totalSize: number;
    lastDeployment?: ArweaveDeploymentHistoryRecord;
  }> {
    try {
      if (!this.arweaveHistoryManager) {
        console.warn('[DeployManager] History manager not initialized');
        return {
          totalDeployments: 0,
          successfulDeployments: 0,
          failedDeployments: 0,
          totalCostAR: '0',
          totalFiles: 0,
          totalSize: 0
        };
      }
      return await this.arweaveHistoryManager.getDeploymentStats();
    } catch (error) {
      console.error('[DeployManager] Failed to get deployment stats:', error);
      return {
        totalDeployments: 0,
        successfulDeployments: 0,
        failedDeployments: 0,
        totalCostAR: '0',
        totalFiles: 0,
        totalSize: 0
      };
    }
  }
}

export default DeployManager; 