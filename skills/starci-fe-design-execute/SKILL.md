---
name: starci-fe-design-execute
description: Implement one accepted composed page or page flow from immutable design.json plus preview.html bundles, reusing source-bound existing layouts, applying accepted blocks to their owning pages, and proving code gates and full-viewport parity.
---

# starci-fe-design-execute

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | shared write approval and reporting boundary |
| `@workspaces` | `contexts/workspaces/context.md` | context | resolve and verify the frontend checkout |
| `@worktrees` | `contexts/worktrees/context.md` | context | verify accepted revision authority |
| `@business` | `contexts/business/context.md` | context | prove accepted behavior still matches product truth |
| `@grammar` | `grammars/context.md` | context | load accepted product-family facts, outcomes and owners for verification |
| `@principles` | `compilers/principles/context.md` | context | resolve accepted principle obligations to current classes |
| `@design-review` | `publication/design-review-preview/context.md` | context | accepted bundle and screenshot parity contract |
| `@patterns-fe` | `compilers/patterns/fe/context.md` | context | resolve product files, exports and boundaries before writing |
| `@lints-fe` | `gates/fe/lints/context.md` | context | prove source at the canonical frontend gate |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | verify tokens bound by the accepted layout |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | compare the current receipt with accepted design authority |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | prove capsule, case and template authority before source writes |
| `@verify-design-grammar` | `scripts/verify-design-grammar.mjs` | script | recompute accepted facts and refuse receipt, locked-token or preview palette drift |
| `@design-registry-check` | `scripts/check-design-registry.mjs` | script | resolve and validate current layout/block revision heads |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | verify accepted design metadata and preview digest |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | prove business authority before the first source write |

## NESTED SKILLS

None.

## Run

Read `@skill-shape` first. The caller supplies one stable `layoutId` resolving an accepted composed page set.
This is the design skill that writes
frontend source; exact product paths require one disclosed `Touching` approval before the first write.

For the current layout head and every declared region block head, require one immutable bundle:

```text
registries/revisions/<revisionHash>/design.json
registries/revisions/<revisionHash>/preview.html
```

`design.json` owns identity, ownership, grammar facts/decisions/receipt, contract/anatomy, the UI-condition inventory, transition graph and state
viewport manifest. `preview.html` owns functional composition. Verify `previewSha256` and recompute `revisionHash` from canonical design metadata plus the preview
digest. Registry revision heads are authority; legacy objects are read-only compatibility and cannot start a new
execution by themselves.

## Process

1. Run the registry check. Resolve the current page-set revision and every declared block revision; require exact
   parent `layoutHash`, owning page, accepted artifacts, complete preview HTML and complete page/state manifests.
   Validate the explicit grammar/profile route, recompute every accepted receipt from its facts, and pass each accepted
   `preview.html` to `@verify-design-grammar`; require byte-identical decisions/context hashes and exact visual-contract proof.
2. Verify the routed frontend, current business heads and visual vocabulary. Classify `businessImpact`.
   Business-affecting execution requires the exact feature head at `in-progress` before the first source write;
   technical-only execution declares `none` and binds current `implemented` truth. Run
   `business-write-boundary.mjs` with routed role and clean baseline. `pending` and `rejected` never authorize code.
   If current product behavior changes
   a route, data owner, action or reachable state, return to design instead of implementing stale authority.
3. Load only templates/capsules/principle concerns selected by the recomputed grammar context pack. Resolve every accepted `principleObligation` through current `@principles`, then inspect source and
   `@patterns-fe`. Principles choose the situation classes; patterns choose the owning files and imports. A stale
   or unrepresentable obligation returns to design. Then disclose the smallest exact frontend file boundary under
   `### NEED APPROVALS`. `OK` authorizes those paths once. Record a clean baseline commit before the first write;
   unrelated dirty work stops execution.
4. Implement from the accepted bundles page by page. Reuse every source-bound `existing` composition node rather
   than rebuilding it. Apply each block only to its declared page/region. Preserve page composition, hierarchy, readable measure, surface and
   boundary ownership, breakpoint exclusivity, selected treatment, icon meaning and exactly one scroll owner per
   axis. Reuse existing contract owners before creating or generalizing one. Preview CSS is evidence, not code to
   paste blindly; source tokens and patterns remain implementation law.
   Treat the accepted preview as a visual outcome, not a recipe for recreating primitives. Search the current
   source first and generalize an existing owner when its reason already matches; a new component requires
   evidence that no existing leaf, composite, branch or block owns the situation.
5. Implement every page/viewport/state pair and every declared transition named by each `design.json`. Exercise
   navigation, tabs, forms, disclosure, drawer, modal, popover/menu, primary/retry and responsive transitions in
   the product. A divider, `ScrollBranch` or
   `SurfaceListCard` is required only when that accepted situation uses it; never universalize an example.
6. Run canonical lint/tests and browser interaction proof. Reach every accepted state through its product control,
   resize the same page across accepted breakpoints, and capture screenshots at the exact accepted viewport/state pairs. Compare
   composition, region bounds, hierarchy, measure, boundaries, scroll ownership and responsive chrome. A
   lint-clean result that drifts visually still fails and must be repaired inside `Touching`.
7. For business-affecting work, commit final source, reconcile the same feature from `in-progress` to
   `implemented` against final heads, and rerun the business registry check. Technical-only work retains its
   implemented head. Close with applied revision heads, business status/head, baseline, exact changed paths and executable proof. Any new path or product
   decision returns to the owner instead of entering the diff silently.

## Stops

- Missing/proposed/legacy-only layout or block revision, grammar/profile/receipt drift, preview digest mismatch, render-only preview, incomplete
  UI-condition/transition coverage, incomplete states or stale
  parent binding → stop and name the identity.
- Accepted business behavior or vocabulary is stale → return to design.
- Dirty target tree or required write outside approved `Touching` → stop; do not absorb unrelated work.
- Required contract class or pattern is unrepresentable → return the contract decision; do not approximate.
- Lint or visual parity cannot be repaired inside the boundary → return the boundary; never suppress the gate.

## OUTPUT

State `layoutId`, applied layout/block revision hashes, grammar receipt, baseline, material paths and code/visual proof in concise
prose. Only a genuine new authority decision may appear under `### NEED APPROVALS`; deterministic repair remains
owned work. No status tables.
