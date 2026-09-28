# Changelog

All notable changes to StarCi are documented here. The project is pre-publication on the
`1.0.0-alpha.N` line: contracts are provisional until every S* row in
`.experiments/OPENSOURCE-GOAL.md` holds with fresh evidence, then `1.0.0` freezes them.
`package.json` `version` is the only version authority.

## [1.0.0-alpha.4] — in preparation

- The comeback concept is removed: `scripts/supervisor/comeback.mjs` is deleted and listed in
  `modules/kernel/retired-paths.yaml`; `COMEBACK_HINT` and every comeback pointer are gone from
  `engine/ledger-db.mjs`, `engine/machine-db.mjs`, the reconciler schedules, the supervisor home, the
  `.starciwork` boundary, `modules/schemas/work-layout.yaml` and `docs/ledger-db.md`. An old-schema store is
  still refused — a fresh `runtime.sqlite` is created by `openLedger` at the file
  `ledgerFileFor(<repo root>)` resolves (the host store by `openMachine`), each on first use once the refused
  file is moved aside; archiving an old store is a manual owner act. `archives.kind` drops `'comeback'` for
  new stores. Contract change `comeback-removed`.

## [1.0.0-alpha.3] — 2026-09-28, base `7b2737d2e`

Theme: one storage architecture that is easy to query and hard to corrupt. All state lives in two
SQLite databases, each with one writer module, plus one content-addressed blob store; the state
machines and the bug classes found by the 2026-09-28 log audits (H1–H17, MB-01..17) are refused by
the schema itself. Clean slate: there is no migration, backfill, v2 table or read fallback. The
comeback (`scripts/supervisor/comeback.mjs`) archives and wipes the old stores; the runtime refuses
an old-schema file with a pointer to it. Design: `docs/architecture.md`, `docs/ledger-db.md`,
`docs/debugging.md`; contract change `alpha3-release`.

**Storage: two databases and a blob store**

- `runtime.sqlite`, one per project, now lives at `%LOCALAPPDATA%/StarCi/projects/<ledger_id>/runtime.sqlite`
  (resolved through `machine.ledgers`), outside every repository. Schema
  `engine/migrations/runtime/0001-init.sql` (`starci/runtime@1`, `user_version` 1, STRICT, `json_valid`
  everywhere); the only writer is `engine/ledger-db.mjs`, with typed write functions per table group,
  the event digest chain computed in JS, idempotency through `api_requests`, and W3C `trace_id` /
  `span_id` on every write.
- `machine.sqlite`, one per host, at `%LOCALAPPDATA%/StarCi/machine.sqlite`. Schema
  `engine/migrations/machine/0001-init.sql` (`starci/machine@1`); the only writer is
  `engine/machine-db.mjs`, which also owns the ledger registry (`registerLedger`, `resolveLedger`,
  `listLedgers`, `forEachLedger`).
- Blob store `~/.starci/artifacts/<sha[0:2]>/<sha256>`; `blobs.http_path` is a generated column.
  `scripts/lib/redact.mjs` is the one redaction module, applied before every blob put and every log
  write. `scripts/lib/blob-lookup.mjs` turns a citation back into bytes.
- Connection policy: WAL verified, `synchronous=NORMAL`, `foreign_keys=ON`, `busy_timeout` 15 s,
  `trusted_schema=OFF`, one checkpointing connection (the engine), read-only `query_only` readers,
  the SQLite version recorded in meta.
- The land gate runs `scripts/checks/check-db-openers.mjs`: no `new DatabaseSync` on a ledger outside
  the writer and reader modules.
- Vocabulary: a **unit** (`work_units`) is one step; a **job** is one try (`try_no`, `retry_of`); an
  **attempt** (`op_attempts`) is one dispatch (`dispatch_seq`), with its contract, report, check runs,
  artifacts, prompt, final transcript and 60 s scrollback snapshots.
- Agent output leaves `.starciwork`: reports only in `reports`, checks in `check_runs` (raw
  `exit_code` apart from `declared_exit_code`), attachments, captures, UAT runs, draw loops, layout
  captures and ask answers as blobs plus rows. A Work record cites them by artifact id and sha256
  (`work_citations`, `scripts/kernel/work-citations.mjs`, check `CITATION_UNRESOLVED`).
  `.starciwork` holds product content only (`scripts/lib/starciwork-boundary.mjs`,
  `work-layout.yaml shape.productPaths`); `check-example-work` refuses agent data in it.

**Retired stores** (archived and deleted by the comeback; no code reads or writes them)

- The Supervisor ledger `~/.starci/supervisor/.starciwork/runtime.sqlite` → `sup_*` tables, `seats`,
  `deliveries` and `machine_logs`.
- `reconciler.sqlite`, `reconciler.heartbeat`, `reconciler-starts.json`, `reconciler.log` →
  `engine_leader`, `leader_history`, `process_runs`, `engine_queue`, `engine_actions` (full result,
  stdout and stderr as blobs), `controller_modes` + `mode_changes`, `sla_episodes`,
  `invariant_violations`, `services` + `service_events`.
- `journal.sqlite` (no writer since `c2a3ccf92`), `logs.sqlite`.
- JSON state: `ram-throttle.json`, `gc-state.json`, the land queue directories, `connectors/`,
  `env-servers/`, `uat-slots/`, footprints → `throttle_*`, `pool_backoff`, `gc_runs`/`gc_items`,
  `land_queue`/`land_runs`/`pushes`, `connectors`/`host_locks`/`notifications`/`sup_messages`,
  `env_servers`, `uat_slots`, `host_samples`.
- Text logs (`supervisor/logs/*.log`, watchdog logs, connector logs) → `machine_logs` with FTS5.
- `.starciwork/kernel-evidence/**`, `kernel-strays/**`, `E/**`, `runs/**`, impl `assets/`, draw loops,
  settle caches → blobs and rows.
- Deleted code: `engine/schema.sql`, `engine/evidence.sql`, `engine/triggers.sql`, `engine/machine.sql`;
  every migrator and backfill (`scripts/migrate/evidence-to-blobs.mjs`,
  `scripts/work/{backfill-artifact-subkind,backfill-job-artifacts,backfill-patch-json,backfill-work-graph,migrate-logs-into-ledger,migrate-runtime}.mjs`,
  `scripts/route/backfill-plan-edges.mjs`); `scripts/kernel/prune-registry.mjs`,
  `scripts/kernel/report-owner.mjs`; `scripts/checks/check-work-history.mjs`,
  `scripts/checks/check-work-replay.mjs`; the retry-lineage helpers. All listed in
  `modules/kernel/retired-paths.yaml`.

**Workflow phases and the Kernel API**

- Seven phases: `awaiting-approval, queued, running, paused, stopped, finished, archived`.
  `workflow_transitions` and `job_transitions` are data; triggers refuse any other transition, and a
  phase change without its `lifecycle_changes` row.
- New verb `api lifecycle --pause | --stop | --resume`. Only the owner resumes a stopped workflow
  (`stopped → queued`); no controller, Kernel or Supervisor resumes one (Q14, MB-08).
- New verb `api unit`: a unit's try budget (default 5) is raised only by the owner or the Supervisor
  (`--raise-budget`, with a reference). Re-running a passed unit needs `enqueue --reopen <reason>`.
- `api report` reads the report from the job scratch (`STARCI_JOB_SCRATCH`) once, stores it only in
  `reports`, turns `--attach` files into blobs, then deletes the scratch.
- `api check` re-runs runtime checks into `check_runs`; any other command is recorded as `declared`
  and never counts green.
- Dispatch writes one `op_attempts` row plus its contract per dispatch; leased → running is a
  compare-and-set on the lease token.

**Hidden bugs fixed** (LOG-AUDIT-PROJECTS, LOG-AUDIT-MACHINE)

- H1: the settler settles what raw evidence decides, without the Kernel; an overdue settle is a
  `v_blocking` / `v_settle_overdue` row. H3/H5: try budget per unit, one unit per (op, subject, goal
  revision), no re-run of a passed unit without a reopen. H4: `retry_of` only to a failed try of the
  same unit. H6: the canon slice planner is mandatory (`scripts/kernel/canon-plan-gate.mjs`). H7: an
  unavailable checker is never red. H8: verdicts use the raw exit code. H9: archive keeps reported
  jobs; dispatch needs ready → leased and a running workflow. H10: reports and artifacts are
  immutable. H11: a stalled Kernel is replaced after 3 wakes without a move. H12: leases, incidents
  and running rows close through their owner and expiry. H13: an infrastructure dispatch failure does
  not spend a try. H14: a dead worker without a report is settled by the worker-health probe.
- MB-01: duty schedules persist in `schedules`. MB-02: a Supervisor Decision Item wakes the seat.
  MB-03: push refusals keep the full output as a blob and a stable signature. MB-04: the engine keeps
  its lease while draining; ensure never kills a draining engine. MB-05: a seat that refuses input 3
  times is replaced. MB-07: DI keys refuse empty parts. MB-10/12: a busy gate and a push-owed land are
  recorded outcomes. MB-11: the Telegram bridge survives an unreadable config. MB-13/14/16: GC matches
  ownerless terminals to lanes, retries after the grace window, records every outcome; test fixtures
  live under %TEMP%. MB-15: the throttle refuses a write from an older runtime rev.
- New SLA codes `TRANSCRIPT_MISSING`, `SEAT_DEAF`, `SETTLE_OVERDUE`.

**Reconciler, GC and the comeback**

- `gc:blob-sweep` (24 h): mark and sweep per ledger through `blob_ref_columns` into `gc_marks`, 24 h
  grace, archive before delete, retention 30 days for a passed attempt and 90 days otherwise (Q4).
  `host:transcripts` (60 s): scrollback snapshots of open attempts and seats.
- Housekeeping is the only purger of ended workflows: 30 days, zipped and verified first (Q6).
- `scripts/supervisor/comeback.mjs`: dry run by default; `--apply` refuses unless every workflow is
  stopped, every controller is in shadow and the engine holds no lease; zips and verifies every old
  store, deletes only verified paths, marks Work records with broken citations stale (Q12), creates
  the fresh databases and prints the relaunch list. It never touches `.starcistacks`, secrets or
  `~/.starci/prod.pw`. It has not been applied to live data.

**Docs, examples and hygiene**

- Rewritten: `docs/architecture.md`, `docs/ledger-db.md` (storage), `docs/supervisor.md`,
  `docs/workflow-kernel.md`, `docs/connectors.md`; new `docs/debugging.md` with the ten standard
  questions and their SQL, verified against the alpha.3 schema. CONTEXT, README, the entry skills and
  `init/AGENTS.md` name the ledger outside `.starciwork`.
- `.starcistacks` is the only stack root: the pre-rename `.stacks` root, `STACKS_LEGACY_ROOT` and
  `STACKS_DUAL_ROOT` are gone.
- The example trees cite their UAT runs and captures by sha256 (`work/evidence@1` `run` is a blob
  citation object); evidence whose record or code digest moved is marked stale with a reason.

**Known gaps in this release**

- The harness UI does not load: `ui/server.mjs`, `ui/supervisor.mjs` and `ui/reconciler.mjs` still
  import removed APIs (the Supervisor ledger helpers and the old reconciler state exports). The
  owner's Codex UI rewrite replaces them; `check-db-openers` keeps `ui/reconciler.mjs` pending.
- Specs are still red on fixtures seeded with the pre-alpha.3 schema (old `jobs.attempt`,
  `result_json`, `state_snapshots`, `checks`, the Supervisor ledger, workflows moved to `running`
  without a `lifecycle_changes` row). A full `npm test` run on main at `92680638d` (with `node_modules`) had 663 failing tests
  in 158 spec files, out of 2,637 tests. Most seed the pre-alpha.3 schema; a few assert shapes that
  alpha.3 changed (blob check output, cited layout captures). Files and failing-test counts:
  `admission` (2), `agent-exited-liveness` (4), `agent-trust` (2), `allocation-balance` (4), `api-status-perf` (3), `app-router-owned-paths` (2), `application-stacks-integration` (1), `artifact-subkind` (1), `ask-auto-accept` (7), `ask-kinds` (7), `assisted-uat-contracts` (1), `assisted-uat-runner` (1), `autopilot` (5), `benchmark-snapshot` (4), `canon-slice-wire` (1), `check-api-surface` (2), `check-host-boundary` (1), `check-op-manifest` (3), `check-orca-tree` (14), `check-starcistacks` (1), `codex-unattended-ops` (3), `config` (1), `connectors` (6), `contract-freeze` (4), `contract-rollout` (3), `cut-seam-stub` (7), `cut-set-integration` (2), `dead-worker-recovery` (12), `dead-worker-self-heal` (13), `decisions-doorbell` (1), `decisions-first` (1), `decisions-verb` (1), `devin-capacity-circuit` (2), `dispatch-handshake` (3), `dispatch-host-resources` (1), `dispatch-path-lease-wait` (4), `dispatch-prerequisites` (3), `dispatch-target-repo` (4), `display-names` (4), `draw-acceptance` (2), `draw-loop-dna` (1), `draw-owner-feedback` (5), `draw-real-components` (1), `draw-review` (11), `foundations` (4), `gate-attribution` (7), `gate-conditions` (14), `goal-entry` (3), `grammar-context` (1), `grammar-knowledge` (1), `greenfield-lockup` (1), `handover` (5), `harness-contract` (3), `heroui-alert-asset` (1), `implement-dead-worker-environment` (1), `input-draft` (3), `interface-audit-contract` (1), `job-settle-parity` (1), `json-exceptions` (1), `kernel-api` (22), `kernel-bridges` (7), `kernel-group` (1), `kernel-launch-readiness` (1), `kernel-observe` (5), `kernel-replace-close` (1), `kernel-runtime-rev` (3), `kernel-wake-delivery-proof` (10), `kernel-watchdog` (1), `launch-grace-liveness` (7), `layout-destinations` (2), `layout-tree` (3), `layout-tree-i18n-keys` (1), `lease-canonical-paths` (2), `leased-launch-abandoned` (4), `ledger-db` (13), `ledger-schema-parity` (2), `ledger-shape` (3), `liveness-busy-cards` (6), `managed-dispatch` (18), `managed-repos` (2), `model-scorecard` (2), `nudge-delivery-proof` (5), `op-ipc` (15), `op-ledger-boundary` (3), `op-params` (1), `op-work-paths` (3), `orca-host-outage` (14), `orca-run-rebind` (3), `orca-tasks-reconcile` (4), `orchestration-question-bridge` (5), `owner-answers` (5), `owner-claim` (2), `peer-messages` (7), `peer-wait` (16), `plan-edges` (1), `pool-slot-route-hold` (3), `prior-attempt-failures` (3), `product-worktree` (1), `progress-report` (1), `prompt-delivery-stalled` (4), `provider-health-recover` (4), `provision-unstick` (1), `push-gate` (3), `qwen-base-pool` (5), `qwen-loop-gate` (1), `reconciler-engine` (1), `reconciler-gc` (1), `reconciler-job` (9), `reconciler-pool-backoff` (1), `reconciler-sla` (1), `reconciler-worker-health` (1), `reconciler-workflow` (5), `route-lineage` (10), `route-model` (1), `runtime-tree-hygiene` (2), `safe-remove` (1), `schema-catalog` (2), `serve-ask-lifecycle` (7), `serve-ask-port-band` (2), `settle-landed` (10), `settle-next-step` (11), `settle-session-release` (5), `settle-target-repo` (6), `shared-checkout-guard` (1), `sonar-local` (2), `staged-input-liveness` (3), `stale-active-liveness` (3), `stale-active-unreachable` (6), `stale-input` (9), `stall-parked-frontier` (4), `start-workflow-restart` (2), `status-api-units` (1), `strategy-pools` (3), `supervisor-bridge` (5), `supervisor-gate-hold-wait` (3), `supervisor-kernel` (1), `supervisor-lessons` (1), `supervisor-owed` (12), `supervisor-owed-ack` (4), `supervisor-poll` (12), `supervisor-stall` (10), `telegram-bridge` (3), `telegram-media` (8), `terminal-create-recovery` (5), `terminal-dedupe` (2), `typed-logs` (3), `verdict-contract` (5), `verify-reliability` (7), `waiter-priority` (5), `work-debt-adopt` (3), `work-graph` (3), `work-graph-runtime` (3), `work-landed` (11), `work-peer-drift` (4), `work-record-schemas` (1), `worker-death-resilience` (1), `worker-question-inactive` (2), `workflow-archive` (4).
- A real reconciler pass (`engine.mjs --once`) takes about 2 min 40 s, longer than the 120 s cap of
  the `reconciler-engine` CLI spec.
- The Orca live paths are not yet exercised on the new schema: a live worker attesting to running,
  the dead-worker requeue on a real terminal, and transcript capture from a real terminal.
- The live owner `config.yaml` still carries the ignored `quota.qwen` keys `planQuota`, `unit`,
  `calibratedRemainingPercent`, `calibratedAt`; `engine/config.mjs` keeps accepting them until the
  owner removes them.

## [1.0.0-alpha.2] — in preparation, base `f87a8f34b`

Theme: canonical files say one thing, once, in the present tense. Every rule lives in exactly
one place and every other surface cites it. Working notes are in `fable.md`.

**Version line**

- `2.0.0` → `1.0.0-alpha.2`. The `v2.x`/`v6.x` git tags belong to the previous `@starci/skills`
  package, not to this runtime. `package.json` `version` is the only version authority.
- `CONTRIBUTING.md` carries the six rules that define the bar for a contract or prose edit.

**One authority per fact**

- `modules/kernel/api.yaml` is the verb surface: it names every verb `scripts/kernel/api.mjs`
  implements, and `bin/starci.mjs` and the docs cite it.
- Blocker kinds, report outcomes, effort vocabulary and job status each live in one place.
  `normalizeOwnedPath`, `readOwnerConfig` and the queued→running phase transition each have one
  implementation.
- `modules/models/runtimes.yaml` owns concurrency and the fleet's time windows; retry counts,
  watchdog cadence and observe interval are data there rather than prose repeated per file.
- `modules/schemas/index.yaml` catalogues every schema stamp, and
  `scripts/checks/check-schema-catalog.mjs` keeps it complete.

**Contracts tell the truth**

- Every documented refusal in the kernel contracts is one the code prints; the rest are removed.
- Every `citation:`/`enforcedBy:`/`source:` names a file and symbol that exist, enforced by
  `scripts/checks/check-contract-cites.mjs`; `scripts/checks/check-api-surface.mjs` holds the verb
  surface to the code.
- `modules/host/orca/calls.yaml` describes what the wrappers do today.
- `modules/kernel/dispatch.yaml` points at `modules/schemas/goal-plan.yaml` for the plan shape.

**The retired execution model is gone**

- Coordinator, matrix, cell, secondary-type and solo-mode vocabulary is removed from
  `modules/models/`, `modules/host/` and `modules/ops/_common.yaml`.
- `.json` ghosts (`registry.json`, `runtimes.json`, `config.json`, `goal-plan.json`) are gone from
  contracts, engine error strings and checks.

**Evidence and checks**

- `scripts/checks/check-evidence-binding.mjs` makes QUALITY-BAR §5 executable: a `done` claim needs
  an artifact that exists with a matching digest.
- `npm run check` (syntax, ops registry, host contract) plus `npm test` gate every push and PR;
  `ci.yml` runs them.
- Ten unreachable `scripts/api/orca/` wrappers, three `scripts/agent/` CLI shells and two orphan
  checks are deleted; the Orca test stub is shared and the landed-lane skip guards are gone.
- Generated example coverage trees are untracked.

**Examples**

- `todo-app-example.yml` runs the checks that exist; the committed age key is documented as a demo
  key that encrypts demo values only.

## [1.0.0-alpha.1] — 2026-09-22, snapshot at `614e67d55`

The tree is a clean open-source layout. Headline changes:

- **Architecture settled:** one long-lived `[Kernel]` LLM agent per workflow; all state mutation
  goes through `scripts/kernel/api.mjs` (`survey|status|plan|enqueue|dispatch|settle|incident|finish`);
  one ephemeral `[Op]` agent per job spawned via provider adapter cards.
- **State:** single sqlite ledger at `.starciwork/runtime.sqlite` (`engine/ledger-db.mjs` +
  `engine/schema.sql`/`machine.sql`).
- **Mechanism/data split:** mechanism code under `engine/`; contracts as YAML data under
  `modules/`; executables under `scripts/{goal,kernel,route,agent,api,context,checks,example,install}/`;
  provider facts (data only) under `providers/`.
- **Install:** `scripts/install/install.mjs` + thin `bin/starci.mjs`
  (`init|update|doctor|version|api|start|goal`). Installer seeds untracked `config.yaml` from
  `config.example.yaml`, writes the `AGENTS.md` bootstrap, and installs the `define-goal` /
  `start-kernel` entry skills into host skills directories.
- **Entry skills ship in the package:** `skills/define-goal/`, `skills/start-kernel/` — a fresh
  install has a lifecycle entry out of the box.
- **Dispatch hardening:** dispatch attests terminal + prompt + first model activity before marking
  a job `running`; settle closes the worker terminal; re-plans persist lineage in the ledger.
- **Packaging:** `files[]` is a source allowlist; `schemas/` is folded into `modules/schemas/`.
- **Docs:** README rewritten; CONTRIBUTING.md and this changelog added; `docs/` describes the
  current architecture.
