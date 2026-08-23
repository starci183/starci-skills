# Scenario sensitivity modeler

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `scenario-sensitivity-modeler` |
| Family | Work |
| Dominant task | Edit assumptions and constraints, recalculate scenarios, and identify which inputs drive outcome sensitivity before committing a decision. |
| Search aliases | `what-if modeler`, `scenario sensitivity`, `assumption editor`, `decision model` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Every result binds to one model version, validated assumptions, and the affected outputs.
- The region graph remains `sensitivity-modeler` → `model-horizon-context` → `assumption-editor` → `constraint-and-validity-model` → `recalculation-status` → `sensitivity-surface` → `scenario-outcome-comparison` → `decision-snapshot`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-SS-01` | The dominant task is: Edit assumptions and constraints, recalculate scenarios, and identify which inputs drive outcome sensitivity before committing a decision. | Candidate evidence. |
| `AR-SS-02` | The complete required region graph must remain semantically present. | Required evidence. |
| `AR-SS-03` | Compact must retain wide selection, action, state, and recovery. | Required evidence. |
| `AR-SS-04` | Each region has an independent owner and retains the current selection association. | Preserve as an invariant. |
| `AR-SS-90` | a passive forecast overview | Reject. |
| `AR-SS-91` | a simple benchmark | Reject. |
| `AR-SS-92` | a one-form estimate | Reject. |
| `AR-SS-93` | a palette or canvas automation builder | Reject. |

### Selection rule

Select `scenario-sensitivity-modeler` only when `AR-SS-01`, `AR-SS-02`, and `AR-SS-03` are evidenced and none of `AR-SS-90`, `AR-SS-91`, `AR-SS-92`, or `AR-SS-93` describes the dominant task. If one required relationship is unknown, return `needs-evidence`; if a rejection code holds, return `reject` instead of adapting this topology by visual resemblance.

## Region graph

```text
sensitivity-modeler
└─ model-horizon-context
   └─ assumption-editor
      └─ constraint-and-validity-model
         └─ recalculation-status
            └─ sensitivity-surface
               └─ scenario-outcome-comparison
                  └─ decision-snapshot
```

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `sensitivity-modeler` | Owns the page-level sensitivity modeler task and all descendant state. | Root of the graph. |
| `model-horizon-context` | Owns model horizon context evidence or action without borrowing product semantics. | Follows `sensitivity-modeler` in semantic order and retains the same selection context. |
| `assumption-editor` | Owns assumption editor evidence or action without borrowing product semantics. | Follows `model-horizon-context` in semantic order and retains the same selection context. |
| `constraint-and-validity-model` | Owns constraint and validity model evidence or action without borrowing product semantics. | Follows `assumption-editor` in semantic order and retains the same selection context. |
| `recalculation-status` | Owns recalculation status evidence or action without borrowing product semantics. | Follows `constraint-and-validity-model` in semantic order and retains the same selection context. |
| `sensitivity-surface` | Owns sensitivity surface evidence or action without borrowing product semantics. | Follows `recalculation-status` in semantic order and retains the same selection context. |
| `scenario-outcome-comparison` | Owns scenario outcome comparison evidence or action without borrowing product semantics. | Follows `sensitivity-surface` in semantic order and retains the same selection context. |
| `decision-snapshot` | Owns decision snapshot evidence or action without borrowing product semantics. | Follows `scenario-outcome-comparison` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when the simultaneous regions cannot retain readable labels, exact associations, and complete actions.
- **Topology response:** Keep assumption editing, sensitivity evidence, and outcome comparison simultaneously inspectable with input-output links.
- **Navigation replacement:** None while all required regions remain simultaneously usable.
- **Sticky boundary:** Only an active cross-region action may persist; it reserves space and yields when height cannot keep focused content visible.
- **Overflow owner:** `sensitivity-surface` alone may own bounded horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Keep the editor primary and alternate sensitivity and comparison as named supporting panes while recalculation remains visible.
- **Navigation replacement:** Replace the displaced supporting region with a named button or disclosure that exposes current selection and state.
- **Sticky boundary:** A persistent action remains only while its exact target and status stay visible; it becomes in-flow at short height.
- **Overflow owner:** `sensitivity-surface` keeps the only bounded overflow axis and exposes keyboard instructions.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions no longer preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Sequence assumption selection, validation, recalculation, sensitivity inspection, scenario comparison, and snapshot saving.
- **Navigation replacement:** Use an explicit primary-pane sequence with Back that restores selection, filter, state, and scroll context.
- **Sticky boundary:** A bottom action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `sensitivity-surface` is optional; its text or list equivalent is primary.

### Reflow

- Semantic and DOM order is `sensitivity-modeler` → `model-horizon-context` → `assumption-editor` → `constraint-and-validity-model` → `recalculation-status` → `sensitivity-surface` → `scenario-outcome-comparison` → `decision-snapshot`.
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
| Initial / loading | `model-horizon-context` | Identify the scope and the region that is pending; preserve the semantic position. |
| Ready | `assumption-editor` | Expose the complete dominant task with every result binds to one model version, validated assumptions, and the affected outputs. |
| Empty / not applicable | `constraint-and-validity-model` | Distinguish meaningful absence from unavailable evidence and state why the region does not apply. |
| Error / retry | `recalculation-status` | Keep valid context, name the failed owner, and offer a local retry without resetting selection. |
| Permission / unavailable | `decision-snapshot` | Do not imply hidden evidence is absent; provide a safe exit or alternate route. |
| Pending | `decision-snapshot` | Prevent duplicate action, retain the exact target and announce progress without moving focus. |
| Success | `decision-snapshot` | Expose the outcome, preserve the selected context, and provide the next valid action. |
| Stale / conflict | `model-horizon-context` | Keep the last safe value, identify version or time conflict, and require explicit recovery. |
| Focus transition | `decision-snapshot` | Move focus only for an opened modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `sensitivity-modeler` | Preserve state, selection, query, and recovery when topology changes. |

Applicable state family: pristine assumptions, dirty assumptions, invalid constraint, calculating, calculation error, stale result, sensitivity unavailable, scenario add, scenario remove, locked baseline, version conflict, snapshot save.

## Boundaries

### Accept

- Accept when users change model inputs before deciding.
- Accept when constraints can invalidate recalculation.
- Accept when sensitivity is independent from scenario comparison.

### Reject

- Reject a passive forecast overview; this is `AR-SS-90` evidence and must route to an adjacent archetype.
- Reject a simple benchmark; this is `AR-SS-91` evidence and must route to an adjacent archetype.
- Reject a one-form estimate; this is `AR-SS-92` evidence and must route to an adjacent archetype.
- Reject a palette or canvas automation builder; this is `AR-SS-93` evidence and must route to an adjacent archetype.

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
| [Microsoft Support — Introduction to What-If Analysis](https://support.microsoft.com/en-us/excel/introduction-to-what-if-analysis) | Supports changing inputs, comparing scenario result sets, and sensitivity across one or two variables. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Supports adaptive screen regions, fluid structures, and content-driven layout integrity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports adaptive panes, readable content regions, and layout relationships across available space. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow without page-level two-dimensional scrolling and bounded exceptions. | Does not select this archetype, define product truth, or authorize copied geometry. |

| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Supports announcing live, pending, success, failure, and reconnect changes without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports meaningful focus sequence through reflow, disclosures, and staged compact navigation. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Adobe Spectrum — Components](https://spectrum.adobe.com/page/components/) | Supports accessible component states, selection, feedback, and coordinated data controls. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "scenario-sensitivity-modeler",
  "situationCodes": ["<matched AR-SS-* codes>"],
  "searchAliases": ["what-if modeler","scenario sensitivity","assumption editor","decision model"],
  "dominantTask": "Edit assumptions and constraints, recalculate scenarios, and identify which inputs drive outcome sensitivity before committing a decision.",
  "regions": ["sensitivity-modeler","model-horizon-context","assumption-editor","constraint-and-validity-model","recalculation-status","sensitivity-surface","scenario-outcome-comparison","decision-snapshot"],
  "regionRelationships": ["sensitivity-modeler precedes model-horizon-context precedes assumption-editor precedes constraint-and-validity-model precedes recalculation-status precedes sensitivity-surface precedes scenario-outcome-comparison precedes decision-snapshot"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "sensitivity-modeler → model-horizon-context → assumption-editor → constraint-and-validity-model → recalculation-status → sensitivity-surface → scenario-outcome-comparison → decision-snapshot",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "sensitivity-surface",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["pristine assumptions", "dirty assumptions", "invalid constraint", "calculating", "calculation error", "stale result", "sensitivity unavailable", "scenario add", "scenario remove", "locked baseline", "version conflict", "snapshot save"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```
