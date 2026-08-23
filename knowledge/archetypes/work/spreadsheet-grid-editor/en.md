# Spreadsheet grid editor

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `spreadsheet-grid-editor` |
| Family | Work |
| Dominant task | Edit values and formulas by cell coordinates, ranges, rows, columns, and sheets in a two-dimensional model. |
| Search aliases | spreadsheet, formula grid, range editor, workbook cells |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `spreadsheet` owns the complete dominant task and its recovery boundary.
- Edit values and formulas by cell coordinates, ranges, rows, columns, and sheets in a two-dimensional model.
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact topology changes occur when a named relationship fails, never by device label.
- Responsive transformation preserves selection, draft, cursor, pending work, errors, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-SGE-01` | Edit values and formulas by cell coordinates, ranges, rows, columns, and sheets in a two-dimensional model. | Required positive evidence. |
| `AR-SGE-02` | Every required batch region and relationship is necessary to complete the task. | Require the complete region graph. |
| `AR-SGE-03` | A named simultaneous relationship fails at intermediate or compact while work state must survive transformation. | Require the three topology responses. |
| `AR-SGE-04` | Pending, error, conflict, or stale state can occur after the user creates work state. | Require recovery without lost input or focus meaning. |
| `AR-SGE-90` | The actual task is owned by batch table operations or row-form editing. | Reject. |
| `AR-SGE-91` | Reject record scanning, row-independent forms, and editable tables without coordinate, range, or formula semantics. | Reject. |
| `AR-SGE-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `spreadsheet-grid-editor` if and only if `AR-SGE-01` through `AR-SGE-04` are evidenced, every required region and relationship is present, and none of `AR-SGE-90` through `AR-SGE-92` is present. Return `needs-evidence` when the dominant task, an owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
spreadsheet
├─ workbook-and-sheet-navigation
├─ formula-input
├─ editable-cell-grid
│  ├─ row-column-headers
│  └─ active-cell-or-range
└─ grid-actions
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `spreadsheet` | Owns one two-dimensional workbook editing model and its recalculation history. |
| `workbook-and-sheet-navigation` | Changes sheets while preserving the active coordinate, dirty state, and return focus. |
| `formula-input` | Edits the value or formula for the addressed cell and owns parse feedback. |
| `editable-cell-grid` | Owns two-axis navigation, bounded overflow, editing entry, and range selection. |
| `row-column-headers` | Provide persistent coordinate context to cells and ranges. |
| `active-cell-or-range` | Names address and extent outside color and survives compact focus mode. |
| `grid-actions` | Own commit, cancel, paste/import, undo, redo, and recalculation status. |

## Responsive contract

### Wide

- **Failure trigger:** Required simultaneous regions retain enough measure for reading, operation, and relationship comprehension.
- **Topology response:** Surround one bounded two-axis grid with sheet context, formula input, frozen headers, and an explicit active address; distinguish navigation and edit modes without color alone.
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only actions or status bound to the current work object may be sticky; they reserve space and never obscure focus.
- **Overflow owner:** `editable-cell-grid` alone owns horizontal and vertical work overflow; formula input wraps and the page never scrolls horizontally.

### Intermediate

- **Failure trigger:** The lowest-priority support starts to squeeze primary work, labels, or actions.
- **Topology response:** Reduce visible cells without linearizing coordinates; move supporting commands to labeled overflow while headers, active address, formula state, and commit/cancel remain visible.
- **Navigation replacement:** A labeled trigger opens the exact temporary pane or disclosure and preserves query, selection, draft, cursor, and return-focus target.
- **Sticky boundary:** Current scope and pending/error summary may persist but yield when height is insufficient.
- **Overflow owner:** `editable-cell-grid` alone owns horizontal and vertical work overflow; formula input wraps and the page never scrolls horizontally.

### Compact

- **Failure trigger:** Two work regions cannot remain simultaneous with sufficient measure, 44px targets, and unobscured focus.
- **Topology response:** Use a cell-focused editing stage paired with a bounded grid navigator; provide previous/next cell, row/column context, commit, and cancel instead of shrinking the whole workbook.
- **Navigation replacement:** Named stages, tabs, or sheets replace direct simultaneity; Back restores exact filter, scroll, selection, draft, cursor, and trigger focus.
- **Sticky boundary:** The primary action is sticky only with reserved space, unobscured focus, and a short-height fallback to normal flow.
- **Overflow owner:** `editable-cell-grid` alone owns horizontal and vertical work overflow; formula input wraps and the page never scrolls horizontally.

### Reflow

- DOM order, reading order, and meaningful focus order are `spreadsheet → workbook-and-sheet-navigation → formula-input → editable-cell-grid → row-column-headers → active-cell-or-range → grid-actions`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific parity includes workbook and sheet loading, active cell, active range, navigation mode, edit/commit/cancel, formula parse error, paste pending, protected cell, concurrent edit conflict, undo/redo, and recalculation.

## State obligations

Task-specific states: workbook and sheet loading, active cell, active range, navigation mode, edit/commit/cancel, formula parse error, paste pending, protected cell, concurrent edit conflict, undo/redo, and recalculation.

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

- Coordinates, ranges, formulas, headers, and two-axis navigation jointly determine the edit model.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject record scanning, row-independent forms, and editable tables without coordinate, range, or formula semantics.
- Reject when batch table operations or row-form editing owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-SGE-90`, `AR-SGE-91`, or `AR-SGE-92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Microsoft Excel keyboard shortcuts](https://support.microsoft.com/en-US/Accessibility/excel/keyboard-shortcuts-in-excel) | Cell navigation, range selection, formula editing, commit, and cancel have keyboard equivalents. | It does not define this archetype’s layout or product shortcuts. |
| [IBM Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Relational scanning, selection, sorting, expansion, and actions remain table-owned. | It does not define product fields, density, or breakpoint values. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary and supporting regions adapt when simultaneous content no longer fits. | It does not supply fixed breakpoints or product components. |
| [W3C APG grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Composite two-axis widgets require managed directional keyboard navigation and explicit edit mode. | It does not require ARIA grid when native table semantics are sufficient. |
| [W3C Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | DOM, reading, and focus order preserve task meaning through topology changes. | It does not define product keyboard shortcuts. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `spreadsheet-grid-editor`. |
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
  "archetypeId": "spreadsheet-grid-editor",
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
