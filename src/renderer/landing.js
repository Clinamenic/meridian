// Landing-specific app logic - minimal imports for fast loading
import { TopologyRenderer } from './js/TopologyRenderer.js';

console.log('[Landing] ===== LANDING.JS LOADED =====');

// Landing Application Logic
class LandingApp {
    constructor() {
        this.marblingRenderer = null;
        this.selectedWorkspace = null;
        
        // Initialize the landing sphere immediately
        this.initializeLandingSphere();
        this.setupWorkspaceSelection();
        this.setupExitButton();
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
            // Use the new preset system - much cleaner configuration
            this.marblingRenderer = new TopologyRenderer(canvas, 'landing');
            console.log('Landing sphere initialized successfully with preset configuration');
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

    // Setup exit button handler
    setupExitButton() {
        const exitButton = document.getElementById('exit-btn');
        if (exitButton) {
            exitButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.close();
            });
        }
    }

    // Handle workspace selection and load main app
    async selectWorkspace() {
        console.log('Loading workspace...');
        
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
            }
        } catch (error) {
            console.error('Error during workspace selection:', error);
            this.showErrorState(error);
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