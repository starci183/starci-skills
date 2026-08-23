# Weaving draft liftplan drawdown workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `weaving-draft-liftplan-drawdown-workbench` |
| Family | Work |
| Dominant task | Construct an executable loom draft by coordinating warp threading, treadle-to-shaft tie-up or liftplan and pick sequence, then derive the interlacement drawdown and correct structural or loom-feasibility defects. |
| Search aliases | weaving draft, liftplan drawdown, loom feasibility |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `weaving-draft` owns the complete dominant task, work state, and recovery boundary.
- Construct an executable loom draft by coordinating warp threading, treadle-to-shaft tie-up or liftplan and pick sequence, then derive the interlacement drawdown and correct structural or loom-feasibility defects.
- Every required region retains its named owner, relationship, and stable identity; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `WEA-01` | Construct an executable loom draft by coordinating warp threading, treadle-to-shaft tie-up or liftplan and pick sequence, then derive the interlacement drawdown and correct structural or loom-feasibility defects. | Required positive evidence. |
| `WEA-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `WEA-03` | Template must alter one threading cell and one treadle or lift selection, recompute rather than paint the drawdown, surface an excessive float, provide button and keyboard alternatives to dragging, correct the draft and preserve both an executable export and sample-proof state. | Require the domain-specific proof path. |
| `WEA-04` | Work state must survive all three named topology responses. | Require responsive parity. |
| `WEA-05` | Task-specific states: loom profile valid/mismatched, threading incomplete/valid, tie-up asymmetric/valid, liftplan conflict, treadling draft/complete, drawdown stale/recomputed, float acceptable/excessive, selvedge stable/open, repeat aligned/broken, sample pending/accepted and export current/superseded. | Require state and recovery coverage. |
| `WEA-90` | Reject cho a spreadsheet grid, `palette-and-token-workbench`, `canvas-inspector-workspace` or a generic rule builder; three separately editable but linked threading/tie-up-or-liftplan/treadling matrices, mechanically derived drawdown, loom limits and interlacement validation are mandatory. | Reject. |
| `WEA-91` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |
| `WEA-92` | An adjacent archetype owns the work object or completion event more precisely. | Reject. |

### Selection rule

Select `weaving-draft-liftplan-drawdown-workbench` if and only if `WEA-01`–`05` are evidenced and none of `WEA-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
weaving-draft
├─ loom-shaft-treadle-and-fabric-spec (downstream)
├─ warp-thread-order-and-shaft-threading-matrix (downstream)
├─ treadle-to-shaft-tieup-or-liftplan-matrix (peer synchronization)
├─ pick-by-treadle-sequence (peer synchronization)
├─ derived-warp-weft-interlacement-drawdown (downstream)
├─ float-selvedge-repeat-and-loom-feasibility-validation (downstream)
├─ color-and-structure-simulation (downstream)
├─ corrected-executable-draft (downstream)
└─ export-and-sample-proof (downstream)
```

The binding relationship expression is `weaving-draft → loom-shaft-treadle-and-fabric-spec → warp-thread-order-and-shaft-threading-matrix ↔ treadle-to-shaft-tieup-or-liftplan-matrix ↔ pick-by-treadle-sequence → derived-warp-weft-interlacement-drawdown → float-selvedge-repeat-and-loom-feasibility-validation → color-and-structure-simulation → corrected-executable-draft → export-and-sample-proof`; operators retain the directed, peer, or joint-axis meaning declared by the prompt.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `weaving-draft` | weaving-draft owns its evidence and state and the dominant-task boundary and passes stable identity to `loom-shaft-treadle-and-fabric-spec`. It does not absorb another region's owner. |
| `loom-shaft-treadle-and-fabric-spec` | loom-shaft-treadle-and-fabric-spec owns its evidence and state; it preserves the → relationship from upstream `weaving-draft` and passes stable identity to `warp-thread-order-and-shaft-threading-matrix`. It does not absorb another region's owner. |
| `warp-thread-order-and-shaft-threading-matrix` | warp-thread-order-and-shaft-threading-matrix owns its evidence and state; it preserves the → relationship from upstream `loom-shaft-treadle-and-fabric-spec` and passes stable identity to `treadle-to-shaft-tieup-or-liftplan-matrix`. It does not absorb another region's owner. |
| `treadle-to-shaft-tieup-or-liftplan-matrix` | treadle-to-shaft-tieup-or-liftplan-matrix owns its evidence and state; it preserves the ↔ relationship from upstream `warp-thread-order-and-shaft-threading-matrix` and passes stable identity to `pick-by-treadle-sequence`. It does not absorb another region's owner. |
| `pick-by-treadle-sequence` | pick-by-treadle-sequence owns its evidence and state; it preserves the ↔ relationship from upstream `treadle-to-shaft-tieup-or-liftplan-matrix` and passes stable identity to `derived-warp-weft-interlacement-drawdown`. It does not absorb another region's owner. |
| `derived-warp-weft-interlacement-drawdown` | derived-warp-weft-interlacement-drawdown owns its evidence and state; it preserves the → relationship from upstream `pick-by-treadle-sequence` and passes stable identity to `float-selvedge-repeat-and-loom-feasibility-validation`. It does not absorb another region's owner. |
| `float-selvedge-repeat-and-loom-feasibility-validation` | float-selvedge-repeat-and-loom-feasibility-validation owns its evidence and state; it preserves the → relationship from upstream `derived-warp-weft-interlacement-drawdown` and passes stable identity to `color-and-structure-simulation`. It does not absorb another region's owner. |
| `color-and-structure-simulation` | color-and-structure-simulation owns its evidence and state; it preserves the → relationship from upstream `float-selvedge-repeat-and-loom-feasibility-validation` and passes stable identity to `corrected-executable-draft`. It does not absorb another region's owner. |
| `corrected-executable-draft` | corrected-executable-draft owns its evidence and state; it preserves the → relationship from upstream `color-and-structure-simulation` and passes stable identity to `export-and-sample-proof`. It does not absorb another region's owner. |
| `export-and-sample-proof` | export-and-sample-proof owns its evidence and state; it preserves the → relationship from upstream `corrected-executable-draft` and emits completion evidence. It does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named simultaneous evidence relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Threading, tie-up or liftplan, treadling, derived drawdown, loom limits and validation findings remain aligned and visible together.
- **Navigation replacement:** None; direct region access still fits and related evidence remains simultaneous.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only the intrinsically tabular, matrix, graph, timeline, notation, or media region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** The complete support scope can no longer remain persistent beside the active proof without reducing readable measure or hiding focus.
- **Topology response:** The active repeat and two contributing matrices remain primary; full drawdown, color simulation and loom setup move to synchronized panels without losing shaft, end or pick coordinates.
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** The active proof may stay sticky only while reserved space keeps every focused control visible; short height yields.
- **Overflow owner:** The same bounded intrinsic region remains the only overflow owner; temporary support does not create nested page scroll.

### Compact

- **Failure trigger:** The active decision and its minimum proof no longer fit side by side at readable measure.
- **Topology response:** Repeat → warp end and threading → pick and lift set → derived interlacement row → float/selvedge/loom violation → correction → sample proof; matrices become navigable row/column cards with labeled coordinates and no page-level horizontal scroll.
- **Navigation replacement:** A labeled one-pane stage route replaces simultaneous columns and preserves the exact active object and recovery target.
- **Sticky boundary:** Only the current-stage action may persist with safe-area spacing; landscape or short height returns it to flow.
- **Overflow owner:** No page-level horizontal scroll; intrinsic two-dimensional evidence uses one labeled bounded region or a semantic list replacement.

### Reflow

- DOM order, reading order, and meaningful focus order are `weaving-draft → loom-shaft-treadle-and-fabric-spec → warp-thread-order-and-shaft-threading-matrix ↔ treadle-to-shaft-tieup-or-liftplan-matrix ↔ pick-by-treadle-sequence → derived-warp-weft-interlacement-drawdown → float-selvedge-repeat-and-loom-feasibility-validation → color-and-structure-simulation → corrected-executable-draft → export-and-sample-proof`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific states: loom profile valid/mismatched, threading incomplete/valid, tie-up asymmetric/valid, liftplan conflict, treadling draft/complete, drawdown stale/recomputed, float acceptable/excessive, selvedge stable/open, repeat aligned/broken, sample pending/accepted and export current/superseded.

## State obligations

Task-specific states: loom profile valid/mismatched, threading incomplete/valid, tie-up asymmetric/valid, liftplan conflict, treadling draft/complete, drawdown stale/recomputed, float acceptable/excessive, selvedge stable/open, repeat aligned/broken, sample pending/accepted and export current/superseded.

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

- Template must alter one threading cell and one treadle or lift selection, recompute rather than paint the drawdown, surface an excessive float, provide button and keyboard alternatives to dragging, correct the draft and preserve both an executable export and sample-proof state.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho a spreadsheet grid, `palette-and-token-workbench`, `canvas-inspector-workspace` or a generic rule builder; three separately editable but linked threading/tie-up-or-liftplan/treadling matrices, mechanically derived drawdown, loom limits and interlacement validation are mandatory.
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `WEA-90`–`92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [W3C Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow, focus order, status communication, and keyboard-operable responsive behavior. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [W3C Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports reflow, focus order, status communication, and keyboard-operable responsive behavior. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [Weavers' Guild of Boston weaving-draft definitions](https://www.weaversguildofboston.org/_files/ugd/c50db8_b78ed82b8ca74e45ac7203fa3b087bd3.pdf) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [Black Mountain College Museum digital weaving project](https://www.blackmountaincollege.org/?p=37224) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `weaving-draft-liftplan-drawdown-workbench`. |
| `situationCodes` | Matched codes from this record. |
| `searchAliases` | Routed aliases that led to the match. |
| `dominantTask` | One product-neutral task sentence. |
| `regions` | Ordered required region IDs. |
| `regionRelationships` | Owner, peer, joint-axis, supporting, temporary, and downstream relationships. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, `interactionParity`. |
| `stateObligations` | Applicable task-specific and common state families. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Product-semantic region and state owners left to Grammar. |
| `principlesHandoff` | Exact geometry, fit thresholds, and emitted layout left to Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Business, current-source, and research evidence classes without invented facts. |

```json
{"archetypeId":"weaving-draft-liftplan-drawdown-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
