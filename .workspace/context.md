## Workspace context for code assistants

This project is configured for multiple code assistants (e.g., Cursor, Claude) that share assistant-agnostic resources in `.workspace/` while keeping assistant-specific guidance in their own directories.

### Goals

- Provide a single place for shared scripts, configs, and docs
- Keep assistant-specific rules decoupled from shared project resources
- Make release/versioning workflows unambiguous and automatable

## Directory map (high level)

- `CHANGELOG.md`: Human-readable release notes for each version
- `package.json`: Project metadata and version (authoritative SemVer source)
- `.workspace/` (assistant-agnostic, shared by all assistants)
  - `scripts/`: Shared automation (e.g., `version-bump.sh`)
  - `config/`: Shared tool/config overrides (e.g., `version-bump.conf`)
  - `docs/`: Project docs and references (e.g., `docs/ref`, `docs/arch`, `docs/temp`)
  - `templates/`: Optional reusable patterns
- `.cursor/`: Cursor-specific rules and guidance
- `.claude/`: Claude-specific rules and guidance

Note: Code lives in the project space (outside assistant directories). Assistant directories are scaffolding and guidance only.

## Conventions and workflows

### Conventional Commits → SemVer

- `fix:` → PATCH (0.0.x)
- `feat:` → MINOR (0.x.0)
- `BREAKING CHANGE` or `!` → MAJOR (x.0.0)
- `docs/style/refactor/test/chore` → PATCH (non-breaking)

See `/.cursor/rules/024_changelog.mdc` for details on analysis, impact assessment, and release process.

### CHANGELOG

- Maintain `CHANGELOG.md` with one section per release
- Use clear subsections (Added, Changed, Fixed, Removed, Security)
- The version in the changelog must match `package.json`

### Git tags

- Tag releases as `vX.Y.Z`

## Shared script: version bump

- Script: `.workspace/scripts/version-bump.sh`
- Usage: `.workspace/scripts/version-bump.sh [patch|minor|major]`
- Defaults: updates `package.json` via `npm version --no-git-tag-version` and, if present and enabled, updates display version in `src/renderer/index.html`

Customization without editing the script:

- Optional config file: `.workspace/config/version-bump.conf`
  - `REQUIRE_CLEAN_TREE` (default: `false`)
  - `PACKAGE_JSON_PATH` (default: `<repo_root>/package.json`)
  - `UPDATE_DISPLAY_VERSION` (default: `true`)
  - `DISPLAY_VERSION_HTML_PATH` (default: `<repo_root>/src/renderer/index.html`)
- Optional hooks:
  - Pre: `.workspace/scripts/version-bump.pre.sh VERSION_TYPE CURRENT_VERSION`
  - Post: `.workspace/scripts/version-bump.post.sh VERSION_TYPE NEW_VERSION`

Recommended release flow:

1. Analyze changes (Conventional Commits) and choose bump type
2. Run: `.workspace/scripts/version-bump.sh patch|minor|major`
3. Update `CHANGELOG.md` for the new version
4. Optionally: `npm install` to refresh `package-lock.json`
5. Commit, tag, push:
   - `git add .`
   - `git commit -m "chore: bump version to X.Y.Z"`
   - `git tag vX.Y.Z`
   - `git push && git push --tags`

## Orientation steps for a new assistant

1. Read this file and scan `.workspace/scripts/` and `.workspace/config/`
2. Review assistant-specific rules (e.g., `.cursor/rules/`, `.claude/`)
3. Check `package.json` for scripts, tooling, and version
4. Review `CHANGELOG.md` and recent tags/commits for context
5. If present, scan app entry points (e.g., `src/` tree) and build scripts
6. Follow release/versioning rules from `/.cursor/rules/024_changelog.mdc`
7. Add shared automation to `.workspace/scripts/` and document it in `.workspace/docs/`

## Etiquette for assistants

- Use `.workspace/` for shared, assistant-agnostic assets
- Keep assistant-specific rules/config in their respective directories
- Prefer hooks/config over editing shared scripts directly
- Keep documentation up to date in `.workspace/docs/` and cross-reference from assistant-specific docs

## Environment

- macOS development environment
- Node.js and npm required for versioning and build tooling
