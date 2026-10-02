Owner: modules/kernel/api.yaml
# Command surface

There are two surfaces: `bin/starci.mjs` (through a reviewed npm archive, or
`node <host>/.claude/bin/starci.mjs`), and direct `node scripts/*` invocation
from an installed `.claude/` tree. `bin/starci.mjs` is a thin dispatcher — it
forwards `init|update|doctor|version` to the installer, `api` to
`scripts/kernel/cli.mjs`, `start` to `scripts/kernel/start-workflow.mjs`,
`goal` to `scripts/goal/define-goal.mjs` and `validate` to
`scripts/work/validate/work-validate.mjs`. The kernel agent calls
`scripts/kernel/cli.mjs` itself.

## Install verbs

`bin/starci.mjs` forwards these to `scripts/install/install.mjs`:

| Command | Effect |
| --- | --- |
| `init --dir <host>` | Copy the source payload into `<host>/.claude`, write the managed bootstrap, seed `config.yaml`, verify, then record the install manifest. |
| `update --dir <host>` | Replace unchanged installer-owned files, verify the installed tree, preserve local modifications. |
| `doctor --dir <host> [--quick]` | Run the tree's own validators on the installed copy and report drift. |
| `version`, `--version` | Print package version. |
| `help`, `--help` | Print every `starci` verb. |

Flags: `--no-bootstrap` leaves host entry files untouched; `--force` permits
overwriting locally changed runtime files (review and back up first);
`--quick` limits doctor to its selected checks. An install recorded under a
different protocol is not upgraded in place — remove `.claude` by hand and
re-run `init`.

## Goal and kernel lifecycle (`node scripts/*`)

```sh
# Queue one owner prompt as a goal (workflows + goals + inbox rows)
node scripts/goal/define-goal.mjs --repo <path> --text "<owner prompt>" [--title <t>] [--display-name "<Product> · <what>"] [--json] [--plan]
node scripts/goal/define-goal.mjs --project <name> --text "<owner prompt>"   # resolve via .workspaces

# Claim a queued goal and spawn the ONE long-lived [Kernel] agent
node scripts/kernel/start-workflow.mjs --repo <path> --goal <workflow_id> [--agent <name>]
# without --goal: claims the earliest pending inbox goal

# The kernel's only ledger gate. `modules/kernel/api.yaml` names every verb,
# what it reads, what it writes and when it refuses; `cli.mjs --help` prints
# the same list with each verb's arguments.
node scripts/kernel/cli.mjs <verb> --repo <path> [...]

# Read-only Work record/layout validation
node scripts/work/validate/work-validate.mjs <work-root>
# ...plus every record compiled against the JSON schema its `schema:` const names
# (closed objects, slug/timestamp patterns); each violation is a [SCHEMA_VIOLATION]
# refusal. Ops run it on the record directories they write.
node scripts/work/validate/work-validate.mjs <work-root-or-record-dir> --strict
# ...judged for a slice: refusals in records outside the owned paths move to
# `outOfScope` (another owner's pre-existing finding) and never fail the run.
node scripts/work/validate/work-validate.mjs <feature-dir> --strict --owned <path>[,<path>]
```

See [workflow-kernel](workflow-kernel.md) for the Kernel decisions these calls serve.

## Routing (`node scripts/route/*`)

```sh
node scripts/route/route-model.mjs --kind <kind> [--risk <level>]   # which model target may take a workload
node scripts/route/route-op.mjs --kind <opKind> [--nodeKind <k>] [--phase <p>] [--intent <t>[,<t>...]]
node scripts/route/route-plan.mjs ...                               # plan-time op-chain derivation
node scripts/route/build-ops-registry.mjs [--check]                 # regenerate modules/ops/registry.yaml
```

## Agent lifecycle (`node scripts/agent/*`)

Starting, attesting and releasing a worker are library calls in
`scripts/agent/lib.mjs` (`orchestration worker-start`, `worker-show`,
`worker-stop`, `worker-release`), driven by `api dispatch` and `api settle`. One
shell stands beside them:

```sh
node scripts/agent/send.mjs ...    # deliver a follow-up to a live worker's terminal
```

Agent flags always come from the agent card
(`modules/models/agents/<agent>.yaml`); callers never type
`--yolo`/`--dangerously-skip-permissions` themselves. See [host contract](host-contract.md).

## Checks (`node scripts/checks/*`)

Read-only machine gates; they judge bytes, not claims. Highlights:

```sh
node scripts/gates/gate.mjs --root <app> [--base <commit>] [--main <ref>] [--changed <files...>] [--tests <pattern>] [--out <file>]
                                                           # THE op gate (starci/gate@1): merge guard, hfs lint --changed, codegen +
                                                           # dist builds, tsc per owning tsconfig, jest --maxWorkers=2; only findings
                                                           # new against --base block; exit 0 clean, 1 new findings, 2 a tool could not run
node scripts/gates/read-digest.mjs --root <app> --touch <files...> --out <file>
                                                           # the op loop's READ digest (starci/read-digest@1)
node scripts/gates/acceptance.mjs ...                     # evidence-packet verdicts
node scripts/gates/proof.mjs ...                          # proof verification
node scripts/checks/check-entry.mjs <host>                 # installed-entry sanity
scripts/gates/stacks-gate.mjs                                  # whole-app stack conformance (library: checkApplicationStacks)
```

Every check prints a typed JSON report (`starci/<name>-report@1`-style schema)
and uses nonzero exits for findings vs usage errors. The per-rule doctrine is
in the `*-check.md` docs beside this file.
