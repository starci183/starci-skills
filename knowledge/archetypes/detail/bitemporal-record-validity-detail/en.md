# Bitemporal record validity detail

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | bitemporal-record-validity-detail |
| Family | detail |
| Dominant task | Determine what a record was valid for in the real world versus when the system knew or corrected that state. |
| Search aliases | bitemporal-record-validity-detail; bitemporal record validity detail |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Determine what a record was valid for in the real world versus when the system knew or corrected that state.
- Each region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-BTV-01 | Determine what a record was valid for in the real world versus when the system knew or corrected that state. | required positive evidence |
| AR-BTV-02 | Every required region and critical relationship has an independent owner. | required positive evidence |
| AR-BTV-03 | The wide relationship stops working, but compact must preserve task, state, and recovery. | transformation trigger |
| AR-BTV-90 | the need is ordinary version history, an audit timeline, a job progression, or a spreadsheet grid. | reject |
| AR-BTV-91 | The difference is only a product noun, density, color, component, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-BTV-01 and AR-BTV-02 are evidenced, neither AR-BTV-90 nor AR-BTV-91 is present, and the region graph remains necessary across all three topologies. Return needs-evidence when an owner or transformation is unresolved.

## Region graph

~~~text
bitemporal-detail
├─ record-identity
├─ valid-time-axis
├─ transaction-time-axis
├─ interval-state-grid
├─ selected-state-facts
├─ correction-provenance
└─ compare-at-two-times
~~~

Critical relationship: Valid time and transaction time remain independent semantic axes; selected facts and correction provenance bind both coordinates.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| bitemporal-detail | Owns the bounded page task and contains every required region; it does not invent product semantics. | Contains record-identity, valid-time-axis, transaction-time-axis, interval-state-grid, selected-state-facts, correction-provenance, compare-at-two-times while preserving their independent owners. |
| record-identity | Owns stable subject, scope, and orientation facts for every downstream decision. | Orients valid-time-axis without replacing its owner. |
| valid-time-axis | Owns ordering, coordinates, or dependency relationships without owning the underlying product facts. | Receives context from record-identity and constrains transaction-time-axis without merging their authorities. |
| transaction-time-axis | Owns ordering, coordinates, or dependency relationships without owning the underlying product facts. | Receives context from valid-time-axis and constrains interval-state-grid without merging their authorities. |
| interval-state-grid | Owns ordering, coordinates, or dependency relationships without owning the underlying product facts. | Receives context from transaction-time-axis and constrains selected-state-facts without merging their authorities. |
| selected-state-facts | Owns traceable supporting evidence and its freshness, availability, and permission state. | Receives context from interval-state-grid and constrains correction-provenance without merging their authorities. |
| correction-provenance | Owns traceable supporting evidence and its freshness, availability, and permission state. | Receives context from selected-state-facts and constrains compare-at-two-times without merging their authorities. |
| compare-at-two-times | Owns this named task fact or stage and no neighboring region's decision authority. | Consumes verified state from correction-provenance and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Show the two-axis interval view with selected facts and provenance; only the bounded matrix owns time overflow.
- Failure trigger: simultaneous regions narrow content, obscure state, or break owner relationships.
- Navigation replacement is unnecessary while regions remain simultaneous; sticky is allowed only for context that fits.
- The page owns vertical overflow; only an intrinsically two-dimensional region may own bounded overflow.

### Intermediate

- Keep one axis primary and expose the other as a selector without losing the selected instant.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- A named trigger opens the temporary pane; Escape closes it and focus returns to the trigger.
- Sticky behavior yields at short height; the page remains the overflow owner.

### Compact

- Choose valid-at or known-at, then inspect interval, facts, and correction provenance with explicit view switching.
- Failure trigger: multiple panes are no longer simultaneously operable with 16px text and 44px targets.
- Previous, Next, and a stage selector replace pane adjacency; Back preserves selection and draft.
- No page-level horizontal scrolling is allowed; sticky or fixed surfaces never obscure content or focus.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder it. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. Region state survives movement into and out of the temporary pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale/conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A dialog contains focus, supports Escape or cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: no history; open/closed interval; retroactive correction; superseded state; conflicting intervals; timezone/granularity; missing provenance; selected instant; unavailable comparison.

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
| domain states | Valid-time interval selected; transaction-time coordinate is unchanged. Known-at instant changed; the real-world interval remains selected. Comparison exposes a retroactive correction in text and table form. Correction chain opened with source and superseded-state evidence. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, its critical relationship creates a distinct topology, and all responsive states preserve task and recovery parity.

### Reject

Reject when the need is ordinary version history, an audit timeline, a job progression, or a spreadsheet grid, or when the candidate only changes nouns, cards, or density from another archetype.

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
| [W3C — Model for Tabular Data and Metadata on the Web](https://www.w3.org/TR/tabular-data-model/) | Supports explicit row, column, and annotation relationships. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports scan and action relationships in dense records. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports responsive region relationships and preservation of usable content measure. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports content availability without page-level two-dimensional scrolling. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "bitemporal-record-validity-detail",
  "matchedSituationCodes": [
    "AR-BTV-01",
    "AR-BTV-02"
  ],
  "aliases": [
    "bitemporal-record-validity-detail",
    "bitemporal record validity detail"
  ],
  "dominantTask": "Determine what a record was valid for in the real world versus when the system knew or corrected that state.",
  "regions": [
    "bitemporal-detail",
    "record-identity",
    "valid-time-axis",
    "transaction-time-axis",
    "interval-state-grid",
    "selected-state-facts",
    "correction-provenance",
    "compare-at-two-times"
  ],
  "relationships": [
    "Valid time and transaction time remain independent semantic axes; selected facts and correction provenance bind both coordinates."
  ],
  "responsive": {
    "wide": "Show the two-axis interval view with selected facts and provenance; only the bounded matrix owns time overflow.",
    "intermediate": "Keep one axis primary and expose the other as a selector without losing the selected instant.",
    "compact": "Choose valid-at or known-at, then inspect interval, facts, and correction provenance with explicit view switching.",
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
