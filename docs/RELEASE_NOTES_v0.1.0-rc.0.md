# WRPGuard v0.1.0-rc.0 — release notes (internal release candidate, NOT released)

Nothing has been published and no git tag exists. License: PolyForm Noncommercial 1.0.0 (source-available, not open source); commercial use requires a license from Vynx Labs LLC (licensing@vynx-labs.dev).

## What it is
An offline preflight that checks whether a proposed OpenID4VP 1.0 DCQL query asks only for credential types and claim paths in a caller-supplied scope declaration, for a named service and intended use. Results: `pass`, `fail`, `indeterminate`, or invalid input.

## Supported
- Formats `dc+sd-jwt` (`meta.vct_values`) and `mso_mdoc` (`meta.doctype_value`).
- Exact, type-sensitive claims-path matching, including `null` wildcards (matched only by `null`).
- `claim_sets` and `credential_sets`: every listed alternative evaluated.
- Validation of the OpenID4VP structural rules in §6–§7 and Appendix B.2/B.3, with JSON Pointer locations.
- CLI exit codes 0/2/3/1, `--json` reports, terminal-safe output.

## Not supported / known limitations
1. Claims made non-selectively-disclosable by an SD-JWT issuer are always disclosed and cannot be seen from the query.
2. No SD-JWT VC type inheritance; exact `vct` strings only.
3. Exact paths only: a narrower child request under a declared parent path is `fail`.
4. No Unicode normalization (differently encoded identifiers fail closed).
5. `jwt_vc_json`, `ldp_vc` and other formats → `indeterminate`.
6. Unknown DCQL properties → `indeterminate`, even though OpenID4VP tells implementations to ignore them.
7. Missing `claims` → `indeterminate` (WRPGuard policy; the query is valid OpenID4VP).
8. Only the bare DCQL object is evaluated, not the Authorization Request (`client_id`, signatures, `scope` aliases, transaction data).
9. `intent_to_retain`, `multiple`, `trusted_authorities`, `require_cryptographic_holder_binding` do not affect the decision.
10. The scope declaration is never authenticated; freshness, revocation and provenance are the caller's responsibility.
11. Pre-parsed SDK inputs (`evaluateDcqlScope`) cannot be checked for duplicate JSON keys or for how numbers were written (e.g. `1.0`), and a `Proxy` can run code during inspection. Use `evaluateDcqlScopeFromJson` for untrusted text.
12. Tested on Windows / Node 24, on Linux (WSL2 Debian) / Node 22 and 24, and in GitHub CI (Ubuntu, Node 22 and 24). macOS is untested.

## Not claimed
Not certified, not an official EU or OpenID validator, not cryptographically verified, not a legal or GDPR assessment, not production-ready.
