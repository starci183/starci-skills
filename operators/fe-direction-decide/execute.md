# Execute `fe.direction.decide`

## Single job

Turn the validated input and its exact context into one typed frontend direction receipt. This is one
linear operator invocation. It does not call another operator, route a workflow, pause internally, or
perform implementation.

## Execution sequence

1. **Validate input and resume.** Apply `input.schema.json` and semantic validation. Reject stale
   authority, source drift, owner overlap, invalid change-level combinations, unapproved comparison,
   and unchanged progress.
2. **Bind authority.** Bind the request, business receipt, optional backend/architecture receipts,
   published Grammar, project, target, change level, and owner ceiling. Evidence may contradict but
   cannot replace authority.
3. **Observe existing context.** Inspect direct artifacts without producer rationale. For existing
   targets, record current regions, actions, states, responsive behavior, and owner boundaries. For new
   targets, verify absence and observe only the authorized host and product-family context.
4. **Compile one UI contract.** Freeze purpose, actor tasks, representative content, region
   responsibilities, information/action order, closed state matrix, exits, responsive rules,
   accessibility obligations, Grammar bindings, preserved decisions, changed decisions, and non-goals.
5. **Resolve reference needs.** If the domain or interaction model is unfamiliar, perform bounded
   external research from exact references. Record useful relationships and limitations; never copy a
   page, brand, palette, or component anatomy. Stop with the owning gap when evidence cannot close a
   business or interaction decision.
6. **Form candidates.** `refine` preserves the approved structure. Exact approved-direction reuse
   preserves the supplied direction triple. Otherwise form one dominant reversible candidate, or
   exactly three/four materially different candidates in authorized compare mode.
7. **Apply the Grammar filter.** Reject every candidate that invents a missing shared interface,
   bypasses the owner ceiling, imitates unpublished Grammar locally, or contradicts a published
   composition. `GRAMMAR_REQUIRED` ends this invocation.
8. **Render decision evidence.** A generated `new` or `reconstruct` candidate is a realistic page or
   substantial surface with representative content, wide and constrained compositions, and at least
   one consequential pending, failure, recovery, or boundary state. Compare mode renders every
   alternative in one inspectable artifact and visibly exposes the material differences.
9. **Falsify.** Attack business/backend conformance, hierarchy, content density, action feedback,
   recovery, responsive reflow, content stress, keyboard/focus behavior, accessibility, family
   coherence, reversibility, and owner leakage. Record add/change/remove dispositions and
   contradictions.
10. **Decide or block.** In dominant mode, select the valid materially dominant candidate. In compare
    mode, or when several valid candidates remain without a dominant answer, emit
    `DIRECTION_CHOICE_REQUIRED` with exactly three/four alternatives. Do not choose by taste.
11. **Emit and stop.** Emit one output conforming to `output.schema.json`, bound to all source,
    authority, context, scope, artifact, input, and progress fingerprints. Do not mutate source or
    claim downstream proof.

## Resume execution

A resume begins again at validation, reuses only unchanged fingerprinted observations/artifacts, and
then consumes the exact delta. An alternative selection must name a candidate in the blocked receipt
and carry exact product authority. The operator does not ideate again before producing the selected
decision. A stale or unchanged resume returns `NO_PROGRESS` or the applicable stale-binding failure.

## Mandatory attacks

The operator cannot decide while any applicable item remains unresolved:

- a business state or recovery path has no UI representation;
- an action lacks pending, success/failure feedback, or recovery;
- the proposal changes an API, auth, persistence, or data assumption;
- a mutable region belongs to an excluded owner;
- a reusable pattern is missing from published Grammar;
- the wide/constrained transformation is absent or contradictory;
- keyboard, focus, labeling, contrast intent, or reading order is unresolved;
- representative content, multi-item behavior, long content, empty/error state, or boundary behavior
  breaks the direction;
- a materially stronger reversible candidate exists but was not evaluated.

