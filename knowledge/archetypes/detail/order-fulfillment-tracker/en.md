# Order fulfillment tracker

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | order-fulfillment-tracker |
| Family | detail |
| Dominant task | Reconcile one order across multiple independent shipment progressions and act on cross-shipment exceptions. |
| Search aliases | order-fulfillment-tracker; order fulfillment tracker |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Reconcile one order across multiple independent shipment progressions and act on cross-shipment exceptions.
- Each region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-OFT-01 | Reconcile one order across multiple independent shipment progressions and act on cross-shipment exceptions. | required positive evidence |
| AR-OFT-02 | Every required region and critical relationship has an independent owner. | required positive evidence |
| AR-OFT-03 | The wide relationship stops working, but compact must preserve task, state, and recovery. | transformation trigger |
| AR-OFT-90 | there is one linear shipment, the user advances stages, or many orders are managed in a table. | reject |
| AR-OFT-91 | The difference is only a product noun, density, color, component, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-OFT-01 and AR-OFT-02 are evidenced, neither AR-OFT-90 nor AR-OFT-91 is present, and the region graph remains necessary across all three topologies. Return needs-evidence when an owner or transformation is unresolved.

## Region graph

~~~text
fulfillment-detail
├─ order-identity
├─ derived-overall-fulfillment
├─ parallel-shipment-groups
├─ cross-shipment-exception-priority
├─ carrier-event-histories
└─ customer-resolution-actions
~~~

Critical relationship: Each shipment owns an external progression; overall fulfillment is derived and unresolved exceptions precede history.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| fulfillment-detail | Owns the bounded page task and contains every required region; it does not invent product semantics. | Contains order-identity, derived-overall-fulfillment, parallel-shipment-groups, cross-shipment-exception-priority, carrier-event-histories, customer-resolution-actions while preserving their independent owners. |
| order-identity | Owns stable subject, scope, and orientation facts for every downstream decision. | Orients derived-overall-fulfillment without replacing its owner. |
| derived-overall-fulfillment | Owns the named invariant or derived state and exposes it in text rather than color alone. | Receives context from order-identity and constrains parallel-shipment-groups without merging their authorities. |
| parallel-shipment-groups | Owns membership, item identity, status, and the current selection for this bounded collection. | Receives context from derived-overall-fulfillment and constrains cross-shipment-exception-priority without merging their authorities. |
| cross-shipment-exception-priority | Owns this named task fact or stage and no neighboring region's decision authority. | Receives context from parallel-shipment-groups and constrains carrier-event-histories without merging their authorities. |
| carrier-event-histories | Owns ordering, coordinates, or dependency relationships without owning the underlying product facts. | Receives context from cross-shipment-exception-priority and constrains customer-resolution-actions without merging their authorities. |
| customer-resolution-actions | Owns the bounded completion, verification, or recovery transaction and prevents duplicate execution. | Consumes verified state from carrier-event-histories and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Show shipment groups and overall stage together, with unresolved exceptions taking priority over the support rail.
- Failure trigger: simultaneous regions narrow content, obscure state, or break owner relationships.
- Navigation replacement is unnecessary while regions remain simultaneous; sticky is allowed only for context that fits.
- The page owns vertical overflow; only an intrinsically two-dimensional region may own bounded overflow.

### Intermediate

- Lower the summary rail without merging independent shipments into a false single timeline.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- A named trigger opens the temporary pane; Escape closes it and focus returns to the trigger.
- Sticky behavior yields at short height; the page remains the overflow owner.

### Compact

- Order identity and unresolved exception precede shipment groups and disclosed histories.
- Failure trigger: multiple panes are no longer simultaneously operable with 16px text and 44px targets.
- Previous, Next, and a stage selector replace pane adjacency; Back preserves selection and draft.
- No page-level horizontal scrolling is allowed; sticky or fixed surfaces never obscure content or focus.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder it. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. Region state survives movement into and out of the temporary pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale/conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A dialog contains focus, supports Escape or cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: split/unfulfilled/partial; shipment in-transit/delivered/delayed/failed/returned; contradictory carrier state; stale source; derived overall status; resolution pending/success/error; permission; timezone.

| State family | Obligation | Focus transition | Responsive presentation |
|---|---|---|---|
| initial/loading | Preserve known anatomy and name the waiting region. | Do not move focus automatically. | Keep the same stage identity. |
| ready | Show internally consistent, product-neutral demo data. | Focus remains at the activating control. | Preserve selection. |
| empty/not-applicable | Explain why content is empty and any valid next step. | Move to recovery only when continuation needs it. | Do not erase other required regions. |
| error/retry | Associate the error with its owner and provide bounded retry. | Multi-error moves to the summary; retry returns to the owner. | Error is not color-only. |
| permission/unavailable | Preserve orientation and explain the limitation. | Do not focus a locked control. | Use the same reason in every topology. |
| pending | Prevent duplicates and preserve the action meaning. | Do not steal focus for progress. | State stays with its action owner. |
| success | Confirm the outcome and a valid continuation. | Move focus only when it helps continuation. | Do not create a second source of truth. |
| stale/conflict | Name the changed version and preserve safe input. | Focus a contextual recovery choice. | Selection survives transformation. |
| domain states | Shipment A selected; its independent history is retained. Shipment B is delayed and the exception is described in text. Replacement request is pending for shipment B only. Overall state remains partial until every shipment reaches a compatible terminal state. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, its critical relationship creates a distinct topology, and all responsive states preserve task and recovery parity.

### Reject

Reject when there is one linear shipment, the user advances stages, or many orders are managed in a table, or when the candidate only changes nouns, cards, or density from another archetype.

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
| [Shopify — Details template](https://shopify.dev/docs/api/app-home/patterns/templates/details) | Supports detail composition and contextual actions. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [USWDS — Step indicator](https://designsystem.digital.gov/components/step-indicator/) | Supports textual step orientation. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports announced dynamic status without unnecessary focus movement. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "order-fulfillment-tracker",
  "matchedSituationCodes": [
    "AR-OFT-01",
    "AR-OFT-02"
  ],
  "aliases": [
    "order-fulfillment-tracker",
    "order fulfillment tracker"
  ],
  "dominantTask": "Reconcile one order across multiple independent shipment progressions and act on cross-shipment exceptions.",
  "regions": [
    "fulfillment-detail",
    "order-identity",
    "derived-overall-fulfillment",
    "parallel-shipment-groups",
    "cross-shipment-exception-priority",
    "carrier-event-histories",
    "customer-resolution-actions"
  ],
  "relationships": [
    "Each shipment owns an external progression; overall fulfillment is derived and unresolved exceptions precede history."
  ],
  "responsive": {
    "wide": "Show shipment groups and overall stage together, with unresolved exceptions taking priority over the support rail.",
    "intermediate": "Lower the summary rail without merging independent shipments into a false single timeline.",
    "compact": "Order identity and unresolved exception precede shipment groups and disclosed histories.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "interactionParity": "Every action, state, recovery path, and focus return remains available across bands."
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
    "focus transition"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product facts",
    "semantic owners",
    "real state transitions"
  ],
  "principlesHandoff": [
    "exact geometry",
    "measure and overflow",
    "content-driven thresholds",
    "focus accommodation"
  ],
  "confidence": "low",
  "evidenceClasses": [
    "official task-domain guidance",
    "official design-system guidance",
    "accessibility guidance"
  ]
}
~~~

Return no class, token, component, source path, fixed breakpoint, or invented product fact.
