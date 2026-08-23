# Storyboard sequence planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `storyboard-sequence-planner` |
| Family | Work |
| Dominant task | Plan a visual narrative sequence by arranging shots, preserving scene continuity and coverage, and resolving missing or contradictory story beats before production |
| Search aliases | story sequence, shot continuity, coverage ledger |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `storyboard-planner` owns the complete dominant task and recovery boundary.
- Plan a visual narrative sequence by arranging shots, preserving scene continuity and coverage, and resolving missing or contradictory story beats before production
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-SSP-01` | Plan a visual narrative sequence by arranging shots, preserving scene continuity and coverage, and resolving missing or contradictory story beats before production | Required positive evidence. |
| `AR-SSP-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `AR-SSP-03` | Work state must survive all three named topology responses. | Require responsive parity. |
| `AR-SSP-04` | Pending, error, permission, stale, or conflict can occur after work state exists. | Require recovery without lost input or focus meaning. |
| `AR-SSP-90` | The dominant task belongs to an adjacent archetype named in the hard rejection. | Reject. |
| `AR-SSP-91` | Reject cho multi-track timeline editor, media annotation, generic kanban or asset gallery; ordered narrative beats plus cross-shot continuity/coverage are mandatory | Reject. |
| `AR-SSP-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `storyboard-sequence-planner` if and only if `AR-SSP-01`–`04` are evidenced, every required region and relationship is present, and none of `AR-SSP-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
storyboard-planner
├─ sequence-outline
├─ scene-and-beat-navigator
├─ shot-card-board
├─ selected-shot-detail (peer synchronization)
├─ continuity-and-coverage-ledger
├─ alternate-take-or-gap-resolution
└─ sequence-review-export
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `storyboard-planner` | Owns the dominant task, complete state, and recovery boundary for storyboard-sequence-planner. |
| `sequence-outline` | Owns sequence outline; preserves the required relationship with upstream `storyboard-planner` and downstream `scene-and-beat-navigator`, and does not absorb another region's owner. |
| `scene-and-beat-navigator` | Owns scene and beat navigator; preserves the required relationship with upstream `sequence-outline` and downstream `shot-card-board`, and does not absorb another region's owner. |
| `shot-card-board` | Owns shot card board; preserves the required relationship with upstream `scene-and-beat-navigator` and downstream `selected-shot-detail`, and does not absorb another region's owner. |
| `selected-shot-detail` | Owns selected shot detail; preserves the required relationship with upstream `shot-card-board` and downstream `continuity-and-coverage-ledger`, and does not absorb another region's owner. |
| `continuity-and-coverage-ledger` | Owns continuity and coverage ledger; preserves the required relationship with upstream `selected-shot-detail` and downstream `alternate-take-or-gap-resolution`, and does not absorb another region's owner. |
| `alternate-take-or-gap-resolution` | Owns alternate take or gap resolution; preserves the required relationship with upstream `continuity-and-coverage-ledger` and downstream `sequence-review-export`, and does not absorb another region's owner. |
| `sequence-review-export` | Owns sequence review export; preserves the required relationship with upstream `alternate-take-or-gap-resolution`, and does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Sequence outline, shot board, selected-shot detail and continuity ledger remain visible together
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Scene/beat navigation becomes a drawer; the active shot board and continuity ledger remain synchronized
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Scene → beat → shot sequence → shot detail → continuity/gap review; reorder has move-before/move-after controls and the board never shrinks into illegible thumbnails
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order are `storyboard-planner → sequence-outline → scene-and-beat-navigator → shot-card-board → selected-shot-detail → continuity-and-coverage-ledger → alternate-take-or-gap-resolution → sequence-review-export`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task parity includes sequence loading, scene empty, shot draft/approved, asset missing, continuity pass/conflict, coverage gap, reorder pending, review stale and export success/failure.

## State obligations

Task-specific states: sequence loading, scene empty, shot draft/approved, asset missing, continuity pass/conflict, coverage gap, reorder pending, review stale and export success/failure.

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

- Template must reorder shots without drag, expose a continuity conflict across two shots, resolve a missing coverage beat and preserve the selected scene across topology changes
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho multi-track timeline editor, media annotation, generic kanban or asset gallery; ordered narrative beats plus cross-shot continuity/coverage are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-SSP-90`, `91` or `92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [ScreenSkills storyboard artist](https://www.screenskills.com/job-profiles/browse/animation/pre-production/storyboard-artist/) | Provides official evidence for sequence outline. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [BBC Academy five essential shots](https://downloads.bbc.co.uk/academy/collegeofproduction/docs/five_essential_shots_ts.pdf) | Provides official evidence for scene and beat navigator. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [Apple layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Provides official evidence for shot card board. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [W3C Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Provides official evidence for keyboard, focus, reflow, or status behavior. | Does not prove product truth, exact geometry, breakpoints, or components. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `storyboard-sequence-planner`. |
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
{"archetypeId":"storyboard-sequence-planner","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
