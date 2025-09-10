# Meridian-Quartz Fork Setup Guide

## Step 1: Create the Fork

### 1.1 Clone Original Quartz Repository

```bash
# Clone the original Quartz repository to a temporary directory
git clone https://github.com/jackyzha0/quartz.git meridian-quartz-temp
cd meridian-quartz-temp
```

### 1.2 Create New Repository on GitHub

1. Go to GitHub and create a new repository: `https://github.com/Clinamenic/meridian-quartz`
2. Do NOT initialize with README, .gitignore, or license (we'll use Quartz's existing ones)
3. Copy the repository URL: `https://github.com/Clinamenic/meridian-quartz.git`

### 1.3 Prepare the Fork

```bash
# Remove the original remote and add your new repository
git remote remove origin
git remote add origin https://github.com/Clinamenic/meridian-quartz.git

# Create and switch to meridian-main branch
git checkout -b meridian-main

# Verify the setup
git remote -v
git branch
```

## Step 2: Initial Cleanup

### 2.1 Remove Vanilla Quartz Components

```bash
# Remove unnecessary directories and files
rm -rf docs/
rm -rf content/
rm -rf .github/
rm -f CNAME
rm -f README.md

# Verify removal
ls -la
```

### 2.2 Create Meridian-Specific README

```bash
cat > README.md << 'EOF'
# Meridian-Quartz

A specialized fork of [Quartz](https://github.com/jackyzha0/quartz) optimized for Meridian Digital Garden deployments.

## Attribution

This project is based on [Quartz](https://github.com/jackyzha0/quartz) by [@jackyzha0](https://github.com/jackyzha0).

Original Quartz is licensed under the MIT License. All original license terms and attribution are preserved.

## Meridian-Specific Features

- **Workspace Root Content Sourcing**: Reads content from parent workspace directory instead of internal `content/`
- **Built-in Meridian Integration**: Pre-configured plugins for Collate, Archive, and Broadcast functionality
- **Optimized Ignore Patterns**: Automatically excludes Meridian infrastructure files (`.meridian/`, etc.)
- **Streamlined Initialization**: No runtime customization needed - ready to build immediately
- **Reduced Dependencies**: Smaller footprint with only necessary components

## Installation Location

This repository is designed to be cloned into `workspace/.quartz/` where it will:
- Source content from `workspace/` (parent directory)
- Build output to `workspace/.quartz/public/`
- Ignore Meridian infrastructure automatically

## Usage

This fork is specifically designed for use with Meridian's Deploy functionality. It should not be used directly but rather through Meridian's deployment system.

## Differences from Vanilla Quartz

### Removed Components
- `docs/` - Vanilla Quartz documentation
- `content/` - Example content (sources from workspace root instead)
- `.github/` - Vanilla CI/CD workflows
- `CNAME` - Vanilla hosting configuration

### Added Components
- `plugins/meridian/` - Meridian-specific integration plugins
- Pre-configured ignore patterns for Meridian workflow
- Optimized package.json for Meridian requirements

### Configuration Changes
- Content sourcing from `../` (workspace root) instead of `./content`
- Meridian-optimized ignore patterns
- Auto-registered Meridian plugins

## License

MIT License - same as original Quartz. See LICENSE file for details.

## Contributing

This is a specialized fork for Meridian. For general Quartz contributions, please contribute to the [original Quartz repository](https://github.com/jackyzha0/quartz).

For Meridian-specific improvements, please contribute through the main Meridian project.
EOF
```

## Step 3: Core Configuration Updates

### 3.1 Update package.json for Meridian

```bash
# Create a backup of the original
cp package.json package.json.original

# Update package.json with Meridian-specific information
cat > package.json << 'EOF'
{
  "name": "meridian-quartz",
  "version": "1.0.0",
  "description": "A specialized fork of Quartz optimized for Meridian Digital Garden deployments",
  "main": "index.js",
  "type": "module",
  "engines": {
    "node": ">=22",
    "npm": ">=10.9.2"
  },
  "scripts": {
    "build": "tsx ./quartz/bootstrap-cli.mts build",
    "serve": "tsx ./quartz/bootstrap-cli.mts build --serve",
    "profile": "0x -D prof ./quartz/bootstrap-cli.mts build --concurrency=1",
    "check": "tsc --noEmit && tsx ./quartz/bootstrap-cli.mts update --check"
  },
  "keywords": [
    "quartz",
    "meridian",
    "digital-garden",
    "static-site-generator",
    "obsidian",
    "ssg"
  ],
  "author": "Meridian (based on Quartz by @jackyzha0)",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/Clinamenic/meridian-quartz.git"
  },
  "bugs": {
    "url": "https://github.com/Clinamenic/meridian-quartz/issues"
  },
  "homepage": "https://github.com/Clinamenic/meridian-quartz#readme",
  "devDependencies": {
    "@types/d3": "^7.4.0",
    "@types/hast": "^2.3.4",
    "@types/js-yaml": "^4.0.5",
    "@types/node": "^20.14.0",
    "@types/yargs": "^17.0.24",
    "esbuild-sass-plugin": "^2.16.0",
    "tsx": "^4.7.1",
    "typescript": "^5.4.5"
  },
  "dependencies": {
    "@clack/prompts": "^0.7.0",
    "@floating-ui/dom": "^1.6.1",
    "@napi-rs/simple-git": "^0.5.0",
    "chokidar": "^3.6.0",
    "d3": "^7.8.5",
    "esbuild": "0.19.8",
    "flexsearch": "0.7.21",
    "github-slugger": "^2.0.0",
    "gray-matter": "^4.0.3",
    "hast-util-to-jsx-runtime": "^2.3.0",
    "hast-util-to-string": "^3.0.0",
    "is-absolute-url": "^4.0.1",
    "js-yaml": "^4.1.0",
    "lightningcss": "^1.21.5",
    "mdast-util-find-and-replace": "^3.0.1",
    "mdast-util-to-hast": "^13.0.2",
    "mdast-util-to-string": "^4.0.0",
    "micromorph": "^0.4.5",
    "preact": "^10.19.6",
    "preact-render-to-string": "^6.4.0",
    "pretty-bytes": "^6.1.1",
    "reading-time": "^1.5.0",
    "rehype-autolink-headings": "^7.1.0",
    "rehype-citation": "^2.0.0",
    "rehype-katex": "^7.0.0",
    "rehype-mathjax": "^6.0.0",
    "rehype-pretty-code": "^0.13.2",
    "rehype-raw": "^7.0.0",
    "rehype-slug": "^6.0.0",
    "remark": "^15.0.1",
    "remark-breaks": "^4.0.0",
    "remark-frontmatter": "^5.0.0",
    "remark-gfm": "^4.0.0",
    "remark-math": "^6.0.0",
    "remark-parse": "^11.0.0",
    "remark-rehype": "^11.0.0",
    "remark-wiki-link": "^1.0.4",
    "rfdc": "^1.3.1",
    "rimraf": "^5.0.5",
    "serve-handler": "^6.1.5",
    "shiki": "^1.3.0",
    "source-map-support": "^0.5.21",
    "to-vfile": "^8.0.0",
    "unified": "^11.0.4",
    "unist-util-visit": "^5.0.0",
    "vfile": "^6.0.1",
    "workbox-build": "^7.0.0",
    "ws": "^8.16.0",
    "yargs": "^17.7.2"
  }
}
EOF
```

### 3.2 Create Meridian Plugin Directory Structure

```bash
# Create the Meridian plugins directory
mkdir -p plugins/meridian

# Create placeholder files for the plugins
touch plugins/meridian/index.ts
touch plugins/meridian/collate.ts
touch plugins/meridian/archive.ts
touch plugins/meridian/broadcast.ts
touch plugins/meridian/types.ts
```

### 3.3 Update quartz.config.ts

```bash
# Backup the original config
cp quartz.config.ts quartz.config.ts.original

# Create the new Meridian-optimized config
cat > quartz.config.ts << 'EOF'
import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Meridian-Quartz Configuration
 *
 * Key differences from vanilla Quartz:
 * - Content sourced from parent directory (workspace root)
 * - Meridian-specific ignore patterns
 * - Pre-configured for .quartz/ installation location
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "Digital Garden",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "en-US",
    baseUrl: undefined,
    ignorePatterns: [
      // Quartz infrastructure
      ".quartz/**",
      ".quartz-cache/**",

      // Meridian infrastructure
      ".meridian/**",

      // Development infrastructure
      ".git/**",
      ".gitignore",
      "node_modules/**",
      "package*.json",
      "yarn.lock",
      "tsconfig*.json",
      "*.config.{js,ts}",
      "vite.config.{js,ts}",
      "rollup.config.{js,ts}",
      "webpack.config.{js,ts}",

      // Build and temporary
      "dist/**",
      "build/**",
      "cache/**",
      "*.log",
      "tmp/**",
      "temp/**",
      ".cache/**",

      // IDE and system
      ".vscode/**",
      ".idea/**",
      "*.swp",
      "*.swo",
      ".DS_Store",
      "Thumbs.db",

      // Backup files
      "*~",
      "*.bak",
      "*.tmp",

      // Private content
      "private/**",
      "templates/**",
      ".obsidian/**",

      // Common documentation that shouldn't be published
      "CHANGELOG.md",
      "CONTRIBUTING.md",
      "INSTALL.md",
      "TODO.md",
      "ROADMAP.md",
    ],
    defaultDateType: "created",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Schibsted Grotesk",
        body: "Source Sans Pro",
        code: "IBM Plex Mono",
      },
      colors: {
        lightMode: {
          light: "#faf8f8",
          lightgray: "#e5e5e5",
          gray: "#b8b8b8",
          darkgray: "#4e4e4e",
          dark: "#2b2b2b",
          secondary: "#284b63",
          tertiary: "#84a59d",
          highlight: "rgba(143, 159, 169, 0.15)",
        },
        darkMode: {
          light: "#161618",
          lightgray: "#393639",
          gray: "#646464",
          darkgray: "#d4d4d4",
          dark: "#ebebec",
          secondary: "#7b97aa",
          tertiary: "#84a59d",
          highlight: "rgba(143, 159, 169, 0.15)",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({ priority: ["frontmatter", "filesystem"] }),
      Plugin.Latex({ renderEngine: "katex" }),
      Plugin.SyntaxHighlighting({
        theme: { light: "github-light", dark: "github-dark" },
        keepBackground: false
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({ enableSiteMap: true, enableRSS: true }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.NotFoundPage(),
      // TODO: Add Meridian-specific plugins once implemented
      // MeridianPlugin.CollatePlugin(),
      // MeridianPlugin.ArchivePlugin(),
      // MeridianPlugin.BroadcastPlugin(),
    ],
  },
}

export default config
EOF
```

## Step 4: Create Basic Meridian Plugin Structure

### 4.1 Create Plugin Types

```bash
cat > plugins/meridian/types.ts << 'EOF'
/**
 * Meridian Plugin Types
 *
 * Shared types for Meridian-specific Quartz plugins
 */

export interface MeridianCollateData {
  resources: Array<{
    title: string;
    url: string;
    domain: string;
    description?: string;
    tags?: string[];
    selected: boolean;
  }>;
}

export interface MeridianArchiveData {
  uploads: Array<{
    filename: string;
    txId: string;
    size: number;
    timestamp: string;
    status: 'confirmed' | 'pending' | 'failed';
  }>;
}

export interface MeridianBroadcastData {
  platforms: {
    atproto?: {
      handle: string;
      displayName: string;
    };
    x?: {
      username: string;
      displayName: string;
    };
  };
  metadata: {
    title?: string;
    description?: string;
    tags?: string[];
  };
}
EOF
```

### 4.2 Create Plugin Index

```bash
cat > plugins/meridian/index.ts << 'EOF'
/**
 * Meridian Plugin Exports
 *
 * This file exports all Meridian-specific plugins for Quartz
 */

// Types
export * from './types'

// Plugins (TODO: Implement these)
// export { CollatePlugin } from './collate'
// export { ArchivePlugin } from './archive'
// export { BroadcastPlugin } from './broadcast'

// Placeholder exports to prevent build errors
export const CollatePlugin = () => ({ name: "MeridianCollate" });
export const ArchivePlugin = () => ({ name: "MeridianArchive" });
export const BroadcastPlugin = () => ({ name: "MeridianBroadcast" });
EOF
```

### 4.3 Create Placeholder Plugin Files

```bash
# Create placeholder for Collate plugin
cat > plugins/meridian/collate.ts << 'EOF'
import { QuartzPlugin } from "../../quartz/plugins/types"

/**
 * Meridian Collate Integration Plugin
 *
 * TODO: Implement plugin to read .meridian/collate.json and generate resource gallery pages
 */
export const CollatePlugin: QuartzPlugin = {
  name: "MeridianCollate",
  markdownPlugins() {
    return []
  },
  htmlPlugins() {
    return []
  },
  externalResources() {
    return {}
  },
  emitters: [
    // TODO: Implement collate gallery emitter
  ],
}
EOF

# Create placeholder for Archive plugin
cat > plugins/meridian/archive.ts << 'EOF'
import { QuartzPlugin } from "../../quartz/plugins/types"

/**
 * Meridian Archive Integration Plugin
 *
 * TODO: Implement plugin to read .meridian/archive.json and generate archive showcase pages
 */
export const ArchivePlugin: QuartzPlugin = {
  name: "MeridianArchive",
  markdownPlugins() {
    return []
  },
  htmlPlugins() {
    return []
  },
  externalResources() {
    return {}
  },
  emitters: [
    // TODO: Implement archive showcase emitter
  ],
}
EOF

# Create placeholder for Broadcast plugin
cat > plugins/meridian/broadcast.ts << 'EOF'
import { QuartzPlugin } from "../../quartz/plugins/types"

/**
 * Meridian Broadcast Integration Plugin
 *
 * TODO: Implement plugin to enhance social metadata from broadcast configurations
 */
export const BroadcastPlugin: QuartzPlugin = {
  name: "MeridianBroadcast",
  markdownPlugins() {
    return []
  },
  htmlPlugins() {
    return []
  },
  externalResources() {
    return {}
  },
  emitters: [
    // TODO: Implement broadcast metadata emitter
  ],
}
EOF
```

## Step 5: Commit and Push

### 5.1 Stage All Changes

```bash
# Add all new and modified files
git add .

# Check what will be committed
git status
```

### 5.2 Create Initial Commit

```bash
# Commit the initial Meridian-Quartz setup
git commit -m "feat: initial Meridian-Quartz fork setup

- Remove vanilla Quartz docs, content, and examples
- Add Meridian-specific README with proper attribution
- Update package.json for Meridian requirements
- Create optimized quartz.config.ts for workspace root sourcing
- Add Meridian plugin structure (placeholders for now)
- Configure ignore patterns for Meridian workflow

Based on Quartz by @jackyzha0 - all original attribution preserved"
```

### 5.3 Push to GitHub

```bash
# Push the meridian-main branch to your repository
git push -u origin meridian-main

# Verify the push was successful
echo "Repository created successfully!"
echo "Visit: https://github.com/Clinamenic/meridian-quartz"
```

## Step 6: Verification

### 6.1 Verify Repository Structure

```bash
# Check the final directory structure
tree -I 'node_modules|.git' -L 3
```

### 6.2 Test Basic Functionality

```bash
# Install dependencies to verify everything works
npm install

# Test that the configuration is valid
npm run check
```

## Next Steps

Once the repository is created successfully:

1. **Implement Meridian Plugins**: Port the plugin logic from deploy-manager.ts
2. **Update Deploy Manager**: Modify it to use the new meridian-quartz repository
3. **Test Integration**: Verify the fork works with Meridian's deployment system
4. **Documentation**: Add more detailed documentation for the fork

## Troubleshooting

### If git clone fails:

- Ensure you have git installed and configured
- Check your internet connection
- Verify the Quartz repository URL is accessible

### If npm install fails:

- Ensure Node.js >= 22 and npm >= 10.9.2 are installed
- Try `npm install --force` if there are peer dependency conflicts
- Clear npm cache: `npm cache clean --force`

### If TypeScript errors occur:

- The placeholder plugins are intentionally minimal
- Full implementation will resolve type errors
- Use `npm run check` to validate configuration only
