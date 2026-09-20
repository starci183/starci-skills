---
name: start-kernel
description: >-
  Boot the long-lived [Kernel] agent for a queued goal — claims the inbox entry in
  .starciwork/runtime.sqlite, enforces kernel singleton, routes the kernel model via route-model
  kind=model.manageWorkflow, and spawns the kernel terminal bound to the persisted goal. Contract:
  .claude/modules/kernel/start-workflow.yaml. Use when the owner says start/run/boot a workflow or
  goal.
---

# start-kernel

Contract: `.claude/modules/kernel/start-workflow.yaml`
Executable: `.claude/scripts/kernel/start-workflow.mjs`

## Approval gate — mandatory

**Never spawn a kernel silently.** The flow is always plan → owner confirms → boot:

1. Resolve `<Source>` (repo containing `.claude/SKILL.md`) and the **goal ID** —
   the `workflowId` printed by `define-goal`, or ask the owner. (Omit `--goal` to
   target the oldest pending goal.)
2. Run the preview — mutates nothing:

   ```
   node .claude/scripts/kernel/start-workflow.mjs --repo <source> --goal <workflowId> --plan
   ```

3. Present the plan plainly: workflow title/phase, goal revision + identity, the
   persisted op chain, inbox status, the kernel that will spawn (routed
   model/provider + command), or "already live — no second kernel".
4. **Wait for the owner to reply exactly `ok`, `OK`, or `oK`.**
   Anything else means do NOT boot — clarify first.
5. On `ok`, boot:

   ```
   node .claude/scripts/kernel/start-workflow.mjs --repo <source> --goal <workflowId> --json
   ```

   The kernel host is **routed**, not flag-picked: `route-model` selects it under
   kind `model.manageWorkflow` (`.claude/modules/models/selection.yaml`).
   `--provider <agent>` exists only as an explicit owner override of that route.
6. Report the spawned `[Kernel]` terminal id and the routed provider/model.

## Rules

- **Singleton**: a live kernel signal refuses a second kernel; a dead one is rebound.
- A `finished` workflow's goal is retired — starting it again is refused.
- The spawned kernel is ONE long-lived LLM agent that orchestrates exclusively
  through `node .claude/scripts/kernel/api.mjs <cmd>`
  (`survey | status | plan | enqueue | route | dispatch | consume-report |
  check | settle | incident | retire`; the worker-side op IPC is
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
- No runtime state under `.starciwork/_local/`: the durable ledger is
  `<repo>/.starciwork/runtime.sqlite` only — report, contract and re-run-check
  truth lives in its reports/contracts/checks rows through the api verbs;
  `_local` files are scratch, never the record. Dispatch artifacts are
  delivered then removed (or staged in the OS temp dir) — never left there.
- Spawn flags come from `.claude/modules/models/agents/<agent>.yaml` —
  never improvise flags.
