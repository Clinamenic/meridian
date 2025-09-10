# Meridian-Quartz Fork Project Outline

## Overview

Create a dedicated fork of the Quartz static site generator optimized for Meridian's Digital Garden deployment workflow. This fork will eliminate the need for runtime customization and provide a clean, pre-configured foundation for Meridian users.

## Project Goals

1. **Pre-configured Architecture**: Deploy directly to `workspace/.quartz/` with content sourcing from `workspace/` root
2. **Meridian Integration**: Built-in plugins for Collate, Archive, and Broadcast functionality
3. **Streamlined Setup**: Remove vanilla Quartz documentation and examples that don't apply to Meridian users
4. **Optimized Performance**: Reduced dependencies and faster initialization
5. **Maintenance Simplicity**: Clear separation from upstream Quartz for independent evolution

## Repository Structure

```
meridian-quartz/
├── README.md                          # Meridian-specific documentation
├── package.json                       # Optimized dependencies for Meridian
├── quartz.config.ts                   # Pre-configured for workspace root sourcing
├── quartz/                            # Core Quartz engine (minimal modifications)
│   ├── cfg.ts                        # Configuration types
│   ├── plugins/                      # Plugin system
│   └── ...                           # Core functionality
├── plugins/
│   └── meridian/                     # Meridian-specific plugins
│       ├── collate.ts               # Resource gallery generation
│       ├── archive.ts               # Arweave showcase
│       └── broadcast.ts             # Social metadata enhancement
├── styles/
│   └── meridian-theme.scss          # Meridian-optimized theming
├── templates/                        # Meridian-specific templates
└── scripts/
    ├── init.js                       # Meridian initialization script
    └── deploy.js                     # Deployment utilities
```

## Key Differences from Vanilla Quartz

### Architecture Changes

- **Content Source**: Reads from parent workspace directory instead of internal `content/`
- **Installation Location**: Designed to live in `workspace/.quartz/` subdirectory
- **Ignore Patterns**: Pre-configured to ignore Meridian infrastructure (`.meridian/`, etc.)
- **Build Output**: Optimized for Meridian's preview and deployment workflow

### Removed Components

- [ ] `docs/` - Vanilla Quartz documentation
- [ ] `content/` - Example content and documentation
- [ ] `.github/` - Vanilla Quartz CI/CD workflows
- [ ] `CNAME` - Vanilla hosting configuration
- [ ] Vanilla `README.md` - Replace with Meridian-specific docs

### Added Components

- [ ] Meridian-specific plugins (`plugins/meridian/`)
- [ ] Pre-configured ignore patterns for Meridian workflow
- [ ] Optimized package.json with exact versions needed by Meridian
- [ ] Custom initialization scripts
- [ ] Meridian theming and branding

## Implementation Plan

### Phase 1: Repository Setup

1. **Fork Creation**

   - [ ] Fork jackyzha0/quartz to new `meridian-quartz` repository
   - [ ] Set up repository permissions and access
   - [ ] Configure branch protection and CI/CD

2. **Initial Cleanup**
   - [ ] Remove vanilla documentation and examples
   - [ ] Update README with Meridian-specific instructions
   - [ ] Modify package.json for Meridian requirements
   - [ ] Set up proper .gitignore for Meridian workflow

### Phase 2: Core Modifications

1. **Configuration Updates**

   - [ ] Modify default `quartz.config.ts` for workspace root sourcing
   - [ ] Update ignore patterns for Meridian infrastructure
   - [ ] Configure build output paths for `.quartz/public/`
   - [ ] Set Meridian-appropriate defaults (theme, plugins, etc.)

2. **Plugin Integration**
   - [ ] Create `plugins/meridian/` directory structure
   - [ ] Port existing Collate integration plugin
   - [ ] Port existing Archive showcase plugin
   - [ ] Create Broadcast metadata enhancement plugin
   - [ ] Register Meridian plugins in default configuration

### Phase 3: Meridian-Specific Features

1. **Enhanced Ignore System**

   - [ ] Smart detection of Meridian project structure
   - [ ] Automatic exclusion of development artifacts
   - [ ] Configurable ignore patterns via `.meridian/deploy.json`

2. **Initialization Optimization**

   - [ ] Custom init script for Meridian deployment setup
   - [ ] Automated workspace structure validation
   - [ ] Dependency verification and installation

3. **Theme Customization**
   - [ ] Meridian-branded color scheme and typography
   - [ ] Optimized layouts for digital garden content
   - [ ] Enhanced navigation for workspace-sourced content

### Phase 4: Integration & Testing

1. **Deploy Manager Updates**

   - [ ] Update `deploy-manager.ts` to use meridian-quartz instead of vanilla
   - [ ] Remove runtime customization code (now pre-configured)
   - [ ] Simplify initialization and build processes
   - [ ] Add fallback to vanilla Quartz if meridian-quartz unavailable

2. **Testing & Validation**
   - [ ] Test with various workspace structures
   - [ ] Validate Meridian plugin functionality
   - [ ] Performance benchmarking vs current approach
   - [ ] Cross-platform compatibility testing

## Technical Specifications

### Content Sourcing

```typescript
// Current vanilla approach:
contentDir: "./content";

// Meridian-quartz approach:
contentDir: "../"; // Parent workspace directory
```

### Ignore Patterns

```typescript
ignorePatterns: [
  // Quartz infrastructure
  ".quartz/**",
  ".quartz-cache/**",

  // Meridian infrastructure
  ".meridian/**",

  // Development files
  ".git/**",
  "node_modules/**",
  "package*.json",

  // System files
  ".DS_Store",
  ".vscode/**",

  // Private content
  "private/**",
  "templates/**",
];
```

### Plugin Architecture

```typescript
// Meridian plugins auto-registered in default config
plugins: {
  emitters: [
    ...defaultEmitters,
    MeridianCollatePlugin(),
    MeridianArchivePlugin(),
    MeridianBroadcastPlugin(),
  ];
}
```

## Maintenance Strategy

### Version Management

- **Semantic Versioning**: Independent versioning from upstream Quartz
- **Release Cadence**: Aligned with Meridian release cycles
- **Compatibility Matrix**: Document supported Meridian versions

### Upstream Synchronization

- **Selective Merging**: Cherry-pick useful upstream improvements
- **Breaking Change Management**: Evaluate upstream changes for Meridian compatibility
- **Fork Divergence Tracking**: Maintain clear documentation of differences

### Testing & Quality Assurance

- **Automated Testing**: CI/CD pipeline for build validation
- **Integration Tests**: Automated testing with Meridian deploy workflows
- **Performance Monitoring**: Track build times and resource usage

## Migration Plan

### Current Workflow

```
1. Clone vanilla Quartz to .quartz/
2. Remove unwanted files (docs, content, etc.)
3. Add Meridian plugins
4. Configure for workspace root sourcing
5. Install dependencies
```

### New Workflow

```
1. Clone meridian-quartz to .quartz/
2. Run meridian-specific initialization
3. Build directly (all configuration pre-applied)
```

### Deployment Manager Changes

- [ ] Update clone URL to meridian-quartz repository
- [ ] Remove `customizeQuartzForMeridian()` method
- [ ] Remove `createMeridianPlugins()` method
- [ ] Simplify `createQuartzProject()` method
- [ ] Add version compatibility checking

## Project Decisions

1. **Repository Hosting**: `https://github.com/Clinamenic/meridian-quartz.git`

2. **Versioning Strategy**: Independent versioning from upstream Quartz with proper attribution

3. **Upstream Compatibility**: Complete divergence allowed - optimize for Meridian workflow

4. **Plugin Distribution**: Meridian plugins packaged within meridian-quartz repository

5. **Feature Scope**: Custom plugins and components will be added for Meridian functionality

6. **Branding**: Minimal for now, subtle branding/styling to be added later

7. **Fallback Strategy**: Commit fully to meridian-quartz, with error handling for unavailable cases

## Success Metrics

- [ ] **Performance**: >50% reduction in initialization time
- [ ] **Maintainability**: Eliminate runtime customization code
- [ ] **User Experience**: Simplified deploy setup for Meridian users
- [ ] **Reliability**: Reduced dependency on upstream Quartz changes
- [ ] **Feature Completeness**: All current Meridian integrations preserved/enhanced

## Next Steps

1. **Decision Making**: Address clarifying questions above
2. **Repository Setup**: Create meridian-quartz fork and initial structure
3. **Proof of Concept**: Implement core modifications and test with single workspace
4. **Integration**: Update deploy-manager.ts to use new fork
5. **Testing**: Comprehensive validation across different workspace types
6. **Documentation**: Create migration guide and user documentation
