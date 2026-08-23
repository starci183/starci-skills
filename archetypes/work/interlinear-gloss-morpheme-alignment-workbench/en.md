# Interlinear gloss morpheme alignment workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `interlinear-gloss-morpheme-alignment-workbench` |
| Family | Work |
| Dominant task | Author and validate an interlinear glossed text by aligning utterance words, morpheme segmentation, object-language forms, lexical or grammatical glosses and a free translation under one declared convention. |
| Search aliases | interlinear gloss editor, morpheme tier alignment, gloss rekey validation |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `interlinear-authoring` owns the complete dominant task, work state, and recovery boundary.
- Author and validate an interlinear glossed text by aligning utterance words, morpheme segmentation, object-language forms, lexical or grammatical glosses and a free translation under one declared convention.
- Every required region retains its named owner, relationship, and stable identity; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `IGT-01` | Author and validate an interlinear glossed text by aligning utterance words, morpheme segmentation, object-language forms, lexical or grammatical glosses and a free translation under one declared convention. | Required positive evidence. |
| `IGT-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `IGT-03` | Template must show pre-edit stable IDs, split one word into multiple morphemes, atomically rekey every linked form and gloss, define one previously unknown abbreviation, block commit on a deliberately orphaned tier item, resolve it, preserve the utterance translation and export a valid corpus example without mouse-only dragging. | Require the domain-specific proof path. |
| `IGT-04` | Work state must survive all three named topology responses. | Require responsive parity. |
| `IGT-05` | Task-specific states: text draft/locked, convention current/changed, token confirmed/split/merged, morpheme boundary proposed/accepted/uncertain, gloss lexical/grammatical/missing, abbreviation defined/undefined/conflicting, alignment balanced/orphaned, free translation missing/current, validation pass/warn/fail and example exported/withdrawn. | Require state and recovery coverage. |
| `IGT-90` | Reject cho `localization-workbench`, `media-annotation-workbench`, `spreadsheet-grid-editor` or `reconciliation-diff-workbench`; stable token ownership, a non-1:1 word-to-morpheme incidence/cardinality matrix, atomic split-or-merge rekeying across form and gloss tiers, abbreviation semantics and commit-blocking orphan validation are mandatory. | Reject. |
| `IGT-91` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |
| `IGT-92` | An adjacent archetype owns the work object or completion event more precisely. | Reject. |

### Selection rule

Select `interlinear-gloss-morpheme-alignment-workbench` if and only if `IGT-01`–`05` are evidenced and none of `IGT-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
interlinear-authoring
├─ language-speaker-text-and-convention-version (downstream)
├─ utterance-and-stable-token-IDs (downstream)
├─ word-to-morpheme-incidence-and-cardinality-matrix (downstream)
├─ object-language-form-tier (peer synchronization)
├─ lexical-and-grammatical-gloss-tier (peer synchronization)
├─ atomic-split-or-merge-rekeying-all-tiers (downstream)
├─ abbreviation-lexicon-and-word-level-alignment (downstream)
├─ free-translation-and-analyst-notes (downstream)
├─ orphan-boundary-and-tier-validation (downstream)
└─ corpus-example-export (downstream)
```

The binding relationship expression is `interlinear-authoring → language-speaker-text-and-convention-version → utterance-and-stable-token-IDs → word-to-morpheme-incidence-and-cardinality-matrix ↔ object-language-form-tier ↔ lexical-and-grammatical-gloss-tier → atomic-split-or-merge-rekeying-all-tiers → abbreviation-lexicon-and-word-level-alignment → free-translation-and-analyst-notes → orphan-boundary-and-tier-validation → corpus-example-export`; operators retain the directed, peer, or joint-axis meaning declared by the prompt.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `interlinear-authoring` | interlinear-authoring owns its evidence and state and the dominant-task boundary and passes stable identity to `language-speaker-text-and-convention-version`. It does not absorb another region's owner. |
| `language-speaker-text-and-convention-version` | language-speaker-text-and-convention-version owns its evidence and state; it preserves the → relationship from upstream `interlinear-authoring` and passes stable identity to `utterance-and-stable-token-IDs`. It does not absorb another region's owner. |
| `utterance-and-stable-token-IDs` | utterance-and-stable-token-IDs owns its evidence and state; it preserves the → relationship from upstream `language-speaker-text-and-convention-version` and passes stable identity to `word-to-morpheme-incidence-and-cardinality-matrix`. It does not absorb another region's owner. |
| `word-to-morpheme-incidence-and-cardinality-matrix` | word-to-morpheme-incidence-and-cardinality-matrix owns its evidence and state; it preserves the → relationship from upstream `utterance-and-stable-token-IDs` and passes stable identity to `object-language-form-tier`. It does not absorb another region's owner. |
| `object-language-form-tier` | object-language-form-tier owns its evidence and state; it preserves the ↔ relationship from upstream `word-to-morpheme-incidence-and-cardinality-matrix` and passes stable identity to `lexical-and-grammatical-gloss-tier`. It does not absorb another region's owner. |
| `lexical-and-grammatical-gloss-tier` | lexical-and-grammatical-gloss-tier owns its evidence and state; it preserves the ↔ relationship from upstream `object-language-form-tier` and passes stable identity to `atomic-split-or-merge-rekeying-all-tiers`. It does not absorb another region's owner. |
| `atomic-split-or-merge-rekeying-all-tiers` | atomic-split-or-merge-rekeying-all-tiers owns its evidence and state; it preserves the → relationship from upstream `lexical-and-grammatical-gloss-tier` and passes stable identity to `abbreviation-lexicon-and-word-level-alignment`. It does not absorb another region's owner. |
| `abbreviation-lexicon-and-word-level-alignment` | abbreviation-lexicon-and-word-level-alignment owns its evidence and state; it preserves the → relationship from upstream `atomic-split-or-merge-rekeying-all-tiers` and passes stable identity to `free-translation-and-analyst-notes`. It does not absorb another region's owner. |
| `free-translation-and-analyst-notes` | free-translation-and-analyst-notes owns its evidence and state; it preserves the → relationship from upstream `abbreviation-lexicon-and-word-level-alignment` and passes stable identity to `orphan-boundary-and-tier-validation`. It does not absorb another region's owner. |
| `orphan-boundary-and-tier-validation` | orphan-boundary-and-tier-validation owns its evidence and state; it preserves the → relationship from upstream `free-translation-and-analyst-notes` and passes stable identity to `corpus-example-export`. It does not absorb another region's owner. |
| `corpus-example-export` | corpus-example-export owns its evidence and state; it preserves the → relationship from upstream `orphan-boundary-and-tier-validation` and emits completion evidence. It does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named simultaneous evidence relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Utterance context, word sequence, linked morpheme/form/gloss tiers, abbreviation lexicon and validation queue remain simultaneously visible.
- **Navigation replacement:** None; direct region access still fits and related evidence remains simultaneous.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only the intrinsically tabular, matrix, graph, timeline, notation, or media region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** The complete support scope can no longer remain persistent beside the active proof without reducing readable measure or hiding focus.
- **Topology response:** The active word and its tier alignment remain primary; full utterance, lexicon and analyst notes move to synchronized panels that retain the active morpheme.
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** The active proof may stay sticky only while reserved space keeps every focused control visible; short height yields.
- **Overflow owner:** The same bounded intrinsic region remains the only overflow owner; temporary support does not create nested page scroll.

### Compact

- **Failure trigger:** The active decision and its minimum proof no longer fit side by side at readable measure.
- **Topology response:** Utterance → word stable ID → pre-edit token and morpheme IDs → split or merge → incidence/cardinality links → post-edit form and gloss IDs → abbreviation and free translation → orphan check → commit or block; an unresolved or stale tier reference blocks commit, and each tier becomes an ordered semantic list instead of a squeezed alignment table.
- **Navigation replacement:** A labeled one-pane stage route replaces simultaneous columns and preserves the exact active object and recovery target.
- **Sticky boundary:** Only the current-stage action may persist with safe-area spacing; landscape or short height returns it to flow.
- **Overflow owner:** No page-level horizontal scroll; intrinsic two-dimensional evidence uses one labeled bounded region or a semantic list replacement.

### Reflow

- DOM order, reading order, and meaningful focus order are `interlinear-authoring → language-speaker-text-and-convention-version → utterance-and-stable-token-IDs → word-to-morpheme-incidence-and-cardinality-matrix ↔ object-language-form-tier ↔ lexical-and-grammatical-gloss-tier → atomic-split-or-merge-rekeying-all-tiers → abbreviation-lexicon-and-word-level-alignment → free-translation-and-analyst-notes → orphan-boundary-and-tier-validation → corpus-example-export`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific states: text draft/locked, convention current/changed, token confirmed/split/merged, morpheme boundary proposed/accepted/uncertain, gloss lexical/grammatical/missing, abbreviation defined/undefined/conflicting, alignment balanced/orphaned, free translation missing/current, validation pass/warn/fail and example exported/withdrawn.

## State obligations

Task-specific states: text draft/locked, convention current/changed, token confirmed/split/merged, morpheme boundary proposed/accepted/uncertain, gloss lexical/grammatical/missing, abbreviation defined/undefined/conflicting, alignment balanced/orphaned, free translation missing/current, validation pass/warn/fail and example exported/withdrawn.

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

- Template must show pre-edit stable IDs, split one word into multiple morphemes, atomically rekey every linked form and gloss, define one previously unknown abbreviation, block commit on a deliberately orphaned tier item, resolve it, preserve the utterance translation and export a valid corpus example without mouse-only dragging.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho `localization-workbench`, `media-annotation-workbench`, `spreadsheet-grid-editor` or `reconciliation-diff-workbench`; stable token ownership, a non-1:1 word-to-morpheme incidence/cardinality matrix, atomic split-or-merge rekeying across form and gloss tiers, abbreviation semantics and commit-blocking orphan validation are mandatory.
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `IGT-90`–`92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Leipzig Glossing Rules from the Max Planck Institute](https://www.eva.mpg.de/lingua/resources/glossing-rules.php) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [SIL FieldWorks interlinear text guidance](https://software.sil.org/fieldworks/features/orientation-to-fieldworks/interlinearize-texts/) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `interlinear-gloss-morpheme-alignment-workbench`. |
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
{"archetypeId":"interlinear-gloss-morpheme-alignment-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
