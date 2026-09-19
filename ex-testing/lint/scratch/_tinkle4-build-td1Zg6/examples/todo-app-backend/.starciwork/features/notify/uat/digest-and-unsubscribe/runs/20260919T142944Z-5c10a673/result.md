# Two events settle into one digest, then an unsubscribe silences the next one

Flow: `uat.notify.digest-and-unsubscribe`  Run: `20260919T142944Z-5c10a673`  Outcome: pass

## Steps walked
- `owner-signed-in` (2026-09-19T14:29:45.257Z -> 2026-09-19T14:29:45.601Z)
- `preferences-reachable` (2026-09-19T14:29:45.668Z -> 2026-09-19T14:29:45.957Z)

## Assertions
- `ux.notify.preferences.reachable`: expected yes, observed yes - The signed-in owner reached /notify/preferences and the screen settled into a real state (not loading, not refused) - the record's step-1 expectation.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.