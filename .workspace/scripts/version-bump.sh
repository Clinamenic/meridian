#!/bin/bash

# Workspace Version Bump Script ("stem cell")
#
# Purpose: Provide a portable, project-agnostic SemVer bump with optional
#          project-specific overrides via config and hook scripts.
#
# Usage: .workspace/scripts/version-bump.sh [patch|minor|major]
#
# Customization points (no need to edit this file):
# - Config file (sourced if present): .workspace/config/version-bump.conf
#     Variables you can set:
#       REQUIRE_CLEAN_TREE         (default: false)
#       PACKAGE_JSON_PATH          (default: <repo_root>/package.json)
#       UPDATE_DISPLAY_VERSION     (default: true)
#       DISPLAY_VERSION_HTML_PATH  (default: <repo_root>/src/renderer/index.html)
# - Hooks (executed if present):
#     .workspace/scripts/version-bump.pre.sh  (args: VERSION_TYPE CURRENT_VERSION)
#     .workspace/scripts/version-bump.post.sh (args: VERSION_TYPE NEW_VERSION)

set -euo pipefail

# Resolve repo root from this script's location so it works from any CWD
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load optional config overrides
CONFIG_FILE="$REPO_ROOT/.workspace/config/version-bump.conf"
if [ -f "$CONFIG_FILE" ]; then
  # shellcheck source=/dev/null
  . "$CONFIG_FILE"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Defaults (can be overridden via config)
REQUIRE_CLEAN_TREE=${REQUIRE_CLEAN_TREE:-false}
PACKAGE_JSON_PATH=${PACKAGE_JSON_PATH:-"$REPO_ROOT/package.json"}
UPDATE_DISPLAY_VERSION=${UPDATE_DISPLAY_VERSION:-true}
DISPLAY_VERSION_HTML_PATH=${DISPLAY_VERSION_HTML_PATH:-"$REPO_ROOT/src/renderer/index.html"}

# Hook paths
PRE_HOOK=${PRE_HOOK:-"$REPO_ROOT/.workspace/scripts/version-bump.pre.sh"}
POST_HOOK=${POST_HOOK:-"$REPO_ROOT/.workspace/scripts/version-bump.post.sh"}

# Helper: portable in-place sed (BSD/macOS and GNU)
sed_inplace() {
  if sed --version >/dev/null 2>&1; then
    sed -i "$@"
  else
    sed -i '' "$@"
  fi
}

# Function to show usage
show_usage() {
    echo "Usage: .workspace/scripts/version-bump.sh [patch|minor|major]"
    echo ""
    echo "Arguments:"
    echo "  patch   Increment patch version (x.y.Z) - for bug fixes"
    echo "  minor   Increment minor version (x.Y.z) - for new features"
    echo "  major   Increment major version (X.y.z) - for breaking changes"
    echo ""
    echo "Examples:"
    echo "  .workspace/scripts/version-bump.sh patch   # 0.1.0 -> 0.1.1"
    echo "  .workspace/scripts/version-bump.sh minor   # 0.1.0 -> 0.2.0"
    echo "  .workspace/scripts/version-bump.sh major   # 0.1.0 -> 1.0.0"
}

# Check if argument is provided
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: No version type specified${NC}"
    show_usage
    exit 1
fi

VERSION_TYPE=$1

# Validate version type
if [[ "$VERSION_TYPE" != "patch" && "$VERSION_TYPE" != "minor" && "$VERSION_TYPE" != "major" ]]; then
    echo -e "${RED}Error: Invalid version type '$VERSION_TYPE'${NC}"
    show_usage
    exit 1
fi

# Ensure we run from repo root for consistent relative paths
cd "$REPO_ROOT"

# Optionally enforce clean working tree
if [ "$REQUIRE_CLEAN_TREE" = true ]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo -e "${RED}Error: Working tree is not clean. Commit or stash changes first.${NC}"
    exit 1
  fi
fi

# Get current version from package.json (absolute path)
CURRENT_VERSION=$(node -p "require('$PACKAGE_JSON_PATH').version")
echo -e "${YELLOW}Current version: $CURRENT_VERSION${NC}"

# Run pre-hook if present
if [ -f "$PRE_HOOK" ]; then
  echo -e "${YELLOW}Running pre-hook: $PRE_HOOK${NC}"
  bash "$PRE_HOOK" "$VERSION_TYPE" "$CURRENT_VERSION"
fi

# Use npm version to bump (default). Projects can override by doing the bump
# inside the pre-hook and writing their own changes, then exporting NEW_VERSION.
echo -e "${YELLOW}Bumping $VERSION_TYPE version...${NC}"
if [ -z "${NEW_VERSION:-}" ]; then
  NEW_VERSION=$(npm version "$VERSION_TYPE" --no-git-tag-version)
fi

# Remove 'v' prefix if present
NEW_VERSION=${NEW_VERSION#v}

echo -e "${GREEN}New version: $NEW_VERSION${NC}"

# Update display version if enabled and file exists
if [ "$UPDATE_DISPLAY_VERSION" = true ] && [ -f "$DISPLAY_VERSION_HTML_PATH" ]; then
  echo -e "${YELLOW}Updating version in ${DISPLAY_VERSION_HTML_PATH#$REPO_ROOT/}...${NC}"
  sed_inplace "s/<strong>Version:<\\/strong> [0-9]\\+\\.[0-9]\\+\\.[0-9]\\+/<strong>Version:<\\/strong> $NEW_VERSION/g" "$DISPLAY_VERSION_HTML_PATH"
fi

# Run post-hook if present
if [ -f "$POST_HOOK" ]; then
  echo -e "${YELLOW}Running post-hook: $POST_HOOK${NC}"
  bash "$POST_HOOK" "$VERSION_TYPE" "$NEW_VERSION"
fi

# Prompt for changelog update
echo -e "${YELLOW}Don't forget to update CHANGELOG.md with your changes!${NC}"
echo -e "${YELLOW}Consider running: npm install to update package-lock.json${NC}"

# Suggest git commands
echo -e "${GREEN}Version bump complete!${NC}"
echo ""
echo "Suggested next steps:"
echo "1. Update CHANGELOG.md with your changes"
echo "2. npm install (to update package-lock.json)"
echo "3. git add ."
echo "4. git commit -m \"chore: bump version to $NEW_VERSION\""
echo "5. git tag v$NEW_VERSION"
echo "6. git push && git push --tags" 