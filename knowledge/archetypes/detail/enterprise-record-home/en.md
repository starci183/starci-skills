# Enterprise record home

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | enterprise-record-home |
| Family | detail |
| Dominant task | Understand the identity, lifecycle, key facts, and next action of one enterprise record while related context remains referential. |
| Search aliases | enterprise-record-home; enterprise record home |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Understand the identity, lifecycle, key facts, and next action of one enterprise record while related context remains referential.
- Each region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-ERH-01 | Understand the identity, lifecycle, key facts, and next action of one enterprise record while related context remains referential. | required positive evidence |
| AR-ERH-02 | Every required region and critical relationship has an independent owner. | required positive evidence |
| AR-ERH-03 | The wide relationship stops working, but compact must preserve task, state, and recovery. | transformation trigger |
| AR-ERH-90 | editing is the dominant task, multiple records require triage, or the page is a persuasive narrative. | reject |
| AR-ERH-91 | The difference is only a product noun, density, color, component, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-ERH-01 and AR-ERH-02 are evidenced, neither AR-ERH-90 nor AR-ERH-91 is present, and the region graph remains necessary across all three topologies. Return needs-evidence when an owner or transformation is unresolved.

## Region graph

~~~text
record-home
├─ location-and-identity-header
├─ lifecycle-summary
├─ primary-record-sections
├─ related-context
└─ record-actions
~~~

Critical relationship: Identity and lifecycle orient every section; related context supports, but never replaces, the current record decision.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| record-home | Owns the bounded page task and contains every required region; it does not invent product semantics. | Contains location-and-identity-header, lifecycle-summary, primary-record-sections, related-context, record-actions while preserving their independent owners. |
| location-and-identity-header | Owns stable subject, scope, and orientation facts for every downstream decision. | Orients lifecycle-summary without replacing its owner. |
| lifecycle-summary | Owns the derived interpretation or consequence preview; it never becomes a second input source. | Receives context from location-and-identity-header and constrains primary-record-sections without merging their authorities. |
| primary-record-sections | Owns this named task fact or stage and no neighboring region's decision authority. | Receives context from lifecycle-summary and constrains related-context without merging their authorities. |
| related-context | Owns this named task fact or stage and no neighboring region's decision authority. | Receives context from primary-record-sections and constrains record-actions without merging their authorities. |
| record-actions | Owns the bounded completion, verification, or recovery transaction and prevents duplicate execution. | Consumes verified state from related-context and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Keep the header across the page and show primary record sections beside a supporting related-context rail only while record measure remains readable.
- Failure trigger: simultaneous regions narrow content, obscure state, or break owner relationships.
- Navigation replacement is unnecessary while regions remain simultaneous; sticky is allowed only for context that fits.
- The page owns vertical overflow; only an intrinsically two-dimensional region may own bounded overflow.

### Intermediate

- Move related context into the temporary supporting pane while identity, lifecycle, and primary sections remain in one reading path.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- A named trigger opens the temporary pane; Escape closes it and focus returns to the trigger.
- Sticky behavior yields at short height; the page remains the overflow owner.

### Compact

- Stage identity, lifecycle, facts, primary sections, actions, then related context; Back restores the active section.
- Failure trigger: multiple panes are no longer simultaneously operable with 16px text and 44px targets.
- Previous, Next, and a stage selector replace pane adjacency; Back preserves selection and draft.
- No page-level horizontal scrolling is allowed; sticky or fixed surfaces never obscure content or focus.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder it. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. Region state survives movement into and out of the temporary pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale/conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A dialog contains focus, supports Escape or cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: identity/loading; partial field failure; no related records; permission-redacted section; lifecycle transition pending/success/failure; stale concurrent update; archived/deleted record; focus action→status→record.

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
| domain states | Related record opened without changing the active section. Lifecycle transition pending; duplicate action is blocked. A concurrent update made this view stale. Current record reloaded; identity and active section are preserved. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, its critical relationship creates a distinct topology, and all responsive states preserve task and recovery parity.

### Reject

Reject when editing is the dominant task, multiple records require triage, or the page is a persuasive narrative, or when the candidate only changes nouns, cards, or density from another archetype.

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
| [Salesforce — Record Form](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-record-form.html) | Supports record identity, fields, and edit state. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [Atlassian Design System — Page header](https://atlassian.design/components/page-header/) | Supports page identity and contextual action hierarchy. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports logical keyboard order and deterministic focus return. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "enterprise-record-home",
  "matchedSituationCodes": [
    "AR-ERH-01",
    "AR-ERH-02"
  ],
  "aliases": [
    "enterprise-record-home",
    "enterprise record home"
  ],
  "dominantTask": "Understand the identity, lifecycle, key facts, and next action of one enterprise record while related context remains referential.",
  "regions": [
    "record-home",
    "location-and-identity-header",
    "lifecycle-summary",
    "primary-record-sections",
    "related-context",
    "record-actions"
  ],
  "relationships": [
    "Identity and lifecycle orient every section; related context supports, but never replaces, the current record decision."
  ],
  "responsive": {
    "wide": "Keep the header across the page and show primary record sections beside a supporting related-context rail only while record measure remains readable.",
    "intermediate": "Move related context into the temporary supporting pane while identity, lifecycle, and primary sections remain in one reading path.",
    "compact": "Stage identity, lifecycle, facts, primary sections, actions, then related context; Back restores the active section.",
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
