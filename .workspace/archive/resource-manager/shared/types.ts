export interface BookmarkMetadata {
  extracted_title: string;
  meta_description: string | null;
  meta_keywords: string[] | null;
  text_preview: string;
  meta_image: string | null;
  open_graph: {
    title: string | null;
    description: string | null;
    image: string | null;
    type: string | null;
  };
  twitter_card: {
    title: string | null;
    description: string | null;
    image: string | null;
  };
  author: string | null;
  publish_date: string | null;
  word_count: number;
  lang: string | null;
}

export interface Bookmark {
  id: string;
  url: string;
  file_path: string | null;
  absolute_path: string | null;
  title: string;
  date_added: string;
  date_modified: string;
  tags: string[];
  save_content: boolean;
  metadata: BookmarkMetadata;
  extraction_status: 'pending' | 'success' | 'failed';
  extraction_errors: string[];
}

export interface BookmarkIndex {
  version: string;
  total_bookmarks: number;
  last_updated: string;
  all_tags: string[];
  bookmarks: {
    id: string;
    url: string;
    title: string;
    tags: string[];
    date_added: string;
  }[];
}

export interface ExtractionResult {
  success: boolean;
  bookmark?: Bookmark;
  error?: string;
}

export interface BatchProcessingStatus {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  current_url?: string;
  is_complete: boolean;
}

export interface AppSettings {
  data_directory: string;
  save_content_by_default: boolean;
  max_concurrent_extractions: number;
  extraction_timeout: number;
  max_content_size: number;
  theme: 'light' | 'dark';
}

export interface SearchFilters {
  query: string;
  tags: string[];
  date_range?: {
    start: string;
    end: string;
  };
}

// IPC Channel types
export interface IpcChannels {
  'bookmark:add': (urls: string[], tags?: string[]) => Promise<ExtractionResult[]>;
  'bookmark:get-all': () => Promise<Bookmark[]>;
  'bookmark:get-by-id': (id: string) => Promise<Bookmark | null>;
  'bookmark:update': (id: string, updates: Partial<Bookmark>) => Promise<boolean>;
  'bookmark:delete': (id: string) => Promise<boolean>;
  'bookmark:search': (filters: SearchFilters) => Promise<Bookmark[]>;
  'bookmark:export': (filePath: string) => Promise<boolean>;
  'bookmark:import': (filePath: string) => Promise<number>;
  'tags:get-all': () => Promise<string[]>;
  'settings:get': () => Promise<AppSettings>;
  'settings:update': (settings: Partial<AppSettings>) => Promise<boolean>;
} 