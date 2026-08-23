# Capitalization dilution event modeler

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `capitalization-dilution-event-modeler` |
| Family | Work |
| Dominant task | Execute one financing or capitalization event across all outstanding equity and equity-linked instruments in the prescribed dependency order, then issue a reconciled post-event ownership record. |
| Search aliases | `cap table event cascade`, `fully diluted ownership bridge`, `conversion issuance pool modeler` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Execute one financing or capitalization event across all outstanding equity and equity-linked instruments in the prescribed dependency order, then issue a reconciled post-event ownership record.
- A frozen pre-event snapshot and instrument-rights dependency DAG govern an ordered cascade whose share, proceeds, rounding, and protective-adjustment effects propagate to every affected holder before close.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-CDE-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-CDE-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-CDE-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-CDE-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-CDE-90` | The dominant task is actually scenario sensitivity modeling. | Reject. |
| `AR-CDE-91` | The dominant task is actually capacity allocation. | Reject. |
| `AR-CDE-92` | The dominant task is actually spreadsheet grid editing. | Reject. |
| `AR-CDE-93` | The dominant task is actually signed contribution waterfall. | Reject. |

### Selection rule

Select `capitalization-dilution-event-modeler` if and only if `AR-CDE-01` through `AR-CDE-04` are evidenced and none of `AR-CDE-90` through `AR-CDE-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
dilution-event
|-- frozen-pre-event-capitalization-snapshot
|-- instrument-rights-dependency-dag
|-- financing-or-corporate-event-terms
|-- dependency-ordered-conversion-exercise-issuance-pool-resize-and-protective-adjustment-cascade
|   |-- affected-instrument-set
|   `-- per-holder-share-and-proceeds-propagation
|-- fully-diluted-ownership-bridge-for-all-affected-holders
|-- rounding-and-residuals
|-- approval-close-and-security-issuance
`-- post-event-cap-table-and-certificate-lineage
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `dilution-event` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `frozen-pre-event-capitalization-snapshot` | Owns Frozen Pre Event Capitalization Snapshot evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `instrument-rights-dependency-dag` | Owns Instrument Rights Dependency Dag evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `financing-or-corporate-event-terms` | Owns Financing Or Corporate Event Terms evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `dependency-ordered-conversion-exercise-issuance-pool-resize-and-protective-adjustment-cascade` | Owns Dependency Ordered Conversion Exercise Issuance Pool Resize And Protective Adjustment Cascade evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `affected-instrument-set` | Owns Affected Instrument Set evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `per-holder-share-and-proceeds-propagation` | Owns Per Holder Share And Proceeds Propagation evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `fully-diluted-ownership-bridge-for-all-affected-holders` | Owns Fully Diluted Ownership Bridge For All Affected Holders evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `rounding-and-residuals` | Owns Rounding And Residuals evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `approval-close-and-security-issuance` | Owns Approval Close And Security Issuance evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `post-event-cap-table-and-certificate-lineage` | Owns Post Event Cap Table And Certificate Lineage evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Pre-event instruments, dependency sequence, active conversion terms, all-holder impact bridge, rounding receipt, and post-event ownership remain visible together.
- **Navigation replacement:** None while all simultaneous regions remain usable.
- **Sticky boundary:** Only the current-task receipt or blocking action may persist; it reserves space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `fully-diluted-ownership-bridge-for-all-affected-holders` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The active sequence step and affected holders remain primary; full rights register, alternate assumptions, frozen snapshot detail, and certificate history move to synchronized drawers.
- **Navigation replacement:** A synchronized drawer replaces the displaced region and preserves the selected object, query, state, scroll context, and exact trigger.
- **Sticky boundary:** Only the current-task receipt or blocking action may persist; it reserves space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `fully-diluted-ownership-bridge-for-all-affected-holders` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44 CSS-pixel targets, and unobscured focus.
- **Topology response:** Event terms → next ordered conversion, exercise, pool resize, or issuance → affected instrument and holder → shares and proceeds → rounding or protective adjustment → post-event ownership → approve close; the ownership matrix becomes an event-step route.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** Only the current-task receipt or blocking action may persist; it reserves space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `fully-diluted-ownership-bridge-for-all-affected-holders` becomes a semantic list or step route when its bounded view no longer fits.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `dilution-event -> frozen-pre-event-capitalization-snapshot -> instrument-rights-dependency-dag -> financing-or-corporate-event-terms -> dependency-ordered-conversion-exercise-issuance-pool-resize-and-protective-adjustment-cascade -> affected-instrument-set -> per-holder-share-and-proceeds-propagation -> fully-diluted-ownership-bridge-for-all-affected-holders -> rounding-and-residuals -> approval-close-and-security-issuance -> post-event-cap-table-and-certificate-lineage`.
- Long labels, localization, zoom, and enlarged controls trigger the same named topology changes.
- CSS never reorders semantics; ordinary content creates no page-level horizontal scroll.
- Hidden detail always has an explicit accessible reveal path.

### Interaction parity

- Every wide selection, edit, action, explanation, retry, and recovery remains reachable at intermediate and compact.
- Topology changes preserve the exact selected object, order, input, pending result, and error context.
- Pointer actions have keyboard equivalents; color is never the only signal.
- Dynamic updates announce one contextual status without stealing focus.

## State obligations

Task-specific states: snapshot draft/frozen; instrument outstanding/convertible/exercisable/cancelled; term valid/disputed; sequence blocked/runnable; conversion pending/applied; option pool unchanged/resized; share count exact/rounded/residual; holder ownership provisional/final; approval pending/complete; issuance pending/recorded; cap table corrected/superseded.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `frozen-pre-event-capitalization-snapshot` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `instrument-rights-dependency-dag` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `instrument-rights-dependency-dag` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `approval-close-and-security-issuance` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `post-event-cap-table-and-certificate-lineage` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `approval-close-and-security-issuance` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `post-event-cap-table-and-certificate-lineage` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `frozen-pre-event-capitalization-snapshot` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `approval-close-and-security-issuance` | Move focus only to a required error summary or modal, then return it to the exact trigger. |
| Responsive presentation | `dilution-event` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Execute one financing or capitalization event across all outstanding equity and equity-linked instruments in the prescribed dependency order, then issue a reconciled post-event ownership record.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject scenario sensitivity modeling; this is `AR-CDE-90` evidence and must route to an adjacent archetype.
- Reject capacity allocation; this is `AR-CDE-91` evidence and must route to an adjacent archetype.
- Reject spreadsheet grid editing; this is `AR-CDE-92` evidence and must route to an adjacent archetype.
- Reject signed contribution waterfall; this is `AR-CDE-93` evidence and must route to an adjacent archetype.

### Boundary verdict

Return `accept` only when the dominant task, complete graph, and compact parity all hold. Differences limited to noun, density, color, component, card count, or state are `duplicate-or-variation`.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permitted actions, and truthful state meaning to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow, and relationship-driven transition points.
- Neither handoff may remove a required region, change the dominant task, or weaken interaction parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports synthesis of task relationships, adaptive behavior, and accessibility obligations; it does not select StarCi owners, exact geometry, or permission to copy a source interface.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [U.S. SEC — Small-business capital formation glossary](https://www.sec.gov/resources-small-businesses/glossary) | Cap-table, convertible-note, dilution, authorized-share, and security vocabulary. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [Delaware Code — Title 8, stock and dividends](https://delcode.delaware.gov/title8/c001/sc05/index.html) | Corporate authority context for stock issuance, classes, and consideration. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Dense holder/instrument comparison, row selection, and bounded ownership tables. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Treegrid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Keyboard traversal and focus/selection distinction for an instrument dependency hierarchy. | Does not select the archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "capitalization-dilution-event-modeler",
  "situationCodes": [
    "<matched AR-CDE-* codes>"
  ],
  "searchAliases": [
    "cap table event cascade",
    "fully diluted ownership bridge",
    "conversion issuance pool modeler"
  ],
  "dominantTask": "Execute one financing or capitalization event across all outstanding equity and equity-linked instruments in the prescribed dependency order, then issue a reconciled post-event ownership record.",
  "regions": [
    "dilution-event",
    "frozen-pre-event-capitalization-snapshot",
    "instrument-rights-dependency-dag",
    "financing-or-corporate-event-terms",
    "dependency-ordered-conversion-exercise-issuance-pool-resize-and-protective-adjustment-cascade",
    "affected-instrument-set",
    "per-holder-share-and-proceeds-propagation",
    "fully-diluted-ownership-bridge-for-all-affected-holders",
    "rounding-and-residuals",
    "approval-close-and-security-issuance",
    "post-event-cap-table-and-certificate-lineage"
  ],
  "regionRelationships": [
    "A frozen pre-event snapshot and instrument-rights dependency DAG govern an ordered cascade whose share, proceeds, rounding, and protective-adjustment effects propagate to every affected holder before close."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and drawer response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "dilution-event -> frozen-pre-event-capitalization-snapshot -> instrument-rights-dependency-dag -> financing-or-corporate-event-terms -> dependency-ordered-conversion-exercise-issuance-pool-resize-and-protective-adjustment-cascade -> affected-instrument-set -> per-holder-share-and-proceeds-propagation -> fully-diluted-ownership-bridge-for-all-affected-holders -> rounding-and-residuals -> approval-close-and-security-issuance -> post-event-cap-table-and-certificate-lineage",
    "navigationReplacement": "<none, synchronized drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved space and short-height yield>",
    "overflowOwner": "fully-diluted-ownership-bridge-for-all-affected-holders",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "snapshot draft/frozen",
    "instrument outstanding/convertible/exercisable/cancelled",
    "term valid/disputed",
    "sequence blocked/runnable",
    "conversion pending/applied",
    "option pool unchanged/resized",
    "share count exact/rounded/residual",
    "holder ownership provisional/final",
    "approval pending/complete",
    "issuance pending/recorded",
    "cap table corrected/superseded"
  ],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": [
    "<product meaning and semantic owners>"
  ],
  "principlesHandoff": [
    "<unresolved geometry only>"
  ],
  "confidence": "<high | medium | low>",
  "evidence": [
    "<business or current-source facts>",
    "<official task research>",
    "<accessibility research>"
  ]
}
```

