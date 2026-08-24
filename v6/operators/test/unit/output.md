# Unit Test output

Validate with `validate-output.mjs` before routing.

- Pass: `test.e2e / ready` with `unit-pass` and `unit-evidence`.
- Assertion or coverage failure: `code.repair / repair` with `unit-failed` and `in-boundary-repair`.
- Missing harness, command authority, or executable environment: `test.review / blocked` with `unit-blocked`.

A pass requires at least one selected and passed test, zero failed tests, zero skipped target tests, one command receipt, and a durable evidence reference.
