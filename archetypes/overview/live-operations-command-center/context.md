# Live operations command center

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `live-operations-command-center` |
| Family | Overview |
| Dominant task | Detect an active incident, assess impact, and execute a safe response command under time pressure. |
| Search aliases | `incident command center`, `live operations`, `response console`, `incident operations` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Urgency, exact command target, eligibility, and command outcome remain explicit.
- The region graph remains `command-center` → `environment-time-context` → `critical-health-strip` → `telemetry-or-topology` → `active-incident-queue` → `selected-incident-command-surface` → `live-feedback`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-LO-01` | The dominant task is: Detect an active incident, assess impact, and execute a safe response command under time pressure. | Candidate evidence. |
| `AR-LO-02` | The complete required region graph must remain semantically present. | Required evidence. |
| `AR-LO-03` | Compact must retain wide selection, action, state, and recovery. | Required evidence. |
| `AR-LO-04` | Each region has an independent owner and retains the current selection association. | Preserve as an invariant. |
| `AR-LO-90` | periodic executive reporting | Reject. |
| `AR-LO-91` | a heterogeneous home dashboard | Reject. |
| `AR-LO-92` | raw log investigation | Reject. |
| `AR-LO-93` | a repeated CRUD queue without live urgency | Reject. |

### Selection rule

Select `live-operations-command-center` only when `AR-LO-01`, `AR-LO-02`, and `AR-LO-03` are evidenced and none of `AR-LO-90`, `AR-LO-91`, `AR-LO-92`, or `AR-LO-93` describes the dominant task. If one required relationship is unknown, return `needs-evidence`; if a rejection code holds, return `reject` instead of adapting this topology by visual resemblance.

## Region graph

```text
command-center
└─ environment-time-context
   └─ critical-health-strip
      └─ telemetry-or-topology
         └─ active-incident-queue
            └─ selected-incident-command-surface
               └─ live-feedback
```

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `command-center` | Owns the page-level command center task and all descendant state. | Root of the graph. |
| `environment-time-context` | Owns environment time context evidence or action without borrowing product semantics. | Follows `command-center` in semantic order and retains the same selection context. |
| `critical-health-strip` | Owns critical health strip evidence or action without borrowing product semantics. | Follows `environment-time-context` in semantic order and retains the same selection context. |
| `telemetry-or-topology` | Owns telemetry or topology evidence or action without borrowing product semantics. | Follows `critical-health-strip` in semantic order and retains the same selection context. |
| `active-incident-queue` | Owns active incident queue evidence or action without borrowing product semantics. | Follows `telemetry-or-topology` in semantic order and retains the same selection context. |
| `selected-incident-command-surface` | Owns selected incident command surface evidence or action without borrowing product semantics. | Follows `active-incident-queue` in semantic order and retains the same selection context. |
| `live-feedback` | Owns live feedback evidence or action without borrowing product semantics. | Follows `selected-incident-command-surface` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when the simultaneous regions cannot retain readable labels, exact associations, and complete actions.
- **Topology response:** Keep critical health, primary telemetry, the incident queue, and the selected command owner simultaneously inspectable.
- **Navigation replacement:** None while all required regions remain simultaneously usable.
- **Sticky boundary:** Only an active cross-region action may persist; it reserves space and yields when height cannot keep focused content visible.
- **Overflow owner:** `telemetry-or-topology` alone may own bounded horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Keep critical health and incidents primary while telemetry or context moves behind an explicit supporting-pane control.
- **Navigation replacement:** Replace the displaced supporting region with a named button or disclosure that exposes current selection and state.
- **Sticky boundary:** A persistent action remains only while its exact target and status stay visible; it becomes in-flow at short height.
- **Overflow owner:** `telemetry-or-topology` keeps the only bounded overflow axis and exposes keyboard instructions.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions no longer preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Sequence critical status, recommended next action, active incidents, then incident detail and command.
- **Navigation replacement:** Use an explicit primary-pane sequence with Back that restores selection, filter, state, and scroll context.
- **Sticky boundary:** A bottom action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `telemetry-or-topology` is optional; its text or list equivalent is primary.

### Reflow

- Semantic and DOM order is `command-center` → `environment-time-context` → `critical-health-strip` → `telemetry-or-topology` → `active-incident-queue` → `selected-incident-command-surface` → `live-feedback`.
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
| Initial / loading | `environment-time-context` | Identify the scope and the region that is pending; preserve the semantic position. |
| Ready | `critical-health-strip` | Expose the complete dominant task with urgency, exact command target, eligibility, and command outcome remain explicit. |
| Empty / not applicable | `telemetry-or-topology` | Distinguish meaningful absence from unavailable evidence and state why the region does not apply. |
| Error / retry | `active-incident-queue` | Keep valid context, name the failed owner, and offer a local retry without resetting selection. |
| Permission / unavailable | `live-feedback` | Do not imply hidden evidence is absent; provide a safe exit or alternate route. |
| Pending | `live-feedback` | Prevent duplicate action, retain the exact target and announce progress without moving focus. |
| Success | `live-feedback` | Expose the outcome, preserve the selected context, and provide the next valid action. |
| Stale / conflict | `environment-time-context` | Keep the last safe value, identify version or time conflict, and require explicit recovery. |
| Focus transition | `live-feedback` | Move focus only for an opened modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `command-center` | Preserve state, selection, query, and recovery when topology changes. |

Applicable state family: live, paused, stale, no-incident, acknowledged, escalated, resolved, confirming, pending, success, failure, conflict, reconnect.

## Boundaries

### Accept

- Accept when live incident urgency drives the page.
- Accept when impact evidence and response command must remain associated.
- Accept when command outcome must be monitored.

### Reject

- Reject periodic executive reporting; this is `AR-LO-90` evidence and must route to an adjacent archetype.
- Reject a heterogeneous home dashboard; this is `AR-LO-91` evidence and must route to an adjacent archetype.
- Reject raw log investigation; this is `AR-LO-92` evidence and must route to an adjacent archetype.
- Reject a repeated CRUD queue without live urgency; this is `AR-LO-93` evidence and must route to an adjacent archetype.

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
| [Google SRE — Incident Response](https://sre.google/workbook/incident-response/) | Supports clear command roles, coordination, impact assessment, and live incident management. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Supports adaptive screen regions, fluid structures, and content-driven layout integrity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports adaptive panes, readable content regions, and layout relationships across available space. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow without page-level two-dimensional scrolling and bounded exceptions. | Does not select this archetype, define product truth, or authorize copied geometry. |

| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Supports announcing live, pending, success, failure, and reconnect changes without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Supports reserving space for sticky actions and yielding overlays so keyboard focus remains visible. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [GitLab Pajamas — Patterns](https://design.gitlab.com/patterns/) | Supports status, filtering, feedback, and resilient task-flow conventions. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "live-operations-command-center",
  "situationCodes": ["<matched AR-LO-* codes>"],
  "searchAliases": ["incident command center","live operations","response console","incident operations"],
  "dominantTask": "Detect an active incident, assess impact, and execute a safe response command under time pressure.",
  "regions": ["command-center","environment-time-context","critical-health-strip","telemetry-or-topology","active-incident-queue","selected-incident-command-surface","live-feedback"],
  "regionRelationships": ["command-center precedes environment-time-context precedes critical-health-strip precedes telemetry-or-topology precedes active-incident-queue precedes selected-incident-command-surface precedes live-feedback"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "command-center → environment-time-context → critical-health-strip → telemetry-or-topology → active-incident-queue → selected-incident-command-surface → live-feedback",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "telemetry-or-topology",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["live", "paused", "stale", "no-incident", "acknowledged", "escalated", "resolved", "confirming", "pending", "success", "failure", "conflict", "reconnect"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```
