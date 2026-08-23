# Evidence extraction synthesis matrix

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | evidence-extraction-synthesis-matrix |
| Family | work |
| Dominant task | Extract normalized values or claims from sources into an outcome schema while preserving exact provenance and reviewer agreement. |
| Search aliases | evidence-extraction-synthesis-matrix; evidence extraction; source outcome matrix; provenance synthesis |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Extract normalized values or claims from sources into an outcome schema while preserving exact provenance and reviewer agreement.
- Each required region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-ESM-01 | Extract normalized values or claims from sources into an outcome schema while preserving exact provenance and reviewer agreement. | required positive evidence |
| AR-ESM-02 | The critical region relationship and owner separation are evidenced. | required relationship evidence |
| AR-ESM-03 | The wide relationship fails, but compact preserves task, state, and recovery. | responsive transformation trigger |
| AR-ESM-04 | Error, permission, pending, success, and stale or conflict states have bounded recovery. | required state evidence |
| AR-ESM-90 | Reject generic spreadsheets, comparison matrices, reconciliation diffs, and systematic weighted synthesis. | reject |
| AR-ESM-91 | The difference is only a product noun, density, color, component, state skin, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-ESM-01, AR-ESM-02, and AR-ESM-03 are evidenced, neither AR-ESM-90 nor AR-ESM-91 is present, and every required region remains necessary across all three topologies. Return needs-evidence when an owner, relation, or transformation is unresolved.

## Region graph

~~~text
extraction-workbench
├─ synthesis-question-outcomes
├─ source-by-field-matrix
├─ selected-source-excerpt
├─ structured-extraction
├─ normalization-confidence
├─ reviewer-conflict
└─ aggregate-synthesis
~~~

Critical relationship: Every matrix value is anchored to a source excerpt; normalization and reviewer agreement are explicit gates before aggregate synthesis.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| extraction-workbench | Owns the dominant-task boundary and contains every required region without inventing product semantics. | Contains synthesis-question-outcomes, source-by-field-matrix, selected-source-excerpt, structured-extraction, normalization-confidence, reviewer-conflict, aggregate-synthesis while preserving each region's independent owner. |
| synthesis-question-outcomes | Owns a derived interpretation or consequence preview; it never becomes a second input authority. | Receives context from extraction-workbench and gates source-by-field-matrix without merging authority. |
| source-by-field-matrix | Owns source evidence, provenance, freshness, and availability; it never decides the outcome. | Receives context from synthesis-question-outcomes and gates selected-source-excerpt without merging authority. |
| selected-source-excerpt | Owns source evidence, provenance, freshness, and availability; it never decides the outcome. | Receives context from source-by-field-matrix and gates structured-extraction without merging authority. |
| structured-extraction | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from selected-source-excerpt and gates normalization-confidence without merging authority. |
| normalization-confidence | Owns a derived interpretation or consequence preview; it never becomes a second input authority. | Receives context from structured-extraction and gates reviewer-conflict without merging authority. |
| reviewer-conflict | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from normalization-confidence and gates aggregate-synthesis without merging authority. |
| aggregate-synthesis | Owns a derived interpretation or consequence preview; it never becomes a second input authority. | Consumes verified state from reviewer-conflict and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Topology response: Keep matrix, selected source excerpt, structured extraction, confidence, conflict, and synthesis simultaneously visible.
- Failure trigger: simultaneous regions narrow readable measure, obscure state, or break the named relationship.
- Navigation replacement: none while regions remain simultaneous; sticky is limited to orientation context that fits.
- Sticky boundary: yield at short height and never obscure a focused control.
- Overflow owner: the page owns vertical overflow; only an intrinsic matrix owns bounded horizontal overflow.

### Intermediate

- Topology response: Let the matrix own bounded horizontal overflow; alternate source viewer and inspector without losing the selected cell.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- Navigation replacement: a named trigger opens the supporting dialog; Escape or Cancel closes it and focus returns to the exact trigger.
- Sticky boundary: persistent context yields at short height; the dialog body owns bounded vertical overflow.
- Overflow owner: the page retains vertical overflow; the supporting dialog owns only its internal overflow.

### Compact

- Topology response: Stage source and outcome selection, exact excerpt, structured fields, confidence or conflict, then grouped synthesis records.
- Failure trigger: the multi-pane relationship is no longer operable with 16px body text and 44px targets.
- Navigation replacement: Previous, Next, and a stage selector replace pane adjacency; Back preserves selection, draft, and recovery state.
- Sticky boundary: no fixed action bar; focused content remains visible.
- Overflow owner: no page-level horizontal scrolling; an intrinsic matrix becomes grouped records.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder semantics. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. State survives movement into and out of the supporting pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale or conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A modal contains focus, supports Escape or Cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: source loading/unavailable; field missing/extracted; excerpt anchor valid/broken; normalization pending/conflict; confidence low/high; reviewer agreement/disagreement; aggregate stale; export.

| State family | Obligation | Focus transition | Responsive presentation |
|---|---|---|---|
| initial/loading | Preserve known anatomy and name the waiting region. | Do not move focus automatically. | Keep the same stage identity. |
| ready | Show consistent fictional data and the current selection. | Focus remains at the activating control. | Preserve selection through transformation. |
| empty/not-applicable | Explain why content is empty and the valid next step. | Move to recovery only when continuation requires it. | Do not erase other required regions. |
| error/retry | Associate the error with its owner and provide bounded retry. | Multi-error focuses the summary; retry returns to the exact action. | Error is not color-only. |
| permission/unavailable | Preserve orientation and explain the limitation. | Do not focus a locked control. | Use the same reason in every topology. |
| pending | Prevent duplicates and preserve action meaning. | Do not steal focus for progress. | State stays with its action owner. |
| success | Confirm the outcome and a valid continuation. | Move focus only when it helps continuation. | Do not create a second source of truth. |
| stale/conflict | Name the changed version and preserve safe input. | Focus a contextual recovery choice. | Selection survives transformation. |
| domain states | Preserve the complete domain catalog: source loading/unavailable; field missing/extracted; excerpt anchor valid/broken; normalization pending/conflict; confidence low/high; reviewer agreement/disagreement; aggregate stale; export. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, the critical relationship creates a distinct topology, and every responsive state preserves task and recovery parity.

### Reject

Reject generic spreadsheets, comparison matrices, reconciliation diffs, and systematic weighted synthesis. Also reject duplicate-or-variation when the candidate only changes nouns, density, components, or visual state.

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
| [Cochrane — Handbook chapter 5](https://training.cochrane.org/handbook/current/chapter-05) | Supports structured extraction, provenance, and discrepancy resolution. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [JBI — Manual for Evidence Synthesis 2024](https://jbi-global-wiki.refined.site/download/attachments/355599504/JBI%20Manual%20for%20Evidence%20Synthesis%202024.pdf) | Supports evidence-synthesis methodology and reviewer governance. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Supports keyboard access to a bounded two-dimensional data region. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "evidence-extraction-synthesis-matrix",
  "matchedSituationCodes": [
    "AR-ESM-01",
    "AR-ESM-02",
    "AR-ESM-03"
  ],
  "aliases": [
    "evidence-extraction-synthesis-matrix",
    "evidence extraction",
    "source outcome matrix",
    "provenance synthesis"
  ],
  "dominantTask": "Extract normalized values or claims from sources into an outcome schema while preserving exact provenance and reviewer agreement.",
  "regions": [
    "extraction-workbench",
    "synthesis-question-outcomes",
    "source-by-field-matrix",
    "selected-source-excerpt",
    "structured-extraction",
    "normalization-confidence",
    "reviewer-conflict",
    "aggregate-synthesis"
  ],
  "relationships": [
    "Every matrix value is anchored to a source excerpt; normalization and reviewer agreement are explicit gates before aggregate synthesis."
  ],
  "responsive": {
    "wide": "Keep matrix, selected source excerpt, structured extraction, confidence, conflict, and synthesis simultaneously visible.",
    "intermediate": "Let the matrix own bounded horizontal overflow; alternate source viewer and inspector without losing the selected cell.",
    "compact": "Stage source and outcome selection, exact excerpt, structured fields, confidence or conflict, then grouped synthesis records.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "extraction-workbench → synthesis-question-outcomes → source-by-field-matrix → selected-source-excerpt → structured-extraction → normalization-confidence → reviewer-conflict → aggregate-synthesis",
    "navigationReplacement": "An anchored supporting pane at intermediate and a staged Previous/Next selector at compact.",
    "stickyBehavior": "Only orientation context may persist, and it yields at short height without obscuring focus.",
    "overflowOwner": "The source-by-field-matrix owns bounded horizontal overflow at intermediate; compact replaces it with grouped records.",
    "interactionParity": "Every action, state, pending guard, recovery path, and focus return remains available across bands."
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
    "focus transition",
    "source loading/unavailable; field missing/extracted; excerpt anchor valid/broken; normalization pending/conflict; confidence low/high; reviewer agreement/disagreement; aggregate stale; export"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product facts",
    "semantic owners",
    "permissions and consequences",
    "real state transitions"
  ],
  "principlesHandoff": [
    "exact geometry",
    "measure and overflow",
    "content-driven thresholds",
    "sticky offsets",
    "focus accommodation"
  ],
  "confidence": "high when the positive situations and critical relationship are evidenced; otherwise needs-evidence",
  "evidenceClasses": [
    "official task-domain guidance",
    "official independent design or service guidance",
    "official accessibility guidance"
  ]
}
~~~

Return no class, token, component, source path, fixed breakpoint, or invented product fact.

