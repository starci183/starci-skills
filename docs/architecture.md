Owner: modules/
# Architecture

StarCi is a source-only runtime installed under a host's `.claude/`. One owner goal becomes one
workflow. One workflow is driven by **one long-lived Kernel agent**; each unit of work is run by
**one ephemeral op agent** per dispatch. Every durable fact lives in exactly one of **two SQLite
databases**, and every byte of agent output lives in **one content-addressed blob store**. The
Kernel reasons; small executables transact; one host engine does the mechanical work.

```text
                     owner (chat, Telegram)
                         │  /starci → approved native goal / workflow / answers
                         ▼
   ┌────────────── Kernel seat (one per workflow) ─────────────┐
   │  reads Decision Items, decides, calls scripts/kernel/cli.mjs│
   └───────────────┬────────────────────────────────────────────┘
                   │ api verbs (one transaction + one event each)
                   ▼
   runtime.sqlite (one per project)  ◄── engine/db/ledger.mjs (the only writer)
                   ▲                                   │
   op agents ──────┘ starci kernel report / log / op-contract    │ blobs put first, then the row
                                                       ▼
                                  <runtime root>/.runtime/artifacts/<sha[0:2]>/<sha256>
                                                       ▲
   reconciler engine (one per host) ──► machine.sqlite ◄── engine/db/machine.mjs (the only writer)
     Job, Workflow, Resource, Host, GC, Workers, Learning controllers
                                                       │
   harness UI (ui/server.mjs) ── read-only handles on both DBs and GET /api/blob/<sha>
```

## Storage: two databases and a blob store

| Store | Where | Holds | Only writer |
| --- | --- | --- | --- |
| `runtime.sqlite` | `<runtime root>/.runtime/projects/<ledger_id>/runtime.sqlite`, one per project, resolved through `machine.ledgers` (`STARCI_LOCAL_ROOT` overrides the `.runtime` base, `STARCI_PROJECTS_ROOT` just `projects/`) | workflows, goals, work units, jobs (tries), op attempts (dispatches), contracts, leases, API idempotency, reports, check runs, artifacts, citations, conditions, Decision Items, decisions, incidents, events and logs | `engine/db/ledger.mjs` |
| `machine.sqlite` | `<runtime root>/.runtime/machine.sqlite`, one per host (`STARCI_LOCAL_ROOT` overrides the base, `STARCI_TEST_MACHINE_FILE` the exact file) | the ledger and repository registry, the Supervisor (`sup_*`), the reconciler engine (`engine_*`, process runs, leader history, schedules, controller modes, SLA episodes), services, seats and deliveries, terminals, worktrees, throttle, provider health, quotas, GC, land queue and pushes, machine logs and metrics | `engine/db/machine.mjs` |
| blob store | `<runtime root>/.runtime/artifacts/<sha[0:2]>/<sha256>` (`STARCI_ARTIFACT_ROOT` overrides; see [storage](ledger-db.md)) | redacted transcripts and scrollback, prompts, check stdout/stderr/output, patches, images, videos, renders | `engine/db/blob.mjs`, called by the two writers |

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
- **No JSON state files and no text logs.** A fact is a row.
- **`.starciwork` holds product content only**: Work records, SRS/SDS, UI specifications and brand.
  Agent output lives in SQL and blobs; a Work record cites it by artifact id and sha256.

The schema itself is data: `engine/db/schema/runtime.sql` and
`engine/db/schema/machine.sql`. See [storage](ledger-db.md) for the tables and
[debugging](debugging.md) for the queries that answer "why is this stuck".

## Roles

| Actor | Lifetime | What it does | What it never does |
| --- | --- | --- | --- |
| Owner / chat | — | Explicitly selects `/starci`, approves the exact goal and intended actions, starts an accepted native workflow, answers asks. As the workflow monitor a chat relays; asked to supervise, it works as the Supervisor. See `CONTEXT.md`. | Never plans, enqueues, dispatches, settles or answers an ask on the owner's behalf inside the Kernel's loop. |
| `[Kernel] <workflow>` | One per workflow, long-lived | Decides the plan, non-green verdicts, incidents and the finish. Reads its Decision Items first on every wake, acts through `scripts/kernel/cli.mjs`, then yields. | Never opens a database, spawns a terminal or calls Orca directly. Never raises a unit's try budget. |
| `[Op] <op-id>` | One per dispatch, ephemeral | A `worker-start` worker in its workflow's worktree (one per Kernel workflow, shared by its ops: serial per side, parallel across sides). Reads its contract (`starci kernel op-contract`), runs the op loop (READ, CODE, `gate.mjs`, FIX) inside its `owned_paths`, logs with `starci kernel log`, files one `starci kernel report` with the gate JSON and READ digest, and is released (`worker-stop`, `worker-release`). | Never sees the ledger beyond its own attempt; its report is its only channel back. |
| Reconciler controllers | One host engine | Mechanical, idempotent work: settle green reports, recover dead workers, dispatch ready work, keep seats and services alive, GC, land and owner digests. Open a Decision Item when judgment is needed. | Never make a business or workflow decision; never resume a `stopped` workflow. |
| Supervisor | One seat (chat or Orca terminal) | Runtime-maintenance authority: decides Supervisor Decision Items, fixes `.claude` through lanes and `scripts/supervisor/land.mjs`, may raise a try budget. | Never dispatches an op, writes a product ledger, or answers an owner gate. |
| Harness UI | One process | Serves the read-only views of both databases and `GET /api/blob/<sha>`. | Never writes, never calls an API verb, never talks to Orca for a closed terminal. |

## Vocabulary: unit, job, attempt

- A **unit** (`work_units`) is one logical step: one op on one subject for one goal revision. It has
  a try budget (default 5; only the owner or the Supervisor raises it, with a reference).
- A **job** (`jobs`) is one try of a unit with concrete input. A business retry is a new job with
  `try_no + 1` and `retry_of` pointing at the failed job of the same unit.
- An **attempt** (`op_attempts`) is one dispatch of a job to a `worker-start` worker. A re-dispatch after a
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
        ├──► queued      (owner only: starci kernel lifecycle --resume)
        └──► archived
```

- `paused` is temporary. The seat is `parked` with a reason, and a controller may return the
  workflow to `running` when the reason clears (for example RAM pressure).
- `stopped` is the owner's. Only the owner stops a workflow, and only the owner resumes it
  (`stopped → queued`). No controller resurrects a stopped or paused workflow on its own judgment.
- Every phase change writes a `lifecycle_changes` row (who, why, when) in the same transaction; the
  `workflows_phase_guard` trigger refuses a change without one. Finishing or archiving a workflow
  closes its open incidents; an archived workflow accepts no new events or jobs.

## The Kernel API: `scripts/kernel/cli.mjs`

```text
starci kernel <verb> --repo <path> [...]
```

`modules/kernel/api.yaml` and `modules/cli/commands/kernel/<verb>.yaml` name every verb with its
arguments, reads, writes and refusals; `scripts/checks/check-cli-parity.mjs` keeps them in step with
the code. A write verb records its request in `api_requests` (idempotency), runs one transaction and
appends one event. A refusal exits non-zero with `{ok:false, reason}`: a routed fact, never a crash.
`dispatch --spawn` is the only place an op agent is started: `scripts/agent/lib.mjs` runs one
`orchestration worker-start` on the workflow's worktree, shaped by the agent card
`modules/models/agents/<agent>.yaml`; every other agent (Kernel, Supervisor, workers) starts through
`worker-start` too, and no runtime code creates a terminal for an agent ([host contract](host-contract.md)).

The op lifecycle is `enqueue → route → dispatch → starci kernel report → starci kernel record-checks → starci kernel settle`, and every
step is a column of the attempt row (`routed_at`, `dispatched_at`, `reported_at`, `checked_at`,
`settled_at`, `released_at`). The op's own claim (`report_outcome`) and the runtime's verdict
(`verdict`) are separate columns; a check's raw exit code (`exit_code`) is separate from the one the
op declared (`declared_exit_code`), and only the raw one decides a verdict.

## The reconciler

`scripts/reconciler/engine.mjs` is the one host runtime loop. The scheduled task
`StarCi-Reconciler` runs `starci reconciler start` at logon and periodically;
`starci reconciler restart` is the restart entry; native host readiness brings the
whole host up and prints one green/red checklist (see "Start"). Every engine start, exit and cause is a
`process_runs` row; every leadership epoch is a `leader_history` row. Each controller runs
`off`, `shadow` or `active` (`controller_modes`, with every change recorded in `mode_changes`
first). In shadow mode a controller computes and records what it would do and does nothing.

`config.yaml` `reconciler.profile` sets every controller's default mode: `operational` runs Job, Host, Workflow and
Resource `active` and GC, Workers and Learning `shadow`; `observe` keeps all of them `shadow`; no profile means only the
explicit `controllers.<name>.mode` entries count. An explicit entry overrides the profile for that controller. Safe mode
(`--safe`) forces every controller to `shadow`; it starts only after a real crash loop (more than `crashLoop.max`
abnormal starts inside `crashLoop.windowMs`). Owner restarts, self-reload and land re-exec handovers, and a restart after
a clean exit are planned starts (`start_reason` `owner-restart`, `start`, `self-reload`, `planned-restart`) and never
count.

| Controller | Duties |
| --- | --- |
| Job | Settles green reports without the Kernel (`scripts/kernel/settle/job-settle.mjs`), detects a dead worker within the health probe, re-dispatches without consuming the try budget, dispatches ready work. A non-green report opens a `settle-nongreen` Decision Item. |
| Workflow | Watches progress and stalls, writes progress and RCA snapshots to `metrics_snapshots`, opens and escalates stall Decision Items. Never moves a `paused` or `stopped` workflow. |
| Resource | RAM throttle and pool backoff (`throttle_state` with every change in `throttle_events`), provider quotas. |
| Host | Services and their probes, the Kernel and Supervisor seats (`seats`, `deliveries`, `seat_turns`), periodic transcript snapshots. Replaces a seat only after proving it dead or deaf. |
| GC | Blob mark-and-sweep per ledger with a 24 h grace, terminal and worktree collection, retention; every item's outcome is a `gc_items` row. |
| Workers | Cross-workflow Decision Items, land and push, owner digests. |
| Learning | Measures outcomes per agent, model and op (`v_model_scorecard`). |

Every periodic duty keeps its last run in `schedules`, so an engine restart never runs a duty early.
Every action is an `engine_actions` row with its full result, stdout and stderr as blobs; nothing is
truncated. SLA breaches are `sla_episodes` (append-only); invariant breaches are
`invariant_violations`. Both surface in the UI and open Decision Items.

**Decision Items** are the durable messages between controllers and deciders
(`decision_items` in a ledger, `sup_decision_items` in machine). Only
`scripts/machine/decisions.mjs` writes them, through `starci kernel decisions`. A Kernel item overdue twice
escalates to the Supervisor. The doorbell (`[decide] N items waiting …` typed into an idle seat) is
only a reminder; every delivery attempt is a `deliveries` row, and a seat that refuses input
repeatedly is replaced.

### Start

`starci reconciler up` (`scripts/reconciler/start.mjs`, with `skills/starci/references/host-startup.md` as its internal
procedure; `starci reconciler restart` is the restart lever) runs, in order: preflight (Node bundles
SQLite >= 3.51.3, `machine.sqlite` quick_check, every registered ledger's quick_check, ledgers on temp/test paths or with a missing repo or file,
kernel/supervisor pins whose agent card cannot attest the model, Orca reachable);
reports a `reconciler.profile` other than operational as red (`config.yaml` is never rewritten by a plain run; `--set-profile operational|observe` writes that one block, backup first);
rebuilds `ui/dist` with `npm run build` in `ui/` when any `ui/src`, `ui/package.json`, `ui/index.html` or vite config is
newer than the build (a failed build is red); starts the engine, or restarts it out of `--safe` when no real crash loop
is on record; links the launcher shim and registers or refreshes a missing or stale Windows task; starts every registry service that is down (never Orca); runs `start-supervisor.mjs` (only in
`supervisor.mode: kernel`) and the Kernel watchdog `--once --repair` of each running workflow. It prints one checklist
(text, or `--json`) of the engine leader and heartbeat, safe mode, each controller against the profile, each service
(harness UI local and public `/healthz`, tunnels, Telegram, ask gateway), the Supervisor seat, each running workflow's
Kernel seat, open violations and the preflight rows (among them `command guard resolvable`, which runs the exact guard hook command through bash and cmd, or sh on POSIX), and exits 0 only when every required row is green. `--check`
changes nothing, and `--brief` prints it as one line per row that is not green. A seat that is not running while no
workflow needs it is idle and green in a `--check`; a start path requires every seat. `--services` heals only the
no-quota services (launcher shim, the three tasks, UI build, engine, harness UI and tunnel, ask gateway and tunnel),
lists each applied action and never reaches `start-supervisor.mjs`, or a Kernel watchdog.

Accepted workflow startup uses this shared native host readiness before launching its Kernel and
configuration-selected maintenance. It validates persisted goal acceptance before host or agent
effects. The ingress does not recursively repair Kernel seats while preparing a new launch; the
standalone host entry retains repair of already-running workflows. Debugging is a `/loop` of the calling chat over
`starci debug digest`, set up by the `/starci` skill; no host process, seat or worker runs it.

## Ownership

The host owns `.claude/`, the `.workspaces` project registry and the bootstrap written from
`init/AGENTS.md`. A project is one app repository: its root owns the project's only `.starciwork` —
product records for both `be/` and `fe/`. The runtime ledger is outside every repository, so no
worktree can copy it and no re-clone loses it. Secrets stay in the app root's `.starcistacks`
custody, encrypted with sops; they never enter a database or a blob.

## Authorities

| Concern | Maintained source |
| --- | --- |
| Agent entry and load order | `CONTEXT.md` |
| Project binding | `.workspaces/projects/<p>/work.json` (`modules/schemas/workspace-routing.yaml`) |
| Kernel decisions and API | `modules/kernel/*.yaml`, `scripts/kernel/cli.mjs` |
| Host runtime loop | `modules/reconciler/reconciler.yaml`, `scripts/reconciler/engine.mjs` |
| Operation contracts | `modules/ops/ops/*.yaml` ([ops-source-ownership](ops-source-ownership.md)) |
| Model routing | `modules/models/selection.yaml`, `scripts/route/route-model.mjs` |
| Schemas | `engine/db/schema/runtime.sql`, `engine/db/schema/machine.sql` |
| Writers | `engine/db/ledger.mjs`, `engine/db/machine.mjs`, `engine/db/blob.mjs` |
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

## A product repository

The runtime works on **product** repositories — the bound project's app. One app is one Git
repository: one root package manifest and lockfile (npm only — slots `app.package-manifest`,
`app.lockfile`), one repository declaration of kind `app` (slot `app.declaration`, shape:
`modules/schemas/hfs-repo.schema.yaml`), its back end under `be/` and its front end
under `fe/`, the one Work tree `.starciwork` and the deployment tree `.starcistacks` at the app
root. The only cross-side reach is `fe/` reading `be/contracts/` (declared in `hfs.json`
`sides.fe.reads`); a side imports nothing outside itself (`ARCH_INTERNAL_IMPORT_OUTSIDE`).

`knowledge/hfs/slots.yaml` is the machine form of the whole tree: every kind of content that may
exist is a slot with a path, presence, tracking, tier and required files; `tiers.be`/`tiers.fe`
fix the import direction and `ruleParams` the budgets. The human reading is
[knowledge/hfs/README.md](../knowledge/hfs/README.md); the repository law is
`knowledge/patterns/repo/folder.yaml`. An app carries no owner list, allowlist or local rule of
its own. Tests split by slot: unit specs are the only tests an automatic gate runs; the
`be.tests.*` trees (integration, e2e, contract) run by hand and never join a gate; a front end
has no tests at all.

A routed app carries the host's `.claude/CONTEXT.md` marker and never grows a second Work tree in
`fe/` (`HFS_WORK_IN_FE`) or a `.starcistacks` inside a side (`HFS_STACKS_IN_SIDE`). A Kernel
workflow's worktree lives outside the app checkout, one per workflow ([workflow kernel](workflow-kernel.md)).

## The responsibility graph

Every product follows one dependency direction, whatever its topology:

```text
framework entry -> feature scenario -> reusable module -> vendor or Grammar
```

| Responsibility | Owns | Must not own |
| --- | --- | --- |
| Framework entry (app) | Boot, composition, route adapters, framework providers | Product scenario logic, persistence, reusable UI internals |
| Feature | One scenario: its commands, queries and handlers, transport adapters, scenario state and mapping | Generic infrastructure for unrelated scenarios |
| Module | One cohesive domain, platform or integration capability | Feature orchestration, app boot |
| Package (Grammar/UI) | Product-agnostic renderers, tokens, interaction primitives | Routes, session, persistence, transport |

A feature with one consumer and a module with one consumer are both legal: reuse count is not an
ownership rule. The model rejects a total folder rank (the tiers expose legal edges, not mandatory
hops), hooks hidden beside visuals (every authored custom hook lives under `hooks/<domain>`), and
machinery that owns nothing (a presentational twin, a forwarding service, a command for its own
sake).

The **back end** instantiates it in Nest/TypeScript: apps compose processes (the `be.app.*` slots),
an api feature exposes operations as typed commands and queries with one handler each
(`transport -> command -> handler -> domain`, one transaction inside a bounded context, an event
only to cross contexts or carry async work), and each capability module registers exactly once per
app with typed options (`register`, `ConfigurableModuleBuilder`, `isGlobal: true` only in app
roots). Every infrastructure dependency is injected through a zero-argument `Inject<Thing>()`
exported from its owner's `<owner>.decorators.ts`. The **front end** instantiates it in Next.js:
`app/` route adapters mount feature owners and hold no product logic; a connected block splits
world ownership (`index.tsx`) from rendering (sibling `component.tsx`); every authored custom hook
lives in `hooks/<domain>`; transport has exactly one client and one `Outcome` union
(`fe.modules.api` or `fe.package.api.*`). The concrete law is `knowledge/patterns/be/*.yaml` and
`knowledge/patterns/fe/*.yaml`, each case citing the catalog rule ids it implements; the tree
shapes are the `be.*`/`fe.*` slots of `knowledge/hfs/slots.yaml`.

## Common architecture rules

`knowledge/architecture-rules.yaml` owns the semantic obligations (`ARCH-*`) that need a reviewing
agent — ownership, composition, dependency direction, public API, abstraction, data boundary,
state, identity, configuration, authority, effect, concurrency, operability, evidence, work and
deployment. Every obligation a machine can decide is an `R`-rule of `knowledge/hfs/rules.yaml`,
stated only there. Load order for an op: the `ARCH-*` catalog, the REF obligations below and
[code-pattern enforcement](code-pattern-enforcement.md), then the applicable `knowledge/patterns/**` topics. The
executable inventory is `modules/models/code-patterns.yaml` ([code-pattern enforcement](code-pattern-enforcement.md));
a missing or unavailable checker is a coverage failure an agent can never waive, and the
[design catalog](design-pattern-catalog.md) supplies the conditional semantic decisions
(`knowledge/design-patterns.yaml`).

Mechanisms are conditional, not a mandatory list: an obligation names a trigger and a required
property and the design picks the smallest mechanism that satisfies it — an outbox for durable
external notification, a persisted saga for cross-transaction progress, fencing where a replaced
worker could still write, an atomic constraint or lock where concurrent requests compete, CQRS
where dispatch/read/write separation has real semantics, typed options for per-caller
configuration, a connected/presentational split where data lifecycle and rendering genuinely
differ, a shared package for an independent lifecycle. None is generated into every project, and
none is chosen because its narrow test is easy.

Evidence channels stay separate: static checks prove resolved dependency edges and file/role
shapes; freshness scripts prove declared inputs still agree; stack validation proves declared
consistency; behavioral runs prove the exercised invariant under recorded conditions; design
review covers responsibility and uncovered obligations. No channel substitutes for another, and no
ignore, suppression, relaxed threshold or stale hash manufactures a pass. Unsupported syntax and
unavailable tools block coverage; they are never relabeled as design.

### Coding responsibility and reference obligations

**REF-SCOPE-1 — Specification and reference evidence.** Current accepted Business/SRS and
Architecture/SDS define product behavior and target boundaries. Adopted portable patterns
define responsibility and dependency constraints; framework topics define concrete code forms.
Reference observations and primary framework documentation inform decisions without overriding
those contracts or inventing product requirements.

**REF-SCOPE-2 — Smallest applicable pattern.** Select the actual framework profile and verified
installed APIs, map roots and owners, then apply relevant rules. A mechanism needs a real
boundary or invariant and its verification obligation; appearing in an example is insufficient.

**REF-SCOPE-3 — Boundary review.** Before the first production unit identify its owner, public
contract, dependencies, data and transaction identity, and applicable code form in the existing
brief or result. Recheck after refactoring. A renamed facade or empty wrapper does not establish
a useful boundary; this review needs no additional Plan or checklist.

**REF-SCOPE-4 — Applicable rules.** Adopted rules hold before acceptance. Existing source and
passing tests do not waive them, and examples cannot override revised law or require obsolete
boilerplate. A real incompatibility needs a scoped design or tool correction under current
authority, without silent suppression or unrelated product redesign.

**REF-BE-1 — Persistence identity.** In the TypeORM profile, database-owning code uses the
correct named EntityManager decorator and every transactional operation uses its
transaction-scoped manager. Other selected persistence profiles preserve connection, tenant and
atomicity semantics. A persistence port may isolate a real boundary; a public Store.manager
escape hatch may not. Change a named-manager lint obligation coherently before changing its
source pattern, and verify the provider token, transaction callback and installed lint.

**REF-BE-2 — One use case behind protocols.** Transport owns protocol DTOs, controllers and
resolvers; application owns plain contracts and use cases; modules own reusable capabilities.
Direct use cases are the default, and bus handlers require actual dispatch semantics. Preserve
existing typed public APIs through an authorized transition, review the boundaries and boot
actual DI or bus registration when selected.

**REF-FE-1 — Visual and data ownership.** Follow the adopted Next.js responsibility graph and
composition patterns using verified installed Grammar exports. The referenced public entry is
`@starci/grammar/common`. Verify exports before selecting component names or props; invented
APIs or a replacement design-system pattern cannot bypass a code rule. Mechanical obligations
need scripts; design and edge cases need separate review.

**REF-LANG-1 — Language and evidence.** Maintain knowledge in English. User-facing communication
may use the configured language. Verify behavior and coding-reference conformance separately.

`examples/index.yaml` indexes complete current source sets in actual HFS apps. Read every source
listed for the selected pattern with its owning configuration and tests. The reference is those
files, not a copied excerpt, and its catalog membership is not a conformance claim.

## The sds family: source-independent design

Business records (fr, br, nfr, data, journey, decision — see [business records](business-srs.md))
define observable behavior. The `sds` family maps it to logical components, contracts,
integrations, events and decisions — flat family folders under `.starciwork/features/<feature>/`,
placed by `modules/schemas/work-layout.yaml`, one schema per family (`work-sds-component@1`,
`work-contract@1`, `work-integration@1`, `work-event@1`, `work-policy-decision@1`). An sds record
never names a repository path, symbol, signature or source revision: architecture may inspect the
relevant source to check feasibility and transition impact, but records the logical decision only;
implementation binds design to actual code (`owners` is written by `review.verify` reconciliation
from done implementation records, never by `architecture.decide`).

A component record states its responsibility, the interfaces others may assume, the business
records it refs, its allowed `dependsOn`, and an optional `stateMachine`/`sequence` traced to
observable outcomes. Records carry `state`/`activity` (`todo`, `activity: investigating |
implementing | verifying`, `blockers[]`) rather than a second lifecycle; an implementation op
reports an `sds-gap` blocker only on concrete proof of a bounded contradiction, and the kernel
routes it to `architecture.revise`. `starci runtime validate` proves structure and traceability —
not code conformance.

## The layout tree

A product's UI wraps a screen through the Next.js App Router layout chain. The Work tree records
it once at `.starciwork/shell/index.yaml` (schema `work/layout-tree@1`, generated by
`starci work layout-tree scan`): one tree per declared front-end app, one node per `app/`
segment, and per layout its chrome, navigation, used i18n keys and per-breakpoint captures. A
re-scan keeps owner decisions, bumps a changed layout's `rev` and returns it to `todo`.

`interface.draw` and `brand.decide` are its only writers — one workflow at a time, so parallel
workers never invent chrome. Every `ui` record binds to the tree by `app`, `route` and
`surface` (`layout`, `page`, `modal`, `drawer`, `loading`, `error`, `not-found`), and a draw works
from the unsettled shell first: a missing ancestor layout is drawn and settled before the screens
on top. `starci work compose-direction` composites a drawn state onto the real layout captures;
`starci work shell-conformance` judges the tree, the ui bindings and the implementation
routes, and [interface audit](interface-audit.md) applies the same check as its layout lens.

## The architecture machine

`starci runtime architecture` (`checkArchitecture`) is the read-only tree, dependency and
source-shape check of one side of an app, run per side (`starci app check`, or directly with
`starci runtime architecture <app>/be [--base <commit>]`) and through the op gate. It
resolves the side's manifests, tsconfig aliases, relative paths, package exports, re-export
barrels and literal dynamic imports, then emits one `starci/architecture-check@1` record whose
`coverage` states what actually ran — an unavailable parser, an unresolvable target or a missing
base is `unavailable` coverage, never a pass.

Its findings name the rule ids of `knowledge/hfs/rules.yaml`: the tier-direction matrix and owner
cycles, owner reachability and composition, dead exports and files, required files, size growth,
duplicate code and duplicated symbols, alias re-exports; on the back end the composition and data
family (connection map, SQL ownership and bounds, register-once, default-deny guard order, error
masking and error homes, feature shape, unit-spec providers, schema owner, module-per-transport,
background ownership); on the front end the route and client family (transport owner, thin route
files, hooks domains, package shape, client-to-server reachability, cross-app duplicates, slot
file roles); on both, document language. `errors` report inputs the checker could not resolve;
`violations` report boundaries crossed. The static result is structural evidence only — cohesive
ownership, DI scope, transaction isolation, idempotency and rendered behavior remain for boot,
contract, concurrency and recovery proof. [code-pattern enforcement](code-pattern-enforcement.md)
describes the executable inventory, and [nest contract check](nest-contract-check.md) and
[next data lifecycle check](next-data-lifecycle-check.md) the specialized contract checkers.

## This repository's own layout

The runtime repository is judged by the same engine with its own manifest,
`knowledge/hfs/runtime-slots.yaml` (the root `hfs.json` declares `{"hfs": 1, "kind": "runtime"}`).
Its `tiers.runtime` fixes the one import direction — entry over checks over reconciler, supervisor
and kernel over domain, gates, machine and hfs, down to the api, db and base tiers — and
`ruleParams.runtime.infraOwners` declares which api system may call which host surface
(`node:child_process` only in `scripts/api/*`, `node:sqlite` only in `engine/db`, each program word
only in its own system's folder). A path the target tree moves is a forbidden slot whose `goesTo`
names its successor; files move with the move codemod.

`starci runtime check` dispatches to `scripts/checks/check-runtime.mjs`: `node --check`
over every `.mjs` of `engine/`, `scripts/`, `modules/` and `bin/`; the runtime HFS check
(`scripts/hfs/runtime-check.mjs`) with the runtime-rule modules of `scripts/hfs/runtime-rules/` and
the cited-path scan over live prose; then every retained self-check of
`ruleParams.runtime.selfChecks`, in order. Every source file is read with the TypeScript AST
(`scripts/hfs/runtime-rules/source-ast.mjs`); no text is grepped. The one allowlist is
`modules/kernel/allowlist.yaml` (`starci/allowlist@1`): every exception a check keeps is a named,
shrink-only section of it, and `scripts/checks/check-one-allowlist.mjs` refuses a second one
(`RT_ALLOWLIST_SPRAWL`).
