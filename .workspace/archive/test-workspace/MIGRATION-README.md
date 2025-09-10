# Migration Script for Unified Resources

This script migrates existing JSON data from the old Collate and Archive tools into the new unified SQLite database format.

## What it does

- Reads `to-import-collate.json` and `to-import-archive.json` from the current directory
- Converts the data to the new UnifiedResource format
- Imports everything into `.meridian/data/unified_resources.db`
- Preserves all metadata, tags, and timestamps

## How to run

1. Copy your JSON files to the test-workspace directory:

   ```bash
   cp /path/to/import/to-import-collate.json .
   cp /path/to/import/to-import-archive.json .
   ```

2. Run the migration script:
   ```bash
   node migrate-to-unified-resources.js
   ```

## What gets migrated

### From Collate (web resources):

- URL → `http-url` location type
- Title → `dc:title` property
- Description → `meridian:description` property
- Tags → `meridian:tags` property
- Creation/modification timestamps preserved

### From Archive (local files):

- File path → `file-path` location type
- Title → `dc:title` property
- MIME type → `dc:format` property
- Tags → `meridian:tags` property
- Arweave uploads → alternative locations
- Creation/modification timestamps preserved

## After migration

- All your resources will appear in the new "Unified" tab in Meridian
- The old Collate and Archive tabs can be removed
- Your data is now in a more robust SQLite format

## Notes

- This script generates new UUIDs for all resources
- Content hashes are generated based on URLs/titles for web resources
- Existing content hashes are preserved for local files
- The script is safe to run multiple times (it won't create duplicates)
