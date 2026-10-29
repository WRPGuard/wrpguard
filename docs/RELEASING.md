# Releasing to npm

Publishing is done only by the manual `release` workflow (`.github/workflows/release.yml`). It runs `pnpm check`, packs both packages, installs the tarballs in a clean project, checks the installed CLI, writes a CycloneDX SBOM and `SHA256SUMS`, and publishes with npm provenance. It is a dry run unless `dry_run` is set to `false`. `publishConfig.provenance: true` makes a local `npm publish` fail, so packages cannot be published from a laptop by accident.

Publishing is an owner decision (`docs/OWNER_APPROVAL_GATES.md`). Agents may run dry runs only.

## Dry run (any time)
```sh
gh workflow run release.yml -R WRPGuard/wrpguard
```
The tarballs, SBOM and checksums are attached to the run as the `release` artifact.

## First publish (packages do not exist on npm yet)
npm trusted publishing can only be configured for packages that already exist, so the first publish uses a short-lived token.

1. Make sure the npm organization `wrpguard` exists and you are an owner.
2. On npmjs.com, create a **granular access token**: read and write for the `@wrpguard` scope, shortest expiry. If your account requires 2FA for publishing, allow this token to publish without it.
3. Store it as a repository secret (you are prompted for the value):
   ```sh
   gh secret set NPM_TOKEN -R WRPGuard/wrpguard
   ```
4. Publish. Prerelease versions such as `0.1.0-rc.0` go to the `next` dist-tag, others to `latest`:
   ```sh
   gh workflow run release.yml -R WRPGuard/wrpguard -f dry_run=false
   ```
5. Check: `npm view @wrpguard/core` and `npm view @wrpguard/cli`; the npm package pages show a provenance badge.

## After the first publish: remove the token
1. For each package on npmjs.com, open **Settings → Trusted publishing** and add GitHub Actions: organization `WRPGuard`, repository `wrpguard`, workflow `release.yml`.
2. In the same settings, set publishing access to require 2FA and disallow tokens.
3. Delete the secret and revoke the token: `gh secret delete NPM_TOKEN -R WRPGuard/wrpguard`, then revoke it on npmjs.com.

Later releases need only step 4.

## New version
1. Set the same version in `packages/core/package.json`, `packages/cli/package.json` and `packages/cli/src/version.ts`; update `CHANGELOG.md` and the release notes.
2. Commit, push, wait for green CI, run a dry run, then publish.
3. A bad release: prefer `npm deprecate @wrpguard/<name>@<version> "<reason>"` and a fixed version. `npm unpublish` works only within 72 hours and breaks anyone who installed it.
