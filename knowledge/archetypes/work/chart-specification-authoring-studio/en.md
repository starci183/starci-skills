# Chart specification authoring studio

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `chart-specification-authoring-studio` |
| Family | Work |
| Dominant task | Author a chart specification by mapping fields to visual encodings, configuring scales and annotations, validating the result, and maintaining an equivalent accessible data explanation |
| Search aliases | chart authoring, visual encoding, accessible chart spec |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `chart-studio` owns the complete dominant task and recovery boundary.
- Author a chart specification by mapping fields to visual encodings, configuring scales and annotations, validating the result, and maintaining an equivalent accessible data explanation
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-CSA-01` | Author a chart specification by mapping fields to visual encodings, configuring scales and annotations, validating the result, and maintaining an equivalent accessible data explanation | Required positive evidence. |
| `AR-CSA-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `AR-CSA-03` | Work state must survive all three named topology responses. | Require responsive parity. |
| `AR-CSA-04` | Pending, error, permission, stale, or conflict can occur after work state exists. | Require recovery without lost input or focus meaning. |
| `AR-CSA-90` | The dominant task belongs to an adjacent archetype named in the hard rejection. | Reject. |
| `AR-CSA-91` | Reject cho query builder, palette/token editor, pivot table, dashboard composition, generic code playground or chart viewer; semantic data fields must be bound to visual channels/transforms/scales and compile into both a chart and equivalent table/narrative—database retrieval and color selection are not the dominant task | Reject. |
| `AR-CSA-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `chart-specification-authoring-studio` if and only if `AR-CSA-01`–`04` are evidenced, every required region and relationship is present, and none of `AR-CSA-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
chart-studio
├─ data-field-schema
├─ mark-and-encoding-specification
├─ live-chart-preview (peer synchronization)
├─ scale-legend-annotation-inspector
├─ validation-ledger
├─ accessible-table-and-narrative
└─ publish-export
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `chart-studio` | Owns the dominant task, complete state, and recovery boundary for chart-specification-authoring-studio. |
| `data-field-schema` | Owns data field schema; preserves the required relationship with upstream `chart-studio` and downstream `mark-and-encoding-specification`, and does not absorb another region's owner. |
| `mark-and-encoding-specification` | Owns mark and encoding specification; preserves the required relationship with upstream `data-field-schema` and downstream `live-chart-preview`, and does not absorb another region's owner. |
| `live-chart-preview` | Owns live chart preview; preserves the required relationship with upstream `mark-and-encoding-specification` and downstream `scale-legend-annotation-inspector`, and does not absorb another region's owner. |
| `scale-legend-annotation-inspector` | Owns scale legend annotation inspector; preserves the required relationship with upstream `live-chart-preview` and downstream `validation-ledger`, and does not absorb another region's owner. |
| `validation-ledger` | Owns validation ledger; preserves the required relationship with upstream `scale-legend-annotation-inspector` and downstream `accessible-table-and-narrative`, and does not absorb another region's owner. |
| `accessible-table-and-narrative` | Owns accessible table and narrative; preserves the required relationship with upstream `validation-ledger` and downstream `publish-export`, and does not absorb another region's owner. |
| `publish-export` | Owns publish export; preserves the required relationship with upstream `accessible-table-and-narrative`, and does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Field schema, encoding editor, preview and accessibility/validation rail remain visible
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Field schema becomes a drawer; specification and preview retain a split while validation/accessibility moves below
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Choose mark → map fields → configure scale/annotation → inspect preview → review accessible table/narrative → validate; no precision drag is required
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order are `chart-studio → data-field-schema → mark-and-encoding-specification → live-chart-preview → scale-legend-annotation-inspector → validation-ledger → accessible-table-and-narrative → publish-export`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task parity includes data loading/empty, field compatible/incompatible, spec valid/error, preview pending/failure, annotation missing, contrast/label warning, accessible equivalent stale and publish success.

## State obligations

Task-specific states: data loading/empty, field compatible/incompatible, spec valid/error, preview pending/failure, annotation missing, contrast/label warning, accessible equivalent stale and publish success.

| State family | Required behavior |
|---|---|
| Initial / loading | Name the loading scope, reserve the primary region, and block only the failed region. |
| Ready | Expose the current object, owner relationship, and valid actions through text and semantics. |
| Empty / not-applicable | Distinguish true empty, no-match, and non-applicable states with an appropriate next action. |
| Error / retry | Name the failed scope, retain input and work state, and provide a focused retry or correction target. |
| Permission / unavailable | Explain the restriction in text; read-only differs from disabled and retains context. |
| Pending | Prevent duplicates, retain context, allow Cancel when safe, and announce progress. |
| Success | Confirm the exact changed scope, update related summaries, and preserve Undo or the next step when required. |
| Stale / conflict | Compare local and external state, never overwrite silently, and retain deterministic recovery. |
| Focus transition | A user-triggered stage change focuses the new heading; status-only updates do not move focus; modals return to the trigger. |
| Responsive presentation | Wide retains simultaneity; intermediate makes the lowest support temporary; compact uses one primary stage with parity. |

## Boundaries

### Accept

- Template must map fields to encodings, surface an invalid mapping, update preview and accessible table from the same spec and return focus to the exact edited encoding
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho query builder, palette/token editor, pivot table, dashboard composition, generic code playground or chart viewer; semantic data fields must be bound to visual channels/transforms/scales and compile into both a chart and equivalent table/narrative—database retrieval and color selection are not the dominant task
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-CSA-90`, `91` or `92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Vega-Lite encoding](https://vega.github.io/vega-lite/docs/encoding.html) | Provides official evidence for data field schema. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [Microsoft chart accessibility](https://support.microsoft.com/en-us/office/make-your-excel-charts-accessible-19e81ce7-88af-4a3f-a4ef-a26c344527b3) | Provides official evidence for mark and encoding specification. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [W3C complex images](https://www.w3.org/WAI/tutorials/images/complex/) | Provides official evidence for keyboard, focus, reflow, or status behavior. | Does not prove product truth, exact geometry, breakpoints, or components. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `chart-specification-authoring-studio`. |
| `situationCodes` | Matched codes from this record. |
| `searchAliases` | Routed aliases that led to the match. |
| `dominantTask` | One product-neutral task sentence. |
| `regions` | Ordered required region IDs. |
| `regionRelationships` | Owner, peer, supporting, temporary, and downstream relationships. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, `interactionParity`. |
| `stateObligations` | Applicable task-specific and common state families. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Product-semantic region and state owners left to Grammar. |
| `principlesHandoff` | Exact geometry, fit thresholds, and emitted layout left to Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Business/current-source/research evidence classes without invented facts. |

```json
{"archetypeId":"chart-specification-authoring-studio","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
