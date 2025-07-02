import { ModuleBase } from './ModuleBase.js';

/**
 * DeployManager module - handles all deployment-related operations (Quartz, build, deploy, site settings)
 */
export class DeployManager extends ModuleBase {
  constructor(app) {
    super(app);
    // You can initialize state here if needed
  }

  async onInit() {
    // Placeholder for initialization logic
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
    // Site Settings button
    const siteSettingsBtn = document.getElementById('site-settings-btn');
    if (siteSettingsBtn) {
      console.log('[DEBUG] Site Settings button found, attaching event listener');
      siteSettingsBtn.addEventListener('click', async () => {
        console.log('[DEBUG] Site Settings button clicked');
        try {
          await this.getApp().openSiteSettingsModal();
        } catch (error) {
          console.error('[DEBUG] Error opening site settings modal:', error);
        }
      });
    } else {
      console.error('[DEBUG] Site Settings button not found!');
    }

    // Deploy button - set up a delegated event listener since the button is dynamically created
    document.addEventListener('click', async (e) => {
      if (e.target && e.target.id === 'deploy-workflow-btn') {
        // Check if Quartz is initialized before proceeding
        try {
          const isInitialized = await this.getApp().checkQuartzInitialized();
          if (!isInitialized) {
            this.getApp().showError('Please initialize Quartz first before deploying');
            return;
          }
          await this.getApp().deploySite();
        } catch (error) {
          console.error('Error in deploy button handler:', error);
          this.getApp().showError(`Deploy failed: ${error.message}`);
        }
      }
    });
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
    const container = document.getElementById('deploy-content');
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
      const container = document.getElementById('deploy-content');
      if (!container) return;

      // Check if workspace is connected
      if (!this.app.workspacePath) {
        this.renderDeployNoWorkspace();
        return;
      }

      // Scan workspace content
      const contentSummary = await window.electronAPI.deploy.scanContent(this.app.workspacePath);
      
      // Check if Quartz is initialized by looking for .quartz directory
      const isQuartzInitialized = await this.checkQuartzInitialized();
      
      // Update site status in header
      const siteStatusElement = document.getElementById('deploy-site-status');
      if (siteStatusElement) {
        siteStatusElement.textContent = `Site Status: ${isQuartzInitialized ? 'Ready' : 'Not Initialized'}`;
        siteStatusElement.className = isQuartzInitialized ? 'ready' : 'not-initialized';
      }

      container.innerHTML = `
        <div class="deploy-main-content">
          <!-- Deployment Workflow Cards -->
          <div class="deploy-phase-cards">
                        <div class="deploy-phase-card ${isQuartzInitialized ? 'completed' : 'active'}" data-phase="initialize">
                          <div class="phase-number">1</div>
                          <button class="${isQuartzInitialized ? 'secondary-btn' : 'primary-btn'}" id="init-workflow-btn" ${isQuartzInitialized ? 'disabled' : ''}>
                            Initialize
                          </button>
                          <div class="phase-description">Set up Quartz static site generator</div>
                        </div>
                        
                        <div class="deploy-phase-card ${isQuartzInitialized ? '' : 'disabled'}" data-phase="build-preview">
                          <svg class="preview-eye-icon" id="enable-preview-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="Start preview server" ${isQuartzInitialized ? '' : 'disabled'}>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                          <div class="phase-number">2</div>
                          <button class="secondary-btn" id="build-preview-workflow-btn" ${isQuartzInitialized ? '' : 'disabled'}>Build</button>
                          <div class="phase-description">Generate static site and optionally preview</div>
                        </div>
                        
                        <div class="deploy-phase-card ${isQuartzInitialized ? '' : 'disabled'}" data-phase="deploy">
                          <div class="phase-number">3</div>
                          <button class="secondary-btn" id="deploy-workflow-btn" ${isQuartzInitialized ? '' : 'disabled'}>Deploy</button>
                          <div class="phase-description">Publish to GitHub Pages</div>
                        </div>
                      </div>
                      
                      <!-- Build Logs Section -->
                      <div class="build-logs-section" id="build-logs-section" style="display: none;">
                        <div class="section-header">
                          <h4>📋 Build Logs</h4>
                          <button class="collapse-btn" id="build-logs-toggle">Hide</button>
                        </div>
                        <div class="build-logs-content">
                          <pre id="build-logs-output"></pre>
                        </div>
                      </div>
                      
                      <!-- Preview Section -->
                      <div class="preview-section" id="preview-section" style="display: none;">
                        <div class="section-header">
                          <h4>Site Preview</h4>
                          <div class="preview-controls">
                            <span class="preview-status" id="preview-status">Server: Stopped</span>
                            <button class="secondary-btn" id="open-external-btn">Open in Browser</button>
                            <button class="collapse-btn" id="preview-toggle">Hide</button>
                          </div>
                        </div>
                        <div class="preview-content">
                          <webview id="site-preview" src="about:blank" style="width: 100%; height: 400px; border: 1px solid var(--surface-border);"></webview>
                        </div>
                      </div>

              <!-- Composition Section -->
              <div class="build-status-tile">
                <div class="status-info">
                  <div class="status-item expandable">
                    <div class="status-row">
                      <span class="status-label">Composition:</span>
                      <span class="status-value composition-summary">
                        <span class="build-included">${contentSummary.buildIncludedFiles || 0}</span> included, 
                        <span class="build-excluded">${contentSummary.buildExcludedFiles || 0}</span> excluded
                      </span>
                      <button class="expand-btn" onclick="this.parentElement.parentElement.classList.toggle('expanded')">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                          <path d="M6 8.5L2.5 5l1-1L6 6.5 8.5 4l1 1L6 8.5z"/>
                        </svg>
                      </button>
                    </div>
                    <div class="expandable-content">
                      <div class="composition-breakdown">
                        <div class="composition-column">
                          <div class="breakdown-section">
                            <h5>Included Files</h5>
                            <div class="file-type-breakdown-compact">
                              ${this.formatFileTypesList(contentSummary.buildFileTypes || {})}
                            </div>
                            <div class="composition-footer">
                              <div class="file-type-row">
                                <span class="file-type-label">Total</span>
                                <span class="file-type-value">${contentSummary.buildIncludedFiles || 0}</span>
                              </div>
                              <div class="file-type-row">
                                <span class="file-type-label">Total Size</span>
                                <span class="file-type-value">${this.formatFileSize(contentSummary.buildIncludedSize || 0)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div class="composition-column">
                          <div class="breakdown-section">
                            <h5>Excluded Files</h5>
                            <div class="file-type-breakdown-compact">
                              ${contentSummary.buildExcludedFiles > 0 ? this.formatExclusionsList(contentSummary) : '<div class="no-exclusions">No files excluded</div>'}
                            </div>
                            <div class="composition-footer">
                              <div class="file-type-row">
                                <span class="file-type-label">Total</span>
                                <span class="file-type-value">${contentSummary.buildExcludedFiles || 0}</span>
                              </div>
                              <div class="file-type-row">
                                <span class="file-type-label">Total Size</span>
                                <span class="file-type-value">${this.formatFileSize(contentSummary.buildExcludedSize || 0)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
        </div>
      `;

      // Add event listeners for workflow buttons
      const initBtn = document.getElementById('init-workflow-btn');
      if (initBtn && !isQuartzInitialized) {
        initBtn.addEventListener('click', async () => {
          await this.initializeQuartzProject();
        });
      }
      
      const buildPreviewBtn = document.getElementById('build-preview-workflow-btn');
      const previewToggle = document.getElementById('enable-preview-toggle');
      if (buildPreviewBtn && previewToggle && isQuartzInitialized) {
        // Track toggle state
        let previewEnabled = false;
        
        // Update button text and icon state
        const updateButtonAndIcon = () => {
          buildPreviewBtn.textContent = 'Build';
          previewToggle.classList.toggle('active', previewEnabled);
        };
        
        // Set initial state
        updateButtonAndIcon();
        
        // Handle eye icon toggle
        previewToggle.addEventListener('click', () => {
          if (!previewToggle.hasAttribute('disabled')) {
            previewEnabled = !previewEnabled;
            updateButtonAndIcon();
          }
        });
        
        // Handle build button click
        buildPreviewBtn.addEventListener('click', async () => {
          await this.buildSiteWithOptionalPreview(previewEnabled);
        });
      }
      
      // Deploy button event listener is now handled in setupDeployEvents() with delegation
      
      this.setupPreviewControls();
      
    } catch (error) {
      console.error('Failed to render deploy status:', error);
      container.innerHTML = `
        <div class="error-state">
          <h3>Failed to Load Deployment Status</h3>
          <p>${error.message}</p>
          <button class="secondary-btn" onclick="meridianApp.renderDeployStatus()">Retry</button>
        </div>
      `;
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

  async buildSiteWithOptionalPreview(enablePreview = false) {
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
        
        if (enablePreview) {
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
          this.app.showSuccess(`Site built successfully!`);
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
    const previewSection = document.getElementById('preview-section');
    const previewStatus = document.getElementById('preview-status');
    const sitePreview = document.getElementById('site-preview');
    
    if (previewSection && previewStatus && sitePreview) {
      previewSection.style.display = 'block';
      previewStatus.textContent = `Server: Running at ${previewUrl}`;
      sitePreview.src = previewUrl;
    }
  }

  setupPreviewControls() {
    // Build logs toggle
    const buildLogsToggle = document.getElementById('build-logs-toggle');
    if (buildLogsToggle) {
      buildLogsToggle.addEventListener('click', () => {
        const buildLogsSection = document.getElementById('build-logs-section');
        const buildLogsContent = document.querySelector('.build-logs-content');
        if (buildLogsSection && buildLogsContent) {
          const isVisible = buildLogsContent.style.display !== 'none';
          buildLogsContent.style.display = isVisible ? 'none' : 'block';
          buildLogsToggle.textContent = isVisible ? 'Show' : 'Hide';
        }
      });
    }

    // Preview toggle
    const previewToggle = document.getElementById('preview-toggle');
    if (previewToggle) {
      previewToggle.addEventListener('click', () => {
        const previewContent = document.querySelector('.preview-content');
        if (previewContent) {
          const isVisible = previewContent.style.display !== 'none';
          previewContent.style.display = isVisible ? 'none' : 'block';
          previewToggle.textContent = isVisible ? 'Show' : 'Hide';
        }
      });
    }

    // Open external button
    const openExternalBtn = document.getElementById('open-external-btn');
    if (openExternalBtn) {
      openExternalBtn.addEventListener('click', () => {
        const sitePreview = document.getElementById('site-preview');
        if (sitePreview && sitePreview.src && sitePreview.src !== 'about:blank') {
          window.electronAPI.openExternal(sitePreview.src);
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
        const modalHtml = `
          <div class="modal deploy-modal">
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
          </div>
        `;
        
        const modal = document.getElementById('modal-overlay');
        modal.innerHTML = modalHtml;
        modal.classList.add('active');
        
        // Setup GitHub account button
        document.getElementById('setup-github-btn').addEventListener('click', () => {
          this.app.closeModal();
          this.app.openGitHubAccountsModal();
        });
        
        return;
      }
      
      // Create deployment modal with GitHub account selection
      const accountOptions = githubAccounts.map(account => 
        `<option value="${account.id}" data-username="${account.username}" data-token-type="${account.tokenType}">
          ${account.nickname} (@${account.username}) ${account.tokenType === 'classic' ? '⚠️' : '🔒'}
        </option>`
      ).join('');
      
      const modalHtml = `
        <div class="modal deploy-modal">
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
        </div>
      `;
      
      const modal = document.getElementById('modal-overlay');
      modal.innerHTML = modalHtml;
      modal.classList.add('active');
      
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
      this.app.openGitHubAccountsModal();
    });
    
    // Form submission
    document.getElementById('deploy-config-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleDeploySubmit();
    });
  }

  async onDeploymentAccountChange(accountId) {
    if (!accountId) {
      document.getElementById('security-info').style.display = 'none';
      document.getElementById('repo-preview').textContent = 'username/repository-name';
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

  updateDeploymentSecurityPanel(account) {
    const securityInfo = document.getElementById('security-info');
    if (!securityInfo) return;
    
    const tokenType = account.tokenType;
    const isClassic = tokenType === 'classic';
    
    securityInfo.innerHTML = `
      <div class="security-header">
        <h5>🔒 Security Information</h5>
        <span class="token-type ${isClassic ? 'warning' : 'secure'}">
          ${isClassic ? '⚠️ Classic Token' : '🔒 Fine-grained Token'}
        </span>
      </div>
      <div class="security-details">
        <div class="security-item">
          <span class="security-label">Token Type:</span>
          <span class="security-value">${tokenType === 'classic' ? 'Classic Personal Access Token' : 'Fine-grained Personal Access Token'}</span>
        </div>
        <div class="security-item">
          <span class="security-label">Account:</span>
          <span class="security-value">@${account.username}</span>
        </div>
        <div class="security-item">
          <span class="security-label">Permissions:</span>
          <span class="security-value">${this.getTokenPermissionsText(account)}</span>
        </div>
      </div>
      ${isClassic ? `
        <div class="security-warning">
          <p><strong>⚠️ Classic Token Detected</strong></p>
          <p>Classic tokens have broad permissions. Consider using a fine-grained token for better security.</p>
          <button type="button" class="link-btn" id="show-security-guide-btn">Learn More</button>
        </div>
      ` : ''}
    `;
    
    securityInfo.style.display = 'block';
    
    // Add event listener for security guide
    const showSecurityGuideBtn = document.getElementById('show-security-guide-btn');
    if (showSecurityGuideBtn) {
      showSecurityGuideBtn.addEventListener('click', () => {
        this.app.showSecurityGuide();
      });
    }
  }

  getTokenPermissionsText(account) {
    if (account.tokenType === 'fine-grained') {
      return 'Repository-specific permissions';
    } else {
      return 'Full repository access';
    }
  }

  async handleDeploySubmit() {
    try {
      const form = document.getElementById('deploy-config-form');
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
      
      this.app.updateFooterStatus('Deploying site...', false);
      
      const deployResult = await window.electronAPI.deploy.deployToGitHub({
        workspacePath: this.app.workspacePath,
        accountId,
        repositoryName,
        customDomain: enableCustomDomain ? customDomain : null,
        autoCreateRepo
      });
      
      if (deployResult.status === 'success') {
        this.app.showSuccess(`Site deployed successfully! Available at ${deployResult.url}`);
        this.app.closeModal();
      } else {
        this.app.showError(`Deployment failed: ${deployResult.error || 'Unknown error'}`);
      }
      
      this.app.updateFooterStatus('Ready', false);
      
    } catch (error) {
      console.error('Deployment failed:', error);
      this.app.showError(`Deployment failed: ${error.message}`);
      this.app.updateFooterStatus('Ready', false);
    }
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
} 