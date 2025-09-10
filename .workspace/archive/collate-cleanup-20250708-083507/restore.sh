#!/bin/bash

# Restore script for collate legacy cleanup backup
# Run this script to restore files from backup

set -e

echo "=== Collate Legacy Cleanup Restore Script ==="
echo "Restoring files from backup..."
echo

# Get the backup directory (this script's location)
BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Restoring from: $BACKUP_DIR"
echo

# Function to restore file with confirmation
restore_file() {
    local source_file="$1"
    local target_file="$2"
    local description="$3"
    
    if [ -f "$source_file" ]; then
        echo "Restoring: $target_file"
        echo "  Description: $description"
        read -p "  Continue? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cp "$source_file" "$target_file"
            echo "  ✓ Restored"
        else
            echo "  ✗ Skipped"
        fi
    else
        echo "Warning: Backup file not found: $source_file"
    fi
    echo
}

# Restore critical files
restore_file "$BACKUP_DIR/app.js" "src/renderer/app.js" "Main application logic"
restore_file "$BACKUP_DIR/styles.css" "src/renderer/styles.css" "Main stylesheet"
restore_file "$BACKUP_DIR/styles copy.css" "src/renderer/styles copy.css" "Copy of stylesheet"
restore_file "$BACKUP_DIR/index.ts" "src/types/index.ts" "Type definitions"
restore_file "$BACKUP_DIR/main.ts" "src/main/main.ts" "Main process"
restore_file "$BACKUP_DIR/data-manager.ts" "src/main/data-manager.ts" "Data manager"
restore_file "$BACKUP_DIR/preload.ts" "src/main/preload.ts" "Preload script"
restore_file "$BACKUP_DIR/TagManager.js" "src/renderer/modules/TagManager.js" "Tag manager"
restore_file "$BACKUP_DIR/UnifiedResourceManager.js" "src/renderer/modules/UnifiedResourceManager.js" "Unified manager"
restore_file "$BACKUP_DIR/README.md" "README.md" "Documentation"
restore_file "$BACKUP_DIR/quartz.config.ts" "meridian-quartz/quartz.config.ts" "Quartz config"

# Restore data files
restore_file "$BACKUP_DIR/unified_resources.db" "unified_resources.db" "Unified resources database"

echo "Restore complete!"
echo "Note: You may need to restart the application for changes to take effect."
