# Image Preview Feature Implementation Plan

## Overview
Add simple image preview functionality to the ResourceManager that displays a 1:1 square thumbnail preview for image resources within the resource header, positioned to the left of the resource-info section. Implementation will be minimal and fully compatible with existing global styling.

## Design Principles
- **Simplicity**: Minimal code changes, leverage existing patterns
- **Compatibility**: Use existing CSS variables and styling patterns
- **Performance**: Lightweight implementation with basic error handling
- **Consistency**: Match existing UI patterns and spacing

## Current State Analysis

### Resource Structure
- Resources are rendered in `renderResourceList()` method (line 285)
- Each resource has a `resource-header` containing:
  - `resource-info` (title, path, status indicator)
  - `resource-actions` (edit, remove, collapse buttons)
- Resource types are determined by `resource.state.type` (internal/external/arweave)
- File extensions are handled in file selection dialogs (line 5794: jpg, jpeg, png, gif, svg)

### Existing Styling Patterns
- Uses CSS custom properties (--spacing-*, --border-radius-*, --surface-*, etc.)
- Consistent spacing with var(--spacing-sm), var(--spacing-xs)
- Border radius patterns: var(--border-radius-sm), var(--border-radius-lg)
- Color scheme: var(--surface-bg-elevated), var(--surface-border), var(--text-*)

## Simplified Implementation Plan

### Phase 1: Minimal Image Detection

#### 1.1 Simple Image Detection Utility
**File**: `src/renderer/modules/ResourceManager.js`
**Method**: `isImageResource(resource)`

```javascript
isImageResource(resource) {
  const location = resource.locations.primary.value.toLowerCase();
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  return imageExtensions.some(ext => location.endsWith(ext));
}
```

#### 1.2 Simple Image URL Resolution
**Method**: `getImageUrl(resource)`

```javascript
getImageUrl(resource) {
  return resource.locations.primary.value;
}
```

### Phase 2: Minimal HTML Integration

#### 2.1 Simple Resource Header Update
**File**: `src/renderer/modules/ResourceManager.js`
**Method**: `renderResourceList()` (around line 306)

Add image preview before existing resource-info:

```javascript
<div class="resource-header">
  ${this.isImageResource(resource) ? `
    <img src="${this.getImageUrl(resource)}" 
         alt=""
         class="resource-image-preview"
         onerror="this.style.display='none'">
  ` : ''}
  <div class="resource-info">
    <!-- existing resource info content unchanged -->
  </div>
  <!-- existing resource actions unchanged -->
</div>
```

### Phase 3: Minimal CSS Styling

#### 3.1 Simple Image Preview Styles
**File**: `src/renderer/styles/modules/resource-manager.css`

Add minimal styles using existing design tokens:

```css
/* Simple Image Preview - uses existing design system */
.resource-image-preview {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: var(--border-radius-sm);
  object-fit: cover;
  border: 1px solid var(--surface-border);
  background-color: var(--surface-bg-subtle);
  margin-right: var(--spacing-sm);
}
```

**That's it!** No complex layouts, no additional containers, no hover effects - just a simple square image that fits naturally into the existing header layout.

## Simplified Implementation Steps

### Step 1: Add Detection Methods (5 minutes)
1. Add `isImageResource()` method to ResourceManager
2. Add `getImageUrl()` method to ResourceManager
3. Test with sample resources

### Step 2: Update HTML Template (5 minutes)
1. Modify `renderResourceList()` to include image preview
2. Test rendering with image resources

### Step 3: Add CSS Styles (5 minutes)
1. Add `.resource-image-preview` styles to CSS file
2. Test visual appearance

### Step 4: Test and Refine (10 minutes)
1. Test with different image formats
2. Test error handling (broken images)
3. Verify integration with existing layout

**Total Implementation Time: ~25 minutes**

## Dependencies
- **None** - Uses only existing HTML, CSS, and JavaScript patterns
- Leverages existing CSS custom properties and design system
- No external libraries or complex dependencies

## Success Criteria
1. ✅ Image resources show 40x40px square thumbnails
2. ✅ Thumbnails appear to the left of resource-info
3. ✅ Broken images hide gracefully (no broken image icons)
4. ✅ Styling matches existing design system
5. ✅ No impact on existing functionality
6. ✅ Works with all resource types (internal/external/arweave)

## Risk Assessment
- **Very Low Risk**: Simple HTML/CSS changes using existing patterns
- **No Breaking Changes**: Existing layout and functionality unchanged
- **Minimal Performance Impact**: Single img element per image resource
- **Browser Compatible**: Uses standard HTML5 img element

## Why This Approach is Better
1. **Minimal Code**: Only ~20 lines of code total
2. **No Complex Logic**: Simple file extension checking
3. **Uses Existing Patterns**: Leverages current CSS variables and layout
4. **Graceful Degradation**: Broken images simply hide
5. **Easy to Maintain**: Simple, readable implementation
6. **Future-Proof**: Easy to extend if needed later
