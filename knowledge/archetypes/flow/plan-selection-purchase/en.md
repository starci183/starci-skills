# Plan selection purchase

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `plan-selection-purchase` |
| Family | `flow` |
| Dominant task | Compare decision-relevant plan trade-offs, select billing terms, and complete purchase with price and consequence attached to selection. |
| Search aliases | `pricing plan purchase`, `subscription selection`, `plan and billing checkout` |
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
| `PSP-01` | Compare decision-relevant plan trade-offs, select billing terms, and complete purchase with price and consequence attached to selection. | required positive |
| `PSP-02` | All required regions and their named ownership relationships are necessary for the task. | required positive |
| `PSP-03` | Wide adjacency fails while intermediate and compact transformations preserve task, state, and recovery. | conditional positive |
| `PSP-90` | Reject broad comparison matrices or multi-line-item carts. | reject |
| `PSP-91` | Reject detail decision rails, upgrade micro-actions, or centered tasks. | reject |

### Selection rule

- Return `accept` only when `PSP-01` and `PSP-02` are evidenced and no 90–99 code is present.
- Return `reject` when `PSP-90` or `PSP-91` is evidenced, or an adjacent archetype owns the dominant task.
- Return `needs-evidence` when the task, required region, relationship, or responsive failure trigger remains unresolved.

## Region graph

```text
plan-purchase
├─ purchase-context
├─ plan-options-and-differences
├─ billing-term-control
├─ selected-plan-summary
├─ payment-or-confirmation
└─ purchase-action
```

- **Shared relationship:** Plan and billing term form one shared selection; price, eligibility, payment, and purchase consequence remain bound to that same selection revision.
- `plan-purchase -> purchase-context`: `purchase-context` consumes the named context or revision from `plan-purchase` and exposes an explicit return or reconciliation path.
- `purchase-context -> plan-options-and-differences`: `plan-options-and-differences` consumes the named context or revision from `purchase-context` and exposes an explicit return or reconciliation path.
- `plan-options-and-differences -> billing-term-control`: `billing-term-control` consumes the named context or revision from `plan-options-and-differences` and exposes an explicit return or reconciliation path.
- `billing-term-control -> selected-plan-summary`: `selected-plan-summary` consumes the named context or revision from `billing-term-control` and exposes an explicit return or reconciliation path.
- `selected-plan-summary -> payment-or-confirmation`: `payment-or-confirmation` consumes the named context or revision from `selected-plan-summary` and exposes an explicit return or reconciliation path.
- `payment-or-confirmation -> purchase-action`: `purchase-action` consumes the named context or revision from `payment-or-confirmation` and exposes an explicit return or reconciliation path.

### Region obligations

| Region | Obligation |
|---|---|
| `plan-purchase` | Owns the complete plan purchase transaction boundary, shared revision, and recovery context; child regions cannot commit outside it. |
| `purchase-context` | Owns the purchase context orientation and immutable basis that qualifies every downstream decision. |
| `plan-options-and-differences` | Owns the plan options and differences input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `billing-term-control` | Owns the billing term control input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `selected-plan-summary` | Owns the derived selected plan summary state; it names its source revision and cannot contradict the input or evidence owners. |
| `payment-or-confirmation` | Owns the payment or confirmation input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `purchase-action` | Owns the purchase action commitment boundary and prevents duplicate or stale commitment; it consumes the reviewed shared revision. |

## Responsive contract

### Wide

- **Failure trigger:** A required region can no longer remain simultaneous without squeezing, truncating, or separating context from action.
- **Topology response:** A small plan set remains simultaneous with shared attributes while the selected summary stays supporting.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer persist while retaining readable measure and action order.
- **Topology response:** An explicit plan selector reduces simultaneous options while key differences and current price remain adjacent.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Compact

- **Failure trigger:** Adjacency or multiple primary panes no longer work under zoom, localization, text growth, or short height.
- **Topology response:** One plan at a time or vertical options preserve essentials and selected price without horizontal carousel dependence.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Reflow

- Semantic and DOM order is `plan-purchase` → `purchase-context` → `plan-options-and-differences` → `billing-term-control` → `selected-plan-summary` → `payment-or-confirmation` → `purchase-action`.
- CSS does not reorder regions or the focus sequence at a topology transition.
- Compact navigation replaces adjacency with a named primary pane and restores the exact trigger, state, and scroll context.

### Interaction parity

- Wide, intermediate, and compact retain the same actions, state meanings, recovery paths, and consequence.
- Dynamic status is announced without moving focus automatically.
- Error recovery moves focus to a summary or repairable field and then returns to the meaningful continuation.

## State obligations

| State | Required behavior | Responsive presentation |
|---|---|---|
| `no selection` | Distinguish a valid absence from missing required input and expose the next available start path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `billing interval changed` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `plan unavailable` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `recommended plan` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `eligibility constraint` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `price recalculating` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `tax recalculating` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `discount invalid` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `payment pending` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `payment declined` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `terms changed` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `purchase conflict` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `success handoff` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |

## Boundaries

### Accept

- Use when one selected plan and billing term remain shared state through purchase.
- Required regions must share one transaction state model and one provable recovery path.

### Reject

- Reject broad comparison matrices or multi-line-item carts.
- Reject detail decision rails, upgrade micro-actions, or centered tasks.
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
| [Stripe — Checkout documentation](https://docs.stripe.com/payments/checkout) | Purchase completion keeps payment outcome and retry states explicit. | It does not define plan comparison or visual layout. |
| [Shopify — App Home patterns](https://shopify.dev/docs/api/app-home/patterns) | Commerce surfaces distinguish primary work from supporting status. | It does not define this fictional cart or price calculation. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Content-driven layout adapts while preserving hierarchy. | It does not define the exact regions or thresholds. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Required content reflows without page-level two-dimensional scrolling. | It does not prescribe a breakpoint or region geometry. |

## Output

Return one resolved record with exactly these runtime fields:

```json
{
  "archetypeId": "plan-selection-purchase",
  "situationCodes": [
    "PSP-01",
    "PSP-02",
    "PSP-03"
  ],
  "searchAliases": [
    "pricing plan purchase",
    "subscription selection",
    "plan and billing checkout"
  ],
  "dominantTask": "Compare decision-relevant plan trade-offs, select billing terms, and complete purchase with price and consequence attached to selection.",
  "regions": [
    "plan-purchase",
    "purchase-context",
    "plan-options-and-differences",
    "billing-term-control",
    "selected-plan-summary",
    "payment-or-confirmation",
    "purchase-action"
  ],
  "regionRelationships": [
    "plan-purchase -> purchase-context",
    "purchase-context -> plan-options-and-differences",
    "plan-options-and-differences -> billing-term-control",
    "billing-term-control -> selected-plan-summary",
    "selected-plan-summary -> payment-or-confirmation",
    "payment-or-confirmation -> purchase-action"
  ],
  "responsive": {
    "wide": "A small plan set remains simultaneous with shared attributes while the selected summary stays supporting.",
    "intermediate": "An explicit plan selector reduces simultaneous options while key differences and current price remain adjacent.",
    "compact": "One plan at a time or vertical options preserve essentials and selected price without horizontal carousel dependence.",
    "reflow": "Preserve one semantic DOM order and transform topology when a named relationship fails.",
    "readingOrder": "plan-purchase -> purchase-context -> plan-options-and-differences -> billing-term-control -> selected-plan-summary -> payment-or-confirmation -> purchase-action",
    "navigationReplacement": "Replace lost adjacency with named in-flow or pane navigation to the same regions.",
    "stickyBehavior": "Persistence yields before it can obscure content, focus, validation, or short-height operation.",
    "overflowOwner": "The page owns vertical overflow unless the archetype names one bounded two-dimensional task region.",
    "interactionParity": "Preserve every action, state, recovery path, and focus return across topology changes."
  },
  "stateObligations": [
    "no selection",
    "billing interval changed",
    "plan unavailable",
    "recommended plan",
    "eligibility constraint",
    "price recalculating",
    "tax recalculating",
    "discount invalid",
    "payment pending",
    "payment declined",
    "terms changed",
    "purchase conflict",
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
