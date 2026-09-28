# Architecture

StarCi is a source-only skill tree installed under a host's `.claude/`. One owner
goal becomes one workflow. One workflow is driven by **one long-lived kernel
agent**; each unit of work is **one ephemeral op agent**; every durable fact
lives in **one SQLite ledger**. The kernel reasons; small executables transact.

## Agents and controllers

| Actor | Lifetime | What it does | What it never does |
| --- | --- | --- | --- |
| Owner / chat | — | Creates the goal (`node scripts/goal/define-goal.mjs`), answers asks, approves. As the workflow monitor it relays; asked to supervise, it patches `.claude` and restarts kernels per `modules/supervisor/supervise.yaml`. See `CONTEXT.md` for the three chat roles. | Never an agent layer inside the kernel's loop: it does not plan, enqueue, dispatch, settle or answer an ask on the owner's behalf. |
| `[Kernel] <workflow>` | One per workflow, long-lived | Decides the plan and non-green verdicts, handles incidents and finishes the workflow. Acts on durable Decision Items for non-green outcomes, progress and rulings. Spawned by `node scripts/kernel/start-workflow.mjs`. | Never opens the sqlite file, writes a job row, spawns a terminal or calls the host (Orca) API directly. |
| Reconciler controllers | One host engine | Handle active mechanical concerns: Job, Workflow, Resource, Host, GC, Fleet and Learning. Use the existing API for product-ledger writes; the reconciler is the only host runtime loop. | Never make business or workflow decisions for an LLM. |
| `[Op] <op-id>` | One per job, ephemeral | Receives one dispatch packet, works inside its `owned_paths`, writes one report, dies. | Never sees the ledger; its report file is its only channel back. |

## The gate: `scripts/kernel/api.mjs`

Product-ledger operations from the Kernel and controllers use one command surface:

```text
node scripts/kernel/api.mjs <verb> --repo <path> [...]
```

`modules/kernel/api.yaml` `commands:` and `modules/kernel/api-commands/<verb>.yaml`
together name every verb with its arguments, reads, writes and refusal strings. Reads return projections. Each write runs
inside one `BEGIN IMMEDIATE` transaction and appends one hash-chained event. A
refusal exits non-zero with `{ok:false, reason}` — a refusal is a fact the
driver loop routes, never a crash.

`hierarchy` is the semantic agent-tree projection. It renders
`workflow → Kernel → Op` from durable workflow/job identity and includes Orca
Run/Task/Dispatch/terminal metadata as attributes. Terminal title, tab order,
pane layout and `parentPaneKey` are never ownership authority. A Kernel restart
keeps the same stable Kernel node; an Op retry is a new operation-job node.

`dispatch --spawn` is the only place an operation agent terminal is born: the api —
through `scripts/agent/lib.mjs` and the agent card
(`modules/models/agents/<agent>.yaml`) — creates the terminal, attests
readiness, delivers the packet and attests submission. Agent flags
(`--yolo`, `--permission-mode dangerous`, …) are injected from the card; no
caller assembles an agent command by hand.

The first operation lazily creates one Orca Run bound to the dedicated Kernel
terminal. Managed agents enter it through `worker-start`, which already owns
Task injection and must not be followed by a second `orchestration dispatch`.
Command-terminal agents create the same operation Task, then bind their exact
terminal with `dispatch --return-preamble`; this keeps every Op visible under
the same durable Kernel hierarchy regardless of launch adapter.

## The ledger

`<repo>/.starciwork/runtime.sqlite` is the record: workflows, goals, jobs,
leases, budgets, reports, contracts, inbox, signals and the hash-chained
`events` log. The DDL is data — `engine/schema.sql` — opened only through
`engine/ledger-db.mjs`. A parallel `machine.sqlite` holds the host ledger
registry; its resource and budget tables are reserved. See [ledger-db](ledger-db.md). Dispatch artifacts
stage in the OS temp dir and are removed once delivered.

## Reconciler loop and Kernel decisions

`modules/kernel/driver-loop.yaml` is the Kernel's decision loop:

```text
read Decision Items -> inspect ledger -> choose an allowed action -> record it -> yield
```

The single host reconciler (`scripts/reconciler/engine.mjs`) runs seven active
controllers. Job handles green settlement, worker recovery and ready dispatch;
Workflow detects stalls and opens Decision Items; Host maintains services and
seats; Resource, GC, Fleet and Learning own their respective mechanical duties.
The Host controller runs `scripts/kernel/watchdog.mjs --once --repair` as a seat
check. There is no independent Kernel watchdog loop. The scheduled task
`StarCi-Reconciler` calls `scripts/reconciler/boot.mjs ensure` at logon and
periodically; `boot.mjs --restart` is the restart entry. See
[workflow kernel](workflow-kernel.md) for the Kernel's decision flow.

A connected operation terminal at an input prompt is
`turn-idle`, not active; the Kernel or Job controller uses `nudge` to
resume that exact worker without creating a replacement job, lease, retry, or authority. `observe`
gives the Kernel a read-only screen tail of its own job's op terminal —
reasoning context at a ~3-minute cadence, never evidence: it sends nothing,
closes nothing, and never substitutes for the reports row or re-run checks. The Kernel
yields when durably waiting and never keeps a model turn alive with sleep or an
internal polling loop. Structural plan divergence against the approved goal
`opChain` is an incident, not a quiet re-plan. The contracts the loop reads:

- `modules/kernel/start-workflow.yaml` — claim a queued goal, spawn the kernel
- `modules/kernel/api.yaml` — the complete Kernel API verbs
- `modules/kernel/dispatch.yaml` — the packet each op is launched with
- `modules/kernel/verdict-contract.yaml` — what `settle` accepts and rejects
- `modules/ops/ops/<op>.yaml` — the op brief the packet names ([ops](ops.md))
- `modules/models/selection.yaml` — model eligibility (`scripts/route/route-model.mjs`)

## Ownership

The host owns `.claude/`, the `.workspaces` project registry and the bootstrap
file written from `init/AGENTS.md`. A project's backend repository owns the
project's only `.starciwork` — the ledger and the product records — for both
backend and frontend; the frontend consumes the same records and owns source
only. `.starciwork/runtime.sqlite` is untracked local state: ignore it in the
owning repository. Durable requirements, specifications and evidence are
committed per project policy; secrets never are.

## Authorities

| Concern | Maintained source |
| --- | --- |
| Agent entry and load order | `CONTEXT.md` |
| Project binding | `.workspaces/projects/<p>/work.json` (`modules/schemas/workspace-routing.yaml`) |
| Kernel decisions and ledger gate | `modules/kernel/*.yaml`, `scripts/kernel/api.mjs` |
| Host runtime loop | `modules/reconciler/reconciler.yaml`, `scripts/reconciler/engine.mjs` |
| Operation contracts | `modules/ops/ops/*.yaml` ([ops-source-ownership](ops-source-ownership.md)) |
| Model routing | `modules/models/selection.yaml`, `scripts/route/route-model.mjs` |
| Ledger schema | `engine/schema.sql` |
| Host contract and agent cards | `modules/host/**`, `modules/models/agents/**` (data only; [host contract](host-contract.md)) |
| Owner configuration | `config.yaml` (seeded from `config.example.yaml`; [config-format](config-format.md)) |

## Evidence boundaries

A `pass` verdict is recorded only after the op's declared checks re-ran green
and its changed files were computed from git — evidence is bytes on disk,
never words in a summary. Changed semantic inputs invalidate dependent proof
without rewriting history; corrections are new evidence, not edited receipts.
These are consistency checks, not a security sandbox: agent actions remain
subject to the host's actual tool permissions and owner authority.
