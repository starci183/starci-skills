# Kanban swimlane board

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `kanban-swimlane-board` |
| Family | Work |
| Dominant task | Move work items through ordered states while preserving WIP policy and optional swimlane grouping context. |
| Search aliases | kanban, state lanes, swimlane work board, WIP move |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `work-board` owns the complete dominant task and its recovery boundary.
- Move work items through ordered states while preserving WIP policy and optional swimlane grouping context.
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact topology changes occur when a named relationship fails, never by device label.
- Responsive transformation preserves selection, draft, cursor, pending work, errors, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-KSB-01` | Move work items through ordered states while preserving WIP policy and optional swimlane grouping context. | Required positive evidence. |
| `AR-KSB-02` | Every required batch region and relationship is necessary to complete the task. | Require the complete region graph. |
| `AR-KSB-03` | A named simultaneous relationship fails at intermediate or compact while work state must survive transformation. | Require the three topology responses. |
| `AR-KSB-04` | Pending, error, conflict, or stale state can occur after the user creates work state. | Require recovery without lost input or focus meaning. |
| `AR-KSB-90` | The actual task is owned by resource scheduling or workflow automation graphs. | Reject. |
| `AR-KSB-91` | Reject time allocation, card catalogs, batch tables, and executable node-edge workflows. | Reject. |
| `AR-KSB-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `kanban-swimlane-board` if and only if `AR-KSB-01` through `AR-KSB-04` are evidenced, every required region and relationship is present, and none of `AR-KSB-90` through `AR-KSB-92` is present. Return `needs-evidence` when the dominant task, an owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
work-board
├─ board-scope-and-filters
├─ ordered-state-lanes
│  ├─ optional-swimlanes
│  └─ work-item-cards
├─ wip-and-policy-feedback
└─ selected-item-inspector
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `work-board` | Owns one ordered workflow state model and move history. |
| `board-scope-and-filters` | Narrows visible work without changing lane semantics or hidden WIP counts. |
| `ordered-state-lanes` | Own workflow order, destination identity, and lane-level WIP. |
| `optional-swimlanes` | Group the same ordered lanes by a second stable dimension. |
| `work-item-cards` | Represent movable work identity, state, and explicit move action. |
| `wip-and-policy-feedback` | Explains limits, rejected moves, and allowed recovery outside color. |
| `selected-item-inspector` | Shows selected item context without owning workflow state order. |

## Responsive contract

### Wide

- **Failure trigger:** Required simultaneous regions retain enough measure for reading, operation, and relationship comprehension.
- **Topology response:** Show multiple ordered lanes in one bounded board with associated headings and WIP; the inspector overlays or uses support space without reordering lanes.
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only actions or status bound to the current work object may be sticky; they reserve space and never obscure focus.
- **Overflow owner:** `ordered-state-lanes` owns bounded horizontal overflow at wide/intermediate; compact lane paging removes horizontal page overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support starts to squeeze primary work, labels, or actions.
- **Topology response:** Show two or three lanes in a bounded scroller or explicit lane paging; keep swimlane identity persistent and make item inspection temporary.
- **Navigation replacement:** A labeled trigger opens the exact temporary pane or disclosure and preserves query, selection, draft, cursor, and return-focus target.
- **Sticky boundary:** Current scope and pending/error summary may persist but yield when height is insufficient.
- **Overflow owner:** `ordered-state-lanes` owns bounded horizontal overflow at wide/intermediate; compact lane paging removes horizontal page overflow.

### Compact

- **Failure trigger:** Two work regions cannot remain simultaneous with sufficient measure, 44px targets, and unobscured focus.
- **Topology response:** Show one selected lane with stacked items and a lane selector; move through an explicit destination chooser instead of horizontal drag.
- **Navigation replacement:** Named stages, tabs, or sheets replace direct simultaneity; Back restores exact filter, scroll, selection, draft, cursor, and trigger focus.
- **Sticky boundary:** The primary action is sticky only with reserved space, unobscured focus, and a short-height fallback to normal flow.
- **Overflow owner:** `ordered-state-lanes` owns bounded horizontal overflow at wide/intermediate; compact lane paging removes horizontal page overflow.

### Reflow

- DOM order, reading order, and meaningful focus order are `work-board → board-scope-and-filters → ordered-state-lanes → optional-swimlanes → work-item-cards → wip-and-policy-feedback → selected-item-inspector`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific parity includes board/lane loading, lane empty, filters applied, item selected, move pending/success/rejected, WIP exceeded, stale item, permission, lane unavailable, and undo.

## State obligations

Task-specific states: board/lane loading, lane empty, filters applied, item selected, move pending/success/rejected, WIP exceeded, stale item, permission, lane unavailable, and undo.

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

- Lane position is workflow state, optional swimlanes preserve grouping, and WIP policy can accept or reject a move.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject time allocation, card catalogs, batch tables, and executable node-edge workflows.
- Reject when resource scheduling or workflow automation graphs owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-KSB-90`, `AR-KSB-91`, or `AR-KSB-92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Atlassian Kanban WIP limits](https://support.atlassian.com/jira-software-cloud/docs/configure-columns/) | Columns map workflow states and constraints can make a destination unavailable. | It does not define this product’s states, limits, or board geometry. |
| [IBM Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Relational scanning, selection, sorting, expansion, and actions remain table-owned. | It does not define product fields, density, or breakpoint values. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary and supporting regions adapt when simultaneous content no longer fits. | It does not supply fixed breakpoints or product components. |
| [W3C APG dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | A modal surface moves focus inside, contains it, closes predictably, and restores the trigger. | It does not decide when a supporting region must be modal. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error, and live changes are announced without moving focus. | It does not define business state policy or copy. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `kanban-swimlane-board`. |
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
  "archetypeId": "kanban-swimlane-board",
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
