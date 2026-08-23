# Independent preference autosave center

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | independent-preference-autosave-center |
| Family | settings |
| Dominant task | Adjust independent preferences whose changes commit separately with per-control pending, error, retry, and undo. |
| Search aliases | independent-preference-autosave-center; independent preference autosave center |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Adjust independent preferences whose changes commit separately with per-control pending, error, retry, and undo.
- Each region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-IPA-01 | Adjust independent preferences whose changes commit separately with per-control pending, error, retry, and undo. | required positive evidence |
| AR-IPA-02 | Every required region and critical relationship has an independent owner. | required positive evidence |
| AR-IPA-03 | The wide relationship stops working, but compact must preserve task, state, and recovery. | transformation trigger |
| AR-IPA-90 | one Save commits a section, the task is a wizard, policy accordion, matrix editor, or settings hub. | reject |
| AR-IPA-91 | The difference is only a product noun, density, color, component, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-IPA-01 and AR-IPA-02 are evidenced, neither AR-IPA-90 nor AR-IPA-91 is present, and the region graph remains necessary across all three topologies. Return needs-evidence when an owner or transformation is unresolved.

## Region graph

~~~text
preference-center
├─ category-index
├─ preference-groups
├─ independent-preference-control
├─ per-control-status-and-undo
└─ reset-category-boundary
~~~

Critical relationship: Every preference owns its own transaction; category reset is an explicit multi-control boundary and no global Save exists.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| preference-center | Owns the bounded page task and contains every required region; it does not invent product semantics. | Contains category-index, preference-groups, independent-preference-control, per-control-status-and-undo, reset-category-boundary while preserving their independent owners. |
| category-index | Owns this named task fact or stage and no neighboring region's decision authority. | Orients preference-groups without replacing its owner. |
| preference-groups | Owns membership, item identity, status, and the current selection for this bounded collection. | Receives context from category-index and constrains independent-preference-control without merging their authorities. |
| independent-preference-control | Owns the currently selected input or choice and preserves its pending and recovery state. | Receives context from preference-groups and constrains per-control-status-and-undo without merging their authorities. |
| per-control-status-and-undo | Owns the currently selected input or choice and preserves its pending and recovery state. | Receives context from independent-preference-control and constrains reset-category-boundary without merging their authorities. |
| reset-category-boundary | Owns this named task fact or stage and no neighboring region's decision authority. | Consumes verified state from per-control-status-and-undo and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Keep category navigation and groups together with local status and undo beside each control.
- Failure trigger: simultaneous regions narrow content, obscure state, or break owner relationships.
- Navigation replacement is unnecessary while regions remain simultaneous; sticky is allowed only for context that fits.
- The page owns vertical overflow; only an intrinsically two-dimensional region may own bounded overflow.

### Intermediate

- Collapse category navigation while preserving group identity and independent transaction feedback.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- A named trigger opens the temporary pane; Escape closes it and focus returns to the trigger.
- Sticky behavior yields at short height; the page remains the overflow owner.

### Compact

- Enter one category and stack controls with local status and undo; reset follows the visible group.
- Failure trigger: multiple panes are no longer simultaneously operable with 16px text and 44px targets.
- Previous, Next, and a stage selector replace pane adjacency; Back preserves selection and draft.
- No page-level horizontal scrolling is allowed; sticky or fixed surfaces never obscure content or focus.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder it. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. Region state survives movement into and out of the temporary pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale/conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A dialog contains focus, supports Escape or cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: initial/loading; saved; local pending; local failure/retry; undone; inherited/locked; dependency hidden/revealed; reset pending/partial failure; announced status.

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
| domain states | Digest preference saved independently; other controls remain unchanged. Theme preference saved independently with local confirmation. Notification preference retry succeeded at its own control. Digest preference restored without invoking a page-level transaction. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, its critical relationship creates a distinct topology, and all responsive states preserve task and recovery parity.

### Reject

Reject when one Save commits a section, the task is a wizard, policy accordion, matrix editor, or settings hub, or when the candidate only changes nouns, cards, or density from another archetype.

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
| [GitLab Pajamas — Saving and feedback](https://design.gitlab.com/patterns/saving-and-feedback/) | Supports pending, success, failure, and recovery feedback. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports announced dynamic status without unnecessary focus movement. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports responsive region relationships and minimum touch targets. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "independent-preference-autosave-center",
  "matchedSituationCodes": [
    "AR-IPA-01",
    "AR-IPA-02"
  ],
  "aliases": [
    "independent-preference-autosave-center",
    "independent preference autosave center"
  ],
  "dominantTask": "Adjust independent preferences whose changes commit separately with per-control pending, error, retry, and undo.",
  "regions": [
    "preference-center",
    "category-index",
    "preference-groups",
    "independent-preference-control",
    "per-control-status-and-undo",
    "reset-category-boundary"
  ],
  "relationships": [
    "Every preference owns its own transaction; category reset is an explicit multi-control boundary and no global Save exists."
  ],
  "responsive": {
    "wide": "Keep category navigation and groups together with local status and undo beside each control.",
    "intermediate": "Collapse category navigation while preserving group identity and independent transaction feedback.",
    "compact": "Enter one category and stack controls with local status and undo; reset follows the visible group.",
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
