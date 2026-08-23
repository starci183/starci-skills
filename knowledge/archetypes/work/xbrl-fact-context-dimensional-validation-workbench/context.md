# XBRL fact context dimensional validation workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `xbrl-fact-context-dimensional-validation-workbench` |
| Family | Work |
| Dominant task | Validate each reported XBRL fact through its taxonomy concept, period and entity context, unit, dimensions, and relationship networks, then correct the smallest semantic graph node and prove deterministic revalidation without changing intended meaning. |
| Search aliases | `XBRL semantic graph validator`, `fact context dimension repair`, `taxonomy relationship validation` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Validate each reported XBRL fact through its taxonomy concept, period and entity context, unit, dimensions, and relationship networks, then correct the smallest semantic graph node and prove deterministic revalidation without changing intended meaning.
- A reported fact is valid only when its fact-to-concept, context, unit, dimension, and taxonomy-relationship neighborhood is coherent; a correction changes the smallest owning node and exposes every affected fact before rerun.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-XFD-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-XFD-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-XFD-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-XFD-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-XFD-90` | The dominant task is actually regulatory filing package validation. | Reject. |
| `AR-XFD-91` | The dominant task is actually data import mapping. | Reject. |
| `AR-XFD-92` | The dominant task is actually document outline editing. | Reject. |
| `AR-XFD-93` | The dominant task is actually generic schema validation. | Reject. |

### Selection rule

Select `xbrl-fact-context-dimensional-validation-workbench` if and only if `AR-XFD-01` through `AR-XFD-04` are evidenced and none of `AR-XFD-90` through `AR-XFD-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
xbrl-validation
|-- report-taxonomy-entry-points-and-filing-rule-version
|-- reported-fact-register
|   `-- selected-fact <-> concept-type-period-balance-and-label
|       |-- context-entity-period-scenario
|       |-- unit-and-decimals-precision
|       `-- explicit-and-typed-dimension-members
|-- presentation-calculation-definition-and-formula-relationships
|-- semantic-issue-and-affected-fact-set
|-- graph-node-correction-and-revalidation
`-- accepted-report-and-validation-receipt
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `xbrl-validation` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `report-taxonomy-entry-points-and-filing-rule-version` | Owns Report Taxonomy Entry Points And Filing Rule Version evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `reported-fact-register` | Owns Reported Fact Register evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `selected-fact` | Owns Selected Fact evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `concept-type-period-balance-and-label` | Owns Concept Type Period Balance And Label evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `context-entity-period-scenario` | Owns Context Entity Period Scenario evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `unit-and-decimals-precision` | Owns Unit And Decimals Precision evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `explicit-and-typed-dimension-members` | Owns Explicit And Typed Dimension Members evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `presentation-calculation-definition-and-formula-relationships` | Owns Presentation Calculation Definition And Formula Relationships evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `semantic-issue-and-affected-fact-set` | Owns Semantic Issue And Affected Fact Set evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `graph-node-correction-and-revalidation` | Owns Graph Node Correction And Revalidation evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `accepted-report-and-validation-receipt` | Owns Accepted Report And Validation Receipt evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Fact register, selected fact, concept/context/unit/dimension graph, relationship networks, issue queue, and validation result remain simultaneously inspectable.
- **Navigation replacement:** None while all simultaneous regions remain usable.
- **Sticky boundary:** Only the current-task receipt or blocking action may persist; it reserves space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `reported-fact-register` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The selected semantic issue and affected graph neighborhood remain primary; taxonomy tree, full fact register, and validation history move to a synchronized evidence drawer.
- **Navigation replacement:** A synchronized drawer replaces the displaced region and preserves the selected object, query, state, scroll context, and exact trigger.
- **Sticky boundary:** Only the current-task receipt or blocking action may persist; it reserves space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `reported-fact-register` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44 CSS-pixel targets, and unobscured focus.
- **Topology response:** Issue → affected fact → concept → context and unit → dimensions → relationship edge → correct one owning node → rerun affected rules → whole-report receipt; grids become one navigable semantic chain.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** Only the current-task receipt or blocking action may persist; it reserves space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `reported-fact-register` becomes a semantic list or step route when its bounded view no longer fits.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `xbrl-validation -> report-taxonomy-entry-points-and-filing-rule-version -> reported-fact-register -> selected-fact -> concept-type-period-balance-and-label -> context-entity-period-scenario -> unit-and-decimals-precision -> explicit-and-typed-dimension-members -> presentation-calculation-definition-and-formula-relationships -> semantic-issue-and-affected-fact-set -> graph-node-correction-and-revalidation -> accepted-report-and-validation-receipt`.
- Long labels, localization, zoom, and enlarged controls trigger the same named topology changes.
- CSS never reorders semantics; ordinary content creates no page-level horizontal scroll.
- Hidden detail always has an explicit accessible reveal path.

### Interaction parity

- Every wide selection, edit, action, explanation, retry, and recovery remains reachable at intermediate and compact.
- Topology changes preserve the exact selected object, order, input, pending result, and error context.
- Pointer actions have keyboard equivalents; color is never the only signal.
- Dynamic updates announce one contextual status without stealing focus.

## State obligations

Task-specific states: taxonomy loading/resolved/missing; fact reported/duplicate/inconsistent; concept standard/extension/deprecated; context valid/malformed/duplicate; unit compatible/incompatible; dimension allowed/disallowed/missing; relationship satisfied/broken/circular; calculation consistent/inconsistent; correction draft/applied/reverted; validation running/pass/fail; report draft/accepted/superseded.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `report-taxonomy-entry-points-and-filing-rule-version` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `reported-fact-register` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `reported-fact-register` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `graph-node-correction-and-revalidation` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `accepted-report-and-validation-receipt` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `graph-node-correction-and-revalidation` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `accepted-report-and-validation-receipt` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `report-taxonomy-entry-points-and-filing-rule-version` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `graph-node-correction-and-revalidation` | Move focus only to a required error summary or modal, then return it to the exact trigger. |
| Responsive presentation | `xbrl-validation` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Validate each reported XBRL fact through its taxonomy concept, period and entity context, unit, dimensions, and relationship networks, then correct the smallest semantic graph node and prove deterministic revalidation without changing intended meaning.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject regulatory filing package validation; this is `AR-XFD-90` evidence and must route to an adjacent archetype.
- Reject data import mapping; this is `AR-XFD-91` evidence and must route to an adjacent archetype.
- Reject document outline editing; this is `AR-XFD-92` evidence and must route to an adjacent archetype.
- Reject generic schema validation; this is `AR-XFD-93` evidence and must route to an adjacent archetype.

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
| [XBRL International — Specifications](https://specifications.xbrl.org/specifications.html) | Concept, context, unit, dimensions, calculation, definition, presentation, and formula recommendation families. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [U.S. SEC — EDGAR technical specifications](https://www.sec.gov/submit-filings/technical-specifications) | Filing-rule versions and EDGAR XBRL validation context. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Dense fact-register selection, row actions, and bounded disclosure. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Treegrid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Keyboard navigation and distinct focus/selection for hierarchical tabular relationships. | Does not select the archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "xbrl-fact-context-dimensional-validation-workbench",
  "situationCodes": [
    "<matched AR-XFD-* codes>"
  ],
  "searchAliases": [
    "XBRL semantic graph validator",
    "fact context dimension repair",
    "taxonomy relationship validation"
  ],
  "dominantTask": "Validate each reported XBRL fact through its taxonomy concept, period and entity context, unit, dimensions, and relationship networks, then correct the smallest semantic graph node and prove deterministic revalidation without changing intended meaning.",
  "regions": [
    "xbrl-validation",
    "report-taxonomy-entry-points-and-filing-rule-version",
    "reported-fact-register",
    "selected-fact",
    "concept-type-period-balance-and-label",
    "context-entity-period-scenario",
    "unit-and-decimals-precision",
    "explicit-and-typed-dimension-members",
    "presentation-calculation-definition-and-formula-relationships",
    "semantic-issue-and-affected-fact-set",
    "graph-node-correction-and-revalidation",
    "accepted-report-and-validation-receipt"
  ],
  "regionRelationships": [
    "A reported fact is valid only when its fact-to-concept, context, unit, dimension, and taxonomy-relationship neighborhood is coherent; a correction changes the smallest owning node and exposes every affected fact before rerun."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and drawer response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "xbrl-validation -> report-taxonomy-entry-points-and-filing-rule-version -> reported-fact-register -> selected-fact -> concept-type-period-balance-and-label -> context-entity-period-scenario -> unit-and-decimals-precision -> explicit-and-typed-dimension-members -> presentation-calculation-definition-and-formula-relationships -> semantic-issue-and-affected-fact-set -> graph-node-correction-and-revalidation -> accepted-report-and-validation-receipt",
    "navigationReplacement": "<none, synchronized drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved space and short-height yield>",
    "overflowOwner": "reported-fact-register",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "taxonomy loading/resolved/missing",
    "fact reported/duplicate/inconsistent",
    "concept standard/extension/deprecated",
    "context valid/malformed/duplicate",
    "unit compatible/incompatible",
    "dimension allowed/disallowed/missing",
    "relationship satisfied/broken/circular",
    "calculation consistent/inconsistent",
    "correction draft/applied/reverted",
    "validation running/pass/fail",
    "report draft/accepted/superseded"
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

