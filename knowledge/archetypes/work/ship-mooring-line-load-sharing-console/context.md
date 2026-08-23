# Ship mooring line load sharing console

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `ship-mooring-line-load-sharing-console` |
| Family | Work |
| Dominant task | Maintain one ship's safe berth restraint as wind, current and water level change by interpreting every mooring line's geometry and live load, predicting redistribution after a line or winch limit is lost and issuing safe tending or unmooring actions. |
| Search aliases | `ship mooring line load sharing`, `ship mooring line load workspace`, `mooring line load sharing control` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Maintain one ship's safe berth restraint as wind, current and water level change by interpreting every mooring line's geometry and live load, predicting redistribution after a line or winch limit is lost and issuing safe tending or unmooring actions.
- total restraint and failure redistribution are derived from the whole physical line system, never from one alarm in isolation.
- Every required region retains a separate owner and the same selected context.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-SMLLSC-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-SMLLSC-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-SMLLSC-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-SMLLSC-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-SMLLSC-90` | The dominant task is actually `live-operations-command-center`. | Reject. |
| `AR-SMLLSC-91` | The dominant task is actually `vessel-damage-stability-response-workbench`. | Reject. |
| `AR-SMLLSC-92` | The dominant task is actually `finite-element-mesh-convergence-workbench`. | Reject. |
| `AR-SMLLSC-93` | The dominant task is actually `risk-bow-tie-control-overview`. | Reject. |

### Selection rule

Select `ship-mooring-line-load-sharing-console` if and only if `AR-SMLLSC-01` through `AR-SMLLSC-04` are evidenced and none of `AR-SMLLSC-90` through `AR-SMLLSC-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
mooring-load-control → vessel-berth-environment-and-mooring-plan → ship-and-shore-fairlead-bollard-winch-geometry → line-identity-material-condition-and-working-load-limit → measured-line-tension-lead-angle-and-winch-brake-margin → vessel-force-and-moment-restraint-equilibrium ↔ per-line-utilization-slack-and-chafe-ledger → selected-line-failure-and-load-redistribution-cascade → snap-back-zone-and-personnel-clearance → tend-heave-pay-out-suspend-or-unmoor-command → acknowledgement-and-post-action-equilibrium → secured-hold-or-emergency-release-log
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `mooring-load-control` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `vessel-berth-environment-and-mooring-plan` | Owns Vessel Berth Environment And Mooring Plan evidence or action and preserves its declared relationship to the current selection. |
| `ship-and-shore-fairlead-bollard-winch-geometry` | Owns Ship And Shore Fairlead Bollard Winch Geometry evidence or action and preserves its declared relationship to the current selection. |
| `line-identity-material-condition-and-working-load-limit` | Owns Line Identity Material Condition And Working Load Limit evidence or action and preserves its declared relationship to the current selection. |
| `measured-line-tension-lead-angle-and-winch-brake-margin` | Owns Measured Line Tension Lead Angle And Winch Brake Margin evidence or action and preserves its declared relationship to the current selection. |
| `vessel-force-and-moment-restraint-equilibrium` | Owns Vessel Force And Moment Restraint Equilibrium evidence or action and preserves its declared relationship to the current selection. |
| `per-line-utilization-slack-and-chafe-ledger` | Owns Per Line Utilization Slack And Chafe Ledger evidence or action and preserves its declared relationship to the current selection. |
| `selected-line-failure-and-load-redistribution-cascade` | Owns Selected Line Failure And Load Redistribution Cascade evidence or action and preserves its declared relationship to the current selection. |
| `snap-back-zone-and-personnel-clearance` | Owns Snap Back Zone And Personnel Clearance evidence or action and preserves its declared relationship to the current selection. |
| `tend-heave-pay-out-suspend-or-unmoor-command` | Owns Tend Heave Pay Out Suspend Or Unmoor Command evidence or action and preserves its declared relationship to the current selection. |
| `acknowledgement-and-post-action-equilibrium` | Owns Acknowledgement And Post Action Equilibrium evidence or action and preserves its declared relationship to the current selection. |
| `secured-hold-or-emergency-release-log` | Owns Secured Hold Or Emergency Release Log evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Berth/vessel geometry, every identified line and winch, environmental force, load-sharing equilibrium, selected failure cascade, snap-back clearance and command acknowledgement remain visible together; only the bounded mooring plan owns pan/zoom.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `vessel-berth-environment-and-mooring-plan` owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The critical line and total restraint equilibrium stay pinned; physical lead/equipment evidence and redistribution/action evidence alternate while the active command persists until acknowledged and measured.
- **Navigation replacement:** Named evidence views replace displaced regions and preserve exact selection and trigger.
- **Sticky boundary:** The current verdict persists only while its target remains visible and returns to flow at short height.
- **Overflow owner:** The wide bounded owner remains local; alternate evidence views create no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Critical named line → fairlead/bollard/winch lead → live tension versus working-load and brake margins → whole-system restraint → redistribute that line's loss → clear snap-back personnel zone → tend/pay out/heave or unmoor → acknowledgement → measured post-action equilibrium; a numbered line list replaces the berth diagram without page-level horizontal scroll.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The bounded visual has a textual ordered equivalent as the primary compact representation.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `mooring-load-control → vessel-berth-environment-and-mooring-plan → ship-and-shore-fairlead-bollard-winch-geometry → line-identity-material-condition-and-working-load-limit → measured-line-tension-lead-angle-and-winch-brake-margin → vessel-force-and-moment-restraint-equilibrium ↔ per-line-utilization-slack-and-chafe-ledger → selected-line-failure-and-load-redistribution-cascade → snap-back-zone-and-personnel-clearance → tend-heave-pay-out-suspend-or-unmoor-command → acknowledgement-and-post-action-equilibrium → secured-hold-or-emergency-release-log`.
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

Task-specific states: Environment live/stale/escalating, line slack/loaded/near-limit/over-limit/damaged, lead clear/chafing/invalid, winch brake margin adequate/marginal/exceeded, restraint balanced/drifting/insufficient, failure scenario contained/cascading, snap-back zone clear/occupied/unknown, command proposed/authorized/issued/acknowledged/failed, post-action improved/worsened and berth secured/suspended/emergency-unmooring.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `vessel-berth-environment-and-mooring-plan` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `ship-and-shore-fairlead-bollard-winch-geometry` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `ship-and-shore-fairlead-bollard-winch-geometry` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `acknowledgement-and-post-action-equilibrium` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `secured-hold-or-emergency-release-log` | Explain the restriction without implying hidden evidence is absent and provide a safe exit. |
| Pending | `secured-hold-or-emergency-release-log` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `secured-hold-or-emergency-release-log` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `vessel-berth-environment-and-mooring-plan` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `secured-hold-or-emergency-release-log` | Move focus only to a modal or required error summary, then return it to the exact trigger. |
| Responsive presentation | `mooring-load-control` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Maintain one ship's safe berth restraint as wind, current and water level change by interpreting every mooring line's geometry and live load, predicting redistribution after a line or winch limit is lost and issuing safe tending or unmooring actions.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject `live-operations-command-center`; this is `AR-SMLLSC-90` evidence and must route to an adjacent archetype.
- Reject `vessel-damage-stability-response-workbench`; this is `AR-SMLLSC-91` evidence and must route to an adjacent archetype.
- Reject `finite-element-mesh-convergence-workbench`; this is `AR-SMLLSC-92` evidence and must route to an adjacent archetype.
- Reject `risk-bow-tie-control-overview`; this is `AR-SMLLSC-93` evidence and must route to an adjacent archetype.

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
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Accessibility obligations for reflow, focus, status, and interaction parity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IMO Safe Mooring authority and current SOLAS guidance](https://www.imo.org/en/ourwork/safety/pages/safemooring.aspx) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [OCIMF Mooring Equipment Guidelines, Fourth Edition](https://www.ocimf.org/publications/books/) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "ship-mooring-line-load-sharing-console",
  "situationCodes": [
    "<matched AR-SMLLSC-* codes>"
  ],
  "searchAliases": [
    "ship mooring line load sharing",
    "ship mooring line load workspace",
    "mooring line load sharing control"
  ],
  "dominantTask": "Maintain one ship's safe berth restraint as wind, current and water level change by interpreting every mooring line's geometry and live load, predicting redistribution after a line or winch limit is lost and issuing safe tending or unmooring actions.",
  "regions": [
    "mooring-load-control",
    "vessel-berth-environment-and-mooring-plan",
    "ship-and-shore-fairlead-bollard-winch-geometry",
    "line-identity-material-condition-and-working-load-limit",
    "measured-line-tension-lead-angle-and-winch-brake-margin",
    "vessel-force-and-moment-restraint-equilibrium",
    "per-line-utilization-slack-and-chafe-ledger",
    "selected-line-failure-and-load-redistribution-cascade",
    "snap-back-zone-and-personnel-clearance",
    "tend-heave-pay-out-suspend-or-unmoor-command",
    "acknowledgement-and-post-action-equilibrium",
    "secured-hold-or-emergency-release-log"
  ],
  "regionRelationships": [
    "total restraint and failure redistribution are derived from the whole physical line system, never from one alarm in isolation."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "mooring-load-control -> vessel-berth-environment-and-mooring-plan -> ship-and-shore-fairlead-bollard-winch-geometry -> line-identity-material-condition-and-working-load-limit -> measured-line-tension-lead-angle-and-winch-brake-margin -> vessel-force-and-moment-restraint-equilibrium -> per-line-utilization-slack-and-chafe-ledger -> selected-line-failure-and-load-redistribution-cascade -> snap-back-zone-and-personnel-clearance -> tend-heave-pay-out-suspend-or-unmoor-command -> acknowledgement-and-post-action-equilibrium -> secured-hold-or-emergency-release-log",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "vessel-berth-environment-and-mooring-plan",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Environment live/stale/escalating",
    "line slack/loaded/near-limit/over-limit/damaged",
    "lead clear/chafing/invalid",
    "winch brake margin adequate/marginal/exceeded",
    "restraint balanced/drifting/insufficient",
    "failure scenario contained/cascading",
    "snap-back zone clear/occupied/unknown",
    "command proposed/authorized/issued/acknowledged/failed",
    "post-action improved/worsened",
    "berth secured/suspended/emergency-unmooring"
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

