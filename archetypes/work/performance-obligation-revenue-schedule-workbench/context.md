# Performance obligation revenue schedule workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `performance-obligation-revenue-schedule-workbench` |
| Family | Work |
| Dominant task | Turn one customer contract and its modifications into distinct performance obligations, allocate the constrained transaction price, and maintain recognized versus remaining revenue as satisfaction evidence arrives. |
| Search aliases | `revenue allocation schedule`, `performance obligation ledger`, `contract revenue recognition`, `IFRS 15 workbench` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Turn one customer contract and its modifications into distinct performance obligations, allocate the constrained transaction price, and maintain recognized versus remaining revenue as satisfaction evidence arrives.
- The complete region graph retains every stable English region ID declared below.
- Required relationship: One conservation graph proves obligation allocations equal the constrained transaction price; a second proves recognized plus remaining revenue equals each allocation through time.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved exact geometry; Direction owns visual character.
- Every state family preserves task, selection, action, and recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-RS-01` | The dominant task matches Identity exactly. | Candidate evidence. |
| `AR-RS-02` | The complete required region graph is present. | Required evidence. |
| `AR-RS-03` | Compact retains wide action, state, recovery, and associations. | Required evidence. |
| `AR-RS-04` | One conservation graph proves obligation allocations equal the constrained transaction price; a second proves recognized plus remaining revenue equals each allocation through time. | Preserve as an invariant. |
| `AR-RS-90` | The dominant task is  stage-gated-process-record. | Reject. |
| `AR-RS-91` | The dominant task is  review-submit-ledger. | Reject. |
| `AR-RS-92` | The dominant task is  rule-builder-workbench. | Reject. |
| `AR-RS-93` | The dominant task is  generic billing schedule. | Reject. |

### Selection rule

Select `performance-obligation-revenue-schedule-workbench` only when `AR-RS-01`, `AR-RS-02`, and `AR-RS-03` are evidenced and no rejection code holds. Return `needs-evidence` when a required owner or relationship is unknown; return `reject` for rejection evidence; a difference limited to noun, count, density, color, component, or state is `duplicate-or-variation`.

## Region graph

```text
revenue-schedule
└─ contract-and-modification-lineage
   └─ promise-inventory
      └─ distinct-performance-obligation-decisions
         └─ transaction-price-components-and-constraint
            └─ standalone-selling-price-evidence
               ├─ transaction-price-conservation-across-obligations
               └─ relative-allocation-ledger
                  └─ obligation-satisfaction-pattern-and-progress
                     └─ recognized-versus-remaining-conservation-through-time
                        └─ contract-asset-liability-schedule
                           └─ close-review-and-disclosure-receipt
```

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `revenue-schedule` | Owns the evidence, action, and state of `revenue-schedule` without borrowing product semantics. | Root of the graph. |
| `contract-and-modification-lineage` | Owns the evidence, action, and state of `contract-and-modification-lineage` without borrowing product semantics. | Follows the graph semantic order and retains its association with `revenue-schedule`. |
| `promise-inventory` | Owns the evidence, action, and state of `promise-inventory` without borrowing product semantics. | Follows the graph semantic order and retains its association with `contract-and-modification-lineage`. |
| `distinct-performance-obligation-decisions` | Owns the evidence, action, and state of `distinct-performance-obligation-decisions` without borrowing product semantics. | Follows the graph semantic order and retains its association with `promise-inventory`. |
| `transaction-price-components-and-constraint` | Owns the evidence, action, and state of `transaction-price-components-and-constraint` without borrowing product semantics. | Follows the graph semantic order and retains its association with `distinct-performance-obligation-decisions`. |
| `standalone-selling-price-evidence` | Owns the evidence, action, and state of `standalone-selling-price-evidence` without borrowing product semantics. | Follows the graph semantic order and retains its association with `transaction-price-components-and-constraint`. |
| `transaction-price-conservation-across-obligations` | Owns the evidence, action, and state of `transaction-price-conservation-across-obligations` without borrowing product semantics. | Follows the graph semantic order and retains its association with `standalone-selling-price-evidence`. |
| `relative-allocation-ledger` | Owns obligation-level relative allocations and allocation adjustments. | Operates as a peer of transaction-price conservation; the ledger may not close unless conservation holds. |
| `obligation-satisfaction-pattern-and-progress` | Owns the evidence, action, and state of `obligation-satisfaction-pattern-and-progress` without borrowing product semantics. | Follows the graph semantic order and retains its association with `relative-allocation-ledger`. |
| `recognized-versus-remaining-conservation-through-time` | Owns the evidence, action, and state of `recognized-versus-remaining-conservation-through-time` without borrowing product semantics. | Follows the graph semantic order and retains its association with `obligation-satisfaction-pattern-and-progress`. |
| `contract-asset-liability-schedule` | Owns the evidence, action, and state of `contract-asset-liability-schedule` without borrowing product semantics. | Follows the graph semantic order and retains its association with `recognized-versus-remaining-conservation-through-time`. |
| `close-review-and-disclosure-receipt` | Owns the evidence, action, and state of `close-review-and-disclosure-receipt` without borrowing product semantics. | Follows the graph semantic order and retains its association with `contract-asset-liability-schedule`. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Keep contract promises, distinctness decisions, price components, allocation ledger, and satisfaction schedules simultaneously inspectable.
- **Navigation replacement:** None while all required regions remain simultaneously usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields at short height.
- **Overflow owner:** `relative-allocation-ledger` is the sole bounded horizontal overflow owner when needed.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Keep the selected obligation, allocated amount, and satisfaction evidence primary; move source clauses, all-obligation comparison, and disclosure history into contextual disclosures.
- **Navigation replacement:** A named disclosure opens the displaced region and retains the exact selection.
- **Sticky boundary:** An action persists only while its exact target and status remain visible; it returns to normal flow at short height.
- **Overflow owner:** The wide bounded owner retains the only axis and exposes a keyboard alternative.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot retain readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Sequence contract version, promise, distinctness, price component, relative allocation, point-in-time or over-time satisfaction, recognized and remaining receipt, and modification treatment.
- **Navigation replacement:** A primary-pane sequence with Back and Next restores selection, state, and scroll context.
- **Sticky boundary:** The bottom action reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** A numeric or list equivalent replaces the bounded grid; no page-level horizontal scroll appears.

### Reflow

- Semantic and DOM order is `revenue-schedule` → `contract-and-modification-lineage` → `promise-inventory` → `distinct-performance-obligation-decisions` → `transaction-price-components-and-constraint` → `standalone-selling-price-evidence` → `transaction-price-conservation-across-obligations` → `relative-allocation-ledger` → `obligation-satisfaction-pattern-and-progress` → `recognized-versus-remaining-conservation-through-time` → `contract-asset-liability-schedule` → `close-review-and-disclosure-receipt`.
- Zoom, long translation, enlarged controls, and text pressure trigger the same topology transformations.
- CSS does not reorder the visual sequence away from keyboard or assistive-technology order.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, action, explanation, retry, and recovery remains reachable in intermediate and compact.
- Topology changes preserve the exact entity, filters, data state, and pending or completed result.
- Dynamic updates announce contextual status without stealing focus.
- Any modal traps focus, supports Escape or Cancel, and returns focus to the exact trigger.
- Color, position, and geometry have a textual or structural equivalent.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `contract-and-modification-lineage` | Name the scope and pending owner; preserve semantic position. |
| Ready | `promise-inventory` | Expose the complete dominant task and required associations. |
| Empty / not applicable | `distinct-performance-obligation-decisions` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `transaction-price-components-and-constraint` | Keep valid context, name the failed owner, and offer local retry. |
| Permission / unavailable | `contract-asset-liability-schedule` | Do not imply hidden evidence is absent; provide a safe exit. |
| Pending | `contract-asset-liability-schedule` | Prevent duplicate action, retain the exact target, and announce progress. |
| Success | `close-review-and-disclosure-receipt` | Expose the outcome, preserve context, and provide the next valid action. |
| Stale / conflict | `contract-and-modification-lineage` | Keep the last safe value and require explicit recovery. |
| Focus transition | `close-review-and-disclosure-receipt` | Move focus only to a modal or error summary, then return to the exact trigger. |
| Responsive presentation | `revenue-schedule` | Preserve task, state, selection, and recovery when topology changes. |

Applicable state family: contract pending/enforceable/terminated; promise unassessed/distinct/combined; variable consideration unconstrained/constrained/revised; standalone price observed/estimated/missing; allocation unbalanced/balanced; obligation unsatisfied/partially/satisfied; progress disputed; revenue scheduled/recognized/reversed; contract asset/liability current; modification prospective/cumulative.

## Boundaries

### Accept

- Accept when Promises receive explicit distinctness decisions.
- Accept when Constrained transaction price is conserved across relative allocations.
- Accept when Recognized plus remaining revenue is conserved through time and modifications create lineage.

### Reject

- Reject `stage-gated-process-record`; this is `AR-RS-90` evidence and must route to an adjacent archetype.
- Reject `review-submit-ledger`; this is `AR-RS-91` evidence and must route to an adjacent archetype.
- Reject `rule-builder-workbench`; this is `AR-RS-92` evidence and must route to an adjacent archetype.
- Reject `generic billing schedule`; this is `AR-RS-93` evidence and must route to an adjacent archetype.

### Boundary verdict

Return `accept` only when the dominant task, complete region graph, and compact interaction parity all hold. Return `reject` for any rejection code. Return `needs-evidence` when a required owner or relationship is unresolved. Apply `duplicate-or-variation` when the difference is limited to noun, count, density, color, component, or state.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permitted actions, eligibility, and truthful state meaning to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, size, alignment, sticky offset, bounded overflow, and relationship-driven transition points.
- Neither handoff may remove a region, change the dominant task, or weaken interaction parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports synthesis of task relationships, responsive behavior, and accessibility obligations; it does not name StarCi owners, select exact geometry, or grant permission to copy an interface.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [IFRS Foundation — IFRS 15](https://www.ifrs.org/issued-standards/list-of-standards/ifrs-15-revenue-from-contracts-with-customers/) | Contract, performance obligation, transaction price, allocation, and recognition principles. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [FASB — Revenue Recognition Implementation Q&As](https://storage.fasb.org/Rev_Rec_Implementation_QAs.pdf) | Implementation questions for distinct promises, variable consideration, allocation, and modifications. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Visible focus around persistent close-review actions. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Announcements for allocation, progress, modification, and close state. | Does not select the archetype, define product truth, or authorize copied geometry. |

+| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Obligation-ledger scanning and row-level evidence actions. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Meaningful focus order across promise, allocation, and satisfaction routes. | Does not select the archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "performance-obligation-revenue-schedule-workbench",
  "situationCodes": [
    "<matched AR-RS-* codes>"
  ],
  "searchAliases": [
    "revenue allocation schedule",
    "performance obligation ledger",
    "contract revenue recognition",
    "IFRS 15 workbench"
  ],
  "dominantTask": "Turn one customer contract and its modifications into distinct performance obligations, allocate the constrained transaction price, and maintain recognized versus remaining revenue as satisfaction evidence arrives.",
  "regions": [
    "revenue-schedule",
    "contract-and-modification-lineage",
    "promise-inventory",
    "distinct-performance-obligation-decisions",
    "transaction-price-components-and-constraint",
    "standalone-selling-price-evidence",
    "transaction-price-conservation-across-obligations",
    "relative-allocation-ledger",
    "obligation-satisfaction-pattern-and-progress",
    "recognized-versus-remaining-conservation-through-time",
    "contract-asset-liability-schedule",
    "close-review-and-disclosure-receipt"
  ],
  "regionRelationships": [
    "One conservation graph proves obligation allocations equal the constrained transaction price; a second proves recognized plus remaining revenue equals each allocation through time."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and synchronized disclosure response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "revenue-schedule → contract-and-modification-lineage → promise-inventory → distinct-performance-obligation-decisions → transaction-price-components-and-constraint → standalone-selling-price-evidence → transaction-price-conservation-across-obligations → relative-allocation-ledger → obligation-satisfaction-pattern-and-progress → recognized-versus-remaining-conservation-through-time → contract-asset-liability-schedule → close-review-and-disclosure-receipt",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "<single bounded owner>",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "contract pending/enforceable/terminated",
    "promise unassessed/distinct/combined",
    "variable consideration unconstrained/constrained/revised",
    "standalone price observed/estimated/missing",
    "allocation unbalanced/balanced",
    "obligation unsatisfied/partially/satisfied",
    "progress disputed",
    "revenue scheduled/recognized/reversed",
    "contract asset/liability current",
    "modification prospective/cumulative"
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
    "<official task research>",
    "<accessibility research>"
  ]
}
```
