  generateDeploymentFormContent() {
    // Simplified Arweave-only deployment form
    return `
      <div class="deploy-main-content">
        <!-- Enhanced Arweave Deployment Section -->
        <div class="collapsible-section" id="arweave-section">
          <div class="section-header" data-section="arweave">
            <h4>Arweave Deployment</h4>
            <div class="section-header-right">
              <span class="deployment-status" id="arweave-status">Ready</span>
              <button type="button" class="expand-btn" aria-label="Toggle Arweave section">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="section-content">
            <div class="wallet-status" id="arweave-wallet-status">
              <div class="wallet-status-loading">Checking wallet status...</div>
            </div>
            
            <form id="arweave-deploy-form">
              <div class="form-group form-group-enhanced">
                <div class="form-group-header">
                  <label for="arweave-site-id">Site ID</label>
                  <button class="form-help-btn" title="Unique identifier for your Arweave deployment. This will be used to track your site deployments.">?</button>
                </div>
                <div class="form-group-control">
                  <input type="text" id="arweave-site-id" placeholder="my-site-arweave" required>
                  <small>Unique identifier for your Arweave deployment</small>
                </div>
              </div>
              
              <div class="deployment-preview" id="deployment-preview" style="display: none;">
                <h5>Deployment Preview</h5>
                <div class="preview-stats">
                  <div class="stat-item">
                    <span class="stat-label">Files to deploy:</span>
                    <span class="stat-value" id="preview-file-count">-</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">Total size:</span>
                    <span class="stat-value" id="preview-total-size">-</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">Estimated cost:</span>
                    <span class="stat-value" id="preview-cost">-</span>
                  </div>
                </div>
              </div>

              <div class="cost-estimate" id="arweave-cost-estimate" style="display: none;">
                <h5>Cost Breakdown</h5>
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
                <button type="button" class="secondary-btn" id="preview-deployment-btn">
                  <span class="btn-icon">👁️</span>
                  Preview Deployment
                </button>
                <button type="submit" class="primary-btn" id="arweave-deploy-btn">
                  <span class="btn-icon">🌐</span>
                  Deploy to Arweave
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }
