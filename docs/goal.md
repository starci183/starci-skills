# GOAL - StarCi

> **Status: pre-1.0.** The runtime is in alpha. Every contract named here may be revised by practice until each S*
> row below holds with fresh evidence; then `1.0.0` freezes them.

The living target state of this runtime. Every workflow, every op chain and every verdict is measured against this
file. Change an `S*` row only when the owner sharpens the target; never reinterpret it silently.

## Mission

Make StarCi a runtime good enough to **open-source and publish content about**. Not "tests pass": a stranger can
clone it, run it, understand it and trust it.

## Target state S*

| Dimension | Done means |
|---|---|
| **Architecture** | The runtime follows its own standard layout (`knowledge/hfs/runtime-slots.yaml`): every tracked path matches exactly one slot, imports obey the tier matrix, and an external system (git, orca, npm, docker, sonar, telegram, http) is called only from `scripts/api/<system>`. `modules/` holds contracts, `engine/` the shared mechanisms and databases, `scripts/reconciler/` the idempotent controllers, `scripts/kernel/` the Kernel verbs, `scripts/checks/` the gates. `bin/starci.mjs` is the one entry. State never lives in the source tree. |
| **Operating model** | Chat, goal, one Kernel agent per workflow, one ephemeral Op agent per job, spine settle, re-plan. Orca is the only place the runtime launches agents (`orca orchestration worker-start`), the Kernel nests its Ops, and every worktree is created by the runtime, one per op, removed at settle and capped. Works on any project, not just this repo. |
| **Durability** | The ledger (`runtime.sqlite` per project, `machine.sqlite` per host) is the single truth. State survives worktree deletion, reboots and agent churn. Zero input loss, zero lease drift. |
| **Correctness** | Work-correction policy enforced: a wrong business flow re-runs from the affected boundary with fresh evidence. No debt ledgers, no stale-evidence assertions. |
| **Test quality** | End-to-end tests fake every third party at the network edge and keep the project's own infrastructure real; unit tests cover pure logic with few mocks. Sonar and Codecov are wired and green through the shared `starci-quality` gate. |
| **Product quality** | Output projects meet `docs/quality-bar.md`: designed renders, complete UX states, code that follows the design and the grammar, evidence for every claim. |
| **Determinism** | Model and op routing is declarative and reproducible: same inputs, same selection, with cited reasons. Spine code, not agent prose, settles truth. |
| **Release** | `npm run check` (one `starci runtime check` entry that reports every step) and the land gate are green before anything lands; a release is gated by one release check and publishing stays an explicit human step. |
| **Docs** | `CONTEXT.md` load order is accurate; a new agent cold-starts correctly from it alone. Architecture docs match what the code does, and docs are English only. |
| **Demonstrability** | The whole loop is showable: prompt, plan, dispatched ops, evidence, settled verdict. This is the content story. |

## Continuous verification loop

A standing loop every Kernel session runs, not a one-shot gate:

1. **SURVEY** - read the ledger and this file's S* rows, compute the current gap.
2. **CHAIN** - plan the ops that close the gap (`modules/goal/`).
3. **DISPATCH** - one Op agent per operation, scoped ownership, fresh evidence required.
4. **SETTLE** - the spine validates verdicts; stale or invalid evidence re-verifies the leg, never accepted.
5. **RE-PLAN** - a verdict that reveals a wrong assumption invalidates state and re-plans from the boundary.
6. **REPEAT** until every S* row holds with fresh evidence.

## Operating standard

| Standard | Means |
|---|---|
| **Self-settling ops** | An Op agent finishes its own task completely, including its own git and file conflicts. Escalation is only for goal-identity or scope changes. |
| **Main-line development** | Code lands on `main`. Worktrees are disposable scratch owned by the runtime, not integration branches; the ledger carries state. |
| **Pattern convergence** | One pattern, no legacy, no aliases. A superseded mechanism is deleted and recorded in `modules/kernel/retired-paths.yaml`. Drift is detected by `scripts/checks/`, never by re-reading. |
| **Token discipline** | Budget is allocated per dispatch: `modules/models/selection.yaml` picks the model and the packet carries the budget. |
| **Practice-driven upgrade** | `benchmark/findings/` records what a session did and the standard derived from it. A durable finding goes to `benchmark/findings/` or `docs/`; `.experiments/` does not exist. |
| **Fresh evidence only** | Every claim of done lands as a marker, a report and an artifact. |

## Explicitly out of scope

- Feature work on the example apps beyond what testing requires.
- Anything that optimizes for looking done instead of being done.

## Current known gaps

The open drift list lives in `benchmark/findings/fable.md` (history, outside docs/). Read it there rather than keeping
a second copy here. Per-product Sonar and Codecov tokens for the product monorepos are still pending.
