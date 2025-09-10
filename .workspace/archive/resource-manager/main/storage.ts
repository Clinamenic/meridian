import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import { Bookmark, BookmarkIndex, AppSettings } from '../shared/types';
import { generateBookmarkId, sanitizeFilename } from '../shared/utils';

export class StorageService {
  private dataDirectory: string;
  private bookmarksDirectory: string;
  private indexPath: string;
  private settingsPath: string;

  constructor() {
    this.dataDirectory = path.join(app.getPath('userData'), 'Resource Manager');
    this.bookmarksDirectory = path.join(this.dataDirectory, 'bookmarks');
    this.indexPath = path.join(this.dataDirectory, 'index.json');
    this.settingsPath = path.join(this.dataDirectory, 'settings.json');
  }

  async initialize(): Promise<void> {
    // Create directories if they don't exist
    await fs.mkdir(this.dataDirectory, { recursive: true });
    await fs.mkdir(this.bookmarksDirectory, { recursive: true });

    // Initialize index file if it doesn't exist
    try {
      await fs.access(this.indexPath);
    } catch {
      const initialIndex: BookmarkIndex = {
        version: '1.0.0',
        total_bookmarks: 0,
        last_updated: new Date().toISOString(),
        all_tags: [],
        bookmarks: []
      };
      await this.saveIndex(initialIndex);
    }

    // Initialize settings if they don't exist
    try {
      await fs.access(this.settingsPath);
    } catch {
      const defaultSettings: AppSettings = {
        data_directory: this.dataDirectory,
        save_content_by_default: false,
        max_concurrent_extractions: 5,
        extraction_timeout: 30000,
        max_content_size: 10 * 1024 * 1024, // 10MB
        theme: 'light'
      };
      await this.saveSettings(defaultSettings);
    }
  }

  async saveBookmark(bookmark: Bookmark): Promise<void> {
    const filename = `${bookmark.id}.json`;
    const filePath = path.join(this.bookmarksDirectory, filename);
    
    await fs.writeFile(filePath, JSON.stringify(bookmark, null, 2), 'utf-8');
    await this.updateIndex();
  }

  async getBookmark(id: string): Promise<Bookmark | null> {
    try {
      const filename = `${id}.json`;
      const filePath = path.join(this.bookmarksDirectory, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as Bookmark;
    } catch {
      return null;
    }
  }

  async getAllBookmarks(): Promise<Bookmark[]> {
    try {
      const files = await fs.readdir(this.bookmarksDirectory);
      const bookmarkFiles = files.filter(file => file.endsWith('.json'));
      
      const bookmarks: Bookmark[] = [];
      for (const file of bookmarkFiles) {
        try {
          const filePath = path.join(this.bookmarksDirectory, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const bookmark = JSON.parse(content) as Bookmark;
          bookmarks.push(bookmark);
        } catch (error) {
          console.error(`Error reading bookmark file ${file}:`, error);
        }
      }
      
      // Sort by date_added (newest first)
      return bookmarks.sort((a, b) => 
        new Date(b.date_added).getTime() - new Date(a.date_added).getTime()
      );
    } catch {
      return [];
    }
  }

  async deleteBookmark(id: string): Promise<boolean> {
    try {
      const filename = `${id}.json`;
      const filePath = path.join(this.bookmarksDirectory, filename);
      await fs.unlink(filePath);
      await this.updateIndex();
      return true;
    } catch {
      return false;
    }
  }

  async updateBookmark(id: string, updates: Partial<Bookmark>): Promise<boolean> {
    try {
      const existing = await this.getBookmark(id);
      if (!existing) return false;

      const updated: Bookmark = {
        ...existing,
        ...updates,
        date_modified: new Date().toISOString()
      };

      await this.saveBookmark(updated);
      return true;
    } catch {
      return false;
    }
  }

  async getIndex(): Promise<BookmarkIndex> {
    try {
      const content = await fs.readFile(this.indexPath, 'utf-8');
      return JSON.parse(content) as BookmarkIndex;
    } catch {
      // Return default index if file doesn't exist or is corrupt
      return {
        version: '1.0.0',
        total_bookmarks: 0,
        last_updated: new Date().toISOString(),
        all_tags: [],
        bookmarks: []
      };
    }
  }

  async saveIndex(index: BookmarkIndex): Promise<void> {
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  async updateIndex(): Promise<void> {
    const bookmarks = await this.getAllBookmarks();
    
    // Extract all unique tags
    const allTags = new Set<string>();
    bookmarks.forEach(bookmark => {
      bookmark.tags.forEach(tag => allTags.add(tag));
    });

    const index: BookmarkIndex = {
      version: '1.0.0',
      total_bookmarks: bookmarks.length,
      last_updated: new Date().toISOString(),
      all_tags: Array.from(allTags).sort(),
      bookmarks: bookmarks.map(bookmark => ({
        id: bookmark.id,
        url: bookmark.url,
        title: bookmark.title,
        tags: bookmark.tags,
        date_added: bookmark.date_added
      }))
    };

    await this.saveIndex(index);
  }

  async getSettings(): Promise<AppSettings> {
    try {
      const content = await fs.readFile(this.settingsPath, 'utf-8');
      return JSON.parse(content) as AppSettings;
    } catch {
      // Return default settings
      return {
        data_directory: this.dataDirectory,
        save_content_by_default: false,
        max_concurrent_extractions: 5,
        extraction_timeout: 30000,
        max_content_size: 10 * 1024 * 1024,
        theme: 'light'
      };
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await fs.writeFile(this.settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  async exportBookmarks(exportPath: string): Promise<boolean> {
    try {
      const bookmarks = await this.getAllBookmarks();
      const exportData = {
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        total_bookmarks: bookmarks.length,
        bookmarks
      };
      
      await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2), 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  async importBookmarks(importPath: string): Promise<number> {
    try {
      const content = await fs.readFile(importPath, 'utf-8');
      const importData = JSON.parse(content);
      
      if (!importData.bookmarks || !Array.isArray(importData.bookmarks)) {
        throw new Error('Invalid import file format');
      }

      let importedCount = 0;
      for (const bookmarkData of importData.bookmarks) {
        try {
          // Generate new ID to avoid conflicts
          const newId = generateBookmarkId(bookmarkData.url);
          
          // Check if bookmark already exists
          const existing = await this.getBookmark(newId);
          if (existing) {
            continue; // Skip duplicates
          }

          const bookmark: Bookmark = {
            ...bookmarkData,
            id: newId,
            date_modified: new Date().toISOString()
          };

          await this.saveBookmark(bookmark);
          importedCount++;
        } catch (error) {
          console.error('Error importing bookmark:', error);
        }
      }

      return importedCount;
    } catch {
      return 0;
    }
  }

  async bookmarkExists(url: string): Promise<boolean> {
    const id = generateBookmarkId(url);
    const bookmark = await this.getBookmark(id);
    return bookmark !== null;
  }

  getDataDirectory(): string {
    return this.dataDirectory;
  }

  getBookmarksDirectory(): string {
    return this.bookmarksDirectory;
  }
} 