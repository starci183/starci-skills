# Effective setting provenance inspector

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | effective-setting-provenance-inspector |
| Family | settings |
| Dominant task | Explain one effective configuration value by tracing defaults, inheritance, scopes, and conflicting overrides. |
| Search aliases | effective-setting-provenance-inspector; effective setting provenance inspector |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Explain one effective configuration value by tracing defaults, inheritance, scopes, and conflicting overrides.
- Each region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-ESP-01 | Explain one effective configuration value by tracing defaults, inheritance, scopes, and conflicting overrides. | required positive evidence |
| AR-ESP-02 | Every required region and critical relationship has an independent owner. | required positive evidence |
| AR-ESP-03 | The wide relationship stops working, but compact must preserve task, state, and recovery. | transformation trigger |
| AR-ESP-90 | the page edits general settings, browses a hierarchy, resolves dependency violations, or edits permissions. | reject |
| AR-ESP-91 | The difference is only a product noun, density, color, component, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-ESP-01 and AR-ESP-02 are evidenced, neither AR-ESP-90 nor AR-ESP-91 is present, and the region graph remains necessary across all three topologies. Return needs-evidence when an owner or transformation is unresolved.

## Region graph

~~~text
provenance-inspector
├─ setting-and-subject-context
├─ scope-tree
├─ effective-value-summary
├─ inheritance-chain
├─ override-conflict-evidence
└─ change-at-owning-scope-action
~~~

Critical relationship: The inheritance chain owns explanation; edit ownership remains at the actual source scope, never at the derived value.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| provenance-inspector | Owns the bounded page task and contains every required region; it does not invent product semantics. | Contains setting-and-subject-context, scope-tree, effective-value-summary, inheritance-chain, override-conflict-evidence, change-at-owning-scope-action while preserving their independent owners. |
| setting-and-subject-context | Owns stable subject, scope, and orientation facts for every downstream decision. | Orients scope-tree without replacing its owner. |
| scope-tree | Owns ordering, coordinates, or dependency relationships without owning the underlying product facts. | Receives context from setting-and-subject-context and constrains effective-value-summary without merging their authorities. |
| effective-value-summary | Owns the named invariant or derived state and exposes it in text rather than color alone. | Receives context from scope-tree and constrains inheritance-chain without merging their authorities. |
| inheritance-chain | Owns ordering, coordinates, or dependency relationships without owning the underlying product facts. | Receives context from effective-value-summary and constrains override-conflict-evidence without merging their authorities. |
| override-conflict-evidence | Owns traceable supporting evidence and its freshness, availability, and permission state. | Receives context from inheritance-chain and constrains change-at-owning-scope-action without merging their authorities. |
| change-at-owning-scope-action | Owns the bounded completion, verification, or recovery transaction and prevents duplicate execution. | Consumes verified state from override-conflict-evidence and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Compare the scope tree with effective value and inheritance chain while conflict evidence remains available.
- Failure trigger: simultaneous regions narrow content, obscure state, or break owner relationships.
- Navigation replacement is unnecessary while regions remain simultaneous; sticky is allowed only for context that fits.
- The page owns vertical overflow; only an intrinsically two-dimensional region may own bounded overflow.

### Intermediate

- Move the scope tree to the temporary pane but keep the selected path and effective source persistent.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- A named trigger opens the temporary pane; Escape closes it and focus returns to the trigger.
- Sticky behavior yields at short height; the page remains the overflow owner.

### Compact

- Stage scope list, setting detail, provenance chain, then owning-scope action; Back restores ancestry expansion.
- Failure trigger: multiple panes are no longer simultaneously operable with 16px text and 44px targets.
- Previous, Next, and a stage selector replace pane adjacency; Back preserves selection and draft.
- No page-level horizontal scrolling is allowed; sticky or fixed surfaces never obscure content or focus.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder it. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. Region state survives movement into and out of the temporary pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale/conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A dialog contains focus, supports Escape or cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: inherited/default/overridden/conflicted; unknown owner; inaccessible scope; loading/stale/cyclic chain; selected source; unavailable change action; recalculation pending.

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
| domain states | Local scope selected; effective value remains derived. Chain traced from default through parent to local override. Two overrides conflict; neither is presented as silently winning. Change action routes to the owning parent scope, not the derived value. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, its critical relationship creates a distinct topology, and all responsive states preserve task and recovery parity.

### Reject

Reject when the page edits general settings, browses a hierarchy, resolves dependency violations, or edits permissions, or when the candidate only changes nouns, cards, or density from another archetype.

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
| [GitLab Pajamas — Settings management](https://design.gitlab.com/patterns/settings-management/) | Supports settings hierarchy and ownership cues. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [Salesforce — Record Form](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-record-form.html) | Supports record identity, fields, and edit state. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports logical keyboard order and deterministic focus return. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "effective-setting-provenance-inspector",
  "matchedSituationCodes": [
    "AR-ESP-01",
    "AR-ESP-02"
  ],
  "aliases": [
    "effective-setting-provenance-inspector",
    "effective setting provenance inspector"
  ],
  "dominantTask": "Explain one effective configuration value by tracing defaults, inheritance, scopes, and conflicting overrides.",
  "regions": [
    "provenance-inspector",
    "setting-and-subject-context",
    "scope-tree",
    "effective-value-summary",
    "inheritance-chain",
    "override-conflict-evidence",
    "change-at-owning-scope-action"
  ],
  "relationships": [
    "The inheritance chain owns explanation; edit ownership remains at the actual source scope, never at the derived value."
  ],
  "responsive": {
    "wide": "Compare the scope tree with effective value and inheritance chain while conflict evidence remains available.",
    "intermediate": "Move the scope tree to the temporary pane but keep the selected path and effective source persistent.",
    "compact": "Stage scope list, setting detail, provenance chain, then owning-scope action; Back restores ancestry expansion.",
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
