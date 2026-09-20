# OPENSOURCE GOAL — StarCi

> **Status: DRAFT / EXPERIMENTAL** — this document and everything it references
> (modules/, kernel/, scripts/, QUALITY-BAR, practices/) is in trial until every
> S* row below holds with fresh evidence. Nothing is official until the goal is
> met; treat all contracts as provisional and expect them to be revised by
> practice.

> Living target state for this project. Every workflow, every op chain, every verdict
> should be measured against this file. Update `S*` when the owner sharpens the target —
> never silently reinterpret it.

## Mission

Make StarCi a runtime good enough to **open-source and publish content about**.
Not "tests pass" — *a stranger can clone it, run it, understand it, and trust it*.

## Target state S*

| Dimension | Done means |
|---|---|
| **Architecture** | `.claude/` is the canonical modular layout — `modules/` context, `kernel/` spine, `scripts/{checks,route}/`, `schemas/`, `sqlite/`. No `.dist` build step. Legacy isolated in `legacy/`. |
| **Operating model** | Chat → goal → `[Kernel]` agent (1/project) → `[Op]` agents (1 op = 1 agent) → spine settle → re-plan. Works on any project, not just this repo. |
| **Durability** | `.starciwork/runtime.sqlite` is the single truth — state survives worktree deletion, reboots, agent churn. Zero input loss, zero lease drift. |
| **Correctness** | Work-correction policy enforced: wrong business flow → re-run from affected boundary with fresh evidence. No debt ledgers, no stale-evidence assertions. |
| **Test quality** | E2E via real HTTP/GraphQL clients over real `TestingModule` stacks on BOTH example apps. Unit tests cover real business journeys, not stub assertions. Sonar + Codecov wired and green. |
| **Product quality** | Output projects meet `.claude/QUALITY-BAR.md` — interface.draw renders are genuinely beautiful, UX complete (skeleton/error/validate/motion), code sát design bám grammar, evidence proves every claim. |
| **Determinism** | Model/op routing is declarative and reproducible — same inputs → same selection, with cited reasons. Spine code (not agent prose) settles truth. |
| **Docs** | SKILL.md load order is accurate; a new agent cold-starts correctly from `AGENTS.md` alone. Architecture docs match what the code actually does. |
| **Demonstrability** | The whole loop is showable: prompt → plan → dispatched ops → evidence → settled verdict. This is the content story. |

## Continuous verification loop

Not a one-shot gate — a standing loop every kernel session runs:

1. **SURVEY** — read `.starciwork` + this file's S* → compute current gap Δ
2. **CHAIN** — plan ops closing Δ (PARSE→SURVEY→GAP→CHAIN→VALIDATE per `modules/goal/`)
3. **DISPATCH** — one `[Op]` agent per operation, scoped ownership, fresh evidence required
4. **SETTLE** — spine validates verdicts; stale/invalid evidence → re-verify leg, never accept
5. **RE-PLAN** — verdict revealing wrong assumptions → invalidate state → re-plan from boundary
6. **REPEAT** until every S* row holds with fresh evidence

## Operating standard (the open-source bar for how work runs)

How agents operate is part of the product — the standard a public demo must show:

| Standard | Means |
|---|---|
| **Self-settling ops** | An `[Op]` agent finishes its own task *completely* — including resolving its own git/file conflicts. The kernel never hand-holds; escalation only for goal-identity or scope changes. |
| **Main-line development** | Code lands on `main`, not per-task worktrees. Worktrees are disposable scratch, not integration branches — the ledger, not the branch, carries state. Conflicts are prevented by ownership boundaries in dispatch packets and resolved by the op agent itself when they occur. |
| **Pattern convergence** | All source refactors toward standard StarCi patterns. Staleness is detected by `scripts/checks/` (drift, staleness, ownership), never by human re-reading. |
| **Token discipline** | Context/token budget is allocated deterministically per dispatch — `modules/models/selection.yaml` picks the model, the packet carries the budget; agents don't self-allocate. |
| **Practice-driven upgrade** | `.claude/practices/` records what fleets actually did and what standard was derived. The architecture upgrades from observed practice, not upfront design. |
| **Fresh evidence only** | Every claim of done lands as a marker + report + artifact; stale evidence re-verifies, never refreshes by assertion. |

## Explicitly out of scope

- `knowledge/` stays untouched.
- Feature work on the example apps beyond what testing requires.
- Anything that optimizes for looking done instead of being done.

## Current known gaps

- `.dist` removal wave in flight (tinkle-14..23).
- Kernel/dispatch modules being built (tinkle-9..13).
- `scripts/checks` move + compact-format check updates (tinkle-4, v11-5).
- Frontend render re-capture (v7-9).
- Sonar/Codecov per-project encrypted tokens under `.stacks` via SOPS — pending.
