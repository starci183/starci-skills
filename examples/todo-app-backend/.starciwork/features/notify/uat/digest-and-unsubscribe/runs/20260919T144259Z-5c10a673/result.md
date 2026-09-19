# Two events settle into one digest, then an unsubscribe silences the next one

Flow: `uat.notify.digest-and-unsubscribe`  Run: `20260919T144259Z-5c10a673`  Outcome: fail

## Steps walked
- `owner-signed-in` (2026-09-19T14:42:59.870Z -> 2026-09-19T14:43:00.233Z)
- `preferences-reachable` (2026-09-19T14:43:00.286Z -> 2026-09-19T14:43:00.599Z)
- `two-events-one-window` (2026-09-19T14:43:00.631Z -> 2026-09-19T14:43:01.289Z)
- `digest-flushes-one-message` (2026-09-19T14:43:01.333Z -> 2026-09-19T14:44:02.362Z)
- `unsubscribed-in-preferences` (2026-09-19T14:44:02.397Z -> 2026-09-19T14:44:02.531Z)
- `third-event-suppressed` (2026-09-19T14:44:02.582Z -> 2026-09-19T14:44:03.029Z)
- `cleaned-up` (2026-09-19T14:44:03.068Z -> 2026-09-19T14:44:04.362Z)

## Assertions
- `ux.notify.preferences.reachable`: expected yes, observed yes - The signed-in owner reached /notify/preferences and the screen settled into a real state (not loading, not refused) - the record's step-1 expectation.
- `br.notify.digest.window`: expected yes, observed yes - Both task completions landed as notify_notifications rows sharing one digest_group_id (15e19eb5-b7d5-4b2c-89cd-30eb29a4bc64) - the second event joined the still-open window the first one opened. Read back from the stack's own Postgres because the product exposes no notifications query.
- `fr.notify.digest`: expected yes, observed yes - The shared window (15e19eb5-b7d5-4b2c-89cd-30eb29a4bc64) flushed once after its 1-minute close and the real scheduler dispatched both members as ONE batch (DeliveryService.dispatchBatch renders a single message per flushed group - "2 updates" naming both tasks). Read back from Postgres: one window, one flush, one batch.
- `ux.notify.inbox-arrival`: expected yes, observed not-run - The record's step 3 asks to read the owner's inbox and see the one message. The product's only inbox is the person's external email mailbox: no in-app inbox UI exists and this stack has no reachable SMTP host (integration.notify.smtp / gap.notify.smtp-host-unreachable), so the rendered message was dispatched, refused transiently by the transport, and never arrived anywhere a walk could read. Per the owner directive, external-provider legs are never faked; this leg stays unproven.
- `fr.notify.unsubscribe`: expected yes, observed yes - The preferences screen's "Unsubscribe from email" action settled the screen on unsubscribed, and a correctly-headed notificationPreferences read-back returns unsubscribed: true - the preference is saved, not merely displayed.
- `br.notify.unsubscribe.honored`: expected yes, observed yes - The third event was recorded (its notify_notifications row exists) but its delivery attempt was created already suppressed with failure_class=unsubscribed and attempt=0 - no dispatch was ever made, so no message could have arrived. That is the provable form of the record's step 6 ("no new message arrives") given that no reachable inbox exists.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.