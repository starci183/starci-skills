# Lane v9-2 — REPORT: uat.notify.digest-and-unsubscribe

Date: 2026-09-19. Scope: `examples/todo-app-frontend/uat/flows/uat.notify.digest-and-unsubscribe.spec.ts`
(the `test.skip` stub this lane was told to implement) + the notify feature's owning records under
`examples/todo-app-backend/.starciwork/features/notify/`. Read first: `v9/_common.md`, v9-3-REPORT.md
(the sibling inprogress/partial-settlement convention this lane follows), the two implemented specs and
`uat/lib/*.ts`.

## Verdict: partial live proof — run settles `partial-pass`, honestly

The brief's verify-first questions answered against the running product:

- **Notify inbox UI?** **No** — the product exposes no in-app notifications surface and no
  notifications query. The only "inbox" the flow's steps 3/6 can mean is the person's external email
  mailbox.
- **Preferences screen with unsubscribe?** Yes — `/notify/preferences` renders channel state and the
  real "Unsubscribe from email" action calls `unsubscribeFromEmailNotifications` over GraphQL.
- **Backend digest batching?** Yes — `DigestService.admit` joins an open rolling window per
  person/channel; `NotifyScheduler` (5s tick) dequeues `flush:<windowId>` from the real Redis queue;
  `DeliveryService.dispatchBatch` renders ONE message per flushed group.
- **Digest-window override?** Yes — per-preference `digestWindowMinutes` (the running demo preference
  was already `1`, the product minimum); the spec arms/reads/restores it through the real
  `updateNotificationPreferences`/`notificationPreferences` operations, not env or seeds.
- **Reachable SMTP host?** **No** — `integration.notify.smtp` is `todo`; the configured default
  `localhost:1025` refuses connections (`gap.notify.smtp-host-unreachable`). Dispatches go out for
  real and are refused transiently by the transport. No fake SMTP sink, no simulated delivery, per
  `_common.md`.

Because steps 3 and 6 ("read the owner's inbox", "no new message arrives") have no honest surface to
read, the record can settle at best `partial-pass` today — `inprogress`, not `done`.

## Stack — shared, not rebooted

FE :3000, BE :3001 `/health` ok, Keycloak :8089 realm `todo`, postgres `compose-postgres-1` :5432 db
`todo`, redis :6379 (real dispatch queue), minio :9000 — used as-is per `_common.md`. One repair the
brief's fallback permits: a concurrent lane ran `next build` under the running `next start`, leaving
the served `.next` incoherent (sign-in form never hydrated); the orphan on :3000 was stopped and
`next start -p 3000` restarted on the settled build.

Run env: `_common.md`'s (`UAT_LIVE_LOGIN_AUTHORIZED=true`, demo passwords, `UAT_BASE_URL=:3000`,
`UAT_API_BASE_URL=:3001`), plus `--output` pointed at a lane-private Playwright dir after a concurrent
lane's startup cleanup wiped the shared `todo-app-uat-raw` artifacts mid-run (see run 3 below).
Postgres read-backs go through `docker exec compose-postgres-1 psql` — the product exposes no
notifications query, so the stack's own database is the only honest read surface; nothing is written
through it except scoped cleanup of the run's own rows.

## Spec implemented — `uat.notify.digest-and-unsubscribe.spec.ts`

Seven walked steps, each a `walkStep` checkpoint with screenshot: owner sign-in (hydration-aware fill,
verified by `form[data-state="filled"]` + the real session response) → `/notify/preferences` settles
→ two run-namespaced tasks created and completed through the UI inside one digest window → poll the
real pipeline until the shared window flushes and both members dispatch as one batch → unsubscribe
through the preferences UI with server-state read-back → third task completed → its delivery attempt
born `suppressed`/`failure_class=unsubscribed`/`attempt=0` → cleanup: all three tasks deleted through
the UI's own two-step confirm, run-scoped notify rows removed, pre-run preference restored, every
deletion verified absent by read-back.

Assertions: `ux.notify.preferences.reachable`, `br.notify.digest.window` (shared digest_group_id),
`fr.notify.digest` (one window, one flush, one batch), `fr.notify.unsubscribe`, and
`br.notify.unsubscribe.honored` — all `yes`; `ux.notify.inbox-arrival` — `not-run`, naming the absent
inbox/SMTP leg. Outcome: **partial-pass**.

## Runs produced (append-only; four, all kept)

Under `features/notify/uat/digest-and-unsubscribe/runs/`:

1. `20260919T143409Z-5c10a673` — `Outcome: fail`. The walk ran end-to-end, but the spec's
   `readPreferences` returned the GraphQL envelope instead of the preference object, so
   `unsubscribed` read `undefined` (a false `no`) and the cleanup race skipped one task. The spec was
   fixed; the run is preserved untouched as honest history.
2. `20260919T144004Z-5c10a673` — `Outcome: partial-pass`. Read-back fixed; unsubscribe/suppression
   proved `yes`. But the digest window never flushed inside the 100s budget: the Redis dequeue is
   destructive (`ZRANGEBYSCORE`+`ZREM` in one EVAL — the job is consumed before the flush runs), so a
   transient failure drops the flush permanently. Recorded `not-run`, not retried into silence.
3. `20260919T144259Z-5c10a673` — `Outcome: fail`. All seven steps walked and every assertion recorded
   correctly (5 `yes` + the honest `not-run`), but a concurrent lane's Playwright startup wiped the
   shared `todo-app-uat-raw` output dir mid-run, so `browserContext.close` could not write
   trace/video → `result.status !== 'passed'` → `fail` (the run-writer's deliberate guard). Video
   lost; everything else intact. Preserved.
4. `20260919T144517Z-5c10a673` — **`Outcome: partial-pass` — the settling run.** Lane-private output
   dir, 1.1m, `1 passed`. 8 screenshots, real video
   (`videos/digest-and-unsubscribe.webm`, 1,470,781 B WebM), `cleanup.json` triplets fully closed:
   3 tasks + notify-pipeline rows created/deleted/verified-absent, preference restored
   (`unsubscribed:false`, `digestWindowMinutes:1` — confirmed by direct psql after the run).

### Disclosed repair — assertion id namespace

The spec initially emitted the ad-hoc inbox check as `uat.notify.digest-and-unsubscribe.inbox-arrival`
— an id in a *record-ref* family. The work gate collects every family-prefixed string in every yaml
under `.starciwork` and refuses dangling refs, so all four run manifests refused. The harness's
sanctioned namespace for unowned UX observations is `ux.*` (sibling runs carry
`ux.plan.create-refusal-feedback`, `ux.notify.preferences.reachable`). The id was renamed to
`ux.notify.inbox-arrival` in the spec and, in place, in the four runs' `manifest.yaml`,
`ux-checks.json`, `readback.json` and `result.md`. This is a mechanical namespace repair of a
generator bug in this lane's own uncommitted output: no step, screenshot, video, observed value or
outcome was altered — every assertion's `expected`/`observed`/`note` is byte-identical. Runs remain
otherwise append-only; the earlier `fail`/`partial-pass` verdicts stand untouched.

## Records changed

- `notify/uat/digest-and-unsubscribe/index.yaml` — `state: inprogress` (product legs proven live;
  `done` impossible while steps 3/6 have no inbox surface to read). `blockedBy` reworded: the
  `fr.notify.on-new-device` edge records that the walk answered its open question (task completions
  are the honest trigger the steps leave unnamed); the `gap.notify.live-proof` edge names the run and
  the single not-run leg. `change` rev 3.
- `notify/uat/digest-and-unsubscribe/evidence.yaml` — NEW, hand-written per the v9-3 convention:
  names run `20260919T144517Z-5c10a673`, `outcome: partial-pass`, video sha256, provenance
  (stack/authorization/observed_effect/recording). It does not settle the record as done.
- `notify/gap/live-proof/index.yaml` — stays `todo`; title + folded `statement` narrowed from "never
  executed" to exactly the inbox-arrival leg (no in-app inbox; no reachable SMTP host — owned by
  `integration.notify.smtp` / `gap.notify.smtp-host-unreachable`). `change` rev 3.
- `notify/integration/smtp`, `notify/gap/smtp-host-unreachable` — unchanged; they already own the
  missing provider leg precisely.

## Gate

`node scripts/check-example-work.mjs`: **334 records, 8 refused** — all in other lanes' families (six
ec `ui/*/assets` id-less files; two `recur` evidence digests gone stale while the recur lane's own
run was in flight). Zero refusals touch `notify/**`, the new run folders, or any record this lane
edited — the four manifest refusals this lane briefly introduced were cleared by the disclosed
namespace repair above.

## What remains for a future lane

1. A reachable dev SMTP host (or an in-app inbox surface) so the record's steps 3/6 can be walked for
   real — then `uat.notify.digest-and-unsubscribe` can re-run to `Outcome: pass` and flip `done`,
   closing `gap.notify.live-proof`. Until then the inbox-arrival leg stays `not-run`, never faked.
2. Reliability look: the dispatch queue's dequeue is destructive — a flush job consumed before its
   work runs is never retried (observed once, run `20260919T144004Z`). Worth a `br`/`gap` if it
   reproduces.
3. Fleet hygiene: lanes share `todo-app-uat-raw` as Playwright's `outputDir`; a concurrent run's
   startup cleanup wipes `.playwright-artifacts-*` under live contexts (observed, run
   `20260919T144259Z`). Lane-private `--output` dirs avoid it.
