import * as cheerio from 'cheerio';
import { URL } from 'url';

export interface ExtractedMetadata {
  title: string;
  description: string;
  imageUrl?: string;
  favicon?: string;
  siteName?: string;
}

export class MetadataExtractor {
  private readonly timeout = 10000; // 10 seconds
  private readonly userAgent = 'Mozilla/5.0 (compatible; Meridian/1.0)';

  constructor() {}

  /**
   * Extract metadata from a URL
   */
  public async extractMetadata(url: string): Promise<ExtractedMetadata> {
    try {
      // Validate URL
      const parsedUrl = new URL(url);
      
      // Fetch the page
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      return this.parseMetadata(html, parsedUrl);
    } catch (error) {
      console.error(`Failed to extract metadata from ${url}:`, error);
      
      // Return basic metadata with URL as title
      return {
        title: this.getBasicTitle(url),
        description: '',
        imageUrl: undefined,
        favicon: undefined,
        siteName: new URL(url).hostname,
      };
    }
  }

  /**
   * Parse HTML and extract metadata
   */
  private parseMetadata(html: string, url: URL): ExtractedMetadata {
    const $ = cheerio.load(html);
    
    // Extract title
    const title = this.extractTitle($);
    
    // Extract description
    const description = this.extractDescription($);
    
    // Extract image
    const imageUrl = this.extractImage($, url);
    
    // Extract favicon
    const favicon = this.extractFavicon($, url);
    
    // Extract site name
    const siteName = this.extractSiteName($, url);

    return {
      title: title || this.getBasicTitle(url.href),
      description: description || '',
      imageUrl,
      favicon,
      siteName,
    };
  }

  /**
   * Extract page title
   */
  private extractTitle($: cheerio.CheerioAPI): string {
    // Try Open Graph title first
    let title = $('meta[property="og:title"]').attr('content');
    
    // Try Twitter title
    if (!title) {
      title = $('meta[name="twitter:title"]').attr('content');
    }
    
    // Try regular title tag
    if (!title) {
      title = $('title').text();
    }
    
    // Try h1 as fallback
    if (!title) {
      title = $('h1').first().text();
    }

    return title ? title.trim() : '';
  }

  /**
   * Extract page description
   */
  private extractDescription($: cheerio.CheerioAPI): string {
    // Try Open Graph description first
    let description = $('meta[property="og:description"]').attr('content');
    
    // Try Twitter description
    if (!description) {
      description = $('meta[name="twitter:description"]').attr('content');
    }
    
    // Try meta description
    if (!description) {
      description = $('meta[name="description"]').attr('content');
    }

    return description ? description.trim() : '';
  }

  /**
   * Extract main image
   */
  private extractImage($: cheerio.CheerioAPI, baseUrl: URL): string | undefined {
    // Try Open Graph image first
    let imageUrl = $('meta[property="og:image"]').attr('content');
    
    // Try Twitter image
    if (!imageUrl) {
      imageUrl = $('meta[name="twitter:image"]').attr('content');
    }
    
    // Try to find a prominent image in the content
    if (!imageUrl) {
      const img = $('img').first();
      imageUrl = img.attr('src');
    }

    if (imageUrl) {
      return this.resolveUrl(imageUrl, baseUrl);
    }

    return undefined;
  }

  /**
   * Extract favicon
   */
  private extractFavicon($: cheerio.CheerioAPI, baseUrl: URL): string | undefined {
    // Try various favicon selectors
    const selectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="apple-touch-icon-precomposed"]',
    ];

    for (const selector of selectors) {
      const href = $(selector).attr('href');
      if (href) {
        return this.resolveUrl(href, baseUrl);
      }
    }

    // Default favicon location
    return this.resolveUrl('/favicon.ico', baseUrl);
  }

  /**
   * Extract site name
   */
  private extractSiteName($: cheerio.CheerioAPI, url: URL): string {
    // Try Open Graph site name
    let siteName = $('meta[property="og:site_name"]').attr('content');
    
    // Try application name
    if (!siteName) {
      siteName = $('meta[name="application-name"]').attr('content');
    }
    
    // Fall back to hostname
    if (!siteName) {
      siteName = url.hostname.replace(/^www\./, '');
    }

    return siteName || url.hostname;
  }

  /**
   * Resolve relative URLs to absolute
   */
  private resolveUrl(url: string, base: URL): string {
    try {
      return new URL(url, base).href;
    } catch {
      return url;
    }
  }

  /**
   * Generate basic title from URL
   */
  private getBasicTitle(url: string): string {
    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname === '/' ? '' : parsedUrl.pathname;
      return `${parsedUrl.hostname}${pathname}`;
    } catch {
      return url;
    }
  }

  /**
   * Test if a URL is accessible
   */
  public async testUrl(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'User-Agent': this.userAgent },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
} 