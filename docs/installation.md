# Installation

## Requirements and trust

Node.js 22.13+ (`package.json` `engines`; `node:sqlite` is unflagged there) and
npm. The runtime ships sources only — it bundles its own YAML parser
(`engine/yaml.mjs`) and runs with no dependency install. Review the
downloaded archive before executing it; `npx` executes package code. Pin a
reviewed version instead of assuming `latest` is safe.

```sh
npm i -g @starci/cli
starci runtime install --dir <host>
starci runtime doctor --dir <host> --quick
```

Use `npx @starci/cli` in place of `starci` when a global install is not
appropriate.

Product repositories need only `@starci/cli` as a development dependency.
Their managed templates invoke only `starci app ...`.

`--dir` always means the **host** — the directory that will own `.claude/` —
not automatically a project backend or frontend.

## What `runtime install` does

The installer copies the payload declared by `package.json` `files[]` into
`<host>/.claude`, then:

1. Writes the managed agent bootstrap into the host's entry files. There is
   **one** template — `init/AGENTS.md`; every supported host file (AGENTS.md,
   CLAUDE.md, DEVIN.md) receives the same entry between the
   `starci:prompt-entry` markers. Locally written instructions outside the
   markers are preserved.
2. Copies the two lifecycle entry skills — `define-goal` and `start-kernel` —
   into each host skills directory that already exists (`.devin/skills/`,
   `.agents/skills/`), so the host's agent surfaces them. The whole `skills/`
   tree also lands under `.claude/skills/` as payload; this tree is its
   canonical source.
3. Seeds an **untracked** `config.yaml` from `config.example.yaml` — the
   per-project owner config: kernel model, effort, budgets. `route-model` and
   `start-workflow` read it: owner config overrides the route-model default,
   and an explicit `--agent` flag overrides both. The installed
   `.claude/.gitignore` carries `/config.yaml`; the file is never shipped or
   committed.
4. Verifies the installed source tree (doctor contract checks), and only then
   records the install manifest `.starci-skills.json` with the version and
   file hashes. A failed copy or verify records nothing.

`starci runtime install` refuses an unmanaged `.claude` by default. `--no-bootstrap` leaves host
entry files untouched (you then owe the agent the runtime path yourself).
`--force` can replace locally edited runtime files — back up and inspect
before opting in. The installer does not run git commands, create project
records, or touch product sources. See [runtime distribution](runtime-distribution.md).

The CLI records the active runtime root in `<home>/.starci/runtime.json` and
writes a `starci` shim under `<home>/.starci/bin`, allowing agents to invoke the
same CLI. If a runtime group is used before a runtime is installed, the command
exits 3 and prints:

```text
starci: the runtime group "<g>" needs the StarCi runtime, which is not installed (run: starci runtime install)
```

## Git hygiene in bound repositories

`.starciwork/` holds product records only, at the app repository root. The runtime
ledger is not in any repository: it lives at `%LOCALAPPDATA%/StarCi/projects/<ledger_id>/runtime.sqlite`, found through
`machine.ledgers` ([storage](ledger-db.md)), and agent output lives in the blob store under
`~/.starci/artifacts`.

Commit durable records (goals, SRS/SDS, evidence your policy keeps); never
commit `config.yaml` or secrets.

## Bind a project

Create or approve a registry entry at `<host>/.workspaces/projects/<name>/work.json`
(contract: `modules/schemas/workspace-routing.yaml`). Synthetic example —
replace paths and remotes with verified real repositories:

```json
{
  "schema": "starci/workspace-binding@2",
  "project": "demo",
  "repository": {
    "pathFromSource": "../demo-monorepo",
    "gitRepository": "https://github.com/example/demo-monorepo.git"
  },
  "sides": { "be": "be", "fe": "fe" },
  "work": { "pathFromRepository": ".starciwork" }
}
```

`be` and `fe` name directories in one app repository. The Work tree is at the
app root. All relative paths resolve from the host. The ledger lives at
`%LOCALAPPDATA%/StarCi/projects/<ledger_id>/runtime.sqlite` — see [architecture](architecture.md)
and [source layout](source-layout.md).

Open the coding agent at the host. If a task opens in the frontend or another
repository, explicitly provide the absolute host, the `.claude/CONTEXT.md` path
and the selected project binding — a sibling host's bootstrap is not
automatically in that task's directory ancestry.

## Update

```sh
starci runtime update --dir <host>
starci runtime doctor --dir <host>
starci runtime version
```

Updates replace unchanged installer-owned files, verify the installed tree,
then record the new version only after a successful check. Locally changed or
unowned content is preserved and reported — inspect that report; a successful
copy is not proof a mixed installation is compatible. An install recorded
under a different protocol is not upgraded in place: remove `.claude` by hand
and run `starci runtime install --dir <host>`. Existing ledgers, goals, reports, receipts and local
settings are preserved.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `npx @starci/cli` cannot find the release | Use a reviewed package version; it may not be published. |
| Bootstrap entry missing or stale | Re-run `starci runtime install --dir <host>`; the managed block is regenerated from `init/AGENTS.md`. |
| `.claude` already exists | Inspect ownership/custom files; do not reflexively pass `--force`. |
| `config.yaml` missing | Copy `config.example.yaml`; it is seeded only when absent. |
| No project binding | Supply backend/frontend paths and verified remotes in `work.json`. Do not initialize `.starciwork` inside the frontend. |
| Runtime sources inconsistent | `starci runtime doctor --dir <host> --quick`; report errors before running workflows. |
| Interrupted install/update | Re-run the same `starci runtime install` or `starci runtime update` command, then `starci runtime doctor --dir <host> --quick`. See [runtime distribution](runtime-distribution.md). |
| Local changes reported after update | Review kept files and run doctor; never erase them just to silence a warning. |
