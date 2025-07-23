// Landing-specific app logic - minimal imports for fast loading
import { OrganicWaveRenderer } from './js/OrganicWaveRenderer.js';

console.log('[Landing] ===== LANDING.JS LOADED =====');

// Landing Application Logic
class LandingApp {
    constructor() {
        this.marblingRenderer = null;
        this.selectedWorkspace = null;
        
        // Initialize the landing sphere immediately
        this.initializeLandingSphere();
        this.setupWorkspaceSelection();
        this.setupCloseButton();
        this.loadAppVersion();
    }

    // Initialize only the landing sphere - fast initial load
    initializeLandingSphere() {
        const canvas = document.getElementById('marbling-canvas');
        if (!canvas) { 
            console.warn('Landing canvas not found'); 
            return; 
        }
        
        try {
            this.marblingRenderer = new OrganicWaveRenderer(canvas, {
                sphereRadius: 1,
                elevationScale: 0.85, // Add slight 3D displacement for spherical shading
                noiseOctaves: 3,
                noiseFrequency: 5.0,
                noisePersistence: 0.2,
                terrainSeed: 2,
                
                // Simple 4-color system - easy to manually adjust
                // Each color represents a distinct topological stratum
                // Colors are in RGB format [Red, Green, Blue] with values from 0.0 to 1.0
                terrainColors: {
                    color1: [5, 5, 5],   // Darkest stratum (lowest elevation) - Dark green
                    color2: [0.31, 0.98, 0.62], // Main theme color (medium elevation) - Bright mint
                    color3: [0.28, 0.85, 0.55],  // Dark stratum - Medium green
                    color4: [0.45, 0.95, 0.65]  // Lightest stratum (highest elevation) - Off-white
                },
                
                // Elevation thresholds for the 4 color zones (0.0 to 1.0)
                // Easy to adjust for different color distributions
                // Lower values = more of the darker colors, Higher values = more of the lighter colors
                elevationThresholds: {
                    threshold1: 0.3,  // Below this = color1 (25% of terrain will be darkest)
                    threshold2: 0.5,   // Below this = color2 (25% will be dark)
                    threshold3: 0.8   // Below this = color3 (25% will be main theme), above = color4 (25% will be lightest)
                },
                
                enableDrag: true, // Re-enable sphere rotation
                autoRotate: true, // Re-enable auto-rotation
                autoRotateSpeed: 0.3, // Increased rotation speed
                circularViewport: true, // Disable circular viewport to show full sphere
                viewportRadius: 1.0, // Full viewport
                edgeSoftness: 0.0, // No edge softness
                elevationAnimation: {
                    enabled: true,
                    speed: 0.4, // Much faster animation for visible fluctuation
                    amplitude: 0.15 // Much larger amplitude for dramatic changes
                },
                
                // Spherical shading for 3D effect
                sphericalShading: {
                    enabled: true,
                    intensity: 0.2, // Adjust this value to control shading strength (0.0 to 1.0)
                    lightDirection: [0.5, 1.0, 0.5] // Light direction [x, y, z]
                }
            });
            console.log('Landing sphere initialized successfully');
        } catch (error) {
            console.error('Failed to initialize landing sphere:', error);
        }
    }

    // Setup workspace selection handlers
    setupWorkspaceSelection() {
        const workspaceButton = document.getElementById('landing-workspace-btn');
        if (workspaceButton) {
            workspaceButton.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await this.selectWorkspace();
            });
        }
    }

    // Setup close button handler
    setupCloseButton() {
        const closeButton = document.getElementById('close-btn');
        if (closeButton) {
            closeButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.close();
            });
        }
    }

    // Handle workspace selection and load main app
    async selectWorkspace() {
        console.log('Loading workspace...');
        
        // Show loading state
        this.showLoadingState();
        
        try {
            const workspacePath = await window.electronAPI.selectWorkspace();
            
            if (workspacePath) {
                console.log(`Selected workspace: ${workspacePath}`);
                this.selectedWorkspace = workspacePath;
                
                // Transition to main app window
                console.log('Calling transitionToMainApp...');
                const result = await window.electronAPI.transitionToMainApp();
                console.log('Transition result:', result);
                
                if (result && result.success) {
                    console.log('Successfully transitioned to main app');
                } else {
                    console.error('Failed to transition to main app:', result?.error);
                    this.showErrorState(new Error('Failed to load main application'));
                }
            } else {
                // User cancelled workspace selection
                console.log('Workspace selection cancelled');
                this.hideLoadingState();
            }
        } catch (error) {
            console.error('Error during workspace selection:', error);
            this.showErrorState(error);
        }
    }

    // Show loading state
    showLoadingState() {
        const content = document.querySelector('.landing-content');
        if (content) {
            content.innerHTML = `
                <h1>Loading...</h1>
                <p>Initializing workspace</p>
            `;
        }
    }

    hideLoadingState() {
        const content = document.querySelector('.landing-content');
        if (content) {
            content.innerHTML = `
                <button id="close-btn" class="close-btn" title="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
                <h1>Meridian</h1>
                <p class="version-text" id="version-display">v0.4.0</p>
                <p>Please select a workspace directory to begin</p>
                <button id="landing-workspace-btn" class="primary-btn">
                    Select Workspace
                </button>
            `;
            // Re-attach event listeners
            this.setupWorkspaceSelection();
            this.setupCloseButton();
            this.loadAppVersion();
        }
    }

    // Show error state
    showErrorState(error) {
        const landingContent = document.querySelector('.landing-content');
        if (landingContent) {
            landingContent.innerHTML = `
                <div class="error-state">
                    <h2>Error Loading Workspace</h2>
                    <p>${error.message}</p>
                    <button class="workspace-btn" onclick="location.reload()">Retry</button>
                </div>
            `;
        }
    }

    // Load app version - preserve existing functionality
    async loadAppVersion() {
        try {
            const version = await window.electronAPI.getAppVersion();
            const versionDisplay = document.getElementById('version-display');
            if (versionDisplay) {
                versionDisplay.textContent = `v${version}`;
            }
        } catch (error) {
            console.error('Failed to load app version:', error);
            // Fallback to hardcoded version if API fails
            const versionDisplay = document.getElementById('version-display');
            if (versionDisplay) {
                versionDisplay.textContent = 'v0.4.0';
            }
        }
    }
}

// Initialize landing app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.landingApp = new LandingApp();
}); 