# Workflow automation builder

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `workflow-automation-builder` |
| Family | Work |
| Dominant task | Build and connect an executable multi-step and branching workflow, configure nodes, validate paths, simulate evidence, and activate a version safely. |
| Search aliases | automation graph, branching workflow, node configuration, simulation trace |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `automation-builder` owns the complete dominant task and its recovery boundary.
- Build and connect an executable multi-step and branching workflow, configure nodes, validate paths, simulate evidence, and activate a version safely.
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact topology changes occur when a named relationship fails, never by device label.
- Responsive transformation preserves selection, draft, cursor, pending work, errors, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-WAB-01` | Build and connect an executable multi-step and branching workflow, configure nodes, validate paths, simulate evidence, and activate a version safely. | Required positive evidence. |
| `AR-WAB-02` | Every required batch region and relationship is necessary to complete the task. | Require the complete region graph. |
| `AR-WAB-03` | A named simultaneous relationship fails at intermediate or compact while work state must survive transformation. | Require the three topology responses. |
| `AR-WAB-04` | Pending, error, conflict, or stale state can occur after the user creates work state. | Require recovery without lost input or focus meaning. |
| `AR-WAB-90` | The actual task is owned by palette builders or rule sets. | Reject. |
| `AR-WAB-91` | Reject block composition without execution, end-user wizards, kanban boards, and rule sets without step/path orchestration. | Reject. |
| `AR-WAB-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `workflow-automation-builder` if and only if `AR-WAB-01` through `AR-WAB-04` are evidenced, every required region and relationship is present, and none of `AR-WAB-90` through `AR-WAB-92` is present. Return `needs-evidence` when the dominant task, an owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
automation-builder
├─ workflow-version-and-status
├─ trigger-and-step-palette
├─ executable-edge-graph
│  ↔ accessible-branch-outline
├─ selected-node-config
├─ path-validation
├─ simulation-inputs
├─ time-ordered-simulation-trace
└─ review-and-activate
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `automation-builder` | Owns one executable workflow version, graph/outline selection, simulation, activation, and rollback. |
| `workflow-version-and-status` | Names draft/active version, stale base, permission, and rollback target. |
| `trigger-and-step-palette` | Supplies executable node types and insertion intent without owning path order. |
| `executable-edge-graph` | Owns spatial node-edge relationships, branch semantics, bounded pan/zoom, and selected path. |
| `accessible-branch-outline` | Owns an equivalent ordered branch model and every connect/remove action for non-canvas navigation. |
| `selected-node-config` | Edits trigger/step inputs for the shared selected node and owns field errors. |
| `path-validation` | Detects missing, unreachable, cyclic, or invalid parallel paths and gates simulation. |
| `simulation-inputs` | Owns representative test inputs and queued/running state. |
| `time-ordered-simulation-trace` | Records per-step input, output, branch decision, timing order, and failure evidence. |
| `review-and-activate` | Blocks activation until path and trace evidence pass; owns conflict and rollback recovery. |

## Responsive contract

### Wide

- **Failure trigger:** Required simultaneous regions retain enough measure for reading, operation, and relationship comprehension.
- **Topology response:** Inspect executable graph or outline, node config, and simulation trace together; graph owns pan/zoom while trace remains durable run evidence.
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only actions or status bound to the current work object may be sticky; they reserve space and never obscure focus.
- **Overflow owner:** `executable-edge-graph` owns bounded pan/zoom; the outline and simulation trace own vertical stage scrolling; the page never owns horizontal overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support starts to squeeze primary work, labels, or actions.
- **Topology response:** Make palette a drawer; alternate config and trace as named supporting panes while graph/outline retains active node, branch, and simulated path.
- **Navigation replacement:** A labeled trigger opens the exact temporary pane or disclosure and preserves query, selection, draft, cursor, and return-focus target.
- **Sticky boundary:** Current scope and pending/error summary may persist but yield when height is insufficient.
- **Overflow owner:** `executable-edge-graph` owns bounded pan/zoom; the outline and simulation trace own vertical stage scrolling; the page never owns horizontal overflow.

### Compact

- **Failure trigger:** Two work regions cannot remain simultaneous with sufficient measure, 44px targets, and unobscured focus.
- **Topology response:** Make the accessible branch outline primary; sequence choose node, configure, connect branch, simulate, inspect full trace, then activate; graph is optional.
- **Navigation replacement:** Named stages, tabs, or sheets replace direct simultaneity; Back restores exact filter, scroll, selection, draft, cursor, and trigger focus.
- **Sticky boundary:** The primary action is sticky only with reserved space, unobscured focus, and a short-height fallback to normal flow.
- **Overflow owner:** `executable-edge-graph` owns bounded pan/zoom; the outline and simulation trace own vertical stage scrolling; the page never owns horizontal overflow.

### Reflow

- DOM order, reading order, and meaningful focus order are `automation-builder → workflow-version-and-status → trigger-and-step-palette → executable-edge-graph → accessible-branch-outline → selected-node-config → path-validation → simulation-inputs → time-ordered-simulation-trace → review-and-activate`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific parity includes draft loading/empty, node/edge add/remove/connect, parallel branch, invalid/unreachable/cyclic path, config error, simulation queued/running/pass/fail with per-step trace, version stale, activate pending/conflict, permission, and rollback.

## State obligations

Task-specific states: draft loading/empty, node/edge add/remove/connect, parallel branch, invalid/unreachable/cyclic path, config error, simulation queued/running/pass/fail with per-step trace, version stale, activate pending/conflict, permission, and rollback.

| State family | Required behavior |
|---|---|
| Initial / loading | Name the loading scope, reserve the primary region, and block only the failed region. |
| Ready | Expose the current object, selection or cursor, owner relationship, and valid actions through text and semantics. |
| Empty / not-applicable | Distinguish true empty, filter no-match, and non-applicable states with an appropriate next action. |
| Error / retry | Name the failed scope, retain input and work state, and provide a focused retry or correction target. |
| Permission / unavailable | Explain the restriction in text; read-only differs from disabled and retains context needed for understanding. |
| Pending | Prevent duplicates, retain context, expose Cancel when safe, and announce progress without stealing focus. |
| Success | Confirm the exact changed scope, update related summaries, and preserve Undo or the next step when required. |
| Stale / conflict | Compare local and external state, never overwrite silently, and retain deterministic recovery. |
| Focus transition | A user-triggered stage change focuses the new heading; status-only updates do not move focus; modals return to the trigger. |
| Responsive presentation | Wide retains required simultaneity; intermediate makes the lowest support temporary; compact uses one primary stage while retaining actions, state, and recovery. |

## Boundaries

### Accept

- Executable nodes and edges own path semantics, an accessible outline has full parity, and activation depends on path validation plus time-ordered simulation evidence.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject block composition without execution, end-user wizards, kanban boards, and rule sets without step/path orchestration.
- Reject when palette builders or rule sets owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-WAB-90`, `AR-WAB-91`, or `AR-WAB-92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

## Handoff

1. Business truth supplies actors, objects, rules, permissions, state transitions, and completion consequences.
2. This archetype resolves the dominant task, region graph, responsive replacement, semantic order, and parity.
3. Grammar binds product-semantic owners to regions and states without changing topology.
4. Principles resolve exact grid, measure, gap, size, alignment, overflow, and content-fit breakpoints.
5. Direction expresses visual character inside accepted owners.

## Non-binding research evidence

### Evidence boundary

The research below is advisory evidence, not product truth. It does not authorize copying geometry, component trees, product nouns, breakpoints, or visual treatment; every binding claim still routes through business truth, Grammar, and Principles.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [GitHub Actions job dependencies](https://docs.github.com/en/actions/how-tos/write-runtime/workflows/choose-what-workflows-do/use-jobs) | Executable jobs form prerequisite paths and failures propagate through dependent branches. | It does not make GitHub workflow syntax, job types, or graph geometry product truth. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary and supporting regions adapt when simultaneous content no longer fits. | It does not supply fixed breakpoints or product components. |
| [Apple split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Related primary and supplementary regions may coexist and later become temporary navigation destinations. | It does not authorize copying platform chrome or exact geometry. |
| [W3C APG grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Composite two-axis widgets require managed directional keyboard navigation and explicit edit mode. | It does not require ARIA grid when native table semantics are sufficient. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error, and live changes are announced without moving focus. | It does not define business state policy or copy. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `workflow-automation-builder`. |
| `situationCodes` | Matched codes from this record. |
| `searchAliases` | Routed aliases that led to the match. |
| `dominantTask` | One product-neutral task sentence. |
| `regions` | Ordered required region IDs. |
| `regionRelationships` | Owner, peer, supporting, temporary, and downstream relationships. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, and `interactionParity`. |
| `stateObligations` | Applicable task-specific and common state families. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Product-semantic region and state owners left to Grammar. |
| `principlesHandoff` | Exact geometry, fit thresholds, and emitted layout left to Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Business/current-source/research evidence classes without invented facts. |

```json
{
  "archetypeId": "workflow-automation-builder",
  "situationCodes": [],
  "searchAliases": [],
  "dominantTask": "",
  "regions": [],
  "regionRelationships": [],
  "responsive": {
    "wide": "", "intermediate": "", "compact": "", "reflow": "",
    "readingOrder": "", "navigationReplacement": "", "stickyBehavior": "",
    "overflowOwner": "", "interactionParity": ""
  },
  "stateObligations": [],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [],
  "principlesHandoff": [],
  "confidence": "low",
  "evidence": []
}
```
