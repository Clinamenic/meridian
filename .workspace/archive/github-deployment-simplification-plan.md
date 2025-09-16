# GitHub Deployment Simplification Plan

## Overview

This document outlines the transition from Meridian's current automated GitHub deployment system to a simplified approach where Meridian only prepares the workspace for manual GitHub deployment. This change eliminates the complexity of token management and repository creation while maintaining the core functionality of GitHub Pages deployment.

## Current State Analysis

### Current GitHub Deployment Flow

1. **Token Management**: Users must create and manage GitHub Personal Access Tokens
2. **Account Management**: Meridian stores and manages GitHub account credentials
3. **Repository Creation**: Meridian automatically creates GitHub repositories via API
4. **Git Operations**: Meridian handles git initialization, commits, and pushes
5. **Workflow Generation**: Meridian creates `.github/workflows/deploy.yml`
6. **Full Automation**: Complete end-to-end deployment without user intervention

### Current Architecture Components

- **GitHubManager**: Handles token validation, account management, and API interactions
- **AccountManager**: UI for managing GitHub accounts and tokens
- **DeployManager**: Frontend interface for deployment configuration
- **SiteDeployManager**: Backend logic for repository creation and deployment
- **IPC Handlers**: Communication between renderer and main processes

## Proposed Simplified Approach

### New GitHub Deployment Flow

1. **Workspace Preparation**: Meridian creates `.github/workflows/deploy.yml` in the workspace
2. **Manual Repository Creation**: User creates GitHub repository manually
3. **Manual Git Setup**: User initializes git and pushes to their repository
4. **Automatic Deployment**: GitHub Actions handles the build and deployment

### Benefits of Simplified Approach

- **Reduced Complexity**: No token management or account storage
- **Better Security**: No sensitive credentials stored in Meridian
- **User Control**: Users maintain full control over their repositories
- **Simplified UI**: Cleaner, more focused deployment interface
- **Reduced Maintenance**: Less code to maintain and debug
- **Standard Workflow**: Follows common open-source project patterns

## Implementation Plan

### Phase 1: Create GitHub Actions Workflow Generator

**Objective**: Create a standalone method to generate `.github/workflows/deploy.yml`

**Tasks**:

1. **Extract Workflow Generation Logic**

   - Move `generateGitHubActionsWorkflow()` to a standalone utility
   - Remove dependency on deployment configuration object
   - Make it work with minimal input (just workspace path)

2. **Create New IPC Handler**

   - Add `deploy:generate-github-workflow` handler
   - Expose through electronAPI
   - Return success/failure status

3. **Update Frontend Interface**
   - Add "Prepare for GitHub Deployment" button
   - Show instructions for manual repository creation
   - Display generated workflow file location

### Phase 2: Remove Automated Deployment Components

**Objective**: Remove complex automated deployment while preserving core functionality

**Tasks**:

1. **Remove GitHub Account Management**

   - Remove `AccountManager` GitHub token UI
   - Remove GitHub account storage and validation
   - Remove token-related IPC handlers

2. **Simplify DeployManager Interface**

   - Remove GitHub account selection from deployment forms
   - Replace with "Prepare for GitHub" option
   - Add clear instructions for manual setup

3. **Remove Repository Creation Logic**
   - Remove `createGitHubRepository()` method
   - Remove `setupGitHubRepository()` method
   - Remove git initialization and push logic

### Phase 3: Update User Experience

**Objective**: Provide clear guidance for manual GitHub setup

**Tasks**:

1. **Create Setup Instructions**

   - Add modal with step-by-step GitHub setup guide
   - Include repository creation instructions
   - Provide git commands for manual setup

2. **Update Deployment UI**

   - Replace complex deployment forms with simple "Prepare" button
   - Show status of workflow file generation
   - Provide links to GitHub repository creation

3. **Add Validation**
   - Check if `.github/workflows/deploy.yml` exists
   - Validate workflow file format
   - Provide helpful error messages

## Files to Modify

### Core Changes

- `src/main/site-deploy-manager.ts`

  - Remove automated deployment methods
  - Keep `generateGitHubActionsWorkflow()` as standalone utility
  - Add new IPC handler for workflow generation

- `src/renderer/modules/DeployManager.js`

  - Simplify deployment interface
  - Remove GitHub account management
  - Add "Prepare for GitHub" functionality

- `src/renderer/modules/AccountManager.js`
  - Remove GitHub token management UI
  - Keep Arweave and other account types

### Cleanup Tasks

- `src/main/github-manager.ts`

  - Remove token validation and account management
  - Keep only workflow generation utilities

- `src/main/preload.ts`
  - Remove GitHub account-related IPC handlers
  - Add new workflow generation handler

## Migration Strategy

### For Existing Users

1. **Preserve Existing Workflows**: Don't break existing `.github/workflows/deploy.yml` files
2. **Graceful Degradation**: Show deprecation notice for automated deployment
3. **Migration Guide**: Provide instructions for transitioning to manual setup

### For New Users

1. **Simplified Onboarding**: Focus on workspace preparation
2. **Clear Documentation**: Provide comprehensive setup guide
3. **Example Workflow**: Include example repository setup

## User Experience Flow

### New Simplified Flow

1. **User clicks "Prepare for GitHub Deployment"**
2. **Meridian generates `.github/workflows/deploy.yml`**
3. **User sees success message with next steps**
4. **User manually creates GitHub repository**
5. **User runs git commands to push code**
6. **GitHub Actions automatically builds and deploys**

### Instructions Provided to User

```
✅ GitHub Actions workflow created at .github/workflows/deploy.yml

Next steps:
1. Create a new repository on GitHub (e.g., username.github.io)
2. Initialize git in your workspace:
   git init
   git add .
   git commit -m "Initial commit"
3. Add your GitHub repository as remote:
   git remote add origin https://github.com/username/repository.git
4. Push to GitHub:
   git push -u origin main
5. Enable GitHub Pages in repository settings
6. Your site will be available at https://username.github.io/repository
```

## Benefits Summary

### For Users

- **Simpler Setup**: No token management required
- **Full Control**: Complete ownership of repositories
- **Standard Process**: Follows common GitHub workflow patterns
- **Better Security**: No credentials stored in Meridian

### For Developers

- **Reduced Complexity**: Less code to maintain
- **Fewer Dependencies**: No GitHub API integration needed
- **Easier Testing**: Simpler workflow generation logic
- **Better Separation**: Clear boundary between Meridian and GitHub

### For the Project

- **Lower Maintenance**: Fewer moving parts
- **Better Reliability**: Less prone to API changes
- **Cleaner Architecture**: Focused on core functionality
- **Easier Onboarding**: Simpler for new contributors

## Implementation Timeline

### Week 1: Core Changes

- Extract workflow generation logic
- Create new IPC handler
- Update frontend interface

### Week 2: Cleanup

- Remove automated deployment code
- Clean up GitHub account management
- Update documentation

### Week 3: Testing & Polish

- Test workflow generation
- Validate user experience
- Update help documentation

## Success Metrics

### Technical Metrics

- **Code Reduction**: Target 30% reduction in deployment-related code
- **Bug Reduction**: Fewer deployment-related issues
- **Performance**: Faster app startup (no GitHub API calls)

### User Experience Metrics

- **Setup Time**: Reduced time to first deployment
- **Success Rate**: Higher deployment success rate
- **User Satisfaction**: Positive feedback on simplified process

## Conclusion

This simplification aligns with Meridian's core philosophy of keeping the user's workspace clean and focused. By removing the complexity of automated GitHub deployment, we create a more maintainable, secure, and user-friendly experience that follows standard open-source practices.

The transition maintains all the benefits of GitHub Pages deployment while eliminating the complexity of token management and automated repository creation. Users get full control over their repositories while Meridian focuses on what it does best: preparing and building Quartz sites.

