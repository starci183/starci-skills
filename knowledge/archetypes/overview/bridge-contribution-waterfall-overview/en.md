# Bridge contribution waterfall overview

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `bridge-contribution-waterfall-overview` |
| Family | Overview |
| Dominant task | Explain how a baseline becomes an ending outcome through ordered positive, negative, and subtotal contributions. |
| Search aliases | `bridge chart`, `contribution waterfall`, `variance bridge`, `baseline to outcome` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Baseline plus ordered signed contributions reconciles exactly to the ending outcome.
- The region graph remains `bridge-overview` → `baseline-period-scope` → `contribution-waterfall` → `ordered-contribution-ledger` → `subtotal-and-ending-outcome` → `selected-contribution-explanation` → `reconciliation-evidence`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-BW-01` | The dominant task is: Explain how a baseline becomes an ending outcome through ordered positive, negative, and subtotal contributions. | Candidate evidence. |
| `AR-BW-02` | The complete required region graph must remain semantically present. | Required evidence. |
| `AR-BW-03` | Compact must retain wide selection, action, state, and recovery. | Required evidence. |
| `AR-BW-04` | Each region has an independent owner and retains the current selection association. | Preserve as an invariant. |
| `AR-BW-90` | a general analytics dashboard | Reject. |
| `AR-BW-91` | a funnel | Reject. |
| `AR-BW-92` | a benchmark | Reject. |
| `AR-BW-93` | a cashflow table without baseline-to-outcome semantics | Reject. |

### Selection rule

Select `bridge-contribution-waterfall-overview` only when `AR-BW-01`, `AR-BW-02`, and `AR-BW-03` are evidenced and none of `AR-BW-90`, `AR-BW-91`, `AR-BW-92`, or `AR-BW-93` describes the dominant task. If one required relationship is unknown, return `needs-evidence`; if a rejection code holds, return `reject` instead of adapting this topology by visual resemblance.

## Region graph

```text
bridge-overview
└─ baseline-period-scope
   └─ contribution-waterfall
      └─ ordered-contribution-ledger
         └─ subtotal-and-ending-outcome
            └─ selected-contribution-explanation
               └─ reconciliation-evidence
```

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `bridge-overview` | Owns the page-level bridge overview task and all descendant state. | Root of the graph. |
| `baseline-period-scope` | Owns baseline period scope evidence or action without borrowing product semantics. | Follows `bridge-overview` in semantic order and retains the same selection context. |
| `contribution-waterfall` | Owns contribution waterfall evidence or action without borrowing product semantics. | Follows `baseline-period-scope` in semantic order and retains the same selection context. |
| `ordered-contribution-ledger` | Owns ordered contribution ledger evidence or action without borrowing product semantics. | Follows `contribution-waterfall` in semantic order and retains the same selection context. |
| `subtotal-and-ending-outcome` | Owns subtotal and ending outcome evidence or action without borrowing product semantics. | Follows `ordered-contribution-ledger` in semantic order and retains the same selection context. |
| `selected-contribution-explanation` | Owns selected contribution explanation evidence or action without borrowing product semantics. | Follows `subtotal-and-ending-outcome` in semantic order and retains the same selection context. |
| `reconciliation-evidence` | Owns reconciliation evidence evidence or action without borrowing product semantics. | Follows `selected-contribution-explanation` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when the simultaneous regions cannot retain readable labels, exact associations, and complete actions.
- **Topology response:** Keep the waterfall synchronized with its ordered ledger and selected explanation while units remain explicit.
- **Navigation replacement:** None while all required regions remain simultaneously usable.
- **Sticky boundary:** Only an active cross-region action may persist; it reserves space and yields when height cannot keep focused content visible.
- **Overflow owner:** `contribution-waterfall` alone may own bounded horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Preserve the core chart sequence and the complete ledger while explanation moves below or into a drawer.
- **Navigation replacement:** Replace the displaced supporting region with a named button or disclosure that exposes current selection and state.
- **Sticky boundary:** A persistent action remains only while its exact target and status stay visible; it becomes in-flow at short height.
- **Overflow owner:** `contribution-waterfall` keeps the only bounded overflow axis and exposes keyboard instructions.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions no longer preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Default to the ordered signed ledger and subtotals; keep the chart optional and place detail after its row.
- **Navigation replacement:** Use an explicit primary-pane sequence with Back that restores selection, filter, state, and scroll context.
- **Sticky boundary:** A bottom action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `contribution-waterfall` is optional; its text or list equivalent is primary.

### Reflow

- Semantic and DOM order is `bridge-overview` → `baseline-period-scope` → `contribution-waterfall` → `ordered-contribution-ledger` → `subtotal-and-ending-outcome` → `selected-contribution-explanation` → `reconciliation-evidence`.
- Text, zoom, long translation, and enlarged controls trigger the same named topology changes.
- No CSS ordering changes the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap; hidden detail has an explicit accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, action, explanation, retry, and recovery path remains reachable in intermediate and compact.
- Topology changes preserve the exact selected entity, filters, data state, and pending or completed result.
- Dynamic updates announce one contextual status message without stealing focus.
- Any modal traps focus, supports Escape or Cancel, and returns focus to the exact trigger.
- Color, position, and geometry always have a textual or structural equivalent.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `baseline-period-scope` | Identify the scope and the region that is pending; preserve the semantic position. |
| Ready | `contribution-waterfall` | Expose the complete dominant task with baseline plus ordered signed contributions reconciles exactly to the ending outcome. |
| Empty / not applicable | `ordered-contribution-ledger` | Distinguish meaningful absence from unavailable evidence and state why the region does not apply. |
| Error / retry | `subtotal-and-ending-outcome` | Keep valid context, name the failed owner, and offer a local retry without resetting selection. |
| Permission / unavailable | `reconciliation-evidence` | Do not imply hidden evidence is absent; provide a safe exit or alternate route. |
| Pending | `reconciliation-evidence` | Prevent duplicate action, retain the exact target and announce progress without moving focus. |
| Success | `reconciliation-evidence` | Expose the outcome, preserve the selected context, and provide the next valid action. |
| Stale / conflict | `baseline-period-scope` | Keep the last safe value, identify version or time conflict, and require explicit recovery. |
| Focus transition | `reconciliation-evidence` | Move focus only for an opened modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `bridge-overview` | Preserve state, selection, query, and recovery when topology changes. |

Applicable state family: loading, no change, positive contribution, negative contribution, zero contribution, residual amount, unreconciled amount, hidden group expanded, selected contribution, comparison unavailable, definition changed, export pending.

## Boundaries

### Accept

- Accept when ordered signed contributions explain a starting-to-ending change.
- Accept when subtotals and units remain explicit.
- Accept when chart and ledger reconcile to the same values.

### Reject

- Reject a general analytics dashboard; this is `AR-BW-90` evidence and must route to an adjacent archetype.
- Reject a funnel; this is `AR-BW-91` evidence and must route to an adjacent archetype.
- Reject a benchmark; this is `AR-BW-92` evidence and must route to an adjacent archetype.
- Reject a cashflow table without baseline-to-outcome semantics; this is `AR-BW-93` evidence and must route to an adjacent archetype.

### Boundary verdict

Return `accept` only when the dominant task, complete region graph, and compact interaction parity all hold. Return `reject` for any rejection code. Return `needs-evidence` when a required owner or relationship is unresolved. Differences limited to nouns, card count, density, color, component, or state are `duplicate-or-variation`, not a new archetype.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permitted actions, eligibility, and truthful state meaning to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow realization, and relationship-driven transition points.
- Neither handoff may remove a required region, change the dominant task, or weaken interaction parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports the synthesis of task relationships, adaptive behavior, and accessibility obligations; it does not name StarCi owners, select exact geometry, or grant permission to copy a source interface.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [Microsoft Power BI — Waterfall charts](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-waterfall-charts) | Supports running totals, ordered positive and negative changes, baseline, breakdown, and ending outcome. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Supports adaptive screen regions, fluid structures, and content-driven layout integrity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports adaptive panes, readable content regions, and layout relationships across available space. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow without page-level two-dimensional scrolling and bounded exceptions. | Does not select this archetype, define product truth, or authorize copied geometry. |

| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports explicit row-column association, selection, dense comparison, and bounded table overflow. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Supports announcing live, pending, success, failure, and reconnect changes without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Adobe Spectrum — Components](https://spectrum.adobe.com/page/components/) | Supports accessible component states, selection, feedback, and coordinated data controls. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "bridge-contribution-waterfall-overview",
  "situationCodes": ["<matched AR-BW-* codes>"],
  "searchAliases": ["bridge chart","contribution waterfall","variance bridge","baseline to outcome"],
  "dominantTask": "Explain how a baseline becomes an ending outcome through ordered positive, negative, and subtotal contributions.",
  "regions": ["bridge-overview","baseline-period-scope","contribution-waterfall","ordered-contribution-ledger","subtotal-and-ending-outcome","selected-contribution-explanation","reconciliation-evidence"],
  "regionRelationships": ["bridge-overview precedes baseline-period-scope precedes contribution-waterfall precedes ordered-contribution-ledger precedes subtotal-and-ending-outcome precedes selected-contribution-explanation precedes reconciliation-evidence"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "bridge-overview → baseline-period-scope → contribution-waterfall → ordered-contribution-ledger → subtotal-and-ending-outcome → selected-contribution-explanation → reconciliation-evidence",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "contribution-waterfall",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["loading", "no change", "positive contribution", "negative contribution", "zero contribution", "residual amount", "unreconciled amount", "hidden group expanded", "selected contribution", "comparison unavailable", "definition changed", "export pending"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```
