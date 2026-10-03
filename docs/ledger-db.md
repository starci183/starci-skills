Task: read the runtime's storage
# Storage: `runtime.sqlite`, `machine.sqlite` and the blob store

The executed schemas live under `engine/db/migrations/runtime/` and `engine/db/migrations/machine/`.
`engine/db/ledger.mjs` owns project schema validation; `engine/db/machine.mjs` owns host schema validation
and the additive provider-reservation upgrade. The host upgrade preserves existing rows and records its
DDL digest in `schema_migrations` in the same transaction as the version change. Read-only host access
validates a supported schema without upgrading it. These writers and their SQL files own the storage rules.

## 1. The layout

```text
%LOCALAPPDATA%/StarCi/projects/<ledger_id>/runtime.sqlite   one per project (its workflows' complete history)
%LOCALAPPDATA%/StarCi/machine.sqlite                        one per host (registry, Supervisor, engine, host state)
~/.starci/artifacts/<sha[0:2]>/<sha256>  +  <sha256>.json    one blob store (bytes; the DBs hold the index)
<app>/.starciwork/                                           product content only, in git
```

- A project ledger is found through `machine.ledgers` (`ledger_id → file`), never by walking a
  repository. `meta.ledger_id` is minted at create and moves with the bytes.
- There is no other store. No JSON state file, no JSONL inbox, no text log, no second SQLite file.
- The writers refuse unsupported schema identities or versions. `openLedger` creates a fresh project
  store at `ledgerFileFor(<repo root>)`; `openMachine` creates a fresh host store at `machineFileFor`
  or applies its supported additive upgrade to an existing host store.
- `STARCI_LOCAL_ROOT` overrides the per-host state base (`%LOCALAPPDATA%/StarCi` itself, one shared helper:
  `engine/db/machine.mjs` `starciLocalRoot`/`LOCAL_ROOT_ENV`, re-exported and honored by `engine/db/ledger.mjs`
  `projectsRootFor`) — both `projects/` and `machine.sqlite` move under it. Narrower seams still win when set:
  `STARCI_PROJECTS_ROOT` (just the `projects/` directory), `STARCI_TEST_MACHINE_FILE` (the exact `machine.sqlite`
  file), `STARCI_ARTIFACT_ROOT` (the blob store, independent of the state base). A debug probe or throwaway repo
  that would otherwise leave a fake ledger in the real store (`skills/claude-debug/SKILL.md` §5) must set
  `STARCI_LOCAL_ROOT` to a temp directory for its whole process tree.

## 2. One writer per database

| Database | Writer | Callers |
| --- | --- | --- |
| `runtime.sqlite` | `engine/db/ledger.mjs` | API verbs, the settler, controllers, `define-goal`, `start-workflow`, the buffered log writer |
| `machine.sqlite` | `engine/db/machine.mjs` | the reconciler engine and controllers, the Supervisor scripts, the land gate, GC |
| blob store | `engine/db/blob.mjs` | the two writers only |

"Single writer" means one module, not one process: several processes write, and SQLite serializes
them. Everything else calls named business functions of the writer; the land gate refuses
`new DatabaseSync` on a ledger outside `engine/`. Readers (the harness UI, `poll.mjs`, CLI
inspection) open read-only handles.

### Connection policy

| Setting | Writer | Reader |
| --- | --- | --- |
| `journal_mode` | `WAL`, verified after open; anything else is an error | — |
| `synchronous` | `NORMAL` | — |
| `foreign_keys` | `ON` on every connection | — |
| `busy_timeout` | 15000 ms | 15000 ms |
| `trusted_schema` | `OFF` | `OFF` |
| `wal_autocheckpoint` | `0` on every connection except the one engine connection that checkpoints (`wal_checkpoint(PASSIVE)` on a timer) | — |
| `journal_size_limit` | 64 MiB | — |
| other | `temp_store=MEMORY`, `cache_size` 16 MiB; new files: `auto_vacuum=INCREMENTAL`, `page_size=4096` before WAL | `readOnly: true`, `query_only=ON` |

The single checkpointing connection is the guard against the WAL-reset defect of SQLite 3.50.4
until the bundled SQLite is 3.51.3 or newer; the open records `sqlite_version` in the meta table.
Databases live on local disks only.

### Transactions

- Every write is `BEGIN IMMEDIATE`, held under 50 ms.
- No I/O outside the database inside a transaction: no spawn, no Orca call, no blob put. The blob is
  put first; the row that cites it is written after.
- Every state change inserts exactly one `events` row in the same transaction. The event digest
  chain (`prev_digest → digest`) is computed in JavaScript, not by an SQL function.
- A write verb records its request in `api_requests` (`request_id`, verb, caller, `args_sha`,
  result), so a retried request returns the first result instead of acting twice.
- `trace_id` / `span_id` pass through every write.

### Time

Timestamps are epoch milliseconds UTC in `*_at` columns. Order by `seq` or rowid, never by `*_at`
(two rows share a millisecond). Durations (`*_ms`) are measured with a monotonic clock. Views use
`CAST(unixepoch('subsec')*1000 AS INTEGER)` for "now".

## 3. `runtime.sqlite`

| Domain | Tables | What they guarantee |
| --- | --- | --- |
| Identity and vocabulary | `meta`, `schema_migrations`, `ui_states`, `ui_state_map`, `blob_ref_columns`, `workflow_transitions`, `job_transitions` | One 7-value display state (`bad, warn, running, waiting, ok, done, unknown`) mapped from every native state; the only list of blob-referencing columns; the state machines as data. |
| Blobs | `blobs` | One row per sha256: bytes, media type, `redacted`, `file_uri`, and `http_path = '/api/blob/' \|\| sha256` as a generated column. |
| Workflow | `workflows`, `lifecycle_changes`, `goals`, `goal_inputs`, `workflow_purges` | `trace_id` per workflow; the 7 phases (`awaiting-approval, queued, running, paused, stopped, finished, archived`); a phase changes only along `workflow_transitions` and only with a matching `lifecycle_changes` row. Goals keep the markdown a relaunch reads. |
| Work graph | `work_graph_versions`, `work_units`, `unit_edges` | One unit per `(workflow, op, subject_key, goal_revision)`; a try budget per unit (default 5, raised only with `budget_raised_by/ref`); a done unit reruns only through a recorded reopen. |
| Execution | `jobs`, `op_attempts`, `contracts`, `resources`, `leases`, `api_requests` | A job's status moves only along `job_transitions`; an attempt row is created only when its job has just gone `ready → leased` in a running workflow; `retry_of` points only at a failed job of the same unit with `try_no = parent + 1`; a job that ends drops its leases. Contracts are keyed by attempt, so a re-dispatch never overwrites the previous one. |
| Results | `reports`, `check_runs`, `settle_tails`, `product_lands`, `job_artifacts`, `attempt_transcript_snapshots`, `report_attachments`, `artifact_proofs`, `work_citations`, `interface_audits`, `llm_usage` | One immutable report per attempt; one check row per `(attempt, runner, phase, name, run_seq)` with the raw `exit_code` separate from `declared_exit_code` and no `pass` with a nonzero raw exit; immutable artifacts keyed by `(attempt_id, name)`; Work citations by artifact id and sha256. Token counts only; no estimated cost. |
| Coordination | `inbox`, `decision_items`, `decisions`, `conditions`, `incidents`, `foundations`, `foundation_declarations`, `path_transfers`, `record_changes`, `signals` | Decision Item keys have no empty part; conditions follow the Kubernetes shape (`type`, `status True/False/Unknown`, `reason`, `owner`); an incident has a kind from a closed list, an owner, a due time, and a reason when closed; finishing a workflow closes its incidents. |
| Observation | `events`, `logs`, `logs_fts`, `log_cursors` | Append-only (UPDATE refused; DELETE only during a purge, or for debug logs past retention); full-text search over logs; an archived workflow accepts no new event. |

Views: `v_attempt_state`, `v_op_history`, `v_units`, `v_checks`, `v_decision_rows`, `v_media`,
`v_record_evidence`, `v_timeline`, `v_workflow_progress`, `v_model_scorecard`, `v_settle_overdue`,
`v_ledger_leaks`, `v_blocking`, `v_open_work`, `v_search_ids`, `v_live_marks`, `v_blob_refs`.
Each view that shows an entity carries its `ui` state. `v_decision_rows`, `v_blocking` and `v_open_work` never
list a live row of an ended workflow (`phase` `archived`|`finished`; a missing `workflows` row still counts as
live) — `v_decision_rows` keeps the ended workflow's resolved history (migration 0005).

### The attempt row

`op_attempts` is the history of one dispatch. Its column groups:

| Group | Columns |
| --- | --- |
| Keys | `attempt_id`; unique `(workflow_id, dispatch_id)` and `(job_id, dispatch_seq)`; `unit_id`, `op_id`, `try_no`, `span_id`, `parent_span_id` |
| Who ran it | `agent`, `provider`, `model`, `request_model`, `model_profile`, `pool`, `effort`, `routed_by`, `route_chain_json`, `terminal_handle`, `worker_pid` |
| Reproduction | `runtime_rev`, `cli_name`, `cli_version`, `contract_sha`, `config_sha`, `prompt_sha`, `transcript_sha` (full redacted scrollback at the end), `session_sha` (redacted CLI session file) |
| Where | `repo_root`, `worktree_path`, `branch`, `base_sha`, `head_sha`, `integrated_sha` |
| When | `routed_at`, `dispatched_at`, `started_at`, `reported_at`, `checked_at`, `settled_at`, `released_at`, `terminal_closed_at`, `worktree_removed_at`, `wall_ms` |
| Outcome | `report_outcome` (the op's claim) apart from `verdict` (the runtime's), `settled_by`, `decision_id`, `failure_class`, `end_state` |
| Usage | `tokens_in` (fresh + cache read + cache write), `tokens_out`, `cost_usd`, `usage_source` (`cli-transcript` measured, `unavailable` with `usage_reason`; per-model detail in `llm_usage`; NULL only until an ended attempt is decided, never estimated) |

Token metering (`scripts/kernel/usage-record.mjs`, `starci kernel usage`): the numbers come from the agent CLI's own session file - Claude
Code JSONL `message.usage`, Codex rollout `token_count` (`scripts/lib/llm-usage.mjs`); devin and any other
agent are unavailable, and a terminal scrollback is never a source. `llm_usage` rows are normalized: `input_tokens` is fresh
(non-cached) input, `output_tokens` includes reasoning, `reasoning_tokens` is that subset. An op attempt gets one row per model when it
settles (`recordAttemptUsage`, idempotent); a Kernel session gets `kernel-turn` rows and the Supervisor seat `supervisor-turn` rows
(machine.sqlite) as increments over what is already recorded for that session (`turn_ref` `<seat>:<session>@<turns>`), so a re-run
never counts twice. `cost_usd` is set only when every rate the model used is declared in `modules/models/registry.yaml` `models.<id>.price`.

While an attempt runs, the Host controller stores a redacted scrollback snapshot every 60 s in
`attempt_transcript_snapshots`; Kernel and Supervisor seats get `seat_transcript_snapshots` in
machine.

## 4. `machine.sqlite`

| Domain | Tables |
| --- | --- |
| Identity and registry | `machine_meta`, `schema_migrations`, `ui_states`, `ui_state_map`, `blob_ref_columns`, `ledgers` (the only ledger registry), `repositories`, `agents`, `models`, `blobs`, `archives`, `gc_marks` |
| Supervisor | `sup_jobs`, `sup_leases`, `sup_attempts` (same column groups as `op_attempts`), `sup_reports`, `sup_events` (append-only), `sup_decision_items`, `sup_decisions`, `sup_owed`, `sup_learning`, `sup_owner_rulings`, `sup_bridges`, `sup_messages`, `sup_signals`, `llm_usage` |
| Engine | `process_runs`, `engine_leader`, `leader_history`, `engine_cursors`, `engine_queue`, `schedules`, `engine_actions`, `action_steps`, `controller_modes`, `mode_changes`, `sla_episodes`, `invariant_violations` |
| Host | `services`, `service_events`, `service_probes`, `seats`, `deliveries`, `seat_turns`, `seat_transcript_snapshots`, `terminals`, `host_locks`, `claims`, `agent_sessions` |
| Resources | `throttle_state`, `throttle_events`, `throttle_decisions`, `host_samples`, `provider_health`, `provider_health_events`, `pool_backoff`, `quotas`, `guard_jobs`, `guard_refusals`, `host_resources`, `host_leases`, `budgets`, `budget_reservations`, `provider_reservations`, `provider_reservation_events` |
| GC, land, environments | `gc_runs`, `gc_items`, `lanes`, `land_queue`, `land_runs`, `pushes`, `worktrees`, `env_servers`, `uat_slots`, `connectors`, `ask_requests` |
| Observation | `machine_logs`, `machine_logs_fts`, `metrics_snapshots`, `notifications` |

Views: `v_services`, `v_seats`, `v_deaf_seats`, `v_engine_actions`, `v_engine_starts`, `v_sla_open`,
`v_schedules`, `v_open_sup_decisions`, `v_leaks`, `v_engine_health`, `v_search_ids`, `v_live_marks`.

Histories are append-only and written before the state they explain: a controller mode changes only
after its `mode_changes` row, the throttle mode only after its `throttle_events` row; `sla_episodes`,
`service_events` and `leader_history` are never updated or deleted. A refused push always carries a
`failure_signature`; an engine action keeps its full result, stdout and stderr as blobs.

SQLite forbids a persistent view that reads an attached database, so cross-ledger views run the same view on
each ledger read-only (`forEachLedger`) and merge in JavaScript. Attaching a batch of ledgers
(at most 9) is for manual queries only.

## 5. Blobs

- **Store.** `<root>/<sha[0:2]>/<sha256>` plus a `<sha256>.json` sidecar `{size, mediaType, createdAt}`,
  written once by hard link. Bytes never change. The sha256 is of the original bytes.
- **Redaction.** Transcripts, scrollback and raw logs pass through `scripts/lib/redact.mjs` before the
  put (tokens, JWTs, URL credentials, PEM blocks, `KEY=...` pairs, the secret names a repository's
  `.starcistacks` declares), and the row records `redacted = 1`.
- **Links.** `file_uri` is the absolute path at put time; `http_path` is `/api/blob/<sha256>`. The
  harness serves `GET/HEAD /api/blob/<sha>` with the stored media type, `ETag = sha`, immutable
  caching and `Range`; `text=head|tail&lines=` for logs; `410` with the archive reference after a
  blob was archived and swept.
- **GC.** Mark and sweep per ledger, never through an attached union: open a `gc_runs` row; for each
  registered ledger, read-only, select every column listed in its `blob_ref_columns` into
  `gc_marks`; do the same for machine; sweep a file only when it is unmarked in this run, unpinned in
  every database, archived, and older than 24 h (the grace against put-before-insert). Every item
  is a `gc_items` row with its outcome. `scripts/housekeeping/blob-gc.mjs` runs it (dry by default);
  an unmarked blob past the grace is first zipped to `<archive root>/blob-retention-<date>/`,
  re-read and re-hashed, recorded in `archives` and marked `archived_at` in every DB that holds it.
  An old-schema or unreadable source sweeps nothing (fail closed).
- **Blob retention (Q4).** Retention drops a reference from the mark set, never a row by itself:
  attempt prompt, transcript and session blobs (`op_attempts`, `sup_attempts`) stay while the
  workflow or Supervisor job lives, then 30 days for a `pass` verdict and 90 days otherwise;
  `attempt_transcript_snapshots` and `seat_transcript_snapshots` are pruned once the final
  transcript exists (`op_attempts.transcript_sha`, the seat's `agent_sessions.transcript_sha`),
  otherwise they follow the same windows (a seat has no verdict: 90 days); an `agent_sessions`
  transcript keeps 90 days after the session ends. A blob a Work record cites (`pinned = 1`) is kept
  forever.

## 6. `.starciwork`

`.starciwork` keeps what matters to the product and nothing about agents: Work records, SRS/SDS,
UI specifications, brand. `modules/schemas/work-layout.yaml` owns the explicit path list. A Work
record cites agent output by artifact id and sha256 (`work_citations`); the bytes are a blob.

## 7. Retention and purge

Rows stay while a workflow lives. A finished workflow is purged only as a unit, with the owner's
approval, by `scripts/work/purge-workflow.mjs`: the workflow's rows and referenced blobs are zipped to
`<archive root>`, the archive is re-read and verified entry by entry, `workflow_purges` records
the archive, and only then does `DELETE FROM workflows` cascade through every table of that
workflow. Blob files leave only through the GC sweep above. Machine sample tables keep 14–30 days,
`machine_logs` 14 days for debug and 90 days otherwise.

## 8. Refusal discipline

`modules/kernel/api.yaml` names every refusal a write verb prints, and
`scripts/checks/check-cli-parity.mjs` holds the two in step. A trigger refusal
(`workflow-transition-unrecorded`, `unit-try-budget-exhausted`, `unit-already-passed`, …) reaches the
caller as a typed reason: a routed fact, never an exception to route around.
