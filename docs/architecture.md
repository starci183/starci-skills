# Architecture

StarCi is a source-only runtime installed under a host's `.claude/`. One owner goal becomes one
workflow. One workflow is driven by **one long-lived Kernel agent**; each unit of work is run by
**one ephemeral op agent** per dispatch. Every durable fact lives in exactly one of **two SQLite
databases**, and every byte of agent output lives in **one content-addressed blob store**. The
Kernel reasons; small executables transact; one host engine does the mechanical work.

```text
                     owner (chat, Telegram)
                         │  define-goal / start-kernel / answers
                         ▼
   ┌────────────── Kernel seat (one per workflow) ─────────────┐
   │  reads Decision Items, decides, calls scripts/kernel/api.mjs│
   └───────────────┬────────────────────────────────────────────┘
                   │ api verbs (one transaction + one event each)
                   ▼
   runtime.sqlite (one per project)  ◄── engine/ledger-db.mjs (the only writer)
                   ▲                                   │
   op agents ──────┘ api report / log / op-contract    │ blobs put first, then the row
                                                       ▼
                                  ~/.starci/artifacts/<sha[0:2]>/<sha256>
                                                       ▲
   reconciler engine (one per host) ──► machine.sqlite ◄── engine/machine-db.mjs (the only writer)
     Job, Workflow, Resource, Host, GC, Fleet, Learning controllers
                                                       │
   harness UI (ui/server.mjs) ── read-only handles on both DBs and GET /api/blob/<sha>
```

## Storage: two databases and a blob store

| Store | Where | Holds | Only writer |
| --- | --- | --- | --- |
| `runtime.sqlite` | `%LOCALAPPDATA%/StarCi/projects/<ledger_id>/runtime.sqlite`, one per project, resolved through `machine.ledgers` | workflows, goals, work units, jobs (tries), op attempts (dispatches), contracts, leases, API idempotency, reports, check runs, artifacts, citations, conditions, Decision Items, decisions, incidents, events and logs | `engine/ledger-db.mjs` |
| `machine.sqlite` | `%LOCALAPPDATA%/StarCi/runtime/machine.sqlite`, one per host | the ledger and repository registry, the Supervisor (`sup_*`), the reconciler engine (`engine_*`, process runs, leader history, schedules, controller modes, SLA episodes), services, seats and deliveries, terminals, worktrees, throttle, provider health, quotas, GC, land queue and pushes, machine logs and metrics | `engine/machine-db.mjs` |
| blob store | `~/.starci/artifacts/<sha[0:2]>/<sha256>` (`STARCI_ARTIFACT_ROOT` overrides) | redacted transcripts and scrollback, prompts, check stdout/stderr/output, patches, images, videos, renders | `scripts/lib/artifact-store.mjs`, called by the two writers |

Rules that hold everywhere:

- **One writer module per database.** Verbs, the settler, controllers and `define-goal` call named
  functions of the writer; nothing else opens a database for writing. The land gate refuses
  `new DatabaseSync` on a ledger outside `engine/`.
- **One transaction, one event.** Each state change is one `BEGIN IMMEDIATE` transaction that also
  inserts one `events` row. No process spawn, Orca call or blob put happens inside a transaction:
  the blob is put first, then the row that cites it is written.
- **The state machines live in the database.** `workflow_transitions` and `job_transitions` are data,
  and triggers refuse every transition they do not list, whatever the calling code does. Reports and
  artifacts are immutable; histories are append-only.
- **No JSON state files and no text logs.** A fact that used to live in a JSON file or a log is a row.
- **`.starciwork` holds product content only**: Work records, SRS/SDS, UI specifications and brand.
  Agent output lives in SQL and blobs; a Work record cites it by artifact id and sha256.

The schema itself is data: `engine/migrations/runtime/0001-init.sql` and
`engine/migrations/machine/0001-init.sql`. See [storage](ledger-db.md) for the tables and
[debugging](debugging.md) for the queries that answer "why is this stuck".

## Roles

| Actor | Lifetime | What it does | What it never does |
| --- | --- | --- | --- |
| Owner / chat | — | Creates the goal (`define-goal`), starts the Kernel (`start-kernel`), answers asks, approves. As the workflow monitor a chat relays; asked to supervise, it works as the Supervisor. See `CONTEXT.md`. | Never plans, enqueues, dispatches, settles or answers an ask on the owner's behalf inside the Kernel's loop. |
| `[Kernel] <workflow>` | One per workflow, long-lived | Decides the plan, non-green verdicts, incidents and the finish. Reads its Decision Items first on every wake, acts through `scripts/kernel/api.mjs`, then yields. | Never opens a database, spawns a terminal or calls Orca directly. Never raises a unit's try budget. |
| `[Op] <op-id>` | One per dispatch, ephemeral | Reads its contract (`api op-contract`), works inside its `owned_paths`, logs with `api log`, files one `api report`, and is closed. | Never sees the ledger beyond its own attempt; its report is its only channel back. |
| Reconciler controllers | One host engine | Mechanical, idempotent work: settle green reports, recover dead workers, dispatch ready work, keep seats and services alive, GC, land and fleet digests. Open a Decision Item when judgment is needed. | Never make a business or workflow decision; never resume a `stopped` workflow. |
| Supervisor | One seat (chat or Orca terminal) | Runtime-maintenance authority: decides Supervisor Decision Items, fixes `.claude` through lanes and `scripts/supervisor/land.mjs`, may raise a try budget. | Never dispatches an op, writes a product ledger, or answers an owner gate. |
| Harness UI | One process | Serves the read-only views of both databases and `GET /api/blob/<sha>`. | Never writes, never calls an API verb, never talks to Orca for a closed terminal. |

## Vocabulary: unit, job, attempt

- A **unit** (`work_units`) is one logical step: one op on one subject for one goal revision. It has
  a try budget (default 5; only the owner or the Supervisor raises it, with a reference).
- A **job** (`jobs`) is one try of a unit with concrete input. A business retry is a new job with
  `try_no + 1` and `retry_of` pointing at the failed job of the same unit.
- An **attempt** (`op_attempts`) is one dispatch of a job into a terminal. A re-dispatch after a
  dead worker is `dispatch_seq + 1` on the same job and does not consume the try budget.

Every attempt carries a W3C `span_id` under the workflow's `trace_id`. The op's environment has
`STARCI_LEDGER_ID`, `STARCI_WORKFLOW_ID`, `STARCI_ATTEMPT_ID`, `STARCI_DISPATCH_ID` and
`TRACEPARENT`, so every log, check and artifact it produces joins back to the attempt.

## Workflow phases

```text
awaiting-approval ──► queued ──► running ──► finished ──► archived
        │               │          │  ▲
        │               │          ▼  │
        │               │        paused
        ▼               ▼          │
      stopped ◄─────────┴──────────┘ (from queued, running or paused)
        │
        ├──► queued      (owner only: api lifecycle --resume)
        └──► archived
```

- `paused` is temporary. The seat is `parked` with a reason, and a controller may return the
  workflow to `running` when the reason clears (for example RAM pressure).
- `stopped` is the owner's. Only the owner stops a workflow, and only the owner resumes it
  (`stopped → queued`). No controller resurrects a stopped or paused workflow on its own judgment.
- Every phase change writes a `lifecycle_changes` row (who, why, when) in the same transaction; the
  `workflows_phase_guard` trigger refuses a change without one. Finishing or archiving a workflow
  closes its open incidents; an archived workflow accepts no new events or jobs.

## The Kernel API: `scripts/kernel/api.mjs`

```text
node scripts/kernel/api.mjs <verb> --repo <path> [...]
```

`modules/kernel/api.yaml` and `modules/kernel/api-commands/<verb>.yaml` name every verb with its
arguments, reads, writes and refusals; `scripts/checks/check-api-surface.mjs` keeps them in step with
the code. A write verb records its request in `api_requests` (idempotency), runs one transaction and
appends one event. A refusal exits non-zero with `{ok:false, reason}`: a routed fact, never a crash.
`dispatch --spawn` is the only place an op terminal is born, through `scripts/agent/lib.mjs` and the
agent card `modules/models/agents/<agent>.yaml`.

The op lifecycle is `enqueue → route → dispatch → api report → api check → api settle`, and every
step is a column of the attempt row (`routed_at`, `dispatched_at`, `reported_at`, `checked_at`,
`settled_at`, `released_at`). The op's own claim (`report_outcome`) and the runtime's verdict
(`verdict`) are separate columns; a check's raw exit code (`exit_code`) is separate from the one the
op declared (`declared_exit_code`), and only the raw one decides a verdict.

## The reconciler

`scripts/reconciler/engine.mjs` is the one host runtime loop. The scheduled task
`StarCi-Reconciler` runs `scripts/reconciler/boot.mjs ensure` at logon and periodically;
`boot.mjs --restart` is the restart entry. Every engine start, exit and cause is a
`process_runs` row; every leadership epoch is a `leader_history` row. Each controller runs
`off`, `shadow` or `active` (`controller_modes`, with every change recorded in `mode_changes`
first). In shadow mode a controller computes and records what it would do and does nothing.

| Controller | Duties |
| --- | --- |
| Job | Settles green reports without the Kernel (`scripts/reconcile/job-settle.mjs`), detects a dead worker within the health probe, re-dispatches without consuming the try budget, dispatches ready work. A non-green report opens a `settle-nongreen` Decision Item. |
| Workflow | Watches progress and stalls, writes progress and RCA snapshots to `metrics_snapshots`, opens and escalates stall Decision Items. Never moves a `paused` or `stopped` workflow. |
| Resource | RAM throttle and pool backoff (`throttle_state` with every change in `throttle_events`), provider quotas. |
| Host | Services and their probes, the Kernel and Supervisor seats (`seats`, `deliveries`, `seat_turns`), periodic transcript snapshots. Replaces a seat only after proving it dead or deaf. |
| GC | Blob mark-and-sweep per ledger with a 24 h grace, terminal and worktree collection, retention; every item's outcome is a `gc_items` row. |
| Fleet | Cross-workflow Decision Items, land and push, owner digests. |
| Learning | Measures outcomes per agent, model and op (`v_model_scorecard`). |

Every periodic duty keeps its last run in `schedules`, so an engine restart never runs a duty early.
Every action is an `engine_actions` row with its full result, stdout and stderr as blobs; nothing is
truncated. SLA breaches are `sla_episodes` (append-only); invariant breaches are
`invariant_violations`. Both surface in the UI and open Decision Items.

**Decision Items** are the durable messages between controllers and deciders
(`decision_items` in a ledger, `sup_decision_items` in machine). Only
`scripts/reconciler/decisions.mjs` writes them, through `api decisions`. A Kernel item overdue twice
escalates to the Supervisor. The doorbell (`[decide] N items waiting …` typed into an idle seat) is
only a reminder; every delivery attempt is a `deliveries` row, and a seat that refuses input
repeatedly is replaced.

## Ownership

The host owns `.claude/`, the `.workspaces` project registry and the bootstrap written from
`init/AGENTS.md`. A project's backend repository owns the project's only `.starciwork` — product
records for both backend and frontend. The runtime ledger is outside every repository, so no
worktree can copy it and no re-clone loses it. Secrets stay in each repository's `.starcistacks`
custody, encrypted with sops; they never enter a database or a blob.

## Authorities

| Concern | Maintained source |
| --- | --- |
| Agent entry and load order | `CONTEXT.md` |
| Project binding | `.workspaces/projects/<p>/work.json` (`modules/schemas/workspace-routing.yaml`) |
| Kernel decisions and API | `modules/kernel/*.yaml`, `scripts/kernel/api.mjs` |
| Host runtime loop | `modules/reconciler/reconciler.yaml`, `scripts/reconciler/engine.mjs` |
| Operation contracts | `modules/ops/ops/*.yaml` ([ops-source-ownership](ops-source-ownership.md)) |
| Model routing | `modules/models/selection.yaml`, `scripts/route/route-model.mjs` |
| Schemas | `engine/migrations/runtime/0001-init.sql`, `engine/migrations/machine/0001-init.sql` |
| Writers | `engine/ledger-db.mjs`, `engine/machine-db.mjs`, `scripts/lib/artifact-store.mjs` |
| Redaction | `scripts/lib/redact.mjs` (applied before every blob put and every log write) |
| Host contract and agent cards | `modules/host/**`, `modules/models/agents/**` ([host contract](host-contract.md)) |
| Owner configuration | `config.yaml` (seeded from `config.example.yaml`; [config-format](config-format.md)) |

## Evidence boundaries

A `pass` verdict is recorded only after the op's declared checks re-ran green under the runtime's
own runner and its changed files were computed from git: evidence is bytes in the blob store, never
words in a summary. A checker that is unavailable is an infrastructure problem, not a red check.
Changed inputs invalidate dependent proof without rewriting history; corrections are new rows, not
edited ones. These are consistency checks, not a security sandbox: agent actions remain subject to
the host's tool permissions and owner authority.
