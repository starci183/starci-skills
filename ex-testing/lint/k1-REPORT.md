# k1 REPORT — `scripts/kernel/api.mjs` (kernel-agent CLI gate)

Lane: k1
Scope owned: `scripts/kernel/api.mjs` (NEW, 477 lines). No other files edited. No commits.

## 1. Commands implemented (all 8)

| Command | Behaviour | Verified |
|---|---|---|
| `survey --repo --workflow` | workflows row, latest goal {revision, identity, markdown, parsed `json` incl. `opChain` + `derivedPlan`}, open jobs (payload parsed), all inbox rows (payload+disposition parsed), live signals (`(scope=wf OR key=wf) AND (expires_at IS NULL OR > now)` — covers both `scope=workflowId` and `scope='kernel',key=workflowId` conventions), last 10 events (chronological, payload parsed), open incidents, `eventsHead` | ✅ live run |
| `status --repo --workflow` | `{phase, jobs:{status:count}, activeLeases:[{resource_key,job_id,expires_at}] (expires_at>now), inboxPending}` | ✅ |
| `plan --repo --workflow --file` | reads `{legs:[{op,paths?,notes?}]}`; structural diff vs stored `goals.json.opChain.legs[].op` → `{missing, extra, reordered, noStoredChain, diverged}`; inside one transaction: `plan-derived` event + `goals.json.derivedPlan = {legs, divergence, derivedAt}` on the latest revision | ✅ divergence detected (5 missing / 1 extra) |
| `enqueue --repo --workflow --op --paths csv [--title --risk]` | INSERT jobs row: `kind='op'`, `role='op'`, `status='pending'`, `attempt = MAX(attempt)+1 per (workflow_id,op_id)`, `generation = workflows.generation`, payload `{opId, owned_paths[], title, risk}`; `job-enqueued` event; prints `job_id` (`op-<opId>-<token10>`) | ✅ `op-request.analyze-18ad1b8d42` |
| `dispatch --repo --job [--model --worktree] [--spawn]` | loads job, refuses settled jobs; builds packet in dispatch-op.mjs's exact shape (op/brief/context{records,owned_paths}/constraints{model,provider,budget,lease}/returns); resolves model via `modules/models/profiles/<t>.yaml` `launch.orca` (flag > payload.model > `qwen-agent` default); without `--spawn` prints packet+prompt+orca argv only, zero mutation; with `--spawn` refuses `brief-missing` / `managed-agent` kinds, runs orca create→read→send, then inside one transaction sets `status='running'` + `worker_id=<handle>` and appends `op-dispatched` | ✅ dry-run packet; refusal paths (brief-missing, job-settled) exit 1 |
| `settle --repo --job --verdict pass\|fail\|blocked --report` | verifies report file exists (cwd-then-repo resolution); inside one transaction: payload gets `{verdict, report, settledAt}`, `status='completed'` (pass) / `'failed'` (fail\|blocked), `result_json={verdict,report,at}`, `lease_token`/`deadline` cleared, `DELETE FROM leases WHERE job_id`, `op-settled` event; machine_ref tokens released best-effort via `openMachine().release()` after commit (never fails the settle) | ✅ verdict persisted; double-settle refused (`job-settled`, exit 1) |
| `incident --repo --workflow --kind --detail [--op]` | INSERT incidents row (`incident_id='inc-<token12>'`, `status='open'`, `last_progress='[kind] detail'`, op_id nullable) + `incident-raised` event | ✅ |
| `retire --repo --workflow` | `phase='finished'` + `finished_json={retiredAt,by}`; inbox rows not already `done`/`applied` → `status='done'`; `workflow-finished` event; idempotent (`alreadyFinished` flag). **Zero deletes** — verified goals/events/jobs rows intact post-retire | ✅ survey after retire shows full history (6 events, goal, jobs) |

Rules honoured: exit 2 + usage on bad args/unknown command/missing flags/bad verdict (verified); every write inside `ledger.transaction`; all output JSON-safe (`--json` pretty-prints, default is compact human lines); ORCA exe resolution + `spawnSync` argv (no shell) copied verbatim from `dispatch-op.mjs`/`start-workflow.mjs`; `--repo` defaults to cwd like `start-workflow.mjs`.

## 2. Schema assumptions verified against `kernel/ledger-db.mjs` DDL

- `jobs` real columns: `job_id, workflow_id, op_id, attempt, generation, kind, role, payload_json, status, priority_json, lease_token, worker_id, deadline, result_json, created_at, updated_at` — the lane spec omitted `priority_json/lease_token/deadline/result_json`; settle uses `result_json` for the settlement record and clears `lease_token`/`deadline`.
- `goals.json` column is literally named `json` (text); `opChain` at `json.opChain.legs[].op` — confirmed by `define-goal.mjs:63` and `start-workflow.mjs:49`.
- `inbox`: `inbox_id, workflow_id, kind, key, payload_json, status('pending'|'claimed'|'applied'), disposition_json, created_at, applied_at`. Retire introduces `'done'` per spec (harmless — `pending()` only filters `status='pending'`).
- `incidents`: `incident_id PK, workflow_id, op_id, attempts, model_calls, tokens, elapsed_ms, last_progress, status, updated_at` — `last_progress` carries `[kind] detail`; `status='open'`.
- `events`: `appendEvent` handle method used everywhere (digest chain maintained by the `events_digest_chain` trigger — verified, seqs 1-6 chained in smoke test).
- `signals` PK is `(scope,key)` — workflow-scoped rows use `scope=workflow_id` (per `retireWorkflow`'s `DELETE FROM signals WHERE scope=?`), kernel singleton uses `scope='kernel',key=workflow_id`; survey covers both.

## 3. Functions not reusable + why

- **`dispatch-op.mjs` packet builder / `buildPrompt` / `resolveModel`** — NOT exported; the file runs `main()` on import (line 264). Shapes replicated in api.mjs (`buildPacket`, `buildPrompt`, `resolveModel`) with one addition: prompt line 1 names the `job_id` so an op agent can be correlated back to its durable job. If reuse is wanted later, dispatch-op.mjs needs an export refactor.
- **`reserveTwoPhase` / `releaseTwoPhase`** — not used. `enqueue` spec asks for a bare `pending` job (no resource reservation); `reserveTwoPhase` writes `status='leased'` jobs and requires declared resource capacities + a machine handle — heavier than this CLI's contract. `releaseTwoPhase` wraps its own `ledger.transaction` so it cannot nest inside the settle transaction (`makeTransaction` throws `ledger-nested-transaction`); its lease-delete + machine_ref-release halves are replicated inline instead.
- **`inspectLedger`** — not used for reads: `openLedger` is required anyway for writes, and keeping one handle keeps `eventsHead`/`transaction` uniform. Read commands never mutate (verified: survey/status do no writes beyond openLedger's own meta.journal_mode upsert + snapshot compaction, which is standard for any open).

## 4. Status-vocabulary deviations from spec shorthand (deliberate, flagged)

- `enqueue` writes `status='pending'` (spec-literal). Note the durable engine's queue word is `'queued'` (`enqueueJob`, `engine.mjs` pending-sweep); api.mjs accepts both as dispatchable and reports raw statuses in survey/status, so a mixed fleet stays coherent.
- `settle` writes `'completed'`/`'failed'` per spec. **Caveat:** `'completed'` ∉ `SETTLED_JOB_STATUSES` (`['succeeded','failed','cancelled']`), so ledger-side `liveRows`/`retireWorkflow` (the erase-path — never called here) would still count a completed job as live. Inside api.mjs this is handled by a local `SETTLED` union (`completed`, `effect_unknown` added). If a later lane wants engine-interop, flip settle's pass-status to `'succeeded'` — one-line change.
- `retire` closes inbox rows as `'done'` (spec-literal; engine convention is `'applied'` — both are non-pending terminal states).

## 5. Notes for the parent / other lanes

- `modules/kernel/api.yaml` (referenced by `scripts/kernel/kernel-prompt.md` load order step 3) still does not exist — whoever owns it should document the status vocabulary above (`pending`/`running`/`completed`/`failed`) or coordinate the flip to `queued`/`succeeded`.
- `--spawn` was exercised only up to the refusal boundaries — actually spawning an Orca/qwen terminal in a smoke test was judged out of scope (side-effect on the real fleet). The create→read→send argv sequence is identical to dispatch-op.mjs's proven path.
- Test repo was created at `ex-testing/lint/tmp/k1-repo`, exercised end-to-end, then removed; no stray ledgers or commits left.
