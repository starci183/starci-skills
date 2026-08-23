# Distributed trace waterfall monitor

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `distributed-trace-waterfall-monitor` |
| Family | Overview |
| Dominant task | Find the critical path, latency contribution, and failure boundary inside one distributed trace. |
| Search aliases | `trace waterfall`, `span timing monitor`, `critical path trace`, `distributed span tree` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Tree hierarchy, time geometry, critical-path membership, and selected span identity stay synchronized.
- The region graph remains `trace-monitor` → `trace-identity-and-timing` → `span-tree` → `bounded-time-waterfall` → `critical-path-summary` → `selected-span-input-output` → `related-error-evidence`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-DW-01` | The dominant task is: Find the critical path, latency contribution, and failure boundary inside one distributed trace. | Candidate evidence. |
| `AR-DW-02` | The complete required region graph must remain semantically present. | Required evidence. |
| `AR-DW-03` | Compact must retain wide selection, action, state, and recovery. | Required evidence. |
| `AR-DW-04` | Each region has an independent owner and retains the current selection association. | Preserve as an invariant. |
| `AR-DW-90` | service dependency topology across traces | Reject. |
| `AR-DW-91` | streaming raw logs | Reject. |
| `AR-DW-92` | a job-step timeline | Reject. |
| `AR-DW-93` | a generic performance dashboard | Reject. |

### Selection rule

Select `distributed-trace-waterfall-monitor` only when `AR-DW-01`, `AR-DW-02`, and `AR-DW-03` are evidenced and none of `AR-DW-90`, `AR-DW-91`, `AR-DW-92`, or `AR-DW-93` describes the dominant task. If one required relationship is unknown, return `needs-evidence`; if a rejection code holds, return `reject` instead of adapting this topology by visual resemblance.

## Region graph

```text
trace-monitor
└─ trace-identity-and-timing
   └─ span-tree
      └─ bounded-time-waterfall
         └─ critical-path-summary
            └─ selected-span-input-output
               └─ related-error-evidence
```

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `trace-monitor` | Owns the page-level trace monitor task and all descendant state. | Root of the graph. |
| `trace-identity-and-timing` | Owns trace identity and timing evidence or action without borrowing product semantics. | Follows `trace-monitor` in semantic order and retains the same selection context. |
| `span-tree` | Owns span tree evidence or action without borrowing product semantics. | Follows `trace-identity-and-timing` in semantic order and retains the same selection context. |
| `bounded-time-waterfall` | Owns bounded time waterfall evidence or action without borrowing product semantics. | Follows `span-tree` in semantic order and retains the same selection context. |
| `critical-path-summary` | Owns critical path summary evidence or action without borrowing product semantics. | Follows `bounded-time-waterfall` in semantic order and retains the same selection context. |
| `selected-span-input-output` | Owns selected span input output evidence or action without borrowing product semantics. | Follows `critical-path-summary` in semantic order and retains the same selection context. |
| `related-error-evidence` | Owns related error evidence evidence or action without borrowing product semantics. | Follows `selected-span-input-output` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when the simultaneous regions cannot retain readable labels, exact associations, and complete actions.
- **Topology response:** Keep the span tree and synchronized waterfall primary while selected span input and output support them.
- **Navigation replacement:** None while all required regions remain simultaneously usable.
- **Sticky boundary:** Only an active cross-region action may persist; it reserves space and yields when height cannot keep focused content visible.
- **Overflow owner:** `bounded-time-waterfall` alone may own bounded horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Collapse or narrow the tree while the waterfall, critical-path summary, and selected evidence remain usable.
- **Navigation replacement:** Replace the displaced supporting region with a named button or disclosure that exposes current selection and state.
- **Sticky boundary:** A persistent action remains only while its exact target and status stay visible; it becomes in-flow at short height.
- **Overflow owner:** `bounded-time-waterfall` keeps the only bounded overflow axis and exposes keyboard instructions.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions no longer preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Default to a critical-path span list with relative timing and selected-span detail; offer the waterfall full-screen.
- **Navigation replacement:** Use an explicit primary-pane sequence with Back that restores selection, filter, state, and scroll context.
- **Sticky boundary:** A bottom action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `bounded-time-waterfall` is optional; its text or list equivalent is primary.

### Reflow

- Semantic and DOM order is `trace-monitor` → `trace-identity-and-timing` → `span-tree` → `bounded-time-waterfall` → `critical-path-summary` → `selected-span-input-output` → `related-error-evidence`.
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
| Initial / loading | `trace-identity-and-timing` | Identify the scope and the region that is pending; preserve the semantic position. |
| Ready | `span-tree` | Expose the complete dominant task with tree hierarchy, time geometry, critical-path membership, and selected span identity stay synchronized. |
| Empty / not applicable | `bounded-time-waterfall` | Distinguish meaningful absence from unavailable evidence and state why the region does not apply. |
| Error / retry | `critical-path-summary` | Keep valid context, name the failed owner, and offer a local retry without resetting selection. |
| Permission / unavailable | `related-error-evidence` | Do not imply hidden evidence is absent; provide a safe exit or alternate route. |
| Pending | `related-error-evidence` | Prevent duplicate action, retain the exact target and announce progress without moving focus. |
| Success | `related-error-evidence` | Expose the outcome, preserve the selected context, and provide the next valid action. |
| Stale / conflict | `trace-identity-and-timing` | Keep the last safe value, identify version or time conflict, and require explicit recovery. |
| Focus transition | `related-error-evidence` | Move focus only for an opened modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `trace-monitor` | Preserve state, selection, query, and recovery when topology changes. |

Applicable state family: trace loading, partial trace, truncated trace, clock skew, span success, span error, span unknown, selected span, collapsed subtree, critical path calculating, redacted payload, retry unavailable.

## Boundaries

### Accept

- Accept when one trace owns a nested span hierarchy.
- Accept when relative timing identifies the critical path.
- Accept when selected span evidence exposes the failure boundary.

### Reject

- Reject service dependency topology across traces; this is `AR-DW-90` evidence and must route to an adjacent archetype.
- Reject streaming raw logs; this is `AR-DW-91` evidence and must route to an adjacent archetype.
- Reject a job-step timeline; this is `AR-DW-92` evidence and must route to an adjacent archetype.
- Reject a generic performance dashboard; this is `AR-DW-93` evidence and must route to an adjacent archetype.

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
| [OpenTelemetry — Traces](https://opentelemetry.io/docs/concepts/signals/traces/) | Supports trace paths, parent-child spans, timing, attributes, events, and status semantics. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Supports adaptive screen regions, fluid structures, and content-driven layout integrity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports adaptive panes, readable content regions, and layout relationships across available space. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow without page-level two-dimensional scrolling and bounded exceptions. | Does not select this archetype, define product truth, or authorize copied geometry. |

| [W3C WAI — ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) | Supports keyboard-complete composite interaction, state exposure, and predictable focus movement. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Supports announcing live, pending, success, failure, and reconnect changes without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "distributed-trace-waterfall-monitor",
  "situationCodes": ["<matched AR-DW-* codes>"],
  "searchAliases": ["trace waterfall","span timing monitor","critical path trace","distributed span tree"],
  "dominantTask": "Find the critical path, latency contribution, and failure boundary inside one distributed trace.",
  "regions": ["trace-monitor","trace-identity-and-timing","span-tree","bounded-time-waterfall","critical-path-summary","selected-span-input-output","related-error-evidence"],
  "regionRelationships": ["trace-monitor precedes trace-identity-and-timing precedes span-tree precedes bounded-time-waterfall precedes critical-path-summary precedes selected-span-input-output precedes related-error-evidence"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "trace-monitor → trace-identity-and-timing → span-tree → bounded-time-waterfall → critical-path-summary → selected-span-input-output → related-error-evidence",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "bounded-time-waterfall",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["trace loading", "partial trace", "truncated trace", "clock skew", "span success", "span error", "span unknown", "selected span", "collapsed subtree", "critical path calculating", "redacted payload", "retry unavailable"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```
