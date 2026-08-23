# Air traffic separation resolution console

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `air-traffic-separation-resolution-console` |
| Family | Work |
| Dominant task | Resolve one predicted loss of separation by understanding the encounter geometry and surrounding traffic, selecting a legal tactical clearance, coordinating ownership, issuing it, verifying pilot readback and observing conformance. |
| Search aliases | `air traffic separation resolution`, `air traffic separation resolution workspace`, `air traffic separation resolution control` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Resolve one predicted loss of separation by understanding the encounter geometry and surrounding traffic, selecting a legal tactical clearance, coordinating ownership, issuing it, verifying pilot readback and observing conformance.
- neither predicted geometry nor an issued clearance closes the encounter without a correct readback and observed two-flight conformance.
- Every required region retains a separate owner and the same selected context.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-ATSRC-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-ATSRC-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-ATSRC-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-ATSRC-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-ATSRC-90` | The dominant task is actually `live-operations-command-center`. | Reject. |
| `AR-ATSRC-91` | The dominant task is actually `map-led-situation-monitor`. | Reject. |
| `AR-ATSRC-92` | The dominant task is actually `orbital-conjunction-assessment-workbench`. | Reject. |
| `AR-ATSRC-93` | The dominant task is actually `flight-dispatch-release-workbench`. | Reject. |

### Selection rule

Select `air-traffic-separation-resolution-console` if and only if `AR-ATSRC-01` through `AR-ATSRC-04` are evidenced and none of `AR-ATSRC-90` through `AR-ATSRC-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
separation-console → sector-time-control-authority-and-rule-version → conflict-pair-queue → selected-two-flight-trajectory-projection ↔ both-flight-progress-strips → legally-applicable-separation-minimum-for-that-pair-and-flight-phases → surrounding-traffic-clearance-veto → legal-tactical-clearance → coordination-and-clearance-issuance → verbatim-pilot-readback-match → observed-track-conformance-to-clearance-and-minimum → resolved-or-reopened-log
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `separation-console` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `sector-time-control-authority-and-rule-version` | Owns Sector Time Control Authority And Rule Version evidence or action and preserves its declared relationship to the current selection. |
| `conflict-pair-queue` | Owns Conflict Pair Queue evidence or action and preserves its declared relationship to the current selection. |
| `selected-two-flight-trajectory-projection` | Owns Selected Two Flight Trajectory Projection evidence or action and preserves its declared relationship to the current selection. |
| `both-flight-progress-strips` | Owns Both Flight Progress Strips evidence or action and preserves its declared relationship to the current selection. |
| `legally-applicable-separation-minimum-for-that-pair-and-flight-phases` | Owns Legally Applicable Separation Minimum For That Pair And Flight Phases evidence or action and preserves its declared relationship to the current selection. |
| `surrounding-traffic-clearance-veto` | Owns Surrounding Traffic Clearance Veto evidence or action and preserves its declared relationship to the current selection. |
| `legal-tactical-clearance` | Owns Legal Tactical Clearance evidence or action and preserves its declared relationship to the current selection. |
| `coordination-and-clearance-issuance` | Owns Coordination And Clearance Issuance evidence or action and preserves its declared relationship to the current selection. |
| `verbatim-pilot-readback-match` | Owns Verbatim Pilot Readback Match evidence or action and preserves its declared relationship to the current selection. |
| `observed-track-conformance-to-clearance-and-minimum` | Owns Observed Track Conformance To Clearance And Minimum evidence or action and preserves its declared relationship to the current selection. |
| `resolved-or-reopened-log` | Owns Resolved Or Reopened Log evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Conflict queue, trajectory projection, both flight strips, minima/context traffic, candidate comparison and clearance/readback rail remain simultaneously visible; only the trajectory stage owns bounded pan/zoom.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `conflict-pair-queue` owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The selected conflict and clearance state remain fixed while trajectory, strips and context traffic become mutually exclusive evidence views; the issue/readback rail yields after acknowledgement.
- **Navigation replacement:** Named evidence views replace displaced regions and preserve exact selection and trigger.
- **Sticky boundary:** The current verdict persists only while its target remains visible and returns to flow at short height.
- **Overflow owner:** The wide bounded owner remains local; alternate evidence views create no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Two named flights → closest-approach facts → legally applicable pair minimum → context-traffic veto → legal clearance → coordination and issue → readback match → observed conformance against both clearance and minimum → resolve or reopen; an ordered encounter proof replaces the tactical plot without dropping either flight.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The bounded visual has a textual ordered equivalent as the primary compact representation.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `separation-console → sector-time-control-authority-and-rule-version → conflict-pair-queue → selected-two-flight-trajectory-projection ↔ both-flight-progress-strips → legally-applicable-separation-minimum-for-that-pair-and-flight-phases → surrounding-traffic-clearance-veto → legal-tactical-clearance → coordination-and-clearance-issuance → verbatim-pilot-readback-match → observed-track-conformance-to-clearance-and-minimum → resolved-or-reopened-log`.
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

Task-specific states: Track loading/live/stale/lost, predicted/near-term/actual separation breach, minima available/uncertain, context traffic clear/blocking, candidate safe/unsafe, coordination requested/accepted/rejected, clearance draft/issued, readback correct/incorrect/missing, conformance improving/diverging, resolved/reopened and control transferred.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `sector-time-control-authority-and-rule-version` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `conflict-pair-queue` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `conflict-pair-queue` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `observed-track-conformance-to-clearance-and-minimum` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `resolved-or-reopened-log` | Explain the restriction without implying hidden evidence is absent and provide a safe exit. |
| Pending | `resolved-or-reopened-log` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `resolved-or-reopened-log` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `sector-time-control-authority-and-rule-version` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `resolved-or-reopened-log` | Move focus only to a modal or required error summary, then return it to the exact trigger. |
| Responsive presentation | `separation-console` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Resolve one predicted loss of separation by understanding the encounter geometry and surrounding traffic, selecting a legal tactical clearance, coordinating ownership, issuing it, verifying pilot readback and observing conformance.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject `live-operations-command-center`; this is `AR-ATSRC-90` evidence and must route to an adjacent archetype.
- Reject `map-led-situation-monitor`; this is `AR-ATSRC-91` evidence and must route to an adjacent archetype.
- Reject `orbital-conjunction-assessment-workbench`; this is `AR-ATSRC-92` evidence and must route to an adjacent archetype.
- Reject `flight-dispatch-release-workbench`; this is `AR-ATSRC-93` evidence and must route to an adjacent archetype.

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
| [FAA Order JO 7110.65BB — Air Traffic Control](https://www.faa.gov/regulations_policies/orders_notices/index.cfm/go/document.information/documentID/1043461) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EUROCONTROL Medium-Term Conflict Detection specification](https://www.eurocontrol.int/publication/eurocontrol-specification-medium-term-conflict-detection-mtcd) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "air-traffic-separation-resolution-console",
  "situationCodes": [
    "<matched AR-ATSRC-* codes>"
  ],
  "searchAliases": [
    "air traffic separation resolution",
    "air traffic separation resolution workspace",
    "air traffic separation resolution control"
  ],
  "dominantTask": "Resolve one predicted loss of separation by understanding the encounter geometry and surrounding traffic, selecting a legal tactical clearance, coordinating ownership, issuing it, verifying pilot readback and observing conformance.",
  "regions": [
    "separation-console",
    "sector-time-control-authority-and-rule-version",
    "conflict-pair-queue",
    "selected-two-flight-trajectory-projection",
    "both-flight-progress-strips",
    "legally-applicable-separation-minimum-for-that-pair-and-flight-phases",
    "surrounding-traffic-clearance-veto",
    "legal-tactical-clearance",
    "coordination-and-clearance-issuance",
    "verbatim-pilot-readback-match",
    "observed-track-conformance-to-clearance-and-minimum",
    "resolved-or-reopened-log"
  ],
  "regionRelationships": [
    "neither predicted geometry nor an issued clearance closes the encounter without a correct readback and observed two-flight conformance."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "separation-console -> sector-time-control-authority-and-rule-version -> conflict-pair-queue -> selected-two-flight-trajectory-projection -> both-flight-progress-strips -> legally-applicable-separation-minimum-for-that-pair-and-flight-phases -> surrounding-traffic-clearance-veto -> legal-tactical-clearance -> coordination-and-clearance-issuance -> verbatim-pilot-readback-match -> observed-track-conformance-to-clearance-and-minimum -> resolved-or-reopened-log",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "conflict-pair-queue",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Track loading/live/stale/lost",
    "predicted/near-term/actual separation breach",
    "minima available/uncertain",
    "context traffic clear/blocking",
    "candidate safe/unsafe",
    "coordination requested/accepted/rejected",
    "clearance draft/issued",
    "readback correct/incorrect/missing",
    "conformance improving/diverging",
    "resolved/reopened",
    "control transferred"
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

