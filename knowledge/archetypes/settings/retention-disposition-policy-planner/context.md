# Retention disposition policy planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | retention-disposition-policy-planner |
| Family | settings |
| Dominant task | Define lifecycle triggers, retention periods, holds, precedence, and irreversible disposition, then simulate impact before publishing and locking policy. |
| Search aliases | retention-disposition-policy-planner; retention policy planner; disposition rule simulation; records lifecycle policy |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Define lifecycle triggers, retention periods, holds, precedence, and irreversible disposition, then simulate impact before publishing and locking policy.
- Each required region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-RDP-01 | Define lifecycle triggers, retention periods, holds, precedence, and irreversible disposition, then simulate impact before publishing and locking policy. | required positive evidence |
| AR-RDP-02 | The critical region relationship and owner separation are evidenced. | required relationship evidence |
| AR-RDP-03 | The wide relationship fails, but compact preserves task, state, and recovery. | responsive transformation trigger |
| AR-RDP-04 | Error, permission, pending, success, and stale or conflict states have bounded recovery. | required state evidence |
| AR-RDP-90 | Reject generic rule builders, effective-setting provenance, operational disposition queues, and preference centers. | reject |
| AR-RDP-91 | The difference is only a product noun, density, color, component, state skin, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-RDP-01, AR-RDP-02, and AR-RDP-03 are evidenced, neither AR-RDP-90 nor AR-RDP-91 is present, and every required region remains necessary across all three topologies. Return needs-evidence when an owner, relation, or transformation is unresolved.

## Region graph

~~~text
retention-policy-planner
├─ scope-record-class-tree
├─ lifecycle-timeline
├─ trigger-retention-disposition-editor
├─ holds-exceptions-precedence
├─ impact-simulation
└─ publish-lock-receipt
~~~

Critical relationship: Temporal rules and hold precedence govern simulated outcomes; this planner never executes disposition on record cohorts.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| retention-policy-planner | Owns the dominant-task boundary and contains every required region without inventing product semantics. | Contains scope-record-class-tree, lifecycle-timeline, trigger-retention-disposition-editor, holds-exceptions-precedence, impact-simulation, publish-lock-receipt while preserving each region's independent owner. |
| scope-record-class-tree | Owns membership, identity, status, and current selection for this bounded collection. | Receives context from retention-policy-planner and gates lifecycle-timeline without merging authority. |
| lifecycle-timeline | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from scope-record-class-tree and gates trigger-retention-disposition-editor without merging authority. |
| trigger-retention-disposition-editor | Owns editable decision state, validation, and the pending guard for the named stage. | Receives context from lifecycle-timeline and gates holds-exceptions-precedence without merging authority. |
| holds-exceptions-precedence | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from trigger-retention-disposition-editor and gates impact-simulation without merging authority. |
| impact-simulation | Owns a derived interpretation or consequence preview; it never becomes a second input authority. | Receives context from holds-exceptions-precedence and gates publish-lock-receipt without merging authority. |
| publish-lock-receipt | Owns the bounded outcome, receipt, or recovery route after every upstream gate passes. | Consumes verified state from impact-simulation and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Topology response: Keep record-class scope, lifecycle timeline, rule editor, precedence evidence, and impact simulation simultaneously visible.
- Failure trigger: simultaneous regions narrow readable measure, obscure state, or break the named relationship.
- Navigation replacement: none while regions remain simultaneous; sticky is limited to orientation context that fits.
- Sticky boundary: yield at short height and never obscure a focused control.
- Overflow owner: the page owns vertical overflow; only an intrinsic matrix owns bounded horizontal overflow.

### Intermediate

- Topology response: Move the class tree to a drawer; keep lifecycle and selected precedence primary.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- Navigation replacement: a named trigger opens the supporting dialog; Escape or Cancel closes it and focus returns to the exact trigger.
- Sticky boundary: persistent context yields at short height; the dialog body owns bounded vertical overflow.
- Overflow owner: the page retains vertical overflow; the supporting dialog owns only its internal overflow.

### Compact

- Topology response: Stage record class, trigger, duration and hold, disposition, simulated outcome, then the explicit publish-and-lock ceremony.
- Failure trigger: the multi-pane relationship is no longer operable with 16px body text and 44px targets.
- Navigation replacement: Previous, Next, and a stage selector replace pane adjacency; Back preserves selection, draft, and recovery state.
- Sticky boundary: no fixed action bar; focused content remains visible.
- Overflow owner: no page-level horizontal scrolling; an intrinsic matrix becomes grouped records.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder semantics. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. State survives movement into and out of the supporting pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale or conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A modal contains focus, supports Escape or Cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: class loading; trigger absent/valid; duration invalid; hold active/conflicting; precedence unresolved; simulation running/impact; policy draft/reviewed/locked; publish failure; superseded version.

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
| domain states | Preserve the complete domain catalog: class loading; trigger absent/valid; duration invalid; hold active/conflicting; precedence unresolved; simulation running/impact; policy draft/reviewed/locked; publish failure; superseded version. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, the critical relationship creates a distinct topology, and every responsive state preserves task and recovery parity.

### Reject

Reject generic rule builders, effective-setting provenance, operational disposition queues, and preference centers. Also reject duplicate-or-variation when the candidate only changes nouns, density, components, or visual state.

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
| [Microsoft Purview — Create retention policies](https://learn.microsoft.com/en-us/purview/create-retention-policies) | Supports retention outcomes, scopes, and precedence concerns. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [NIST — Privacy Framework](https://www.nist.gov/privacy-framework) | Supports privacy risk governance and lifecycle accountability. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports topology transformation without two-dimensional page scrolling. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "retention-disposition-policy-planner",
  "matchedSituationCodes": [
    "AR-RDP-01",
    "AR-RDP-02",
    "AR-RDP-03"
  ],
  "aliases": [
    "retention-disposition-policy-planner",
    "retention policy planner",
    "disposition rule simulation",
    "records lifecycle policy"
  ],
  "dominantTask": "Define lifecycle triggers, retention periods, holds, precedence, and irreversible disposition, then simulate impact before publishing and locking policy.",
  "regions": [
    "retention-policy-planner",
    "scope-record-class-tree",
    "lifecycle-timeline",
    "trigger-retention-disposition-editor",
    "holds-exceptions-precedence",
    "impact-simulation",
    "publish-lock-receipt"
  ],
  "relationships": [
    "Temporal rules and hold precedence govern simulated outcomes; this planner never executes disposition on record cohorts."
  ],
  "responsive": {
    "wide": "Keep record-class scope, lifecycle timeline, rule editor, precedence evidence, and impact simulation simultaneously visible.",
    "intermediate": "Move the class tree to a drawer; keep lifecycle and selected precedence primary.",
    "compact": "Stage record class, trigger, duration and hold, disposition, simulated outcome, then the explicit publish-and-lock ceremony.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "retention-policy-planner → scope-record-class-tree → lifecycle-timeline → trigger-retention-disposition-editor → holds-exceptions-precedence → impact-simulation → publish-lock-receipt",
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
    "class loading; trigger absent/valid; duration invalid; hold active/conflicting; precedence unresolved; simulation running/impact; policy draft/reviewed/locked; publish failure; superseded version"
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

