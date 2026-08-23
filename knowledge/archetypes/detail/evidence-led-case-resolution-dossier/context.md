# Evidence-led case resolution dossier

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | evidence-led-case-resolution-dossier |
| Family | detail |
| Dominant task | Resolve one bounded case by testing explicit criteria against evidence, contradictions, and gaps before recording rationale. |
| Search aliases | evidence-led-case-resolution-dossier; evidence-led case resolution dossier |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Resolve one bounded case by testing explicit criteria against evidence, contradictions, and gaps before recording rationale.
- Each region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-ECD-01 | Resolve one bounded case by testing explicit criteria against evidence, contradictions, and gaps before recording rationale. | required positive evidence |
| AR-ECD-02 | Every required region and critical relationship has an independent owner. | required positive evidence |
| AR-ECD-03 | The wide relationship stops working, but compact must preserve task, state, and recovery. | transformation trigger |
| AR-ECD-90 | the page is a generic record, support conversation, approval composer, audit event, or simple list-detail view. | reject |
| AR-ECD-91 | The difference is only a product noun, density, color, component, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-ECD-01 and AR-ECD-02 are evidenced, neither AR-ECD-90 nor AR-ECD-91 is present, and the region graph remains necessary across all three topologies. Return needs-evidence when an owner or transformation is unresolved.

## Region graph

~~~text
case-dossier
├─ case-question-and-criteria
├─ criteria-status-index
├─ evidence-register
├─ contradiction-and-gap-summary
├─ selected-evidence-detail
├─ resolution-rationale
└─ decision-record
~~~

Critical relationship: Criteria and evidence are independent many-to-many owners; rationale cannot outrun unresolved required evidence.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| case-dossier | Owns the bounded page task and contains every required region; it does not invent product semantics. | Contains case-question-and-criteria, criteria-status-index, evidence-register, contradiction-and-gap-summary, selected-evidence-detail, resolution-rationale, decision-record while preserving their independent owners. |
| case-question-and-criteria | Owns this named task fact or stage and no neighboring region's decision authority. | Orients criteria-status-index without replacing its owner. |
| criteria-status-index | Owns this named task fact or stage and no neighboring region's decision authority. | Receives context from case-question-and-criteria and constrains evidence-register without merging their authorities. |
| evidence-register | Owns membership, item identity, status, and the current selection for this bounded collection. | Receives context from criteria-status-index and constrains contradiction-and-gap-summary without merging their authorities. |
| contradiction-and-gap-summary | Owns the derived interpretation or consequence preview; it never becomes a second input source. | Receives context from evidence-register and constrains selected-evidence-detail without merging their authorities. |
| selected-evidence-detail | Owns traceable supporting evidence and its freshness, availability, and permission state. | Receives context from contradiction-and-gap-summary and constrains resolution-rationale without merging their authorities. |
| resolution-rationale | Owns the derived interpretation or consequence preview; it never becomes a second input source. | Receives context from selected-evidence-detail and constrains decision-record without merging their authorities. |
| decision-record | Owns this named task fact or stage and no neighboring region's decision authority. | Consumes verified state from resolution-rationale and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Keep criteria, evidence, selected detail, and rationale inspectable together.
- Failure trigger: simultaneous regions narrow content, obscure state, or break owner relationships.
- Navigation replacement is unnecessary while regions remain simultaneous; sticky is allowed only for context that fits.
- The page owns vertical overflow; only an intrinsically two-dimensional region may own bounded overflow.

### Intermediate

- Keep criteria visible and move selected evidence detail into the temporary supporting pane; gaps remain before rationale.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- A named trigger opens the temporary pane; Escape closes it and focus returns to the trigger.
- Sticky behavior yields at short height; the page remains the overflow owner.

### Compact

- Stage criterion, linked evidence, gaps, rationale, then decision; Back preserves both selections and the draft.
- Failure trigger: multiple panes are no longer simultaneously operable with 16px text and 44px targets.
- Previous, Next, and a stage selector replace pane adjacency; Back preserves selection and draft.
- No page-level horizontal scrolling is allowed; sticky or fixed surfaces never obscure content or focus.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder it. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. Region state survives movement into and out of the temporary pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale/conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A dialog contains focus, supports Escape or cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: evidence loading/missing/stale/redacted; criterion met/not-met/uncertain; contradiction open/resolved; gap owner; rationale draft/conflict; decision pending/recorded/reopened; criterion↔evidence focus.

| State family | Obligation | Focus transition | Responsive presentation |
|---|---|---|---|
| initial/loading | Preserve known anatomy and name the waiting region. | Do not move focus automatically. | Keep the same stage identity. |
| ready | Show internally consistent, product-neutral demo data. | Focus remains at the activating control. | Preserve selection. |
| empty/not-applicable | Explain why content is empty and any valid next step. | Move to recovery only when continuation needs it. | Do not erase other required regions. |
| error/retry | Associate the error with its owner and provide bounded retry. | Multi-error moves to the summary; retry returns to the owner. | Error is not color-only. |
| permission/unavailable | Preserve orientation and explain the limitation. | Do not focus a locked control. | Use the same reason in every topology. |
| pending | Prevent duplicates and preserve the action meaning. | Do not steal focus for progress. | State stays with its action owner. |
| success | Confirm the outcome and a valid continuation. | Move focus only when it helps continuation. | Do not create a second source of truth. |
| stale/conflict | Name the changed version and preserve safe input. | Focus a contextual recovery choice. | Selection survives transformation. |
| domain states | Evidence E-14 now supports criterion C-2 without hiding its limits. Contradictory evidence remains open and blocks a final decision. The required gap has an owner and a verified artifact. Rationale recorded with supporting and contradicting evidence links. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, its critical relationship creates a distinct topology, and all responsive states preserve task and recovery parity.

### Reject

Reject when the page is a generic record, support conversation, approval composer, audit event, or simple list-detail view, or when the candidate only changes nouns, cards, or density from another archetype.

### Boundary verdict

The valid result is accept, reject, duplicate-or-variation, or needs-evidence under the Situation-code rule; visual preference is not evidence.

## Handoff

- Grammar receives real facts, semantic owners, permissions, states, and action consequences.
- Principles receives exact grid, measure, gaps, sizing, alignment, overflow, thresholds, sticky offsets, and focus accommodation.
- Direction receives visual character; the template is only one conforming realization.

## Non-binding research evidence

### Evidence boundary

The official sources below are advisory evidence. They are not product truth, do not imply that a source organization names this synthesized archetype, and do not authorize copying geometry, component trees, nouns, or breakpoints.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [GOV.UK — Check answers](https://design-system.service.gov.uk/patterns/check-answers/) | Supports review before consequential submission. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [USWDS — Patterns](https://designsystem.digital.gov/patterns/) | Supports task-oriented public-service flows. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports logical keyboard order and deterministic focus return. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "evidence-led-case-resolution-dossier",
  "matchedSituationCodes": [
    "AR-ECD-01",
    "AR-ECD-02"
  ],
  "aliases": [
    "evidence-led-case-resolution-dossier",
    "evidence-led case resolution dossier"
  ],
  "dominantTask": "Resolve one bounded case by testing explicit criteria against evidence, contradictions, and gaps before recording rationale.",
  "regions": [
    "case-dossier",
    "case-question-and-criteria",
    "criteria-status-index",
    "evidence-register",
    "contradiction-and-gap-summary",
    "selected-evidence-detail",
    "resolution-rationale",
    "decision-record"
  ],
  "relationships": [
    "Criteria and evidence are independent many-to-many owners; rationale cannot outrun unresolved required evidence."
  ],
  "responsive": {
    "wide": "Keep criteria, evidence, selected detail, and rationale inspectable together.",
    "intermediate": "Keep criteria visible and move selected evidence detail into the temporary supporting pane; gaps remain before rationale.",
    "compact": "Stage criterion, linked evidence, gaps, rationale, then decision; Back preserves both selections and the draft.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "interactionParity": "Every action, state, recovery path, and focus return remains available across bands."
  },
  "stateObligations": [
    "initial/loading",
    "ready",
    "empty/not-applicable",
    "error/retry",
    "permission/unavailable",
    "pending",
    "success",
    "stale/conflict",
    "focus transition"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product facts",
    "semantic owners",
    "real state transitions"
  ],
  "principlesHandoff": [
    "exact geometry",
    "measure and overflow",
    "content-driven thresholds",
    "focus accommodation"
  ],
  "confidence": "low",
  "evidenceClasses": [
    "official task-domain guidance",
    "official design-system guidance",
    "accessibility guidance"
  ]
}
~~~

Return no class, token, component, source path, fixed breakpoint, or invented product fact.
