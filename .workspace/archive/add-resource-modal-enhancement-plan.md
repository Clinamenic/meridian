# Add Resource Modal Enhancement Plan

## Overview

This document outlines the plan to enhance the Add Resource modal functionality in Meridian to provide consistent bulk and individual tag management for both internal and external resources. The goal is to align the internal and external resource adding processes and leverage existing modular architecture for tag functionality.

## Current State Analysis

### Existing Architecture

1. **Modular System**: Meridian uses a modular architecture with `ModuleBase` as the foundation
2. **Tag Management**: Centralized `TagManager` module handles all tag-related operations
3. **Tag Autocomplete**: Unified `TagAutocomplete` component provides consistent autocomplete functionality
4. **Modal System**: Dynamic modal creation through `ModalManager`

### Current Add Resource Modal Structure

#### Internal Resources Tab

- **Phase 1**: File Selection
- **Phase 2**: Metadata (bulk settings)
- **Phase 3**: Arweave Upload (optional)
- **Phase 4**: Review & Confirm

#### External Resources Tab

- **Phase 1**: URL Input
- **Phase 2**: Processing
- **Phase 3**: Review & Confirm

### Current Limitations

1. **Inconsistent Review Phase**: External resources have a proper review phase with resource previews, but internal resources lack this
2. **No Bulk Tag Management**: No way to add tags to multiple resources at once during the review phase
3. **No Individual Tag Management**: Cannot add tags to individual resources during the review phase
4. **Missing Preview**: Internal resources don't show resource-item tiles before confirmation

## Enhancement Requirements

### 1. Align Internal and External Resource Processes

**Goal**: Make both internal and external resource adding processes follow the same pattern with proper review phases.

**Changes Needed**:

- Add a proper review phase to internal resources that shows resource-item tiles
- Ensure both processes have consistent phase progression
- Leverage existing resource-item rendering patterns

### 2. Add Bulk Tag Management

**Goal**: Allow adding tags to all resources being added in a single operation.

**Requirements**:

- Bulk tag input above the resource preview list
- Tag autocomplete functionality for bulk tags
- Visual indication of which tags are applied to all resources
- Ability to remove bulk tags

### 3. Add Individual Tag Management

**Goal**: Allow adding/removing tags for individual resources during the review phase.

**Requirements**:

- Individual tag input for each resource-item
- Tag autocomplete for individual resources
- Visual distinction between bulk and individual tags
- Ability to remove individual tags

### 4. Leverage Existing Infrastructure

**Goal**: Reuse existing tag functionality and styling patterns.

**Components to Leverage**:

- `TagManager` module for tag operations
- `TagAutocomplete` component for autocomplete functionality
- Existing tag input styling and patterns
- Resource-item rendering from main resource list

## Technical Implementation Plan

### Phase 1: Enhance Internal Resource Review Phase

#### 1.1 Update Internal Resource Modal Structure

**File**: `src/renderer/modules/UnifiedResourceManager.js`

**Changes**:

- Modify `openAddUnifiedResourceModal()` to include proper review phase for internal resources
- Add resource preview generation similar to external resources
- Update phase progression logic

**New Phase Structure for Internal Resources**:

```
Phase 1: File Selection
Phase 2: Metadata (bulk settings)
Phase 3: Arweave Upload (optional)
Phase 4: Review & Confirm (enhanced with previews)
```

#### 1.2 Add Resource Preview Generation

**New Method**: `generateInternalResourcePreviews()`

- Create resource-item tiles for selected files
- Include metadata from bulk settings
- Show file information and status
- Prepare for tag management integration

### Phase 2: Implement Bulk Tag Management

#### 2.1 Add Bulk Tag UI Components

**New HTML Structure**:

```html
<div class="bulk-tag-management">
  <h5>Bulk Tags</h5>
  <div class="bulk-tag-input">
    <div class="tag-input-container">
      <input
        type="text"
        class="tag-input"
        id="bulk-tag-input"
        placeholder="add tag to all resources..."
      />
      <button type="button" class="add-tag-btn" id="bulk-add-tag-btn" disabled>
        +
      </button>
    </div>
    <div
      class="tag-autocomplete"
      id="bulk-tag-autocomplete"
      style="display: none;"
    ></div>
  </div>
  <div class="bulk-tags-list" id="bulk-tags-list">
    <!-- Bulk tags will appear here -->
  </div>
</div>
```

#### 2.2 Integrate with TagManager

**New Methods in TagManager**:

- `addBulkTags(tags, resourceIds)`: Add tags to multiple staged resources
- `removeBulkTag(tag, resourceIds)`: Remove tag from multiple staged resources
- `getTagSuggestions(input)`: Get suggestions for tag input (same for bulk and individual)

#### 2.3 Add Bulk Tag Event Handlers

**New Methods in UnifiedResourceManager**:

- `setupBulkTagEventListeners()`: Handle bulk tag input events
- `addBulkTag(tagValue)`: Add tag to all resources in review
- `removeBulkTag(tagValue)`: Remove tag from all resources
- `renderBulkTags()`: Update bulk tags display

### Phase 3: Implement Individual Tag Management

#### 3.1 Add Individual Tag UI to Resource Items

**Enhanced Resource Item Structure**:

```html
<div class="resource-item">
  <!-- Existing resource content -->
  <div class="resource-tags">
    <!-- Existing tags -->
    <div class="resource-tag-input">
      <div class="tag-input-container">
        <input
          type="text"
          class="tag-input"
          data-resource-id="${resourceId}"
          placeholder="add tag..."
        />
        <button
          type="button"
          class="add-tag-btn"
          data-resource-id="${resourceId}"
          disabled
        >
          +
        </button>
      </div>
      <div
        class="tag-autocomplete"
        data-resource-id="${resourceId}"
        style="display: none;"
      ></div>
    </div>
  </div>
</div>
```

#### 3.2 Integrate Individual Tag Autocomplete

**New Methods in UnifiedResourceManager**:

- `setupIndividualTagEventListeners()`: Handle individual tag inputs
- `addIndividualTag(resourceId, tagValue)`: Add tag to specific resource
- `removeIndividualTag(resourceId, tagValue)`: Remove tag from specific resource
- `setupIndividualTagAutocomplete(resourceId)`: Initialize autocomplete for resource

#### 3.3 Visual Organization

**CSS Enhancements**:

- Clear separation between bulk tag management and individual resource items
- Consistent tag styling across bulk and individual contexts
- Visual organization of tag management areas

### Phase 4: Update Resource Addition Logic

#### 4.1 Enhance Resource Creation Process

**Modified Methods**:

- `addInternalResources()`: Include tags from both bulk and individual sources
- `addExternalResources()`: Include tags from both bulk and individual sources
- `generateResourceFromPreview()`: Create resource objects with accumulated tags

#### 4.2 Tag Accumulation Logic

**New Method**: `accumulateResourceTags(resourceId)`

- Combine bulk tags with individual tags for the specific resource
- Remove duplicates (if same tag exists in both bulk and individual)
- Return final tag array for resource

### Phase 5: UI/UX Enhancements

#### 5.1 Consistent Styling

**Leverage Existing CSS Classes**:

- `.tag-input-container`
- `.tag-input`
- `.add-tag-btn`
- `.tag-autocomplete`
- `.resource-tag`
- `.modal-resource-tags`

#### 5.2 Visual Organization

**New CSS Classes**:

- `.bulk-tag-management`: Container for bulk tag functionality
- `.bulk-tag-input`: Styling for bulk tag input area
- `.bulk-tags-list`: Container for bulk tags display
- `.review-resource-item`: Enhanced styling for resource items in review phase

#### 5.3 Responsive Design

**Considerations**:

- Ensure tag inputs work well on different screen sizes
- Maintain usability in modal context
- Handle overflow for long tag lists

## Implementation Details

### File Modifications

#### Primary Files to Modify

1. **`src/renderer/modules/UnifiedResourceManager.js`**

   - Enhance modal structure and phase management
   - Add bulk and individual tag functionality
   - Update resource creation logic

2. **`src/renderer/modules/TagManager.js`**

   - Add bulk tag management methods
   - Enhance tag suggestion logic for bulk operations
   - Add individual tag management for modal context

3. **`src/renderer/styles.css`**
   - Add styling for bulk tag management
   - Enhance existing tag styles for modal context
   - Add visual distinction between tag types

#### Supporting Files

4. **`src/renderer/components/TagAutocomplete.js`**

   - May need minor enhancements for bulk tag context
   - Ensure proper cleanup for dynamic elements

5. **`src/renderer/modules/ModuleBase.js`**
   - No changes needed (foundation remains stable)

### New Methods to Implement

#### In UnifiedResourceManager

```javascript
// Phase 1: Enhanced Review Phase
generateInternalResourcePreviews();
setupReviewPhaseEventListeners();

// Phase 2: Bulk Tag Management
setupBulkTagEventListeners();
addBulkTag(tagValue);
removeBulkTag(tagValue);
renderBulkTags();
setupBulkTagAutocomplete();

// Phase 3: Individual Tag Management
setupIndividualTagEventListeners();
addIndividualTag(resourceId, tagValue);
removeIndividualTag(resourceId, tagValue);
setupIndividualTagAutocomplete(resourceId);
renderIndividualTags(resourceId);

// Phase 4: Resource Creation
accumulateResourceTags(resourceId);
generateResourceFromPreview(previewData);
```

#### In TagManager

```javascript
// Bulk Tag Operations
addBulkTags(tags, resourceIds);
removeBulkTag(tag, resourceIds);
getTagSuggestions(input, excludeTags, limit); // Same for bulk and individual

// Individual Tag Operations (Modal Context)
addIndividualTagToPreview(resourceId, tagValue);
removeIndividualTagFromPreview(resourceId, tagValue);
```

### State Management

#### Enhanced Modal State Structure

```javascript
this.modalState = {
  activeTab: "internal",
  internal: {
    selectedFiles: [],
    bulkMetadata: {
      title: "",
      description: "",
      tags: [], // NEW: Bulk tags
    },
    individualMetadata: {},
    resourcePreviews: [], // NEW: Generated previews
    bulkTags: [], // NEW: Tags applied to all resources
    individualTags: {}, // NEW: Tags per resource {resourceId: [tags]}
    arweaveSettings: {
      /* existing */
    },
    phase: "selection",
  },
  external: {
    urls: [],
    processingResults: [],
    resourcePreviews: [], // NEW: Generated previews
    bulkTags: [], // NEW: Tags applied to all resources
    individualTags: {}, // NEW: Tags per resource
    phase: "input",
  },
};
```

## Testing Strategy

### Unit Testing

1. **Tag Accumulation Logic**: Test combining bulk and individual tags
2. **Tag Deduplication**: Ensure proper deduplication when same tag exists in both contexts
3. **Resource Creation**: Verify resources are created with correct tags

### Integration Testing

1. **Modal Flow**: Test complete flow from file selection to resource creation
2. **Tag Autocomplete**: Verify autocomplete works in modal context
3. **State Persistence**: Ensure modal state is maintained during navigation

### User Testing

1. **Usability**: Test tag input and management in modal context
2. **Performance**: Ensure smooth operation with many resources
3. **Accessibility**: Verify keyboard navigation and screen reader support

## Migration Considerations

### Backward Compatibility

- Existing tag functionality remains unchanged
- Current resource creation process continues to work
- No breaking changes to existing APIs

### Data Migration

- No data migration required
- New functionality is additive only

## Success Criteria

1. **Consistent Experience**: Internal and external resource adding follow the same pattern
2. **Bulk Tag Management**: Users can add tags to all staged resources in one operation
3. **Individual Tag Management**: Users can add/remove tags for specific resources during review
4. **Visual Organization**: Clear separation between bulk tag management and individual resource items
5. **Performance**: Smooth operation with multiple resources
6. **Accessibility**: Standard keyboard navigation support

## Timeline Estimate

- **Phase 1** (Internal Review Enhancement): 2-3 days
- **Phase 2** (Bulk Tag Management): 2-3 days
- **Phase 3** (Individual Tag Management): 2-3 days
- **Phase 4** (Resource Creation Updates): 1-2 days
- **Phase 5** (UI/UX Polish): 1-2 days
- **Testing and Refinement**: 2-3 days

**Total Estimated Time**: 10-16 days

## Clarifications and Design Decisions

Based on user feedback, the following design decisions have been made:

1. **Tag Validation**: No validation restrictions implemented at this time
2. **Tag Persistence**: Bulk tags are applied to staged resources in the review phase only - no persistence across tab switches needed
3. **Performance Limits**: No performance limits implemented at this time
4. **Tag Conflicts**: No conflicts - bulk tags add to all staged resources, individual tags can be added/removed per resource
5. **Undo Functionality**: No undo/redo functionality required
6. **Tag Suggestions**: Same autocomplete functionality for both bulk and individual tag inputs
7. **Tag Types**: Tags are agnostic to resource type (internal/external) - they function purely as index tags within the database structure
8. **Accessibility**: No specific accessibility requirements beyond standard keyboard navigation
