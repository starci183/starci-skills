# Lane v9-4 — REPORT: `uat.recur.make-recurring` → real run produced; Outcome: fail (APP_CAPABILITY_MISSING on step 5)

Date: 2026-09-19. Scope: implement + run `examples/todo-app-frontend/uat/flows/uat.recur.make-recurring.spec.ts`
against the already-running fleet stack (todo BE :3001, FE :3000, keycloak :8089, postgres :5432).
Read first per brief: `v9/_common.md`, `v7-11-REPORT.md`, `v7-12-REPORT.md`, `uat/lib/*.ts`, sibling v9 reports.

## Verdict: the walk now exists and ran for real — it cannot pass because the product has no occurrence-completion door

Unlike v9-1 (no surface at all → no run), this lane's flow is walkable for five of six steps, so the
spec was implemented and executed. The settled evidence is `runs/20260919T150331Z-5c10a673/`
(`.starciwork/features/recur/uat/make-recurring/`): nine `walkStep` checkpoints with full-page
screenshots, a real 4.7 MB `.webm` video, a complete cleanup ledger, and `result.md` reading
`Outcome: fail`. The record stays `todo` — correctly, since the gate's concept-12 requires a passing
result.md for `done`.

## What the run proved (observed `yes`)

- `fr.recur.make-recurring` — weekday/09:00/owner-zone rule created through the real form
  (`e48d3b93-…`), screen moved to the active state.
- `fr.recur.see-upcoming` — ten live-computed preview dates, none a weekend.
- `br.recur.generation.once` — a real scheduler tick (the stack's own `*/5`-minute cron, ~90 s wait)
  materialised the covered date; a re-read across the next tick boundary showed exactly the same
  single occurrence — no double-write.
- `fr.recur.end-rule` — ended via the screen's own two-step confirm; the mutation response named the
  run's own ruleId; the ended state showed "Nothing upcoming" and the post-boundary re-read returned
  the materialised row with preview empty.
- `br.recur.ending.preserves-history` — the materialised row survived ending with its own status.

## What it proved CANNOT be produced (observed `no`) — the gap

`br.recur.occurrence.owned-by-rule-owner` leg of step 5 ("complete that occurrence … its status
becomes completed"): the served product has no door. The schedule screen's occurrence rows are
read-only (`StaticStateRow`); the public GraphQL schema registers no `completeOccurrence`/
`skipOccurrence` (`OccurrenceService.complete` exists but is internal CQRS, never mounted); and
completing the occurrence's backing task row through the task list sets `tasks.complete` but leaves
`occurrences.status = materialised` — observed live on the ended screen and confirmed in Postgres.
Until the product ships an occurrence-completion surface, no honest run can record `Outcome: pass`.

## Second defect the run surfaced

The record's `entry: /tasks/:taskId/schedule` is unserved — that route 404s, and the task list's
per-row "Schedule" link points at the same dead path. The surface that exists is
`/<lang>/recur?task=<task title>` (the contract binds a task by title, never by id). The walk uses
the served route; the divergence is named on `gap.recur.live-proof` for the owning workflow —
`ui.recur.schedule` (done) claims the dead route, so either that record or the app is wrong.

## Incidents handled inside the lane

- **Stale API process corrupted run 2's end leg.** The ts-node-dev API had not reloaded the recur
  module; its `endRecurrence(ruleId=172a408e…)` ended a different, already-ended foreign fixture
  (`e4a728d3`, a `live-proof-recur.sh` row) while the screen still flipped to "ended". The process
  respawned at 14:54Z; current code returns the targeted ruleId and empties the ended rule's preview
  (re-verified live). The spec now captures the mutation's ruleId so a wrong-rule end records `no`
  rather than hiding behind the UI state. Run folder `20260919T144405Z-5c10a673` is retained
  append-only with a `_NOTE.md` marking its two `no` verdicts as stale-process artifacts. Foreign-row
  check: the still-active `live-proof` rule `ec0de4d5` was never touched; the two ended ones were
  already ended by their own script runs (`orphanedCount: 0`, same `ended_at` date).
- **Harness bug fixed:** `run-writer.ts` computed `outcome` from recorded assertions only, ignoring
  `TestResult.status` — run 1 (`20260919T143618Z-5c10a673`) crashed at the completion attempt yet
  wrote `Outcome: pass`. The writer now forces `fail` when `result.status !== 'passed'`; the corrupt
  folder is retained append-only with a `_VOID.md`, its leaked rows cleaned by hand.
- **Checkbox interaction fix:** the task row's checkbox is controlled — `locator.check()` raced the
  mutation roundtrip. The spec now clicks and awaits the real `completeTask` response per row.

## Records changed

- `uat/flows/uat.recur.make-recurring.spec.ts` — real walk implemented (was a `test.skip` stub).
  Nine checkpoints; run-scoped title `uat-<runId>-recur`; second tab on the same context observes
  `/tasks` while the recur session stays mounted (the schedule screen holds the rule in session state
  and has no reload door).
- `uat/lib/run-writer.ts` — outcome guard (above).
- `features/recur/uat/make-recurring/index.yaml` — still `state: todo`; `blockedBy.because` rewritten
  (was "no run folder exists" — now false) to name the real blocker and the dead entry route.
- `features/recur/gap/live-proof/index.yaml` — rev 3 clarifying, still `todo`, `closedBy` unchanged;
  statement now names the missing occurrence-completion door (and the unserved entry route) instead of
  "spec is an unimplemented stub".

## Gate

`node scripts/check-example-work.mjs`: `337 record(s), 2841 ref(s), 123 evidence file(s)` —
zero refused, zero warned. Nothing in `recur/**` refuses.

## To unblock (named for the next lane, not assumed)

Step 5 needs an occurrence-completion surface: a `completeOccurrence`/`skipOccurrence` mutation wired
to the existing `OccurrenceService.complete` plus a control on the schedule screen (or a product
decision that `completeTask` syncs the occurrence row). Separately, the designed entry
`/tasks/:taskId/schedule` needs either the route built or `ui.recur.schedule`/the task-list link
corrected. Both are owning-workflow work; once they land, this spec walks unchanged to a passing run.

## Cleanup

Every run's rows were removed and verified absent (two UI deletions + id-scoped Postgres deletes per
run; three independent `SELECT count(*)` → 0). Probe rows from this lane's API probes likewise
deleted. No foreign row's state changed — verified above.
