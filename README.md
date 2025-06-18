# Meridian: Local-First Multi-Tool Interface

Meridian is a local-first Electron desktop application that bridges individual knowledge management with global social coordination. The app features three core tools: **Collate** (URL resource management), **Archive** (Arweave upload), and **Broadcast** (social media scheduling).

## Features

### 🔗 Collate - URL Resource Manager

- Add and organize web resources with metadata extraction
- Tag-based organization with search and filtering
- Automatic title, description, and image extraction
- Local JSON storage with workspace integration
- Duplicate URL detection and management

### 📦 Archive - Arweave Upload Tool

- Upload files to Arweave permanent storage via arkb
- Cost estimation and wallet balance checking
- Transaction tracking and status monitoring
- Custom tagging for uploaded content
- Bundle upload support for multiple files

### 📢 Broadcast - Social Media Scheduler

- Multi-platform posting to Bluesky, Farcaster, and Twitter
- Draft management and post scheduling
- Platform-specific character limits and previews
- Secure credential management with OS-level encryption
- Linear calendar interface for content planning

## Technical Architecture

### Built With

- **Electron** (latest LTS) with security-hardened configuration
- **TypeScript** for type safety and maintainability
- **Plain CSS** with modern features (Grid, Flexbox, Custom Properties)
- **Local-first** data storage with JSON documents

### Security & Performance

- **safeStorage API** for encrypted credential storage
- **Secure IPC** between main and renderer processes
- **Content Security Policy** for XSS prevention
- **Virtual scrolling** for large collections (10k+ items)
- **Background data validation** and atomic file writes

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- arkb CLI (for Arweave functionality)

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd meridian

# Install dependencies
npm install

# Build the application
npm run build

# Start the application
npm start
```

### Development

```bash
# Start in development mode with hot reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Package for distribution
npm run package
```

## Usage

### Getting Started

1. Launch Meridian
2. Select a workspace directory (creates `/data` and `/attachments` subdirectories)
3. Use the three-tab interface to access different tools

### Data Storage

```
<workspace>/
├── data/
│   ├── collate.json       # Resource collection
│   ├── archive.json       # Arweave uploads
│   └── broadcast.json     # Social posts
└── attachments/           # Local file cache
```

### Collate Tool

- Click "Add Resource" to add a new URL
- Use "Extract Metadata" to automatically fill title and description
- Add comma-separated tags for organization
- Use the search bar to filter resources
- Click on tag filters to narrow results

### Archive Tool

- Click "Upload File" to select and upload files to Arweave
- Check wallet balance before uploading
- Monitor upload status and transaction confirmations
- Add custom tags to organize uploads

### Broadcast Tool

- Click "New Post" to create content
- Select target platforms (Bluesky, Farcaster, Twitter)
- Save as draft or schedule for later posting
- Manage platform credentials in settings

## Configuration

### Platform Authentication

#### Bluesky

- Sign in with your Bluesky handle/email and password
- Credentials are encrypted and stored securely

#### Farcaster

- Generate app-specific keys (implementation pending)
- Store FID and authentication tokens

#### Twitter

- Set up Twitter API v2 credentials (implementation pending)
- OAuth 2.0 authentication flow

#### Arweave

- Install and configure arkb CLI with wallet
- Ensure sufficient AR balance for uploads

### Workspace Integration

- Choose any directory as your workspace
- Data is stored in JSON format for portability
- Export to Markdown, CSV, or other formats
- Compatible with Obsidian vaults and note-taking apps

## Development Roadmap

### ✅ Phase 1: Foundation (Complete)

- [x] Project architecture and tooling setup
- [x] Electron security configuration
- [x] Credential management system
- [x] Basic UI shell with three tabs
- [x] Workspace directory selection

### 🚧 Phase 2: Core Tools (In Progress)

- [x] Collate: URL processing and metadata extraction
- [ ] Archive: arkb integration and file uploads
- [ ] Broadcast: Platform authentication and posting
- [x] Data persistence and JSON management
- [x] Search and filtering across tools

### 📋 Phase 3: Polish & Integration (Planned)

- [ ] Workspace export/import functionality
- [ ] Advanced scheduling for Broadcast
- [ ] Performance optimization and virtual scrolling
- [ ] Cross-platform testing and packaging

### 🚀 Phase 4: Release (Planned)

- [ ] Security audit and penetration testing
- [ ] Documentation and user guides
- [ ] Automated release pipeline
- [ ] Community feedback integration

## Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style

- Use TypeScript for all new code
- Follow existing file organization patterns
- Use the established CSS design system
- Add JSDoc comments for public APIs

### Architecture Guidelines

- Keep main process logic separate from renderer
- Use IPC for secure communication
- Store credentials with safeStorage API
- Maintain local-first data principles

## Security

### Data Protection

- All credentials encrypted with OS-native storage
- Local-first approach keeps data under user control
- Content Security Policy prevents XSS attacks
- Secure IPC prevents unauthorized access

### Privacy

- No telemetry or analytics tracking
- All data stored locally in workspace
- Social platform APIs used only for posting
- User controls all data export and deletion

## License

MIT License - see LICENSE file for details

## Support

- Create issues for bugs or feature requests
- Check existing issues before creating new ones
- Include system information and reproduction steps
- Use discussion forum for questions and ideas

---

**Meridian** - Bridging individual knowledge management with global social coordination through local-first principles.
