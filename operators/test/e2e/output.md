# E2E Test output

Validate with `validate-output.mjs` before routing.

- Pass: `test.ui / ready` with `e2e-pass` and `e2e-evidence`.
- Connected behavior failure: `code.repair / repair` with `e2e-failed` and `in-boundary-repair`.
- Unsafe data, stale services, unavailable environment, or incomplete cleanup: `test.review / blocked` with `e2e-blocked`.

A pass requires every declared scenario to execute and reset successfully, with observable business results rather than response-code-only assertions.
