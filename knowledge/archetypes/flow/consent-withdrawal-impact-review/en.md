# Consent withdrawal impact review

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | consent-withdrawal-impact-review |
| Family | flow |
| Dominant task | Withdraw one or more grants after understanding affected purposes, recipients, services, unavoidable retention, and propagation timing. |
| Search aliases | consent-withdrawal-impact-review; consent withdrawal; grant impact review; revocation propagation |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Withdraw one or more grants after understanding affected purposes, recipients, services, unavoidable retention, and propagation timing.
- Each required region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-CWI-01 | Withdraw one or more grants after understanding affected purposes, recipients, services, unavoidable retention, and propagation timing. | required positive evidence |
| AR-CWI-02 | The critical region relationship and owner separation are evidenced. | required relationship evidence |
| AR-CWI-03 | The wide relationship fails, but compact preserves task, state, and recovery. | responsive transformation trigger |
| AR-CWI-04 | Error, permission, pending, success, and stale or conflict states have bounded recovery. | required state evidence |
| AR-CWI-90 | Reject configuration dependency resolution, consent signatures, preference centers, and account exit. | reject |
| AR-CWI-91 | The difference is only a product noun, density, color, component, state skin, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-CWI-01, AR-CWI-02, and AR-CWI-03 are evidenced, neither AR-CWI-90 nor AR-CWI-91 is present, and every required region remains necessary across all three topologies. Return needs-evidence when an owner, relation, or transformation is unresolved.

## Region graph

~~~text
withdrawal-review
├─ existing-grant-version
├─ purpose-data-recipient-dependency-map
├─ service-consequences
├─ selectable-withdrawal-boundary
├─ retained-basis-timing
└─ confirm-propagation-receipts
~~~

Critical relationship: Withdrawal scope and lawful retained basis remain distinct; propagation receipts never imply immediate deletion where another basis retains data.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| withdrawal-review | Owns the dominant-task boundary and contains every required region without inventing product semantics. | Contains existing-grant-version, purpose-data-recipient-dependency-map, service-consequences, selectable-withdrawal-boundary, retained-basis-timing, confirm-propagation-receipts while preserving each region's independent owner. |
| existing-grant-version | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from withdrawal-review and gates purpose-data-recipient-dependency-map without merging authority. |
| purpose-data-recipient-dependency-map | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from existing-grant-version and gates service-consequences without merging authority. |
| service-consequences | Owns a derived interpretation or consequence preview; it never becomes a second input authority. | Receives context from purpose-data-recipient-dependency-map and gates selectable-withdrawal-boundary without merging authority. |
| selectable-withdrawal-boundary | Owns editable decision state, validation, and the pending guard for the named stage. | Receives context from service-consequences and gates retained-basis-timing without merging authority. |
| retained-basis-timing | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from selectable-withdrawal-boundary and gates confirm-propagation-receipts without merging authority. |
| confirm-propagation-receipts | Owns the bounded outcome, receipt, or recovery route after every upstream gate passes. | Consumes verified state from retained-basis-timing and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Topology response: Keep dependency map, service and recipient consequences, selectable scope, retained basis, and propagation timing simultaneously visible.
- Failure trigger: simultaneous regions narrow readable measure, obscure state, or break the named relationship.
- Navigation replacement: none while regions remain simultaneous; sticky is limited to orientation context that fits.
- Sticky boundary: yield at short height and never obscure a focused control.
- Overflow owner: the page owns vertical overflow; only an intrinsic matrix owns bounded horizontal overflow.

### Intermediate

- Topology response: Make the impact path primary while the existing grant version persists.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- Navigation replacement: a named trigger opens the supporting dialog; Escape or Cancel closes it and focus returns to the exact trigger.
- Sticky boundary: persistent context yields at short height; the dialog body owns bounded vertical overflow.
- Overflow owner: the page retains vertical overflow; the supporting dialog owns only its internal overflow.

### Compact

- Topology response: Stage grant version, affected recipients and services, withdrawal scope, retained basis and timing, confirmation, then propagation receipts.
- Failure trigger: the multi-pane relationship is no longer operable with 16px body text and 44px targets.
- Navigation replacement: Previous, Next, and a stage selector replace pane adjacency; Back preserves selection, draft, and recovery state.
- Sticky boundary: no fixed action bar; focused content remains visible.
- Overflow owner: no page-level horizontal scrolling; an intrinsic matrix becomes grouped records.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder semantics. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. State survives movement into and out of the supporting pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale or conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A modal contains focus, supports Escape or Cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: grant active/partial/expired; dependency loading; recipient unknown; service consequence unavailable; scope selected; retained basis required; withdrawal pending/failure/success; propagation incomplete.

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
| domain states | Preserve the complete domain catalog: grant active/partial/expired; dependency loading; recipient unknown; service consequence unavailable; scope selected; retained basis required; withdrawal pending/failure/success; propagation incomplete. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, the critical relationship creates a distinct topology, and every responsive state preserves task and recovery parity.

### Reject

Reject configuration dependency resolution, consent signatures, preference centers, and account exit. Also reject duplicate-or-variation when the candidate only changes nouns, density, components, or visual state.

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
| [ICO — Obtain, record, and manage consent](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/how-should-we-obtain-record-and-manage-consent/) | Supports easy withdrawal, stopping consent-based processing, and separate retention bases. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [IETF — RFC 9396 Rich Authorization Requests](https://datatracker.ietf.org/doc/html/rfc9396) | Supports explicit resource, action, and authorization-detail boundaries. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports non-disruptive propagation and recovery announcements. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "consent-withdrawal-impact-review",
  "matchedSituationCodes": [
    "AR-CWI-01",
    "AR-CWI-02",
    "AR-CWI-03"
  ],
  "aliases": [
    "consent-withdrawal-impact-review",
    "consent withdrawal",
    "grant impact review",
    "revocation propagation"
  ],
  "dominantTask": "Withdraw one or more grants after understanding affected purposes, recipients, services, unavoidable retention, and propagation timing.",
  "regions": [
    "withdrawal-review",
    "existing-grant-version",
    "purpose-data-recipient-dependency-map",
    "service-consequences",
    "selectable-withdrawal-boundary",
    "retained-basis-timing",
    "confirm-propagation-receipts"
  ],
  "relationships": [
    "Withdrawal scope and lawful retained basis remain distinct; propagation receipts never imply immediate deletion where another basis retains data."
  ],
  "responsive": {
    "wide": "Keep dependency map, service and recipient consequences, selectable scope, retained basis, and propagation timing simultaneously visible.",
    "intermediate": "Make the impact path primary while the existing grant version persists.",
    "compact": "Stage grant version, affected recipients and services, withdrawal scope, retained basis and timing, confirmation, then propagation receipts.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "withdrawal-review → existing-grant-version → purpose-data-recipient-dependency-map → service-consequences → selectable-withdrawal-boundary → retained-basis-timing → confirm-propagation-receipts",
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
    "grant active/partial/expired; dependency loading; recipient unknown; service consequence unavailable; scope selected; retained basis required; withdrawal pending/failure/success; propagation incomplete"
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

