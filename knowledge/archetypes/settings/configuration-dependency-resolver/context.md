# Configuration dependency resolver

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | configuration-dependency-resolver |
| Family | settings |
| Dominant task | Trace one configuration violation through its dependency path, compare valid resolutions, and apply one safely. |
| Search aliases | configuration-dependency-resolver; configuration dependency resolver |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Trace one configuration violation through its dependency path, compare valid resolutions, and apply one safely.
- Each region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-CDR-01 | Trace one configuration violation through its dependency path, compare valid resolutions, and apply one safely. | required positive evidence |
| AR-CDR-02 | Every required region and critical relationship has an independent owner. | required positive evidence |
| AR-CDR-03 | The wide relationship stops working, but compact must preserve task, state, and recovery. | transformation trigger |
| AR-CDR-90 | the need is passive monitoring, rule building, ordinary validation, provenance inspection, or workflow editing. | reject |
| AR-CDR-91 | The difference is only a product noun, density, color, component, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-CDR-01 and AR-CDR-02 are evidenced, neither AR-CDR-90 nor AR-CDR-91 is present, and the region graph remains necessary across all three topologies. Return needs-evidence when an owner or transformation is unresolved.

## Region graph

~~~text
dependency-resolver
├─ violation-summary
├─ dependency-constraint-graph
├─ selected-constraint-evidence
├─ candidate-resolution-set
├─ before-after-resolution-preview
└─ apply-and-verification
~~~

Critical relationship: The graph explains causality; the preview owns consequences and verification owns whether apply may stand.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| dependency-resolver | Owns the bounded page task and contains every required region; it does not invent product semantics. | Contains violation-summary, dependency-constraint-graph, selected-constraint-evidence, candidate-resolution-set, before-after-resolution-preview, apply-and-verification while preserving their independent owners. |
| violation-summary | Owns the derived interpretation or consequence preview; it never becomes a second input source. | Orients dependency-constraint-graph without replacing its owner. |
| dependency-constraint-graph | Owns ordering, coordinates, or dependency relationships without owning the underlying product facts. | Receives context from violation-summary and constrains selected-constraint-evidence without merging their authorities. |
| selected-constraint-evidence | Owns traceable supporting evidence and its freshness, availability, and permission state. | Receives context from dependency-constraint-graph and constrains candidate-resolution-set without merging their authorities. |
| candidate-resolution-set | Owns the currently selected input or choice and preserves its pending and recovery state. | Receives context from selected-constraint-evidence and constrains before-after-resolution-preview without merging their authorities. |
| before-after-resolution-preview | Owns the derived interpretation or consequence preview; it never becomes a second input source. | Receives context from candidate-resolution-set and constrains apply-and-verification without merging their authorities. |
| apply-and-verification | Owns the bounded completion, verification, or recovery transaction and prevents duplicate execution. | Consumes verified state from before-after-resolution-preview and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Compare violations, dependency path, selected evidence, and before/after preview together.
- Failure trigger: simultaneous regions narrow content, obscure state, or break owner relationships.
- Navigation replacement is unnecessary while regions remain simultaneous; sticky is allowed only for context that fits.
- The page owns vertical overflow; only an intrinsically two-dimensional region may own bounded overflow.

### Intermediate

- Move the graph into the temporary pane while violations, active path summary, and preview remain primary.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- A named trigger opens the temporary pane; Escape closes it and focus returns to the trigger.
- Sticky behavior yields at short height; the page remains the overflow owner.

### Compact

- Stage violation, dependency path, candidates, preview, apply, and verification; the graph may become a path list.
- Failure trigger: multiple panes are no longer simultaneously operable with 16px text and 44px targets.
- Previous, Next, and a stage selector replace pane adjacency; Back preserves selection and draft.
- No page-level horizontal scrolling is allowed; sticky or fixed surfaces never obscure content or focus.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder it. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. Region state survives movement into and out of the temporary pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale/conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A dialog contains focus, supports Escape or cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: detecting; no violations; selected constraint; incomplete graph; cyclic dependency; candidate calculating/incompatible; stale preview; apply pending/failure/rollback; verification pass/fail.

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
| domain states | Constraint C-7 selected with its dependency path. Resolution A preview changes two dependent values; resolution B remains comparable. Candidate applied locally; verification is pending and duplicate apply is blocked. Verification failed, so rollback restored the selected path and prior values. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, its critical relationship creates a distinct topology, and all responsive states preserve task and recovery parity.

### Reject

Reject when the need is passive monitoring, rule building, ordinary validation, provenance inspection, or workflow editing, or when the candidate only changes nouns, cards, or density from another archetype.

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
| [GitLab Pajamas — Progressive disclosure](https://design.gitlab.com/patterns/progressive-disclosure/) | Supports graduated disclosure of dependency detail. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports responsive region relationships and minimum touch targets. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports announced dynamic status without unnecessary focus movement. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "configuration-dependency-resolver",
  "matchedSituationCodes": [
    "AR-CDR-01",
    "AR-CDR-02"
  ],
  "aliases": [
    "configuration-dependency-resolver",
    "configuration dependency resolver"
  ],
  "dominantTask": "Trace one configuration violation through its dependency path, compare valid resolutions, and apply one safely.",
  "regions": [
    "dependency-resolver",
    "violation-summary",
    "dependency-constraint-graph",
    "selected-constraint-evidence",
    "candidate-resolution-set",
    "before-after-resolution-preview",
    "apply-and-verification"
  ],
  "relationships": [
    "The graph explains causality; the preview owns consequences and verification owns whether apply may stand."
  ],
  "responsive": {
    "wide": "Compare violations, dependency path, selected evidence, and before/after preview together.",
    "intermediate": "Move the graph into the temporary pane while violations, active path summary, and preview remain primary.",
    "compact": "Stage violation, dependency path, candidates, preview, apply, and verification; the graph may become a path list.",
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
