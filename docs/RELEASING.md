# Releasing to npm

Releases go only through the manual `release` workflow (`.github/workflows/release.yml`). It runs `pnpm check`, packs both packages, installs the tarballs in a clean project, checks the installed CLI, writes a CycloneDX SBOM and `SHA256SUMS`, and publishes with npm provenance through **trusted publishing** (OIDC: no token, no 2FA prompt). With `stage=true` it stages instead, and a maintainer approves each package with 2FA. The workflow is a dry run unless `dry_run` is set to `false`. `publishConfig.provenance: true` makes a local `npm publish` fail, so packages cannot be published from a laptop by accident.

Publishing is an owner decision. Agents may run dry runs only.

## One-time setup: trusted publishing
Requires npm >= 11.15 (`npx -y npm@11` works without upgrading) and one 2FA confirmation. On the npm 2FA page, tick "skip two-factor authentication for the next 5 minutes" so the second command does not ask again.
```sh
npx -y npm@11 login
npx -y npm@11 trust github @wrpguard/core --file release.yml --repo WRPGuard/wrpguard --allow-publish --allow-stage-publish -y
npx -y npm@11 trust github @wrpguard/cli --file release.yml --repo WRPGuard/wrpguard --allow-publish --allow-stage-publish -y
gh secret delete NPM_TOKEN -R WRPGuard/wrpguard
```
Then revoke the old granular token on npmjs.com (Access Tokens). Optional hardening: set each package's publishing access to "Require two-factor authentication and disallow tokens"; trusted publishing keeps working.

## Release
1. Set the same version in `packages/core/package.json`, `packages/cli/package.json` and `packages/cli/src/version.ts`; update `CHANGELOG.md` and the release notes. Commit, push, wait for green CI.
2. Dry run, then publish:
   ```sh
   gh workflow run release.yml -R WRPGuard/wrpguard
   gh workflow run release.yml -R WRPGuard/wrpguard -f dry_run=false
   ```
3. Check: `npm view @wrpguard/core dist-tags`; the package pages show a provenance badge.

Dist-tags: a stable version becomes `latest`. A prerelease (`-rc.N`) becomes `latest` while no stable version exists, and `next` afterwards.

To require a human approval for a release, add `-f stage=true` and approve each package on npmjs.com (Staged Packages tab) with 2FA.

A bad release: prefer `npm deprecate @wrpguard/<name>@<version> "<reason>"` and a fixed version. `npm unpublish` works only within 72 hours and breaks anyone who installed it.

## Notes from the first release (2026-10-28)
- npm accepts provenance only from **public** source repositories.
- `repository.url` in each `package.json` must match the GitHub repository's exact casing (`WRPGuard/wrpguard`).
- `npm publish` with a granular token fails with `EOTP` when the account requires 2FA; trusted publishing (or `npm stage publish`) avoids that.
- Staging a package that does not exist yet creates a public placeholder `0.0.0-stage` and points `latest` at it. After approving a **new** package, move `latest` and deprecate the placeholder (needs 2FA):
  ```sh
  npm dist-tag add @wrpguard/<name>@<version> latest
  npm deprecate @wrpguard/<name>@0.0.0-stage "Placeholder from npm staged publishing; use @wrpguard/<name>@latest"
  ```
