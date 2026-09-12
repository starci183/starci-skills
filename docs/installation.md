# Installation

## Requirements and trust

Use Node.js 20+ and npm. The runtime includes its YAML parser and does not require a separate dependency install to run the CLI. Development builds require dev dependencies. Review the downloaded archive before executing its CLI; `npx` executes package code. Pin a reviewed version instead of assuming `latest` is safe.

This alpha is not published as `starci` yet. The commands below use the local release archive. Replace the archive path with your actual file; `--dir` always means the **host**, not automatically the backend or frontend.

```sh
npx --yes --package=./starci-5.0.0-alpha.1.tgz starci init --dir /absolute/host
npx --yes --package=./starci-5.0.0-alpha.1.tgz starci doctor --dir /absolute/host --quick
```

The installer copies its declared **source** payload to `/absolute/host/.claude`, builds and verifies local `.dist` from that tree, then records `.starci-skills.json` only if verification succeeds. It installs the managed entry in both `AGENTS.md` and `CLAUDE.md`, and creates local config only if absent. Installed `.claude/.gitignore` includes `/.dist/` and `/config.json`. It preserves custom instructions. Conflicting bootstrap protocols fail before runtime writes. `init` refuses an unmanaged `.claude` by default. It does not run Git commands, create project records, install global skills, or change FE sources. See [runtime distribution](runtime-distribution.md).

`--no-bootstrap` deliberately leaves host entry files untouched; you must provide the runtime path to the agent yourself. Do not use `--force` as routine setup: it can replace locally edited runtime files. Back up and inspect before explicitly opting in.

## Bind a project

Create or approve a registry entry at `<host>/.workspaces/projects/demo/work.json`. Synthetic example; replace paths and remotes with verified real repositories:

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
    }
  },
  "work": { "ownerRole": "be", "pathFromRepository": ".starciwork" }
}
```

All relative repository paths resolve from the host. The authoritative contract is [workspace routing](../schemas/workspace-routing.json). Existing different registry layouts need inspection and explicit mapping, not blind replacement with this example.

To create only a new metadata root after selecting the backend:

```sh
node /absolute/host/.claude/bin/starci.mjs workspace init /absolute/demo-backend/.starciwork --id demo
node /absolute/host/.claude/bin/starci.mjs validate /absolute/demo-backend/.starciwork
```

First run `starci storage <backend>`: legacy names require a coordinated migration before new planning, and mixed trees require explicit reconciliation. Initialization creates workspace metadata, not business nodes or a completed plan. Normal project work then uses `prepare-work` as needed. The command refuses legacy destinations or a parallel canonical tree beside legacy storage; it never migrates data automatically.

Open the coding agent at the host. If a task opens in FE or another repository, explicitly provide the absolute host, `.claude/SKILL.md` path and selected project binding. A sibling host's bootstrap is not automatically in that task's directory ancestry. Both host files point to the same runtime; there is no second `.chatgpt` runtime.

## Update

```sh
npx --yes --package=./starci-5.0.0-alpha.1.tgz starci update --dir /absolute/host
npx --yes --package=./starci-5.0.0-alpha.1.tgz starci doctor --dir /absolute/host
```

Updates replace unchanged installer-owned runtime files, rebuild and verify `.dist` from the installed source, then record the new version only after a successful check. Locally changed or unowned content is preserved and reported. Inspect that report: a successful copy is not proof a mixed/custom installation is compatible. Major upgrades require `--upgrade-major`. Keep a backup or Git checkpoint of runtime and host instructions before upgrading. Existing business data, active plans, receipts, local settings and Git metadata are not migration targets.

The ownership manifest retains the historical filename `.starci-skills.json` for installer compatibility; this is not the public command name.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Public `npx starci` cannot find this alpha | Use the reviewed `.tgz`; it is not published yet. |
| Agent asks for retired `INDEX.md` | Read actual host entry; run `node .claude/scripts/check-entry.mjs /absolute/host`. Do not recreate a retired entry. |
| `.claude` already exists | Inspect ownership/custom files; do not reflexively pass `--force`. |
| No project binding | Supply backend/FE paths and verified remotes. Do not initialize inside FE. |
| Invalid metadata or evidence | Run `starci validate <explicit-root>` and repair the specific proof. Do not weaken schemas to claim completion. |
| Generated build stale | Run `node .claude/scripts/ensure-build.mjs`; report build errors before workflow execution. |
| Interrupted init/update (no new version recorded) | Re-run `init`/`update` from the same reviewed package, or `node .claude/scripts/ensure-build.mjs`, then `doctor --quick`. See [runtime distribution](runtime-distribution.md). |
| Runtime has local changes after update | Review kept files and run doctor. Never erase them just to remove a warning. |
