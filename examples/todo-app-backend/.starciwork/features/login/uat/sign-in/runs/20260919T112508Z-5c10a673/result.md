# Sign in, close the browser, come back

Flow: `uat.login.sign-in`  Run: `20260919T112508Z-5c10a673`  Outcome: pass

## Steps walked
- `empty` (2026-09-19T11:25:10.346Z -> 2026-09-19T11:25:10.416Z)
- `signed-in` (2026-09-19T11:25:10.509Z -> 2026-09-19T11:25:11.197Z)
- `task-list-after-sign-in` (2026-09-19T11:25:11.311Z -> 2026-09-19T11:25:11.320Z)
- `session-restores-on-reload` (2026-09-19T11:25:11.361Z -> 2026-09-19T11:25:11.457Z)
- `filled` (2026-09-19T11:25:11.546Z -> 2026-09-19T11:25:11.622Z)
- `working-and-refused` (2026-09-19T11:25:11.702Z -> 2026-09-19T11:25:11.829Z)

## Assertions
- `ux.sign-in.validation-feedback`: expected yes, observed yes - The submit button stays disabled while either field is empty (SignInFormView disabled logic).
- `ux.sign-in.lands-on-task-list`: expected yes, observed yes - Signing in navigates to /tasks on its own (useSignIn calls router.push after setToken); no manual navigation was needed.
- `fr.login.sign-in`: expected yes, observed yes - After landing on /tasks, the browser rendered data-state="empty", matching a correctly-headed API read-back of demo@todo.dev's own 0 task(s).
- `br.login.session.restores`: expected yes, observed yes - The session token lives in localStorage, read back as an Authorization: Bearer header - never a cookie (the record's own step 3 wording now says this) - so reloading /tasks re-read it without re-authenticating; the list rendered data-state="empty" after reload. This matches a correctly-headed API read-back of demo@todo.dev's own 0 task(s).
- `ux.sign-in.error-feedback`: expected yes, observed yes - form[data-state="refused"] renders a role="alert" message after the wrong-password submit.
- `br.login.password.sign-in`: expected yes, observed yes - The refusal text is the one normalized SIGN_IN_REFUSAL_MESSAGE regardless of which half of the pair was wrong (src/modules/api/auth.ts) - the same text an unknown email would produce.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.