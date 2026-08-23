---
name: starci-business-analyze
description: "Create, advance or reconcile one routed project's evidence-backed business feature authority through pending, in-progress, implemented and rejected heads. Use when product truth or owner intent must exist before design, planning or source writes; never changes product source or imports facts from examples."
---

# starci-business-analyze

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | own execution and user-facing proof |
| `@workspaces` | `knowledge/contexts/workspaces/context.md` | context | resolve and verify FE/BE routes |
| `@worktrees` | `knowledge/contexts/worktrees/context.md` | context | verify the durable business root |
| `@business` | `knowledge/contexts/business/context.md` | context | business schema, evidence and publication law |

## NESTED SKILLS

None. A stop ends this run; this skill never invokes another skill as recovery.

## PIPELINE

Topology: `reconciliation`.

| Step | Track | Input | Transform | Required output | Gate |
|---|---|---|---|---|---|
| evidence | shared | owner statements, routed source evidence and current feature head | separate fact, intent, example, unknown and contradiction | normalized evidence pack | every claim has provenance and examples create no product truth |
| model | reconciliation | evidence pack and predecessor head | reconcile actors, goals, rules, states, operations and failures | proposed business model and delta | every change traces to evidence and preserves lineage |
| publish | execution | accepted model and requested lifecycle transition | write immutable model, compact context, modules and evidence links | new feature head and publication receipt | schema, predecessor and lifecycle transition validate |
| reconcile | proof | published head and implemented source when applicable | compare declared truth with observed implementation | implemented or discrepancy receipt | no unsupported claim or unbound source baseline |

## Purpose

Build, advance or reconcile one stable `featureId` from routed source evidence and explicit owner intent. The output is an
immutable machine model plus a compact `CONTEXT.md`, task-routed Markdown modules and `evidence.json` under
`.worktrees/<project>/businesses`. The model is the source design, planning and implementation use; the
Markdown is its human view.

## Boundary

This skill may read routed FE/BE source and tests, and may write only the project's business worktree.
It never edits FE, BE, design preview cache, workspace route, deployment state or imported reference files.
A reference specification contributes headings and granularity only. Claims not proven by current
source become explicit `unknowns`.

## Run

1. Resolve runtime language, Source, declared project, `featureId`, and requested/related surfaces.
2. Verify every routed role: disk path, branch, committed head, origin and instructions. Refreshing a
   stale workspace route belongs to the initialization owner; do not approximate it here.
3. Verify `.worktrees/<project>/businesses` is locked, clean, owned by Source Git and on
   `codex/businesses/<project>`. Refuse foreign, unlocked, dirty or missing roots.
4. Read source in this order:
   - route mounts, connected pages and user-facing states;
   - frontend operations, types, session/authorization and interaction tests;
   - backend resolvers/controllers, handlers/services, schema/entities and tests;
   - sibling feature families only when needed to resolve an exact contract.
5. Select exactly one authority operation: observe a new implemented feature, publish accepted intent as
   `pending`, advance that exact head to `in-progress`, publish `rejected`, or reconcile completed source
   as `implemented`. Never skip `pending → in-progress` for a business-affecting write.
6. Create one feature model valid against `@business/@feature-schema`. Every actor, flow, rule, state,
   entity, operation, surface, region and acceptance assertion cites evidence in the same model.
   Evidence records role, relative path, exact line range, claim and kind.
7. Keep presentation and truth separate. Surface regions carry real identities, statuses, actions and
   states for prototype rendering, but never add totals, roles, APIs or behavior absent from evidence.
8. Run:
   `node .claude/scripts/business-registry.mjs --source <Source> --project <project> --input <model.json>`.
   Fix schema, reference, route, head, line-range or dirty-evidence failures before publication.
9. Re-run with `--apply`, inspect the generated `model.json`, `spec.md` and `evidence.json`, then commit
   only the business worktree with `docs(business): refresh <featureId>`. The generated feature folder is:
   `CONTEXT.md`, `overview.md`, `actors.md`, `rules.md`, `states.md`, `contracts.md`, `acceptance.md`,
   `flows/<flowId>.md`, `surfaces/<surfaceId>.md`, `model.json`, `evidence.json` and aggregate `spec.md`.
   `CONTEXT.md` is the default LLM entry; load only the flow/surface module needed by the task.
10. Prove currentness with `--check --feature <featureId>` and report authority status, base head, feature hash, source heads,
   surface IDs, unknown count and committed business head.

## Refresh contract for consumers

Business-dependent consumers trust the current business head, including its state. `pending` permits
design and planning. `in-progress` permits only the exact declared implementation. `implemented` is
runtime truth. `rejected` refuses implementation. Purely technical work binds the current implemented
head with `businessImpact: none`; it never creates or advances a feature. Reconciliation must re-read
changed claims and bind final committed source heads, never merely rewrite hashes.

## Refusals

- No verified FE or BE route for a claim the feature needs.
- A cited file is dirty, outside its routed repository, absent or outside the recorded line range.
- The business worktree is missing, dirty, unlocked, foreign or on the wrong branch.
- A claim cites no evidence, or an evidence ID is dangling.
- An example, screenshot, conversation or design candidate is being treated as implemented business.
- A requested transition skips the state machine, loses `baseHead`/`previousHead`, or tries to implement
  a `pending` or `rejected` head.

## Output

```text
business: <project>/<featureId>@<hash>
sources: <fe@head, be@head, ...>
surfaces: <ids>
unknowns: <count>
business commit: <hash>
```
