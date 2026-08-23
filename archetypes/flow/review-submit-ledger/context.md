# Review and submit ledger

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `review-submit-ledger` |
| Family | `flow` |
| Dominant task | Review all transaction data and consequences, change the owning source step, and perform one meaningful final submission. |
| Search aliases | `check answers ledger`, `pre-submit review`, `sectioned transaction review` |
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
| `RSL-01` | Review all transaction data and consequences, change the owning source step, and perform one meaningful final submission. | required positive |
| `RSL-02` | All required regions and their named ownership relationships are necessary for the task. | required positive |
| `RSL-03` | Wide adjacency fails while intermediate and compact transformations preserve task, state, and recovery. | conditional positive |
| `RSL-90` | Reject a post-submit receipt or repeated-item editing page. | reject |
| `RSL-91` | Reject simple confirmation, read-only detail, or centered tasks. | reject |

### Selection rule

- Return `accept` only when `RSL-01` and `RSL-02` are evidenced and no 90–99 code is present.
- Return `reject` when `RSL-90` or `RSL-91` is evidenced, or an adjacent archetype owns the dominant task.
- Return `needs-evidence` when the task, required region, relationship, or responsive failure trigger remains unresolved.

## Region graph

```text
review-submit
├─ transaction-context
├─ sectioned-answer-ledger
├─ contextual-change-paths
├─ consequence-and-declaration
└─ final-submit-actions
```

- **Shared relationship:** Each Change path remains attached to its answer owner and returns to the same ledger anchor; declaration and final submission follow the complete reviewed ledger.
- `review-submit -> transaction-context`: `transaction-context` consumes the named context or revision from `review-submit` and exposes an explicit return or reconciliation path.
- `transaction-context -> sectioned-answer-ledger`: `sectioned-answer-ledger` consumes the named context or revision from `transaction-context` and exposes an explicit return or reconciliation path.
- `sectioned-answer-ledger -> contextual-change-paths`: `contextual-change-paths` consumes the named context or revision from `sectioned-answer-ledger` and exposes an explicit return or reconciliation path.
- `contextual-change-paths -> consequence-and-declaration`: `consequence-and-declaration` consumes the named context or revision from `contextual-change-paths` and exposes an explicit return or reconciliation path.
- `consequence-and-declaration -> final-submit-actions`: `final-submit-actions` consumes the named context or revision from `consequence-and-declaration` and exposes an explicit return or reconciliation path.

### Region obligations

| Region | Obligation |
|---|---|
| `review-submit` | Owns the complete review submit transaction boundary, shared revision, and recovery context; child regions cannot commit outside it. |
| `transaction-context` | Owns the transaction context orientation and immutable basis that qualifies every downstream decision. |
| `sectioned-answer-ledger` | Owns the sectioned answer ledger input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `contextual-change-paths` | Owns the contextual change paths orientation and immutable basis that qualifies every downstream decision. |
| `consequence-and-declaration` | Owns the consequence and declaration input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `final-submit-actions` | Owns the final submit actions input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |

## Responsive contract

### Wide

- **Failure trigger:** A required region can no longer remain simultaneous without squeezing, truncating, or separating context from action.
- **Topology response:** The readable ledger keeps each Change action next to the value owner; dense totals may use full content width.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer persist while retaining readable measure and action order.
- **Topology response:** Rows reflow while key, value, and action remain one association; declaration follows the full review.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Compact

- **Failure trigger:** Adjacency or multiple primary panes no longer work under zoom, localization, text growth, or short height.
- **Topology response:** Every row becomes key, value, Change before consequence, declaration, and final submit in semantic order.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Reflow

- Semantic and DOM order is `review-submit` → `transaction-context` → `sectioned-answer-ledger` → `contextual-change-paths` → `consequence-and-declaration` → `final-submit-actions`.
- CSS does not reorder regions or the focus sequence at a topology transition.
- Compact navigation replaces adjacency with a named primary pane and restores the exact trigger, state, and scroll context.

### Interaction parity

- Wide, intermediate, and compact retain the same actions, state meanings, recovery paths, and consequence.
- Dynamic status is announced without moving focus automatically.
- Error recovery moves focus to a summary or repairable field and then returns to the meaningful continuation.

## State obligations

| State | Required behavior | Responsive presentation |
|---|---|---|
| `incomplete` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `not provided` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `changed answer` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `derived total recalculating` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `validation invalidated` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `declaration unchecked` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `stale` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `conflict` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `submit pending` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `duplicate prevented` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `success handoff` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |

## Boundaries

### Accept

- Use for a pre-submit authority view that returns changes to their source steps.
- Required regions must share one transaction state model and one provable recovery path.

### Reject

- Reject a post-submit receipt or repeated-item editing page.
- Reject simple confirmation, read-only detail, or centered tasks.
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
| [GOV.UK Design System — Check answers](https://design-system.service.gov.uk/patterns/check-answers/) | Review rows keep Change actions associated with their answers. | It does not define the submitted transaction or its consequence. |
| [NHS service manual — Check answers](https://service-manual.nhs.uk/design-system/patterns/check-answers) | Review preserves answer-to-change association before submission. | It does not define non-health product truth. |
| [W3C WAI — Error Prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html) | Consequential submissions support review, correction, and confirmation. | It does not define the domain consequence or approval rule. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Logical focus follows relationships and preserves operability. | It does not select this archetype or define product facts. |

## Output

Return one resolved record with exactly these runtime fields:

```json
{
  "archetypeId": "review-submit-ledger",
  "situationCodes": [
    "RSL-01",
    "RSL-02",
    "RSL-03"
  ],
  "searchAliases": [
    "check answers ledger",
    "pre-submit review",
    "sectioned transaction review"
  ],
  "dominantTask": "Review all transaction data and consequences, change the owning source step, and perform one meaningful final submission.",
  "regions": [
    "review-submit",
    "transaction-context",
    "sectioned-answer-ledger",
    "contextual-change-paths",
    "consequence-and-declaration",
    "final-submit-actions"
  ],
  "regionRelationships": [
    "review-submit -> transaction-context",
    "transaction-context -> sectioned-answer-ledger",
    "sectioned-answer-ledger -> contextual-change-paths",
    "contextual-change-paths -> consequence-and-declaration",
    "consequence-and-declaration -> final-submit-actions"
  ],
  "responsive": {
    "wide": "The readable ledger keeps each Change action next to the value owner; dense totals may use full content width.",
    "intermediate": "Rows reflow while key, value, and action remain one association; declaration follows the full review.",
    "compact": "Every row becomes key, value, Change before consequence, declaration, and final submit in semantic order.",
    "reflow": "Preserve one semantic DOM order and transform topology when a named relationship fails.",
    "readingOrder": "review-submit -> transaction-context -> sectioned-answer-ledger -> contextual-change-paths -> consequence-and-declaration -> final-submit-actions",
    "navigationReplacement": "Replace lost adjacency with named in-flow or pane navigation to the same regions.",
    "stickyBehavior": "Persistence yields before it can obscure content, focus, validation, or short-height operation.",
    "overflowOwner": "The page owns vertical overflow unless the archetype names one bounded two-dimensional task region.",
    "interactionParity": "Preserve every action, state, recovery path, and focus return across topology changes."
  },
  "stateObligations": [
    "incomplete",
    "not provided",
    "changed answer",
    "derived total recalculating",
    "validation invalidated",
    "declaration unchecked",
    "stale",
    "conflict",
    "submit pending",
    "duplicate prevented",
    "success handoff"
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
