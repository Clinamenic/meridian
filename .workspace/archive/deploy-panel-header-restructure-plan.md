# Deploy Panel Header Restructure Plan

## Overview

Move the Configure, Build, and Publish buttons from the current `deploy-phase-cards` workflow section into the deploy panel header, while preserving the three-column structure and removing the Site Status readout from the header.

## Current Architecture Analysis

### Current Structure

1. **Panel Header** (`#deploy-panel .panel-header`)

   - Left: Site Status readout (`#deploy-site-status`)
   - Right: Empty (commented as "Site settings now handled by Configure button in workflow cards")

2. **Panel Content** (`#deploy-panel .panel-content`)
   - `deploy-phase-cards` container with three-column layout:
     - Configure phase card (with Configure button)
     - Build phase card (with Build button)
     - Publish phase card (with Publish button)
   - Build logs section
   - Composition breakdown section

### Current Button IDs and Event Handlers

- `configure-workflow-btn` → `openConfigurationModal()`
- `build-preview-workflow-btn` → `buildSiteWithPreview()`
- `deploy-workflow-btn` → `deploySite()` (delegated event listener)

## Proposed Changes

### 1. Panel Header Restructure

**New Header Layout:**

```html
<div class="panel-header">
  <div class="panel-header-left">
    <div class="panel-title">
      <span>Deploy</span>
    </div>
  </div>
  <div class="panel-header-right">
    <div class="deploy-workflow-buttons">
      <div class="workflow-button-group">
        <div class="phase-number">1</div>
        <button class="panel-header-btn" id="configure-header-btn">
          Configure
        </button>
      </div>
      <div class="workflow-button-group">
        <div class="phase-number">2</div>
        <button class="panel-header-btn" id="build-header-btn">Build</button>
      </div>
      <div class="workflow-button-group">
        <div class="phase-number">3</div>
        <button class="panel-header-btn" id="publish-header-btn">
          Publish
        </button>
      </div>
    </div>
  </div>
</div>
```

### 2. Content Section Updates

**Remove workflow cards from content:**

- Remove entire `deploy-phase-cards` section
- Keep build logs and composition sections
- Update content layout to fill available space

### 3. CSS Updates Required

#### New Header Button Styles

```css
.deploy-workflow-buttons {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.workflow-button-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.workflow-button-group .phase-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: var(--surface-border);
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  font-weight: 600;
  flex-shrink: 0;
}

.workflow-button-group.active .phase-number {
  background-color: var(--theme-primary);
  color: white;
}

.workflow-button-group.completed .phase-number {
  background-color: var(--success-color);
  color: white;
}

.workflow-button-group.disabled .phase-number {
  background-color: var(--surface-border);
  color: var(--text-disabled);
}
```

#### Update Existing Styles

- Remove `.deploy-phase-cards` styles (or mark as deprecated)
- Update `.deploy-main-content` to remove gap for workflow cards
- Ensure header buttons use existing `.panel-header-btn` base styles

### 4. JavaScript Updates Required

#### DeployManager.js Changes

1. **Update `renderDeployStatus()` method:**

   - Remove workflow cards HTML generation
   - Update button event listeners to use new header button IDs
   - Preserve all existing functionality

2. **Update event handlers:**

   - `configure-header-btn` → `openConfigurationModal()`
   - `build-header-btn` → `buildSiteWithPreview()`
   - `publish-header-btn` → `deploySite()`

3. **Add header button state management:**
   - Update button states based on Quartz initialization status
   - Maintain visual feedback for active/completed/disabled states
   - Preserve existing phase progression logic

#### Event Listener Updates

```javascript
// Update setupDeployEvents() method
setupDeployEvents() {
  // Configure button
  document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'configure-header-btn') {
      await this.openConfigurationModal();
    }
  });

  // Build button
  document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'build-header-btn') {
      await this.buildSiteWithPreview();
    }
  });

  // Deploy button (existing delegated listener)
  document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'publish-header-btn') {
      // Existing deploy logic
    }
  });
}
```

### 5. State Management Updates

**Preserve existing state logic:**

- Quartz initialization status
- Build completion status
- Deployment readiness
- Button enable/disable states

**Update visual state indicators:**

- Active phase highlighting
- Completed phase styling
- Disabled state handling

## Implementation Phases

### Phase 1: CSS Foundation

1. Add new header button styles
2. Create workflow button group styles
3. Update panel header layout styles
4. Test visual appearance

### Phase 2: HTML Structure

1. Update panel header HTML in `index.html`
2. Remove workflow cards from `renderDeployStatus()`
3. Update content layout structure
4. Test basic layout

### Phase 3: JavaScript Integration

1. Update button event handlers
2. Implement header button state management
3. Preserve all existing functionality
4. Test button interactions

### Phase 4: State Management

1. Update visual state indicators
2. Implement phase progression logic
3. Test state transitions
4. Verify all edge cases

### Phase 5: Cleanup

1. Remove deprecated CSS classes
2. Clean up unused HTML templates
3. Update documentation
4. Final testing

## Benefits of This Approach

### 1. Improved UX

- More prominent action buttons in header
- Consistent with other panel patterns
- Better visual hierarchy

### 2. Space Efficiency

- Frees up content area for build logs and composition
- Reduces vertical scrolling
- Better use of horizontal space

### 3. Consistency

- Aligns with ResourceManager and BroadcastManager patterns
- Standardized panel header approach
- Consistent button styling

### 4. Maintainability

- Centralized button management
- Clearer separation of concerns
- Easier to extend with additional actions

## Risk Mitigation

### 1. Preserve Functionality

- Maintain all existing event handlers
- Keep state management logic intact
- Preserve phase progression

### 2. Visual Consistency

- Use existing design system variables
- Maintain button styling consistency
- Preserve color scheme and spacing

### 3. Responsive Design

- Ensure header buttons work on smaller screens
- Maintain accessibility standards
- Test across different window sizes

## Testing Checklist

### Functional Testing

- [ ] Configure button opens configuration modal
- [ ] Build button triggers build with preview
- [ ] Publish button opens deployment modal
- [ ] Button states update correctly based on Quartz status
- [ ] Phase progression works as expected

### Visual Testing

- [ ] Header layout matches design
- [ ] Button styling is consistent
- [ ] State indicators work correctly
- [ ] Responsive behavior is appropriate
- [ ] No layout shifts or visual glitches

### Integration Testing

- [ ] All existing functionality preserved
- [ ] No console errors
- [ ] Performance impact is minimal
- [ ] Accessibility standards maintained

## Files to Modify

### Primary Changes

1. `src/renderer/index.html` - Update panel header structure
2. `src/renderer/modules/DeployManager.js` - Update rendering and event handlers
3. `src/renderer/styles/modules/deploy-manager.css` - Add new styles, update existing

### Potential Impact

1. `src/renderer/styles/main.css` - May need panel header style updates
2. `src/renderer/modules/ModuleLoader.js` - No changes needed
3. `src/renderer/app.js` - No changes needed

## Success Criteria

1. **Functionality Preserved**: All existing deploy functionality works exactly as before
2. **Visual Improvement**: Header layout is cleaner and more intuitive
3. **Space Efficiency**: Content area has more room for build logs and composition
4. **Consistency**: Matches patterns used in other panels
5. **Performance**: No degradation in performance or responsiveness
