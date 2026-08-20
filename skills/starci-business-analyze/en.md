---
title: starci-business-analyze · English
---

# starci-business-analyze

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/en.md` | en | own execution and user-facing proof |
| `@workspaces` | `contexts/workspaces/en.md` | en | resolve and verify FE/BE routes |
| `@worktrees` | `contexts/worktrees/en.md` | en | verify the durable business root |
| `@business` | `contexts/business/en.md` | en | business schema, evidence and publication law |

## NESTED SKILLS

None. A stop ends this run; this skill never invokes another skill as recovery.

## Purpose

Build, advance or reconcile one stable `featureId` from routed source and explicit owner intent. The
result is an immutable machine model plus a compact `CONTEXT.md`, task-routed modules and evidence under
`.worktrees/<project>/businesses`.

## Boundary

The skill reads routed product source and tests, and writes only the project's business worktree. It
never edits product source, design registry, workspace routes, deployment state or imported examples.
Unproved claims become explicit unknowns.

## Run

1. Resolve the Source, project, stable `featureId`, requested surfaces and runtime language.
2. Verify every routed role's path, branch, committed head, origin and local instructions.
3. Verify the locked, clean, Source-owned business worktree on `codex/businesses/<project>`.
4. Read route mounts and connected UI states, then frontend operations/types/tests, then backend
   operations/schema/services/tests. Read siblings only to settle an exact contract.
5. Select one authority operation: observe new implemented truth, publish `pending`, advance it to
   `in-progress`, publish `rejected`, or reconcile source as `implemented`. Never skip the write boundary.
6. Create a model valid against `@business/@feature-schema`. Every non-unknown actor, flow, rule, state,
   entity, operation, surface, region and acceptance assertion cites evidence from the same model.
7. Put real identities, statuses, actions and states in surface regions for prototype rendering; never
   invent totals, roles, APIs or behavior.
8. Validate with `business-registry.mjs`, then apply, inspect generated views and commit only the
   business worktree with `docs(business): refresh <featureId>`.
9. Prove currentness with `--check --feature <featureId>` and report status, base head, feature hash, routed heads,
   surface IDs, unknown count and business commit.

## Refresh contract for consumers

Consumers trust both head and state: `pending` permits design/planning, `in-progress` permits its exact
implementation, `implemented` is runtime truth, and `rejected` refuses work. Purely technical changes
bind implemented truth with `businessImpact: none`; they do not invent a feature.

## Refusals

- A required FE/BE route is absent or stale.
- Cited evidence is dirty, missing, outside its routed repository or outside the line range.
- The business worktree is missing, dirty, unlocked, foreign or on the wrong branch.
- A claim has no evidence or an evidence ID is dangling.
- A screenshot, conversation, example or design candidate is presented as implemented truth.
- A transition skips the state machine or loses its implemented base/immediate predecessor.

## Output

```text
business: <project>/<featureId>@<hash>
sources: <fe@head, be@head, ...>
surfaces: <ids>
unknowns: <count>
business commit: <hash>
```
