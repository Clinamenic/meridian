# UnifiedResourceManager to ResourceManager Renaming Plan

## Overview

This document outlines a systematic and holistic approach to rename `UnifiedResourceManager` to `ResourceManager` across the entire Meridian codebase. The renaming will simplify the naming convention while maintaining all functionality and ensuring backward compatibility during the transition.

## Rationale

1. **Simplification**: "Unified" is redundant since this is now the primary resource management system
2. **Clarity**: "ResourceManager" is more concise and descriptive
3. **Consistency**: Aligns with other module naming patterns in the codebase
4. **Future-proofing**: Prepares for potential expansion of resource management capabilities

## Scope Analysis

### Files Requiring Changes

#### Core Module Files

- `src/renderer/modules/UnifiedResourceManager.js` → `ResourceManager.js`
- `src/main/unified-database-manager.ts` → `resource-database-manager.ts`

#### Import/Reference Files

- `src/renderer/modules/ModuleLoader.js` - Module registration and imports
- `src/renderer/app.js` - Module access and method calls
- `src/renderer/modules/TagManager.js` - Cross-module dependencies
- `src/main/preload.ts` - IPC API definitions
- `src/main/main.ts` - IPC handlers
- `src/types/index.ts` - Type definitions

#### Documentation Files

- `.cursor/docs/temp/edit-resource-modal-improvements.md` - References in documentation

### Naming Patterns to Update

#### Class Names

- `UnifiedResourceManager` → `ResourceManager`

#### Module Registration Names

- `'unifiedResourceManager'` → `'resourceManager'`

#### Method Names

- `loadUnifiedResources()` → `loadResources()`
- `saveUnifiedResources()` → `saveResources()`
- `addUnifiedResource()` → `addResource()`
- `removeUnifiedResource()` → `removeResource()`
- `editUnifiedResource()` → `editResource()`
- `openAddUnifiedResourceModal()` → `openAddResourceModal()`
- `openUnifiedExportModal()` → `openExportModal()`

#### Event Names

- `'unifiedResourceManagerInitializing'` → `'resourceManagerInitializing'`
- `'unifiedResourceManagerInitialized'` → `'resourceManagerInitialized'`
- `'unifiedResourceManagerCleanedUp'` → `'resourceManagerCleanedUp'`
- `'unifiedResourceStateChanged'` → `'resourceStateChanged'`

#### IPC Channel Names

- `'unified:load-data'` → `'resource:load-data'`
- `'unified:save-data'` → `'resource:save-data'`
- `'unified:add-resource'` → `'resource:add-resource'`
- `'unified:update-resource'` → `'resource:update-resource'`
- `'unified:remove-resource'` → `'resource:remove-resource'`
- `'unified:add-tag-to-resource'` → `'resource:add-tag-to-resource'`
- `'unified:remove-tag-from-resource'` → `'resource:remove-tag-from-resource'`
- `'unified:export-to-json'` → `'resource:export-to-json'`
- `'unified:export-to-database'` → `'resource:export-to-database'`
- `'unified:get-stats'` → `'resource:get-stats'`
- `'unified:search-resources'` → `'resource:search-resources'`

#### DOM Element IDs

- `'unified-panel'` → `'resource-panel'`
- `'unified-resource-list'` → `'resource-list'`
- `'add-unified-resource-btn'` → `'add-resource-btn'`
- `'unified-search'` → `'resource-search'`
- `'unified-filter-logic-btn'` → `'resource-filter-logic-btn'`
- `'unified-clear-filters-btn'` → `'resource-clear-filters-btn'`
- `'unified-collapse-all-btn'` → `'resource-collapse-all-btn'`
- `'unified-export-btn'` → `'resource-export-btn'`
- `'unified-count-text'` → `'resource-count-text'`
- `'unified-tag-filter-list'` → `'resource-tag-filter-list'`
- `'unified-resource-modal'` → `'resource-modal'`
- `'unified-export-modal'` → `'export-modal'`

#### CSS Classes

- `.unified-resource-list` → `.resource-list`
- `.unified-resource-item` → `.resource-item`
- `.unified-resource-modal` → `.resource-modal`

#### Variable Names

- `unifiedResources` → `resources`
- `unifiedManager` → `resourceManager`
- `unifiedResourceManager` → `resourceManager`

#### Database/File Names

- `unified_resources.db` → `resources.db`
- `unified-resources-*.json` → `resources-*.json`
- `unified-resources-*.txt` → `resources-*.txt`
- `unified-resources-*.html` → `resources-*.html`

#### Type Definitions

- `UnifiedResource` → `Resource`
- `UnifiedData` → `ResourceData`

## Implementation Strategy

### Phase 1: Preparation and Backup

1. **Create backup branch**: `git checkout -b backup/unified-resource-manager`
2. **Document current state**: Capture all current references and dependencies
3. **Create migration script**: Automated search and replace with validation

### Phase 2: Core Module Renaming

1. **Rename main module file**:

   - `UnifiedResourceManager.js` → `ResourceManager.js`
   - Update class name and all internal references
   - Update all method names
   - Update all event emissions

2. **Update ModuleLoader.js**:
   - Change import path
   - Update module registration name
   - Update dependency references

### Phase 3: Backend Integration

1. **Rename database manager**:

   - `unified-database-manager.ts` → `resource-database-manager.ts`
   - Update class name and references

2. **Update IPC channels**:
   - Modify `preload.ts` API definitions
   - Update `main.ts` IPC handlers
   - Ensure backward compatibility during transition

### Phase 4: Frontend Integration

1. **Update app.js**:

   - Change module access patterns
   - Update method calls
   - Update event listeners

2. **Update cross-module dependencies**:
   - TagManager.js references
   - Any other module dependencies

### Phase 5: UI Elements

1. **Update DOM element IDs**:

   - All panel and modal IDs
   - All button and input IDs
   - All list and container IDs

2. **Update CSS classes**:
   - Resource list styling
   - Modal styling
   - Component-specific classes

### Phase 6: Type Definitions

1. **Update types/index.ts**:
   - Rename interfaces
   - Update type references
   - Maintain backward compatibility

### Phase 7: Documentation and Cleanup

1. **Update documentation files**:

   - Remove references to "unified"
   - Update examples and code snippets

2. **Clean up legacy references**:
   - Remove deprecated aliases
   - Clean up unused imports
   - Remove redundant comments

## Risk Assessment

### High Risk Areas

1. **IPC Channel Changes**: Breaking changes to backend communication
2. **DOM Element IDs**: Potential UI breakage if not updated consistently
3. **Module Registration**: Application startup failures if module loading fails
4. **Database File Names**: Data loss risk if file renaming not handled properly

### Mitigation Strategies

1. **Backward Compatibility**: Maintain old IPC channels during transition period
2. **Gradual Migration**: Update one component at a time with thorough testing
3. **Comprehensive Testing**: Test each phase before proceeding to next
4. **Rollback Plan**: Ability to revert changes if issues arise

## Testing Strategy

### Unit Testing

1. **Module Loading**: Verify ResourceManager loads correctly
2. **Method Functionality**: Test all renamed methods work as expected
3. **Event Emissions**: Verify events are emitted with new names
4. **IPC Communication**: Test backend communication still works

### Integration Testing

1. **Cross-module Communication**: Test TagManager and other module interactions
2. **UI Functionality**: Verify all UI elements work with new IDs
3. **Data Persistence**: Test database operations with new naming
4. **Export/Import**: Test file operations with new naming

### End-to-End Testing

1. **Complete Workflows**: Test full resource management workflows
2. **Error Handling**: Test error scenarios and recovery
3. **Performance**: Ensure no performance degradation
4. **User Experience**: Verify UI remains intuitive and functional

## Rollback Plan

### Immediate Rollback

1. **Git Revert**: `git revert` to previous commit
2. **Database Backup**: Restore from backup if needed
3. **Configuration Reset**: Reset any changed configuration files

### Gradual Rollback

1. **Feature Flags**: Implement feature flags for gradual rollback
2. **Dual Support**: Maintain both old and new naming during transition
3. **Monitoring**: Monitor for issues and rollback specific components

## Success Criteria

### Functional Requirements

- [ ] All resource management functionality works as before
- [ ] No breaking changes to user workflows
- [ ] All UI elements function correctly
- [ ] Database operations work seamlessly
- [ ] Export/import functionality preserved

### Technical Requirements

- [ ] No console errors or warnings
- [ ] All tests pass
- [ ] Performance metrics maintained
- [ ] Code coverage preserved
- [ ] Documentation updated

### User Experience Requirements

- [ ] No visible changes to user interface
- [ ] All user workflows work identically
- [ ] No data loss or corruption
- [ ] Smooth transition with no downtime

## Timeline

### Week 1: Preparation

- Create backup branch
- Document current state
- Create migration scripts
- Set up testing environment

### Week 2: Core Module Changes

- Rename main module file
- Update class and method names
- Update ModuleLoader integration
- Unit testing

### Week 3: Backend Integration

- Rename database manager
- Update IPC channels
- Test backend communication
- Integration testing

### Week 4: Frontend Integration

- Update app.js and dependencies
- Update UI element IDs
- Update CSS classes
- End-to-end testing

### Week 5: Cleanup and Documentation

- Update type definitions
- Clean up legacy references
- Update documentation
- Final testing and validation

## Post-Migration Tasks

### Monitoring

1. **Error Monitoring**: Watch for any new errors or warnings
2. **Performance Monitoring**: Ensure no performance impact
3. **User Feedback**: Monitor for any user-reported issues

### Cleanup

1. **Remove Legacy Code**: Clean up any remaining "unified" references
2. **Optimize Imports**: Remove unused imports and dependencies
3. **Update Documentation**: Final documentation updates

### Future Considerations

1. **API Versioning**: Consider API versioning for future changes
2. **Migration Tools**: Create tools for future migrations
3. **Naming Conventions**: Establish clear naming conventions for future modules

## Conclusion

This renaming represents a significant but manageable change to the codebase. With proper planning, testing, and execution, the transition from `UnifiedResourceManager` to `ResourceManager` can be completed successfully while maintaining all functionality and user experience.

The key to success is the systematic approach, comprehensive testing, and ability to rollback if issues arise. The benefits of simplified naming and improved consistency will outweigh the temporary complexity of the migration process.
