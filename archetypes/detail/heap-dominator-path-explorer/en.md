# Heap dominator and root-path explorer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `heap-dominator-path-explorer` |
| Family | Detail |
| Dominant task | Find why objects remain retained by following dominators and reference paths back to garbage-collection roots. |
| Search aliases | `heap dominator`, `retained objects`, `GC root path`, `memory leak` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Dominator relations and root reachability are mathematical owners; retained-size evidence remains attached to the selected object path.
- The required region graph remains `heap-explorer → snapshot-and-runtime-context → class-and-size-summary → dominator-tree → retained-size-view → reference-paths-to-roots → selected-object-fields → snapshot-comparison-and-leak-suspects`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.
- Dominator relation and path-to-root evidence are mandatory.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-HD-01` | The dominant task is: Find why objects remain retained by following dominators and reference paths back to garbage-collection roots. | Candidate evidence. |
| `AR-HD-02` | The complete required region graph is semantically present. | Required evidence. |
| `AR-HD-03` | Compact preserves the wide selection, action, state, and recovery. | Required evidence. |
| `AR-HD-04` | Dominator relation and path-to-root evidence are mandatory. | Required relationship evidence. |
| `AR-HD-90` | The dominant task is dependency topology monitor. | Reject. |
| `AR-HD-91` | The dominant task is generic hierarchy explorer. | Reject. |
| `AR-HD-92` | The dominant task is memory chart. | Reject. |
| `AR-HD-93` | The dominant task is record detail. | Reject. |

### Selection rule

Select `heap-dominator-path-explorer` only when `AR-HD-01`, `AR-HD-02`, `AR-HD-03`, and `AR-HD-04` are evidenced and none of the `AR-HD-90` through `AR-HD-93` rejection codes holds. Return `needs-evidence` when one required owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
heap-explorer
└─ snapshot-and-runtime-context
   └─ class-and-size-summary
      └─ dominator-tree
         └─ retained-size-view
            └─ reference-paths-to-roots
               └─ selected-object-fields
                  └─ snapshot-comparison-and-leak-suspects
```

- Required relationship: Dominator relations and root reachability are mathematical owners; retained-size evidence remains attached to the selected object path.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `heap-explorer` | Owns the page-level dominant task and all descendant state. | Root of the graph. |
| `snapshot-and-runtime-context` | Owns the evidence, state, and action for snapshot and runtime context without borrowing product semantics. | Follows `heap-explorer` in semantic order and retains the same selection context. |
| `class-and-size-summary` | Owns the evidence, state, and action for class and size summary without borrowing product semantics. | Follows `snapshot-and-runtime-context` in semantic order and retains the same selection context. |
| `dominator-tree` | Owns the evidence, state, and action for dominator tree without borrowing product semantics. | Follows `class-and-size-summary` in semantic order and retains the same selection context. |
| `retained-size-view` | Owns the evidence, state, and action for retained size view without borrowing product semantics. | Follows `dominator-tree` in semantic order and retains the same selection context. |
| `reference-paths-to-roots` | Owns the evidence, state, and action for reference paths to roots without borrowing product semantics. | Follows `retained-size-view` in semantic order and retains the same selection context. |
| `selected-object-fields` | Owns the evidence, state, and action for selected object fields without borrowing product semantics. | Follows `reference-paths-to-roots` in semantic order and retains the same selection context. |
| `snapshot-comparison-and-leak-suspects` | Owns the evidence, state, and action for snapshot comparison and leak suspects without borrowing product semantics. | Follows `selected-object-fields` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Keep the dominator tree, root path, and object detail visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** `dominator-tree` alone may own bounded two-dimensional overflow when its task meaning requires it.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Make suspect ranking and root path primary while object detail becomes a drawer.
- **Navigation replacement:** A named pane control exposes the displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** `dominator-tree` retains its bounded overflow; displaced prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Use leak suspects → selected dominator path → root references → object fields → snapshot delta.
- **Navigation replacement:** Explicit Previous, Next, and named-pane controls restore selection, state, and scroll context.
- **Sticky boundary:** The compact step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** `dominator-tree` remains the only bounded exception; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `heap-explorer → snapshot-and-runtime-context → class-and-size-summary → dominator-tree → retained-size-view → reference-paths-to-roots → selected-object-fields → snapshot-comparison-and-leak-suspects`.
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
- The fictional suspect remains linked to its dominator and exact GC-root path.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `snapshot-and-runtime-context` | Identify the pending owner and preserve its semantic position. |
| Ready | `class-and-size-summary` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `dominator-tree` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `retained-size-view` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `reference-paths-to-roots` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `snapshot-comparison-and-leak-suspects` | Prevent duplicate action and announce progress without moving focus. |
| Success | `snapshot-comparison-and-leak-suspects` | Expose the result, preserve context, and provide the next valid action. |
| Stale / conflict | `snapshot-and-runtime-context` | Keep the last safe value and require explicit recovery. |
| Focus transition | `snapshot-comparison-and-leak-suspects` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `heap-explorer` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: snapshot loading, snapshot corrupt, class grouped, object selected, object collected, root path found, root paths multiple, root path missing, retained size calculating, suspect confirmed, suspect dismissed, comparison unavailable.

## Boundaries

### Accept

- Accept when find why objects remain retained by following dominators and reference paths back to garbage-collection roots.
- Accept when dominator relations and root reachability are mathematical owners; retained-size evidence remains attached to the selected object path.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject dependency topology monitor; this is `AR-HD-90` evidence and must route to an adjacent archetype.
- Reject generic hierarchy explorer; this is `AR-HD-91` evidence and must route to an adjacent archetype.
- Reject memory chart; this is `AR-HD-92` evidence and must route to an adjacent archetype.
- Reject record detail; this is `AR-HD-93` evidence and must route to an adjacent archetype.
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
| [Chrome DevTools — Memory terminology](https://developer.chrome.com/docs/devtools/memory-problems/get-started) | Supports retained size, dominators, and heap terminology. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Eclipse MAT — Dominator Tree](https://help.eclipse.org/latest/topic/org.eclipse.mat.ui.help/concepts/dominatortree.html) | Supports independent dominator-tree semantics. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Mozilla — Firefox Profiler documentation](https://profiler.firefox.com/docs/) | Supports independent runtime profiling context. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Treegrid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Supports deterministic keyboard access to hierarchy plus tabular evidence. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "heap-dominator-path-explorer",
  "situationCodes": ["<matched AR-HD-* codes>"],
  "searchAliases": ["heap dominator","retained objects","GC root path","memory leak"],
  "dominantTask": "Find why objects remain retained by following dominators and reference paths back to garbage-collection roots.",
  "regions": ["heap-explorer","snapshot-and-runtime-context","class-and-size-summary","dominator-tree","retained-size-view","reference-paths-to-roots","selected-object-fields","snapshot-comparison-and-leak-suspects"],
  "regionRelationships": ["Dominator relations and root reachability are mathematical owners; retained-size evidence remains attached to the selected object path."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "heap-explorer → snapshot-and-runtime-context → class-and-size-summary → dominator-tree → retained-size-view → reference-paths-to-roots → selected-object-fields → snapshot-comparison-and-leak-suspects",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "dominator-tree",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["snapshot loading","snapshot corrupt","class grouped","object selected","object collected","root path found","root paths multiple","root path missing","retained size calculating","suspect confirmed","suspect dismissed","comparison unavailable"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

