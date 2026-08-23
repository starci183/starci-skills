# Literature screening workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | literature-screening-workbench |
| Family | work |
| Dominant task | Classify citations against a review protocol, record exclusion reasons, and adjudicate independent reviewer conflicts. |
| Search aliases | literature-screening-workbench; citation screening; study selection; reviewer adjudication |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Classify citations against a review protocol, record exclusion reasons, and adjudicate independent reviewer conflicts.
- Each required region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-LSW-01 | Classify citations against a review protocol, record exclusion reasons, and adjudicate independent reviewer conflicts. | required positive evidence |
| AR-LSW-02 | The critical region relationship and owner separation are evidenced. | required relationship evidence |
| AR-LSW-03 | The wide relationship fails, but compact preserves task, state, and recovery. | responsive transformation trigger |
| AR-LSW-04 | Error, permission, pending, success, and stale or conflict states have bounded recovery. | required state evidence |
| AR-LSW-90 | Reject generic operational queues, one-case resolution, systematic synthesis, and content moderation. | reject |
| AR-LSW-91 | The difference is only a product noun, density, color, component, state skin, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-LSW-01, AR-LSW-02, and AR-LSW-03 are evidenced, neither AR-LSW-90 nor AR-LSW-91 is present, and every required region remains necessary across all three topologies. Return needs-evidence when an owner, relation, or transformation is unresolved.

## Region graph

~~~text
screening-workbench
├─ review-protocol
├─ citation-queue
├─ title-abstract-evidence
├─ inclusion-criteria
├─ include-exclude-uncertain-decision
├─ reviewer-conflict-adjudication
└─ flow-counts
~~~

Critical relationship: The review protocol and blinded reviewer decisions independently own classification; flow counts derive from adjudicated decisions.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| screening-workbench | Owns the dominant-task boundary and contains every required region without inventing product semantics. | Contains review-protocol, citation-queue, title-abstract-evidence, inclusion-criteria, include-exclude-uncertain-decision, reviewer-conflict-adjudication, flow-counts while preserving each region's independent owner. |
| review-protocol | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from screening-workbench and gates citation-queue without merging authority. |
| citation-queue | Owns membership, identity, status, and current selection for this bounded collection. | Receives context from review-protocol and gates title-abstract-evidence without merging authority. |
| title-abstract-evidence | Owns source evidence, provenance, freshness, and availability; it never decides the outcome. | Receives context from citation-queue and gates inclusion-criteria without merging authority. |
| inclusion-criteria | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from title-abstract-evidence and gates include-exclude-uncertain-decision without merging authority. |
| include-exclude-uncertain-decision | Owns editable decision state, validation, and the pending guard for the named stage. | Receives context from inclusion-criteria and gates reviewer-conflict-adjudication without merging authority. |
| reviewer-conflict-adjudication | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from include-exclude-uncertain-decision and gates flow-counts without merging authority. |
| flow-counts | Owns a derived interpretation or consequence preview; it never becomes a second input authority. | Consumes verified state from reviewer-conflict-adjudication and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Topology response: Keep citation queue, title and abstract evidence, inclusion criteria, decision, and flow counts simultaneously visible.
- Failure trigger: simultaneous regions narrow readable measure, obscure state, or break the named relationship.
- Navigation replacement: none while regions remain simultaneous; sticky is limited to orientation context that fits.
- Sticky boundary: yield at short height and never obscure a focused control.
- Overflow owner: the page owns vertical overflow; only an intrinsic matrix owns bounded horizontal overflow.

### Intermediate

- Topology response: Move the queue to a drawer; keep citation evidence and criteria primary.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- Navigation replacement: a named trigger opens the supporting dialog; Escape or Cancel closes it and focus returns to the exact trigger.
- Sticky boundary: persistent context yields at short height; the dialog body owns bounded vertical overflow.
- Overflow owner: the page retains vertical overflow; the supporting dialog owns only its internal overflow.

### Compact

- Topology response: Stage one citation, criteria, decision and reason, then next; use a separate adjudication route that preserves queue position.
- Failure trigger: the multi-pane relationship is no longer operable with 16px body text and 44px targets.
- Navigation replacement: Previous, Next, and a stage selector replace pane adjacency; Back preserves selection, draft, and recovery state.
- Sticky boundary: no fixed action bar; focused content remains visible.
- Overflow owner: no page-level horizontal scrolling; an intrinsic matrix becomes grouped records.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder semantics. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. State survives movement into and out of the supporting pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale or conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A modal contains focus, supports Escape or Cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: citation loading/duplicate; reviewer assignment blind/revealed; include/exclude/uncertain; reason missing; disagreement open/adjudicated; full text unavailable; flow counts stale; screening complete.

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
| domain states | Preserve the complete domain catalog: citation loading/duplicate; reviewer assignment blind/revealed; include/exclude/uncertain; reason missing; disagreement open/adjudicated; full text unavailable; flow counts stale; screening complete. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, the critical relationship creates a distinct topology, and every responsive state preserves task and recovery parity.

### Reject

Reject generic operational queues, one-case resolution, systematic synthesis, and content moderation. Also reject duplicate-or-variation when the candidate only changes nouns, density, components, or visual state.

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
| [Cochrane — Selecting studies and collecting data](https://training.cochrane.org/interactivelearning/module-4-selecting-studies-and-collecting-data) | Supports protocol-based study selection and duplicate reviewer work. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [IBM Carbon — Data table usage](https://carbondesignsystem.com/components/data-table/usage/) | Supports bounded queue navigation and explicit row state. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports preserving citation and adjudication focus order. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "literature-screening-workbench",
  "matchedSituationCodes": [
    "AR-LSW-01",
    "AR-LSW-02",
    "AR-LSW-03"
  ],
  "aliases": [
    "literature-screening-workbench",
    "citation screening",
    "study selection",
    "reviewer adjudication"
  ],
  "dominantTask": "Classify citations against a review protocol, record exclusion reasons, and adjudicate independent reviewer conflicts.",
  "regions": [
    "screening-workbench",
    "review-protocol",
    "citation-queue",
    "title-abstract-evidence",
    "inclusion-criteria",
    "include-exclude-uncertain-decision",
    "reviewer-conflict-adjudication",
    "flow-counts"
  ],
  "relationships": [
    "The review protocol and blinded reviewer decisions independently own classification; flow counts derive from adjudicated decisions."
  ],
  "responsive": {
    "wide": "Keep citation queue, title and abstract evidence, inclusion criteria, decision, and flow counts simultaneously visible.",
    "intermediate": "Move the queue to a drawer; keep citation evidence and criteria primary.",
    "compact": "Stage one citation, criteria, decision and reason, then next; use a separate adjudication route that preserves queue position.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "screening-workbench → review-protocol → citation-queue → title-abstract-evidence → inclusion-criteria → include-exclude-uncertain-decision → reviewer-conflict-adjudication → flow-counts",
    "navigationReplacement": "An anchored supporting pane at intermediate and a staged Previous/Next selector at compact.",
    "stickyBehavior": "Only orientation context may persist, and it yields at short height without obscuring focus.",
    "overflowOwner": "The page owns vertical overflow; no page-level horizontal overflow is allowed.",
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
    "citation loading/duplicate; reviewer assignment blind/revealed; include/exclude/uncertain; reason missing; disagreement open/adjudicated; full text unavailable; flow counts stale; screening complete"
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

