# Basic relying-party integration (synthetic data only)

`preflight.mjs` shows the intended integration: a relying party runs WRPGuard on every DCQL query before putting it into an OpenID4VP Authorization Request, and sends only queries that `pass`.

```sh
pnpm install && pnpm build          # from the repository root
node examples/basic/preflight.mjs
```
```
age-only: pass -> send
age-and-birth-date: fail -> blocked (UNREGISTERED_CLAIM_PATH at /credentials/0/claims/1/path)
no-claims-list: indeterminate -> blocked (MISSING_CLAIM_SELECTION at /credentials/0)
```

In your own project, `npm install @wrpguard/core` and use the same code. Points worth copying:
- Serialize the query once, check that text, and send that same text, so what was checked is what is sent.
- Treat `fail`, `indeterminate` and invalid input all as "do not send".
- `scope.json` is a declaration you maintain. WRPGuard does not authenticate it or check that it matches your registration; `pass` means only that the query fits this declaration.

`pnpm smoke` runs this example and checks its output.
