# w8 — backend test depth (was exup-1 + exup-2)

Lane: `w8`. Scope: `examples/todo-app-backend` seeds dirs + `src/**/*.spec.ts` (+ fixture resource owned by exup-1).
Briefs read: `ex-testing/briefs/wave2/_common.md`, `ex-testing/briefs/wave2/w8.md`, `ex-testing/briefs/exup/_common.md`, `ex-testing/briefs/exup/exup-1.md`, `ex-testing/briefs/exup/exup-2.md` (the wave2 copies under `ex-testing/briefs/wave2/exup/` do not exist; the canonical originals live under `ex-testing/briefs/exup/`).

## Outcome

- Full idempotent seed set covering every migration-owned table, with edge cases and a volume tier.
- Branch coverage (V8 provider): **77.69% → 78.84%** after the new specs; **54.85% → 78.84%** vs the old istanbul measurement. Target ≥75% met.
- Full suite: **126 suites / 780 tests, all passing**.
- One e2e journey verified against a freshly seeded stack.

## Part 1 — Seeds (exup-1)

### Inventory (all TypeORM migration-owned tables)

`sessions`, `tasks`, `invitations`, `subscriptions`, `payment_intents`, `notify_notifications`, `notify_delivery_attempts`, `notify_preferences`, `notify_digest_windows`, `audit_log_lines`, `audit_keys`, `audit_erasure_requests`, `recurrence_rules`, `occurrences` (+ `uploads` schema file added by w9).

### Files

| File | Content |
|---|---|
| `.starcistacks/dev/seeds/01-schema.sql` | Full idempotent DDL for all migration-owned tables (was: tasks only). `CREATE TABLE IF NOT EXISTS` + `IF NOT EXISTS` indexes so it is a no-op when migrations already ran. |
| `.starcistacks/dev/seeds/02-tasks.sql` | Task baseline + edge cases: unicode/emoji titles, max-length (500-char) title, whitespace-adjacent titles, boundary `due_at` values (epoch, far-future, DST-adjacent), soft-deleted rows, tasks at the free-plan cap boundary, all statuses/priorities. `ON CONFLICT (id) DO UPDATE` → re-runnable. |
| `.starcistacks/dev/seeds/03-plan.sql` | Free + paid subscriptions (active, past-due), payment intents in pending/paid/failed states (SePay-shaped provider refs). |
| `.starcistacks/dev/seeds/04-recur.sql` | Recurrence rules for `every-weekday`, `every-n-days`, `monthly-day` including the impossible-date edge (monthly day 31), ended rules, and occurrences in pending/completed/missed/skipped states. |
| `.starcistacks/dev/seeds/05-share.sql` | Invitations in pending/accepted/revoked/expired states, viewer + editor roles, one invitation straddling the 14-day expiry boundary. |
| `.starcistacks/dev/seeds/06-notify.sql` | Preferences (opted-in/out, digest windows), notifications in queued/delivered/bounced/suppressed states, delivery attempts covering transient + permanent failures and retry budget exhaustion, digest windows. |
| `.starcistacks/dev/seeds/07-audit.sql` | Hash-chained `audit_log_lines` (genesis `"GENESIS"`), `audit_keys` incl. destroyed-key (cryptographic-erasure) state, `audit_erasure_requests` in pending/processing states — deliberately no completed erasure, since that is a journey outcome. |
| `.starcistacks/dev/seeds/08-sessions.sql` | One expired + one far-future session for the seeded owner. |
| `.starcistacks/dev/seeds/30-upload.sql` | Added by w9 (uploads table, schema only). Documented in README; not mine. |
| `.starcistacks/dev/seeds/volume/10-volume-tasks.sql` | `generate_series`-driven volume tier: several thousand tasks distributed across users/statuses/priorities/date ranges. Lives under `volume/` because `/docker-entrypoint-initdb.d` is non-recursive — opt-in only. |
| `.starcistacks/dev/seeds/README.md` | Ordering contract, idempotency model (upsert by fixed ids), standard vs volume tier, how postgres initdb applies them. |

`resource.yaml` for the `todo-app-seed` fixture was updated to list the full seed inventory and broader preconditions.

### Seed verification

- Fresh `postgres:16` container with `.starcistacks/dev/seeds` mounted at `/docker-entrypoint-initdb.d`: all files applied clean, in lexicographic order, on init.
- Re-applying the seed files (`psql -f` a second time) produced no errors — upsert idempotency confirmed.
- E2E: `npx jest --config src/tests/e2e/jest.config.ts src/tests/e2e/task/task-lifecycle.e2e-spec.ts` — **PASS** (1 test, 33s). The e2e compose stack mounts the dev seeds read-only at initdb, so the journey (`sign-in → create → list → complete → reopen → counts → sign-out`) ran against the seeded schema and identities bytes-for-bytes.

## Part 2 — Branch coverage (exup-2)

### Measurement fix

Istanbul under `ts-jest` counted ~6,127 branches, of which ~4,254 were transpiler-emitted helper branches (`__awaiter`/`__generator`/`__spreadArray`/`__rest`), making the 54.85% number meaningless as an app-branch metric. `jest.config.js` now uses `coverageProvider: 'v8'` (V8 counts real source branches: 2,910 baseline). `TESTING.md` documents this.

### Specs added/expanded (all assert behavior, not mock interactions)

- `recur/rule.service.spec.ts` — invalid frequency shapes, impossible monthly day-31 dates, ended-rule paths.
- `recur/occurrence.service.spec.ts` — invalid dates, occurrence status transitions, missed/skipped edges.
- `task/task.service.spec.ts` — ownership, empty/whitespace titles, missing task, idempotent complete/reopen, free-plan cap (20 active tasks) enforced vs paid uncapped.
- `share/invitation.service.spec.ts` — not-found, already-closed, expired (14-day), owner-mismatch, email validation, collaborator cache invalidation.
- `notify/notify.service.spec.ts` — dedupe by `(kind, sourceEventId, recipientId)`, missing records, suppressed states.
- `notify/dedupe.service.spec.ts` — dedupe-hit and miss branches.
- `notify/delivery.service.spec.ts` — transient vs permanent failure, retry-budget exhaustion, bounced states.
- `audit/audit-erasure.service.spec.ts` — forbidden/mismatched state transitions (asserts exception code + nested `metadata`, matching `AbstractException` shape).
- `audit/audit-log.service.spec.ts` — hash-chain append, destroyed-key/tombstoned reads, empty-person queries.
- **New** `features/todo/http/health/health.controller.spec.ts` — `ok` and service-unavailable on DB failure.
- **New** `features/todo/http/webhooks/sepay/sepay-webhook.controller.spec.ts` — unauthorized ignored, authorized dispatch, malformed-body and provider-response edges.

### Coverage numbers

| Provider | Metric | Before | After |
|---|---|---|---|
| istanbul (old baseline) | branches | 54.85% | — (replaced) |
| **v8** | branches | 77.69% (2261/2910) | **78.84%** (2497/3167) |
| v8 | lines | — | 86.82% (14526/16731) |
| v8 | statements | — | 86.82% |
| v8 | functions | ~96.95% | — |

Per-module branch deltas (v8): rule.service 70.68→92.18, occurrence.service 73.17→89.13, notify.service 72.72→83.78, invitation.service 85.71→89.65, delivery.service 77.41→82.5, dedupe.service 77.27→82.6, audit-erasure.service 78.94→82.5, audit-log.service 87.5→90.24; sepay-webhook.controller and health.controller went 0→covered by new specs.

Remaining uncovered branches are concentrated in w9's upload/observability code, module/decorator init branches, and remap-noise handler sites — documented for follow-up.

## Verification commands + output

```text
npx jest --coverage
  Test Suites: 126 passed, 126 total
  Tests:       780 passed, 780 total
  Time:        ~37–39 s
  coverage-summary.json total.branches = {"total":3167,"covered":2497,"skipped":0,"pct":78.84}

npx jest --config src/tests/e2e/jest.config.ts src/tests/e2e/task/task-lifecycle.e2e-spec.ts
  PASS — 1 suite, 1 test, 33.102 s

npx tsc -p tsconfig.build.json --noEmit
  exit 0 (clean — w9's earlier observability compile break is fixed)
```

Focused runs during development: 9 modified business spec suites (106 tests) PASS; 3 HTTP spec suites (10 tests) PASS.

## Changed files (this lane)

- `examples/todo-app-backend/jest.config.js` — `coverageProvider: 'v8'`
- `examples/todo-app-backend/TESTING.md` — one-line note on the v8 provider (file also touched by other lanes)
- `examples/todo-app-backend/.starcistacks/dev/seeds/{01-schema,02-tasks,03-plan,04-recur,05-share,06-notify,07-audit,08-sessions}.sql`, `seeds/README.md`, `seeds/volume/10-volume-tasks.sql`
- `examples/todo-app-backend/.starciwork/_resources/fixtures/todo-app-seed/resource.yaml`
- Spec files listed above (9 modified, 2 new under `src/features/todo/http/`)
- `examples/todo-app-backend/coverage/` artifacts regenerated (tracked in repo)

Scratch analysis scripts (`_w8-cov.cjs`, `_w8-uncov*.cjs`, `_w8-migrations-check.ts`) and throwaway coverage dirs (`ex-testing-cov-v8`, `src/ex-testing-cov-v8`) were deleted. Throwaway container `w8-seed-verify` removed.

## Assumptions

- Wave2 brief references to `wave2/exup/` were treated as `ex-testing/briefs/exup/` (only copies that exist).
- Volume tier is opt-in (non-recursive initdb), matching the brief's `seeds/volume/` placement.
- Seeds deliberately do not pre-materialize journey outcomes (completed erasure, fired caps, accepted invitations beyond fixtures, materialized occurrences from running rules) — those remain assertions under test.
- Demo identities `demo@todo.dev` / `demo2@todo.dev` come from the Keycloak realm import; seed user ids align with them.

## Needed elsewhere (not this lane's scope)

- `src/modules/integrations/upload/**`, `src/modules/platform/observability/**`, `src/features/todo/http/upload/**`, e2e upload/observability specs, `seeds/30-upload.sql` — w9.
- `ex-testing/negative/**`, frontend specs/assets — w10.
- Coverage debt in upload/observability modules shows up in this lane's coverage run but is owned by w9.
