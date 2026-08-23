# Streaming log console

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `streaming-log-console` |
| Family | Work |
| Dominant task | Monitor a high-volume append-only event stream, control pause and follow position, find patterns, and inspect one event to isolate failure. |
| Search aliases | live logs, tail console, event stream inspector, follow output |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `log-console` owns the complete dominant task and its recovery boundary.
- Monitor a high-volume append-only event stream, control pause and follow position, find patterns, and inspect one event to isolate failure.
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact topology changes occur when a named relationship fails, never by device label.
- Responsive transformation preserves selection, draft, cursor, pending work, errors, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-SLC-01` | Monitor a high-volume append-only event stream, control pause and follow position, find patterns, and inspect one event to isolate failure. | Required positive evidence. |
| `AR-SLC-02` | Every required batch region and relationship is necessary to complete the task. | Require the complete region graph. |
| `AR-SLC-03` | A named simultaneous relationship fails at intermediate or compact while work state must survive transformation. | Require the three topology responses. |
| `AR-SLC-04` | Pending, error, conflict, or stale state can occur after the user creates work state. | Require recovery without lost input or focus meaning. |
| `AR-SLC-90` | The actual task is owned by audit timelines or terminal sessions. | Reject. |
| `AR-SLC-91` | Reject curated audit timelines, conversational feeds, terminal command sessions, and static code or file editors. | Reject. |
| `AR-SLC-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `streaming-log-console` if and only if `AR-SLC-01` through `AR-SLC-04` are evidenced, every required region and relationship is present, and none of `AR-SLC-90` through `AR-SLC-92` is present. Return `needs-evidence` when the dominant task, an owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
log-console
├─ stream-scope-and-query
├─ live-status-and-follow-controls
├─ bounded-log-viewport
├─ selected-event-context
└─ detail-or-export-actions
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `log-console` | Owns one stream scope, live position, query, and failure-isolation context. |
| `stream-scope-and-query` | Defines sources, time range, and pattern filter without changing selected event silently. |
| `live-status-and-follow-controls` | Own connection, pause, follow, resume-at-bottom, and backpressure state. |
| `bounded-log-viewport` | Owns high-volume vertical scroll, line identity, timestamps, wrapping policy, and selection. |
| `selected-event-context` | Explains the selected line and its structured fields without moving live position. |
| `detail-or-export-actions` | Owns payload disclosure, redaction notice, export pending, error, and retry. |

## Responsive contract

### Wide

- **Failure trigger:** Required simultaneous regions retain enough measure for reading, operation, and relationship comprehension.
- **Topology response:** Give the stream most space; keep query or command band and selected-event detail adjacent; preserve line identity and timestamp instead of cardizing each event.
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only actions or status bound to the current work object may be sticky; they reserve space and never obscure focus.
- **Overflow owner:** `bounded-log-viewport` owns vertical overflow; only a raw token subregion may own horizontal overflow; the page never does.

### Intermediate

- **Failure trigger:** The lowest-priority support starts to squeeze primary work, labels, or actions.
- **Topology response:** Make query controls collapsible and detail a drawer; retain readable log lines, explicit wrap policy, live status, pause, and follow controls.
- **Navigation replacement:** A labeled trigger opens the exact temporary pane or disclosure and preserves query, selection, draft, cursor, and return-focus target.
- **Sticky boundary:** Current scope and pending/error summary may persist but yield when height is insufficient.
- **Overflow owner:** `bounded-log-viewport` owns vertical overflow; only a raw token subregion may own horizontal overflow; the page never does.

### Compact

- **Failure trigger:** Two work regions cannot remain simultaneous with sufficient measure, 44px targets, and unobscured focus.
- **Topology response:** Use a full-width wrapped stream; constrain raw unbreakable tokens inside the line/detail owner; open filter and detail as sheets while pause/follow remains reachable.
- **Navigation replacement:** Named stages, tabs, or sheets replace direct simultaneity; Back restores exact filter, scroll, selection, draft, cursor, and trigger focus.
- **Sticky boundary:** The primary action is sticky only with reserved space, unobscured focus, and a short-height fallback to normal flow.
- **Overflow owner:** `bounded-log-viewport` owns vertical overflow; only a raw token subregion may own horizontal overflow; the page never does.

### Reflow

- DOM order, reading order, and meaningful focus order are `log-console → stream-scope-and-query → live-status-and-follow-controls → bounded-log-viewport → selected-event-context → detail-or-export-actions`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific parity includes connecting, live, paused, disconnected, reconnecting, empty range, burst/backpressure, query applied/error, selected event, truncated line, redacted payload, export pending/error, and resume-at-bottom.

## State obligations

Task-specific states: connecting, live, paused, disconnected, reconnecting, empty range, burst/backpressure, query applied/error, selected event, truncated line, redacted payload, export pending/error, and resume-at-bottom.

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

- An append-only stream, live-position policy, query, and selected-event isolation jointly own the work loop.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject curated audit timelines, conversational feeds, terminal command sessions, and static code or file editors.
- Reject when audit timelines or terminal sessions owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-SLC-90`, `AR-SLC-91`, or `AR-SLC-92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Elastic Explore logs](https://www.elastic.co/docs/solutions/observability/logs/explore-logs) | Current log exploration supports search, filtering, tailing, and failure investigation over one stream. | It does not define product sources, query language, or exact console geometry. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary and supporting regions adapt when simultaneous content no longer fits. | It does not supply fixed breakpoints or product components. |
| [W3C Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | DOM, reading, and focus order preserve task meaning through topology changes. | It does not define product keyboard shortcuts. |
| [W3C Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Sticky and temporary surfaces must not fully hide the focused control. | It does not select which surface should persist. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error, and live changes are announced without moving focus. | It does not define business state policy or copy. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `streaming-log-console`. |
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
  "archetypeId": "streaming-log-console",
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
