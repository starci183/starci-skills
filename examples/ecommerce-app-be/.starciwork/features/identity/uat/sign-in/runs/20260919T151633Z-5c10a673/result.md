# Register a pair, be refused alike on a wrong one, sign in

Flow: `uat.identity.sign-in`  Run: `20260919T151633Z-5c10a673`  Outcome: pass

## Steps walked
- `register-pair` (2026-09-19T15:16:35.407Z -> 2026-09-19T15:16:37.494Z)
- `wrong-pair-uniform-refusal` (2026-09-19T15:16:37.539Z -> 2026-09-19T15:16:38.152Z)
- `missing-half-refused` (2026-09-19T15:16:38.229Z -> 2026-09-19T15:16:38.850Z)

## Assertions
- `loading`: expected yes, observed yes - The register submit relabelled to "Registering…" and disabled itself while the request was in flight (SessionForm working state).
- `completion`: expected yes, observed yes - After one POST /api/session (mode=register), the account page re-rendered server-side and shows "Signed in as uat-person-20260919t151633z-5c10a673@ecommerce.dev." with the Sign out action - the registered pair signed the person in.
- `fr.identity.sign-in`: expected yes, observed yes - Register ran the identity register door then signIn behind it; the opaque bearer landed in the httpOnly northwind-session cookie and the server render verified it to this person.
- `errorFeedback`: expected yes, observed yes - The wrong pair was refused with HTTP 401 (INVALID_CREDENTIALS) and the form rendered one role="alert" line: "That email and password did not open a session.".
- `br.identity.sign-in`: expected yes, observed yes - Wrong-password-on-known-email and any-password-on-unknown-email both answered 401 INVALID_CREDENTIALS and rendered the identical refusal "That email and password did not open a session." - indistinguishable, naming neither half (ac.identity.sign-in.wrong-pair-is-refused-alike).
- `validation`: expected yes, observed yes - With the password empty the submit stayed disabled; Enter and a forced click produced zero POST /api/session calls - refused before the credential check, exactly as fr.identity.sign-in's exception flow states.
- `errorFeedback`: expected yes, observed yes - Re-registering uat-person-20260919t151633z-5c10a673@ecommerce.dev answered 409 EMAIL_TAKEN and the form rendered the conflict refusal "That email already has an account — sign in instead.".

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.