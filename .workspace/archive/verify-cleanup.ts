#!/usr/bin/env ts-node
/**
 * Legacy Module Cleanup Verification Script
 * 
 * This script verifies that legacy module references have been properly
 * removed from the codebase without breaking functionality.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface SearchResult {
  pattern: string;
  found: boolean;
  files: string[];
  details: string[];
}

const LEGACY_PATTERNS = [
  // Type references
  'CollateData',
  'interface CollateData',
  'interface Resource {',
  
  // API calls
  'window.electronAPI.collate',
  'electronAPI.collate',
  
  // Method names
  'loadCollateData',
  'saveCollateData',
  'addResource\\(', // Specific to old collate system
  
  // IPC handlers
  'collate:load-data',
  'collate:add-resource',
  'collate:extract-metadata',
];

const CRITICAL_FUNCTIONALITY = [
  // These should still exist in unified form
  'window.electronAPI.unified',
  'window.electronAPI.archive',
  'window.electronAPI.metadata',
  'UnifiedResource',
  'UnifiedDatabaseManager',
  'extractMetadata',
  'estimateCost',
  'uploadFile',
];

const EXCLUDED_DIRECTORIES = [
  'node_modules',
  'dist',
  'dist-electron',
  '.git',
  'test-workspace', // Should be removed anyway
];

const EXCLUDED_FILES = [
  'app.js.modularization-backup', // Should be removed anyway
  'legacy-module-cleanup-plan.md',
  'verify-cleanup.ts',
];

function searchPattern(pattern: string, directory: string = 'src'): SearchResult {
  const result: SearchResult = {
    pattern,
    found: false,
    files: [],
    details: []
  };

  try {
    // Use grep to search for pattern
    const grepCommand = `grep -r "${pattern}" ${directory}/ --include="*.ts" --include="*.js" --exclude-dir="{${EXCLUDED_DIRECTORIES.join(',')}}"`;
    const output = execSync(grepCommand, { encoding: 'utf8' });
    
    if (output.trim()) {
      result.found = true;
      const lines = output.trim().split('\n');
      
      for (const line of lines) {
        const [filePath, ...rest] = line.split(':');
        const content = rest.join(':');
        
        // Skip excluded files
        const fileName = path.basename(filePath);
        if (EXCLUDED_FILES.some(excluded => fileName.includes(excluded))) {
          continue;
        }
        
        if (!result.files.includes(filePath)) {
          result.files.push(filePath);
        }
        result.details.push(`${filePath}: ${content.trim()}`);
      }
      
      // Update found status based on filtered results
      result.found = result.files.length > 0;
    }
  } catch (error) {
    // grep returns non-zero when no matches found, which is what we want
    result.found = false;
  }

  return result;
}

function checkFileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function verifyLegacyRemoval(): boolean {
  console.log('🔍 Checking for legacy module references...\n');
  
  let hasLegacyReferences = false;
  
  for (const pattern of LEGACY_PATTERNS) {
    const result = searchPattern(pattern);
    
    if (result.found) {
      console.log(`❌ Found legacy references to "${pattern}":`);
      for (const detail of result.details) {
        console.log(`   ${detail}`);
      }
      console.log('');
      hasLegacyReferences = true;
    } else {
      console.log(`✅ No references to "${pattern}" found`);
    }
  }
  
  return !hasLegacyReferences;
}

function verifyCriticalFunctionality(): boolean {
  console.log('\n🔍 Checking critical functionality preservation...\n');
  
  let allFunctionalityPresent = true;
  
  for (const pattern of CRITICAL_FUNCTIONALITY) {
    const result = searchPattern(pattern);
    
    if (result.found) {
      console.log(`✅ Critical functionality "${pattern}" is present`);
    } else {
      console.log(`❌ Critical functionality "${pattern}" is missing!`);
      allFunctionalityPresent = false;
    }
  }
  
  return allFunctionalityPresent;
}

function checkFilesDeleted(): boolean {
  console.log('\n🔍 Checking if legacy files were removed...\n');
  
  const filesToDelete = [
    'src/renderer/app.js.modularization-backup',
    'test-workspace',
  ];
  
  let allDeleted = true;
  
  for (const filePath of filesToDelete) {
    if (checkFileExists(filePath)) {
      console.log(`❌ Legacy file/directory still exists: ${filePath}`);
      allDeleted = false;
    } else {
      console.log(`✅ Legacy file/directory removed: ${filePath}`);
    }
  }
  
  return allDeleted;
}

function checkUnifiedResourceManagerIntegrity(): boolean {
  console.log('\n🔍 Checking UnifiedResourceManager integrity...\n');
  
  const urmPath = 'src/renderer/modules/UnifiedResourceManager.js';
  
  if (!checkFileExists(urmPath)) {
    console.log(`❌ UnifiedResourceManager not found at ${urmPath}`);
    return false;
  }
  
  try {
    const content = fs.readFileSync(urmPath, 'utf8');
    
    // Check for critical methods
    const criticalMethods = [
      'loadUnifiedResources',
      'addUnifiedResource',
      'removeUnifiedResourceById',
      'addTagToResource',
      'removeTagFromResource',
      'getFilteredResources',
    ];
    
    let allMethodsPresent = true;
    
    for (const method of criticalMethods) {
      if (content.includes(method)) {
        console.log(`✅ Critical method "${method}" is present`);
      } else {
        console.log(`❌ Critical method "${method}" is missing!`);
        allMethodsPresent = false;
      }
    }
    
    // Check for problematic legacy API calls
    const problematicCalls = [
      'window.electronAPI.collate.',
    ];
    
    let hasProblematicCalls = false;
    
    for (const call of problematicCalls) {
      if (content.includes(call)) {
        console.log(`❌ Found problematic legacy API call: ${call}`);
        hasProblematicCalls = true;
      }
    }
    
    if (!hasProblematicCalls) {
      console.log(`✅ No problematic legacy API calls found`);
    }
    
    return allMethodsPresent && !hasProblematicCalls;
    
  } catch (error) {
    console.log(`❌ Error reading UnifiedResourceManager: ${error}`);
    return false;
  }
}

function main(): void {
  console.log('Legacy Module Cleanup Verification');
  console.log('===================================\n');
  
  const legacyClean = verifyLegacyRemoval();
  const functionalityPresent = verifyCriticalFunctionality();
  const filesDeleted = checkFilesDeleted();
  const urmIntegrity = checkUnifiedResourceManagerIntegrity();
  
  console.log('\n📊 Summary:');
  console.log('===========');
  console.log(`Legacy references removed: ${legacyClean ? '✅ Yes' : '❌ No'}`);
  console.log(`Critical functionality preserved: ${functionalityPresent ? '✅ Yes' : '❌ No'}`);
  console.log(`Legacy files deleted: ${filesDeleted ? '✅ Yes' : '❌ No'}`);
  console.log(`UnifiedResourceManager integrity: ${urmIntegrity ? '✅ Yes' : '❌ No'}`);
  
  const allPassed = legacyClean && functionalityPresent && filesDeleted && urmIntegrity;
  
  if (allPassed) {
    console.log('\n🎉 All verification checks passed! Cleanup is complete.');
    process.exit(0);
  } else {
    console.log('\n💥 Some verification checks failed. Review the issues above.');
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
} 