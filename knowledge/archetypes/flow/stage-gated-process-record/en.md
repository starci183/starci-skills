# Stage-gated process record

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `stage-gated-process-record` |
| Family | `flow` |
| Dominant task | Understand and advance one record through formal stages with gates, evidence, approvers, and transition rules. |
| Search aliases | `formal gated record`, `approval stage process`, `evidence-gated workflow` |
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
| `SGP-01` | Understand and advance one record through formal stages with gates, evidence, approvers, and transition rules. | required positive |
| `SGP-02` | All required regions and their named ownership relationships are necessary for the task. | required positive |
| `SGP-03` | Wide adjacency fails while intermediate and compact transformations preserve task, state, and recovery. | conditional positive |
| `SGP-90` | Reject simple form progress or guided setup. | reject |
| `SGP-91` | Reject retrospective timelines, pre-submit composition, or centered tasks. | reject |

### Selection rule

- Return `accept` only when `SGP-01` and `SGP-02` are evidenced and no 90–99 code is present.
- Return `reject` when `SGP-90` or `SGP-91` is evidenced, or an adjacent archetype owns the dominant task.
- Return `needs-evidence` when the task, required region, relationship, or responsive failure trigger remains unresolved.

## Region graph

```text
gated-record
├─ process-identity-and-status
├─ stage-sequence
├─ current-gate-requirements
├─ evidence-and-approvals
├─ transition-actions
└─ history-and-exceptions
```

- **Shared relationship:** The current gate owns transition authority; evidence and approvals satisfy named requirements; transitions append immutable history and never rewrite prior evidence.
- `gated-record -> process-identity-and-status`: `process-identity-and-status` consumes the named context or revision from `gated-record` and exposes an explicit return or reconciliation path.
- `process-identity-and-status -> stage-sequence`: `stage-sequence` consumes the named context or revision from `process-identity-and-status` and exposes an explicit return or reconciliation path.
- `stage-sequence -> current-gate-requirements`: `current-gate-requirements` consumes the named context or revision from `stage-sequence` and exposes an explicit return or reconciliation path.
- `current-gate-requirements -> evidence-and-approvals`: `evidence-and-approvals` consumes the named context or revision from `current-gate-requirements` and exposes an explicit return or reconciliation path.
- `evidence-and-approvals -> transition-actions`: `transition-actions` consumes the named context or revision from `evidence-and-approvals` and exposes an explicit return or reconciliation path.
- `transition-actions -> history-and-exceptions`: `history-and-exceptions` consumes the named context or revision from `transition-actions` and exposes an explicit return or reconciliation path.

### Region obligations

| Region | Obligation |
|---|---|
| `gated-record` | Owns the complete gated record transaction boundary, shared revision, and recovery context; child regions cannot commit outside it. |
| `process-identity-and-status` | Owns the derived process identity and status state; it names its source revision and cannot contradict the input or evidence owners. |
| `stage-sequence` | Owns the stage sequence input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `current-gate-requirements` | Owns the current gate requirements input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `evidence-and-approvals` | Owns the durable evidence and approvals evidence and its provenance; it does not silently mutate the current input owner. |
| `transition-actions` | Owns the transition actions input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `history-and-exceptions` | Owns the durable history and exceptions evidence and its provenance; it does not silently mutate the current input owner. |

## Responsive contract

### Wide

- **Failure trigger:** A required region can no longer remain simultaneous without squeezing, truncating, or separating context from action.
- **Topology response:** Stage sequence and current gate detail remain simultaneous while history stays subordinate to current authority.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer persist while retaining readable measure and action order.
- **Topology response:** The stage sequence becomes a horizontal-free summary while current gate requirements retain primary width.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Compact

- **Failure trigger:** Adjacency or multiple primary panes no longer work under zoom, localization, text growth, or short height.
- **Topology response:** Current stage and gate own the page; all stages and history become named secondary screens after evidence.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Reflow

- Semantic and DOM order is `gated-record` → `process-identity-and-status` → `stage-sequence` → `current-gate-requirements` → `evidence-and-approvals` → `transition-actions` → `history-and-exceptions`.
- CSS does not reorder regions or the focus sequence at a topology transition.
- Compact navigation replaces adjacency with a named primary pane and restores the exact trigger, state, and scroll context.

### Interaction parity

- Wide, intermediate, and compact retain the same actions, state meanings, recovery paths, and consequence.
- Dynamic status is announced without moving focus automatically.
- Error recovery moves focus to a summary or repairable field and then returns to the meaningful continuation.

## State obligations

| State | Required behavior | Responsive presentation |
|---|---|---|
| `future locked` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `current` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `complete` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `failed` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `waived` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `evidence missing` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `evidence stale` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `approval pending` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `approved` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `rejected` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `transition pending` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `transition conflict` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `permission unavailable` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `exception request` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `history updated` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |

## Boundaries

### Accept

- Use when a current gate formally owns transition authority for one record.
- Required regions must share one transaction state model and one provable recovery path.

### Reject

- Reject simple form progress or guided setup.
- Reject retrospective timelines, pre-submit composition, or centered tasks.
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
| [U.S. Web Design System — Step indicator](https://designsystem.digital.gov/components/step-indicator/) | Step context can orient a person without becoming arbitrary navigation. | It does not define process authority or responsive geometry. |
| [Salesforce Lightning — Component reference](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/) | Record statuses, approvals, and activity can remain separately identified. | It does not define a process gate or handoff contract. |
| [W3C WAI — Error Prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html) | Consequential submissions support review, correction, and confirmation. | It does not define the domain consequence or approval rule. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic results can be announced without moving focus. | It does not define transaction states or timing. |

## Output

Return one resolved record with exactly these runtime fields:

```json
{
  "archetypeId": "stage-gated-process-record",
  "situationCodes": [
    "SGP-01",
    "SGP-02",
    "SGP-03"
  ],
  "searchAliases": [
    "formal gated record",
    "approval stage process",
    "evidence-gated workflow"
  ],
  "dominantTask": "Understand and advance one record through formal stages with gates, evidence, approvers, and transition rules.",
  "regions": [
    "gated-record",
    "process-identity-and-status",
    "stage-sequence",
    "current-gate-requirements",
    "evidence-and-approvals",
    "transition-actions",
    "history-and-exceptions"
  ],
  "regionRelationships": [
    "gated-record -> process-identity-and-status",
    "process-identity-and-status -> stage-sequence",
    "stage-sequence -> current-gate-requirements",
    "current-gate-requirements -> evidence-and-approvals",
    "evidence-and-approvals -> transition-actions",
    "transition-actions -> history-and-exceptions"
  ],
  "responsive": {
    "wide": "Stage sequence and current gate detail remain simultaneous while history stays subordinate to current authority.",
    "intermediate": "The stage sequence becomes a horizontal-free summary while current gate requirements retain primary width.",
    "compact": "Current stage and gate own the page; all stages and history become named secondary screens after evidence.",
    "reflow": "Preserve one semantic DOM order and transform topology when a named relationship fails.",
    "readingOrder": "gated-record -> process-identity-and-status -> stage-sequence -> current-gate-requirements -> evidence-and-approvals -> transition-actions -> history-and-exceptions",
    "navigationReplacement": "Replace lost adjacency with named in-flow or pane navigation to the same regions.",
    "stickyBehavior": "Persistence yields before it can obscure content, focus, validation, or short-height operation.",
    "overflowOwner": "The page owns vertical overflow unless the archetype names one bounded two-dimensional task region.",
    "interactionParity": "Preserve every action, state, recovery path, and focus return across topology changes."
  },
  "stateObligations": [
    "future locked",
    "current",
    "complete",
    "failed",
    "waived",
    "evidence missing",
    "evidence stale",
    "approval pending",
    "approved",
    "rejected",
    "transition pending",
    "transition conflict",
    "permission unavailable",
    "exception request",
    "history updated"
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
