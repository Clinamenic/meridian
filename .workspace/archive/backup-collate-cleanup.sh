#!/bin/bash

# Collate Legacy Cleanup Backup Script
# This script creates a comprehensive backup before starting the cleanup process

set -e  # Exit on any error

echo "=== Collate Legacy Cleanup Backup Script ==="
echo "Creating backup before starting cleanup process..."
echo

# Create backup directory with timestamp
BACKUP_DIR=".cursor/backups/collate-cleanup-$(date +%Y%m%d-%H%M%S)"
echo "Creating backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Create backup manifest
MANIFEST_FILE="$BACKUP_DIR/backup-manifest.txt"
echo "Creating backup manifest: $MANIFEST_FILE"

cat > "$MANIFEST_FILE" << EOF
Collate Legacy Cleanup Backup
Created: $(date)
Purpose: Backup before removing collate panel references
Backup ID: $(date +%Y%m%d-%H%M%S)

Files backed up:
EOF

# Function to backup file with logging
backup_file() {
    local source_file="$1"
    local description="$2"
    
    if [ -f "$source_file" ]; then
        echo "Backing up: $source_file"
        cp "$source_file" "$BACKUP_DIR/"
        echo "- $source_file ($description)" >> "$MANIFEST_FILE"
    else
        echo "Warning: File not found: $source_file"
        echo "- $source_file (NOT FOUND)" >> "$MANIFEST_FILE"
    fi
}

# Backup critical files that will be modified
echo "Backing up critical files..."

backup_file "src/renderer/app.js" "Main application logic with collate references"
backup_file "src/renderer/styles.css" "Main stylesheet with collate panel CSS"
backup_file "src/renderer/styles copy.css" "Copy of stylesheet with collate panel CSS"
backup_file "src/types/index.ts" "Type definitions with CollateData interface"
backup_file "src/main/main.ts" "Main process with collate IPC handlers"
backup_file "src/main/data-manager.ts" "Data manager with collate methods"
backup_file "src/main/preload.ts" "Preload script with collate APIs"
backup_file "src/renderer/modules/TagManager.js" "Tag manager with collate references"
backup_file "src/renderer/modules/UnifiedResourceManager.js" "Unified manager with collate API usage"
backup_file "README.md" "Documentation with collate tool references"
backup_file "meridian-quartz/quartz.config.ts" "Quartz config with collate plugin reference"

# Backup data files
echo "Backing up data files..."

# Backup unified database if it exists
if [ -f "unified_resources.db" ]; then
    echo "Backing up: unified_resources.db"
    cp unified_resources.db "$BACKUP_DIR/"
    echo "- unified_resources.db (Unified resources database)" >> "$MANIFEST_FILE"
fi

# Backup meridian data directory if it exists
if [ -d ".meridian/data" ]; then
    echo "Backing up: .meridian/data"
    cp -r .meridian/data "$BACKUP_DIR/"
    echo "- .meridian/data/ (Meridian data directory)" >> "$MANIFEST_FILE"
fi

# Backup any collate.json files
find . -name "collate.json" -type f 2>/dev/null | while read -r file; do
    echo "Backing up: $file"
    cp "$file" "$BACKUP_DIR/"
    echo "- $file (Collate data file)" >> "$MANIFEST_FILE"
done

# Create restore script
RESTORE_SCRIPT="$BACKUP_DIR/restore.sh"
echo "Creating restore script: $RESTORE_SCRIPT"

cat > "$RESTORE_SCRIPT" << 'EOF'
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
EOF

chmod +x "$RESTORE_SCRIPT"

# Create git backup instructions
GIT_INSTRUCTIONS="$BACKUP_DIR/git-backup-instructions.md"
echo "Creating git backup instructions: $GIT_INSTRUCTIONS"

cat > "$GIT_INSTRUCTIONS" << EOF
# Git Backup Instructions

## Before Starting Cleanup

1. Ensure you're on the main branch and up to date:
   \`\`\`bash
   git checkout main
   git pull origin main
   \`\`\`

2. Create a backup branch:
   \`\`\`bash
   git checkout -b backup/collate-legacy-cleanup-backup
   git push origin backup/collate-legacy-cleanup-backup
   \`\`\`

3. Create the working branch:
   \`\`\`bash
   git checkout -b feature/collate-legacy-cleanup
   \`\`\`

## During Cleanup

Create checkpoints after each phase:
\`\`\`bash
# After Phase 1 (CSS cleanup)
git add .
git commit -m "Phase 1: Remove collate CSS references"

# After Phase 2 (JS/TS cleanup)
git add .
git commit -m "Phase 2: Remove collate JS/TS references"

# After Phase 3 (Module updates)
git add .
git commit -m "Phase 3: Update module dependencies"
\`\`\`

## Rollback Options

### Option 1: Revert to backup branch
\`\`\`bash
git checkout backup/collate-legacy-cleanup-backup
\`\`\`

### Option 2: Revert specific commits
\`\`\`bash
git revert <commit-hash>
\`\`\`

### Option 3: Reset to backup branch
\`\`\`bash
git reset --hard backup/collate-legacy-cleanup-backup
\`\`\`
EOF

# Final summary
echo
echo "=== Backup Complete ==="
echo "Backup directory: $BACKUP_DIR"
echo "Files backed up: $(find "$BACKUP_DIR" -type f -name "*.js" -o -name "*.ts" -o -name "*.css" -o -name "*.md" -o -name "*.db" | wc -l | tr -d ' ')"
echo
echo "Next steps:"
echo "1. Review the backup manifest: $MANIFEST_FILE"
echo "2. Follow git backup instructions: $GIT_INSTRUCTIONS"
echo "3. Use restore script if needed: $RESTORE_SCRIPT"
echo
echo "Backup ID: $(date +%Y%m%d-%H%M%S)"
echo "Backup location: $BACKUP_DIR" 