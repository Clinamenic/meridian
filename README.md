# Meridian: Local-First Multi-Tool Interface

Meridian is a local-first Electron desktop application that bridges individual knowledge management with global social coordination. The app features three core tools: **Unified Resource Manager** (URL and file resource management), **Archive** (Arweave upload), and **Broadcast** (social media scheduling).

**Version 1.0.0** - First stable release with comprehensive modular architecture

## Features

### Unified Resource Manager

- Add and organize web resources and local files with metadata extraction
- Tag-based organization with search and filtering
- Automatic title, description, and image extraction
- Local SQLite database with workspace integration
- Duplicate URL detection and management
- Unified interface for both web resources and file management

### Archive - Arweave Upload Tool

- Upload files to Arweave permanent storage via arkb
- Cost estimation and wallet balance checking
- Transaction tracking and status monitoring
- Custom tagging for uploaded content
- Bundle upload support for multiple files

### Broadcast - Social Media Scheduler

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
- **Modular Architecture** with event-driven module system

### Modular System

- **ModuleBase**: Abstract base class providing common functionality
- **ModuleLoader**: Centralized module lifecycle management with dependency ordering
- **Specialized Managers**: AccountManager, ArchiveManager, BroadcastManager, DeployManager, ModalManager, ResourceManager, UIManager, UploadManager
- **Event-Driven Communication**: Inter-module communication via EventTarget
- **Dependency Management**: Explicit dependency ordering and initialization

### Security & Performance

- **safeStorage API** for encrypted credential storage
- **Secure IPC** between main and renderer processes
- **Content Security Policy** for XSS prevention
- **Virtual scrolling** for large collections (10k+ items)
- **Background data validation** and atomic file writes
- **Modular Error Handling**: Consistent error handling and logging across modules

## Installation

### Prerequisites

- **Node.js 22+** (required for deployment functionality)
  - Download from [nodejs.org](https://nodejs.org/) - choose the LTS version
- **npm 10.9.2+** (usually included with Node.js)
  - Verify with: `npm --version`
- **Git** (for cloning the repository)
  - Download from [git-scm.com](https://git-scm.com/)
- **arkb CLI** (optional, for Arweave functionality)
  - Install with: `npm install -g arkb`

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Clinamenic/meridian.git
cd meridian

# 2. Install dependencies
npm install

# 3. Build the application
npm run build

# 4. Start the application
npm start
```

**First Launch:** When you first start Meridian, you'll be prompted to select a workspace directory. This can be any folder where you want to store your data. The app will create `.meridian/data/` and `.meridian/attachments/` subdirectories within your chosen workspace.

### Troubleshooting

- **Build errors:** Ensure you're using Node.js 22+ with `node --version`
- **Permission errors:** On macOS/Linux, you may need to use `sudo` for global npm installs
- **App won't start:** Check that all dependencies installed successfully with `npm list --depth=0`

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
├── .meridian/
│   ├── data/
│   │   ├── unified.db     # Unified resource database
│   │   ├── archive.json   # Arweave uploads
│   │   └── broadcast.json # Social posts
│   └── attachments/       # Local file cache
```

### Unified Resource Manager

- Click "Add Resource" to add a new URL or local file
- Use "Extract Metadata" to automatically fill title and description
- Add comma-separated tags for organization
- Use the search bar to filter resources
- Click on tag filters to narrow results
- Manage both web resources and local files in one interface

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

## Recent Updates

### Version 1.0.0 (2025-07-01)

**Major Release**: Comprehensive Frontend Modularization

- Complete architectural refactor from monolithic to modular design
- Introduced ModuleBase abstract class for consistent module interface
- Implemented ModuleLoader for centralized lifecycle management
- Created 8 specialized manager modules for different functionality areas
- Added event-driven inter-module communication system
- Maintained full backward compatibility with existing features
- Improved maintainability and extensibility for future development

This release represents the first stable, production-ready version of Meridian with a robust modular architecture that enables easier feature development, better code organization, and improved maintainability.

---

**Meridian** - Bridging individual knowledge management with global social coordination through local-first principles.
