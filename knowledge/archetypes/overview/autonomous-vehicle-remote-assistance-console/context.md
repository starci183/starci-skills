# Autonomous vehicle remote assistance console

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `autonomous-vehicle-remote-assistance-console` |
| Family | Overview |
| Dominant task | Resolve an automated-driving-system help request by establishing the frozen vehicle state and operational-design-domain context, reviewing synchronized evidence, sending bounded strategic guidance and verifying whether the ADS safely resumes or enters a minimal-risk condition. |
| Search aliases | `autonomous vehicle remote assistance`, `autonomous vehicle remote assistance workspace`, `autonomous vehicle remote assistance control` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Resolve an automated-driving-system help request by establishing the frozen vehicle state and operational-design-domain context, reviewing synchronized evidence, sending bounded strategic guidance and verifying whether the ADS safely resumes or enters a minimal-risk condition.
- the ADS retains the dynamic driving task while the remote operator owns only a discrete, evidenced guidance transaction.
- Every required region retains a separate owner and the same selected context.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-AVRAC-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-AVRAC-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-AVRAC-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-AVRAC-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-AVRAC-90` | The dominant task is actually `live-support-console`. | Reject. |
| `AR-AVRAC-91` | The dominant task is actually `live-operations-command-center`. | Reject. |
| `AR-AVRAC-92` | The dominant task is actually `fleet-route-dispatch-planner`. | Reject. |
| `AR-AVRAC-93` | The dominant task is actually `canvas-inspector-studio`. | Reject. |

### Selection rule

Select `autonomous-vehicle-remote-assistance-console` if and only if `AR-AVRAC-01` through `AR-AVRAC-04` are evidenced and none of `AR-AVRAC-90` through `AR-AVRAC-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
remote-assistance → exception-queue → vehicle-identity-odd-and-ads-state → frozen-help-request-and-minimal-risk-state → synchronized-scene-evidence ↔ ads-proposed-strategic-options → operator-permitted-guidance-boundary → safety-policy-and-vulnerable-road-user-check → guidance-send → ads-accept-reject-execute → resume-minimal-risk-escalate-and-event-record
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `remote-assistance` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `exception-queue` | Owns Exception Queue evidence or action and preserves its declared relationship to the current selection. |
| `vehicle-identity-odd-and-ads-state` | Owns Vehicle Identity Odd And Ads State evidence or action and preserves its declared relationship to the current selection. |
| `frozen-help-request-and-minimal-risk-state` | Owns Frozen Help Request And Minimal Risk State evidence or action and preserves its declared relationship to the current selection. |
| `synchronized-scene-evidence` | Owns Synchronized Scene Evidence evidence or action and preserves its declared relationship to the current selection. |
| `ads-proposed-strategic-options` | Owns Ads Proposed Strategic Options evidence or action and preserves its declared relationship to the current selection. |
| `operator-permitted-guidance-boundary` | Owns Operator Permitted Guidance Boundary evidence or action and preserves its declared relationship to the current selection. |
| `safety-policy-and-vulnerable-road-user-check` | Owns Safety Policy And Vulnerable Road User Check evidence or action and preserves its declared relationship to the current selection. |
| `guidance-send` | Owns Guidance Send evidence or action and preserves its declared relationship to the current selection. |
| `ads-accept-reject-execute` | Owns Ads Accept Reject Execute evidence or action and preserves its declared relationship to the current selection. |
| `resume-minimal-risk-escalate-and-event-record` | Owns Resume Minimal Risk Escalate And Event Record evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Exception queue, selected vehicle/ODD state, synchronized scene evidence, ADS proposals, guidance boundary and execution acknowledgement stay visible; only the evidence viewport owns bounded pan/zoom.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `exception-queue` owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Vehicle state and help request remain pinned; scene evidence and strategic-option evidence alternate while guidance scope and minimal-risk status persist.
- **Navigation replacement:** Named evidence views replace displaced regions and preserve exact selection and trigger.
- **Sticky boundary:** The current verdict persists only while its target remains visible and returns to flow at short height.
- **Overflow owner:** The wide bounded owner remains local; alternate evidence views create no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Help request → frozen ADS/ODD state → scene facts → ADS options → permitted strategic guidance → vulnerable-road-user check → send → ADS accept/reject → resume or minimal-risk outcome; ordered evidence facts replace the miniature video wall.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The bounded visual has a textual ordered equivalent as the primary compact representation.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `remote-assistance → exception-queue → vehicle-identity-odd-and-ads-state → frozen-help-request-and-minimal-risk-state → synchronized-scene-evidence ↔ ads-proposed-strategic-options → operator-permitted-guidance-boundary → safety-policy-and-vulnerable-road-user-check → guidance-send → ads-accept-reject-execute → resume-minimal-risk-escalate-and-event-record`.
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

Task-specific states: Request new/triaged/claimed, telemetry live/stale/lost, scene evidence synchronized/lagging/incomplete, ADS engaged/degraded/stopped/minimal-risk, ODD inside/edge/outside, proposal available/unsafe/ambiguous, guidance draft/blocked/sent, ADS accepted/rejected/executing, vulnerable-road-user clear/uncertain/present, resume verified/failed and escalation transferred/acknowledged.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `exception-queue` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `vehicle-identity-odd-and-ads-state` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `vehicle-identity-odd-and-ads-state` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `ads-accept-reject-execute` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `resume-minimal-risk-escalate-and-event-record` | Explain the restriction without implying hidden evidence is absent and provide a safe exit. |
| Pending | `resume-minimal-risk-escalate-and-event-record` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `resume-minimal-risk-escalate-and-event-record` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `exception-queue` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `resume-minimal-risk-escalate-and-event-record` | Move focus only to a modal or required error summary, then return it to the exact trigger. |
| Responsive presentation | `remote-assistance` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Resolve an automated-driving-system help request by establishing the frozen vehicle state and operational-design-domain context, reviewing synchronized evidence, sending bounded strategic guidance and verifying whether the ADS safely resumes or enters a minimal-risk condition.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject `live-support-console`; this is `AR-AVRAC-90` evidence and must route to an adjacent archetype.
- Reject `live-operations-command-center`; this is `AR-AVRAC-91` evidence and must route to an adjacent archetype.
- Reject `fleet-route-dispatch-planner`; this is `AR-AVRAC-92` evidence and must route to an adjacent archetype.
- Reject `canvas-inspector-studio`; this is `AR-AVRAC-93` evidence and must route to an adjacent archetype.

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
| [UNECE remote-management terminology for automated driving](https://unece.org/sites/default/files/2025-09/Informal%20document-WP1-90-11rev1-e.pdf) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [UK Department for Transport automated-vehicle safety principles](https://www.gov.uk/government/consultations/automated-vehicles-statement-of-safety-principles/automated-vehicles-statement-of-safety-principles-consultation) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "autonomous-vehicle-remote-assistance-console",
  "situationCodes": [
    "<matched AR-AVRAC-* codes>"
  ],
  "searchAliases": [
    "autonomous vehicle remote assistance",
    "autonomous vehicle remote assistance workspace",
    "autonomous vehicle remote assistance control"
  ],
  "dominantTask": "Resolve an automated-driving-system help request by establishing the frozen vehicle state and operational-design-domain context, reviewing synchronized evidence, sending bounded strategic guidance and verifying whether the ADS safely resumes or enters a minimal-risk condition.",
  "regions": [
    "remote-assistance",
    "exception-queue",
    "vehicle-identity-odd-and-ads-state",
    "frozen-help-request-and-minimal-risk-state",
    "synchronized-scene-evidence",
    "ads-proposed-strategic-options",
    "operator-permitted-guidance-boundary",
    "safety-policy-and-vulnerable-road-user-check",
    "guidance-send",
    "ads-accept-reject-execute",
    "resume-minimal-risk-escalate-and-event-record"
  ],
  "regionRelationships": [
    "the ADS retains the dynamic driving task while the remote operator owns only a discrete, evidenced guidance transaction."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "remote-assistance -> exception-queue -> vehicle-identity-odd-and-ads-state -> frozen-help-request-and-minimal-risk-state -> synchronized-scene-evidence -> ads-proposed-strategic-options -> operator-permitted-guidance-boundary -> safety-policy-and-vulnerable-road-user-check -> guidance-send -> ads-accept-reject-execute -> resume-minimal-risk-escalate-and-event-record",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "exception-queue",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Request new/triaged/claimed",
    "telemetry live/stale/lost",
    "scene evidence synchronized/lagging/incomplete",
    "ADS engaged/degraded/stopped/minimal-risk",
    "ODD inside/edge/outside",
    "proposal available/unsafe/ambiguous",
    "guidance draft/blocked/sent",
    "ADS accepted/rejected/executing",
    "vulnerable-road-user clear/uncertain/present",
    "resume verified/failed",
    "escalation transferred/acknowledged"
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

