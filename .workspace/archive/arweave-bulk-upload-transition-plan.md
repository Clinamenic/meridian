# Arweave Site Publishing Process Transition Plan

## From Individual Page Uploads to Bulk Directory Upload

**Document Version:** 1.0  
**Date:** September 11, 2025  
**Author:** AI Assistant  
**Status:** Planning Phase

---

## Executive Summary

This document outlines a comprehensive plan to transition Meridian's Arweave site publishing process from uploading individual pages separately to uploading the entire site directory at once. This change will significantly simplify the deployment process, reduce upload time, and minimize potential errors.

### 🔍 Key Research Findings

**MAJOR DISCOVERY:** arkb v1.1.61 (already installed) natively supports directory uploads with manifest generation!

**Research Results:**

- ✅ **arkb Directory Upload:** `arkb deploy folder/` with `--index index.html` creates manifests
- ✅ **Zero New Dependencies:** Can implement bulk upload using existing arkb installation
- ✅ **Simplified Implementation:** Single command replaces complex file iteration loop
- ✅ **Faster Timeline:** 3 weeks instead of 6 weeks (50% time reduction)

**Impact Assessment:**

- **Implementation Complexity:** Reduced from High to Low
- **New Dependencies Required:** None (arkb already installed)
- **Breaking Changes:** None (maintains backward compatibility)
- **Expected Benefits:** 60-80% upload time reduction with minimal code changes

## Current State Analysis

### Current Implementation Review

**Location:** `src/main/arweave-manager.ts` (lines 1703-1852)

**Current Process:**

1. **Individual File Upload:** The `uploadSiteBundle()` method iterates through each file in the build directory
2. **Sequential Processing:** Files are uploaded one by one using `uploadFileDirect()`
3. **Manual Manifest Creation:** After all individual uploads, a path manifest is created and uploaded
4. **Tool Used:** arkb CLI v1.1.61 with individual `deploy` commands

**Current Upload Flow:**

```typescript
// For each file in build directory:
for (const filePath of filePaths) {
  const result = await this.uploadFileDirect(filePath, fileTags);
  // Process result and track uploaded files
}
// Create and upload manifest separately
const pathManifest = this.createArweavePathManifest(uploadedFiles, manifest);
const manifestResult = await this.uploadArweavePathManifest(pathManifest);
```

**Identified Issues:**

1. **Time Intensive:** Each file requires separate arkb process execution
2. **Error Prone:** Partial failures can leave site in inconsistent state
3. **Complex State Management:** Tracking individual upload results adds complexity
4. **Network Overhead:** Multiple separate transactions instead of single bundled transaction
5. **Cost Inefficiency:** Multiple transaction fees instead of single bundled cost

### Current Technology Stack

- **Tool:** arkb v1.1.61 (already installed as dependency)
- **Upload Method:** Individual file deployment via arkb CLI
- **Manifest Creation:** Custom Arweave path manifest generation
- **File Processing:** Node.js file system operations with spawn processes

## Proposed Solution: Bulk Directory Upload

### Research Findings

Based on web research and current industry practices, three viable approaches exist:

#### Option A: Enhanced arkb Usage (Recommended)

- **Status:** Investigate if arkb v1.1.61+ supports directory upload
- **Benefit:** Minimal codebase changes, uses existing dependency
- **Implementation:** Replace individual file uploads with single directory upload command

#### Option B: Irys SDK Integration

- **Tool:** Irys (formerly Bundlr) SDK
- **Method:** `uploadFolder()` function with automatic manifest generation
- **Benefits:** Purpose-built for bulk uploads, excellent TypeScript support
- **Trade-off:** Additional dependency, migration required

#### Option C: ArDrive Integration

- **Tool:** ArDrive CLI or API
- **Method:** Programmatic folder upload with manifest creation
- **Benefits:** User-friendly, robust manifest handling
- **Trade-off:** Additional dependency, different upload paradigm

### Recommended Implementation Strategy

**Primary Approach: Enhanced arkb Usage**

1. Research arkb v1.1.61+ documentation for directory upload capabilities
2. If supported, modify `uploadSiteBundle()` to use directory upload
3. Maintain fallback to current individual file approach

**Fallback Approach: Irys SDK Integration**

1. Add Irys SDK as dependency
2. Implement parallel upload capability
3. Provide user choice between methods

## Technical Implementation Plan

### Phase 1: Research and Proof of Concept (Week 1)

## Research Findings Summary

### arkb v1.1.61 Capability Assessment ✅ COMPLETED

**Key Discovery:** arkb already supports directory upload with manifest generation!

**CLI Analysis Results:**

```bash
# arkb supports directory deployment
arkb deploy <folder_or_file>

# Key directory upload options:
--index -i                              Set path manifest index for a directory upload
--bundle                                Locally bundle your files and deploy to Arweave
--use-bundler <host_or_ip>              Use an ans104 bundler
--tag-name <name>                       Set a tag name
--tag-value <value>                     Set a tag value
--auto-confirm                          Skips the confirm screen
--force -f                              Force a redeploy of all the files
```

**Directory Upload Examples from arkb help:**

```bash
# Basic directory deployment
arkb deploy folder/path/ --wallet path/to/my/wallet.json

# Custom index file (manifest support)
arkb deploy folder/path --index custom.html

# Using bundles for efficiency
arkb deploy folder --use-bundler https://node2.bundlr.network
```

**Critical Finding:** arkb v1.1.61 natively supports:

- ✅ Directory upload (`arkb deploy folder/`)
- ✅ Manifest generation (`--index` flag)
- ✅ Bundle creation (`--bundle` flag)
- ✅ Tag support (`--tag-name`, `--tag-value`)
- ✅ Auto-confirmation (`--auto-confirm`)

**Implementation Impact:** This means we can implement bulk directory upload using the existing arkb dependency with minimal code changes!

### Irys SDK Evaluation ✅ COMPLETED

**Research Summary:** Irys (formerly Bundlr) provides modern, efficient bulk upload capabilities.

**Key Features:**

- ✅ `uploadFolder()` method for directory uploads
- ✅ Automatic manifest generation with `indexFile` support
- ✅ Batch processing with configurable `batchSize`
- ✅ Built-in error handling and retry logic
- ✅ TypeScript support with comprehensive types

**Implementation Example:**

```typescript
import { Irys } from "@irys/sdk";

const irys = new Irys({
  url: "https://node2.irys.xyz",
  token: "arweave",
  wallet: walletJWK,
});

const result = await irys.uploadFolder("./build-directory", {
  indexFile: "index.html",
  batchSize: 50,
  keepDeleted: false,
});
```

**Advantages over arkb:**

- Modern async/await API design
- Better error handling and progress reporting
- Configurable batch processing
- More comprehensive TypeScript support
- Active development and support

**Trade-offs:**

- Additional dependency (~2MB)
- Different API paradigm from current arkb usage
- Requires code migration

### Alternative Tools Research ✅ COMPLETED

**ArDrive Web/CLI:**

- ✅ Web interface for non-technical users
- ✅ CLI available for automation
- ✅ Robust manifest handling
- ❌ Additional dependency and learning curve

**Arseeding SDK:**

- ✅ Static site deployment focus
- ✅ Manifest optimization
- ❌ Less mature ecosystem

**ArLoader:**

- ✅ Bulk upload capabilities
- ✅ Gigabyte-scale data handling
- ❌ More complex setup

### Recommended Implementation Strategy (UPDATED)

**Primary Approach: Enhanced arkb Usage** ⭐ RECOMMENDED

- **Rationale:** arkb already supports directory uploads with manifests
- **Benefit:** Zero new dependencies, minimal code changes
- **Implementation:** Modify existing `uploadSiteBundle()` to use directory upload instead of file iteration

**Secondary Approach: Irys SDK Integration**

- **Rationale:** Modern API with better error handling
- **Benefit:** Superior development experience and reliability
- **Implementation:** Add as alternative method with fallback to arkb

### Phase 2: Implementation Design (Week 2)

#### 2.1 Architecture Design (UPDATED WITH RESEARCH FINDINGS)

**Revised Implementation Strategy:**
Based on research findings, arkb directory upload should be the primary method since it requires no new dependencies.

**New Method Signature:**

```typescript
public async uploadSiteBundleBulk(
  buildPath: string,
  manifest: ArweaveDeployManifest,
  method: 'arkb-directory' | 'irys' | 'legacy' = 'arkb-directory'
): Promise<ArweaveDeployResult>
```

**Implementation Priority (Updated):**

1. **arkb Directory Upload** (Primary) - Use existing dependency
2. **Irys SDK** (Alternative) - Modern API for advanced use cases
3. **Legacy Individual Files** (Fallback) - Current method as backup

**Implementation Strategy:**

1. **Native arkb Directory Upload:** Leverage `arkb deploy folder/` with `--index` flag
2. **Graceful Fallback:** Fall back to current method if directory upload fails
3. **Optional Irys Integration:** Add Irys as enhanced alternative
4. **Progress Reporting:** Maintain progress feedback for large uploads

**Key Advantages of arkb-first approach:**

- Zero new dependencies
- Minimal code changes required
- Uses familiar arkb command structure
- Maintains existing error handling patterns

#### 2.2 Code Structure Changes

**New Files to Create:**

- `src/main/arweave-bulk-uploader.ts` - Bulk upload implementations
- `src/types/arweave-bulk-types.ts` - Type definitions for bulk upload

**Files to Modify:**

- `src/main/arweave-manager.ts` - Add bulk upload orchestration
- `src/main/site-deploy-manager.ts` - Update deployment flow
- `package.json` - Add Irys SDK dependency (if chosen)

### Phase 3: Implementation (Week 3-4)

#### 3.1 arkb Directory Upload Implementation (PRIMARY)

**Based on research findings, this is the recommended approach using existing arkb capabilities:**

```typescript
class ArweaveBulkUploader {
  async uploadDirectoryWithArkb(
    buildPath: string,
    manifest: ArweaveDeployManifest
  ): Promise<ArweaveDeployResult> {
    try {
      const walletJWK = await this.getActiveWalletJWK();
      if (!walletJWK) {
        throw new Error("No Arweave wallet configured");
      }

      const walletPath = await this.createTempWalletFile(walletJWK);

      // Build arkb directory upload command based on research findings
      const args = [
        "deploy",
        buildPath, // Deploy entire directory
        "--wallet",
        walletPath,
        "--index",
        "index.html", // Set manifest index file
        "--bundle", // Use bundling for efficiency
        "--auto-confirm", // Skip confirmation
        "--tag-name",
        "meridian:site-id",
        "--tag-value",
        manifest.siteId,
        "--tag-name",
        "meridian:version",
        "--tag-value",
        manifest.version,
        "--tag-name",
        "meridian:timestamp",
        "--tag-value",
        manifest.timestamp,
        "--tag-name",
        "meridian:generator",
        "--tag-value",
        "Meridian Quartz",
      ];

      console.log(
        `Executing arkb directory upload: ${this.arkbPath} ${args.join(" ")}`
      );

      // Execute directory upload using spawn
      const { spawn } = require("child_process");
      const spawnResult = await new Promise<{ stdout: string; stderr: string }>(
        (resolve, reject) => {
          const process = spawn(this.arkbPath, args, { timeout: 600000 }); // 10 min timeout
          let stdout = "";
          let stderr = "";

          process.stdout.on("data", (data: Buffer) => {
            stdout += data.toString();
            console.log(`[arkb] ${data.toString()}`);
          });

          process.stderr.on("data", (data: Buffer) => {
            stderr += data.toString();
            console.warn(`[arkb stderr] ${data.toString()}`);
          });

          process.on("close", (code: number) => {
            if (code === 0) {
              resolve({ stdout, stderr });
            } else {
              reject(
                new Error(
                  `arkb directory upload failed with code ${code}: ${stderr}`
                )
              );
            }
          });

          process.on("error", (error: Error) => {
            reject(error);
          });
        }
      );

      // Clean up temp wallet file
      await this.cleanupTempWallet();

      // Parse result to get manifest transaction ID
      const parseResult = this.parseArkbOutput(spawnResult.stdout);

      if (!parseResult.transactionId) {
        throw new Error(
          "Failed to parse transaction ID from arkb directory upload"
        );
      }

      // Return standardized result format
      return {
        success: true,
        transactionId: parseResult.transactionId,
        manifestHash: parseResult.transactionId,
        manifestUrl: `https://arweave.net/${parseResult.transactionId}`,
        url: `https://arweave.net/${parseResult.transactionId}`, // Manifest serves as site entry point
        totalCost: { ar: "0" }, // Cost estimation can be added later
        fileCount: await this.countFilesInDirectory(buildPath),
        totalSize: await this.calculateDirectorySize(buildPath),
        uploadedFiles: [], // Directory upload doesn't provide individual file details
      } as ArweaveDeployResult;
    } catch (error) {
      console.error("arkb directory upload failed:", error);
      throw error;
    }
  }

  private async countFilesInDirectory(dirPath: string): Promise<number> {
    const files = await this.getAllFiles(dirPath);
    return files.filter((file) => fs.statSync(file).isFile()).length;
  }

  private async calculateDirectorySize(dirPath: string): Promise<number> {
    const files = await this.getAllFiles(dirPath);
    let totalSize = 0;
    for (const file of files) {
      const stats = fs.statSync(file);
      if (stats.isFile()) {
        totalSize += stats.size;
      }
    }
    return totalSize;
  }
}
```

**Key Implementation Changes:**

- ✅ Uses `arkb deploy buildPath` for directory upload
- ✅ Leverages `--index index.html` for manifest generation
- ✅ Includes `--bundle` for efficient upload
- ✅ Maintains existing tag structure
- ✅ Preserves error handling patterns

#### 3.2 Irys-Based Implementation

```typescript
async uploadDirectoryWithIrys(
  buildPath: string,
  manifest: ArweaveDeployManifest
): Promise<ArweaveDeployResult> {
  const irys = new Irys({
    url: "https://node2.irys.xyz",
    token: "arweave",
    wallet: await this.getActiveWalletJWK()
  });

  const tags = [
    { name: "Content-Type", value: "application/x.arweave-manifest+json" },
    { name: "meridian:site-id", value: manifest.siteId },
    { name: "meridian:version", value: manifest.version },
    { name: "meridian:generator", value: "Meridian Quartz" }
  ];

  const result = await irys.uploadFolder(buildPath, {
    indexFile: "index.html",
    tags: tags
  });

  return this.processIrysUploadResult(result);
}
```

#### 3.3 Integration with Existing Code

**Modified `uploadSiteBundle()` method (UPDATED BASED ON RESEARCH):**

```typescript
public async uploadSiteBundle(
  buildPath: string,
  manifest: ArweaveDeployManifest
): Promise<ArweaveDeployResult> {
  console.log('[ArweaveManager] Starting site bundle upload with bulk directory method');

  try {
    // Primary: Try arkb directory upload (recommended based on research)
    console.log('[ArweaveManager] Attempting arkb directory upload');
    return await this.uploadDirectoryWithArkb(buildPath, manifest);

  } catch (arkbError) {
    console.warn('[ArweaveManager] arkb directory upload failed:', arkbError);

    // Check if user has Irys SDK available as fallback
    try {
      const irysAvailable = await this.checkIrysAvailability();
      if (irysAvailable) {
        console.log('[ArweaveManager] Attempting Irys SDK upload');
        return await this.uploadDirectoryWithIrys(buildPath, manifest);
      }
    } catch (irysError) {
      console.warn('[ArweaveManager] Irys upload failed:', irysError);
    }

    // Final fallback: Use current individual file method
    console.log('[ArweaveManager] Falling back to legacy individual file upload');
    return await this.uploadSiteBundleLegacy(buildPath, manifest);
  }
}

/**
 * Legacy method - renames current implementation for fallback use
 */
private async uploadSiteBundleLegacy(
  buildPath: string,
  manifest: ArweaveDeployManifest
): Promise<ArweaveDeployResult> {
  // This is the current uploadSiteBundle implementation
  // (individual file upload loop)
  // ... existing implementation ...
}

/**
 * Check if Irys SDK is available for use
 */
private async checkIrysAvailability(): Promise<boolean> {
  try {
    require('@irys/sdk');
    return true;
  } catch {
    return false;
  }
}
```

**Integration Strategy:**

1. **Phase 1:** Implement arkb directory upload as primary method
2. **Phase 2:** Add Irys SDK as optional enhancement
3. **Always:** Maintain legacy individual file upload as fallback

**Benefits of this approach:**

- ✅ Immediate improvement using existing dependencies
- ✅ Zero breaking changes to existing API
- ✅ Robust fallback ensures continuity
- ✅ Optional Irys integration for advanced use cases

### Phase 4: Testing and Validation (Week 5)

#### 4.1 Test Scenarios

**Unit Tests:**

- [ ] Bulk upload with small site (< 10 files)
- [ ] Bulk upload with medium site (10-100 files)
- [ ] Bulk upload with large site (100+ files)
- [ ] Fallback mechanism testing
- [ ] Error handling validation

**Integration Tests:**

- [ ] End-to-end deployment flow
- [ ] Manifest integrity verification
- [ ] Site accessibility after upload
- [ ] Cost comparison analysis

**Performance Tests:**

- [ ] Upload time comparison (bulk vs individual)
- [ ] Network efficiency measurement
- [ ] Memory usage analysis
- [ ] Concurrent upload testing

#### 4.2 Validation Criteria

**Success Metrics:**

- Upload time reduction: Target 60-80% improvement
- Error rate reduction: Target < 5% failure rate
- Manifest accuracy: 100% file coverage
- Cost efficiency: Reduced transaction fees

### Phase 5: Documentation and Deployment (Week 6)

#### 5.1 Documentation Updates

**User Documentation:**

- Update deployment guides
- Add troubleshooting section
- Create configuration options guide

**Developer Documentation:**

- Update API documentation
- Add architecture diagrams
- Document fallback mechanisms

#### 5.2 Configuration Options

**User Settings:**

```json
{
  "arweave": {
    "uploadMethod": "auto", // "auto", "arkb", "irys", "legacy"
    "enableFallback": true,
    "maxRetries": 3,
    "timeoutMinutes": 10
  }
}
```

## Migration Strategy

### Backward Compatibility

**Approach:** Maintain full backward compatibility

- Keep existing `uploadSiteBundle()` method signature
- Legacy method remains available as fallback
- Gradual rollout with opt-in testing

### Rollout Plan

**Phase 1:** Internal testing with development sites
**Phase 2:** Beta testing with volunteer users
**Phase 3:** Default enable with legacy fallback
**Phase 4:** Full migration (legacy method as backup only)

### Risk Mitigation

**Identified Risks:**

1. **Bulk upload failure:** Mitigated by fallback to individual uploads
2. **Tool compatibility:** Mitigated by multiple tool options
3. **Manifest corruption:** Mitigated by verification checks
4. **Cost increase:** Mitigated by cost estimation preview

**Rollback Plan:**

- Configuration flag to disable bulk upload
- Immediate fallback to legacy method
- Diagnostic logging for troubleshooting

## Resource Requirements

### Development Time Estimate (UPDATED)

**Original Estimate:** 6 weeks  
**Revised Estimate Based on Research:** 3-4 weeks

- **Research & Design:** ✅ COMPLETED (1 week saved due to arkb discovery)
- **arkb Implementation:** 1 week (simplified due to existing dependency)
- **Testing & Validation:** 1 week
- **Documentation & Deployment:** 1 week
- **Optional Irys Integration:** +1 week (if desired)
- **Total:** 3 weeks (primary implementation) + 1 week (optional Irys)

### Dependencies

**Potential New Dependencies:**

- `@irys/sdk` (if Irys route chosen)
- `@ardrive/cli` (if ArDrive route chosen)

**Testing Dependencies:**

- Test site fixtures
- Performance benchmarking tools

## Success Metrics

### Quantitative Metrics

- **Upload Time:** 60-80% reduction in total upload time
- **Error Rate:** < 5% failure rate for bulk uploads
- **User Satisfaction:** > 90% prefer new method
- **Cost Efficiency:** Reduced transaction fees per deployment

### Qualitative Metrics

- Simplified deployment workflow
- Reduced cognitive load for users
- More reliable deployment process
- Better error handling and reporting

## Conclusion

The transition to bulk directory upload represents a significant improvement to Meridian's Arweave deployment capabilities. By leveraging existing tools like arkb or modern solutions like Irys, we can achieve substantial improvements in deployment speed, reliability, and user experience while maintaining full backward compatibility.

The proposed phased approach ensures careful validation and risk mitigation while delivering tangible benefits to users. The implementation can be completed within 6 weeks with appropriate resource allocation.

## Next Steps (UPDATED BASED ON RESEARCH)

### Immediate Actions (This Week)

✅ **COMPLETED:** arkb capability research - **MAJOR DISCOVERY: arkb supports directory uploads!**  
✅ **COMPLETED:** Irys SDK evaluation and alternative tools research  
✅ **COMPLETED:** Architecture design and implementation planning

### Phase 1: arkb Directory Upload Implementation (Week 1)

- [ ] Implement `uploadDirectoryWithArkb()` method in `arweave-manager.ts`
- [ ] Add directory size calculation utilities
- [ ] Rename current `uploadSiteBundle()` to `uploadSiteBundleLegacy()`
- [ ] Update main `uploadSiteBundle()` with directory upload logic
- [ ] Add comprehensive error handling and logging

### Phase 2: Testing & Validation (Week 2)

- [ ] Create test site directories for validation
- [ ] Test arkb directory upload with small, medium, and large sites
- [ ] Validate manifest generation and site accessibility
- [ ] Performance comparison testing (directory vs individual uploads)
- [ ] Error scenario testing and fallback validation

### Phase 3: Documentation & Deployment (Week 3)

- [ ] Update API documentation
- [ ] Create user guide for new deployment process
- [ ] Update troubleshooting documentation
- [ ] Gradual rollout with feature flag support

### Optional Phase 4: Irys Integration (Week 4, if desired)

- [ ] Add `@irys/sdk` dependency
- [ ] Implement `uploadDirectoryWithIrys()` method
- [ ] Add Irys availability detection
- [ ] Create configuration options for upload method selection

### Key Advantages of This Timeline:

- **Faster Implementation:** arkb research eliminated need for new dependencies
- **Lower Risk:** Using existing arkb tool reduces complexity
- **Immediate Benefits:** Can implement directory upload in just 1 week
- **Incremental Enhancement:** Irys can be added later as optional upgrade

---

**Document Status:** Ready for Review and Implementation  
**Priority:** High - Significant user experience improvement  
**Risk Level:** Low - Strong fallback mechanisms ensure continuity
