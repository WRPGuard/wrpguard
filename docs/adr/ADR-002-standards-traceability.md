# ADR-002 — Normative clauses vs. WRPGuard policy, and test mapping

- **Status:** Accepted by lead, frozen for policy `wrpguard.policy/0.1`. Requires 2 human reviewers before public release (ACCEPTANCE.md).
- **Revision 1 (2026-10-28):** WRPG-SYN-02 extended after the independent adversarial review (finding F1). This only turns a former `pass` into invalid input, so the policy version is unchanged.
- **Revision 2 (2026-10-29):** adds WRPG-CRT-01/02: an ETSI TS 119 475 registration certificate can replace the `wrpguard.scope/1` file. Results for `wrpguard.scope/1` inputs are unchanged, so the policy version stays 0.1.
- **Date:** 2026-10-28

## Sources actually read for this ADR
| Source | Version / date | Retrieved | Fingerprint |
|---|---|---|---|
| OpenID for Verifiable Presentations 1.0, `https://openid.net/specs/openid-4-verifiable-presentations-1_0-final.html` | Final, published 9 July 2025 | 2026-10-28 22:25 UTC | SHA-256 of HTML `08e635ea3563b192309c627382c281c81de176e94cdb5ffb11b13ac624f7e12e` |
| EUDI TS5 "Common formats and API for RP registration information", `eudi-doc-standards-and-technical-specifications` `main` branch | Version table tops at **v1.6, 30.09.2026** | 2026-10-28 | SHA-256 of markdown `c6c2169cde9e8abf1153020e3a22a0164924d9f889506ddbd7129118f1dcc164` |
| ETSI TS 119 475 "Relying party attributes supporting EUDI Wallet user's authorization decisions", `https://www.etsi.org/deliver/etsi_ts/119400_119499/119475/01.02.01_60/ts_119475v010201p.pdf` | **V1.2.1, 2026-03** (latest on the ETSI server, checked 2026-10-29) | 2026-10-28 | SHA-256 of PDF `77bf8e71715c495494113da23ccba89c0af8bf6b457fe2da38b5a12738ace55f` |
| ETSI TS 119 472-2 (EAA profiles; registration certificate in `verifier_info`) | V1.3.1, 2026-07 | 2026-10-28 | §6.3.2.2 OIDFVP-HAIP-COMMON-REQ-RO-13 to RO-16 read |

Clause numbers below refer to these texts. TS5 is background for the scope model only; WRPGuard does **not** parse TS5 registration objects.

## Normative facts relied upon (OpenID4VP 1.0 Final)
| Ref | Paraphrase (verify against source) |
|---|---|
| §6 | `credentials` REQUIRED non-empty array; `credential_sets` OPTIONAL non-empty array. "Implementations MUST ignore any unknown properties." |
| §6.1 | Credential Query: `id` REQUIRED, non-empty, `[A-Za-z0-9_-]`, unique in the request; `format` REQUIRED; `multiple` OPTIONAL boolean; `meta` REQUIRED object; `trusted_authorities` OPTIONAL non-empty array; `require_cryptographic_holder_binding` OPTIONAL boolean; `claims` OPTIONAL non-empty array, "Verifiers MUST NOT point to the same claim more than once"; `claim_sets` OPTIONAL non-empty array of arrays of claim ids. Multiple queries MAY request the same credential. |
| §6.1.1 | Trusted Authorities Query: `type` REQUIRED string, `values` REQUIRED non-empty array of strings. |
| §6.2 | Credential Set Query: `options` REQUIRED non-empty array of non-empty arrays of credential ids; `required` OPTIONAL boolean (default true). |
| §6.3 | Claims Query: `id` REQUIRED if `claim_sets` present (same charset, unique within `claims`); `path` REQUIRED non-empty claims path pointer; `values` OPTIONAL non-empty array of strings, integers or booleans. |
| §6.4 | Wallets MUST NOT send selectively disclosable claims not selected; a presentation MAY contain additional claims that are **not selectively disclosable**. |
| §6.4.1 | `claims` absent ⇒ no selectively disclosable claims requested, only mandatory claims returned; for non-SD formats this means the "full credential". `claims` without `claim_sets` ⇒ all listed claims requested. With `claim_sets` ⇒ **one** combination requested; wallet SHOULD return the first it can satisfy but may deviate. `claim_sets` MUST NOT be present without `claims`. `values` restrictions are best effort; Verifiers MUST NOT rely on them for security. |
| §6.4.2 | Without `credential_sets` all credentials requested; with it, all required sets plus optionally any others; each set satisfied by one of its options. |
| §7 | Claims path pointer: non-empty array of strings, nulls and non-negative integers. `null` selects all elements of an array. |
| §7.2 / §7.2.1 | mdoc path: exactly two strings (namespace, data element identifier), otherwise processing error. |
| App. B.2 / B.2.3 / B.2.4 | `mso_mdoc`; `meta.doctype_value` REQUIRED string; claims query may carry `intent_to_retain` boolean. |
| App. B.3.1 / B.3.5 | `dc+sd-jwt`; `meta.vct_values` REQUIRED non-empty array of strings; Wallet MAY return credentials inheriting from any listed type. |
| App. B.1 | `jwt_vc_json`, `ldp_vc` exist (W3C VC) — valid formats, **unsupported** by WRPGuard 0.1. |

TS5 background: `IntendedUse.intendedUseIdentifier` [1..1] (§2.4.4), `WalletRelyingPartyService.serviceIdentifier` [0..1] (§2.4.1), `Credential` = `format`, `meta` (`vct_values` | `doctype_value`), `claims` [1..*] of OpenID4VP claim paths (§2.4.2, §2.4.5, §2.4.13). "Expected claim values … are not informed as part of the Intended use registration" (§2.4.2 note).

## Rule table
`N` = normative requirement of the cited clause. `P` = WRPGuard conservative policy (stricter than, or outside, the standard). A `P` rule must never be described as "the request is invalid under OpenID4VP".

| Rule ID | Code / effect | Basis | Rule | Threat prevented | Tests |
|---|---|---|---|---|---|
| WRPG-CTX-01 | `WRONG_SERVICE` / fail | P | `context.serviceId` must equal `scope.serviceId` exactly. | Checking a request against another service's declaration. | T05 |
| WRPG-CTX-02 | `WRONG_INTENDED_USE` / fail | P (TS5 §2.4.4 background) | `context.intendedUseId` must equal `scope.intendedUseId` exactly. | Same, for intended use. | T04 |
| WRPG-CTX-03 | `MISSING_CONTEXT` / indeterminate | P | Both context IDs must be supplied for `pass`. | Implicit, unconfirmed binding of request to declaration. | ctx tests, CLI |
| WRPG-FMT-01 | `UNSUPPORTED_CREDENTIAL_FORMAT` / indeterminate | N §6.1 (format), P (allowlist) | Only `dc+sd-jwt` and `mso_mdoc` are evaluated. Other format strings — including valid `jwt_vc_json`, `ldp_vc` — are not judged. | Unknown semantics passing silently. | T07, T13 |
| WRPG-TYP-01 | `UNREGISTERED_CREDENTIAL_TYPE` / fail | N B.3.5, B.2.3; P exact match | **Every** `vct_values` entry, and the `doctype_value`, must equal a scope credential `type` with the same `format`. No inheritance resolution. | Multi-vct smuggling, format/type confusion. | T03, T11 |
| WRPG-CLM-01 | `UNREGISTERED_CLAIM_PATH` / fail | N §6.3, §7; P exact match | Each claims query `path` must **exactly equal** (element-wise, type-sensitive) a path registered for that format+type. A registered descendant never covers a parent; a registered `null` wildcard never covers, and is never covered by, an index. Checked against every registered requested type. | Parent-path over-disclosure; wildcard widening. | T02, T08, T10, T12 |
| WRPG-CLM-02 | `MISSING_CLAIM_SELECTION` / indeterminate | N §6.4.1 says absent `claims` is **valid**; P | Absent `claims`, or an empty option inside `claim_sets`, is not analyzable from paths alone ⇒ indeterminate. | Unbounded "mandatory/full credential" disclosure. | T06 |
| WRPG-ALT-01 | (feeds CLM-01) | N §6.4.1; P superset | With `claim_sets`, **every** entry of `claims` is evaluated, including entries no option references (stricter than §6.4.1). | Ignoring a requestable alternative. | T12 |
| WRPG-ALT-02 | (feeds all) | N §6.4.2; P superset | With `credential_sets`, **every** credential query is evaluated regardless of `required` or option membership. | Ignoring an optional branch. | T13 |
| WRPG-EXT-01 | `UNSUPPORTED_DCQL_PROPERTY` / indeterminate | N §6 says unknown properties MUST be ignored; P | Any property not modeled by policy 0.1 (any level, including `meta`) ⇒ indeterminate. The request is **not** malformed. | Extension semantics that may widen disclosure. | ext tests |
| WRPG-VAL-01 | none | N §6.4.1 | `values` never narrows the evaluated claim set ("MUST NOT rely on it for security"); values are never echoed. | Value filter used to disguise an over-request; privacy leak. | T17 |
| WRPG-SYN-01 | `MALFORMED_DCQL` | N §6–§7, B.2.3, B.3.5 | Structural violations of the cited REQUIRED/MUST rules: missing/empty `credentials`; bad/duplicate `id`; missing `format`/`meta`; empty `claims`; `claim_sets` without `claims`; claim `id` missing when `claim_sets` present; dangling ids in `claim_sets`/`credential_sets`; bad path element types; mdoc path not two strings; missing/empty `vct_values`; non-string `doctype_value`; exact duplicate `path` within one query; wrong JSON types for known properties. | Requests whose meaning is undefined. | T14, parser tests |
| WRPG-SYN-02 | `MALFORMED_DCQL` / `MALFORMED_SCOPE` | P | Policy rejections beyond the spec: duplicate JSON object keys; empty-string path components; `-0`; non-finite numbers; integral numbers written with a fraction or exponent (`1.0`, `1e0`, `0.99999999999999999999`) *(rev. 1)*. | Parser differentials; ambiguous identifiers. | T14, T15 |
| WRPG-SCP-01 | `MALFORMED_SCOPE` | P (WRPGuard schema, **not** an EUDI schema) | `wrpguard.scope/1` is a closed schema: exact `schemaVersion`; non-empty IDs; formats limited to the supported set; non-empty claims; unique format+type; unique paths; mdoc paths two strings; unknown properties rejected. | Mis-typed declarations silently widening scope. | scope tests |
| WRPG-CRT-01 | `MALFORMED_SCOPE`; feeds TYP-01 / CLM-01 | N TS 119 475 §5.2.1, §5.2.2 (Table 5), §5.2.4 (Tables 7, 9), Annex B.2.7, B.2.9, B.2.10; TS 119 472-2 RO-16; P for the handling below | A registration certificate can replace the scope file: the compact JWT (`typ` `rc-wrp+jwt`), the base64url-wrapped JWT from a `verifier_info` `registration_cert` element, or the decoded payload. `sub` is required. Each `credentials` entry declares its `claim` paths for every `vct_values` entry (or its `doctype_value`); entries with the same format and type are merged. An entry **without `claim` declares no claim paths** (B.2.9: "does not declare any specific attributes"); wallets read this differently, WRPGuard takes the strict reading (P). Entries in unsupported formats are ignored (they cannot make a supported-format query pass). Unknown keys in a supported entry, its `meta` or its claims are rejected (P), including `claims` instead of the specification's `claim`. `values` is ignored (WRPG-VAL-01). Signature, certificate chain, status, `iat` and `exp` are **not checked** (P); CWT (`rc-wrp+cwt`) is not supported. | Over-requests relative to the certificate a wallet compares the request with (ARF v3.0.0 RPRC_21); an unknown field that might narrow the declaration being silently ignored; parser differentials (strict parser on header and payload). | `certificate.test.ts`, CLI, smoke |
| WRPG-CRT-02 | `WRONG_INTENDED_USE` / fail; `MISSING_CONTEXT` / indeterminate; `MALFORMED_CONTEXT` | P (TS 119 475 Table 9: `intended_use_id` optional; TS 119 472-2 RO-13: the certificate travels in the request) | The certificate covers one intended use and is sent with the request it declares, so it binds the request by itself: no context is required for `pass`. A supplied `intendedUseId` must equal `intended_use_id` (else fail); if the certificate has none, the supplied intended use cannot be confirmed (indeterminate). `serviceId` is rejected: certificates have no service identifier. Report `subject`: `sub`, `intended_use_id` or `""`, and `serviceId` `""`. | Checking a request against the certificate of another intended use. | `certificate.test.ts` |
| WRPG-LIM-01 | `INPUT_TOO_LARGE` | P (ADR-003) | Byte, depth, node, string, array and per-field caps. | DoS. | T15 |

## Superset strategy (why `UNRESOLVED_ALTERNATIVES` is reserved)
Under §6.4.1/§6.4.2 any disclosed claim must come from a listed claims query of a listed credential query, unless it is non-selectively-disclosable (see limitations). Evaluating the **union** of all listed credential queries and claims queries is therefore an over-approximation of every branch the wallet could choose: if the union matches the scope, every branch does. The strategy can produce false `fail` (an unreferenced unregistered claim), never a false `pass` from a skipped branch.

## Mapping a TS5 intended use to `wrpguard.scope/1` (informative)
`scope.intendedUseId` ← `IntendedUse.intendedUseIdentifier`; `scope.serviceId` ← `serviceIdentifier`, or a caller-chosen local label when TS5 omits it; for each TS5 `Credential` and each of its `vct_values` (or its `doctype_value`) emit one entry `{format, type, claims: [path…]}`. Whether the TS5 source is genuine, current, or unrevoked is **out of scope** and remains the caller's responsibility.

## Known limitations of policy 0.1 (must be published)
1. Non-selectively-disclosable SD-JWT claims, and mdoc MSO data, are disclosed regardless of the query and are not evaluated.
2. No SD-JWT VC type inheritance resolution: exact `vct` strings only.
3. Exact path equality only: a narrower request under a registered parent path or wildcard is reported `fail`. Registrations must list the exact paths requested.
4. No Unicode normalization: visually identical but differently encoded identifiers do not match (fails closed).
5. `intent_to_retain`, `multiple`, `trusted_authorities`, `require_cryptographic_holder_binding` are validated but do not affect the decision.
6. Only a bare DCQL object is evaluated; Authorization Request parameters (`scope` aliases, `client_id`, signatures) are not.
7. The scope declaration is never authenticated.
8. Registration certificates are decoded, not verified: signature, certificate chain, status list and validity period are not checked, and CWT certificates are not supported. An entry without `claim` is read as declaring no claims, which some wallets read as allowing any claim.
