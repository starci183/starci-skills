# Calculation estimate flow

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `calculation-estimate-flow` |
| Family | `flow` |
| Dominant task | Provide inputs and assumptions, understand a derived breakdown, and review or accept an estimate with explicit uncertainty and limitations. |
| Search aliases | `estimate calculator`, `assumption-driven estimate`, `calculation review flow` |
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
| `CEF-01` | Provide inputs and assumptions, understand a derived breakdown, and review or accept an estimate with explicit uncertainty and limitations. | required positive |
| `CEF-02` | All required regions and their named ownership relationships are necessary for the task. | required positive |
| `CEF-03` | Wide adjacency fails while intermediate and compact transformations preserve task, state, and recovery. | conditional positive |
| `CEF-90` | Reject a full scenario modeler or generic sectioned form. | reject |
| `CEF-91` | Reject a plan purchase, static price card, or one-number centered calculator. | reject |

### Selection rule

- Return `accept` only when `CEF-01` and `CEF-02` are evidenced and no 90–99 code is present.
- Return `reject` when `CEF-90` or `CEF-91` is evidenced, or an adjacent archetype owns the dominant task.
- Return `needs-evidence` when the task, required region, relationship, or responsive failure trigger remains unresolved.

## Region graph

```text
estimate-flow
├─ estimate-purpose-and-basis
├─ input-and-assumption-groups
├─ live-calculation-summary
├─ itemized-breakdown
├─ uncertainty-and-limitations
└─ review-adjust-or-accept
```

- **Shared relationship:** Inputs and assumptions are the calculation basis; the live summary and itemized breakdown derive from the same revision; limitations qualify those values; acceptance commits only that reviewed revision.
- `estimate-flow -> estimate-purpose-and-basis`: `estimate-purpose-and-basis` consumes the named context or revision from `estimate-flow` and exposes an explicit return or reconciliation path.
- `estimate-purpose-and-basis -> input-and-assumption-groups`: `input-and-assumption-groups` consumes the named context or revision from `estimate-purpose-and-basis` and exposes an explicit return or reconciliation path.
- `input-and-assumption-groups -> live-calculation-summary`: `live-calculation-summary` consumes the named context or revision from `input-and-assumption-groups` and exposes an explicit return or reconciliation path.
- `live-calculation-summary -> itemized-breakdown`: `itemized-breakdown` consumes the named context or revision from `live-calculation-summary` and exposes an explicit return or reconciliation path.
- `itemized-breakdown -> uncertainty-and-limitations`: `uncertainty-and-limitations` consumes the named context or revision from `itemized-breakdown` and exposes an explicit return or reconciliation path.
- `uncertainty-and-limitations -> review-adjust-or-accept`: `review-adjust-or-accept` consumes the named context or revision from `uncertainty-and-limitations` and exposes an explicit return or reconciliation path.

### Region obligations

| Region | Obligation |
|---|---|
| `estimate-flow` | Owns the complete estimate flow transaction boundary, shared revision, and recovery context; child regions cannot commit outside it. |
| `estimate-purpose-and-basis` | Owns the estimate purpose and basis orientation and immutable basis that qualifies every downstream decision. |
| `input-and-assumption-groups` | Owns the input and assumption groups input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `live-calculation-summary` | Owns the derived live calculation summary state; it names its source revision and cannot contradict the input or evidence owners. |
| `itemized-breakdown` | Owns the derived itemized breakdown state; it names its source revision and cannot contradict the input or evidence owners. |
| `uncertainty-and-limitations` | Owns the uncertainty and limitations input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `review-adjust-or-accept` | Owns the review adjust or accept commitment boundary and prevents duplicate or stale commitment; it consumes the reviewed shared revision. |

## Responsive contract

### Wide

- **Failure trigger:** A required region can no longer remain simultaneous without squeezing, truncating, or separating context from action.
- **Topology response:** Inputs and the live result remain simultaneous while each limitation stays adjacent to the value it qualifies.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer persist while retaining readable measure and action order.
- **Topology response:** The result summary remains near inputs while detailed breakdown moves into an in-flow disclosure.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Compact

- **Failure trigger:** Adjacency or multiple primary panes no longer work under zoom, localization, text growth, or short height.
- **Topology response:** The task becomes input, calculate, result, breakdown, assumptions, and accept; Edit returns to the exact field.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Reflow

- Semantic and DOM order is `estimate-flow` → `estimate-purpose-and-basis` → `input-and-assumption-groups` → `live-calculation-summary` → `itemized-breakdown` → `uncertainty-and-limitations` → `review-adjust-or-accept`.
- CSS does not reorder regions or the focus sequence at a topology transition.
- Compact navigation replaces adjacency with a named primary pane and restores the exact trigger, state, and scroll context.

### Interaction parity

- Wide, intermediate, and compact retain the same actions, state meanings, recovery paths, and consequence.
- Dynamic status is announced without moving focus automatically.
- Error recovery moves focus to a summary or repairable field and then returns to the meaningful continuation.

## State obligations

| State | Required behavior | Responsive presentation |
|---|---|---|
| `initial/no estimate` | Distinguish a valid absence from missing required input and expose the next available start path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `calculating` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `ready` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `invalid/incomplete input` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `source rate stale` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `uncertainty unavailable` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `assumption edited` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `estimate expired` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `accept pending` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `accept conflict` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |

## Boundaries

### Accept

- Use when a multi-input derivation and its basis must be reviewed before acceptance.
- Required regions must share one transaction state model and one provable recovery path.

### Reject

- Reject a full scenario modeler or generic sectioned form.
- Reject a plan purchase, static price card, or one-number centered calculator.
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
| [Internal Revenue Service — Tax Withholding Estimator FAQs](https://www.irs.gov/individuals/tax-withholding-estimator-faqs) | An estimate exposes input sensitivity, calculation basis, and limitations. | It does not define a reusable visual layout or non-tax calculation. |
| [U.S. Web Design System — Complete a complex form](https://designsystem.digital.gov/patterns/complete-a-complex-form/) | Long transactions preserve progress, review, and recovery. | It does not define a product workflow or fixed step count. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic results can be announced without moving focus. | It does not define transaction states or timing. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Logical focus follows relationships and preserves operability. | It does not select this archetype or define product facts. |

## Output

Return one resolved record with exactly these runtime fields:

```json
{
  "archetypeId": "calculation-estimate-flow",
  "situationCodes": [
    "CEF-01",
    "CEF-02",
    "CEF-03"
  ],
  "searchAliases": [
    "estimate calculator",
    "assumption-driven estimate",
    "calculation review flow"
  ],
  "dominantTask": "Provide inputs and assumptions, understand a derived breakdown, and review or accept an estimate with explicit uncertainty and limitations.",
  "regions": [
    "estimate-flow",
    "estimate-purpose-and-basis",
    "input-and-assumption-groups",
    "live-calculation-summary",
    "itemized-breakdown",
    "uncertainty-and-limitations",
    "review-adjust-or-accept"
  ],
  "regionRelationships": [
    "estimate-flow -> estimate-purpose-and-basis",
    "estimate-purpose-and-basis -> input-and-assumption-groups",
    "input-and-assumption-groups -> live-calculation-summary",
    "live-calculation-summary -> itemized-breakdown",
    "itemized-breakdown -> uncertainty-and-limitations",
    "uncertainty-and-limitations -> review-adjust-or-accept"
  ],
  "responsive": {
    "wide": "Inputs and the live result remain simultaneous while each limitation stays adjacent to the value it qualifies.",
    "intermediate": "The result summary remains near inputs while detailed breakdown moves into an in-flow disclosure.",
    "compact": "The task becomes input, calculate, result, breakdown, assumptions, and accept; Edit returns to the exact field.",
    "reflow": "Preserve one semantic DOM order and transform topology when a named relationship fails.",
    "readingOrder": "estimate-flow -> estimate-purpose-and-basis -> input-and-assumption-groups -> live-calculation-summary -> itemized-breakdown -> uncertainty-and-limitations -> review-adjust-or-accept",
    "navigationReplacement": "Replace lost adjacency with named in-flow or pane navigation to the same regions.",
    "stickyBehavior": "Persistence yields before it can obscure content, focus, validation, or short-height operation.",
    "overflowOwner": "The page owns vertical overflow unless the archetype names one bounded two-dimensional task region.",
    "interactionParity": "Preserve every action, state, recovery path, and focus return across topology changes."
  },
  "stateObligations": [
    "initial/no estimate",
    "calculating",
    "ready",
    "invalid/incomplete input",
    "source rate stale",
    "uncertainty unavailable",
    "assumption edited",
    "estimate expired",
    "accept pending",
    "accept conflict"
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
