# Document outline editor

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `document-outline-editor` |
| Family | Work |
| Dominant task | Author a long-form structured document while navigating its outline, formatting text flow, and resolving comments anchored to text locations. |
| Search aliases | long-form editor, document outline, anchored comments, structured authoring |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `document-editor` owns the complete dominant task and its recovery boundary.
- Author a long-form structured document while navigating its outline, formatting text flow, and resolving comments anchored to text locations.
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact topology changes occur when a named relationship fails, never by device label.
- Responsive transformation preserves selection, draft, cursor, pending work, errors, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-DOE-01` | Author a long-form structured document while navigating its outline, formatting text flow, and resolving comments anchored to text locations. | Required positive evidence. |
| `AR-DOE-02` | Every required batch region and relationship is necessary to complete the task. | Require the complete region graph. |
| `AR-DOE-03` | A named simultaneous relationship fails at intermediate or compact while work state must survive transformation. | Require the three topology responses. |
| `AR-DOE-04` | Pending, error, conflict, or stale state can occur after the user creates work state. | Require recovery without lost input or focus meaning. |
| `AR-DOE-90` | The actual task is owned by reading annotation or block building. | Reject. |
| `AR-DOE-91` | Reject reading-only manuscripts, spatial canvases, code editors, and block builders whose reusable components own structure. | Reject. |
| `AR-DOE-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `document-outline-editor` if and only if `AR-DOE-01` through `AR-DOE-04` are evidenced, every required region and relationship is present, and none of `AR-DOE-90` through `AR-DOE-92` is present. Return `needs-evidence` when the dominant task, an owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
document-editor
├─ document-status-and-actions
├─ hierarchical-outline
├─ flow-editor
│  └─ formatting-controls
├─ anchored-comments
└─ revision-or-save-feedback
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `document-editor` | Owns one structured text flow, selection, comment anchors, and revision state. |
| `document-status-and-actions` | Names title, permission, offline/online state, save status, and document-level actions. |
| `hierarchical-outline` | Navigates heading hierarchy and returns to the exact text anchor. |
| `flow-editor` | Owns primary text insertion, selection, semantic structure, and readable measure. |
| `formatting-controls` | Act on current editor selection without becoming an unsynchronized second editor. |
| `anchored-comments` | Own comments, replies, resolve state, and exact text-anchor return. |
| `revision-or-save-feedback` | Owns autosave pending/error, offline draft, stale revision, conflict, and recovery. |

## Responsive contract

### Wide

- **Failure trigger:** Required simultaneous regions retain enough measure for reading, operation, and relationship comprehension.
- **Topology response:** Keep outline, optimal editor measure, and anchored comments simultaneous only when each remains usable; formatting acts on editor selection.
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only actions or status bound to the current work object may be sticky; they reserve space and never obscure focus.
- **Overflow owner:** The text editor and comment list scroll vertically in their active stage; no horizontal page or toolbar overflow is allowed.

### Intermediate

- **Failure trigger:** The lowest-priority support starts to squeeze primary work, labels, or actions.
- **Topology response:** Keep one support rail persistent and move outline or comments to a drawer according to the current subtask; never squeeze editor measure.
- **Navigation replacement:** A labeled trigger opens the exact temporary pane or disclosure and preserves query, selection, draft, cursor, and return-focus target.
- **Sticky boundary:** Current scope and pending/error summary may persist but yield when height is insufficient.
- **Overflow owner:** The text editor and comment list scroll vertically in their active stage; no horizontal page or toolbar overflow is allowed.

### Compact

- **Failure trigger:** Two work regions cannot remain simultaneous with sufficient measure, 44px targets, and unobscured focus.
- **Topology response:** Use a single-column editor; open outline and comments as named sheets/screens that return to the exact text anchor; group formatting without toolbar spill.
- **Navigation replacement:** Named stages, tabs, or sheets replace direct simultaneity; Back restores exact filter, scroll, selection, draft, cursor, and trigger focus.
- **Sticky boundary:** The primary action is sticky only with reserved space, unobscured focus, and a short-height fallback to normal flow.
- **Overflow owner:** The text editor and comment list scroll vertically in their active stage; no horizontal page or toolbar overflow is allowed.

### Reflow

- DOM order, reading order, and meaningful focus order are `document-editor → document-status-and-actions → hierarchical-outline → flow-editor → formatting-controls → anchored-comments → revision-or-save-feedback`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific parity includes document loading, empty first draft, text selection/formatting, comment open/resolved/orphaned, autosave pending/error, offline/stale revision, external conflict, permission/read-only, undo, and redo.

## State obligations

Task-specific states: document loading, empty first draft, text selection/formatting, comment open/resolved/orphaned, autosave pending/error, offline/stale revision, external conflict, permission/read-only, undo, and redo.

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

- Long-form text flow, outline hierarchy, formatting selection, and comments anchored to text jointly own the authoring loop.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject reading-only manuscripts, spatial canvases, code editors, and block builders whose reusable components own structure.
- Reject when reading annotation or block building owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-DOE-90`, `AR-DOE-91`, or `AR-DOE-92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Google Docs comments with a screen reader](https://support.google.com/docs/answer/6239410?hl=en) | Comments bind to selected text, expose next/previous navigation, and return focus to content. | It does not define product document structure or exact editor layout. |
| [Apple split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Related primary and supplementary regions may coexist and later become temporary navigation destinations. | It does not authorize copying platform chrome or exact geometry. |
| [Adobe Spectrum components](https://spectrum.adobe.com/page/components/) | Editor controls expose labeled states, validation, and contextual actions. | It does not make a Spectrum component tree binding here. |
| [W3C Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | DOM, reading, and focus order preserve task meaning through topology changes. | It does not define product keyboard shortcuts. |
| [W3C Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Sticky and temporary surfaces must not fully hide the focused control. | It does not select which surface should persist. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `document-outline-editor`. |
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
  "archetypeId": "document-outline-editor",
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
