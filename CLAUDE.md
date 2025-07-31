# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development
- `npm run build` - TypeScript compilation to `/dist` directory
- `npm run build:watch` - Watch mode for TypeScript compilation
- `npm run build:bundle` - Bundle main process with esbuild for production
- `npm start` - Build and start the Electron app
- `npm run dev` - Development mode with hot reload (concurrent build watch + Electron)

### Testing and Code Quality
- `npm test` - Run Jest tests
- `npm run lint` - ESLint TypeScript files in `src/`
- `npm run lint:fix` - Auto-fix ESLint issues

### Packaging
- `npm run package` - Package for current platform
- `npm run package:prod` - Production packaging with optimized dependencies
- `npm run package:ultra` - Ultra-optimized packaging with bundled main process

## Architecture Overview

### Application Structure
Meridian is an Electron desktop application with a modular frontend/backend architecture:

- **Main Process** (`src/main/`): TypeScript backend with specialized managers
- **Renderer Process** (`src/renderer/`): Modular JavaScript frontend
- **Data Storage**: Local-first with SQLite database and JSON fallbacks
- **IPC Communication**: Extensive use of `ipcMain.handle` patterns for secure communication

### Backend Architecture (Main Process)

The main process uses a centralized class-based architecture with specialized managers:

**Core Application Class**: `MeridianApp` in `main.ts` orchestrates all managers and IPC handlers.

**Manager Classes** (all TypeScript):
- `CredentialManager` - OS-level encrypted credential storage
- `DataManager` - JSON file-based data persistence
- `UnifiedDatabaseManager` - SQLite database operations for resources
- `ArweaveManager` - Arweave blockchain uploads
- `ATProtoManager` - Bluesky/AT Protocol integration
- `XManager` - Twitter/X API integration
- `SocialManager` - Multi-platform social posting coordination
- `AccountStateManager` - Centralized account state tracking
- `TemplateManager` - Broadcast template system
- `StagingManager` - Post staging and scheduling
- `MarkdownProcessor` - Markdown content processing
- Various site deployment managers (`DeployManager`, `ConfigManager`, etc.)

### Frontend Architecture (Renderer Process)

The frontend uses a **modular event-driven architecture**:

**Module System**:
- `ModuleBase.js` - Abstract base class for all modules
- `ModuleLoader.js` - Centralized module lifecycle management
- All modules extend `ModuleBase` and are managed by `ModuleLoader`

**Module Dependencies** (initialization order):
1. `TagManager` - Tag autocomplete and management
2. `ResourceManager` - Unified resource and file management (depends on TagManager)
3. `ModalManager` - Modal dialog system
4. `AccountManager` - Account management UI
5. `BroadcastManager` - Social media posting (depends on ModalManager)
6. `DeployManager` - Site deployment (depends on AccountManager)
7. `UploadManager` - File upload operations

**Inter-Module Communication**:
- Event-driven system using `EventTarget`
- Modules can emit/listen for events via `ModuleBase` methods
- Centralized event bus managed by `ModuleLoader`

### Data Architecture

**Primary Storage**: SQLite database (`unified_resources.db`) for resources and uploads
**Fallback Storage**: JSON files for backward compatibility
**File Organization**:
```
<workspace>/.meridian/
├── data/
│   ├── unified_resources.db    # SQLite database (primary)
│   ├── unified.json           # JSON fallback
│   ├── broadcast.json         # Social media data
│   └── archive.json           # Legacy archive data
└── attachments/               # Local file cache
```

### Security Architecture

- **Content Security Policy**: XSS prevention
- **Context Isolation**: Renderer process isolation
- **Secure IPC**: All communication via `ipcMain.handle` patterns
- **Credential Encryption**: OS-native `safeStorage` API
- **External URL Handling**: All external links opened in system browser

## Key Development Patterns

### IPC Handler Pattern
All backend operations use the handle/invoke pattern:
```javascript
// Main process
ipcMain.handle('module:operation', async (_, param1, param2) => {
  return await this.manager.operation(param1, param2);
});

// Renderer process
const result = await electronAPI.invoke('module:operation', param1, param2);
```

### Module Integration
When adding new modules:
1. Extend `ModuleBase` class
2. Register in `ModuleLoader.loadAllModules()` with proper dependency order
3. Follow event-driven communication patterns
4. Use consistent error handling and logging

### Database Operations
The app uses dual storage (SQLite primary, JSON fallback):
- All resource operations go through `UnifiedDatabaseManager`
- Automatic fallback to JSON if database operations fail
- Migration system for upgrading from JSON to SQLite

### Error Handling
- Consistent error logging with module prefixes: `[ModuleName]`
- Try/catch blocks with fallback mechanisms
- User-friendly error messages via notification system

## Important Implementation Notes

- **Electron Security**: The app follows security best practices with disabled node integration and context isolation
- **Database Management**: Always close database connections on app shutdown via `before-quit` event
- **Window Management**: The app transitions from landing page to main interface dynamically
- **Platform Credentials**: All social platform credentials are encrypted and stored securely
- **Modular Design**: The frontend architecture supports easy addition of new modules following the established patterns

## Testing Considerations

- Jest is configured for unit testing
- No specific test framework patterns established yet
- Integration testing would require Electron testing setup
- When writing tests, focus on module isolation and IPC communication testing