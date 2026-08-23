# Data export delivery flow

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `data-export-delivery-flow` |
| Family | `flow` |
| Dominant task | Choose data scope, fields, format, privacy boundary, and delivery before generating and receiving a potentially long-running export. |
| Search aliases | `export configuration flow`, `archive delivery`, `privacy-aware data export` |
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
| `EDF-01` | Choose data scope, fields, format, privacy boundary, and delivery before generating and receiving a potentially long-running export. | required positive |
| `EDF-02` | All required regions and their named ownership relationships are necessary for the task. | required positive |
| `EDF-03` | Wide adjacency fails while intermediate and compact transformations preserve task, state, and recovery. | conditional positive |
| `EDF-90` | Reject import mapping or a simple file download. | reject |
| `EDF-91` | Reject report tables, upload managers, or a background job detail after handoff. | reject |

### Selection rule

- Return `accept` only when `EDF-01` and `EDF-02` are evidenced and no 90–99 code is present.
- Return `reject` when `EDF-90` or `EDF-91` is evidenced, or an adjacent archetype owns the dominant task.
- Return `needs-evidence` when the task, required region, relationship, or responsive failure trigger remains unresolved.

## Region graph

```text
export-flow
├─ source-and-scope-context
├─ field-and-format-options
├─ record-count-and-size-preview
├─ privacy-redaction-warning
├─ delivery-destination
├─ generate-action
└─ export-progress-and-delivery
```

- **Shared relationship:** Count, size, and privacy consequences derive from scope, fields, and format; delivery follows that review; generation progress survives after the configuration stage ends.
- `export-flow -> source-and-scope-context`: `source-and-scope-context` consumes the named context or revision from `export-flow` and exposes an explicit return or reconciliation path.
- `source-and-scope-context -> field-and-format-options`: `field-and-format-options` consumes the named context or revision from `source-and-scope-context` and exposes an explicit return or reconciliation path.
- `field-and-format-options -> record-count-and-size-preview`: `record-count-and-size-preview` consumes the named context or revision from `field-and-format-options` and exposes an explicit return or reconciliation path.
- `record-count-and-size-preview -> privacy-redaction-warning`: `privacy-redaction-warning` consumes the named context or revision from `record-count-and-size-preview` and exposes an explicit return or reconciliation path.
- `privacy-redaction-warning -> delivery-destination`: `delivery-destination` consumes the named context or revision from `privacy-redaction-warning` and exposes an explicit return or reconciliation path.
- `delivery-destination -> generate-action`: `generate-action` consumes the named context or revision from `delivery-destination` and exposes an explicit return or reconciliation path.
- `generate-action -> export-progress-and-delivery`: `export-progress-and-delivery` consumes the named context or revision from `generate-action` and exposes an explicit return or reconciliation path.

### Region obligations

| Region | Obligation |
|---|---|
| `export-flow` | Owns the complete export flow transaction boundary, shared revision, and recovery context; child regions cannot commit outside it. |
| `source-and-scope-context` | Owns the source and scope context orientation and immutable basis that qualifies every downstream decision. |
| `field-and-format-options` | Owns the field and format options input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `record-count-and-size-preview` | Owns the derived record count and size preview state; it names its source revision and cannot contradict the input or evidence owners. |
| `privacy-redaction-warning` | Owns the privacy redaction warning input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `delivery-destination` | Owns the delivery destination input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `generate-action` | Owns the generate action commitment boundary and prevents duplicate or stale commitment; it consumes the reviewed shared revision. |
| `export-progress-and-delivery` | Owns the derived export progress and delivery state; it names its source revision and cannot contradict the input or evidence owners. |

## Responsive contract

### Wide

- **Failure trigger:** A required region can no longer remain simultaneous without squeezing, truncating, or separating context from action.
- **Topology response:** Configuration and live count, size, and privacy consequences remain simultaneous before delivery selection.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer persist while retaining readable measure and action order.
- **Topology response:** The consequence summary moves between configuration and Generate while fields remain meaningfully grouped.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Compact

- **Failure trigger:** Adjacency or multiple primary panes no longer work under zoom, localization, text growth, or short height.
- **Topology response:** The task becomes configure, review privacy and size, choose delivery, then a dedicated generation tracker.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Reflow

- Semantic and DOM order is `export-flow` → `source-and-scope-context` → `field-and-format-options` → `record-count-and-size-preview` → `privacy-redaction-warning` → `delivery-destination` → `generate-action` → `export-progress-and-delivery`.
- CSS does not reorder regions or the focus sequence at a topology transition.
- Compact navigation replaces adjacency with a named primary pane and restores the exact trigger, state, and scroll context.

### Interaction parity

- Wide, intermediate, and compact retain the same actions, state meanings, recovery paths, and consequence.
- Dynamic status is announced without moving focus automatically.
- Error recovery moves focus to a summary or repairable field and then returns to the meaningful continuation.

## State obligations

| State | Required behavior | Responsive presentation |
|---|---|---|
| `preview calculating` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `preview error` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `preview stale` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `zero records` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `restricted field` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `large export warning` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `destination invalid` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `queued` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `generating` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `ready` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `expired` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `failed` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `cancel/retry` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `permission unavailable` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |

## Boundaries

### Accept

- Use when scope and privacy materially change a long-running export and its delivery.
- Required regions must share one transaction state model and one provable recovery path.

### Reject

- Reject import mapping or a simple file download.
- Reject report tables, upload managers, or a background job detail after handoff.
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
| [Google Account Help — Download your data](https://support.google.com/accounts/answer/3024190?hl=en) | Export scope, format, delivery, delay, and archive expiry are distinct decisions and states. | It does not define another product’s export policy. |
| [U.S. Web Design System — Complete a complex form](https://designsystem.digital.gov/patterns/complete-a-complex-form/) | Long transactions preserve progress, review, and recovery. | It does not define a product workflow or fixed step count. |
| [Carbon Design System — Data table usage](https://carbondesignsystem.com/components/data-table/usage/) | Dense row-column relationships may own bounded horizontal overflow. | It does not make a small record collection a data table. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic results can be announced without moving focus. | It does not define transaction states or timing. |

## Output

Return one resolved record with exactly these runtime fields:

```json
{
  "archetypeId": "data-export-delivery-flow",
  "situationCodes": [
    "EDF-01",
    "EDF-02",
    "EDF-03"
  ],
  "searchAliases": [
    "export configuration flow",
    "archive delivery",
    "privacy-aware data export"
  ],
  "dominantTask": "Choose data scope, fields, format, privacy boundary, and delivery before generating and receiving a potentially long-running export.",
  "regions": [
    "export-flow",
    "source-and-scope-context",
    "field-and-format-options",
    "record-count-and-size-preview",
    "privacy-redaction-warning",
    "delivery-destination",
    "generate-action",
    "export-progress-and-delivery"
  ],
  "regionRelationships": [
    "export-flow -> source-and-scope-context",
    "source-and-scope-context -> field-and-format-options",
    "field-and-format-options -> record-count-and-size-preview",
    "record-count-and-size-preview -> privacy-redaction-warning",
    "privacy-redaction-warning -> delivery-destination",
    "delivery-destination -> generate-action",
    "generate-action -> export-progress-and-delivery"
  ],
  "responsive": {
    "wide": "Configuration and live count, size, and privacy consequences remain simultaneous before delivery selection.",
    "intermediate": "The consequence summary moves between configuration and Generate while fields remain meaningfully grouped.",
    "compact": "The task becomes configure, review privacy and size, choose delivery, then a dedicated generation tracker.",
    "reflow": "Preserve one semantic DOM order and transform topology when a named relationship fails.",
    "readingOrder": "export-flow -> source-and-scope-context -> field-and-format-options -> record-count-and-size-preview -> privacy-redaction-warning -> delivery-destination -> generate-action -> export-progress-and-delivery",
    "navigationReplacement": "Replace lost adjacency with named in-flow or pane navigation to the same regions.",
    "stickyBehavior": "Persistence yields before it can obscure content, focus, validation, or short-height operation.",
    "overflowOwner": "The page owns vertical overflow unless the archetype names one bounded two-dimensional task region.",
    "interactionParity": "Preserve every action, state, recovery path, and focus return across topology changes."
  },
  "stateObligations": [
    "preview calculating",
    "preview error",
    "preview stale",
    "zero records",
    "restricted field",
    "large export warning",
    "destination invalid",
    "queued",
    "generating",
    "ready",
    "expired",
    "failed",
    "cancel/retry",
    "permission unavailable"
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
