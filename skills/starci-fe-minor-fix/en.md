---
title: starci-fe-minor-fix · English
---

# starci-fe-minor-fix

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/en.md` | en | use the shared context, ownership, approval, and reporting contract |
| `@workspaces` | `contexts/workspaces/en.md` | en | resolve and verify the requested frontend checkout |
| `@business` | `contexts/business/en.md` | en | bind correction to implemented truth |
| `@principles` | `compilers/principles` | module | resolve existing visual situations |
| `@patterns-fe` | `compilers/patterns/fe` | module | load only the pattern modules reached by the existing component and requested correction |
| `@lints-fe` | `gates/fe/lints` | module | route canonical lint findings without suppressing or guessing unknown rules |
| `@scope-check` | `scripts/check-fe-minor-fix-scope.mjs` | script | enforce the existing-folder, file-count, and production-churn fence before and after the patch |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | prove technical-only business boundary |

## NESTED SKILLS

None. A rejection names the larger workflow; it never invokes it.

## Run

This is a fast lane for one already-understood correction. The caller supplies a project, frontend role,
one existing component identity, the observed defect, and the expected behavior. “Atom” in a request maps
to the active `leaves` tier; this skill never creates or revives an `atoms` tier.

## Eligibility fence

Accept only one existing folder under `blocks`, `composites`, or `leaves`; no public shape, visual anatomy,
contract, state, or data owner may change. The patch admits at most two existing production files, two
colocated tests, and 40 added-plus-deleted production lines. The target must be clean before writing;
unrelated dirt elsewhere is preserved.

Reject route, page, layout, new folder/component, contract/token, translation, dependency/config, public
API, caller, query/mutation, cache, async-owner, new-state, or multi-component work before writing.

## Process

1. Resolve language and the verified frontend workspace route.
2. Run the scope checker without `--base`; keep its HEAD as the baseline.
3. Read the target, colocated tests, necessary callers, and already-cited contract entries only.
4. Route through the frontend pattern shelf and load only reached child records before writing.
5. Apply the smallest behavior patch with no adjacent refactor.
6. Run the scope checker with `--base`. On rejection, undo only this run's hunks with `apply_patch`.
7. Run colocated tests, repository typecheck, and canonical lint scoped to the target. Repair only inside
   the boundary; unknown rules and outside-path findings reject the run.
8. Report baseline, paths, production churn, and proof. Commit or push only when explicitly requested.

## Stops

- Missing/stale route; absent, dirty, new, ambiguous, or invalid target.
- Any semantic fence crossed before writing.
- More than two production files, two tests, or 40 production changed lines.
- Suppression, unknown lint rule, or required outside path.
- Block anatomy or states — larger owner: `starci-fe-design-block`.
- Persistent geometry or address ownership — larger owner: `starci-fe-design-layout`.
- Multi-region or page-level redesign — larger owner: `starci-fe-design-layout`.
- Broad quality repair — larger owner: `starci-repair`.
- Public API or data ownership — larger owner: a normal planned coding task.

## OUTPUT

Return `minor fix applied` with identity and proof, or `MINOR-FIX-REJECTED` with the first measured boundary
and correct larger workflow. No status tables.
