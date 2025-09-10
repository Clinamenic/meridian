# Edit Resource Modal Improvements Planning Document

## User Requirements Summary

### 1. Resource Type Classification

- **Internal**: Resources with local storage path/location
- **External**: Resources without local storage (URL-based)
- **Arweave Capability**: Both internal and external can have Arweave uploads

### 2. Modal Integration

- **Architecture**: Use modularized ModalManager for all modal operations
- **Pattern**: Follow existing modal lifecycle and callback patterns

### 3. Alternative Locations Management

- **User Control**: Add/remove alternative locations
- **Arweave Management**: Insert/remove from Arweave upload list
- **Immutable Metadata**: No editing of Arweave upload metadata (immutable)

### 4. Validation Strategy

- **Timing**: Verify on form submission
- **URL Accessibility**: Show accessibility status for each URL entered

### 5. File Path Handling

- **Internal Resources**: Change file path via browse only (no manual entry)
- **Security**: Prevent arbitrary path injection

### 6. Custom Properties System

- **Index Metadata**: Allow custom "Index Metadata" properties
- **Scope**: Global properties with autocomplete for both keys and values
- **Autocomplete**: Similar to tagging system - key autocomplete, then value autocomplete within each key
- **External Arweave**: Users can insert external Arweave hashes
- **File Browser**: System-wide browsing with workspace default
- **Performance**: Optimized for extensive custom properties usage

## Current State Analysis

### Existing Edit Resource Modal

- **Location**: `src/renderer/index.html` (lines 1577-1744)
- **ID**: `edit-resource-item-modal`
- **Status**: Static HTML form, incomplete functionality
- **Issues**: No type-specific handling, missing validation, no alternative location management

### ModalManager Architecture

- **Pattern**: Extends ModuleBase, manages modal lifecycle
- **Methods**: `openModal(modalId, options)`, `closeModal()`, tab management
- **Features**: Modal history, callbacks, dynamic content, animation support

### Database Schema (Current)

```sql
CREATE TABLE resources (
  -- Core fields
  id TEXT PRIMARY KEY,
  state_type TEXT, -- 'internal' | 'external'
  location_type TEXT, -- 'file-path' | 'http-url'
  location_value TEXT,

  -- Metadata stored as JSON in properties
  arweave_hashes TEXT, -- JSON array

  -- Tags stored in separate table
  -- Custom properties need new schema
);
```

## Database Schema Enhancements

Following normalization best practices and the principles from web research:

### 1. Custom Properties Tables (3NF Design with Global Autocomplete)

```sql
-- Global property key definitions for autocomplete
CREATE TABLE global_property_keys (
  property_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  data_type TEXT NOT NULL, -- 'string', 'number', 'boolean', 'date'
  usage_count INTEGER DEFAULT 0,
  last_used TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Global property values for autocomplete within each key
CREATE TABLE global_property_values (
  id TEXT PRIMARY KEY,
  property_key TEXT NOT NULL,
  property_value TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  last_used TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (property_key) REFERENCES global_property_keys(property_key) ON DELETE CASCADE,
  UNIQUE(property_key, property_value)
);

-- Store custom property values for resources
CREATE TABLE resource_custom_properties (
  resource_id TEXT NOT NULL,
  property_key TEXT NOT NULL,
  property_value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (resource_id, property_key),
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
  FOREIGN KEY (property_key) REFERENCES global_property_keys(property_key)
);

-- Performance indexes
CREATE INDEX idx_resource_custom_properties_resource_id ON resource_custom_properties(resource_id);
CREATE INDEX idx_resource_custom_properties_key ON resource_custom_properties(property_key);
CREATE INDEX idx_global_property_values_key ON global_property_values(property_key);
CREATE INDEX idx_global_property_keys_usage ON global_property_keys(usage_count DESC, last_used DESC);
CREATE INDEX idx_global_property_values_usage ON global_property_values(property_key, usage_count DESC, last_used DESC);
```

### 2. Alternative Locations Table

```sql
CREATE TABLE resource_alternative_locations (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  location_type TEXT NOT NULL, -- 'http-url', 'arweave-hash', 'file-path'
  location_value TEXT NOT NULL,
  is_accessible BOOLEAN DEFAULT NULL,
  last_verified TEXT,
  metadata TEXT, -- JSON for type-specific metadata (immutable for Arweave)
  is_external_arweave BOOLEAN DEFAULT false, -- User-added external Arweave hash
  created_at TEXT NOT NULL,
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
);

CREATE INDEX idx_alt_locations_resource_id ON resource_alternative_locations(resource_id);
CREATE INDEX idx_alt_locations_type ON resource_alternative_locations(location_type);
```

## Modular Architecture Compliance

### Integration with Existing Modules

#### 1. ModalManager Integration Pattern

```javascript
// Follows existing ModalManager.createDynamicModal() pattern
class EditResourceModalHandler {
  constructor(app) {
    this.app = app;
    this.modalManager = app.modules.modalManager;
    this.tagManager = app.modules.tagManager;
    this.unifiedResourceManager = app.modules.unifiedResourceManager;
  }

  async openEditModal(resourceId, options = {}) {
    const modalContent = await this.generateModalContent(resourceId);
    return this.modalManager.createDynamicModal(
      "edit-resource-dynamic",
      modalContent,
      {
        onClose: options.onClose || (() => this.handleModalClose(resourceId)),
        onSubmit: (formData) => this.handleFormSubmit(resourceId, formData),
      }
    );
  }
}
```

#### 2. TagManager Pattern Reuse for Custom Properties

```javascript
// Reuse TagManager's autocomplete architecture for custom properties
class CustomPropertyAutocomplete {
  constructor(app) {
    this.app = app;
    this.tagManager = app.modules.tagManager;
  }

  // Leverage TagManager's existing autocomplete logic
  initializePropertyKeyAutocomplete(inputElement, containerElement) {
    // Adapt TagManager.initializeTagAutocomplete for property keys
    return this.tagManager.createAutocompleteInstance(inputElement, {
      dataSource: () => this.getPropertyKeysSuggestions(),
      onSelect: (key) => this.initializePropertyValueAutocomplete(key),
      placeholder: "Property name...",
    });
  }

  initializePropertyValueAutocomplete(propertyKey, inputElement) {
    return this.tagManager.createAutocompleteInstance(inputElement, {
      dataSource: () => this.getPropertyValuesSuggestions(propertyKey),
      onSelect: (value) => this.addPropertyToForm(propertyKey, value),
      placeholder: "Property value...",
    });
  }
}
```

#### 3. UnifiedDatabaseManager Extension Pattern

```javascript
// Follow existing pattern of extending UnifiedDatabaseManager
class UnifiedDatabaseManager {
  // Existing methods...

  // Add custom property methods following existing patterns
  async addCustomPropertyKey(propertyKey, dataType = "string") {
    const query = `
      INSERT OR REPLACE INTO global_property_keys 
      (property_key, display_name, data_type, usage_count, last_used, created_at, updated_at)
      VALUES (?, ?, ?, COALESCE((SELECT usage_count FROM global_property_keys WHERE property_key = ?), 0) + 1, ?, ?, ?)
    `;
    const now = new Date().toISOString();
    return this.db.run(query, [
      propertyKey,
      propertyKey,
      dataType,
      propertyKey,
      now,
      now,
      now,
    ]);
  }

  async getPropertyKeySuggestions(searchTerm = "") {
    const query = `
      SELECT property_key, usage_count
      FROM global_property_keys
      WHERE property_key LIKE ?
      ORDER BY usage_count DESC, last_used DESC
      LIMIT 10
    `;
    return this.db.all(query, [`%${searchTerm}%`]);
  }

  async getPropertyValueSuggestions(propertyKey, searchTerm = "") {
    const query = `
      SELECT property_value, usage_count
      FROM global_property_values
      WHERE property_key = ? AND property_value LIKE ?
      ORDER BY usage_count DESC, last_used DESC
      LIMIT 10
    `;
    return this.db.all(query, [propertyKey, `%${searchTerm}%`]);
  }
}
```

## Implementation Plan

### Phase 1: Database Schema Migration (High Priority - Foundation)

```javascript
// UnifiedDatabaseManager.js - Schema migration with rollback capability
class UnifiedDatabaseManager {
  async migrateToCustomPropertiesSchema() {
    console.log(
      "[UnifiedDatabaseManager] Starting custom properties schema migration..."
    );

    try {
      // Start transaction for atomic migration
      await this.db.run("BEGIN TRANSACTION");

      // Create backup of current schema version
      await this.createSchemaMigrationBackup();

      // Create new tables
      await this.createCustomPropertiesTables();

      // Migrate existing data if any
      await this.migrateExistingCustomProperties();

      // Verify migration integrity
      await this.validateMigrationIntegrity();

      // Update schema version
      await this.updateSchemaVersion("1.1.0");

      await this.db.run("COMMIT");
      console.log(
        "[UnifiedDatabaseManager] Custom properties migration completed successfully"
      );
    } catch (error) {
      await this.db.run("ROLLBACK");
      console.error(
        "[UnifiedDatabaseManager] Migration failed, rolled back:",
        error
      );
      throw error;
    }
  }

  // Performance-optimized property operations
  async addCustomPropertyValue(
    resourceId,
    propertyKey,
    propertyValue,
    dataType = "string"
  ) {
    const now = new Date().toISOString();

    try {
      await this.db.run("BEGIN TRANSACTION");

      // Ensure property key exists and update usage stats
      await this.ensurePropertyKeyExists(propertyKey, dataType);

      // Add/update global property value and update usage stats
      await this.ensurePropertyValueExists(propertyKey, propertyValue);

      // Set resource property value
      await this.db.run(
        `
        INSERT OR REPLACE INTO resource_custom_properties 
        (resource_id, property_key, property_value, created_at, updated_at)
        VALUES (?, ?, ?, COALESCE((SELECT created_at FROM resource_custom_properties WHERE resource_id = ? AND property_key = ?), ?), ?)
      `,
        [
          resourceId,
          propertyKey,
          propertyValue,
          resourceId,
          propertyKey,
          now,
          now,
        ]
      );

      await this.db.run("COMMIT");
    } catch (error) {
      await this.db.run("ROLLBACK");
      throw error;
    }
  }

  async ensurePropertyKeyExists(propertyKey, dataType) {
    const now = new Date().toISOString();
    await this.db.run(
      `
      INSERT OR REPLACE INTO global_property_keys 
      (property_key, display_name, data_type, usage_count, last_used, created_at, updated_at)
      VALUES (?, ?, ?, COALESCE((SELECT usage_count FROM global_property_keys WHERE property_key = ?), 0) + 1, ?, 
              COALESCE((SELECT created_at FROM global_property_keys WHERE property_key = ?), ?), ?)
    `,
      [
        propertyKey,
        propertyKey,
        dataType,
        propertyKey,
        now,
        propertyKey,
        now,
        now,
      ]
    );
  }

  async ensurePropertyValueExists(propertyKey, propertyValue) {
    const now = new Date().toISOString();
    const id = this.generateId();
    await this.db.run(
      `
      INSERT OR REPLACE INTO global_property_values 
      (id, property_key, property_value, usage_count, last_used, created_at)
      VALUES (COALESCE((SELECT id FROM global_property_values WHERE property_key = ? AND property_value = ?), ?), 
              ?, ?, COALESCE((SELECT usage_count FROM global_property_values WHERE property_key = ? AND property_value = ?), 0) + 1, ?, ?)
    `,
      [
        propertyKey,
        propertyValue,
        id,
        propertyKey,
        propertyValue,
        propertyKey,
        propertyValue,
        now,
        now,
      ]
    );
  }
}
```

### Phase 2: Modal Architecture Redesign

#### A. Dynamic Modal Generation

```javascript
// In UnifiedResourceManager.js
async editUnifiedResource(resourceId) {
  try {
    const resource = await window.api.database.getResourceById(resourceId);
    const customProperties = await window.api.database.getCustomProperties(resourceId);
    const alternativeLocations = await window.api.database.getAlternativeLocations(resourceId);

    const modalContent = this.generateEditModalContent(resource, customProperties, alternativeLocations);

    return this.app.modules.modalManager.createDynamicModal('edit-resource-dynamic', modalContent, {
      onClose: () => this.handleEditModalClose(resourceId),
      onSubmit: (formData) => this.handleEditSubmit(resourceId, formData)
    });
  } catch (error) {
    console.error('[UnifiedResourceManager] Failed to open edit modal:', error);
  }
}

generateEditModalContent(resource, customProperties, alternativeLocations) {
  const isInternal = resource.state.type === 'internal';

  return `
    <div class="modal-header">
      <h3>Edit Resource</h3>
      <div class="resource-type-indicator">
        <span class="type-badge ${resource.state.type}">${isInternal ? 'Internal' : 'External'} Resource</span>
      </div>
    </div>

    <div class="modal-content">
      ${this.generateBasicInfoSection(resource)}
      ${this.generateLocationSection(resource, isInternal)}
      ${this.generateCustomPropertiesSection(customProperties)}
      ${this.generateAlternativeLocationsSection(alternativeLocations)}
      ${this.generateTagsSection(resource.properties['meridian:tags'] || [])}
    </div>

    <div class="modal-footer">
      <button type="button" class="secondary-btn" onclick="modalManager.closeModal()">Cancel</button>
      <button type="button" class="primary-btn" onclick="unifiedResourceManager.validateAndSubmitEdit()">Save Changes</button>
    </div>
  `;
}
```

#### B. Section Generators

```javascript
generateLocationSection(resource, isInternal) {
  if (isInternal) {
    return `
      <div class="form-section">
        <h4>File Location</h4>
        <div class="form-group">
          <label>File Path</label>
          <div class="file-path-browser">
            <input type="text" id="edit-file-path" value="${resource.locations.primary.value}" readonly>
            <button type="button" class="browse-btn" onclick="unifiedResourceManager.browseForFile()">Browse...</button>
          </div>
        </div>
        <div class="file-status">
          <span class="status-indicator ${resource.state.accessible ? 'accessible' : 'inaccessible'}">
            ${resource.state.accessible ? 'File Accessible' : 'File Not Found'}
          </span>
          <span class="last-verified">Last verified: ${new Date(resource.state.lastVerified).toLocaleString()}</span>
        </div>
      </div>
    `;
  } else {
    return `
      <div class="form-section">
        <h4>Primary URL</h4>
        <div class="form-group">
          <label>URL</label>
          <input type="url" id="edit-primary-url" value="${resource.locations.primary.value}" required>
          <div class="url-validation-status" id="primary-url-status"></div>
        </div>
      </div>
    `;
  }
}

generateCustomPropertiesSection(customProperties) {
  const propertiesHtml = customProperties.map(prop => `
    <div class="custom-property-item" data-key="${prop.property_key}">
      <div class="property-controls">
        <div class="property-key-container">
          <input type="text" class="property-key" value="${prop.property_key}" placeholder="Property Name"
                 onkeyup="unifiedResourceManager.handlePropertyKeyInput(this)"
                 onfocus="unifiedResourceManager.showPropertyKeyAutocomplete(this)">
          <div class="property-key-autocomplete" style="display: none;"></div>
        </div>
        <div class="property-value-container">
          <input type="text" class="property-value" value="${prop.property_value}" placeholder="Value"
                 onkeyup="unifiedResourceManager.handlePropertyValueInput(this, '${prop.property_key}')"
                 onfocus="unifiedResourceManager.showPropertyValueAutocomplete(this, '${prop.property_key}')">
          <div class="property-value-autocomplete" style="display: none;"></div>
        </div>
        <button type="button" class="remove-property-btn" onclick="unifiedResourceManager.removeCustomProperty('${prop.property_key}')">×</button>
      </div>
    </div>
  `).join('');

  return `
    <div class="form-section">
      <h4>Index Metadata <span class="help-text">(Global properties with autocomplete)</span></h4>
      <div class="custom-properties-list" id="custom-properties-list">
        ${propertiesHtml}
      </div>
      <button type="button" class="secondary-btn" onclick="unifiedResourceManager.addCustomProperty()">Add Property</button>
    </div>
  `;
}

generateAlternativeLocationsSection(alternativeLocations) {
  const arweaveUploads = alternativeLocations.filter(loc => loc.location_type === 'arweave-hash');
  const otherLocations = alternativeLocations.filter(loc => loc.location_type !== 'arweave-hash');

  return `
    <div class="form-section">
      <h4>Alternative Locations</h4>

      <div class="arweave-uploads-subsection">
        <h5>Arweave Uploads</h5>
        ${arweaveUploads.length > 0 ? arweaveUploads.map(upload => `
          <div class="arweave-upload-item" data-id="${upload.id}">
            <div class="upload-info">
              <span class="hash-link">
                <a href="https://arweave.net/${upload.location_value}" target="_blank">${upload.location_value.substring(0, 12)}...</a>
              </span>
              <span class="upload-date">${new Date(upload.created_at).toLocaleDateString()}</span>
              <span class="upload-metadata">${JSON.parse(upload.metadata || '{}').size || 'Unknown size'}</span>
              ${upload.is_external_arweave ? '<span class="external-badge">External</span>' : '<span class="system-badge">System</span>'}
            </div>
            <button type="button" class="remove-upload-btn" onclick="unifiedResourceManager.removeArweaveUpload('${upload.id}')">Remove</button>
          </div>
        `).join('') : '<p class="no-uploads">No Arweave uploads</p>'}

        <div class="arweave-actions">
          <button type="button" class="secondary-btn" onclick="unifiedResourceManager.addExternalArweaveHash()">Add External Hash</button>
        </div>
      </div>

      <div class="other-locations-subsection">
        <h5>Other URLs</h5>
        <div class="alternative-urls-list" id="alternative-urls-list">
          ${otherLocations.map(loc => `
            <div class="alternative-url-item" data-id="${loc.id}">
              <input type="url" value="${loc.location_value}" onchange="unifiedResourceManager.updateAlternativeLocation('${loc.id}', this.value)">
              <div class="url-status ${loc.is_accessible ? 'accessible' : loc.is_accessible === false ? 'inaccessible' : 'unchecked'}">
                ${loc.is_accessible === null ? 'Unchecked' : (loc.is_accessible ? 'Accessible' : 'Inaccessible')}
              </div>
              <button type="button" class="remove-url-btn" onclick="unifiedResourceManager.removeAlternativeLocation('${loc.id}')">×</button>
            </div>
          `).join('')}
        </div>
        <button type="button" class="secondary-btn" onclick="unifiedResourceManager.addAlternativeLocation()">Add URL</button>
      </div>
    </div>
  `;
}
```

### Phase 3: Validation and Submission

```javascript
async validateAndSubmitEdit() {
  const formData = this.collectFormData();
  const validationResults = await this.validateFormData(formData);

  if (validationResults.isValid) {
    await this.submitEditChanges(formData);
    this.app.modules.modalManager.closeModal();
    this.refreshResourceDisplay();
  } else {
    this.displayValidationErrors(validationResults.errors);
  }
}

async validateFormData(formData) {
  const errors = [];

  // URL validation for external resources and alternative locations
  if (formData.type === 'external') {
    const urlValid = await this.validateUrl(formData.primaryUrl);
    if (!urlValid.isAccessible) {
      errors.push({ field: 'primaryUrl', message: 'Primary URL is not accessible' });
    }
  }

  // Alternative URLs validation
  for (const altUrl of formData.alternativeUrls) {
    if (altUrl.value) {
      const urlValid = await this.validateUrl(altUrl.value);
      altUrl.isAccessible = urlValid.isAccessible;
    }
  }

  // Custom properties validation
  for (const prop of formData.customProperties) {
    if (!prop.key.trim()) {
      errors.push({ field: 'customProperties', message: 'Property key cannot be empty' });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    validatedData: formData
  };
}

async validateUrl(url) {
  try {
    // This would call a backend service to validate URL accessibility
    const result = await window.api.validateUrl(url);
    return { isAccessible: result.accessible, lastChecked: new Date().toISOString() };
  } catch (error) {
    return { isAccessible: false, error: error.message };
  }
}
```

### Phase 4: Integration with Existing Systems

#### A. TagManager Integration

```javascript
// Reuse existing tag functionality
setupTagsSection(existingTags) {
  const tagInput = document.getElementById('edit-resource-tags-input');
  const tagContainer = document.getElementById('edit-resource-tags-container');

  // Initialize with existing TagManager functionality
  this.app.modules.tagManager.initializeTagInput(tagInput, tagContainer, existingTags);
}
```

#### B. File Browser Integration

```javascript
async browseForFile() {
  try {
    // Get current workspace path for default directory
    const workspacePath = await window.api.getWorkspacePath();

    const filePath = await window.api.showOpenDialog({
      properties: ['openFile'],
      defaultPath: workspacePath, // Default to workspace but allow system-wide browsing
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (filePath && filePath.length > 0) {
      document.getElementById('edit-file-path').value = filePath[0];
      // Validate file accessibility
      const accessible = await window.api.validateFilePath(filePath[0]);
      this.updateFileStatus(accessible);
    }
  } catch (error) {
    console.error('[UnifiedResourceManager] File selection failed:', error);
  }
}

// Add external Arweave hash functionality
async addExternalArweaveHash() {
  const arweaveHash = prompt('Enter Arweave transaction hash:');
  if (arweaveHash && arweaveHash.length === 43) { // Arweave hashes are 43 characters
    try {
      await window.api.database.addAlternativeLocation(
        this.currentEditingResourceId,
        'arweave-hash',
        arweaveHash,
        { is_external_arweave: true }
      );
      this.refreshArweaveSection();
    } catch (error) {
      alert('Failed to add Arweave hash: ' + error.message);
    }
  } else {
    alert('Invalid Arweave hash. Please enter a valid 43-character hash.');
  }
}

// Custom property autocomplete handlers
async handlePropertyKeyInput(inputElement) {
  const searchTerm = inputElement.value;
  const suggestions = await window.api.database.getPropertyKeySuggestions(searchTerm);
  this.showPropertyKeySuggestions(inputElement, suggestions);
}

async handlePropertyValueInput(inputElement, propertyKey) {
  const searchTerm = inputElement.value;
  const suggestions = await window.api.database.getPropertyValueSuggestions(propertyKey, searchTerm);
  this.showPropertyValueSuggestions(inputElement, suggestions);
}

showPropertyKeySuggestions(inputElement, suggestions) {
  const container = inputElement.parentElement.querySelector('.property-key-autocomplete');
  // Reuse TagManager's autocomplete display logic
  this.app.modules.tagManager.displaySuggestions(container, suggestions, (suggestion) => {
    inputElement.value = suggestion.property_key;
    container.style.display = 'none';
  });
}

showPropertyValueSuggestions(inputElement, suggestions) {
  const container = inputElement.parentElement.querySelector('.property-value-autocomplete');
  // Reuse TagManager's autocomplete display logic
  this.app.modules.tagManager.displaySuggestions(container, suggestions, (suggestion) => {
    inputElement.value = suggestion.property_value;
    container.style.display = 'none';
  });
}
```

### Phase 2: Core Modal Infrastructure (Medium Priority - User Interface)

```javascript
// Phase 2A: Remove static HTML and implement dynamic modal
class UnifiedResourceManager extends ModuleBase {
  async editUnifiedResource(resourceId) {
    console.log(
      `[UnifiedResourceManager] Opening edit modal for resource: ${resourceId}`
    );

    try {
      // Load all required data in parallel for performance
      const [resource, customProperties, alternativeLocations] =
        await Promise.all([
          window.api.database.getResourceById(resourceId),
          window.api.database.getResourceCustomProperties(resourceId),
          window.api.database.getResourceAlternativeLocations(resourceId),
        ]);

      if (!resource) {
        throw new Error(`Resource not found: ${resourceId}`);
      }

      this.currentEditingResourceId = resourceId;
      const modalContent = this.generateEditModalContent(
        resource,
        customProperties,
        alternativeLocations
      );

      // Use ModalManager's createDynamicModal for consistency
      return this.app.modules.modalManager.createDynamicModal(
        "edit-resource-dynamic",
        modalContent,
        {
          onClose: () => this.handleEditModalClose(resourceId),
          onSubmit: () => this.validateAndSubmitEdit(),
          className: "edit-resource-modal large-modal",
        }
      );
    } catch (error) {
      console.error(
        "[UnifiedResourceManager] Failed to open edit modal:",
        error
      );
      this.app.modules.modalManager.showErrorModal(
        "Edit Resource Error",
        error.message
      );
    }
  }
}

// Phase 2B: Implement autocomplete integration with TagManager patterns
class CustomPropertyManager {
  constructor(app) {
    this.app = app;
    this.tagManager = app.modules.tagManager;
  }

  initializeCustomPropertyAutocomplete(containerElement) {
    // Initialize property key autocomplete using TagManager patterns
    const keyInputs = containerElement.querySelectorAll(".property-key");
    const valueInputs = containerElement.querySelectorAll(".property-value");

    keyInputs.forEach((input) => this.setupPropertyKeyAutocomplete(input));
    valueInputs.forEach((input) => this.setupPropertyValueAutocomplete(input));
  }

  setupPropertyKeyAutocomplete(inputElement) {
    // Reuse TagManager's autocomplete infrastructure
    this.tagManager.createAutocompleteInstance(inputElement, {
      dataSource: async (searchTerm) => {
        const suggestions = await window.api.database.getPropertyKeySuggestions(
          searchTerm
        );
        return suggestions.map((s) => ({
          label: s.property_key,
          value: s.property_key,
          count: s.usage_count,
        }));
      },
      onSelect: (suggestion) => {
        inputElement.value = suggestion.value;
        this.setupPropertyValueAutocompleteForKey(
          inputElement,
          suggestion.value
        );
      },
      placeholder: "Property name...",
      minChars: 1,
    });
  }
}
```

### Phase 3: Advanced Features & Performance (Low Priority - Enhancement)

```javascript
// Phase 3A: Advanced validation and batch operations
class EditResourceValidator {
  constructor(app) {
    this.app = app;
  }

  async validateFormData(formData) {
    const validationResults = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Parallel validation for performance
    const validationPromises = [
      this.validateResourceBasics(formData),
      this.validateCustomProperties(formData.customProperties),
      this.validateAlternativeLocations(formData.alternativeLocations),
    ];

    if (formData.type === "internal") {
      validationPromises.push(this.validateFilePath(formData.filePath));
    }

    const results = await Promise.allSettled(validationPromises);

    results.forEach((result) => {
      if (result.status === "rejected") {
        validationResults.errors.push(result.reason.message);
        validationResults.isValid = false;
      } else if (result.value.warnings) {
        validationResults.warnings.push(...result.value.warnings);
      }
    });

    return validationResults;
  }

  async validateCustomProperties(customProperties) {
    const errors = [];
    const propertyKeys = new Set();

    for (const prop of customProperties) {
      // Check for duplicate keys
      if (propertyKeys.has(prop.key)) {
        errors.push(`Duplicate property key: ${prop.key}`);
      }
      propertyKeys.add(prop.key);

      // Validate key format
      if (!prop.key.trim() || prop.key.includes(" ")) {
        errors.push(`Invalid property key format: ${prop.key}`);
      }

      // Validate value based on data type
      const dataType = await this.getPropertyDataType(prop.key);
      if (!this.isValidPropertyValue(prop.value, dataType)) {
        errors.push(`Invalid value for ${prop.key}: expected ${dataType}`);
      }
    }

    return { errors, warnings: [] };
  }
}

// Phase 3B: Performance optimizations
class PerformanceOptimizer {
  constructor() {
    this.propertyCache = new Map();
    this.debounceTimers = new Map();
  }

  // Debounced autocomplete to reduce database calls
  debouncedAutocomplete(inputElement, searchFunction, delay = 300) {
    const timerId = this.debounceTimers.get(inputElement);
    if (timerId) clearTimeout(timerId);

    this.debounceTimers.set(
      inputElement,
      setTimeout(async () => {
        await searchFunction();
        this.debounceTimers.delete(inputElement);
      }, delay)
    );
  }

  // Cache frequently used property definitions
  async getCachedPropertyKeys(searchTerm = "") {
    const cacheKey = `property_keys_${searchTerm}`;

    if (!this.propertyCache.has(cacheKey)) {
      const results = await window.api.database.getPropertyKeySuggestions(
        searchTerm
      );
      this.propertyCache.set(cacheKey, results);

      // Auto-expire cache after 5 minutes
      setTimeout(() => this.propertyCache.delete(cacheKey), 5 * 60 * 1000);
    }

    return this.propertyCache.get(cacheKey);
  }
}
```

### Phase 4: Integration Testing & Deployment (Critical - Quality Assurance)

```javascript
// Phase 4A: Comprehensive testing suite
class EditResourceModalTests {
  constructor(app) {
    this.app = app;
  }

  async runAllTests() {
    console.log(
      "[EditResourceModalTests] Starting comprehensive test suite..."
    );

    const testSuites = [
      this.testDatabaseMigration(),
      this.testModalGeneration(),
      this.testFormValidation(),
      this.testCustomPropertiesAutocomplete(),
      this.testAlternativeLocationsManagement(),
      this.testPerformanceRequirements(),
    ];

    const results = await Promise.allSettled(testSuites);

    const passed = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(
      `[EditResourceModalTests] Tests completed: ${passed} passed, ${failed} failed`
    );

    if (failed > 0) {
      throw new Error(`${failed} tests failed. See console for details.`);
    }
  }

  async testCustomPropertiesAutocomplete() {
    // Test global property key suggestions
    const keySuggestions = await window.api.database.getPropertyKeySuggestions(
      "test"
    );
    assert(
      Array.isArray(keySuggestions),
      "Property key suggestions should return array"
    );

    // Test property value suggestions
    if (keySuggestions.length > 0) {
      const valueSuggestions =
        await window.api.database.getPropertyValueSuggestions(
          keySuggestions[0].property_key,
          ""
        );
      assert(
        Array.isArray(valueSuggestions),
        "Property value suggestions should return array"
      );
    }

    console.log(
      "[EditResourceModalTests] Custom properties autocomplete tests passed"
    );
  }

  async testPerformanceRequirements() {
    const resourceId = await this.createTestResource();

    // Test modal load time < 500ms
    const startTime = performance.now();
    await this.app.modules.unifiedResourceManager.editUnifiedResource(
      resourceId
    );
    const loadTime = performance.now() - startTime;

    assert(
      loadTime < 500,
      `Modal load time ${loadTime}ms exceeds 500ms requirement`
    );

    console.log(
      `[EditResourceModalTests] Performance test passed: ${loadTime}ms load time`
    );
  }
}

// Phase 4B: Deployment checklist
const DEPLOYMENT_CHECKLIST = {
  database: [
    "✓ Schema migration tested with backup/rollback",
    "✓ Indexes created for performance",
    "✓ Foreign key constraints validated",
    "✓ Data integrity verification completed",
  ],
  ui: [
    "✓ Modal renders correctly for both internal/external resources",
    "✓ Autocomplete functions properly for custom properties",
    "✓ File browser defaults to workspace with system-wide access",
    "✓ Arweave hash addition works for external hashes",
  ],
  integration: [
    "✓ ModalManager integration follows established patterns",
    "✓ TagManager autocomplete reused successfully",
    "✓ UnifiedDatabaseManager methods extended properly",
    "✓ Error handling and logging implemented",
  ],
  performance: [
    "✓ Modal load time < 500ms verified",
    "✓ Database queries optimized with proper indexing",
    "✓ Autocomplete debouncing implemented",
    "✓ Memory usage monitored for extensive properties",
  ],
};
```

## Success Criteria

### Functional Requirements

- ✅ Type-specific form fields (internal vs external)
- ✅ Custom Index Metadata properties management
- ✅ Alternative locations CRUD with validation
- ✅ File path browser for internal resources
- ✅ Arweave upload management (read-only metadata)
- ✅ Real-time URL accessibility validation
- ✅ Integration with existing ModalManager

### Performance Requirements

- ⚡ Modal load time < 500ms
- ⚡ Form validation response < 200ms
- ⚡ Database operations < 300ms

### Data Integrity

- 🔒 Database constraints enforce data validity
- 🔒 URL validation before storage
- 🔒 File path validation prevents traversal attacks
- 🔒 Custom properties maintain referential integrity

### User Experience

- 🎯 Mobile-responsive design
- 🎯 Keyboard navigation support
- 🎯 Clear validation error messages
- 🎯 Consistent with existing UI patterns

## Risk Mitigation

### Data Migration

- **Backup Strategy**: Full database backup before schema changes
- **Rollback Plan**: SQL scripts to revert schema changes
- **Testing**: Comprehensive testing with existing data

### Performance Impact

- **Indexing**: Proper indexes on foreign keys and frequently queried fields
- **Lazy Loading**: Load alternative locations and custom properties on demand
- **Caching**: Cache custom property definitions

### Security Considerations

- **Input Sanitization**: All user inputs sanitized and validated
- **Path Validation**: File paths checked for directory traversal
- **URL Validation**: Comprehensive URL validation and sandboxing
