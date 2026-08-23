# SLO error budget burn console

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `slo-error-budget-burn-console` |
| Family | Overview |
| Dominant task | Decide whether release activity or reliability work must change from windowed SLI, remaining error budget, and multi-window burn rates. |
| Search aliases | `SLO burn console`, `error budget policy`, `multi-window burn rate` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Decide whether release activity or reliability work must change from windowed SLI, remaining error budget, and multi-window burn rates.
- Remaining budget and short and long burn windows jointly own the policy action.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-SLO-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-SLO-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-SLO-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-SLO-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-SLO-90` | The dominant task is actually statistical process control. | Reject. |
| `AR-SLO-91` | The dominant task is actually live incident command. | Reject. |
| `AR-SLO-92` | The dominant task is actually generic KPI dashboard. | Reject. |
| `AR-SLO-93` | The dominant task is actually capacity overview. | Reject. |

### Selection rule

Select `slo-error-budget-burn-console` if and only if `AR-SLO-01` through `AR-SLO-04` are evidenced and none of `AR-SLO-90` through `AR-SLO-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
slo-console -> service-objective-and-window -> sli-definition -> good-vs-total-event-series -> remaining-error-budget -> multiwindow-burn-rates -> breach-contributors-and-incidents -> error-budget-policy-action -> decision-record
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `slo-console` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `service-objective-and-window` | Owns Service Objective And Window evidence or action and preserves its declared relationship to the current selection. |
| `sli-definition` | Owns Sli Definition evidence or action and preserves its declared relationship to the current selection. |
| `good-vs-total-event-series` | Owns Good Vs Total Event Series evidence or action and preserves its declared relationship to the current selection. |
| `remaining-error-budget` | Owns Remaining Error Budget evidence or action and preserves its declared relationship to the current selection. |
| `multiwindow-burn-rates` | Owns Multiwindow Burn Rates evidence or action and preserves its declared relationship to the current selection. |
| `breach-contributors-and-incidents` | Owns Breach Contributors And Incidents evidence or action and preserves its declared relationship to the current selection. |
| `error-budget-policy-action` | Owns Error Budget Policy Action evidence or action and preserves its declared relationship to the current selection. |
| `decision-record` | Owns Decision Record evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Remaining budget, short and long burn views, and contributor evidence remain simultaneously visible.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `good-vs-total-event-series` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Budget and burn remain primary while contributor detail becomes a drawer.
- **Navigation replacement:** A named disclosure or drawer replaces the displaced region and preserves exact selection and trigger.
- **Sticky boundary:** The current verdict or action persists only while its target and status remain visible and returns to flow at short height.
- **Overflow owner:** `good-vs-total-event-series` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Budget verdict → fast burn → slow burn → contributors → policy action → decision receipt.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `good-vs-total-event-series` has a textual or list equivalent as primary when its bounded view does not fit.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `slo-console -> service-objective-and-window -> sli-definition -> good-vs-total-event-series -> remaining-error-budget -> multiwindow-burn-rates -> breach-contributors-and-incidents -> error-budget-policy-action -> decision-record`.
- Long labels, translation, zoom, and enlarged controls trigger the same named topology changes.
- CSS never reorders semantics; ordinary content creates no page-level horizontal scroll.
- Hidden detail always has an explicit accessible reveal path.

### Interaction parity

- Every wide selection, edit, action, explanation, retry, and recovery remains reachable at intermediate and compact.
- Topology changes preserve the exact selected object, cursor or order, data state, pending result, and error context.
- Pointer actions have keyboard and single-pointer non-drag equivalents when movement is involved.
- Dynamic updates announce one contextual status without stealing focus; color is never the only signal.
- A modal receives and contains focus, supports Escape or Cancel, and returns focus to the exact trigger.

## State obligations

Task-specific states: SLI loading, SLI gap, budget healthy, budget warning, budget exhausted, fast burn active, fast burn clear, slow burn active, slow burn clear, contributor selected, action recommended, action overridden, decision pending, decision recorded, window changed.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `service-objective-and-window` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `sli-definition` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `sli-definition` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `error-budget-policy-action` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `decision-record` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `decision-record` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `decision-record` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `service-objective-and-window` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `decision-record` | Move focus only to a modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `slo-console` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Decide whether release activity or reliability work must change from windowed SLI, remaining error budget, and multi-window burn rates.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject statistical process control; this is `AR-SLO-90` evidence and must route to an adjacent archetype.
- Reject live incident command; this is `AR-SLO-91` evidence and must route to an adjacent archetype.
- Reject generic KPI dashboard; this is `AR-SLO-92` evidence and must route to an adjacent archetype.
- Reject capacity overview; this is `AR-SLO-93` evidence and must route to an adjacent archetype.

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
| [Google SRE Workbook — Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/) | Error-budget consumption and multi-window multi-burn-rate alerting. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Prometheus — Alerting rules](https://prometheus.io/docs/practices/rules/) | Operational rule evaluation and recorded alert evidence. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Explicit row-column relationships, selection, and bounded overflow. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Status changes announced without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "slo-error-budget-burn-console",
  "situationCodes": ["<matched AR-SLO-* codes>"],
  "searchAliases": ["SLO burn console","error budget policy","multi-window burn rate"],
  "dominantTask": "Decide whether release activity or reliability work must change from windowed SLI, remaining error budget, and multi-window burn rates.",
  "regions": ["slo-console","service-objective-and-window","sli-definition","good-vs-total-event-series","remaining-error-budget","multiwindow-burn-rates","breach-contributors-and-incidents","error-budget-policy-action","decision-record"],
  "regionRelationships": ["Remaining budget and short and long burn windows jointly own the policy action."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "slo-console -> service-objective-and-window -> sli-definition -> good-vs-total-event-series -> remaining-error-budget -> multiwindow-burn-rates -> breach-contributors-and-incidents -> error-budget-policy-action -> decision-record",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "good-vs-total-event-series",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["SLI loading","SLI gap","budget healthy","budget warning","budget exhausted","fast burn active","fast burn clear","slow burn active","slow burn clear","contributor selected","action recommended","action overridden","decision pending","decision recorded","window changed"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

