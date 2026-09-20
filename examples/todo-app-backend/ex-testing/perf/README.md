# Performance baseline — todo-app GraphQL

Five heaviest journeys measured with **autocannon** (k6 is not installed on this machine; autocannon
runs via `npx` so nothing is added to package.json).

## Run

```bash
# stack: compose dev infra up (postgres/keycloak/redis), backend serving :3001
node ex-testing/perf/run-baseline.mjs [--duration 15] [--connections 10] [--base http://localhost:3001]
```

The runner signs in as `demo@todo.dev` / `todo-demo-pass` (seeded dev account), then POSTs each
journey's GraphQL document to `/graphql` for `duration` seconds at `connections` parallel
connections. Results land in `baseline-<iso-ts>.json`.

## Journeys

| Journey | Operation | Why it's heavy |
|---|---|---|
| task-list | `tasks` | the caller's full list — ~4.1k seeded rows, unbounded (no pagination arg exists on the resolver; flagged in the report) |
| recur-expansion | `upcomingOccurrences(ruleId)` | materialised rows + live previewDates computation over a rule |
| share-fan-out | `collaborators(taskId)` | invitation fan-out read on a task holding pending/accepted/revoked invites |
| notify-digest | `notificationPreferences(channel)` | heaviest notify *read* in the schema — digest flushing is write-side and not load-safe to hammer |
| audit-export | `exportMyData` | decrypts every audit line naming the caller (468 seeded) |

## Baseline (2026-09-19, dev machine, backend dev-mode on :3001, 15s x 10 conn)

| Journey | p50 | p97.5 | p99 | throughput | errors |
|---|---|---|---|---|---|
| task-list | 11 ms | 16 ms | 18 ms | ~885 rps | 0 |
| recur-expansion | 12 ms | 15 ms | 16 ms | ~809 rps | 0 |
| share-fan-out | 8 ms | 10 ms | 11 ms | ~1239 rps | 0 |
| notify-digest | 7 ms | 9 ms | 10 ms | ~1410 rps | 0 |
| audit-export | 615 ms | 793 ms | 938 ms | ~16 rps | 0 |

autocannon's default percentile grid emits p97.5 rather than p95 — reported as-is. `errorRate` counts
transport/HTTP failures only; GraphQL-level `errors[]` bodies return HTTP 200 and need an
assertion-capable tool to count.

## Draft SLOs (proposed, not enforced)

- p97.5 ≤ 200 ms for share/notify reads, ≤ 300 ms recur expansion, ≤ 800 ms task list
- p97.5 ≤ 1500 ms audit export (scales with log size)
- error rate ≤ 1%

## Reproduce after a DB reset

The journey arguments name seeded ids (`ec0de4d5-…` rule, `7b5fdf63-…` task). If the database was
reset, re-apply `.starcistacks/dev/seeds/` then update the ids in `run-baseline.mjs` from
`SELECT id FROM recurrence_rules` / `SELECT task_id FROM invitations` for the demo account.
