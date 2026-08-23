# Poetry meter scansion prosody workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `poetry-meter-scansion-prosody-workbench` |
| Family | Work |
| Dominant task | Scan a poem under an explicit metrical hypothesis by resolving syllables and contextual stress or quantity, grouping metrical positions and documenting meaningful substitutions, caesurae and competing readings. |
| Search aliases | poetry scansion, metrical analysis, prosody workbench |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `prosody-workbench` owns the complete dominant task, work state, and recovery boundary.
- Scan a poem under an explicit metrical hypothesis by resolving syllables and contextual stress or quantity, grouping metrical positions and documenting meaningful substitutions, caesurae and competing readings.
- Every required region retains its named owner, relationship, and stable identity; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `PRO-01` | Scan a poem under an explicit metrical hypothesis by resolving syllables and contextual stress or quantity, grouping metrical positions and documenting meaningful substitutions, caesurae and competing readings. | Required positive evidence. |
| `PRO-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `PRO-03` | Template must syllabify one line, change a contextual stress, regroup its feet, mark a caesura and one licensed substitution, compare an alternate scansion with explicit rationale and export a semantic annotation understandable without color or visual scansion marks alone. | Require the domain-specific proof path. |
| `PRO-04` | Work state must survive all three named topology responses. | Require responsive parity. |
| `PRO-05` | Task-specific states: edition current/variant, meter hypothesis selected/competing, syllabification confirmed/disputed, stress lexical/contextual/ambiguous, position filled/resolved/extra, foot boundary proposed/accepted, caesura primary/secondary, substitution allowed/unexplained, line regular/variant and analysis reviewed/exported. | Require state and recovery coverage. |
| `PRO-90` | Reject cho `document-outline-workspace`, text highlighting, `media-annotation-review-console`, localization or a spreadsheet; word-to-syllable hierarchy, stress or quantity evidence, metrical positions, foot boundaries, licensed deviations and competing scansion rationale are mandatory. | Reject. |
| `PRO-91` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |
| `PRO-92` | An adjacent archetype owns the work object or completion event more precisely. | Reject. |

### Selection rule

Select `poetry-meter-scansion-prosody-workbench` if and only if `PRO-01`–`05` are evidenced and none of `PRO-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
prosody-workbench
├─ poem-language-edition-and-meter-hypothesis (downstream)
├─ stanza-line-word-and-syllable-sequence (downstream)
├─ lexical-and-contextual-stress-evidence (downstream)
├─ syllable-quantity-or-stress-scansion-grid (downstream)
├─ foot-boundary-caesura-and-metrical-position-model (downstream)
├─ substitution-elision-resolution-and-extrametrical-annotations (downstream)
├─ line-pattern-and-poem-level-variation-summary (downstream)
├─ competing-scansion-comparison-and-rationale (downstream)
└─ annotated-edition-export (downstream)
```

The binding relationship expression is `prosody-workbench → poem-language-edition-and-meter-hypothesis → stanza-line-word-and-syllable-sequence → lexical-and-contextual-stress-evidence → syllable-quantity-or-stress-scansion-grid → foot-boundary-caesura-and-metrical-position-model → substitution-elision-resolution-and-extrametrical-annotations → line-pattern-and-poem-level-variation-summary → competing-scansion-comparison-and-rationale → annotated-edition-export`; operators retain the directed, peer, or joint-axis meaning declared by the prompt.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `prosody-workbench` | prosody-workbench owns its evidence and state and the dominant-task boundary and passes stable identity to `poem-language-edition-and-meter-hypothesis`. It does not absorb another region's owner. |
| `poem-language-edition-and-meter-hypothesis` | poem-language-edition-and-meter-hypothesis owns its evidence and state; it preserves the → relationship from upstream `prosody-workbench` and passes stable identity to `stanza-line-word-and-syllable-sequence`. It does not absorb another region's owner. |
| `stanza-line-word-and-syllable-sequence` | stanza-line-word-and-syllable-sequence owns its evidence and state; it preserves the → relationship from upstream `poem-language-edition-and-meter-hypothesis` and passes stable identity to `lexical-and-contextual-stress-evidence`. It does not absorb another region's owner. |
| `lexical-and-contextual-stress-evidence` | lexical-and-contextual-stress-evidence owns its evidence and state; it preserves the → relationship from upstream `stanza-line-word-and-syllable-sequence` and passes stable identity to `syllable-quantity-or-stress-scansion-grid`. It does not absorb another region's owner. |
| `syllable-quantity-or-stress-scansion-grid` | syllable-quantity-or-stress-scansion-grid owns its evidence and state; it preserves the → relationship from upstream `lexical-and-contextual-stress-evidence` and passes stable identity to `foot-boundary-caesura-and-metrical-position-model`. It does not absorb another region's owner. |
| `foot-boundary-caesura-and-metrical-position-model` | foot-boundary-caesura-and-metrical-position-model owns its evidence and state; it preserves the → relationship from upstream `syllable-quantity-or-stress-scansion-grid` and passes stable identity to `substitution-elision-resolution-and-extrametrical-annotations`. It does not absorb another region's owner. |
| `substitution-elision-resolution-and-extrametrical-annotations` | substitution-elision-resolution-and-extrametrical-annotations owns its evidence and state; it preserves the → relationship from upstream `foot-boundary-caesura-and-metrical-position-model` and passes stable identity to `line-pattern-and-poem-level-variation-summary`. It does not absorb another region's owner. |
| `line-pattern-and-poem-level-variation-summary` | line-pattern-and-poem-level-variation-summary owns its evidence and state; it preserves the → relationship from upstream `substitution-elision-resolution-and-extrametrical-annotations` and passes stable identity to `competing-scansion-comparison-and-rationale`. It does not absorb another region's owner. |
| `competing-scansion-comparison-and-rationale` | competing-scansion-comparison-and-rationale owns its evidence and state; it preserves the → relationship from upstream `line-pattern-and-poem-level-variation-summary` and passes stable identity to `annotated-edition-export`. It does not absorb another region's owner. |
| `annotated-edition-export` | annotated-edition-export owns its evidence and state; it preserves the → relationship from upstream `competing-scansion-comparison-and-rationale` and emits completion evidence. It does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named simultaneous evidence relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Poem lines, syllable/stress evidence, foot and caesura model, deviations, competing reading and poem-level pattern remain visible together.
- **Navigation replacement:** None; direct region access still fits and related evidence remains simultaneous.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only the intrinsically tabular, matrix, graph, timeline, notation, or media region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** The complete support scope can no longer remain persistent beside the active proof without reducing readable measure or hiding focus.
- **Topology response:** The active line and its evidence-to-meter mapping remain primary; stanza pattern, alternative analysis and terminology notes move to synchronized drawers.
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** The active proof may stay sticky only while reserved space keeps every focused control visible; short height yields.
- **Overflow owner:** The same bounded intrinsic region remains the only overflow owner; temporary support does not create nested page scroll.

### Compact

- **Failure trigger:** The active decision and its minimum proof no longer fit side by side at readable measure.
- **Topology response:** Line → word and syllable → contextual stress or quantity → metrical position and foot → caesura/substitution/elision → competing reading → rationale; symbols always have spoken or textual names and ordered semantic controls.
- **Navigation replacement:** A labeled one-pane stage route replaces simultaneous columns and preserves the exact active object and recovery target.
- **Sticky boundary:** Only the current-stage action may persist with safe-area spacing; landscape or short height returns it to flow.
- **Overflow owner:** No page-level horizontal scroll; intrinsic two-dimensional evidence uses one labeled bounded region or a semantic list replacement.

### Reflow

- DOM order, reading order, and meaningful focus order are `prosody-workbench → poem-language-edition-and-meter-hypothesis → stanza-line-word-and-syllable-sequence → lexical-and-contextual-stress-evidence → syllable-quantity-or-stress-scansion-grid → foot-boundary-caesura-and-metrical-position-model → substitution-elision-resolution-and-extrametrical-annotations → line-pattern-and-poem-level-variation-summary → competing-scansion-comparison-and-rationale → annotated-edition-export`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific states: edition current/variant, meter hypothesis selected/competing, syllabification confirmed/disputed, stress lexical/contextual/ambiguous, position filled/resolved/extra, foot boundary proposed/accepted, caesura primary/secondary, substitution allowed/unexplained, line regular/variant and analysis reviewed/exported.

## State obligations

Task-specific states: edition current/variant, meter hypothesis selected/competing, syllabification confirmed/disputed, stress lexical/contextual/ambiguous, position filled/resolved/extra, foot boundary proposed/accepted, caesura primary/secondary, substitution allowed/unexplained, line regular/variant and analysis reviewed/exported.

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

- Template must syllabify one line, change a contextual stress, regroup its feet, mark a caesura and one licensed substitution, compare an alternate scansion with explicit rationale and export a semantic annotation understandable without color or visual scansion marks alone.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho `document-outline-workspace`, text highlighting, `media-annotation-review-console`, localization or a spreadsheet; word-to-syllable hierarchy, stress or quantity evidence, metrical positions, foot boundaries, licensed deviations and competing scansion rationale are mandatory.
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `PRO-90`–`92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Academy of American Poets glossary of meter](https://poets.org/glossary/meter) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [TEI P5 Verse guidelines](https://www.tei-c.org/release/doc/tei-p5-doc/en/html/VE.html) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `poetry-meter-scansion-prosody-workbench`. |
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
{"archetypeId":"poetry-meter-scansion-prosody-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
