# Git Backup Instructions

## Before Starting Cleanup

1. Ensure you're on the main branch and up to date:
   ```bash
   git checkout main
   git pull origin main
   ```

2. Create a backup branch:
   ```bash
   git checkout -b backup/collate-legacy-cleanup-backup
   git push origin backup/collate-legacy-cleanup-backup
   ```

3. Create the working branch:
   ```bash
   git checkout -b feature/collate-legacy-cleanup
   ```

## During Cleanup

Create checkpoints after each phase:
```bash
# After Phase 1 (CSS cleanup)
git add .
git commit -m "Phase 1: Remove collate CSS references"

# After Phase 2 (JS/TS cleanup)
git add .
git commit -m "Phase 2: Remove collate JS/TS references"

# After Phase 3 (Module updates)
git add .
git commit -m "Phase 3: Update module dependencies"
```

## Rollback Options

### Option 1: Revert to backup branch
```bash
git checkout backup/collate-legacy-cleanup-backup
```

### Option 2: Revert specific commits
```bash
git revert <commit-hash>
```

### Option 3: Reset to backup branch
```bash
git reset --hard backup/collate-legacy-cleanup-backup
```
