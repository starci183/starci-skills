# Causal root analysis dossier

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | causal-root-analysis-dossier |
| Family | detail |
| Dominant task | Test a causal hypothesis tree against evidence, eliminate unsupported causes, and record a reviewable root-cause rationale. |
| Search aliases | causal-root-analysis-dossier; causal root analysis dossier |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Test a causal hypothesis tree against evidence, eliminate unsupported causes, and record a reviewable root-cause rationale.
- Each region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-CRA-01 | Test a causal hypothesis tree against evidence, eliminate unsupported causes, and record a reviewable root-cause rationale. | required positive evidence |
| AR-CRA-02 | Every required region and critical relationship has an independent owner. | required positive evidence |
| AR-CRA-03 | The wide relationship stops working, but compact must preserve task, state, and recovery. | transformation trigger |
| AR-CRA-90 | the page is a generic case dossier, dependency graph, incident timeline, rule builder, or narrative report. | reject |
| AR-CRA-91 | The difference is only a product noun, density, color, component, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-CRA-01 and AR-CRA-02 are evidenced, neither AR-CRA-90 nor AR-CRA-91 is present, and the region graph remains necessary across all three topologies. Return needs-evidence when an owner or transformation is unresolved.

## Region graph

~~~text
root-analysis
├─ problem-statement-and-boundary
├─ causal-hypothesis-tree
├─ evidence-linked-cause-register
├─ eliminated-and-unresolved-causes
├─ selected-cause-evidence
├─ root-cause-rationale
└─ corrective-action-linkage
~~~

Critical relationship: The hypothesis tree and evidence statuses are independent; correlation alone never upgrades a cause.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| root-analysis | Owns the bounded page task and contains every required region; it does not invent product semantics. | Contains problem-statement-and-boundary, causal-hypothesis-tree, evidence-linked-cause-register, eliminated-and-unresolved-causes, selected-cause-evidence, root-cause-rationale, corrective-action-linkage while preserving their independent owners. |
| problem-statement-and-boundary | Owns stable subject, scope, and orientation facts for every downstream decision. | Orients causal-hypothesis-tree without replacing its owner. |
| causal-hypothesis-tree | Owns ordering, coordinates, or dependency relationships without owning the underlying product facts. | Receives context from problem-statement-and-boundary and constrains evidence-linked-cause-register without merging their authorities. |
| evidence-linked-cause-register | Owns membership, item identity, status, and the current selection for this bounded collection. | Receives context from causal-hypothesis-tree and constrains eliminated-and-unresolved-causes without merging their authorities. |
| eliminated-and-unresolved-causes | Owns this named task fact or stage and no neighboring region's decision authority. | Receives context from evidence-linked-cause-register and constrains selected-cause-evidence without merging their authorities. |
| selected-cause-evidence | Owns traceable supporting evidence and its freshness, availability, and permission state. | Receives context from eliminated-and-unresolved-causes and constrains root-cause-rationale without merging their authorities. |
| root-cause-rationale | Owns the derived interpretation or consequence preview; it never becomes a second input source. | Receives context from selected-cause-evidence and constrains corrective-action-linkage without merging their authorities. |
| corrective-action-linkage | Owns the bounded completion, verification, or recovery transaction and prevents duplicate execution. | Consumes verified state from root-cause-rationale and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Inspect hypothesis tree, evidence detail, eliminated and unresolved summary, and rationale together.
- Failure trigger: simultaneous regions narrow content, obscure state, or break owner relationships.
- Navigation replacement is unnecessary while regions remain simultaneous; sticky is allowed only for context that fits.
- The page owns vertical overflow; only an intrinsically two-dimensional region may own bounded overflow.

### Intermediate

- Move the tree into the temporary pane while the selected path and evidence remain primary.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- A named trigger opens the temporary pane; Escape closes it and focus returns to the trigger.
- Sticky behavior yields at short height; the page remains the overflow owner.

### Compact

- Stage problem, hypothesis path, selected evidence, eliminated and unresolved causes, then rationale and action.
- Failure trigger: multiple panes are no longer simultaneously operable with 16px text and 44px targets.
- Previous, Next, and a stage selector replace pane adjacency; Back preserves selection and draft.
- No page-level horizontal scrolling is allowed; sticky or fixed surfaces never obscure content or focus.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder it. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. Region state survives movement into and out of the temporary pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale/conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A dialog contains focus, supports Escape or cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: hypothesis proposed/supported/refuted/unknown; evidence loading/stale/contradictory; branch eliminated/reopened; selected cause; rationale draft/conflict; missing corrective action; recorded review.

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
| domain states | Evidence E-9 linked to H-2 as support, not proof by itself. Unsupported branch eliminated with a recorded reason. Contradictory evidence reopened the branch and the conclusion is pending. Rationale recorded with uncertainty and a linked corrective action. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, its critical relationship creates a distinct topology, and all responsive states preserve task and recovery parity.

### Reject

Reject when the page is a generic case dossier, dependency graph, incident timeline, rule builder, or narrative report, or when the candidate only changes nouns, cards, or density from another archetype.

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
| [USWDS — Process list](https://designsystem.digital.gov/components/process-list/) | Supports ordered explanatory relationships. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Supports responsive region grouping. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports logical keyboard order and deterministic focus return. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "causal-root-analysis-dossier",
  "matchedSituationCodes": [
    "AR-CRA-01",
    "AR-CRA-02"
  ],
  "aliases": [
    "causal-root-analysis-dossier",
    "causal root analysis dossier"
  ],
  "dominantTask": "Test a causal hypothesis tree against evidence, eliminate unsupported causes, and record a reviewable root-cause rationale.",
  "regions": [
    "root-analysis",
    "problem-statement-and-boundary",
    "causal-hypothesis-tree",
    "evidence-linked-cause-register",
    "eliminated-and-unresolved-causes",
    "selected-cause-evidence",
    "root-cause-rationale",
    "corrective-action-linkage"
  ],
  "relationships": [
    "The hypothesis tree and evidence statuses are independent; correlation alone never upgrades a cause."
  ],
  "responsive": {
    "wide": "Inspect hypothesis tree, evidence detail, eliminated and unresolved summary, and rationale together.",
    "intermediate": "Move the tree into the temporary pane while the selected path and evidence remain primary.",
    "compact": "Stage problem, hypothesis path, selected evidence, eliminated and unresolved causes, then rationale and action.",
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
