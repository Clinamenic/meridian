# Build Button Preview Default - Implementation Plan

## Overview

Remove the eye icon toggle entirely and modify the Deploy panel's build button to always trigger a site preview, eliminating the optionality and simplifying the user experience.

## Current Architecture Analysis

### Current Flow

1. **Build Phase Card** contains:

   - Eye icon toggle (`enable-preview-toggle`) - positioned absolutely in top-right
   - Build button (`build-preview-workflow-btn`) - labeled "Build"
   - Phase description

2. **Current State Management**:

   - `previewEnabled` boolean tracks toggle state (defaults to `false`)
   - Eye icon visual state controlled by `active` class
   - Build button always shows "Build" text regardless of toggle state

3. **Current Button Behavior**:
   - Clicking build button calls `buildSiteWithOptionalPreview(previewEnabled)`
   - If `previewEnabled` is `false` (default): Only builds site
   - If `previewEnabled` is `true`: Builds site + starts preview server

### Key Files Involved

- `Meridian/src/renderer/modules/DeployManager.js` - Main implementation
- `Meridian/src/renderer/styles/modules/deploy-manager.css` - Styling
- `Meridian/src/main/site-deploy-manager.ts` - Backend build/preview logic

## Proposed Changes

### 1. Remove Eye Icon Toggle

**Current**: Eye icon positioned absolutely in top-right of build card
**Proposed**: Remove eye icon entirely from UI

### 2. Simplify Button Behavior

**Current**: Button calls `buildSiteWithOptionalPreview(previewEnabled)` with toggle state
**Proposed**: Button always calls `buildSiteWithPreview()` (no optionality)

### 3. Update Button Text

**Current**: Always shows "Build"
**Proposed**: Show "Build & Preview" to clearly indicate behavior

### 4. Remove State Management

**Current**: `previewEnabled` boolean and toggle logic
**Proposed**: No state management needed - preview is always enabled

## Implementation Details

### File: `Meridian/src/renderer/modules/DeployManager.js`

#### Change 1: Remove Eye Icon from HTML Template (Line ~115-120)

```javascript
// Current:
<div class="deploy-phase-card ${isQuartzInitialized ? '' : 'disabled'}" data-phase="build-preview">
  <svg class="preview-eye-icon" id="enable-preview-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="Start preview server" ${isQuartzInitialized ? '' : 'disabled'}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
  <div class="phase-number">2</div>
  <button class="secondary-btn" id="build-preview-workflow-btn" ${isQuartzInitialized ? '' : 'disabled'}>Build</button>
  <div class="phase-description">Generate static site and optionally preview</div>
</div>

// Proposed:
<div class="deploy-phase-card ${isQuartzInitialized ? '' : 'disabled'}" data-phase="build-preview">
  <div class="phase-number">2</div>
  <button class="secondary-btn" id="build-preview-workflow-btn" ${isQuartzInitialized ? '' : 'disabled'}>Build & Preview</button>
  <div class="phase-description">Generate static site and preview</div>
</div>
```

#### Change 2: Simplify Event Listener Logic (Line ~225-250)

```javascript
// Current:
const buildPreviewBtn = document.getElementById("build-preview-workflow-btn");
const previewToggle = document.getElementById("enable-preview-toggle");
if (buildPreviewBtn && previewToggle && isQuartzInitialized) {
  // Track toggle state
  let previewEnabled = false;

  // Update button text and icon state
  const updateButtonAndIcon = () => {
    buildPreviewBtn.textContent = "Build";
    previewToggle.classList.toggle("active", previewEnabled);
  };

  // Set initial state
  updateButtonAndIcon();

  // Handle eye icon toggle
  previewToggle.addEventListener("click", () => {
    if (!previewToggle.hasAttribute("disabled")) {
      previewEnabled = !previewEnabled;
      updateButtonAndIcon();
    }
  });

  // Handle build button click
  buildPreviewBtn.addEventListener("click", async () => {
    await this.buildSiteWithOptionalPreview(previewEnabled);
  });
}

// Proposed:
const buildPreviewBtn = document.getElementById("build-preview-workflow-btn");
if (buildPreviewBtn && isQuartzInitialized) {
  // Handle build button click
  buildPreviewBtn.addEventListener("click", async () => {
    await this.buildSiteWithPreview();
  });
}
```

#### Change 3: Create New Method (Replace buildSiteWithOptionalPreview)

```javascript
// New method to replace buildSiteWithOptionalPreview
async buildSiteWithPreview() {
  try {
    this.app.updateFooterStatus('Building site...', false);

    // Show build logs section
    this.showBuildLogs();
    this.appendBuildLog('Starting build process...');

    const buildResult = await window.electronAPI.deploy.buildSite({
      workspacePath: this.app.workspacePath
    });

    if (buildResult.status === 'success') {
      this.appendBuildLog('Build completed successfully!');
      this.appendBuildLog(`Processed ${buildResult.filesProcessed} files in ${buildResult.duration}ms`);
      if (buildResult.output) {
        this.appendBuildLog('--- Build Output ---');
        this.appendBuildLog(buildResult.output);
      }

      // Always start preview after successful build
      this.appendBuildLog('Starting preview server...');
      this.app.updateFooterStatus('Starting preview server...', false);

      try {
        const previewUrl = await window.electronAPI.deploy.previewSite({
          workspacePath: this.app.workspacePath
        });

        // Show preview section and load the site
        this.showPreviewSection(previewUrl);
        this.appendBuildLog(`Preview server started at ${previewUrl}`);
        this.app.showSuccess(`Site built and preview started at ${previewUrl}`);
      } catch (previewError) {
        console.error('Failed to start preview:', previewError);
        this.appendBuildLog(`Preview failed: ${previewError.message}`);
        this.app.showError(`Build succeeded but preview failed: ${previewError.message}`);
      }
    } else {
      this.appendBuildLog('Build failed!');
      if (buildResult.errors) {
        buildResult.errors.forEach(error => this.appendBuildLog(`Error: ${error}`));
      }
      this.app.showError(`Build failed: ${buildResult.errors?.join(', ') || 'Unknown error'}`);
    }

    this.app.updateFooterStatus('Ready', false);

  } catch (error) {
    console.error('Failed to build site:', error);
    this.appendBuildLog(`Build failed: ${error.message}`);
    this.app.showError(`Build failed: ${error.message}`);
    this.app.updateFooterStatus('Ready', false);
  }
}
```

### File: `Meridian/src/renderer/styles/modules/deploy-manager.css`

#### Change 4: Remove Eye Icon Styles (Line ~300-350)

```css
/* Remove these styles entirely:
.preview-eye-icon {
  position: absolute;
  top: 10px;
  right: 5px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--surface-border);
  stroke: var(--surface-border);
  stroke-width: 1;
  fill: var(--surface-bg-subtle);
  z-index: 10;
  width: 38px;
  height: 38px;
}

.preview-eye-icon:hover {
  color: var(--surface-border);
  stroke: var(--surface-border);
  fill: var(--theme-primary-subtle);
  stroke-width: 1;
}

.preview-eye-icon.active {
  color: var(--theme-primary);
  stroke: var(--theme-primary);
  fill: var(--theme-primary-subtle);
}
*/
```

## Benefits

1. **Simplified UX**: No confusing toggle - just click Build to get preview
2. **Clearer Intent**: Button text "Build & Preview" clearly indicates behavior
3. **Reduced Complexity**: Eliminates state management and toggle logic
4. **Consistent Behavior**: Users always get the same experience
5. **Cleaner UI**: Removes visual clutter of the eye icon

## Backward Compatibility

- **Breaking Change**: Removes the ability to build without preview
- **API Compatibility**: Backend APIs remain unchanged
- **Other Modules**: No impact on other modules

## Testing Considerations

1. **Build + Preview Flow**: Verify build + preview works correctly
2. **Error Handling**: Verify build failures don't attempt preview
3. **Preview Failures**: Verify preview failures are handled gracefully
4. **UI Cleanup**: Verify eye icon is completely removed
5. **Button Text**: Verify button shows "Build & Preview"

## Implementation Steps

1. **Remove Eye Icon**: Delete from HTML template and CSS
2. **Simplify Event Logic**: Remove toggle state management
3. **Create New Method**: Replace `buildSiteWithOptionalPreview` with `buildSiteWithPreview`
4. **Update Button Text**: Change to "Build & Preview"
5. **Test Complete Flow**: Verify build + preview works end-to-end
6. **Clean Up Code**: Remove unused methods and variables

## Risk Assessment

**Low-Medium Risk**: This is a UX simplification that:

- Removes optionality (breaking change for users who preferred build-only)
- Simplifies codebase and reduces complexity
- Maintains core functionality
- Is easily testable

## Success Criteria

- [ ] Eye icon completely removed from UI
- [ ] Build button shows "Build & Preview"
- [ ] Clicking Build button always triggers build + preview
- [ ] No toggle state management in code
- [ ] Preview section appears after successful build
- [ ] Error handling works correctly for both build and preview failures
- [ ] No regression in build or preview functionality
