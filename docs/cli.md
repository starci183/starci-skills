# CLI reference

Run `starci` through a reviewed npm archive/version, or `node <host>/.claude/bin/starci.mjs`. Paths below are explicit; commands do not infer a frontend as the project owner.

| Command | Effect |
| --- | --- |
| `init --dir <host>` | Install runtime, managed host bootstraps and absent local config. |
| `update --dir <host>` | Update installer-owned runtime; preserve local modifications by default. |
| `doctor --dir <host> [--quick]` | Run installed contract tests and report drift. Tests use isolated fixtures. |
| `version`, `--version` | Print package version. |
| `workspace init <new-root> --id <id>` | Create metadata in an absent root or one containing only reserved `_local` Plan state; preserve that state and refuse existing Work or unrelated files. |
| `storage <backend-root>` | Read-only naming check; legacy, mixed or unsafe paths return nonzero. No automatic migration. |
| `validate <root>` | Validate workspace and evidence; nonzero exit on invalid input. |
| `tree <root>` | Print interpreted node tree/status. |
| `impact <root> <id>` | Inspect dependents affected by an ID. |
| `stale <root>` | Inspect stale completion evidence. |
| `ops`, `op <id>` | List operators or read one contract. |
| `workflows`, `workflow <id>` | List workflows or read one matrix. |
| `route <intent>` | Inspect matching workflow routes; no execution. |
| `plan <goal.yaml>` | Preflight a frozen workflow goal; no approval or dispatch. |
| `audit-legacy <root>` | Read-only legacy inventory, not import/migration. |

The historical internal `cli/main.mjs init` remains an implementation entrypoint. The public distinction is `starci init` for host installation and `starci workspace init` for project metadata.

## Full plan authoring helpers

From the installed `.claude` directory:

```sh
node scripts/plan.mjs template
node scripts/plan.mjs create /absolute/filled-plan.yaml /absolute/backend/.starciwork/_local/plans/my-task
node scripts/plan.mjs render /absolute/backend/.starciwork/_local/plans/my-task/goal/index.yaml
```

The template intentionally fails validation until filled from real scope. `create` refuses an existing destination and creates the four-file plan bundle. These helpers do not confer user approval. The top-level `starci plan` preflights a workflow goal; it is not a replacement for the complete Plan v2 authoring helper.

New workspace/Plan creation refuses `.work` / `.starci` destinations or a parallel canonical tree beside legacy storage. Existing bound bundles remain resumable without changing receipt paths; see [migration](migration.md).

## Auto ASAP

An auto Plan rendering includes the initial candidate workflow chain, its estimate and the later checkpoint, while preserving every future stage. Propose the time budget in the same full delegation presentation. A later workflow question does not delay an earlier eligible workflow. There is no fixed two-job limit and no separate time-only approval loop.

`autoASAPWindow(plan)` is advisory only. `autoASAPStatus(plan, {authorization, runs})` derives the next window from current delegated authority and verified predecessor evidence; it does not dispatch. Actual execution still assesses risk per goal, verifies every cell and respects budget expiry. A waiting checkpoint neither completes the Plan nor grants a background scheduler or automatic deadline extension.

## Installation flags

`--no-bootstrap` leaves host instructions untouched. `--force` explicitly permits overwriting locally changed runtime files; use only after review and backup. `--upgrade-major` opts into an incompatible major runtime update, not data migration. `--quick` limits doctor to its selected checks. Invalid data-command arguments exit nonzero.
