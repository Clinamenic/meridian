# Unified Resource Manager Test Plan

## Overview

This document outlines comprehensive testing procedures to verify that the UnifiedResourceManager fixes work correctly, particularly focusing on the collapse/expand functionality and tag filtering issues that were identified.

## Test Environment Setup

### Prerequisites

1. Meridian application running
2. Workspace selected with existing resources
3. Multiple resources with different tags
4. Browser developer tools open for debugging

### Test Data Requirements

- At least 5-10 resources with various tags
- Mix of internal and external resources
- Resources with and without descriptions
- Resources with Arweave uploads

## Test Cases

### Phase 1: Collapse/Expand Functionality

#### Test Case 1.1: Global Collapse/Expand

**Objective**: Verify that the "Collapse All" and "Expand All" buttons work correctly

**Steps**:

1. Open Unified Resource Manager panel
2. Verify all resources are initially expanded
3. Click "Collapse All" button
4. **Expected Result**: All resources collapse, button icon changes to expand
5. Click "Expand All" button
6. **Expected Result**: All resources expand, button icon changes to collapse

**Validation Points**:

- Button state changes correctly
- All resource items collapse/expand simultaneously
- Individual collapse buttons remain functional after global operations

#### Test Case 1.2: Individual Resource Collapse

**Objective**: Verify that individual resource collapse buttons work correctly

**Steps**:

1. Ensure all resources are expanded
2. Click individual collapse button on first resource
3. **Expected Result**: Only that resource collapses, others remain expanded
4. Click the same button again
5. **Expected Result**: Resource expands again
6. Test with multiple resources simultaneously

**Validation Points**:

- Individual collapse state is maintained independently
- Collapse state persists after filtering operations
- Visual indicators (arrows) change correctly

#### Test Case 1.3: Collapse State Persistence

**Objective**: Verify that collapse state is saved and restored

**Steps**:

1. Collapse some resources individually
2. Click "Collapse All"
3. Refresh the page or restart the application
4. **Expected Result**: Collapse state is restored correctly
5. Verify both global and individual states are preserved

**Validation Points**:

- localStorage is updated correctly
- State restoration works on page reload
- No conflicts between global and individual states

### Phase 2: Tag Filtering Functionality

#### Test Case 2.1: Basic Tag Filtering

**Objective**: Verify that tag filters work correctly

**Steps**:

1. Identify resources with specific tags
2. Click on a tag filter button
3. **Expected Result**: Only resources with that tag are shown
4. Click the same tag again
5. **Expected Result**: Tag filter is removed, all resources shown

**Validation Points**:

- Filter buttons show correct active state
- Resource count updates correctly
- Filter logic works as expected

#### Test Case 2.2: Multiple Tag Filtering (ANY Logic)

**Objective**: Verify ANY logic for multiple tag filters

**Steps**:

1. Set filter logic to "ANY" (default)
2. Select multiple tag filters
3. **Expected Result**: Resources with ANY of the selected tags are shown
4. Verify count matches expected number

**Validation Points**:

- Resources with any of the selected tags are visible
- Resources with none of the selected tags are hidden
- Count display is accurate

#### Test Case 2.3: Multiple Tag Filtering (ALL Logic)

**Objective**: Verify ALL logic for multiple tag filters

**Steps**:

1. Set filter logic to "ALL"
2. Select multiple tag filters
3. **Expected Result**: Only resources with ALL selected tags are shown
4. Verify count matches expected number

**Validation Points**:

- Only resources with all selected tags are visible
- Filter logic button shows correct state
- Count display is accurate

#### Test Case 2.4: Tag Filter with Search

**Objective**: Verify tag filters work correctly with search

**Steps**:

1. Apply a tag filter
2. Enter search term
3. **Expected Result**: Only resources matching both tag filter AND search are shown
4. Clear search
5. **Expected Result**: Only tag filter is applied

**Validation Points**:

- Combined filtering works correctly
- Search and tag filters are independent
- Clear filters button resets both

### Phase 3: State Management

#### Test Case 3.1: State Synchronization

**Objective**: Verify that state is properly synchronized across all operations

**Steps**:

1. Perform various operations (collapse, filter, search)
2. Check browser console for state change events
3. **Expected Result**: Events are emitted correctly
4. Verify no state inconsistencies

**Validation Points**:

- State updates are atomic
- Events are emitted for all state changes
- No orphaned state properties

#### Test Case 3.2: Error Handling

**Objective**: Verify error handling works correctly

**Steps**:

1. Simulate network errors (disconnect internet)
2. Try to add/remove tags
3. **Expected Result**: Error messages are shown
4. Verify state remains consistent

**Validation Points**:

- Error events are emitted
- User feedback is provided
- State doesn't become corrupted

### Phase 4: Performance Testing

#### Test Case 4.1: Large Dataset Performance

**Objective**: Verify performance with large numbers of resources

**Steps**:

1. Load 100+ resources
2. Apply various filters and collapse operations
3. **Expected Result**: Operations remain responsive
4. Monitor memory usage

**Validation Points**:

- UI remains responsive
- Memory usage is reasonable
- No memory leaks

#### Test Case 4.2: Rapid State Changes

**Objective**: Verify stability during rapid state changes

**Steps**:

1. Rapidly click collapse/expand buttons
2. Rapidly change tag filters
3. **Expected Result**: No crashes or state corruption
4. Final state is correct

**Validation Points**:

- No race conditions
- State remains consistent
- UI updates correctly

## Automated Testing

### Unit Tests to Implement

```javascript
// Test collapse state management
describe("Collapse State Management", () => {
  test("should toggle global collapse state correctly", () => {
    // Implementation
  });

  test("should maintain individual collapse states", () => {
    // Implementation
  });

  test("should persist collapse state to localStorage", () => {
    // Implementation
  });
});

// Test tag filtering
describe("Tag Filtering", () => {
  test("should filter resources by single tag", () => {
    // Implementation
  });

  test("should apply ANY logic correctly", () => {
    // Implementation
  });

  test("should apply ALL logic correctly", () => {
    // Implementation
  });

  test("should combine search and tag filters", () => {
    // Implementation
  });
});

// Test state management
describe("State Management", () => {
  test("should emit events on state changes", () => {
    // Implementation
  });

  test("should handle errors gracefully", () => {
    // Implementation
  });

  test("should maintain state consistency", () => {
    // Implementation
  });
});
```

## Manual Testing Checklist

### Collapse/Expand Functionality

- [ ] Global collapse/expand works
- [ ] Individual collapse/expand works
- [ ] State persists after page reload
- [ ] No conflicts between global and individual states
- [ ] Visual indicators update correctly

### Tag Filtering

- [ ] Single tag filtering works
- [ ] Multiple tag filtering (ANY) works
- [ ] Multiple tag filtering (ALL) works
- [ ] Filter logic toggle works
- [ ] Clear filters works
- [ ] Search + tag filter combination works

### State Management

- [ ] Events are emitted correctly
- [ ] Error handling works
- [ ] State remains consistent
- [ ] Performance is acceptable
- [ ] No memory leaks

## Success Criteria

### Functional Requirements

1. **Collapse/Expand**: All collapse/expand operations work correctly and maintain state
2. **Tag Filtering**: All filtering operations work correctly with proper logic
3. **State Management**: State is consistent and properly synchronized
4. **Error Handling**: Errors are handled gracefully without state corruption

### Performance Requirements

1. **Responsiveness**: UI remains responsive with 100+ resources
2. **Memory**: No significant memory leaks during extended use
3. **Stability**: No crashes during rapid state changes

### User Experience Requirements

1. **Feedback**: Users receive appropriate feedback for all operations
2. **Consistency**: UI behavior is consistent across all operations
3. **Intuitiveness**: Operations behave as users would expect

## Reporting

### Test Results Template

```
Test Case: [ID]
Status: [PASS/FAIL]
Date: [YYYY-MM-DD]
Tester: [Name]
Environment: [Details]

Description:
[Brief description of what was tested]

Steps:
[Detailed steps taken]

Expected Results:
[What should happen]

Actual Results:
[What actually happened]

Issues Found:
[Any issues or bugs discovered]

Notes:
[Additional observations or comments]
```

### Bug Report Template

```
Bug ID: [Auto-generated]
Severity: [Critical/High/Medium/Low]
Priority: [High/Medium/Low]
Status: [Open/In Progress/Fixed/Closed]

Summary:
[Brief description of the bug]

Steps to Reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Expected Behavior:
[What should happen]

Actual Behavior:
[What actually happens]

Environment:
- OS: [Operating System]
- Browser: [Browser and version]
- Meridian Version: [Version]

Additional Information:
[Screenshots, logs, etc.]
```

## Conclusion

This test plan provides comprehensive coverage of the UnifiedResourceManager fixes. All tests should be executed to ensure the system works correctly and meets the specified requirements. Any failures should be documented and addressed before considering the fixes complete.
