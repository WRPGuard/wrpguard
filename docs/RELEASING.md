# Releasing to npm

Releases go only through the manual `release` workflow (`.github/workflows/release.yml`). It runs `pnpm check`, packs both packages, installs the tarballs in a clean project, checks the installed CLI, writes a CycloneDX SBOM and `SHA256SUMS`, and **stages** both packages on npm with provenance (`npm stage publish`). Nothing goes live until a maintainer approves each staged package with 2FA. The workflow is a dry run unless `dry_run` is set to `false`. `publishConfig.provenance: true` makes a local `npm publish` fail, so packages cannot be published from a laptop by accident.

Requirements learned on the first release (2026-10-28):
- npm accepts provenance only from **public** source repositories.
- `repository.url` in each `package.json` must match the GitHub repository's exact casing (`WRPGuard/wrpguard`).
- `npm publish` with a granular token fails with `EOTP` when the account requires 2FA; `npm stage publish` (npm >= 11.15) works with the same token and defers 2FA to approval.

Publishing is an owner decision (`docs/OWNER_APPROVAL_GATES.md`). Agents may run dry runs only.

## Dry run (any time)
```sh
gh workflow run release.yml -R WRPGuard/wrpguard
```
The tarballs, SBOM and checksums are attached to the run as the `release` artifact.

## Release
1. Stage. Prerelease versions such as `0.1.0-rc.0` get the `next` dist-tag, others `latest`:
   ```sh
   gh workflow run release.yml -R WRPGuard/wrpguard -f dry_run=false
   ```
2. Approve each staged package with 2FA: npmjs.com → **Staged Packages** tab → review → **Approve**, or `npm stage list` and `npm stage approve <stage-id>`.
3. Check: `npm view @wrpguard/core` and `npm view @wrpguard/cli`; the package pages show a provenance badge.

Authentication for staging is the `NPM_TOKEN` repository secret (a granular token with write access to `@wrpguard`, no 2FA bypass needed).

## Recommended after the first release: replace the token
1. For each package on npmjs.com, open **Settings → Trusted publishing** and add GitHub Actions: organization `WRPGuard`, repository `wrpguard`, workflow `release.yml`. Allow staged publishing only (`npm trust ... --allow-stage-publish`), not direct publish.
2. Set package publishing access to "Require two-factor authentication and disallow tokens".
3. Delete the secret and revoke the token: `gh secret delete NPM_TOKEN -R WRPGuard/wrpguard`, then revoke it on npmjs.com.

## New version
1. Set the same version in `packages/core/package.json`, `packages/cli/package.json` and `packages/cli/src/version.ts`; update `CHANGELOG.md` and the release notes.
2. Commit, push, wait for green CI, run a dry run, then release.
3. A bad release: prefer `npm deprecate @wrpguard/<name>@<version> "<reason>"` and a fixed version. `npm unpublish` works only within 72 hours and breaks anyone who installed it.
