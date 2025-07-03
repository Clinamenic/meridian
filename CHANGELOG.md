# Changelog

All notable changes to Meridian will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-07-03

### Added

- **Unified Resource Management System**: Consolidated resource management interface combining archive and collate functionality
- **UnifiedResourceManager**: New module providing comprehensive resource management capabilities
- **Unified Database Manager**: Backend integration for unified resource operations
- **Streamlined UI**: Single resource panel replacing separate archive and collate panels
- **Enhanced Resource Operations**: Improved resource handling with unified interface

### Changed

- **BREAKING CHANGE**: Removed legacy Archive and Collate panels from UI
- **BREAKING CHANGE**: Consolidated all resource management into unified system
- **Default Panel**: Unified panel now serves as the default active tab
- **Module Architecture**: Removed ArchiveManager.js and ResourceManager.js modules
- **Event System**: Updated event handling to use unified resource manager
- **Export Functionality**: Migrated export operations to unified system

### Removed

- **ArchiveManager.js**: Legacy archive management module
- **ResourceManager.js**: Legacy resource management module
- **Archive Panel**: Dedicated archive management interface
- **Collate Panel**: Dedicated collate management interface
- **Legacy Export Methods**: Old export functionality in app.js

### Technical Improvements

- **Code Consolidation**: Eliminated duplicate functionality between archive and collate systems
- **UI Simplification**: Reduced interface complexity with single resource management view
- **Maintainability**: Streamlined codebase with unified resource handling
- **Performance**: Reduced module loading and event handling overhead

### Migration Notes

- All existing functionality preserved in unified system
- Users automatically see unified panel as default
- No data loss - all resources accessible through new interface
- Export and management features enhanced in unified system

## [1.0.0] - 2025-07-01

### Added

- **Comprehensive Frontend Modularization**: Complete architectural refactor introducing modular system
- **ModuleBase**: Abstract base class providing common module functionality (event system, module access, utilities)
- **ModuleLoader**: Centralized module lifecycle management with dependency ordering
- **Specialized Manager Modules**:
  - AccountManager: Account and authentication management
  - ArchiveManager: File archive operations and Arweave integration
  - BroadcastManager: Social media broadcasting functionality
  - DeployManager: Quartz deployment and site management
  - ModalManager: UI modal and dialog management
  - ResourceManager: Web resource management and metadata extraction
  - UIManager: Centralized UI utilities and notifications
  - UploadManager: Arweave upload functionality
- **Event-Driven Architecture**: Inter-module communication via EventTarget
- **Dependency Management**: Explicit dependency ordering and initialization
- **Backward Compatibility**: All existing functionality preserved during refactor

### Changed

- **BREAKING CHANGE**: Complete architectural restructuring from monolithic to modular design
- **app.js**: Refactored from 8374-line monolithic structure to modular orchestrator
- **Module Integration**: All functionality now distributed across specialized modules
- **Code Organization**: Improved maintainability and extensibility through modular design
- **UI Integration**: Updated styling and component integration for modular system

### Technical Improvements

- **Maintainability**: Modular architecture enables easier feature development and bug fixes
- **Extensibility**: New modules can be added without affecting existing functionality
- **Code Reuse**: Common functionality centralized in ModuleBase
- **Event System**: Loose coupling between modules through event-driven communication
- **Initialization**: Proper dependency management and module lifecycle control

### Architecture

- **Module Pattern**: All modules extend ModuleBase for consistent interface
- **Dependency Injection**: Modules can access other modules through getModule() pattern
- **Event Bus**: Centralized event system for inter-module communication
- **Lifecycle Management**: Coordinated init/cleanup across all modules
- **Error Handling**: Consistent error handling and logging across modules

### Security

## [0.2.0] - 2025-06-25

### Added

- **Digital Garden Deployment System**: Complete deployment framework for publishing knowledge gardens as static websites
- **Meridian-Quartz Integration**: Custom fork of Quartz optimized for Meridian workflow with 50%+ faster initialization
- **Multi-Platform Deploy Support**: GitHub Pages, static export, and local preview capabilities
- **Deploy Manager**: 960-line comprehensive deployment orchestration system
- **System Requirements Validation**: Automatic Node.js/NPM version checking with user guidance
- **Content Analysis**: Intelligent workspace scanning and preparation for deployment
- **Static Server**: Optimized preview server with Quartz URL resolution and error handling
- **Enhanced UI**: Major frontend functionality expansion with modern deployment interface

### Changed

- **Performance**: Eliminated 374 lines of runtime Quartz customization through pre-configured fork approach
- **Architecture**: Streamlined deployment process using Meridian-Quartz custom fork
- **UI/UX**: Comprehensive styling updates and interface enhancements

### Technical Improvements

- **Fork Integration**: Uses https://github.com/Clinamenic/meridian-quartz for optimal deployment workflow
- **IPC Enhancement**: Extended main process handlers for deployment functionality
- **API Exposure**: Deploy functionality accessible through preload script
- **Error Handling**: Robust error management and user feedback systems

### Requirements

- **Node.js**: >=22.0.0 required for deployment functionality
- **NPM**: >=10.9.2 required for package management during deployment

### Performance

- **50%+ faster** Quartz initialization through elimination of runtime customization
- **Immediate build readiness** with pre-configured Meridian-Quartz fork
- **Zero customization failures** due to pre-configured setup

## [0.1.0] - 2025-06-18

### Added

- **Resource Management**: Add and organize web resources (URLs) with metadata extraction
- **Tagging System**: Tag-based organization with autocomplete and bulk tagging capabilities
- **Bulk Operations**: Bulk resource addition from pasted text with automatic URL detection
- **Multi-Platform Account Integration**: Support for Arweave, AT Protocol (Bluesky), and X (Twitter) accounts
- **Workspace Management**: Local workspace with automatic migration from legacy data structures
- **Local-First Architecture**: All data stored locally in `.meridian` directory structure
- **Account State Management**: Parallel account detection and state management across platforms
- **Metadata Extraction**: Automatic extraction of title and description from web resources
- **Modern UI**: Clean, responsive interface built with Electron

### Changed

- Redesignated version from 1.0.0 to 0.1.0 to properly reflect initial development status
- Updated version display in application UI

### Technical Features

- **Cross-Platform**: Electron-based desktop application (macOS, Windows, Linux)
- **TypeScript**: Full TypeScript implementation for type safety
- **Local Data**: No external dependencies for core functionality
- **Account Integration**: Optional integration with social platforms
- **Workspace Migration**: Automatic migration from legacy data structures

### Notes

- This version correctly represents the initial development phase
- Major version 0 indicates that the public API is not yet stable
- Breaking changes may occur at any time during 0.x.x releases
- Core knowledge management and social coordination features are functional

---

## Semantic Versioning Guidelines for Meridian

During the **0.x.x phase** (initial development):

- **0.y.z**: Any changes may occur
- **0.y.Z**: Increment patch version for bug fixes
- **0.Y.z**: Increment minor version for new features or breaking changes
- API should not be considered stable

When ready for **1.0.0**:

- Declare a stable public API
- Users depend on backwards compatibility
- Follow strict semantic versioning:
  - **X.y.z**: Major version for breaking changes
  - **x.Y.z**: Minor version for backwards-compatible features
  - **x.y.Z**: Patch version for backwards-compatible bug fixes

## Release Criteria

### From 0.x.x to 1.0.0

- [ ] Public API is stable and well-documented
- [ ] Software is being used in production
- [ ] Backwards compatibility becomes a concern
- [ ] Core functionality is complete and tested

### Version Increment Guidelines

- **Bug fixes**: Always increment patch version (x.y.Z)
- **New features**: Increment minor version in 0.x.x, or minor version in 1.x.x if backwards compatible
- **Breaking changes**: Increment minor version in 0.x.x, or major version in 1.x.x
- **Security fixes**: Follow same rules as bug fixes but note in changelog
