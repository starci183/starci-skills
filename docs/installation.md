Task: install, update or bind a runtime host
# Installation

## Requirements and trust

The local storage profile supports local disks on one host. SQLite WAL files must stay with their database on the same host; SMB/NFS shares, synchronized folders and cross-host concurrent access are unsupported. A project-ledger snapshot is not a whole-system restore point: machine authority, blob bytes, repository Git state and native accounts require separate owner-managed custody. See [ledger recovery limits](ledger-db.md#recovery-scope). No measured RPO or RTO is promised.

Before unattended agent launches, the current owner must adopt `launchTrust` for exact repository roots in the local config; the shipped profile is null. Existing owner-approved roots can keep automatic operation without repeated prompts. Explicit provider declines are preserved. Symbolic `new-child`/`new-top-level` launches are refused until their checkout can be resolved before trust preparation; resolve/create the checkout through its existing worktree owner first. A terminal consent screen alone does not prove root scope. Provider account login and bypass defaults remain native host prerequisites. Automatic workflow purge separately requires `retention.workflowPurge` adoption. See [local config](config-format.md).

Node.js must satisfy `package.json` `engines.node`; unflagged `node:sqlite` and
npm are required. The runtime ships sources only — it bundles its own YAML parser
(`engine/yaml.mjs`) and runs with no dependency install. Review the
downloaded archive before executing it; `npx` executes package code. Pin a
reviewed version instead of assuming `latest` is safe.

The init identity setup needs `age-keygen` 1.2.1 or 1.3.1 on `PATH` (the versions `scripts/api/sops/lib.mjs` accepts); the installer never skips key
generation, so without a supported `age-keygen` it projects the files, names the missing or unsupported tool and exits 1 as "held".

Have the owner install the exact reviewed `@starci/cli` package globally, then run:

```sh
starci runtime install --cwd <host>
starci runtime doctor --cwd <host> --quick
```

Use `npx @starci/cli` in place of `starci` when a global install is not
appropriate.

Product repositories need only `@starci/cli` as a development dependency.
Their managed templates invoke only `starci app ...`.

`--cwd` always means the **host** — the directory that will own `.claude/` —
not automatically a project backend or frontend.

## What `runtime install` does

The installer copies the payload declared by `package.json` `files[]` into
`<host>/.claude`, then:

1. Writes the managed agent bootstrap into the host's entry files. There is
   **one** template — `init/AGENTS.md`; every supported host file (AGENTS.md,
   CLAUDE.md, DEVIN.md) receives the same entry between the
   `starci:prompt-entry` markers. Locally written instructions outside the
   markers are preserved.
2. Copies the one public `starci` entry into `.agents/skills/starci/`, creating that shared
   discovery root when absent, and into an existing `.devin/skills/` root. The canonical payload
   remains `.claude/skills/starci/`; copies carry the same prompt and provider policy bytes.
   References beneath that entry, including `host-startup.md` and `host-maintenance.md`, are internal instructions, not skills.
3. Seeds an **untracked** `config.yaml` from `config.example.yaml` — the
   per-project owner config: kernel model, effort, budgets. `route-model` and
   `start-workflow` read it: owner config overrides the route-model default,
   and an explicit `--agent` flag overrides both. The installed
   `.claude/.gitignore` carries `/config.yaml`; the file is never shipped or
   committed.
4. Records `.starci-skills.json` with the runtime version, payload file hashes and host entry-copy
   custody. `starci runtime doctor` is a separate explicit validation action; installation does not
   claim test or workflow acceptance from a successful file copy.

`starci runtime install` refuses an unmanaged `.claude` by default. `--no-bootstrap` leaves host
entry files untouched (you then owe the agent the runtime path yourself).
`--force` can replace locally edited runtime files — back up and inspect
before opting in. The installer does not run git commands, create project
records, or touch product sources. See [releasing](releasing.md).

The CLI records the active runtime root in `<home>/.starci/runtime.json` and
writes a `starci` shim under `<home>/.starci/bin`, allowing agents to invoke the
same CLI. If a runtime group is used before a runtime is installed, the command
exits 3 and prints:

```text
starci: the runtime group "<g>" needs the StarCi runtime, which is not installed (run: starci runtime install)
```

## Explicit discovery and update custody

Codex reads `agents/openai.yaml` with `policy.allow_implicit_invocation: false`. The same canonical
`SKILL.md` uses Claude's `disable-model-invocation: true` and Devin CLI's `triggers: [user]`. A human
selects `/starci` (or the provider's native explicit selection). A plain workflow request does not
enroll into StarCi. These policies target the documented CLI discovery surfaces; do not claim a
Devin Desktop automatic-discovery policy that its native contract does not provide.

Update retires an old copied StarCi entry only when its entire regular-file inventory matches the
previous runtime manifest's LF-normalized digests. Cleanup binds the inspected actual bytes before
removal. New copies are recorded under `hostSkills` with `hashMode: sha256-bytes`; modified or unowned files
and symlink/junction roots are preserved and reported. This installer does not traverse global
user directories or remove unrelated system/plugin skills. A pre-existing unknown bootstrap block
is refused; only the exact prior installed entry may be refreshed, preserving custom instructions.

## Git hygiene in bound repositories

`.starciwork/` holds product records only, at the app repository root. The runtime
ledger is not in any product repository: it lives at `<runtime root>/.runtime/projects/<ledger_id>/runtime.sqlite` (git-ignored
host data inside `.claude`), found through `machine.ledgers` ([storage](ledger-db.md)), and agent output lives in the blob store
under `<runtime root>/.runtime/artifacts`.

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
`<runtime root>/.runtime/projects/<ledger_id>/runtime.sqlite` — see [architecture](architecture.md).

Open the coding agent at the host. If a task opens in the frontend or another
repository, explicitly provide the absolute host, the `.claude/CONTEXT.md` path
and the selected project binding — a sibling host's bootstrap is not
automatically in that task's directory ancestry.

## Update

```sh
starci runtime update --cwd <host>
starci runtime doctor --cwd <host>
starci runtime version
```

Updates replace unchanged installer-owned files, verify the installed tree,
then record the new version only after a successful check. Locally changed or
unowned content is preserved and reported — inspect that report; a successful
copy is not proof a mixed installation is compatible. An install recorded
under a different protocol is not upgraded in place: remove `.claude` by hand
and run `starci runtime install --cwd <host>`. Existing ledgers, goals, reports, receipts and local
settings are preserved.

## Install sandboxes

`scripts/gates/install-sandbox.mjs` proves on a clean machine that the packaged runtime installs and that its host configuration works. It takes the packed
tarball of the root package (the one release inventory, see [releasing](releasing.md): the `runtime-artifact` or `install-sandbox` workflow produces it, or the
owner packs the root package into a temp directory outside the tree), redirects `HOME`, `USERPROFILE`, `LOCALAPPDATA` and `APPDATA` into one temp directory,
creates an empty `app` git repository there and installs the way a host gets it: the fetch `starci runtime install` makes, with the tarball as its spec, then the
installed package's own `installRuntime` (the installer `init`, the dependency install and the per-user shim). It asserts the `.claude` payload
(`CONTEXT.md`, `skills/starci/SKILL.md`, `skills/starci/references/host-startup.md`), no `.starci/host`, a `config.yaml` seeded verbatim from
`config.example.yaml`, the `AGENTS.md` entry of `init/AGENTS.md`, the host ignores, the shim, `starci runtime version`, the entry check for the app, a fresh
`machine-db init` and `status`, an idempotent second install, and that the real home was not written. Exit 0 every assertion passed, 1 an assertion failed,
2 a step could not run; it prints a JSON summary and appends a table to `$GITHUB_STEP_SUMMARY` when GitHub sets it.

The script asserts the `age-keygen` prerequisite by name. Run either sandbox as `node scripts/gates/install-sandbox.mjs --tarball <temp-dir>/starci-<version>.tgz`:

- **Windows (or any host), direct:** the command as written; the temp HOME is the only home the run sees.
- **Linux, in a throwaway Docker container:** add `--docker [--tools <dir>]`. The container is the node image of the release parity step, started through
  `scripts/api/docker/run.mjs` with `--rm`; only the tarball and the script are mounted, read-only, and nothing is published. `--tools <dir>` mounts a directory
  holding a Linux `age-keygen` (read-only, first on `PATH`); build one with Go: `go install filippo.io/age/cmd/age-keygen@v1.3.1` with `GOOS=linux`,
  `GOARCH=amd64` and `GOBIN=<dir>`.
- **GitHub, both OSes:** dispatch the `install-sandbox` workflow; it packs once and runs the same script on `ubuntu-latest` and `windows-latest`.
- **Full OS clean room:** Windows Sandbox is a Windows optional feature the owner enables once (nothing here enables or launches it). A `.wsb` file maps host
  folders by absolute path, which source must not carry, so it is described instead: map a folder holding the tarball and the script read-only into the
  sandbox, install Node 22 and `age-keygen` inside it, and run the same command against the mapped tarball.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `npx @starci/cli` cannot find the release | Use a reviewed package version; it may not be published. |
| Bootstrap entry missing or stale | Re-run `starci runtime install --cwd <host>`; the managed block is regenerated from `init/AGENTS.md`. `starci runtime check --only entry -- <host> [claimed-entry] [--hosts claude,devin|all]` judges `AGENTS.md` plus the `CLAUDE.md`/`DEVIN.md` copies that exist or are named by `--hosts`. |
| Install exits 1 with "initial age setup" held | `age-keygen` 1.2.1 or 1.3.1 is missing from `PATH`; the message names the tool, see the prerequisites above. |
| `.claude` already exists | Inspect ownership/custom files; do not reflexively pass `--force`. |
| `config.yaml` missing | Copy `config.example.yaml`; it is seeded only when absent. |
| No project binding | Supply backend/frontend paths and verified remotes in `work.json`. Do not initialize `.starciwork` inside the frontend. |
| Runtime sources inconsistent | `starci runtime doctor --cwd <host> --quick`; report errors before running workflows. |
| Interrupted install/update | Re-run the same `starci runtime install` or `starci runtime update` command, then `starci runtime doctor --cwd <host> --quick`. See [releasing](releasing.md). |
| Local changes reported after update | Review kept files and run doctor; never erase them just to silence a warning. |
