// Resource types for Collate tool
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

export interface CollateData {
  resources: Resource[];
  tags: { [tag: string]: number }; // tag usage count
  lastModified: string;
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

// Credential management types
export interface CredentialStore {
  bluesky?: { jwt: string; refreshToken: string };
  farcaster?: { appKey: string; jwt: string };
  twitter?: { accessToken: string; refreshToken: string };
  arweave?: { walletJWK: string };
}

// Application state types
export interface AppState {
  currentTool: "collate" | "archive" | "broadcast";
  workspacePath?: string;
  isLoading: boolean;
}

// IPC message types
export interface IPCMessage<T = unknown> {
  type: string;
  payload?: T;
  requestId?: string;
}

// Platform integration types
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

// Utility types
export type Platform = "bluesky" | "farcaster" | "twitter" | "x";
export type ToolName = "collate" | "archive" | "broadcast";
export type PostStatus = "draft" | "scheduled" | "posted" | "failed";
export type UploadStatus = "pending" | "confirmed" | "failed"; 