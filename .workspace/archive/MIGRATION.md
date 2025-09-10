# Migration Guide: Resource Manager → Multi-Tool

This document outlines the changes made when restructuring the Resource Manager into a Multi-Tool application.

## What Changed

### Directory Structure

- **Old**: Resource Manager was the root application
- **New**: Resource Manager is now a tool module within the Multi-Tool application

### File Movements

| Old Location                         | New Location              | Notes                        |
| ------------------------------------ | ------------------------- | ---------------------------- |
| `resource_manager/src/`              | `tools/resource-manager/` | Tool-specific code           |
| `resource_manager/package.json`      | `package.json`            | Updated for multi-tool       |
| `resource_manager/electron.ts`       | `electron.ts`             | Updated main process         |
| `resource_manager/preload.js`        | `preload.js`              | Enhanced with multi-tool API |
| `resource_manager/webpack.config.js` | `webpack.config.js`       | Updated entry point          |
| `resource_manager/public/`           | `public/`                 | Static assets                |

### New Files Created

- `src/main/ipc-handlers.ts` - Central IPC handler coordination
- `src/renderer/App.tsx` - Main multi-tool application with tabs
- `src/renderer/App.css` - Multi-tool styling
- `src/renderer/index.tsx` - React entry point
- `src/renderer/types/global.d.ts` - TypeScript definitions
- `tools/resource-manager/renderer/components/ResourceManagerTool.tsx` - Tool wrapper
- `README.md` - Updated documentation

### API Changes

#### Preload API

The preload API has been enhanced while maintaining backward compatibility:

**New Structured API:**

```javascript
window.electronAPI.getTools();
window.electronAPI.bookmarks.add(urls, tags);
window.electronAPI.bookmarks.getAll();
// ... etc
```

**Legacy API (still works):**

```javascript
window.electronAPI.addBookmarks(urls, tags);
window.electronAPI.getAllBookmarks();
// ... etc
```

#### Main Process

- Added multi-tool coordination in `src/main/ipc-handlers.ts`
- Resource Manager handlers remain unchanged in `tools/resource-manager/main/`

## Breaking Changes

### For Developers

- Import paths for Resource Manager components have changed
- Main application entry point is now `src/renderer/index.tsx`
- Tool-specific code should be imported from `tools/resource-manager/`

### For Users

- **No breaking changes** - the application functionality remains the same
- Resource Manager is now accessible as a tab in the Multi-Tool interface
- All existing bookmarks and settings are preserved

## Benefits of the New Structure

1. **Modularity**: Each tool is self-contained and can be developed independently
2. **Scalability**: Easy to add new tools without affecting existing ones
3. **Organization**: Clear separation between app framework and tool logic
4. **Maintainability**: Better code organization and dependency management
5. **User Experience**: Unified interface for multiple productivity tools

## Next Steps

1. Test the application to ensure all Resource Manager functionality works
2. Add new tools by following the structure in `tools/resource-manager/`
3. Consider extracting common tool patterns into shared utilities
4. Update any external documentation or integrations

## Rollback Plan

If needed, the old Resource Manager can be restored by:

1. Reverting to the `resource_manager/` directory structure
2. Using the backed-up `package_old.json` as `package.json`
3. Restoring the original file locations

However, this is not recommended as the new structure provides significant benefits for future development.
