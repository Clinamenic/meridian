# Landing Page Transition Plan

## Overview

This document outlines the transition from the current integrated landing page architecture to a standalone landing page HTML file featuring the animated topological contoured sphere. The landing page will preserve the existing copy and "Select Workspace" button, and upon workspace selection, the landing page window will close and the main app window will open.

## Current Architecture Analysis

### Current Landing Page Structure

- **Location**: `src/renderer/index.html` (lines 13-25)
- **Implementation**: Integrated within the main app HTML structure
- **Canvas**: `#marbling-canvas` with class `marbling-background`
- **Content**: Centered content with "Meridian" title, version text, description, and "Select Workspace" button
- **Renderer**: Basic OrganicWaveRenderer with wave-based animation
- **Interaction**: No drag functionality on sphere surface

### Current OrganicWaveRenderer

- **Location**: `src/renderer/js/OrganicWaveRenderer.js`
- **Features**: Wave-based animation with Meridian theme colors
- **Configuration**: Optimized for brand colors (#4ffa9f mint green)
- **Performance**: 60 FPS target with device pixel ratio optimization

### Current App Integration

- **Initialization**: `app.js` handles landing page display/hide logic
- **Workspace Selection**: Integrated with main app workflow
- **Transition**: Landing page hidden, main app shown after workspace selection
- **State Management**: Part of the main MeridianApp class

## Reference Implementation Analysis

### New Landing Page Structure (`landing.html`)

- **Standalone HTML**: Complete self-contained landing page
- **Canvas**: `#marbling-canvas` with animated topological sphere rendering
- **Content**: Preserved existing copy: "Meridian" title, version text, description, and "Select Workspace" button
- **Interaction**: Click/drag functionality on sphere surface area for rotation
- **Scripts**: Separate `landing.js` for landing-specific logic

### Enhanced OrganicWaveRenderer (`OrganicWaveRenderer.js`)

- **Topological Sphere**: 3D sphere with contour line rendering
- **Terrain Generation**: Multi-octave noise for realistic terrain
- **Color System**: 4-zone posterized color system with elevation thresholds
- **Animation**: Elevation animation with configurable speed/amplitude
- **Interaction**: Drag rotation, auto-rotation, circular viewport options

### Landing App Logic (`landing.js`)

- **Standalone Class**: `LandingApp` class for landing-specific functionality
- **Workspace Selection**: Direct integration with Electron API
- **Window Management**: Closes landing page window and opens main app window
- **Sphere Interaction**: Handles click/drag events on sphere surface for rotation
- **Error Handling**: Comprehensive error states and loading states

## Transition Strategy

### Phase 1: Create Standalone Landing Page

1. **Create new landing page file**

   - Location: `src/renderer/landing.html`
   - Based on reference `landing.html`
   - Minimal, focused structure

2. **Update OrganicWaveRenderer**

   - Enhance current renderer with topological sphere features
   - Maintain backward compatibility with existing wave animation
   - Add configuration options for different rendering modes

3. **Create landing-specific JavaScript**
   - Location: `src/renderer/landing.js`
   - Standalone `LandingApp` class
   - Handle workspace selection and app transition

### Phase 2: Update Main App Architecture

1. **Modify main.ts**

   - Add IPC handlers for window management between landing and main app
   - Support for opening main app window from landing page
   - Maintain existing workspace selection logic
   - Handle window lifecycle (landing page closes, main app opens)
   - Add `transitionToMainApp` IPC handler for window switching

2. **Update app.js**

   - Remove landing page initialization logic (lines 67-82)
   - Remove marbling background initialization (lines 67, 82)
   - Focus on main app functionality only
   - Handle workspace loading from external selection
   - Preserve all existing modular system integration

3. **Update index.html**
   - Remove landing page HTML structure (lines 13-25)
   - Focus on main app interface only
   - Clean up unused elements

### Phase 3: Integration and Testing

1. **Update build process**

   - Ensure landing page is properly built and served
   - Test both development and production modes

2. **Update main window creation**

   - Start with landing page instead of main app
   - Handle window management between landing and main app

3. **Test workflow**
   - Landing page → workspace selection → main app transition
   - Error handling and edge cases
   - Performance and visual quality

## Technical Implementation Details

### Enhanced OrganicWaveRenderer Configuration

```javascript
// Topological sphere configuration
const sphereConfig = {
  sphereRadius: 1.0,
  elevationScale: 0.0, // Flat surface for contour lines
  noiseOctaves: 4,
  noiseFrequency: 2.0,
  terrainColors: {
    color1: [0.2, 0.1, 0.4], // Darkest stratum
    color2: [0.25, 0.78, 0.5], // Dark stratum
    color3: [0.31, 0.98, 0.62], // Main theme color
    color4: [0.45, 0.95, 0.65], // Lightest stratum
  },
  elevationThresholds: {
    threshold1: 0.25,
    threshold2: 0.5,
    threshold3: 0.75,
  },
  enableDrag: true,
  autoRotate: true,
  autoRotateSpeed: 0.3,
  elevationAnimation: {
    enabled: true,
    speed: 0.5,
    amplitude: 0.15,
  },
};
```

### Landing Page HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
    />
    <title>Meridian - Local-First Multi-Tool Interface</title>
    <link rel="stylesheet" href="styles/main.css" />
  </head>
  <body>
    <div id="landing-container" class="landing-container">
      <canvas id="marbling-canvas" class="marbling-background"></canvas>
      <div class="landing-content">
        <h1>Meridian</h1>
        <p class="version-text" id="version-display">v0.4.0</p>
        <p>Please select a workspace directory to begin</p>
        <button id="landing-workspace-btn" class="primary-btn">
          Select Workspace
        </button>
      </div>
    </div>
    <script type="module" src="js/OrganicWaveRenderer.js"></script>
    <script type="module" src="landing.js"></script>
  </body>
</html>
```

### LandingApp Class Structure

```javascript
class LandingApp {
  constructor() {
    this.marblingRenderer = null;
    this.selectedWorkspace = null;
    this.initializeLandingSphere();
    this.setupWorkspaceSelection();
    this.loadAppVersion();
  }

  initializeLandingSphere() {
    // Initialize animated topological sphere renderer with drag functionality
    const canvas = document.getElementById("marbling-canvas");
    this.marblingRenderer = new OrganicWaveRenderer(canvas, {
      // Topological sphere configuration
      sphereRadius: 1.0,
      elevationScale: 0.0,
      noiseOctaves: 4,
      noiseFrequency: 2.0,
      terrainColors: {
        color1: [0.2, 0.1, 0.4],
        color2: [0.25, 0.78, 0.5],
        color3: [0.31, 0.98, 0.62],
        color4: [0.45, 0.95, 0.65],
      },
      elevationThresholds: {
        threshold1: 0.25,
        threshold2: 0.5,
        threshold3: 0.75,
      },
      enableDrag: true,
      autoRotate: true,
      autoRotateSpeed: 0.3,
      elevationAnimation: {
        enabled: true,
        speed: 0.5,
        amplitude: 0.15,
      },
    });
  }

  setupWorkspaceSelection() {
    // Handle workspace selection with existing button ID
    document
      .getElementById("landing-workspace-btn")
      .addEventListener("click", async () => {
        await this.selectWorkspace();
      });
  }

  async selectWorkspace() {
    // Workspace selection logic - preserve existing app.js workflow
    try {
      const result = await window.electronAPI.selectWorkspace();
      if (result) {
        this.selectedWorkspace = result;
        await this.transitionToMainApp();
      }
    } catch (error) {
      console.error("Failed to select workspace:", error);
    }
  }

  async transitionToMainApp() {
    // Close landing page window and open main app window
    await window.electronAPI.transitionToMainApp();
  }

  async loadAppVersion() {
    // Load app version - preserve existing functionality
    try {
      const version = await window.electronAPI.getAppVersion();
      const versionDisplay = document.getElementById("version-display");
      if (versionDisplay) {
        versionDisplay.textContent = `v${version}`;
      }
    } catch (error) {
      console.error("Failed to load app version:", error);
    }
  }
}
```

## App.js Integration Strategy

### Current app.js Landing Page Logic (Lines 67-82)

```javascript
// Show landing page if no workspace is selected
if (!this.workspacePath) {
  document.getElementById("landing-page").style.display = "flex";
  this.initializeMarblingBackground();
  await this.loadAppVersion();
  document
    .getElementById("landing-workspace-btn")
    .addEventListener("click", async () => {
      await this.selectWorkspace();
      if (this.workspacePath) {
        document.getElementById("landing-page").style.display = "none";
        this.cleanupMarblingBackground();
        await this.loadToolData();
        // Account state will be automatically initialized by workspace selection
        await this.waitForAccountStateInitialization();
        this.updateFooterWorkspace();
        this.updateFooterStatus("Ready");
      }
    });
  return;
}
```

### Required Changes to app.js

1. **Remove Landing Page Logic**: Remove lines 67-82 that handle landing page display/hide
2. **Remove Marbling Background**: Remove `initializeMarblingBackground()` and `cleanupMarblingBackground()` calls
3. **Preserve Workspace Selection**: Keep `selectWorkspace()` method intact for main app functionality
4. **Preserve Modular System**: Maintain all existing module initialization and event handling
5. **Update Initialization Flow**: Start directly with main app when workspace exists

### Updated app.js Initialization Flow

```javascript
async init() {
  await this.checkWorkspace();

  // Initialize modular system first
  await this.moduleLoader.initializeAll();

  // Setup event listeners after modules are initialized
  await this.setupEventListeners();

  // If workspace exists, proceed with normal initialization
  if (this.workspacePath) {
    await this.loadAllToolData();
    await this.waitForAccountStateInitialization();
    this.updateFooterWorkspace();
    this.updateFooterStatus('Ready');
  } else {
    // No workspace - this should not happen in main app window
    console.warn('No workspace selected in main app window');
  }
}
```

### Required main.ts IPC Handlers

```typescript
// Add to main.ts setupIPC() method
private setupIPC(): void {
  // Existing IPC handlers...

  // New window management handlers
  ipcMain.handle('transitionToMainApp', async () => {
    try {
      // Create main app window
      const mainAppWindow = new BrowserWindow({
        width: 900,
        height: 800,
        minWidth: 700,
        minHeight: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js'),
          webSecurity: true,
          allowRunningInsecureContent: false,
          experimentalFeatures: false
        },
        titleBarStyle: 'hiddenInset',
        show: false
      });

      // Load the main app
      if (process.env.NODE_ENV === 'development') {
        mainAppWindow.loadFile(path.join(__dirname, '../../src/renderer/index.html'));
        mainAppWindow.webContents.openDevTools();
      } else {
        mainAppWindow.loadFile(path.join(__dirname, '../../src/renderer/index.html'));
      }

      // Show when ready
      mainAppWindow.once('ready-to-show', () => {
        mainAppWindow?.show();
      });

      // Close landing page window
      if (this.mainWindow) {
        this.mainWindow.close();
        this.mainWindow = mainAppWindow;
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to transition to main app:', error);
      return { success: false, error: error.message };
    }
  });
}
```

## Benefits of Transition

### User Experience

- **Faster Initial Load**: Standalone landing page loads quickly
- **Better Visual Impact**: Animated topological sphere creates stronger first impression
- **Interactive Sphere**: Click/drag functionality on sphere surface for user engagement
- **Cleaner Transitions**: Clear separation between landing and main app
- **Preserved Workflow**: Maintains existing workspace selection experience

### Technical Benefits

- **Modular Architecture**: Landing page independent of main app
- **Easier Maintenance**: Separate concerns and responsibilities
- **Better Performance**: Landing page doesn't load main app resources
- **Enhanced Visuals**: Topological sphere more engaging than wave animation

### Development Benefits

- **Clearer Code Organization**: Landing logic separate from main app
- **Easier Testing**: Landing page can be tested independently
- **Future Flexibility**: Easy to modify landing page without affecting main app
- **Better Error Handling**: Isolated error states and recovery

## Implementation Timeline

### Week 1: Foundation

- [ ] Create standalone landing page HTML
- [ ] Enhance OrganicWaveRenderer with topological sphere
- [ ] Create LandingApp class structure

### Week 2: Integration

- [ ] Update main.ts with landing page IPC handlers
- [ ] Modify app.js to remove landing page logic
- [ ] Update index.html to focus on main app

### Week 3: Testing and Refinement

- [ ] Test landing page → main app transition
- [ ] Optimize performance and visual quality
- [ ] Handle edge cases and error states

### Week 4: Polish and Documentation

- [ ] Final visual refinements
- [ ] Update documentation
- [ ] Performance optimization

## Risk Assessment

### Low Risk

- **Visual Changes**: Topological sphere is additive, doesn't break existing functionality
- **Code Organization**: Modular approach reduces coupling

### Medium Risk

- **Window Management**: Need to handle multiple windows properly
- **State Management**: Ensure workspace selection state is preserved

### Mitigation Strategies

- **Incremental Implementation**: Build and test each phase separately
- **Fallback Options**: Maintain ability to revert to current architecture
- **Comprehensive Testing**: Test all workflows and edge cases
- **Performance Monitoring**: Ensure new renderer doesn't impact performance

## Success Criteria

### Functional Requirements

- [ ] Landing page loads independently with animated topological sphere
- [ ] Sphere surface area supports click/drag interaction for rotation
- [ ] Existing landing page copy and "Select Workspace" button are preserved
- [ ] Workspace selection works seamlessly with existing workflow
- [ ] Landing page window closes and main app window opens upon workspace selection
- [ ] Main app integrates properly with existing app.js modular system
- [ ] Error states are handled gracefully

### Performance Requirements

- [ ] Landing page loads in < 2 seconds
- [ ] Topological sphere maintains 60 FPS
- [ ] Memory usage remains reasonable
- [ ] No performance regression in main app

### User Experience Requirements

- [ ] Animated topological sphere creates stronger visual impact than current wave animation
- [ ] Interactive sphere drag functionality feels natural and engaging
- [ ] Preserved landing page copy maintains familiar user experience
- [ ] Window transition workflow feels natural and intuitive
- [ ] Loading states provide clear feedback
- [ ] Error messages are helpful and actionable

## Conclusion

This transition represents a significant improvement to Meridian's user experience and code architecture. The standalone landing page with animated topological sphere rendering will create a stronger first impression while preserving the familiar user experience. The interactive sphere with click/drag functionality will engage users while maintaining the existing workspace selection workflow.

The window-based architecture (landing page window closes, main app window opens) provides clear separation of concerns while ensuring proper integration with the existing app.js modular system. This approach maintains the high quality and reliability of the current application while adding the enhanced visual experience of the topological sphere.

The implementation should be approached incrementally, with careful testing at each phase to ensure a smooth transition and maintain the high quality of the current application.
