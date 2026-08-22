---
name: starci-fe-feedback-evolve
description: Turn concrete owner feedback on an accepted frontend implementation into the smallest durable improvement to evidence, grammar, principles, patterns or gates, then correct and visually prove source in the same invocation. Design previews are disposable cache; use when feedback shows reasoning failed at the wrong layer.
---

# starci-fe-feedback-evolve

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | shared approval, baseline and reporting boundary |
| `@workspaces` | `contexts/workspaces/context.md` | context | verify routed frontend and grammar/profile |
| `@worktrees` | `contexts/worktrees/context.md` | context | keep correction previews in session cache |
| `@composition` | `brainstorms/composition/context.md` | context | distinguish wrong parent from missing law |
| `@business` | `contexts/business/context.md` | context | distinguish visual correction from product truth |
| `@grammar` | `grammars/context.md` | context | test stable product-family facts and owners |
| `@principles` | `compilers/principles/context.md` | context | test product-neutral visual law |
| `@patterns-fe` | `compilers/patterns/fe/context.md` | context | test source ownership and architecture |
| `@lints-fe` | `gates/fe/lints/context.md` | context | bind observable law to a gate |
| `@standards` | `standards/context.md` | context | preserve law-to-proof accountability |
| `@design-review` | `publication/design-review-preview/context.md` | context | render corrected candidate in cache |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | prove grammar authority |
| `@verify-design-grammar` | `scripts/verify-design-grammar.mjs` | script | prove the current correction receipt |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | refuse source writes against wrong business authority |
| `@compile-context` | `scripts/compile-context.mjs` | script | rebuild runtime context after authority changes |
| `@check-deps` | `scripts/check-deps.mjs` | script | prove runtime and publication graphs |
| `@validate-baseline` | `scripts/validate-design-baseline.mjs` | script | prove Scope, Owner, Invariant and Proof locks |
| `@validate-principles` | `scripts/validate-fe-principles.mjs` | script | refuse concerns without real modules |
| `@validate-visual-proof` | `scripts/validate-visual-proof.mjs` | script | refuse incomplete or undelivered corrections |

## NESTED SKILLS

None. This capability owns authority correction, transient preview, source correction and proof in one invocation.

## Purpose

Classify owner feedback as `Law misruling`, `Evidence inventory miss`, `Application miss`, `Grammar gap`, `Principle gap`, `Pattern or gate gap`, `Source drift` or `Local preference`. Improve only the highest authority that was genuinely incomplete. Source code and proof are the durable design outcome; no design revision is stored.

## Process

1. Resolve language, Source, project, routed FE, grammar/profile, business head, committed source baseline and observable feedback. Print the shared two-row execution table: read-only audit, then one approved authority/source/proof batch.
2. Run dependency and grammar authority checks before classification. Name the governing rule and verdict `sound`, `misdrawn` or `absent`; `misdrawn` requires a real counterexample.
3. Reproduce the state, build the four-lock composition baseline and inspect the complete relevant source subtree. A wrong parent is an inventory/application miss until the governing principle itself fails a counterexample.
4. Build the reasoning chain: symptom → expected outcome → evidence → rule on trial → missing invariant → authority layer → counterexample → enforcement → source consequence. For every owner observation, state `correct`, `incorrect` or `partly-correct`, explain why, and name why the AI has not executed it: approval boundary, missing evidence, external blocker, or AI reasoning/reporting failure. `Waiting for OK` alone is not an explanation. When feedback concerns state or data ownership, start at the smallest visible changing surface and trace its concrete `ComponentBase → Component → PageBase/LayoutBase/OverlayBase → Page/Layout/Overlay` chain. Treat nested block state or request data under outer-surface props as a proxy, not an extraction. Require nested Block chains only where a Layout or Overlay composes an independently stateful subtree.
5. Build the impact cone from the real owner chain, including exact child component files rather than only page files. Compile one authority-to-write map: one decision has one semantic owner, each path belongs to one write batch, and already-sound owners are explicitly preserved. Present one exact `### NEED APPROVALS` authority, source and proof boundary. `OK` authorizes that one batch once; take baselines before the first write.
6. Inside the approved batch, write authority before product code when law changes, update paired English/Vietnamese records, compile runtime context and run dependency/grammar proof. Do not finish a source patch and open a second pass for the authority/reasoning already exposed by the same feedback.
7. Render any needed correction preview only under cache. Apply MASTER once, record page deviations only, and route only unresolved deltas to principles.
8. Correct the routed frontend in the same invocation. Run gates and same-viewport full-page browser comparison; completion requires zero known defects and the requested delivery state.
9. Reconcile business authority when product behavior changed. Report authority identities, source paths and executable proof; never report design heads.

## Rules

1. Authority is interrogated before product classification.
2. Design preview and source correction happen in one invocation.
3. Cache cannot be consumed as accepted truth by another task.
4. No design registry, revision bundle or design head is written.
5. Law changes precede source changes and carry paired publications plus executable proof.
6. Feedback that changes product truth returns to business authority first.
7. `example` and `local-preference` feedback cannot promote grammar; `invariant`/`correction` requires explicit scope and negative boundary.
8. One feedback chain produces one verdict table and one authority-to-write batch; the source consequence, explanation and durable correction are never split into duplicate passes.

## Stops

- No observable state or recoverable expected outcome.
- Authority gates were not run before classification.
- `misdrawn` has no counterexample.
- A grammar/principle addition is already expressible by current law.
- Business-affecting source work lacks `in-progress` authority.
- Required path lies outside the approved boundary.

## OUTPUT

Render one compact owner-feedback verdict table with columns `Observation`, `Verdict`, `Why`, `Why not executed`, `Authority correction`, `Source correction` and `Proof`. Report the one-pass authority-to-write map, strengthened authority, changed source paths, preserved sound owners, business status and code/browser proof. State which items were law gaps and which were application/source failures. No registry identities.
