# Site Settings Configuration - Scoping Document

## Overview

This document outlines the implementation of a comprehensive Site Settings system for Meridian, focused on workspace-specific configuration management. The system will provide users with a dedicated interface to configure site-specific settings that integrate with the Quartz static site generator and deployment workflows.

## Core Requirements

### 1. Site Settings Button & Modal Interface

**Location**: Deploy panel header (alongside existing Initialize Quartz, Build Site, Preview Site, and Deploy Site buttons)

**Button Specifications**:

- **Icon**: Settings gear icon (consistent with existing panel header icon styling)
- **Tooltip**: "Site Settings"
- **Position**: First button in the Deploy panel actions (logical order: Settings → Initialize → Build → Preview → Deploy)
- **Style**: Follow existing `.panel-header-icon-btn` styling patterns

**Modal Specifications**:

- **Title**: "Site Settings"
- **Layout**: Single-tab modal with organized form sections
- **Validation**: Real-time validation for URL format and domain requirements
- **Actions**: Cancel, Reset to Defaults, Save Settings

### 2. Configuration Storage Architecture

**Primary Configuration File**: `.meridian/config/site-settings.json`

**Configuration Structure**:

```json
{
  "version": "1.0.0",
  "lastModified": "2024-01-01T00:00:00.000Z",
  "site": {
    "baseUrl": "https://example.com",
    "customDomain": "example.com",
    "title": "Digital Garden",
    "description": "My personal digital garden",
    "author": "Author Name"
  },
  "quartz": {
    "enableSPA": true,
    "enablePopovers": true,
    "theme": {
      "mode": "auto", // "light", "dark", "auto"
      "primaryColor": "#284b63"
    }
  },
  "deployment": {
    "provider": null, // Set when deployment is configured
    "repository": null,
    "branch": "main",
    "customCNAME": true
  },
  "metadata": {
    "createdAt": "2024-01-01T00:00:00.000Z",
    "workspacePath": "/path/to/workspace"
  }
}
```

**Configuration Hierarchy**:

1. **Workspace-level**: `.meridian/config/site-settings.json` (primary configuration)
2. **Quartz integration**: Automatic synchronization with `.quartz/quartz.config.ts`
3. **Deployment artifacts**: CNAME file generation for custom domains

### 3. Site Settings Modal Form Sections

#### Section 1: Basic Site Information

- **Site Title** (text input)

  - Default: "Digital Garden"
  - Syncs with `pageTitle` in quartz.config.ts
  - Validation: 1-100 characters

- **Site Description** (textarea)

  - Default: ""
  - Optional metadata field
  - Validation: 0-500 characters

- **Author Name** (text input)
  - Default: ""
  - Used in metadata and RSS feeds
  - Validation: 0-100 characters

#### Section 2: Domain Configuration

- **Base URL** (text input, primary feature)

  - Placeholder: "https://yourdomain.com"
  - Required for proper site generation
  - Real-time validation for URL format
  - Updates `baseUrl` in quartz.config.ts
  - Generates/updates CNAME file when custom domain detected

- **Custom Domain Toggle** (checkbox)
  - Enables/disables CNAME file generation
  - When enabled, extracts domain from Base URL
  - When disabled, removes CNAME file

#### Section 3: Display Preferences

- **Theme Mode** (radio buttons)

  - Options: Auto (default), Light, Dark
  - Syncs with Quartz theme configuration

- **Enable Single Page Application** (checkbox)

  - Default: true
  - Controls SPA behavior in Quartz

- **Enable Popovers** (checkbox)
  - Default: true
  - Controls link preview popovers

### 4. Integration Points

#### Quartz Configuration Synchronization

**File**: `workspace/.quartz/quartz.config.ts`

**Synchronized Fields**:

```typescript
const config: QuartzConfig = {
  configuration: {
    pageTitle: siteSettings.site.title, // From site-settings.json
    baseUrl: siteSettings.site.baseUrl, // Primary sync target
    enableSPA: siteSettings.quartz.enableSPA,
    enablePopovers: siteSettings.quartz.enablePopovers,
    // ... existing configuration
  },
};
```

**Synchronization Strategy**:

- **On Save**: Immediately update quartz.config.ts when site settings are saved
- **On Load**: Read existing quartz.config.ts values to populate site settings (first-time setup)
- **Conflict Resolution**: Site settings take precedence over quartz.config.ts

#### CNAME File Management

**File**: `workspace/.quartz/static/CNAME`

**Generation Logic**:

1. Extract domain from Base URL (e.g., "https://example.com" → "example.com")
2. Validate domain format (no protocols, no paths)
3. Create/update CNAME file in static directory
4. Delete CNAME file if custom domain is disabled

**Domain Extraction Examples**:

- `https://example.com` → `example.com`
- `https://www.example.com` → `www.example.com`
- `https://subdomain.example.com` → `subdomain.example.com`
- `http://example.com/path` → `example.com` (path ignored)

### 5. Backend Implementation

#### Configuration Manager Service

**File**: `src/main/config-manager.ts` (new service)

**Core Methods**:

```typescript
class ConfigManager {
  async loadSiteSettings(workspacePath: string): Promise<SiteSettings>;
  async saveSiteSettings(
    workspacePath: string,
    settings: SiteSettings
  ): Promise<void>;
  async syncWithQuartz(
    workspacePath: string,
    settings: SiteSettings
  ): Promise<void>;
  async generateCNAME(workspacePath: string, domain: string): Promise<void>;
  async removeCNAME(workspacePath: string): Promise<void>;
  private validateSettings(settings: SiteSettings): ValidationResult;
  private extractDomain(url: string): string | null;
}
```

#### IPC Handler Registration

**File**: `src/main/main.ts`

**New Handlers**:

```typescript
ipcMain.handle("config:load-site-settings", (_, workspacePath) =>
  configManager.loadSiteSettings(workspacePath)
);
ipcMain.handle("config:save-site-settings", (_, workspacePath, settings) =>
  configManager.saveSiteSettings(workspacePath, settings)
);
```

#### Preload API Extension

**File**: `src/main/preload.ts`

**New API Methods**:

```typescript
config: {
  loadSiteSettings: (workspacePath: string) => Promise<SiteSettings>;
  saveSiteSettings: (workspacePath: string, settings: SiteSettings) =>
    Promise<void>;
}
```

### 6. Frontend Implementation

#### Site Settings Modal Component

**Integration Point**: `src/renderer/app.js` - Add to existing deploy event handlers

**Modal HTML Structure**:

```html
<div class="modal-content site-settings-modal">
  <div class="modal-header">
    <h3>Site Settings</h3>
    <button class="modal-close">&times;</button>
  </div>
  <div class="modal-body">
    <form id="site-settings-form">
      <!-- Basic Site Information Section -->
      <section class="settings-section">
        <h4>Basic Information</h4>
        <!-- Form fields -->
      </section>

      <!-- Domain Configuration Section -->
      <section class="settings-section">
        <h4>Domain Configuration</h4>
        <!-- Base URL field (primary) -->
        <!-- Custom domain toggle -->
      </section>

      <!-- Display Preferences Section -->
      <section class="settings-section">
        <h4>Display Preferences</h4>
        <!-- Theme and feature toggles -->
      </section>
    </form>
  </div>
  <div class="modal-footer">
    <button type="button" class="secondary-btn">Reset to Defaults</button>
    <button type="button" class="secondary-btn modal-cancel">Cancel</button>
    <button type="submit" form="site-settings-form" class="primary-btn">
      Save Settings
    </button>
  </div>
</div>
```

#### Validation & User Experience

**Real-time Validation**:

- URL format validation with visual feedback
- Domain extraction preview
- Character count indicators for text fields

**Error Handling**:

- Network errors during save operations
- File system errors (permissions, disk space)
- Invalid configuration format errors

**Success Feedback**:

- Settings saved confirmation
- Quartz configuration updated notification
- CNAME file status updates

### 7. File Structure Changes

#### New Files

```
src/main/config-manager.ts        # Configuration management service
.meridian/config/                 # Configuration directory
  └── site-settings.json          # Primary site settings file
```

#### Modified Files

```
src/main/main.ts                  # IPC handler registration
src/main/preload.ts               # API method exposure
src/renderer/app.js               # Modal and event handling
src/renderer/index.html           # Site settings button
src/renderer/styles.css           # Site settings modal styling
```

#### Generated/Updated Files

```
.quartz/quartz.config.ts          # Synchronized configuration
.quartz/static/CNAME              # Custom domain configuration (when enabled)
```

### 8. Development Workflow

#### Implementation Phases

**Phase 1: Backend Foundation**

1. Create ConfigManager service
2. Implement configuration file I/O
3. Add IPC handlers and preload APIs
4. Create initial site-settings.json schema

**Phase 2: Frontend Interface**

1. Add Site Settings button to Deploy panel
2. Create modal HTML structure and styling
3. Implement form validation and submission
4. Add success/error feedback systems

**Phase 3: Integration & Synchronization**

1. Implement Quartz configuration synchronization
2. Add CNAME file generation logic
3. Test configuration consistency across restarts
4. Verify deployment workflow compatibility

**Phase 4: Testing & Refinement**

1. Test various URL formats and edge cases
2. Verify file system error handling
3. Test configuration migration and defaults
4. Performance testing for large workspaces

### 9. Error Handling & Edge Cases

#### Configuration File Issues

- **Missing .meridian directory**: Create automatically with defaults
- **Corrupted site-settings.json**: Backup and recreate with defaults
- **Permission errors**: Clear error messages with resolution steps

#### URL & Domain Validation

- **Invalid URL formats**: Real-time validation with helpful error messages
- **Unsupported protocols**: Accept http/https, reject others with explanation
- **Domain extraction failures**: Fallback to manual domain input

#### Quartz Configuration Conflicts

- **Missing quartz.config.ts**: Graceful degradation, settings still saved
- **Syntax errors in quartz.config.ts**: Warning notification, preserve user settings
- **Multiple configuration sources**: Site settings take precedence with user notification

### 10. Future Enhancements

#### Planned Extensions

- **Advanced theme customization**: Color picker for primary theme color
- **SEO settings**: Meta tags, Open Graph configuration
- **Analytics integration**: Google Analytics, Plausible setup
- **Custom CSS injection**: User-defined styling overrides

#### Integration Opportunities

- **Template system**: Site settings affecting template selection
- **Content processing**: Settings influencing markdown processing
- **Social sharing**: Auto-generation of social meta tags

## Success Criteria

1. **Functional Requirements**:

   - ✅ Site Settings button accessible from Deploy panel
   - ✅ Modal interface with organized form sections
   - ✅ Persistent configuration storage in `.meridian/config/`
   - ✅ Base URL synchronization with `quartz.config.ts`
   - ✅ Automatic CNAME file generation for custom domains

2. **Technical Requirements**:

   - ✅ Robust error handling and validation
   - ✅ Configuration consistency across application restarts
   - ✅ Integration with existing deployment workflows
   - ✅ Performance impact < 100ms for configuration operations

3. **User Experience Requirements**:
   - ✅ Intuitive interface consistent with existing modal patterns
   - ✅ Real-time validation feedback
   - ✅ Clear success/error messaging
   - ✅ Logical workflow integration with deploy process

## Implementation Notes

- **Configuration versioning**: Include version field for future schema migrations
- **Backward compatibility**: Graceful handling of missing or outdated configuration files
- **Security considerations**: Validate all user inputs, sanitize file paths
- **Performance optimization**: Cache configuration in memory, lazy-load when needed
- **Testing strategy**: Unit tests for ConfigManager, integration tests for full workflow

This scoping document provides a comprehensive foundation for implementing the Site Settings configuration system. The design prioritizes user experience, technical robustness, and seamless integration with existing Meridian workflows.
