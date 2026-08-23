# Dependency topology monitor

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `dependency-topology-monitor` |
| Family | Overview |
| Dominant task | Understand health, upstream and downstream dependencies, and blast radius in order to prioritize response. |
| Search aliases | `service dependency graph`, `blast radius monitor`, `causal topology`, `dependency health` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Causal path and response ownership remain independent from graph inspection.
- The region graph remains `topology-monitor` → `environment-filter` → `dependency-graph` → `causal-impact-path` → `impact-ranked-entity-list` → `selected-node-evidence` → `response-owner-and-action`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-DT-01` | The dominant task is: Understand health, upstream and downstream dependencies, and blast radius in order to prioritize response. | Candidate evidence. |
| `AR-DT-02` | The complete required region graph must remain semantically present. | Required evidence. |
| `AR-DT-03` | Compact must retain wide selection, action, state, and recovery. | Required evidence. |
| `AR-DT-04` | Each region has an independent owner and retains the current selection association. | Preserve as an invariant. |
| `AR-DT-90` | knowledge discovery without health | Reject. |
| `AR-DT-91` | a single-parent infrastructure tree | Reject. |
| `AR-DT-92` | a flat service KPI grid | Reject. |
| `AR-DT-93` | free-form diagram editing | Reject. |

### Selection rule

Select `dependency-topology-monitor` only when `AR-DT-01`, `AR-DT-02`, and `AR-DT-03` are evidenced and none of `AR-DT-90`, `AR-DT-91`, `AR-DT-92`, or `AR-DT-93` describes the dominant task. If one required relationship is unknown, return `needs-evidence`; if a rejection code holds, return `reject` instead of adapting this topology by visual resemblance.

## Region graph

```text
topology-monitor
└─ environment-filter
   └─ dependency-graph
      └─ causal-impact-path
         └─ impact-ranked-entity-list
            └─ selected-node-evidence
               └─ response-owner-and-action
```

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `topology-monitor` | Owns the page-level topology monitor task and all descendant state. | Root of the graph. |
| `environment-filter` | Owns environment filter evidence or action without borrowing product semantics. | Follows `topology-monitor` in semantic order and retains the same selection context. |
| `dependency-graph` | Owns dependency graph evidence or action without borrowing product semantics. | Follows `environment-filter` in semantic order and retains the same selection context. |
| `causal-impact-path` | Owns causal impact path evidence or action without borrowing product semantics. | Follows `dependency-graph` in semantic order and retains the same selection context. |
| `impact-ranked-entity-list` | Owns impact ranked entity list evidence or action without borrowing product semantics. | Follows `causal-impact-path` in semantic order and retains the same selection context. |
| `selected-node-evidence` | Owns selected node evidence evidence or action without borrowing product semantics. | Follows `impact-ranked-entity-list` in semantic order and retains the same selection context. |
| `response-owner-and-action` | Owns response owner and action evidence or action without borrowing product semantics. | Follows `selected-node-evidence` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when the simultaneous regions cannot retain readable labels, exact associations, and complete actions.
- **Topology response:** Keep the dependency graph and causal path primary with ranked impacts and response ownership beside them.
- **Navigation replacement:** None while all required regions remain simultaneously usable.
- **Sticky boundary:** Only an active cross-region action may persist; it reserves space and yields when height cannot keep focused content visible.
- **Overflow owner:** `dependency-graph` alone may own bounded horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Keep the graph and prioritized impact list usable while the inspector becomes an explicit drawer.
- **Navigation replacement:** Replace the displaced supporting region with a named button or disclosure that exposes current selection and state.
- **Sticky boundary:** A persistent action remains only while its exact target and status stay visible; it becomes in-flow at short height.
- **Overflow owner:** `dependency-graph` keeps the only bounded overflow axis and exposes keyboard instructions.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions no longer preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Default to an accessible dependency path and ranked list; offer the graph as an optional full-screen equivalent.
- **Navigation replacement:** Use an explicit primary-pane sequence with Back that restores selection, filter, state, and scroll context.
- **Sticky boundary:** A bottom action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `dependency-graph` is optional; its text or list equivalent is primary.

### Reflow

- Semantic and DOM order is `topology-monitor` → `environment-filter` → `dependency-graph` → `causal-impact-path` → `impact-ranked-entity-list` → `selected-node-evidence` → `response-owner-and-action`.
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
| Initial / loading | `environment-filter` | Identify the scope and the region that is pending; preserve the semantic position. |
| Ready | `dependency-graph` | Expose the complete dominant task with causal path and response ownership remain independent from graph inspection. |
| Empty / not applicable | `causal-impact-path` | Distinguish meaningful absence from unavailable evidence and state why the region does not apply. |
| Error / retry | `impact-ranked-entity-list` | Keep valid context, name the failed owner, and offer a local retry without resetting selection. |
| Permission / unavailable | `response-owner-and-action` | Do not imply hidden evidence is absent; provide a safe exit or alternate route. |
| Pending | `response-owner-and-action` | Prevent duplicate action, retain the exact target and announce progress without moving focus. |
| Success | `response-owner-and-action` | Expose the outcome, preserve the selected context, and provide the next valid action. |
| Stale / conflict | `environment-filter` | Keep the last safe value, identify version or time conflict, and require explicit recovery. |
| Focus transition | `response-owner-and-action` | Move focus only for an opened modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `topology-monitor` | Preserve state, selection, query, and recovery when topology changes. |

Applicable state family: graph loading, too-large graph, partial source, healthy, degraded, unknown, selected node, selected edge, inferred path, hidden dependency, cycle, stale topology, ranking error, ownership conflict.

## Boundaries

### Accept

- Accept when dependency health determines blast radius.
- Accept when causal direction changes response priority.
- Accept when ranked impacts lead to an accountable action owner.

### Reject

- Reject knowledge discovery without health; this is `AR-DT-90` evidence and must route to an adjacent archetype.
- Reject a single-parent infrastructure tree; this is `AR-DT-91` evidence and must route to an adjacent archetype.
- Reject a flat service KPI grid; this is `AR-DT-92` evidence and must route to an adjacent archetype.
- Reject free-form diagram editing; this is `AR-DT-93` evidence and must route to an adjacent archetype.

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
| [OpenTelemetry — Service Graph Connector](https://explorer.opentelemetry.io/collector/components/contrib/servicegraphconnector) | Supports service interrelationships and graph-producing telemetry semantics. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Supports adaptive screen regions, fluid structures, and content-driven layout integrity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports adaptive panes, readable content regions, and layout relationships across available space. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow without page-level two-dimensional scrolling and bounded exceptions. | Does not select this archetype, define product truth, or authorize copied geometry. |

| [W3C WAI — ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) | Supports keyboard-complete composite interaction, state exposure, and predictable focus movement. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Supports announcing live, pending, success, failure, and reconnect changes without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "dependency-topology-monitor",
  "situationCodes": ["<matched AR-DT-* codes>"],
  "searchAliases": ["service dependency graph","blast radius monitor","causal topology","dependency health"],
  "dominantTask": "Understand health, upstream and downstream dependencies, and blast radius in order to prioritize response.",
  "regions": ["topology-monitor","environment-filter","dependency-graph","causal-impact-path","impact-ranked-entity-list","selected-node-evidence","response-owner-and-action"],
  "regionRelationships": ["topology-monitor precedes environment-filter precedes dependency-graph precedes causal-impact-path precedes impact-ranked-entity-list precedes selected-node-evidence precedes response-owner-and-action"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "topology-monitor → environment-filter → dependency-graph → causal-impact-path → impact-ranked-entity-list → selected-node-evidence → response-owner-and-action",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "dependency-graph",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["graph loading", "too-large graph", "partial source", "healthy", "degraded", "unknown", "selected node", "selected edge", "inferred path", "hidden dependency", "cycle", "stale topology", "ranking error", "ownership conflict"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```
