# StarCi

**A kernel-agent workflow runtime for AI-assisted delivery — one durable goal, one kernel agent, one ledger.**

StarCi turns an owner's request into a durable goal with a queued chain of operations, then runs it
under supervision: a long-lived `[Kernel]` agent owns the workflow and mutates state only through a
single API gate, while one ephemeral `[Op]` agent executes each job. Every decision, dispatch,
verdict and incident lands in a sqlite ledger (`.starciwork/runtime.sqlite`) — evidence before
completion, always.

StarCi provides:

- **A durable goal and plan:** `define-goal` assesses the request, writes the goal and enqueues the
  op chain in the ledger — the plan survives sessions, restarts and context loss.
- **A kernel agent per workflow:** `start-kernel` claims a queued goal and boots one long-lived
  `[Kernel]` agent. It never writes sqlite directly and never touches the host — every mutation goes
  through `node scripts/kernel/api.mjs <survey|status|plan|enqueue|dispatch|settle|incident|retire>`.
- **Ephemeral op agents:** `api dispatch` spawns one short-lived `[Op]` agent per job through the
  per-agent cards (`modules/models/agents/`). Adapter flags are injected by the spawner — the kernel
  cannot forget them; `settle` records the verdict and closes the worker.
- **Contracts as data:** goals, kernel loop, op manifests, model routing and quality gates are YAML
  under `modules/` — mechanism code stays under `engine/` and `scripts/`.
- **Machine checks:** `scripts/checks/` holds the deterministic gates (architecture, brand,
  staleness, proof bundles, example evidence) that ops must pass before a job settles.

**Requirements:** Node.js 22.13+ (unflagged `node:sqlite`) and a coding agent host. Provider access
comes from locally configured agent CLIs (Devin, Claude Code, Codex, Orca) — StarCi has no API key
of its own.

**Status:** `1.0.4`, MIT, not yet published to npm. Use the source or a reviewed archive.

[Install](#install) · [How it runs](#how-it-runs) · [Configuration](#configuration) ·
[Layout](#layout) · [Documentation](#documentation)

## Install

From a clone of this repository:

```sh
git clone https://github.com/starci183/starci-skills.git
cd starci-skills
npm ci
node bin/starci.mjs init --dir /absolute/path/to/host
node bin/starci.mjs doctor --dir /absolute/path/to/host
```

Once published, the equivalent is `npx starci init --dir /absolute/path/to/host`. The same installer
is reachable directly at `node scripts/install/install.mjs init --dir <host>`.

The installer:

1. Copies the declared payload (`package.json` `files[]`) into `<host>/.claude` — the runtime reads
   source directly, there is no build step.
2. Writes the `AGENTS.md` bootstrap pointing agents at `.claude/SKILL.md` (other host bootstrap
   names are opt-in).
3. Installs the two entry skills — `define-goal` and `start-kernel` — into the host's skills
   directories (`.devin/skills/`, `.agents/skills/`, best-effort).
4. Seeds an untracked `config.yaml` from `config.example.yaml` and records an install manifest.
5. Prints the consumer `.gitignore` lines — `.starciwork/` (runtime state) and `config.yaml`
   (local config) must never be committed by the host project.

## How it runs

```text
owner prompt
  └─ define-goal        → goal + op chain queued in .starciwork/runtime.sqlite
       └─ start-kernel  → claims the goal, boots the long-lived [Kernel] agent
            └─ api.mjs  → survey → plan → enqueue → dispatch → settle → retire
                 └─ dispatch spawns one ephemeral [Op] agent per job
                      (adapter card injects the provider CLI flags)
```

- The kernel agent reasons; `api.mjs` is the only mutation surface. It owns host mechanics —
  terminals, prompt delivery, worker lifecycle — so the kernel never calls a provider CLI directly.
- Dispatch attests the spawn before a job is marked `running`; `settle` requires a verdict plus
  evidence and closes the worker terminal; `incident` records failures without losing the ledger.
- Re-plans persist lineage (`replannedFrom`, blocker, path delta, routing reason) — the ledger is
  the audit trail, not the chat log.

## Configuration

`config.yaml` (untracked, seeded from `config.example.yaml`) holds per-project settings: kernel
model, effort and budgets. Resolution order: explicit `--provider` flag > owner `config.yaml` >
`scripts/route/route-model.mjs` defaults. See [config format](docs/config-format.md).

## Layout

```text
SKILL.md            the one skill every agent loads first
modules/            contracts as data — goal, kernel, ops, models, quality, schemas
engine/             mechanism — ledger-db, schema.sql, yaml (vendored), config, constants
scripts/            executables — kernel/api.mjs, kernel/start-workflow.mjs, goal/, route/,
                    agent/, checks/, context/, example/, install/
bin/starci.mjs      thin CLI: init | update | doctor | version | api | start | goal
modules/host/       per-host contracts — orca call surface (data only)
skills/             user-facing skills — define-goal, start-kernel, computer-use, orca-cli,
                    orchestration, workflow-chat
init/               AGENTS.md bootstrap template
knowledge/          authored YAML doctrine the checks and skills cite
docs/               documentation
examples/           reference projects with recorded .starciwork evidence
tests/              node:test specs — npm test
packages/           vendored toolkits (eslint configs, grammar, e2e-kit, fe-kit, heroicons)
```

## CLI

```sh
node bin/starci.mjs --help
node bin/starci.mjs init --dir <host>      # install
node bin/starci.mjs update --dir <host>    # update an install
node bin/starci.mjs doctor --dir <host>    # verify an install (runs its own specs)
node bin/starci.mjs api <verb>             # kernel api gate
node bin/starci.mjs start                  # start-workflow
node bin/starci.mjs goal                   # define-goal
```

Inside an install the same entry is `<host>/.claude/bin/starci.mjs`. Checks and tools are invoked
directly, e.g. `node .claude/scripts/checks/check-stales.mjs` — there is no wrapper command layer.

## Documentation

- [Installation, update and binding](docs/installation.md)
- [Architecture: kernel agent, api gate, op agents, ledger](docs/architecture.md)
- [Ledger schema and access rules](docs/ledger-db.md)
- [Writing an op manifest](docs/ops.md)
- [Host contracts and agent cards](docs/host-contract.md)
- [CLI and script reference](docs/cli.md)
- [Build, test, package and release](docs/releasing.md)
- [The todo-app standard example](docs/examples/todo-app-standard.md)

Agent-facing instructions live in [SKILL.md](SKILL.md); humans only need this page and `docs/`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md): `npm ci`, `npm test` (`node --test tests/*.spec.mjs`),
evidence is re-recorded — never hand-edited.

## License

MIT — [LICENSE](LICENSE). `engine/yaml.mjs` is a vendored bundle of the `yaml` package; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
