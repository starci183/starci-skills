---
name: starci-fe-feedback-evolve
description: Turn concrete owner feedback on an accepted frontend design or implementation into durable improvements across evidence inventory, grammar, principles, patterns or gates, then revise affected design authority and source code. Use when feedback reveals that the system reasoned at the wrong layer; not for ordinary unaccepted design iteration or a small isolated code fix.
---

# starci-fe-feedback-evolve

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | shared approval, baseline and reporting boundary |
| `@workspaces` | `contexts/workspaces/context.md` | context | verify the routed frontend and explicit grammar/profile |
| `@worktrees` | `contexts/worktrees/context.md` | context | preserve immutable design history and disposable drafts |
| `@business` | `contexts/business/context.md` | context | distinguish visual correction from changed product truth |
| `@grammar` | `grammars/context.md` | context | test whether a stable product-family fact or owner is missing |
| `@principles` | `compilers/principles/context.md` | context | test whether a general visual situation is missing or misapplied |
| `@patterns-fe` | `compilers/patterns/fe/context.md` | context | test whether source ownership or file architecture is missing |
| `@lints-fe` | `gates/fe/lints/context.md` | context | bind mechanically observable law to an accountable gate |
| `@standards` | `standards/context.md` | context | preserve law → gate → machine → proof accountability |
| `@design-review` | `publication/design-review-preview/context.md` | context | append corrected immutable design revisions and prove viewports |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | prove grammar facts, cases, capsules, templates and profile owners |
| `@verify-design-grammar` | `scripts/verify-design-grammar.mjs` | script | recompute affected design receipts after grammar evolution |
| `@design-registry-check` | `scripts/check-design-registry.mjs` | script | prove accepted revision and block-parent currentness |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | refuse source writes against the wrong business authority |
| `@compile-context` | `scripts/compile-context.mjs` | script | rebuild runtime context after paired authority publication changes |
| `@check-deps` | `scripts/check-deps.mjs` | script | prove runtime, English and Vietnamese dependency graphs |

## NESTED SKILLS

None. This capability owns one feedback-evolution run. It does not invoke design, execute, repair or business
skills as hidden recovery.

## Purpose

Convert one concrete owner correction into a better reasoning system and a corrected product outcome. The run
must determine whether the failure came from missing evidence, missing durable vocabulary, missing general law,
missing source architecture, missing enforcement, or a bad application of law that already existed. It improves
the highest durable owner that was genuinely incomplete and never creates a new rule merely to explain one bad
screen.

## Boundary

The input is owner feedback tied to a visible page/state, accepted design revision or committed frontend result.
The skill may write only the exact disclosed authority modules, affected design registry identities and routed
frontend files. It never imports business facts from screenshots, rewrites immutable revisions, refreshes every
design receipt after a grammar hash change, or broadens a local preference into universal law.

If the feedback changes actor, entitlement, route, operation, data owner, state transition or product outcome,
stop before writes: business authority must advance separately. Otherwise declare `businessImpact: none` and
bind the current implemented feature head.

## Reasoning ladder

For every feedback item, write and prove this chain before proposing a file:

```text
observed symptom
→ expected outcome
→ source/legacy evidence
→ governing rule named and put on trial
→ missing or misdrawn invariant
→ correct authority layer
→ nearby counterexample
→ enforcement opportunity
→ affected design identities
→ smallest source consequence
```

The chain is incomplete if it jumps from screenshot directly to CSS, from one source example directly to a
grammar rule, or from a principle sentence directly to unrelated product churn. It is equally incomplete if the
governing rule is cited but never tried: quoting a situation table is not the same as asking whether that
situation is drawn where it belongs.

## Authority interrogation

**The law is examined before the product is.** Owner feedback is evidence that something in the chain is wrong,
and the chain begins at the rule, not at the component. A run that reads a situation table, finds an answer and
proceeds to blame the code has skipped the only step that can find a defective rule — because a defective rule
always has an answer. That is what makes it defective rather than absent.

Before classifying anything, measure the authority itself. Run `@check-deps` and `@validate-grammar` over the
trust tree and read every finding as a fact about the law, not as noise to be cleared later. A publication that
carries a situation its runtime record does not, a profile owner whose stated debt is still open, a manifest hash
that no longer matches its source — each of these will otherwise be discovered as a false gap in the product.

Then, for each feedback item, name the exact rule, situation code or profile owner that governs it, and return
one of three verdicts. A verdict is not optional and `sound` is not the default.

| Verdict | What it means | Where it goes |
|---|---|---|
| `sound` | The rule answers this situation and answers it correctly | classify against the product |
| `misdrawn` | The rule answers, and the answer is wrong for this situation | `Law misruling` |
| `absent` | No rule reaches this situation at all | `Grammar gap` or `Principle gap` |

`misdrawn` must be earned, not asserted. It requires a **counterexample the current rule decides wrongly** —
one real composition where following the rule to the letter produces the outcome the owner is correcting. Owner
dissatisfaction alone is not a counterexample; neither is a rule that merely feels coarse. Without one, the
verdict is `sound` and the correction belongs to the product.

Interrogation is also how an owner is answered when the law survives it. A rule that has been tried and held can
be shown to the owner with its boundary and its adjacent code, which is a reason. A rule that was only looked up
can be shown to the owner only as a citation, which is an appeal to authority.

## Classification

Choose exactly one primary class per feedback item; secondary consequences may cite it.

- **Law misruling** — an existing rule, situation or profile owner governs this case and decides it wrongly:
  its boundary is drawn in the wrong place, or it emits the wrong outcome. Correct the rule at its owning module,
  carry the paired publications and runtime record together, and add the counterexample that fails under the old
  wording and passes under the new. Never resolve a misruling by changing the product to satisfy a rule that is
  itself wrong.
- **Evidence inventory miss** — routed source or accepted legacy already contained the required element, state,
  owner or relationship, but design decomposition omitted it. Correct the design/source and strengthen the
  inventory proof only when the omission could recur mechanically.
- **Application miss** — current grammar or principle already resolves the situation. Do not change the law;
  correct the facts, selected situation, principle obligation, design revision and source.
- **Grammar gap** — a stable product-family fact deterministically selects a semantic outcome and owner, and the
  closed fact/rule/capsule/profile vocabulary cannot express it. Add the fact, rule, outcome owner, capsule,
  golden case, counterexample and durable template together.
- **Principle gap** — a product-neutral visual relationship has no canonical situation or cannot emit the class
  needed to express its own outcome, including the case where a vendor default must be neutralized. Update the
  paired English/Vietnamese publication and runtime context with the same situation identity and boundaries.
- **Pattern or gate gap** — the desired result is about file/import/slot/owner architecture, or an observable
  violation of existing law repeatedly passes. Add law only at its owning pattern; add a gate only when the
  syntax is observable and the machine source is in the disclosed boundary.
- **Source drift** — accepted design and current authority are correct, but product code differs. Change source
  and tests only; changing law would hide the implementation defect.
- **Local preference** — the feedback is valid for this composition but has no stable generalization. Preserve it
  in the new design revision and source; do not promote it to grammar or principles.

## Process

1. Resolve language, Source, project, routed FE, grammar/profile, business head, accepted layout/block heads,
   committed source baseline and exact owner feedback. Verify registry and target worktrees are clean.
2. **Interrogate the authority first.** Run `@check-deps` and `@validate-grammar` over the trust tree and record
   every finding as a fact about the law. Then name the governing rule, situation code or profile owner for each
   feedback item and return its verdict — `sound`, `misdrawn` or `absent` — with the counterexample any
   `misdrawn` verdict requires. A red or stale authority is reported before it is reasoned from, never after.
3. Reproduce the reported state at its real viewport. Read the complete relevant source/legacy subtree, not only
   the element named in the feedback: header, identity, surface owner, controls, overlays and responsive owner.
4. Run the reasoning ladder and classification for each item, carrying the verdict from step 2. An existing
   answer makes this an application miss only when that answer survived interrogation; an answer that failed is
   a `Law misruling` and the law moves, not the product.
5. Build the **impact cone** before writing: exact authority files, grammar/profile hashes that change, accepted
   design receipts made stale, layout/block heads that require a new immutable revision, source owners and tests.
   Unaffected accepted revisions remain immutable and are never mass-refreshed to make a check green.
6. Present one `### NEED APPROVALS` boundary naming the exact authority, registry and source paths plus the
   recommended correction. `OK` authorizes that boundary once. Take trust-tree and FE baselines after approval
   and before the first write.
7. Write authority before product code:
   - paired `en.md` and `vi.md`, then derived runtime `context.md` and manifest when a module law changes;
   - the complete grammar promotion set when classification is `Grammar gap`;
   - pattern/gate law and its real machine twin together when enforcement is approved and routed.
8. Validate grammar, compile/check runtime contexts and run all three dependency graphs. Add counterexamples that
   distinguish the new situation from its nearest existing rule; wording-only tests are insufficient.
9. Append corrected layout/block revisions. Preserve the full composed page or flow, existing source-bound nodes,
   every evidenced state and overlay. Recompute grammar receipts and principle obligations only for affected
   identities; never edit an accepted bundle in place.
10. Implement the accepted correction in the routed frontend. Reuse semantic owners emitted by grammar and source
   patterns. Do not paste preview CSS or introduce caller styling doors.
11. Run scoped and repository gates, targeted unit/interaction tests and browser proof at every affected viewport
    and state. Compare the new render against both owner feedback and the newly strengthened authority.
12. Commit trust authority, design registry and frontend separately so each history states what changed. Do not
    push unless explicitly requested. Report any unrelated baseline failure without absorbing it.

## Stops

- The feedback has no observable page/state and no recoverable expected outcome.
- Routed source contradicts the claimed product fact and the owner has not supplied a product decision.
- A proposed grammar/principle **addition** is already expressible by current authority. Correcting a rule that
  is present and misdrawn is not an addition and is not stopped here; it stops only when it has no counterexample.
- A `misdrawn` verdict carries no counterexample the current rule decides wrongly, or an item reached
  classification with no verdict recorded at all.
- Authority gates were not run before the first classification, or a gate finding was carried past it unreported.
- A grammar change has no golden case, counterexample, capsule, template, profile owner or impact cone.
- A principle change cannot name the nearest adjacent situation and why it is insufficient.
- An accepted revision would be edited rather than replaced, or unrelated receipts would be rewritten.
- Source would be written before authority and affected design identities are green.
- A gate or external machine repository is outside the approved boundary.

## OUTPUT

Report the feedback classification, strengthened authority identities, superseding design hashes, source commit,
business status, affected paths and executable proof. State explicitly which feedback items were law gaps and
which were failures to apply law that already existed. No internal matrix or generic lessons section.
