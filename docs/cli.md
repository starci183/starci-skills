# Command surface

There are two surfaces: `bin/starci.mjs` (through a reviewed npm archive, or
`node <host>/.claude/bin/starci.mjs`), and direct `node scripts/*` invocation
from an installed `.claude/` tree. `bin/starci.mjs` is a thin dispatcher — it
forwards `init|update|doctor|version` to the installer, `api` to
`scripts/kernel/api.mjs`, `start` to `scripts/kernel/start-workflow.mjs`,
`goal` to `scripts/goal/define-goal.mjs` and `validate` to
`scripts/checks/work-validate.mjs`. The kernel agent calls
`scripts/kernel/api.mjs` itself.

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
node scripts/goal/define-goal.mjs --repo <path> --text "<owner prompt>" [--title <t>] [--json] [--plan]
node scripts/goal/define-goal.mjs --project <name> --text "<owner prompt>"   # resolve via .workspaces

# Claim a queued goal and spawn the ONE long-lived [Kernel] agent
node scripts/kernel/start-workflow.mjs --repo <path> --goal <workflow_id> [--agent <name>]
# without --goal: claims the earliest pending inbox goal

# The kernel's only ledger gate. `modules/kernel/api.yaml` names every verb,
# what it reads, what it writes and when it refuses; `api.mjs --help` prints
# the same list with each verb's arguments.
node scripts/kernel/api.mjs <verb> --repo <path> [...]

# Read-only Work record/layout validation
node scripts/checks/work-validate.mjs <work-root>
# ...plus every record compiled against the JSON schema its `schema:` const names
# (closed objects, slug/timestamp patterns); each violation is a [SCHEMA_VIOLATION]
# refusal. Ops run it on the record directories they write.
node scripts/checks/work-validate.mjs <work-root-or-record-dir> --strict
```

See [workflow-kernel](workflow-kernel.md) for the loop these calls serve.

## Routing (`node scripts/route/*`)

```sh
node scripts/route/route-model.mjs --kind <kind> [--risk <level>]   # which model target may take a workload
node scripts/route/route-op.mjs --kind <opKind> [--nodeKind <k>] [--phase <p>] [--intent <t>[,<t>...]]
node scripts/route/route-plan.mjs ...                               # plan-time op-chain derivation
node scripts/route/build-ops-registry.mjs [--check]                 # regenerate modules/ops/registry.yaml
```

## Agent lifecycle (`node scripts/agent/*`)

Spawning, probing and closing a worker terminal are library calls in
`scripts/agent/lib.mjs`, driven by `api dispatch` and `api settle`. One shell
stands beside them:

```sh
node scripts/agent/send.mjs ...    # deliver a follow-up to a live agent terminal
```

Agent flags always come from the agent card
(`modules/models/agents/<agent>.yaml`); callers never type
`--yolo`/`--dangerously-skip-permissions` themselves. See [host contract](host-contract.md).

## Checks (`node scripts/checks/*`)

Read-only machine gates; they judge bytes, not claims. Highlights:

```sh
node scripts/checks/check-scoped-lint.mjs --profile <nest|next> --root <repo> \
  [--architecture-config <file>] (--all | [--base <commit>] -- <files...>)
                                                           # aggregate: architecture + code patterns;
                                                           # a scoped run exits on report.slice: its NEW findings against
                                                           # --base (owed repo contracts and debt already there at base are notes)
node scripts/checks/check-stales.mjs --work <work-root> --repo <id>=<git-root> [--target <node>]
node scripts/checks/acceptance.mjs ...                     # evidence-packet verdicts
node scripts/checks/proof.mjs ...                          # proof verification
node scripts/checks/check-entry.mjs <host>                 # installed-entry sanity
scripts/checks/stacks.mjs                                  # whole-app stack conformance (library: checkApplicationStacks)
```

Every check prints a typed JSON report (`starci/<name>-report@1`-style schema)
and uses nonzero exits for findings vs usage errors. The per-rule doctrine is
in the `*-check.md` docs beside this file.
