# Contributing

WRPGuard is licensed under the PolyForm Noncommercial License 1.0.0, and Vynx Labs LLC offers separate commercial licenses. Merging outside code requires a contributor agreement that lets Vynx Labs LLC offer it under both. That agreement does not exist yet, so **pull requests from outside contributors cannot be merged for now**. Issues with synthetic reproductions are welcome; suspected vulnerabilities go through `SECURITY.md`.

## Ground rules
- Open a focused issue or PR with a **synthetic** reproduction. Never include real credentials, registration certificates, keys, tokens or personal data.
- Every matching behavior must link to an OpenID4VP clause, or be labeled explicitly as WRPGuard policy in `docs/adr/ADR-002-standards-traceability.md`.
- A change that can turn a previous `fail`/`indeterminate` into `pass` needs a new policy version and an ADR-002 entry.
- Add both positive and negative tests. Suspected false passes are security issues: follow `SECURITY.md`, not the public tracker.

## Local checks
```sh
pnpm install
pnpm check   # lint, typecheck, test, build, CLI smoke test, secret scan, license check
```
Node.js >= 22.12 and pnpm 9 are required for development; the packages themselves support Node.js >= 22.

## PR description
Use `.github/pull_request_template.md`: scope, ADR/clause or policy, exact commands and results, security and false-pass considerations, dependency/license changes, public wording changes, owner approvals needed, open questions.
