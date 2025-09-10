# Cosmo: Local-First Multi-Tool Interface

**Project Specification**  
_Version 2.0 - January 2025_

---

## Executive Summary

Cosmo is a local-first Electron desktop application that bridges individual knowledge management with global social coordination. The app features three core tools: **Collate** (URL resource management), **Archive** (Arweave upload), and **Broadcast** (social media scheduling). All data is stored locally with optional workspace integration, emphasizing performance, security, and user data ownership.

---

## Core Architecture

### Application Framework

- **Electron** (latest LTS) with security-hardened configuration
- **TypeScript** for type safety and maintainability
- **Plain CSS** with modern features (Grid, Flexbox, Custom Properties)
- **Local-first** data storage with JSON documents

### Security & Credentials

- **safeStorage API** for encrypted credential storage (JWT tokens, API keys)
- **Application-wide credential management** for social platform integration
- **Secure IPC** between main and renderer processes
- **Content Security Policy** for XSS prevention

---

## Tool Specifications

### 1. Collate: URL Resource Manager

**Core Functionality:**

- URL input with automatic metadata extraction (title, description, images)
- Tag-based organization with autocomplete
- Search and filtering across resources
- JSON storage in `<workspace>/data/collate.json`

**Data Structure:**

```typescript
interface Resource {
  id: string;
  url: string;
  title: string;
  description: string;
  imageUrl?: string;
  tags: string[];
  createdAt: string;
  modifiedAt: string;
}

interface CollateData {
  resources: Resource[];
  tags: { [tag: string]: number }; // tag usage count
  lastModified: string;
}
```

**Features:**

- Duplicate URL detection
- Bulk tag operations
- Export to markdown/CSV
- Virtual scrolling for large collections (10k+ items)

### 2. Archive: Arweave Upload Tool

**Core Functionality:**

- File upload to Arweave via arkb library
- Custom tag system for uploads
- Transaction tracking and confirmation
- Upload cost calculation and AR balance checking

**Data Structure:**

```typescript
interface ArweaveUpload {
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

interface ArchiveData {
  uploads: ArweaveUpload[];
  wallet: { address: string; balance?: string };
  lastUpdated: string;
}
```

**arkb Integration:**

- Direct integration with arkb library for efficient uploads
- Bundled upload support for multiple files
- Transaction status monitoring
- Automatic retry logic for failed uploads

### 3. Broadcast: Social Media Scheduler

**Core Functionality:**

- Linear calendar interface for staging posts
- Multi-platform posting: Bluesky, Farcaster, X/Twitter
- Draft management and scheduling
- Post preview and character limits per platform

**Data Structure:**

```typescript
interface SocialPost {
  id: string;
  content: string;
  platforms: ("bluesky" | "farcaster" | "twitter")[];
  scheduledFor?: string;
  status: "draft" | "scheduled" | "posted" | "failed";
  mediaAttachments?: string[];
  createdAt: string;
  postedAt?: { [platform: string]: string };
}

interface BroadcastData {
  posts: SocialPost[];
  drafts: SocialPost[];
  accounts: {
    bluesky?: { handle: string; did: string };
    farcaster?: { fid: number; username: string };
    twitter?: { username: string; userId: string };
  };
}
```

**Platform Integration:**

- **Bluesky**: AT Protocol with OAuth authentication
- **Farcaster**: Warpcast API or Hub integration
- **X/Twitter**: Twitter API v2 with OAuth 2.0

---

## Technical Implementation

### Local Data Management

**Storage Architecture:**

```
<workspace>/
├── data/
│   ├── collate.json       # Resource collection
│   ├── archive.json       # Arweave uploads
│   └── broadcast.json     # Social posts
└── attachments/           # Local file cache
```

**Performance Optimizations:**

- Lazy loading of large datasets
- Virtual scrolling for resource lists
- Debounced search with indexing
- Background data validation

### Secure Credential Management

**Electron safeStorage Integration:**

```typescript
interface CredentialManager {
  // Store encrypted credentials
  setCredential(service: string, key: string, value: string): Promise<void>;

  // Retrieve decrypted credentials
  getCredential(service: string, key: string): Promise<string | null>;

  // Remove stored credentials
  removeCredential(service: string, key: string): Promise<void>;

  // List available credential keys
  listCredentials(service: string): Promise<string[]>;
}

// Platform-specific credential storage
const platforms = {
  bluesky: { jwt: string; refreshToken: string },
  farcaster: { appKey: string; jwt: string },
  twitter: { accessToken: string; refreshToken: string },
  arweave: { walletJWK: string }
};
```

**Security Features:**

- OS-level encryption (Keychain on macOS, DPAPI on Windows, Secret Service on Linux)
- Credential isolation per platform
- Automatic token refresh handling
- Secure credential validation

### Workspace Integration

**Global Workspace Connection:**

- Single directory selection that affects all tools
- Live file watching for external changes
- Automatic backup on modifications
- Export/import functionality for portability

**Integration Features:**

- Markdown export of collections with frontmatter
- CSV export for spreadsheet applications
- Obsidian vault detection and optimization
- Wiki-link generation for cross-references

---

## User Interface Design

### Application Shell

**Layout:**

- Three-tab interface (Collate, Archive, Broadcast)
- Consistent header with workspace status
- Global search across all tools
- Settings panel for credentials and preferences

**Design System:**

```css
:root {
  --primary-hue: 220;
  --surface-bg: hsl(var(--primary-hue), 15%, 95%);
  --text-primary: hsl(var(--primary-hue), 20%, 15%);
  --accent-color: hsl(var(--primary-hue), 70%, 55%);
  --border-radius: 8px;
  --spacing-unit: 1rem;
}

.tool-container {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100vh;
}

.content-area {
  padding: var(--spacing-unit);
  overflow-y: auto;
}
```

### Responsive Behavior

- Minimum window size: 1024x768
- Flexible sidebar collapse
- Adaptive grid layouts
- High-DPI display support

---

## Platform Integration Details

### Bluesky (AT Protocol)

**Authentication Flow:**

1. OAuth with user authorization
2. JWT token storage with refresh capability
3. Session management with automatic renewal

**Posting Implementation:**

```typescript
interface BlueskyPost {
  text: string;
  createdAt: string;
  langs?: string[];
  facets?: RichTextFacet[]; // for links/mentions
  embed?: ImageEmbed | ExternalEmbed;
}

// Create post via com.atproto.repo.createRecord
const createPost = async (content: BlueskyPost) => {
  return await api.post("/xrpc/com.atproto.repo.createRecord", {
    repo: session.did,
    collection: "app.bsky.feed.post",
    record: content,
  });
};
```

### Farcaster Integration

**Hub Connection:**

- Direct hub integration for posting casts
- FID-based authentication
- Support for channels and threads

**Cast Structure:**

```typescript
interface FarcasterCast {
  text: string;
  parentUrl?: string; // for channel posts
  embeds?: { url: string }[];
  mentions?: number[]; // FIDs
}
```

### Arweave via arkb

**Upload Process:**

1. File validation and size checking
2. Cost estimation before upload
3. arkb command execution with progress tracking
4. Transaction ID capture and monitoring

**Implementation:**

```typescript
const uploadToArweave = async (filePath: string, tags: string[]) => {
  const command = `arkb deploy "${filePath}" --tags ${tags.join(",")}`;
  const result = await execAsync(command);
  return result.transactionId;
};
```

---

## Development Roadmap

### Phase 1: Foundation (Weeks 1-2)

- [x] Project architecture and tooling setup
- [ ] Electron security configuration
- [ ] Credential management system
- [ ] Basic UI shell with three tabs
- [ ] Workspace directory selection

### Phase 2: Core Tools (Weeks 3-5)

- [ ] Collate: URL processing and metadata extraction
- [ ] Archive: arkb integration and file uploads
- [ ] Broadcast: Platform authentication and posting
- [ ] Data persistence and JSON management
- [ ] Search and filtering across tools

### Phase 3: Polish & Integration (Weeks 6-7)

- [ ] Workspace export/import functionality
- [ ] Advanced scheduling for Broadcast
- [ ] Performance optimization and virtual scrolling
- [ ] Cross-platform testing and packaging

### Phase 4: Release (Week 8)

- [ ] Security audit and penetration testing
- [ ] Documentation and user guides
- [ ] Automated release pipeline
- [ ] Community feedback integration

---

## Success Metrics

### Technical Performance

- Application startup < 3 seconds
- Search response < 100ms for 10,000 items
- Upload success rate > 99%
- Cross-platform compatibility (Windows, macOS, Linux)

### User Experience

- Single-click workspace connection
- Intuitive three-tool workflow
- Reliable credential management
- Seamless social platform integration

---

## Risk Mitigation

### Platform Dependencies

- **arkb library status**: Library is archived but functional; maintain local fork if needed
- **API rate limits**: Implement exponential backoff and user feedback
- **Credential security**: Use OS-native storage with fallback encryption

### Data Integrity

- Automatic backup on workspace modifications
- Conflict resolution for concurrent external edits
- Data validation and schema migration support

---

## Future Considerations

### Extensibility Framework

- Plugin system for additional social platforms
- Custom data processors for different file types
- Integration with additional productivity tools

### Advanced Features (Post-Launch)

- Real-time collaboration on collections
- Advanced analytics and insights
- Mobile companion app for monitoring
- Integration with calendar applications

---

This specification provides a focused, implementable foundation for Cosmo while maintaining the flexibility to evolve based on user feedback and platform changes. The emphasis on local-first principles, security, and performant user experience ensures long-term viability and user satisfaction.
