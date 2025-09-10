import { ModuleBase } from './ModuleBase.js';

/**
 * DeployManager module - handles all deployment-related operations (Quartz, build, deploy, site configuration)
 */
export class DeployManager extends ModuleBase {
  constructor(app) {
    super(app);
    // You can initialize state here if needed
  }

  async onInit() {
    console.log('[DeployManager] Initializing...');
    
    // Setup deploy-related event listeners
    this.setupDeployEvents();
    
    // Setup subtab navigation
    this.setupDeploySubtabs();
    
    // Initialize header collapse state
    this.initializeHeaderCollapseState();
    
    // Setup global collapsible section functionality
    this.setupGlobalCollapsibleSections();
    
    console.log('[DeployManager] Initialized');
  }

  async onCleanup() {
    // Placeholder for cleanup logic
    console.log('[DeployManager] Cleaned up');
  }

  /**
   * Set up all deploy-related event listeners
   */
  setupDeployEvents() {
    // Setup header collapse functionality
    this.setupHeaderCollapse();
    
    // Setup GitHub Pages toggle
    this.setupGitHubPagesToggle();
    
    // Subtab navigation is handled by setupDeploySubtabs()
    
    // Optional: Add any future header actions here
    // Example: Settings button, help button, etc.
  }

  /**
   * Setup GitHub Pages toggle functionality
   */
  setupGitHubPagesToggle() {
    // Use event delegation since the toggle might not exist when this runs
    document.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'github-pages-enabled') {
        this.handleGitHubPagesToggleChange(e.target.checked);
      }
    });
  }

  /**
   * Handle GitHub Pages toggle change (UI only)
   */
  handleGitHubPagesToggleChange(enabled) {
    // Just update the UI state - actual file operations will happen on Apply Changes
    console.log(`GitHub Pages toggle changed to: ${enabled}`);
    // The toggle state will be processed when Apply Changes is clicked
  }


  /**
   * Setup header collapse/expand functionality
   */
  setupHeaderCollapse() {
    const collapseBtn = document.getElementById('deploy-header-collapse-btn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        this.toggleHeaderCollapse();
      });
    }
  }

  /**
   * Toggle header collapse state
   */
  toggleHeaderCollapse() {
    const header = document.querySelector('#deploy-panel .panel-header');
    const collapseBtn = document.getElementById('deploy-header-collapse-btn');
    
    if (!header || !collapseBtn) return;
    
    const isCollapsed = header.classList.contains('collapsed');
    const newState = isCollapsed ? 'expanded' : 'collapsed';
    
    // Update header class
    header.classList.toggle('collapsed', !isCollapsed);
    
    // Update button state
    collapseBtn.setAttribute('data-state', newState);
    collapseBtn.setAttribute('title', newState === 'expanded' ? 'Collapse Header' : 'Expand Header');
    
    // Save state to localStorage
    localStorage.setItem('deployHeaderCollapsed', (!isCollapsed).toString());
  }

  /**
   * Initialize header collapse state from localStorage
   */
  initializeHeaderCollapseState() {
    const header = document.querySelector('#deploy-panel .panel-header');
    const collapseBtn = document.getElementById('deploy-header-collapse-btn');
    
    if (!header || !collapseBtn) return;
    
    try {
      const savedState = localStorage.getItem('deployHeaderCollapsed');
      if (savedState === 'true') {
        header.classList.add('collapsed');
        collapseBtn.setAttribute('data-state', 'collapsed');
        collapseBtn.setAttribute('title', 'Expand Header');
      } else {
        header.classList.remove('collapsed');
        collapseBtn.setAttribute('data-state', 'expanded');
        collapseBtn.setAttribute('title', 'Collapse Header');
      }
    } catch (error) {
      console.warn('[DeployManager] Failed to load header collapse state:', error);
    }
  }

  /**
   * Set up subtab navigation event listeners
   */
  setupDeploySubtabs() {
    const subtabBtns = document.querySelectorAll('.subtab-btn');
    subtabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchDeploySubtab(btn.dataset.tab);
      });
    });
  }

  /**
   * Switch to a specific deploy subtab
   */
  switchDeploySubtab(tabName) {
    // Hide all panels
    document.querySelectorAll('.subtab-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    
    // Show selected panel
    const targetPanel = document.getElementById(`${tabName}-tab`);
    if (targetPanel) {
      targetPanel.classList.add('active');
    }
    
    // Update button states
    document.querySelectorAll('.subtab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Load tab-specific content if needed
    this.loadSubtabContent(tabName);
  }

  /**
   * Load content for a specific subtab
   */
  loadSubtabContent(tabName) {
    switch (tabName) {
      case 'configure':
        this.loadConfigureContent();
        break;
      case 'build':
        this.loadBuildContent();
        break;
      case 'publish':
        this.loadPublishContent();
        break;
    }
  }

  /**
   * Load configure tab content
   */
  async loadConfigureContent() {
    try {
      const isInitialized = await this.checkQuartzInitialized();
      const currentSettings = await window.electronAPI.config.loadSiteSettings(this.app.workspacePath);
      const defaultTemplate = await window.electronAPI.template.getDefault();
      const clinamenicTemplate = await window.electronAPI.template.getClinamenic();
      
      this.renderConfigureContent(isInitialized, currentSettings, defaultTemplate, clinamenicTemplate);
    } catch (error) {
      console.error('Failed to load configure content:', error);
      this.getApp().showError('Failed to load configuration content');
    }
  }

  /**
   * Load build tab content
   */
  loadBuildContent() {
    this.renderBuildContent();
  }

  /**
   * Load publish tab content
   */
  async loadPublishContent() {
    try {
      const githubAccounts = await window.electronAPI.deploy.githubAccounts();
      this.renderPublishContent(githubAccounts);
    } catch (error) {
      console.error('Failed to load publish content:', error);
      this.getApp().showError('Failed to load deployment content');
    }
  }

  /**
   * Render configure tab content
   */
  renderConfigureContent(isInitialized, currentSettings, defaultTemplate, clinamenicTemplate) {
    const container = document.getElementById('configure-tab');
    
    // Extract form content from existing modal creation logic
    const formContent = this.generateConfigurationFormContent(
      isInitialized, currentSettings, defaultTemplate, clinamenicTemplate
    );
    
    container.innerHTML = formContent;
    this.setupConfigurationFormEvents(isInitialized, currentSettings);
  }

  /**
   * Render build tab content
   */
  renderBuildContent() {
    const container = document.getElementById('build-tab');
    
    // Move existing build logs and composition content
    container.innerHTML = this.generateBuildContent();
    this.setupBuildContentEvents();
    this.setupPreviewControls();
  }

  /**
   * Render publish tab content
   */
  renderPublishContent(githubAccounts) {
    const container = document.getElementById('publish-tab');
    
    // Extract deployment form content from existing modal logic
    const deploymentContent = this.generateDeploymentFormContent(githubAccounts);
    
    container.innerHTML = deploymentContent;
    this.setupDeploymentFormEvents();
  }

  /**
   * Generate configuration form content (extracted from modal)
   */
  generateConfigurationFormContent(isInitialized, currentSettings, defaultTemplate, clinamenicTemplate) {
    const currentTemplate = currentSettings.quartz?.template || defaultTemplate;
    
    return `
      <div class="deploy-main-content">
        <form id="site-configuration-form">
          <!-- Initialization Section -->
          <div class="collapsible-section" id="initialization-section">
            <div class="section-header" data-section="initialization">
              <h4>Initialization ${!isInitialized ? '(Required)' : ''}</h4>
              <button type="button" class="expand-btn" aria-label="Toggle initialization section">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="section-content">
              <div class="template-options">
                <div class="form-group form-group-enhanced">
                  <div class="form-group-header">
                    <label>Template Selection</label>
                    <button class="form-help-btn" title="Choose the Quartz template for your site. Vanilla is the default, Clinamenic has enhanced features, or use a custom template from GitHub.">?</button>
                  </div>
                  <div class="form-group-control">
                    <label class="radio-option">
                      <input type="radio" name="template" value="vanilla" ${currentTemplate.id === 'vanilla-quartz' ? 'checked' : ''}>
                      <div class="radio-content">
                        <strong>Vanilla Quartz</strong>
                        <p>Default Meridian-Quartz template with clean styling</p>
                      </div>
                    </label>
                    
                    <label class="radio-option">
                      <input type="radio" name="template" value="clinamenic" ${currentTemplate.id === 'clinamenic-quartz' ? 'checked' : ''}>
                      <div class="radio-content">
                        <strong>Clinamenic Quartz</strong>
                        <p>Enhanced Meridian-Quartz template with advanced features and optimizations</p>
                      </div>
                    </label>
                    
                    <label class="radio-option">
                      <input type="radio" name="template" value="custom" ${currentTemplate.id !== 'vanilla-quartz' && currentTemplate.id !== 'clinamenic-quartz' ? 'checked' : ''}>
                      <div class="radio-content">
                        <strong>Custom Template</strong>
                        <p>Use a custom Quartz template from GitHub or other source</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
              
              <div class="form-group form-group-enhanced" id="custom-template-group" style="display: ${currentTemplate.id !== 'vanilla-quartz' && currentTemplate.id !== 'clinamenic-quartz' ? 'block' : 'none'};">
                <div class="form-group-header">
                  <label for="custom-template-url">Custom Template URL</label>
                  <button class="form-help-btn" title="Enter the full GitHub repository URL for your custom Quartz template. The repository should contain a valid Quartz configuration.">?</button>
                </div>
                <div class="form-group-control">
                  <input type="text" id="custom-template-url" placeholder="https://github.com/username/repo" value="${currentTemplate.url || ''}">
                </div>
              </div>
            </div>
          </div>

          <!-- Site Settings Section -->
          <div class="collapsible-section" id="site-settings-section">
            <div class="section-header" data-section="site-settings">
              <h4>Site Settings</h4>
              <button type="button" class="expand-btn" aria-label="Toggle site settings section">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="section-content">
              <div class="form-group form-group-enhanced">
                <div class="form-group-header">
                  <label for="site-title">Site Title</label>
                  <button class="form-help-btn" title="The main title displayed on your site and in browser tabs. This appears in search results and social media previews.">?</button>
                </div>
                <div class="form-group-control">
                  <input type="text" id="site-title" value="${currentSettings.site?.title || ''}" maxlength="100">
                  <div class="character-count">
                    <span id="title-count">0</span>/100
                  </div>
                </div>
              </div>
              
              <div class="form-group form-group-enhanced">
                <div class="form-group-header">
                  <label for="site-description">Site Description</label>
                  <button class="form-help-btn" title="A brief description of your site used in metadata and search engines. This helps people understand what your site is about.">?</button>
                </div>
                <div class="form-group-control">
                  <textarea id="site-description" rows="3" maxlength="300">${currentSettings.site?.description || ''}</textarea>
                  <div class="character-count">
                    <span id="description-count">0</span>/300
                  </div>
                </div>
              </div>
              
              <div class="form-group form-group-enhanced">
                <div class="form-group-header">
                  <label for="base-url">Base URL</label>
                  <button class="form-help-btn" title="The full URL where your site will be accessible. This is used for generating absolute links and social media previews. Include the protocol (https://).">?</button>
                </div>
                <div class="form-group-control">
                  <input type="text" id="base-url" placeholder="https://example.com" value="${currentSettings.site?.baseUrl || ''}">
                </div>
              </div>
              
              <div class="form-group checkbox-group checkbox-group-enhanced">
                <div class="form-group-control">
                  <input type="checkbox" id="github-pages-enabled" ${currentSettings.deployment?.githubPages ? 'checked' : ''}>
                  <label for="github-pages-enabled" class="checkbox-label">GitHub Pages Deployment</label>
                  <button class="form-help-btn" title="Enables automatic deployment to GitHub Pages using GitHub Actions. Creates a workflow file that builds and deploys your site when you push changes to your repository.">?</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Custom Ignore Patterns Section -->
          <div class="collapsible-section" id="ignore-patterns-section">
            <div class="section-header" data-section="ignore-patterns">
              <h4>Custom Ignore Patterns</h4>
              <button type="button" class="expand-btn" aria-label="Toggle ignore patterns section">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="section-content">
              <div class="form-group form-group-enhanced">
                <div class="form-group-header">
                  <label for="custom-ignore-patterns">Additional Ignore Patterns</label>
                  <button class="form-help-btn" title="File patterns to exclude from your site build using glob syntax (*, **, etc.). One pattern per line. These will be added to the default Quartz ignore patterns.">?</button>
                </div>
                <div class="form-group-control">
                  <textarea id="custom-ignore-patterns" rows="4" placeholder="*.tmp&#10;private/**&#10;drafts/&#10;.env">${currentSettings.site?.ignorePatterns?.custom?.join('\n') || ''}</textarea>
                </div>
              </div>
            </div>
          </div>

          <!-- Form Actions -->
          <div class="form-actions">
            <button type="submit" class="primary-btn">
              ${isInitialized ? 'Apply Changes' : 'Initialize Site'}
            </button>
          </div>
        </form>
      </div>
    `;
  }

  /**
   * Generate build content (extracted from existing renderDeployStatus)
   */
  generateBuildContent() {
    return `
      <div class="deploy-main-content">
        <!-- Build Logs Section -->
        <div class="collapsible-section" id="build-logs-section">
          <div class="section-header" data-section="build-logs">
            <h4>Build Logs</h4>
            <div class="section-header-right">
              <div class="build-controls">
                <button type="button" class="primary-btn" id="build-site-btn">
                  Build Site
                </button>
                <div class="preview-info">
                  <span class="preview-status" id="preview-status">Server: Not running</span>
                  <button type="button" class="secondary-btn" id="open-external-btn" disabled>
                    Open External
                  </button>
                </div>
              </div>
              <button type="button" class="expand-btn" aria-label="Toggle build logs">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="section-content">
            <pre id="build-logs-output"></pre>
          </div>
        </div>

        <!-- Composition Section -->
        <div class="collapsible-section" id="composition-section">
          <div class="section-header" data-section="composition">
            <h4>Composition</h4>
            <div class="section-header-right">
              <span class="composition-summary">
                <span class="build-included">0</span> included, 
                <span class="build-excluded">0</span> excluded
              </span>
              <button type="button" class="expand-btn" aria-label="Toggle composition section">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="section-content">
            <div class="composition-breakdown">
              <div class="composition-column">
                <div class="breakdown-section">
                  <h5>Included Files</h5>
                  <div class="file-type-breakdown-compact">
                    <div class="no-exclusions">No files processed yet</div>
                  </div>
                </div>
              </div>
              <div class="composition-column">
                <div class="breakdown-section">
                  <h5>Excluded Files</h5>
                  <div class="file-type-breakdown-compact">
                    <div class="no-exclusions">No files processed yet</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate deployment form content (extracted from modal)
   */
  generateDeploymentFormContent(githubAccounts) {
    // Always show deployment options, even without GitHub accounts
    // since Arweave deployment doesn't require GitHub

    const accountOptions = githubAccounts.map(account => 
      `<option value="${account.id}" data-username="${account.username}" data-token-type="${account.tokenType}">
        ${account.nickname} (@${account.username}) ${account.tokenType === 'classic' ? '⚠️' : '🔒'}
      </option>`
    ).join('');

      return `
        <div class="deploy-main-content">
        <!-- GitHub Pages Deployment Section -->
        <div class="collapsible-section" id="github-pages-section">
          <div class="section-header" data-section="github-pages">
            <h4>GitHub Pages Deployment</h4>
            <button type="button" class="expand-btn" aria-label="Toggle GitHub Pages section">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="section-content">
            ${githubAccounts.length === 0 ? `
          <div class="no-accounts-message">
            <div class="message-icon">🔗</div>
            <h4>No GitHub Accounts Connected</h4>
            <p>To deploy your site to GitHub Pages, you'll need to connect a GitHub account first.</p>
            <div class="account-setup-info">
              <h5>What you'll need:</h5>
              <ul>
                <li>GitHub Personal Access Token (Fine-grained recommended)</li>
                <li>Repository access permissions</li>
                <li>GitHub Pages enabled on your account</li>
              </ul>
            </div>
            <button type="button" class="primary-btn" id="setup-github-btn">
              <span class="btn-icon">⚙️</span>
              Set Up GitHub Account
            </button>
          </div>
            ` : `
              <form id="github-deploy-form">
          <div class="form-group">
            <label for="github-account">GitHub Account</label>
            <select id="github-account" required>
              <option value="">Select GitHub account...</option>
              ${accountOptions}
            </select>
            <button type="button" id="add-github-account-btn" class="link-btn">+ Add Account</button>
          </div>
          
          <div id="security-info" class="security-panel" style="display: none;">
            <!-- Dynamic security information -->
          </div>
          
          <div class="form-group">
            <label for="repository-name">Repository Name</label>
            <input type="text" id="repository-name" placeholder="my-site" required>
            <small>Will create: <span id="repo-preview">username/my-site</span></small>
          </div>
          
          <div class="form-group">
            <label for="custom-domain">Custom Domain (Optional)</label>
            <input type="text" id="custom-domain" placeholder="example.com">
            <small>Leave empty to use GitHub Pages default domain</small>
          </div>
          
          <div class="deployment-options">
                  <h5>Deployment Options</h5>
            <div class="option-group">
              <label class="checkbox-label">
                <input type="checkbox" id="auto-create-repo" checked>
                <span class="checkmark"></span>
                Automatically create repository if it doesn't exist
              </label>
            </div>
            <div class="option-group">
              <label class="checkbox-label">
                <input type="checkbox" id="enable-custom-domain" disabled>
                <span class="checkmark"></span>
                Configure custom domain (requires domain ownership)
              </label>
            </div>
          </div>

          <div class="form-actions">
                  <button type="submit" class="primary-btn" id="github-deploy-btn">
              <span class="btn-icon">🚀</span>
              Deploy to GitHub Pages
            </button>
          </div>
        </form>
            `}
          </div>
        </div>

        <!-- Arweave Deployment Section -->
        <div class="collapsible-section" id="arweave-section">
          <div class="section-header" data-section="arweave">
            <h4>Arweave Deployment</h4>
            <button type="button" class="expand-btn" aria-label="Toggle Arweave section">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="section-content">
            <div class="wallet-status" id="arweave-wallet-status">
              <div class="wallet-status-loading">Checking wallet status...</div>
            </div>
            
            <form id="arweave-deploy-form">
              <div class="form-group">
                <label for="arweave-site-id">Site ID</label>
                <input type="text" id="arweave-site-id" placeholder="my-site-arweave" required>
                <small>Unique identifier for your Arweave deployment</small>
              </div>
              
              <div class="form-group">
                <label for="arweave-deployment-strategy">Deployment Strategy</label>
                <select id="arweave-deployment-strategy">
                  <option value="full">Full Deployment</option>
                  <option value="incremental">Incremental (if available)</option>
                </select>
                <small>Choose how to deploy your site</small>
              </div>

              <div class="cost-estimate" id="arweave-cost-estimate" style="display: none;">
                <h5>Estimated Cost</h5>
                <div class="cost-breakdown">
                  <div class="cost-item">
                    <span class="cost-label">Total Size:</span>
                    <span class="cost-value" id="arweave-total-size">Calculating...</span>
                  </div>
                  <div class="cost-item">
                    <span class="cost-label">AR Cost:</span>
                    <span class="cost-value" id="arweave-ar-cost">Calculating...</span>
                  </div>
                  <div class="cost-item">
                    <span class="cost-label">USD Cost:</span>
                    <span class="cost-value" id="arweave-usd-cost">Calculating...</span>
                  </div>
                </div>
              </div>

              <div class="form-actions">
                <button type="submit" class="primary-btn" id="arweave-deploy-btn">
                  <span class="btn-icon">🌐</span>
                  Deploy to Arweave
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Hybrid Deployment Section -->
        <div class="collapsible-section" id="hybrid-section">
          <div class="section-header" data-section="hybrid">
            <h4>Hybrid Deployment (Both Platforms)</h4>
            <button type="button" class="expand-btn" aria-label="Toggle Hybrid section">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="section-content">
            <div class="hybrid-info">
              <p>Deploy your site to both GitHub Pages and Arweave simultaneously for maximum reliability and permanence.</p>
              <div class="hybrid-benefits">
                <h5>Benefits:</h5>
                <ul>
                  <li><strong>GitHub Pages:</strong> Traditional hosting with Git integration and easy updates</li>
                  <li><strong>Arweave:</strong> Permanent decentralized storage that never goes down</li>
                  <li><strong>Redundancy:</strong> Your site is available even if one platform is unavailable</li>
                </ul>
              </div>
            </div>
            
            ${githubAccounts.length === 0 ? `
              <div class="no-accounts-message">
                <p>To use hybrid deployment, you'll need to connect a GitHub account first.</p>
                <button type="button" class="primary-btn" id="setup-github-hybrid-btn">
                  <span class="btn-icon">⚙️</span>
                  Set Up GitHub Account
                </button>
              </div>
            ` : `
              <form id="hybrid-deploy-form">
                <div class="form-group">
                  <label for="hybrid-site-id">Arweave Site ID</label>
                  <input type="text" id="hybrid-site-id" placeholder="my-site-hybrid" required>
                  <small>Unique identifier for your Arweave deployment</small>
                </div>
                
                <div class="form-group">
                  <label for="hybrid-github-account">GitHub Account</label>
                  <select id="hybrid-github-account" required>
                    <option value="">Select GitHub account...</option>
                    ${accountOptions}
                  </select>
                </div>
                
                <div class="form-group">
                  <label for="hybrid-repository-name">Repository Name</label>
                  <input type="text" id="hybrid-repository-name" placeholder="my-site" required>
                  <small>Will create: <span id="hybrid-repo-preview">username/my-site</span></small>
                </div>

                <div class="form-actions">
                  <button type="submit" class="primary-btn" id="hybrid-deploy-btn">
                    <span class="btn-icon">🔄</span>
                    Deploy to Both Platforms
                  </button>
                </div>
              </form>
            `}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Setup configuration form events
   */
  setupConfigurationFormEvents(isInitialized, currentSettings) {
    // Add form event handlers here
    const form = document.getElementById('site-configuration-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleConfigurationSubmit(isInitialized, currentSettings);
      });
    }

    // Collapsible sections are now handled globally in setupGlobalCollapsibleSections()
  }

  /**
   * Setup global collapsible sections functionality
   * This method sets up event delegation for all collapsible sections
   */
  setupGlobalCollapsibleSections() {
    // Use event delegation on the document to handle all collapsible sections
    // This ensures it works for dynamically created content and survives page refreshes
    
    // Handle section header clicks
    document.addEventListener('click', (e) => {
      const sectionHeader = e.target.closest('.collapsible-section .section-header');
      if (sectionHeader) {
        // Don't toggle if clicking on the expand button (it has its own handler)
        if (e.target.closest('.expand-btn')) {
          return;
        }
        
        const section = sectionHeader.closest('.collapsible-section');
        this.toggleSection(section);
      }
    });

    // Handle expand button clicks
    document.addEventListener('click', (e) => {
      const expandBtn = e.target.closest('.collapsible-section .expand-btn');
      if (expandBtn) {
        e.stopPropagation(); // Prevent header click
        const section = expandBtn.closest('.collapsible-section');
        this.toggleSection(section);
      }
    });

    // Load saved states after a short delay to ensure DOM is ready
    setTimeout(() => {
      this.loadSectionStates();
    }, 100);
  }

  /**
   * Setup collapsible sections functionality (legacy method - kept for compatibility)
   */
  setupCollapsibleSections() {
    // This method is now deprecated in favor of setupGlobalCollapsibleSections()
    // It's kept for backward compatibility but delegates to the global setup
    console.log('[DeployManager] setupCollapsibleSections() is deprecated, use setupGlobalCollapsibleSections()');
  }

  /**
   * Toggle a collapsible section
   */
  toggleSection(section) {
    if (!section || !section.id) {
      console.warn('[DeployManager] Cannot toggle section without ID:', section);
      return;
    }
    
    const isCollapsed = section.classList.contains('collapsed');
    const newState = !isCollapsed;
    
    if (newState) {
      section.classList.add('collapsed');
    } else {
      section.classList.remove('collapsed');
    }
    
    // Save state to localStorage
    this.saveSectionState(section.id, newState);
    
    console.log(`[DeployManager] Toggled section "${section.id}" to ${newState ? 'collapsed' : 'expanded'}`);
  }

  /**
   * Save section state to localStorage
   */
  saveSectionState(sectionId, isExpanded) {
    const sectionStates = JSON.parse(localStorage.getItem('deploySectionStates') || '{}');
    sectionStates[sectionId] = isExpanded;
    localStorage.setItem('deploySectionStates', JSON.stringify(sectionStates));
  }

  /**
   * Load section states from localStorage
   */
  loadSectionStates() {
    try {
      const sectionStates = JSON.parse(localStorage.getItem('deploySectionStates') || '{}');
      
      Object.entries(sectionStates).forEach(([sectionId, isExpanded]) => {
        const section = document.getElementById(sectionId);
        if (section) {
          if (!isExpanded) {
            section.classList.add('collapsed');
          } else {
            section.classList.remove('collapsed');
          }
        }
      });
      
      console.log('[DeployManager] Loaded section states:', Object.keys(sectionStates));
    } catch (error) {
      console.warn('[DeployManager] Failed to load section states:', error);
    }
  }

  /**
   * Setup build content events
   */
  setupBuildContentEvents() {
    // Build site button (creates preview by default)
    const buildSiteBtn = document.getElementById('build-site-btn');
    if (buildSiteBtn) {
      buildSiteBtn.addEventListener('click', async () => {
        await this.buildSiteWithPreview();
      });
    }

    // Collapsible sections are now handled globally in setupGlobalCollapsibleSections()
  }

  /**
   * Setup deployment form events
   */
  setupDeploymentFormEvents() {
    // Setup GitHub Pages deployment form
    const githubForm = document.getElementById('github-deploy-form');
    if (githubForm) {
      githubForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleGitHubDeploySubmit();
      });
    }

    // Setup Arweave deployment form
    const arweaveForm = document.getElementById('arweave-deploy-form');
    if (arweaveForm) {
      arweaveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleArweaveDeploySubmit();
      });
    }

    // Setup Hybrid deployment form
    const hybridForm = document.getElementById('hybrid-deploy-form');
    if (hybridForm) {
      hybridForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleHybridDeploySubmit();
      });
    }

    // Setup GitHub account setup buttons
    const setupGithubBtn = document.getElementById('setup-github-btn');
    if (setupGithubBtn) {
      setupGithubBtn.addEventListener('click', () => {
        this.app.closeModal();
        const accountManager = this.app.getModule('accountManager');
        if (accountManager) {
          accountManager.openGitHubAccountsModal();
        } else {
          console.error('AccountManager not available');
        }
      });
    }

    const setupGithubHybridBtn = document.getElementById('setup-github-hybrid-btn');
    if (setupGithubHybridBtn) {
      setupGithubHybridBtn.addEventListener('click', () => {
        this.app.closeModal();
        const accountManager = this.app.getModule('accountManager');
        if (accountManager) {
          accountManager.openGitHubAccountsModal();
        } else {
          console.error('AccountManager not available');
        }
      });
    }

    // Setup Arweave configuration events
    this.setupArweaveConfigEvents();
    
    // Setup GitHub account change events
    this.setupGitHubAccountEvents();
    
    // Check Arweave wallet status
    this.checkArweaveWalletStatus();
  }



  /**
   * Setup Arweave configuration events
   */
  setupArweaveConfigEvents() {
    const siteIdInput = document.getElementById('arweave-site-id');
    if (siteIdInput) {
      siteIdInput.addEventListener('input', () => {
        this.updateArweaveCostEstimate();
      });
    }

    const strategySelect = document.getElementById('arweave-deployment-strategy');
    if (strategySelect) {
      strategySelect.addEventListener('change', () => {
        this.updateArweaveCostEstimate();
      });
    }
  }

  /**
   * Setup GitHub account events
   */
  setupGitHubAccountEvents() {
    const githubAccount = document.getElementById('github-account');
    if (githubAccount) {
      githubAccount.addEventListener('change', async (e) => {
        await this.onDeploymentAccountChange(e.target.value);
      });
    }

    const hybridGithubAccount = document.getElementById('hybrid-github-account');
    if (hybridGithubAccount) {
      hybridGithubAccount.addEventListener('change', async (e) => {
        await this.onHybridDeploymentAccountChange(e.target.value);
      });
    }

    const repositoryName = document.getElementById('repository-name');
    if (repositoryName) {
      repositoryName.addEventListener('input', (e) => {
        this.updateRepositoryPreview();
      });
    }

    const hybridRepositoryName = document.getElementById('hybrid-repository-name');
    if (hybridRepositoryName) {
      hybridRepositoryName.addEventListener('input', (e) => {
        this.updateHybridRepositoryPreview();
      });
    }

    const addGithubAccountBtn = document.getElementById('add-github-account-btn');
    if (addGithubAccountBtn) {
      addGithubAccountBtn.addEventListener('click', () => {
        this.app.closeModal();
        const accountManager = this.app.getModule('accountManager');
        if (accountManager) {
          accountManager.openGitHubAccountsModal();
        } else {
          console.error('AccountManager not available');
        }
      });
    }
  }

  /**
   * Check and display Arweave wallet status
   */
  async checkArweaveWalletStatus() {
    const walletStatus = document.getElementById('arweave-wallet-status');
    if (!walletStatus) return;

    try {
      const isConfigured = await window.electronAPI.archive.isWalletConfigured();
      
      if (isConfigured) {
        // Get wallet info to show address
        const walletInfo = await window.electronAPI.archive.getWalletInfo();
        const activeAccount = await window.electronAPI.archive.getActiveAccount();
        
        let lastDeploymentHtml = '';
        if (this.lastArweaveDeployment) {
          const deploymentDate = new Date(this.lastArweaveDeployment.timestamp).toLocaleString();
          
          // Create file list HTML
          let filesHtml = '';
          if (this.lastArweaveDeployment.uploadedFiles && this.lastArweaveDeployment.uploadedFiles.length > 0) {
            filesHtml = `
              <div class="deployment-files">
                <div class="deployment-files-title">Uploaded Files (${this.lastArweaveDeployment.uploadedFiles.length}):</div>
                <div class="deployment-files-list">
                  ${this.lastArweaveDeployment.uploadedFiles.map(file => `
                    <div class="deployment-file-item">
                      <span class="file-path">${file.path}</span>
                      <span class="file-size">${this.formatFileSize(file.size)}</span>
                      <button type="button" class="link-btn small" onclick="window.electronAPI.openExternal('${file.url}')">
                        View
                      </button>
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }
          
          lastDeploymentHtml = `
            <div class="last-deployment-info">
              <div class="last-deployment-title">Last Deployment</div>
              <div class="last-deployment-details">
                <div>Date: ${deploymentDate}</div>
                <div>Cost: ${this.lastArweaveDeployment.cost} AR</div>
                <div>Files: ${this.lastArweaveDeployment.fileCount}</div>
                <div>Size: ${this.formatFileSize(this.lastArweaveDeployment.totalSize)}</div>
              </div>
              <div class="deployment-actions">
                <button type="button" class="link-btn" id="view-last-deployment-btn">
                  View Site
                </button>
                ${this.lastArweaveDeployment.indexFile ? `
                  <button type="button" class="link-btn secondary" id="view-index-file-btn">
                    View Index.html
                  </button>
                ` : ''}
                ${this.lastArweaveDeployment.manifestUrl ? `
                  <button type="button" class="link-btn secondary" id="view-manifest-btn">
                    View Manifest
                  </button>
                ` : ''}
              </div>
              ${filesHtml}
            </div>
          `;
        }
        
        walletStatus.innerHTML = `
          <div class="wallet-status-connected">
            <div class="wallet-status-icon">✅</div>
            <div class="wallet-status-info">
              <div class="wallet-status-title">Arweave Wallet Connected</div>
              <div class="wallet-status-details">
                ${activeAccount ? `Account: ${activeAccount.nickname} (${activeAccount.address})` : 'Wallet ready for deployment'}
              </div>
            </div>
          </div>
          ${lastDeploymentHtml}
        `;
        
        // Add event listeners for deployment action buttons
        const viewBtn = document.getElementById('view-last-deployment-btn');
        if (viewBtn) {
          viewBtn.addEventListener('click', () => {
            if (this.lastArweaveDeployment) {
              window.electronAPI.openExternal(this.lastArweaveDeployment.url);
            }
          });
        }
        
        const viewIndexBtn = document.getElementById('view-index-file-btn');
        if (viewIndexBtn && this.lastArweaveDeployment?.indexFile) {
          viewIndexBtn.addEventListener('click', () => {
            window.electronAPI.openExternal(this.lastArweaveDeployment.indexFile.url);
          });
        }
        
        const viewManifestBtn = document.getElementById('view-manifest-btn');
        if (viewManifestBtn && this.lastArweaveDeployment?.manifestUrl) {
          viewManifestBtn.addEventListener('click', () => {
            window.electronAPI.openExternal(this.lastArweaveDeployment.manifestUrl);
          });
        }
      } else {
        walletStatus.innerHTML = `
          <div class="wallet-status-disconnected">
            <div class="wallet-status-icon">⚠️</div>
            <div class="wallet-status-info">
              <div class="wallet-status-title">Arweave Wallet Required</div>
              <div class="wallet-status-details">You need to set up an Arweave wallet to deploy your site</div>
            </div>
            <button type="button" class="secondary-btn" id="setup-arweave-wallet-btn">
              Set Up Wallet
            </button>
          </div>
        `;
        
        // Add event listener for setup button
        const setupBtn = document.getElementById('setup-arweave-wallet-btn');
        if (setupBtn) {
          setupBtn.addEventListener('click', () => {
            this.app.closeModal();
            this.app.openArweaveAccountsModal();
          });
        }
      }
    } catch (error) {
      console.error('Failed to check Arweave wallet status:', error);
      walletStatus.innerHTML = `
        <div class="wallet-status-error">
          <div class="wallet-status-icon">❌</div>
          <div class="wallet-status-info">
            <div class="wallet-status-title">Error Checking Wallet</div>
            <div class="wallet-status-details">Unable to verify wallet status</div>
          </div>
        </div>
      `;
    }
  }

  /**
   * Update Arweave cost estimate
   */
  async updateArweaveCostEstimate() {
    const costEstimate = document.getElementById('arweave-cost-estimate');
    const totalSize = document.getElementById('arweave-total-size');
    const arCost = document.getElementById('arweave-ar-cost');
    const usdCost = document.getElementById('arweave-usd-cost');
    const siteIdInput = document.getElementById('arweave-site-id');

    if (!costEstimate || !totalSize || !arCost || !usdCost || !siteIdInput) {
      return;
    }

    const siteId = siteIdInput.value.trim();
    if (!siteId) {
      costEstimate.style.display = 'none';
      return;
    }

    try {
      // Show loading state
      costEstimate.style.display = 'block';
      totalSize.textContent = 'Calculating...';
      arCost.textContent = 'Calculating...';
      usdCost.textContent = 'Calculating...';

      // Call backend to estimate cost
      const estimate = await window.electronAPI.deploy.arweaveCostEstimate({
        workspacePath: this.getApp().workspacePath,
        siteId: siteId,
        costEstimate: true
      });

      // Update UI with cost estimate
      totalSize.textContent = this.formatFileSize(estimate.totalSize);
      arCost.textContent = `${estimate.arCost} AR`;
      usdCost.textContent = estimate.usdCost ? `~$${estimate.usdCost}` : 'N/A';

    } catch (error) {
      console.error('Failed to estimate Arweave cost:', error);
      costEstimate.style.display = 'none';
    }
  }

  /**
   * Load deployment data and render status
   */
  async loadDeployData() {
    try {
      // Check if workspace is connected
      if (!this.getApp().workspacePath) {
        this.renderDeployNoWorkspace();
        return;
      }
      this.getApp().data.deploy = await window.electronAPI.deploy.loadData();
      this.renderDeployStatus();
    } catch (error) {
      console.error('Failed to load deploy data:', error);
      this.getApp().showError('Failed to load deployment configuration');
    }
  }

  renderDeployNoWorkspace() {
    const container = document.getElementById('configure-tab');
    container.innerHTML = `
      <div class="no-workspace-state">
        <div class="no-workspace-icon">Deploy</div>
        <h3>No Workspace Selected</h3>
        <p>Select a workspace to deploy your digital garden.</p>
        <button class="primary-btn" id="deploy-select-workspace-btn">Select Workspace</button>
      </div>
    `;
    document.getElementById('deploy-select-workspace-btn').addEventListener('click', async () => {
      await this.getApp().selectWorkspace();
    });
  }

  async renderDeployStatus() {
    try {
      // Check if workspace is connected
      if (!this.app.workspacePath) {
        this.renderDeployNoWorkspace();
        return;
      }

      // Load initial content for all tabs
      await this.loadConfigureContent();
      this.loadBuildContent();
      await this.loadPublishContent();
    } catch (error) {
      console.error('Failed to render deploy status:', error);
      this.getApp().showError('Failed to load deployment status');
    }
  }

  async checkQuartzInitialized() {
    try {
      if (!this.app.workspacePath) {
        return false;
      }
      
      // Use the new backend API to check if Quartz is properly initialized
      return await window.electronAPI.deploy.checkInitialized(this.app.workspacePath);
    } catch (error) {
      console.error('Error checking Quartz initialization:', error);
      return false;
    }
  }

  /**
   * Update header button states based on Quartz initialization status
   */
  updateHeaderButtonStates(isQuartzInitialized) {
    const configureGroup = document.getElementById('configure-group');
    const buildGroup = document.getElementById('build-group');
    const publishGroup = document.getElementById('publish-group');
    
    const configureBtn = document.getElementById('configure-header-btn');
    const buildBtn = document.getElementById('build-header-btn');
    const publishBtn = document.getElementById('publish-header-btn');

    if (!configureGroup || !buildGroup || !publishGroup) {
      return; // Elements not found, likely not rendered yet
    }

    if (isQuartzInitialized) {
      // Configure phase completed
      configureGroup.classList.remove('active');
      configureGroup.classList.add('completed');
      
      // Build phase active
      buildGroup.classList.remove('disabled');
      buildGroup.classList.add('active');
      if (buildBtn) buildBtn.disabled = false;
      
      // Publish phase disabled until build completes
      publishGroup.classList.add('disabled');
      if (publishBtn) publishBtn.disabled = true;
    } else {
      // Configure phase active
      configureGroup.classList.remove('completed');
      configureGroup.classList.add('active');
      
      // Build and Publish phases disabled
      buildGroup.classList.remove('active');
      buildGroup.classList.add('disabled');
      if (buildBtn) buildBtn.disabled = true;
      
      publishGroup.classList.add('disabled');
      if (publishBtn) publishBtn.disabled = true;
    }
  }

  /**
   * Update header button states after successful build
   */
  updateBuildCompletionState() {
    const buildGroup = document.getElementById('build-group');
    const publishGroup = document.getElementById('publish-group');
    const publishBtn = document.getElementById('publish-header-btn');

    if (!buildGroup || !publishGroup) {
      return;
    }

    // Build phase completed
    buildGroup.classList.remove('active');
    buildGroup.classList.add('completed');
    
    // Publish phase active
    publishGroup.classList.remove('disabled');
    publishGroup.classList.add('active');
    if (publishBtn) publishBtn.disabled = false;
  }

  async initializeQuartzProject() {
    try {
      this.app.updateFooterStatus('Initializing Quartz project...', false);
      
      await window.electronAPI.deploy.initializeQuartz(this.app.workspacePath);
      
      this.app.showSuccess('Quartz project initialized successfully!');
      this.app.updateFooterStatus('Ready', false);
      
      // Refresh the deploy status
      await this.renderDeployStatus();
      
    } catch (error) {
      console.error('Failed to initialize Quartz project:', error);
      this.app.showError(`Failed to initialize project: ${error.message}`);
      this.app.updateFooterStatus('Ready', false);
    }
  }

  async openConfigurationModal() {
    try {
      // Check if site is already initialized
      const isInitialized = await this.checkQuartzInitialized();
      
      // Load existing site settings if available
      let currentSettings = {};
      try {
        currentSettings = await window.electronAPI.config.loadSiteSettings(this.app.workspacePath);
      } catch (error) {
        console.log('No existing site settings found, using defaults');
      }

      // Get default template for reference
      const defaultTemplate = await window.electronAPI.template.getDefault();
      const clinamenicTemplate = await window.electronAPI.template.getClinamenic();
      
      // Create unified configuration modal
      await this.createUnifiedConfigurationModal(isInitialized, currentSettings, defaultTemplate, clinamenicTemplate);
      
    } catch (error) {
      console.error('Failed to open configuration modal:', error);
      this.app.showError(`Failed to open configuration: ${error.message}`);
    }
  }

  async createUnifiedConfigurationModal(isInitialized, currentSettings, defaultTemplate, clinamenicTemplate) {
    try {
      const currentTemplate = currentSettings.quartz?.template || defaultTemplate;
      
      const modalHtml = `
          <div class="modal-header">
            <h3>${isInitialized ? 'Site Configuration' : 'Site Setup'}</h3>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-content">
            <form id="site-configuration-form">
                
                <!-- Initialization Section -->
                <div class="form-section ${!isInitialized ? 'highlight-section' : ''}">
                  <h4>Initialization ${!isInitialized ? '(Required)' : ''}</h4>
                  <div class="template-options">
                    <label class="radio-option">
                      <input type="radio" name="template" value="vanilla" ${currentTemplate.id === 'vanilla-quartz' ? 'checked' : ''}>
                      <div class="radio-content">
                        <strong>Vanilla Quartz</strong>
                        <p>Default Meridian-Quartz template with clean styling</p>
                      </div>
                    </label>
                    
                    <label class="radio-option">
                      <input type="radio" name="template" value="clinamenic" ${currentTemplate.id === 'clinamenic-quartz' ? 'checked' : ''}>
                      <div class="radio-content">
                        <strong>Clinamenic Quartz</strong>
                        <p>Enhanced Meridian-Quartz template with advanced features and optimizations</p>
                      </div>
                    </label>
                    
                    <label class="radio-option">
                      <input type="radio" name="template" value="custom" ${currentTemplate.id !== 'vanilla-quartz' && currentTemplate.id !== 'clinamenic-quartz' ? 'checked' : ''}>
                      <div class="radio-content">
                        <strong>Custom Template</strong>
                        <p>Use a custom Quartz template from a repository URL</p>
                      </div>
                    </label>
                  </div>
                  
                  <div class="custom-template-section" id="custom-template-section" style="display: ${currentTemplate.isDefault === false ? 'block' : 'none'};">
                    <label for="custom-template-url">Template Repository URL</label>
                    <input type="url" id="custom-template-url" placeholder="https://github.com/owner/repo or proland://username/repo" value="${currentTemplate.isDefault === false ? currentTemplate.url : ''}">
                    <div class="url-validation" id="url-validation"></div>
                    <small>Supports GitHub, Protocol.land (proland://), and generic Git repositories</small>
                  </div>
                  
                  ${isInitialized ? `
                    <div class="warning-notice">
                      <strong>⚠️ Template Change Warning</strong>
                      <p>Changing templates will reinitialize your site and erase any customizations made to the Quartz configuration.</p>
                    </div>
                  ` : ''}
                </div>
                
                <!-- Customization Section -->
                <div class="form-section">
                  <h4>Customization</h4>
                  
                  <!-- Site Information -->
                  <div class="form-subsection">
                    <h5>Site Information</h5>
                    <div class="form-group form-group-enhanced">
                      <div class="form-group-header">
                        <label for="site-title">Site Title</label>
                        <button class="form-help-btn" title="The main title displayed on your site and in browser tabs. This appears in search results and social media previews.">?</button>
                      </div>
                      <div class="form-group-control">
                        <input type="text" id="site-title" value="${this.escapeHtml(currentSettings.site?.title || 'My Digital Garden')}" maxlength="100" required>
                        <div class="character-count" id="title-char-count"></div>
                      </div>
                      <div class="form-group-help">
                        <small>The main title for your site (1-100 characters)</small>
                      </div>
                    </div>
                    
                    <div class="form-group form-group-enhanced">
                      <div class="form-group-header">
                        <label for="site-description">Site Description</label>
                        <button class="form-help-btn" title="A brief description of your site used in metadata and search engines. This helps people understand what your site is about.">?</button>
                      </div>
                      <div class="form-group-control">
                        <textarea id="site-description" placeholder="A brief description of your digital garden" maxlength="500">${this.escapeHtml(currentSettings.site?.description || '')}</textarea>
                        <div class="character-count" id="description-char-count"></div>
                      </div>
                      <div class="form-group-help">
                        <small>A brief description of your site (optional, max 500 characters)</small>
                      </div>
                    </div>
                    
                    <div class="form-group">
                      <label for="site-author">Author Name</label>
                      <input type="text" id="site-author" value="${this.escapeHtml(currentSettings.site?.author || '')}" placeholder="Your name" maxlength="100">
                      <small>Used in metadata and RSS feeds (optional, max 100 characters)</small>
                      <div class="character-count" id="author-char-count"></div>
                    </div>
                  </div>

                  <!-- Domain Configuration -->
                  <div class="form-subsection">
                    <h5>Domain Configuration</h5>
                    <div class="form-group form-group-enhanced">
                      <div class="form-group-header">
                        <label for="site-base-url">Base URL</label>
                        <button class="form-help-btn" title="The full URL where your site will be accessible. This is used for generating absolute links and social media previews. Include the protocol (https://).">?</button>
                      </div>
                      <div class="form-group-control">
                        <input type="url" id="site-base-url" value="${this.escapeHtml(currentSettings.site?.baseUrl || '')}" placeholder="https://yourdomain.com">
                        <div class="url-validation" id="base-url-validation" style="display: none;"></div>
                        <div class="domain-preview" id="domain-preview">
                          ${currentSettings.site?.baseUrl ? this.extractDomainFromUrl(currentSettings.site.baseUrl) : 'No domain specified'}
                        </div>
                      </div>
                      <div class="form-group-help">
                        <small>The full URL where your site will be accessible</small>
                      </div>
                    </div>
                    
                    <div class="form-group checkbox-group checkbox-group-enhanced">
                      <div class="form-group-header">
                        <label for="custom-cname">Generate CNAME file for custom domain</label>
                        <button class="form-help-btn" title="Automatically creates a CNAME file when a custom domain is detected. This is required for custom domains to work with GitHub Pages.">?</button>
                      </div>
                      <div class="form-group-control">
                        <input type="checkbox" id="custom-cname" ${currentSettings.deployment?.customCNAME ? 'checked' : ''}>
                        <label for="custom-cname" class="checkbox-label">Generate CNAME file for custom domain</label>
                      </div>
                      <div class="form-group-help">
                        <small>Automatically creates a CNAME file when a custom domain is detected</small>
                      </div>
                    </div>
                  </div>

                  <!-- Display Preferences -->
                  <div class="form-subsection">
                    <h5>Display Preferences</h5>
                    <div class="form-group">
                      <label>Theme Mode</label>
                      <div class="theme-mode-options">
                        <div class="theme-mode-option">
                          <input type="radio" id="theme-auto" name="theme-mode" value="auto" ${(currentSettings.quartz?.theme?.mode || 'auto') === 'auto' ? 'checked' : ''}>
                          <label for="theme-auto">Auto</label>
                        </div>
                        <div class="theme-mode-option">
                          <input type="radio" id="theme-light" name="theme-mode" value="light" ${currentSettings.quartz?.theme?.mode === 'light' ? 'checked' : ''}>
                          <label for="theme-light">Light</label>
                        </div>
                        <div class="theme-mode-option">
                          <input type="radio" id="theme-dark" name="theme-mode" value="dark" ${currentSettings.quartz?.theme?.mode === 'dark' ? 'checked' : ''}>
                          <label for="theme-dark">Dark</label>
                        </div>
                      </div>
                      <small>Choose how the theme adapts to user preferences</small>
                    </div>
                    
                    <div class="form-group checkbox-group checkbox-group-enhanced">
                      <div class="form-group-header">
                        <label for="enable-spa">Enable Single Page Application</label>
                        <button class="form-help-btn" title="Enables client-side routing for faster navigation between pages without full page reloads. This provides a smoother user experience but may not work with all hosting providers.">?</button>
                      </div>
                      <div class="form-group-control">
                        <input type="checkbox" id="enable-spa" ${currentSettings.quartz?.enableSPA !== false ? 'checked' : ''}>
                        <label for="enable-spa" class="checkbox-label">Enable Single Page Application</label>
                      </div>
                      <div class="form-group-help">
                        <small>Faster navigation between pages (recommended)</small>
                      </div>
                    </div>
                    
                    <div class="form-group checkbox-group checkbox-group-enhanced">
                      <div class="form-group-header">
                        <label for="enable-popovers">Enable Link Popovers</label>
                        <button class="form-help-btn" title="Shows preview popups when hovering over internal links to other pages in your site. This helps users navigate your content more easily.">?</button>
                      </div>
                      <div class="form-group-control">
                        <input type="checkbox" id="enable-popovers" ${currentSettings.quartz?.enablePopovers !== false ? 'checked' : ''}>
                        <label for="enable-popovers" class="checkbox-label">Enable Link Popovers</label>
                      </div>
                      <div class="form-group-help">
                        <small>Show preview popups when hovering over internal links</small>
                      </div>
                    </div>
                  </div>

                  <!-- Ignore Files Section -->
                  <div class="form-subsection">
                    <h5>Ignore Files</h5>
                    <div class="form-group">
                      <label for="ignore-patterns">Custom Ignore Patterns</label>
                      <textarea id="ignore-patterns" placeholder="drafts/**&#10;private/**&#10;*.tmp" rows="4">${currentSettings.site?.ignorePatterns?.custom?.join('\n') || ''}</textarea>
                      <small>File patterns to exclude from build (one per line). Uses glob syntax: *, **, etc.</small>
                    </div>
                    
                    <div class="form-group checkbox-group checkbox-group-enhanced">
                      <div class="form-group-header">
                        <label for="enable-ignore-patterns">Enable custom ignore patterns</label>
                        <button class="form-help-btn" title="Apply the custom patterns above to exclude files from your site build. This is useful for excluding drafts, private files, or temporary files from your published site.">?</button>
                      </div>
                      <div class="form-group-control">
                        <input type="checkbox" id="enable-ignore-patterns" ${currentSettings.site?.ignorePatterns?.enabled !== false ? 'checked' : ''}>
                        <label for="enable-ignore-patterns" class="checkbox-label">Enable custom ignore patterns</label>
                      </div>
                      <div class="form-group-help">
                        <small>Apply the custom patterns above to exclude files from your site</small>
                      </div>
                    </div>
                    
                    <div class="ignore-patterns-help">
                      <details>
                        <summary>Pattern Examples</summary>
                        <div class="help-content">
                          <ul>
                            <li><code>drafts/**</code> - Exclude entire drafts directory</li>
                            <li><code>*.tmp</code> - Exclude all .tmp files</li>
                            <li><code>private-notes/**</code> - Exclude private-notes folder</li>
                            <li><code>**/WIP/**</code> - Exclude any WIP folders</li>
                            <li><code>secret.md</code> - Exclude specific file</li>
                          </ul>
                        </div>
                      </details>
                    </div>
                    
                    <div class="ignore-preview" id="ignore-preview" style="display: none;">
                      <h6>Preview Impact</h6>
                      <div class="preview-stats">
                        <span class="preview-included">Files included: <strong id="preview-included-count">-</strong></span>
                        <span class="preview-excluded">Files excluded: <strong id="preview-excluded-count">-</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
                
              </form>
            </div>
          <div class="modal-footer">
            <div class="footer-left">
              <button type="button" class="secondary-btn" id="reset-defaults-btn">Reset to Defaults</button>
            </div>
            <div class="footer-right">
              <button type="button" class="secondary-btn modal-cancel">Cancel</button>
              <button type="submit" form="site-configuration-form" class="primary-btn">
                ${isInitialized ? 'Apply Changes' : 'Initialize Site'}
              </button>
            </div>
          </div>
      `;
      
      // Use ModalManager properly
      const modalManager = this.app.getModalManager();
      if (!modalManager) {
        console.error('ModalManager not available');
        return;
      }

      // Create the dynamic modal
      const modal = modalManager.createDynamicModal('site-configuration-modal', modalHtml);
      
      // Add the appropriate CSS class for styling
      if (modal) {
        modal.classList.add('site-configuration-modal');
      }
      
      // Open the modal using ModalManager
      await modalManager.openModal('site-configuration-modal');
      
      // Setup modal-specific events with a small delay to ensure DOM is ready
      setTimeout(() => {
        this.setupConfigurationModalEvents(isInitialized, currentSettings);
      }, 50);
      
    } catch (error) {
      console.error('Failed to create configuration modal:', error);
      throw error;
    }
  }

  setupConfigurationModalEvents(isInitialized, currentSettings) {
    console.log('[DeployManager] Setting up configuration modal events...');
    
    // Template radio button handling
    const templateRadios = document.querySelectorAll('input[name="template"]');
    const customTemplateSection = document.getElementById('custom-template-section');
    const customTemplateUrl = document.getElementById('custom-template-url');
    
    templateRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
          customTemplateSection.style.display = 'block';
        } else {
          customTemplateSection.style.display = 'none';
        }
      });
    });
    
    // URL validation for custom template
    let templateValidationTimeout;
    customTemplateUrl.addEventListener('input', (e) => {
      clearTimeout(templateValidationTimeout);
      const url = e.target.value.trim();
      const validationDiv = document.getElementById('url-validation');
      
      if (!url) {
        validationDiv.innerHTML = '';
        return;
      }
      
      validationDiv.innerHTML = '<div class="validation-loading">Validating URL...</div>';
      
      templateValidationTimeout = setTimeout(async () => {
        try {
          const validation = await window.electronAPI.template.validateCustomUrl(url);
          
          if (validation.isValid) {
            validationDiv.innerHTML = `
              <div class="validation-success">
                ✅ Valid ${validation.detectedType} repository
                ${validation.repoInfo?.owner && validation.repoInfo?.repo ? 
                  `<br><small>${validation.repoInfo.owner}/${validation.repoInfo.repo}</small>` : ''}
              </div>
            `;
          } else {
            validationDiv.innerHTML = `
              <div class="validation-error">
                ❌ ${validation.error}
              </div>
            `;
          }
        } catch (error) {
          validationDiv.innerHTML = `
            <div class="validation-error">
              ❌ Validation failed: ${error.message}
            </div>
          `;
        }
      }, 500);
    });
    
    // Base URL validation and domain preview
    const baseUrlInput = document.getElementById('site-base-url');
    let baseUrlValidationTimeout;
    
    baseUrlInput.addEventListener('input', (e) => {
      clearTimeout(baseUrlValidationTimeout);
      const url = e.target.value.trim();
      
      this.updateDomainPreview();
      
      if (!url) {
        document.getElementById('base-url-validation').style.display = 'none';
        return;
      }
      
      baseUrlValidationTimeout = setTimeout(() => {
        this.validateBaseUrl();
      }, 500);
    });
    
    // Character count updates
    const titleInput = document.getElementById('site-title');
    const descriptionInput = document.getElementById('site-description');
    const authorInput = document.getElementById('site-author');

    titleInput.addEventListener('input', () => this.updateCharacterCounts());
    descriptionInput.addEventListener('input', () => this.updateCharacterCounts());
    authorInput.addEventListener('input', () => this.updateCharacterCounts());
    
    // Initialize character counts
    this.updateCharacterCounts();

    // Custom CNAME checkbox
    const customCnameCheckbox = document.getElementById('custom-cname');
    
    customCnameCheckbox.addEventListener('change', () => {
      this.updateDomainPreview();
    });
    
    // Ignore patterns functionality
    const ignorePatternsTextarea = document.getElementById('ignore-patterns');
    const enableIgnorePatternsCheckbox = document.getElementById('enable-ignore-patterns');

    // Preview ignore patterns impact
    ignorePatternsTextarea.addEventListener('input', () => {
      this.previewIgnorePatterns();
    });

    enableIgnorePatternsCheckbox.addEventListener('change', () => {
      this.previewIgnorePatterns();
    });
    
    // Reset to defaults button
    const resetDefaultsBtn = document.getElementById('reset-defaults-btn');
    if (resetDefaultsBtn) {
      resetDefaultsBtn.addEventListener('click', () => {
        this.resetConfigurationToDefaults();
      });
    }
    
    // Form submission
    const configForm = document.getElementById('site-configuration-form');
    if (configForm) {
      configForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleConfigurationSubmit(isInitialized, currentSettings);
      });
    }
    
    // Modal close handlers - be more specific to avoid conflicts
    const modalCloseBtn = document.querySelector('#site-configuration-modal .modal-close');
    const modalCancelBtn = document.querySelector('#site-configuration-modal .modal-cancel');
    
    console.log('[DeployManager] Modal close button found:', !!modalCloseBtn);
    console.log('[DeployManager] Modal cancel button found:', !!modalCancelBtn);
    
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', (e) => {
        console.log('[DeployManager] Modal close button clicked');
        e.preventDefault();
        e.stopPropagation();
        const modalManager = this.app.getModalManager();
        if (modalManager) {
          modalManager.closeModal('site-configuration-modal');
        }
      });
    } else {
      console.error('[DeployManager] Modal close button not found!');
    }
    
    if (modalCancelBtn) {
      modalCancelBtn.addEventListener('click', (e) => {
        console.log('[DeployManager] Modal cancel button clicked');
        e.preventDefault();
        e.stopPropagation();
        const modalManager = this.app.getModalManager();
        if (modalManager) {
          modalManager.closeModal('site-configuration-modal');
        }
      });
    } else {
      console.error('[DeployManager] Modal cancel button not found!');
    }
  }

  async handleConfigurationSubmit(isInitialized, currentSettings) {
    try {
      console.log('[DeployManager] Handling configuration submit...');
      this.app.updateFooterStatus('Saving configuration...', false);
      
      // Get form data
      const formData = this.collectConfigurationData();
      console.log('[DeployManager] Form data collected:', formData);
      
      // Determine if template changed (destructive change)
      const currentTemplate = currentSettings.quartz?.template;
      const selectedTemplate = formData.template;
      const templateChanged = this.hasTemplateChanged(currentTemplate, selectedTemplate);
      
      console.log('[DeployManager] isInitialized:', isInitialized, 'templateChanged:', templateChanged);
      
      if (isInitialized && templateChanged) {
        console.log('[DeployManager] Taking reinitialize path');
        // Show reinitialization warning
        const confirmed = await this.showReinitializationWarning();
        if (!confirmed) {
          this.app.updateFooterStatus('Ready', false);
          return;
        }
        
        // Reinitialize with new template
        await this.reinitializeWithTemplate(formData);
      } else if (!isInitialized) {
        console.log('[DeployManager] Taking initialization path');
        // First-time initialization
        await this.initializeWithConfiguration(formData);
      } else {
        console.log('[DeployManager] Taking safe configuration changes path');
        // Safe configuration changes only
        await this.applySafeConfigurationChanges(formData);
      }
      
      // Refresh the configuration content to show updated state
      await this.loadConfigureContent();
      this.app.updateFooterStatus('Ready', false);
      this.app.showSuccess('Configuration updated successfully!');
      
      // Update header button states after configuration changes
      const isQuartzInitialized = await this.checkQuartzInitialized();
      this.updateHeaderButtonStates(isQuartzInitialized);
      
    } catch (error) {
      console.error('Failed to save configuration:', error);
      this.app.showError(`Configuration failed: ${error.message}`);
      this.app.updateFooterStatus('Ready', false);
    }
  }

  collectConfigurationData() {
    console.log('[DeployManager] Collecting configuration data...');
    
    // Get the selected template type
    const templateRadio = document.querySelector('input[name="template"]:checked');
    if (!templateRadio) {
      console.error('[DeployManager] No template radio button found');
      throw new Error('No template option selected');
    }
    
    const templateType = templateRadio.value;
    let template;
    
    if (templateType === 'vanilla') {
      // For vanilla template, send a default template object
      template = {
        id: 'vanilla-quartz',
        name: 'Vanilla Quartz',
        type: 'github',
        url: 'https://github.com/Clinamenic/meridian-quartz.git',
        branch: 'meridian-main',
        description: 'Default Meridian-Quartz template',
        isDefault: true,
      };
    } else if (templateType === 'clinamenic') {
      // For Clinamenic template, send the Clinamenic template object
      template = {
        id: 'clinamenic-quartz',
        name: 'Clinamenic Quartz',
        type: 'github',
        url: 'https://github.com/Clinamenic/meridian-quartz-clinamenic.git',
        branch: 'meridian-main',
        description: 'Clinamenic-optimized Meridian-Quartz template with enhanced features',
        isDefault: false,
      };
    } else {
      // Custom template
      const customUrlElement = document.getElementById('custom-template-url');
      if (!customUrlElement) {
        throw new Error('Custom template URL field not found');
      }
      const customUrl = customUrlElement.value.trim();
      if (!customUrl) {
        throw new Error('Custom template URL is required when using custom template');
      }
      template = { isCustom: true, url: customUrl };
    }
    
    // Collect ignore patterns - using the correct element ID from the form
    const ignorePatternsElement = document.getElementById('custom-ignore-patterns');
    if (!ignorePatternsElement) {
      throw new Error('Ignore patterns field not found');
    }
    
    const ignorePatternsValue = ignorePatternsElement.value;
    const customPatterns = ignorePatternsValue
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    // Get site settings - using the correct element IDs from the form
    const siteTitleElement = document.getElementById('site-title');
    const siteDescriptionElement = document.getElementById('site-description');
    const baseUrlElement = document.getElementById('base-url');
    
    if (!siteTitleElement || !siteDescriptionElement || !baseUrlElement) {
      throw new Error('Required site settings fields not found');
    }
    
    return {
      template,
      site: {
        title: siteTitleElement.value.trim(),
        description: siteDescriptionElement.value.trim(),
        author: '', // Not in current form
        baseUrl: baseUrlElement.value.trim(),
        ignorePatterns: {
          custom: customPatterns,
          enabled: true, // Always enabled in current form
        },
      },
      quartz: {
        enableSPA: true, // Default values since not in current form
        enablePopovers: true,
        theme: {
          mode: 'light', // Default value
        },
      },
      deployment: {
        customCNAME: false, // Default value since not in current form
      },
    };
  }

  hasTemplateChanged(currentTemplate, selectedTemplate) {
    // Handle undefined/null cases
    if (!currentTemplate && !selectedTemplate) return false;
    if (!currentTemplate && selectedTemplate) return true;
    if (currentTemplate && !selectedTemplate) return true;
    
    // If current template is default and selected is default, no change
    if (currentTemplate?.isDefault && selectedTemplate?.isDefault) return false;
    
    // If current template is Clinamenic and selected is Clinamenic, no change
    if (currentTemplate?.id === 'clinamenic-quartz' && selectedTemplate?.id === 'clinamenic-quartz') return false;
    
    // If current template is default but selected is Clinamenic, it's a change
    if (currentTemplate?.isDefault && selectedTemplate?.id === 'clinamenic-quartz') return true;
    
    // If current template is Clinamenic but selected is default, it's a change
    if (currentTemplate?.id === 'clinamenic-quartz' && selectedTemplate?.isDefault) return true;
    
    // If current template is not default/Clinamenic but selected is default/Clinamenic, it's a change
    if (!currentTemplate?.isDefault && currentTemplate?.id !== 'clinamenic-quartz' && 
        (selectedTemplate?.isDefault || selectedTemplate?.id === 'clinamenic-quartz')) return true;
    
    // If selected template is custom, compare URLs
    if (selectedTemplate?.isCustom) {
      return !currentTemplate?.isDefault && currentTemplate?.id !== 'clinamenic-quartz' || currentTemplate.url !== selectedTemplate.url;
    }
    
    return true;
  }

  async showReinitializationWarning() {
    return new Promise((resolve) => {
      const confirmed = confirm(
        'Changing the template will reinitialize your site and erase any customizations made to the Quartz configuration.\n\nAre you sure you want to continue?'
      );
      resolve(confirmed);
    });
  }

  async initializeWithConfiguration(configData) {
    let template = undefined;
    
    if (configData.template?.isCustom) {
      // Parse custom template URL
      template = await window.electronAPI.template.parseUrl(configData.template.url);
    } else if (configData.template?.isDefault || configData.template?.id === 'clinamenic-quartz') {
      // Use the template object directly for both default and Clinamenic templates
      template = configData.template;
    }
    
    // Initialize Quartz with selected template
    await window.electronAPI.deploy.initializeQuartz(this.app.workspacePath, template);
    
    // Save additional site settings
    await this.saveSiteSettings(configData);
  }

  async reinitializeWithTemplate(configData) {
    let template = undefined;
    
    if (configData.template?.isCustom) {
      // Parse custom template URL
      template = await window.electronAPI.template.parseUrl(configData.template.url);
    } else if (configData.template?.isDefault || configData.template?.id === 'clinamenic-quartz') {
      // Use the template object directly for both default and Clinamenic templates
      template = configData.template;
    }
    
    // Reinitialize with new template
    await window.electronAPI.deploy.initializeQuartz(this.app.workspacePath, template);
    
    // Save additional site settings
    await this.saveSiteSettings(configData);
  }

  async applySafeConfigurationChanges(configData) {
    try {
      console.log('[DeployManager] applySafeConfigurationChanges called');
      // Save settings that don't require reinitialization
      await this.saveSiteSettings(configData);
      
      // Handle GitHub Pages workflow changes
      console.log('[DeployManager] About to call handleGitHubPagesWorkflowChanges');
      await this.handleGitHubPagesWorkflowChanges();
      console.log('[DeployManager] handleGitHubPagesWorkflowChanges completed');
    } catch (error) {
      console.error('[DeployManager] Error in applySafeConfigurationChanges:', error);
      throw error;
    }
  }

  /**
   * Check if GitHub workflow file exists
   */
  async checkWorkflowFileExists() {
    try {
      const result = await window.electronAPI.deploy.checkWorkflowFileExists();
      return result.exists;
    } catch (error) {
      console.error('[DeployManager] Error checking workflow file existence:', error);
      return false;
    }
  }

  /**
   * Handle GitHub Pages workflow changes based on current toggle state
   */
  async handleGitHubPagesWorkflowChanges() {
    try {
      console.log('[DeployManager] handleGitHubPagesWorkflowChanges called');
      const toggle = document.getElementById('github-pages-enabled');
      if (!toggle) {
        console.log('[DeployManager] GitHub Pages toggle not found');
        return;
      }

      const enabled = toggle.checked;
      console.log('[DeployManager] Toggle state:', enabled);
      const currentSettings = await window.electronAPI.config.loadSiteSettings(this.app.workspacePath);
      const wasEnabled = currentSettings.deployment?.githubPages || false;
      console.log('[DeployManager] Previous state:', wasEnabled);

      // Check if workflow file actually exists
      const workflowExists = await this.checkWorkflowFileExists();
      console.log('[DeployManager] Workflow file exists:', workflowExists);

      // Make changes if:
      // 1. Toggle state changed, OR
      // 2. Toggle is enabled but workflow doesn't exist, OR  
      // 3. Toggle is disabled but workflow exists
      const shouldCreateWorkflow = enabled && !workflowExists;
      const shouldRemoveWorkflow = !enabled && workflowExists;
      const stateChanged = enabled !== wasEnabled;

      if (stateChanged || shouldCreateWorkflow || shouldRemoveWorkflow) {
        console.log('[DeployManager] State changed, processing workflow changes...');
        if (enabled) {
          // Generate GitHub Actions workflow
          this.app.updateFooterStatus('Generating GitHub Actions workflow...', false);
          const result = await window.electronAPI.deploy.generateGitHubWorkflow();
          
          if (result.success) {
            this.app.showSuccess('GitHub Actions workflow created successfully!');
          } else {
            this.app.showError(`Failed to create GitHub Actions workflow: ${result.error}`);
            // Revert the toggle if it failed
            toggle.checked = false;
            return;
          }
        } else {
          // Remove GitHub Actions workflow
          this.app.updateFooterStatus('Removing GitHub Actions workflow...', false);
          const result = await window.electronAPI.deploy.removeGitHubWorkflow();
          
          if (result.success) {
            this.app.showSuccess('GitHub Actions workflow removed successfully!');
          } else {
            this.app.showError(`Failed to remove GitHub Actions workflow: ${result.error}`);
            // Revert the toggle if it failed
            toggle.checked = true;
            return;
          }
        }
      }
    } catch (error) {
      console.error('[DeployManager] Failed to handle GitHub Pages workflow changes:', error);
      this.app.showError(`Failed to update GitHub Pages settings: ${error.message}`);
      throw error; // Re-throw to be caught by parent method
    } finally {
      this.app.updateFooterStatus('Ready', true);
    }
  }

  async saveSiteSettings(configData) {
    try {
      // Prepare settings object
      const settings = {
        version: '1.0.0',
        lastModified: new Date().toISOString(),
        site: {
          title: configData.site.title || 'My Digital Garden',
          description: configData.site.description || '',
          author: configData.site.author || '',
          baseUrl: configData.site.baseUrl || '',
          ignorePatterns: configData.site.ignorePatterns || {
            custom: [],
            enabled: false,
          },
        },
        quartz: {
          enableSPA: configData.quartz.enableSPA,
          enablePopovers: configData.quartz.enablePopovers,
          theme: configData.quartz.theme,
          template: configData.template,
        },
        deployment: {
          branch: 'main',
          customCNAME: configData.deployment.customCNAME,
          githubPages: document.getElementById('github-pages-enabled')?.checked || false,
        },
        metadata: {
          createdAt: new Date().toISOString(),
          workspacePath: this.app.workspacePath,
          initialized: true,
        },
      };
      
      // Save to backend
      await window.electronAPI.config.saveSiteSettings(this.app.workspacePath, settings);
      
      console.log('Site settings saved successfully');
    } catch (error) {
      console.error('Failed to save site settings:', error);
      // Don't throw - this is not always critical
    }
  }

  async buildSite() {
    try {
      this.app.updateFooterStatus('Building site...', false);
      
      const buildResult = await window.electronAPI.deploy.buildSite({
        workspacePath: this.app.workspacePath
      });
      
      if (buildResult.status === 'success') {
        this.app.showSuccess(`Site built successfully! Processed ${buildResult.filesProcessed} files in ${buildResult.duration}ms`);
      } else {
        this.app.showError(`Build failed: ${buildResult.errors?.join(', ') || 'Unknown error'}`);
      }
      
      this.app.updateFooterStatus('Ready', false);
      
    } catch (error) {
      console.error('Failed to build site:', error);
      this.app.showError(`Build failed: ${error.message}`);
      this.app.updateFooterStatus('Ready', false);
    }
  }

  async buildSiteWithLogs() {
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
        this.app.showSuccess(`Site built successfully!`);
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
        
        // Update header button states to show build completion
        this.updateBuildCompletionState();
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

  async previewSiteIntegrated() {
    try {
      this.app.updateFooterStatus('Starting preview server...', false);
      
      const previewUrl = await window.electronAPI.deploy.previewSite({
        workspacePath: this.app.workspacePath
      });
      
      // Show preview section and load the site
      this.showPreviewSection(previewUrl);
      
      this.app.showSuccess(`Preview server started at ${previewUrl}`);
      
    } catch (error) {
      console.error('Failed to start preview:', error);
      this.app.showError(`Preview failed: ${error.message}`);
      this.app.updateFooterStatus('Ready', false);
    }
  }

  showBuildLogs() {
    const buildLogsSection = document.getElementById('build-logs-section');
    if (buildLogsSection) {
      buildLogsSection.style.display = 'block';
      buildLogsSection.classList.remove('collapsed'); // Ensure it starts expanded
    }
  }

  appendBuildLog(message) {
    const buildLogsOutput = document.getElementById('build-logs-output');
    if (buildLogsOutput) {
      const timestamp = new Date().toLocaleTimeString();
      buildLogsOutput.textContent += `[${timestamp}] ${message}\n`;
      buildLogsOutput.scrollTop = buildLogsOutput.scrollHeight;
    }
  }

  showPreviewSection(previewUrl) {
    const previewStatus = document.getElementById('preview-status');
    const openExternalBtn = document.getElementById('open-external-btn');
    
    if (previewStatus && openExternalBtn) {
      previewStatus.textContent = `Server: Running at ${previewUrl}`;
      openExternalBtn.disabled = false;
    }
  }

  setupPreviewControls() {
    // Open external button
    const openExternalBtn = document.getElementById('open-external-btn');
    if (openExternalBtn) {
      openExternalBtn.addEventListener('click', () => {
        const previewStatus = document.getElementById('preview-status');
        if (previewStatus && previewStatus.textContent.includes('http://')) {
          // Extract URL from the status text
          const urlMatch = previewStatus.textContent.match(/http:\/\/[^\s]+/);
          if (urlMatch) {
            window.electronAPI.openExternal(urlMatch[0]);
          }
        }
      });
    }
  }

  async previewSite() {
    try {
      this.app.updateFooterStatus('Starting preview server...', false);
      
      const previewUrl = await window.electronAPI.deploy.previewSite({
        workspacePath: this.app.workspacePath
      });
      
      // Show preview section and load the site
      this.showPreviewSection(previewUrl);
      
      this.app.showSuccess(`Preview server started at ${previewUrl}`);
      
    } catch (error) {
      console.error('Failed to start preview:', error);
      this.app.showError(`Preview failed: ${error.message}`);
      this.app.updateFooterStatus('Ready', false);
    }
  }

  async deploySite() {
    try {
      // Open deployment configuration modal
      this.openDeploymentModal();
      
    } catch (error) {
      console.error('Failed to open deployment modal:', error);
      this.app.showError(`Deployment setup failed: ${error.message}`);
    }
  }

  async openDeploymentModal() {
    try {
      // Load GitHub accounts first
      const githubAccounts = await window.electronAPI.deploy.githubAccounts();
      
      if (githubAccounts.length === 0) {
        // No GitHub accounts - show setup message
        const modalContent = `
          <div class="modal-header">
            <h3>Deploy to GitHub Pages</h3>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-content">
            <div class="modal-body">
              <div class="no-accounts-message">
                <div class="message-icon">🔗</div>
                <h4>No GitHub Accounts Connected</h4>
                <p>To deploy your site to GitHub Pages, you'll need to connect a GitHub account first.</p>
                <div class="account-setup-info">
                  <h5>What you'll need:</h5>
                  <ul>
                    <li>GitHub Personal Access Token (Fine-grained recommended)</li>
                    <li>Repository access permissions</li>
                    <li>GitHub Pages enabled on your account</li>
                  </ul>
                </div>
                <button type="button" class="primary-btn" id="setup-github-btn">
                  <span class="btn-icon">⚙️</span>
                  Set Up GitHub Account
                </button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="secondary-btn modal-cancel">Cancel</button>
          </div>
        `;
        
        // Use ModalManager to create and open the modal
        const modalManager = this.getModalManager();
        modalManager.createDynamicModal('deploy-modal', modalContent);
        modalManager.openModal('deploy-modal');
        
        // Setup GitHub account button
        document.getElementById('setup-github-btn').addEventListener('click', () => {
          this.app.closeModal();
          const accountManager = this.app.getModule('accountManager');
          if (accountManager) {
            accountManager.openGitHubAccountsModal();
          } else {
            console.error('AccountManager not available');
          }
        });
        
        return;
      }
      
      // Create deployment modal with GitHub account selection
      const accountOptions = githubAccounts.map(account => 
        `<option value="${account.id}" data-username="${account.username}" data-token-type="${account.tokenType}">
          ${account.nickname} (@${account.username}) ${account.tokenType === 'classic' ? '⚠️' : '🔒'}
        </option>`
      ).join('');
      
      const modalContent = `
        <div class="modal-header">
          <h3>Deploy to GitHub Pages</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-content">
          <div class="modal-body">
            <form id="deploy-config-form">
              <div class="form-group">
                <label for="github-account">GitHub Account</label>
                <select id="github-account" required>
                  <option value="">Select GitHub account...</option>
                  ${accountOptions}
                </select>
                <button type="button" id="add-github-account-btn" class="link-btn">+ Add Account</button>
              </div>
              
              <div id="security-info" class="security-panel" style="display: none;">
                <!-- Dynamic security information -->
              </div>
              
              <div class="form-group">
                <label for="repository-name">Repository Name</label>
                <input type="text" id="repository-name" placeholder="my-site" required>
                <small>Will create: <span id="repo-preview">username/my-site</span></small>
              </div>
              
              <div class="form-group">
                <label for="custom-domain">Custom Domain (Optional)</label>
                <input type="text" id="custom-domain" placeholder="example.com">
                <small>Leave empty to use GitHub Pages default domain</small>
              </div>
              
              <div class="deployment-options">
                <h4>Deployment Options</h4>
                <div class="option-group">
                  <label class="checkbox-label">
                    <input type="checkbox" id="auto-create-repo" checked>
                    <span class="checkmark"></span>
                    Automatically create repository if it doesn't exist
                  </label>
                </div>
                <div class="option-group">
                  <label class="checkbox-label">
                    <input type="checkbox" id="enable-custom-domain" disabled>
                    <span class="checkmark"></span>
                    Configure custom domain (requires domain ownership)
                  </label>
                </div>
              </div>
            </form>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="secondary-btn modal-cancel">Cancel</button>
          <button type="submit" form="deploy-config-form" class="primary-btn">
            <span class="btn-icon">🚀</span>
            Deploy to GitHub Pages
          </button>
        </div>
      `;
      
      // Use ModalManager to create and open the modal
      const modalManager = this.getModalManager();
      modalManager.createDynamicModal('deploy-modal', modalContent);
      modalManager.openModal('deploy-modal');
      
      // Setup event listeners
      this.setupDeploymentModalEvents();
      
    } catch (error) {
      console.error('Failed to open deployment modal:', error);
      this.app.showError(`Failed to open deployment modal: ${error.message}`);
    }
  }

  setupDeploymentModalEvents() {
    // GitHub account selection
    document.getElementById('github-account').addEventListener('change', async (e) => {
      await this.onDeploymentAccountChange(e.target.value);
    });
    
    // Repository name preview
    document.getElementById('repository-name').addEventListener('input', (e) => {
      this.updateRepositoryPreview();
    });
    
    // Custom domain checkbox
    document.getElementById('custom-domain').addEventListener('input', (e) => {
      const enableCustomDomain = document.getElementById('enable-custom-domain');
      enableCustomDomain.disabled = !e.target.value.trim();
    });
    
    // Add GitHub account button
    document.getElementById('add-github-account-btn').addEventListener('click', () => {
      this.app.closeModal();
      const accountManager = this.app.getModule('accountManager');
      if (accountManager) {
        accountManager.openGitHubAccountsModal();
      } else {
        console.error('AccountManager not available');
      }
    });
    
    // Form submission
    document.getElementById('deploy-config-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleDeploySubmit();
    });
  }

  async onDeploymentAccountChange(accountId) {
    if (!accountId) {
      const securityInfo = document.getElementById('security-info');
      const repoPreview = document.getElementById('repo-preview');
      if (securityInfo) securityInfo.style.display = 'none';
      if (repoPreview) repoPreview.textContent = 'username/repository-name';
      return;
    }
    
    try {
      const account = await window.electronAPI.deploy.getGitHubAccount(accountId);
      if (!account) return;
      
      // Update repository preview
      this.updateRepositoryPreview();
      
      // Update security panel
      this.updateDeploymentSecurityPanel(account);
      
    } catch (error) {
      console.error('Failed to load account details:', error);
    }
  }

  async onHybridDeploymentAccountChange(accountId) {
    if (!accountId) {
      const hybridRepoPreview = document.getElementById('hybrid-repo-preview');
      if (hybridRepoPreview) hybridRepoPreview.textContent = 'username/repository-name';
      return;
    }
    
    try {
      const account = await window.electronAPI.deploy.getGitHubAccount(accountId);
      if (!account) return;
      
      // Update hybrid repository preview
      this.updateHybridRepositoryPreview();
      
    } catch (error) {
      console.error('Failed to load account details:', error);
    }
  }

  updateRepositoryPreview() {
    const accountSelect = document.getElementById('github-account');
    const repoNameInput = document.getElementById('repository-name');
    const repoPreview = document.getElementById('repo-preview');
    
    if (accountSelect && repoNameInput && repoPreview) {
      const selectedOption = accountSelect.selectedOptions[0];
      const username = selectedOption ? selectedOption.dataset.username : '';
      const repoName = repoNameInput.value.trim() || 'my-site';
      
      repoPreview.textContent = username ? `${username}/${repoName}` : 'username/repository-name';
    }
  }

  updateHybridRepositoryPreview() {
    const accountSelect = document.getElementById('hybrid-github-account');
    const repoNameInput = document.getElementById('hybrid-repository-name');
    const repoPreview = document.getElementById('hybrid-repo-preview');
    
    if (accountSelect && repoNameInput && repoPreview) {
      const selectedOption = accountSelect.selectedOptions[0];
      const username = selectedOption ? selectedOption.dataset.username : '';
      const repoName = repoNameInput.value.trim() || 'my-site';
      
      repoPreview.textContent = username ? `${username}/${repoName}` : 'username/repository-name';
    }
  }

  updateDeploymentSecurityPanel(account) {
    // Security panel no longer needed for manual GitHub deployment
    const securityInfo = document.getElementById('security-info');
    if (securityInfo) {
      securityInfo.style.display = 'none';
    }
  }


  /**
   * Handle GitHub Pages deployment
   */
  async handleGitHubDeploySubmit() {
    try {
      const form = document.getElementById('github-deploy-form');
      const formData = new FormData(form);
      
      const accountId = formData.get('github-account') || document.getElementById('github-account').value;
      const repositoryName = formData.get('repository-name') || document.getElementById('repository-name').value;
      const customDomain = formData.get('custom-domain') || document.getElementById('custom-domain').value;
      const autoCreateRepo = document.getElementById('auto-create-repo').checked;
      const enableCustomDomain = document.getElementById('enable-custom-domain').checked;
      
      if (!accountId || !repositoryName) {
        this.app.showError('Please select a GitHub account and enter a repository name');
        return;
      }
      
      this.app.updateFooterStatus('Deploying to GitHub Pages...', false);
      
      const deployResult = await window.electronAPI.deploy.deployToGitHub({
        workspacePath: this.app.workspacePath,
        accountId,
        repositoryName,
        customDomain: enableCustomDomain ? customDomain : null,
        autoCreateRepo
      });
      
      if (deployResult.success) {
        this.app.showSuccess(`Site deployed to GitHub Pages successfully! Available at ${deployResult.url}`);
      } else {
        this.app.showError(`GitHub Pages deployment failed: ${deployResult.error || 'Unknown error'}`);
      }
      
      this.app.updateFooterStatus('Ready', false);
      
    } catch (error) {
      console.error('GitHub Pages deployment failed:', error);
      this.app.showError(`GitHub Pages deployment failed: ${error.message}`);
      this.app.updateFooterStatus('Ready', false);
    }
  }

  /**
   * Handle Arweave deployment
   */
  async handleArweaveDeploySubmit() {
    try {
      const form = document.getElementById('arweave-deploy-form');
      const formData = new FormData(form);
      
      const siteId = formData.get('arweave-site-id') || document.getElementById('arweave-site-id').value;
      const deploymentStrategy = document.getElementById('arweave-deployment-strategy').value || 'full';
      
      if (!siteId) {
        this.app.showError('Please enter a Site ID for Arweave deployment');
        return;
      }
      
      // Check if Arweave wallet is configured first
      const isWalletConfigured = await window.electronAPI.archive.isWalletConfigured();
      if (!isWalletConfigured) {
        this.app.showError('Arweave wallet not configured. Please set up your Arweave wallet first.', {
          action: 'Set Up Wallet',
          onAction: () => {
        this.app.closeModal();
            this.app.openArweaveAccountsModal();
          }
        });
        return;
      }
      
      this.app.updateFooterStatus('Deploying to Arweave...', false);
      
      const deployResult = await window.electronAPI.deploy.arweaveDeploy({
        workspacePath: this.app.workspacePath,
        siteId: siteId,
        incremental: deploymentStrategy === 'incremental'
      });
      
      if (deployResult.success) {
        const successMessage = `Site deployed to Arweave successfully!\n\nURL: ${deployResult.url}\nTransaction ID: ${deployResult.manifestHash}\nCost: ${deployResult.totalCost.ar} AR\nFiles: ${deployResult.fileCount}`;
        this.app.showSuccess(successMessage);
        
        // Store the detailed deployment information for display
        this.lastArweaveDeployment = {
          url: deployResult.url,
          manifestUrl: deployResult.manifestUrl,
          transactionId: deployResult.manifestHash,
          timestamp: new Date().toISOString(),
          cost: deployResult.totalCost.ar,
          fileCount: deployResult.fileCount,
          totalSize: deployResult.totalSize,
          uploadedFiles: deployResult.uploadedFiles || [],
          indexFile: deployResult.indexFile
        };
        
        // Update the wallet status display to show the new deployment details
        await this.checkArweaveWalletStatus();
      } else {
        this.app.showError(`Arweave deployment failed: ${deployResult.error || 'Unknown error'}`);
      }
      
      this.app.updateFooterStatus('Ready', false);
      
    } catch (error) {
      console.error('Arweave deployment failed:', error);
      this.app.showError(`Arweave deployment failed: ${error.message}`);
      this.app.updateFooterStatus('Ready', false);
    }
  }

  /**
   * Handle Hybrid deployment
   */
  async handleHybridDeploySubmit() {
    try {
      const form = document.getElementById('hybrid-deploy-form');
      const formData = new FormData(form);
      
      const siteId = formData.get('hybrid-site-id') || document.getElementById('hybrid-site-id').value;
      const accountId = formData.get('hybrid-github-account') || document.getElementById('hybrid-github-account').value;
      const repositoryName = formData.get('hybrid-repository-name') || document.getElementById('hybrid-repository-name').value;
      
      if (!accountId || !repositoryName || !siteId) {
        this.app.showError('Please fill in all required fields for hybrid deployment');
        return;
      }
      
      // Check if Arweave wallet is configured first
      const isWalletConfigured = await window.electronAPI.archive.isWalletConfigured();
      if (!isWalletConfigured) {
        this.app.showError('Arweave wallet not configured. Please set up your Arweave wallet first.', {
          action: 'Set Up Wallet',
          onAction: () => {
            this.app.closeModal();
            this.app.openArweaveAccountsModal();
          }
        });
        return;
      }
      
      this.app.updateFooterStatus('Deploying to both platforms...', false);
      
      const deployResult = await window.electronAPI.deploy.hybridDeploy({
        githubPages: {
          workspacePath: this.app.workspacePath,
          accountId,
          repositoryName
        },
        arweave: {
          workspacePath: this.app.workspacePath,
          siteId: siteId,
          incremental: false
        },
        syncStrategy: 'sequential',
        crossReference: true
      });
      
      if (deployResult.githubPages.success && deployResult.arweave.success) {
        const successMessage = `Site deployed to both platforms successfully!\nGitHub Pages: ${deployResult.githubPages.url}\nArweave: ${deployResult.arweave.url}`;
        this.app.showSuccess(successMessage);
      } else {
        let errorMessage = 'Hybrid deployment failed:';
        if (!deployResult.githubPages.success) {
          errorMessage += `\nGitHub Pages: ${deployResult.githubPages.error}`;
        }
        if (!deployResult.arweave.success) {
          errorMessage += `\nArweave: ${deployResult.arweave.error}`;
        }
        this.app.showError(errorMessage);
      }
      
      this.app.updateFooterStatus('Ready', false);
      
    } catch (error) {
      console.error('Hybrid deployment failed:', error);
      this.app.showError(`Hybrid deployment failed: ${error.message}`);
      this.app.updateFooterStatus('Ready', false);
    }
  }

  /**
   * Handle deployment submit (legacy method - kept for compatibility)
   */
  async handleDeploySubmit() {
    // Redirect to GitHub deployment for backward compatibility
    await this.handleGitHubDeploySubmit();
  }

  // Utility methods for formatting
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatFileTypesList(fileTypes) {
    if (!fileTypes || Object.keys(fileTypes).length === 0) {
      return '<div class="no-files">No files found</div>';
    }
    
    return Object.entries(fileTypes)
      .sort(([,a], [,b]) => b - a)
      .map(([type, count]) => `
        <div class="file-type-row">
          <span class="file-type-label">${type}</span>
          <span class="file-type-value">${count}</span>
        </div>
      `).join('');
  }

  formatExclusionsList(contentSummary) {
    if (!contentSummary.buildExcludedTypes || Object.keys(contentSummary.buildExcludedTypes).length === 0) {
      return '<div class="no-exclusions">No files excluded</div>';
    }
    
    return Object.entries(contentSummary.buildExcludedTypes)
      .sort(([,a], [,b]) => b - a)
      .map(([type, count]) => `
        <div class="file-type-row">
          <span class="file-type-label">${type}</span>
          <span class="file-type-value">${count}</span>
        </div>
      `).join('');
  }

  // Utility methods for configuration modal
  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  extractDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return 'Invalid URL';
    }
  }

  updateCharacterCounts() {
    const inputs = [
      { id: 'site-title', countId: 'title-char-count', maxLength: 100 },
      { id: 'site-description', countId: 'description-char-count', maxLength: 500 },
      { id: 'site-author', countId: 'author-char-count', maxLength: 100 }
    ];

    inputs.forEach(({ id, countId, maxLength }) => {
      const input = document.getElementById(id);
      const countDiv = document.getElementById(countId);
      
      if (input && countDiv) {
        const currentLength = input.value.length;
        const isOver = currentLength > maxLength;
        
        countDiv.textContent = `${currentLength}/${maxLength}`;
        countDiv.className = `character-count ${isOver ? 'over-limit' : ''}`;
      }
    });
  }

  validateBaseUrl() {
    const baseUrlInput = document.getElementById('site-base-url');
    const validationDiv = document.getElementById('base-url-validation');
    
    if (!baseUrlInput || !validationDiv) return;
    
    const url = baseUrlInput.value.trim();
    
    if (!url) {
      validationDiv.style.display = 'none';
      return;
    }
    
    try {
      const urlObj = new URL(url);
      
      if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
        validationDiv.innerHTML = `
          <div class="validation-error">
            ❌ URL must use http:// or https:// protocol
          </div>
        `;
        validationDiv.style.display = 'block';
        return;
      }
      
      validationDiv.innerHTML = `
        <div class="validation-success">
          ✅ Valid URL
        </div>
      `;
      validationDiv.style.display = 'block';
    } catch (error) {
      validationDiv.innerHTML = `
        <div class="validation-error">
          ❌ Invalid URL format
        </div>
      `;
      validationDiv.style.display = 'block';
    }
  }

  updateDomainPreview() {
    const baseUrlInput = document.getElementById('site-base-url');
    const domainPreview = document.getElementById('domain-preview');
    const customCnameCheckbox = document.getElementById('custom-cname');
    
    if (!baseUrlInput || !domainPreview || !customCnameCheckbox) return;
    
    const url = baseUrlInput.value.trim();
    
    if (!url) {
      domainPreview.textContent = 'No domain specified';
      return;
    }
    
    try {
      const domain = this.extractDomainFromUrl(url);
      
      if (customCnameCheckbox.checked) {
        domainPreview.innerHTML = `
          <strong>${domain}</strong>
          <br><small>CNAME file will be generated for custom domain</small>
        `;
      } else {
        domainPreview.textContent = domain;
      }
    } catch (error) {
      domainPreview.textContent = 'Invalid URL';
    }
  }

  async previewIgnorePatterns() {
    const ignorePatternsTextarea = document.getElementById('ignore-patterns');
    const enableIgnorePatternsCheckbox = document.getElementById('enable-ignore-patterns');
    const previewDiv = document.getElementById('ignore-preview');
    
    if (!ignorePatternsTextarea || !enableIgnorePatternsCheckbox || !previewDiv) return;
    
    const patterns = ignorePatternsTextarea.value
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    if (!enableIgnorePatternsCheckbox.checked || patterns.length === 0) {
      previewDiv.style.display = 'none';
      return;
    }
    
    try {
      // Call backend to preview patterns
      const preview = await window.electronAPI.deploy.previewIgnorePatterns(
        this.app.workspacePath, 
        patterns
      );
      
      document.getElementById('preview-included-count').textContent = preview.currentIncluded || 0;
      document.getElementById('preview-excluded-count').textContent = preview.currentExcluded || 0;
      
      previewDiv.style.display = 'block';
    } catch (error) {
      console.error('Failed to preview ignore patterns:', error);
      previewDiv.style.display = 'none';
    }
  }

  resetConfigurationToDefaults() {
    // Reset template to vanilla
    document.querySelector('input[name="template"][value="vanilla"]').checked = true;
    document.getElementById('custom-template-section').style.display = 'none';
    document.getElementById('custom-template-url').value = '';
    document.getElementById('url-validation').innerHTML = '';

    // Reset site information
    document.getElementById('site-title').value = 'My Digital Garden';
    document.getElementById('site-description').value = '';
    document.getElementById('site-author').value = '';

    // Reset domain configuration
    document.getElementById('site-base-url').value = '';
    document.getElementById('custom-cname').checked = true;
    document.getElementById('base-url-validation').style.display = 'none';

    // Reset display preferences
    document.getElementById('theme-auto').checked = true;
    document.getElementById('enable-spa').checked = true;
    document.getElementById('enable-popovers').checked = true;

    // Reset ignore patterns
    document.getElementById('ignore-patterns').value = '';
    document.getElementById('enable-ignore-patterns').checked = false;

    // Update displays
    this.updateCharacterCounts();
    this.updateDomainPreview();

    // Hide ignore preview
    const previewDiv = document.getElementById('ignore-preview');
    if (previewDiv) {
      previewDiv.style.display = 'none';
    }

    this.app.showSuccess('Settings reset to defaults');
  }

  getModalManager() {
    return this.app.getModule('modalManager');
  }
} 