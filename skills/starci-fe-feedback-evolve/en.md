---
title: starci-fe-feedback-evolve · English
---

# starci-fe-feedback-evolve

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/en.md` | en | shared approval, baseline and reporting boundary |
| `@workspaces` | `contexts/workspaces/en.md` | en | verify the routed frontend and explicit grammar/profile |
| `@worktrees` | `contexts/worktrees/en.md` | en | preserve immutable design history and disposable drafts |
| `@business` | `contexts/business/en.md` | en | distinguish visual correction from changed product truth |
| `@grammar` | `grammars` | module | test whether stable product-family vocabulary is missing |
| `@principles` | `compilers/principles` | module | test whether general visual law is missing or misapplied |
| `@patterns-fe` | `compilers/patterns/fe` | module | test source ownership and file architecture |
| `@lints-fe` | `gates/fe/lints` | module | bind observable law to accountable gates |
| `@standards` | `standards` | module | preserve law-to-proof accountability |
| `@design-review` | `publication/design-review-preview/en.md` | en | append corrected immutable design revisions |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | prove grammar facts, cases, capsules, templates and profile owners |
| `@verify-design-grammar` | `scripts/verify-design-grammar.mjs` | script | recompute affected design receipts after grammar evolution |
| `@design-registry-check` | `scripts/check-design-registry.mjs` | script | prove accepted revision and block-parent currentness |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | refuse source writes against the wrong business authority |
| `@compile-context` | `scripts/compile-context.mjs` | script | rebuild runtime context after paired authority publication changes |
| `@check-deps` | `scripts/check-deps.mjs` | script | prove runtime, English and Vietnamese dependency graphs |

## NESTED SKILLS

None.

## Purpose

Turn concrete owner feedback on an accepted frontend design or implementation into a better reasoning system and
a corrected product outcome. The capability separates missing authority from failure to apply authority that
already existed, improves only the highest durable owner that was incomplete, then carries that correction
through affected design authority and product code.

## Boundary

The input is feedback tied to a visible page/state, accepted revision or committed frontend result. The run may
write only disclosed authority modules, affected design identities and routed FE files. Screenshots do not create
business facts. Immutable revisions are replaced, never edited. A grammar hash change never authorizes refreshing
unrelated receipts. Product-behavior changes return to business authority before writes; visual corrections bind
the current implemented feature with `businessImpact: none`.

## Reasoning ladder

Every feedback item must prove:

```text
observed symptom → expected outcome → source/legacy evidence
→ governing rule named and put on trial → missing or misdrawn invariant
→ correct authority layer → nearby counterexample → enforcement opportunity
→ affected design identities → smallest source consequence
```

Jumping directly from screenshot to CSS, from one example to a grammar rule, or from a principle to unrelated
source churn is invalid. Citing the governing rule without trying it is equally invalid: quoting a situation
table is not the same as asking whether that situation is drawn where it belongs.

## Authority interrogation

The law is examined before the product is. Owner feedback is evidence that something in the chain is wrong, and
the chain begins at the rule. A run that finds an answer in a situation table and proceeds to blame the code has
skipped the only step that can catch a defective rule, because a defective rule always has an answer — that is
what makes it defective rather than absent.

Measure the authority itself before classifying anything. Run the dependency and grammar gates over the trust
tree and read each finding as a fact about the law: a publication carrying a situation its runtime record does
not, a profile owner whose stated debt is still open, a manifest hash adrift from its source. Left unmeasured,
each of these reappears later as a false gap in the product.

Then name the exact rule, situation code or profile owner governing each item and return one verdict. `sound`
means the rule answers correctly and the product is at fault. `misdrawn` means it answers and the answer is
wrong here. `absent` means nothing reaches the situation. No item may reach classification without one, and
`sound` is not the default.

A `misdrawn` verdict is earned by a counterexample the current rule decides wrongly — one real composition
where following the rule to the letter produces the outcome the owner is correcting. Owner dissatisfaction is
not a counterexample, and neither is a rule that merely feels coarse; without one the verdict is `sound`.

Interrogation is also how an owner is answered when the law survives. A rule that was tried and held can be
shown with its boundary and its adjacent code, which is a reason. A rule that was only looked up can be shown
only as a citation, which is an appeal to authority.

## Classification

- **Law misruling:** an existing rule, situation or profile owner governs the case and decides it wrongly — a boundary drawn in the wrong place or a wrong emission. Correct the rule at its owning module, carry paired publications and runtime record together, and add the counterexample that fails under the old wording. Never satisfy a wrong rule by changing the product.
- **Evidence inventory miss:** required precedent existed but decomposition omitted it.
- **Application miss:** current grammar/principle already answered; correct facts, situation, obligation, design and source without changing law.
- **Grammar gap:** a stable product-family fact cannot select its deterministic semantic owner; promote fact, rule, capsule, profile owner, golden/counterexample cases and template together.
- **Principle gap:** a product-neutral visual situation or required emission is absent, including neutralizing a vendor default.
- **Pattern or gate gap:** ownership architecture is absent, or an observable repeated violation passes existing enforcement.
- **Source drift:** authority/design are right and code differs.
- **Local preference:** valid only for this composition; preserve in design/source and never universalize.

## Process

1. Resolve language, Source, routed FE, grammar/profile, business head, accepted design heads and committed baseline.
2. Interrogate the authority first: run the dependency and grammar gates over the trust tree, record every finding as a fact about the law, then return a `sound`/`misdrawn`/`absent` verdict per item with any counterexample a `misdrawn` verdict requires. Red or stale authority is reported before it is reasoned from.
3. Reproduce the state and read the complete relevant source/legacy subtree, including header, identity, surface, controls, overlays and responsive owner.
4. Run the reasoning ladder and classify every item, carrying the step-2 verdict. An existing answer is an application miss only when it survived interrogation; an answer that failed is a `Law misruling` and the law moves, not the product.
5. Build an impact cone: authority files, changed hashes, stale receipts, affected design identities, source owners and tests.
6. Present one exact `Touching` approval. After `OK`, capture trust and FE baselines.
7. Write authority first. Keep English/Vietnamese/runtime records aligned; grammar promotions are complete sets; enforceable law gains its real machine twin only inside the approved route.
8. Validate grammar, contexts and dependency graphs with meaningful golden/counterexample proof.
9. Append corrected full-page/flow design revisions and recompute only affected receipts/obligations.
10. Implement through emitted semantic owners and source patterns, never preview CSS or caller styling doors.
11. Run scoped and repository gates, unit/interaction tests and browser proof for every affected state/viewport.
12. Commit trust, registry and FE separately; push only when requested.

## Stops

- No observable state or recoverable expected outcome.
- Source contradicts the claimed product fact.
- A proposed new law is already expressible. Correcting a present, misdrawn rule is not an addition and is not stopped here; it stops only for want of a counterexample.
- A `misdrawn` verdict has no counterexample, or an item reached classification with no verdict at all.
- Authority gates were not run before the first classification, or a finding was carried past it unreported.
- Grammar promotion lacks its complete evidence set or impact cone.
- Principle addition cannot distinguish its nearest situation.
- Immutable or unrelated design history would be rewritten.
- Source precedes green authority/design.
- Required machine/source lies outside approval.

## OUTPUT

Report classifications, strengthened authority, superseding design hashes, source commit, business status and
proof. Explicitly distinguish real law gaps from application failures.
