---
name: starci-fe-minor-fix
description: Apply one small behavior or rendering correction inside an existing frontend block, composite, or leaf-level atom, with a deterministic file-and-line scope fence. Reject route, page, layout, contract, public API, data-ownership, or multi-component work before writing.
---

# starci-fe-minor-fix

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | use the shared context, ownership, approval, and reporting contract |
| `@workspaces` | `contexts/workspaces/context.md` | context | resolve and verify the requested frontend checkout |
| `@business` | `contexts/business/context.md` | context | bind technical correction to implemented product truth |
| `@principles` | `compilers/principles/context.md` | context | resolve existing visual situations without ad-hoc taste |
| `@patterns-fe` | `compilers/patterns/fe/context.md` | context | load only the pattern modules reached by the existing component and requested correction |
| `@lints-fe` | `gates/fe/lints/context.md` | context | route canonical lint findings without suppressing or guessing unknown rules |
| `@scope-check` | `scripts/check-fe-minor-fix-scope.mjs` | script | enforce the existing-folder, file-count, and production-churn fence before and after the patch |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | prove technical-only work binds implemented truth |

## NESTED SKILLS

None. A rejection names the larger workflow; it never invokes it.

## Run

This is a fast lane for one already-understood correction. The caller supplies a project, frontend role,
one existing component identity, the observed defect, and the expected behavior. “Atom” in a request maps
to the active `leaves` tier; this skill never creates or revives an `atoms` tier.

## Eligibility fence

Accept only when all are true:

- the target is one existing folder under `blocks`, `composites`, or `leaves` in an allowed frontend root;
- the visual structure, contract key, public props/exports, ownership, states, and data source remain unchanged;
- the correction fits at most two existing production files and two colocated tests;
- expected production churn is at most 40 added-plus-deleted lines;
- the target paths are clean before the first write. Unrelated dirt elsewhere is preserved and ignored.

Reject before writing when the request needs any route, page, layout, new component/folder, contract or
token edit, translation key, dependency/config change, public API change, caller update, query/mutation,
cache key, async owner, new state, or more than one component identity. Copy changes requiring catalogue
work and visual changes requiring a new anatomy are not minor fixes.

## Process

1. Read `@skill-shape`, resolve `defaultLang`, then read `@workspaces` and verify the declared `fe` route.
2. Classify this lane as `businessImpact: none`; any changed flow, rule, state, operation, surface ownership or
   acceptance condition is not minor and is rejected. Name the owning `featureId`, then run `@business-boundary`
   against its current `implemented` head and routed FE baseline. Do not create a feature for a technical fix.
3. Name the exact component folder and run `@scope-check` without `--base`. Its printed HEAD is the scope
   baseline. A dirty target or invalid tier is `MINOR-FIX-REJECTED`.
4. Read the component, its colocated tests, its current callers only when needed to understand the defect,
   and the contract entries it already cites. Do not open a design registry: this skill cannot change a
   design decision.
5. For a visual correction, resolve the existing situation through `@principles`; then read `@patterns-fe` and
   load only reached child contexts before the first line. Keep the existing tier,
   export family, connected/pure split, contract keys, tokens, copy ownership, and vendor boundary.
6. Apply the smallest patch that changes the reported behavior. Do not refactor adjacent code, add a
   helper folder, widen types, rename exports, or opportunistically clear unrelated findings.
7. Run `@scope-check --base <baseline>`. If it rejects, undo only this run's hunks with `apply_patch`,
   return `MINOR-FIX-REJECTED`, and leave pre-existing work untouched.
8. Run the colocated targeted tests, repository typecheck, and canonical lint scoped to the component
   folder. Read `@lints-fe` only for emitted rules. Repair findings inside the boundary without suppression;
   an unknown rule or a required outside path rejects the minor-fix run.
9. Report the business head, baseline, changed paths, production churn, and proof. Do not commit or push unless the
   request explicitly includes that action.

## Stops

- Workspace route missing or stale.
- Target identity absent, dirty, new, ambiguous, or outside the three admitted tiers.
- Any eligibility fence is crossed before writing.
- Post-patch scope check exceeds two production files, two tests, or 40 production changed lines.
- A gate requires suppression, an unknown lint rule, or a path outside the target folder.
- Block internals, states, or visual anatomy change — larger owner: `starci-fe-design-block`.
- Persistent page geometry or address ownership change — larger owner: `starci-fe-design-layout`.
- Already accepted multi-region implementation — larger owner: `starci-fe-design-execute`.
- Multi-file quality repair or assurance work — larger owner: `starci-repair`.
- Public API or data-ownership change — larger owner: a normal planned coding task.

## OUTPUT

On success, state `minor fix applied`, the component identity, baseline, paths, churn, and proof. On refusal,
state `MINOR-FIX-REJECTED`, the first measured boundary crossed, and the correct larger workflow. No status
tables.
