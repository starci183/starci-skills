# Derivatives portfolio compression cycle workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `derivatives-portfolio-compression-cycle-workbench` |
| Family | Work |
| Dominant task | Construct and execute one multilateral compression cycle that terminates and replaces eligible derivative trades to reduce gross notional while preserving every participant's declared market-risk, cash-flow, and legal invariants. |
| Search aliases | `multilateral trade compression`, `terminate replace cycle`, `portfolio compression hypergraph` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Construct and execute one multilateral compression cycle that terminates and replaces eligible derivative trades to reduce gross notional while preserving every participant's declared market-risk, cash-flow, and legal invariants.
- Each candidate is one multilateral hyperedge across participants and trades; no termination or replacement leg executes unless every affected risk, cash-flow, legal, and consent invariant passes atomically.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-DPC-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-DPC-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-DPC-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-DPC-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-DPC-90` | The dominant task is actually multicurrency netting settlement. | Reject. |
| `AR-DPC-91` | The dominant task is actually dual-list transfer. | Reject. |
| `AR-DPC-92` | The dominant task is actually reconciliation diff. | Reject. |
| `AR-DPC-93` | The dominant task is actually generic portfolio optimization. | Reject. |

### Selection rule

Select `derivatives-portfolio-compression-cycle-workbench` if and only if `AR-DPC-01` through `AR-DPC-04` are evidenced and none of `AR-DPC-90` through `AR-DPC-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
portfolio-compression
|-- cycle-scope-date-product-rules-and-legal-version
|-- participant-and-trade-portfolio
|-- risk-equivalence-and-net-cashflow-invariants
|-- eligible-trade-hypergraph
|   `-- candidate-multilateral-terminate-replace-package
|       <-> participant-impact-and-invariant-diagnostics
|-- bilateral-and-multilateral-consent-matrix
|-- atomic-termination-and-replacement-instruction
`-- post-cycle-residual-trades-risk-proof-and-receipts
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `portfolio-compression` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `cycle-scope-date-product-rules-and-legal-version` | Owns Cycle Scope Date Product Rules And Legal Version evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `participant-and-trade-portfolio` | Owns Participant And Trade Portfolio evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `risk-equivalence-and-net-cashflow-invariants` | Owns Risk Equivalence And Net Cashflow Invariants evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `eligible-trade-hypergraph` | Owns Eligible Trade Hypergraph evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `candidate-multilateral-terminate-replace-package` | Owns Candidate Multilateral Terminate Replace Package evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `participant-impact-and-invariant-diagnostics` | Owns Participant Impact And Invariant Diagnostics evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `bilateral-and-multilateral-consent-matrix` | Owns Bilateral And Multilateral Consent Matrix evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `atomic-termination-and-replacement-instruction` | Owns Atomic Termination And Replacement Instruction evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `post-cycle-residual-trades-risk-proof-and-receipts` | Owns Post Cycle Residual Trades Risk Proof And Receipts evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Participant/trade graph, candidate hyperedge, invariant comparison, consent matrix, gross-notional reduction, atomic instruction, and residual portfolio remain visible together.
- **Navigation replacement:** None while all simultaneous regions remain usable.
- **Sticky boundary:** Only the current-task receipt or blocking action may persist; it reserves space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `bilateral-and-multilateral-consent-matrix` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The candidate package, failed invariant, and missing or revoked consent remain primary; complete portfolios, alternate packages, and prior-cycle receipts move to synchronized drawers.
- **Navigation replacement:** A synchronized drawer replaces the displaced region and preserves the selected object, query, state, scroll context, and exact trigger.
- **Sticky boundary:** Only the current-task receipt or blocking action may persist; it reserves space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `bilateral-and-multilateral-consent-matrix` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44 CSS-pixel targets, and unobscured focus.
- **Topology response:** Cycle scope → candidate participant/trade set → before/after participant risk and cash-flow invariants → each consent → atomic execute or reject → residual portfolio proof; the graph becomes a hyperedge route with persistent cycle totals.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** Only the current-task receipt or blocking action may persist; it reserves space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `bilateral-and-multilateral-consent-matrix` becomes a semantic list or step route when its bounded view no longer fits.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `portfolio-compression -> cycle-scope-date-product-rules-and-legal-version -> participant-and-trade-portfolio -> risk-equivalence-and-net-cashflow-invariants -> eligible-trade-hypergraph -> candidate-multilateral-terminate-replace-package -> participant-impact-and-invariant-diagnostics -> bilateral-and-multilateral-consent-matrix -> atomic-termination-and-replacement-instruction -> post-cycle-residual-trades-risk-proof-and-receipts`.
- Long labels, localization, zoom, and enlarged controls trigger the same named topology changes.
- CSS never reorders semantics; ordinary content creates no page-level horizontal scroll.
- Hidden detail always has an explicit accessible reveal path.

### Interaction parity

- Every wide selection, edit, action, explanation, retry, and recovery remains reachable at intermediate and compact.
- Topology changes preserve the exact selected object, order, input, pending result, and error context.
- Pointer actions have keyboard equivalents; color is never the only signal.
- Dynamic updates announce one contextual status without stealing focus.

## State obligations

Task-specific states: trade eligible/ineligible/disputed; participant included/withdrawn; invariant inside/outside tolerance; candidate generated/invalid/optimized; consent pending/accepted/rejected/expired; legal check pending/pass/fail; instruction staged/atomic-ready/aborted/executed; termination unmatched/matched; replacement booked/rejected; risk proof pass/fail; cycle open/closed/reversed-by-new-cycle.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `cycle-scope-date-product-rules-and-legal-version` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `participant-and-trade-portfolio` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `participant-and-trade-portfolio` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `atomic-termination-and-replacement-instruction` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `post-cycle-residual-trades-risk-proof-and-receipts` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `atomic-termination-and-replacement-instruction` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `post-cycle-residual-trades-risk-proof-and-receipts` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `cycle-scope-date-product-rules-and-legal-version` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `atomic-termination-and-replacement-instruction` | Move focus only to a required error summary or modal, then return it to the exact trigger. |
| Responsive presentation | `portfolio-compression` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Construct and execute one multilateral compression cycle that terminates and replaces eligible derivative trades to reduce gross notional while preserving every participant's declared market-risk, cash-flow, and legal invariants.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject multicurrency netting settlement; this is `AR-DPC-90` evidence and must route to an adjacent archetype.
- Reject dual-list transfer; this is `AR-DPC-91` evidence and must route to an adjacent archetype.
- Reject reconciliation diff; this is `AR-DPC-92` evidence and must route to an adjacent archetype.
- Reject generic portfolio optimization; this is `AR-DPC-93` evidence and must route to an adjacent archetype.

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
| [Bank for International Settlements — OTC derivatives statistics](https://data.bis.org/topics/OTC_DER) | Compression as a post-trade mechanism and gross-notional context for OTC derivatives. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [U.S. eCFR — 17 CFR 23.503](https://www.ecfr.gov/current/title-17/chapter-I/part-23/subpart-I/section-23.503) | Portfolio-compression exercise requirements and swap-dealer regulatory context. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Dense trade and consent matrices with explicit actions and bounded disclosure. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Non-focus-stealing announcements for consent, invariant, and atomic execution changes. | Does not select the archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "derivatives-portfolio-compression-cycle-workbench",
  "situationCodes": [
    "<matched AR-DPC-* codes>"
  ],
  "searchAliases": [
    "multilateral trade compression",
    "terminate replace cycle",
    "portfolio compression hypergraph"
  ],
  "dominantTask": "Construct and execute one multilateral compression cycle that terminates and replaces eligible derivative trades to reduce gross notional while preserving every participant's declared market-risk, cash-flow, and legal invariants.",
  "regions": [
    "portfolio-compression",
    "cycle-scope-date-product-rules-and-legal-version",
    "participant-and-trade-portfolio",
    "risk-equivalence-and-net-cashflow-invariants",
    "eligible-trade-hypergraph",
    "candidate-multilateral-terminate-replace-package",
    "participant-impact-and-invariant-diagnostics",
    "bilateral-and-multilateral-consent-matrix",
    "atomic-termination-and-replacement-instruction",
    "post-cycle-residual-trades-risk-proof-and-receipts"
  ],
  "regionRelationships": [
    "Each candidate is one multilateral hyperedge across participants and trades; no termination or replacement leg executes unless every affected risk, cash-flow, legal, and consent invariant passes atomically."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and drawer response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "portfolio-compression -> cycle-scope-date-product-rules-and-legal-version -> participant-and-trade-portfolio -> risk-equivalence-and-net-cashflow-invariants -> eligible-trade-hypergraph -> candidate-multilateral-terminate-replace-package -> participant-impact-and-invariant-diagnostics -> bilateral-and-multilateral-consent-matrix -> atomic-termination-and-replacement-instruction -> post-cycle-residual-trades-risk-proof-and-receipts",
    "navigationReplacement": "<none, synchronized drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved space and short-height yield>",
    "overflowOwner": "bilateral-and-multilateral-consent-matrix",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "trade eligible/ineligible/disputed",
    "participant included/withdrawn",
    "invariant inside/outside tolerance",
    "candidate generated/invalid/optimized",
    "consent pending/accepted/rejected/expired",
    "legal check pending/pass/fail",
    "instruction staged/atomic-ready/aborted/executed",
    "termination unmatched/matched",
    "replacement booked/rejected",
    "risk proof pass/fail",
    "cycle open/closed/reversed-by-new-cycle"
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

