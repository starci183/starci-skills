# Automated decision explanation challenge

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | automated-decision-explanation-challenge |
| Family | flow |
| Dominant task | Understand a consequential automated outcome, inspect factors, source data, and uncertainty, then correct inputs or challenge it for human review. |
| Search aliases | automated-decision-explanation-challenge; automated decision challenge; factor explanation; human review request |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Understand a consequential automated outcome, inspect factors, source data, and uncertainty, then correct inputs or challenge it for human review.
- Each required region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-ADC-01 | Understand a consequential automated outcome, inspect factors, source data, and uncertainty, then correct inputs or challenge it for human review. | required positive evidence |
| AR-ADC-02 | The critical region relationship and owner separation are evidenced. | required relationship evidence |
| AR-ADC-03 | The wide relationship fails, but compact preserves task, state, and recovery. | responsive transformation trigger |
| AR-ADC-04 | Error, permission, pending, success, and stale or conflict states have bounded recovery. | required state evidence |
| AR-ADC-90 | Reject analytical briefings, generic appeal forms, model dashboards, and one-case dossiers without subject-specific provenance and review. | reject |
| AR-ADC-91 | The difference is only a product noun, density, color, component, state skin, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-ADC-01, AR-ADC-02, and AR-ADC-03 are evidenced, neither AR-ADC-90 nor AR-ADC-91 is present, and every required region remains necessary across all three topologies. Return needs-evidence when an owner, relation, or transformation is unresolved.

## Region graph

~~~text
decision-challenge
├─ outcome-impact
├─ factor-explanation
├─ source-data-provenance
├─ limits-uncertainty
├─ correction-or-challenge-grounds
├─ evidence-submit
└─ human-review-tracker
~~~

Critical relationship: Factor explanation and the transactional challenge are peer owners; the exact disputed factor and source provenance persist through human review.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| decision-challenge | Owns the dominant-task boundary and contains every required region without inventing product semantics. | Contains outcome-impact, factor-explanation, source-data-provenance, limits-uncertainty, correction-or-challenge-grounds, evidence-submit, human-review-tracker while preserving each region's independent owner. |
| outcome-impact | Owns a derived interpretation or consequence preview; it never becomes a second input authority. | Receives context from decision-challenge and gates factor-explanation without merging authority. |
| factor-explanation | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from outcome-impact and gates source-data-provenance without merging authority. |
| source-data-provenance | Owns source evidence, provenance, freshness, and availability; it never decides the outcome. | Receives context from factor-explanation and gates limits-uncertainty without merging authority. |
| limits-uncertainty | Owns a derived interpretation or consequence preview; it never becomes a second input authority. | Receives context from source-data-provenance and gates correction-or-challenge-grounds without merging authority. |
| correction-or-challenge-grounds | Owns editable decision state, validation, and the pending guard for the named stage. | Receives context from limits-uncertainty and gates evidence-submit without merging authority. |
| evidence-submit | Owns source evidence, provenance, freshness, and availability; it never decides the outcome. | Receives context from correction-or-challenge-grounds and gates human-review-tracker without merging authority. |
| human-review-tracker | Owns the bounded outcome, receipt, or recovery route after every upstream gate passes. | Consumes verified state from evidence-submit and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Topology response: Keep outcome and factors, source facts, uncertainty, challenge grounds, and review status simultaneously visible.
- Failure trigger: simultaneous regions narrow readable measure, obscure state, or break the named relationship.
- Navigation replacement: none while regions remain simultaneous; sticky is limited to orientation context that fits.
- Sticky boundary: yield at short height and never obscure a focused control.
- Overflow owner: the page owns vertical overflow; only an intrinsic matrix owns bounded horizontal overflow.

### Intermediate

- Topology response: Move source provenance to a drawer; keep factors, limits, and grounds primary.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- Navigation replacement: a named trigger opens the supporting dialog; Escape or Cancel closes it and focus returns to the exact trigger.
- Sticky boundary: persistent context yields at short height; the dialog body owns bounded vertical overflow.
- Overflow owner: the page retains vertical overflow; the supporting dialog owns only its internal overflow.

### Compact

- Topology response: Stage outcome, factors, source facts, limits, correction or challenge grounds, evidence submission, then human-review status.
- Failure trigger: the multi-pane relationship is no longer operable with 16px body text and 44px targets.
- Navigation replacement: Previous, Next, and a stage selector replace pane adjacency; Back preserves selection, draft, and recovery state.
- Sticky boundary: no fixed action bar; focused content remains visible.
- Overflow owner: no page-level horizontal scrolling; an intrinsic matrix becomes grouped records.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder semantics. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. State survives movement into and out of the supporting pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale or conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A modal contains focus, supports Escape or Cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: outcome loading/final; factor available/withheld; source fact correct/incorrect/unknown; uncertainty high; correction allowed/blocked; challenge draft/submitted; evidence missing; review pending/decided.

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
| domain states | Preserve the complete domain catalog: outcome loading/final; factor available/withheld; source fact correct/incorrect/unknown; uncertainty high; correction allowed/blocked; challenge draft/submitted; evidence missing; review pending/decided. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, the critical relationship creates a distinct topology, and every responsive state preserves task and recovery parity.

### Reject

Reject analytical briefings, generic appeal forms, model dashboards, and one-case dossiers without subject-specific provenance and review. Also reject duplicate-or-variation when the candidate only changes nouns, density, components, or visual state.

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
| [NIST — AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) | Supports transparency, traceability, and risk management for AI outcomes. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [OECD — AI Principles](https://www.oecd.org/en/topics/ai-principles.html) | Supports meaningful explanation and the ability to challenge consequential output. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports accessible challenge and review-status updates. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "automated-decision-explanation-challenge",
  "matchedSituationCodes": [
    "AR-ADC-01",
    "AR-ADC-02",
    "AR-ADC-03"
  ],
  "aliases": [
    "automated-decision-explanation-challenge",
    "automated decision challenge",
    "factor explanation",
    "human review request"
  ],
  "dominantTask": "Understand a consequential automated outcome, inspect factors, source data, and uncertainty, then correct inputs or challenge it for human review.",
  "regions": [
    "decision-challenge",
    "outcome-impact",
    "factor-explanation",
    "source-data-provenance",
    "limits-uncertainty",
    "correction-or-challenge-grounds",
    "evidence-submit",
    "human-review-tracker"
  ],
  "relationships": [
    "Factor explanation and the transactional challenge are peer owners; the exact disputed factor and source provenance persist through human review."
  ],
  "responsive": {
    "wide": "Keep outcome and factors, source facts, uncertainty, challenge grounds, and review status simultaneously visible.",
    "intermediate": "Move source provenance to a drawer; keep factors, limits, and grounds primary.",
    "compact": "Stage outcome, factors, source facts, limits, correction or challenge grounds, evidence submission, then human-review status.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "decision-challenge → outcome-impact → factor-explanation → source-data-provenance → limits-uncertainty → correction-or-challenge-grounds → evidence-submit → human-review-tracker",
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
    "outcome loading/final; factor available/withheld; source fact correct/incorrect/unknown; uncertainty high; correction allowed/blocked; challenge draft/submitted; evidence missing; review pending/decided"
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

