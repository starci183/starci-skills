# Two events settle into one digest, then an unsubscribe silences the next one

Flow: `uat.notify.digest-and-unsubscribe`  Run: `20260919T143409Z-5c10a673`  Outcome: fail

## Steps walked
- `owner-signed-in` (2026-09-19T14:34:10.486Z -> 2026-09-19T14:34:10.840Z)
- `preferences-reachable` (2026-09-19T14:34:10.892Z -> 2026-09-19T14:34:11.171Z)
- `two-events-one-window` (2026-09-19T14:34:11.202Z -> 2026-09-19T14:34:11.770Z)
- `digest-flushes-one-message` (2026-09-19T14:34:11.809Z -> 2026-09-19T14:35:15.780Z)
- `unsubscribed-in-preferences` (2026-09-19T14:35:15.838Z -> 2026-09-19T14:35:16.016Z)
- `third-event-suppressed` (2026-09-19T14:35:16.068Z -> 2026-09-19T14:35:16.559Z)
- `cleaned-up` (2026-09-19T14:35:16.606Z -> 2026-09-19T14:35:17.906Z)

## Assertions
- `ux.notify.preferences.reachable`: expected yes, observed yes - The signed-in owner reached /notify/preferences and the screen settled into a real state (not loading, not refused) - the record's step-1 expectation.
- `br.notify.digest.window`: expected yes, observed yes - Both task completions landed as notify_notifications rows sharing one digest_group_id (48090bf5-07b4-4df2-8ad8-b999afd3ca79) - the second event joined the still-open window the first one opened. Read back from the stack's own Postgres because the product exposes no notifications query.
- `fr.notify.digest`: expected yes, observed yes - The shared window (48090bf5-07b4-4df2-8ad8-b999afd3ca79) flushed once after its 1-minute close and the real scheduler dispatched both members as ONE batch (DeliveryService.dispatchBatch renders a single message per flushed group - "2 updates" naming both tasks). Read back from Postgres: one window, one flush, one batch.
- `ux.notify.inbox-arrival`: expected yes, observed not-run - The record's step 3 asks to read the owner's inbox and see the one message. The product's only inbox is the person's external email mailbox: no in-app inbox UI exists and this stack has no reachable SMTP host (integration.notify.smtp / gap.notify.smtp-host-unreachable), so the rendered message was dispatched, refused transiently by the transport, and never arrived anywhere a walk could read. Per the owner directive, external-provider legs are never faked; this leg stays unproven.
- `fr.notify.unsubscribe`: expected yes, observed no - The screen unsubscribed but the API read-back disagrees ({"notificationPreferences":{"channel":"email","unsubscribed":true,"digestWindowMinutes":1}}).
- `br.notify.unsubscribe.honored`: expected yes, observed yes - The third event was recorded (its notify_notifications row exists) but its delivery attempt was created already suppressed with failure_class=unsubscribed and attempt=0 - no dispatch was ever made, so no message could have arrived. That is the provable form of the record's step 6 ("no new message arrives") given that no reachable inbox exists.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.