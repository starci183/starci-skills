# Command surface

There are two surfaces: the `starci` install verbs (through a reviewed npm
archive, or `node <host>/.claude/bin/starci.mjs`), and direct `node scripts/*`
invocation from an installed `.claude/` tree. There is no `starci <verb>`
workflow command line — the kernel agent drives work through
`scripts/kernel/api.mjs`, not a CLI.

## Install verbs

`bin/starci.mjs` forwards these to `scripts/install/install.mjs`:

| Command | Effect |
| --- | --- |
| `init --dir <host>` | Copy the source payload into `<host>/.claude`, write the managed bootstrap, seed `config.yaml`, verify, then record the install manifest. |
| `update --dir <host>` | Replace unchanged installer-owned files, verify the installed tree, preserve local modifications. |
| `doctor --dir <host> [--quick]` | Run the tree's own validators on the installed copy and report drift. |
| `version`, `--version` | Print package version. |
| `help`, `--help` | Print the install verbs. |

Flags: `--no-bootstrap` leaves host entry files untouched; `--force` permits
overwriting locally changed runtime files (review and back up first);
`--upgrade-major` opts into an incompatible major update; `--quick` limits
doctor to its selected checks.

## Goal and kernel lifecycle (`node scripts/*`)

```sh
# Queue one owner prompt as a goal (workflows + goals + inbox rows)
node scripts/goal/define-goal.mjs --repo <path> --text "<owner prompt>" [--title <t>] [--json] [--plan]
node scripts/goal/define-goal.mjs --project <name> --text "<owner prompt>"   # resolve via .workspaces

# Claim a queued goal and spawn the ONE long-lived [Kernel] agent
node scripts/kernel/start-workflow.mjs --repo <path> --goal <workflow_id> [--provider <name>]
# without --goal: claims the oldest pending inbox goal

# The kernel's only ledger gate — eight verbs
node scripts/kernel/api.mjs <survey|status|plan|enqueue|dispatch|settle|incident|retire> --repo <path> [...]
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

```sh
node scripts/agent/spawn.mjs --provider <devin|qwen|claude|codex> --worktree <path> --title <t> \
  [--prompt <text> | --prompt-file <f>] [--command <override>] [--kernel] [--json]
node scripts/agent/send.mjs ...    # deliver a follow-up to a live agent terminal
node scripts/agent/health.mjs ...  # readiness/activity probe
node scripts/agent/kill.mjs ...    # close a worker terminal
```

Provider flags always come from the adapter card
(`providers/orca/adapters/<provider>.yaml`); callers never type
`--yolo`/`--dangerously-skip-permissions` themselves. See [providers](providers.md).

## Checks (`node scripts/checks/*`)

Read-only machine gates; they judge bytes, not claims. Highlights:

```sh
node scripts/checks/check-scoped-lint.mjs --profile <nest|next> --root <repo> \
  [--architecture-config <file>] (--all | -- <files...>)   # aggregate: architecture + code patterns
node scripts/checks/check-stales.mjs --work <work-root> --repo <id>=<git-root> [--target <node>]
node scripts/checks/acceptance.mjs ...                     # evidence-packet verdicts
node scripts/checks/proof.mjs ...                          # proof verification
node scripts/checks/check-entry.mjs <host>                 # installed-entry sanity
node scripts/checks/work-layout.mjs ...                    # .starciwork layout conformance
node scripts/checks/stacks.mjs ...                         # whole-app stack conformance
```

Every check prints a typed JSON report (`starci/<name>-report@1`-style schema)
and uses nonzero exits for findings vs usage errors. The per-rule doctrine is
in the `*-check.md` docs beside this file.
