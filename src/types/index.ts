// Resource types for Unified Resource Management System
/** @deprecated Use UnifiedResource instead */
export interface Resource {
  id: string;
  url: string;
  title: string;
  description: string;
  imageUrl?: string;
  tags: string[];
  createdAt: string;
  modifiedAt: string;
}

// Enhanced Arweave types for Archive tool with UUID-based file registry
export interface ArweaveUpload {
  id: string;
  filename: string;
  filePath: string;
  fileSize: number;
  contentType: string;
  tags: string[];
  transactionId: string;
  status: "pending" | "confirmed" | "failed";
  cost: { ar: string; usd?: string };
  uploadedAt: string;
  confirmedAt?: string;
}

export interface ArweaveUploadRecord {
  hash: string;
  timestamp: string;
  link: string;
  tags: string[];
}

export interface FileRegistryEntry {
  uuid: string;
  title: string;
  filePath: string;
  contentHash: string;
  fileSize: number;
  mimeType: string;
  created: string;
  modified: string;
  tags: string[];
  metadata: {
    author?: string;
    customFields: { [key: string]: any };
  };
  arweave_hashes: ArweaveUploadRecord[];
}

// Interface for editing archive item metadata
export interface EditableMetadata {
  title?: string;
  tags?: string[];
  author?: string;
  customFields?: { [key: string]: any };
  mimeType?: string; // Virtual files only
}

export interface ArweaveAccount {
  id: string;           // UUID for account
  nickname: string;     // User-defined name
  address: string;      // Wallet address
  createdAt: string;    // ISO timestamp
  lastUsed: string;     // ISO timestamp
}

export interface ArchiveData {
  // Legacy upload tracking (maintained for backward compatibility)
  uploads: ArweaveUpload[];
  wallet: { address: string; balance?: string };
  
  // Enhanced file registry with UUID-based tracking
  files: FileRegistryEntry[];
  
  // Metadata
  lastUpdated: string;
  version: string;
}

// Social media types for Broadcast tool
export interface SocialPost {
  id: string;
  content: string;
  platforms: ("bluesky" | "farcaster" | "twitter")[];
  scheduledFor?: string;
  status: "draft" | "scheduled" | "posted" | "failed";
  mediaAttachments?: string[];
  createdAt: string;
  postedAt?: { [platform: string]: string };
}

export interface BroadcastData {
  posts: SocialPost[];
  drafts: SocialPost[];
  accounts: {
    bluesky?: { handle: string; did: string };
    farcaster?: { fid: number; username: string };
    twitter?: { username: string; userId: string };
  };
}

// Enhanced Broadcast types for staging and templates
export interface StagedPost {
  id: string;
  sourceType: "manual" | "template" | "markdown";
  sourceData?: {
    filePath?: string;
    templateId?: string;
    variables?: Record<string, string>;
  };
  
  // Platform-specific content variations
  platformContent: {
    [platform in Platform]: {
      content: string;
      enabled: boolean;
      customizations?: {
        hashtags?: string[];
        mentions?: string[];
        mediaAttachments?: string[];
      };
    };
  };
  
  // Base content and metadata
  baseContent: string;
  title?: string;
  description?: string;
  tags: string[];
  
  // Scheduling and status
  scheduledFor?: string;
  status: "staged" | "scheduled" | "posting" | "posted" | "failed";
  createdAt: string;
  updatedAt: string;
  
  // Results tracking
  postResults?: {
    [platform: string]: {
      success: boolean;
      postId?: string;
      url?: string;
      error?: string;
      postedAt?: string;
    };
  };
}

export interface PostTemplate {
  id: string;
  name: string;
  description: string;
  template: string; // Template string with {{variable}} placeholders
  variables: TemplateVariable[];
  platforms: Platform[];
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface TemplateVariable {
  key: string;
  label: string;
  type: "text" | "url" | "date" | "number" | "select";
  required: boolean;
  defaultValue?: string;
  options?: string[]; // For select type
  source?: "frontmatter" | "file" | "computed" | "user";
  frontmatterKey?: string; // For frontmatter source
}

export interface MarkdownFile {
  filePath: string;
  relativePath: string;
  frontmatter: Record<string, any>;
  title: string;
  content: string;
  lastModified: string;
  url?: string; // Generated URL for published content
}

export interface BroadcastDataV2 {
  posts: StagedPost[];
  templates: PostTemplate[];
  accounts: {
    bluesky?: { handle: string; did: string };
    farcaster?: { fid: number; username: string };
    twitter?: { username: string; userId: string };
  };
  settings: {
    contentDirectory: string;
    autoDetectMarkdown: boolean;
    defaultPlatforms: Platform[];
  };
  version: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface FormattingSuggestion {
  type: "hashtag" | "mention" | "url" | "length" | "emoji";
  message: string;
  suggestion?: string;
  position?: { start: number; end: number };
}

export interface TemplateFilters {
  tags?: string[];
  platforms?: Platform[];
  search?: string;
}

export interface StagingFilters {
  status?: StagedPost["status"][];
  platforms?: Platform[];
  tags?: string[];
  search?: string;
  dateRange?: { start: string; end: string };
}

export interface CreateStagedPostData {
  sourceType: StagedPost["sourceType"];
  sourceData?: StagedPost["sourceData"];
  baseContent: string;
  title?: string;
  description?: string;
  tags: string[];
  platforms: Platform[];
  scheduledFor?: string;
}

export interface PostResult {
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
  platform: Platform;
}

export interface CredentialStore {
  bluesky?: { jwt: string; refreshToken: string };
  farcaster?: { appKey: string; jwt: string };
  twitter?: { accessToken: string; refreshToken: string };
  arweave?: { walletJWK: string };
  github?: { 
    token: string; 
    tokenType: "classic" | "fine-grained" | "github-app";
    repositories?: string[];
    expiresAt?: string;
  };
}

export interface AppState {
  currentTool: "unified" | "archive" | "broadcast";
  workspacePath?: string;
  isLoading: boolean;
}

export interface IPCMessage<T = unknown> {
  type: string;
  payload?: T;
  requestId?: string;
}

export interface BlueskyPost {
  text: string;
  createdAt: string;
  langs?: string[];
  facets?: RichTextFacet[];
  embed?: ImageEmbed | ExternalEmbed;
}

export interface RichTextFacet {
  index: { byteStart: number; byteEnd: number };
  features: { $type: string; [key: string]: unknown }[];
}

export interface ImageEmbed {
  $type: "app.bsky.embed.images";
  images: { alt: string; image: { $type: string; ref: { $link: string } } }[];
}

export interface ExternalEmbed {
  $type: "app.bsky.embed.external";
  external: {
    uri: string;
    title: string;
    description: string;
    thumb?: { $type: string; ref: { $link: string } };
  };
}

export interface FarcasterCast {
  text: string;
  parentUrl?: string;
  embeds?: { url: string }[];
  mentions?: number[];
}

export type Platform = "bluesky" | "farcaster" | "twitter" | "x" | "github";
export type ToolName = "unified" | "archive" | "broadcast";
export type PostStatus = "draft" | "scheduled" | "posted" | "failed";
export type UploadStatus = "pending" | "confirmed" | "failed";

export interface SiteSettings {
  version: string;
  lastModified: string;
  site: {
    baseUrl?: string;
    customDomain?: string;
    title: string;
    description?: string;
    author?: string;
    ignorePatterns?: {
      custom: string[];
      enabled: boolean;
    };
  };
  quartz: {
    enableSPA: boolean;
    enablePopovers: boolean;
    theme: {
      mode: 'auto' | 'light' | 'dark';
      primaryColor?: string;
    };
    template?: import('./site-template-types').TemplateSource;
  };
  deployment: {
    provider?: string | null;
    repository?: string | null;
    branch: string;
    customCNAME: boolean;
  };
  metadata: {
    createdAt: string;
    workspacePath: string;
    initialized?: boolean;
  };
}

export interface GitHubAccount {
  id: string; // UUID
  nickname: string; // User-defined name
  username: string; // GitHub username
  tokenType: "classic" | "fine-grained" | "github-app";
  repositories: string[]; // Accessible repos for fine-grained
  expiresAt?: string; // Token expiration
  createdAt: string;
  lastUsed: string;
}

export interface TokenValidationResult {
  isValid: boolean;
  tokenType: "classic" | "fine-grained" | "github-app";
  username: string;
  scopes: string[];
  repositories: string[];
  expiresAt?: string;
  securityWarnings: string[];
  recommendations: string[];
}

export interface GitHubDeployConfig {
  workspacePath: string;
  githubAccountId?: string;
  repositoryName?: string;
  customDomain?: string;
  branch?: string;
}

export interface DeployResult {
  success: boolean;
  url?: string;
  repository?: string;
  message?: string;
  error?: string;
}

export interface UnifiedResource {
  id: string;
  uri: string;
  contentHash: string;
  properties: {
    'dc:title': string;
    'dc:type': string;
    'meridian:tags': string[];
    'meridian:description'?: string;
    [key: string]: any;
  };
  locations: {
    primary: {
      type: 'file-path' | 'http-url';
      value: string;
      accessible: boolean;
      lastVerified: string;
    };
    alternatives: Array<{
      type: 'file-path' | 'http-url';
      value: string;
      accessible: boolean;
      lastVerified: string;
    }>;
  };
  provenance: Array<{
    timestamp: string;
    action: string;
    method: string;
    toLocation: {
      type: 'file-path' | 'http-url';
      value: string;
      accessible: boolean;
      lastVerified: string;
    };
  }>;
  state: {
    type: 'internal' | 'external';
    accessible: boolean;
    lastVerified: string;
    verificationStatus: 'verified' | 'unverified' | 'failed';
  };
  timestamps: {
    created: string;
    modified: string;
    lastAccessed: string;
  };
}

export interface UnifiedData {
  resources: UnifiedResource[];
  tags: { [tag: string]: number }; // tag usage count
  lastModified: string;
  version: string;
} 