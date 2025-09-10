# Unified Resource Modal Planning Document

## Overview

The new Add Resource modal will replace the current simple form with a more sophisticated two-tab interface that handles both internal (local files) and external (web resources) with appropriate workflows for each type.

## Modal Structure

### Base Modal Layout

```
┌─────────────────────────────────────────────────────────┐
│ Add Unified Resource                    [×]             │
├─────────────────────────────────────────────────────────┤
│ [Internal] [External]                                   │
├─────────────────────────────────────────────────────────┤
│ Tab Content Area                                        │
│                                                         │
│                                                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ [Cancel] [Add Resource(s)]                              │
└─────────────────────────────────────────────────────────┘
```

## Tab 1: Internal Resources

### Purpose

Allow users to select and add local files to the unified resource system.

### Workflow

1. **File Selection Phase**

   - File picker with multiple file selection
   - Drag & drop support
   - File type filtering (optional)
   - Preview of selected files

2. **Metadata Phase**

   - Bulk title editing (with individual overrides)
   - Bulk description editing
   - Tag management (bulk + individual)
   - Resource type classification

3. **Review & Confirm Phase**
   - Summary of all files to be added
   - Validation checks
   - Final confirmation

### UI Components

#### File Selection

```
┌─────────────────────────────────────────────────────────┐
│ Select Local Files                                      │
├─────────────────────────────────────────────────────────┤
│ [Choose Files] or drag files here                       │
│                                                         │
│ Selected Files (3):                                     │
│ • document.pdf (2.3 MB)                                │
│ • image.jpg (1.1 MB)                                   │
│ • notes.txt (15 KB)                                    │
│                                                         │
│ [Clear Selection]                                       │
└─────────────────────────────────────────────────────────┘
```

#### Metadata Editing

```
┌─────────────────────────────────────────────────────────┐
│ Edit Resource Metadata                                  │
├─────────────────────────────────────────────────────────┤
│ Bulk Settings:                                          │
│ Title: [My Documents]                                   │
│ Description: [Personal files]                           │
│ Tags: [personal, documents]                             │
│                                                         │
│ Individual Files:                                       │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ document.pdf                                        │ │
│ │ Title: [Document] [Override]                        │ │
│ │ Description: [PDF document]                         │ │
│ │ Tags: [pdf, document]                               │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ image.jpg                                           │ │
│ │ Title: [Image] [Override]                           │ │
│ │ Description: [Photo]                                │ │
│ │ Tags: [image, photo]                                │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### Review Phase

```
┌─────────────────────────────────────────────────────────┐
│ Review & Confirm                                        │
├─────────────────────────────────────────────────────────┤
│ Summary:                                                │
│ • 3 files will be added                                │
│ • Total size: 3.4 MB                                   │
│ • New tags: personal, documents, pdf, image, photo     │
│                                                         │
│ Files to add:                                           │
│ • document.pdf → "Document"                             │
│ • image.jpg → "Image"                                   │
│ • notes.txt → "My Documents"                           │
│                                                         │
│ [Back] [Add Resources]                                  │
└─────────────────────────────────────────────────────────┘
```

## Tab 2: External Resources

### Purpose

Use the existing bulk add workflow for external resources, even for single items.

### Workflow

Reuse the existing 3-phase bulk add process:

1. **URL Input Phase**

   - Single or multiple URL input
   - URL validation
   - Duplicate detection

2. **Processing Phase**

   - Web scraping
   - Metadata extraction
   - Content analysis

3. **Review & Confirm Phase**
   - Extracted metadata review
   - Tag suggestions
   - Final confirmation

### UI Components

Leverage existing bulk add components with modifications for single-item use.

## Technical Implementation

### Modal State Management

```javascript
const modalState = {
  activeTab: "internal", // 'internal' | 'external'
  internal: {
    selectedFiles: [],
    bulkMetadata: {
      title: "",
      description: "",
      tags: [],
    },
    individualMetadata: {}, // fileId -> metadata
    phase: "selection", // 'selection' | 'metadata' | 'review'
  },
  external: {
    urls: [],
    processingResults: [],
    phase: "input", // 'input' | 'processing' | 'review'
  },
};
```

### File Handling

- Use Electron's `dialog.showOpenDialog` for file selection
- Support drag & drop with `ondragover` and `ondrop` events
- File validation (size limits, type restrictions)
- Generate content hashes for selected files

### Metadata Management

- Bulk editing with individual overrides
- Tag autocomplete from existing tags
- Metadata validation
- Preview of changes

### Integration Points

- **UnifiedResourceManager**: Add resources to unified list
- **TagManager**: Update tag counts and suggestions
- **ArchiveManager**: For internal file references
- **ResourceManager**: For external resource handling

## User Experience Considerations

### Accessibility

- Keyboard navigation between tabs
- Screen reader support
- Focus management
- Error handling and validation

### Performance

- Lazy loading of file previews
- Efficient bulk operations
- Progress indicators for large operations

### Error Handling

- File access errors
- Network errors for external resources
- Validation errors
- Graceful degradation

## Migration Strategy

### Phase 1: Modal Structure

1. Create new modal with tab navigation
2. Implement basic tab switching
3. Add placeholder content for each tab

### Phase 2: Internal Resources

1. File selection interface
2. Basic metadata editing
3. Review and confirmation

### Phase 3: External Resources

1. Integrate existing bulk add workflow
2. Adapt for single-item use
3. Unified result handling

### Phase 4: Integration

1. Connect to UnifiedResourceManager
2. Tag integration
3. Error handling and validation

## Success Metrics

- User can successfully add both internal and external resources
- Bulk operations work efficiently
- Tag management is intuitive
- Error states are handled gracefully
- Modal performance is smooth

## Future Enhancements

- File preview capabilities
- Advanced metadata extraction
- Batch operations across tabs
- Template-based metadata
- Integration with external services
