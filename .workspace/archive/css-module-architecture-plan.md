# CSS Module Architecture Implementation Plan

## Executive Summary

This document outlines a strategy for introducing module-specific CSS files to the Meridian project while maintaining the existing global stylesheet approach. The goal is to improve maintainability, scalability, and developer experience by organizing CSS alongside corresponding JavaScript modules.

## Current State Analysis

### Existing Structure

- **Single Global CSS**: All styles are consolidated in `src/renderer/styles.css` (~7000+ lines)
- **Modular JavaScript**: Well-organized module system with clear separation:
  - `ResourceManager.js` - Resource/archive management
  - `BroadcastManager.js` - Social media and broadcasting
  - `DeployManager.js` - Site deployment and configuration
  - `ModalManager.js` - Modal dialogs and overlays
  - `AccountManager.js` - Account/wallet management
  - `UploadManager.js` - File upload operations
  - `TagManager.js` - Tag management utilities

### Pain Points

- Large monolithic CSS file is difficult to navigate
- No clear association between CSS and related JavaScript modules
- Higher risk of CSS conflicts and cascading issues
- Difficult to identify unused/dead CSS code
- Challenging for multiple developers to work on styles simultaneously

## Proposed Architecture

### 1. Hybrid Approach: Global + Module-Specific CSS

**Philosophy**: Maintain global consistency while enabling module-specific styling.

```
src/renderer/
├── styles/
│   ├── modules/
│   │   ├── resource-manager.css
│   │   ├── broadcast-manager.css
│   │   ├── deploy-manager.css
│   │   ├── modal-manager.css
│   │   ├── account-manager.css
│   │   └── upload-manager.css
│   └── styles.css (keeps current global styles + imports modules)
├── modules/
│   ├── ResourceManager.js
│   ├── BroadcastManager.js
│   └── [other modules...]
└── index.html
```

### 2. CSS Architecture Methodology

**Base Strategy**: ITCSS (Inverted Triangle CSS) with BEM naming conventions

#### Layer Structure:

1. **Settings** (`styles.css` - top section) - CSS custom properties, design tokens
2. **Tools** - Mixins and functions (if using preprocessor)
3. **Generic** (`styles.css` - reset section) - Normalize, box-sizing, resets
4. **Elements** (`styles.css` - typography section) - Base HTML element styles
5. **Objects** (`styles.css` - layout section) - Layout patterns, grid systems
6. **Components** (module files) - UI components and modules
7. **Utilities** (`styles.css` - utilities section) - Helper classes, overrides

#### Naming Conventions:

- **Global Components**: `.c-component-name`
- **Module Components**: `.m-module-name__element--modifier`
- **Layout Objects**: `.l-layout-name`
- **Utilities**: `.u-utility-name`
- **States**: `.is-state` / `.has-state`

### 3. Module-Specific CSS Structure

Each module CSS file follows a consistent pattern:

```css
/* modules/resource-manager.css */

/* Module-specific variables */
:root {
  --resource-item-padding: 1rem;
  --resource-item-border: 1px solid var(--surface-border);
}

/* Main module container */
.m-resource-manager {
  /* Container styles */
}

/* Module components using BEM */
.m-resource-item {
  padding: var(--resource-item-padding);
  border: var(--resource-item-border);
}

.m-resource-item__header {
  /* Header styles */
}

.m-resource-item__title {
  /* Title styles */
}

.m-resource-item--collapsed {
  /* Collapsed state */
}

/* Module-specific utilities (scoped) */
.m-resource-manager .u-fade-out {
  /* Module-specific utility override */
}
```

## Implementation Strategy

### Phase 1: Foundation Setup (Week 1)

1. **Create directory structure**

   ```bash
   mkdir -p src/renderer/styles/modules
   ```

2. **Add module imports to existing `styles.css`**:

   Add the following import statements at the bottom of the current `styles.css` file:

   ```css
   /* === MODULE-SPECIFIC STYLES === */
   @import url("./modules/modal-manager.css");
   @import url("./modules/account-manager.css");
   @import url("./modules/upload-manager.css");
   @import url("./modules/broadcast-manager.css");
   @import url("./modules/deploy-manager.css");
   @import url("./modules/resource-manager.css");
   ```

3. **No changes to existing global styles**:
   - Keep all current styles in `styles.css` untouched
   - This minimizes risk and maintains current functionality
   - Global style cleanup can be a separate future phase

### Phase 2: Module Extraction (Weeks 2-3)

**Priority Order** (based on complexity and independence):

1. `modal-manager.css` - Self-contained modal styles
2. `account-manager.css` - Account/wallet interface styles
3. `upload-manager.css` - Upload interface and progress styles
4. `broadcast-manager.css` - Social media and broadcast interface
5. `deploy-manager.css` - Deployment dashboard and configuration
6. `resource-manager.css` - Resource list and archive management

**Per-module process (Conservative Approach)**:

1. **Identify** all CSS selectors related to the module in current `styles.css`
2. **Copy** (don't move) these styles to dedicated module CSS file
3. **Rename** selectors in module file using BEM convention (`.m-module-name__element--modifier`)
4. **Update** JavaScript module to use new class names
5. **Test** module functionality with new styles
6. **Remove** old selectors from `styles.css` only after confirming new ones work
7. **Clean up** any unused styles left in main file

### Phase 3: Optimization (Week 4)

1. **Dead code elimination** - Remove unused CSS rules
2. **Performance audit** - Ensure CSS bundle size doesn't increase significantly
3. **Documentation** - Create style guide for new patterns
4. **Testing** - Comprehensive visual regression testing

## Benefits and Advantages

### Conservative Implementation Benefits

- **Lower risk migration**: No need to extract existing global styles
- **Maintains current functionality**: All existing styles remain untouched
- **Gradual adoption**: Modules can be added incrementally without disruption
- **Easy rollback**: Module imports can be removed if issues arise
- **No build changes required**: Uses standard CSS @import functionality

### Developer Experience

- **Faster navigation**: Find styles related to specific functionality quickly
- **Reduced conflicts**: Smaller, focused files reduce merge conflicts
- **Parallel development**: Multiple developers can work on different modules
- **Clearer ownership**: Obvious relationship between CSS and JS modules

### Maintainability

- **Easier refactoring**: Module-specific styles are self-contained
- **Dead code detection**: Unused module styles are easier to identify
- **Consistent patterns**: BEM naming provides predictable structure
- **Scalability**: New modules follow established patterns

### Performance

- **Potential for code splitting**: Future optimization for loading only needed CSS
- **Better caching**: Module-specific CSS can be cached independently
- **Reduced specificity conflicts**: Better cascade management

## Risk Assessment and Mitigation

### Risks

1. **Increased complexity** - More files to manage
2. **Import order dependencies** - CSS cascade order matters
3. **Duplication potential** - Similar styles might be repeated across modules
4. **Learning curve** - Team needs to adopt new conventions

### Mitigation Strategies

1. **Clear documentation** and style guide
2. **Automated tooling** for CSS organization and linting
3. **Progressive adoption** - migrate one module at a time
4. **Code review process** to maintain consistency
5. **Shared design tokens** in global variables to prevent duplication

## Success Metrics

### Quantitative

- **Reduction in main CSS file size** (target: <2000 lines)
- **Improved build performance** (CSS processing time)
- **Reduced specificity scores** (average specificity per selector)
- **Developer survey scores** on CSS maintainability

### Qualitative

- **Easier onboarding** for new developers
- **Faster feature development** cycle
- **Reduced styling-related bugs**
- **Better design system consistency**

## Implementation Timeline

- **Week 1**: Foundation setup and module imports (low-risk, quick setup)
- **Week 2**: First 3 modules (modal, account, upload) - copy/test/replace approach
- **Week 3**: Remaining 3 modules (broadcast, deploy, resource) - copy/test/replace approach
- **Week 4**: Optimization, cleanup, and documentation

_Note: Conservative approach reduces timeline risk and allows for flexible pacing based on testing results._

## Future Considerations

### PostCSS Integration

Consider adding PostCSS for:

- CSS nesting support
- Autoprefixer for browser compatibility
- CSS custom property fallbacks
- Minification and optimization

### CSS-in-JS Alternative

For future consideration, evaluate CSS-in-JS solutions:

- Scoped styles by default
- Dynamic styling based on JavaScript state
- Bundle size optimization
- Component co-location

### Design System Evolution

This architecture supports future design system development:

- Design token management
- Component library extraction
- Documentation generation
- Cross-project style sharing

## Conclusion

The proposed CSS module architecture strikes a balance between maintaining the simplicity of the current approach while introducing the benefits of modular organization. By aligning CSS structure with the existing JavaScript module architecture, we create a more maintainable and scalable codebase that supports the growing complexity of the Meridian application.

The phased implementation approach minimizes risk while delivering immediate benefits to developer productivity and long-term maintainability.
