---
title: starci-fe-design-execute · English
---

# starci-fe-design-execute

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/en.md` | en | shared write approval and reporting boundary |
| `@workspaces` | `contexts/workspaces/en.md` | en | resolve and verify the frontend checkout |
| `@worktrees` | `contexts/worktrees/en.md` | en | verify accepted revision authority |
| `@business` | `contexts/business/en.md` | en | prove accepted behavior still matches product truth |
| `@grammar` | `grammars` | module | load accepted product-family facts, outcomes and owners for verification |
| `@principles` | `compilers/principles` | module | resolve accepted principle obligations |
| `@design-review` | `publication/design-review-preview/en.md` | en | accepted bundle and screenshot parity contract |
| `@patterns-fe` | `compilers/patterns/fe` | module | resolve product files, exports and boundaries before writing |
| `@lints-fe` | `gates/fe/lints` | module | prove source at the canonical frontend gate |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | verify tokens bound by the accepted layout |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | compare the current receipt with accepted design authority |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | prove capsule, case and template authority before source writes |
| `@verify-design-grammar` | `scripts/verify-design-grammar.mjs` | script | recompute accepted facts and refuse decision or receipt drift |
| `@design-registry-check` | `scripts/check-design-registry.mjs` | script | resolve and validate current layout/block revision heads |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | verify accepted design metadata and preview digest |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | prove authority before source write |

## NESTED SKILLS

None.

## Run

This capability implements one accepted frontend composed page or page flow. It is the design capability that writes product source,
so exact paths require one disclosed `Touching` approval and a clean baseline before the first write.

**Authority.**

The current layout head and every declared block head must resolve to an immutable bundle:

```text
registries/revisions/<revisionHash>/design.json
registries/revisions/<revisionHash>/preview.html
```

`design.json` owns identity, ownership, grammar facts/decisions/receipt, contract/anatomy and the state viewport manifest. `preview.html` owns
composition. Verify its `previewSha256` and recompute `revisionHash` from canonical design metadata plus the
preview digest. Registry revision heads are implementation authority. Legacy objects remain readable history but
cannot start a new execution without a current revision bundle.

## Process

**1. Resolve complete accepted input.**

Run the registry check. Resolve every page and ordered nested ownership node in the current layout revision, then
every declared block revision against its owning page. Require an exact
parent `layoutHash`, accepted artifacts, valid preview digest and complete state viewport manifests. A proposed,
missing, legacy-only or stale child stops execution before source inspection becomes a write plan.
Validate the explicit grammar/profile route and recompute every accepted receipt from its facts. Only the selected
capsules, templates and principle concerns enter implementation context; any hash drift returns to design.

**2. Verify current truth and the write boundary.**

Verify the routed frontend, business heads and visual vocabulary. If current behavior changes a route, data
owner, action or reachable state, return to design rather than implementing stale authority.

Read source and `@patterns-fe`, then disclose the smallest exact frontend path boundary under
`### NEED APPROVALS`. `OK` authorizes those paths once. Take a clean baseline commit before the first product
write. Unrelated dirty work stops the run because it cannot produce an honest diff.

**3. Implement the accepted composition.**

Reuse every source-bound `existing` node rather than duplicating or redesigning it. Preserve page-set composition,
hierarchy, readable measure, surface and boundary ownership, breakpoint exclusivity,
selected treatment, icon meaning and exactly one scroll owner per axis. Reuse existing contract owners before
creating or generalizing one. Preview CSS is visual evidence, not source to paste blindly; frontend tokens,
principles and patterns remain implementation law.

Implement every viewport/state pair named by each design record. A divider, `ScrollBranch` or `SurfaceListCard`
is required only when the accepted situation uses it. An example is never promoted to a universal architecture
rule.

**4. Prove code and visual parity.**

Run canonical lint and tests. Capture the implementation at the exact accepted viewport/state pairs and compare:

- breakpoint-exclusive desktop/mobile chrome;
- hierarchy and content measure;
- region and surface bounds;
- boundary/divider ownership;
- scroll ownership;
- selected and state treatments.

Lint-clean visual drift still fails. Repair it inside `Touching`; never suppress a gate or silently add a path.

**5. Close.**

Report applied layout/block revision heads, baseline, exact changed paths and executable code/visual proof. A new
path or product decision returns to the owner. Deterministic repair remains owned work and does not create another
approval checkpoint.

## Stops

- Missing/proposed/legacy-only revision, grammar/profile/receipt drift, preview digest mismatch, incomplete states or stale parent binding stops
  execution and names the identity.
- Stale business behavior or vocabulary returns to design.
- Dirty target tree or a required path outside approved `Touching` stops the run.
- Unrepresentable contract class or pattern returns the contract decision; it is never approximated.
- Lint or visual parity that cannot be repaired inside the boundary returns that boundary; no gate is suppressed.

Implementation must reproduce the accepted condition inventory, business-content matrix and transition graph.
Browser proof reaches every accepted state through product controls, resizes the same page across breakpoints and
exercises reachable modal, drawer, menu/popover, expanded/collapsed, loading, empty, error, locked and disabled
conditions. A render-only implementation or screenshot-only parity fails.

## OUTPUT

State `layoutId`, applied layout/block revision hashes, grammar receipt, baseline, material paths and code/visual proof in concise
prose. Only a genuine new authority decision appears under `### NEED APPROVALS`. No status tables.
