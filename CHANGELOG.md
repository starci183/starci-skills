# Changelog

All notable changes to StarCi are documented here. The project is pre-publication — version
numbering and release cadence are the owner's call.

## [Unreleased]

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
