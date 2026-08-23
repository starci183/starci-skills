# Editable record with summary rail

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | editable-record-with-summary-rail |
| Family | detail |
| Dominant task | Create or edit one long structured record while consulting a derived summary and completing one explicit save or discard transaction. |
| Search aliases | editable-record-with-summary-rail; editable record with summary rail |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Create or edit one long structured record while consulting a derived summary and completing one explicit save or discard transaction.
- Each region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-ERS-01 | Create or edit one long structured record while consulting a derived summary and completing one explicit save or discard transaction. | required positive evidence |
| AR-ERS-02 | Every required region and critical relationship has an independent owner. | required positive evidence |
| AR-ERS-03 | The wide relationship stops working, but compact must preserve task, state, and recovery. | transformation trigger |
| AR-ERS-90 | controls save independently, the task is a wizard, or the page is read-only narrative detail. | reject |
| AR-ERS-91 | The difference is only a product noun, density, color, component, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-ERS-01 and AR-ERS-02 are evidenced, neither AR-ERS-90 nor AR-ERS-91 is present, and the region graph remains necessary across all three topologies. Return needs-evidence when an owner or transformation is unresolved.

## Region graph

~~~text
record-editor
├─ breadcrumb-and-editor-header
├─ defining-fields
├─ supporting-field-sections
├─ summary-rail
└─ validation-and-save-boundary
~~~

Critical relationship: Defining fields own identity; the summary reflects the draft and never becomes a second input source.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| record-editor | Owns the bounded page task and contains every required region; it does not invent product semantics. | Contains breadcrumb-and-editor-header, defining-fields, supporting-field-sections, summary-rail, validation-and-save-boundary while preserving their independent owners. |
| breadcrumb-and-editor-header | Owns the currently selected input or choice and preserves its pending and recovery state. | Orients defining-fields without replacing its owner. |
| defining-fields | Owns this named task fact or stage and no neighboring region's decision authority. | Receives context from breadcrumb-and-editor-header and constrains supporting-field-sections without merging their authorities. |
| supporting-field-sections | Owns this named task fact or stage and no neighboring region's decision authority. | Receives context from defining-fields and constrains summary-rail without merging their authorities. |
| summary-rail | Owns the derived interpretation or consequence preview; it never becomes a second input source. | Receives context from supporting-field-sections and constrains validation-and-save-boundary without merging their authorities. |
| validation-and-save-boundary | Owns this named task fact or stage and no neighboring region's decision authority. | Consumes verified state from summary-rail and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Keep the editor primary, the derived summary visible, and a save boundary that reserves space below the final field.
- Failure trigger: simultaneous regions narrow content, obscure state, or break owner relationships.
- Navigation replacement is unnecessary while regions remain simultaneous; sticky is allowed only for context that fits.
- The page owns vertical overflow; only an intrinsically two-dimensional region may own bounded overflow.

### Intermediate

- Turn the summary rail into the temporary supporting pane while grouping and dirty state remain visible.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- A named trigger opens the temporary pane; Escape closes it and focus returns to the trigger.
- Sticky behavior yields at short height; the page remains the overflow owner.

### Compact

- Use one dependency-ordered form sequence and expose the summary before the final save boundary; sticky actions yield at short height.
- Failure trigger: multiple panes are no longer simultaneously operable with 16px text and 44px targets.
- Previous, Next, and a stage selector replace pane adjacency; Back preserves selection and draft.
- No page-level horizontal scrolling is allowed; sticky or fixed surfaces never obscure content or focus.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder it. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. Region state survives movement into and out of the temporary pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale/conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A dialog contains focus, supports Escape or cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: field schema loading; pristine/dirty; inline validation; multi-error summary; derived summary updating; save pending/success/error; discard confirmation; read-only; stale conflict; focus error-summary→field.

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
| domain states | Draft changed; the derived summary is stale until recalculated. Validation found two linked fields and focused the error summary. Save succeeded once; the pending guard prevented duplication. Latest values merged; the edited field and focus target are retained. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, its critical relationship creates a distinct topology, and all responsive states preserve task and recovery parity.

### Reject

Reject when controls save independently, the task is a wizard, or the page is read-only narrative detail, or when the candidate only changes nouns, cards, or density from another archetype.

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
| [GitLab Pajamas — Forms](https://design.gitlab.com/patterns/forms/) | Supports field grouping and validation feedback. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Supports focus visibility around sticky and temporary surfaces. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "editable-record-with-summary-rail",
  "matchedSituationCodes": [
    "AR-ERS-01",
    "AR-ERS-02"
  ],
  "aliases": [
    "editable-record-with-summary-rail",
    "editable record with summary rail"
  ],
  "dominantTask": "Create or edit one long structured record while consulting a derived summary and completing one explicit save or discard transaction.",
  "regions": [
    "record-editor",
    "breadcrumb-and-editor-header",
    "defining-fields",
    "supporting-field-sections",
    "summary-rail",
    "validation-and-save-boundary"
  ],
  "relationships": [
    "Defining fields own identity; the summary reflects the draft and never becomes a second input source."
  ],
  "responsive": {
    "wide": "Keep the editor primary, the derived summary visible, and a save boundary that reserves space below the final field.",
    "intermediate": "Turn the summary rail into the temporary supporting pane while grouping and dirty state remain visible.",
    "compact": "Use one dependency-ordered form sequence and expose the summary before the final save boundary; sticky actions yield at short height.",
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
