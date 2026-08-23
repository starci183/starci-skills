# Asynchronous outcome tracker

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `asynchronous-outcome-tracker` |
| Family | `flow` |
| Dominant task | Track one submitted case across long-running milestones, expected updates, information requests, and stalled-progress recovery. |
| Search aliases | `case outcome tracker`, `long-running submission status`, `milestone request tracker` |
| Authority | Product-neutral macro topology and behavior contract. |

### Invariants

- The archetype owns only the dominant task, required regions, region relationships, responsive transformations, interaction parity, and state families.
- Grammar owns product nouns, semantic owners, domain rules, and state transitions.
- Principles own exact geometry, measure, gap, alignment, overflow values, and responsive thresholds.
- Direction owns visual character; the template is only one neutral conforming realization.
- Reading order, DOM order, and focus order retain one semantic sequence across every topology.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AOT-01` | Track one submitted case across long-running milestones, expected updates, information requests, and stalled-progress recovery. | required positive |
| `AOT-02` | All required regions and their named ownership relationships are necessary for the task. | required positive |
| `AOT-03` | Wide adjacency fails while intermediate and compact transformations preserve task, state, and recovery. | conditional positive |
| `AOT-90` | Reject terminal receipts or user-controlled gated records. | reject |
| `AOT-91` | Reject parallel-shipment orders, support conversations, or dashboards of many cases. | reject |

### Selection rule

- Return `accept` only when `AOT-01` and `AOT-02` are evidenced and no 90–99 code is present.
- Return `reject` when `AOT-90` or `AOT-91` is evidenced, or an adjacent archetype owns the dominant task.
- Return `needs-evidence` when the task, required region, relationship, or responsive failure trigger remains unresolved.

## Region graph

```text
outcome-tracker
├─ submission-identity-and-owner
├─ current-milestone-and-expectation
├─ ordered-milestone-history
├─ outstanding-information-requests
├─ submitted-record-and-messages
└─ escalation-or-recovery
```

- **Shared relationship:** The external process owns milestone advancement; outstanding requests precede routine chronology; expectations, messages, and escalation remain attached to the same submission identity.
- `outcome-tracker -> submission-identity-and-owner`: `submission-identity-and-owner` consumes the named context or revision from `outcome-tracker` and exposes an explicit return or reconciliation path.
- `submission-identity-and-owner -> current-milestone-and-expectation`: `current-milestone-and-expectation` consumes the named context or revision from `submission-identity-and-owner` and exposes an explicit return or reconciliation path.
- `current-milestone-and-expectation -> ordered-milestone-history`: `ordered-milestone-history` consumes the named context or revision from `current-milestone-and-expectation` and exposes an explicit return or reconciliation path.
- `ordered-milestone-history -> outstanding-information-requests`: `outstanding-information-requests` consumes the named context or revision from `ordered-milestone-history` and exposes an explicit return or reconciliation path.
- `outstanding-information-requests -> submitted-record-and-messages`: `submitted-record-and-messages` consumes the named context or revision from `outstanding-information-requests` and exposes an explicit return or reconciliation path.
- `submitted-record-and-messages -> escalation-or-recovery`: `escalation-or-recovery` consumes the named context or revision from `submitted-record-and-messages` and exposes an explicit return or reconciliation path.

### Region obligations

| Region | Obligation |
|---|---|
| `outcome-tracker` | Owns the complete outcome tracker transaction boundary, shared revision, and recovery context; child regions cannot commit outside it. |
| `submission-identity-and-owner` | Owns the submission identity and owner orientation and immutable basis that qualifies every downstream decision. |
| `current-milestone-and-expectation` | Owns the derived current milestone and expectation state; it names its source revision and cannot contradict the input or evidence owners. |
| `ordered-milestone-history` | Owns the durable ordered milestone history evidence and its provenance; it does not silently mutate the current input owner. |
| `outstanding-information-requests` | Owns the outstanding information requests input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `submitted-record-and-messages` | Owns the durable submitted record and messages evidence and its provenance; it does not silently mutate the current input owner. |
| `escalation-or-recovery` | Owns the escalation or recovery recovery route and preserves the exact state, trigger, and return position. |

## Responsive contract

### Wide

- **Failure trigger:** A required region can no longer remain simultaneous without squeezing, truncating, or separating context from action.
- **Topology response:** Current milestone and expectation are primary while unresolved requests precede routine history and supporting record detail.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer persist while retaining readable measure and action order.
- **Topology response:** Supporting regions reflow while current milestone, expected date, and outstanding request remain visible together.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Compact

- **Failure trigger:** Adjacency or multiple primary panes no longer work under zoom, localization, text growth, or short height.
- **Topology response:** Current expectation, outstanding action, milestone history, submitted record, and escalation appear in priority order.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Reflow

- Semantic and DOM order is `outcome-tracker` → `submission-identity-and-owner` → `current-milestone-and-expectation` → `ordered-milestone-history` → `outstanding-information-requests` → `submitted-record-and-messages` → `escalation-or-recovery`.
- CSS does not reorder regions or the focus sequence at a topology transition.
- Compact navigation replaces adjacency with a named primary pane and restores the exact trigger, state, and scroll context.

### Interaction parity

- Wide, intermediate, and compact retain the same actions, state meanings, recovery paths, and consequence.
- Dynamic status is announced without moving focus automatically.
- Error recovery moves focus to a summary or repairable field and then returns to the meaningful continuation.

## State obligations

| State | Required behavior | Responsive presentation |
|---|---|---|
| `submitted` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `received` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `reviewing` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `waiting` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `external decision` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `completed` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `delayed` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `no update` | Distinguish a valid absence from missing required input and expose the next available start path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `information requested` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `responding` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `response accepted` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `response rejected` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `owner changed` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `timeline partial` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `escalation pending` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `stale status` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |

## Boundaries

### Accept

- Use when external progression advances one submitted record and the person may respond but cannot advance milestones directly.
- Required regions must share one transaction state model and one provable recovery path.

### Reject

- Reject terminal receipts or user-controlled gated records.
- Reject parallel-shipment orders, support conversations, or dashboards of many cases.
- Reject when the difference is only a product noun, card count, density, color, component, or state variation.

### Boundary verdict

- Default `needs-evidence`; `accept` is valid only under the executable selection rule above.

## Handoff

- **Grammar:** Supplies product actors, nouns, semantic owners, domain rules, eligibility, transitions, and consequences.
- **Principles:** Resolve exact grid, measure, gap, size, alignment, overflow, sticky offsets, and content-driven thresholds.
- **Direction:** Resolve visual character without changing topology or ownership.

## Non-binding research evidence

### Evidence boundary

The sources below are advisory comparison evidence. They are not product truth, do not select a Grammar owner, do not authorize copied geometry or component trees, and do not override Source authority.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [USCIS Developer Portal — Case Status API](https://developer.uscis.gov/api/case-status) | A submitted case can expose externally advanced status updates. | It does not define milestones, guarantees, or escalation rights for another product. |
| [USCIS — Case Status Online](https://egov.uscis.gov/?localeLang=en) | A submitted case exposes external status, processing expectations, and a separate inquiry path when progress stalls. | It does not guarantee dates or define another product’s milestones. |
| [U.S. Web Design System — Process list](https://designsystem.digital.gov/components/process-list/) | A sequence can expose ordered stages and explanatory state. | It does not prove that a process is user-controlled. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic results can be announced without moving focus. | It does not define transaction states or timing. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Logical focus follows relationships and preserves operability. | It does not select this archetype or define product facts. |

## Output

Return one resolved record with exactly these runtime fields:

```json
{
  "archetypeId": "asynchronous-outcome-tracker",
  "situationCodes": [
    "AOT-01",
    "AOT-02",
    "AOT-03"
  ],
  "searchAliases": [
    "case outcome tracker",
    "long-running submission status",
    "milestone request tracker"
  ],
  "dominantTask": "Track one submitted case across long-running milestones, expected updates, information requests, and stalled-progress recovery.",
  "regions": [
    "outcome-tracker",
    "submission-identity-and-owner",
    "current-milestone-and-expectation",
    "ordered-milestone-history",
    "outstanding-information-requests",
    "submitted-record-and-messages",
    "escalation-or-recovery"
  ],
  "regionRelationships": [
    "outcome-tracker -> submission-identity-and-owner",
    "submission-identity-and-owner -> current-milestone-and-expectation",
    "current-milestone-and-expectation -> ordered-milestone-history",
    "ordered-milestone-history -> outstanding-information-requests",
    "outstanding-information-requests -> submitted-record-and-messages",
    "submitted-record-and-messages -> escalation-or-recovery"
  ],
  "responsive": {
    "wide": "Current milestone and expectation are primary while unresolved requests precede routine history and supporting record detail.",
    "intermediate": "Supporting regions reflow while current milestone, expected date, and outstanding request remain visible together.",
    "compact": "Current expectation, outstanding action, milestone history, submitted record, and escalation appear in priority order.",
    "reflow": "Preserve one semantic DOM order and transform topology when a named relationship fails.",
    "readingOrder": "outcome-tracker -> submission-identity-and-owner -> current-milestone-and-expectation -> ordered-milestone-history -> outstanding-information-requests -> submitted-record-and-messages -> escalation-or-recovery",
    "navigationReplacement": "Replace lost adjacency with named in-flow or pane navigation to the same regions.",
    "stickyBehavior": "Persistence yields before it can obscure content, focus, validation, or short-height operation.",
    "overflowOwner": "The page owns vertical overflow unless the archetype names one bounded two-dimensional task region.",
    "interactionParity": "Preserve every action, state, recovery path, and focus return across topology changes."
  },
  "stateObligations": [
    "submitted",
    "received",
    "reviewing",
    "waiting",
    "external decision",
    "completed",
    "delayed",
    "no update",
    "information requested",
    "responding",
    "response accepted",
    "response rejected",
    "owner changed",
    "timeline partial",
    "escalation pending",
    "stale status"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product actors and nouns",
    "semantic owners",
    "domain rules and transitions"
  ],
  "principlesHandoff": [
    "exact geometry and thresholds",
    "measure and spacing",
    "sticky offsets and overflow values"
  ],
  "confidence": "high",
  "evidence": [
    "dominant-task",
    "region-relationship",
    "responsive-failure",
    "state-family",
    "official-research"
  ]
}
```

Do not return a class, token, component, source path, fixed breakpoint, or invented product fact.
