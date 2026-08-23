# Cart checkout flow

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `cart-checkout-flow` |
| Family | `flow` |
| Dominant task | Confirm line items, provide fulfillment, contact, and payment, review totals, and submit one non-duplicated order. |
| Search aliases | `multi-item checkout`, `cart payment flow`, `order submission checkout` |
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
| `CCF-01` | Confirm line items, provide fulfillment, contact, and payment, review totals, and submit one non-duplicated order. | required positive |
| `CCF-02` | All required regions and their named ownership relationships are necessary for the task. | required positive |
| `CCF-03` | Wide adjacency fails while intermediate and compact transformations preserve task, state, and recovery. | conditional positive |
| `CCF-90` | Reject one-plan purchase or generic review ledgers. | reject |
| `CCF-91` | Reject receipts, donations, or centered tasks. | reject |

### Selection rule

- Return `accept` only when `CCF-01` and `CCF-02` are evidenced and no 90–99 code is present.
- Return `reject` when `CCF-90` or `CCF-91` is evidenced, or an adjacent archetype owns the dominant task.
- Return `needs-evidence` when the task, required region, relationship, or responsive failure trigger remains unresolved.

## Region graph

```text
checkout
├─ cart-line-items
├─ fulfillment-and-contact
├─ payment-input
├─ order-price-summary
├─ review-and-terms
└─ place-order-action
```

- **Shared relationship:** The price summary derives from line items and fulfillment; payment and terms consume that reviewed total; Place order commits one guarded order revision.
- `checkout -> cart-line-items`: `cart-line-items` consumes the named context or revision from `checkout` and exposes an explicit return or reconciliation path.
- `cart-line-items -> fulfillment-and-contact`: `fulfillment-and-contact` consumes the named context or revision from `cart-line-items` and exposes an explicit return or reconciliation path.
- `fulfillment-and-contact -> payment-input`: `payment-input` consumes the named context or revision from `fulfillment-and-contact` and exposes an explicit return or reconciliation path.
- `payment-input -> order-price-summary`: `order-price-summary` consumes the named context or revision from `payment-input` and exposes an explicit return or reconciliation path.
- `order-price-summary -> review-and-terms`: `review-and-terms` consumes the named context or revision from `order-price-summary` and exposes an explicit return or reconciliation path.
- `review-and-terms -> place-order-action`: `place-order-action` consumes the named context or revision from `review-and-terms` and exposes an explicit return or reconciliation path.

### Region obligations

| Region | Obligation |
|---|---|
| `checkout` | Owns the complete checkout transaction boundary, shared revision, and recovery context; child regions cannot commit outside it. |
| `cart-line-items` | Owns the cart line items input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `fulfillment-and-contact` | Owns the fulfillment and contact input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `payment-input` | Owns the payment input input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `order-price-summary` | Owns the derived order price summary state; it names its source revision and cannot contradict the input or evidence owners. |
| `review-and-terms` | Owns the review and terms input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `place-order-action` | Owns the place order action commitment boundary and prevents duplicate or stale commitment; it consumes the reviewed shared revision. |

## Responsive contract

### Wide

- **Failure trigger:** A required region can no longer remain simultaneous without squeezing, truncating, or separating context from action.
- **Topology response:** The checkout form is primary and the derived order summary supports it only while focus and validation remain unobscured.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer persist while retaining readable measure and action order.
- **Topology response:** The order summary becomes collapsible while total and material price changes remain visible before payment.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Compact

- **Failure trigger:** Adjacency or multiple primary panes no longer work under zoom, localization, text growth, or short height.
- **Topology response:** The task becomes cart, fulfillment, payment, and review with final total and line items before Place order.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Reflow

- Semantic and DOM order is `checkout` → `cart-line-items` → `fulfillment-and-contact` → `payment-input` → `order-price-summary` → `review-and-terms` → `place-order-action`.
- CSS does not reorder regions or the focus sequence at a topology transition.
- Compact navigation replaces adjacency with a named primary pane and restores the exact trigger, state, and scroll context.

### Interaction parity

- Wide, intermediate, and compact retain the same actions, state meanings, recovery paths, and consequence.
- Dynamic status is announced without moving focus automatically.
- Error recovery moves focus to a summary or repairable field and then returns to the meaningful continuation.

## State obligations

| State | Required behavior | Responsive presentation |
|---|---|---|
| `empty cart` | Distinguish a valid absence from missing required input and expose the next available start path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `changed cart` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `stock unavailable` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `quantity conflict` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `shipping recalculating` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `tax recalculating` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `promo invalid` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `payment pending` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `payment declined` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `payment retry` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `price stale` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `duplicate prevention` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `success handoff` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `recoverable draft` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |

## Boundaries

### Accept

- Use when multiple priced line items feed fulfillment, payment, and one order submission.
- Required regions must share one transaction state model and one provable recovery path.

### Reject

- Reject one-plan purchase or generic review ledgers.
- Reject receipts, donations, or centered tasks.
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
| [GOV.UK Design System — Payment card details](https://design-system.service.gov.uk/patterns/payment-card-details/) | Payment collection requires clear field ownership and error recovery. | It does not define cart, pricing, or processor rules. |
| [Shopify — App Home patterns](https://shopify.dev/docs/api/app-home/patterns) | Commerce surfaces distinguish primary work from supporting status. | It does not define this fictional cart or price calculation. |
| [W3C WAI — Error Prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html) | Consequential submissions support review, correction, and confirmation. | It does not define the domain consequence or approval rule. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic results can be announced without moving focus. | It does not define transaction states or timing. |

## Output

Return one resolved record with exactly these runtime fields:

```json
{
  "archetypeId": "cart-checkout-flow",
  "situationCodes": [
    "CCF-01",
    "CCF-02",
    "CCF-03"
  ],
  "searchAliases": [
    "multi-item checkout",
    "cart payment flow",
    "order submission checkout"
  ],
  "dominantTask": "Confirm line items, provide fulfillment, contact, and payment, review totals, and submit one non-duplicated order.",
  "regions": [
    "checkout",
    "cart-line-items",
    "fulfillment-and-contact",
    "payment-input",
    "order-price-summary",
    "review-and-terms",
    "place-order-action"
  ],
  "regionRelationships": [
    "checkout -> cart-line-items",
    "cart-line-items -> fulfillment-and-contact",
    "fulfillment-and-contact -> payment-input",
    "payment-input -> order-price-summary",
    "order-price-summary -> review-and-terms",
    "review-and-terms -> place-order-action"
  ],
  "responsive": {
    "wide": "The checkout form is primary and the derived order summary supports it only while focus and validation remain unobscured.",
    "intermediate": "The order summary becomes collapsible while total and material price changes remain visible before payment.",
    "compact": "The task becomes cart, fulfillment, payment, and review with final total and line items before Place order.",
    "reflow": "Preserve one semantic DOM order and transform topology when a named relationship fails.",
    "readingOrder": "checkout -> cart-line-items -> fulfillment-and-contact -> payment-input -> order-price-summary -> review-and-terms -> place-order-action",
    "navigationReplacement": "Replace lost adjacency with named in-flow or pane navigation to the same regions.",
    "stickyBehavior": "Persistence yields before it can obscure content, focus, validation, or short-height operation.",
    "overflowOwner": "The page owns vertical overflow unless the archetype names one bounded two-dimensional task region.",
    "interactionParity": "Preserve every action, state, recovery path, and focus return across topology changes."
  },
  "stateObligations": [
    "empty cart",
    "changed cart",
    "stock unavailable",
    "quantity conflict",
    "shipping recalculating",
    "tax recalculating",
    "promo invalid",
    "payment pending",
    "payment declined",
    "payment retry",
    "price stale",
    "duplicate prevention",
    "success handoff",
    "recoverable draft"
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
