# OrganicWaveRenderer to TopologyRenderer Transition Plan

## Overview

This document outlines the comprehensive transition plan for renaming `OrganicWaveRenderer.js` to `TopologyRenderer.js` and updating all related references throughout the codebase.

## Rationale

The name "TopologyRenderer" better reflects the component's purpose of rendering topological terrain visualizations with elevation mapping and contour lines, moving away from the more abstract "organic wave" terminology.

## Files Requiring Updates

### 1. Core Renderer File

- **Current**: `src/renderer/js/OrganicWaveRenderer.js`
- **Target**: `src/renderer/js/TopologyRenderer.js`
- **Changes**:
  - Rename file
  - Update class name from `OrganicWaveRenderer` to `TopologyRenderer`
  - Update export statement
  - Update error messages and console logs

### 2. Import/Export References

#### Landing Page (`src/renderer/landing.js`)

```javascript
// Current
import { OrganicWaveRenderer } from "./js/OrganicWaveRenderer.js";
this.marblingRenderer = new OrganicWaveRenderer(canvas, "landing");

// Target
import { TopologyRenderer } from "./js/TopologyRenderer.js";
this.marblingRenderer = new TopologyRenderer(canvas, "landing");
```

#### Main App (`src/renderer/app.js`)

```javascript
// Current
this.marblingRenderer = new OrganicWaveRenderer(
  canvas,
  OrganicWaveRenderer.presets.meridianDefault
);

// Target
this.marblingRenderer = new TopologyRenderer(
  canvas,
  TopologyRenderer.presets.meridianDefault
);
```

### 3. HTML Script References

#### Landing Page (`src/renderer/landing.html`)

```html
<!-- Current -->
<script type="module" src="js/OrganicWaveRenderer.js"></script>

<!-- Target -->
<script type="module" src="js/TopologyRenderer.js"></script>
```

#### Main App (`src/renderer/index.html`)

```html
<!-- Current -->
<script src="js/OrganicWaveRenderer.js"></script>

<!-- Target -->
<script src="js/TopologyRenderer.js"></script>
```

### 4. Documentation Updates

#### CHANGELOG.md

- **IMPORTANT**: Do NOT update historical references to "OrganicWaveRenderer" in the changelog
- The changelog should preserve accurate historical development records
- Only add new entries using "TopologyRenderer" for future changes
- Historical entries at lines 56, 79, 89 should remain unchanged as they reflect the actual development timeline

## Variable Naming Considerations

### Current Variable Names to Review

- `marblingRenderer` - Consider renaming to `topologyRenderer` for consistency
- `marbling-canvas` - Consider renaming to `topology-canvas`
- `marbling-background` CSS class - Consider renaming to `topology-background`

### Recommended Variable Renaming Strategy

#### Option A: Full Consistency (Recommended)

- `marblingRenderer` → `topologyRenderer`
- `marbling-canvas` → `topology-canvas`
- `marbling-background` → `topology-background`

#### Option B: Minimal Changes

- Keep existing variable names to minimize impact
- Only rename the class and file

## Implementation Steps

### Phase 1: File Rename and Class Update

1. Rename `OrganicWaveRenderer.js` to `TopologyRenderer.js`
2. Update class name in the file
3. Update export statement
4. Update internal error messages and console logs

### Phase 2: Import/Export Updates

1. Update `landing.js` import statement
2. Update `app.js` class instantiation
3. Update HTML script references

### Phase 3: Documentation Updates

1. **Preserve CHANGELOG.md historical entries** - do not modify existing references to "OrganicWaveRenderer"
2. Update any inline comments or documentation in code files
3. Add new changelog entry documenting the rename transition

### Phase 4: Variable Renaming (Optional)

1. Rename `marblingRenderer` to `topologyRenderer`
2. Rename `marbling-canvas` to `topology-canvas`
3. Rename `marbling-background` CSS class to `topology-background`
4. Update all references to these variables

## Testing Checklist

### Functionality Testing

- [ ] Landing page renders correctly with new renderer
- [ ] Main app renders correctly with new renderer
- [ ] All preset configurations work
- [ ] Animation and interaction features work
- [ ] Error handling works correctly

### Import/Export Testing

- [ ] Module imports work correctly
- [ ] Class instantiation works
- [ ] Static methods are accessible
- [ ] Preset configurations are available

### Visual Testing

- [ ] Canvas rendering is identical
- [ ] Animation performance is maintained
- [ ] Responsive behavior is preserved
- [ ] Error fallbacks work correctly

## Rollback Plan

### Quick Rollback

1. Revert file rename
2. Revert class name changes
3. Revert import statements
4. Revert HTML references

### Full Rollback

1. Restore all original variable names
2. Restore all original CSS classes
3. Restore all documentation references (except changelog historical entries)

## Risk Assessment

### Low Risk

- File rename and class name change
- Import/export updates
- Documentation updates

### Medium Risk

- Variable renaming (if chosen)
- CSS class renaming (if chosen)
- Potential for missed references

### Mitigation Strategies

- Use search and replace with careful review
- Test each change incrementally
- Maintain git history for easy rollback
- Use IDE refactoring tools where available

## Timeline Estimate

### Phase 1: 30 minutes

- File rename and core class updates

### Phase 2: 15 minutes

- Import/export updates

### Phase 3: 10 minutes

- Documentation updates

### Phase 4: 45 minutes (Optional)

- Variable renaming and CSS updates

### Testing: 30 minutes

- Comprehensive testing of all functionality

**Total Estimated Time: 2 hours (with optional variable renaming)**

## Success Criteria

1. All files compile and load without errors
2. Visual rendering is identical to current implementation
3. All functionality works as expected
4. No console errors or warnings related to the rename
5. Documentation is consistent and accurate
6. Code is more semantically clear with the new naming

## Post-Transition Tasks

1. Update any additional documentation that may reference the old name (excluding changelog historical entries)
2. Consider updating any external references or documentation
3. Review code comments for any missed references
4. Update any development documentation or guides
5. Consider if any additional refactoring would be beneficial
6. Add changelog entry documenting the rename transition for future reference

## Notes

- The transition maintains backward compatibility in terms of functionality
- The new name better reflects the component's purpose
- Consider this an opportunity to improve code organization and clarity
- All changes should be committed atomically to maintain git history
