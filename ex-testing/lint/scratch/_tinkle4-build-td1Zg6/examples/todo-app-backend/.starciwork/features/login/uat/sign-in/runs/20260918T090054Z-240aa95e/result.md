# Sign in, close the browser, come back

Flow: `uat.login.sign-in`  Run: `20260918T090054Z-240aa95e`  Outcome: pass

## Steps walked
- `empty` (2026-09-18T09:00:56.228Z -> 2026-09-18T09:00:56.280Z)
- `signed-in` (2026-09-18T09:00:56.378Z -> 2026-09-18T09:00:56.792Z)
- `task-list-after-sign-in` (2026-09-18T09:00:56.941Z -> 2026-09-18T09:00:56.975Z)
- `session-restores-on-reload` (2026-09-18T09:00:57.037Z -> 2026-09-18T09:00:57.139Z)
- `filled` (2026-09-18T09:00:57.235Z -> 2026-09-18T09:00:57.320Z)
- `working-and-refused` (2026-09-18T09:00:57.387Z -> 2026-09-18T09:00:57.555Z)

## Assertions
- `ux.sign-in.validation-feedback`: expected yes, observed yes - The submit button stays disabled while either field is empty (SignInFormView disabled logic).
- `ux.sign-in.lands-on-task-list`: expected yes, observed yes - Signing in navigates to /tasks on its own (useSignIn calls router.push after setToken); no manual navigation was needed.
- `fr.login.sign-in`: expected yes, observed yes - After landing on /tasks, the browser rendered data-state="empty", matching a correctly-headed API read-back of demo@todo.dev's own 0 task(s).
- `br.login.session.restores`: expected yes, observed yes - The session token lives in localStorage, read back as an Authorization: Bearer header - never a cookie (the record's own step 3 wording now says this) - so reloading /tasks re-read it without re-authenticating; the list rendered data-state="empty" after reload. This matches a correctly-headed API read-back of demo@todo.dev's own 0 task(s).
- `ux.sign-in.error-feedback`: expected yes, observed yes - form[data-state="refused"] renders a role="alert" message after the wrong-password submit.
- `br.login.password.sign-in`: expected yes, observed yes - The refusal text is the one normalized SIGN_IN_REFUSAL_MESSAGE regardless of which half of the pair was wrong (src/modules/api/auth.ts) - the same text an unknown email would produce.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.