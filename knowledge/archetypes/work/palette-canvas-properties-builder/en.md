# Palette canvas properties builder

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `palette-canvas-properties-builder` |
| Family | Work |
| Dominant task | Assemble an ordered or nested structure by choosing reusable blocks, placing them in a composition, and configuring the selected block. |
| Search aliases | block builder, component palette, structure canvas, property inspector |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `builder` owns the complete dominant task and its recovery boundary.
- Assemble an ordered or nested structure by choosing reusable blocks, placing them in a composition, and configuring the selected block.
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact topology changes occur when a named relationship fails, never by device label.
- Responsive transformation preserves selection, draft, cursor, pending work, errors, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-PCB-01` | Assemble an ordered or nested structure by choosing reusable blocks, placing them in a composition, and configuring the selected block. | Required positive evidence. |
| `AR-PCB-02` | Every required batch region and relationship is necessary to complete the task. | Require the complete region graph. |
| `AR-PCB-03` | A named simultaneous relationship fails at intermediate or compact while work state must survive transformation. | Require the three topology responses. |
| `AR-PCB-04` | Pending, error, conflict, or stale state can occur after the user creates work state. | Require recovery without lost input or focus meaning. |
| `AR-PCB-90` | The actual task is owned by canvas inspection or workflow automation. | Reject. |
| `AR-PCB-91` | Reject single-artifact canvas inspection, executable workflow branches, field-only forms, and file hierarchy editing. | Reject. |
| `AR-PCB-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `palette-canvas-properties-builder` if and only if `AR-PCB-01` through `AR-PCB-04` are evidenced, every required region and relationship is present, and none of `AR-PCB-90` through `AR-PCB-92` is present. Return `needs-evidence` when the dominant task, an owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
builder
├─ component-palette
├─ structure-canvas
│  └─ insertion-and-order-controls
├─ selected-block
├─ property-inspector
└─ structure-outline-and-validation
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `builder` | Owns one composed structure, selection, validation, history, and save boundary. |
| `component-palette` | Owns reusable block discovery and insertion intent, not the resulting structure. |
| `structure-canvas` | Owns nesting, sibling order, insertion target, and composed preview. |
| `insertion-and-order-controls` | Provide add, move, indent, outdent, and reorder equivalents to drag. |
| `selected-block` | Synchronizes the selected structural node across canvas, outline, and inspector. |
| `property-inspector` | Configures valid selected-block properties and owns inline errors. |
| `structure-outline-and-validation` | Navigates hierarchy, exposes invalid placement, and gates save. |

## Responsive contract

### Wide

- **Failure trigger:** Required simultaneous regions retain enough measure for reading, operation, and relationship comprehension.
- **Topology response:** Keep palette, canvas, and properties simultaneous only while all three remain usable; use the outline for structure navigation rather than a separate browsing task.
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only actions or status bound to the current work object may be sticky; they reserve space and never obscure focus.
- **Overflow owner:** The structure canvas and outline own bounded vertical navigation; no page-level horizontal overflow or drag-only region is permitted.

### Intermediate

- **Failure trigger:** The lowest-priority support starts to squeeze primary work, labels, or actions.
- **Topology response:** Make palette a drawer; keep canvas and collapsible properties; keep insertion target and selected-block summary visible.
- **Navigation replacement:** A labeled trigger opens the exact temporary pane or disclosure and preserves query, selection, draft, cursor, and return-focus target.
- **Sticky boundary:** Current scope and pending/error summary may persist but yield when height is insufficient.
- **Overflow owner:** The structure canvas and outline own bounded vertical navigation; no page-level horizontal overflow or drag-only region is permitted.

### Compact

- **Failure trigger:** Two work regions cannot remain simultaneous with sufficient measure, 44px targets, and unobscured focus.
- **Topology response:** Sequence choose block, place/reorder, then configure; make the structure outline the primary navigator and preserve add/move button equivalents.
- **Navigation replacement:** Named stages, tabs, or sheets replace direct simultaneity; Back restores exact filter, scroll, selection, draft, cursor, and trigger focus.
- **Sticky boundary:** The primary action is sticky only with reserved space, unobscured focus, and a short-height fallback to normal flow.
- **Overflow owner:** The structure canvas and outline own bounded vertical navigation; no page-level horizontal overflow or drag-only region is permitted.

### Reflow

- DOM order, reading order, and meaningful focus order are `builder → component-palette → structure-canvas → insertion-and-order-controls → selected-block → property-inspector → structure-outline-and-validation`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific parity includes palette loading/empty, valid/invalid insertion, selected block, property validation, nested/reordered item, duplicate/remove, unsaved, save pending/conflict, undo, and redo.

## State obligations

Task-specific states: palette loading/empty, valid/invalid insertion, selected block, property validation, nested/reordered item, duplicate/remove, unsaved, save pending/conflict, undo, and redo.

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

- A reusable palette inserts blocks, a structure owner orders or nests them, and an inspector configures the selected block.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject single-artifact canvas inspection, executable workflow branches, field-only forms, and file hierarchy editing.
- Reject when canvas inspection or workflow automation owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-PCB-90`, `AR-PCB-91`, or `AR-PCB-92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Webflow Designer element hierarchy](https://developers.webflow.com/designer/reference/creating-retrieving-elements) | Reusable elements can be inserted before, after, inside, or around a selected hierarchy node with explicit placement context. | It does not authorize copying Webflow blocks, labels, or canvas geometry. |
| [Apple split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Related primary and supplementary regions may coexist and later become temporary navigation destinations. | It does not authorize copying platform chrome or exact geometry. |
| [Adobe Spectrum components](https://spectrum.adobe.com/page/components/) | Editor controls expose labeled states, validation, and contextual actions. | It does not make a Spectrum component tree binding here. |
| [W3C APG grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Composite two-axis widgets require managed directional keyboard navigation and explicit edit mode. | It does not require ARIA grid when native table semantics are sufficient. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error, and live changes are announced without moving focus. | It does not define business state policy or copy. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `palette-canvas-properties-builder`. |
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
  "archetypeId": "palette-canvas-properties-builder",
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
