# Centered single task

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `centered-single-task` |
| Family | Task |
| Dominant task | Complete or acknowledge one bounded task with minimal surrounding context, one clear primary outcome and an explicit recovery or exit path when needed. |
| Search aliases | focused task, centered card, single task, sign in, verification, reset, invite code, confirmation, completion status |
| Authority | Cross-product page topology and responsive behavior. It does not choose product semantics, visual styling or implementation values. |

This archetype is defined by task boundedness, not by visual centering alone. A centered card is a valid wide expression, but the semantic unit is `bounded-task-region`; its decorative boundary may disappear when space is constrained.

### Invariants

- The page has exactly one dominant task and one primary outcome at a time.
- `bounded-task-region` is one ordered semantic unit. Identity, context, task body, status, primary action and recovery do not become independent dashboard regions.
- Supporting copy is concise and directly helps completion, trust, consequence or recovery.
- The viewport may center the task when room exists, but centering must yield before content is clipped, focus is obscured or a second scroll owner appears.
- Compact presentation may release the decorative card boundary without changing task order, task measure, state behavior or interaction access.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-CS-01` | The surface has one dominant task and one primary outcome; all supporting content serves that task. | Required positive signal. |
| `AR-CS-02` | The entry state is a bounded input, authentication, verification, recovery or short confirmation action. | Select the interactive variant. |
| `AR-CS-03` | The entry state is a bounded terminal status or acknowledgement with one clear next step. | Select the status variant. |
| `AR-CS-04` | Failure, cancellation or inability to continue requires an explicit recovery or exit path. | Include `recovery-or-exit` and prove it in every presentation. |
| `AR-CS-90` | The task is long, sectioned, resumable as a substantial draft or requires multi-step progress navigation. | Reject this archetype; use a form or guided-flow archetype. |
| `AR-CS-91` | Completion requires persistent reference content, comparison, history or another work region at the same time. | Reject this archetype; use a detail, split or workbench archetype. |
| `AR-CS-92` | Several peer tasks, outcomes or calls to action compete for priority. | Reject this archetype; the surface is not single-task. |

### Selection rule

Select `centered-single-task` only when `AR-CS-01` and exactly one entry mode, `AR-CS-02` or `AR-CS-03`, are evidenced and no rejection code is present. An interactive task may later reach a terminal success state without also matching the status entry mode.

If content length, number of decisions or external reference needs make the boundary uncertain, return `needs-evidence`. Do not select this archetype merely because a mockup places a card in the middle of the screen.

## Region graph

```text
focused-viewport
└─ bounded-task-region
   ├─ task-identity
   ├─ concise-context
   ├─ task-body
   ├─ task-status
   ├─ task-actions
   │  ├─ primary-outcome
   │  └─ secondary-safe-action [when required]
   └─ recovery-or-exit [AR-CS-04 or evidenced need]
```

### Region obligations

| Region | Obligation |
|---|---|
| `focused-viewport` | Provide calm surrounding space and one page-level scroll owner; it must not become an empty visual requirement on constrained surfaces. |
| `bounded-task-region` | Hold the complete task as one semantic sequence and maintain a readable, operable measure. A visual card boundary is optional. |
| `task-identity` | Name the exact task or result so users can confirm where they are. |
| `concise-context` | Explain only the information necessary to act, trust the request or understand the consequence. |
| `task-body` | Own the bounded inputs, verification content, acknowledgement or result content. |
| `task-status` | Own validation, pending, success, failure and blocked messages without displacing unrelated regions. |
| `task-actions` | Make one primary outcome unambiguous and keep any secondary action visibly subordinate. |
| `recovery-or-exit` | Offer the safe way to retry, recover, change route or leave when the user cannot complete the primary path. |

### Region relationships

The semantic order is fixed: identity, concise context, task body, status relevant to that body, actions, then recovery or exit. Inline field errors may appear beside their targets while still belonging to `task-status`.

There is no supporting rail, peer card grid, persistent detail pane or independent navigation region. Global product shell may surround the archetype only when it does not compete with the single task; shell ownership remains outside this record.

For a terminal status entry, `task-body` contains the result or acknowledgement rather than empty form structure. For an interactive entry, success may replace or resolve the task body inside the same bounded sequence, while preserving the next safe action.

## Responsive contract

### Wide

- Center `bounded-task-region` horizontally within the available task viewport and give it a bounded reading measure.
- Vertical centering is allowed only while the entire meaningful task, errors, recovery and focused control remain comfortably reachable. When content grows, align toward the start and let the page scroll.
- A card-like visual boundary may group the task, but it must not create nested decorative containers or imply additional regions.
- Keep the primary action with the task body. Recovery or exit remains close enough to be found but subordinate to the primary outcome.
- Surrounding space may carry product identity or reassurance only when it does not introduce a competing task.

### Intermediate

- Preserve the bounded task measure while reducing surrounding space. Relax vertical centering before reducing usable content width or hiding recovery.
- Let long labels, validation text and localized copy increase the region's height; do not compress the task into an internal scrolling card.
- Keep the same semantic sequence and primary-action priority. Do not create a side column merely because some horizontal space remains.
- If the software keyboard, zoom or reduced height makes centering unstable, switch to start-aligned page flow without waiting for a named breakpoint.

### Compact

- Use one vertical page stream and the available safe width. The decorative card boundary, elevation or contrasting outer field may be released so the task is not a cramped card inside a narrow viewport.
- Releasing the boundary must not remove the `bounded-task-region` semantics, readable measure, internal order or separation from global navigation.
- Preserve task identity, required context, all inputs or result content, validation, primary action and recovery. Nothing moves into an undiscoverable hover-only or overflow-only location.
- Keep the primary action in normal task flow. A fixed action is not part of this archetype and may be introduced only by a later authority that proves it does not obscure content or focus.
- When the software keyboard opens, the active input, its label, error and next required action remain reachable through the page's single scroll.

### Reflow

- The reading and focus order remains `task-identity`, `concise-context`, `task-body`, relevant `task-status`, `task-actions`, `recovery-or-exit`.
- Text, labels, codes, error messages and translated strings wrap without page-level horizontal scrolling, clipping or overlap.
- The page owns overflow. `bounded-task-region` must not become an independently scrolling panel; if the task needs a large internal document or dataset, the boundary verdict must be reconsidered.
- Content growth shifts the region toward the block start rather than preserving mathematical centering at the cost of inaccessible content.
- Sticky behavior is none by default. Global browser or product chrome remains outside this contract; any later sticky addition must preserve focus visibility and the complete task sequence.

### Interaction parity

- Every presentation preserves entry, validation, submission, success, recoverable failure, blocked state, retry and exit behavior that applies to the task.
- Presentation changes do not clear entered values, restart a verification process, duplicate an operation or hide a recovery route.
- Validation errors identify the affected input in text and focus moves to a useful error destination only after a user-triggered validation or submission event.
- Pending and success status can be announced without stealing focus; a terminal transition has an explicit focus destination and a clear next action.
- Keyboard, pointer and assistive-technology users receive the same task, status, primary outcome and recovery access.

## State obligations

| State family | Required states and behavior |
|---|---|
| Entry | `resting`, `prefilled` when routed data exists, and `unavailable` when the task cannot start. Prefill never hides what will be submitted. |
| Input | `untouched`, `dirty`, `validating`, `valid`, `invalid`. Errors are textual, connected to their target and retain the user's value unless safety requires otherwise. |
| Operation | `ready`, `submitting`, `succeeded`, `submit-failed`. The primary operation cannot be triggered twice while pending. |
| Verification | When applicable: `code-requested`, `code-ready`, `checking`, `incorrect`, `expired`, `resend-available`, `resending`, `resend-failed`. Time-dependent changes remain announced and recoverable. |
| Recovery | `recovery-available`, `recovering`, `recovery-sent`, `recovery-failed`, plus a safe exit when recovery is impossible. |
| Terminal status | `success`, `recoverable-error`, `blocked`, `cancelled`. Each state explains what happened, whether prior work was kept and the one safest next step. |
| Focus | Initial task focus, first-invalid focus, pending-status announcement, terminal-result focus and return-from-recovery focus each have an explicit destination. A status update alone does not unpredictably change context. |
| Data failure | Initial load failure, stale or invalid invitation, unavailable dependency and network failure. The failure stays within the bounded task and exposes retry or exit rather than rendering a blank viewport. |

## Boundaries

### Accept

- Sign-in, short verification, password recovery, invitation code, compact consent or one bounded confirmation action.
- A success, failure or completion acknowledgement with one clear next action.
- A very small form only when all fields serve one outcome, need no section navigation and can be understood without simultaneous reference content.

### Reject

- A long or sectioned form, onboarding journey, application or checkout that needs steps, draft resumption or a progress model.
- A detail page whose user must read substantial evidence before deciding.
- A task that needs a side-by-side preview, history, policy document, comparison or live reference data.
- A dashboard, catalogue, settings collection or page with several peer actions.
- A modal interaction embedded in another page; a modal is a container behavior, not this page archetype.
- Any surface selected only because its current visual design has a centered card.

### Boundary verdict

Return `accept` only when the selection rule passes and the entire task can remain one bounded semantic sequence. Return `reject` when `AR-CS-90`, `AR-CS-91` or `AR-CS-92` is evidenced or another archetype owns the dominant task. Return `needs-evidence` when task length, outcome priority, recovery, external reference or continuation behavior is unresolved.

## Handoff

1. Business truth provides the exact outcome, required inputs, security constraints, validation, consequence, recovery and next destination.
2. This archetype resolves one bounded region, its order, responsive boundary release, page-level overflow and state obligations.
3. Grammar maps the regions and states to product-family semantic owners and vocabulary; it may not turn supporting context into a competing task.
4. Principles resolve exact measure, spacing, alignment, visual boundary, hierarchy, motion and content-fit transition after this topology is accepted.
5. Direction expresses product character inside the bounded sequence without adding a rail, peer card or second primary action.

The archetype output names no product component, source path, class, token or fixed breakpoint.

## Non-binding research evidence

These sources are advisory evidence only. They help test the archetype but do not override routed business truth, grammar or principles.

- [PatternFly Bullseye layout](https://www.patternfly.org/layouts/bullseye/html) describes centering a single child in its parent, supporting the wide spatial expression without making centering the semantic identity.
- [USWDS authentication pages](https://designsystem.digital.gov/templates/authentication-pages/) recommends explaining necessary context and removing unnecessary distractions; its [sign-in guidance](https://designsystem.digital.gov/templates/authentication-pages/sign-in/) also emphasizes a clear, uncluttered, mobile-friendly task with recovery and safe error feedback.
- [GOV.UK Design System question pages](https://design-system.service.gov.uk/patterns/question-pages/) supports beginning with one focused question per page and a clear way back or forward.
- [Material Design 3 canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview) notes that layering can create a focused task-oriented experience, while its adaptive examples reinforce that presentation changes with available space.
- [W3C Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow), [Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) and [Understanding Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification) support a single reflowing sequence, meaningful focus and textual, target-specific errors.

## Output

Return exactly these top-level fields. `responsive` contains exactly the listed nested fields.

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `centered-single-task`. |
| `situationCodes` | Matched codes from this record; an accepted result includes `AR-CS-01`, exactly one entry mode and no rejection code. |
| `searchAliases` | Relevant discovery aliases used to find this archetype. |
| `dominantTask` | One sentence naming the single bounded outcome in the routed product context. |
| `regions` | Ordered canonical region IDs that apply; omit optional regions without evidence. |
| `regionRelationships` | The fixed semantic sequence, primary/subordinate actions and any conditional recovery relationship. |
| `responsive` | Object containing `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner` and `interactionParity`. |
| `stateObligations` | Applicable state families and the states that implementation must prove. |
| `boundaryVerdict` | `accept`, `reject` or `needs-evidence`, with a short reason. |
| `grammarHandoff` | Product-semantic decisions the routed grammar must resolve without adding another dominant task. |
| `principlesHandoff` | Measure, alignment, visual boundary and adaptive details left for principles. |
| `confidence` | `high`, `medium` or `low`, based on the completeness and consistency of evidence. |
| `evidence` | Exact routed observations that caused the match; external research is labeled advisory and cannot establish product facts. |

```json
{
  "archetypeId": "centered-single-task",
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
