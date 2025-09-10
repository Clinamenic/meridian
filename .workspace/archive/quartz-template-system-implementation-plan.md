# Quartz Template System Implementation Plan

## Executive Summary

This document outlines the implementation of a flexible template system for Meridian that allows users to choose from curated Quartz templates and supports both centralized (GitHub) and decentralized (Protocol.land) template sources. The system will provide a seamless template selection experience during Quartz initialization while maintaining the ability to switch templates (with the understanding that customizations will be lost).

## Current State Analysis

### Existing Deploy Panel Architecture

- **Current Buttons**: "Initialize" (phase 1) + "Site Settings" (header) create dual entry points
- **Initialize Flow**: Clones `meridian-quartz` repository to `.quartz/` directory
- **Site Settings**: Separate modal for configuration (title, domain, theme, etc.)
- **UX Issue**: Two buttons with overlapping functionality create confusion

### Proposed Simplification

- **Single "Configure" Button**: Replaces both Initialize and Site Settings buttons
- **Context-Aware Modal**: Adapts behavior based on initialization status
- **Unified Configuration**: All site setup and ongoing configuration in one place
- **Clean Interface**: Eliminates competing entry points and duplicate functionality

### Technical Components

- `DeployManager.initializeQuartz()`: Handles Quartz setup and template cloning
- `ConfigManager`: Manages unified site settings including template selection
- Template switching affects only Quartz configuration, not core Meridian functionality

## Research Insights: Protocol.land Integration

### Protocol.land Capabilities

- **Git Compatibility**: Full git protocol support via `git-remote-proland`
- **Repository Format**: `proland://username/repo-name` or `proland://repo-id`
- **Authentication**: Arweave wallet-based (JWK format)
- **Permanence**: Immutable storage on Arweave blockchain
- **Toolchain**: Node.js based with existing npm packages

### Integration Benefits

- **Decentralization**: Reduced dependency on centralized platforms
- **Permanence**: Templates stored permanently on Arweave
- **Censorship Resistance**: Immutable template availability
- **Ecosystem Alignment**: Leverages Meridian's existing Arweave integration

## Proposed Architecture

### 1. Template Registry System

#### Template Source Types

```typescript
interface TemplateSource {
  id: string;
  name: string;
  type: "github" | "protocol-land" | "custom-git";
  url: string;
  branch?: string;
  description: string;
  isDefault?: boolean; // Flag for vanilla Quartz template
}

interface TemplateValidation {
  isValid: boolean;
  error?: string;
  detectedType?: "github" | "protocol-land" | "custom-git";
  repoInfo?: {
    owner?: string;
    repo?: string;
    branch?: string;
  };
}
```

#### Simple Template Management

```typescript
class SiteTemplateManager {
  // Default vanilla Quartz template
  private getDefaultTemplate(): TemplateSource {
    return {
      id: "vanilla-quartz",
      name: "Vanilla Quartz",
      type: "github",
      url: "https://github.com/Clinamenic/meridian-quartz.git",
      branch: "meridian-main",
      description: "Default Meridian-Quartz template",
      isDefault: true,
    };
  }

  // Validate and parse custom template URLs
  async validateTemplateUrl(url: string): Promise<TemplateValidation>;

  // Create TemplateSource from validated URL
  async createTemplateFromUrl(url: string): Promise<TemplateSource>;
}
```

### 2. Template Manager Architecture

#### Core Components

- **SiteTemplateManager**: Simple template management (default + custom URL validation)
- **SiteTemplateCloner**: Handles multi-protocol cloning (GitHub, Protocol.land, custom)
- **SiteTemplateValidator**: Validates template repository structure and accessibility
- **SiteTemplateUrlParser**: Parses and validates different repository URL formats

#### File Naming Convention

All template-related files must use the `site-template-*` prefix for consistency:

- `src/main/site-template-manager.ts` - Core template management
- `src/main/site-template-cloner.ts` - Multi-protocol cloning logic
- `src/main/site-template-validator.ts` - Template validation logic
- `src/main/site-template-url-parser.ts` - URL parsing utilities
- `src/types/site-template-types.ts` - Template-related type definitions

### 3. Unified Site Configuration Modal Design

#### Consolidated Modal Structure

```
┌───────────────────────────────────────────────────────────────────────┐
│ Site Configuration                                                 × │
├───────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│ │   General   │ │   Display   │ │   Build     │ │  Template   │       │
│ │             │ │             │ │             │ │             │       │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                                       │
│ ┌─ General Settings (Non-destructive) ─────────────────────────────┐   │
│ │ Site Title: [Digital Garden___________________________] ⚡     │   │
│ │ Description: [Optional site description_______________] ⚡     │   │
│ │ Author: [Your Name____________________________________] ⚡     │   │
│ │ Base URL: [https://yourdomain.com____________________] ⚡     │   │
│ │ □ Generate CNAME file for custom domain                      │   │
│ └─────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│ ┌─ Template Settings (Requires Reinitialization) ─────────────────┐   │
│ │ Current Template: Vanilla Quartz (GitHub) 📄              🔄 │   │
│ │                                                                 │   │
│ │ Template Selection:                                             │   │
│ │ ○ Vanilla Quartz (Default)                                     │   │
│ │   └─ Official Meridian-Quartz template                         │   │
│ │                                                                 │   │
│ │ ○ Custom Template                                               │   │
│ │   └─ Custom URL: __________________________ [Validate]        │   │
│ │      Supports: GitHub, Protocol.land (proland://), Git repos  │   │
│ │                                                                 │   │
│ │ ⚠️ Changing template will reinitialize Quartz                  │   │
│ └─────────────────────────────────────────────────────────────────┘   │
├───────────────────────────────────────────────────────────────────────┤
│                    [Cancel]  [Apply Changes]                         │
└───────────────────────────────────────────────────────────────────────┘
```

#### Settings Categories with Clear Change Impact

**🟢 Safe Changes (Apply Immediately)**

- Site title, description, author
- Base URL and domain settings
- Theme preferences
- Build ignore patterns
- Display options (SPA, popovers)

**🔴 Destructive Changes (Require Reinitialization)**

- Template selection/switching
- Major Quartz configuration changes

### 4. Unified Configuration Workflow

```
[Configure Button] → [Unified Site Configuration Modal]
                          ↓
                [Modal adapts based on initialization status]
                          ↓
              ┌─ First Time Setup ─┴─ Existing Configuration ─┐
              ↓                                              ↓
    [Template selection required]                 [All settings available]
              ↓                                              ↓
    [Initialize with settings]                    [Apply changes by type]
              ↓                                              ↓
    ┌─ Safe Changes ─┴─ Destructive Changes ─┐              │
    ↓                                        ↓              ↓
[Apply immediately]          [Show reinitialization warning] │
    ↓                                        ↓              ↓
[Save & sync]                [Backup → Reinitialize → Apply] │
    ↓                                        ↓              ↓
[Success]                            [Success with warnings] │
    └────────────────────────────────────────────────────────┘
```

## Implementation Requirements

### File Naming Convention

**CRITICAL**: All template-related files must follow the `site-template-*` naming pattern for consistency and organization:

#### Required File Structure

```
src/
├── main/
│   ├── site-template-manager.ts          # Core template management
│   ├── site-template-cloner.ts           # Multi-protocol cloning
│   ├── site-template-validator.ts        # Template validation
│   ├── site-template-url-parser.ts       # URL parsing utilities
│   └── site-template-protocol-client.ts  # Protocol.land integration
├── types/
│   └── site-template-types.ts            # Template type definitions
└── renderer/
    └── modules/
        └── SiteTemplateManager.js        # Frontend template handling
```

#### Class Naming Convention

- `SiteTemplateManager` - Main template management class
- `SiteTemplateCloner` - Template cloning operations
- `SiteTemplateValidator` - Template validation logic
- `SiteTemplateUrlParser` - URL parsing utilities
- `SiteTemplateProtocolLandClient` - Protocol.land integration

## Implementation Phases

### Phase 1: Unified Site Configuration System (Week 1-2)

#### Backend Implementation

1. **Simple Template Management Service**

   ```typescript
   class SiteTemplateManager {
     async getDefaultTemplate(): Promise<TemplateSource>;
     async validateCustomUrl(url: string): Promise<TemplateValidation>;
     async parseRepositoryUrl(url: string): Promise<TemplateSource>;

     // URL format detection
     private isGitHubUrl(url: string): boolean;
     private isProtocolLandUrl(url: string): boolean;
     private isGenericGitUrl(url: string): boolean;
   }
   ```

2. **Multi-Protocol Template Cloner**

   ```typescript
   class SiteTemplateCloner {
     async cloneTemplate(
       source: TemplateSource,
       destination: string
     ): Promise<void>;
     private cloneGitHub(url: string, destination: string): Promise<void>;
     private cloneProtocolLand(url: string, destination: string): Promise<void>;
     private cloneCustomGit(url: string, destination: string): Promise<void>;
   }
   ```

3. **Protocol.land Integration**

   ```typescript
   class SiteTemplateProtocolLandClient {
     private walletPath?: string;

     async setupWallet(walletPath: string): Promise<void>;
     async validateRepository(repoId: string): Promise<boolean>;
     async cloneRepository(repoUrl: string, destination: string): Promise<void>;
   }
   ```

#### Frontend Updates

1. **Enhanced Site Settings Modal** (extends existing modal structure)
2. **Template Selection Radio Buttons** (vanilla vs custom options)
3. **URL Validation Components** (real-time validation for custom URLs)
4. **Change Impact Indicators** (visual cues for destructive vs safe changes)

#### Deploy Panel Integration

1. **Replace Deploy Panel Buttons**:

   - Remove: "Initialize" button (phase 1 card)
   - Remove: "Site Settings" button (panel header)
   - Add: Single "Configure" button (phase 1 card)

2. **Updated Event Handling**:

   ```typescript
   // Replace existing initialize button event
   const configureBtn = document.getElementById("configure-workflow-btn");
   if (configureBtn) {
     configureBtn.addEventListener("click", async () => {
       await this.openConfigurationModal();
     });
   }

   // Remove site settings button event listener
   // (no longer needed)
   ```

3. **Modal Integration**:
   - Extend existing site-settings-modal CSS classes
   - Integrate with existing ModalManager system
   - Preserve existing form validation and character counting
   - Add template selection and URL validation

#### Unified Configuration Integration

1. **Extend existing SiteSettings interface**

   ```typescript
   interface SiteSettings {
     version: string;
     lastModified: string;
     site: {
       baseUrl?: string;
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
         mode: "auto" | "light" | "dark";
         primaryColor?: string;
       };
       template?: TemplateSource; // NEW: Current template
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
       initialized?: boolean; // NEW: Track initialization status
     };
   }
   ```

2. **Unified Configure Modal Handler**

   ```typescript
   async openConfigurationModal() {
     // Load current settings (including template info)
     const settings = await window.electronAPI.config.loadSiteSettings(this.workspacePath);
     const isInitialized = await this.checkQuartzInitialized();

     // Create modal that adapts based on initialization status
     this.createConfigurationModal(settings, isInitialized);
   }

   async handleConfigurationSubmit(changes) {
     const isInitialized = await this.checkQuartzInitialized();

     if (!isInitialized) {
       // First-time setup - always requires initialization
       await this.initializeWithConfiguration(changes);
     } else {
       // Existing configuration - categorize changes
       const { safeChanges, destructiveChanges } = this.categorizeChanges(changes);

       if (destructiveChanges.length > 0) {
         const confirmed = await this.showReinitializationWarning(destructiveChanges);
         if (!confirmed) return;
         await this.applyDestructiveChanges(destructiveChanges);
       }

       if (safeChanges.length > 0) {
         await this.applySafeChanges(safeChanges);
       }
     }
   }
   ```

3. **Template-Aware Initialization Flow**

   ```typescript
   async initializeQuartz(workspacePath: string, templateSource?: TemplateSource): Promise<void> {
     // Get template from settings or show selection within unified modal
     if (!templateSource) {
       const settings = await window.electronAPI.config.loadSiteSettings(workspacePath);
       templateSource = settings.quartz?.template || this.getDefaultTemplate();
     }

     // Clean up existing .quartz directory
     await this.cleanQuartzDirectory(workspacePath);

     // Clone selected template
     await this.siteTemplateCloner.cloneTemplate(templateSource, quartzPath);

     // Apply workspace-specific configurations from site settings
     await this.applyWorkspaceSettings(workspacePath, settings);

     // Update settings with new template and initialization status
     settings.quartz.template = templateSource;
     settings.metadata.initialized = true;
     await window.electronAPI.config.saveSiteSettings(workspacePath, settings);
   }
   ```

### Phase 2: Enhanced Features (Week 3-4)

#### Template Validation & Compatibility

1. **Template Structure Validator**

   ```typescript
   interface TemplateValidation {
     isValid: boolean;
     errors: string[];
     warnings: string[];
     compatibility: {
       quartzVersion: string;
       meridianVersion: string;
     };
   }
   ```

2. **Automatic Template Updates**
   - Check for template updates
   - Notify users of available updates
   - Optional auto-update for curated templates

#### Advanced Template Features

1. **Template Previews**

   - Generate static previews of templates
   - Cached preview images
   - Live preview option for supported templates

2. **Template Customization Backup**
   - Save user customizations before template switching
   - Restore compatible customizations after switch
   - Migration assistant for breaking changes

### Phase 3: Future Enhancements (Later)

#### Manual Template Curation

1. **Curated Template Addition**

   - Manual review and testing of new templates
   - Quality assurance for official template options
   - Documentation and preview generation

2. **Template Management Interface**
   - Admin interface for adding new template options
   - Template testing and validation tools
   - Update management for existing templates

## Technical Specifications

### Template Repository Structure

```
template-repo/
├── quartz.config.ts          # Quartz configuration
├── quartz.layout.ts          # Layout configuration
├── quartz/                   # Quartz framework files
│   ├── components/           # Custom components
│   ├── plugins/              # Custom plugins
│   └── styles/               # Template-specific styles
├── static/                   # Static assets
├── .template/                # Template metadata
│   ├── metadata.json         # Template information
│   ├── preview.png           # Template preview image
│   ├── screenshots/          # Additional screenshots
│   └── README.md             # Template documentation
└── package.json              # Dependencies
```

### Template Repository Requirements

#### Required Files

Templates must contain these core files to be considered valid:

```
template-repo/
├── quartz.config.ts          # Quartz configuration
├── quartz.layout.ts          # Layout configuration
├── quartz/                   # Quartz framework files
│   ├── components/           # Custom components
│   ├── plugins/              # Custom plugins
│   └── styles/               # Template-specific styles
├── static/                   # Static assets
└── package.json              # Dependencies
```

#### Optional Template Metadata

```json
{
  "name": "My Custom Template",
  "description": "A custom Quartz template",
  "author": "Template Creator",
  "version": "1.0.0",
  "meridian": {
    "compatible": true,
    "notes": "Works with Meridian's build system"
  }
}
```

### Protocol.land Integration

#### Setup Requirements

1. **Global Protocol.land CLI Installation**

   ```bash
   npm install -g @protocol.land/git-remote-helper
   ```

2. **Arweave Wallet Configuration**
   ```bash
   git config --global --add protocol.land.keyfile ~/.arweave/keyfile.json
   git config --global --add protocol.land.thresholdCost 0.0003
   ```

#### Repository URL Formats

- **Protocol.land ID**: `proland://template-repo-id`
- **Protocol.land Username**: `proland://username/template-name`
- **GitHub**: `https://github.com/owner/repo`
- **Custom Git**: `https://git.example.com/templates/template-name.git`

### IPC Handler Extensions

```typescript
// Add to main.ts IPC handlers
ipcMain.handle("template:getDefault", async () => {
  return await siteTemplateManager.getDefaultTemplate();
});

ipcMain.handle("template:validateCustomUrl", async (_, url: string) => {
  return await siteTemplateManager.validateCustomUrl(url);
});

ipcMain.handle("template:parseUrl", async (_, url: string) => {
  return await siteTemplateManager.parseRepositoryUrl(url);
});

ipcMain.handle(
  "template:cloneTemplate",
  async (_, source: TemplateSource, destination: string) => {
    return await siteTemplateCloner.cloneTemplate(source, destination);
  }
);
```

## Migration Strategy & Compatibility

### Existing Site Settings Integration

1. **No Breaking Changes**: Current site settings continue to work unchanged
2. **Gradual Enhancement**: Template options added to existing modal structure
3. **Preserve User Data**: All existing configurations migrate seamlessly

### Deploy Panel Workflow Redesign

1. **Single Configure Button**:

   - **Replaces both**: Initialize button and Site Settings button
   - **First-time users**: Shows template selection prominently with all configuration options
   - **Existing users**: Shows full configuration modal with current template indicated
   - **No workspace selected**: Configure button disabled until workspace selected

2. **Simplified Panel Layout**:
   - **Deploy Status**: Shows current configuration status (Not Configured, Ready, etc.)
   - **Single Action**: One "Configure" button handles all configuration needs
   - **Clean Interface**: No competing buttons or duplicate entry points

### Existing Users

1. **Backward Compatibility**: Default template remains `meridian-quartz`
2. **Zero Migration Required**: Existing installations continue working without changes
3. **Opt-in Enhancement**: Users discover new template options when they open site settings

### Template Creation Guidelines

1. **Template Standards Document**: Comprehensive guide for template creators
2. **Testing Framework**: Automated testing for template compatibility
3. **Template Certification**: Quality assurance for curated templates

## Risk Assessment & Mitigation

### Technical Risks

1. **Protocol.land Dependency**

   - **Risk**: Protocol.land service availability
   - **Mitigation**: Fallback to GitHub mirrors, local caching

2. **Template Compatibility**

   - **Risk**: Breaking changes in templates
   - **Mitigation**: Semantic versioning, compatibility testing

3. **Network Connectivity**
   - **Risk**: No internet during template selection
   - **Mitigation**: Offline template cache, default fallback

### User Experience Risks

1. **Template Selection Complexity**

   - **Risk**: Analysis paralysis from too many options
   - **Mitigation**: Smart defaults, guided selection, categories

2. **Customization Loss**
   - **Risk**: Users losing work during template switches
   - **Mitigation**: Clear warnings, backup system, migration tools

## Success Metrics

### Adoption Metrics

- Template selection usage rate
- Community template submissions
- Template switching frequency
- User satisfaction scores

### Performance Metrics

- Template clone time (target: <30 seconds)
- Template validation accuracy (target: >95%)
- Preview generation time (target: <5 seconds)
- System reliability (target: 99.5% uptime)

## Future Enhancements

### Advanced Features (Future)

1. **Enhanced Template Validation**

   - Automated compatibility checking
   - Template health monitoring
   - Build testing integration

2. **Template Management Tools**

   - Template update notifications
   - Automated template sync
   - Template rollback capabilities

### Ecosystem Integration

1. **Arweave Native Templates**

   - Templates stored directly on Arweave
   - Immutable template versioning via Protocol.land

2. **Community Template Support**
   - Template sharing via Protocol.land
   - Decentralized template discovery

## UX Consolidation Benefits

### Eliminated Modal Conflicts

1. **Single Point of Configuration**: All site-related settings in one unified modal
2. **No Competing Interfaces**: Template selection integrated into existing settings flow
3. **Contextual Organization**: Related settings grouped logically (General, Display, Build, Template)
4. **Progressive Disclosure**: Template options appear naturally within configuration context

### Streamlined User Experience

1. **Single Point of Entry**: One "Configure" button handles all configuration needs
2. **Context-Aware Interface**: Modal adapts based on initialization status (first-time vs existing)
3. **Clear Change Impact**: Visual indicators distinguish safe vs destructive changes
4. **Intelligent Workflow**: First-time users see template selection, returning users see full configuration
5. **Consistent Interaction**: All site configuration follows same interaction patterns

### Technical Benefits

1. **Code Reuse**: Leverages existing modal infrastructure, validation, and form handling
2. **Maintainable**: Single modal system to maintain vs multiple competing interfaces
3. **Extensible**: Easy to add new configuration sections using established patterns
4. **Testable**: Unified testing approach for all site configuration functionality

## Conclusion

This implementation plan provides a comprehensive roadmap for building a flexible, extensible template system that seamlessly integrates with Meridian's Deploy panel through a single, intuitive "Configure" button. By eliminating the separate Initialize and Site Settings buttons, we create a streamlined workflow that handles both first-time setup and ongoing configuration through one unified interface.

The context-aware modal adapts intelligently: new users see template selection prominently alongside basic configuration, while existing users access the full configuration interface with their current template clearly indicated. The integration with Protocol.land positions Meridian at the forefront of decentralized development tooling while maintaining compatibility with familiar platforms like GitHub.

This design eliminates UX confusion by providing one clear path to configuration, whether users are setting up their first site or modifying an existing one. The single "Configure" button approach creates a professional, intentional user experience that scales from simple setup to advanced configuration needs.
