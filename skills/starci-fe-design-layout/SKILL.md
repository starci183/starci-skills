---
name: starci-fe-design-layout
description: Confirm one composed page or end-to-end page flow, then challenge, preview, approve, implement and visually prove that exact frontend scope in one invocation using routed business truth, grammar, contracts and current source. Preview artifacts are disposable cache; no design registry is created.
---

# starci-fe-design-layout

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | shared approval and reporting boundary |
| `@workspaces` | `contexts/workspaces/context.md` | context | resolve and verify the frontend route |
| `@worktrees` | `contexts/worktrees/context.md` | context | keep review evidence in session cache |
| `@composition` | `brainstorms/composition/context.md` | context | lock Scope, Owner, Invariant and Proof before visual reasoning |
| `@business` | `contexts/business/context.md` | context | bind the page to current product truth |
| `@grammar` | `grammars/context.md` | context | load routed product-family facts, outcomes and owners |
| `@principles` | `compilers/principles/context.md` | context | audit selected visual decisions |
| `@patterns-fe` | `compilers/patterns/fe/context.md` | context | choose source files and ownership before writing |
| `@lints-fe` | `gates/fe/lints/context.md` | context | prove the implemented source |
| `@layouts` | `brainstorms/layouts/context.md` | context | compose pages, regions and ownership |
| `@design-review` | `publication/design-review-preview/context.md` | context | authored HTML review in cache |
| `@contract-search` | `scripts/contract-search.mjs` | script | query contract reasons without exposing classes |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | emit selected grammar decisions and compact context |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | prove the routed grammar package |
| `@verify-design-grammar` | `scripts/verify-design-grammar.mjs` | script | refuse theme or receipt drift |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | bind candidates to current frontend vocabulary |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate session design artifacts |
| `@validate-baseline` | `scripts/validate-design-baseline.mjs` | script | refuse wrong parent, unbounded delta or missing full-page proof |
| `@validate-principles` | `scripts/validate-fe-principles.mjs` | script | refuse phantom principle concerns |
| `@validate-visual-proof` | `scripts/validate-visual-proof.mjs` | script | enforce same-viewport parity and terminal delivery state |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | publish the cache review |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | prove business authority before source writes |

## NESTED SKILLS

None. This skill owns design through implementation and QA in one invocation.

## Run

Read `@skill-shape` first. Confirm exactly one scope checkpoint: `page` for one composed route and all reachable states/overlays, or `flow` for an explicit start-to-end route/page sequence. A screenshot never silently authorizes another page.

Resolve the verified FE route, explicit grammar/profile, MASTER visual system, current business head, contract vocabulary and committed source baseline. Classify `businessImpact`. Business-affecting work requires the matching feature at `in-progress`; technical-only work binds current `implemented` truth.

Create one ignored session root at `.worktrees/<project>/cache/design/<session-id>`. Use `@composition` to write and validate `baseline.json`: Scope, exact parent/direct children, semantic invariant, preserved nodes, allowed deltas and same-viewport proof obligations. Legacy/screenshot evidence outranks MASTER inside its declared scope; MASTER governs everything not overridden. Read the complete current composition and preserve every source-bound existing node outside `allowedDeltas`.

Author three or four materially distinct complete functional HTML candidates covering the entire page or flow. Every candidate shares MASTER axes, roles, spacing rhythm and anti-patterns; a page override records deviations only. Rank them using baseline parity, business fit, hierarchy, reuse, accessibility and responsive behavior. Audit only visual deltas still unresolved after baseline, MASTER, grammar and source through `@principles`.

Render the cache review and disclose one `### NEED APPROVALS` boundary containing the recommended candidate, exact frontend source paths and product decision, if any. `OK` authorizes the candidate and those paths once. Take the target baseline after approval and before the first source write.

Implement the approved outcome immediately in the routed frontend. Resolve obligations through current principles and source patterns; reuse contract owners before creating new ones. Preview CSS is evidence, not code to paste. Implement every declared state, transition and responsive condition.

Run canonical lint/tests and browser proof against the real product at every reference viewport/state. Compare the full viewport, target region and preserved regions against baseline; computed CSS is supporting evidence only. Write `visual-proof.json` and pass `@validate-visual-proof`. Never say complete before known defects are empty and the requested terminal delivery state is reached.

## Rules

1. Design, owner approval, source implementation and QA occur in one invocation.
2. Candidates and selected preview live only in project cache.
3. No layout head, block head, immutable design revision or design branch is created.
4. Another task regenerates from current business, grammar, contract and source.
5. A page/flow candidate includes every owned region; incomplete compositions are refused.
6. Exact source paths require one disclosed approval before the first write.
7. Frontend source and executable proof are the durable outcome.
8. MASTER is selected once; page files contain deviations only, and principles resolve deltas only.

## Stops

- Missing/stale route, grammar/profile, business authority, vocabulary or source baseline.
- Missing page/flow scope confirmation or explicit flow endpoints.
- Fabricated product content, incomplete condition inventory, fewer than three materially distinct candidates or non-functional HTML.
- Approval without an exact source boundary.
- A new actor, entitlement, route, operation, data owner, state transition or product outcome without business authority.
- A source/gate/visual defect that cannot be repaired inside the approved boundary.

## OUTPUT

Before approval, report scope, ranked candidates, recommendation, cache review URL and exact source boundary. After `OK`, report baseline, changed source paths, business status and code/browser proof. Never report registry heads or accepted revision hashes.
