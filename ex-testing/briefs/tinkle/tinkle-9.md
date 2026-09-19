# tinkle-9 — modules/kernel/: orchestrator driver loop + dispatch contract

Read `tinkle/_common.md` + `tinkle-8.md` (methodology section). Pure yaml only.

## Context
.claude now runs purely on Orca. Operating model for EVERY project going forward:

- Chat = goal creator + trigger only (owner prompt lands here, kernel agent is spawned from chat)
- `[Kernel]` agent — ONE per project, LONG-LIVED: receives the goal-plan, dispatches ops, settles verdicts, re-plans on "cấn cấn" (mid-flight wrongness), escalates to owner when goal_identity is wrong
- `[Op] <name>` agents — 1 op = 1 agent, EPHEMERAL: spawned per dispatch via orca terminal, dies when verdict settles
- Naming convention in Orca: kernel terminals `[Kernel] <project>`, worker terminals `[Op] <op-or-task>`

The current session running this fleet IS the kernel prototype — encode what it does (poll markers, spawn ops, read verdicts, re-brief on failure) as the driver-loop rules.

## Sources
`.dist/kernel/engine.mjs`, `goal.mjs`, `owner-requests.mjs`, `ledger-db.mjs`; `ops/runtime.operate`, `ops/task.execute`, `ops/provision.ask`; `modules/goal/*.yaml` (tinkle-8 output); `modules/ops/*/route:` blocks; `modules/models/selection.yaml`.

## Deliverables — `.claude/modules/kernel/`

### `driver-loop.yaml`
The reasoned half of the kernel — describe as declarative rules, cite kernel functions:
- loop: settle verdict → pick next leg (state machine, cite engine.mjs) → route-op + route-model → dispatch → wait verdict
- verdict handling table: pass → next leg / fail → retry budget then what / blocked → provision.ask / suspicion → goal.revise (backward edge)
- re-plan triggers: when S₀ measured wrong, when goal_identity wrong (MUST escalate to owner — never self-decide)
- escalation: which decisions the driver may take alone vs must ask owner (ambiguity tiers from modules/goal/legality.yaml)

### `dispatch.yaml` — the spawn contract (THIS IS THE CORE)
```yaml
packet:
  op: <id>
  brief: modules/ops/ops/<id>.yaml        # business context the shell agent reads
  context:
    records: [...]                        # .starciwork records it touches
    owned_paths: [...]                    # what it may modify — boundary enforcement
  constraints: {model, budget, lease: <token>}
  returns: {verdict: pass|fail|blocked, evidence: [...paths], suspicion?: string}
```
Define every field + which kernel mechanism enforces it (lease-identity-drift trigger for lease, DEP_STALE for owned_paths, artifact checks for evidence). The lease token is the key: spine binds agent's writes to job identity — agent physically cannot record evidence for another job.

### `verdict-contract.yaml`
Shell agent output schema: verdict enum + semantics, evidence paths (must pass artifact-byte checks — cite checks), suspicion free-text → how driver maps it to goal.revise. What the spine accepts vs rejects.

## Boundaries
READ-ONLY on .dist/ and modules/ops, modules/goal. Write ONLY modules/kernel/ + report + marker `done/tinkle-9.done`.
