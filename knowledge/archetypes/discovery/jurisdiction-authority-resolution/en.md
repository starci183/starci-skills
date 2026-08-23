# Jurisdiction authority resolution

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | jurisdiction-authority-resolution |
| Family | discovery |
| Dominant task | Resolve which authority owns a subject when geographic and organizational jurisdictions overlap, while preserving the rule evidence that explains the result. |
| Search aliases | jurisdiction-authority-resolution; authority resolution; jurisdiction overlap; service-owner precedence |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Resolve which authority owns a subject when geographic and organizational jurisdictions overlap, while preserving the rule evidence that explains the result.
- Each required region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-JAR-01 | Resolve which authority owns a subject when geographic and organizational jurisdictions overlap, while preserving the rule evidence that explains the result. | required positive evidence |
| AR-JAR-02 | The critical region relationship and owner separation are evidenced. | required relationship evidence |
| AR-JAR-03 | The wide relationship fails, but compact preserves task, state, and recovery. | responsive transformation trigger |
| AR-JAR-04 | Error, permission, pending, success, and stale or conflict states have bounded recovery. | required state evidence |
| AR-JAR-90 | Reject place discovery, map monitoring, scope picking, evidence dossiers, service hubs, generic rule builders, and any case-merit adjudication. | reject |
| AR-JAR-91 | The difference is only a product noun, density, color, component, state skin, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-JAR-01, AR-JAR-02, and AR-JAR-03 are evidenced, neither AR-JAR-90 nor AR-JAR-91 is present, and every required region remains necessary across all three topologies. Return needs-evidence when an owner, relation, or transformation is unresolved.

## Region graph

~~~text
authority-resolver
├─ subject-location-and-scope
├─ jurisdiction-layer-stack
├─ authority-rule-register
├─ overlap-or-conflict-evidence
├─ selected-authority-and-service
└─ proof-and-escalation
~~~

Critical relationship: The jurisdiction-layer-stack and authority-rule-register are peer evidence owners; precedence resolution, not the map, determines selected-authority-and-service.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| authority-resolver | Owns the dominant-task boundary and contains every required region without inventing product semantics. | Contains subject-location-and-scope, jurisdiction-layer-stack, authority-rule-register, overlap-or-conflict-evidence, selected-authority-and-service, proof-and-escalation while preserving each region's independent owner. |
| subject-location-and-scope | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from authority-resolver and gates jurisdiction-layer-stack without merging authority. |
| jurisdiction-layer-stack | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from subject-location-and-scope and gates authority-rule-register without merging authority. |
| authority-rule-register | Owns source evidence, provenance, freshness, and availability; it never decides the outcome. | Receives context from jurisdiction-layer-stack and gates overlap-or-conflict-evidence without merging authority. |
| overlap-or-conflict-evidence | Owns source evidence, provenance, freshness, and availability; it never decides the outcome. | Receives context from authority-rule-register and gates selected-authority-and-service without merging authority. |
| selected-authority-and-service | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from overlap-or-conflict-evidence and gates proof-and-escalation without merging authority. |
| proof-and-escalation | Owns the bounded outcome, receipt, or recovery route after every upstream gate passes. | Consumes verified state from selected-authority-and-service and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Topology response: Keep spatial and layer context, the rule register, conflict evidence, and the authority result simultaneously inspectable.
- Failure trigger: simultaneous regions narrow readable measure, obscure state, or break the named relationship.
- Navigation replacement: none while regions remain simultaneous; sticky is limited to orientation context that fits.
- Sticky boundary: yield at short height and never obscure a focused control.
- Overflow owner: the page owns vertical overflow; only an intrinsic matrix owns bounded horizontal overflow.

### Intermediate

- Topology response: Make rule and result regions primary; move spatial context to an anchored supporting pane without changing the selected subject.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- Navigation replacement: a named trigger opens the supporting dialog; Escape or Cancel closes it and focus returns to the exact trigger.
- Sticky boundary: persistent context yields at short height; the dialog body owns bounded vertical overflow.
- Overflow owner: the page retains vertical overflow; the supporting dialog owns only its internal overflow.

### Compact

- Topology response: Stage the evidence-first jurisdiction path, selected authority and service, proof, then escalation; open the map only to inspect location evidence.
- Failure trigger: the multi-pane relationship is no longer operable with 16px body text and 44px targets.
- Navigation replacement: Previous, Next, and a stage selector replace pane adjacency; Back preserves selection, draft, and recovery state.
- Sticky boundary: no fixed action bar; focused content remains visible.
- Overflow owner: no page-level horizontal scrolling; an intrinsic matrix becomes grouped records.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder semantics. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. State survives movement into and out of the supporting pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale or conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A modal contains focus, supports Escape or Cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: location unknown/ambiguous; layer loading; rule active/expired; authority unique/multiple/none; conflict unresolved; service unavailable; escalation pending; proof exported.

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
| domain states | Preserve the complete domain catalog: location unknown/ambiguous; layer loading; rule active/expired; authority unique/multiple/none; conflict unresolved; service unavailable; escalation pending; proof exported. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, the critical relationship creates a distinct topology, and every responsive state preserves task and recovery parity.

### Reject

Reject place discovery, map monitoring, scope picking, evidence dossiers, service hubs, generic rule builders, and any case-merit adjudication. Also reject duplicate-or-variation when the candidate only changes nouns, density, components, or visual state.

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
| [Esri — Creating app layouts](https://developers.arcgis.com/javascript/latest/creating-app-layouts/) | Supports keeping spatial context subordinate to a task owner. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [GOV.UK — Local government structure and elections](https://www.gov.uk/guidance/local-government-structure-and-elections) | Supports overlapping tiers and split service responsibilities. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports logical focus order when supporting panes change. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "jurisdiction-authority-resolution",
  "matchedSituationCodes": [
    "AR-JAR-01",
    "AR-JAR-02",
    "AR-JAR-03"
  ],
  "aliases": [
    "jurisdiction-authority-resolution",
    "authority resolution",
    "jurisdiction overlap",
    "service-owner precedence"
  ],
  "dominantTask": "Resolve which authority owns a subject when geographic and organizational jurisdictions overlap, while preserving the rule evidence that explains the result.",
  "regions": [
    "authority-resolver",
    "subject-location-and-scope",
    "jurisdiction-layer-stack",
    "authority-rule-register",
    "overlap-or-conflict-evidence",
    "selected-authority-and-service",
    "proof-and-escalation"
  ],
  "relationships": [
    "The jurisdiction-layer-stack and authority-rule-register are peer evidence owners; precedence resolution, not the map, determines selected-authority-and-service."
  ],
  "responsive": {
    "wide": "Keep spatial and layer context, the rule register, conflict evidence, and the authority result simultaneously inspectable.",
    "intermediate": "Make rule and result regions primary; move spatial context to an anchored supporting pane without changing the selected subject.",
    "compact": "Stage the evidence-first jurisdiction path, selected authority and service, proof, then escalation; open the map only to inspect location evidence.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "authority-resolver → subject-location-and-scope → jurisdiction-layer-stack → authority-rule-register → overlap-or-conflict-evidence → selected-authority-and-service → proof-and-escalation",
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
    "location unknown/ambiguous; layer loading; rule active/expired; authority unique/multiple/none; conflict unresolved; service unavailable; escalation pending; proof exported"
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

