# Conversation room

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `conversation-room` |
| Family | Work |
| Dominant task | Read and continue a live chronological thread while preserving unread position, composer draft, room context, and scroll intent. |
| Search aliases | live thread, chat room, persistent composer, unread position |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `conversation-room` owns the complete dominant task and its recovery boundary.
- Read and continue a live chronological thread while preserving unread position, composer draft, room context, and scroll intent.
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact topology changes occur when a named relationship fails, never by device label.
- Responsive transformation preserves selection, draft, cursor, pending work, errors, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-CRM-01` | Read and continue a live chronological thread while preserving unread position, composer draft, room context, and scroll intent. | Required positive evidence. |
| `AR-CRM-02` | Every required batch region and relationship is necessary to complete the task. | Require the complete region graph. |
| `AR-CRM-03` | A named simultaneous relationship fails at intermediate or compact while work state must survive transformation. | Require the three topology responses. |
| `AR-CRM-04` | Pending, error, conflict, or stale state can occur after the user creates work state. | Require recovery without lost input or focus meaning. |
| `AR-CRM-90` | The actual task is owned by inbox triage or live support sessions. | Reject. |
| `AR-CRM-91` | Reject inbox triage, passive activity feeds, ticket decision queues, time-bound media comments, and live-support rooms requiring a shared stage or remote-control consent. | Reject. |
| `AR-CRM-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `conversation-room` if and only if `AR-CRM-01` through `AR-CRM-04` are evidenced, every required region and relationship is present, and none of `AR-CRM-90` through `AR-CRM-92` is present. Return `needs-evidence` when the dominant task, an owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
conversation-room
├─ room-and-live-status
├─ chronological-thread
│  └─ unread-position
├─ persistent-composer
├─ participants-pins-and-files-context
└─ message-actions
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `conversation-room` | Owns one room identity, chronological history, read position, composer draft, and connection state. |
| `room-and-live-status` | Names room, participant summary, live/disconnected/reconnecting state, and permissions. |
| `chronological-thread` | Owns message order, history loading, new arrivals, vertical scroll, and message focus. |
| `unread-position` | Marks the stable boundary between read history and unread arrivals without color alone. |
| `persistent-composer` | Owns draft, attachment state, send pending/error/retry, and duplicate prevention. |
| `participants-pins-and-files-context` | Owns supporting room context and returns focus/scroll to its trigger. |
| `message-actions` | Own edit/delete/retry and conflict for a selected message without changing room order silently. |

## Responsive contract

### Wide

- **Failure trigger:** Required simultaneous regions retain enough measure for reading, operation, and relationship comprehension.
- **Topology response:** Keep thread and contextual rail simultaneous; reserve composer space within the room; treat optional room navigation as outside this leaf.
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only actions or status bound to the current work object may be sticky; they reserve space and never obscure focus.
- **Overflow owner:** `chronological-thread` owns vertical message overflow; composer and page never own horizontal overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support starts to squeeze primary work, labels, or actions.
- **Topology response:** Make the context rail a drawer; retain thread measure and composer as primary; keep pins/participant summary reachable.
- **Navigation replacement:** A labeled trigger opens the exact temporary pane or disclosure and preserves query, selection, draft, cursor, and return-focus target.
- **Sticky boundary:** Current scope and pending/error summary may persist but yield when height is insufficient.
- **Overflow owner:** `chronological-thread` owns vertical message overflow; composer and page never own horizontal overflow.

### Compact

- **Failure trigger:** Two work regions cannot remain simultaneous with sufficient measure, 44px targets, and unobscured focus.
- **Topology response:** Use a full-width thread; keep composer safe-area sticky with reserved space but yield at short height; open context as a sheet and show Jump to latest only away from the live edge.
- **Navigation replacement:** Named stages, tabs, or sheets replace direct simultaneity; Back restores exact filter, scroll, selection, draft, cursor, and trigger focus.
- **Sticky boundary:** The primary action is sticky only with reserved space, unobscured focus, and a short-height fallback to normal flow.
- **Overflow owner:** `chronological-thread` owns vertical message overflow; composer and page never own horizontal overflow.

### Reflow

- DOM order, reading order, and meaningful focus order are `conversation-room → room-and-live-status → chronological-thread → unread-position → persistent-composer → participants-pins-and-files-context → message-actions`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific parity includes initial/history loading, empty new room, live/disconnected/reconnecting, unread/new messages, send pending/error/retry, draft, edit/delete conflict, attachment unavailable, permission/muted, and focus after send or arrival.

## State obligations

Task-specific states: initial/history loading, empty new room, live/disconnected/reconnecting, unread/new messages, send pending/error/retry, draft, edit/delete conflict, attachment unavailable, permission/muted, and focus after send or arrival.

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

- Chronological reading, unread position, live arrival policy, and persistent composer draft jointly own the room loop.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject inbox triage, passive activity feeds, ticket decision queues, time-bound media comments, and live-support rooms requiring a shared stage or remote-control consent.
- Reject when inbox triage or live support sessions owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-CRM-90`, `AR-CRM-91`, or `AR-CRM-92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Slack keyboard shortcuts](https://slack.com/help/articles/201374536-Slack-keyboard-shortcuts) | Conversation navigation, composer access, message actions, and sidebar access require keyboard paths. | It does not define product rooms, message policy, or responsive geometry. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary and supporting regions adapt when simultaneous content no longer fits. | It does not supply fixed breakpoints or product components. |
| [Apple split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Related primary and supplementary regions may coexist and later become temporary navigation destinations. | It does not authorize copying platform chrome or exact geometry. |
| [W3C Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Sticky and temporary surfaces must not fully hide the focused control. | It does not select which surface should persist. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error, and live changes are announced without moving focus. | It does not define business state policy or copy. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `conversation-room`. |
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
  "archetypeId": "conversation-room",
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
