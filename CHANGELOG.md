# Changelog

All notable changes to StarCi are documented here. The project is pre-publication — version
numbering and release cadence are the owner's call.

## [Unreleased] — open-source cut

The tree is being cut to a clean open-source layout. Headline changes:

- **Architecture settled:** one long-lived `[Kernel]` LLM agent per workflow; all state mutation
  goes through `scripts/kernel/api.mjs` (`survey|status|plan|enqueue|dispatch|settle|incident|retire`);
  one ephemeral `[Op]` agent per job spawned via provider adapter cards. The deterministic old
  engine (`kernel/` loop, `hosts/`, `execution/`, `workflows/`, `cli/`, `models/`, `contracts/`,
  `approvals/`, `specifications/`) is removed.
- **State:** single sqlite ledger at `.starciwork/runtime.sqlite` (`engine/ledger-db.mjs` +
  `engine/schema.sql`/`machine.sql`). No runtime state under `.starciwork/_local/`.
- **Mechanism/data split:** mechanism code under `engine/`; contracts as YAML data under
  `modules/`; executables under `scripts/{goal,kernel,route,agent,api,context,checks,example,install}/`;
  provider facts (data only) under `providers/`.
- **Install:** `scripts/install/install.mjs` + thin `bin/starci.mjs`
  (`init|update|doctor|version|api|start|goal`). Installer seeds untracked `config.yaml` from
  `config.example.yaml`, writes the `AGENTS.md` bootstrap, and installs the `define-goal` /
  `start-kernel` entry skills into host skills directories.
- **Entry skills ship in the package:** `skills/define-goal/`, `skills/start-kernel/` — previously
  they lived outside the package and a fresh install had no lifecycle entry.
- **Dispatch hardening:** dispatch attests terminal + prompt + first model activity before marking
  a job `running`; settle closes the worker terminal; re-plans persist lineage in the ledger.
- **Packaging:** `files[]` rewritten to the new allowlist; `schemas/` folded into
  `modules/schemas/`; stale `sites/` entries and old-engine root files (`VERSION`, `README.yaml`,
  `INDEX.yaml`, `UPDATE.yaml`, `MASTER.md`, `PARALLEL-AMAP.md`, `goal.md`) removed.
- **Docs:** README rewritten; CONTRIBUTING.md and this changelog added; `docs/` triaged to the
  surviving architecture.

## [1.0.4]

- Current public baseline: distless source tree — the runtime reads `modules/`, `kernel/`,
  `scripts/` and `docs/` directly, no `.dist` build.
- Kernel-agent operating model in place: `scripts/kernel/api.mjs` mutation gate,
  `start-workflow.mjs` boot path, `define-goal`/`start-kernel` lifecycle skills (authored in the
  host repo, not yet shipped in the package).
- sqlite ledger (`kernel/ledger-db.mjs`) owns workflow/goal/job/inbox state; vendored
  `core/yaml.mjs` keeps runtime dependency-free.
- Installer (`bin/starci-skills.mjs`) with payload copy, bootstrap write, manifest and doctor.
- 181-file `node:test` suite (`tests/*.spec.mjs`) — largely old-engine surface, pruned in the
  open-source cut.
