# Assessment workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `assessment-workbench` |
| Family | Work |
| Dominant task | Complete a finite assessment attempt while understanding the current question, remaining progress, answer persistence, time constraints and the consequences of final submission. |
| Search aliases | quiz workspace, exam session, test runner, question navigator, assessment attempt, review and submit |
| Authority | Cross-product page topology and responsive behavior. It does not choose product semantics, visual styling or implementation values. |

This archetype is a focused work surface, not merely a page that happens to contain questions. It keeps one current question primary while preserving the session facts needed to make safe progress.

### Invariants

- `question-stage` is the only primary work region.
- Exactly one navigation policy is evidenced before selection: nonlinear (`AR-AW-02`) or linear (`AR-AW-03`).
- `question-navigator` exists only for nonlinear attempts. On a wide left-to-right surface, it is the right supporting rail; a linear attempt must not receive an inert or decorative question-number rail.
- Timer, answer-persistence and submission behavior come from business truth. The archetype preserves them when present and never invents their policy.
- A change in available space may change presentation, but it must not change question access, answer state, time state, submission access or focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-AW-01` | The user is completing one finite assessment attempt with identifiable questions and a terminal completion event. | Required positive signal. |
| `AR-AW-02` | The attempt permits the user to jump among available questions before final submission. | Select the nonlinear variant and include `question-navigator`. |
| `AR-AW-03` | The attempt enforces ordered progression and does not permit arbitrary question access. | Select the linear variant and omit `question-navigator`. |
| `AR-AW-04` | The attempt has a visible time limit or time-dependent transition. | Preserve timer states and expiry behavior at every presentation size. |
| `AR-AW-05` | Answers are persisted during the attempt, automatically or explicitly. | Preserve dirty, saving, saved and failure states without replacing the current question. |
| `AR-AW-06` | Final submission commits the whole attempt or prevents further editing. | Require a review or consequence gate before commitment. |
| `AR-AW-90` | The activity is open-ended practice, a conversation, content reading or an unbounded stream rather than a finite attempt. | Reject this archetype. |
| `AR-AW-91` | The surface authors, configures or grades an assessment instead of taking one. | Reject this archetype; it is an authoring or review workspace. |

### Selection rule

Select `assessment-workbench` only when `AR-AW-01` is evidenced, neither rejection code is present, and exactly one of `AR-AW-02` or `AR-AW-03` is resolved. If navigation policy is unknown or contradictory, return `needs-evidence`; do not infer a question rail from the number of questions.

`AR-AW-04`, `AR-AW-05` and `AR-AW-06` add obligations without changing the archetype. Their absence must be evidenced as an actual product rule, not inferred from a sparse mockup.

## Region graph

```text
assessment-session
├─ session-header
│  ├─ assessment-identity
│  ├─ progress-status
│  ├─ timer-status [AR-AW-04]
│  └─ save-status [AR-AW-05]
└─ assessment-workspace
   ├─ question-stage
   │  ├─ question-context
   │  ├─ prompt-and-stimulus
   │  ├─ answer-region
   │  ├─ validation-or-feedback
   │  └─ question-actions
   ├─ question-navigator [AR-AW-02 only]
   │  ├─ question-index
   │  ├─ question-state-legend
   │  └─ review-entry
   └─ completion-flow
      ├─ attempt-summary
      ├─ consequence-or-warning
      └─ final-submit
```

### Region obligations

| Region | Obligation |
|---|---|
| `session-header` | Establish the attempt, current progress and any time or persistence state without competing with the question. |
| `question-stage` | Own the current prompt, answer interaction, local validation and allowed previous/next action. It remains primary at every size. |
| `question-navigator` | Expose reachable questions and their non-color-only states. It supports the stage and exists only under `AR-AW-02`. |
| `completion-flow` | Summarize unanswered, invalid or flagged questions as policy permits, communicate commitment consequences and own final submission. |

### Variant relationships

For the nonlinear variant, the wide topology is `question-stage` on the left and `question-navigator` as the right supporting rail in left-to-right presentation. The rail may lead into `completion-flow`, but it must not become a second primary workspace. In a right-to-left locale the logical supporting edge may mirror while the semantic relationship remains unchanged.

For the linear variant, `question-stage` is a single work stream. Progress belongs in `session-header`; previous and next actions belong to the stage when policy permits them; `completion-flow` is reached only at an allowed terminal or review step. A disabled grid of question numbers is not a valid substitute for absent nonlinear access.

## Responsive contract

### Wide

- The session header spans the work surface and keeps identity, progress, timer and save status visually subordinate to the question.
- Under `AR-AW-02`, the question stage is the left primary region and the question navigator is the right supporting rail. The stage receives the larger usable measure.
- Under `AR-AW-03`, no supporting rail is reserved. The question stage uses the available primary measure without manufacturing empty symmetry.
- The rail may remain visible while the stage moves only when it does not create a competing scroll trap or obscure focused content.
- `completion-flow` is downstream from answering. It may be entered from the nonlinear navigator or from the permitted terminal step, but final submission is never conflated with ordinary next-question navigation.

### Intermediate

- Transition by content fit, not by a named device or fixed breakpoint.
- Keep the nonlinear supporting rail only while the prompt, answer controls, state labels and navigator labels all remain operable at their required measure.
- When that fit fails, replace the rail with an explicit navigator trigger and an on-demand navigation surface. Do not compress it into an unreadable strip or hide question states.
- The session header may wrap or condense, but current progress, timer state, save failure and the route to submission remain perceivable.
- The linear variant remains one stream; it does not gain a navigator during the transition.

### Compact

- Present one vertical question stage. Supporting navigation is not placed beside the question.
- Under `AR-AW-02`, replace the rail with a clearly named trigger that opens a temporary question-navigation surface. That surface preserves current, unanswered, answered, flagged and invalid states, the legend, review access and the route to submission.
- Under `AR-AW-03`, preserve only the allowed previous/next or continue path. Do not expose inaccessible future questions through a decorative index.
- Condense progress, timer and save status into the session context without reducing them to color or unlabeled icons. A warning, expiry or save failure remains available in text.
- Keep local question actions with the question. Final submit remains inside `completion-flow`, with its consequence and attempt summary, rather than becoming an ambiguous persistent next button.
- Opening the temporary navigator moves focus into its named context; closing it returns focus to its trigger. Selecting a question closes the temporary surface and places focus at the new question context. Validation and submission failures place focus at the relevant error summary or first invalid target.

### Reflow

- The reading order is `session-header`, `question-stage`, nonlinear supporting navigation when invoked, then `completion-flow`; visual rearrangement must preserve this meaning.
- Prompt text, answer labels, status text and translated copy wrap without page-level horizontal scrolling or loss of action.
- An intrinsically two-dimensional stimulus may own bounded two-dimensional navigation only when its meaning requires it; the rest of the assessment still reflows independently and an accessible equivalent remains a product obligation.
- Enlarged text, long localized labels, browser zoom, software keyboard and reduced viewport height must not cover the current answer, timer warning, save failure, focused control or submit consequence.
- The page owns the primary scroll. A temporary navigator may own its scroll while open, with focus contained and restored; the question stage and wide rail must not become simultaneous ambiguous scroll owners.
- Sticky presentation is not an invariant. If the wide navigator or compact session status is kept visible, it must not obscure content or keyboard focus, and it must yield when available height is insufficient.

### Interaction parity

- Every size preserves the same allowed question access policy, answer editing, flag or review action, persistence retry, timer warning and expiry behavior, attempt review and final submission.
- Changing presentation must not reset an answer, clear a flag, restart a timer, duplicate a submission or silently discard an unsaved change.
- Question states use text, shape or another programmatically determinable cue in addition to color.
- Save progress and timer warnings are announced without stealing focus. A user-triggered question change may move focus to the new question context; automatic saving may not.
- Keyboard, pointer and assistive-technology users receive equivalent access to the navigator, state legend, question actions and completion flow.

## State obligations

| State family | Required states and behavior |
|---|---|
| Session | `initializing`, `ready`, `access-blocked`, `reconnecting`, `expired`, `completed`. A blocking transition explains what remains possible and does not erase entered answers. |
| Question | `current`, `unvisited`, `visited-unanswered`, `answered`, `flagged`, `invalid`; `locked` only when business truth permits it. Combinations remain distinguishable without color alone. |
| Persistence | Under `AR-AW-05`: `dirty`, `saving`, `saved`, `save-failed`, and `offline-pending` when offline continuation exists. Failure retains the local answer and offers a clear retry or recovery path. |
| Time | Under `AR-AW-04`: `running`, `warning`, `paused` only if policy permits, and `expired`. Warnings do not steal focus; expiry produces one deterministic, announced transition. |
| Navigation | Current question, reachable question, unavailable question and return-from-navigator states. Moving between questions preserves committed and locally pending answers according to policy. |
| Validation | Resting, validating, invalid and accepted. Errors identify the affected answer in text and remain connected to the question context. |
| Submission | `not-ready`, `ready`, `confirming`, `submitting`, `submitted`, `submit-failed`. The commit cannot be triggered twice; failure preserves the attempt and a safe recovery route. |
| Feedback | `not-evaluated`, `correct`, `incorrect`, `partially-correct` and explanatory feedback only when assessment policy allows disclosure at that point. |
| Focus | Entry focus, question-change focus, temporary-navigator entry and return, validation-error focus, expiry focus and submission-result focus each have an explicit destination. Status updates alone do not move focus. |
| Data failure | Initial load failure, question load failure, navigator-state failure and stale session. Partial failure identifies its scope and does not turn the whole attempt into an unexplained blank state. |

## Boundaries

### Accept

- A quiz, test, exam or certification attempt with a finite question set and one current answer task.
- A long assessment split into sections when it still preserves a finite attempt, one primary question stage and an evidenced linear or nonlinear policy.
- Timed, untimed, autosaved or explicitly saved variants when their exact rules are supplied by business authority.

### Reject

- A single independent question or tiny one-step transaction with no attempt-level navigation or completion commitment.
- Flashcards, drills or adaptive practice with no evidenced finite terminal set.
- A learning reader whose dominant task is consuming content rather than answering an assessment.
- A conversational interview, live proctoring room or collaborative session whose dominant task is real-time exchange.
- Assessment creation, configuration, grading or analytics.
- A generic survey or long application whose dominant structure is data collection and section progression rather than an assessment attempt.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` when `AR-AW-90` or `AR-AW-91` is evidenced or another archetype clearly owns the dominant task. Return `needs-evidence` when finiteness, navigation policy, time policy, persistence policy or submission consequence would materially change the topology or state contract.

## Handoff

1. Business truth provides attempt boundaries, question reachability, timing, persistence, validation, feedback and submission consequences.
2. This archetype resolves the macro regions, linear or nonlinear topology, responsive replacement and state obligations.
3. Grammar maps each region and state to product-family semantic owners and may narrow behavior only with routed authority; it may not add a nonlinear navigator to a linear attempt.
4. Principles resolve exact geometry, spacing, sizing, visual priority, motion and content-fit transitions after this topology is accepted.
5. Direction expresses character inside the accepted regions without changing their ownership or interaction parity.

The archetype output names no product component, source path, class, token or fixed breakpoint.

## Non-binding research evidence

These sources are advisory evidence only. They help test the archetype but do not override routed business truth, grammar or principles.

- [Material Design 3 canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview) distinguishes a primary area from a supporting pane and adapts canonical layouts across available space; this supports, but does not mandate, the nonlinear wide topology.
- [MoodleDocs: Using Quiz](https://docs.moodle.org/405/en/Using_Quiz) demonstrates question jumping, flagged and unanswered states, autosave failure messaging, review and final submission in a mature nonlinear assessment flow.
- [GOV.UK Design System: Question pages](https://design-system.service.gov.uk/patterns/question-pages/) supports keeping the current question focused, preserving a back path and using a simple progress indicator only when it helps.
- [Ofqual guidance on accessible assessments](https://www.gov.uk/government/consultations/consultation-on-designing-and-developing-accessible-assessments/guidance-on-designing-and-developing-accessible-assessments) emphasizes clear instructions, readable question structure and ready access to information needed for a task.
- [W3C Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) and [Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) support reflow without lost functionality and a focus sequence that preserves meaning when regions move.
- [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) supports announcing save, time and submission status without unnecessary focus movement.

## Output

Return exactly these top-level fields. `responsive` contains exactly the listed nested fields.

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `assessment-workbench`. |
| `situationCodes` | Matched codes from this record; include exactly one of `AR-AW-02` or `AR-AW-03` for an accepted result. |
| `searchAliases` | Relevant discovery aliases used to find this archetype. |
| `dominantTask` | One sentence describing the finite assessment attempt in the routed product context. |
| `regions` | Ordered canonical region IDs that apply; omit conditional regions that do not apply. |
| `regionRelationships` | Explicit primary, supporting, conditional and downstream relationships, including the selected navigation variant. |
| `responsive` | Object containing `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner` and `interactionParity`. |
| `stateObligations` | Applicable state families and the states that implementation must prove. |
| `boundaryVerdict` | `accept`, `reject` or `needs-evidence`, with a short reason. |
| `grammarHandoff` | Product-semantic decisions the routed grammar must resolve without changing topology. |
| `principlesHandoff` | Geometry, hierarchy and adaptive details left for principles. |
| `confidence` | `high`, `medium` or `low`, based on the completeness and consistency of evidence. |
| `evidence` | Exact routed observations that caused the match; external research is labeled advisory and cannot establish product facts. |

```json
{
  "archetypeId": "assessment-workbench",
  "situationCodes": [],
  "searchAliases": [],
  "dominantTask": "",
  "regions": [],
  "regionRelationships": [],
  "responsive": {
    "wide": "",
    "intermediate": "",
    "compact": "",
    "reflow": "",
    "readingOrder": "",
    "navigationReplacement": "",
    "stickyBehavior": "",
    "overflowOwner": "",
    "interactionParity": ""
  },
  "stateObligations": [],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [],
  "principlesHandoff": [],
  "confidence": "low",
  "evidence": []
}
```
