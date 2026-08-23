# Aircraft defect deferral disposition workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `aircraft-defect-deferral-disposition-workbench` |
| Family | Work |
| Dominant task | Disposition one aircraft discrepancy by establishing MEL applicability, evaluating interactions with other unserviceabilities, binding maintenance and operational procedures, starting the correct rectification interval and returning a controlled defer, repair or no-dispatch verdict. |
| Search aliases | `aircraft defect deferral disposition`, `aircraft defect deferral disposition workspace`, `aircraft defect deferral disposition control` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Disposition one aircraft discrepancy by establishing MEL applicability, evaluating interactions with other unserviceabilities, binding maintenance and operational procedures, starting the correct rectification interval and returning a controlled defer, repair or no-dispatch verdict.
- no generic defect category may replace the exact MEL branch, and neither procedure nor either signoff can stand in for its paired owner.
- Every required region retains a separate owner and the same selected context.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-ADDDW-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-ADDDW-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-ADDDW-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-ADDDW-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-ADDDW-90` | The dominant task is actually `stage-gated-process-record`. | Reject. |
| `AR-ADDDW-91` | The dominant task is actually `evidence-led-case-resolution-dossier`. | Reject. |
| `AR-ADDDW-92` | The dominant task is actually `permit-to-work-isolation-control-room`. | Reject. |
| `AR-ADDDW-93` | The dominant task is actually `flight-dispatch-release-workbench`. | Reject. |

### Selection rule

Select `aircraft-defect-deferral-disposition-workbench` if and only if `AR-ADDDW-01` through `AR-ADDDW-04` are evidenced and none of `AR-ADDDW-90` through `AR-ADDDW-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
defect-disposition → exact-aircraft-configuration-operation-and-mel-revision → discrepancy-facts-and-system-location → exact-mel-item-branch-condition-and-exception-proof ↔ all-concurrent-defects-and-combination-prohibition-register → branch-owned-rectification-category-start-event-and-expiry-clock → named-maintenance-procedure ↔ named-operational-procedure → placard-route-operation-and-special-approval-restrictions → independent-maintenance-signoff ↔ operational-control-signoff → controlled-deferral-rectification-or-no-dispatch-lineage
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `defect-disposition` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `exact-aircraft-configuration-operation-and-mel-revision` | Owns Exact Aircraft Configuration Operation And Mel Revision evidence or action and preserves its declared relationship to the current selection. |
| `discrepancy-facts-and-system-location` | Owns Discrepancy Facts And System Location evidence or action and preserves its declared relationship to the current selection. |
| `exact-mel-item-branch-condition-and-exception-proof` | Owns Exact Mel Item Branch Condition And Exception Proof evidence or action and preserves its declared relationship to the current selection. |
| `all-concurrent-defects-and-combination-prohibition-register` | Owns All Concurrent Defects And Combination Prohibition Register evidence or action and preserves its declared relationship to the current selection. |
| `branch-owned-rectification-category-start-event-and-expiry-clock` | Owns Branch Owned Rectification Category Start Event And Expiry Clock evidence or action and preserves its declared relationship to the current selection. |
| `named-maintenance-procedure` | Owns Named Maintenance Procedure evidence or action and preserves its declared relationship to the current selection. |
| `named-operational-procedure` | Owns Named Operational Procedure evidence or action and preserves its declared relationship to the current selection. |
| `placard-route-operation-and-special-approval-restrictions` | Owns Placard Route Operation And Special Approval Restrictions evidence or action and preserves its declared relationship to the current selection. |
| `independent-maintenance-signoff` | Owns Independent Maintenance Signoff evidence or action and preserves its declared relationship to the current selection. |
| `operational-control-signoff` | Owns Operational Control Signoff evidence or action and preserves its declared relationship to the current selection. |
| `controlled-deferral-rectification-or-no-dispatch-lineage` | Owns Controlled Deferral Rectification Or No Dispatch Lineage evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Discrepancy, MEL applicability, concurrent defects, expiry clock, procedure bundle, restrictions and both signoffs remain visible as one disposition surface.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `exact-aircraft-configuration-operation-and-mel-revision` owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Selected MEL branch and verdict stay primary; applicability/interactions and procedure/restriction evidence alternate while the expiry/signoff rail persists.
- **Navigation replacement:** Named evidence views replace displaced regions and preserve exact selection and trigger.
- **Sticky boundary:** The current verdict persists only while its target remains visible and returns to flow at short height.
- **Overflow owner:** The wide bounded owner remains local; alternate evidence views create no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Discrepancy → exact MEL item branch and every condition/exception → all concurrent defects → category, start event and expiry → named maintenance procedure → named operational procedure plus restrictions/placard → maintenance signoff → operational-control signoff → defer, repair or no-dispatch; the branch proof replaces a generic checklist.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The bounded visual has a textual ordered equivalent as the primary compact representation.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `defect-disposition → exact-aircraft-configuration-operation-and-mel-revision → discrepancy-facts-and-system-location → exact-mel-item-branch-condition-and-exception-proof ↔ all-concurrent-defects-and-combination-prohibition-register → branch-owned-rectification-category-start-event-and-expiry-clock → named-maintenance-procedure ↔ named-operational-procedure → placard-route-operation-and-special-approval-restrictions → independent-maintenance-signoff ↔ operational-control-signoff → controlled-deferral-rectification-or-no-dispatch-lineage`.
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

Task-specific states: MEL loading/current/superseded, discrepancy open/clarified, item applicable/not listed/not applicable, concurrent interaction clear/blocking, category assigned/unknown, interval active/near-expiry/expired, procedures incomplete/complete, placard pending/applied, restriction compatible/blocking, signoff pending/signed/rejected, defer active/rectified/extended with authority and aircraft dispatchable/not dispatchable.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `exact-aircraft-configuration-operation-and-mel-revision` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `discrepancy-facts-and-system-location` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `discrepancy-facts-and-system-location` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `operational-control-signoff` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `controlled-deferral-rectification-or-no-dispatch-lineage` | Explain the restriction without implying hidden evidence is absent and provide a safe exit. |
| Pending | `controlled-deferral-rectification-or-no-dispatch-lineage` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `controlled-deferral-rectification-or-no-dispatch-lineage` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `exact-aircraft-configuration-operation-and-mel-revision` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `controlled-deferral-rectification-or-no-dispatch-lineage` | Move focus only to a modal or required error summary, then return it to the exact trigger. |
| Responsive presentation | `defect-disposition` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Disposition one aircraft discrepancy by establishing MEL applicability, evaluating interactions with other unserviceabilities, binding maintenance and operational procedures, starting the correct rectification interval and returning a controlled defer, repair or no-dispatch verdict.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject `stage-gated-process-record`; this is `AR-ADDDW-90` evidence and must route to an adjacent archetype.
- Reject `evidence-led-case-resolution-dossier`; this is `AR-ADDDW-91` evidence and must route to an adjacent archetype.
- Reject `permit-to-work-isolation-control-room`; this is `AR-ADDDW-92` evidence and must route to an adjacent archetype.
- Reject `flight-dispatch-release-workbench`; this is `AR-ADDDW-93` evidence and must route to an adjacent archetype.

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
| [EASA Easy Access Rules for Air Operations — MEL](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-air-operations?erules-id=ERULES-1963177438-11920) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [FAA AC 120-125 — MEL Management Program](https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_120-125.pdf) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "aircraft-defect-deferral-disposition-workbench",
  "situationCodes": [
    "<matched AR-ADDDW-* codes>"
  ],
  "searchAliases": [
    "aircraft defect deferral disposition",
    "aircraft defect deferral disposition workspace",
    "aircraft defect deferral disposition control"
  ],
  "dominantTask": "Disposition one aircraft discrepancy by establishing MEL applicability, evaluating interactions with other unserviceabilities, binding maintenance and operational procedures, starting the correct rectification interval and returning a controlled defer, repair or no-dispatch verdict.",
  "regions": [
    "defect-disposition",
    "exact-aircraft-configuration-operation-and-mel-revision",
    "discrepancy-facts-and-system-location",
    "exact-mel-item-branch-condition-and-exception-proof",
    "all-concurrent-defects-and-combination-prohibition-register",
    "branch-owned-rectification-category-start-event-and-expiry-clock",
    "named-maintenance-procedure",
    "named-operational-procedure",
    "placard-route-operation-and-special-approval-restrictions",
    "independent-maintenance-signoff",
    "operational-control-signoff",
    "controlled-deferral-rectification-or-no-dispatch-lineage"
  ],
  "regionRelationships": [
    "no generic defect category may replace the exact MEL branch, and neither procedure nor either signoff can stand in for its paired owner."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "defect-disposition -> exact-aircraft-configuration-operation-and-mel-revision -> discrepancy-facts-and-system-location -> exact-mel-item-branch-condition-and-exception-proof -> all-concurrent-defects-and-combination-prohibition-register -> branch-owned-rectification-category-start-event-and-expiry-clock -> named-maintenance-procedure -> named-operational-procedure -> placard-route-operation-and-special-approval-restrictions -> independent-maintenance-signoff -> operational-control-signoff -> controlled-deferral-rectification-or-no-dispatch-lineage",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "exact-aircraft-configuration-operation-and-mel-revision",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "MEL loading/current/superseded",
    "discrepancy open/clarified",
    "item applicable/not listed/not applicable",
    "concurrent interaction clear/blocking",
    "category assigned/unknown",
    "interval active/near-expiry/expired",
    "procedures incomplete/complete",
    "placard pending/applied",
    "restriction compatible/blocking",
    "signoff pending/signed/rejected",
    "defer active/rectified/extended with authority",
    "aircraft dispatchable/not dispatchable"
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

