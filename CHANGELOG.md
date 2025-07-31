# Changelog

All notable changes to Meridian will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.3] - 2025-07-31

### Added

- **TopologyRenderer**: Complete replacement of OrganicWaveRenderer with enhanced 3D terrain visualization system
- **Development Documentation**: Added CLAUDE.md with comprehensive development guidance and architecture overview
- **Enhanced Terrain Rendering**: Advanced spherical terrain with 4-color elevation system and configurable presets
- **Grain Texture System**: Animated grain texture overlay for enhanced visual depth
- **Contour Line Visualization**: Terrain boundary lines with configurable intensity and color

### Changed

- **Renderer Architecture**: Replaced OrganicWaveRenderer.js with TopologyRenderer.js for improved performance and features
- **Visual Rendering**: Enhanced terrain visualization with spherical shading and elevation animation
- **CSS Integration**: Terrain colors now use CSS variables for better theme integration
- **Performance Optimization**: Improved rendering performance with optimized shader configurations

### Technical Improvements

- **Code Organization**: Streamlined renderer architecture with better separation of concerns
- **Shader System**: Enhanced WebGL shader implementation with improved lighting and shading
- **Configuration System**: Flexible preset-based configuration for different use cases
- **Documentation**: Comprehensive development documentation for contributors and maintainers

### User Experience

- **Enhanced Visual Appeal**: Improved terrain rendering with better color distribution and visual depth
- **Smooth Performance**: Optimized rendering for better frame rates and responsiveness
- **Consistent Theming**: Terrain colors now integrate with application theme system

## [0.7.2] - 2025-07-28

### Added

- **Deploy Panel Header Collapsible Feature**: Added collapsible header with collapse/expand button positioned on right side
- **Header State Persistence**: Collapsible header state saved to localStorage for user preference retention
- **Enhanced Resource Display**: Made URLs clickable in resource list with proper link styling and external browser opening

### Changed

- **Deploy Panel UI**: Removed 'Deploy' text from header and added collapsible functionality
- **Header Layout**: Button positioned at top of header instead of vertically centered for better accessibility
- **Panel Header Heights**: Updated panel header heights with new header-height-lg variable (40px)
- **Tab Navigation**: Improved tab navigation styling with transparent backgrounds and better spacing

### Fixed

- **DeployManager Form Data Collection**: Fixed "Cannot read properties of null" error when switching templates in Configure subtab
- **Form Element References**: Updated collectConfigurationData() to use correct element IDs matching subtab form structure
- **Modal Context Issues**: Removed inappropriate modal close calls in subtab context
- **Error Handling**: Added comprehensive error handling and debugging for form data collection

### Technical Improvements

- **CSS Variables**: Added header-height-lg variable for consistent header sizing across panels
- **Form Validation**: Enhanced form data collection with proper null checks and error messages
- **State Management**: Implemented header collapse state management with localStorage persistence
- **Code Organization**: Improved DeployManager structure with better separation of collapse and form handling logic

### User Experience

- **Space Efficiency**: Collapsible header provides more content area when collapsed
- **Consistent Interface**: Header collapse pattern matches ResourceManager for UI consistency
- **Improved Usability**: Fixed template switching functionality in Configure subtab
- **Better Accessibility**: Collapse button positioned at top for easier access

## [0.7.1] - 2025-07-26

### Added

- **Template System Enhancements**: Improved template initialization with source parameter support
- **Template Validation**: Added validation to ensure template objects have required fields (type, url)
- **Enhanced Dependency Management**: Improved dependency installation workflow in Quartz directory

### Changed

- **Landing Page UI**: Replaced X close button with Exit button positioned next to Select Workspace
- **Typography**: Fixed horizontal centering of landing page h1 title for better visual alignment
- **Button Layout**: Improved landing page layout with proper button container styling
- **OrganicWaveRenderer**: Enhanced configuration for better visual presentation and performance
- **Template Initialization**: Enhanced template initialization workflow with better error handling

### Technical Improvements

- **IPC Handlers**: Updated deploy:initialize-quartz handler to support template source parameter
- **Error Handling**: Added comprehensive template validation before initialization
- **Code Organization**: Improved template system architecture with better separation of concerns
- **User Experience**: Streamlined landing page interface with more intuitive button placement

### User Experience

- **Improved Onboarding**: Better landing page layout provides clearer workspace selection workflow
- **Enhanced Visual Design**: Fixed typography alignment and improved button positioning
- **Template Reliability**: More robust template validation prevents initialization errors
- **Modern Interface**: Updated styling creates more contemporary and polished appearance

## [0.7.0] - 2025-07-22

### Added

- **Landing Page System**: Complete workspace selection interface with enhanced visual presentation
- **Workspace Selection Workflow**: Streamlined onboarding process with workspace directory selection
- **Enhanced OrganicWaveRenderer**: Major refactor with spherical terrain visualization and 4-color elevation system
- **Spherical Terrain Rendering**: Advanced 3D terrain visualization with configurable elevation thresholds
- **App Lifecycle Management**: Improved window management with proper app lifecycle handling
- **Loading States**: Comprehensive loading and error state management for workspace selection
- **Transparent Window Support**: Landing page loads in transparent window for modern UI experience

### Changed

- **Window Management**: Updated main.ts to load landing page first before workspace selection
- **App Behavior**: Modified app quit behavior to support page transitions instead of immediate closure
- **Visual Rendering**: Enhanced OrganicWaveRenderer with spherical shading and elevation animation
- **UI Styling**: Updated CSS for landing page components and improved visual consistency

### Technical Improvements

- **Code Organization**: Separated landing logic into dedicated landing.js module
- **Performance**: Optimized initial load with minimal imports for fast landing page rendering
- **User Experience**: Improved onboarding flow with clear workspace selection process
- **Error Handling**: Robust error handling for workspace selection and app transitions

### User Experience

- **Streamlined Onboarding**: Users now see a landing page before selecting workspace
- **Visual Appeal**: Enhanced spherical terrain rendering provides engaging visual experience
- **Clear Workflow**: Workspace selection is now an explicit step in the application flow
- **Modern Interface**: Transparent window and improved styling create contemporary feel

## [0.6.0] - 2025-07-22

### Added

- **Site Template Management System**: Comprehensive template management with cloning, validation, and configuration
- **Template Cloning**: Clone templates from various sources (GitHub, local paths, URLs) with validation
- **Template Validation**: Multi-level validation system for template integrity and compatibility
- **Repository URL Parsing**: Intelligent parsing of GitHub repository URLs for template sources
- **Template Configuration**: Flexible configuration system for site templates with custom URL support
- **New IPC Handlers**: Added template operations (getDefault, validateCustomUrl, parseUrl, cloneTemplate, validateTemplate, quickValidate)
- **Site Template Types**: New type definitions for template management system
- **Modular CSS Structure**: Organized styles into modules for better maintainability

### Changed

- **Deployment Architecture**: Refactored deployment managers for better separation of concerns
- **Manager Renaming**: Renamed config-manager.ts to site-config-manager.ts and deploy-manager.ts to site-deploy-manager.ts
- **UI Improvements**: Updated DeployManager to use Configure button instead of Site Settings
- **Style Organization**: Consolidated styles into organized structure with module-specific CSS files
- **Font Management**: Removed deprecated font files and reorganized font structure

### Technical Improvements

- **Code Organization**: Better separation of concerns in deployment-related managers
- **Type Safety**: Enhanced type definitions for template management operations
- **Maintainability**: Modular CSS structure for easier style management
- **API Consistency**: Unified template management API across the application

## [0.5.2] - 2025-01-14

### Changed

- **Architecture Improvement**: Replaced UnifiedResourceManager.js with new ResourceManager.js following modular architecture pattern
- **Code Modernization**: Updated resource management to use ModuleBase inheritance for better maintainability
- **Backward Compatibility**: Maintained legacy state aliases to ensure existing functionality continues to work
- **Documentation Enhancement**: Comprehensive README improvements with detailed installation instructions

### Added

- **Installation Guide**: Enhanced README with step-by-step setup instructions and actual repository URL
- **Troubleshooting Section**: Added common issue resolution guide for new users
- **Prerequisites Documentation**: Detailed system requirements with download links for Node.js, Git, and optional tools

### Technical Improvements

- **Modular Architecture**: ResourceManager now follows Meridian's standardized modular pattern
- **Code Consolidation**: Unified resource management system with improved organization
- **Development Experience**: Better onboarding documentation for new contributors and users

## [0.5.1] - 2025-07-07

### Changed

- **BREAKING CHANGE**: Complete removal of legacy collate system
- **Code Consolidation**: Eliminated duplicate functionality between collate and unified systems
- **API Simplification**: Removed collate-specific IPC handlers and preload APIs
- **Type System Cleanup**: Removed CollateData, CollateResource, and related interfaces
- **Documentation Update**: Updated README.md to reflect unified resource management system

### Removed

- **Collate Types**: CollateData, CollateResource, and all collate-related interfaces
- **Collate Methods**: All collate methods from DataManager class (loadCollateData, saveCollateData, etc.)
- **Collate IPC Handlers**: All collate: handlers from main process
- **Collate Preload APIs**: All collate. API definitions from preload script
- **Collate CSS Styles**: Removed collate panel styling from styles.css
- **Migration Utilities**: Removed collate-to-unified migration functions

### Technical Improvements

- **Maintainability**: Streamlined codebase with single unified resource management system
- **Performance**: Reduced code complexity and eliminated duplicate functionality
- **API Consistency**: Single unified API for all resource management operations
- **Type Safety**: Cleaner type system with deprecated Resource interface and active UnifiedResource

### Migration Notes

- All collate functionality has been consolidated into the unified resource management system
- No data loss - all resources are accessible through the unified interface
- The unified system provides enhanced functionality for both web resources and local files
- Legacy collate API calls will no longer work - use unified APIs instead

## [0.5.0] - 2025-07-03

### Added

- **Enhanced Add Resource Modal**: Comprehensive bulk and individual tag management system
- **Bulk Tag Management**: Add tags to all resources at once during review phase for both internal and external resources
- **Individual Tag Management**: Add/remove tags for each resource individually during review phase
- **Resource Preview System**: Preview resource items with accumulated tags before final confirmation
- **Tag Accumulation**: Automatic combination of bulk and individual tags during resource creation
- **Flexible Modal Tab System**: Dynamic tab width distribution supporting any number of tabs
- **Improved Resource Preview Styling**: Resource previews now match main resource list design

### Changed

- **Modal Tab Styling**: Updated to match main app tabs with consistent height, background, and typography
- **Resource Preview Layout**: Enhanced preview items with proper spacing, typography, and tag styling
- **Tag Input Integration**: Unified tag suggestions and autocomplete for both bulk and individual inputs
- **Review Phase Enhancement**: Streamlined review process with comprehensive tag management capabilities
- **UI Consistency**: Modal tabs now use same styling as main application tabs

### Technical Improvements

- **Code Organization**: Removed legacy backup files and improved code structure
- **Database Integration**: Enhanced unified database manager with additional functionality
- **Event Handling**: Improved tag management event listeners and autocomplete integration
- **Responsive Design**: Modal tabs automatically adjust width based on number of tabs
- **Performance**: Optimized resource preview generation and tag accumulation

### User Experience

- **Intuitive Tag Management**: Clear separation between bulk and individual tag operations
- **Visual Consistency**: Resource previews provide accurate representation of final items
- **Flexible Workflow**: Support for both bulk operations and fine-grained individual control
- **Modern Interface**: Consistent styling across all modal components

## [0.4.0] - 2025-07-03

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

## [0.3.0] - 2025-07-01

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
