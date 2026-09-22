# Changelog

All notable changes to StarCi are documented here. The project is pre-publication on the
`1.0.0-alpha.N` line: contracts are provisional until every S* row in
`.experiments/OPENSOURCE-GOAL.md` holds with fresh evidence, then `1.0.0` freezes them.
`package.json` `version` is the only version authority.

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
