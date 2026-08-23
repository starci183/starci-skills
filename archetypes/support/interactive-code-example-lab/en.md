# Interactive code example lab

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | interactive-code-example-lab |
| Family | support |
| Dominant task | Learn one concept by editing a bounded code example and observing synchronized preview, console, and test evidence. |
| Search aliases | interactive-code-example-lab; interactive code example lab |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Learn one concept by editing a bounded code example and observing synchronized preview, console, and test evidence.
- Each region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-ICL-01 | Learn one concept by editing a bounded code example and observing synchronized preview, console, and test evidence. | required positive evidence |
| AR-ICL-02 | Every required region and critical relationship has an independent owner. | required positive evidence |
| AR-ICL-03 | The wide relationship stops working, but compact must preserve task, state, and recovery. | transformation trigger |
| AR-ICL-90 | the need is an API console, production IDE, static sample, query builder, or generic form preview. | reject |
| AR-ICL-91 | The difference is only a product noun, density, color, component, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-ICL-01 and AR-ICL-02 are evidenced, neither AR-ICL-90 nor AR-ICL-91 is present, and the region graph remains necessary across all three topologies. Return needs-evidence when an owner or transformation is unresolved.

## Region graph

~~~text
code-lab
├─ lesson-goal-and-instructions
├─ editable-code-region
├─ live-preview-or-simulator
├─ console-and-test-evidence
├─ reset-solution-controls
└─ explanation-and-next-step
~~~

Critical relationship: Code, preview, console, and tests share one explicit run version; editing marks prior output stale.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| code-lab | Owns the bounded page task and contains every required region; it does not invent product semantics. | Contains lesson-goal-and-instructions, editable-code-region, live-preview-or-simulator, console-and-test-evidence, reset-solution-controls, explanation-and-next-step while preserving their independent owners. |
| lesson-goal-and-instructions | Owns this named task fact or stage and no neighboring region's decision authority. | Orients editable-code-region without replacing its owner. |
| editable-code-region | Owns this named task fact or stage and no neighboring region's decision authority. | Receives context from lesson-goal-and-instructions and constrains live-preview-or-simulator without merging their authorities. |
| live-preview-or-simulator | Owns the derived interpretation or consequence preview; it never becomes a second input source. | Receives context from editable-code-region and constrains console-and-test-evidence without merging their authorities. |
| console-and-test-evidence | Owns traceable supporting evidence and its freshness, availability, and permission state. | Receives context from live-preview-or-simulator and constrains reset-solution-controls without merging their authorities. |
| reset-solution-controls | Owns the currently selected input or choice and preserves its pending and recovery state. | Receives context from console-and-test-evidence and constrains explanation-and-next-step without merging their authorities. |
| explanation-and-next-step | Owns this named task fact or stage and no neighboring region's decision authority. | Consumes verified state from reset-solution-controls and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Coordinate instructions, editor, preview, and evidence panes; only code and console own bounded overflow.
- Failure trigger: simultaneous regions narrow content, obscure state, or break owner relationships.
- Navigation replacement is unnecessary while regions remain simultaneous; sticky is allowed only for context that fits.
- The page owns vertical overflow; only an intrinsically two-dimensional region may own bounded overflow.

### Intermediate

- Collapse instructions and alternate preview with evidence while the run version stays visible.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- A named trigger opens the temporary pane; Escape closes it and focus returns to the trigger.
- Sticky behavior yields at short height; the page remains the overflow owner.

### Compact

- Stage instructions, editor, run, preview, tests, then explanation; explicit switches preserve code and output.
- Failure trigger: multiple panes are no longer simultaneously operable with 16px text and 44px targets.
- Previous, Next, and a stage selector replace pane adjacency; Back preserves selection and draft.
- No page-level horizontal scrolling is allowed; sticky or fixed surfaces never obscure content or focus.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder it. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. Region state survives movement into and out of the temporary pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale/conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A dialog contains focus, supports Escape or cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: starter/dirty code; syntax error; running; preview success/runtime failure; tests pass/fail; stale output; reset confirmation; solution reveal; reduced-motion simulator.

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
| domain states | Code changed; preview and tests are marked stale. Version 2 ran locally; preview and console now share that version. One test failed with a text explanation and no focus theft. Starter restored after confirmation; reduced-motion behavior remains equivalent. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, its critical relationship creates a distinct topology, and all responsive states preserve task and recovery parity.

### Reject

Reject when the need is an API console, production IDE, static sample, query builder, or generic form preview, or when the candidate only changes nouns, cards, or density from another archetype.

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
| [W3C WAI APG — Keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | Supports keyboard-complete interaction and visible focus. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [Apple HIG — Split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Supports adjacent-pane transformation. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports responsive region relationships and minimum touch targets. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "interactive-code-example-lab",
  "matchedSituationCodes": [
    "AR-ICL-01",
    "AR-ICL-02"
  ],
  "aliases": [
    "interactive-code-example-lab",
    "interactive code example lab"
  ],
  "dominantTask": "Learn one concept by editing a bounded code example and observing synchronized preview, console, and test evidence.",
  "regions": [
    "code-lab",
    "lesson-goal-and-instructions",
    "editable-code-region",
    "live-preview-or-simulator",
    "console-and-test-evidence",
    "reset-solution-controls",
    "explanation-and-next-step"
  ],
  "relationships": [
    "Code, preview, console, and tests share one explicit run version; editing marks prior output stale."
  ],
  "responsive": {
    "wide": "Coordinate instructions, editor, preview, and evidence panes; only code and console own bounded overflow.",
    "intermediate": "Collapse instructions and alternate preview with evidence while the run version stays visible.",
    "compact": "Stage instructions, editor, run, preview, tests, then explanation; explicit switches preserve code and output.",
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
