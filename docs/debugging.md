# Debugging

Every question about a workflow has an answer in SQL. Open the databases read-only, run one query,
close. Never call an API verb to look at state, and never open a database for writing by hand.

```text
runtime.sqlite   %LOCALAPPDATA%/StarCi/projects/<ledger_id>/runtime.sqlite
machine.sqlite   %LOCALAPPDATA%/StarCi/machine.sqlite
blob             GET /api/blob/<sha256> on the harness, or blobs.file_uri
```

Find a ledger's file with `SELECT ledger_id, name, file FROM ledgers` in machine. For a query that
joins both (Q7, Q8), open machine read-only, set `PRAGMA query_only = ON`, and attach the ledger
as `l`:

```sql
PRAGMA query_only = ON;
ATTACH '<runtime.sqlite>' AS l;
```

Parameters: `:wf` workflow id, `:unit` unit id, `:att` attempt id, `:job` job id, `:ledger` ledger
id, `:op` op id, `:day0` epoch ms. Every blob column is a sha256; join `blobs` to get `http_path`.

## Start here: what is blocking the workflow

```sql
SELECT entity_type, entity_id, blocker_type, blocker_id, reason_code, detail, who,
       (CAST(unixepoch('subsec')*1000 AS INTEGER) - since)/60000 AS minutes
FROM v_blocking WHERE workflow_id = :wf ORDER BY since;
```

One row per reason something waits: a unit waiting on an unfinished unit, an open Decision Item, a
condition that is not `True`, an open incident, a worker question, a failing settle tail, a red
product land. `who` names the party that has to act.

## The ten questions

**Q1. Why is unit X stuck?** Its state, its latest attempt, and every condition on that attempt
that is not `True`:

```sql
SELECT u.state, u.tries, u.try_budget, a.attempt_id, a.agent, a.model, a.terminal_handle,
       c.type, c.status, c.reason, c.message, c.owner,
       (CAST(unixepoch('subsec')*1000 AS INTEGER) - c.last_transition_at)/60000 AS minutes_in_state
FROM work_units u
LEFT JOIN op_attempts a ON a.attempt_id = (SELECT max(attempt_id) FROM op_attempts
                                           WHERE workflow_id = u.workflow_id AND unit_id = u.unit_id)
LEFT JOIN conditions c ON c.entity_type = 'attempt' AND c.entity_id = CAST(a.attempt_id AS TEXT) AND c.status <> 'True'
WHERE u.workflow_id = :wf AND u.unit_id = :unit
ORDER BY c.last_transition_at;
```

**Q2. What did attempt `:att` do, in order?**

```sql
SELECT at, source, kind, detail FROM v_timeline WHERE attempt_id = :att ORDER BY at, seq;
```

**Q3. Which checks are red, and where is their output?**

```sql
SELECT c.name, c.phase, c.runner, c.authority, c.exit_code, c.declared_exit_code, c.status, c.summary_json,
       so.http_path AS stdout, se.http_path AS stderr, oo.http_path AS output
FROM check_runs c
LEFT JOIN blobs so ON so.sha256 = c.stdout_sha
LEFT JOIN blobs se ON se.sha256 = c.stderr_sha
LEFT JOIN blobs oo ON oo.sha256 = c.output_sha
WHERE c.attempt_id = :att AND c.status IN ('fail', 'error')
ORDER BY c.started_at;
```

`exit_code` is what the runner observed; `declared_exit_code` is what the op said. Only the raw one
decides a verdict. A check with status `unavailable` is an infrastructure problem, never red.

**Q4. What did the agent see, and how many tokens did it use?**

```sql
SELECT a.agent, a.cli_name, a.cli_version, a.model, a.runtime_rev, a.base_sha,
       (SELECT http_path FROM blobs WHERE sha256 = a.prompt_sha)     AS prompt,
       (SELECT http_path FROM blobs WHERE sha256 = a.transcript_sha) AS transcript,
       (SELECT http_path FROM blobs WHERE sha256 = a.session_sha)    AS cli_session,
       ct.markdown AS contract,
       sum(u.input_tokens) AS tokens_in, sum(u.output_tokens) AS tokens_out,
       sum(u.cache_read_tokens) AS tokens_cache_read, max(u.source) AS usage_source
FROM op_attempts a
LEFT JOIN contracts ct ON ct.attempt_id = a.attempt_id
LEFT JOIN llm_usage u ON u.attempt_id = a.attempt_id
WHERE a.attempt_id = :att
GROUP BY a.attempt_id;
```

Token counts only; the runtime never estimates a cost. A running attempt has no `transcript_sha`
yet: read its newest `attempt_transcript_snapshots` row instead.

**Q5. What did the op claim, and what did the runtime decide?**

```sql
SELECT a.dispatch_seq, a.report_outcome, r.summary AS claim,
       a.verdict, a.settled_by, a.failure_class, d.choice, d.rationale, di.summary AS decision_item
FROM op_attempts a
LEFT JOIN reports r ON r.attempt_id = a.attempt_id
LEFT JOIN decisions d ON d.decision_id = a.decision_id
LEFT JOIN decision_items di ON di.di_id = d.di_id
WHERE a.workflow_id = :wf AND a.unit_id = :unit
ORDER BY a.attempt_id;
```

**Q6. The whole retry history of a unit** (unit → try → dispatch):

```sql
SELECT j.job_id, j.try_no, j.retry_of, j.retry_class, j.status, a.dispatch_seq, a.end_state,
       a.agent, a.model, a.verdict, a.failure_class, (a.settled_at - a.dispatched_at)/60000 AS minutes
FROM jobs j LEFT JOIN op_attempts a ON a.job_id = j.job_id
WHERE j.workflow_id = :wf AND j.unit_id = :unit
ORDER BY j.try_no, a.dispatch_seq;
```

**Q7. What is running now, in which terminal and worktree, and is it alive?** (machine, ledger as `l`)

```sql
SELECT a.workflow_id, a.unit_id, a.attempt_id, a.agent, a.model, t.handle, t.last_output_at,
       w.path AS worktree, (CAST(unixepoch('subsec')*1000 AS INTEGER) - a.dispatched_at)/60000 AS minutes_running
FROM l.op_attempts a
LEFT JOIN main.terminals t ON t.handle = a.terminal_handle
LEFT JOIN main.worktrees w ON w.ledger_id = :ledger AND w.attempt_id = a.attempt_id
WHERE a.settled_at IS NULL AND a.end_state IS NULL
ORDER BY a.dispatched_at;
```

**Q8. What leaked: a finished attempt whose terminal or worktree is still open?** (machine, ledger as `l`)

```sql
SELECT a.attempt_id, a.settled_at, t.handle, t.closed_at, w.path, w.removed_at
FROM l.op_attempts a
LEFT JOIN main.terminals t ON t.handle = a.terminal_handle
LEFT JOIN main.worktrees w ON w.ledger_id = :ledger AND w.attempt_id = a.attempt_id
WHERE a.settled_at IS NOT NULL
  AND ((t.handle IS NOT NULL AND t.closed_at IS NULL) OR (w.path IS NOT NULL AND w.removed_at IS NULL));
```

The standing views give the same answer without the join: `SELECT * FROM v_leaks` in machine
(terminals without an owner, expired host locks and leases) and `SELECT * FROM v_ledger_leaks` in
each ledger (expired leases, overdue incidents, closed terminals with no transcript).

**Q9. What did the reconciler do with job X, and which action failed?** (machine)

```sql
SELECT controller, duty, verb, state, mode, started_at, finished_at, exit_code, error_signature,
       (SELECT http_path FROM blobs WHERE sha256 = e.result_sha) AS result,
       (SELECT http_path FROM blobs WHERE sha256 = e.stderr_sha) AS stderr
FROM v_engine_actions e
WHERE ledger_id = :ledger AND job_id = :job
ORDER BY started_at;
```

`mode = 'shadow'` rows are what the controller would have done; nothing was executed.

**Q10. Find an error in every log, then jump to the attempt.**

```sql
SELECT l.at, l.level, l.actor, l.kind, l.workflow_id, l.attempt_id,
       snippet(logs_fts, 0, '[', ']', '…', 12) AS hit
FROM logs_fts JOIN logs l ON l.seq = logs_fts.rowid
WHERE logs_fts MATCH '"EADDRINUSE" OR "lease-identity-drift"' AND l.level IN ('warn', 'error')
ORDER BY l.seq DESC LIMIT 50;
```

The machine log has the same shape:

```sql
SELECT l.at, l.level, l.actor, l.controller, l.kind, l.ledger_id, l.action_id,
       snippet(machine_logs_fts, 0, '[', ']', '…', 12) AS hit
FROM machine_logs_fts JOIN machine_logs l ON l.seq = machine_logs_fts.rowid
WHERE machine_logs_fts MATCH '"push-refused"'
ORDER BY l.seq DESC LIMIT 50;
```

## More questions

| Question | Query |
| --- | --- |
| Which reports wait too long for a settle? | `SELECT workflow_id, attempt_id, unit_id, op_id, report_outcome, waiting_ms/60000 AS minutes, who, open_di FROM v_settle_overdue ORDER BY waiting_ms DESC;` |
| How far is each workflow? | `SELECT workflow_id, phase, units_total, units_done, units_active, units_waiting, units_failed, completion_rate, done_last_6h, eta_at FROM v_workflow_progress;` |
| Who paused or stopped this workflow, and why? | `SELECT at, from_phase, to_phase, by, reason FROM lifecycle_changes WHERE workflow_id = :wf ORDER BY change_id;` |
| Which model keeps failing op Y? | `SELECT agent, model, attempts, pass, fail, blocked, worker_dead, pass_rate, avg_cycle_ms, tokens_in, tokens_out FROM v_model_scorecard WHERE op_id = :op ORDER BY pass_rate;` |
| Is the engine alive? (machine) | `SELECT holder, pid, epoch, heartbeat_age_ms, draining, starts_last_hour, bad_exits_24h, last_error FROM v_engine_health;` |
| Why did the engine die? (machine) | `SELECT run_id, role, pid, rev, start_reason, started_at, ended_at, exit_code, exit_reason, killed_by, heartbeat_age_at_end_ms FROM process_runs ORDER BY started_at DESC LIMIT 20;` |
| Are the seats alive and listening? (machine) | `SELECT seat_id, role, workflow_id, state, parked_reason, input_failures_consecutive, last_output_at, ui FROM v_seats;` |
| Is a periodic duty running too often or too late? (machine) | `SELECT controller, duty, interval_ms, last_started_at, next_due_at, overdue_ms, runs_24h, ui FROM v_schedules;` |
| Who changed a controller's mode? (machine) | `SELECT m.controller, m.mode, c.from_mode, c.to_mode, c.by, c.reason, c.at FROM controller_modes m LEFT JOIN mode_changes c ON c.controller = m.controller ORDER BY c.change_id DESC;` |
| What waits on the Supervisor? (machine) | `SELECT di_id, kind, summary, status, due_at, escalations, delivered_at, ui FROM v_open_sup_decisions;` |
| How many tokens did the Kernel use today? | `SELECT sum(input_tokens) AS tokens_in, sum(output_tokens) AS tokens_out FROM llm_usage WHERE subject_type = 'kernel-turn' AND at > :day0;` |
| Where does this id appear? | `SELECT * FROM v_search_ids WHERE id = :id;` (in each database) |

## Habits

- Read `v_blocking` before anything else; it names who has to act.
- Trust the attempt row over a terminal screen. The screen is context; the row and its blobs are the
  record.
- A red `verdict` with a green `report_outcome` is the runtime disagreeing with the op: read the red
  checks (Q3), not the op's summary.
- A unit at `tries = try_budget` is refused further tries by the database. Only the owner or the
  Supervisor raises the budget, with a reference to the Decision Item or incident that justifies it.
- A `stopped` workflow stays stopped until the owner resumes it. A controller that moved it would be
  a bug; `lifecycle_changes` shows who did.

## Why an attempt ended as it did

Every failed, blocked, refused, requeued or waiting attempt has a plain-language `why` (`op_attempts.why_json`, `v_op_history.why_json`, `starci kernel status` legs/frontier, `scripts/kernel/why.mjs`). Read it before the raw codes; the contract and the code catalog are in [why](why.md).