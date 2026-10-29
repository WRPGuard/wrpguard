# WRPGuard

**Experimental · [`@wrpguard/core`](https://www.npmjs.com/package/@wrpguard/core) and [`@wrpguard/cli`](https://www.npmjs.com/package/@wrpguard/cli) 0.1.0-rc.0 on npm · source-available ([PolyForm Noncommercial 1.0.0](LICENSE.md))**

WRPGuard is an **offline preflight**. It checks whether a proposed [OpenID4VP 1.0](https://openid.net/specs/openid-4-verifiable-presentations-1_0-final.html) DCQL query asks only for the credential types and claim paths in a **scope declaration you supply**, for the service and intended use you name. It flags over-requests before the request reaches a wallet.

> **Trust boundary.** WRPGuard does not authenticate the scope declaration. It does not validate registration certificates, signatures, revocation, or legal basis, and it does not assess EUDI or OpenID4VP conformance. `pass` means only: *this DCQL query matches the declaration you supplied, under WRPGuard policy `wrpguard.policy/0.1`*.

## 60-second demo (synthetic data)
Requires Node.js >= 22. The synthetic scope and requests are in this repository's `fixtures/`.
```sh
git clone https://github.com/WRPGuard/wrpguard && cd wrpguard
npx -y @wrpguard/cli check --scope fixtures/scope.json --request fixtures/request-pass.json \
  --service onboarding --intended-use age-check            # exit 0  pass
npx -y @wrpguard/cli check --scope fixtures/scope.json --request fixtures/request-overask.json \
  --service onboarding --intended-use age-check            # exit 2  fail: birth_date not declared
npx -y @wrpguard/cli check --scope fixtures/scope.json --request fixtures/request-indeterminate.json \
  --service onboarding --intended-use age-check --json     # exit 3  indeterminate: no claims list
```
More cases: [`examples/README.md`](examples/README.md). CLI reference: [`docs/CLI.md`](docs/CLI.md).

| Exit | Result |
|---|---|
| 0 | `pass`: matches the supplied declaration |
| 2 | `fail`: detected mismatch (unregistered type or claim path, wrong service or intended use) |
| 3 | `indeterminate`: WRPGuard cannot establish a safe match (no claims list, unsupported format, unknown properties, missing `--service`/`--intended-use`) |
| 1 | invalid input, usage error, unreadable file, internal error |

## Library
```sh
npm install @wrpguard/core
```
```ts
import { evaluateDcqlScopeFromJson } from '@wrpguard/core';

const result = evaluateDcqlScopeFromJson({
  scopeJson,       // string, wrpguard.scope/1
  dcqlQueryJson,   // string, the value of the Authorization Request's dcql_query
  context: { serviceId: 'onboarding', intendedUseId: 'age-check' },
});
if (!result.ok) console.error(result.error.issues);          // malformed / too large
else if (result.report.decision !== 'pass') console.error(result.report.findings);
```
`@wrpguard/core` has **zero runtime dependencies** and no I/O, network, clock, or randomness. Prefer the `FromJson` entry point for raw text: its strict parser rejects duplicate JSON keys. `evaluateDcqlScope` accepts already-parsed values.

- API reference: [`docs/API.md`](docs/API.md). Contract: [ADR-001](docs/adr/ADR-001-api-contract.md).
- Runnable relying-party integration: [`examples/basic`](examples/basic/).
- JSON Schemas for the scope declaration and the report ship in the package: `@wrpguard/core/schemas/scope-1.schema.json`, `@wrpguard/core/schemas/report-1.schema.json`.

## What is checked (policy 0.1)
- Formats `dc+sd-jwt` (`meta.vct_values`; **every** listed vct must be declared) and `mso_mdoc` (`meta.doctype_value`). Other formats → `indeterminate`.
- Claim paths are compared by **exact** element-wise equality. A declared `["address","street"]` does not cover a requested `["address"]`, and `null` (all array elements) only matches `null`.
- `claim_sets` and `credential_sets`: every listed alternative is evaluated, including optional and least-preferred ones.
- Missing `claims` is valid OpenID4VP (§6.4.1), but WRPGuard returns `indeterminate` as a **conservative policy**, not because the query is invalid.
- Properties WRPGuard does not model → `indeterminate` (OpenID4VP says to ignore unknown properties; WRPGuard does not assume they are harmless).
- Reports contain identifiers and paths only, never requested `values`.

Each rule is traced to an OpenID4VP clause or marked as WRPGuard policy in [ADR-002](docs/adr/ADR-002-standards-traceability.md). Input limits and parser design: [ADR-003](docs/adr/ADR-003-input-security.md).

## Known limitations
- Claims an SD-JWT issuer made non-selectively-disclosable are always disclosed and are invisible to a query-only check.
- No SD-JWT VC type inheritance; exact `vct` strings only.
- Exact paths only: a narrower child request under a declared parent is reported as `fail`.
- No Unicode normalization (differently encoded identifiers do not match; fails closed).
- Only the bare DCQL object is evaluated, not the surrounding Authorization Request.
- The `wrpguard.scope/1` format is WRPGuard's own schema, informed by EUDI TS5; it is not an official EUDI format, and WRPGuard does not parse TS5 registration data.

## License
WRPGuard is **source-available, not open source**. Copyright 2026 Vynx Labs LLC, licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md).

- Noncommercial use is permitted on the terms of the license, which names personal research, experiment and testing, hobby projects, and use by charitable organizations, educational institutions, public research organizations, public safety or health organizations, environmental protection organizations and government institutions.
- **Commercial use requires a separate commercial license from Vynx Labs LLC:** licensing@vynx-labs.dev.

This summary is not legal advice and does not change the license; [`LICENSE.md`](LICENSE.md) governs.

## Project status and governance
- Status: experimental release candidate `0.1.0-rc.0`, published on npm with provenance. Changes: [`CHANGELOG.md`](CHANGELOG.md).
- Security reports: GitHub private vulnerability reporting, see [`SECURITY.md`](SECURITY.md).
- Contributions: outside pull requests cannot be merged yet, see [`CONTRIBUTING.md`](CONTRIBUTING.md). Code of conduct: [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
- Tests and security review: [`docs/TEST_MATRIX.md`](docs/TEST_MATRIX.md), [`docs/SECURITY_REVIEW.md`](docs/SECURITY_REVIEW.md). Releasing: [`docs/RELEASING.md`](docs/RELEASING.md).

### Development
Requires Node.js >= 22.12 and pnpm 9. `pnpm install`, then `pnpm check` runs lint, typecheck, tests, build, the CLI and example smoke test, the secret scan and the license check.
