# Musical instrument fingering mechanism mapper

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `musical-instrument-fingering-mechanism-mapper` |
| Family | Work |
| Dominant task | Map a note, chord or passage to playable fingerings on one exact instrument mechanism, compare alternate physical key/hole/valve/string states and validate transitions across the performed sequence. |
| Search aliases | instrument fingering, mechanism state map, playable transition |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `fingering-mapper` owns the complete dominant task, work state, and recovery boundary.
- Map a note, chord or passage to playable fingerings on one exact instrument mechanism, compare alternate physical key/hole/valve/string states and validate transitions across the performed sequence.
- Every required region retains its named owner, relationship, and stable identity; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `FIN-01` | Map a note, chord or passage to playable fingerings on one exact instrument mechanism, compare alternate physical key/hole/valve/string states and validate transitions across the performed sequence. | Required positive evidence. |
| `FIN-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `FIN-03` | Template must show two physical fingerings for one sounding note, reject one because its transition from the previous event is impossible, allow mechanism selection without dragging, choose a playable alternate, validate the next transition and export a performer-reviewed sequence tied to the instrument model. | Require the domain-specific proof path. |
| `FIN-04` | Work state must survive all three named topology responses. | Require responsive parity. |
| `FIN-05` | Task-specific states: instrument profile current/wrong, event unassigned/assigned, candidate standard/alternate/extended/unreachable, pitch correct/out-of-register, mechanism state valid/conflicting, transition easy/difficult/impossible, hand span within/exceeded, performer test pending/accepted/rejected and export current/stale. | Require state and recovery coverage. |
| `FIN-90` | Reject cho a typeface glyph map, `spatial-route-constraint-planner`, `canvas-inspector-workspace` or `score-to-part-extraction-proof-workbench`; a versioned physical instrument mechanism, many-to-one fingering candidates, sounding-pitch proof and sequence-dependent transition feasibility are mandatory. | Reject. |
| `FIN-91` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |
| `FIN-92` | An adjacent archetype owns the work object or completion event more precisely. | Reject. |

### Selection rule

Select `musical-instrument-fingering-mechanism-mapper` if and only if `FIN-01`–`05` are evidenced and none of `FIN-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
fingering-mapper
├─ instrument-model-tuning-and-mechanism-version (downstream)
├─ note-chord-and-articulation-sequence (downstream)
├─ physical-key-hole-valve-string-state-model (downstream)
├─ candidate-fingering-set-per-event (downstream)
├─ sounding-pitch-register-and-alternate-fingering-proof (downstream)
├─ transition-path-hand-span-and-technique-constraints (downstream)
├─ difficult-transition-and-unreachable-queue (downstream)
├─ selected-fingering-sequence-and-notation (downstream)
└─ performer-validation-and-export (downstream)
```

The binding relationship expression is `fingering-mapper → instrument-model-tuning-and-mechanism-version → note-chord-and-articulation-sequence → physical-key-hole-valve-string-state-model → candidate-fingering-set-per-event → sounding-pitch-register-and-alternate-fingering-proof → transition-path-hand-span-and-technique-constraints → difficult-transition-and-unreachable-queue → selected-fingering-sequence-and-notation → performer-validation-and-export`; operators retain the directed, peer, or joint-axis meaning declared by the prompt.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `fingering-mapper` | fingering-mapper owns its evidence and state and the dominant-task boundary and passes stable identity to `instrument-model-tuning-and-mechanism-version`. It does not absorb another region's owner. |
| `instrument-model-tuning-and-mechanism-version` | instrument-model-tuning-and-mechanism-version owns its evidence and state; it preserves the → relationship from upstream `fingering-mapper` and passes stable identity to `note-chord-and-articulation-sequence`. It does not absorb another region's owner. |
| `note-chord-and-articulation-sequence` | note-chord-and-articulation-sequence owns its evidence and state; it preserves the → relationship from upstream `instrument-model-tuning-and-mechanism-version` and passes stable identity to `physical-key-hole-valve-string-state-model`. It does not absorb another region's owner. |
| `physical-key-hole-valve-string-state-model` | physical-key-hole-valve-string-state-model owns its evidence and state; it preserves the → relationship from upstream `note-chord-and-articulation-sequence` and passes stable identity to `candidate-fingering-set-per-event`. It does not absorb another region's owner. |
| `candidate-fingering-set-per-event` | candidate-fingering-set-per-event owns its evidence and state; it preserves the → relationship from upstream `physical-key-hole-valve-string-state-model` and passes stable identity to `sounding-pitch-register-and-alternate-fingering-proof`. It does not absorb another region's owner. |
| `sounding-pitch-register-and-alternate-fingering-proof` | sounding-pitch-register-and-alternate-fingering-proof owns its evidence and state; it preserves the → relationship from upstream `candidate-fingering-set-per-event` and passes stable identity to `transition-path-hand-span-and-technique-constraints`. It does not absorb another region's owner. |
| `transition-path-hand-span-and-technique-constraints` | transition-path-hand-span-and-technique-constraints owns its evidence and state; it preserves the → relationship from upstream `sounding-pitch-register-and-alternate-fingering-proof` and passes stable identity to `difficult-transition-and-unreachable-queue`. It does not absorb another region's owner. |
| `difficult-transition-and-unreachable-queue` | difficult-transition-and-unreachable-queue owns its evidence and state; it preserves the → relationship from upstream `transition-path-hand-span-and-technique-constraints` and passes stable identity to `selected-fingering-sequence-and-notation`. It does not absorb another region's owner. |
| `selected-fingering-sequence-and-notation` | selected-fingering-sequence-and-notation owns its evidence and state; it preserves the → relationship from upstream `difficult-transition-and-unreachable-queue` and passes stable identity to `performer-validation-and-export`. It does not absorb another region's owner. |
| `performer-validation-and-export` | performer-validation-and-export owns its evidence and state; it preserves the → relationship from upstream `selected-fingering-sequence-and-notation` and emits completion evidence. It does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named simultaneous evidence relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Passage notation, instrument mechanism, candidate fingerings, prior/next transition evidence and unreachable queue remain visible together.
- **Navigation replacement:** None; direct region access still fits and related evidence remains simultaneous.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only the intrinsically tabular, matrix, graph, timeline, notation, or media region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** The complete support scope can no longer remain persistent beside the active proof without reducing readable measure or hiding focus.
- **Topology response:** The active event and mechanism state remain primary; passage overview, alternate candidates and performer notes move to synchronized panels.
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** The active proof may stay sticky only while reserved space keeps every focused control visible; short height yields.
- **Overflow owner:** The same bounded intrinsic region remains the only overflow owner; temporary support does not create nested page scroll.

### Compact

- **Failure trigger:** The active decision and its minimum proof no longer fit side by side at readable measure.
- **Topology response:** Note or chord → candidate physical state → sounding pitch/register → previous and next transition → constraint or technique note → select and validate; the mechanism diagram always has a labeled key/hole/valve/string list alternative.
- **Navigation replacement:** A labeled one-pane stage route replaces simultaneous columns and preserves the exact active object and recovery target.
- **Sticky boundary:** Only the current-stage action may persist with safe-area spacing; landscape or short height returns it to flow.
- **Overflow owner:** No page-level horizontal scroll; intrinsic two-dimensional evidence uses one labeled bounded region or a semantic list replacement.

### Reflow

- DOM order, reading order, and meaningful focus order are `fingering-mapper → instrument-model-tuning-and-mechanism-version → note-chord-and-articulation-sequence → physical-key-hole-valve-string-state-model → candidate-fingering-set-per-event → sounding-pitch-register-and-alternate-fingering-proof → transition-path-hand-span-and-technique-constraints → difficult-transition-and-unreachable-queue → selected-fingering-sequence-and-notation → performer-validation-and-export`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific states: instrument profile current/wrong, event unassigned/assigned, candidate standard/alternate/extended/unreachable, pitch correct/out-of-register, mechanism state valid/conflicting, transition easy/difficult/impossible, hand span within/exceeded, performer test pending/accepted/rejected and export current/stale.

## State obligations

Task-specific states: instrument profile current/wrong, event unassigned/assigned, candidate standard/alternate/extended/unreachable, pitch correct/out-of-register, mechanism state valid/conflicting, transition easy/difficult/impossible, hand span within/exceeded, performer test pending/accepted/rejected and export current/stale.

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

- Template must show two physical fingerings for one sounding note, reject one because its transition from the previous event is impossible, allow mechanism selection without dragging, choose a playable alternate, validate the next transition and export a performer-reviewed sequence tied to the instrument model.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho a typeface glyph map, `spatial-route-constraint-planner`, `canvas-inspector-workspace` or `score-to-part-extraction-proof-workbench`; a versioned physical instrument mechanism, many-to-one fingering candidates, sounding-pitch proof and sequence-dependent transition feasibility are mandatory.
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `FIN-90`–`92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Yamaha instrument fingering charts](https://www.yamaha.com/en/musical_instrument_guide/feature/fingering/) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [Music Encoding Initiative common music notation guidance](https://music-encoding.org/guidelines/v5/content/cmn.html) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `musical-instrument-fingering-mechanism-mapper`. |
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
{"archetypeId":"musical-instrument-fingering-mechanism-mapper","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
