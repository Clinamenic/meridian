#!/usr/bin/env node

/**
 * Test script to analyze arkb bundle structure and extract individual file information
 * This will help us understand how to implement clean URL manifests
 */

const fs = require('fs');
const path = require('path');

async function testBundleParser() {
  try {
    console.log('🔍 Testing arbundles library for bundle parsing...\n');
    
    // Import arbundles
    const { bundleAndSignData, createData, ArweaveSigner } = await import('arbundles');
    
    console.log('✅ arbundles imported successfully');
    console.log('Available methods:', Object.keys({ bundleAndSignData, createData, ArweaveSigner }));
    
    // Test bundle information extraction from our last deployment
    const bundleId = 'lvQUf5ITM9BKkar_SPflKCcqIlPu6aKSFIelJB43oqs'; // From previous deployment
    const manifestId = 'fWxZjvy5VZ8uVsFUqVvSWjXsSWw3lDecPIyCqjYoJls'; // Manifest from previous deployment
    
    console.log(`\n📦 Testing with bundle ID: ${bundleId}`);
    console.log(`📄 Testing with manifest ID: ${manifestId}`);
    
    // Test fetching bundle data from Arweave
    console.log('\n🌐 Attempting to fetch bundle from Arweave...');
    
    const response = await fetch(`https://arweave.net/${bundleId}`);
    if (response.ok) {
      const bundleData = await response.arrayBuffer();
      console.log(`✅ Bundle fetched successfully: ${bundleData.byteLength} bytes`);
      
      // Try to parse the bundle
      try {
        const { Bundle } = await import('arbundles');
        const bundle = new Bundle(Buffer.from(bundleData));
        
        console.log('\n📋 Bundle Analysis:');
        console.log(`- Bundle ID: ${bundle.id}`);
        console.log(`- Number of items: ${bundle.items.length}`);
        
        // List all items in the bundle
        console.log('\n📁 Files in bundle:');
        bundle.items.forEach((item, index) => {
          const tags = {};
          item.tags.forEach(tag => {
            tags[tag.name] = tag.value;
          });
          
          console.log(`  ${index + 1}. ID: ${item.id}`);
          console.log(`     Data size: ${item.data.length} bytes`);
          console.log(`     Tags:`, tags);
          console.log('');
        });
        
      } catch (parseError) {
        console.error('❌ Error parsing bundle:', parseError.message);
      }
      
    } else {
      console.error(`❌ Failed to fetch bundle: ${response.status} ${response.statusText}`);
    }
    
    // Test fetching manifest
    console.log(`\n📄 Testing manifest fetch from: ${manifestId}`);
    const manifestResponse = await fetch(`https://arweave.net/${manifestId}`);
    if (manifestResponse.ok) {
      const manifestText = await manifestResponse.text();
      console.log('✅ Manifest fetched successfully:');
      console.log(manifestText);
      
      try {
        const manifest = JSON.parse(manifestText);
        console.log('\n📋 Manifest structure:');
        console.log(`- Manifest type: ${manifest.manifest}`);
        console.log(`- Version: ${manifest.version}`);
        console.log(`- Index: ${manifest.index?.path || 'not set'}`);
        console.log(`- Number of paths: ${Object.keys(manifest.paths || {}).length}`);
        
        if (manifest.paths) {
          console.log('\n🗂️ Available paths:');
          Object.entries(manifest.paths).forEach(([path, info]) => {
            console.log(`  - ${path} → ${info.id}`);
          });
        }
        
      } catch (jsonError) {
        console.error('❌ Error parsing manifest JSON:', jsonError.message);
      }
    } else {
      console.error(`❌ Failed to fetch manifest: ${manifestResponse.status} ${manifestResponse.statusText}`);
    }
    
  } catch (error) {
    console.error('❌ Error in bundle parser test:', error);
  }
}

// Alternative method: Test with local arkb output parsing
function parseArkbOutput(arkbOutput) {
  console.log('\n🔍 Parsing arkb output for file information...\n');
  
  const lines = arkbOutput.split('\n');
  const files = [];
  let inFileSection = false;
  
  for (const line of lines) {
    // Look for the file listing section
    if (line.includes('ID') && line.includes('Size') && line.includes('Type') && line.includes('Path')) {
      inFileSection = true;
      continue;
    }
    
    // Stop when we hit the summary section
    if (line.includes('Summary') || line.includes('Total size:')) {
      inFileSection = false;
      continue;
    }
    
    // Parse file lines
    if (inFileSection && line.trim()) {
      const match = line.match(/([a-zA-Z0-9_-]{43})\s+[\d.]+\s+[kKmMgG]?B?\s+[-\d.]*\s+([^\s]+)\s+(.+)/);
      if (match) {
        const [, id, type, path] = match;
        files.push({
          id: id.trim(),
          type: type.trim(),
          path: path.trim()
        });
      }
    }
  }
  
  return files;
}

// Test arkb output parsing with our previous output
function testArkbOutputParsing() {
  console.log('\n🧪 Testing arkb output parsing...\n');
  
  // Sample arkb output from our previous deployment
  const sampleOutput = `
[arkb] ID                                           Size           Fee              Type                          Path                

[arkb] 2oGKMiXFWwDM7tB_byz3epebE0hjB3k1nysMCtm6SxU  14.96 kB       -                text/html                     404.html            
LdRRZDPkx7NUR9aFbQE53dda9CQKRus5PZ_JV-JH76o  35.02 kB       -                text/html                     about.html          
2Qx6aiZKyMfCMh9dN9uWJM2KCzTZX3X2EOBntKkKE9I  31.85 kB       -                text/html                     gallery.html        
NDl0wmTCqMfH5ReZVGQ_AKttAzzS-5AgPIsU3PhYovc  40.37 kB       -                text/html                     design.html         
5mNIHP2k0Cb9RzqZjQstHfr0Zs5vwa9ixK-W4OmJHF4  34.07 kB       -                text/css                      index.css           
7Jz-70tB39wXI7YgLvDQAr_dMRtCRkRY7_QvdyBwbWE  1.35 kB        -                application/javascript        prescript.js        
8dIQFm1cmiZ1kjLIJIOa37XYi4A_8dYUMtY8xmyD39o  68.67 kB       -                text/html                     index.html          

[arkb] Summary
Total size: 1.29 MB
Fees: 0.002847536405 + 0.000284753640 (10% arkb fee )
`;
  
  const files = parseArkbOutput(sampleOutput);
  
  console.log('📁 Parsed files from arkb output:');
  files.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file.path}`);
    console.log(`     ID: ${file.id}`);
    console.log(`     Type: ${file.type}`);
    console.log('');
  });
  
  // Generate sample clean URL manifest
  if (files.length > 0) {
    console.log('🎯 Generated clean URL manifest:');
    const manifest = {
      manifest: "arweave/paths",
      version: "0.2.0",
      index: { path: "index.html" },
      paths: {}
    };
    
    files.forEach(file => {
      // Add original path
      manifest.paths[file.path] = { id: file.id };
      
      // Add clean URL for HTML files
      if (file.path.endsWith('.html') && file.path !== 'index.html') {
        const cleanPath = file.path.replace('.html', '');
        manifest.paths[cleanPath] = { id: file.id };
      }
    });
    
    console.log(JSON.stringify(manifest, null, 2));
  }
}

// Run tests
console.log('🚀 Starting Bundle Analysis Research\n');
console.log('=' .repeat(50));

testArkbOutputParsing();

console.log('\n' + '=' .repeat(50));
testBundleParser().then(() => {
  console.log('\n✅ Bundle analysis research completed!');
}).catch(error => {
  console.error('\n❌ Bundle analysis failed:', error);
});
