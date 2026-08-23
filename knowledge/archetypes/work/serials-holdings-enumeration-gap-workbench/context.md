# Serials holdings enumeration gap workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `serials-holdings-enumeration-gap-workbench` |
| Family | Work |
| Dominant task | Record and publish exactly which issues of a continuing serial a location holds by pairing hierarchical enumeration with chronology, predicting expected issues and distinguishing real gaps from irregular publication, supplements or bound-unit choices. |
| Search aliases | serial holdings, enumeration chronology, holdings gap proof |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `serials-holdings` owns the complete dominant task, work state, and recovery boundary.
- Record and publish exactly which issues of a continuing serial a location holds by pairing hierarchical enumeration with chronology, predicting expected issues and distinguishing real gaps from irregular publication, supplements or bound-unit choices.
- Every required region retains its named owner, relationship, and stable identity; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `SER-01` | Record and publish exactly which issues of a continuing serial a location holds by pairing hierarchical enumeration with chronology, predicting expected issues and distinguishing real gaps from irregular publication, supplements or bound-unit choices. | Required positive evidence. |
| `SER-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `SER-03` | Template must generate expected issues from one versioned pattern, identify each by paired enumeration and chronology, classify one as missing and another as not published, attach a supplement, compress the expanded issue set, re-expand one issue to prove identity equality and publish a statement that preserves the remaining claimable gap. | Require the domain-specific proof path. |
| `SER-04` | Work state must survive all three named topology responses. | Require responsive parity. |
| `SER-05` | Task-specific states: publication active/ceased/unknown, pattern regular/irregular/changed, issue expected/received/missing/not-published, enumeration valid/ambiguous, chronology exact/approximate, supplement linked/orphaned, index covered/missing, bound unit open/complete, summary valid/overcompressed and holdings published/revised. | Require state and recovery coverage. |
| `SER-90` | Reject cho `inventory-replenishment-planner`, `cycle-count-variance-reconciliation-workbench`, `timeline-status-monitor` or `spreadsheet-grid-editor`; a versioned publication-pattern generator, enumeration×chronology issue identity, received/missing/not-published/irregular classification and reversible statement equality proof are mandatory. | Reject. |
| `SER-91` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |
| `SER-92` | An adjacent archetype owns the work object or completion event more precisely. | Reject. |

### Selection rule

Select `serials-holdings-enumeration-gap-workbench` if and only if `SER-01`–`05` are evidenced and none of `SER-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
serials-holdings
├─ bibliographic-title-copy-location-and-publication-pattern-version (downstream)
├─ predicted-issue-generator (downstream)
├─ enumeration-levels (downstream)
├─ chronology-levels (joint identity axis)
├─ enumeration-chronology-issue-identity (downstream)
├─ received-item-ledger (downstream)
├─ expected-issue-classification-as-received-missing-not-published-or-irregular (downstream)
├─ supplement-index-and-bound-unit-check (downstream)
├─ reversible-expanded-to-compressed-to-expanded-equality-proof (downstream)
└─ publish-holdings-and-claiming-handoff (downstream)
```

The binding relationship expression is `serials-holdings → bibliographic-title-copy-location-and-publication-pattern-version → predicted-issue-generator → enumeration-levels × chronology-levels → enumeration-chronology-issue-identity → received-item-ledger → expected-issue-classification-as-received-missing-not-published-or-irregular → supplement-index-and-bound-unit-check → reversible-expanded-to-compressed-to-expanded-equality-proof → publish-holdings-and-claiming-handoff`; operators retain the directed, peer, or joint-axis meaning declared by the prompt.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `serials-holdings` | serials-holdings owns its evidence and state and the dominant-task boundary and passes stable identity to `bibliographic-title-copy-location-and-publication-pattern-version`. It does not absorb another region's owner. |
| `bibliographic-title-copy-location-and-publication-pattern-version` | bibliographic-title-copy-location-and-publication-pattern-version owns its evidence and state; it preserves the → relationship from upstream `serials-holdings` and passes stable identity to `predicted-issue-generator`. It does not absorb another region's owner. |
| `predicted-issue-generator` | predicted-issue-generator owns its evidence and state; it preserves the → relationship from upstream `bibliographic-title-copy-location-and-publication-pattern-version` and passes stable identity to `enumeration-levels`. It does not absorb another region's owner. |
| `enumeration-levels` | enumeration-levels owns its evidence and state; it preserves the → relationship from upstream `predicted-issue-generator` and passes stable identity to `chronology-levels`. It does not absorb another region's owner. |
| `chronology-levels` | chronology-levels owns its evidence and state; it preserves the × relationship from upstream `enumeration-levels` and passes stable identity to `enumeration-chronology-issue-identity`. It does not absorb another region's owner. |
| `enumeration-chronology-issue-identity` | enumeration-chronology-issue-identity owns its evidence and state; it preserves the → relationship from upstream `chronology-levels` and passes stable identity to `received-item-ledger`. It does not absorb another region's owner. |
| `received-item-ledger` | received-item-ledger owns its evidence and state; it preserves the → relationship from upstream `enumeration-chronology-issue-identity` and passes stable identity to `expected-issue-classification-as-received-missing-not-published-or-irregular`. It does not absorb another region's owner. |
| `expected-issue-classification-as-received-missing-not-published-or-irregular` | expected-issue-classification-as-received-missing-not-published-or-irregular owns its evidence and state; it preserves the → relationship from upstream `received-item-ledger` and passes stable identity to `supplement-index-and-bound-unit-check`. It does not absorb another region's owner. |
| `supplement-index-and-bound-unit-check` | supplement-index-and-bound-unit-check owns its evidence and state; it preserves the → relationship from upstream `expected-issue-classification-as-received-missing-not-published-or-irregular` and passes stable identity to `reversible-expanded-to-compressed-to-expanded-equality-proof`. It does not absorb another region's owner. |
| `reversible-expanded-to-compressed-to-expanded-equality-proof` | reversible-expanded-to-compressed-to-expanded-equality-proof owns its evidence and state; it preserves the → relationship from upstream `supplement-index-and-bound-unit-check` and passes stable identity to `publish-holdings-and-claiming-handoff`. It does not absorb another region's owner. |
| `publish-holdings-and-claiming-handoff` | publish-holdings-and-claiming-handoff owns its evidence and state; it preserves the → relationship from upstream `reversible-expanded-to-compressed-to-expanded-equality-proof` and emits completion evidence. It does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named simultaneous evidence relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Title/copy context, paired enumeration-chronology grid, expected sequence, gap ledger and compressed holdings statement remain visible together.
- **Navigation replacement:** None; direct region access still fits and related evidence remains simultaneous.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only the intrinsically tabular, matrix, graph, timeline, notation, or media region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** The complete support scope can no longer remain persistent beside the active proof without reducing readable measure or hiding focus.
- **Topology response:** The selected run and its expected-versus-received issues remain primary; caption hierarchy, bound units and statement rules move to synchronized drawers.
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** The active proof may stay sticky only while reserved space keeps every focused control visible; short height yields.
- **Overflow owner:** The same bounded intrinsic region remains the only overflow owner; temporary support does not create nested page scroll.

### Compact

- **Failure trigger:** The active decision and its minimum proof no longer fit side by side at readable measure.
- **Topology response:** Location/copy → publication-pattern version → predicted issue → enumeration×chronology identity → received, missing, not-published or irregular → supplement/binding evidence → expanded statement → compress → re-expand the same issue → equality proof → publish or claim; the complete issue matrix stays in a bounded table route.
- **Navigation replacement:** A labeled one-pane stage route replaces simultaneous columns and preserves the exact active object and recovery target.
- **Sticky boundary:** Only the current-stage action may persist with safe-area spacing; landscape or short height returns it to flow.
- **Overflow owner:** No page-level horizontal scroll; intrinsic two-dimensional evidence uses one labeled bounded region or a semantic list replacement.

### Reflow

- DOM order, reading order, and meaningful focus order are `serials-holdings → bibliographic-title-copy-location-and-publication-pattern-version → predicted-issue-generator → enumeration-levels × chronology-levels → enumeration-chronology-issue-identity → received-item-ledger → expected-issue-classification-as-received-missing-not-published-or-irregular → supplement-index-and-bound-unit-check → reversible-expanded-to-compressed-to-expanded-equality-proof → publish-holdings-and-claiming-handoff`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific states: publication active/ceased/unknown, pattern regular/irregular/changed, issue expected/received/missing/not-published, enumeration valid/ambiguous, chronology exact/approximate, supplement linked/orphaned, index covered/missing, bound unit open/complete, summary valid/overcompressed and holdings published/revised.

## State obligations

Task-specific states: publication active/ceased/unknown, pattern regular/irregular/changed, issue expected/received/missing/not-published, enumeration valid/ambiguous, chronology exact/approximate, supplement linked/orphaned, index covered/missing, bound unit open/complete, summary valid/overcompressed and holdings published/revised.

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

- Template must generate expected issues from one versioned pattern, identify each by paired enumeration and chronology, classify one as missing and another as not published, attach a supplement, compress the expanded issue set, re-expand one issue to prove identity equality and publish a statement that preserves the remaining claimable gap.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho `inventory-replenishment-planner`, `cycle-count-variance-reconciliation-workbench`, `timeline-status-monitor` or `spreadsheet-grid-editor`; a versioned publication-pattern generator, enumeration×chronology issue identity, received/missing/not-published/irregular classification and reversible statement equality proof are mandatory.
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `SER-90`–`92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Library of Congress MARC 21 Format for Holdings Data](https://www.loc.gov/marc/holdings/) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [NISO Z39.71 Holdings Statements for Bibliographic Items](https://www.niso.org/publications/z3971-2006-r2011) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `serials-holdings-enumeration-gap-workbench`. |
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
{"archetypeId":"serials-holdings-enumeration-gap-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
