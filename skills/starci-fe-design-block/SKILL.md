---
name: starci-fe-design-block
description: Challenge, preview, approve, implement and visually prove one frontend block inside its exact current composed page in one invocation. Uses routed business truth, grammar, contracts and source; preview artifacts are disposable cache and no design registry is created.
---

# starci-fe-design-block

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | shared approval and reporting boundary |
| `@workspaces` | `contexts/workspaces/context.md` | context | resolve and verify the frontend route |
| `@worktrees` | `contexts/worktrees/context.md` | context | keep review evidence in session cache |
| `@composition` | `brainstorms/composition/context.md` | context | lock highlighted parent, preserved page and proof scope |
| `@business` | `contexts/business/context.md` | context | resolve real data, actions and states |
| `@grammar` | `grammars/context.md` | context | load routed block facts, outcomes and owners |
| `@principles` | `compilers/principles/context.md` | context | audit the selected anatomy |
| `@patterns-fe` | `compilers/patterns/fe/context.md` | context | choose owning source files and imports |
| `@lints-fe` | `gates/fe/lints/context.md` | context | prove implemented source |
| `@blocks` | `brainstorms/blocks/context.md` | context | block ownership, anatomy, state and contract law |
| `@design-review` | `publication/design-review-preview/context.md` | context | exact-parent authored HTML review in cache |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | verify current vocabulary |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | resolve deterministic block grammar decisions |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | prove the routed grammar package |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate session artifacts |
| `@validate-baseline` | `scripts/validate-design-baseline.mjs` | script | refuse a partial parent or missing page parity |
| `@validate-principles` | `scripts/validate-fe-principles.mjs` | script | refuse phantom principle concerns |
| `@validate-visual-proof` | `scripts/validate-visual-proof.mjs` | script | enforce full-page same-viewport proof |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | publish the cache review |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | prove business authority before source writes |

## NESTED SKILLS

None. This skill owns the block decision through implementation and full-page QA.

## Run

Resolve the verified FE route, grammar/profile, current business head, contract vocabulary and clean committed source baseline. The caller supplies one current page/route and block boundary; resolve that block from source rather than a design head.

Read the complete parent composition and exact owning subtree. Write `baseline.json` with the highlighted owner, every direct child, preserved page nodes, allowed delta and reference viewport/state. A coloured annotation is parent evidence: a wrapper containing only some enclosed children is refused before any gap or padding decision.

Create `.worktrees/<project>/cache/design/<session-id>` and author three or four materially distinct functional block candidates embedded in the exact current parent page. Preserve all untargeted rendering. All candidates inherit MASTER; page overrides contain deviations only. Principles audit only the remaining delta.

Render the cache review. Disclose the recommended candidate and smallest exact frontend paths under one `### NEED APPROVALS`. After `OK`, take the target baseline and implement immediately in the same invocation. Reuse current contract owners and source patterns; implement all states and transitions.

Run canonical lint/tests and browser proof on the complete real page at every baseline viewport/state. Prove full-page parity, target parent fit, preserved regions, transitions and clean console through `visual-proof.json`. Known defects or an unmet delivery target forbid completion wording.

## Rules

1. The current routed source page is the parent authority.
2. Design, approval, implementation and QA occur in one invocation.
3. Candidate and selected previews live only in project cache.
4. No block head, layout head, revision bundle or design branch is created.
5. Untargeted parent and sibling regions remain unchanged.
6. Source plus full-page browser proof is the durable outcome.
7. MASTER is never re-decided by a block; only evidenced page/block deviations may differ.

## Stops

- Missing current parent page, ambiguous block ownership, stale route, grammar/profile or business truth.
- Unknown data owner, action, outcome or state.
- Missing contract/vocabulary evidence, parent embedding, conditions, functional transitions or viewport coverage.
- Fewer than three materially distinct candidates or fabricated product content.
- Required source change outside the approved boundary.

## OUTPUT

Before approval, report the current page/block boundary, ranked candidates, recommendation, cache review URL and exact source paths. After `OK`, report baseline, changed paths, business status and full-page code/browser proof. Never report layout hashes, block heads or revision hashes.
