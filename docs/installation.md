# Installation

## Requirements and trust

Node.js 20+ and npm. The runtime ships sources only — it bundles its own YAML
parser (`engine/yaml.mjs`) and needs no dependency install to run. Review the
downloaded archive before executing it; `npx` executes package code. Pin a
reviewed version instead of assuming `latest` is safe.

```sh
npx --yes --package=<reviewed-archive>.tgz starci init --dir /absolute/host
npx --yes --package=<reviewed-archive>.tgz starci doctor --dir /absolute/host --quick
```

`--dir` always means the **host** — the directory that will own `.claude/` —
not automatically a project backend or frontend.

## What `init` does

The installer (`bin/starci.mjs` → `scripts/install/install.mjs`) copies the
declared **source** payload — `skills/`, `modules/`, `engine/`,
`scripts/`, `knowledge/`, `docs/`, `init/AGENTS.md` — into `/absolute/host/.claude`,
then:

1. Writes the managed agent bootstrap into the host's entry files. There is
   **one** template — `init/AGENTS.md`; every supported host file (AGENTS.md,
   CLAUDE.md, DEVIN.md) receives the same entry between the
   `starci:prompt-entry` markers. Locally written instructions outside the
   markers are preserved.
2. Installs the user-facing skills (`skills/define-goal`, `start-kernel`,
   `computer-use`, `orca-cli`, `orchestration`, `workflow-chat`) so the host's
   agent surfaces them (for example `.devin/skills/` is install output —
   `skills/` in this tree is the canonical source).
3. Seeds an **untracked** `config.yaml` from `config.example.yaml` — the
   per-project owner config: kernel model, effort, budgets. `route-model` and
   `start-workflow` read it: owner config overrides the route-model default,
   and an explicit `--provider` flag overrides both. The installed
   `.claude/.gitignore` carries `/config.yaml`; the file is never shipped or
   committed.
4. Verifies the installed source tree (doctor contract checks), and only then
   records the install manifest `.starci-skills.json` with the version and
   file hashes. A failed copy or verify records nothing.

`init` refuses an unmanaged `.claude` by default. `--no-bootstrap` leaves host
entry files untouched (you then owe the agent the runtime path yourself).
`--force` can replace locally edited runtime files — back up and inspect
before opting in. The installer does not run git commands, create project
records, or touch product sources. See [runtime distribution](runtime-distribution.md).

## Git hygiene in bound repositories

`.starciwork/` is runtime + product-record state owned by the project's
backend repository. Keep the ledger out of git — add to the backend's
`.gitignore`:

```text
/.starciwork/runtime.sqlite
/.starciwork/_local/
```

Commit durable records (goals, SRS/SDS, evidence your policy keeps); never
commit `config.yaml` or secrets.

## Bind a project

Create or approve a registry entry at `<host>/.workspaces/projects/<name>/work.json`
(contract: `modules/schemas/workspace-routing.yaml`). Synthetic example —
replace paths and remotes with verified real repositories:

```json
{
  "schema": "starci/workspace-binding@1",
  "project": "demo",
  "repositories": {
    "be": {
      "pathFromSource": "../demo-backend",
      "gitRepository": "https://github.com/example/demo-backend.git"
    },
    "fe": {
      "pathFromSource": "../demo-frontend",
      "gitRepository": "https://github.com/example/demo-frontend.git"
    },
    "grammar": {
      "pathFromSource": "../demo-grammar",
      "gitRepository": "https://github.com/example/demo-grammar.git",
      "package": "@example/grammar"
    }
  },
  "work": { "ownerRole": "be", "pathFromRepository": ".starciwork" }
}
```

`be` and `fe` deliver the product; `grammar` is optional and delivers the
language the interface is drawn in. Omit it and a grammar gap becomes a
question for the owner instead of a guessed repository. All relative paths
resolve from the host. The ledger lives at
`<backend>/.starciwork/runtime.sqlite` — see [architecture](architecture.md)
and [source layout](source-layout.md).

Open the coding agent at the host. If a task opens in the frontend or another
repository, explicitly provide the absolute host, the `.claude/SKILL.md` path
and the selected project binding — a sibling host's bootstrap is not
automatically in that task's directory ancestry.

## Update

```sh
npx --yes --package=<reviewed-archive>.tgz starci update --dir /absolute/host
npx --yes --package=<reviewed-archive>.tgz starci doctor --dir /absolute/host
```

Updates replace unchanged installer-owned files, verify the installed tree,
then record the new version only after a successful check. Locally changed or
unowned content is preserved and reported — inspect that report; a successful
copy is not proof a mixed installation is compatible. Major upgrades require
`--upgrade-major`. Existing ledgers, goals, reports, receipts and local
settings are not migration targets.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `npx starci` cannot find the release | Use the reviewed `.tgz` path; it may not be published. |
| Bootstrap entry missing or stale | Re-run `init`; the managed block is regenerated from `init/AGENTS.md`. |
| `.claude` already exists | Inspect ownership/custom files; do not reflexively pass `--force`. |
| `config.yaml` missing | Copy `config.example.yaml`; it is seeded only when absent. |
| No project binding | Supply backend/frontend paths and verified remotes in `work.json`. Do not initialize `.starciwork` inside the frontend. |
| Runtime sources inconsistent | `starci doctor --dir <host> --quick`; report errors before running workflows. |
| Interrupted init/update | Re-run from the same reviewed package, then `doctor --quick`. See [runtime distribution](runtime-distribution.md). |
| Local changes reported after update | Review kept files and run doctor; never erase them just to silence a warning. |
