# Meridian

[![Version](https://img.shields.io/badge/version-0.9.0-blue.svg)](https://github.com/Clinamenic/meridian)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/electron-28.0.0-blue.svg)](https://electronjs.org/)

A local-first productivity application that combines knowledge management, file archiving, and static site deployment into a unified desktop interface.

## 🌟 Features

### 📚 Unified Resource Manager

- **Resource Organization**: Manage web URLs, bookmarks, and local files in one interface
- **Smart Metadata**: Automatic extraction of titles, descriptions, and images from web resources
- **Advanced Tagging**: Powerful tag-based organization with search and filtering
- **Local Database**: SQLite storage with efficient full-text search capabilities
- **Duplicate Detection**: Intelligent URL deduplication and content validation
- **Integrated Archive**: Upload files to Arweave directly from the resource interface
- **Upload Tracking**: Monitor Arweave uploads with cost estimation and transaction status

### 🏗️ Static Site Deployment

- **Quartz Integration**: Deploy knowledge gardens as static websites using Quartz
- **Multiple Targets**: Deploy to GitHub Pages, Arweave, or export static files
- **Build Pipeline**: Automated content scanning, processing, and optimization
- **Cost Estimation**: Real-time deployment cost calculation for Arweave
- **Deployment History**: Track all deployments with detailed metadata and status

### 🔧 Account Management

- **Platform Integration**: Connect accounts for Arweave and GitHub
- **Secure Storage**: All credentials encrypted using OS-native security
- **Status Monitoring**: Real-time connection status across all platforms
- **Token Management**: Easy token renewal and account switching

## 🏗️ Architecture

### Desktop Application

- **Electron Framework**: Cross-platform desktop app (macOS, Windows, Linux)
- **TypeScript Backend**: Type-safe main process with specialized managers
- **Modular Frontend**: Event-driven module system with clear separation of concerns
- **Local-First**: All data stored locally with optional cloud synchronization

### Backend (Main Process)

```
src/main/
├── main.ts                    # Application orchestration
├── data-manager.ts           # JSON-based data persistence
├── unified-database-manager.ts # SQLite operations
├── credential-manager.ts     # Secure credential storage
├── arweave-manager.ts        # Arweave blockchain integration
├── arweave-history-manager.ts # Deployment tracking
├── site-deploy-manager.ts    # Static site deployment
├── atproto-manager.ts        # Bluesky/AT Protocol
├── x-manager.ts              # Twitter/X integration
├── social-manager.ts         # Multi-platform coordination
└── preload.ts                # Secure IPC bridge
```

### Frontend (Renderer Process)

```
src/renderer/modules/
├── ModuleBase.js             # Abstract base for all modules
├── ModuleLoader.js           # Module lifecycle management
├── ResourceManager.js        # Resource organization & search
├── DeployManager.js          # Site deployment interface
├── AccountManager.js         # Platform authentication
├── UploadManager.js          # Arweave upload interface
├── TagManager.js             # Tag system management
├── ModalManager.js           # UI modal coordination
└── UIManager.js              # Global UI utilities
```

### Data Storage

```
<workspace>/
├── .meridian/
│   ├── data/
│   │   ├── resources.db      # SQLite database (resources, uploads)
│   │   ├── deploy.json       # Site deployment configuration
│   │   └── accounts.json     # Platform account metadata
│   └── attachments/          # Local file cache
└── content/                  # Markdown files for site deployment
```

## 🚀 Installation

### Prerequisites

- **Node.js 22+** (required for deployment features)
- **npm 10.9.2+** (package management)
- **Git** (for repository cloning)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/Clinamenic/meridian.git
cd meridian

# Install dependencies
npm install

# Build the application
npm run build

# Start Meridian
npm start
```

### Development Mode

```bash
# Start with hot reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Package for distribution
npm run package
```

## 📖 Usage

### First Launch

1. **Select Workspace**: Choose a directory for your data (creates `.meridian/` subdirectory)
2. **Connect Accounts**: Optional - connect Arweave and GitHub accounts for deployment
3. **Start Organizing**: Begin adding resources, uploading files, or deploying sites

### Resource Management

- **Add Resources**: Click "Add Resource" to import URLs or local files
- **Auto-Metadata**: Use "Extract Metadata" for automatic title/description
- **Tagging**: Add comma-separated tags for organization
- **Search & Filter**: Use the search bar and tag filters to find content
- **Bulk Operations**: Import multiple URLs from clipboard text
- **Archive Files**: Upload files directly to Arweave with cost estimation
- **Track Uploads**: Monitor Arweave upload status and transaction confirmations

### Site Deployment

- **Initialize**: Set up Quartz static site generator in your workspace
- **Configure**: Set site title, description, and deployment options
- **Build**: Process markdown files into static website
- **Deploy**: Push to GitHub Pages, upload to Arweave, or export files
- **Monitor**: Track deployment status and view detailed logs

### File Archiving (Integrated)

- **Seamless Upload**: Upload files to Arweave directly from the resource manager
- **Cost Estimation**: See upload costs before committing transactions
- **Bundle Uploads**: Efficiently upload multiple files together
- **Track Status**: Monitor transaction confirmations and access URLs
- **Upload History**: View complete history of all Arweave transactions

## ⚙️ Configuration

### Platform Setup

#### GitHub (for deployment)

```bash
# Generate personal access token with repo permissions
# Configure in Account Manager for GitHub Pages deployment
```

#### Arweave

```bash
# Install arkb CLI globally
npm install -g arkb

# Set up wallet
arkb wallet-save /path/to/wallet.json
```

### Workspace Structure

Meridian is designed to work with any directory structure. Point it to:

- **Obsidian Vaults**: Full compatibility with existing note collections
- **Document Folders**: Any directory with markdown files
- **Project Directories**: Organize by project or topic
- **Research Folders**: Academic or professional research materials

## 🔒 Security & Privacy

### Data Protection

- **Local-First**: All data stored on your device, no cloud dependencies
- **Encrypted Credentials**: Platform tokens secured with OS-native encryption
- **Secure IPC**: Communication between processes uses Electron's secure APIs
- **Content Security**: CSP headers prevent XSS and injection attacks

### Privacy Guarantees

- **No Telemetry**: Zero analytics, tracking, or data collection
- **User Control**: Complete ownership of all data and exports
- **Platform Isolation**: External APIs only used for explicit operations (deployment, archiving)
- **Transparent Storage**: All data in readable JSON/SQLite formats

## 🛠️ Development

### Architecture Principles

- **Modular Design**: Clear separation between modules and concerns
- **Event-Driven**: Loose coupling via EventTarget-based communication
- **Type Safety**: TypeScript in main process, documented JavaScript in renderer
- **Local-First**: Offline-capable with optional cloud integration
- **Security-First**: All external communication through secure, validated APIs

### Contributing

1. **Fork & Clone**: Fork the repository and clone your fork
2. **Feature Branch**: Create a feature branch for your changes
3. **Test**: Ensure all tests pass and add new tests for features
4. **Lint**: Run `npm run lint:fix` to fix code style issues
5. **Pull Request**: Submit PR with clear description of changes

### Building & Packaging

```bash
# Development build
npm run build

# Watch mode for development
npm run build:watch

# Production optimized build
npm run build:bundle

# Package for current platform
npm run package

# Package with optimizations
npm run package:prod
```

## 📝 Recent Updates

### Version 0.9.0 (September 16, 2025)

**Enhanced Deployment System** with comprehensive Arweave integration:

- **🎯 Deployment History**: Complete tracking system with persistent history storage
- **🎨 Streamlined UI**: Simplified interface with collapsible sections replacing complex tabs
- **💰 Enhanced Cost Estimation**: Real-time Arweave deployment cost calculation with wallet integration
- **⚡ Performance Optimization**: Reduced deployment code complexity by 4,000+ lines while adding features
- **📊 ArweaveHistoryManager**: Dedicated system for tracking deployment records and metadata
- **✨ Better UX**: Intuitive workflow with clear visual progression and enhanced feedback
- **📤 Export Functionality**: Export deployment history for record-keeping and analysis

This release significantly improves the deployment experience with a focus on simplicity, performance, and comprehensive deployment tracking.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/Clinamenic/meridian/issues) for bugs and feature requests
- **Discussions**: [GitHub Discussions](https://github.com/Clinamenic/meridian/discussions) for questions and ideas
- **Documentation**: Check the [wiki](https://github.com/Clinamenic/meridian/wiki) for detailed guides

---

**Meridian** - _Bridging individual knowledge management with global social coordination through local-first principles._
