import { ipcMain, dialog, BrowserWindow } from 'electron';
import { StorageService } from './storage';
import { MetadataExtractor } from './metadata';
import { 
  ExtractionResult, 
  SearchFilters, 
  BatchProcessingStatus, 
  AppSettings 
} from '../shared/types';
import { isValidUrl, matchesFilters } from '../shared/utils';

let storageService: StorageService;
let metadataExtractor: MetadataExtractor;

export async function setupIpcHandlers(): Promise<void> {
  // Initialize services
  storageService = new StorageService();
  await storageService.initialize();
  
  metadataExtractor = new MetadataExtractor(
    storageService.getBookmarksDirectory()
  );

  // Bookmark operations
  ipcMain.handle('bookmark:add', async (event, urls: string[], tags: string[] = []) => {
    return await addBookmarks(urls, tags, event.sender);
  });

  ipcMain.handle('bookmark:get-all', async () => {
    return await storageService.getAllBookmarks();
  });

  ipcMain.handle('bookmark:get-by-id', async (event, id: string) => {
    return await storageService.getBookmark(id);
  });

  ipcMain.handle('bookmark:update', async (event, id: string, updates: any) => {
    return await storageService.updateBookmark(id, updates);
  });

  ipcMain.handle('bookmark:delete', async (event, id: string) => {
    return await storageService.deleteBookmark(id);
  });

  ipcMain.handle('bookmark:search', async (event, filters: SearchFilters) => {
    return await searchBookmarks(filters);
  });

  // Import/Export
  ipcMain.handle('bookmark:export', async (event, filePath?: string) => {
    if (!filePath) {
      const result = await dialog.showSaveDialog({
        title: 'Export Bookmarks',
        defaultPath: 'bookmarks-export.json',
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (result.canceled || !result.filePath) {
        return false;
      }
      filePath = result.filePath;
    }
    
    return await storageService.exportBookmarks(filePath);
  });

  ipcMain.handle('bookmark:import', async (event, filePath?: string) => {
    if (!filePath) {
      const result = await dialog.showOpenDialog({
        title: 'Import Bookmarks',
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });
      
      if (result.canceled || result.filePaths.length === 0) {
        return 0;
      }
      filePath = result.filePaths[0];
    }
    
    return await storageService.importBookmarks(filePath);
  });

  // Tags
  ipcMain.handle('tags:get-all', async () => {
    const index = await storageService.getIndex();
    return index.all_tags;
  });

  // Settings
  ipcMain.handle('settings:get', async () => {
    return await storageService.getSettings();
  });

  ipcMain.handle('settings:update', async (event, settings: Partial<AppSettings>) => {
    try {
      const currentSettings = await storageService.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      await storageService.saveSettings(updatedSettings);
      return true;
    } catch {
      return false;
    }
  });

  // File dialogs
  ipcMain.handle('dialog:show-open', async (event, options: any) => {
    return await dialog.showOpenDialog(options);
  });

  ipcMain.handle('dialog:show-save', async (event, options: any) => {
    return await dialog.showSaveDialog(options);
  });
}

async function addBookmarks(
  urls: string[], 
  tags: string[] = [], 
  sender: Electron.WebContents
): Promise<ExtractionResult[]> {
  const results: ExtractionResult[] = [];
  const validUrls = urls.filter(url => isValidUrl(url.trim()));
  
  if (validUrls.length === 0) {
    return results;
  }

  const settings = await storageService.getSettings();
  const batchStatus: BatchProcessingStatus = {
    total: validUrls.length,
    processed: 0,
    successful: 0,
    failed: 0,
    is_complete: false
  };

  // Send initial progress
  sender.send('progress:update', batchStatus);

  // Process URLs with concurrency limit
  const concurrencyLimit = settings.max_concurrent_extractions;
  const chunks = chunkArray(validUrls, concurrencyLimit);

  for (const chunk of chunks) {
    const chunkPromises = chunk.map(async (url) => {
      try {
        batchStatus.current_url = url;
        sender.send('progress:update', batchStatus);

        // Check if bookmark already exists
        const exists = await storageService.bookmarkExists(url);
        if (exists) {
          batchStatus.processed++;
          sender.send('progress:update', batchStatus);
          return {
            success: false,
            error: 'Bookmark already exists'
          };
        }

        // Extract metadata
        const result = await metadataExtractor.extractMetadata(
          url, 
          tags, 
          settings.save_content_by_default
        );

        if (result.success && result.bookmark) {
          await storageService.saveBookmark(result.bookmark);
          batchStatus.successful++;
        } else {
          // Save failed bookmark anyway
          if (result.bookmark) {
            await storageService.saveBookmark(result.bookmark);
          }
          batchStatus.failed++;
        }

        batchStatus.processed++;
        sender.send('progress:update', batchStatus);
        
        return result;
      } catch (error) {
        batchStatus.failed++;
        batchStatus.processed++;
        sender.send('progress:update', batchStatus);
        
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);

    // Small delay between chunks to be respectful
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  batchStatus.is_complete = true;
  batchStatus.current_url = undefined;
  sender.send('progress:update', batchStatus);

  return results;
}

async function searchBookmarks(filters: SearchFilters) {
  const allBookmarks = await storageService.getAllBookmarks();
  
  if (!filters.query && (!filters.tags || filters.tags.length === 0) && !filters.date_range) {
    return allBookmarks;
  }

  return allBookmarks.filter(bookmark => matchesFilters(bookmark, filters));
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
} 