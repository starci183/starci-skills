# StarCi

**A kernel-agent workflow runtime for AI-assisted delivery — one durable goal, one kernel agent, one ledger.**

StarCi turns an owner's request into a durable goal with a queued chain of operations, then runs it
under supervision: a long-lived `[Kernel]` agent owns the workflow and mutates state only through a
single API gate, while one ephemeral `[Op]` agent executes each job. Every decision, dispatch,
verdict and incident lands in the project's SQLite ledger (`runtime.sqlite`, outside every repository) and every
byte of agent output in a content-addressed blob store — evidence before completion, always.

StarCi provides:

- **A durable goal and plan:** the explicitly selected `/starci` entry assesses and previews the request;
  after the owner accepts the exact goal and plan, native goal definition writes and enqueues the
  op chain in the ledger — the plan survives sessions, restarts and context loss.
- **A kernel agent per workflow:** native workflow startup claims an accepted queued goal and boots one long-lived
  `[Kernel]` agent. It never writes sqlite directly and never touches the host — every mutation goes
  through one `starci kernel <verb>` call. `modules/kernel/api.yaml` and
  `modules/cli/commands/kernel/` hold the verb contracts; [docs/cli.md](docs/cli.md) is the human list.
- **One host reconciler:** active controllers handle mechanical Job, Workflow, Resource, Host,
  GC, Workers and Learning concerns. Kernels decide through durable Decision Items; `scripts/reconciler/engine.mjs`
  is the single host runtime loop (`modules/reconciler/reconciler.yaml`).
- **Ephemeral op agents:** `starci kernel dispatch` spawns one short-lived `[Op]` agent per job through the
  per-agent cards (`modules/models/agents/`). Adapter flags are injected by the spawner — the kernel
  cannot forget them; `settle` records the verdict and closes the worker.
- **Contracts as data:** goals, kernel loop, op manifests, model routing and quality gates are YAML
  under `modules/` — mechanism code stays under `engine/` and `scripts/`.
- **Machine checks:** `scripts/checks/` holds the deterministic gates (architecture, brand,
  staleness, proof bundles, example evidence) that ops must pass before a job settles.

**Requirements:** Node.js 22.13+ (unflagged `node:sqlite`) and a coding agent host. Provider access
comes from locally configured agent CLIs (Devin, Claude Code, Codex, Orca) — StarCi has no API key
of its own.

**Status:** `1.0.0-alpha.2` (alpha line; contracts are provisional until `1.0.0`), MIT, not yet published to npm. Use the source or a reviewed archive.

[Overview](#overview) · [Stack](#stack) · [Repository layout](#repository-layout) ·
[Development](#development) · [Install](#install) · [Documentation](#documentation)

## Overview

StarCi stores each workflow's decisions and evidence outside product repositories while its
contracts and checks live in this source tree. [How it runs](#how-it-runs) follows one goal
through the kernel and operation agents.

## Stack

Node.js 22.13+, npm, SQLite (`node:sqlite`), authored YAML contracts, and JavaScript checks.
The examples use NestJS backend and Next.js frontend applications.

## Repository layout

This repository is the StarCi runtime package: `modules/` holds contracts, `engine/` and
`scripts/` hold mechanism and checks, `knowledge/` holds HFS and code rules, `docs/` holds
human guidance, and `examples/` holds one backend/frontend product example (ecommerce-app), the
shape-slot front-end slot-teaching fixture (not a product) and the starcistacks-services declarations. Each
product example follows the [HFS tree](docs/architecture.md); [Detailed layout](#detailed-layout)
maps the runtime directories below.

## Development

From this repository root, run `starci npm ci` once; while working, use `starci check run --level L1 --changed <files>`
for syntax and contract gates and `starci test run --level L1 --spec <files>` for the affected Node specs. Leads use
L2 before land, and the release cut owns the whole suite. The runtime package has no separate TypeScript
typecheck, lint, or build script; product examples declare their own `typecheck`,
`lint`, `build`, and `test` commands. Run the runtime presentation gate with
`starci gate repo-presentation --root . --runtime`.

## Install

Have the owner install the exact reviewed `@starci/cli` package globally, then install the runtime into a host:

```sh
starci runtime install --cwd <host>
starci runtime doctor --cwd <host>
```

Without a global install, use `npx @starci/cli` in place of `starci`. Use
`starci runtime update --cwd <host>` to update an installed tree and
`starci runtime version` to print the runtime version.

The installer:

1. Copies the declared payload (`package.json` `files[]`) into `<host>/.claude` — the installed
   source is the runtime and `node` reads it directly.
2. Writes the `AGENTS.md` bootstrap pointing agents at `.claude/CONTEXT.md` (other host bootstrap
   names are opt-in).
3. Installs the one public `starci` entry in `.agents/skills/starci/` and in an existing
   `.devin/skills/` discovery root, recording exact file custody. Internal references are not skills.
4. Seeds an untracked `config.yaml` from `config.example.yaml` and records an install manifest.
5. Prints the consumer `.gitignore` lines — `.starciwork/` (runtime state) and `config.yaml`
   (local config) must never be committed by the host project.

The CLI records the selected runtime in `<home>/.starci/runtime.json` and writes the
`starci` shim under `<home>/.starci/bin`, so agents can run the same command. A runtime
group used before installation exits 3 and prints
`starci: the runtime group "<g>" needs the StarCi runtime, which is not installed (run: starci runtime install)`.

## How it runs

```text
explicit /starci request
  └─ read-only goal assessment + derived plan → owner accepts exact goal and intended actions
       └─ native goal definition → queue in the project ledger (runtime.sqlite)
            └─ native workflow start → host readiness + optional maintenance + attested [Kernel]
            └─ starci kernel survey → plan → enqueue → dispatch → settle → finish
                 └─ dispatch spawns one ephemeral [Op] agent per job
                      (adapter card injects the provider CLI flags)
```

- The kernel agent reasons; `cli.mjs` is the only mutation surface. It owns host mechanics —
  terminals, prompt delivery, worker lifecycle — so the kernel never calls a provider CLI directly.
- Dispatch attests the spawn before a job is marked `running`; `settle` requires a verdict plus
  evidence and closes the worker terminal; `incident` records failures without losing the ledger.
- Re-plans persist lineage (`replannedFrom`, blocker, path delta, routing reason) — the ledger is
  the audit trail, not the chat log.

## Configuration

`config.yaml` (untracked, seeded from `config.example.yaml`) holds per-project settings: kernel
model, effort and budgets. Resolution order: explicit `--agent` flag > owner `config.yaml` >
`scripts/route/route-model.mjs` defaults. See [config format](docs/config-format.md).

## Detailed layout

```text
CONTEXT.md          canonical runtime entry and instruction load order
modules/            contracts as data — goal, kernel, ops, models, host, supervisor,
                    reconciler, schemas
engine/             mechanism — ledger-db, schema.sql, yaml (vendored), config, constants
scripts/            executables — kernel/cli.mjs, kernel/start-workflow.mjs, goal/, route/,
                    agent/, api/, reconciler/, supervisor/, connectors/, work/, guards/,
                    uat/, checks/, context/, lib/, reconcile/, example/, install/
packages/cli/       @starci/cli, the thin dispatcher and the only starci bin
modules/host/       per-host contracts — orca call surface (data only)
skills/starci/      one explicit public entry, provider policy and conditional internal references
.starci/host/       internal startup and maintenance prompts; not host skill discovery
init/               AGENTS.md bootstrap template
knowledge/          authored YAML doctrine the checks and skills cite
benchmark/          model-pool evidence: expectations.yaml, append-only snapshots/, findings/
docs/               documentation
examples/           ecommerce-app (a reference product with recorded .starciwork evidence), lite-app (a tools-produced lite booking app), shape-slot (a slot-teaching fixture, not a product) and starcistacks-services (service declarations)
tests/              node:test specs — npm test
packages/           vendored toolkits (eslint configs, grammar, fe-kit, heroicons)
```

## CLI

`@starci/cli` owns the only `starci` binary. Its command groups are:

| Groups | Surface |
| --- | --- |
| `app`, `workflow`, `kernel`, `runtime` | Product apps, workflow lifecycle, the Kernel gate, and runtime management |
| `supervisor`, `debug`, `harness`, `reconciler` | Host supervision, inspection, UI, and reconciliation |
| `guard`, `gate`, `release`, `work` | Fast guards, quality gates, releases, and Work records |
| `machine`, `connect`, `route`, `uat`, `orca` | Host state, connectors, routing, UAT, and Orca adapters |

The generated [CLI reference](docs/cli.md) is the complete source for verbs, flags,
examples, and exit codes. Removed spellings are refused with their replacement and exit 2;
there are no aliases.

## Documentation

- [Installation, update and binding](docs/installation.md)
- [Architecture: two databases, blob store, Kernel, reconciler, Supervisor, phases](docs/architecture.md)
- [Storage: runtime.sqlite, machine.sqlite and blobs](docs/ledger-db.md)
- [Debugging: the ten questions and their SQL](docs/debugging.md)
- [Writing an op manifest](docs/ops.md)
- [Host contracts and agent cards](docs/host-contract.md)
- [CLI reference](docs/cli.md)
- [Build, test, package and release](docs/releasing.md)

Agent-facing instructions live in [CONTEXT.md](CONTEXT.md); humans only need this page and `docs/`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md): `npm ci`, `npm test` (`node --test tests/*.spec.mjs`),
evidence is re-recorded — never hand-edited.

## License

MIT — [LICENSE](LICENSE). `engine/yaml.mjs` is a vendored bundle of the `yaml` package; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
