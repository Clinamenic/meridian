# Arweave Tagging Analysis and Planning Document

## Executive Summary

This document analyzes the current Arweave upload functionality in Meridian where custom tags are not appearing on uploaded transactions, despite the upload process completing successfully. Through code analysis and web research on best practices, we've identified potential issues and propose solutions to ensure reliable tag functionality.

## Problem Statement

**Issue**: When uploading files to Arweave using Meridian, custom tags (e.g., 'testfield: testvalue') are not appearing on Viewblock or other Arweave explorers. Only standard arkb-generated tags are visible:

- User-Agent: arkb
- User-Agent-Version: 1.1.61
- Type: file
- Content-Type: image/jpeg
- File-Hash: [hash]

**Expected Behavior**: Custom tags should appear alongside standard tags on the uploaded transaction.

## Current Implementation Analysis

### 1. Tag Flow Architecture

```
User Interface (app.js)
    ↓
Upload Modal Tag Collection
    ↓
Format as "key:value" strings
    ↓
ArweaveManager.uploadFile()
    ↓
prepareUploadTags() Enhancement
    ↓
arkb CLI with --tag arguments
    ↓
Arweave Network
```

### 2. Code Analysis

#### Frontend Tag Collection (`src/renderer/app.js:4498-4551`)

```javascript
// Convert tags to Arweave format (array of "key:value" strings)
const arweaveTags = this.uploadTags.map((tag) => `${tag.key}:${tag.value}`);

// Upload the file
const result = await window.electronAPI.archive.uploadFile(
  this.selectedFile.path,
  arweaveTags
);
```

#### Backend Tag Processing (`src/main/arweave-manager.ts:571-669`)

```typescript
// Resolve UUID and prepare enhanced tags
const uuidResult = await this.resolveUUID(filePath);
const enhancedTags = await this.prepareUploadTags(
  filePath,
  uuidResult.uuid,
  tags
);

// Build arkb command arguments array
const args = ["deploy", filePath, "--wallet", walletPath];

// Add enhanced tags as separate arguments
for (const tag of enhancedTags) {
  args.push("--tag", tag);
}

// Add final flags
args.push("--no-bundle", "--auto-confirm");
```

#### Tag Enhancement (`src/main/arweave-manager.ts:997-1045`)

```typescript
private async prepareUploadTags(filePath: string, uuid: string, userTags: string[] = []): Promise<string[]> {
  const tags: string[] = [];

  // Add UUID tag (critical for querying)
  tags.push(`uuid:${uuid}`);
  // ... system tags ...

  // Add user-provided tags
  for (const tag of userTags) {
    // Avoid duplicates and ensure proper formatting
    if (!tags.includes(tag) && !tags.includes(`tag:${tag}`)) {
      tags.push(tag.includes(':') ? tag : `tag:${tag}`);
    }
  }

  return tags;
}
```

## Web Research Findings

### 1. arkb Documentation Analysis

From [GitHub arkb repository](https://github.com/textury/arkb) and [Arweave Cookbook](https://cookbook.arweave.dev/guides/deployment/arkb.html):

**Official tag syntax options:**

```bash
# Option 1: Separate name/value arguments
arkb deploy [file] --tag-name "key" --tag-value "value"

# Option 2: Combined tag argument
arkb deploy [file] --tag "key:value"
```

### 2. Arweave Tag Best Practices

From [Arweave Standards](https://github.com/ArweaveTeam/arweave-standards) and [Transaction Metadata Guide](https://cookbook.arweave.dev/concepts/tags.html):

**Key Requirements:**

- Tags are Base64URL encoded key-value pairs
- Maximum total size: 2048 bytes for all tags combined
- Special characters may require escaping
- Common naming patterns exist in the community

**Recommended tag patterns:**

```
Content-Type: [MIME type]
App-Name: [Application identifier]
Title: [Human readable name]
Description: [Content description]
[Custom-Key]: [Custom-Value]
```

### 3. Command Line Argument Handling

**Potential Issues:**

- Special characters in tag values may require shell escaping
- Multiple `--tag` arguments may not be processed correctly
- Colon separator might conflict with some systems

## Root Cause Analysis

### Primary Suspected Issues

1. **Argument Escaping**: The current implementation doesn't escape special characters in tag values
2. **Command Construction**: Using spawn vs. exec may affect argument parsing
3. **Tag Format**: The "key:value" format may not be properly handled by arkb
4. **Character Encoding**: Special characters might be causing parsing failures

### Secondary Considerations

1. **Tag Size Limits**: Approaching the 2048-byte limit with enhanced tags
2. **Duplicate Handling**: The duplicate prevention logic might be removing user tags
3. **arkb Version**: Different arkb versions may handle tags differently

## Proposed Solutions

### Phase 1: Immediate Diagnostic Implementation

#### 1.1 Enhanced Logging and Debugging

```typescript
// Add comprehensive logging to uploadFile method
console.log("Enhanced tags being sent to arkb:", enhancedTags);
console.log("Total tag size:", enhancedTags.join("").length, "bytes");
console.log("Full arkb command:", this.arkbPath, args.join(" "));

// Log arkb stdout/stderr in detail
console.log("arkb stdout:", stdout);
console.log("arkb stderr:", stderr);
```

#### 1.2 Tag Validation Function

```typescript
private validateTags(tags: string[]): { valid: string[], invalid: string[], totalSize: number } {
  const valid: string[] = [];
  const invalid: string[] = [];
  let totalSize = 0;

  for (const tag of tags) {
    if (!tag.includes(':')) {
      invalid.push(tag);
      continue;
    }

    const [key, value] = tag.split(':', 2);
    if (!key.trim() || !value.trim()) {
      invalid.push(tag);
      continue;
    }

    totalSize += tag.length;
    if (totalSize > 2000) { // Leave buffer for encoding
      invalid.push(tag);
      continue;
    }

    valid.push(tag);
  }

  return { valid, invalid, totalSize };
}
```

### Phase 2: Alternative Tag Implementation

#### 2.1 Switch to --tag-name/--tag-value Syntax

```typescript
// Build arkb command using separate name/value arguments
const args = ["deploy", filePath, "--wallet", walletPath];

for (const tag of enhancedTags) {
  const [key, value] = tag.split(":", 2);
  if (key && value) {
    args.push("--tag-name", key.trim(), "--tag-value", value.trim());
  }
}

args.push("--no-bundle", "--auto-confirm");
```

#### 2.2 Improved Argument Escaping

```typescript
private escapeTagValue(value: string): string {
  // Escape special characters for shell safety
  return value
    .replace(/\\/g, '\\\\')  // Escape backslashes
    .replace(/"/g, '\\"')    // Escape quotes
    .replace(/'/g, "\\'")    // Escape single quotes
    .replace(/\$/g, '\\$')   // Escape dollar signs
    .replace(/`/g, '\\`');   // Escape backticks
}
```

### Phase 3: Enhanced User Experience

#### 3.1 Real-time Tag Validation in UI

```javascript
validateTag(key, value) {
  const errors = [];

  if (!key.trim()) errors.push('Tag key cannot be empty');
  if (!value.trim()) errors.push('Tag value cannot be empty');
  if (key.includes(':')) errors.push('Tag key cannot contain colons');
  if (key.length > 100) errors.push('Tag key too long (max 100 characters)');
  if (value.length > 500) errors.push('Tag value too long (max 500 characters)');

  return errors;
}
```

#### 3.2 Tag Preview and Verification

```javascript
// Add to upload modal: preview final tags before upload
showTagPreview() {
  const preview = this.uploadTags.map(tag => `${tag.key}:${tag.value}`);
  console.log('Tags that will be uploaded:', preview);
  // Display in modal for user confirmation
}
```

### Phase 4: Testing and Verification Framework

#### 4.1 Automated Tag Testing

```typescript
public async testTagUpload(testTags: Array<{key: string, value: string}>): Promise<boolean> {
  // Create minimal test file
  const testFile = await this.createTestFile();

  try {
    // Format tags
    const formattedTags = testTags.map(tag => `${tag.key}:${tag.value}`);

    // Upload with test tags
    const result = await this.uploadFile(testFile, formattedTags);

    if (!result.success) return false;

    // Wait for confirmation
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify tags appeared
    return await this.verifyTagsOnTransaction(result.transactionId!, testTags);

  } finally {
    // Cleanup test file
    await fs.promises.unlink(testFile);
  }
}
```

#### 4.2 GraphQL Tag Verification

```typescript
private async verifyTagsOnTransaction(txId: string, expectedTags: Array<{key: string, value: string}>): Promise<boolean> {
  try {
    const query = `
      query {
        transactions(ids: ["${txId}"]) {
          edges {
            node {
              tags {
                name
                value
              }
            }
          }
        }
      }
    `;

    const response = await fetch('https://arweave.net/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    const data = await response.json();
    const tags = data.data.transactions.edges[0]?.node.tags || [];

    // Check if all expected tags are present
    return expectedTags.every(expected =>
      tags.some((tag: any) =>
        tag.name === expected.key && tag.value === expected.value
      )
    );

  } catch (error) {
    console.error('Tag verification failed:', error);
    return false;
  }
}
```

## Implementation Timeline

### Week 1: Diagnostic Phase

- [ ] Implement enhanced logging and debugging
- [ ] Add tag validation function
- [ ] Test with current implementation to identify exact failure point
- [ ] Document arkb command output and behavior

### Week 2: Alternative Implementation

- [ ] Implement --tag-name/--tag-value approach
- [ ] Add argument escaping
- [ ] Test with various tag formats and special characters
- [ ] Compare success rates between approaches

### Week 3: UI Enhancement

- [ ] Add real-time tag validation to upload modal
- [ ] Implement tag preview functionality
- [ ] Add error handling and user feedback for tag issues
- [ ] Test edge cases (long tags, special characters, etc.)

### Week 4: Testing and Verification

- [ ] Implement automated tag testing framework
- [ ] Add GraphQL verification system
- [ ] Create comprehensive test suite
- [ ] Document best practices for users

## Success Criteria

1. **Custom tags appear consistently** on Viewblock and other Arweave explorers
2. **Error handling provides clear feedback** when tags fail to upload
3. **UI validates tags** before allowing upload
4. **Automated tests verify** tag functionality
5. **Documentation exists** for users on tag best practices

## Risk Mitigation

### Technical Risks

- **arkb version compatibility**: Test with multiple arkb versions
- **Platform differences**: Test on macOS, Windows, Linux
- **Special character handling**: Comprehensive escaping tests

### User Experience Risks

- **Breaking existing functionality**: Maintain backward compatibility
- **Confusing error messages**: Clear, actionable error descriptions
- **Performance impact**: Minimize overhead from validation

## Next Steps

1. **Immediate**: Implement Phase 1 diagnostic logging
2. **Priority**: Test the --tag-name/--tag-value approach
3. **Validate**: Confirm tag appearance on Arweave network
4. **Iterate**: Refine based on test results
5. **Document**: Create user guidelines for effective tagging

## References

- [arkb GitHub Repository](https://github.com/textury/arkb)
- [Arweave Cookbook - arkb Guide](https://cookbook.arweave.dev/guides/deployment/arkb.html)
- [Arweave Transaction Metadata Guide](https://cookbook.arweave.dev/concepts/tags.html)
- [Arweave Standards Repository](https://github.com/ArweaveTeam/arweave-standards)
- [Arweave GraphQL Guide](https://gql-guide.arweave.dev/)
