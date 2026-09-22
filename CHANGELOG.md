# Changelog

All notable changes to StarCi are documented here. The project is pre-publication on the
`1.0.0-alpha.N` line: contracts are provisional until every S* row in
`.experiments/OPENSOURCE-GOAL.md` holds with fresh evidence, then `1.0.0` freezes them.
`package.json` `version` is the only version authority.

## [1.0.0-alpha.2] — in preparation

Theme: canonical files say one thing, once. Every rule lives in exactly one place and
describes the present tense; the working notes are in `fable.md`.

- **Version line reset:** `2.0.0` → `1.0.0-alpha.2`. The `v2.x`/`v6.x` git tags belong to the
  previous `@starci/skills` package, not to this runtime.
- **De-sediment:** remove dangling clauses, duplicated sentences and stale summaries left by
  layered feedback edits (first case: `modules/ops/ops/interface.draw.yaml`).
- **No ghost-context:** canonical files stop referencing states the tree no longer has
  (`distless`, former top-level dirs).
- **One api verb list:** `modules/kernel/api.yaml` names every verb `scripts/kernel/api.mjs`
  implements; docs cite it instead of restating it.

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
