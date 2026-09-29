---
name: start-kernel
description: >-
  Boot the long-lived [Kernel] agent for a queued goal — claims the inbox entry in
  the project's runtime ledger, enforces kernel singleton, resolves the Kernel agent/model, and asks
  Orca to spawn the dedicated terminal bound to the persisted goal. Contract:
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
   `host=orca`, Kernel `agent`, concrete `model`, exact terminal command, or
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
6. Report the spawned `[Kernel]` terminal id and attested agent/model. If an
   explicit agent/model pin is unavailable or the terminal does not render the
   requested model, report the typed failure; never substitute Devin.

## Rules

- **Singleton**: a live kernel signal refuses a second kernel; a dead one is rebound.
- **Topology**: Codex/Claude/Devin chats are ingress launchers; Orca is the
  execution host; the Kernel is one dedicated Orca terminal. Codex/Claude
  managed workers run ops; the Kernel is never booted on one.
- **Identity**: `agent` means execution adapter (`codex|claude|devin`),
  `model` means a concrete model id, `profile` means a StarCi routing target,
  and `runtimePool` means a quota/capacity window. Do not call all four a provider.
- **Fail closed**: an explicit Kernel pin never falls through to another agent.
  The exact requested model must be visible in the ready terminal before the
  Kernel is recorded running; a command flag alone is not attestation.
- A `finished` workflow's goal never re-enters the queue — starting it again is refused.
- The kernel orchestrates only through `node .claude/scripts/kernel/api.mjs <verb>`
  (verbs: `.claude/modules/kernel/api.yaml`); its boundary and op lifecycle are
  `.claude/modules/kernel/driver-loop.yaml`. Hand it no op-level work and no
  direct-ledger instructions.
- The reconciler Host controller keeps the long-lived seat alive by running
  `scripts/kernel/watchdog.mjs --once --repair`. It wakes the same terminal when
  work is actionable and replaces it only after exact disconnected/unwritable
  proof. `scripts/reconciler/boot.mjs ensure` starts the one host loop.
- Spawn flags come from `.claude/modules/models/agents/<agent>.yaml` —
  never improvise flags.
