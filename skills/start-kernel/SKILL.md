---
name: start-kernel
description: >-
  Boot the long-lived [Kernel] agent for a queued goal — claims the inbox entry in
  the project's runtime ledger, enforces kernel singleton, resolves the Kernel agent/model, and asks
  Orca to start the Kernel as a worker (worker-start) bound to the persisted goal. Contract:
  .claude/modules/kernel/start-workflow.yaml. Use when the owner says start/run/boot a workflow or
  goal.
---

# start-kernel

You are the owner's chat. This skill boots the one long-lived `[Kernel]` agent
for a goal `define-goal` already persisted, and the owner's exact `ok` is the
only thing that lets you spawn it.

Contract: `.claude/modules/kernel/start-workflow.yaml`
Executable: `.claude/scripts/kernel/start-workflow.mjs`

## Approval gate — mandatory

**Never spawn a kernel silently.** The flow is always plan → owner confirms → boot:

1. Resolve both locations, without conflating them:
   - `<Source>` is the host repository containing `.claude/CONTEXT.md` and the
     entry executable.
   - `<project-owner-repo>` is the ledger owner of the selected project; its
     runtime ledger is the path `define-goal` printed on its `ledger:` line.
   Resolve the **goal ID** (`workflowId`) printed by `define-goal`, or ask the
   owner. Omit `--goal` only to target the earliest pending goal.
2. Run the preview — mutates nothing:

   ```
   node <Source>/.claude/scripts/kernel/start-workflow.mjs --repo <project-owner-repo> --goal <workflowId> --plan
   ```

3. Present the plan plainly: workflow title/phase, goal revision + identity, the
   persisted op chain, inbox status, `launcher` (current human chat surface),
   `host=orca`, Kernel `agent`, concrete `model`, `launch=worker`, or
   "already live — no second kernel". A StarCi profile such as `codex-agent`
   and a runtime pool are routing concepts, not agent or model names.
4. **Wait for the owner to reply exactly `ok`, `OK`, or `oK`.**
   Anything else means do NOT boot — clarify first.
5. On `ok`, boot:

   ```
   node <Source>/.claude/scripts/kernel/start-workflow.mjs --repo <project-owner-repo> --goal <workflowId> --json
   ```

   Orca is always the execution host. `route-model` may select the Kernel
   agent/model under kind `model.manageWorkflow` when the owner did not pin
   them. `--agent <name>` is the explicit owner override.
6. Report the `[Kernel]` worker (its Dispatch and terminal) and attested agent/model. If an
   explicit agent/model pin is unavailable or worker-show does not report the
   requested model, report the typed failure; never substitute Devin.

## Rules

- **Singleton**: a live kernel signal refuses a second kernel; a dead one is rebound.
- **Topology**: Codex/Claude/Devin chats are ingress launchers; Orca is the
  execution host. The boot creates the Kernel's entry Run from this chat's
  terminal (this chat coordinates it) and starts the Kernel as a worker-start
  worker; the Kernel creates its own workflow Run (it coordinates it) and
  starts every op there as a worker-start worker from its own terminal, with
  no --parent (the nested Run rule). Nothing is launched with terminal create.
- **One worktree per workflow**: before the Kernel starts, the boot has
  Orca create the workflow worktree (Orca's worktree create call, name and
  branch `wf-<workflowId>`, a real `starci npm ci` at the app root, no
  `node_modules` junctions), then starts the Kernel in it with `worker-start
  --worktree <its path>`. Every op of the workflow runs in it: serially per side (`be/`,
  `fe/`), in parallel across sides. Ops never commit: a green op is a
  checkpoint commit the runtime makes on the branch, gated against the previous
  checkpoint; a failed or blocked op is preserved to
  `preserved/<workflowId>/<op>` and the worktree reset to the last checkpoint.
  Main is touched only at the finish: full gate against main's merge-base,
  merge guard, `review.verify` of the exact head that lands, rebase,
  fast-forward and push; the worktree is then `release-pending` and the
  host-side controller removes it once its terminals are released. Never make
  or remove that worktree by hand.
- **Identity**: `agent` means execution adapter (`codex|claude|devin`),
  `model` means a concrete model id, `profile` means a StarCi routing target,
  and `runtimePool` means a quota/capacity window. Do not call all four a provider.
- **Fail closed**: an explicit Kernel pin never falls through to another agent.
  worker-show must report the exact requested model as the worker's effective
  model before the Kernel is recorded running.
- A `finished` workflow's goal never re-enters the queue — starting it again is refused.
- The kernel orchestrates only through `starci kernel <verb>`
  (verbs: `.claude/modules/kernel/api.yaml`); its boundary and op lifecycle are
  `.claude/modules/kernel/driver-loop.yaml`. Hand it no op-level work and no
  direct-ledger instructions.
- The reconciler Host controller keeps the long-lived seat alive by running
  `scripts/kernel/kernel-watchdog.mjs --once --repair`. It wakes the same terminal when
  work is actionable and replaces the Kernel only after worker-show proves its
  Dispatch ended (or exact disconnected/unwritable proof). `scripts/reconciler/boot.mjs ensure` starts the one host loop.
- Orca composes the agent command with the owner's per-agent default args;
  the runtime passes only --agent/--model/--effort (`.claude/modules/models/agents/<agent>.yaml` start).
