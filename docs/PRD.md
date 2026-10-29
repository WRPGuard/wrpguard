# Product Requirements Document — v0.1

## Who/why
An EUDI relying-party integrator needs to see when the *request it is about to send* would ask for an attribute not declared for the selected service/intended use. This is a local preflight to reduce errors during integration.

## In scope (must ship)
1. Consume a **supplied** normalized scope in WRPGuard's own documented JSON model. Scope carries RP ID, service ID, intended-use ID, supported credential formats/types, permitted claim paths, and optional snapshot metadata.
2. Parse a standalone **DCQL query** object (not complete authorization/request-object verification). Support `dc+sd-jwt` (`meta.vct_values`) and `mso_mdoc` (`meta.doctype_value`).
3. Evaluate every potentially requested credential and claim against the chosen intended-use scope, exact path and format/type matching.
4. Return `pass`, `fail`, or `indeterminate`; typed findings with codes, JSON pointers, explanations, and references to applicable rule IDs.
5. Enforce conservative handling of alternates; provide fixtures and tests for `claim_sets` and `credential_sets`.
6. Provide CLI: `wrpguard check --scope ... --request ... [--json]` with documented exits.
7. Publish internal API docs, security disclaimer, versioned schemas and conformance-by-rule matrix.

## Out of scope (must not promise)
Authenticating RP or origin; certificate signature / chain / revocation; fetching a live registry or trust list; validation of signed authorization requests; GDPR legality; wallet presentation or user approval; `scope` parameter resolution; interoperability guarantees across Member States; full regulatory certification.

## Value proposition
"Catch unintended or overbroad digital identity attribute requests before they reach wallets." Never use "provably compliant" or "fully secure" in marketing.

## Release criteria
- All checks in `docs/ACCEPTANCE.md` pass.
- 2 independent reviewers examine security cases and standards mapping.
- Document known limitations and a clear trusted-data boundary.
- No invented certificate parsing; no production keys.

## Success metrics
CLI integrates in under 15 minutes using synthetic fixtures; stable programmatic report; 100% passing regression fixtures; at least 3 discovery calls with wallet/relying-party integrators before charging for licenses.
