# Lane v10-2 — REPORT: todo-be graphql/http transport doors claimed by their impl records

Date: 2026-09-19. Scope: `examples/todo-app-backend/.starciwork/features/*/impl/todo-app-backend/*`
owners expansion only — no product code touched. Read first: `v10/_common.md`, v10-2 brief,
`scripts/check-work-deep.mjs`, `scripts/example-ownership.mjs`, `scripts/example-evidence.mjs`.

## Baseline vs after

`check-work-deep.mjs` before: **19 UNCLAIMED_SURFACE** on todo-app-backend (the brief's "22" was a
stale count; the actual flagged set was 18 graphql op dirs + the `GET /health` controller file —
`webhooks/sepay` and `session`/`notify`/`recur` dirs were already owned). After: **0**.

Every flagged surface was traced to the `bussiness` module its resolver dispatches into
(`@modules/bussiness/<cap>/*.{command,query}` imports in each `*.resolver.ts`), then `owners:` on the
impl record that owns that capability's business logic was extended:

| transport dir(s) | owning record | why |
|---|---|---|
| `graphql/mutations/audit` (request-erasure, complete-erasure) | `impl.audit.todo-app-backend.erasure` | RequestErasureCommand/CompleteErasureCommand handlers named in its own change reason |
| `graphql/queries/audit/audit-log` | `impl.audit.todo-app-backend.operator-read` | AuditLogHandler is the dispatch point its fail-closed operator read hangs on (proves `fr.audit.log.read`) |
| `graphql/queries/audit/export-my-data` | `impl.audit.todo-app-backend.log` | `AuditLogService.exportForPerson` is this record's named method |
| `graphql/{mutations,queries}/plan` | `impl.plan.todo-app-backend.plan` | upgrade/downgrade/reconcile + plan-usage dispatch into `bussiness/plan` |
| `graphql/{mutations,queries}/share` | `impl.share.todo-app-backend.invitations` | invite/accept/revoke/collaborators are the lifecycle this record proves; `access` owns only the internal guards, no transport |
| `graphql/mutations/task/{create,complete,delete,reopen}-task` | the matching per-op impl records | each resolver dispatches the same-named command |
| `graphql/queries/task/{list-tasks,task-counts}` | `impl.task.todo-app-backend.list` | TaskCountsHandler is already its `contract.task.list-for-dashboard` provider assertion |
| `http/health` | `impl.task.todo-app-backend.platform-database` | the controller's only function is pinging `PostgresPrimaryClient` — this record owns the dependency the door reports on |

**TRANSPORT_ORPHAN: none.** Every shipped op had a real owning capability record; no record was
invented. Per-op granularity was used where a cap's ops split across records (task, audit queries);
cap-level where one record owns them all (plan, share, audit mutations).

## Provenance kept honest

- `change.rev` bumped 2→3 on the five records that carried a `change` block (audit erasure/log/
  operator-read, plan, share invitations); `change: {rev: 1}` authored on the six that had only a
  code `revision:` pin or nothing — the owners edit is a normative change and is now recorded as one.
  No `revision` sha moved: no code changed.
- Evidence refreshed by real re-execution, not by assertion: a scratch driver
  (`ex-testing/lint/scratch/v10-2-refresh*.mjs`) replayed each touched record's own recorded
  `--assert` commands through `scripts/example-evidence.mjs` so `recordDigest`/`codeDigest` settle.
  **16 records**: the 11 edited impls plus the 5 spec records with no own paths whose prover-fallback
  `codeDigest` legitimately moved (`fr.audit.log.read`, `contract.plan.create-precondition`,
  `event.task.completed`, `fr.task.create`, `event.task.deleted`). All assertions pass — jest specs,
  repo-wide `npx tsc --noEmit`, and share's live-proof replayed against the real API on :3001
  (`/health` 200). No `stale: true`, no authored `provenBy`, nothing dropped.
- Two index.yaml parse failures on the first pass (unquoted `rev 3 (...):` inside plain scalars in
  the plan/invitations `reason` fields) were fixed and re-run — that's why the refresh is two scripts.

## Gates after

- `check-example-work.mjs`: **310 records, 5 refused — zero mine.** All five are concurrent lanes'
  in-flight ec-be items (two evidence recordDigests mid-refresh, v10-3's new
  `contract.identity.internal.sessions` done-without-evidence yet, `uat.identity.sign-in` missing
  evidence/run). A transient malformed-yaml crash mid-run was that same v10-3 file being written;
  it parses clean on retry.
- `check-work-deep.mjs` on todo-app-backend: **0 UNCLAIMED_SURFACE**, 0 refused. The three expected
  `DEP_STALE` on done gap records (`gap.{audit,plan,share}.unbuilt-module` — their dep edges to the
  moved impl norms) were settled by `--write-baseline --tree examples/todo-app-backend/.starciwork`
  after the verified-clean pass, per the script's documented flow. Remaining ec-be `DEP_STALE`
  (`uat.identity.sign-in` vs `gap.identity.live-proof`) is v10-3's dep, not mine.

## Remaining suspects (pre-existing, out of scope)

- `CAPABILITY_WITHOUT_SPEC` on `/health` and `/webhooks` (todo-be): these need an fr/br/contract
  record *naming* the capability — impl `owners` don't count for that check (it scans spec-record id
  and path segments only). Naming a spec for a readiness probe and a webhook door is a spec-authoring
  decision for a business/architecture lane, not this owners lane.
- Same class of suspect on ec-be `/internal` + `/health` (v10-3 is actively on `/internal`).
- `EVIDENCE_CONTEXT_MISSING` info counts (110 todo / 14 ec) — pre-existing.
