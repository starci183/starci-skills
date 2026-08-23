# Constrained quota allocation editor

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | constrained-quota-allocation-editor |
| Family | settings |
| Dominant task | Allocate one conserved total across recipients while reconciling remaining balance and cross-row constraints. |
| Search aliases | constrained-quota-allocation-editor; constrained quota allocation editor |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Allocate one conserved total across recipients while reconciling remaining balance and cross-row constraints.
- Each region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-CQA-01 | Allocate one conserved total across recipients while reconciling remaining balance and cross-row constraints. | required positive evidence |
| AR-CQA-02 | Every required region and critical relationship has an independent owner. | required positive evidence |
| AR-CQA-03 | The wide relationship stops working, but compact must preserve task, state, and recovery. | transformation trigger |
| AR-CQA-90 | the task is a permissions matrix, independent preferences, spreadsheet free editing, transfer list, or scheduler. | reject |
| AR-CQA-91 | The difference is only a product noun, density, color, component, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-CQA-01 and AR-CQA-02 are evidenced, neither AR-CQA-90 nor AR-CQA-91 is present, and the region graph remains necessary across all three topologies. Return needs-evidence when an owner or transformation is unresolved.

## Region graph

~~~text
quota-editor
├─ scope-and-conserved-total
├─ recipient-allocation-collection
├─ remaining-balance-ledger
├─ cross-row-constraint-summary
├─ selected-recipient-editor
└─ whole-plan-review-and-commit
~~~

Critical relationship: The conserved total and remaining ledger are global invariant owners; no recipient row can commit independently.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| quota-editor | Owns the bounded page task and contains every required region; it does not invent product semantics. | Contains scope-and-conserved-total, recipient-allocation-collection, remaining-balance-ledger, cross-row-constraint-summary, selected-recipient-editor, whole-plan-review-and-commit while preserving their independent owners. |
| scope-and-conserved-total | Owns the named invariant or derived state and exposes it in text rather than color alone. | Orients recipient-allocation-collection without replacing its owner. |
| recipient-allocation-collection | Owns membership, item identity, status, and the current selection for this bounded collection. | Receives context from scope-and-conserved-total and constrains remaining-balance-ledger without merging their authorities. |
| remaining-balance-ledger | Owns the named invariant or derived state and exposes it in text rather than color alone. | Receives context from recipient-allocation-collection and constrains cross-row-constraint-summary without merging their authorities. |
| cross-row-constraint-summary | Owns the derived interpretation or consequence preview; it never becomes a second input source. | Receives context from remaining-balance-ledger and constrains selected-recipient-editor without merging their authorities. |
| selected-recipient-editor | Owns the currently selected input or choice and preserves its pending and recovery state. | Receives context from cross-row-constraint-summary and constrains whole-plan-review-and-commit without merging their authorities. |
| whole-plan-review-and-commit | Owns the derived interpretation or consequence preview; it never becomes a second input source. | Consumes verified state from selected-recipient-editor and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Keep allocations beside a persistent balance and constraint summary; the row editor stays subordinate to whole-plan review.
- Failure trigger: simultaneous regions narrow content, obscure state, or break owner relationships.
- Navigation replacement is unnecessary while regions remain simultaneous; sticky is allowed only for context that fits.
- The page owns vertical overflow; only an intrinsically two-dimensional region may own bounded overflow.

### Intermediate

- Reduce comparison columns and move the selected recipient editor into the temporary pane while balance remains visible.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- A named trigger opens the temporary pane; Escape closes it and focus returns to the trigger.
- Sticky behavior yields at short height; the page remains the overflow owner.

### Compact

- Stage allocation list, recipient edit, balance and violations, then whole-plan commit.
- Failure trigger: multiple panes are no longer simultaneously operable with 16px text and 44px targets.
- Previous, Next, and a stage selector replace pane adjacency; Back preserves selection and draft.
- No page-level horizontal scrolling is allowed; sticky or fixed surfaces never obscure content or focus.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder it. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. Region state survives movement into and out of the temporary pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale/conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A dialog contains focus, supports Escape or cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: unallocated/overallocated/balanced; recipient min/max/locked; invalid unit; calculating total; bulk distribution; dirty plan; commit pending/conflict; stale capacity.

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
| domain states | Alpha allocation is 40; 60 units remain. Beta allocation is 35; 25 units remain and all cross-row constraints pass so far. Gamma allocation is 25; the conserved total is balanced at 100. Whole plan committed once; no row was committed independently. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, its critical relationship creates a distinct topology, and all responsive states preserve task and recovery parity.

### Reject

Reject when the task is a permissions matrix, independent preferences, spreadsheet free editing, transfer list, or scheduler, or when the candidate only changes nouns, cards, or density from another archetype.

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
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports scan and action relationships in dense records. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports responsive region relationships and minimum touch targets. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports content availability without page-level two-dimensional scrolling. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "constrained-quota-allocation-editor",
  "matchedSituationCodes": [
    "AR-CQA-01",
    "AR-CQA-02"
  ],
  "aliases": [
    "constrained-quota-allocation-editor",
    "constrained quota allocation editor"
  ],
  "dominantTask": "Allocate one conserved total across recipients while reconciling remaining balance and cross-row constraints.",
  "regions": [
    "quota-editor",
    "scope-and-conserved-total",
    "recipient-allocation-collection",
    "remaining-balance-ledger",
    "cross-row-constraint-summary",
    "selected-recipient-editor",
    "whole-plan-review-and-commit"
  ],
  "relationships": [
    "The conserved total and remaining ledger are global invariant owners; no recipient row can commit independently."
  ],
  "responsive": {
    "wide": "Keep allocations beside a persistent balance and constraint summary; the row editor stays subordinate to whole-plan review.",
    "intermediate": "Reduce comparison columns and move the selected recipient editor into the temporary pane while balance remains visible.",
    "compact": "Stage allocation list, recipient edit, balance and violations, then whole-plan commit.",
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
