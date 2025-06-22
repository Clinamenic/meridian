import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { MarkdownFile } from '../types';

export class MarkdownProcessor {
  private watchers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Scan content directory for markdown files
   */
  async scanContentDirectory(directory: string): Promise<MarkdownFile[]> {
    const markdownFiles: MarkdownFile[] = [];

    try {
      // Check if directory exists
      const stats = await fs.promises.stat(directory);
      if (!stats.isDirectory()) {
        throw new Error(`${directory} is not a directory`);
      }

      // Recursively find all .md files
      const files = await this.findMarkdownFiles(directory);
      
      // Parse each markdown file
      for (const filePath of files) {
        try {
          const markdownFile = await this.parseMarkdownFile(filePath);
          markdownFiles.push(markdownFile);
        } catch (error) {
          console.warn(`Failed to parse markdown file ${filePath}:`, error);
          // Continue processing other files
        }
      }

      return markdownFiles;
    } catch (error) {
      console.error(`Failed to scan content directory ${directory}:`, error);
      return [];
    }
  }

  /**
   * Parse single markdown file
   */
  async parseMarkdownFile(filePath: string): Promise<MarkdownFile> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const stats = await fs.promises.stat(filePath);
      
      const frontmatter = this.extractFrontmatter(content);
      const title = this.extractTitle(content, frontmatter);
      const relativePath = path.relative(process.cwd(), filePath);

      return {
        filePath,
        relativePath,
        frontmatter,
        title,
        content,
        lastModified: stats.mtime.toISOString(),
        url: this.generateFileUrl(filePath),
      };
    } catch (error) {
      throw new Error(`Failed to parse markdown file ${filePath}: ${error}`);
    }
  }

  /**
   * Watch for changes in content directory
   */
  watchContentDirectory(
    directory: string,
    callback: (files: MarkdownFile[]) => void
  ): void {
    // Stop existing watcher if any
    this.stopWatching(directory);

    // Simple polling-based watching (can be enhanced with proper file watching later)
    const interval = setInterval(async () => {
      try {
        await this.handleDirectoryChange(directory, callback);
      } catch (error: any) {
        console.error(`Watcher error for ${directory}:`, error);
      }
    }, 2000); // Check every 2 seconds

    this.watchers.set(directory, interval);
  }

  /**
   * Stop watching a directory
   */
  stopWatching(directory: string): void {
    const interval = this.watchers.get(directory);
    if (interval) {
      clearInterval(interval);
      this.watchers.delete(directory);
    }
  }

  /**
   * Stop all watchers
   */
  stopAllWatching(): void {
    for (const [directory] of this.watchers) {
      this.stopWatching(directory);
    }
  }

  /**
   * Extract frontmatter with js-yaml
   */
  extractFrontmatter(content: string): Record<string, any> {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return {};

    try {
      const result = frontmatterMatch[1] ? yaml.load(frontmatterMatch[1]) : null;
      return (result && typeof result === 'object') ? result as Record<string, any> : {};
    } catch (error) {
      console.warn('Failed to parse frontmatter YAML:', error);
      return {};
    }
  }

  /**
   * Recursively find all markdown files in directory
   */
  private async findMarkdownFiles(directory: string): Promise<string[]> {
    const files: string[] = [];
    
    async function traverse(dir: string) {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip hidden directories
          if (!entry.name.startsWith('.')) {
            await traverse(fullPath);
          }
        } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
          files.push(fullPath);
        }
      }
    }
    
    await traverse(directory);
    return files;
  }

  /**
   * Extract title from markdown content
   */
  private extractTitle(content: string, frontmatter: Record<string, any>): string {
    // Try frontmatter title first
    if (frontmatter.title && typeof frontmatter.title === 'string') {
      return frontmatter.title;
    }

    // Try first H1 heading
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match && h1Match[1]) {
      return h1Match[1].trim();
    }

    // Fallback to filename without extension
    return path.basename(content, path.extname(content));
  }

  /**
   * Generate URL for markdown file (basic implementation)
   */
  private generateFileUrl(filePath: string): string {
    const relativePath = path.relative(process.cwd(), filePath);
    const urlPath = relativePath
      .replace(/^content\//, '') // Remove content/ prefix
      .replace(/\.md$/, '') // Remove .md extension
      .replace(/\\/g, '/'); // Normalize path separators
    
    return `/${urlPath}`;
  }

  /**
   * Handle directory change events
   */
  private async handleDirectoryChange(
    directory: string,
    callback: (files: MarkdownFile[]) => void
  ): Promise<void> {
    try {
      const files = await this.scanContentDirectory(directory);
      callback(files);
    } catch (error) {
      console.error(`Failed to handle directory change for ${directory}:`, error);
    }
  }
} 