# Canvas inspector studio

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `canvas-inspector-studio` |
| Family | Work |
| Dominant task | Manipulate a spatial artifact directly and edit contextual properties of the current selection with an accessible object-list equivalent. |
| Search aliases | spatial canvas, object inspector, selection properties, accessible object list |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `studio` owns the complete dominant task and its recovery boundary.
- Manipulate a spatial artifact directly and edit contextual properties of the current selection with an accessible object-list equivalent.
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact topology changes occur when a named relationship fails, never by device label.
- Responsive transformation preserves selection, draft, cursor, pending work, errors, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-CIS-01` | Manipulate a spatial artifact directly and edit contextual properties of the current selection with an accessible object-list equivalent. | Required positive evidence. |
| `AR-CIS-02` | Every required batch region and relationship is necessary to complete the task. | Require the complete region graph. |
| `AR-CIS-03` | A named simultaneous relationship fails at intermediate or compact while work state must survive transformation. | Require the three topology responses. |
| `AR-CIS-04` | Pending, error, conflict, or stale state can occur after the user creates work state. | Require recovery without lost input or focus meaning. |
| `AR-CIS-90` | The actual task is owned by palette builders or workflow graph editors. | Reject. |
| `AR-CIS-91` | Reject palette-led assembly, text-flow authoring, read-only graph/map inspection, and executable workflow graphs. | Reject. |
| `AR-CIS-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `canvas-inspector-studio` if and only if `AR-CIS-01` through `AR-CIS-04` are evidenced, every required region and relationship is present, and none of `AR-CIS-90` through `AR-CIS-92` is present. Return `needs-evidence` when the dominant task, an owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
studio
├─ document-and-history-controls
├─ spatial-canvas
│  └─ canvas-tools
├─ current-selection
├─ contextual-inspector
└─ accessible-object-list
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `studio` | Owns one spatial document, selection model, transform history, and save boundary. |
| `document-and-history-controls` | Own document identity, dirty/save state, undo, redo, and conflict recovery. |
| `spatial-canvas` | Owns direct manipulation, bounded pan/zoom, spatial relationships, and visual selection. |
| `canvas-tools` | Choose manipulation mode and provide non-gesture equivalents. |
| `current-selection` | Synchronizes selected object identity across canvas, list, and inspector. |
| `contextual-inspector` | Edits only properties valid for the current selection and owns validation. |
| `accessible-object-list` | Provides ordered selection and actions equivalent to canvas-only hit testing. |

## Responsive contract

### Wide

- **Failure trigger:** Required simultaneous regions retain enough measure for reading, operation, and relationship comprehension.
- **Topology response:** Make the canvas primary; keep the inspector persistent when selection exists; keep tools compact and bound pan/zoom inside the canvas.
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only actions or status bound to the current work object may be sticky; they reserve space and never obscure focus.
- **Overflow owner:** `spatial-canvas` owns bounded pan/zoom overflow; the object list and inspector scroll vertically without page-level horizontal overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support starts to squeeze primary work, labels, or actions.
- **Topology response:** Collapse the inspector or make it temporary; condense essential tools with labels; preserve a usable canvas work area and selected-object summary.
- **Navigation replacement:** A labeled trigger opens the exact temporary pane or disclosure and preserves query, selection, draft, cursor, and return-focus target.
- **Sticky boundary:** Current scope and pending/error summary may persist but yield when height is insufficient.
- **Overflow owner:** `spatial-canvas` owns bounded pan/zoom overflow; the object list and inspector scroll vertically without page-level horizontal overflow.

### Compact

- **Failure trigger:** Two work regions cannot remain simultaneous with sufficient measure, 44px targets, and unobscured focus.
- **Topology response:** Default to the object list or focused-object stage when the canvas is too small; make canvas optional full-screen and inspector a sheet; preserve all non-gesture actions.
- **Navigation replacement:** Named stages, tabs, or sheets replace direct simultaneity; Back restores exact filter, scroll, selection, draft, cursor, and trigger focus.
- **Sticky boundary:** The primary action is sticky only with reserved space, unobscured focus, and a short-height fallback to normal flow.
- **Overflow owner:** `spatial-canvas` owns bounded pan/zoom overflow; the object list and inspector scroll vertically without page-level horizontal overflow.

### Reflow

- DOM order, reading order, and meaningful focus order are `studio → document-and-history-controls → spatial-canvas → canvas-tools → current-selection → contextual-inspector → accessible-object-list`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific parity includes document loading, no/single/multi selection, tool active, zoom/pan, unsaved/pending save, invalid property, locked object, external conflict, undo, and redo.

## State obligations

Task-specific states: document loading, no/single/multi selection, tool active, zoom/pan, unsaved/pending save, invalid property, locked object, external conflict, undo, and redo.

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

- A spatial artifact is directly manipulated and one shared selection drives a contextual inspector plus accessible object list.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject palette-led assembly, text-flow authoring, read-only graph/map inspection, and executable workflow graphs.
- Reject when palette builders or workflow graph editors owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-CIS-90`, `AR-CIS-91`, or `AR-CIS-92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Adobe Illustrator properties panel](https://helpx.adobe.com/in/illustrator/desktop/get-started/learn-the-basics/properties-panel-overview.html) | Contextual controls change with current selection while document controls remain distinct. | It does not authorize copying Illustrator tools, panels, or geometry. |
| [Apple split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Related primary and supplementary regions may coexist and later become temporary navigation destinations. | It does not authorize copying platform chrome or exact geometry. |
| [Adobe Spectrum components](https://spectrum.adobe.com/page/components/) | Editor controls expose labeled states, validation, and contextual actions. | It does not make a Spectrum component tree binding here. |
| [W3C APG grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Composite two-axis widgets require managed directional keyboard navigation and explicit edit mode. | It does not require ARIA grid when native table semantics are sufficient. |
| [W3C Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | DOM, reading, and focus order preserve task meaning through topology changes. | It does not define product keyboard shortcuts. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `canvas-inspector-studio`. |
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
  "archetypeId": "canvas-inspector-studio",
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
