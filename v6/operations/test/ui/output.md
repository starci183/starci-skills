# UI Test output

Validate with `validate-output.mjs` before routing.

- Pass: `proof.run / ready` with `ui-pass` and `ui-evidence`.
- Product code defect inside the approved direction: `code.repair / repair` with `ui-failed` and `in-boundary-repair`.
- Layout, ownership, responsive, or source-boundary drift: `layout.review / rejected` with `boundary-drift` and `layout-feedback-recorded`; Layout regenerates before reusing the existing approval checkpoint.
- App, browser, account, authentication, safe test data, or evidence unavailable: `test.review / blocked` with `ui-blocked`.

A pass requires every scenario to start from the visible app, use the test account as an ordinary user, cover all three viewport classes, and produce sanitized screenshots and trace evidence.
