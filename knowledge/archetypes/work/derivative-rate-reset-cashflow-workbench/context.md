# Derivative rate reset cashflow workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `derivative-rate-reset-cashflow-workbench` |
| Family | Work |
| Dominant task | Determine one contractual derivative reset from its schedule, observations, index, and fallback provisions; calculate the resulting leg cash flows; obtain counterparty agreement; and settle or dispute the payment. |
| Search aliases | `interest rate reset workbench`, `swap fixing cashflow confirmation`, `fallback rate determination` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Determine one contractual derivative reset from its schedule, observations, index, and fallback provisions; calculate the resulting leg cash flows; obtain counterparty agreement; and settle or dispute the payment.
- The exact accrual period and contractual observation method bind the rate determination to day count, notional, compounding, gross leg amounts, and the agreed net payment.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-DRR-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-DRR-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-DRR-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-DRR-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-DRR-90` | The dominant task is actually calendar resource scheduling. | Reject. |
| `AR-DRR-91` | The dominant task is actually timeline status monitoring. | Reject. |
| `AR-DRR-92` | The dominant task is actually generic calculation estimate. | Reject. |
| `AR-DRR-93` | The dominant task is actually generic cash-flow table. | Reject. |

### Selection rule

Select `derivative-rate-reset-cashflow-workbench` if and only if `AR-DRR-01` through `AR-DRR-04` are evidenced and none of `AR-DRR-90` through `AR-DRR-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
derivative-reset
|-- contract-confirmation-and-definition-version
|-- leg-schedule-and-business-day-conventions
|   `-- accrual-period-and-reset-event
|       `-- observation-set-index-source-and-fallback-waterfall
|           |-- fixed-or-floating-rate-determination
|           `-- day-count-notional-and-compounding-calculation
|-- gross-leg-cashflows-and-net-payment
|-- counterparty-confirmation-dispute-and-adjustment
`-- settled-cancelled-or-superseded-cashflow-lineage
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `derivative-reset` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `contract-confirmation-and-definition-version` | Owns Contract Confirmation And Definition Version evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `leg-schedule-and-business-day-conventions` | Owns Leg Schedule And Business Day Conventions evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `accrual-period-and-reset-event` | Owns Accrual Period And Reset Event evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `observation-set-index-source-and-fallback-waterfall` | Owns Observation Set Index Source And Fallback Waterfall evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `fixed-or-floating-rate-determination` | Owns Fixed Or Floating Rate Determination evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `day-count-notional-and-compounding-calculation` | Owns Day Count Notional And Compounding Calculation evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `gross-leg-cashflows-and-net-payment` | Owns Gross Leg Cashflows And Net Payment evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `counterparty-confirmation-dispute-and-adjustment` | Owns Counterparty Confirmation Dispute And Adjustment evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `settled-cancelled-or-superseded-cashflow-lineage` | Owns Settled Cancelled Or Superseded Cashflow Lineage evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Contract terms, schedule, observations, fallback path, rate calculation, gross and net cash flows, and confirmation state remain simultaneously visible.
- **Navigation replacement:** None while all simultaneous regions remain usable.
- **Sticky boundary:** Only the current-task receipt or blocking action may persist; it reserves space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `leg-schedule-and-business-day-conventions` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The active reset event, selected observations, fallback decision, and payment calculation remain primary; full schedule, definition history, and prior settlements move to synchronized drawers.
- **Navigation replacement:** A synchronized drawer replaces the displaced region and preserves the selected object, query, state, scroll context, and exact trigger.
- **Sticky boundary:** Only the current-task receipt or blocking action may persist; it reserves space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `leg-schedule-and-business-day-conventions` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44 CSS-pixel targets, and unobscured focus.
- **Topology response:** Contract leg → active accrual period → observation or fallback → determined rate → day count/notional calculation → gross and net cash flow → confirm, dispute, adjust, or settle; the schedule becomes one reset-event route.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** Only the current-task receipt or blocking action may persist; it reserves space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `leg-schedule-and-business-day-conventions` becomes a semantic list or step route when its bounded view no longer fits.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `derivative-reset -> contract-confirmation-and-definition-version -> leg-schedule-and-business-day-conventions -> accrual-period-and-reset-event -> observation-set-index-source-and-fallback-waterfall -> fixed-or-floating-rate-determination -> day-count-notional-and-compounding-calculation -> gross-leg-cashflows-and-net-payment -> counterparty-confirmation-dispute-and-adjustment -> settled-cancelled-or-superseded-cashflow-lineage`.
- Long labels, localization, zoom, and enlarged controls trigger the same named topology changes.
- CSS never reorders semantics; ordinary content creates no page-level horizontal scroll.
- Hidden detail always has an explicit accessible reveal path.

### Interaction parity

- Every wide selection, edit, action, explanation, retry, and recovery remains reachable at intermediate and compact.
- Topology changes preserve the exact selected object, order, input, pending result, and error context.
- Pointer actions have keyboard equivalents; color is never the only signal.
- Dynamic updates announce one contextual status without stealing focus.

## State obligations

Task-specific states: contract active/terminated/amended; schedule valid/broken; reset upcoming/due/determined; observation available/missing/corrected; fallback inactive/triggered/disputed; rate provisional/final; cash flow calculated/adjusted; counterparty unconfirmed/agreed/disputed; payment pending/settled/failed; prior determination superseded.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `contract-confirmation-and-definition-version` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `leg-schedule-and-business-day-conventions` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `leg-schedule-and-business-day-conventions` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `counterparty-confirmation-dispute-and-adjustment` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `settled-cancelled-or-superseded-cashflow-lineage` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `counterparty-confirmation-dispute-and-adjustment` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `settled-cancelled-or-superseded-cashflow-lineage` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `contract-confirmation-and-definition-version` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `counterparty-confirmation-dispute-and-adjustment` | Move focus only to a required error summary or modal, then return it to the exact trigger. |
| Responsive presentation | `derivative-reset` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Determine one contractual derivative reset from its schedule, observations, index, and fallback provisions; calculate the resulting leg cash flows; obtain counterparty agreement; and settle or dispute the payment.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject calendar resource scheduling; this is `AR-DRR-90` evidence and must route to an adjacent archetype.
- Reject timeline status monitoring; this is `AR-DRR-91` evidence and must route to an adjacent archetype.
- Reject generic calculation estimate; this is `AR-DRR-92` evidence and must route to an adjacent archetype.
- Reject generic cash-flow table; this is `AR-DRR-93` evidence and must route to an adjacent archetype.

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
| [ISDA — 2021 Interest Rate Derivatives Definitions InfoHub](https://www.isda.org/?p=975268) | Versioned definitions, floating-rate options, confirmations, and fallback context. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [FpML — Interest-rate product architecture](https://www.fpml.org/spec/fpml-5-1-6-rec-1/html/reporting/fpml-5-1-intro-5.html) | Reset dates, calculation periods, day-count, compounding, and regenerable cash-flow representations. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Schedule-row selection, dense numeric comparison, and bounded data disclosure. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Sticky confirmation state that does not cover focused schedule or actions. | Does not select the archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "derivative-rate-reset-cashflow-workbench",
  "situationCodes": [
    "<matched AR-DRR-* codes>"
  ],
  "searchAliases": [
    "interest rate reset workbench",
    "swap fixing cashflow confirmation",
    "fallback rate determination"
  ],
  "dominantTask": "Determine one contractual derivative reset from its schedule, observations, index, and fallback provisions; calculate the resulting leg cash flows; obtain counterparty agreement; and settle or dispute the payment.",
  "regions": [
    "derivative-reset",
    "contract-confirmation-and-definition-version",
    "leg-schedule-and-business-day-conventions",
    "accrual-period-and-reset-event",
    "observation-set-index-source-and-fallback-waterfall",
    "fixed-or-floating-rate-determination",
    "day-count-notional-and-compounding-calculation",
    "gross-leg-cashflows-and-net-payment",
    "counterparty-confirmation-dispute-and-adjustment",
    "settled-cancelled-or-superseded-cashflow-lineage"
  ],
  "regionRelationships": [
    "The exact accrual period and contractual observation method bind the rate determination to day count, notional, compounding, gross leg amounts, and the agreed net payment."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and drawer response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "derivative-reset -> contract-confirmation-and-definition-version -> leg-schedule-and-business-day-conventions -> accrual-period-and-reset-event -> observation-set-index-source-and-fallback-waterfall -> fixed-or-floating-rate-determination -> day-count-notional-and-compounding-calculation -> gross-leg-cashflows-and-net-payment -> counterparty-confirmation-dispute-and-adjustment -> settled-cancelled-or-superseded-cashflow-lineage",
    "navigationReplacement": "<none, synchronized drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved space and short-height yield>",
    "overflowOwner": "leg-schedule-and-business-day-conventions",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "contract active/terminated/amended",
    "schedule valid/broken",
    "reset upcoming/due/determined",
    "observation available/missing/corrected",
    "fallback inactive/triggered/disputed",
    "rate provisional/final",
    "cash flow calculated/adjusted",
    "counterparty unconfirmed/agreed/disputed",
    "payment pending/settled/failed",
    "prior determination superseded"
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

