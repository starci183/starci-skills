# Register a pair, be refused alike on a wrong one, sign in

Flow: `uat.identity.sign-in`  Run: `20260919T152145Z-5c10a673`  Outcome: pass

## Steps walked
- `register-pair` (2026-09-19T15:21:47.213Z -> 2026-09-19T15:21:49.298Z)
- `wrong-pair-uniform-refusal` (2026-09-19T15:21:49.347Z -> 2026-09-19T15:21:50.147Z)
- `missing-half-refused` (2026-09-19T15:21:50.237Z -> 2026-09-19T15:21:50.879Z)
- `taken-email-conflict` (2026-09-19T15:21:50.940Z -> 2026-09-19T15:21:52.983Z)
- `second-sign-in-new-session` (2026-09-19T15:21:53.039Z -> 2026-09-19T15:21:53.502Z)

## Assertions
- `loading`: expected yes, observed yes - The register submit relabelled to "Registering…" and disabled itself while the request was in flight (SessionForm working state).
- `completion`: expected yes, observed yes - After one POST /api/session (mode=register), the account page re-rendered server-side and shows "Signed in as uat-person-20260919t152145z-5c10a673@ecommerce.dev." with the Sign out action - the registered pair signed the person in.
- `fr.identity.sign-in`: expected yes, observed yes - Register ran the identity register door then signIn behind it; the opaque bearer landed in the httpOnly northwind-session cookie and the server render verified it to this person.
- `errorFeedback`: expected yes, observed yes - The wrong pair was refused with HTTP 401 (INVALID_CREDENTIALS) and the form rendered one role="alert" line: "That email and password did not open a session.".
- `br.identity.sign-in`: expected yes, observed yes - Wrong-password-on-known-email and any-password-on-unknown-email both answered 401 INVALID_CREDENTIALS and rendered the identical refusal "That email and password did not open a session." - indistinguishable, naming neither half (ac.identity.sign-in.wrong-pair-is-refused-alike).
- `validation`: expected yes, observed yes - With the password empty the submit stayed disabled; Enter and a forced click produced zero POST /api/session calls - refused before the credential check, exactly as fr.identity.sign-in's exception flow states.
- `errorFeedback`: expected yes, observed yes - Re-registering uat-person-20260919t152145z-5c10a673@ecommerce.dev answered 409 EMAIL_TAKEN and the form rendered the conflict refusal "That email already has an account — sign in instead.".
- `fr.identity.sign-in`: expected yes, observed yes - After the EMAIL_TAKEN conflict the original pair still signed in; the account page shows the same person again.
- `ac.identity.sign-in.known-pair-issues-a-session-token`: expected yes, observed yes - The second sign-in set a different bearer than the first (ac.identity.sign-in.known-pair-issues-a-session-token); the verify door read the new bearer back live for personId 34b04f4f-a2d2-426b-a985-d79c4e167ca7 - the same person the account page keeps showing.
- `completion`: expected yes, observed yes - The account page again shows "Signed in as uat-person-20260919t152145z-5c10a673@ecommerce.dev." under the fresh session; session-3 stays live until the identity TTL (the walk's declared end state, per the record's cleanup note).

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.