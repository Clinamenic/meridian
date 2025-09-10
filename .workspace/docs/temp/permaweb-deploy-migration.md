## Meridian Arweave Deployment: Migration to permaweb-deploy

This document plans a migration from our current Arweave site deployment flow (custom arkb-driven uploads and manual path manifest creation) to the `permaweb-deploy` CLI. The new approach leverages Turbo SDK-powered uploads, standard Arweave Manifest v0.2.0 support with SPA fallback, and optional ArNS updates via ANT.

### Objectives

- Replace ad-hoc site bundle uploads and manifest creation with `permaweb-deploy`.
- Support ArNS updates (root and undernames) as part of deployment.
- Maintain backwards compatibility for single-file uploads (ResourceManager) via existing `ArweaveManager` methods.
- Keep/extend our verification and cost-estimation UX.

### References

- Internal reference: `.cursor/docs/ref/permaweb-deploy.md`
- Current code paths:
  - Main: `src/main/site-deploy-manager.ts`
  - Main: `src/main/arweave-manager.ts`
  - Renderer: `src/renderer/modules/DeployManager.js`
  - Styles (informational): `src/renderer/styles/modules/deploy-manager.css`, `resource-manager.css`

### Current State Summary (as-is)

- Build step: Quartz build into `workspace/.quartz/public`.
- Deployment (Arweave):
  - `DeployManager.deployToArweave()` → `ArweaveManager.uploadSiteBundle()`
  - Iterates over files, uploads each via arkb, then constructs and uploads a custom path manifest using `uploadArweavePathManifest()`.
  - Tags include `meridian:*` metadata; we track results in `DataManager` + `UnifiedDatabaseManager`.
- Verification: `ArweaveManager.verifySiteDeployment()` fetches manifest and files to confirm accessibility.
- Cost estimate: built from our own manifest generation and size accounting.

### Target State Summary (to-be)

- Build step unchanged (Quartz).
- Deployment (Arweave):
  - Use `permaweb-deploy` CLI to deploy the folder `workspace/.quartz/public` (or a single file if ever needed).
  - Provide signer via `DEPLOY_KEY` env:
    - For Arweave: base64-encoded JWK (we already store JSON; we’ll base64-encode at runtime).
    - For other signers (ethereum, polygon, kyve) pass raw private key.
  - Optional ArNS update using `--arns-name` and `--undername`, plus `--ttl-seconds` and `--ario-process` (mainnet/testnet/custom PID).
  - CLI handles manifest creation (v0.2.0) and SPA fallback.
- Verification:
  - Parse CLI output for the site/manifest transaction ID, then reuse our `ArweaveManager.verifyTransaction()` and/or fetch `https://arweave.net/<txid>` for live check.
- Cost estimate:
  - Keep our preflight size-based estimate for now; consider adding a future enhancement to ask `permaweb-deploy` for a dry-run/estimate if/when supported.

### Architecture & API Changes

1. Main process: add a new deployment path using permaweb-deploy

- File: `src/main/site-deploy-manager.ts`
  - Add IPC handler: `deploy:arweave-permaweb` that accepts config:
    - `workspacePath: string`
    - `arnsName?: string`
    - `undername?: string` (default `@`)
    - `ttlSeconds?: number` (default `3600`)
    - `arioProcess?: 'mainnet' | 'testnet' | string` (default `mainnet`)
    - `sigType?: 'arweave' | 'ethereum' | 'polygon' | 'kyve'` (default `arweave`)
  - Implementation outline (pseudo):
    - Ensure site is built (reuse `buildSite`).
    - Resolve build folder: `const buildPath = path.join(workspacePath, '.quartz', 'public')`.
    - Retrieve wallet from `ArweaveManager`/`CredentialManager`:
      - If `sigType === 'arweave'`, get JWK JSON, base64-encode → `DEPLOY_KEY`.
      - Else, get raw private key string → `DEPLOY_KEY`.
    - Spawn non-interactive CLI, e.g.:
      - Command: `npx --yes permaweb-deploy --arns-name <name> --deploy-folder "<buildPath>" [--undername <u>] [--ttl-seconds <ttl>] [--ario-process <proc>] [--sig-type <sig>]`
      - `env`: include `DEPLOY_KEY`, do NOT log it.
    - Capture stdout/stderr; parse transaction ID from JSON or by regex; return structured result `{ success, manifestHash, manifestUrl, url, fileCount?, totalSize? }` similar to existing `ArweaveDeployResult` for UI compatibility.
    - Store minimally necessary deployment metadata (e.g., txid) in `DataManager`/`UnifiedDatabaseManager` (optional v1), or defer and just display to user.
  - Keep existing `deploy:arweave-deploy` as legacy for a transition period. Consider a settings switch to choose the engine.

2. Main process: utilities in `ArweaveManager`

- File: `src/main/arweave-manager.ts`
  - Add helper: `getActiveWalletBase64(): Promise<string | null>`
    - Get active JWK string → base64 encode.
    - This supports `DEPLOY_KEY` for `sigType === 'arweave'`.
  - Keep existing single-file and bundle APIs for ResourceManager features.
  - Keep verification helpers (`verifyTransaction`, `checkTransactionStatus`) for post-deploy checks.
  - Mark `uploadSiteBundle`, `uploadArweavePathManifest` as legacy (retained for now).

3. Renderer process: UI updates in `DeployManager.js`

- File: `src/renderer/modules/DeployManager.js`
  - Add a toggle/engine selection (default to permaweb-deploy) for Arweave deployment.
  - In the Arweave section of the Deploy dialog:
    - Inputs: ArNS Name (required when using ArNS), Undername (default `@`), TTL seconds, Network (`mainnet`/`testnet`), Signer Type (arweave/ethereum/polygon/kyve).
    - Validation for ArNS/Undername format, TTL range (60–86400).
  - On submit for Arweave deploy:
    - If engine is permaweb-deploy → call IPC `deploy:arweave-permaweb` with collected args.
    - Display returned URLs/txid, and verification status using existing verification view.
  - Keep legacy path available under advanced options or a feature flag.

4. Styles

- Minimal changes; ensure new fields align with existing section styling in `deploy-manager.css`.

### CLI Invocation Details

- Non-interactive usage:
  - `DEPLOY_KEY=<base64_jwk_or_raw_pk> npx --yes permaweb-deploy --arns-name <ARNS_NAME> --deploy-folder <BUILD_DIR> [--undername <UNDERNAME>] [--ttl-seconds <TTL>] [--ario-process <mainnet|testnet|PID>] [--sig-type <arweave|ethereum|polygon|kyve>]`
- Build dir: `<workspace>/.quartz/public`
- Environment:
  - Set only in the child process; do not persist `DEPLOY_KEY` to logs or disk.
- Output parsing:
  - Prefer JSON if available; else extract 43-char Arweave tx id via regex; capture any reported manifest/primary tx.

### Backwards Compatibility and Feature Switch

- Add to `site-settings.json` (via `SiteConfigManager`):
  - `deployment.arweaveEngine: 'permaweb-deploy' | 'legacy'` (default: `'permaweb-deploy'`).
- Renderer reads the engine to set default selection.
- Both main and renderer pathways exist during transition; legacy can be removed after a deprecation window.

### Security Considerations

- Never log wallet JSON or the base64-encoded `DEPLOY_KEY`.
- Clear any process env copies immediately after use (spawn-scoped env object only).
- Encourage users to use a dedicated deployment wallet, as in docs.

### Verification Workflow (Post-Deploy)

- If permaweb-deploy returns a tx id (manifest or site entry):
  - Use `ArweaveManager.verifyTransaction(txid)` for quick status.
  - Attempt GET `https://arweave.net/<txid>` to confirm data availability.
  - If ArNS used, resolve and show `https://arweave.net/<arns-resolution>` when applicable.
- Display verification summary in the Deploy UI.

### Internal Link Preservation (Quartz → Permaweb)

Background (see `quartz-architecture.md`): Quartz emits static HTML pages with internal links generated from slugs (e.g., `canonicalizeServer`, path helpers). When deployed to Arweave using a path manifest, the gateway resolves URLs under:

- `https://arweave.net/<manifestTxId>/<relative/site/path>` (path manifest scope)
- Or (recommended) `https://<your-ar-gateway-domain>/` when using ArNS with a gateway-backed hostname that treats your site root as the domain root.

Key constraints:

- Root-absolute links (hrefs starting with `/`) will break when browsing under `https://arweave.net/<manifestTxId>/...` because `/` points to the gateway root, not your manifest scope.
- Relative links (e.g., `../page/`, `page/index.html`) work in both contexts.
- Using ArNS with a dedicated gateway hostname (e.g., `https://myname.arweave.dev/`) makes root-absolute links safe because the domain root is your site root.

Recommended strategies:

- Preferred: Enable ArNS update and access the site via the ArNS hostname. Keep Quartz links as-is (root-absolute or relative) and treat the ArNS domain as the canonical base.
- Alternative (no ArNS): Ensure Quartz outputs relative internal links. If Quartz cannot be configured to emit relative links in your setup, add a post-build audit (and optional rewrite) step:
  - Audit: scan `.quartz/public/**/*.html` for `href="/` and `src="/` occurrences and report counts.
  - Optional rewrite (flagged): convert root-absolute links `"/foo/bar"` to page-relative links computed from the current file path. Only apply to internal links (same-origin paths); skip `http(s)://` and protocol-relative URLs.

Implementation notes:

- Configuration option: consider setting `configuration.baseUrl` in Quartz to a relative-friendly value or leaving it blank so generated anchors are relative (test with a small fixture).
- Post-build audit utility: add a `SiteDeployManager.auditInternalLinks(buildPath)` that returns counts and examples of root-absolute links; surface results in the Deploy UI pre-publish.
- Rewrite utility (opt-in): `SiteDeployManager.rewriteAbsoluteLinksToRelative(buildPath)` guarded by a checkbox in the UI; create backups and show a diff summary.
- With ArNS + gateway hostname, no rewrite is necessary; still run the audit to catch edge cases.

Success criteria for links:

- Navigating the deployed site via ArNS domain results in zero broken internal links.
- Navigating via `https://arweave.net/<manifestTxId>/` also works when the audit reports 0 root-absolute links (or after rewrite is applied).

### Cost Estimation (Interim)

- Continue using our size-based estimate from `generateArweaveManifest()`/content scan results pre-deploy.
- Future: If `permaweb-deploy` exposes an estimate/dry-run, add a toggle to request official estimate.

### Telemetry/Logging

- Follow `Meridian/023_debugging` logging patterns.
- Log high-level steps and statuses only; never include secrets.

### Step-by-Step Implementation Plan

Phase 0: Dependencies and groundwork

- Add `permaweb-deploy` to `Meridian/package.json` dependencies (or rely on `npx` fetch on-demand). Prefer local dep for stability and offline support.
- Confirm Node/NPM constraints are compatible (Node ≥ 22 is fine; the CLI commonly targets Node 18/20+). Keep our system validation as-is.

Phase 1: Main-process integration

- `src/main/arweave-manager.ts`
  - Add `getActiveWalletBase64()` helper.
- `src/main/site-deploy-manager.ts`
  - Add IPC `deploy:arweave-permaweb` and implement spawn flow with `DEPLOY_KEY`.
  - Reuse `buildSite()` before invoking the CLI.
  - Return a response shaped like `ArweaveDeployResult` where possible to minimize UI changes.

Phase 2: Renderer UI/UX

- `src/renderer/modules/DeployManager.js`
  - Add engine selector and new input fields (ArNS Name, Undername, TTL, Network, Signer Type).
  - Wire submit handler to new IPC when engine is permaweb-deploy.
  - Display returned manifest/site URLs and verification status.
  - Keep legacy controls accessible under “Advanced/Legacy”.
  - Add link audit UI panel shown after build: show counts of root-absolute links and offer optional rewrite (with warning and backup).

Phase 3: Data persistence and verification polish

- Optionally record deployment entries in `DataManager`/`UnifiedDatabaseManager` (txid, timestamp, engine, arns info).
- Enhance the verification panel to show ArNS resolution if used.

Phase 4: Documentation and deprecation

- Add user-facing docs in `.cursor/docs/` describing the new flow.
- Mark legacy manifest/bundle methods as deprecated in code comments.
- After a deprecation period, remove legacy path if desired.

### Acceptance Criteria

- Deploying a built site to Arweave via permaweb-deploy works from the UI with an Arweave signer.
- Optional ArNS updates succeed when configured (root and undername).
- Verification step confirms data availability (manifest or index) and shows a working URL.
- Secrets are not logged; `DEPLOY_KEY` is ephemeral and only set for the child process.
- Legacy single-file uploads continue to work unchanged.

### Example IPC Flow (happy path)

1. User clicks Deploy → selects Arweave → Engine: permaweb-deploy, sets ArNS Name, Undername, TTL, Network.
2. Renderer calls `ipcRenderer.invoke('deploy:arweave-permaweb', config)`.
3. Main builds site, encodes wallet, spawns `npx --yes permaweb-deploy ...` with `DEPLOY_KEY`.
4. Parse stdout to obtain tx id; run a quick verification.
5. Return `{ success: true, url, manifestUrl, manifestHash, fileCount?, totalSize? }`.
6. UI displays success, links, and verification status.

### Risks & Mitigations

- CLI output format changes: implement resilient parsing (JSON first, regex fallback) and surface raw logs in UI when parsing fails.
- Network instability: keep timeouts reasonable; surface clear errors; recommend retry.
- Large sites: rely on Turbo-powered uploads; keep our build log buffering and timeouts (extend if needed).
- Security: ensure no accidental credential logging; review logs in error paths too.

### Rollback Plan

- Feature switch to `'legacy'` engine in settings; renderer defaults back to legacy path.
- Code paths remain intact; no data/schema migrations are required.

### Work Items (tracked)

- Main
  - [ ] Add `getActiveWalletBase64()` to `ArweaveManager`.
  - [ ] Add `deploy:arweave-permaweb` IPC handler and method in `SiteDeployManager`.
  - [ ] Spawn permaweb-deploy with proper args, secure env, and parse output.
  - [ ] Integrate verification and structured return.
  - [ ] Implement `auditInternalLinks(buildPath)` and optional `rewriteAbsoluteLinksToRelative(buildPath)` in `SiteDeployManager`.
- Renderer
  - [ ] Add engine selector and new ArNS-related fields.
  - [ ] Wire submit to new IPC; update success view.
  - [ ] Optional: Display ArNS resolution link if provided.
  - [ ] Add link audit panel with results and optional rewrite control.
- Docs
  - [ ] Add user doc for permaweb-deploy usage within Meridian.
  - [ ] Mark legacy path as deprecated in code comments and UI copy.
