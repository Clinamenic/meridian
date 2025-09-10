# Collapsible Sections Implementation Plan

## Overview

Implement collapsible sections for all three main sections in the Configure subtab (Initialization, Site Settings, and Custom Ignore Patterns) using the same pattern as the existing Build Logs section.

## Current Architecture Analysis

### Existing Collapsible Pattern (Build Logs)

- **Location**: `src/renderer/modules/DeployManager.js` lines 1499-1530
- **CSS Classes**:
  - `.build-logs-section` - Container with background, border, border-radius
  - `.section-header` - Header with flex layout, background, padding
  - `.build-logs-content` - Content area with transition animations
  - `.collapsed` - State class for collapsed content
- **JavaScript**: Toggle functionality via `setupPreviewControls()` method
- **HTML Structure**: Header with button + content area

### Current Configure Subtab Sections

- **Initialization**: Template selection (vanilla, clinamenic, custom)
- **Site Settings**: Title, description, base URL
- **Custom Ignore Patterns**: Textarea for additional ignore patterns

## Implementation Plan

### Phase 1: Extract Global Styles to main.css

#### 1.1 Move Generic Collapsible Styles

**From**: `src/renderer/styles/modules/deploy-manager.css`
**To**: `src/renderer/styles/main.css`

**Styles to move**:

```css
/* Generic collapsible section styles */
.collapsible-section {
  background-color: var(--surface-bg-elevated);
  border: 1px solid var(--surface-border);
  border-radius: var(--border-radius-lg);
  margin-bottom: var(--spacing-md);
  overflow: hidden;
}

.section-header {
  height: var(--header-height-lg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--surface-bg-subtle);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.section-header:hover {
  background-color: var(--surface-bg-elevated);
}

.section-header h4 {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 400;
  color: var(--text-primary);
}

.section-content {
  padding: var(--spacing-md);
  overflow: hidden;
  transition: max-height 0.3s ease, opacity 0.2s ease;
}

.collapsible-section.collapsed .section-content {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.collapsible-section:not(.collapsed) .section-content {
  max-height: 1000px; /* Adjust based on content */
  opacity: 1;
}

.expand-btn {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-sm);
  background-color: transparent;
  border: 1px solid var(--surface-border);
  border-radius: var(--border-radius);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.expand-btn:hover {
  background-color: var(--surface-bg-subtle);
  color: var(--text-primary);
}

.expand-btn svg {
  transition: transform 0.2s ease;
  transform: rotate(180deg);
}

.collapsible-section.collapsed .expand-btn svg {
  transform: rotate(0deg);
}
```

#### 1.2 Update Build Logs to Use Global Styles

**File**: `src/renderer/styles/modules/deploy-manager.css`

**Changes**:

- Remove duplicate styles that are now in main.css
- Keep only build-logs-specific overrides
- Update class names to use new global pattern

### Phase 2: Update Configure Subtab HTML Structure

#### 2.1 Modify generateConfigurationFormContent()

**File**: `src/renderer/modules/DeployManager.js`

**Changes**:

```javascript
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
              <!-- Existing template options content -->
            </div>
            <div class="form-group" id="custom-template-group" style="display: ${currentTemplate.id !== 'vanilla-quartz' && currentTemplate.id !== 'clinamenic-quartz' ? 'block' : 'none'};">
              <!-- Existing custom template content -->
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
            <!-- Existing site settings form groups -->
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
            <!-- Existing ignore patterns content -->
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
```

### Phase 3: Add JavaScript Functionality

#### 3.1 Add Collapsible Section Management

**File**: `src/renderer/modules/DeployManager.js`

**New Methods**:

```javascript
setupCollapsibleSections() {
  // Set up click handlers for all section headers
  const sectionHeaders = document.querySelectorAll('.collapsible-section .section-header');

  sectionHeaders.forEach(header => {
    header.addEventListener('click', (e) => {
      // Don't toggle if clicking on the expand button (it has its own handler)
      if (e.target.closest('.expand-btn')) {
        return;
      }

      const section = header.closest('.collapsible-section');
      this.toggleSection(section);
    });
  });

  // Set up expand button handlers
  const expandButtons = document.querySelectorAll('.collapsible-section .expand-btn');

  expandButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent header click
      const section = button.closest('.collapsible-section');
      this.toggleSection(section);
    });
  });
}

toggleSection(section) {
  const isCollapsed = section.classList.contains('collapsed');

  if (isCollapsed) {
    section.classList.remove('collapsed');
  } else {
    section.classList.add('collapsed');
  }

  // Save state to localStorage
  this.saveSectionState(section.id, !isCollapsed);
}

saveSectionState(sectionId, isExpanded) {
  const sectionStates = JSON.parse(localStorage.getItem('deploySectionStates') || '{}');
  sectionStates[sectionId] = isExpanded;
  localStorage.setItem('deploySectionStates', JSON.stringify(sectionStates));
}

loadSectionStates() {
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
}
```

#### 3.2 Update Event Setup

**File**: `src/renderer/modules/DeployManager.js`

**Modify**: `setupConfigurationFormEvents()` method

```javascript
setupConfigurationFormEvents(isInitialized, currentSettings) {
  // Existing event setup code...

  // Add collapsible section functionality
  this.setupCollapsibleSections();
  this.loadSectionStates();

  // Rest of existing code...
}
```

### Phase 4: Update Build Logs to Use New Pattern

#### 4.1 Update Build Logs HTML Structure

**File**: `src/renderer/modules/DeployManager.js`

**Modify**: `generateBuildContent()` method

```javascript
generateBuildContent() {
  return `
    <div class="deploy-main-content">
      <!-- Build Logs Section -->
      <div class="collapsible-section" id="build-logs-section">
        <div class="section-header" data-section="build-logs">
          <div class="section-header-left">
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
          <button type="button" class="expand-btn" id="build-logs-toggle" aria-label="Toggle build logs">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="section-content">
          <pre id="build-logs-output"></pre>
        </div>
      </div>
    </div>
  `;
}
```

#### 4.2 Update Build Logs Event Handling

**File**: `src/renderer/modules/DeployManager.js`

**Modify**: `setupPreviewControls()` method

```javascript
setupPreviewControls() {
  // Build logs toggle - now uses global collapsible pattern
  const buildLogsToggle = document.getElementById('build-logs-toggle');
  if (buildLogsToggle) {
    buildLogsToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const buildLogsSection = document.getElementById('build-logs-section');
      if (buildLogsSection) {
        this.toggleSection(buildLogsSection);
      }
    });
  }

  // Rest of existing code...
}
```

### Phase 5: CSS Refinements

#### 5.1 Add Section-Specific Styles

**File**: `src/renderer/styles/modules/deploy-manager.css`

**Add**:

```css
/* Section-specific overrides */
#initialization-section .section-header {
  border-bottom: 1px solid var(--surface-border);
}

#site-settings-section .section-content {
  padding-top: var(--spacing-lg);
}

#ignore-patterns-section .section-content {
  padding-top: var(--spacing-lg);
}

/* Build logs specific styles */
#build-logs-section .section-header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

#build-logs-section .section-content pre {
  margin: 0;
  font-family: var(--standard-font-mono);
  font-size: var(--font-size-sm);
  line-height: 1.4;
  background-color: var(--surface-bg);
  padding: var(--spacing-md);
  border-radius: var(--border-radius);
  max-height: 400px;
  overflow-y: auto;
}
```

## Implementation Order

1. **Phase 1**: Extract global styles to main.css
2. **Phase 2**: Update Configure subtab HTML structure
3. **Phase 3**: Add JavaScript functionality
4. **Phase 4**: Update Build Logs to use new pattern
5. **Phase 5**: CSS refinements and testing

## Benefits

1. **Consistency**: All sections use the same collapsible pattern
2. **Reusability**: Global styles can be used across other modules
3. **User Experience**: Users can focus on relevant sections
4. **State Persistence**: Section states are saved between sessions
5. **Accessibility**: Proper ARIA labels and keyboard navigation

## Testing Checklist

- [ ] All sections collapse/expand correctly
- [ ] Section states persist between page reloads
- [ ] Build logs functionality still works
- [ ] Form submission still works
- [ ] Responsive design maintained
- [ ] Keyboard navigation works
- [ ] Screen reader compatibility
- [ ] Animation smoothness
- [ ] No console errors
