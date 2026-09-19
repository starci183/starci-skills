# Two events settle into one digest, then an unsubscribe silences the next one

Flow: `uat.notify.digest-and-unsubscribe`  Run: `20260919T142930Z-5c10a673`  Outcome: inconclusive

## Steps walked
- (none reached)

## Assertions
- `br.notify.digest.window`: expected yes, observed not-run - Every step needs a real session and real task completions on the shared, other-lane-owned Postgres; this lane is not authorized to create them, so this flow is not attempted in this environment.
- `fr.notify.digest`: expected yes, observed not-run - Every step needs a real session and real task completions on the shared, other-lane-owned Postgres; this lane is not authorized to create them, so this flow is not attempted in this environment.
- `fr.notify.unsubscribe`: expected yes, observed not-run - Every step needs a real session and real task completions on the shared, other-lane-owned Postgres; this lane is not authorized to create them, so this flow is not attempted in this environment.
- `br.notify.unsubscribe.honored`: expected yes, observed not-run - Every step needs a real session and real task completions on the shared, other-lane-owned Postgres; this lane is not authorized to create them, so this flow is not attempted in this environment.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.