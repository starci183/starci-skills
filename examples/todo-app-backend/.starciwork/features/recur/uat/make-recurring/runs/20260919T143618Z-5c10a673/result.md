# Make a task recurring, see its upcoming occurrences, then end it

Flow: `uat.recur.make-recurring`  Run: `20260919T143618Z-5c10a673`  Outcome: pass

## Steps walked
- `owner-signed-in` (2026-09-19T14:36:19.359Z -> 2026-09-19T14:36:19.781Z)
- `task-created` (2026-09-19T14:36:19.839Z -> 2026-09-19T14:36:19.956Z)
- `rule-made-active` (2026-09-19T14:36:20.003Z -> 2026-09-19T14:36:20.209Z)
- `upcoming-preview-weekdays-only` (2026-09-19T14:36:20.236Z -> 2026-09-19T14:36:20.259Z)
- `generation-tick-materialised` (2026-09-19T14:36:20.299Z -> 2026-09-19T14:40:01.032Z)

## Assertions
- `fr.recur.make-recurring`: expected yes, observed yes - The weekday/09:00 form submission created rule 240b86a4-f446-44dc-9ec1-5db8daa5fba8 and the screen moved to the active state ("Repeats every weekday at 09:00 ... starting 2026-09-18") with an End rule action.
- `fr.recur.see-upcoming`: expected yes, observed yes - The upcoming card lists 10 live-computed preview date(s) (2026-09-21, 2026-09-22, 2026-09-23, 2026-09-24, 2026-09-25, 2026-09-28, 2026-09-29, 2026-09-30, 2026-10-01, 2026-10-02); none of them is a Saturday or Sunday.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.