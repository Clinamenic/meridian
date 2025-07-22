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
    // Site configuration is now handled by the Configure button in the workflow cards

    // Deploy button - set up a delegated event listener since the button is dynamically created
    document.addEventListener('click', async (e) => {
      if (e.target && e.target.id === 'deploy-workflow-btn') {
        // Check if Quartz is initialized before proceeding
        try {
          const isInitialized = await this.checkQuartzInitialized();
          if (!isInitialized) {
            this.getApp().showError('Please initialize Quartz first before deploying');
            return;
          }
          await this.deploySite();
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
                        <div class="deploy-phase-card ${isQuartzInitialized ? 'completed' : 'active'}" data-phase="configure">
                          <div class="phase-number">1</div>
                          <button class="secondary-btn" id="configure-workflow-btn">
                            Configure
                          </button>
                          <div class="phase-description">${isQuartzInitialized ? 'Modify site settings or template' : 'Set up site template and settings'}</div>
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
      const configureBtn = document.getElementById('configure-workflow-btn');
      if (configureBtn) {
        configureBtn.addEventListener('click', async () => {
          await this.openConfigurationModal();
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
      
      // Create unified configuration modal
      await this.createUnifiedConfigurationModal(isInitialized, currentSettings, defaultTemplate);
      
    } catch (error) {
      console.error('Failed to open configuration modal:', error);
      this.app.showError(`Failed to open configuration: ${error.message}`);
    }
  }

  async createUnifiedConfigurationModal(isInitialized, currentSettings, defaultTemplate) {
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
                      <input type="radio" name="template" value="vanilla" ${currentTemplate.isDefault !== false ? 'checked' : ''}>
                      <div class="radio-content">
                        <strong>Vanilla Quartz</strong>
                        <p>Default Meridian-Quartz template with clean styling</p>
                      </div>
                    </label>
                    
                    <label class="radio-option">
                      <input type="radio" name="template" value="custom" ${currentTemplate.isDefault === false ? 'checked' : ''}>
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
                    <div class="form-group">
                      <label for="site-title">Site Title</label>
                      <input type="text" id="site-title" value="${this.escapeHtml(currentSettings.site?.title || 'My Digital Garden')}" maxlength="100" required>
                      <small>The main title for your site (1-100 characters)</small>
                      <div class="character-count" id="title-char-count"></div>
                    </div>
                    
                    <div class="form-group">
                      <label for="site-description">Site Description</label>
                      <textarea id="site-description" placeholder="A brief description of your digital garden" maxlength="500">${this.escapeHtml(currentSettings.site?.description || '')}</textarea>
                      <small>A brief description of your site (optional, max 500 characters)</small>
                      <div class="character-count" id="description-char-count"></div>
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
                    <div class="form-group">
                      <label for="site-base-url">Base URL</label>
                      <input type="url" id="site-base-url" value="${this.escapeHtml(currentSettings.site?.baseUrl || '')}" placeholder="https://yourdomain.com">
                      <small>The full URL where your site will be accessible</small>
                      <div class="url-validation" id="base-url-validation" style="display: none;"></div>
                      <div class="domain-preview" id="domain-preview">
                        ${currentSettings.site?.baseUrl ? this.extractDomainFromUrl(currentSettings.site.baseUrl) : 'No domain specified'}
                      </div>
                    </div>
                    
                    <div class="form-group checkbox-group">
                      <input type="checkbox" id="custom-cname" ${currentSettings.deployment?.customCNAME ? 'checked' : ''}>
                      <label for="custom-cname">Generate CNAME file for custom domain</label>
                      <small>Automatically creates a CNAME file when a custom domain is detected</small>
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
                    
                    <div class="form-group checkbox-group">
                      <input type="checkbox" id="enable-spa" ${currentSettings.quartz?.enableSPA !== false ? 'checked' : ''}>
                      <label for="enable-spa">Enable Single Page Application</label>
                      <small>Faster navigation between pages (recommended)</small>
                    </div>
                    
                    <div class="form-group checkbox-group">
                      <input type="checkbox" id="enable-popovers" ${currentSettings.quartz?.enablePopovers !== false ? 'checked' : ''}>
                      <label for="enable-popovers">Enable Link Popovers</label>
                      <small>Show preview popups when hovering over internal links</small>
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
                    
                    <div class="form-group checkbox-group">
                      <input type="checkbox" id="enable-ignore-patterns" ${currentSettings.site?.ignorePatterns?.enabled !== false ? 'checked' : ''}>
                      <label for="enable-ignore-patterns">Enable custom ignore patterns</label>
                      <small>Apply the custom patterns above to exclude files from your site</small>
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
      this.app.updateFooterStatus('Saving configuration...', false);
      
      // Get form data
      const formData = this.collectConfigurationData();
      
      // Determine if template changed (destructive change)
      const currentTemplate = currentSettings.quartz?.template;
      const selectedTemplate = formData.template;
      const templateChanged = this.hasTemplateChanged(currentTemplate, selectedTemplate);
      
      if (isInitialized && templateChanged) {
        // Show reinitialization warning
        const confirmed = await this.showReinitializationWarning();
        if (!confirmed) {
          this.app.updateFooterStatus('Ready', false);
          return;
        }
        
        // Reinitialize with new template
        await this.reinitializeWithTemplate(formData);
      } else if (!isInitialized) {
        // First-time initialization
        await this.initializeWithConfiguration(formData);
      } else {
        // Safe configuration changes only
        await this.applySafeConfigurationChanges(formData);
      }
      
      this.app.closeModal();
      await this.renderDeployStatus();
      this.app.updateFooterStatus('Ready', false);
      this.app.showSuccess('Configuration updated successfully!');
      
    } catch (error) {
      console.error('Failed to save configuration:', error);
      this.app.showError(`Configuration failed: ${error.message}`);
      this.app.updateFooterStatus('Ready', false);
    }
  }

  collectConfigurationData() {
    const templateType = document.querySelector('input[name="template"]:checked').value;
    let template;
    
    if (templateType === 'vanilla') {
      // Use default template (will be resolved on backend)
      template = null;
    } else {
      // Custom template
      const customUrl = document.getElementById('custom-template-url').value.trim();
      if (!customUrl) {
        throw new Error('Custom template URL is required when using custom template');
      }
      template = { isCustom: true, url: customUrl };
    }
    
    // Collect ignore patterns
    const ignorePatternsValue = document.getElementById('ignore-patterns').value;
    const customPatterns = ignorePatternsValue
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    return {
      template,
      site: {
        title: document.getElementById('site-title').value.trim(),
        description: document.getElementById('site-description').value.trim(),
        author: document.getElementById('site-author').value.trim(),
        baseUrl: document.getElementById('site-base-url').value.trim(),
        ignorePatterns: {
          custom: customPatterns,
          enabled: document.getElementById('enable-ignore-patterns').checked,
        },
      },
      quartz: {
        enableSPA: document.getElementById('enable-spa').checked,
        enablePopovers: document.getElementById('enable-popovers').checked,
        theme: {
          mode: document.querySelector('input[name="theme-mode"]:checked').value,
        },
      },
      deployment: {
        customCNAME: document.getElementById('custom-cname').checked,
      },
    };
  }

  hasTemplateChanged(currentTemplate, selectedTemplate) {
    if (!currentTemplate && !selectedTemplate) return false;
    if (!currentTemplate && selectedTemplate) return true;
    if (currentTemplate && !selectedTemplate) return true;
    
    if (currentTemplate.isDefault && !selectedTemplate) return false;
    if (!currentTemplate.isDefault && selectedTemplate?.isCustom) {
      return currentTemplate.url !== selectedTemplate.url;
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
    let template = null;
    
    if (configData.template?.isCustom) {
      // Parse custom template URL
      template = await window.electronAPI.template.parseUrl(configData.template.url);
    }
    
    // Initialize Quartz with selected template
    await window.electronAPI.deploy.initializeQuartz(this.app.workspacePath, template);
    
    // Save additional site settings
    await this.saveSiteSettings(configData);
  }

  async reinitializeWithTemplate(configData) {
    let template = null;
    
    if (configData.template?.isCustom) {
      // Parse custom template URL
      template = await window.electronAPI.template.parseUrl(configData.template.url);
    }
    
    // Reinitialize with new template
    await window.electronAPI.deploy.initializeQuartz(this.app.workspacePath, template);
    
    // Save additional site settings
    await this.saveSiteSettings(configData);
  }

  async applySafeConfigurationChanges(configData) {
    // Save settings that don't require reinitialization
    await this.saveSiteSettings(configData);
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
} 