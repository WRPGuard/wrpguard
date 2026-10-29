# @wrpguard/cli

**Experimental.** `wrpguard check` runs the WRPGuard preflight on two local JSON files: a scope declaration you supply, and a DCQL query. It works offline, makes no network calls, writes no files and sends no telemetry.

```sh
wrpguard check --scope scope.json --request dcql.json --service onboarding --intended-use age-check [--json]
```

| Exit | Result |
|---|---|
| 0 | pass: matches the supplied declaration |
| 2 | fail: detected mismatch |
| 3 | indeterminate: insufficient or unsupported evidence |
| 1 | invalid input, usage error, unreadable file, internal error |

The scope declaration is never authenticated. `pass` is not proof of registration authenticity, certificate validity, legal authorization, consent, or conformance. The full reference is in `docs/CLI.md` in the project repository.

## License
Source-available, not open source: [PolyForm Noncommercial License 1.0.0](LICENSE.md), copyright 2026 Vynx Labs LLC. Commercial use requires a separate license from Vynx Labs LLC: licensing@vynx-labs.dev.
