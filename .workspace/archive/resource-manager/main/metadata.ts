import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Bookmark, BookmarkMetadata, ExtractionResult } from '../shared/types';
import { 
  generateBookmarkId, 
  normalizeUrl, 
  isValidUrl, 
  urlToFilename, 
  cleanTextPreview,
  sanitizeFilename
} from '../shared/utils';

export class MetadataExtractor {
  private userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  private timeout = 30000; // 30 seconds
  private maxContentSize = 10 * 1024 * 1024; // 10MB

  constructor(
    private contentDirectory: string,
    timeout?: number,
    maxContentSize?: number
  ) {
    if (timeout) this.timeout = timeout;
    if (maxContentSize) this.maxContentSize = maxContentSize;
  }

  async extractMetadata(
    url: string, 
    tags: string[] = [],
    saveContent: boolean = false
  ): Promise<ExtractionResult> {
    try {
      // Validate URL
      if (!isValidUrl(url)) {
        return {
          success: false,
          error: 'Invalid URL format'
        };
      }

      const normalizedUrl = normalizeUrl(url);
      const id = generateBookmarkId(normalizedUrl);

      // Fetch webpage content
      const response = await axios.get(normalizedUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: this.timeout,
        maxContentLength: this.maxContentSize,
        maxRedirects: 5,
        validateStatus: (status) => status < 400
      });

      if (!response.data) {
        return {
          success: false,
          error: 'No content received from URL'
        };
      }

      // Parse HTML content
      const $ = cheerio.load(response.data);
      const metadata = this.parseMetadata($, normalizedUrl);

      // Save content if requested
      let filePath: string | null = null;
      let absolutePath: string | null = null;

      if (saveContent) {
        try {
          const filename = `${urlToFilename(normalizedUrl)}_${id}.html`;
          const safeFilename = sanitizeFilename(filename);
          filePath = `private/bookmarks/${safeFilename}`;
          absolutePath = path.join(this.contentDirectory, safeFilename);
          
          await fs.mkdir(path.dirname(absolutePath), { recursive: true });
          await fs.writeFile(absolutePath, response.data, 'utf-8');
        } catch (error) {
          console.error('Error saving content:', error);
          // Continue without saving content
        }
      }

      const bookmark: Bookmark = {
        id,
        url: normalizedUrl,
        file_path: filePath,
        absolute_path: absolutePath,
        title: metadata.extracted_title || new URL(normalizedUrl).hostname,
        date_added: new Date().toISOString(),
        date_modified: new Date().toISOString(),
        tags: tags.map(tag => tag.toLowerCase()),
        save_content: saveContent,
        metadata,
        extraction_status: 'success',
        extraction_errors: []
      };

      return {
        success: true,
        bookmark
      };

    } catch (error) {
      // Create minimal bookmark even on failure
      const normalizedUrl = normalizeUrl(url);
      const id = generateBookmarkId(normalizedUrl);
      
      const fallbackBookmark: Bookmark = {
        id,
        url: normalizedUrl,
        file_path: null,
        absolute_path: null,
        title: this.extractTitleFromUrl(normalizedUrl),
        date_added: new Date().toISOString(),
        date_modified: new Date().toISOString(),
        tags: tags.map(tag => tag.toLowerCase()),
        save_content: false,
        metadata: this.createFallbackMetadata(normalizedUrl),
        extraction_status: 'failed',
        extraction_errors: [error instanceof Error ? error.message : 'Unknown error']
      };

      return {
        success: false,
        bookmark: fallbackBookmark,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private parseMetadata($: cheerio.CheerioAPI, url: string): BookmarkMetadata {
    // Extract basic title
    const title = this.extractTitle($);
    
    // Extract meta description
    const metaDescription = this.extractMetaDescription($);
    
    // Extract meta keywords
    const metaKeywords = this.extractMetaKeywords($);
    
    // Extract Open Graph data
    const openGraph = this.extractOpenGraph($);
    
    // Extract Twitter Card data
    const twitterCard = this.extractTwitterCard($);
    
    // Extract additional metadata
    const author = this.extractAuthor($);
    const publishDate = this.extractPublishDate($);
    const lang = this.extractLanguage($);
    
    // Extract text preview
    const textPreview = this.extractTextPreview($);
    
    // Extract meta image
    const metaImage = openGraph.image || twitterCard.image || this.extractMetaImage($);
    
    // Calculate word count
    const wordCount = this.calculateWordCount($);

    return {
      extracted_title: title,
      meta_description: metaDescription,
      meta_keywords: metaKeywords,
      text_preview: textPreview,
      meta_image: metaImage,
      open_graph: openGraph,
      twitter_card: twitterCard,
      author,
      publish_date: publishDate,
      word_count: wordCount,
      lang
    };
  }

  private extractTitle($: cheerio.CheerioAPI): string {
    // Try various title sources in order of preference
    const sources = [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'title',
      'h1',
      'meta[name="title"]'
    ];

    for (const selector of sources) {
      const element = $(selector).first();
      if (element.length) {
        const content = selector.includes('meta') 
          ? element.attr('content') 
          : element.text();
        
        if (content && content.trim()) {
          return content.trim();
        }
      }
    }

    return '';
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      if (pathname && pathname !== '/') {
        // Extract meaningful part from path
        const parts = pathname.split('/').filter(part => part.length > 0);
        if (parts.length > 0) {
          const lastPart = parts[parts.length - 1];
          return lastPart
            .replace(/[-_]/g, ' ')
            .replace(/\.\w+$/, '') // Remove file extensions
            .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize words
        }
      }
      
      return urlObj.hostname;
    } catch {
      return 'Untitled Bookmark';
    }
  }

  private extractMetaDescription($: cheerio.CheerioAPI): string | null {
    const description = $('meta[name="description"]').attr('content') ||
                      $('meta[property="og:description"]').attr('content') ||
                      $('meta[name="twitter:description"]').attr('content');
    
    return description ? description.trim() : null;
  }

  private extractMetaKeywords($: cheerio.CheerioAPI): string[] | null {
    const keywords = $('meta[name="keywords"]').attr('content');
    if (!keywords) return null;
    
    return keywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0)
      .slice(0, 10); // Limit to 10 keywords
  }

  private extractOpenGraph($: cheerio.CheerioAPI): BookmarkMetadata['open_graph'] {
    return {
      title: $('meta[property="og:title"]').attr('content') || null,
      description: $('meta[property="og:description"]').attr('content') || null,
      image: $('meta[property="og:image"]').attr('content') || null,
      type: $('meta[property="og:type"]').attr('content') || null
    };
  }

  private extractTwitterCard($: cheerio.CheerioAPI): BookmarkMetadata['twitter_card'] {
    return {
      title: $('meta[name="twitter:title"]').attr('content') || null,
      description: $('meta[name="twitter:description"]').attr('content') || null,
      image: $('meta[name="twitter:image"]').attr('content') || null
    };
  }

  private extractAuthor($: cheerio.CheerioAPI): string | null {
    const author = $('meta[name="author"]').attr('content') ||
                  $('meta[property="article:author"]').attr('content') ||
                  $('meta[name="twitter:creator"]').attr('content') ||
                  $('.author').first().text() ||
                  $('[rel="author"]').first().text();
    
    return author ? author.trim() : null;
  }

  private extractPublishDate($: cheerio.CheerioAPI): string | null {
    const dateSelectors = [
      'meta[property="article:published_time"]',
      'meta[name="publish_date"]',
      'meta[name="date"]',
      'time[datetime]',
      '.published-date',
      '.date'
    ];

    for (const selector of dateSelectors) {
      const element = $(selector).first();
      if (element.length) {
        const dateValue = element.attr('content') || 
                         element.attr('datetime') || 
                         element.text();
        
        if (dateValue) {
          try {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
              return date.toISOString();
            }
          } catch {
            // Continue to next selector
          }
        }
      }
    }

    return null;
  }

  private extractLanguage($: cheerio.CheerioAPI): string | null {
    return $('html').attr('lang') || 
           $('meta[http-equiv="content-language"]').attr('content') ||
           null;
  }

  private extractTextPreview($: cheerio.CheerioAPI): string {
    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .ad, .advertisement').remove();
    
    // Try to find main content
    const contentSelectors = [
      'article',
      'main',
      '.content',
      '.post-content',
      '.entry-content',
      '#content',
      'body'
    ];

    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length) {
        const text = element.text();
        if (text && text.trim().length > 100) {
          return cleanTextPreview(text, 400);
        }
      }
    }

    // Fallback to body text
    const bodyText = $('body').text();
    return cleanTextPreview(bodyText, 400);
  }

  private extractMetaImage($: cheerio.CheerioAPI): string | null {
    const imageSelectors = [
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'meta[name="image"]',
      'link[rel="image_src"]'
    ];

    for (const selector of imageSelectors) {
      const element = $(selector).first();
      if (element.length) {
        const imageUrl = element.attr('content') || element.attr('href');
        if (imageUrl) {
          return imageUrl;
        }
      }
    }

    return null;
  }

  private calculateWordCount($: cheerio.CheerioAPI): number {
    // Remove scripts and styles
    $('script, style').remove();
    
    const text = $('body').text();
    const words = text.match(/\b\w+\b/g);
    return words ? words.length : 0;
  }

  private createFallbackMetadata(url: string): BookmarkMetadata {
    return {
      extracted_title: this.extractTitleFromUrl(url),
      meta_description: null,
      meta_keywords: null,
      text_preview: `Failed to extract content from ${url}`,
      meta_image: null,
      open_graph: {
        title: null,
        description: null,
        image: null,
        type: null
      },
      twitter_card: {
        title: null,
        description: null,
        image: null
      },
      author: null,
      publish_date: null,
      word_count: 0,
      lang: null
    };
  }
} 