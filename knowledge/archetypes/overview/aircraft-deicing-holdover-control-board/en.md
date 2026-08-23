# Aircraft deicing holdover control board

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `aircraft-deicing-holdover-control-board` |
| Family | Overview |
| Dominant task | Control aircraft ground deicing by recording zone-complete treatment, establishing the final anti-icing start and treatment code, tracking weather-sensitive holdover allowance through taxi and releasing, reinspecting or retreating before takeoff. |
| Search aliases | `aircraft deicing holdover control`, `aircraft deicing holdover control workspace`, `aircraft deicing holdover control control` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Control aircraft ground deicing by recording zone-complete treatment, establishing the final anti-icing start and treatment code, tracking weather-sensitive holdover allowance through taxi and releasing, reinspecting or retreating before takeoff.
- physical treatment completion, current precipitation/fluid limits and the takeoff sequence jointly determine protection validity.
- Every required region retains a separate owner and the same selected context.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-ADHCB-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-ADHCB-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-ADHCB-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-ADHCB-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-ADHCB-90` | The dominant task is actually `stage-gated-process-record`. | Reject. |
| `AR-ADHCB-91` | The dominant task is actually `permit-to-work-isolation-control-room`. | Reject. |
| `AR-ADHCB-92` | The dominant task is actually `timeline-status-monitor`. | Reject. |
| `AR-ADHCB-93` | The dominant task is actually `appointment-booking-flow`. | Reject. |

### Selection rule

Select `aircraft-deicing-holdover-control-board` if and only if `AR-ADHCB-01` through `AR-ADHCB-04` are evidenced and none of `AR-ADHCB-90` through `AR-ADHCB-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
deicing-control → winter-program-fluid-and-weather-authority → aircraft-treatment-queue → selected-aircraft-critical-surface-and-treatment-plan → zone-by-zone-application-record → anti-icing-code-and-hot-start → dynamic-hot-allowance-clock ↔ taxi-takeoff-sequence → pre-takeoff-contamination-check → release-reinspect-or-retreat → treatment-and-expiry-audit
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `deicing-control` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `winter-program-fluid-and-weather-authority` | Owns Winter Program Fluid And Weather Authority evidence or action and preserves its declared relationship to the current selection. |
| `aircraft-treatment-queue` | Owns Aircraft Treatment Queue evidence or action and preserves its declared relationship to the current selection. |
| `selected-aircraft-critical-surface-and-treatment-plan` | Owns Selected Aircraft Critical Surface And Treatment Plan evidence or action and preserves its declared relationship to the current selection. |
| `zone-by-zone-application-record` | Owns Zone By Zone Application Record evidence or action and preserves its declared relationship to the current selection. |
| `anti-icing-code-and-hot-start` | Owns Anti Icing Code And Hot Start evidence or action and preserves its declared relationship to the current selection. |
| `dynamic-hot-allowance-clock` | Owns Dynamic Hot Allowance Clock evidence or action and preserves its declared relationship to the current selection. |
| `taxi-takeoff-sequence` | Owns Taxi Takeoff Sequence evidence or action and preserves its declared relationship to the current selection. |
| `pre-takeoff-contamination-check` | Owns Pre Takeoff Contamination Check evidence or action and preserves its declared relationship to the current selection. |
| `release-reinspect-or-retreat` | Owns Release Reinspect Or Retreat evidence or action and preserves its declared relationship to the current selection. |
| `treatment-and-expiry-audit` | Owns Treatment And Expiry Audit evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Treatment queue, aircraft zone record, live weather/fluid authority, holdover range, taxi/takeoff sequence and release decision remain visible; the queue alone owns bounded vertical density.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `aircraft-treatment-queue` owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Selected aircraft, treatment code and remaining allowance stay pinned; zone evidence and taxi/weather evidence alternate while the release gate remains adjacent.
- **Navigation replacement:** Named evidence views replace displaced regions and preserve exact selection and trigger.
- **Sticky boundary:** The current verdict persists only while its target remains visible and returns to flow at short height.
- **Overflow owner:** The wide bounded owner remains local; alternate evidence views create no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Aircraft → critical-surface zones → treatment completion → anti-icing start/code → current weather and holdover range → taxi delay → contamination check → release/reinspect/retreat; a time-stamped zone ledger replaces the wide control board.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The bounded visual has a textual ordered equivalent as the primary compact representation.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `deicing-control → winter-program-fluid-and-weather-authority → aircraft-treatment-queue → selected-aircraft-critical-surface-and-treatment-plan → zone-by-zone-application-record → anti-icing-code-and-hot-start → dynamic-hot-allowance-clock ↔ taxi-takeoff-sequence → pre-takeoff-contamination-check → release-reinspect-or-retreat → treatment-and-expiry-audit`.
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

Task-specific states: Weather feed live/stale/changed-category, fluid table current/superseded, zone untreated/in-progress/complete/recontaminated, treatment code incomplete/valid, holdover not-started/active/near-limit/expired/indeterminate, taxi sequence on-time/delayed, check not-required/due/passed/failed, release blocked/granted/revoked, retreat queued/in-progress/complete and audit record reconciled.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `winter-program-fluid-and-weather-authority` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `aircraft-treatment-queue` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `aircraft-treatment-queue` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `release-reinspect-or-retreat` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `treatment-and-expiry-audit` | Explain the restriction without implying hidden evidence is absent and provide a safe exit. |
| Pending | `treatment-and-expiry-audit` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `treatment-and-expiry-audit` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `winter-program-fluid-and-weather-authority` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `treatment-and-expiry-audit` | Move focus only to a modal or required error summary, then return it to the exact trigger. |
| Responsive presentation | `deicing-control` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Control aircraft ground deicing by recording zone-complete treatment, establishing the final anti-icing start and treatment code, tracking weather-sensitive holdover allowance through taxi and releasing, reinspecting or retreating before takeoff.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject `stage-gated-process-record`; this is `AR-ADHCB-90` evidence and must route to an adjacent archetype.
- Reject `permit-to-work-isolation-control-room`; this is `AR-ADHCB-91` evidence and must route to an adjacent archetype.
- Reject `timeline-status-monitor`; this is `AR-ADHCB-92` evidence and must route to an adjacent archetype.
- Reject `appointment-booking-flow`; this is `AR-ADHCB-93` evidence and must route to an adjacent archetype.

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
| [Transport Canada current holdover-time guidelines](https://tc.canada.ca/en/aviation/general-operating-flight-rules/holdover-time-hot-guidelines-icing-anti-icing-aircraft) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EASA ground-handling deicing rules](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-ground-handling?erules-id=ERULES-1963177438-23680) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "aircraft-deicing-holdover-control-board",
  "situationCodes": [
    "<matched AR-ADHCB-* codes>"
  ],
  "searchAliases": [
    "aircraft deicing holdover control",
    "aircraft deicing holdover control workspace",
    "aircraft deicing holdover control control"
  ],
  "dominantTask": "Control aircraft ground deicing by recording zone-complete treatment, establishing the final anti-icing start and treatment code, tracking weather-sensitive holdover allowance through taxi and releasing, reinspecting or retreating before takeoff.",
  "regions": [
    "deicing-control",
    "winter-program-fluid-and-weather-authority",
    "aircraft-treatment-queue",
    "selected-aircraft-critical-surface-and-treatment-plan",
    "zone-by-zone-application-record",
    "anti-icing-code-and-hot-start",
    "dynamic-hot-allowance-clock",
    "taxi-takeoff-sequence",
    "pre-takeoff-contamination-check",
    "release-reinspect-or-retreat",
    "treatment-and-expiry-audit"
  ],
  "regionRelationships": [
    "physical treatment completion, current precipitation/fluid limits and the takeoff sequence jointly determine protection validity."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "deicing-control -> winter-program-fluid-and-weather-authority -> aircraft-treatment-queue -> selected-aircraft-critical-surface-and-treatment-plan -> zone-by-zone-application-record -> anti-icing-code-and-hot-start -> dynamic-hot-allowance-clock -> taxi-takeoff-sequence -> pre-takeoff-contamination-check -> release-reinspect-or-retreat -> treatment-and-expiry-audit",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "aircraft-treatment-queue",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Weather feed live/stale/changed-category",
    "fluid table current/superseded",
    "zone untreated/in-progress/complete/recontaminated",
    "treatment code incomplete/valid",
    "holdover not-started/active/near-limit/expired/indeterminate",
    "taxi sequence on-time/delayed",
    "check not-required/due/passed/failed",
    "release blocked/granted/revoked",
    "retreat queued/in-progress/complete",
    "audit record reconciled"
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

