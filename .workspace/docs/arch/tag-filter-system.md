# Tag Filter System Architecture

## Overview

The tag filter system in Meridian provides a sophisticated filtering mechanism for unified resources, supporting both search-based and tag-based filtering with configurable logic (ANY/ALL). The system is designed to be persistent across sessions and provides real-time UI updates.

## Core Components

### 1. State Management

The filter system uses a centralized state structure within the `UnifiedResourceManager`:

```javascript
state: {
  filters: {
    searchTerm: '',           // Text search filter
    activeTags: Set<string>,  // Currently active tag filters
    filterLogic: 'any' | 'all' // Filter combination logic
  },
  resources: UnifiedResource[], // All available resources
  collapse: {                  // UI collapse state
    globalState: 'expanded' | 'collapsed',
    collapsedItems: Set<string>
  }
}
```

### 2. Filter Logic Types

- **ANY Logic**: Resources must match ANY of the active tag filters
- **ALL Logic**: Resources must match ALL of the active tag filters

### 3. Persistence Layer

Filter state is automatically persisted to localStorage and restored on application startup:

```javascript
// Storage keys
const FILTER_STATE_KEY = "meridian_unified_filter_state";
const COLLAPSE_STATE_KEY = "meridian_unified_collapse_state";
```

## Implementation Details

### Filter Application Pipeline

1. **Resource Loading**: Resources are loaded from backend via `loadUnifiedResources()`
2. **State Restoration**: Filter state is loaded from localStorage during initialization
3. **UI Rendering**: `renderUnifiedResourceList()` applies filters in real-time
4. **State Persistence**: Changes are automatically saved to localStorage

### Core Methods

#### `getFilteredResources()`

The central filtering method that applies both search and tag filters:

```javascript
getFilteredResources() {
  let filtered = this.state.resources;

  // Apply search filter
  if (this.state.filters.searchTerm) {
    const searchTerm = this.state.filters.searchTerm.toLowerCase();
    filtered = filtered.filter(resource => {
      const title = (resource.properties["dc:title"] || "").toLowerCase();
      const description = (resource.properties["meridian:description"] || "").toLowerCase();
      const url = resource.locations.primary.value.toLowerCase();
      const tags = (resource.properties["meridian:tags"] || []).join(" ").toLowerCase();

      return title.includes(searchTerm) ||
             description.includes(searchTerm) ||
             url.includes(searchTerm) ||
             tags.includes(searchTerm);
    });
  }

  // Apply tag filters
  if (this.state.filters.activeTags.size > 0) {
    const activeTagsArray = Array.from(this.state.filters.activeTags);

    filtered = filtered.filter(resource => {
      const resourceTags = new Set(resource.properties["meridian:tags"] || []);

      if (this.state.filters.filterLogic === 'any') {
        return activeTagsArray.some(tag => resourceTags.has(tag));
      } else {
        return activeTagsArray.every(tag => resourceTags.has(tag));
      }
    });
  }

  return filtered;
}
```

#### `toggleTagFilter(tag)`

Handles tag filter activation/deactivation:

```javascript
toggleTagFilter(tag) {
  const newActiveTags = new Set(this.state.filters.activeTags);

  if (newActiveTags.has(tag)) {
    newActiveTags.delete(tag);
  } else {
    newActiveTags.add(tag);
  }

  // Update state
  this.updateState({
    filters: {
      activeTags: newActiveTags
    }
  });

  // Update UI and persist
  this.updateUI();
  this.saveFilterState();
}
```

### State Persistence

#### `loadFilterState()`

Restores filter state from localStorage:

```javascript
loadFilterState() {
  try {
    const savedState = localStorage.getItem(FILTER_STATE_KEY);
    if (savedState) {
      const parsed = JSON.parse(savedState);
      this.updateState({
        filters: {
          searchTerm: parsed.searchTerm || '',
          activeTags: new Set(parsed.activeTags || []),
          filterLogic: parsed.filterLogic || 'any'
        }
      });
    }
  } catch (error) {
    console.warn('[UnifiedResourceManager] Failed to load filter state:', error);
  }
}
```

#### `saveFilterState()`

Persists current filter state:

```javascript
saveFilterState() {
  try {
    const stateToSave = {
      searchTerm: this.state.filters.searchTerm,
      activeTags: Array.from(this.state.filters.activeTags),
      filterLogic: this.state.filters.filterLogic
    };
    localStorage.setItem(FILTER_STATE_KEY, JSON.stringify(stateToSave));
  } catch (error) {
    console.warn('[UnifiedResourceManager] Failed to save filter state:', error);
  }
}
```

## UI Components

### Tag Filter Buttons

Tag filters are rendered as interactive buttons with visual state indicators:

```javascript
renderTagFilters() {
  const allTags = this.getAllTags();

  return allTags.map(tag => {
    const isActive = this.state.filters.activeTags.has(tag);
    const count = this.getTagCount(tag);

    return `
      <button
        class="tag-filter ${isActive ? 'active' : ''}"
        data-tag="${tag}"
        title="${count} resources"
      >
        <span class="tag-filter-text">${this.escapeHtml(tag)}</span>
        <span class="tag-filter-count">${count}</span>
      </button>
    `;
  }).join('');
}
```

### Search Input

Real-time search with debounced updates:

```javascript
// Search input event listener
searchInput.addEventListener("input", (e) => {
  const searchTerm = e.target.value;
  this.updateState({
    filters: { searchTerm },
  });
  this.updateUI();
  this.saveFilterState();
});
```

### Filter Logic Toggle

Button to switch between ANY/ALL logic:

```javascript
// Filter logic toggle
filterLogicBtn.addEventListener("click", () => {
  const newLogic = this.state.filters.filterLogic === "any" ? "all" : "any";
  this.updateState({
    filters: { filterLogic: newLogic },
  });
  this.updateUI();
  this.saveFilterState();
});
```

## Event System

### Event Delegation

Tag filter clicks are handled via event delegation on the panel container:

```javascript
setupUnifiedEventListeners() {
  const panel = document.getElementById('unified-panel');
  if (!panel) return;

  // Tag filter clicks
  panel.addEventListener('click', (e) => {
    if (e.target.closest('.tag-filter')) {
      const tag = e.target.closest('.tag-filter').dataset.tag;
      this.toggleTagFilter(tag);
    }
  });
}
```

### State Change Events

The system emits events for external components:

```javascript
// Emit filter change events
this.emit("filtersApplied", {
  searchTerm: this.state.filters.searchTerm,
  activeTags: Array.from(this.state.filters.activeTags),
  filterLogic: this.state.filters.filterLogic,
  filteredCount: this.getFilteredResources().length,
});
```

## Performance Optimizations

### Efficient Filtering

1. **Set-based Operations**: Uses `Set` for O(1) tag lookups
2. **Early Termination**: Stops filtering when no resources remain
3. **Memoization**: Filtered results are computed on-demand

### UI Updates

1. **Selective Updates**: Only updates changed components
2. **Event Delegation**: Reduces event listener overhead
3. **Debounced Search**: Prevents excessive filtering during typing

## Integration Points

### Backend Integration

The filter system integrates with the backend data manager:

```javascript
// Loading resources
const unifiedData = await window.electronAPI.unified.loadData();
this.updateState({ resources: unifiedData.resources || [] });

// Adding resources
const addedResource = await window.electronAPI.unified.addResource(resource);
this.updateState({
  resources: [...this.state.resources, addedResource],
});
```

### Module Integration

The system integrates with other modules through the event system:

```javascript
// TagManager integration
const tagManager = this.getModule("tagManager");
if (tagManager) {
  tagManager.on("tagAdded", (data) => {
    this.updateUI(); // Refresh tag filters
  });
}
```

## Error Handling

### Graceful Degradation

1. **LocalStorage Failures**: Continues with default state
2. **Backend Errors**: Shows error messages, maintains local state
3. **Invalid Data**: Validates and sanitizes input

### Recovery Mechanisms

1. **State Validation**: Ensures state consistency
2. **Fallback Values**: Provides sensible defaults
3. **Error Logging**: Comprehensive error tracking

## Testing Considerations

### Unit Tests

Key areas for testing:

1. **Filter Logic**: ANY vs ALL behavior
2. **State Persistence**: Save/load functionality
3. **Edge Cases**: Empty states, invalid data
4. **Performance**: Large resource sets

### Integration Tests

1. **UI Updates**: Filter changes reflect in UI
2. **Event Handling**: Click events work correctly
3. **Persistence**: State survives page refreshes

## Future Enhancements

### Planned Features

1. **Advanced Filters**: Date ranges, file types
2. **Saved Filter Sets**: Named filter configurations
3. **Filter History**: Undo/redo functionality
4. **Bulk Operations**: Apply filters to multiple resources

### Performance Improvements

1. **Virtual Scrolling**: Handle large resource lists
2. **Indexed Search**: Faster text search
3. **Caching**: Cache filtered results
4. **Background Processing**: Non-blocking filter updates

## Best Practices

### Development Guidelines

1. **State Immutability**: Always create new state objects
2. **Event Consistency**: Emit events for all state changes
3. **Error Boundaries**: Handle errors gracefully
4. **Performance Monitoring**: Track filter performance

### User Experience

1. **Immediate Feedback**: Update UI instantly
2. **Clear Indicators**: Show active filter state
3. **Keyboard Shortcuts**: Support keyboard navigation
4. **Accessibility**: Ensure screen reader compatibility

## Troubleshooting

### Common Issues

1. **Filters Not Persisting**: Check localStorage permissions
2. **Slow Performance**: Monitor resource count and filter complexity
3. **UI Not Updating**: Verify event listener setup
4. **State Inconsistency**: Check state validation logic

### Debug Tools

1. **Console Logging**: Comprehensive debug output
2. **State Inspection**: Browser dev tools for state debugging
3. **Performance Profiling**: Monitor filter execution time
4. **Error Tracking**: Centralized error logging
