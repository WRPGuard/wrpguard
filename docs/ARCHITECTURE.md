# Architecture and canonical contracts

## Planned monorepo
```
packages/
  core/                 # pure TS types, parse, normalize, evaluate, report
    src/{types,parse,match,evaluate,index}.ts
    test/
  cli/                  # file I/O and stdout; depends on core only
    src/index.ts
  adapter-ts5/          # POST-MVP: TS5 verified registration-source normalization
examples/
  basic/
fixtures/
docs/
```

## Public API sketch
```ts
import { evaluateDcqlScope } from '@wrpguard/core';
const report = evaluateDcqlScope({
  scope: normalizedScope,
  dcqlQuery: dcqlQuery,
  context: { intendedUseId: 'age-check', serviceId: 'onboarding' },
});
// report.decision: 'pass' | 'fail' | 'indeterminate'
// report.findings: { code, severity, pointer, message, ruleId? }[]
```
This is a DESIGN contract, not shipped code. Lead agent may adjust and freeze it in ADR-001.

## Internal versioned `NormalizedScope` shape
```ts
{
 schemaVersion: 'wrpguard.scope/1',
 relyingPartyId: string,
 serviceId: string,
 intendedUseId: string,
 credentials: Array<{
   format: 'dc+sd-jwt' | 'mso_mdoc',
   type: string,                 // vct or doctype
   claims: Array<Array<string | number | null>>
 }>,
 snapshot?: { observedAt: string, sourceLabel: string }
}
```
**Not an official EUDI standard schema**. Scope objects are test declarations supplied by the integrator. The core cannot know whether they are genuine, complete, current, or legally authoritative.

## DCQL processing algorithm
1. Parse untrusted JSON strictly; enforce byte length, depth and entry count caps. Reject invalid forms with a distinct malformed-input result / CLI exit 1.
2. Identify the single selected service ID and intended-use ID from caller context; require exact match to scope (mismatch => fail; missing/ambiguous => indeterminate).
3. For each credential query, resolve its *possible* `format` and `meta.vct_values` or `meta.doctype_value`. Multi-valued vct must be checked across **all** possible requested types, not just one.
4. If `claims` missing, mark `indeterminate` because mandatory/full-credential disclosure cannot be analyzed safely from a claimed path list alone.
5. For each possible credential type and each path, compare only against exact registered path arrays. A request for `['address']` is NOT covered by a registered `['address','street']`.
6. If `claim_sets` / `credential_sets` add alternatives, test all branches that could be sent, or mark `indeterminate` if parsing a branch is unsupported; never ignore a branch.
7. Prioritize fail over indeterminate over pass when aggregating: a proven overrequest is fail even if other parts are unknown.
8. Produce stable ordered findings; `pass` means **syntactic match to supplied declaration only**.

## Reason codes (freeze in ADR)
- `UNREGISTERED_CREDENTIAL_TYPE`
- `UNREGISTERED_CLAIM_PATH`
- `WRONG_SERVICE`
- `WRONG_INTENDED_USE`
- `UNSUPPORTED_CREDENTIAL_FORMAT`
- `MISSING_CLAIM_SELECTION`
- `UNRESOLVED_ALTERNATIVES`
- `MALFORMED_DCQL`
- `MALFORMED_SCOPE`
- `INPUT_TOO_LARGE`

## Security boundary
```
[untrusted user-supplied JSON] --> strict parse --> [pure preflight matcher] --> local report
[future trusted source adapter] --> validated source evidence --> [normalized declaration]
```
Passing the preflight must never be represented as authentication, signature validity, eligibility, legal basis, or proof of issuer trust.
