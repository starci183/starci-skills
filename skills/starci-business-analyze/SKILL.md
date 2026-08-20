---
name: starci-business-analyze
description: "Analyze one routed project's frontend and backend into an evidence-backed business feature registry with stable feature heads, human specs and prototype-ready surfaces. Use when product truth is missing, stale, disputed, or needed before design/planning; never changes product source or imports facts from examples."
---

# starci-business-analyze

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | own execution and user-facing proof |
| `@workspaces` | `contexts/workspaces/context.md` | context | resolve and verify FE/BE routes |
| `@worktrees` | `contexts/worktrees/context.md` | context | verify the durable business root |
| `@business` | `contexts/business/context.md` | context | business schema, evidence and publication law |

## NESTED SKILLS

None. A stop ends this run; this skill never invokes another skill as recovery.

## Purpose

Build or refresh one stable `featureId` from the routed FE and BE at committed heads. The output is an
immutable machine model plus a compact `CONTEXT.md`, task-routed Markdown modules and `evidence.json` under
`.worktrees/<project>/businesses`. The model is the source design, planning and implementation use; the
Markdown is its human view.

## Boundary

This skill may read routed FE/BE source and tests, and may write only the project's business worktree.
It never edits FE, BE, design registry, workspace route, deployment state or imported reference files.
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
5. Create one feature model valid against `@business/@feature-schema`. Every actor, flow, rule, state,
   entity, operation, surface, region and acceptance assertion cites evidence in the same model.
   Evidence records role, relative path, exact line range, claim and kind.
6. Keep presentation and truth separate. Surface regions carry real identities, statuses, actions and
   states for prototype rendering, but never add totals, roles, APIs or behavior absent from evidence.
7. Run:
   `node .claude/scripts/business-registry.mjs --source <Source> --project <project> --input <model.json>`.
   Fix schema, reference, route, head, line-range or dirty-evidence failures before publication.
8. Re-run with `--apply`, inspect the generated `model.json`, `spec.md` and `evidence.json`, then commit
   only the business worktree with `docs(business): refresh <featureId>`. The generated feature folder is:
   `CONTEXT.md`, `overview.md`, `actors.md`, `rules.md`, `states.md`, `contracts.md`, `acceptance.md`,
   `flows/<flowId>.md`, `surfaces/<surfaceId>.md`, `model.json`, `evidence.json` and aggregate `spec.md`.
   `CONTEXT.md` is the default LLM entry; load only the flow/surface module needed by the task.
9. Prove currentness with `--check --feature <featureId>` and report the feature hash, source heads,
   surface IDs, unknown count and committed business head.

## Refresh contract for consumers

Business-dependent layout, block, execute and backend planning runs check the required feature before
using it. If the feature is absent or stale, that run performs this same evidence-and-publication phase
inside its disclosed business write boundary before continuing. It must not merely rewrite source heads:
changed source requires re-reading affected claims and line ranges. If current source cannot answer a
product choice, preserve the unknown and request approval only when the consuming task cannot proceed.

## Refusals

- No verified FE or BE route for a claim the feature needs.
- A cited file is dirty, outside its routed repository, absent or outside the recorded line range.
- The business worktree is missing, dirty, unlocked, foreign or on the wrong branch.
- A claim cites no evidence, or an evidence ID is dangling.
- An example, screenshot, conversation or design candidate is being treated as implemented business.
- The request actually asks to change product behavior; that belongs to its implementation skill after
  business truth or owner intent is explicit.

## Output

```text
business: <project>/<featureId>@<hash>
sources: <fe@head, be@head, ...>
surfaces: <ids>
unknowns: <count>
business commit: <hash>
```
