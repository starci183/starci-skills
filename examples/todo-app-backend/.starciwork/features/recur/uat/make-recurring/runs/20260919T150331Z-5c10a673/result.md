# Make a task recurring, see its upcoming occurrences, then end it

Flow: `uat.recur.make-recurring`  Run: `20260919T150331Z-5c10a673`  Outcome: fail

## Steps walked
- `owner-signed-in` (2026-09-19T15:03:32.305Z -> 2026-09-19T15:03:32.634Z)
- `task-created` (2026-09-19T15:03:32.669Z -> 2026-09-19T15:03:32.790Z)
- `rule-made-active` (2026-09-19T15:03:32.832Z -> 2026-09-19T15:03:33.000Z)
- `upcoming-preview-weekdays-only` (2026-09-19T15:03:33.030Z -> 2026-09-19T15:03:33.051Z)
- `generation-tick-materialised` (2026-09-19T15:03:33.082Z -> 2026-09-19T15:05:03.596Z)
- `occurrence-complete-attempted` (2026-09-19T15:05:03.638Z -> 2026-09-19T15:05:03.802Z)
- `rule-ended-history-preserved` (2026-09-19T15:05:03.861Z -> 2026-09-19T15:05:03.980Z)
- `no-new-occurrence-after-end` (2026-09-19T15:05:04.022Z -> 2026-09-19T15:10:25.027Z)
- `cleanup-run-owned-rows` (2026-09-19T15:10:25.070Z -> 2026-09-19T15:10:26.449Z)

## Assertions
- `fr.recur.make-recurring`: expected yes, observed yes - The weekday/09:00 form submission created rule e48d3b93-13aa-469c-8ae0-2db3502e50f2 and the screen moved to the active state ("Repeats every weekday at 09:00 ... starting 2026-09-18") with an End rule action.
- `fr.recur.see-upcoming`: expected yes, observed yes - The upcoming card lists 10 live-computed preview date(s) (2026-09-21, 2026-09-22, 2026-09-23, 2026-09-24, 2026-09-25, 2026-09-28, 2026-09-29, 2026-09-30, 2026-10-01, 2026-10-02); none of them is a Saturday or Sunday.
- `br.recur.occurrence.owned-by-rule-owner`: expected yes, observed no - Step 5 of this record ("complete that occurrence ... its status becomes completed") has no door in the served product: the schedule screen's occurrence rows are read-only (StaticStateRow, no action), the public GraphQL schema registers no completeOccurrence/skipOccurrence mutation (OccurrenceService.complete exists but is internal CQRS only), and completing the occurrence's backing task row through the task list set tasks.complete yet left the occurrence's own status reading "materialised" on this ended screen - the app cannot produce the designed outcome.
- `br.recur.ending.preserves-history`: expected yes, observed yes - After ending, the upcoming card kept all 1 materialised row(s) (status shown: materialised) and shows no preview ("Nothing upcoming" + the ended note). The completed/skipped-preservation half of the rule stays unproven here because no completed occurrence could be produced - see the missing complete door above.
- `br.recur.generation.once`: expected yes, observed yes - 1 occurrence(s) materialised for the covered window; a re-read across the next tick boundary still shows exactly 1 row(s) for rule e48d3b93-13aa-469c-8ae0-2db3502e50f2 - no second occurrence was written for any already-covered date.
- `fr.recur.end-rule`: expected yes, observed yes - The rule ended through the screen's own two-step confirm; endRecurrence's response named rule e48d3b93-13aa-469c-8ae0-2db3502e50f2 (this run's rule); the ended state shows no preview ("Nothing upcoming" + the ended note) and the post-boundary re-read returned 1 materialised row(s), preview 0 - nothing dated after the end day was generated in-window.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.