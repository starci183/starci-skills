# Lane v4-3 — todo-be E2E verification + residual fixes

Scope: `examples/todo-app-backend/**` only. Date: 2026-09-19.

## Final counts

| Check | Result |
|---|---|
| `npx eslint src` | 0 errors, 0 warnings |
| `npx tsc --noEmit` | clean |
| `npx jest` (unit) | **117/117 suites, 701 tests — all green** |
| `npx jest --config src/tests/e2e/jest.config.ts` | **13/13 specs — all green** (~390 s) |

E2E spec results (final full run):

- `resilience/infra-recovery` — PASS (24.7 s; was the remaining failure)
- `resilience/teardown-verification` — PASS
- `auth/sign-in` — PASS
- `session/sign-out`, `session/session-expiry` — PASS
- `task/task-lifecycle`, `task/task-isolation` — PASS
- `share/share-journey` — PASS
- `plan/plan-journey` — PASS
- `recur/recurrence-lifecycle` — PASS
- `notify/notify-preferences` — PASS
- `audit/erasure-journey`, `audit/export-and-log` — PASS

The six `errors[0].extensions.code` assertions (`TASK_FORBIDDEN_EXCEPTION` & friends) pass inside the journey specs — the `formatError` passthrough was already correct in source; see root cause 1.

No docker leftovers after the run (`docker ps -a`/`volume ls` filtered on `todo-e2e` empty; `teardown-verification` also asserts this per spec).

## Root causes found and fixed

### 1. Stale `dist/` — the api child ran code the tree no longer contained

`E2EStackService.startApi()` spawns `dist/main.js`, but nothing ensured `dist` was fresh.
`dist/main.js` was ~10 h older than 500 `src/**/*.ts` files — the entire previous lane
(ping deadline, `formatError` code passthrough, module-boundary refactor) never reached the
artifact the e2e suite actually executes. This explains why both expected-fix groups still
failed on the first verification run.

**Fix** (`src/tests/infra/platform/stack/e2e-stack.service.ts`): added `ensureApiBuild()` at the
top of `boot()`. It compares the newest mtime of the sources `tsconfig.build.json` compiles
(`src/**/*.ts` minus `*.spec.ts`) against `dist/main.js`; when dist is stale or absent it runs
the same two steps `npm run build` runs (`typescript/bin/tsc -p tsconfig.build.json`, then
`tsc-alias -p tsconfig.build.json`) via `spawnSync(process.execPath, …)` — shell-free, so it
works on Windows without `npx`/cmd. A compile failure aborts boot with the tsc output instead
of an api that never answers `/health`. Cost when fresh: one directory walk (~ms); the rebuild
runs once per jest invocation, on the first spec's boot.

### 2. Api crashed on postgres kill — unhandled `error` events on the pg pool (the real residual defect)

`PostgresPrimaryClient`'s `new Pool(…)` had **no `'error'` listener**. On `docker kill postgres`
every idle client socket dies → pg-pool's `idleListener` re-emits on the pool → Node throws
`Unhandled 'error' event` → the api **process exited**. That is why `/health` never answered
503 — there was nothing left to answer. Evidence: `api.log` tail showed
`throw er; // Unhandled 'error' event` → `Error: Connection terminated unexpectedly` →
`Emitted 'error' event on BoundPool instance at: … pg-pool/index.js:62` → `Node.js v25.2.1`.
TypeORM's own driver already attaches `pool.on("error", poolErrorHandler)` for exactly this
reason; our hand-rolled pool did not.

**Fix** (`primary.client.ts`, `primary.module.ts`, `log-events.ts`): inject `WinstonService`,
attach `pool.on("error", …)` that logs `postgresql-primary.pool.idle-client-error`
(new `LogEvent` member) — observation only; the pool evicts the dead client itself and the next
`ping()` decides health on its own. `WinstonService` added to `PostgresqlPrimaryModule` providers.

### 3. Same crash one level down — checked-out clients have no `error` listener at all

pg-pool `removeListener('error', idleListener)` runs on checkout (`pg-pool/index.js:344`), so a
socket that dies while checked out (e.g. a `SELECT 1` probe in flight during the kill) emits
`'error'` with zero listeners → same process crash. The second crash in `api.log` was exactly
this (`pg/lib/client.js:204` → `_handleErrorEvent` → `emit('error')` → throw).

**Fix** (`primary.client.ts`): `pool.on("connect", client => client.on("error", () => undefined))`
— a per-client guard armed for the client's whole life. It does not hide anything: an in-flight
query still receives the same error through its own callback (ping still rejects → 503), and
idle deaths still reach the pool listener → logged once.

### 4. Unhandled rejection from the fire-and-forget recur tick

`SchedulerService`'s cron callback does `void this.onTick()`; `onTick → runOnce →
ruleService.listActive()` is a TypeORM query against the primary database. In e2e the tick is
`* * * * * *` (every second), so during an outage the rejection would escape as an unhandled
rejection → process crash — a second, independent way for the api to die before answering 503.

**Fix** (`scheduler.service.ts`, `log-events.ts`): `void this.onTick().catch(reason =>
winston.log(LogEvent.RECUR_GENERATION_TICK_FAILED, { reason }))`. `onTick`'s own contract is
unchanged (direct callers still see the rejection); the containment lives at the
fire-and-forget site. Verified live: `api.log` for the passing run shows
`recur.generation-tick.failed` logged during the outage instead of a crash.

### 5. Same fire-and-forget exposure in the notify dispatch loop (hardened for parity)

`NotifyScheduler`'s interval does `void this.notify.runDueJobs(…)`; `runDueJobs` touches pg
(`digest.flush`, `dedupe.findByDigestGroup`) whenever a flush/retry job is due. Not triggered by
this particular scenario (queue empty at kill time), but identical crash class in the same blast
radius — fixed the same way: `WinstonService` injected, `.catch` logs
`notify.dispatch-tick.failed`, `WinstonService` added to `NotifyModule` providers.

## Files changed

- `src/tests/infra/platform/stack/e2e-stack.service.ts` — `ensureApiBuild()` + `newestSourceMtimeMs`
- `src/modules/platform/databases/postgresql/primary/primary.client.ts` — pool `error`/`connect` listeners, `WinstonService`
- `src/modules/platform/databases/postgresql/primary/primary.module.ts` — `WinstonService` provider
- `src/modules/platform/logging/log-events.ts` — 3 new event names
- `src/modules/bussiness/recur/scheduler.service.ts` — tick rejection containment
- `src/modules/bussiness/notify/notify.scheduler.ts` — `WinstonService` + rejection containment
- `src/modules/bussiness/notify/notify.module.ts` — `WinstonService` provider
- Specs updated for the new DI/behavior (no assertions weakened, nothing skipped):
  `primary.client.spec.ts` (pool mock gains `on`; +3 specs covering listener registration,
  per-client guard arming, winston routing),
  `notify.scheduler.spec.ts` (`WinstonService` provider; +1 spec proving a rejecting tick is contained).

## Notes / residual observations (not defects of this lane)

- First `npx jest` run: 4 suites failed on transient worker conditions under ~27 parallel
  workers (2× V8 OOM in ts-jest workers, 2× transient `Cannot find module` inside
  `node_modules` during worker startup). All 4 pass on a targeted retry and in the final full
  run — environmental (Windows FS/AV races + worker heap), not code. Worth watching if it recurs;
  a `--maxWorkers` cap or `NODE_OPTIONS=--max-old-space-size` would mitigate but was not needed.
- `api.log` shows a boot-time TypeORM `Unable to connect … Retrying (1)` with
  `QueryFailedError: duplicate key … pg_class_relname_nsp_index` — the named connection's
  migrations-table creation races its own second init (`TypeOrmCoreModule … initialized` logs
  twice); it self-recovers on retry and predates this lane. Harmless but worth a look in a
  future lane.
- Event subscribers (`audit-event.subscriber.ts`, `notify-event.subscriber.ts`) use the same
  `void this.<async>(…)` fire-and-forget pattern as the schedulers. Not exercised by
  infra-recovery (no domain events during the kill window) so left as-is; same containment
  pattern applies if a future spec produces events across an outage.
