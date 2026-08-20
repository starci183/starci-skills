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

Build or refresh one stable `featureId` from routed frontend and backend source at committed heads. The
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
5. Create a model valid against `@business/@feature-schema`. Every non-unknown actor, flow, rule, state,
   entity, operation, surface, region and acceptance assertion cites evidence from the same model.
6. Put real identities, statuses, actions and states in surface regions for prototype rendering; never
   invent totals, roles, APIs or behavior.
7. Validate with `business-registry.mjs`, then apply, inspect generated views and commit only the
   business worktree with `docs(business): refresh <featureId>`.
8. Prove currentness with `--check --feature <featureId>` and report the feature hash, routed heads,
   surface IDs, unknown count and business commit.

## Refresh contract for consumers

Business-dependent consumers check required feature heads before reasoning. Missing or stale truth must
be re-read and republished from current evidence; changing only recorded source heads is forbidden.
Preserve unknowns when current source cannot answer a product choice.

## Refusals

- A required FE/BE route is absent or stale.
- Cited evidence is dirty, missing, outside its routed repository or outside the line range.
- The business worktree is missing, dirty, unlocked, foreign or on the wrong branch.
- A claim has no evidence or an evidence ID is dangling.
- A screenshot, conversation, example or design candidate is presented as implemented truth.
- The request is a product behavior change rather than business analysis.

## Output

```text
business: <project>/<featureId>@<hash>
sources: <fe@head, be@head, ...>
surfaces: <ids>
unknowns: <count>
business commit: <hash>
```
