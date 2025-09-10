# Meridian-Quartz GitHub Pages Integration Plan

## Overview

This document outlines the plan to integrate GitHub Pages deployment capabilities into the generic meridian-quartz framework, based on successful implementations in the website project. The integration will enable users to deploy their digital gardens directly to GitHub Pages with minimal configuration.

## Clean Workspace Philosophy

**Core Principle**: The user's chosen workspace directory should remain clean and focused on content, not framework implementation details.

**Key Implementation Details**:

- All Quartz framework code lives in `.quartz/` subdirectory
- Root directory contains only content files and minimal configuration
- Build commands always operate from `.quartz/` directory via `cd .quartz`
- No framework dependencies pollute the root workspace
- GitHub Actions workflow follows the proven pattern: `cd .quartz && npm install` and `npm run build`

This approach ensures that users can focus on their content while the framework handles all technical complexity behind the scenes, maintaining the clean separation demonstrated in the working website implementation.

## Current State Analysis

### Website Project Implementation

The website project has successfully implemented a custom Quartz framework with the following key changes:

1. **Dependency Management Optimization**

   - Removed duplicate dependencies from root `package.json`
   - All Quartz framework dependencies consolidated in framework directory
   - Root project contains only essential scripts and metadata

2. **GitHub Pages Deployment**

   - Added `.github/workflows/deploy.yml` for automated deployment
   - Configured for GitHub Pages with proper permissions
   - Uses Node.js 22 and standard GitHub Actions workflow

3. **Architecture Benefits**
   - Clean separation between framework and content
   - Reduced repository size by eliminating duplicate dependencies
   - Simplified maintenance and updates
   - Standard GitHub Pages deployment workflow

### Current Meridian-Quartz Framework

The Meridian application currently implements a sophisticated Quartz initialization system:

**Current Architecture**:

- **Template Cloning**: Uses `SiteTemplateCloner` to clone templates into `.quartz/` subdirectory
- **Dependency Management**: Creates workspace `package.json` with ALL Quartz dependencies copied from `.quartz/package.json`
- **Build Process**: Executes `npx quartz build --directory "${workspacePath}" --output "${quartzPath}/public"` from `.quartz/` directory
- **Configuration**: Injects custom ignore patterns into Quartz config before building
- **GitHub Actions**: Generates workflow files but uses complex setup process

**Key Files**:

- `src/main/site-deploy-manager.ts` - Main initialization and build logic
- `src/renderer/modules/DeployManager.js` - Frontend deployment interface
- `src/main/site-template-cloner.ts` - Template cloning system

**Current Issues**:

- Duplicate dependencies between workspace and `.quartz/` directories
- Complex GitHub Actions workflow generation
- No clean separation between framework and content dependencies

## Integration Objectives

### Primary Goals

1. **GitHub Pages Deployment Automation**

   - Provide ready-to-use GitHub Actions workflow
   - Support for custom domain configuration
   - Automated deployment on push to main branch

2. **Dependency Management Optimization**

   - Implement clean dependency separation
   - Reduce framework footprint
   - Enable easier framework updates

3. **Configuration Flexibility**
   - Support multiple deployment targets
   - Configurable build parameters
   - Environment-specific settings

### Secondary Goals

1. **Documentation and Examples**

   - Comprehensive setup guides
   - Configuration examples
   - Troubleshooting documentation

2. **Framework Modularity**
   - Optional GitHub Pages integration
   - Backward compatibility
   - Extensible architecture

## Implementation Plan

### Phase 1: Framework Restructuring

#### 1.1 Dependency Management Refactor

**Objective**: Eliminate duplicate dependencies between workspace and `.quartz/` directories

**Current Problem**:
The `createWorkspacePackageJson()` method in `site-deploy-manager.ts` copies ALL Quartz dependencies to the workspace root, creating duplication.

**Tasks**:

- [ ] Modify `createWorkspacePackageJson()` to create minimal workspace `package.json`
- [ ] Update workspace `package.json` to use delegation pattern: `"build": "cd .quartz && npm run build"`
- [ ] Ensure `.quartz/package.json` contains all framework dependencies
- [ ] Update build process to work with new dependency structure
- [ ] Test that all functionality works with minimal workspace dependencies

**Files to Modify**:

- `src/main/site-deploy-manager.ts` - Update `createWorkspacePackageJson()` method
- `src/main/site-deploy-manager.ts` - Update `buildSite()` method if needed
- `src/renderer/modules/DeployManager.js` - Update any dependency-related UI logic

**Expected Outcome**:

- Workspace `package.json` contains only essential scripts and metadata
- All Quartz framework dependencies isolated in `.quartz/package.json`
- Build commands delegate to `.quartz/` directory
- Eliminated duplicate dependencies and reduced repository size

#### 1.2 Build System Updates

**Objective**: Ensure build system works with clean dependency separation

**Current Implementation**:
The `buildSite()` method in `site-deploy-manager.ts` already uses the correct pattern:

```typescript
const result = await execAsync(
  `npx quartz build --directory "${workspacePath}" --output "${path.join(
    quartzPath,
    "public"
  )}"`,
  {
    cwd: quartzPath, // Runs from .quartz directory
    // ...
  }
);
```

**Tasks**:

- [ ] Verify current build command works with minimal workspace dependencies
- [ ] Update any hardcoded dependency checks in build process
- [ ] Ensure `installQuartzDependencies()` only installs in `.quartz/` directory
- [ ] Test build process with new dependency structure
- [ ] Update any error handling for missing workspace dependencies

**Files to Modify**:

- `src/main/site-deploy-manager.ts` - Update `buildSite()` method dependency checks
- `src/main/site-deploy-manager.ts` - Update `installQuartzDependencies()` method
- `src/main/site-deploy-manager.ts` - Update any dependency validation logic

**Expected Outcome**:

- Build process works entirely from `.quartz/` directory
- No dependency on workspace `node_modules`
- Clean separation maintained throughout build process

### Phase 2: GitHub Pages Integration

#### 2.1 GitHub Actions Workflow

**Objective**: Simplify and standardize GitHub Actions workflow generation

**Current Implementation**:
The `generateGitHubActionsWorkflow()` method in `site-deploy-manager.ts` creates complex workflow files. We need to simplify this to match the proven pattern from the website project.

**Tasks**:

- [ ] Update `generateGitHubActionsWorkflow()` to use the proven deploy.yml pattern
- [ ] Simplify workflow to use `cd .quartz && npm install` and `npm run build`
- [ ] Remove complex caching and submodule logic
- [ ] Ensure workflow uses `path: .quartz/public` for artifact upload
- [ ] Test generated workflow with actual GitHub Pages deployment

**Files to Modify**:

- `src/main/site-deploy-manager.ts` - Update `generateGitHubActionsWorkflow()` method
- `src/main/site-deploy-manager.ts` - Simplify workflow template
- `src/renderer/modules/DeployManager.js` - Update any workflow-related UI

**Workflow Features**:

```yaml
name: Deploy Quartz site to GitHub Pages

on:
  push:
    branches:
      - main # Adjust if your default branch is different

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Fetch all history for git info
      - uses: actions/setup-node@v4
        with:
          node-version: 22 # Match the Node version requirement from package.json
      - name: Install Dependencies
        run: cd .quartz && npm install
      - name: Build Quartz
        run: npm run build
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: .quartz/public

  deploy:
    needs: build
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

#### 2.2 Configuration Templates

**Objective**: Provide ready-to-use configuration templates

**Tasks**:

- [ ] Create `quartz.config.github-pages.ts` template
- [ ] Add environment variable support for URLs
- [ ] Create deployment-specific ignore patterns
- [ ] Add GitHub Pages specific optimizations

**Template Features**:

- Environment-based base URL configuration
- GitHub Pages specific ignore patterns
- Optimized build settings for static hosting
- SEO and performance optimizations

### Phase 3: Documentation and Examples

#### 3.1 Setup Documentation

**Objective**: Create comprehensive setup guides

**Tasks**:

- [ ] Write GitHub Pages deployment guide
- [ ] Create configuration examples
- [ ] Document troubleshooting steps
- [ ] Add migration guide from standard Quartz

**Documentation Structure**:

```
docs/
├── deployment/
│   ├── github-pages-setup.md
│   ├── custom-domain-configuration.md
│   └── troubleshooting.md
├── configuration/
│   ├── environment-variables.md
│   └── build-optimization.md
└── examples/
    ├── basic-site/
    ├── custom-domain/
    └── advanced-configuration/
```

#### 3.2 Example Projects

**Objective**: Provide working examples for different use cases

**Tasks**:

- [ ] Create basic example project
- [ ] Create custom domain example
- [ ] Create advanced configuration example
- [ ] Add example GitHub repositories

### Phase 4: Testing and Validation

#### 4.1 Framework Testing

**Objective**: Ensure framework works correctly with new structure

**Tasks**:

- [ ] Test build process with new directory structure
- [ ] Validate GitHub Actions workflow
- [ ] Test deployment to GitHub Pages
- [ ] Verify backward compatibility

#### 4.2 Integration Testing

**Objective**: Test complete deployment pipeline

**Tasks**:

- [ ] Create test repository with new framework
- [ ] Deploy to GitHub Pages
- [ ] Test custom domain configuration
- [ ] Validate all features work correctly

## Configuration Options

### Environment Variables

```bash
# GitHub Pages URL (required for deployment)
GITHUB_PAGES_URL=https://username.github.io/repository-name

# Custom domain (optional)
CUSTOM_DOMAIN=example.com

# Build optimization
NODE_ENV=production
```

### Build Scripts

**Minimal Root Package.json** (following the clean workspace pattern):

```json
{
  "name": "project-name",
  "version": "1.0.0",
  "description": "Website built with custom Quartz framework",
  "type": "module",
  "engines": {
    "node": ">=22",
    "npm": ">=10.9.2"
  },
  "scripts": {
    "build": "cd .quartz && npm run build",
    "serve": "cd .quartz && npm run serve",
    "quartz": "cd .quartz && tsx ./quartz/bootstrap-cli.mjs"
  }
}
```

**Key Principles**:

- Root package.json contains only essential scripts and metadata
- All Quartz framework dependencies are isolated in `.quartz/package.json`
- Build commands always `cd .quartz` to maintain clean workspace separation
- No duplicate dependencies between root and framework directories

## Specific Code Changes Required

### 1. Update `createWorkspacePackageJson()` Method

**File**: `src/main/site-deploy-manager.ts` (lines 898-935)

**Current Code**:

```typescript
// Create a workspace package.json that includes all Quartz dependencies
const workspacePackageJson = {
  name: "meridian-digital-garden",
  version: "1.0.0",
  type: "module",
  engines: quartzPackageJson.engines || {
    node: ">=22",
    npm: ">=10.9.2",
  },
  scripts: {
    build: "npx quartz build",
    serve: "npx quartz build --serve",
  },
  // Copy all dependencies from Quartz
  devDependencies: quartzPackageJson.devDependencies || {},
  dependencies: quartzPackageJson.dependencies || {},
};
```

**New Code**:

```typescript
// Create a minimal workspace package.json with delegation pattern
const workspacePackageJson = {
  name: "meridian-digital-garden",
  version: "1.0.0",
  description: "Website built with custom Quartz framework",
  type: "module",
  engines: quartzPackageJson.engines || {
    node: ">=22",
    npm: ">=10.9.2",
  },
  scripts: {
    build: "cd .quartz && npm run build",
    serve: "cd .quartz && npm run serve",
    quartz: "cd .quartz && tsx ./quartz/bootstrap-cli.mjs",
  },
  // No dependencies - all handled in .quartz/package.json
};
```

### 2. Update `generateGitHubActionsWorkflow()` Method

**File**: `src/main/site-deploy-manager.ts` (lines 1803-1843)

**Current Implementation**: Complex workflow with caching and submodule handling

**New Implementation**: Use the proven pattern from website project:

```typescript
const workflowContent = `name: Deploy Quartz site to GitHub Pages

on:
  push:
    branches:
      - main

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Install Dependencies
        run: cd .quartz && npm install
      - name: Build Quartz
        run: npm run build
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: .quartz/public

  deploy:
    needs: build
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4`;
```

### 3. Update Build Process Validation

**File**: `src/main/site-deploy-manager.ts` (lines 1086-1094)

**Current Code**:

```typescript
// First, verify that dependencies are installed in the quartz directory
console.log("Verifying dependencies in quartz directory...");
try {
  await execAsync("npm list async-mutex", { cwd: quartzPath });
  console.log("async-mutex is installed in quartz directory");
} catch (listError) {
  console.log("async-mutex not found, attempting to install dependencies...");
  await this.installQuartzDependencies(quartzPath);
}
```

**New Code**: Remove workspace dependency checks, focus only on `.quartz/` directory:

```typescript
// Verify dependencies are installed in the quartz directory only
console.log("Verifying dependencies in quartz directory...");
try {
  await execAsync("npm list async-mutex", { cwd: quartzPath });
  console.log("Dependencies verified in quartz directory");
} catch (listError) {
  console.log("Installing dependencies in quartz directory...");
  await this.installQuartzDependencies(quartzPath);
}
```

## Migration Strategy

### For Existing Meridian Projects

1. **Backup Current Setup**

   - Create backup of current configuration
   - Document current customizations

2. **Update Meridian Application**

   - Update to new version with clean dependency separation
   - Reinitialize Quartz project to get new structure

3. **Configure GitHub Pages**
   - Enable GitHub Pages in repository settings
   - Configure custom domain if needed
   - Test deployment with new workflow

### For New Projects

1. **Initialize Project**

   - Use updated Meridian application
   - Configure basic settings through DeployManager

2. **Setup GitHub Pages**
   - Use simplified deployment workflow
   - Configure repository settings
   - Deploy initial version

## Risk Assessment

### High Risk

- **Breaking Changes**: New directory structure may break existing setups
- **Dependency Conflicts**: Moving dependencies could cause version conflicts

### Medium Risk

- **GitHub Actions Issues**: Workflow may fail due to permission or configuration issues
- **Build Process Changes**: Modified build process may not work in all environments

### Low Risk

- **Documentation Gaps**: Users may struggle with new setup process
- **Performance Impact**: Additional build steps may slow down deployment

## Mitigation Strategies

### Breaking Changes

- Provide migration scripts
- Maintain backward compatibility where possible
- Clear documentation of changes

### Dependency Issues

- Thorough testing of dependency versions
- Clear upgrade paths
- Fallback options for problematic dependencies

### GitHub Actions Issues

- Comprehensive workflow testing
- Clear error messages and troubleshooting
- Alternative deployment methods

## Success Metrics

### Technical Metrics

- [ ] Successful deployment to GitHub Pages
- [ ] Build time under 5 minutes
- [ ] Zero dependency conflicts
- [ ] 100% backward compatibility for existing features

### User Experience Metrics

- [ ] Setup time under 10 minutes for new projects
- [ ] Clear documentation with examples
- [ ] Successful migration for existing projects
- [ ] Positive user feedback

## Timeline

### Week 1-2: Framework Restructuring

- Implement dependency separation
- Update build system
- Test basic functionality

### Week 3-4: GitHub Pages Integration

- Create GitHub Actions workflow
- Implement configuration templates
- Test deployment pipeline

### Week 5-6: Documentation and Examples

- Write comprehensive documentation
- Create example projects
- Test with real repositories

### Week 7-8: Testing and Validation

- Comprehensive testing
- Bug fixes and optimizations
- Final validation

## Future Enhancements

### Advanced Features

- Support for multiple deployment targets (Netlify, Vercel)
- Automated dependency updates
- Performance monitoring integration
- Advanced caching strategies

### Developer Experience

- CLI tools for setup and deployment
- Visual configuration interface
- Automated testing integration
- Performance optimization tools

## Conclusion

This integration plan will transform meridian-quartz into a comprehensive framework that supports easy GitHub Pages deployment while maintaining the flexibility and power of the original Quartz framework. The phased approach ensures minimal disruption to existing users while providing powerful new capabilities for digital garden deployment.

The key benefits of this integration include:

- Simplified deployment process
- Reduced maintenance overhead
- Better separation of concerns
- Enhanced developer experience
- Professional deployment capabilities

By implementing this plan, meridian-quartz will become the go-to solution for digital garden deployment, combining the power of Quartz with the convenience of automated GitHub Pages deployment.
