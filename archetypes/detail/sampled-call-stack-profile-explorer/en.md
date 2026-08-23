# Sampled call-stack profile explorer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `sampled-call-stack-profile-explorer` |
| Family | Detail |
| Dominant task | Locate aggregate CPU cost by connecting sampled stacks, flame geometry, bottom-up callers, and source frames. |
| Search aliases | `CPU profile`, `sampled stacks`, `flame graph`, `bottom-up callers` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Aggregated samples and shared stack prefixes own the evidence; the selected frame persists across flame, call-tree, bottom-up, and source representations.
- The required region graph remains `profile-explorer → profile-and-workload-context → flame-graph → call-tree-and-bottom-up-table → thread-and-category-navigation → selected-frame-source → sample-distribution → baseline-comparison`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.
- Aggregate sampled stacks and caller or callee paths are mandatory.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-CP-01` | The dominant task is: Locate aggregate CPU cost by connecting sampled stacks, flame geometry, bottom-up callers, and source frames. | Candidate evidence. |
| `AR-CP-02` | The complete required region graph is semantically present. | Required evidence. |
| `AR-CP-03` | Compact preserves the wide selection, action, state, and recovery. | Required evidence. |
| `AR-CP-04` | Aggregate sampled stacks and caller or callee paths are mandatory. | Required relationship evidence. |
| `AR-CP-90` | The dominant task is distributed trace. | Reject. |
| `AR-CP-91` | The dominant task is streaming log console. | Reject. |
| `AR-CP-92` | The dominant task is query plan. | Reject. |
| `AR-CP-93` | The dominant task is generic chart dashboard. | Reject. |

### Selection rule

Select `sampled-call-stack-profile-explorer` only when `AR-CP-01`, `AR-CP-02`, `AR-CP-03`, and `AR-CP-04` are evidenced and none of the `AR-CP-90` through `AR-CP-93` rejection codes holds. Return `needs-evidence` when one required owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
profile-explorer
└─ profile-and-workload-context
   └─ flame-graph
      └─ call-tree-and-bottom-up-table
         └─ thread-and-category-navigation
            └─ selected-frame-source
               └─ sample-distribution
                  └─ baseline-comparison
```

- Required relationship: Aggregated samples and shared stack prefixes own the evidence; the selected frame persists across flame, call-tree, bottom-up, and source representations.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `profile-explorer` | Owns the page-level dominant task and all descendant state. | Root of the graph. |
| `profile-and-workload-context` | Owns the evidence, state, and action for profile and workload context without borrowing product semantics. | Follows `profile-explorer` in semantic order and retains the same selection context. |
| `flame-graph` | Owns the evidence, state, and action for flame graph without borrowing product semantics. | Follows `profile-and-workload-context` in semantic order and retains the same selection context. |
| `call-tree-and-bottom-up-table` | Owns the evidence, state, and action for call tree and bottom up table without borrowing product semantics. | Follows `flame-graph` in semantic order and retains the same selection context. |
| `thread-and-category-navigation` | Owns the evidence, state, and action for thread and category navigation without borrowing product semantics. | Follows `call-tree-and-bottom-up-table` in semantic order and retains the same selection context. |
| `selected-frame-source` | Owns the evidence, state, and action for selected frame source without borrowing product semantics. | Follows `thread-and-category-navigation` in semantic order and retains the same selection context. |
| `sample-distribution` | Owns the evidence, state, and action for sample distribution without borrowing product semantics. | Follows `selected-frame-source` in semantic order and retains the same selection context. |
| `baseline-comparison` | Owns the evidence, state, and action for baseline comparison without borrowing product semantics. | Follows `sample-distribution` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Keep the flame graph, call table, and source or detail visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** `flame-graph` alone may own bounded two-dimensional overflow when its task meaning requires it.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Make the flame graph primary; alternate call and source while the selected stack persists.
- **Navigation replacement:** A named pane control exposes the displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** `flame-graph` retains its bounded overflow; displaced prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Use hot-functions list → caller or callee path → source frame → distribution or baseline; make flame view optional full-screen.
- **Navigation replacement:** Explicit Previous, Next, and named-pane controls restore selection, state, and scroll context.
- **Sticky boundary:** The compact step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** `flame-graph` remains the only bounded exception; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `profile-explorer → profile-and-workload-context → flame-graph → call-tree-and-bottom-up-table → thread-and-category-navigation → selected-frame-source → sample-distribution → baseline-comparison`.
- Text zoom, long translation, and enlarged controls trigger the same relationship-driven topology changes.
- CSS never reorders the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap and every hidden region has a named accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, measurement, action, retry, and recovery path remains reachable in intermediate and compact.
- Topology changes preserve the exact selected item, shared coordinate or path, data state, and pending or completed receipt.
- Dynamic updates announce one contextual status without stealing focus.
- A modal traps focus, supports Escape or Cancel, and returns focus to the exact trigger.
- Color, position, geometry, and visual marks have textual or tabular equivalents.
- The fictional hotspot preserves the same frame across flame, call, bottom-up, and source views.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `profile-and-workload-context` | Identify the pending owner and preserve its semantic position. |
| Ready | `flame-graph` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `call-tree-and-bottom-up-table` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `thread-and-category-navigation` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `selected-frame-source` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `baseline-comparison` | Prevent duplicate action and announce progress without moving focus. |
| Success | `baseline-comparison` | Expose the result, preserve context, and provide the next valid action. |
| Stale / conflict | `profile-and-workload-context` | Keep the last safe value and require explicit recovery. |
| Focus transition | `baseline-comparison` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `profile-explorer` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: profile loading, profile partial, thread hidden, frame selected, frame inlined, frame unknown, samples aggregating, hotspot filtered, baseline missing, baseline regressed, baseline improved, source unavailable.

## Boundaries

### Accept

- Accept when locate aggregate CPU cost by connecting sampled stacks, flame geometry, bottom-up callers, and source frames.
- Accept when aggregated samples and shared stack prefixes own the evidence; the selected frame persists across flame, call-tree, bottom-up, and source representations.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject distributed trace; this is `AR-CP-90` evidence and must route to an adjacent archetype.
- Reject streaming log console; this is `AR-CP-91` evidence and must route to an adjacent archetype.
- Reject query plan; this is `AR-CP-92` evidence and must route to an adjacent archetype.
- Reject generic chart dashboard; this is `AR-CP-93` evidence and must route to an adjacent archetype.
- Reject a candidate whose only difference is product noun, count, density, color, component, or state as `duplicate-or-variation`.

### Boundary verdict

Return `accept` only when the dominant task, complete region graph, mandatory owner relationship, and compact interaction parity all hold. Return `reject` for any rejection code. Return `needs-evidence` when a required owner or relationship is unresolved.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permissions, actions, and truthful state meaning to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow realization, and relationship-driven transition points.
- Neither handoff may remove a required region, change the dominant task, or weaken interaction parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports task relationships, adaptive behavior, and accessibility obligations; it does not name StarCi owners, select exact geometry, or grant permission to copy a source interface. The sources were opened and verified as current official pages during this batch.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [Chrome DevTools — Performance reference](https://developer.chrome.com/docs/devtools/performance/reference) | Supports flame charts, call trees, and performance evidence. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Mozilla — Firefox Profiler documentation](https://profiler.firefox.com/docs/) | Supports independent sampled-profile and stack analysis. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Eclipse MAT — Dominator Tree](https://help.eclipse.org/latest/topic/org.eclipse.mat.ui.help/concepts/dominatortree.html) | Supports independent hierarchy and retained-path contrast. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports aggregation and view-change announcements without focus loss. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "sampled-call-stack-profile-explorer",
  "situationCodes": ["<matched AR-CP-* codes>"],
  "searchAliases": ["CPU profile","sampled stacks","flame graph","bottom-up callers"],
  "dominantTask": "Locate aggregate CPU cost by connecting sampled stacks, flame geometry, bottom-up callers, and source frames.",
  "regions": ["profile-explorer","profile-and-workload-context","flame-graph","call-tree-and-bottom-up-table","thread-and-category-navigation","selected-frame-source","sample-distribution","baseline-comparison"],
  "regionRelationships": ["Aggregated samples and shared stack prefixes own the evidence; the selected frame persists across flame, call-tree, bottom-up, and source representations."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "profile-explorer → profile-and-workload-context → flame-graph → call-tree-and-bottom-up-table → thread-and-category-navigation → selected-frame-source → sample-distribution → baseline-comparison",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "flame-graph",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["profile loading","profile partial","thread hidden","frame selected","frame inlined","frame unknown","samples aggregating","hotspot filtered","baseline missing","baseline regressed","baseline improved","source unavailable"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

