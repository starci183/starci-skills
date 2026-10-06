Task: read the runtime's storage
# Storage: `runtime.sqlite`, `machine.sqlite` and the blob store

The executed schemas are `engine/db/schema/runtime.sql` and `engine/db/schema/machine.sql`.
`engine/db/ledger.mjs` owns project schema validation; `engine/db/machine.mjs` owns host schema validation
and required physical objects. Each store has exactly one schema. A fresh machine store
executes `schema/machine.sql` and atomically sets its user_version. A host store that is not exactly that
schema (any other identity or version, or a missing, changed or extra object) is refused unchanged by writers and
readers alike; the operator replaces it with a fresh store. The current signal domains keep
Supervisor keys, tokens, values and expiries separate from core-debug enabled/diagnostic scopes.
These writers and their SQL files own the storage rules.

## 1. The layout

```text
<runtime root>/.runtime/projects/<ledger_id>/runtime.sqlite   one per project (its workflows' complete history)
<runtime root>/.runtime/machine.sqlite                        one per host (registry, Supervisor, engine, host state)
<runtime root>/.runtime/artifacts/<sha[0:2]>/<sha256>  +  <sha256>.json   one blob store (bytes; the DBs hold the index)
<runtime root>/.runtime/archive/                              session files, blob retention, ledger backups
<app>/.starciwork/                                           product content only, in git
```

- `<runtime root>` is the `.claude` of the host Source: the checkout, or the copy `starci runtime install` places at
  `<app>/.claude` inside the app's repository. `.runtime/` is host data: git-ignored (the installer adds `.claude/.runtime/` to the
  app's `.gitignore`), never in the npm package or the GitHub archive. `~/.starci/runtime/node_modules/starci` is only the CLI's
  download cache and holds no state. `engine/runtime-root.mjs` `starciLocalRoot` is the one owner of this path. The earlier
  `%LOCALAPPDATA%/StarCi` and `~/.starci/artifacts` stores are not read, copied or removed: the new location starts empty and the
  init owners create it.
- The state base follows the code's own location: a lane worktree, or a runtime that `STARCI_RUNTIME` or `starci runtime link`
  points elsewhere, resolves its own `<that root>/.runtime` and opens a different, empty store. `STARCI_LOCAL_ROOT` names one
  shared base when several roots must see the same state. Lane worktrees themselves default outside the checkout
  (`scripts/machine/home.mjs` `lanesRoot`).
- The blob writer (`engine/db/blob.mjs`) accepts a root outside every checkout, or one under the runtime's own `.runtime` whose
  directory the checkout's `.gitignore` (or `.git/info/exclude`) ignores, the last matching rule winning so a negation refuses;
  any other root inside a checkout is refused. In a `node --test` process tree an unset `STARCI_ARTIFACT_ROOT` resolves to a temp
  directory instead of the checkout.
- A project ledger is found through `machine.ledgers` (`ledger_id → file`), never by walking a
  repository. `meta.ledger_id` is minted at create and moves with the bytes.
- There is no other store. No JSON state file, no JSONL inbox, no text log, no second SQLite file.
- The writers refuse unsupported schema identities or versions. `openLedger` creates a fresh project
  store at `ledgerFileFor(<repo root>)`; `openMachine` creates a fresh host store at `machineFileFor`
  and validates an existing host store, refusing any store that is not exactly the current schema.
- `openLedger({fixture:{ledgerId,createdAt,blobRoot[,sqliteVersion]},file,checkpointer:true})` initializes a fresh
  sample through the same canonical schema and seeds. Its identity is in the reserved synthetic namespace
  validated by `engine/db/ledger-paths.mjs`; its clock is frozen and `blobRoot` is a portable relative path.
  The sample records the stated `sqliteVersion` (default the running one) so a tracked sample stays byte-stable
  across SQLite upgrades; a version newer than the running SQLite is refused like any ledger recorded by a newer SQLite.
  A sample accepts no repository, product, machine or cached project binding. Typed mutations and later
  writable opens refuse it before writer setup; read-only inspection remains available. A real project
  initializes its own store through its normal lifecycle instead of copying or registering sample bytes.
  The fixture descriptor and selected artifact roots are explicit producer inputs; metadata alone does not
  redirect blob readers. Selected reads use the existing per-call blob-root contract.
- `STARCI_LOCAL_ROOT` overrides the per-host state base (`<runtime root>/.runtime` itself, one shared helper:
  `engine/runtime-root.mjs` `starciLocalRoot`/`LOCAL_ROOT_ENV`, re-exported by `engine/db/machine.mjs` and honored by
  `engine/db/ledger.mjs` `projectsRootFor`) — `projects/`, `machine.sqlite`, `archive/` and `artifacts/` move under it. Narrower seams still win when set:
  `STARCI_PROJECTS_ROOT` (just the `projects/` directory), `STARCI_TEST_MACHINE_FILE` (the exact `machine.sqlite`
  file), `STARCI_ARTIFACT_ROOT` (the blob store, default `<state base>/artifacts`). A debug probe or throwaway repo
  that would otherwise leave a fake ledger in the real store (`skills/starci/references/host-maintenance.md` §5) must set
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
inspection) open read-only handles. For public host observation, `openMachineObserver` exposes a handle with
the read connection, metadata, in-memory recovery notices and close. Its typed queries reuse the operational
registry, service, seat, provider, log, metric and resource projections. It validates
supported host schemas and retains bounded retries and visible coded corruption diagnostics without
persisting incidents or recovery notices. `openMachineReader` and `readMachine` retain operational incident
and deferred recovery reporting. Project observers use `openLedgerReader` and must verify registry identity
at their consuming boundary.

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
Databases live on a local disk whose filesystem implements SQLite locking and sync correctly. Network shares,
NAS mounts and cloud-synchronized database directories are outside the supported placement. Root overrides do
not validate a filesystem's failure behavior. With WAL and `synchronous=NORMAL`, a process crash preserves
committed transactions, while power loss or a hard reset can roll acknowledged commits back. The runtime does
not promise zero data loss under those failures. See [SQLite WAL](https://www.sqlite.org/wal.html), reviewed
2026-10-04; physical power-loss behavior has no measured recovery bound in the runtime's private specs.

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
| Identity and vocabulary | `meta`, `ui_states`, `ui_state_map`, `blob_ref_columns`, `workflow_transitions`, `job_transitions` | One 7-value display state (`bad, warn, running, waiting, ok, done, unknown`) mapped from every native state; the only list of blob-referencing columns; the state machines as data. |
| Blobs | `blobs` | One row per sha256: bytes, media type, `redacted`, `file_uri`, and `http_path = '/api/blob/' \|\| sha256` as a generated column. |
| Workflow | `workflows`, `lifecycle_changes`, `goals`, `goal_inputs`, `workflow_purges` | `trace_id` per workflow; the 7 phases (`awaiting-approval, queued, running, paused, stopped, finished, archived`); a phase changes only along `workflow_transitions` and only with a matching `lifecycle_changes` row. Goals keep the markdown a relaunch reads. |
| Work graph | `work_graph_versions`, `work_units`, `unit_edges` | One unit per `(workflow, op, subject_key, goal_revision)`; a try budget per unit (default 5, raised only with `budget_raised_by/ref`); a done unit reruns only through a recorded reopen. |
| Execution | `jobs`, `op_attempts`, `contracts`, `resources`, `leases`, `api_requests` | A job's status moves only along `job_transitions`; an attempt row is created only when its job has just gone `ready → leased` in a running workflow; `retry_of` points only at a failed job of the same unit with `try_no = parent + 1`; a job that ends drops its leases. Contracts are keyed by attempt, so a re-dispatch never overwrites the previous one. |
| Results | `reports`, `check_runs`, `settle_tails`, `job_artifacts`, `attempt_transcript_snapshots`, `report_attachments`, `artifact_proofs`, `work_citations`, `interface_audits`, `llm_usage` | One immutable report per attempt; one check row per `(attempt, runner, phase, name, run_seq)` with the raw `exit_code` separate from `declared_exit_code` and no `pass` with a nonzero raw exit; immutable artifacts keyed by `(attempt_id, name)`; Work citations by artifact id and sha256. Token counts only; no estimated cost. |
| Coordination | `inbox`, `decision_items`, `decisions`, `conditions`, `incidents`, `foundations`, `foundation_declarations`, `path_transfers`, `record_changes`, `signals` | Decision Item keys have no empty part; conditions follow the Kubernetes shape (`type`, `status True/False/Unknown`, `reason`, `owner`); an incident has a kind from a closed list, an owner, a due time, and a reason when closed; finishing a workflow closes its incidents. |
| Observation | `events`, `logs`, `logs_fts`, `log_cursors` | Append-only (UPDATE refused; DELETE only during a purge, or for debug logs past retention); full-text search over logs; an archived workflow accepts no new event. |

Views: `v_attempt_state`, `v_op_history`, `v_units`, `v_checks`, `v_decision_rows`, `v_media`,
`v_record_evidence`, `v_timeline`, `v_workflow_progress`, `v_model_scorecard`, `v_settle_overdue`,
`v_ledger_leaks`, `v_blocking`, `v_open_work`, `v_search_ids`, `v_live_marks`, `v_blob_refs`.
Each view that shows an entity carries its `ui` state. `v_decision_rows`, `v_blocking` and `v_open_work` never
list a live row of an ended workflow (`phase` `archived`|`finished`; a missing `workflows` row still counts as
live) — `v_decision_rows` keeps the ended workflow's resolved history.

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
| Identity and registry | `machine_meta`, `ui_states`, `ui_state_map`, `blob_ref_columns`, `ledgers` (the only ledger registry), `repositories`, `agents`, `models`, `blobs`, `archives`, `gc_marks` |
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
- **GC capability.** `scripts/housekeeping/blob-gc.mjs` plans retention read-only across each registered ledger and machine reference catalog. Missing applicable tables/columns, an unreadable source or an archive whose recorded identity/exact blob-entry digest fails verification blocks the plan. Destructive `--apply` is unsupported and returns nonzero without opening writers, archiving, pruning rows or deleting bytes: the existing GC lock serializes GC processes but ordinary cross-store reference writers do not consume a deletion fence, so an old sha can be reused after marking. A rescan does not prove that race safe. Originals remain; blob disk usage has no enforced upper bound. Worktree and job cleanup are separate owners and remain available.
- **Blob retention (Q4).** Retention drops a reference from the mark set, never a row by itself:
  attempt prompt, transcript and session blobs (`op_attempts`, `sup_attempts`) stay while the
  workflow or Supervisor job lives, then 30 days for a `pass` verdict and 90 days otherwise;
  `attempt_transcript_snapshots` and `seat_transcript_snapshots` stop marking once the final
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
workflow. Automatic workflow purge requires current explicit `retention.workflowPurge` adoption for its exact repository; the shipped default grants none. The approved workflow ZIP purge remains available within the supported archive envelope; blob files are retained while destructive blob GC is unsupported. Machine sample tables keep 14–30 days,
`machine_logs` 14 days for debug and 90 days otherwise.

ZIP I/O supports at most 4096 entries, 64 MiB compressed/uncompressed per entry, 256 MiB compressed archive/total uncompressed payload and 1024-byte names. Options can reduce these caps. Verification reads positional records and inflates one entry at a time through `zipVisit`; workflow purge verification retains only entry metadata/digests, and archive hashing streams through the existing digest owner. Invalid bounds, duplicates, encryption/data descriptors, ZIP64, excessive output and truncation refuse before workflow deletion. Compression is synchronous; these byte caps do not establish a hard CPU deadline or an end-to-end RTO.

The output cap and positional I/O APIs are documented by [Node.js zlib](https://nodejs.org/download/release/v22.15.1/docs/api/zlib.html) and [Node.js File system](https://nodejs.org/docs/latest-v24.x/api/fs.html), reviewed 2026-10-04.

Blob publication flushes temporary bytes/metadata before linking and hashes reused bytes before returning. A corrupt same-size destination or invalid sidecar refuses acknowledgement. Publication directory/link persistence and SQLite NORMAL remain dependent on the local filesystem, operating system and hardware; no power-loss guarantee for an acknowledged blob/DB reference is established.

Repository identity preserves case on POSIX and uses the existing Windows case-insensitive policy. Case-sensitive Windows directories and synchronized/network storage are outside this profile.

### Recovery scope

The Host controller snapshots individual project ledgers through `scripts/reconciler/ledger-health.mjs`.
It uses SQLite `VACUUM INTO`, checks the output's pages, supported schema and ledger identity, hashes and
syncs the snapshot bytes, publishes the file, then applies that ledger's snapshot retention. The active child
receipt records the file, digest and identity. A failed or shadow action does not advance backup success.
An output-verification or publication failure preserves older snapshots. Filesystem sync and rename still
depend on the operating system and storage hardware; these checks establish a usable snapshot under the
observed conditions, not a physical power-loss guarantee. [SQLite VACUUM](https://www.sqlite.org/lang_vacuum.html)
defines the snapshot semantics; reviewed 2026-10-04.

These snapshots exclude `machine.sqlite`, blob bytes, Git refs and repository files, owner configuration,
secrets, provider sessions and external effects. The default backup directory shares the local state root's
failure domain. Full host/disk-loss recovery, a consistent multi-store export/import and an off-host backup
service are unsupported capabilities. No recovery-point or recovery-time bound has been measured for them;
the nightly schedule alone supplies neither an RPO nor an RTO guarantee.

Recovery is manual. Preserve the original database and WAL, resolve compatibility or access failures first,
and stop every writer before restoring an owner-selected verified snapshot. Inspect its identity, schema,
digest and creation time against the retained receipt and accept the explicit loss window. Before resuming,
reconcile the restored project state with the current machine registry, Git checkpoints, evidence bytes and
provider/external effects; a lost acknowledgement can leave an effect that the restored ledger does not show.
An unidentified database is retained for diagnosis rather than replaced by an empty store.

A repository clone carries Work records and citations. Host-local ledger rows and blob bytes must be made
available separately or their verification must be rerun. A citation whose backing bytes are unavailable is
missing proof; a Git revision alone cannot make that evidence portable. Machine action, probe and metrics
histories also have no general archive/retention budget; the machine log retention helper does not establish
a bound for those other tables.

## 8. Refusal discipline

`modules/kernel/api.yaml` names every refusal a write verb prints, and
`scripts/checks/check-cli-parity.mjs` holds the two in step. A trigger refusal
(`workflow-transition-unrecorded`, `unit-try-budget-exhausted`, `unit-already-passed`, …) reaches the
caller as a typed reason: a routed fact, never an exception to route around.
