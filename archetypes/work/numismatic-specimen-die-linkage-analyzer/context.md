# Numismatic specimen die linkage analyzer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `numismatic-specimen-die-linkage-analyzer` |
| Family | Work |
| Dominant task | Infer coin-production relationships by assigning each specimen independently to obverse and reverse die identities, then reviewing the specimen bridges that form die pairs, chains and a defensible production sequence. |
| Search aliases | die linkage, numismatic die study, bipartite die chain |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `die-linkage-analysis` owns the complete dominant task, work state, and recovery boundary.
- Infer coin-production relationships by assigning each specimen independently to obverse and reverse die identities, then reviewing the specimen bridges that form die pairs, chains and a defensible production sequence.
- Every required region retains its named owner, relationship, and stable identity; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `NUM-01` | Infer coin-production relationships by assigning each specimen independently to obverse and reverse die identities, then reviewing the specimen bridges that form die pairs, chains and a defensible production sequence. | Required positive evidence. |
| `NUM-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `NUM-03` | Template must assign one specimen to separate obverse and reverse candidates, show feature evidence and uncertainty, reveal a conflicting side assignment, resolve it without relying on image-only cues, update the die chain and publish a reviewed hypothesis with specimen-to-die link provenance. | Require the domain-specific proof path. |
| `NUM-04` | Work state must survive all three named topology responses. | Require responsive parity. |
| `NUM-05` | Task-specific states: specimen verified/duplicate/restricted, image sufficient/insufficient, obverse assignment proposed/confirmed/conflicted, reverse assignment proposed/confirmed/conflicted, die state early/late/unknown, pair linked/broken, chain connected/isolated, chronology supported/contradicted, hypothesis draft/reviewed and export current/retracted. | Require state and recovery coverage. |
| `NUM-90` | Reject cho `entity-resolution-cluster-workbench`, `phylogenetic-tree-comparison-workbench`, a generic knowledge graph or `media-annotation-review-console`; distinct obverse and reverse die partitions, specimen-as-bridge linkage, side-specific match evidence, wear state and die-chain production inference are mandatory. | Reject. |
| `NUM-91` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |
| `NUM-92` | An adjacent archetype owns the work object or completion event more precisely. | Reject. |

### Selection rule

Select `numismatic-specimen-die-linkage-analyzer` if and only if `NUM-01`–`05` are evidenced and none of `NUM-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
die-linkage-analysis
├─ corpus-mint-denomination-and-period (downstream)
├─ specimen-register-with-obverse-reverse-evidence (downstream)
├─ candidate-obverse-die-clusters (downstream)
├─ candidate-reverse-die-clusters (peer synchronization)
├─ specimen-to-obverse-and-reverse-die-bipartite-links (downstream)
├─ die-match-confidence-conflict-and-wear-state (downstream)
├─ die-pair-chain-and-link-sequence (downstream)
├─ production-chronology-and-output-hypotheses (downstream)
└─ reviewed-die-study-and-linked-data-export (downstream)
```

The binding relationship expression is `die-linkage-analysis → corpus-mint-denomination-and-period → specimen-register-with-obverse-reverse-evidence → candidate-obverse-die-clusters ↔ candidate-reverse-die-clusters → specimen-to-obverse-and-reverse-die-bipartite-links → die-match-confidence-conflict-and-wear-state → die-pair-chain-and-link-sequence → production-chronology-and-output-hypotheses → reviewed-die-study-and-linked-data-export`; operators retain the directed, peer, or joint-axis meaning declared by the prompt.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `die-linkage-analysis` | die-linkage-analysis owns its evidence and state and the dominant-task boundary and passes stable identity to `corpus-mint-denomination-and-period`. It does not absorb another region's owner. |
| `corpus-mint-denomination-and-period` | corpus-mint-denomination-and-period owns its evidence and state; it preserves the → relationship from upstream `die-linkage-analysis` and passes stable identity to `specimen-register-with-obverse-reverse-evidence`. It does not absorb another region's owner. |
| `specimen-register-with-obverse-reverse-evidence` | specimen-register-with-obverse-reverse-evidence owns its evidence and state; it preserves the → relationship from upstream `corpus-mint-denomination-and-period` and passes stable identity to `candidate-obverse-die-clusters`. It does not absorb another region's owner. |
| `candidate-obverse-die-clusters` | candidate-obverse-die-clusters owns its evidence and state; it preserves the → relationship from upstream `specimen-register-with-obverse-reverse-evidence` and passes stable identity to `candidate-reverse-die-clusters`. It does not absorb another region's owner. |
| `candidate-reverse-die-clusters` | candidate-reverse-die-clusters owns its evidence and state; it preserves the ↔ relationship from upstream `candidate-obverse-die-clusters` and passes stable identity to `specimen-to-obverse-and-reverse-die-bipartite-links`. It does not absorb another region's owner. |
| `specimen-to-obverse-and-reverse-die-bipartite-links` | specimen-to-obverse-and-reverse-die-bipartite-links owns its evidence and state; it preserves the → relationship from upstream `candidate-reverse-die-clusters` and passes stable identity to `die-match-confidence-conflict-and-wear-state`. It does not absorb another region's owner. |
| `die-match-confidence-conflict-and-wear-state` | die-match-confidence-conflict-and-wear-state owns its evidence and state; it preserves the → relationship from upstream `specimen-to-obverse-and-reverse-die-bipartite-links` and passes stable identity to `die-pair-chain-and-link-sequence`. It does not absorb another region's owner. |
| `die-pair-chain-and-link-sequence` | die-pair-chain-and-link-sequence owns its evidence and state; it preserves the → relationship from upstream `die-match-confidence-conflict-and-wear-state` and passes stable identity to `production-chronology-and-output-hypotheses`. It does not absorb another region's owner. |
| `production-chronology-and-output-hypotheses` | production-chronology-and-output-hypotheses owns its evidence and state; it preserves the → relationship from upstream `die-pair-chain-and-link-sequence` and passes stable identity to `reviewed-die-study-and-linked-data-export`. It does not absorb another region's owner. |
| `reviewed-die-study-and-linked-data-export` | reviewed-die-study-and-linked-data-export owns its evidence and state; it preserves the → relationship from upstream `production-chronology-and-output-hypotheses` and emits completion evidence. It does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named simultaneous evidence relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Specimen evidence, obverse die partition, reverse die partition, bipartite links, selected chain and chronology hypothesis remain visible together.
- **Navigation replacement:** None; direct region access still fits and related evidence remains simultaneous.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only the intrinsically tabular, matrix, graph, timeline, notation, or media region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** The complete support scope can no longer remain persistent beside the active proof without reducing readable measure or hiding focus.
- **Topology response:** The selected specimen and both candidate die assignments remain primary; whole-corpus network, wear chronology and export metadata move to synchronized drawers.
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** The active proof may stay sticky only while reserved space keeps every focused control visible; short height yields.
- **Overflow owner:** The same bounded intrinsic region remains the only overflow owner; temporary support does not create nested page scroll.

### Compact

- **Failure trigger:** The active decision and its minimum proof no longer fit side by side at readable measure.
- **Topology response:** Specimen → obverse candidates and evidence → reverse candidates and evidence → two assignments → die-pair bridge → chain consequence → review; image comparison always includes labeled feature evidence and confidence.
- **Navigation replacement:** A labeled one-pane stage route replaces simultaneous columns and preserves the exact active object and recovery target.
- **Sticky boundary:** Only the current-stage action may persist with safe-area spacing; landscape or short height returns it to flow.
- **Overflow owner:** No page-level horizontal scroll; intrinsic two-dimensional evidence uses one labeled bounded region or a semantic list replacement.

### Reflow

- DOM order, reading order, and meaningful focus order are `die-linkage-analysis → corpus-mint-denomination-and-period → specimen-register-with-obverse-reverse-evidence → candidate-obverse-die-clusters ↔ candidate-reverse-die-clusters → specimen-to-obverse-and-reverse-die-bipartite-links → die-match-confidence-conflict-and-wear-state → die-pair-chain-and-link-sequence → production-chronology-and-output-hypotheses → reviewed-die-study-and-linked-data-export`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific states: specimen verified/duplicate/restricted, image sufficient/insufficient, obverse assignment proposed/confirmed/conflicted, reverse assignment proposed/confirmed/conflicted, die state early/late/unknown, pair linked/broken, chain connected/isolated, chronology supported/contradicted, hypothesis draft/reviewed and export current/retracted.

## State obligations

Task-specific states: specimen verified/duplicate/restricted, image sufficient/insufficient, obverse assignment proposed/confirmed/conflicted, reverse assignment proposed/confirmed/conflicted, die state early/late/unknown, pair linked/broken, chain connected/isolated, chronology supported/contradicted, hypothesis draft/reviewed and export current/retracted.

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

- Template must assign one specimen to separate obverse and reverse candidates, show feature evidence and uncertainty, reveal a conflicting side assignment, resolve it without relying on image-only cues, update the die chain and publish a reviewed hypothesis with specimen-to-die link provenance.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho `entity-resolution-cluster-workbench`, `phylogenetic-tree-comparison-workbench`, a generic knowledge graph or `media-annotation-review-console`; distinct obverse and reverse die partitions, specimen-as-bridge linkage, side-specific match evidence, wear state and die-chain production inference are mandatory.
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `NUM-90`–`92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Nomisma.org ontology](https://www.nomisma.org/ontology) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [American Numismatic Society guide to die links and sequences](https://numismatics.org/pocketchange/die-links-and-sequences/) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `numismatic-specimen-die-linkage-analyzer`. |
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
{"archetypeId":"numismatic-specimen-die-linkage-analyzer","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
