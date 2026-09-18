# Sign in, close the browser, come back

Flow: `uat.login.sign-in`  Run: `20260918T061141Z-af3dfbbc`  Outcome: **partial-pass**

## Steps walked
- `empty` (2026-09-18T06:11:44.810Z -> 2026-09-18T06:11:44.877Z)
- `filled` (2026-09-18T06:11:44.943Z -> 2026-09-18T06:11:45.010Z)
- `working-and-refused` (2026-09-18T06:11:45.060Z -> 2026-09-18T06:11:55.074Z)

## Assertions
- `ux.sign-in.validation-feedback`: expected yes, observed yes - The submit button stays disabled while either field is empty (SignInFormView disabled logic).
- `fr.login.sign-in`: expected yes, observed not-run - A successful sign-in writes a session row to the shared, other-lane-owned Postgres. This lane is authorized only for the read-only wrong-password check below, so this step is not-run here.
- `br.login.session.restores`: expected yes, observed not-run - Depends on the real signed-in session from fr.login.sign-in above; not-run for the same reason.
- `ux.sign-in.error-feedback`: expected yes, observed not-run - No response observed from /auth/sign-in within the timeout; the API origin did not answer.
- `br.login.password.sign-in`: expected yes, observed not-run - Same reason: no backend response to compare against a normalized refusal message.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.