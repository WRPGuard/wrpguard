# Standards baseline / traceability matrix

**Pinned 2026-10-28.** Rule-by-rule clause mapping, normative-vs-policy split and test IDs live in [ADR-002](adr/ADR-002-standards-traceability.md).

| Reference | Baseline | Verified 2026-10-28 | Project implication |
|---|---|---|---|
| [OpenID4VP 1.0 Final](https://openid.net/specs/openid-4-verifiable-presentations-1_0-final.html) | Final, published 2025-07-09 | **Yes**: final text fetched; §6, §6.1–6.4, §7, App. B.1–B.3 read; SHA-256 in ADR-002 | DCQL query: `credentials`, `credential_sets`; `claims`, `claim_sets`, `path`, `format`, `meta`. The `-1_0.html` URL tracks errata and may differ from the final text. |
| [EUDI TS5](https://github.com/eu-digital-identity-wallet/eudi-doc-standards-and-technical-specifications/blob/main/docs/technical-specifications/ts5-common-formats-and-api-for-rp-registration-information.md) | **v1.6, 2026-09-30** (kit said v1.5) | **Partly**: `main` branch fetched; §2.4.1, 2.4.2, 2.4.4, 2.4.5, 2.4.13 read. Whether v1.6 is a tagged release was not checked. | Model of service identifiers, intended use, credentials, claims and metadata. Informs `wrpguard.scope/1` only. |
| [EUDI ARF](https://eu-digital-identity-wallet.github.io/) | v3.0.0, 2026-07-21 (per kit) | No | Wallet–relying party trust and intended-use architecture; background only |
| [EUDI TS6](https://github.com/eu-digital-identity-wallet/eudi-doc-standards-and-technical-specifications/blob/main/docs/technical-specifications/ts6-common-set-of-rp-information-to-be-registered.md) | v1.2.2, 2026-08-20 (per kit) | No | Registered RP information and intended-use linkage; background only |
| [EU 2025/848](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32025R0848) | Amended (per kit) | No | Legal context of relying-party registration |
| [EU 2026/1730](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202601730) | Published 2026-07-22 (per kit) | No | Updated certificate and intended-use requirements |
| [EU 2024/2982 consolidated](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A02024R2982-20260811) | Consolidated 2026-08-11 (per kit) | No | Wallet-side checks and user warning policy; NOT proof our RP tool is compliant |
| [ETSI TS 119 475](https://www.etsi.org/deliver/etsi_ts/119400_119499/119475/01.01.01_60/ts_119475v010101p.pdf) | v1.1.1, 2025-10 (per kit) | No | Future registration-certificate adapter requirements |

No v0.1 rule depends on an unverified source.

## Rules investigated (outcome)
- DCQL `claims.path` permits string, nonnegative integer and null; `null` selects all array elements (§7). **Implemented:** exact, type-sensitive comparison (WRPG-CLM-01). Empty-string elements and `-0` are rejected by policy (WRPG-SYN-02).
- Missing `claims` is valid: only mandatory claims are returned, or the full credential for non-SD formats (§6.4.1). **Implemented:** `indeterminate` as WRPGuard policy (WRPG-CLM-02), never described as invalid.
- `claim_sets` and `credential_sets` select alternatives (§6.4.1, §6.4.2). **Implemented:** superset evaluation of every listed alternative (WRPG-ALT-01/02).
- Unknown properties MUST be ignored by implementations (§6). **Implemented:** not malformed, but `indeterminate` (WRPG-EXT-01).
- TS5 has `serviceIdentifier` (optional, §2.4.1) and `intendedUseIdentifier` (§2.4.4). **Implemented:** both kept as `serviceId` / `intendedUseId`; WRPGuard requires a `serviceId` label even when TS5 omits it.
- TS5 registration `Credential` includes format, meta and claim paths; expected `values` are not registered (§2.4.2 note). **Implemented:** `values` never affect the decision and are never echoed (WRPG-VAL-01).
- Registration does not inherently prove legal permission. **Implemented:** every report carries `scopeTrust: caller-supplied-unverified` and a fixed notice.
