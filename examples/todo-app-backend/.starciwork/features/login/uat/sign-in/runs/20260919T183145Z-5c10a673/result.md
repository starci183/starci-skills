# Sign in, close the browser, come back

Flow: `uat.login.sign-in`  Run: `20260919T183145Z-5c10a673`  Outcome: partial-pass

## Steps walked
- `empty` (2026-09-19T18:31:46.639Z -> 2026-09-19T18:31:46.669Z)
- `filled` (2026-09-19T18:31:46.745Z -> 2026-09-19T18:31:46.798Z)
- `working-and-refused` (2026-09-19T18:31:46.859Z -> 2026-09-19T18:31:56.871Z)

## Assertions
- `ux.sign-in.validation-feedback`: expected yes, observed yes - The submit button stays disabled while either field is empty (SignInFormView disabled logic).
- `fr.login.sign-in`: expected yes, observed not-run - A successful sign-in writes a session row to Postgres. UAT_LIVE_LOGIN_AUTHORIZED is not true in this environment, so this step is not-run here rather than attempted against infrastructure this run does not own.
- `br.login.session.restores`: expected yes, observed not-run - Depends on the real signed-in session from fr.login.sign-in above; not-run for the same reason.
- `ux.sign-in.error-feedback`: expected yes, observed not-run - No response observed from /graphql within the timeout; the API origin did not answer.
- `br.login.password.sign-in`: expected yes, observed not-run - Same reason: no backend response to compare against a normalized refusal message.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.