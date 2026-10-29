# Demo (synthetic data only)

From the project root after `pnpm install && pnpm build`:

```sh
WRPG="node packages/cli/dist/bin.js check --scope fixtures/scope.json --service onboarding --intended-use age-check"

$WRPG --request fixtures/request-pass.json                      # 0  pass
$WRPG --request fixtures/request-mdoc-pass.json                 # 0  pass (mdoc namespace/element)
$WRPG --request fixtures/request-overask.json                   # 2  fail: birth_date not declared
$WRPG --request fixtures/request-claim-sets-overask.json        # 2  fail: a claim_sets alternative asks for birth_date
$WRPG --request fixtures/request-indeterminate.json             # 3  indeterminate: no claims list (policy)
$WRPG --request fixtures/request-unsupported-format.json        # 3  indeterminate: jwt_vc_json not supported
$WRPG --request fixtures/request-credential-sets-unsupported.json  # 3  indeterminate: an alternative uses ldp_vc
$WRPG --request fixtures/request-malformed-path.json            # 1  invalid input: negative path index
```
Add `--json` to any command for the machine-readable report. Dropping `--service`/`--intended-use` turns the first command into exit 3 (`MISSING_CONTEXT`).

`pnpm smoke` runs this table against the compiled binary and checks every exit code.

On Windows PowerShell, call `node packages/cli/dist/bin.js check ...` directly instead of the `$WRPG` variable.
