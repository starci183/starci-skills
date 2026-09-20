---
name: start-kernel
description: >-
  Boot the long-lived [Kernel] agent for a queued goal — claims the inbox entry in
  .starciwork/runtime.sqlite, enforces kernel singleton, resolves the Kernel agent/model, and asks
  Orca to spawn the dedicated terminal bound to the persisted goal. Contract:
  .claude/modules/kernel/start-workflow.yaml. Use when the owner says start/run/boot a workflow or
  goal.
---

# start-kernel

Contract: `.claude/modules/kernel/start-workflow.yaml`
Executable: `.claude/scripts/kernel/start-workflow.mjs`

## Approval gate — mandatory

**Never spawn a kernel silently.** The flow is always plan → owner confirms → boot:

1. Resolve both locations, without conflating them:
   - `<Source>` is the host repository containing `.claude/SKILL.md` and the
     entry executable.
   - `<project-owner-repo>` owns the selected project's
     `.starciwork/runtime.sqlite`; `define-goal` printed it as `LEDGER`.
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
  managed workers are operation lanes and are not used to boot the Kernel.
- **Identity**: `agent` means execution adapter (`codex|claude|devin|qwen`),
  `model` means a concrete model id, `profile` means a StarCi routing target,
  and `runtimePool` means a quota/capacity window. Do not call all four a provider.
- **Fail closed**: an explicit Kernel pin never falls through to another agent.
  The exact requested model must be visible in the ready terminal before the
  Kernel is recorded running; a command flag alone is not attestation.
- A `finished` workflow's goal never re-enters the queue — starting it again is refused.
- The spawned kernel is ONE long-lived LLM agent that orchestrates exclusively
  through `node .claude/scripts/kernel/api.mjs <cmd>`
  (`survey | status | hierarchy | plan | enqueue | route | dispatch | consume-report |
  check | settle | incident | finish`; the worker-side op IPC is
  `op-contract | report`). It never writes `.starciwork/runtime.sqlite`
  directly, never calls `orca`
  itself — the api owns all host mechanics — and never spawns op terminals by
  hand: each op is one ephemeral `[Op]` agent per job, launched through
  `api dispatch --spawn`. Do NOT hand the kernel op-level work or
  direct-ledger instructions.
- The op lifecycle is fixed: `enqueue` → `api route` (the model decision is
  persisted on the job payload — model/modelId/effort/routeChain; the kernel
  never picks a model ad hoc) → `api dispatch` (writes the contracts row the
  worker reads via `api op-contract`, acquires the leases) → the worker files
  `api report` → the kernel integrates it via `api consume-report` → re-runs
  the op's checks → `api check` records the re-run → `api settle`.
- `api settle` is the close-out: it enforces consumption — marking the job's
  report `consumed_at` itself if `api consume-report` did not — records the
  verdict, releases the job's leases and closes the worker terminal — a
  settled job leaves no live terminal behind and no report settles
  unconsumed. `api dispatch` must attest the terminal landed (prompt
  delivered, first model activity); an auth/crash spawn is a
  `dispatch-rejected`, the job is NOT running and its slot is released.
- The durable ledger is `<repo>/.starciwork/runtime.sqlite` only — report,
  contract and re-run-check truth lives in its reports/contracts/checks rows
  through the api verbs. Dispatch artifacts stage in the OS temp dir and are
  removed once delivered.
- Spawn flags come from `.claude/modules/models/agents/<agent>.yaml` —
  never improvise flags.
