# Calendar resource scheduler

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `calendar-resource-scheduler` |
| Family | Work |
| Dominant task | Allocate resources into time slots, detect collisions, and adjust assignments until the schedule is feasible. |
| Search aliases | resource calendar, allocation timeline, collision scheduler, unscheduled queue |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `scheduler` owns the complete dominant task and its recovery boundary.
- Allocate resources into time slots, detect collisions, and adjust assignments until the schedule is feasible.
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact topology changes occur when a named relationship fails, never by device label.
- Responsive transformation preserves selection, draft, cursor, pending work, errors, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-CRS-01` | Allocate resources into time slots, detect collisions, and adjust assignments until the schedule is feasible. | Required positive evidence. |
| `AR-CRS-02` | Every required batch region and relationship is necessary to complete the task. | Require the complete region graph. |
| `AR-CRS-03` | A named simultaneous relationship fails at intermediate or compact while work state must survive transformation. | Require the three topology responses. |
| `AR-CRS-04` | Pending, error, conflict, or stale state can occur after the user creates work state. | Require recovery without lost input or focus meaning. |
| `AR-CRS-90` | The actual task is owned by calendar browsing or kanban boards. | Reject. |
| `AR-CRS-91` | Reject read-only calendars, kanban state movement, audit timelines, and event forms without resource allocation or collision work. | Reject. |
| `AR-CRS-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `calendar-resource-scheduler` if and only if `AR-CRS-01` through `AR-CRS-04` are evidenced, every required region and relationship is present, and none of `AR-CRS-90` through `AR-CRS-92` is present. Return `needs-evidence` when the dominant task, an owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
scheduler
├─ date-range-and-view-controls
├─ resource-axis
├─ time-axis-grid
├─ unscheduled-work-queue
├─ selected-assignment-editor
└─ conflict-feedback
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `scheduler` | Owns one feasible-allocation problem, selected date/resource, and recovery history. |
| `date-range-and-view-controls` | Set horizon, timezone, and view while preserving selected assignment. |
| `resource-axis` | Names allocatable resources and availability against the shared time axis. |
| `time-axis-grid` | Owns resource-time intersections, placement, bounded two-axis navigation, and collision locations. |
| `unscheduled-work-queue` | Owns work awaiting placement and links each item to explicit schedule controls. |
| `selected-assignment-editor` | Edits resource, time, duration, recurrence, and confirmation for one assignment. |
| `conflict-feedback` | Names colliding assignments, blocks unsafe commitment, and offers resolution/undo. |

## Responsive contract

### Wide

- **Failure trigger:** Required simultaneous regions retain enough measure for reading, operation, and relationship comprehension.
- **Topology response:** Keep the resource-time grid simultaneous with the unscheduled queue and contextual editor when each remains usable; the scheduler owns two-axis overflow and headers.
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only actions or status bound to the current work object may be sticky; they reserve space and never obscure focus.
- **Overflow owner:** `time-axis-grid` alone owns bounded two-axis overflow; compact agenda removes horizontal page overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support starts to squeeze primary work, labels, or actions.
- **Topology response:** Reduce time horizon or resource set; make queue/editor collapsible; keep conflict summary and selected time/resource visible.
- **Navigation replacement:** A labeled trigger opens the exact temporary pane or disclosure and preserves query, selection, draft, cursor, and return-focus target.
- **Sticky boundary:** Current scope and pending/error summary may persist but yield when height is insufficient.
- **Overflow owner:** `time-axis-grid` alone owns bounded two-axis overflow; compact agenda removes horizontal page overflow.

### Compact

- **Failure trigger:** Two work regions cannot remain simultaneous with sufficient measure, 44px targets, and unobscured focus.
- **Topology response:** Use an agenda-first or one-resource/one-day stage; open unscheduled work and assignment editing as sheets; provide explicit add/move controls instead of drag-only placement.
- **Navigation replacement:** Named stages, tabs, or sheets replace direct simultaneity; Back restores exact filter, scroll, selection, draft, cursor, and trigger focus.
- **Sticky boundary:** The primary action is sticky only with reserved space, unobscured focus, and a short-height fallback to normal flow.
- **Overflow owner:** `time-axis-grid` alone owns bounded two-axis overflow; compact agenda removes horizontal page overflow.

### Reflow

- DOM order, reading order, and meaningful focus order are `scheduler → date-range-and-view-controls → resource-axis → time-axis-grid → unscheduled-work-queue → selected-assignment-editor → conflict-feedback`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific parity includes range/resource loading, no availability, tentative/confirmed assignment, collision, recurrence, timezone, move pending, external schedule conflict, permission, undo, and recovery.

## State obligations

Task-specific states: range/resource loading, no availability, tentative/confirmed assignment, collision, recurrence, timezone, move pending, external schedule conflict, permission, undo, and recovery.

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

- Resource-time intersections, unscheduled work, and collision resolution determine whether allocation is feasible.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject read-only calendars, kanban state movement, audit timelines, and event forms without resource allocation or collision work.
- Reject when calendar browsing or kanban boards owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-CRS-90`, `AR-CRS-91`, or `AR-CRS-92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [FullCalendar event dragging and constraints](https://fullcalendar.io/docs/event-dragging-resizing) | Resource and time movement, overlap constraints, and rejected placement expose scheduling consequences. | It does not prescribe drag-only interaction, product resources, or exact layout. |
| [Apple split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Related primary and supplementary regions may coexist and later become temporary navigation destinations. | It does not authorize copying platform chrome or exact geometry. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary and supporting regions adapt when simultaneous content no longer fits. | It does not supply fixed breakpoints or product components. |
| [W3C APG grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Composite two-axis widgets require managed directional keyboard navigation and explicit edit mode. | It does not require ARIA grid when native table semantics are sufficient. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error, and live changes are announced without moving focus. | It does not define business state policy or copy. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `calendar-resource-scheduler`. |
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
  "archetypeId": "calendar-resource-scheduler",
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
