# Execute `fe.direction.decide`

## Single job

Turn the validated input and its exact context into one typed frontend direction receipt. This is one
linear operator invocation. It does not call another operator, route a workflow, pause internally, or
perform implementation.

## Sequence

| # | Step | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- |
| 1 | Validate input and resume | input, `@dynamic/fe-direction-decision.json`, `@workspaces/fe` (the frozen head binding) | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind authority | input (request, project, target, change level, owner ceiling), `@dynamic/business-promise-authority.json`, `@dynamic/backend-implementation.json`, `@dynamic/architecture-decision.json`, `@grammar/core` | — | `ROUTE_UNVERIFIED`, `SCOPE_UNFROZEN`, `CHANGE_LEVEL_AMBIGUOUS`, `OWNER_CEILING_INVALID`, `BUSINESS_REQUIRED`, `BACKEND_REQUIRED`, `ARCHITECTURE_REQUIRED` |
| 3 | Observe existing context | `@workspaces/fe` (direct artifacts of the target, or the authorized host and product-family context), ``, `@worktrees/uat/<flow>/<case>` | — | `EVIDENCE_MISSING` |
| 4 | Compile one UI contract | `@knowledge/ui/composition`, `@dynamic/business-promise-authority.json`, `@workspaces/fe` (the observed context) | — | — |
| 5 | Resolve reference needs | input (the exact external references), `@knowledge/ui/composition` (the gap they must close) | — | `REFERENCE_EVIDENCE_EXHAUSTED` |
| 6 | Form candidates | `@knowledge/ui/composition` (the compiled UI contract), input (change level, comparison authorization) | — | `NO_VIABLE_DIRECTION` |
| 7 | Apply the Grammar filter | `@grammar/core` (what a component owns and which props exist), `@knowledge/grammars/starci` (family realization rules), input (owner ceiling) | — | `GRAMMAR_REQUIRED` |
| 8 | Render decision evidence | `@grammar/core`, `@knowledge/ui/composition` (the UI contract the surviving candidates answer) | `@dynamic/<candidateId>.html` | — |
| 9 | Falsify | `@dynamic/<candidateId>.html`, `@dynamic/business-promise-authority.json`, `@dynamic/backend-implementation.json` | — | — |
| 10 | Decide or block | `@dynamic/<candidateId>.html`, input (the running mode) | — | `DIRECTION_CHOICE_REQUIRED` |
| 11 | Emit and stop | everything above | `@dynamic/fe-direction-decision.json` | — |

Validation rejects stale authority, source drift, owner overlap, invalid change-level combinations,
an unapproved comparison, and unchanged progress. Evidence may contradict authority but never
replaces it. Observation takes the direct artifacts without the producer's rationale: an existing
target yields its current regions, actions, states, responsive behavior, and owner boundaries, and a
new target is verified absent before only the authorized host and product-family context is observed.

The UI contract freezes purpose, actor tasks, representative content, region responsibilities,
information and action order, the closed state matrix, exits, responsive rules, accessibility
obligations, Grammar bindings, preserved decisions, changed decisions, and non-goals. Bounded external
research records useful relationships and their limitations and never copies a page, brand, palette,
or component anatomy; when evidence cannot close a business or interaction decision the invocation
stops with the owning gap.

`refine` preserves the approved structure and an exact approved-direction reuse preserves the supplied
direction triple; otherwise the step forms one dominant reversible candidate, or exactly three or four
materially different candidates in an authorized compare mode. The Grammar filter rejects every
candidate that invents a missing shared interface, bypasses the owner ceiling, imitates unpublished
Grammar locally, or contradicts a published composition.

A generated `new` or `reconstruct` candidate is rendered as a realistic page or substantial surface
with representative content, wide and constrained compositions, and at least one consequential
pending, failure, recovery, or boundary state; compare mode renders every alternative in one
inspectable artifact and visibly exposes the material differences. Falsification attacks business and
backend conformance, hierarchy, content density, action feedback, recovery, responsive reflow, content
stress, keyboard and focus behavior, accessibility, family coherence, reversibility, and owner
leakage, and records add, change, and remove dispositions with their contradictions. The decision
selects the valid materially dominant candidate in dominant mode; in compare mode, or when several
valid candidates remain with no dominant answer, it returns exactly three or four alternatives rather
than choosing by taste. Emission binds all source, authority, context, scope, artifact, input, and
progress fingerprints, mutates no source, and claims no downstream proof.

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

