# Fixture expectations
Synthetic data only; no actual registration certificates or private information. Identifiers use `example.org` and the public ISO mDL doctype/namespace names.

All expectations assume `--service onboarding --intended-use age-check` (without them every result is at best `indeterminate`).

| File | Expected | Reason code |
|---|---|---|
| `scope.json` | — | **unverified local synthetic declaration**, not a signed trusted registration |
| `request-pass.json` | `pass` (exit 0) | declared scope matches only |
| `request-mdoc-pass.json` | `pass` (exit 0) | mdoc `[namespace, element]` declared |
| `request-overask.json` | `fail` (exit 2) | `UNREGISTERED_CLAIM_PATH` for `birth_date` |
| `request-claim-sets-overask.json` | `fail` (exit 2) | `UNREGISTERED_CLAIM_PATH`; `birth_date` is a `claim_sets` alternative |
| `request-indeterminate.json` | `indeterminate` (exit 3) | `MISSING_CLAIM_SELECTION` (WRPGuard policy; the query is valid OpenID4VP) |
| `request-unsupported-format.json` | `indeterminate` (exit 3) | `UNSUPPORTED_CREDENTIAL_FORMAT` (`jwt_vc_json`) |
| `request-credential-sets-unsupported.json` | `indeterminate` (exit 3) | `UNSUPPORTED_CREDENTIAL_FORMAT` in a `credential_sets` alternative |
| `request-malformed-path.json` | invalid input (exit 1) | `MALFORMED_DCQL`: negative path index |

The fixture `snapshot.observedAt` merely supplies user data; it is NOT evidence of scope validity or provenance.
