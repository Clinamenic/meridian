import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

interface ContentSummary {
  totalFiles: number;
  markdownFiles: number;
  imageFiles: number;
  otherFiles: number;
  totalSize: number;
  directories: string[];
  hasObsidianFiles: boolean;
  hasFrontmatter: number;
  fileTypes: { [extension: string]: number };
}

interface SystemCheck {
  isValid: boolean;
  issues: string[];
}

/**
 * Deploy Manager for Meridian Digital Gardens
 * 
 * Uses the Meridian-Quartz fork (https://github.com/Clinamenic/meridian-quartz)
 * which is pre-configured for Meridian workflow and eliminates runtime customization.
 */
class DeployManager {
  private workspacePath: string = '';

  constructor() {
    this.registerIpcHandlers();
  }

  private registerIpcHandlers(): void {
    ipcMain.handle('deploy:load-data', () => this.loadDeployData());
    ipcMain.handle('deploy:save-config', (_, config) => this.saveDeployConfig(config));
    ipcMain.handle('deploy:initialize-quartz', (_, workspacePath) => this.initializeQuartz(workspacePath));
    ipcMain.handle('deploy:build-site', (_, config) => this.buildSite(config));
    ipcMain.handle('deploy:preview-site', (_, config) => this.previewSite(config));
    ipcMain.handle('deploy:scan-content', (_, workspacePath) => this.scanContent(workspacePath));
    ipcMain.handle('deploy:validate-system', () => this.validateSystem());
    ipcMain.handle('deploy:deploy-github', (_, config) => this.deployGitHub(config));
    ipcMain.handle('deploy:export-static', (_, config) => this.exportStatic(config));
    ipcMain.handle('deploy:check-initialized', (_, workspacePath) => this.checkQuartzInitialized(workspacePath));
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
    const summary: ContentSummary = {
      totalFiles: 0,
      markdownFiles: 0,
      imageFiles: 0,
      otherFiles: 0,
      totalSize: 0,
      directories: [],
      hasObsidianFiles: false,
      hasFrontmatter: 0,
      fileTypes: {}
    };
    
    try {
      const entries = await this.getAllFiles(workspacePath);
      
      for (const entry of entries) {
        try {
          const stats = await fs.stat(entry);
          
          if (stats.isFile()) {
            summary.totalFiles++;
            summary.totalSize += stats.size;
            
            const ext = path.extname(entry).toLowerCase();
            const relativePath = path.relative(workspacePath, entry);
            
            if (this.shouldIgnoreFile(relativePath)) {
              continue;
            }
            
            // Track file type counts
            if (ext) {
              summary.fileTypes[ext] = (summary.fileTypes[ext] || 0) + 1;
            } else {
              // Files without extensions
              summary.fileTypes['(no ext)'] = (summary.fileTypes['(no ext)'] || 0) + 1;
            }
            
            if (ext === '.md' || ext === '.mdx') {
              summary.markdownFiles++;
              
              try {
                const content = await fs.readFile(entry, 'utf-8');
                if (content.startsWith('---')) {
                  summary.hasFrontmatter++;
                }
                
                if (content.includes('[[') && content.includes(']]')) {
                  summary.hasObsidianFiles = true;
                }
              } catch {
                // Skip files we can't read
              }
            } else if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'].includes(ext)) {
              summary.imageFiles++;
            } else {
              summary.otherFiles++;
            }
          } else if (stats.isDirectory()) {
            const relativePath = path.relative(workspacePath, entry);
            if (!this.shouldIgnoreFile(relativePath) && relativePath !== '') {
              summary.directories.push(relativePath);
            }
          }
        } catch {
          // Skip files/directories we can't access
        }
      }
      
      return summary;
    } catch {
      throw new Error('Failed to scan workspace content');
    }
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

  private shouldIgnoreFile(relativePath: string): boolean {
    const ignorePatterns = [
      '.quartz',
      '.meridian',
      '.git',
      'node_modules',
      'dist',
      'build',
      '.vscode',
      '.DS_Store'
    ];
    
    return ignorePatterns.some(pattern => relativePath.includes(pattern));
  }

  async initializeQuartz(workspacePath: string): Promise<void> {
    try {
      const quartzPath = path.join(workspacePath, '.quartz');
      
      // Clean up existing .quartz directory if it exists
      try {
        await fs.rm(quartzPath, { recursive: true, force: true });
      } catch {
        // Ignore if directory doesn't exist
      }
      
      // Create .quartz directory
      await fs.mkdir(quartzPath, { recursive: true });
      
      // Clone pre-configured Meridian-Quartz repository
      await this.createQuartzProject(quartzPath);
      
      // Create minimal package.json for workspace (GitHub Actions compatibility)
      await this.createWorkspacePackageJson(workspacePath);
      
      // No configuration generation needed - meridian-quartz comes pre-configured!
      
      // Update .gitignore to exclude build artifacts
      await this.updateGitignore(workspacePath);
      
    } catch (error: any) {
      console.error('Meridian-Quartz initialization error:', error);
      throw new Error(`Failed to initialize Meridian-Quartz project: ${error.message}`);
    }
  }

  private async createQuartzProject(quartzPath: string): Promise<void> {
    // Clone the Meridian-Quartz repository (pre-configured for Meridian)
    return new Promise((resolve, reject) => {
      console.log(`Cloning Meridian-Quartz repository to ${quartzPath}...`);
      
      const child = spawn('git', [
        'clone', 
        '--branch', 'meridian-main',
        'https://github.com/Clinamenic/meridian-quartz.git', 
        '.'
      ], {
        cwd: quartzPath,
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
      
      child.on('close', async (code) => {
        if (code === 0) {
          try {
            console.log('Meridian-Quartz cloned successfully, installing dependencies...');
            
            // No customization needed - meridian-quartz is pre-configured!
            await this.installQuartzDependencies(quartzPath);
            resolve();
          } catch (error) {
            reject(error);
          }
        } else {
          const errorMessage = `Git clone failed with code ${code}. Stdout: ${stdout}. Stderr: ${stderr}`;
          console.error(errorMessage);
          reject(new Error(errorMessage));
        }
      });
      
      child.on('error', (error) => {
        const errorMessage = `Failed to clone Meridian-Quartz repository: ${error.message}`;
        console.error(errorMessage);
        reject(new Error(errorMessage));
      });
    });
  }



  private async installQuartzDependencies(quartzPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Installing Meridian-Quartz dependencies...');
      
      // Use --force to bypass engine checks if needed
      const child = spawn('npm', ['install', '--force'], {
        cwd: quartzPath,
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
          console.log('Dependencies installed successfully');
          resolve();
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

  private async createWorkspacePackageJson(workspacePath: string): Promise<void> {
    // Create a minimal package.json for GitHub Actions compatibility
    const packageJson = {
      "name": "meridian-digital-garden",
      "version": "1.0.0",
      "type": "module",
      "engines": { 
        "node": ">=22",
        "npm": ">=10.9.2"
      },
      "scripts": {
        "build": "npx quartz build",
        "serve": "npx quartz build --serve"
      },
      "devDependencies": {
        "@types/d3": "^7.4.0",
        "@types/hast": "^2.3.4",
        "@types/js-yaml": "^4.0.5",
        "@types/node": "^20.14.0",
        "@types/yargs": "^17.0.24",
        "esbuild-sass-plugin": "^2.16.0",
        "tsx": "^4.7.1",
        "typescript": "^5.4.5"
      },
      "dependencies": {
        "@clack/prompts": "^0.7.0",
        "@floating-ui/dom": "^1.6.1",
        "@napi-rs/simple-git": "^0.5.0",
        "chokidar": "^3.6.0",
        "d3": "^7.8.5",
        "esbuild": "0.19.8",
        "flexsearch": "0.7.21",
        "github-slugger": "^2.0.0",
        "gray-matter": "^4.0.3",
        "hast-util-to-jsx-runtime": "^2.3.0",
        "hast-util-to-string": "^3.0.0",
        "is-absolute-url": "^4.0.1",
        "js-yaml": "^4.1.0",
        "lightningcss": "^1.21.5",
        "mdast-util-find-and-replace": "^3.0.1",
        "mdast-util-to-hast": "^13.0.2",
        "mdast-util-to-string": "^4.0.0",
        "micromorph": "^0.4.5",
        "preact": "^10.19.6",
        "preact-render-to-string": "^6.4.0",
        "pretty-bytes": "^6.1.1",
        "reading-time": "^1.5.0",
        "rehype-autolink-headings": "^7.1.0",
        "rehype-citation": "^2.0.0",
        "rehype-katex": "^7.0.0",
        "rehype-mathjax": "^6.0.0",
        "rehype-pretty-code": "^0.13.2",
        "rehype-raw": "^7.0.0",
        "rehype-slug": "^6.0.0",
        "remark": "^15.0.1",
        "remark-breaks": "^4.0.0",
        "remark-frontmatter": "^5.0.0",
        "remark-gfm": "^4.0.0",
        "remark-math": "^6.0.0",
        "remark-parse": "^11.0.0",
        "remark-rehype": "^11.0.0",
        "remark-wiki-link": "^1.0.4",
        "rfdc": "^1.3.1",
        "rimraf": "^5.0.5",
        "serve-handler": "^6.1.5",
        "shiki": "^1.3.0",
        "source-map-support": "^0.5.21",
        "to-vfile": "^8.0.0",
        "unified": "^11.0.4",
        "unist-util-visit": "^5.0.0",
        "vfile": "^6.0.1",
        "workbox-build": "^7.0.0",
        "ws": "^8.16.0",
        "yargs": "^17.7.2"
      }
    };
    
    await fs.writeFile(
      path.join(workspacePath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
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
    
    try {
      const workspacePath = config.workspacePath || this.workspacePath;
      const quartzPath = path.join(workspacePath, '.quartz');
      
      console.log(`Starting Meridian-Quartz build for workspace: ${workspacePath}`);
      
      // Build with Meridian-Quartz reading directly from workspace root
      const { stdout, stderr } = await execAsync(`npx quartz build --directory "${workspacePath}" --output "${path.join(quartzPath, 'public')}"`, {
        cwd: quartzPath,
        env: { ...process.env }
      });
      
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
      const duration = Date.now() - startTime;
              console.error(`Build failed after ${duration}ms:`, error);
      
      // Format error output
              let errorOutput = `Build failed after ${duration}ms\n`;
      errorOutput += `Error: ${error.message}\n\n`;
      
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
        errors: [error.message],
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
      
      await this.generateGitHubActionsWorkflow(workspacePath, deployment);
      
      return {
        success: true,
        url: `https://${deployment.repository.split('/')[0]}.github.io/${deployment.repository.split('/')[1]}/`,
        message: 'GitHub Actions workflow created. Push to repository to deploy.'
      };
    } catch {
      return {
        success: false,
        error: 'Deployment setup failed'
      };
    }
  }

  private async generateGitHubActionsWorkflow(workspacePath: string, config: any): Promise<void> {
    const workflowContent = `name: Deploy Quartz site to GitHub Pages

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
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build site
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './public'

  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
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
      const publicPath = path.join(workspacePath, 'public');
      
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
}

export default DeployManager; 