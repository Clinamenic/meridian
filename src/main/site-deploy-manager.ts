import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import { minimatch } from 'minimatch';
import { GitHubManager } from './github-manager';
import { GitHubDeployConfig, DeployResult } from '../types';

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
  private githubManager: GitHubManager;

  constructor() {
    this.githubManager = new GitHubManager();
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
    ipcMain.handle('deploy:deploy-github', (_, config) => this.deployGitHub(config));
    ipcMain.handle('deploy:export-static', (_, config) => this.exportStatic(config));
    ipcMain.handle('deploy:check-initialized', (_, workspacePath) => this.checkQuartzInitialized(workspacePath));
    
    // GitHub credential handlers
    ipcMain.handle("deploy:github-accounts", () => this.githubManager.listAccounts());
    ipcMain.handle("deploy:add-github-account", (_, token, nickname) => 
      this.githubManager.addAccount(token, nickname));
    ipcMain.handle("deploy:validate-github-token", (_, token) => 
      this.githubManager.validateToken(token));
    ipcMain.handle("deploy:get-github-account", (_, accountId) => 
      this.githubManager.getAccount(accountId));
    ipcMain.handle("deploy:remove-github-account", (_, accountId) => 
      this.githubManager.removeAccount(accountId));
    ipcMain.handle("deploy:generate-github-token-url", (_, repoName) => 
      this.githubManager.generateTokenRequestUrl(repoName));
    ipcMain.handle("deploy:deploy-to-github-pages", (_, config) => 
      this.deployToGitHubPages(config));
    ipcMain.handle("deploy:start-github-account-addition", (_, repoName) => 
      this.githubManager.startAccountAddition(repoName));
    
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
              } catch {}
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
      
      // Read the Quartz package.json
      const quartzPackageJson = JSON.parse(await fs.readFile(quartzPackageJsonPath, 'utf-8'));
      
      // Create a workspace package.json that includes all Quartz dependencies
      const workspacePackageJson = {
        "name": "meridian-digital-garden",
        "version": "1.0.0",
        "type": "module",
        "engines": quartzPackageJson.engines || { 
          "node": ">=22",
          "npm": ">=10.9.2"
        },
        "scripts": {
          "build": "npx quartz build",
          "serve": "npx quartz build --serve"
        },
        // Copy all dependencies from Quartz
        "devDependencies": quartzPackageJson.devDependencies || {},
        "dependencies": quartzPackageJson.dependencies || {}
      };
      
      await fs.writeFile(
        workspacePackageJsonPath,
        JSON.stringify(workspacePackageJson, null, 2)
      );
      
      console.log('Created workspace package.json with all Quartz dependencies');
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
          },
          metadata: {
            createdAt: new Date().toISOString(),
            workspacePath: workspacePath,
          },
        };
      }
      
      // Update template and initialization status
      settings.quartz.template = template;
      settings.metadata.initialized = true;
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
        // First, verify that dependencies are installed in the quartz directory
        console.log('Verifying dependencies in quartz directory...');
        try {
          await execAsync('npm list async-mutex', { cwd: quartzPath });
          console.log('async-mutex is installed in quartz directory');
        } catch (listError) {
          console.log('async-mutex not found, attempting to install dependencies...');
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

  async deployGitHub(config: any): Promise<any> {
    try {
      const { workspacePath, deployment } = config;
      
      console.log('Starting GitHub deployment process...');
      
      // Step 1: Build the site first
      console.log('Building site...');
      const buildResult = await this.buildSite({ workspacePath });
      if (buildResult.status !== 'success') {
        return {
          success: false,
          error: `Site build failed: ${buildResult.errors?.join(', ') || 'Unknown build error'}`
        };
      }
      
      // Step 2: Generate GitHub Actions workflow
      console.log('Creating GitHub Actions workflow...');
      await this.generateGitHubActionsWorkflow(workspacePath, deployment);
      
      // Step 3: Set up GitHub repository and push content
      console.log('Setting up GitHub repository...');
      await this.setupGitHubRepository(workspacePath, deployment);
      
      return {
        success: true,
        url: `https://${deployment.repository.split('/')[0]}.github.io/${deployment.repository.split('/')[1]}/`,
        message: 'Site built and deployed successfully! GitHub Pages will be available shortly.'
      };
    } catch (error: any) {
      console.error('Deployment failed:', error);
      return {
        success: false,
        error: `Deployment failed: ${error.message}`
      };
    }
  }

  private async setupGitHubRepository(workspacePath: string, deployment: any): Promise<void> {
    
    try {
      const [owner, repo] = deployment.repository.split('/');
      const token = deployment.personalAccessToken;
      
      // Step 1: Create repository on GitHub if it doesn't exist
      console.log(`Creating/configuring GitHub repository: ${deployment.repository}`);
      await this.createGitHubRepository(owner, repo, token);
      
      // Step 2: Initialize git repository in workspace if needed
      console.log('Initializing git repository...');
      await this.initializeGitRepository(workspacePath, deployment.repository, token);
      
      // Step 2.5: Create GitHub Actions workflow and workspace config
      console.log('Creating GitHub Actions workflow...');
      await this.generateGitHubActionsWorkflow(workspacePath, deployment);
      
      // Step 3: Commit and push source files + pre-built site to GitHub
      console.log('Committing and pushing to GitHub...');
      await this.commitAndPush(workspacePath, deployment.branch || 'main');
      
      console.log('GitHub repository setup completed successfully!');
    } catch (error: any) {
      console.error('Failed to setup GitHub repository:', error);
      throw new Error(`GitHub setup failed: ${error.message}`);
    }
  }

  private async createGitHubRepository(owner: string, repo: string, token: string): Promise<void> {
    try {
      // Check if repository exists first
      const checkResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Meridian-Deploy',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      
      if (checkResponse.ok) {
        console.log('Repository already exists, configuring...');
        // Repository exists, ensure GitHub Pages is enabled
        await this.enableGitHubPages(owner, repo, token);
        return;
      }
      
      if (checkResponse.status !== 404) {
        throw new Error(`Failed to check repository: ${checkResponse.status} ${checkResponse.statusText}`);
      }
      
      // Repository doesn't exist, create it
      console.log('Creating new repository...');
      const createResponse = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Meridian-Deploy',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          name: repo,
          description: 'Meridian Quartz site',
          private: false,
          has_pages: true
        })
      });
      
      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(`Failed to create repository: ${errorData.message || createResponse.statusText}`);
      }
      
      console.log('Repository created successfully!');
      
      // Enable GitHub Pages
      await this.enableGitHubPages(owner, repo, token);
      
    } catch (error: any) {
      throw new Error(`Repository creation failed: ${error.message}`);
    }
  }

  private async enableGitHubPages(owner: string, repo: string, token: string): Promise<void> {
    try {
      // First, try to create Pages with GitHub Actions as source
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Meridian-Deploy',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          build_type: 'workflow'
        })
      });
      
      if (response.ok) {
        console.log('GitHub Pages enabled with GitHub Actions source!');
        return;
      } else if (response.status === 409) {
        console.log('GitHub Pages already enabled, updating source to GitHub Actions...');
        // Pages exists but might be using branch source, let's update it
        await this.updatePagesToGitHubActions(owner, repo, token);
        return;
      } else {
        const errorText = await response.text();
        console.warn(`Could not enable GitHub Pages: ${response.status} ${response.statusText} - ${errorText}`);
        // Fall back to trying the old branch-based method
        await this.enablePagesWithBranchSource(owner, repo, token);
      }
    } catch (error: any) {
      console.warn(`GitHub Pages setup warning: ${error.message}`);
      // Fall back to trying the old method
      await this.enablePagesWithBranchSource(owner, repo, token);
    }
  }

  private async updatePagesToGitHubActions(owner: string, repo: string, token: string): Promise<void> {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Meridian-Deploy',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          build_type: 'workflow'
        })
      });
      
      if (response.ok) {
        console.log('Successfully updated GitHub Pages to use GitHub Actions!');
      } else {
        const errorText = await response.text();
        console.warn(`Could not update Pages source: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error: any) {
      console.warn(`Failed to update Pages source: ${error.message}`);
    }
  }

  private async enablePagesWithBranchSource(owner: string, repo: string, token: string): Promise<void> {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Meridian-Deploy',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          source: {
            branch: 'main',
            path: '/'
          }
        })
      });
      
      if (response.ok) {
        console.log('GitHub Pages enabled with branch source (manual configuration may be needed)');
      } else if (response.status === 409) {
        console.log('GitHub Pages already enabled');
      } else {
        const errorText = await response.text();
        console.warn(`Could not enable GitHub Pages: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error: any) {
      console.warn(`GitHub Pages setup warning: ${error.message}`);
    }
  }

  private async initializeGitRepository(workspacePath: string, repository: string, token: string): Promise<void> {
    
    try {
      // Check if git is already initialized
      try {
        await execAsync('git status', { cwd: workspacePath });
        console.log('Git repository already initialized');
      } catch {
        // Initialize git repository
        console.log('Initializing new git repository...');
        await execAsync('git init', { cwd: workspacePath });
        await execAsync('git config user.name "Meridian Deploy"', { cwd: workspacePath });
        await execAsync('git config user.email "deploy@meridian.local"', { cwd: workspacePath });
      }
      
      // Set up remote with token authentication
      const remoteUrl = `https://${token}@github.com/${repository}.git`;
      
      try {
        // Check if remote 'origin' exists
        await execAsync('git remote get-url origin', { cwd: workspacePath });
        // Update existing remote
        await execAsync(`git remote set-url origin ${remoteUrl}`, { cwd: workspacePath });
        console.log('Updated existing git remote');
      } catch {
        // Add new remote
        await execAsync(`git remote add origin ${remoteUrl}`, { cwd: workspacePath });
        console.log('Added git remote');
      }
      
    } catch (error: any) {
      throw new Error(`Git initialization failed: ${error.message}`);
    }
  }



  private async commitAndPush(workspacePath: string, branch: string = 'main'): Promise<void> {
    
    try {
      // Ensure .gitignore excludes only unnecessary files (keep .quartz tracked)
      const gitignorePath = path.join(workspacePath, '.gitignore');
      try {
        const existingGitignore = await fs.readFile(gitignorePath, 'utf-8');
        // Only add OS/editor files if not already present
        const linesToAdd = [];
        if (!existingGitignore.includes('.DS_Store')) {
          linesToAdd.push('# OS files', '.DS_Store', 'Thumbs.db');
        }
        if (!existingGitignore.includes('.vscode') && !existingGitignore.includes('.idea')) {
          linesToAdd.push('# Editor files', '.vscode/', '.idea/', '*.swp', '*.swo');
        }
        if (linesToAdd.length > 0) {
          await fs.writeFile(gitignorePath, existingGitignore + '\n' + linesToAdd.join('\n') + '\n');
          console.log('Updated .gitignore with OS/editor exclusions');
        }
      } catch {
        // .gitignore doesn't exist, create basic one (without .quartz exclusion)
        await fs.writeFile(gitignorePath, `# OS files
.DS_Store
Thumbs.db

# Editor files
.vscode/
.idea/
*.swp
*.swo
`);
        console.log('Created .gitignore for OS/editor files');
      }
      
      // Fetch latest changes from remote
      console.log('Fetching latest changes from remote...');
      try {
        await execAsync(`git fetch origin ${branch}`, { cwd: workspacePath });
      } catch (fetchError: any) {
        console.log('Fetch failed (probably first push), continuing...');
      }
      
      // Add source files and .quartz build system (for pre-built deployment)
      await execAsync('git add .', { cwd: workspacePath });
      
      // Check if there are changes to commit
      let hasChanges = false;
      try {
        await execAsync('git diff --cached --quiet', { cwd: workspacePath });
      } catch (error: any) {
        // There are changes to commit (exit code 1 is expected when there are changes)
        if (error.code === 1) {
          hasChanges = true;
        } else {
          throw error;
        }
      }
      
      if (hasChanges) {
        // Commit changes
        await execAsync('git commit -m "Deploy Meridian Quartz site"', { cwd: workspacePath });
        console.log('Changes committed');
      }
      
      // Check if remote branch exists and has different commits
      let needsRebase = false;
      try {
        const { stdout } = await execAsync(`git rev-list --count ${branch}..origin/${branch}`, { cwd: workspacePath });
        const remoteBehind = parseInt(stdout.trim());
        if (remoteBehind > 0) {
          needsRebase = true;
          console.log(`Remote has ${remoteBehind} commits ahead, rebasing...`);
        }
      } catch (error: any) {
        console.log('Could not check remote commits (probably first push)');
      }
      
      if (needsRebase) {
        try {
          // Try to rebase our changes on top of remote changes
          await execAsync(`git rebase origin/${branch}`, { cwd: workspacePath });
          console.log('Successfully rebased local changes');
        } catch (rebaseError: any) {
          console.log('Rebase failed, trying to merge instead...');
          try {
            // Rebase failed, try merge
            await execAsync(`git merge origin/${branch} --no-edit`, { cwd: workspacePath });
            console.log('Successfully merged remote changes');
          } catch (mergeError: any) {
            console.log('Merge also failed, will force push to avoid conflicts...');
            // Both rebase and merge failed, force push (deployment scenario)
            await execAsync(`git push --force-with-lease origin ${branch}`, { cwd: workspacePath });
            console.log('Force pushed to GitHub (overwrote remote changes)');
            return;
          }
        }
      }
      
      // Normal push
      await execAsync(`git push -u origin ${branch}`, { cwd: workspacePath });
      console.log('Pushed to GitHub successfully!');
      
    } catch (error: any) {
      throw new Error(`Failed to commit and push: ${error.message}`);
    }
  }

  private async generateGitHubActionsWorkflow(workspacePath: string, config: any): Promise<void> {
    const workflowContent = `name: Deploy Pre-built Meridian Quartz Site

on:
  push:
    branches: ["${config.branch || 'main'}"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.quartz/public'

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

  /**
   * Deploy to GitHub Pages with automatic repository creation and setup
   */
  async deployToGitHubPages(config: GitHubDeployConfig): Promise<DeployResult> {
    try {
      console.log('Starting GitHub Pages deployment...');
      
      const { workspacePath } = config;
      
      // Get GitHub account - use first account if none specified
      let githubAccountId = config.githubAccountId;
      if (!githubAccountId) {
        const accounts = await this.githubManager.listAccounts();
        if (accounts.length === 0) {
          return {
            success: false,
            error: 'No GitHub accounts configured. Please add a GitHub account first.'
          };
        }
        // We know accounts[0] exists because we checked length above
        githubAccountId = accounts[0]?.id;
        if (!githubAccountId) {
          return {
            success: false,
            error: 'Invalid GitHub account found. Please remove and re-add the account.'
          };
        }
      }
      
      const account = await this.githubManager.getAccount(githubAccountId);
      if (!account) {
        return {
          success: false,
          error: 'GitHub account not found. Please check your account configuration.'
        };
      }
      
      const token = await this.githubManager.getToken(githubAccountId);
      if (!token) {
        return {
          success: false,
          error: 'GitHub token not found. Please re-add your GitHub account.'
        };
      }
      
      // Validate token before deployment
      const validation = await this.githubManager.validateAccountToken(githubAccountId);
      if (!validation.isValid) {
        return {
          success: false,
          error: 'GitHub token is invalid or expired. Please update your token.'
        };
      }
      
      // Generate repository name if not provided
      const workspaceName = path.basename(workspacePath);
      const repoName = config.repositoryName || `${workspaceName}-site`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const fullRepoName = `${account.username}/${repoName}`;
      
      // Check if repository exists, create if not
      const repoExists = await this.githubManager.repositoryExists(account.username, repoName, token);
      if (!repoExists) {
        console.log(`Creating repository: ${fullRepoName}`);
        await this.githubManager.createRepository(account.username, repoName, token, false);
      } else {
        console.log(`Using existing repository: ${fullRepoName}`);
      }
      
      // Build the site first
      console.log('Building Quartz site...');
      const buildResult = await this.buildSite({ workspacePath });
      if (buildResult.status !== 'success') {
        const errors = buildResult.errors || [];
        return {
          success: false,
          error: `Site build failed: ${errors.join(', ') || 'Unknown build error'}`
        };
      }
      
      // Setup GitHub Pages workflow
      console.log('Setting up GitHub Pages workflow...');
      await this.setupQuartzGitHubPagesWorkflow(workspacePath, fullRepoName, token);
      
      // Initialize git and deploy
      console.log('Deploying to GitHub...');
      await this.setupGitHubRepository(workspacePath, {
        repository: fullRepoName,
        personalAccessToken: token,
        branch: config.branch || 'main'
      });
      
      const siteUrl = `https://${account.username}.github.io/${repoName}`;
      
      return {
        success: true,
        url: siteUrl,
        repository: fullRepoName,
        message: 'Site deployed successfully! GitHub Pages may take a few minutes to become available.'
      };
      
    } catch (error: any) {
      console.error('GitHub Pages deployment failed:', error);
      return {
        success: false,
        error: `Deployment failed: ${error.message}`
      };
    }
  }

  /**
   * Setup Quartz GitHub Pages workflow based on official Quartz documentation
   */
  private async setupQuartzGitHubPagesWorkflow(workspacePath: string, repository: string, token: string): Promise<void> {
    try {
      // Create GitHub Actions workflow based on official Quartz docs
      const quartzWorkflow = `name: Deploy Quartz site to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

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
          node-version: 22
      - name: Install Dependencies
        run: npm ci
      - name: Build Quartz
        run: npx quartz build
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: public

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

      // Write workflow file
      const workflowDir = path.join(workspacePath, '.github', 'workflows');
      await fs.mkdir(workflowDir, { recursive: true });
      await fs.writeFile(path.join(workflowDir, 'deploy.yml'), quartzWorkflow);
      
      // Enable GitHub Pages via API
      if (!repository.includes('/')) {
        throw new Error('Invalid repository format. Expected format: owner/repo');
      }
      const [owner, repo] = repository.split('/');
      if (!owner || !repo) {
        throw new Error('Invalid repository format. Expected format: owner/repo');
      }
      await this.enableGitHubPages(owner, repo, token);
      
      console.log('GitHub Pages workflow created successfully');
      
    } catch (error) {
      console.error('Failed to setup GitHub Pages workflow:', error);
      throw error;
    }
  }
}

export default DeployManager; 