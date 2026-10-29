# @wrpguard/core

**Experimental.** Offline check of whether an OpenID4VP 1.0 DCQL query fits a **caller-supplied, unverified** scope declaration (`wrpguard.scope/1`).

`pass` means only that the query matched the declaration you supplied under `wrpguard.policy/0.1`. It is not proof of registration authenticity, certificate validity, legal authorization, user consent, or EUDI/OpenID4VP conformance.

```ts
import { evaluateDcqlScopeFromJson } from '@wrpguard/core';

const result = evaluateDcqlScopeFromJson({
  scopeJson,
  dcqlQueryJson,
  context: { serviceId: 'onboarding', intendedUseId: 'age-check' },
});
// result.ok === false        -> result.error.issues (MALFORMED_DCQL | MALFORMED_SCOPE | MALFORMED_CONTEXT | INPUT_TOO_LARGE)
// result.report.decision     -> 'pass' | 'fail' | 'indeterminate'
// result.report.findings     -> [{ code, effect, ruleId, source, pointer, message, ... }]
```

- Zero runtime dependencies; no I/O, network, clock or randomness.
- `evaluateDcqlScopeFromJson` parses raw text with a strict parser that rejects duplicate keys. Use it for untrusted text.
- `evaluateDcqlScope` accepts already-parsed values. They are copied and validated, but duplicate keys cannot be detected after `JSON.parse`.
- `parseJsonStrict` is exported for callers that need the strict parser alone.

API contract, reason codes and limits: ADR-001 and ADR-003. Rule-to-clause traceability: ADR-002 (in the project repository, `docs/adr/`).

## License
Source-available, not open source: [PolyForm Noncommercial License 1.0.0](LICENSE.md), copyright 2026 Vynx Labs LLC. Commercial use requires a separate license from Vynx Labs LLC: licensing@vynx-labs.dev.
