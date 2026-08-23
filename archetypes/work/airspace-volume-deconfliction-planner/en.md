# Airspace volume deconfliction planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `airspace-volume-deconfliction-planner` |
| Family | Work |
| Dominant task | Allocate temporary four-dimensional airspace volumes by detecting space-time intersections under uncertainty, negotiating shift, resize or reroute counterfactuals and activating a non-overlapping coordinated volume set. |
| Search aliases | `airspace volume deconfliction`, `airspace volume deconfliction workspace`, `airspace volume deconfliction control` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Allocate temporary four-dimensional airspace volumes by detecting space-time intersections under uncertainty, negotiating shift, resize or reroute counterfactuals and activating a non-overlapping coordinated volume set.
- a 2D map overlap or calendar overlap is insufficient, and reserved capacity stays occupied until actual use ends and authority records release.
- Every required region retains a separate owner and the same selected context.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-AVDP-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-AVDP-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-AVDP-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-AVDP-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-AVDP-90` | The dominant task is actually `orbital-conjunction-assessment-workbench`. | Reject. |
| `AR-AVDP-91` | The dominant task is actually `air-traffic-separation-resolution-console`. | Reject. |
| `AR-AVDP-92` | The dominant task is actually `capacity-allocation-overview`. | Reject. |
| `AR-AVDP-93` | The dominant task is actually `calendar-resource-scheduler`. | Reject. |
| `AR-AVDP-94` | The dominant task is actually `map-led-situation-monitor`. | Reject. |

### Selection rule

Select `airspace-volume-deconfliction-planner` if and only if `AR-AVDP-01` through `AR-AVDP-04` are evidenced and none of `AR-AVDP-90` through `AR-AVDP-94` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
volume-deconfliction → airspace-authority-time-horizon-and-rule-version → request-register → selected-operation-lateral-polygon-altitude-floor-ceiling-and-time-interval → true-4d-volume-solid ↔ altitude-time-slice-projections ↔ pairwise-space-time-intersection-matrix → uncertainty-and-buffer-envelope → shift-resize-reroute-counterfactuals → stakeholder-coordination-and-approval → activation-amendment-or-cancellation → actual-use-containment-and-vacated-time → explicit-volume-release-and-lineage
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `volume-deconfliction` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `airspace-authority-time-horizon-and-rule-version` | Owns Airspace Authority Time Horizon And Rule Version evidence or action and preserves its declared relationship to the current selection. |
| `request-register` | Owns Request Register evidence or action and preserves its declared relationship to the current selection. |
| `selected-operation-lateral-polygon-altitude-floor-ceiling-and-time-interval` | Owns Selected Operation Lateral Polygon Altitude Floor Ceiling And Time Interval evidence or action and preserves its declared relationship to the current selection. |
| `true-4d-volume-solid` | Owns True 4d Volume Solid evidence or action and preserves its declared relationship to the current selection. |
| `altitude-time-slice-projections` | Owns Altitude Time Slice Projections evidence or action and preserves its declared relationship to the current selection. |
| `pairwise-space-time-intersection-matrix` | Owns Pairwise Space Time Intersection Matrix evidence or action and preserves its declared relationship to the current selection. |
| `uncertainty-and-buffer-envelope` | Owns Uncertainty And Buffer Envelope evidence or action and preserves its declared relationship to the current selection. |
| `shift-resize-reroute-counterfactuals` | Owns Shift Resize Reroute Counterfactuals evidence or action and preserves its declared relationship to the current selection. |
| `stakeholder-coordination-and-approval` | Owns Stakeholder Coordination And Approval evidence or action and preserves its declared relationship to the current selection. |
| `activation-amendment-or-cancellation` | Owns Activation Amendment Or Cancellation evidence or action and preserves its declared relationship to the current selection. |
| `actual-use-containment-and-vacated-time` | Owns Actual Use Containment And Vacated Time evidence or action and preserves its declared relationship to the current selection. |
| `explicit-volume-release-and-lineage` | Owns Explicit Volume Release And Lineage evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Request register, 4D slice projections, pairwise intersection matrix, buffer evidence, counterfactuals and coordination state remain visible; only the bounded spatial slice owns pan/zoom.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `pairwise-space-time-intersection-matrix` owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Selected conflict pair and active time/altitude slice stay pinned; spatial slices and matrix/counterfactual evidence alternate while approval state persists.
- **Navigation replacement:** Named evidence views replace displaced regions and preserve exact selection and trigger.
- **Sticky boundary:** The current verdict persists only while its target remains visible and returns to flow at short height.
- **Overflow owner:** The wide bounded owner remains local; alternate evidence views create no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Request → lateral polygon → altitude floor/ceiling → activation interval → exact conflicting 4D solid and overlap interval → uncertainty buffer → shift/resize/reroute → stakeholder decision → activate → actual containment/vacated evidence → authoritative release; an ordered geometry ledger replaces the map.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The bounded visual has a textual ordered equivalent as the primary compact representation.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `volume-deconfliction → airspace-authority-time-horizon-and-rule-version → request-register → selected-operation-lateral-polygon-altitude-floor-ceiling-and-time-interval → true-4d-volume-solid ↔ altitude-time-slice-projections ↔ pairwise-space-time-intersection-matrix → uncertainty-and-buffer-envelope → shift-resize-reroute-counterfactuals → stakeholder-coordination-and-approval → activation-amendment-or-cancellation → actual-use-containment-and-vacated-time → explicit-volume-release-and-lineage`.
- Long labels, translation, zoom, and enlarged controls trigger the same named topology changes.
- CSS never reorders semantics; ordinary content creates no page-level horizontal scroll.
- Hidden detail always has an explicit accessible reveal path.

### Interaction parity

- Every wide selection, edit, action, explanation, retry, and recovery remains reachable at intermediate and compact.
- Topology changes preserve the exact selected object, order, data state, pending result, and error context.
- Pointer actions have keyboard and single-pointer non-drag equivalents when movement is involved.
- Dynamic updates announce one contextual status without stealing focus; color is never the only signal.
- A modal receives and contains focus, supports Escape or Cancel, and returns focus to the exact trigger.

## State obligations

Task-specific states: Request draft/submitted/changed, geometry invalid/valid, interval proposed/coordinated/active/released, buffer complete/insufficient, intersection none/potential/confirmed, counterfactual infeasible/clear/new-conflict, stakeholder pending/accepted/rejected, activation scheduled/live/aborted, actual containment nominal/deviating and amendment superseded.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `airspace-authority-time-horizon-and-rule-version` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `request-register` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `request-register` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `actual-use-containment-and-vacated-time` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `explicit-volume-release-and-lineage` | Explain the restriction without implying hidden evidence is absent and provide a safe exit. |
| Pending | `explicit-volume-release-and-lineage` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `explicit-volume-release-and-lineage` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `airspace-authority-time-horizon-and-rule-version` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `explicit-volume-release-and-lineage` | Move focus only to a modal or required error summary, then return it to the exact trigger. |
| Responsive presentation | `volume-deconfliction` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Allocate temporary four-dimensional airspace volumes by detecting space-time intersections under uncertainty, negotiating shift, resize or reroute counterfactuals and activating a non-overlapping coordinated volume set.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject `orbital-conjunction-assessment-workbench`; this is `AR-AVDP-90` evidence and must route to an adjacent archetype.
- Reject `air-traffic-separation-resolution-console`; this is `AR-AVDP-91` evidence and must route to an adjacent archetype.
- Reject `capacity-allocation-overview`; this is `AR-AVDP-92` evidence and must route to an adjacent archetype.
- Reject `calendar-resource-scheduler`; this is `AR-AVDP-93` evidence and must route to an adjacent archetype.
- Reject `map-led-situation-monitor`; this is `AR-AVDP-94` evidence and must route to an adjacent archetype.

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
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Accessibility obligations for reflow, focus, status, and interaction parity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EASA U-space rules for four-dimensional volumes](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-u-space?erules-id=ERULES-1963177438-21046) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EUROCONTROL airspace-management service](https://www.eurocontrol.int/service/airspace-management) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "airspace-volume-deconfliction-planner",
  "situationCodes": [
    "<matched AR-AVDP-* codes>"
  ],
  "searchAliases": [
    "airspace volume deconfliction",
    "airspace volume deconfliction workspace",
    "airspace volume deconfliction control"
  ],
  "dominantTask": "Allocate temporary four-dimensional airspace volumes by detecting space-time intersections under uncertainty, negotiating shift, resize or reroute counterfactuals and activating a non-overlapping coordinated volume set.",
  "regions": [
    "volume-deconfliction",
    "airspace-authority-time-horizon-and-rule-version",
    "request-register",
    "selected-operation-lateral-polygon-altitude-floor-ceiling-and-time-interval",
    "true-4d-volume-solid",
    "altitude-time-slice-projections",
    "pairwise-space-time-intersection-matrix",
    "uncertainty-and-buffer-envelope",
    "shift-resize-reroute-counterfactuals",
    "stakeholder-coordination-and-approval",
    "activation-amendment-or-cancellation",
    "actual-use-containment-and-vacated-time",
    "explicit-volume-release-and-lineage"
  ],
  "regionRelationships": [
    "a 2D map overlap or calendar overlap is insufficient, and reserved capacity stays occupied until actual use ends and authority records release."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "volume-deconfliction -> airspace-authority-time-horizon-and-rule-version -> request-register -> selected-operation-lateral-polygon-altitude-floor-ceiling-and-time-interval -> true-4d-volume-solid -> altitude-time-slice-projections -> pairwise-space-time-intersection-matrix -> uncertainty-and-buffer-envelope -> shift-resize-reroute-counterfactuals -> stakeholder-coordination-and-approval -> activation-amendment-or-cancellation -> actual-use-containment-and-vacated-time -> explicit-volume-release-and-lineage",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "pairwise-space-time-intersection-matrix",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Request draft/submitted/changed",
    "geometry invalid/valid",
    "interval proposed/coordinated/active/released",
    "buffer complete/insufficient",
    "intersection none/potential/confirmed",
    "counterfactual infeasible/clear/new-conflict",
    "stakeholder pending/accepted/rejected",
    "activation scheduled/live/aborted",
    "actual containment nominal/deviating",
    "amendment superseded"
  ],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": [
    "<product meaning and semantic owners>"
  ],
  "principlesHandoff": [
    "<unresolved geometry only>"
  ],
  "confidence": "<high | medium | low>",
  "evidence": [
    "<business or current-source facts>",
    "<official task research>",
    "<accessibility research>"
  ]
}
```

