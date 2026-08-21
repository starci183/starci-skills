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

## NESTED SKILLS

None. This capability owns authority correction, transient preview, source correction and proof in one invocation.

## Purpose

Classify owner feedback as `Law misruling`, `Evidence inventory miss`, `Application miss`, `Grammar gap`, `Principle gap`, `Pattern or gate gap`, `Source drift` or `Local preference`. Improve only the highest authority that was genuinely incomplete. Source code and proof are the durable design outcome; no design revision is stored.

## Process

1. Resolve language, Source, project, routed FE, grammar/profile, business head, committed source baseline and observable feedback.
2. Run dependency and grammar authority checks before classification. Name the governing rule and verdict `sound`, `misdrawn` or `absent`; `misdrawn` requires a real counterexample.
3. Reproduce the state and inspect the complete relevant source subtree.
4. Build the reasoning chain: symptom → expected outcome → evidence → rule on trial → missing invariant → authority layer → counterexample → enforcement → source consequence.
5. Build the impact cone. Present one exact `### NEED APPROVALS` authority and source boundary. `OK` authorizes it once; take baselines before the first write.
6. Write authority before product code when law changes, update paired English/Vietnamese records, compile runtime context and run dependency/grammar proof.
7. Render any needed correction preview only under `.worktrees/<project>/cache/design/<session-id>`. It is evidence for this invocation, not authority.
8. Correct the routed frontend in the same invocation. Run scoped and repository gates plus browser proof at every affected viewport/state.
9. Reconcile business authority when product behavior changed. Report authority identities, source paths and executable proof; never report design heads.

## Rules

1. Authority is interrogated before product classification.
2. Design preview and source correction happen in one invocation.
3. Cache cannot be consumed as accepted truth by another task.
4. No design registry, revision bundle or design head is written.
5. Law changes precede source changes and carry paired publications plus executable proof.
6. Feedback that changes product truth returns to business authority first.

## Stops

- No observable state or recoverable expected outcome.
- Authority gates were not run before classification.
- `misdrawn` has no counterexample.
- A grammar/principle addition is already expressible by current law.
- Business-affecting source work lacks `in-progress` authority.
- Required path lies outside the approved boundary.

## OUTPUT

Report classification, strengthened authority, changed source paths, business status and code/browser proof. State which items were law gaps and which were application/source failures. No registry identities.
