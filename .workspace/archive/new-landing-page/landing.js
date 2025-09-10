// Landing-specific app logic - minimal imports for fast loading
import { OrganicWaveRenderer } from './js/OrganicWaveRenderer.js';

console.log('[Landing] ===== LANDING.JS LOADED =====');

// Landing Application Logic
class LandingApp {
    constructor() {
        this.marblingRenderer = null;
        this.isMainAppLoaded = false;
        this.selectedWorkspace = null;
        
        // Initialize the landing sphere immediately
        this.initializeLandingSphere();
        this.setupWorkspaceSelection();
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
                sphereRadius: 1.0,
                elevationScale: 0.0, // No 3D displacement - flat surface for contour lines
                noiseOctaves: 4,
                noiseFrequency: 2.0,
                noisePersistence: 0.6,
                terrainSeed: 42,
                
                // Simple 4-color system - easy to manually adjust
                // Each color represents a distinct topological stratum
                // Colors are in RGB format [Red, Green, Blue] with values from 0.0 to 1.0
                terrainColors: {
                    color1: [0.2, 0.1, 0.4],   // Darkest stratum (lowest elevation) - Dark green
                    color2: [0.25, 0.78, 0.5],  // Dark stratum - Medium green
                    color3: [0.31, 0.98, 0.62], // Main theme color (medium elevation) - Bright mint
                    color4: [0.45, 0.95, 0.65]  // Lightest stratum (highest elevation) - Off-white
                },
                
                // Elevation thresholds for the 4 color zones (0.0 to 1.0)
                // Easy to adjust for different color distributions
                // Lower values = more of the darker colors, Higher values = more of the lighter colors
                elevationThresholds: {
                    threshold1: 0.25,  // Below this = color1 (25% of terrain will be darkest)
                    threshold2: 0.5,   // Below this = color2 (25% will be dark)
                    threshold3: 0.75   // Below this = color3 (25% will be main theme), above = color4 (25% will be lightest)
                },
                
                enableDrag: true, // Re-enable sphere rotation
                autoRotate: true, // Re-enable auto-rotation
                autoRotateSpeed: 0.3, // Increased rotation speed
                circularViewport: false, // Disable circular viewport to show full sphere
                viewportRadius: 1.0, // Full viewport
                edgeSoftness: 0.0, // No edge softness
                elevationAnimation: {
                    enabled: true,
                    speed: 0.5, // Much faster animation for visible fluctuation
                    amplitude: 0.15 // Much larger amplitude for dramatic changes
                }
            });
            console.log('Landing sphere initialized successfully');
            this.initializeLandingPageDrag();
        } catch (error) {
            console.error('Failed to initialize landing sphere:', error);
        }
    }

    // Setup workspace selection handlers
    setupWorkspaceSelection() {
        const workspaceButtons = document.querySelectorAll('.workspace-btn');
        workspaceButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const workspace = btn.dataset.workspace;
                this.selectWorkspace(workspace);
            });
        });
    }

    // Handle workspace selection and load main app
    async selectWorkspace(workspace) {
        console.log(`Loading workspace: ${workspace}`);
        this.selectedWorkspace = workspace;
        
        // Show loading state
        this.showLoadingState();
        
        try {
            // For the single "Select Workspace" button, show the workspace selection dialog
            if (workspace === 'select') {
                const workspacePath = await window.electronAPI.selectWorkspace();
                
                if (workspacePath) {
                    console.log(`Selected workspace: ${workspacePath}`);
                    // Transition to main app window
                    const result = await window.electronAPI.transitionToMainApp();
                    
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
            } else {
                // Handle other workspace options if needed
                console.error('Unknown workspace option:', workspace);
                this.showErrorState(new Error('Invalid workspace option'));
            }
        } catch (error) {
            console.error('Error during workspace selection:', error);
            this.showErrorState(error);
        }
    }

    // Dynamically load main app content
    async loadMainAppContent() {
        if (this.isMainAppLoaded) return;
        
        // Load main app HTML content
        const mainAppContainer = document.getElementById('main-app-container');
        
        // Create the main app structure
        mainAppContainer.innerHTML = `
            <div class="app-shell">
                <header class="app-header">
                    <div class="header-left">
                        <h1 class="app-title">Meridian</h1>
                    </div>
                    <div class="header-actions">
                        <button class="header-icon-btn" id="search-btn" title="Search">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="m21 21-4.35-4.35"></path>
                            </svg>
                        </button>
                        <button class="header-icon-btn" id="info-btn" title="Info">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="m9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                                <path d="M12 17h.01"></path>
                            </svg>
                        </button>
                    </div>
                </header>
                
                <main class="main-content">
                    <div class="tab-navigation">
                        <button class="tab-btn active" data-tab="resources">
                            <span class="tab-icon">📁</span>
                            <span class="tab-label">Resources</span>
                        </button>
                        <button class="tab-btn" data-tab="deploy">
                            <span class="tab-icon">🚀</span>
                            <span class="tab-label">Deploy</span>
                        </button>
                        <button class="tab-btn" data-tab="broadcast">
                            <span class="tab-icon">📡</span>
                            <span class="tab-label">Broadcast</span>
                        </button>
                    </div>
                    
                    <div class="tool-panels">
                        <div class="tool-panel active" id="resources-panel">
                            <div class="panel-header">
                                <h2>Resource Manager</h2>
                                <div class="panel-actions">
                                    <button class="panel-header-btn primary-btn">Add Resource</button>
                                </div>
                            </div>
                            <div class="panel-content">
                                <p>Resource management tools will be loaded here...</p>
                            </div>
                        </div>
                        
                        <div class="tool-panel" id="deploy-panel">
                            <div class="panel-header">
                                <h2>Deploy Manager</h2>
                                <div class="panel-actions">
                                    <button class="panel-header-btn primary-btn">Deploy</button>
                                </div>
                            </div>
                            <div class="panel-content">
                                <p>Deployment tools will be loaded here...</p>
                            </div>
                        </div>
                        
                        <div class="tool-panel" id="broadcast-panel">
                            <div class="panel-header">
                                <h2>Broadcast Manager</h2>
                                <div class="panel-actions">
                                    <button class="panel-header-btn primary-btn">Broadcast</button>
                                </div>
                            </div>
                            <div class="panel-content">
                                <p>Broadcasting tools will be loaded here...</p>
                            </div>
                        </div>
                    </div>
                </main>
                
                <footer class="app-footer">
                    <div class="footer-content">
                        <div class="footer-left">
                            <div class="footer-dropdown">
                                <button class="footer-dropdown-btn" id="workspace-dropdown">
                                    <span class="footer-label">Workspace:</span>
                                    <span class="footer-value" id="workspace-value">${this.selectedWorkspace}</span>
                                    <span class="footer-dropdown-arrow">▼</span>
                                </button>
                            </div>
                        </div>
                        <div class="footer-center">
                            <span class="footer-info">Ready</span>
                        </div>
                    </div>
                </footer>
            </div>
        `;
        
        // Load main app modules and functionality
        await this.loadMainAppModules();
        
        this.isMainAppLoaded = true;
    }

    // Load main app modules
    async loadMainAppModules() {
        // Load module-specific CSS
        await this.loadModuleCSS();
        
        // Initialize main app functionality
        this.initializeMainAppFunctionality();
    }

    // Load module CSS files
    async loadModuleCSS() {
        const cssFiles = [
            'styles/modules/resource-manager.css',
            'styles/modules/deploy-manager.css', 
            'styles/modules/broadcast-manager.css',
            'styles/modules/modal-manager.css'
        ];
        
        for (const cssFile of cssFiles) {
            await this.loadCSS(cssFile);
        }
    }

    // Load CSS file dynamically
    loadCSS(href) {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = () => resolve();
            link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
            document.head.appendChild(link);
        });
    }

    // Initialize main app functionality
    initializeMainAppFunctionality() {
        // Tab navigation
        const tabButtons = document.querySelectorAll('.tab-btn');
        const toolPanels = document.querySelectorAll('.tool-panel');
        
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                
                // Update active tab
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update active panel
                toolPanels.forEach(panel => panel.classList.remove('active'));
                document.getElementById(`${targetTab}-panel`).classList.add('active');
            });
        });
        
        // Header actions
        document.getElementById('search-btn')?.addEventListener('click', () => {
            console.log('Search functionality');
        });
        
        document.getElementById('info-btn')?.addEventListener('click', () => {
            console.log('Info functionality');
        });
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
                <h1>Meridian</h1>
                <p>Select a workspace to begin</p>
                <div class="workspace-selector">
                    <button class="workspace-btn" data-workspace="select">
                        Select Workspace
                    </button>
                </div>
            `;
            // Re-attach event listeners
            this.setupWorkspaceSelection();
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

    // Transition from landing to main app
    transitionToMainApp() {
        const landingContainer = document.getElementById('landing-container');
        const mainAppContainer = document.getElementById('main-app-container');
        
        // Hide landing container
        landingContainer.style.opacity = '0';
        landingContainer.style.transform = 'scale(0.9)';
        landingContainer.style.transition = 'all 0.5s ease-out';
        
        setTimeout(() => {
            landingContainer.style.display = 'none';
            mainAppContainer.classList.remove('hidden');
            
            // Show main app with animation
            mainAppContainer.style.opacity = '0';
            mainAppContainer.style.transform = 'scale(1.1)';
            mainAppContainer.style.transition = 'all 0.5s ease-out';
            
            requestAnimationFrame(() => {
                mainAppContainer.style.opacity = '1';
                mainAppContainer.style.transform = 'scale(1)';
            });
        }, 500);
    }

    // Initialize landing page drag functionality
    initializeLandingPageDrag() {
        const landingPage = document.querySelector('.landing-page');
        const landingContent = document.querySelector('.landing-content');
        if (!landingPage || !landingContent) { 
            console.warn('Landing page elements not found'); 
            return; 
        }
        
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        
        const handleMouseDown = (e) => {
            if (e.target.closest('.workspace-selector')) {
                return; // Don't drag if clicking workspace buttons
            }
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = landingPage.offsetLeft;
            startTop = landingPage.offsetTop;
            
            e.stopPropagation();
            e.preventDefault();
        };
        
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            landingPage.style.left = `${startLeft + deltaX}px`;
            landingPage.style.top = `${startTop + deltaY}px`;
            
            e.stopPropagation();
        };
        
        const handleMouseUp = (e) => {
            if (isDragging) {
                isDragging = false;
                e.stopPropagation();
            }
        };
        
        landingContent.addEventListener('mousedown', handleMouseDown, true);
        document.addEventListener('mousemove', handleMouseMove, true);
        document.addEventListener('mouseup', handleMouseUp, true);
        
        // Cleanup function
        this.cleanupLandingDrag = () => {
            landingContent.removeEventListener('mousedown', handleMouseDown, true);
            document.removeEventListener('mousemove', handleMouseMove, true);
            document.removeEventListener('mouseup', handleMouseUp, true);
        };
    }
}

// Initialize landing app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.landingApp = new LandingApp();
}); 