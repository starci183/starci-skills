# Process variant mining overview

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `process-variant-mining-overview` |
| Family | Overview |
| Dominant task | Discover actual process paths from event evidence and find loops, deviations, and bottlenecks instead of assuming a linear funnel. |
| Search aliases | `process mining`, `variant frequency map`, `actual path analysis`, `process bottlenecks` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Map, variant list, and selected trace use the same event and transition semantics.
- The region graph remains `process-mining` → `case-period-segment-filters` → `directed-process-map` → `variant-frequency-list` → `duration-and-bottleneck-evidence` → `selected-variant-trace`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-PV-01` | The dominant task is: Discover actual process paths from event evidence and find loops, deviations, and bottlenecks instead of assuming a linear funnel. | Candidate evidence. |
| `AR-PV-02` | The complete required region graph must remain semantically present. | Required evidence. |
| `AR-PV-03` | Compact must retain wide selection, action, state, and recovery. | Required evidence. |
| `AR-PV-04` | Each region has an independent owner and retains the current selection association. | Preserve as an invariant. |
| `AR-PV-90` | a fixed linear funnel | Reject. |
| `AR-PV-91` | an editable workflow builder | Reject. |
| `AR-PV-92` | dependency health graph | Reject. |
| `AR-PV-93` | a retrospective single-case audit timeline | Reject. |

### Selection rule

Select `process-variant-mining-overview` only when `AR-PV-01`, `AR-PV-02`, and `AR-PV-03` are evidenced and none of `AR-PV-90`, `AR-PV-91`, `AR-PV-92`, or `AR-PV-93` describes the dominant task. If one required relationship is unknown, return `needs-evidence`; if a rejection code holds, return `reject` instead of adapting this topology by visual resemblance.

## Region graph

```text
process-mining
└─ case-period-segment-filters
   └─ directed-process-map
      └─ variant-frequency-list
         └─ duration-and-bottleneck-evidence
            └─ selected-variant-trace
```

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `process-mining` | Owns the page-level process mining task and all descendant state. | Root of the graph. |
| `case-period-segment-filters` | Owns case period segment filters evidence or action without borrowing product semantics. | Follows `process-mining` in semantic order and retains the same selection context. |
| `directed-process-map` | Owns directed process map evidence or action without borrowing product semantics. | Follows `case-period-segment-filters` in semantic order and retains the same selection context. |
| `variant-frequency-list` | Owns variant frequency list evidence or action without borrowing product semantics. | Follows `directed-process-map` in semantic order and retains the same selection context. |
| `duration-and-bottleneck-evidence` | Owns duration and bottleneck evidence evidence or action without borrowing product semantics. | Follows `variant-frequency-list` in semantic order and retains the same selection context. |
| `selected-variant-trace` | Owns selected variant trace evidence or action without borrowing product semantics. | Follows `duration-and-bottleneck-evidence` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when the simultaneous regions cannot retain readable labels, exact associations, and complete actions.
- **Topology response:** Keep the process map primary with ranked variants and bottlenecks while selected trace supports the map.
- **Navigation replacement:** None while all required regions remain simultaneously usable.
- **Sticky boundary:** Only an active cross-region action may persist; it reserves space and yields when height cannot keep focused content visible.
- **Overflow owner:** `directed-process-map` alone may own bounded horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Keep the map and one supporting region visible while the remaining variant or trace region becomes a drawer.
- **Navigation replacement:** Replace the displaced supporting region with a named button or disclosure that exposes current selection and state.
- **Sticky boundary:** A persistent action remains only while its exact target and status stay visible; it becomes in-flow at short height.
- **Overflow owner:** `directed-process-map` keeps the only bounded overflow axis and exposes keyboard instructions.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions no longer preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Start with ranked variants and bottlenecks, then open an ordered trace; the process map is optional.
- **Navigation replacement:** Use an explicit primary-pane sequence with Back that restores selection, filter, state, and scroll context.
- **Sticky boundary:** A bottom action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `directed-process-map` is optional; its text or list equivalent is primary.

### Reflow

- Semantic and DOM order is `process-mining` → `case-period-segment-filters` → `directed-process-map` → `variant-frequency-list` → `duration-and-bottleneck-evidence` → `selected-variant-trace`.
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
| Initial / loading | `case-period-segment-filters` | Identify the scope and the region that is pending; preserve the semantic position. |
| Ready | `directed-process-map` | Expose the complete dominant task with map, variant list, and selected trace use the same event and transition semantics. |
| Empty / not applicable | `variant-frequency-list` | Distinguish meaningful absence from unavailable evidence and state why the region does not apply. |
| Error / retry | `duration-and-bottleneck-evidence` | Keep valid context, name the failed owner, and offer a local retry without resetting selection. |
| Permission / unavailable | `selected-variant-trace` | Do not imply hidden evidence is absent; provide a safe exit or alternate route. |
| Pending | `selected-variant-trace` | Prevent duplicate action, retain the exact target and announce progress without moving focus. |
| Success | `selected-variant-trace` | Expose the outcome, preserve the selected context, and provide the next valid action. |
| Stale / conflict | `case-period-segment-filters` | Keep the last safe value, identify version or time conflict, and require explicit recovery. |
| Focus transition | `selected-variant-trace` | Move focus only for an opened modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `process-mining` | Preserve state, selection, query, and recovery when topology changes. |

Applicable state family: mining loading, no cases, partial event log, inferred transition, missing transition, rare variant, loop, selected path, filter recalculation, stale model, privacy threshold.

## Boundaries

### Accept

- Accept when event evidence reveals multiple actual paths.
- Accept when loops and deviations alter the model.
- Accept when variant frequency and duration guide bottleneck inspection.

### Reject

- Reject a fixed linear funnel; this is `AR-PV-90` evidence and must route to an adjacent archetype.
- Reject an editable workflow builder; this is `AR-PV-91` evidence and must route to an adjacent archetype.
- Reject dependency health graph; this is `AR-PV-92` evidence and must route to an adjacent archetype.
- Reject a retrospective single-case audit timeline; this is `AR-PV-93` evidence and must route to an adjacent archetype.

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
| [Microsoft Power Automate — Visualize and gain insights from processes](https://learn.microsoft.com/en-us/power-automate/process-mining-visualize) | Supports process variants, frequency, duration, loops, bottlenecks, and synchronized filtering. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Supports adaptive screen regions, fluid structures, and content-driven layout integrity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports adaptive panes, readable content regions, and layout relationships across available space. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow without page-level two-dimensional scrolling and bounded exceptions. | Does not select this archetype, define product truth, or authorize copied geometry. |

| [W3C WAI — ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) | Supports keyboard-complete composite interaction, state exposure, and predictable focus movement. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Supports announcing live, pending, success, failure, and reconnect changes without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "process-variant-mining-overview",
  "situationCodes": ["<matched AR-PV-* codes>"],
  "searchAliases": ["process mining","variant frequency map","actual path analysis","process bottlenecks"],
  "dominantTask": "Discover actual process paths from event evidence and find loops, deviations, and bottlenecks instead of assuming a linear funnel.",
  "regions": ["process-mining","case-period-segment-filters","directed-process-map","variant-frequency-list","duration-and-bottleneck-evidence","selected-variant-trace"],
  "regionRelationships": ["process-mining precedes case-period-segment-filters precedes directed-process-map precedes variant-frequency-list precedes duration-and-bottleneck-evidence precedes selected-variant-trace"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "process-mining → case-period-segment-filters → directed-process-map → variant-frequency-list → duration-and-bottleneck-evidence → selected-variant-trace",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "directed-process-map",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["mining loading", "no cases", "partial event log", "inferred transition", "missing transition", "rare variant", "loop", "selected path", "filter recalculation", "stale model", "privacy threshold"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```
