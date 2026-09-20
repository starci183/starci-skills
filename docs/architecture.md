# Architecture

StarCi is a source-only skill tree installed under a host's `.claude/`. One owner
goal becomes one workflow. One workflow is driven by **one long-lived kernel
agent**; each unit of work is **one ephemeral op agent**; every durable fact
lives in **one SQLite ledger**. The kernel reasons; small executables transact.

## The three actors

| Actor | Lifetime | What it does | What it never does |
| --- | --- | --- | --- |
| Owner / chat | — | Creates the goal (`node scripts/goal/define-goal.mjs`), answers asks, approves. | Not an agent layer above the kernel; the kernel is spawned, not supervised, by chat. |
| `[Kernel] <workflow>` | One per workflow, long-lived | Surveys the ledger, derives the plan, enqueues ops, routes the model, dispatches, settles verdicts, escalates incidents, retires the workflow. Spawned by `node scripts/kernel/start-workflow.mjs`. | Never opens the sqlite file, never writes a job row, never spawns a terminal, never calls the host (Orca) API directly. |
| `[Op] <op-id>` | One per job, ephemeral | Receives one dispatch packet, works inside its `owned_paths`, writes one report, dies. | Never sees the ledger; its report file is its only channel back. |

## The gate: `scripts/kernel/api.mjs`

Every kernel state operation is one command:

```text
node scripts/kernel/api.mjs <verb> --repo <path> [...]
  survey | status | plan | enqueue | dispatch | settle | incident | retire
```

Reads (`survey`, `status`) return projections. Each write runs inside one
`BEGIN IMMEDIATE` transaction and appends one hash-chained event. A refusal
exits non-zero with `{ok:false, reason}` — a refusal is a fact the driver loop
routes, never a crash. The full contract (arguments, reads/writes, refusal
strings) is `modules/kernel/api.yaml`.

`dispatch --spawn` is the only place an agent terminal is born: the api —
through `scripts/agent/lib.mjs` and the provider adapter card
(`providers/orca/adapters/<provider>.yaml`) — creates the terminal, attests
readiness, delivers the packet and attests submission. Provider flags
(`--yolo`, `--permission-mode dangerous`, …) are injected from the card; no
caller assembles a provider command by hand.

## The ledger

`<repo>/.starciwork/runtime.sqlite` is the record: workflows, goals, jobs,
leases, budgets, reports, contracts, inbox, signals and the hash-chained
`events` log. The DDL is data — `engine/schema.sql` — opened only through
`engine/ledger-db.mjs`. A parallel `machine.sqlite` holds only the cross-ledger
provider-quota arbiter. See [ledger-db](ledger-db.md). No runtime state lives
under `.starciwork/_local/`; dispatch artifacts are delivered and removed, or
written to the OS temp dir.

## The loop

`modules/kernel/driver-loop.yaml` is the tick the kernel agent runs:

```text
survey → plan → enqueue → drive { status → dispatch → wait → settle → retry|incident } → retire
```

The kernel re-derives the frontier from ledger state each tick — never from
memory of what it sent. Structural plan divergence against the approved goal
`opChain` is an incident, not a quiet re-plan. The contracts the loop reads:

- `modules/kernel/start-workflow.yaml` — claim a queued goal, spawn the kernel
- `modules/kernel/api.yaml` — the eight verbs
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
| Agent entry and load order | `SKILL.md` |
| Project binding | `.workspaces/projects/<p>/work.json` (`modules/schemas/workspace-routing.yaml`) |
| Kernel loop and ledger gate | `modules/kernel/*.yaml`, `scripts/kernel/api.mjs` |
| Operation contracts | `modules/ops/ops/*.yaml` ([ops-source-ownership](ops-source-ownership.md)) |
| Model routing | `modules/models/selection.yaml`, `scripts/route/route-model.mjs` |
| Ledger schema | `engine/schema.sql` |
| Provider facts | `providers/**` (data only; [providers](providers.md)) |
| Owner configuration | `config.yaml` (seeded from `config.example.yaml`; [config-format](config-format.md)) |

## Evidence boundaries

A `pass` verdict is recorded only after the op's declared checks re-ran green
and its changed files were computed from git — evidence is bytes on disk,
never words in a summary. Changed semantic inputs invalidate dependent proof
without rewriting history; corrections are new evidence, not edited receipts.
These are consistency checks, not a security sandbox: agent actions remain
subject to the host's actual tool permissions and owner authority.
