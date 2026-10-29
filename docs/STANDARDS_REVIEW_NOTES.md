# Standards review notes and verification checklist

Prepared: 2026-10-28. These are source bookmarks and rules to verify, **not** proof that every proposed behavior is normative.

## Official primary sources
- OpenID4VP 1.0 Final: https://openid.net/specs/openid-4-verifiable-presentations-1_0-final.html
- OpenID4VP Sections 5–7 define `dcql_query`, credential/claim selection, alternative sets and paths. Verify exact clause and terminology.
- EUDI ARF official releases: https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework/releases
- ARF 3.0.0 changelog dated 2026-07-21: https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework/blob/main/CHANGELOG.md
- EUDI technical specifications: use official versioned EUDI sources and confirm TS5/TS6 numbers from published records. Do not cite a draft as final without qualification.

## Important distinction
OpenID4VP says when `claims` is absent, the verifier requests no selectively disclosable claims, and only mandatory claims are returned for selectively-disclosing formats. Some other formats reveal their whole credentials. **WRPGuard's `MISSING_CLAIM_SELECTION -> indeterminate` is a conservative scope-analysis policy, NOT a statement that the query is invalid under OpenID4VP.**

Unknown JSON properties may be permitted in OpenID4VP. Parser must not reject valid forward-compatible requests without explicit policy rationale; evaluator may return `indeterminate` for new semantics that could affect safe scope determination. Distinguish format validity from our coverage limits in reports.

## Traceability worksheet
For each reason code, document: rule ID; spec version; URL; section; normative requirement? yes/no; our own conservative policy? yes/no; threat it prevents; positive test; negative test; unresolved profile ambiguity. A code review must challenge unproven legal assumptions.
