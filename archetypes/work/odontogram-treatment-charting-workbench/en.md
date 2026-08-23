# Odontogram treatment charting workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `odontogram-treatment-charting-workbench` |
| Family | Work |
| Dominant task | Record current findings and planned, performed or superseded treatment at exact teeth and surfaces while preserving a constrained longitudinal dental state |
| Search aliases | dental chart, tooth surface state, treatment transition |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `dental-chart` owns the complete dominant task and recovery boundary.
- Record current findings and planned, performed or superseded treatment at exact teeth and surfaces while preserving a constrained longitudinal dental state
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-OTC-01` | Record current findings and planned, performed or superseded treatment at exact teeth and surfaces while preserving a constrained longitudinal dental state | Required positive evidence. |
| `AR-OTC-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `AR-OTC-03` | Work state must survive all three named topology responses. | Require responsive parity. |
| `AR-OTC-04` | Pending, error, permission, stale, or conflict can occur after work state exists. | Require recovery without lost input or focus meaning. |
| `AR-OTC-90` | The dominant task belongs to an adjacent archetype named in the hard rejection. | Reject. |
| `AR-OTC-91` | Reject cho `media-annotation-workbench`, `canvas-inspector-studio`, image markup, spreadsheet or generic record form; non-visual tooth/surface addressing, mutually exclusive finite states and validated planned→performed→superseded transitions are mandatory | Reject. |
| `AR-OTC-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `odontogram-treatment-charting-workbench` if and only if `AR-OTC-01`–`04` are evidenced, every required region and relationship is present, and none of `AR-OTC-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
dental-chart
├─ dentition-and-notation-context
├─ fixed-tooth-by-surface-semantic-matrix
├─ selected-tooth-finite-state-ledger (peer synchronization)
├─ planned-procedure-layer
├─ performed-or-superseded-transition-layer
├─ notation-and-state-consistency-gate
└─ signed-chart-snapshot
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `dental-chart` | Owns the dominant task, complete state, and recovery boundary for odontogram-treatment-charting-workbench. |
| `dentition-and-notation-context` | Owns dentition and notation context; preserves the required relationship with upstream `dental-chart` and downstream `fixed-tooth-by-surface-semantic-matrix`, and does not absorb another region's owner. |
| `fixed-tooth-by-surface-semantic-matrix` | Owns fixed tooth by surface semantic matrix; preserves the required relationship with upstream `dentition-and-notation-context` and downstream `selected-tooth-finite-state-ledger`, and does not absorb another region's owner. |
| `selected-tooth-finite-state-ledger` | Owns selected tooth finite state ledger; preserves the required relationship with upstream `fixed-tooth-by-surface-semantic-matrix` and downstream `planned-procedure-layer`, and does not absorb another region's owner. |
| `planned-procedure-layer` | Owns planned procedure layer; preserves the required relationship with upstream `selected-tooth-finite-state-ledger` and downstream `performed-or-superseded-transition-layer`, and does not absorb another region's owner. |
| `performed-or-superseded-transition-layer` | Owns performed or superseded transition layer; preserves the required relationship with upstream `planned-procedure-layer` and downstream `notation-and-state-consistency-gate`, and does not absorb another region's owner. |
| `notation-and-state-consistency-gate` | Owns notation and state consistency gate; preserves the required relationship with upstream `performed-or-superseded-transition-layer` and downstream `signed-chart-snapshot`, and does not absorb another region's owner. |
| `signed-chart-snapshot` | Owns signed chart snapshot; preserves the required relationship with upstream `notation-and-state-consistency-gate`, and does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Full semantic dentition matrix, selected tooth/surface ledger, procedure layers, history and consistency gate remain visible
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `fixed-tooth-by-surface-semantic-matrix` owns bounded two-axis navigation; compact replaces it with addressed paths.

### Intermediate

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Odontogram matrix stays primary; state-transition editor and longitudinal history become synchronized alternate panes without losing tooth/surface address
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `fixed-tooth-by-surface-semantic-matrix` owns bounded two-axis navigation; compact replaces it with addressed paths.

### Compact

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Dentition/quadrant → keyboard-addressable tooth×surface grid → current finite state → planned/performed/superseded transition → history → sign; it never shrinks a mouth canvas
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `fixed-tooth-by-surface-semantic-matrix` owns bounded two-axis navigation; compact replaces it with addressed paths.

### Reflow

- DOM order, reading order và meaningful focus order are `dental-chart → dentition-and-notation-context → fixed-tooth-by-surface-semantic-matrix → selected-tooth-finite-state-ledger → planned-procedure-layer → performed-or-superseded-transition-layer → notation-and-state-consistency-gate → signed-chart-snapshot`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task parity includes dentition primary/mixed/permanent, tooth present/missing/unerupted, surface sound/pathology/restored, procedure planned/performed/superseded, transition permitted/contradictory, notation compatible/invalid, history loading/conflicted and snapshot unsigned/signing/signed/amended.

## State obligations

Task-specific states: dentition primary/mixed/permanent, tooth present/missing/unerupted, surface sound/pathology/restored, procedure planned/performed/superseded, transition permitted/contradictory, notation compatible/invalid, history loading/conflicted and snapshot unsigned/signing/signed/amended.

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

- Template must select any tooth/surface without pointer input, distinguish clinical states without color alone, reject an impossible transition or incompatible notation, preserve history through compact reflow and sign an immutable chart snapshot
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho `media-annotation-workbench`, `canvas-inspector-studio`, image markup, spreadsheet or generic record form; non-visual tooth/surface addressing, mutually exclusive finite states and validated planned→performed→superseded transitions are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-OTC-90`, `91` or `92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [ADA Universal Tooth Designation System](https://www.ada.org/-/media/project/ada-organization/ada/ada-org/files/publications/cdt/universal_tooth_designation_system_valueset_2.pdf) | Provides official evidence for dentition and notation context. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [HL7 Dental Data Exchange](https://hl7.org/fhir/us/dental-data-exchange/) | Provides official evidence for fixed tooth by surface semantic matrix. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [ISO 3950](https://www.iso.org/standard/68292.html) | Provides official evidence for selected tooth finite state ledger. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [W3C Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Provides official evidence for keyboard, focus, reflow, or status behavior. | Does not prove product truth, exact geometry, breakpoints, or components. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `odontogram-treatment-charting-workbench`. |
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
{"archetypeId":"odontogram-treatment-charting-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
