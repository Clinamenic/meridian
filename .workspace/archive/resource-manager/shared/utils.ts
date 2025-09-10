import * as crypto from 'crypto-js';

/**
 * Generate a deterministic ID from a URL using SHA-256
 */
export function generateBookmarkId(url: string): string {
  const normalizedUrl = normalizeUrl(url);
  const hash = crypto.SHA256(normalizedUrl).toString();
  return hash.substring(0, 10);
}

/**
 * Normalize URL for consistent processing
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Remove trailing slash
    if (urlObj.pathname.endsWith('/') && urlObj.pathname.length > 1) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    
    // Sort query parameters for consistency
    const params = new URLSearchParams(urlObj.search);
    const sortedParams = new URLSearchParams();
    Array.from(params.keys()).sort().forEach(key => {
      sortedParams.append(key, params.get(key) || '');
    });
    urlObj.search = sortedParams.toString();
    
    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Validate if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Generate safe filename from URL
 */
export function urlToFilename(url: string): string {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/[^a-zA-Z0-9]/g, '-');
    const path = urlObj.pathname.replace(/[^a-zA-Z0-9]/g, '-');
    const filename = `${domain}${path}`.replace(/-+/g, '-').replace(/^-|-$/g, '');
    return filename.substring(0, 50) || 'bookmark';
  } catch {
    return 'invalid-url';
  }
}

/**
 * Clean and truncate text preview
 */
export function cleanTextPreview(text: string, maxLength: number = 400): string {
  // Remove extra whitespace and newlines
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
  
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  
  // Truncate at word boundary
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days} day${days === 1 ? '' : 's'} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    } else {
      return 'Just now';
    }
  } catch {
    return 'Unknown';
  }
}

/**
 * Sanitize filename to prevent directory traversal
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/^\.+/, '')
    .substring(0, 255);
}

/**
 * Debounce function for search input
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Parse tags from string input
 */
export function parseTags(tagString: string): string[] {
  return tagString
    .split(/[,\s]+/)
    .map(tag => tag.trim().toLowerCase())
    .filter(tag => tag.length > 0 && tag.length <= 50)
    .slice(0, 20); // Limit to 20 tags max
}

/**
 * Extract URLs from any text input
 */
export function extractUrlsFromText(text: string): string[] {
  // URL regex pattern that matches http/https URLs
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const matches = text.match(urlRegex);
  
  if (!matches) {
    return [];
  }
  
  // Clean up URLs and remove duplicates
  const urls = matches
    .map(url => url.trim())
    .filter(url => isValidUrl(url))
    .filter((url, index, array) => array.indexOf(url) === index); // Remove duplicates
  
  return urls;
}

/**
 * Check if bookmark matches search filters
 */
export function matchesFilters(bookmark: any, filters: any): boolean {
  const { query, tags, date_range } = filters;
  
  // Text search
  if (query) {
    const searchText = `${bookmark.title} ${bookmark.url} ${bookmark.metadata.meta_description || ''} ${bookmark.metadata.text_preview}`.toLowerCase();
    if (!searchText.includes(query.toLowerCase())) {
      return false;
    }
  }
  
  // Tag filter
  if (tags && tags.length > 0) {
    const hasMatchingTag = tags.some((tag: string) => 
      bookmark.tags.includes(tag.toLowerCase())
    );
    if (!hasMatchingTag) {
      return false;
    }
  }
  
  // Date range filter
  if (date_range) {
    const bookmarkDate = new Date(bookmark.date_added);
    const startDate = new Date(date_range.start);
    const endDate = new Date(date_range.end);
    
    if (bookmarkDate < startDate || bookmarkDate > endDate) {
      return false;
    }
  }
  
  return true;
} 