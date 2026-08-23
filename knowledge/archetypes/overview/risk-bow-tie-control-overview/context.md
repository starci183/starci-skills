# Risk bow-tie control overview

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `risk-bow-tie-control-overview` |
| Family | Overview |
| Dominant task | Understand how threats can cause one central event and how preventive and recovery controls break paths to consequences. |
| Search aliases | `bow tie risk`, `barrier control overview`, `threat consequence paths`, `control gaps` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Threat and consequence directions, the central event, and each control association never detach.
- The region graph remains `bow-tie-overview` → `risk-scope-and-central-event` → `threat-paths` → `preventive-controls` → `central-event` → `consequence-paths` → `recovery-mitigations` → `control-gap-register`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-RB-01` | The dominant task is: Understand how threats can cause one central event and how preventive and recovery controls break paths to consequences. | Candidate evidence. |
| `AR-RB-02` | The complete required region graph must remain semantically present. | Required evidence. |
| `AR-RB-03` | Compact must retain wide selection, action, state, and recovery. | Required evidence. |
| `AR-RB-04` | Each region has an independent owner and retains the current selection association. | Preserve as an invariant. |
| `AR-RB-90` | an impact-by-likelihood matrix | Reject. |
| `AR-RB-91` | dependency graph health | Reject. |
| `AR-RB-92` | a generic compliance matrix | Reject. |
| `AR-RB-93` | an editable workflow | Reject. |

### Selection rule

Select `risk-bow-tie-control-overview` only when `AR-RB-01`, `AR-RB-02`, and `AR-RB-03` are evidenced and none of `AR-RB-90`, `AR-RB-91`, `AR-RB-92`, or `AR-RB-93` describes the dominant task. If one required relationship is unknown, return `needs-evidence`; if a rejection code holds, return `reject` instead of adapting this topology by visual resemblance.

## Region graph

```text
bow-tie-overview
└─ risk-scope-and-central-event
   └─ threat-paths
      └─ preventive-controls
         └─ central-event
            └─ consequence-paths
               └─ recovery-mitigations
                  └─ control-gap-register
```

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `bow-tie-overview` | Owns the page-level bow tie overview task and all descendant state. | Root of the graph. |
| `risk-scope-and-central-event` | Owns risk scope and central event evidence or action without borrowing product semantics. | Follows `bow-tie-overview` in semantic order and retains the same selection context. |
| `threat-paths` | Owns threat paths evidence or action without borrowing product semantics. | Follows `risk-scope-and-central-event` in semantic order and retains the same selection context. |
| `preventive-controls` | Owns preventive controls evidence or action without borrowing product semantics. | Follows `threat-paths` in semantic order and retains the same selection context. |
| `central-event` | Owns central event evidence or action without borrowing product semantics. | Follows `preventive-controls` in semantic order and retains the same selection context. |
| `consequence-paths` | Owns consequence paths evidence or action without borrowing product semantics. | Follows `central-event` in semantic order and retains the same selection context. |
| `recovery-mitigations` | Owns recovery mitigations evidence or action without borrowing product semantics. | Follows `consequence-paths` in semantic order and retains the same selection context. |
| `control-gap-register` | Owns control gap register evidence or action without borrowing product semantics. | Follows `recovery-mitigations` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when the simultaneous regions cannot retain readable labels, exact associations, and complete actions.
- **Topology response:** Keep the full two-sided bow-tie and selected path detail together with a semantic list equivalent.
- **Navigation replacement:** None while all required regions remain simultaneously usable.
- **Sticky boundary:** Only an active cross-region action may persist; it reserves space and yields when height cannot keep focused content visible.
- **Overflow owner:** `bow-tie-overview` alone may own bounded horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Keep the central event and one named side at a time while the control-gap summary persists.
- **Navigation replacement:** Replace the displaced supporting region with a named button or disclosure that exposes current selection and state.
- **Sticky boundary:** A persistent action remains only while its exact target and status stay visible; it becomes in-flow at short height.
- **Overflow owner:** `bow-tie-overview` keeps the only bounded overflow axis and exposes keyboard instructions.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions no longer preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Lead with the central event, then separate threat-to-prevention and consequence-to-mitigation path lists.
- **Navigation replacement:** Use an explicit primary-pane sequence with Back that restores selection, filter, state, and scroll context.
- **Sticky boundary:** A bottom action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `bow-tie-overview` is optional; its text or list equivalent is primary.

### Reflow

- Semantic and DOM order is `bow-tie-overview` → `risk-scope-and-central-event` → `threat-paths` → `preventive-controls` → `central-event` → `consequence-paths` → `recovery-mitigations` → `control-gap-register`.
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
| Initial / loading | `risk-scope-and-central-event` | Identify the scope and the region that is pending; preserve the semantic position. |
| Ready | `threat-paths` | Expose the complete dominant task with threat and consequence directions, the central event, and each control association never detach. |
| Empty / not applicable | `preventive-controls` | Distinguish meaningful absence from unavailable evidence and state why the region does not apply. |
| Error / retry | `central-event` | Keep valid context, name the failed owner, and offer a local retry without resetting selection. |
| Permission / unavailable | `control-gap-register` | Do not imply hidden evidence is absent; provide a safe exit or alternate route. |
| Pending | `control-gap-register` | Prevent duplicate action, retain the exact target and announce progress without moving focus. |
| Success | `control-gap-register` | Expose the outcome, preserve the selected context, and provide the next valid action. |
| Stale / conflict | `risk-scope-and-central-event` | Keep the last safe value, identify version or time conflict, and require explicit recovery. |
| Focus transition | `control-gap-register` | Move focus only for an opened modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `bow-tie-overview` | Preserve state, selection, query, and recovery when topology changes. |

Applicable state family: path loading, threat assessed, threat unassessed, control effective, control degraded, control missing, consequence severity, selected path, stale evidence, gap owner, mitigation pending, alternate-list sync.

## Boundaries

### Accept

- Accept when one central event connects two directional risk halves.
- Accept when preventive and recovery controls own different paths.
- Accept when control gaps require accountable evidence.

### Reject

- Reject an impact-by-likelihood matrix; this is `AR-RB-90` evidence and must route to an adjacent archetype.
- Reject dependency graph health; this is `AR-RB-91` evidence and must route to an adjacent archetype.
- Reject a generic compliance matrix; this is `AR-RB-92` evidence and must route to an adjacent archetype.
- Reject an editable workflow; this is `AR-RB-93` evidence and must route to an adjacent archetype.

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
| [UK HSE — Major hazards regulatory model](https://www.hse.gov.uk/regulating-major-hazards/assets/docs/major-hazards-regulatory-model.pdf) | Supports bow-tie barrier layers, hazard pathways, prevention, mitigation, and effective control. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Supports adaptive screen regions, fluid structures, and content-driven layout integrity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports adaptive panes, readable content regions, and layout relationships across available space. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow without page-level two-dimensional scrolling and bounded exceptions. | Does not select this archetype, define product truth, or authorize copied geometry. |

| [W3C WAI — ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) | Supports keyboard-complete composite interaction, state exposure, and predictable focus movement. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Supports announcing live, pending, success, failure, and reconnect changes without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "risk-bow-tie-control-overview",
  "situationCodes": ["<matched AR-RB-* codes>"],
  "searchAliases": ["bow tie risk","barrier control overview","threat consequence paths","control gaps"],
  "dominantTask": "Understand how threats can cause one central event and how preventive and recovery controls break paths to consequences.",
  "regions": ["bow-tie-overview","risk-scope-and-central-event","threat-paths","preventive-controls","central-event","consequence-paths","recovery-mitigations","control-gap-register"],
  "regionRelationships": ["bow-tie-overview precedes risk-scope-and-central-event precedes threat-paths precedes preventive-controls precedes central-event precedes consequence-paths precedes recovery-mitigations precedes control-gap-register"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "bow-tie-overview → risk-scope-and-central-event → threat-paths → preventive-controls → central-event → consequence-paths → recovery-mitigations → control-gap-register",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "bow-tie-overview",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["path loading", "threat assessed", "threat unassessed", "control effective", "control degraded", "control missing", "consequence severity", "selected path", "stale evidence", "gap owner", "mitigation pending", "alternate-list sync"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```
