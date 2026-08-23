# Archaeological fragment refit assembly workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `archaeological-fragment-refit-assembly-workbench` |
| Family | Work |
| Dominant task | Test non-destructive physical joins among archaeological fragments, combine compatible joins into assembly hypotheses and use proven refits to interpret manufacture or redistribution while preserving uncertainty and conservation limits. |
| Search aliases | fragment refit, assembly hypothesis, physical join proof |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `refit-assembly` owns the complete dominant task, work state, and recovery boundary.
- Test non-destructive physical joins among archaeological fragments, combine compatible joins into assembly hypotheses and use proven refits to interpret manufacture or redistribution while preserving uncertainty and conservation limits.
- Every required region retains its named owner, relationship, and stable identity; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `REF-01` | Test non-destructive physical joins among archaeological fragments, combine compatible joins into assembly hypotheses and use proven refits to interpret manufacture or redistribution while preserving uncertainty and conservation limits. | Required positive evidence. |
| `REF-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `REF-03` | Template must compare one fragment against at least two mates, record material and edge evidence, fit one join with explicit transform and tolerance, reveal an overlap that makes two assemblies mutually exclusive, support non-drag controls, approve one hypothesis and retain the rejected alternative. | Require the domain-specific proof path. |
| `REF-04` | Work state must survive all three named topology responses. | Require responsive parity. |
| `REF-05` | Task-specific states: fragment stable/restricted, candidate unreviewed/likely/unlikely, surface sufficient/eroded, join aligned/misaligned, contact within/outside tolerance, transform provisional/locked, assembly compatible/overlapping, hypothesis active/mutually exclusive/superseded, conservation handling allowed/blocked and review accepted/rejected. | Require state and recovery coverage. |
| `REF-90` | Reject cho `canvas-inspector-studio`, `entity-resolution-cluster-adjudicator`, `knowledge-graph-explorer` or `chain-of-custody-transfer-ledger`; physical fragment surfaces, rigid contact transforms, proven joins, transitive assembly membership, overlap incompatibility and mutually exclusive reconstructions are mandatory. | Reject. |
| `REF-91` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |
| `REF-92` | An adjacent archetype owns the work object or completion event more precisely. | Reject. |

### Selection rule

Select `archaeological-fragment-refit-assembly-workbench` if and only if `REF-01`–`05` are evidenced and none of `REF-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
refit-assembly
├─ assemblage-provenience-material-and-conservation-context (downstream)
├─ fragment-register-and-surface-or-edge-evidence (downstream)
├─ candidate-pair-match-graph (downstream)
├─ selected-join-geometric-material-and-decoration-proof (downstream)
├─ rigid-transform-and-physical-contact-fit (downstream)
├─ transitive-assembly-hypothesis (downstream)
├─ overlap-incompatibility-and-mutual-exclusion-ledger (peer synchronization)
├─ manufacturing-sequence-and-context-redistribution-inference (downstream)
└─ reviewed-non-destructive-assembly-and-archive (downstream)
```

The binding relationship expression is `refit-assembly → assemblage-provenience-material-and-conservation-context → fragment-register-and-surface-or-edge-evidence → candidate-pair-match-graph → selected-join-geometric-material-and-decoration-proof → rigid-transform-and-physical-contact-fit → transitive-assembly-hypothesis ↔ overlap-incompatibility-and-mutual-exclusion-ledger → manufacturing-sequence-and-context-redistribution-inference → reviewed-non-destructive-assembly-and-archive`; operators retain the directed, peer, or joint-axis meaning declared by the prompt.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `refit-assembly` | refit-assembly owns its evidence and state and the dominant-task boundary and passes stable identity to `assemblage-provenience-material-and-conservation-context`. It does not absorb another region's owner. |
| `assemblage-provenience-material-and-conservation-context` | assemblage-provenience-material-and-conservation-context owns its evidence and state; it preserves the → relationship from upstream `refit-assembly` and passes stable identity to `fragment-register-and-surface-or-edge-evidence`. It does not absorb another region's owner. |
| `fragment-register-and-surface-or-edge-evidence` | fragment-register-and-surface-or-edge-evidence owns its evidence and state; it preserves the → relationship from upstream `assemblage-provenience-material-and-conservation-context` and passes stable identity to `candidate-pair-match-graph`. It does not absorb another region's owner. |
| `candidate-pair-match-graph` | candidate-pair-match-graph owns its evidence and state; it preserves the → relationship from upstream `fragment-register-and-surface-or-edge-evidence` and passes stable identity to `selected-join-geometric-material-and-decoration-proof`. It does not absorb another region's owner. |
| `selected-join-geometric-material-and-decoration-proof` | selected-join-geometric-material-and-decoration-proof owns its evidence and state; it preserves the → relationship from upstream `candidate-pair-match-graph` and passes stable identity to `rigid-transform-and-physical-contact-fit`. It does not absorb another region's owner. |
| `rigid-transform-and-physical-contact-fit` | rigid-transform-and-physical-contact-fit owns its evidence and state; it preserves the → relationship from upstream `selected-join-geometric-material-and-decoration-proof` and passes stable identity to `transitive-assembly-hypothesis`. It does not absorb another region's owner. |
| `transitive-assembly-hypothesis` | transitive-assembly-hypothesis owns its evidence and state; it preserves the → relationship from upstream `rigid-transform-and-physical-contact-fit` and passes stable identity to `overlap-incompatibility-and-mutual-exclusion-ledger`. It does not absorb another region's owner. |
| `overlap-incompatibility-and-mutual-exclusion-ledger` | overlap-incompatibility-and-mutual-exclusion-ledger owns its evidence and state; it preserves the ↔ relationship from upstream `transitive-assembly-hypothesis` and passes stable identity to `manufacturing-sequence-and-context-redistribution-inference`. It does not absorb another region's owner. |
| `manufacturing-sequence-and-context-redistribution-inference` | manufacturing-sequence-and-context-redistribution-inference owns its evidence and state; it preserves the → relationship from upstream `overlap-incompatibility-and-mutual-exclusion-ledger` and passes stable identity to `reviewed-non-destructive-assembly-and-archive`. It does not absorb another region's owner. |
| `reviewed-non-destructive-assembly-and-archive` | reviewed-non-destructive-assembly-and-archive owns its evidence and state; it preserves the → relationship from upstream `manufacturing-sequence-and-context-redistribution-inference` and emits completion evidence. It does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named simultaneous evidence relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Fragment register, candidate-pair graph, selected edge/surface evidence, transformed assembly, incompatibility ledger and inference remain visible together.
- **Navigation replacement:** None; direct region access still fits and related evidence remains simultaneous.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only the intrinsically tabular, matrix, graph, timeline, notation, or media region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** The complete support scope can no longer remain persistent beside the active proof without reducing readable measure or hiding focus.
- **Topology response:** The selected fragment pair and its contact-fit proof remain primary; whole assembly, provenience comparison and alternate hypotheses move to synchronized drawers.
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** The active proof may stay sticky only while reserved space keeps every focused control visible; short height yields.
- **Overflow owner:** The same bounded intrinsic region remains the only overflow owner; temporary support does not create nested page scroll.

### Compact

- **Failure trigger:** The active decision and its minimum proof no longer fit side by side at readable measure.
- **Topology response:** Fragment → candidate mate → edge/surface/material/decorative evidence → rigid fit and contact → assembly consequence → overlap or exclusion conflict → accept, reject or hold; imagery always has labeled evidence and transform values.
- **Navigation replacement:** A labeled one-pane stage route replaces simultaneous columns and preserves the exact active object and recovery target.
- **Sticky boundary:** Only the current-stage action may persist with safe-area spacing; landscape or short height returns it to flow.
- **Overflow owner:** No page-level horizontal scroll; intrinsic two-dimensional evidence uses one labeled bounded region or a semantic list replacement.

### Reflow

- DOM order, reading order, and meaningful focus order are `refit-assembly → assemblage-provenience-material-and-conservation-context → fragment-register-and-surface-or-edge-evidence → candidate-pair-match-graph → selected-join-geometric-material-and-decoration-proof → rigid-transform-and-physical-contact-fit → transitive-assembly-hypothesis ↔ overlap-incompatibility-and-mutual-exclusion-ledger → manufacturing-sequence-and-context-redistribution-inference → reviewed-non-destructive-assembly-and-archive`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific states: fragment stable/restricted, candidate unreviewed/likely/unlikely, surface sufficient/eroded, join aligned/misaligned, contact within/outside tolerance, transform provisional/locked, assembly compatible/overlapping, hypothesis active/mutually exclusive/superseded, conservation handling allowed/blocked and review accepted/rejected.

## State obligations

Task-specific states: fragment stable/restricted, candidate unreviewed/likely/unlikely, surface sufficient/eroded, join aligned/misaligned, contact within/outside tolerance, transform provisional/locked, assembly compatible/overlapping, hypothesis active/mutually exclusive/superseded, conservation handling allowed/blocked and review accepted/rejected.

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

- Template must compare one fragment against at least two mates, record material and edge evidence, fit one join with explicit transform and tolerance, reveal an overlap that makes two assemblies mutually exclusive, support non-drag controls, approve one hypothesis and retain the rejected alternative.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho `canvas-inspector-studio`, `entity-resolution-cluster-adjudicator`, `knowledge-graph-explorer` or `chain-of-custody-transfer-ledger`; physical fragment surfaces, rigid contact transforms, proven joins, transitive assembly membership, overlap incompatibility and mutually exclusive reconstructions are mandatory.
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `REF-90`–`92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Historic England guidance on lithic refitting studies](https://historicengland.org.uk/images-books/publications/managing-lithic-sites/heag318-managing-lithic-sites/) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [Canadian Conservation Institute care of archaeological collections guidance](https://www.canada.ca/en/conservation-institute/services/learning-activities/care-archaeological-collections.html) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `archaeological-fragment-refit-assembly-workbench`. |
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
{"archetypeId":"archaeological-fragment-refit-assembly-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
