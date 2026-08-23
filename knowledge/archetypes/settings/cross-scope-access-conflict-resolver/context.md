# Cross-scope access conflict resolver

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | cross-scope-access-conflict-resolver |
| Family | settings |
| Dominant task | Resolve a blocked intent by comparing permission deltas across candidate scopes and choosing switch, request, or abandon. |
| Search aliases | cross-scope-access-conflict-resolver; cross-scope access conflict resolver |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Resolve a blocked intent by comparing permission deltas across candidate scopes and choosing switch, request, or abandon.
- Each region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-CAC-01 | Resolve a blocked intent by comparing permission deltas across candidate scopes and choosing switch, request, or abandon. | required positive evidence |
| AR-CAC-02 | Every required region and critical relationship has an independent owner. | required positive evidence |
| AR-CAC-03 | The wide relationship stops working, but compact must preserve task, state, and recovery. | transformation trigger |
| AR-CAC-90 | the need is a generic permission outcome, permission editing matrix, account switcher, outage, or plan comparison. | reject |
| AR-CAC-91 | The difference is only a product noun, density, color, component, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-CAC-01 and AR-CAC-02 are evidenced, neither AR-CAC-90 nor AR-CAC-91 is present, and the region graph remains necessary across all three topologies. Return needs-evidence when an owner or transformation is unresolved.

## Region graph

~~~text
access-resolver
├─ retained-intent-and-current-scope
├─ candidate-scope-list
├─ permission-delta-comparison
├─ selected-scope-consequence
├─ switch-or-request-action
└─ return-to-intent
~~~

Critical relationship: The original intent remains retained; gained, lost, and unchanged permissions all bind to the selected candidate scope.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| access-resolver | Owns the bounded page task and contains every required region; it does not invent product semantics. | Contains retained-intent-and-current-scope, candidate-scope-list, permission-delta-comparison, selected-scope-consequence, switch-or-request-action, return-to-intent while preserving their independent owners. |
| retained-intent-and-current-scope | Owns this named task fact or stage and no neighboring region's decision authority. | Orients candidate-scope-list without replacing its owner. |
| candidate-scope-list | Owns membership, item identity, status, and the current selection for this bounded collection. | Receives context from retained-intent-and-current-scope and constrains permission-delta-comparison without merging their authorities. |
| permission-delta-comparison | Owns this named task fact or stage and no neighboring region's decision authority. | Receives context from candidate-scope-list and constrains selected-scope-consequence without merging their authorities. |
| selected-scope-consequence | Owns the derived interpretation or consequence preview; it never becomes a second input source. | Receives context from permission-delta-comparison and constrains switch-or-request-action without merging their authorities. |
| switch-or-request-action | Owns the bounded completion, verification, or recovery transaction and prevents duplicate execution. | Receives context from selected-scope-consequence and constrains return-to-intent without merging their authorities. |
| return-to-intent | Owns this named task fact or stage and no neighboring region's decision authority. | Consumes verified state from switch-or-request-action and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Compare at least three candidate scopes with permission deltas and consequences visible together.
- Failure trigger: simultaneous regions narrow content, obscure state, or break owner relationships.
- Navigation replacement is unnecessary while regions remain simultaneous; sticky is allowed only for context that fits.
- The page owns vertical overflow; only an intrinsically two-dimensional region may own bounded overflow.

### Intermediate

- Turn candidates into a selector while gained, lost, and unchanged groups remain visible.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- A named trigger opens the temporary pane; Escape closes it and focus returns to the trigger.
- Sticky behavior yields at short height; the page remains the overflow owner.

### Compact

- Stage scope list, selected delta, consequence, action, then return to the retained intent.
- Failure trigger: multiple panes are no longer simultaneously operable with 16px text and 44px targets.
- Previous, Next, and a stage selector replace pane adjacency; Back preserves selection and draft.
- No page-level horizontal scrolling is allowed; sticky or fixed surfaces never obscure content or focus.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder it. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. Region state survives movement into and out of the temporary pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale/conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A dialog contains focus, supports Escape or cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: candidates loading/none; current/candidate; permission gained/lost/unknown; inaccessible scope; request pending/approved/denied; switch failure; stale intent; focus return.

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
| domain states | Team scope selected: two permissions gained and one lost. Division scope selected: one gained, two unchanged, and one lost. Restricted scope request is pending; the original intent remains retained. Returned to the blocked export intent with the approved scope selected. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, its critical relationship creates a distinct topology, and all responsive states preserve task and recovery parity.

### Reject

Reject when the need is a generic permission outcome, permission editing matrix, account switcher, outage, or plan comparison, or when the candidate only changes nouns, cards, or density from another archetype.

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
| [Salesforce — Tree Grid](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-tree-grid.html) | Supports hierarchical comparison semantics. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports scan and action relationships in dense records. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports logical keyboard order and deterministic focus return. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "cross-scope-access-conflict-resolver",
  "matchedSituationCodes": [
    "AR-CAC-01",
    "AR-CAC-02"
  ],
  "aliases": [
    "cross-scope-access-conflict-resolver",
    "cross-scope access conflict resolver"
  ],
  "dominantTask": "Resolve a blocked intent by comparing permission deltas across candidate scopes and choosing switch, request, or abandon.",
  "regions": [
    "access-resolver",
    "retained-intent-and-current-scope",
    "candidate-scope-list",
    "permission-delta-comparison",
    "selected-scope-consequence",
    "switch-or-request-action",
    "return-to-intent"
  ],
  "relationships": [
    "The original intent remains retained; gained, lost, and unchanged permissions all bind to the selected candidate scope."
  ],
  "responsive": {
    "wide": "Compare at least three candidate scopes with permission deltas and consequences visible together.",
    "intermediate": "Turn candidates into a selector while gained, lost, and unchanged groups remain visible.",
    "compact": "Stage scope list, selected delta, consequence, action, then return to the retained intent.",
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
