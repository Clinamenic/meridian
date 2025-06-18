#!/bin/bash

# Meridian Version Bump Script
# Usage: ./scripts/version-bump.sh [patch|minor|major]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to show usage
show_usage() {
    echo "Usage: $0 [patch|minor|major]"
    echo ""
    echo "Arguments:"
    echo "  patch   Increment patch version (x.y.Z) - for bug fixes"
    echo "  minor   Increment minor version (x.Y.z) - for new features"
    echo "  major   Increment major version (X.y.z) - for breaking changes"
    echo ""
    echo "Examples:"
    echo "  $0 patch   # 0.1.0 -> 0.1.1"
    echo "  $0 minor   # 0.1.0 -> 0.2.0"
    echo "  $0 major   # 0.1.0 -> 1.0.0"
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

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${YELLOW}Current version: $CURRENT_VERSION${NC}"

# Use npm version to bump
echo -e "${YELLOW}Bumping $VERSION_TYPE version...${NC}"
NEW_VERSION=$(npm version $VERSION_TYPE --no-git-tag-version)

# Remove 'v' prefix if present
NEW_VERSION=${NEW_VERSION#v}

echo -e "${GREEN}New version: $NEW_VERSION${NC}"

# Update version in renderer HTML
echo -e "${YELLOW}Updating version in src/renderer/index.html...${NC}"
sed -i '' "s/<strong>Version:<\/strong> [0-9]\+\.[0-9]\+\.[0-9]\+/<strong>Version:<\/strong> $NEW_VERSION/g" src/renderer/index.html

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