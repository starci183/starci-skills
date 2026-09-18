# Sign in, close the browser, come back

Flow: `uat.login.sign-in`  Run: `20260918T080854Z-f7ab26f0`  Outcome: **fail**

## Steps walked
- `empty` (2026-09-18T08:08:54.887Z -> 2026-09-18T08:08:54.916Z)
- `signed-in` (2026-09-18T08:08:54.952Z -> 2026-09-18T08:08:55.077Z)
- `task-list-after-sign-in` (2026-09-18T08:08:55.132Z -> 2026-09-18T08:08:55.201Z)
- `session-restores-on-reload` (2026-09-18T08:08:55.229Z -> 2026-09-18T08:08:55.276Z)
- `filled` (2026-09-18T08:08:55.340Z -> 2026-09-18T08:08:55.385Z)
- `working-and-refused` (2026-09-18T08:08:55.431Z -> 2026-09-18T08:08:55.516Z)

## Assertions
- `ux.sign-in.validation-feedback`: expected yes, observed yes - The submit button stays disabled while either field is empty (SignInFormView disabled logic).
- `ux.sign-in.lands-on-task-list`: expected yes, observed no - Signing in does not navigate anywhere; this harness then navigated to /tasks by URL to keep walking the flow.
- `fr.login.sign-in`: expected yes, observed yes - After navigating to /tasks by URL, the browser rendered data-state="empty", matching a correctly-headed API read-back of demo@todo.dev's own 0 task(s).
- `br.login.session.restores`: expected yes, observed yes - The session token lives in localStorage, not a cookie - the record's own wording is stale against src/modules/session - so reloading /tasks re-read it without re-authenticating; the list rendered data-state="empty" after reload. This matches a correctly-headed API read-back of demo@todo.dev's own 0 task(s).
- `ux.sign-in.error-feedback`: expected yes, observed yes - form[data-state="refused"] renders a role="alert" message after the wrong-password submit.
- `br.login.password.sign-in`: expected yes, observed yes - The refusal text is the one normalized SIGN_IN_REFUSAL_MESSAGE regardless of which half of the pair was wrong (src/modules/api/auth.ts) - the same text an unknown email would produce.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.