# Multi rendition creative adaptation workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `multi-rendition-creative-adaptation-workbench` |
| Family | Work |
| Dominant task | Adapt one approved creative master into multiple target renditions while preserving message hierarchy, asset lineage, safe areas and explicit per-target overrides |
| Search aliases | creative rendition, master adaptation, safe-area override |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `adaptation-workbench` owns the complete dominant task and recovery boundary.
- Adapt one approved creative master into multiple target renditions while preserving message hierarchy, asset lineage, safe areas and explicit per-target overrides
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-MCA-01` | Adapt one approved creative master into multiple target renditions while preserving message hierarchy, asset lineage, safe areas and explicit per-target overrides | Required positive evidence. |
| `AR-MCA-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `AR-MCA-03` | Work state must survive all three named topology responses. | Require responsive parity. |
| `AR-MCA-04` | Pending, error, permission, stale, or conflict can occur after work state exists. | Require recovery without lost input or focus meaning. |
| `AR-MCA-90` | The dominant task belongs to an adjacent archetype named in the hard rejection. | Reject. |
| `AR-MCA-91` | Reject cho localization workbench, canvas inspector, responsive page preview or asset gallery; one-to-many master propagation with target-specific safe-area and override provenance is mandatory | Reject. |
| `AR-MCA-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `multi-rendition-creative-adaptation-workbench` if and only if `AR-MCA-01`–`04` are evidenced, every required region and relationship is present, and none of `AR-MCA-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
adaptation-workbench
├─ master-creative-and-message-rules
├─ target-rendition-matrix
├─ selected-rendition-stage
├─ crop-layout-content-overrides (peer synchronization)
├─ cross-rendition-consistency-ledger
└─ approval-and-export-manifest
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `adaptation-workbench` | Owns the dominant task, complete state, and recovery boundary for multi-rendition-creative-adaptation-workbench. |
| `master-creative-and-message-rules` | Owns master creative and message rules; preserves the required relationship with upstream `adaptation-workbench` and downstream `target-rendition-matrix`, and does not absorb another region's owner. |
| `target-rendition-matrix` | Owns target rendition matrix; preserves the required relationship with upstream `master-creative-and-message-rules` and downstream `selected-rendition-stage`, and does not absorb another region's owner. |
| `selected-rendition-stage` | Owns selected rendition stage; preserves the required relationship with upstream `target-rendition-matrix` and downstream `crop-layout-content-overrides`, and does not absorb another region's owner. |
| `crop-layout-content-overrides` | Owns crop layout content overrides; preserves the required relationship with upstream `selected-rendition-stage` and downstream `cross-rendition-consistency-ledger`, and does not absorb another region's owner. |
| `cross-rendition-consistency-ledger` | Owns cross rendition consistency ledger; preserves the required relationship with upstream `crop-layout-content-overrides` and downstream `approval-and-export-manifest`, and does not absorb another region's owner. |
| `approval-and-export-manifest` | Owns approval and export manifest; preserves the required relationship with upstream `cross-rendition-consistency-ledger`, and does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Master, rendition matrix, selected stage and consistency ledger remain concurrently visible
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Master becomes a comparison drawer; selected rendition and override/consistency regions remain primary
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Target selector → inherited master rules → rendition stage → explicit overrides → cross-target warnings → approval/export; target previews become a list, not a miniature wall
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order are `adaptation-workbench → master-creative-and-message-rules → target-rendition-matrix → selected-rendition-stage → crop-layout-content-overrides → cross-rendition-consistency-ledger → approval-and-export-manifest`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task parity includes master loading/locked, target missing, inherited/overridden, crop unsafe, copy overflow, asset unavailable, consistency warning, approval pending/rejected and export partial/complete.

## State obligations

Task-specific states: master loading/locked, target missing, inherited/overridden, crop unsafe, copy overflow, asset unavailable, consistency warning, approval pending/rejected and export partial/complete.

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

- Template must switch among target renditions, show inherited versus overridden properties, detect an unsafe crop and prove that a master change propagates without erasing an approved override
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho localization workbench, canvas inspector, responsive page preview or asset gallery; one-to-many master propagation with target-specific safe-area and override provenance is mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-MCA-90`, `91` or `92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Google Ads specifications](https://support.google.com/google-ads/answer/13676244?hl=en) | Provides official evidence for master creative and message rules. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [Meta ad aspect ratios](https://www.facebook.com/business/help/103816146375741) | Provides official evidence for target rendition matrix. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [W3C image alternatives](https://www.w3.org/WAI/tutorials/images/) | Provides official evidence for keyboard, focus, reflow, or status behavior. | Does not prove product truth, exact geometry, breakpoints, or components. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `multi-rendition-creative-adaptation-workbench`. |
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
{"archetypeId":"multi-rendition-creative-adaptation-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
