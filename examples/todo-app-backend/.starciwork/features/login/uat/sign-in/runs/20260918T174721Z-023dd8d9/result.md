# Sign in, close the browser, come back

Flow: `uat.login.sign-in`  Run: `20260918T174721Z-023dd8d9`  Outcome: pass

## Steps walked
- `empty` (2026-09-18T17:47:22.153Z -> 2026-09-18T17:47:22.191Z)
- `signed-in` (2026-09-18T17:47:22.260Z -> 2026-09-18T17:47:22.658Z)
- `task-list-after-sign-in` (2026-09-18T17:47:22.747Z -> 2026-09-18T17:47:22.767Z)
- `session-restores-on-reload` (2026-09-18T17:47:22.797Z -> 2026-09-18T17:47:22.875Z)
- `filled` (2026-09-18T17:47:22.951Z -> 2026-09-18T17:47:23.006Z)
- `working-and-refused` (2026-09-18T17:47:23.046Z -> 2026-09-18T17:47:23.172Z)

## Assertions
- `ux.sign-in.validation-feedback`: expected yes, observed yes - The submit button stays disabled while either field is empty (SignInFormView disabled logic).
- `ux.sign-in.lands-on-task-list`: expected yes, observed yes - Signing in navigates to /tasks on its own (useSignIn calls router.push after setToken); no manual navigation was needed.
- `fr.login.sign-in`: expected yes, observed yes - After landing on /tasks, the browser rendered data-state="many-tasks", matching a correctly-headed API read-back of demo@todo.dev's own 8 task(s).
- `br.login.session.restores`: expected yes, observed yes - The session token lives in localStorage, read back as an Authorization: Bearer header - never a cookie (the record's own step 3 wording now says this) - so reloading /tasks re-read it without re-authenticating; the list rendered data-state="many-tasks" after reload. This matches a correctly-headed API read-back of demo@todo.dev's own 8 task(s).
- `ux.sign-in.error-feedback`: expected yes, observed yes - form[data-state="refused"] renders a role="alert" message after the wrong-password submit.
- `br.login.password.sign-in`: expected yes, observed yes - The refusal text is the one normalized SIGN_IN_REFUSAL_MESSAGE regardless of which half of the pair was wrong (src/modules/api/auth.ts) - the same text an unknown email would produce.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.