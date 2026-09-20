# dev seeds

SQL seeds for the `todo` database. Mounted read-only into postgres'
`/docker-entrypoint-initdb.d` by `.starcistacks/dev/infra/compose/postgres.yaml`
(and by the e2e stack, `src/tests/infra/platform/stack/compose.e2e.yaml`), so the
`NN-*.sql` files run in alphabetical order on a fresh volume, before the api's own
`migrationsRun: true` boot.

## Layout

| file | contents |
|---|---|
| `01-schema.sql` | All 14 tables + indexes, statement-for-statement identical to the app's migrations. Lets data exist before the api first boots; migrations' `IF NOT EXISTS` clauses agree with it instead of fighting it. |
| `02-tasks.sql` | Baseline task rows plus edge cases: unicode/emoji titles, a 400-char max-length title, verbatim whitespace/quotes, a `completed_at` on a UTC day boundary, and the plan-cap boundary owners (`uat-cap-below` 19 open, `uat-cap-at` 20 open = free cap, `uat-paid` 25 open on paid). |
| `03-plan.sql` | Subscriptions (free / active paid / past-due) and payment intents in each status (pending / paid / failed). |
| `04-recur.sql` | Recurrence rules for all three frequencies plus calendar edges: `monthly-day` 31, a leap-day `start_date`, DST-crossing (`America/New_York`) and earliest-clock (`Pacific/Kiritimati`, UTC+14) time zones, and an ended rule. |
| `05-share.sql` | Shared tasks and invitations in every non-outcome state: live pending, near-expiry pending, past-expiry pending (lazy `t-expire` read path), revoked. |
| `06-notify.sql` | Preferences (subscribed / unsubscribed / custom digest window / multi-channel), notifications, delivery attempts in every state (`queued`/`sending`/`delivered`/`bounced`/`suppressed`) with real failure classes, and flushed + open digest windows. |
| `07-audit.sql` | Audit keys, a **real** hash-chained `audit_log_lines` prefix (`sha256(prevHash\|at\|action\|target\|keyId\|actor)` from `GENESIS` — `verifyChain` passes), and erasure requests in `requested`/`verified`/`refused`. |
| `08-sessions.sql` | One expired and one far-future session for `uat-owner`. |
| `30-upload.sql` | Uploads table only (owned by the upload lane) — schema without rows: a seeded upload row would point at bytes SQL cannot write. |
| `volume/` | Volume tier — see below. Not auto-applied. |

## Conventions

- **Namespace**: every seeded owner/recipient/person is `uat-*` (the fixture's declared
  `owner LIKE 'uat-%'` namespace). Realm users such as `demo@todo.dev` get zero seeded rows.
- **Idempotent**: safe to re-run any file (`psql "$DATABASE_URL" -f <file>`); data files
  upsert on their primary keys, `01-schema.sql` uses `IF NOT EXISTS`, and the audit chain
  insert is guarded by `WHERE NOT EXISTS` so it grafts only onto an empty table — re-running
  never corrupts an app-extended chain. After the chain lines exist, `setval` keeps the
  `bigserial` sequence ahead of the seeded ids.
- **neverSeeds** (per `.starciwork/_resources/fixtures/todo-app-seed/resource.yaml`): seeds
  provide prerequisites, never outcomes under test — so there is deliberately no
  `accepted` invitation, no materialised `occurrences` row, no `executing`/`completed`
  erasure request, and no already-fired cap (the `uat-cap-at` owner sits *at* 20 open
  tasks so the next create fires it). There is also no soft-delete column anywhere in
  this schema; the erased-person state is expressed by refusing rather than anonymizing
  seeded erasure rows.

## Volume tier

`volume/10-volume-tasks.sql` inserts 4 000 tasks across 40 `uat-vol-*` owners (plus their
free subscriptions and 2 000 notifications) — enough for e2e perf-relevant queries
(owner-filtered lists, counts, digest groups) to actually measure something. It is not
applied by container init; load it on demand:

```sh
docker compose -f .starcistacks/dev/infra/compose/compose.yaml exec -T postgres \
  psql -U postgres -d todo < .starcistacks/dev/seeds/volume/10-volume-tasks.sql
```

or against any reachable database: `psql "$DATABASE_URL" -f volume/10-volume-tasks.sql`.
Re-running is safe (deterministic ids, upsert/`ON CONFLICT DO NOTHING`).
