# Job run detail timeline

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | job-run-detail-timeline |
| Family | detail |
| Dominant task | Determine where one execution is, why it stopped or failed, and which recovery action applies to that run. |
| Search aliases | job-run-detail-timeline; job run detail timeline |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Determine where one execution is, why it stopped or failed, and which recovery action applies to that run.
- Each region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-JRD-01 | Determine where one execution is, why it stopped or failed, and which recovery action applies to that run. | required positive evidence |
| AR-JRD-02 | Every required region and critical relationship has an independent owner. | required positive evidence |
| AR-JRD-03 | The wide relationship stops working, but compact must preserve task, state, and recovery. | transformation trigger |
| AR-JRD-90 | the page manages many runs, explores append-only logs without steps, or presents a forensic audit timeline. | reject |
| AR-JRD-91 | The difference is only a product noun, density, color, component, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-JRD-01 and AR-JRD-02 are evidenced, neither AR-JRD-90 nor AR-JRD-91 is present, and the region graph remains necessary across all three topologies. Return needs-evidence when an owner or transformation is unresolved.

## Region graph

~~~text
run-detail
├─ run-identity-status-actions
├─ ordered-step-timeline
├─ active-or-failed-step
├─ bounded-log-output
├─ artifacts
└─ run-metadata
~~~

Critical relationship: Ordered steps own progress meaning; the bounded log owns technical overflow, while artifacts and metadata support diagnosis.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| run-detail | Owns the bounded page task and contains every required region; it does not invent product semantics. | Contains run-identity-status-actions, ordered-step-timeline, active-or-failed-step, bounded-log-output, artifacts, run-metadata while preserving their independent owners. |
| run-identity-status-actions | Owns stable subject, scope, and orientation facts for every downstream decision. | Orients ordered-step-timeline without replacing its owner. |
| ordered-step-timeline | Owns ordering, coordinates, or dependency relationships without owning the underlying product facts. | Receives context from run-identity-status-actions and constrains active-or-failed-step without merging their authorities. |
| active-or-failed-step | Owns this named task fact or stage and no neighboring region's decision authority. | Receives context from ordered-step-timeline and constrains bounded-log-output without merging their authorities. |
| bounded-log-output | Owns traceable supporting evidence and its freshness, availability, and permission state. | Receives context from active-or-failed-step and constrains artifacts without merging their authorities. |
| artifacts | Owns membership, item identity, status, and the current selection for this bounded collection. | Receives context from bounded-log-output and constrains run-metadata without merging their authorities. |
| run-metadata | Owns traceable supporting evidence and its freshness, availability, and permission state. | Consumes verified state from artifacts and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Compare the step timeline and bounded log while artifacts and metadata remain supporting context.
- Failure trigger: simultaneous regions narrow content, obscure state, or break owner relationships.
- Navigation replacement is unnecessary while regions remain simultaneous; sticky is allowed only for context that fits.
- The page owns vertical overflow; only an intrinsically two-dimensional region may own bounded overflow.

### Intermediate

- Move metadata and artifacts into the temporary supporting pane; keep the current step and log usable together.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- A named trigger opens the temporary pane; Escape closes it and focus returns to the trigger.
- Sticky behavior yields at short height; the page remains the overflow owner.

### Compact

- Prioritize status, failed step, recovery, log excerpt, artifacts, then metadata; full logs remain bounded.
- Failure trigger: multiple panes are no longer simultaneously operable with 16px text and 44px targets.
- Previous, Next, and a stage selector replace pane adjacency; Back preserves selection and draft.
- No page-level horizontal scrolling is allowed; sticky or fixed surfaces never obscure content or focus.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder it. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. Region state survives movement into and out of the temporary pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale/conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A dialog contains focus, supports Escape or cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: queued; running incremental updates; succeeded; failed; cancelling/cancelled; retry pending; disconnected/stale stream; empty/truncated log; artifact pending/unavailable; permission; announced step changes.

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
| domain states | Run queued; known anatomy remains visible. Selected step is running and its status was announced. The selected step failed; log evidence and retry stay associated. Retry passed; artifacts now match the completed run version. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, its critical relationship creates a distinct topology, and all responsive states preserve task and recovery parity.

### Reject

Reject when the page manages many runs, explores append-only logs without steps, or presents a forensic audit timeline, or when the candidate only changes nouns, cards, or density from another archetype.

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
| [GitLab Pajamas — Loading](https://design.gitlab.com/patterns/loading/) | Supports partial and incremental loading states. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [Salesforce — Progress Indicator](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-progress-indicator.html) | Supports ordered step state. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports announced dynamic status without unnecessary focus movement. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "job-run-detail-timeline",
  "matchedSituationCodes": [
    "AR-JRD-01",
    "AR-JRD-02"
  ],
  "aliases": [
    "job-run-detail-timeline",
    "job run detail timeline"
  ],
  "dominantTask": "Determine where one execution is, why it stopped or failed, and which recovery action applies to that run.",
  "regions": [
    "run-detail",
    "run-identity-status-actions",
    "ordered-step-timeline",
    "active-or-failed-step",
    "bounded-log-output",
    "artifacts",
    "run-metadata"
  ],
  "relationships": [
    "Ordered steps own progress meaning; the bounded log owns technical overflow, while artifacts and metadata support diagnosis."
  ],
  "responsive": {
    "wide": "Compare the step timeline and bounded log while artifacts and metadata remain supporting context.",
    "intermediate": "Move metadata and artifacts into the temporary supporting pane; keep the current step and log usable together.",
    "compact": "Prioritize status, failed step, recovery, log excerpt, artifacts, then metadata; full logs remain bounded.",
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
