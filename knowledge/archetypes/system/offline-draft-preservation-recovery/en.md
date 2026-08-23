# Offline draft preservation recovery

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | offline-draft-preservation-recovery |
| Family | system |
| Dominant task | Preserve work after reconnect by comparing a local draft with server state and choosing a safe synchronization outcome. |
| Search aliases | offline-draft-preservation-recovery; offline draft preservation recovery |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Preserve work after reconnect by comparing a local draft with server state and choosing a safe synchronization outcome.
- Each region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-ODP-01 | Preserve work after reconnect by comparing a local draft with server state and choosing a safe synchronization outcome. | required positive evidence |
| AR-ODP-02 | Every required region and critical relationship has an independent owner. | required positive evidence |
| AR-ODP-03 | The wide relationship stops working, but compact must preserve task, state, and recovery. | transformation trigger |
| AR-ODP-90 | the need is a generic error, editable diff workbench, conflict toast, version history, or centered confirmation. | reject |
| AR-ODP-91 | The difference is only a product noun, density, color, component, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-ODP-01 and AR-ODP-02 are evidenced, neither AR-ODP-90 nor AR-ODP-91 is present, and the region graph remains necessary across all three topologies. Return needs-evidence when an owner or transformation is unresolved.

## Region graph

~~~text
draft-recovery
├─ retained-task-identity
├─ local-snapshot-summary
├─ server-state-summary
├─ conflict-and-loss-analysis
├─ preservation-options
├─ merged-outcome-review
└─ sync-result
~~~

Critical relationship: Local and server snapshots are peer evidence owners; every option explains loss before synchronization.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| draft-recovery | Owns the bounded page task and contains every required region; it does not invent product semantics. | Contains retained-task-identity, local-snapshot-summary, server-state-summary, conflict-and-loss-analysis, preservation-options, merged-outcome-review, sync-result while preserving their independent owners. |
| retained-task-identity | Owns stable subject, scope, and orientation facts for every downstream decision. | Orients local-snapshot-summary without replacing its owner. |
| local-snapshot-summary | Owns traceable supporting evidence and its freshness, availability, and permission state. | Receives context from retained-task-identity and constrains server-state-summary without merging their authorities. |
| server-state-summary | Owns traceable supporting evidence and its freshness, availability, and permission state. | Receives context from local-snapshot-summary and constrains conflict-and-loss-analysis without merging their authorities. |
| conflict-and-loss-analysis | Owns the derived interpretation or consequence preview; it never becomes a second input source. | Receives context from server-state-summary and constrains preservation-options without merging their authorities. |
| preservation-options | Owns the currently selected input or choice and preserves its pending and recovery state. | Receives context from conflict-and-loss-analysis and constrains merged-outcome-review without merging their authorities. |
| merged-outcome-review | Owns the derived interpretation or consequence preview; it never becomes a second input source. | Receives context from preservation-options and constrains sync-result without merging their authorities. |
| sync-result | Owns the bounded completion, verification, or recovery transaction and prevents duplicate execution. | Consumes verified state from merged-outcome-review and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Compare local and server summaries with conflict analysis before presenting preservation options.
- Failure trigger: simultaneous regions narrow content, obscure state, or break owner relationships.
- Navigation replacement is unnecessary while regions remain simultaneous; sticky is allowed only for context that fits.
- The page owns vertical overflow; only an intrinsically two-dimensional region may own bounded overflow.

### Intermediate

- Stack aligned snapshot summaries while keeping outcome review visible before synchronization.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- A named trigger opens the temporary pane; Escape closes it and focus returns to the trigger.
- Sticky behavior yields at short height; the page remains the overflow owner.

### Compact

- Stage local, server, conflicts, preservation choice, outcome review, then sync; never overwrite automatically.
- Failure trigger: multiple panes are no longer simultaneously operable with 16px text and 44px targets.
- Previous, Next, and a stage selector replace pane adjacency; Back preserves selection and draft.
- No page-level horizontal scrolling is allowed; sticky or fixed surfaces never obscure content or focus.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder it. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. Region state survives movement into and out of the temporary pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale/conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A dialog contains focus, supports Escape or cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: offline/local-only; reconnecting; server unchanged/changed/deleted; conflict; stale local; merge possible/impossible; sync pending/failure/retry/success; recoverable backup.

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
| domain states | Local-only edit preserved in a recoverable snapshot. Server changed while offline; aligned differences identify both versions. Preserve-both selected; no local or server text is silently discarded. Reviewed merge synchronized and the backup remains recoverable. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, its critical relationship creates a distinct topology, and all responsive states preserve task and recovery parity.

### Reject

Reject when the need is a generic error, editable diff workbench, conflict toast, version history, or centered confirmation, or when the candidate only changes nouns, cards, or density from another archetype.

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
| [USWDS — Patterns](https://designsystem.digital.gov/patterns/) | Supports task-oriented public-service flows. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports content availability without page-level two-dimensional scrolling. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "offline-draft-preservation-recovery",
  "matchedSituationCodes": [
    "AR-ODP-01",
    "AR-ODP-02"
  ],
  "aliases": [
    "offline-draft-preservation-recovery",
    "offline draft preservation recovery"
  ],
  "dominantTask": "Preserve work after reconnect by comparing a local draft with server state and choosing a safe synchronization outcome.",
  "regions": [
    "draft-recovery",
    "retained-task-identity",
    "local-snapshot-summary",
    "server-state-summary",
    "conflict-and-loss-analysis",
    "preservation-options",
    "merged-outcome-review",
    "sync-result"
  ],
  "relationships": [
    "Local and server snapshots are peer evidence owners; every option explains loss before synchronization."
  ],
  "responsive": {
    "wide": "Compare local and server summaries with conflict analysis before presenting preservation options.",
    "intermediate": "Stack aligned snapshot summaries while keeping outcome review visible before synchronization.",
    "compact": "Stage local, server, conflicts, preservation choice, outcome review, then sync; never overwrite automatically.",
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
