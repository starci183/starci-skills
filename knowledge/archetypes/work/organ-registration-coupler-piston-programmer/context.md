# Organ registration coupler piston programmer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `organ-registration-coupler-piston-programmer` |
| Family | Work |
| Dominant task | Program and rehearse pipe-organ registrations by resolving stops through divisions and couplers into effective sounding ranks, then storing reachable cue changes in the console's piston and memory system. |
| Search aliases | organ registration, coupler closure, piston programming |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `organ-registration` owns the complete dominant task, work state, and recovery boundary.
- Program and rehearse pipe-organ registrations by resolving stops through divisions and couplers into effective sounding ranks, then storing reachable cue changes in the console's piston and memory system.
- Every required region retains its named owner, relationship, and stable identity; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `ORG-01` | Program and rehearse pipe-organ registrations by resolving stops through divisions and couplers into effective sounding ranks, then storing reachable cue changes in the console's piston and memory system. | Required positive evidence. |
| `ORG-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `ORG-03` | Template must select stops in two divisions, derive a rank added through a coupler, show an invalid or overloaded combination, correct it, store the result to a named piston and memory level, detect a failed recall and pass a reachable cue-to-cue registration change without mouse-only controls. | Require the domain-specific proof path. |
| `ORG-04` | Work state must survive all three named topology responses. | Require responsive parity. |
| `ORG-05` | Task-specific states: instrument profile current/changed, stop on/off/unavailable, coupler engaged/disengaged/conflicting, effective rank sounding/suppressed, wind load normal/high, cue registration draft/approved, change reachable/unreachable, piston empty/stored/overwritten, memory level active/wrong, recall equal/diverged and rehearsal passed/returned. | Require state and recovery coverage. |
| `ORG-90` | Reject cho `audio-mix-routing-console`, `rule-builder-workbench`, `multi-track-timeline-editor` or `editorial-rundown-control-board`; physical organ divisions and stops, transitive coupler semantics, effective-rank derivation, console piston snapshots and performance-time recall reachability are mandatory. | Reject. |
| `ORG-91` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |
| `ORG-92` | An adjacent archetype owns the work object or completion event more precisely. | Reject. |

### Selection rule

Select `organ-registration-coupler-piston-programmer` if and only if `ORG-01`–`05` are evidenced and none of `ORG-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
organ-registration
├─ instrument-stoplist-divisions-and-console-memory (downstream)
├─ score-cue-and-performance-sequence (downstream)
├─ selected-cue-stop-registration-by-division (downstream)
├─ coupler-and-unison-off-transitive-closure (downstream)
├─ effective-sounding-rank-and-pitch-set (downstream)
├─ wind-load-balance-and-style-compatibility-check (downstream)
├─ general-divisional-piston-and-memory-level-capture (downstream)
├─ registration-change-reachability-and-recall-test (downstream)
└─ approved-cue-sheet-and-console-program (downstream)
```

The binding relationship expression is `organ-registration → instrument-stoplist-divisions-and-console-memory → score-cue-and-performance-sequence → selected-cue-stop-registration-by-division → coupler-and-unison-off-transitive-closure → effective-sounding-rank-and-pitch-set → wind-load-balance-and-style-compatibility-check → general-divisional-piston-and-memory-level-capture → registration-change-reachability-and-recall-test → approved-cue-sheet-and-console-program`; operators retain the directed, peer, or joint-axis meaning declared by the prompt.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `organ-registration` | organ-registration owns its evidence and state and the dominant-task boundary and passes stable identity to `instrument-stoplist-divisions-and-console-memory`. It does not absorb another region's owner. |
| `instrument-stoplist-divisions-and-console-memory` | instrument-stoplist-divisions-and-console-memory owns its evidence and state; it preserves the → relationship from upstream `organ-registration` and passes stable identity to `score-cue-and-performance-sequence`. It does not absorb another region's owner. |
| `score-cue-and-performance-sequence` | score-cue-and-performance-sequence owns its evidence and state; it preserves the → relationship from upstream `instrument-stoplist-divisions-and-console-memory` and passes stable identity to `selected-cue-stop-registration-by-division`. It does not absorb another region's owner. |
| `selected-cue-stop-registration-by-division` | selected-cue-stop-registration-by-division owns its evidence and state; it preserves the → relationship from upstream `score-cue-and-performance-sequence` and passes stable identity to `coupler-and-unison-off-transitive-closure`. It does not absorb another region's owner. |
| `coupler-and-unison-off-transitive-closure` | coupler-and-unison-off-transitive-closure owns its evidence and state; it preserves the → relationship from upstream `selected-cue-stop-registration-by-division` and passes stable identity to `effective-sounding-rank-and-pitch-set`. It does not absorb another region's owner. |
| `effective-sounding-rank-and-pitch-set` | effective-sounding-rank-and-pitch-set owns its evidence and state; it preserves the → relationship from upstream `coupler-and-unison-off-transitive-closure` and passes stable identity to `wind-load-balance-and-style-compatibility-check`. It does not absorb another region's owner. |
| `wind-load-balance-and-style-compatibility-check` | wind-load-balance-and-style-compatibility-check owns its evidence and state; it preserves the → relationship from upstream `effective-sounding-rank-and-pitch-set` and passes stable identity to `general-divisional-piston-and-memory-level-capture`. It does not absorb another region's owner. |
| `general-divisional-piston-and-memory-level-capture` | general-divisional-piston-and-memory-level-capture owns its evidence and state; it preserves the → relationship from upstream `wind-load-balance-and-style-compatibility-check` and passes stable identity to `registration-change-reachability-and-recall-test`. It does not absorb another region's owner. |
| `registration-change-reachability-and-recall-test` | registration-change-reachability-and-recall-test owns its evidence and state; it preserves the → relationship from upstream `general-divisional-piston-and-memory-level-capture` and passes stable identity to `approved-cue-sheet-and-console-program`. It does not absorb another region's owner. |
| `approved-cue-sheet-and-console-program` | approved-cue-sheet-and-console-program owns its evidence and state; it preserves the → relationship from upstream `registration-change-reachability-and-recall-test` and emits completion evidence. It does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named simultaneous evidence relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Cue sequence, stops by division, coupler closure, effective ranks, piston memory and change-reachability findings remain visible together.
- **Navigation replacement:** None; direct region access still fits and related evidence remains simultaneous.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only the intrinsically tabular, matrix, graph, timeline, notation, or media region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** The complete support scope can no longer remain persistent beside the active proof without reducing readable measure or hiding focus.
- **Topology response:** The active cue, division registration and effective sounding result remain primary; complete stoplist, piston banks and prior rehearsal notes move to synchronized panels.
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** The active proof may stay sticky only while reserved space keeps every focused control visible; short height yields.
- **Overflow owner:** The same bounded intrinsic region remains the only overflow owner; temporary support does not create nested page scroll.

### Compact

- **Failure trigger:** The active decision and its minimum proof no longer fit side by side at readable measure.
- **Topology response:** Cue → stops by division → couplers and unison-off state → effective ranks/pitches → wind/style check → reachable change → piston capture and recall; console diagrams have an ordered semantic control list.
- **Navigation replacement:** A labeled one-pane stage route replaces simultaneous columns and preserves the exact active object and recovery target.
- **Sticky boundary:** Only the current-stage action may persist with safe-area spacing; landscape or short height returns it to flow.
- **Overflow owner:** No page-level horizontal scroll; intrinsic two-dimensional evidence uses one labeled bounded region or a semantic list replacement.

### Reflow

- DOM order, reading order, and meaningful focus order are `organ-registration → instrument-stoplist-divisions-and-console-memory → score-cue-and-performance-sequence → selected-cue-stop-registration-by-division → coupler-and-unison-off-transitive-closure → effective-sounding-rank-and-pitch-set → wind-load-balance-and-style-compatibility-check → general-divisional-piston-and-memory-level-capture → registration-change-reachability-and-recall-test → approved-cue-sheet-and-console-program`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific states: instrument profile current/changed, stop on/off/unavailable, coupler engaged/disengaged/conflicting, effective rank sounding/suppressed, wind load normal/high, cue registration draft/approved, change reachable/unreachable, piston empty/stored/overwritten, memory level active/wrong, recall equal/diverged and rehearsal passed/returned.

## State obligations

Task-specific states: instrument profile current/changed, stop on/off/unavailable, coupler engaged/disengaged/conflicting, effective rank sounding/suppressed, wind load normal/high, cue registration draft/approved, change reachable/unreachable, piston empty/stored/overwritten, memory level active/wrong, recall equal/diverged and rehearsal passed/returned.

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

- Template must select stops in two divisions, derive a rank added through a coupler, show an invalid or overloaded combination, correct it, store the result to a named piston and memory level, detect a failed recall and pass a reachable cue-to-cue registration change without mouse-only controls.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho `audio-mix-routing-console`, `rule-builder-workbench`, `multi-track-timeline-editor` or `editorial-rundown-control-board`; physical organ divisions and stops, transitive coupler semantics, effective-rank derivation, console piston snapshots and performance-time recall reachability are mandatory.
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `ORG-90`–`92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [American Guild of Organists New Organist resources](https://agohq.org/Ago/Ago/Education/The-New-Organist.aspx) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [Allen Organ manuals and guides](https://allenorgan.com/support/manuals-and-guides.html) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `organ-registration-coupler-piston-programmer`. |
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
{"archetypeId":"organ-registration-coupler-piston-programmer","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
