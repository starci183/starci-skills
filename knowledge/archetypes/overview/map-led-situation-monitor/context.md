# Map-led situation monitor

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `map-led-situation-monitor` |
| Family | Overview |
| Dominant task | Monitor geographically distributed status, use impact geometry to reprioritize alerts, and bind an eligible response command to the exact affected area. |
| Search aliases | `geospatial situation monitor`, `hotspot response map`, `area impact monitor`, `map operations` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Alert priority, impact geometry, and response command remain independent owners with shared selection.
- The selected impact area derives the exact command target and eligibility; a generic incident identifier is insufficient.
- The region graph remains `situation-monitor` → `scope-time-severity` → `geographic-health-map` → `impact-area-model` → `alert-priority-queue` → `selected-area-evidence` → `response-command-surface` → `command-feedback`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-MM-01` | The dominant task is: Monitor geographically distributed status, use impact geometry to reprioritize alerts, and bind an eligible response command to the exact affected area. | Candidate evidence. |
| `AR-MM-02` | The complete required region graph must remain semantically present. | Required evidence. |
| `AR-MM-03` | Compact must retain wide selection, action, state, and recovery. | Required evidence. |
| `AR-MM-04` | Each region has an independent owner and retains the current selection association. | Preserve as an invariant. |
| `AR-MM-90` | place discovery or choice | Reject. |
| `AR-MM-91` | route planning | Reject. |
| `AR-MM-92` | asset dispatch editing | Reject. |
| `AR-MM-93` | a decorative map whose removal does not change the task | Reject. |
| `AR-MM-94` | a generic live operations command center where geography does not own alert grouping, impact boundary, or command eligibility | Reject. |

### Selection rule

Select `map-led-situation-monitor` only when `AR-MM-01`, `AR-MM-02`, and `AR-MM-03` are evidenced, impact geometry changes alert priority or command eligibility, and none of `AR-MM-90` through `AR-MM-94` describes the dominant task. If one required relationship is unknown, return `needs-evidence`; if a rejection code holds, return `reject` instead of adapting this topology by visual resemblance.

## Region graph

```text
situation-monitor
└─ scope-time-severity
   ├─ geographic-health-map
   │  ↔ impact-area-model
   │     ↔ alert-priority-queue
   └─ selected-area-evidence
      └─ response-command-surface
         └─ command-feedback
```

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `situation-monitor` | Owns the page-level situation monitor task and all descendant state. | Root of the graph. |
| `scope-time-severity` | Owns scope time severity evidence or action without borrowing product semantics. | Follows `situation-monitor` in semantic order and retains the same selection context. |
| `geographic-health-map` | Owns spatial status and selectable affected-area geometry. | Synchronizes area selection with `impact-area-model` without owning alert priority or command eligibility. |
| `impact-area-model` | Owns the selected boundary, containment, overlap, and affected-set explanation. | Converts map geometry into the area evidence consumed by `alert-priority-queue` and `response-command-surface`. |
| `alert-priority-queue` | Owns alert ordering and the reason geometry changes that ordering. | Synchronizes selection bidirectionally with the impact area while remaining independent from the command owner. |
| `selected-area-evidence` | Owns textual evidence for the selected boundary and affected set. | Preserves a non-map verification path before commitment. |
| `response-command-surface` | Owns the exact area-derived command target, eligibility, review, and confirmation entry. | Consumes the selected impact area rather than a generic incident identifier. |
| `command-feedback` | Owns confirming, pending, success, failure, conflict, and reconnect outcomes. | Retains the exact area, command target, and prior queue context through recovery. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when the simultaneous regions cannot retain readable labels, exact associations, and complete actions.
- **Topology response:** Keep the map, prioritized alerts, selected-area evidence, and response command simultaneously inspectable.
- **Navigation replacement:** None while all required regions remain simultaneously usable.
- **Sticky boundary:** Only an active cross-region action may persist; it reserves space and yields when height cannot keep focused content visible.
- **Overflow owner:** `geographic-health-map` alone may own bounded horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Keep alert priority and command primary while map and evidence alternate as named supporting panes.
- **Navigation replacement:** Replace the displaced supporting region with a named button or disclosure that exposes current selection and state.
- **Sticky boundary:** A persistent action remains only while its exact target and status stay visible; it becomes in-flow at short height.
- **Overflow owner:** `geographic-health-map` keeps the only bounded overflow axis and exposes keyboard instructions.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions no longer preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Start with the alert queue, continue to textual impact-area boundary and containment evidence, and end with the exact area-derived response command; the map becomes an alternate full-screen verification view.
- **Navigation replacement:** Use an explicit primary-pane sequence with Back that restores selection, filter, state, and scroll context.
- **Sticky boundary:** A bottom action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `geographic-health-map` is optional; its text or list equivalent is primary.

### Reflow

- Semantic and DOM order is `situation-monitor` → `scope-time-severity` → `geographic-health-map` → `impact-area-model` → `alert-priority-queue` → `selected-area-evidence` → `response-command-surface` → `command-feedback`.
- Text, zoom, long translation, and enlarged controls trigger the same named topology changes.
- No CSS ordering changes the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap; hidden detail has an explicit accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, action, explanation, retry, and recovery path remains reachable in intermediate and compact.
- Topology changes preserve queue severity, selected alert, selected impact area, boundary evidence, exact command target, eligibility, and pending or completed result.
- Dynamic updates announce one contextual status message without stealing focus.
- Any modal traps focus, supports Escape or Cancel, and returns focus to the exact trigger.
- Color, position, and geometry always have a textual or structural equivalent.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `scope-time-severity` | Identify the scope and the region that is pending; preserve the semantic position. |
| Ready | `geographic-health-map` | Expose alert priority, impact geometry, and response command as independent owners while showing how the area derives the exact command target and eligibility. |
| Empty / not applicable | `impact-area-model` | Distinguish meaningful absence from unavailable evidence and state why the region does not apply. |
| Error / retry | `alert-priority-queue` | Keep valid context, name the failed owner, and offer a local retry without resetting selection. |
| Permission / unavailable | `command-feedback` | Do not imply hidden evidence is absent; provide a safe exit or alternate route. |
| Pending | `command-feedback` | Prevent duplicate action, retain the exact target and announce progress without moving focus. |
| Success | `command-feedback` | Expose the outcome, preserve the selected context, and provide the next valid action. |
| Stale / conflict | `scope-time-severity` | Keep the last safe value, identify version or time conflict, and require explicit recovery. |
| Focus transition | `command-feedback` | Move focus only for an opened modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `situation-monitor` | Preserve state, selection, query, and recovery when topology changes. |

Applicable state family: map loading, stale impact, no alerts, clustered status, reprioritized alert, unavailable area, confirming, pending, success, failure, conflict, alternate list.

## Boundaries

### Accept

- Accept when geography changes response priority.
- Accept when an alert binds to an exact impact area.
- Accept when the same area owns evidence and command feedback.

### Reject

- Reject place discovery or choice; this is `AR-MM-90` evidence and must route to an adjacent archetype.
- Reject route planning; this is `AR-MM-91` evidence and must route to an adjacent archetype.
- Reject asset dispatch editing; this is `AR-MM-92` evidence and must route to an adjacent archetype.
- Reject a decorative map whose removal does not change the task; this is `AR-MM-93` evidence and must route to an adjacent archetype.
- Reject a generic live operations command center where geography does not own alert grouping, impact boundary, or command eligibility; this is `AR-MM-94` evidence and must route to an adjacent archetype.

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
| [Mapbox — Maps products overview](https://docs.mapbox.com/help/getting-started/maps/) | Supports interactive maps, user-data overlays, geographic context, and map-led monitoring use cases. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Supports adaptive screen regions, fluid structures, and content-driven layout integrity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports adaptive panes, readable content regions, and layout relationships across available space. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow without page-level two-dimensional scrolling and bounded exceptions. | Does not select this archetype, define product truth, or authorize copied geometry. |

| [Apple — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Supports hierarchy, readable regions, adaptation, and preserving important content across available space. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Supports announcing live, pending, success, failure, and reconnect changes without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [OASIS — Common Alerting Protocol 1.2](https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2-os.pdf) | Supports linking urgency, severity, certainty, and polygon or area geometry in an alert model. | Does not impose a product command, scoring policy, or copied map geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "map-led-situation-monitor",
  "situationCodes": ["<matched AR-MM-* codes>"],
  "searchAliases": ["geospatial situation monitor","hotspot response map","area impact monitor","map operations"],
  "dominantTask": "Monitor geographically distributed status, use impact geometry to reprioritize alerts, and bind an eligible response command to the exact affected area.",
  "regions": ["situation-monitor","scope-time-severity","geographic-health-map","impact-area-model","alert-priority-queue","selected-area-evidence","response-command-surface","command-feedback"],
  "regionRelationships": ["geographic-health-map synchronizes area selection with impact-area-model", "impact-area-model derives alert-priority-queue ordering", "selected-area-evidence verifies the boundary before response-command-surface derives target and eligibility", "command-feedback retains area and command context"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "situation-monitor → scope-time-severity → geographic-health-map → impact-area-model → alert-priority-queue → selected-area-evidence → response-command-surface → command-feedback",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "geographic-health-map",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["map loading", "stale impact", "no alerts", "clustered status", "reprioritized alert", "unavailable area", "confirming", "pending", "success", "failure", "conflict", "alternate list"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```
