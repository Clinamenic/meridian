// Test the arkb output parser with real data from the terminal
const sampleOutput = `[arkb] ID                                           Size           Fee              Type                          Path                

[arkb] B8jQA2eJWMyoZP86AJ2kEBwbDW2PK0KN1QNOPhZ41ec  14.96 kB       -                text/html                     404.html            
mnBAhXXDcoI84WAgQi3Ij6uL3jB6o10f9G9rRL7R9Ic  31.85 kB       -                text/html                     gallery.html        

[arkb] 0h8RfFsyF4WGKnDuH-71rWX0hQfq1CdKjR5Xq71r9u8  68.67 kB       -                text/html                     index.html          
jkgxnRZyepK-HFE0ku99XmeW09kUj50Ubq1M_mCobOQ  40.37 kB       -                text/html                     design.html         
1bXQb6HYkNT5v76S0UrYJS72qhwmdsorBzmYRGFIuQA  659.43 kB      -                application/javascript        postscript.js       

[arkb] WFDoJX4YVSsZYUngHUQXjZrnZ1t313O1ZC07_qCYXx4  35.02 kB       -                text/html                     about.html          

[arkb] Summary`;

// Simple parser test (adapted from the actual implementation)
function parseArkbFileList(arkbOutput) {
    const lines = arkbOutput.split('\n');
    const files = [];
    let inFileSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue; // Skip undefined/null lines
      
      // Look for the file listing section header
      if (line.includes('ID') && line.includes('Size') && line.includes('Type') && line.includes('Path')) {
        inFileSection = true;
        continue;
      }
      
      // Stop when we hit the summary section
      if (line.includes('Summary') || line.includes('Total size:')) {
        inFileSection = false;
        continue;
      }
      
      // Parse file lines in the section
      if (inFileSection && line.trim()) {
        let lineToProcess = line;
        
        // Handle cases where arkb output wraps lines - look for ID on next line if current line starts with [arkb] but no ID
        if (line.includes('[arkb]') && !line.match(/\[arkb\]\s+[a-zA-Z0-9_-]{43}/)) {
          // Check if next line has the ID
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            if (nextLine && nextLine.match(/^[a-zA-Z0-9_-]{43}/)) {
              // Combine current line with next line
              lineToProcess = line + ' ' + nextLine;
              i++; // Skip the next line since we've processed it
            }
          }
        }
        
        // Also handle lines that don't start with [arkb] but contain file IDs (wrapped from previous line)
        if (!line.includes('[arkb]') && line.match(/^[a-zA-Z0-9_-]{43}/)) {
          lineToProcess = '[arkb] ' + line;
        }
        
        if (lineToProcess && lineToProcess.includes('[arkb]')) {
          // Updated pattern to match the actual arkb output format
          const match = lineToProcess.match(/\[arkb\]\s+([a-zA-Z0-9_-]{43})\s+([\d.]+\s*[kKmMgG]?B?)\s+[-\d.]*\s+([^\s]+(?:\s+[^\s]*)*?)\s{2,}([^\s].*)$/);
          if (match) {
            const [, id, size, type, path] = match;
            if (id && type && path && size) {
              // Clean up the path - remove extra spaces and get just the filename
              const cleanPath = path.trim();
              files.push({
                id: id.trim(),
                type: type.trim(),
                path: cleanPath,
                size: size.trim()
              });
              console.log(`Parsed file: ${cleanPath} → ${id.trim()}`);
            }
          }
        }
      }
    }
    
    console.log(`Total parsed files: ${files.length}`);
    return files;
}

console.log('Testing arkb output parser...');
const parsedFiles = parseArkbFileList(sampleOutput);
console.log('\nParsed files:');
console.log(JSON.stringify(parsedFiles, null, 2));
