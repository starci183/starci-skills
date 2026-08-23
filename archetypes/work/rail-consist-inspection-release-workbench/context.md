# Rail consist inspection release workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `rail-consist-inspection-release-workbench` |
| Family | Work |
| Dominant task | Reconcile an ordered train consist, prove brake-test continuity, resolve car-specific defects and dangerous-goods placement constraints and issue a whole-train release or restriction with role signoffs. |
| Search aliases | `rail consist inspection release`, `rail consist inspection release workspace`, `rail consist inspection release control` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Reconcile an ordered train consist, prove brake-test continuity, resolve car-specific defects and dangerous-goods placement constraints and issue a whole-train release or restriction with role signoffs.
- moving, adding or removing any physical car invalidates affected coverage and placement proof until recomputed for the complete ordered train.
- Every required region retains a separate owner and the same selected context.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-RCIRW-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-RCIRW-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-RCIRW-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-RCIRW-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-RCIRW-90` | The dominant task is actually `stage-gated-process-record`. | Reject. |
| `AR-RCIRW-91` | The dominant task is actually `regulatory-filing-package-validator`. | Reject. |
| `AR-RCIRW-92` | The dominant task is actually `chain-of-custody-transfer-ledger`. | Reject. |
| `AR-RCIRW-93` | The dominant task is actually `permit-to-work-isolation-control-room`. | Reject. |

### Selection rule

Select `rail-consist-inspection-release-workbench` if and only if `AR-RCIRW-01` through `AR-RCIRW-04` are evidenced and none of `AR-RCIRW-90` through `AR-RCIRW-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
consist-release → train-identity-route-and-operating-rule-set → exact-ordered-physical-locomotive-and-car-chain → position-bound-car-identity-load-and-dangerous-goods-register → end-to-end-brake-pipe-and-tested-car-coverage-map ↔ car-defect-and-restriction-ledger → order-dependent-dangerous-goods-separation-and-placement-proof → reorder-couple-or-uncouple-change-impact → retest-and-continuous-brake-coverage-restoration → whole-train-readiness → independent-role-signoffs → one-global-release-restriction-or-rebuild-lineage
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `consist-release` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `train-identity-route-and-operating-rule-set` | Owns Train Identity Route And Operating Rule Set evidence or action and preserves its declared relationship to the current selection. |
| `exact-ordered-physical-locomotive-and-car-chain` | Owns Exact Ordered Physical Locomotive And Car Chain evidence or action and preserves its declared relationship to the current selection. |
| `position-bound-car-identity-load-and-dangerous-goods-register` | Owns Position Bound Car Identity Load And Dangerous Goods Register evidence or action and preserves its declared relationship to the current selection. |
| `end-to-end-brake-pipe-and-tested-car-coverage-map` | Owns End To End Brake Pipe And Tested Car Coverage Map evidence or action and preserves its declared relationship to the current selection. |
| `car-defect-and-restriction-ledger` | Owns Car Defect And Restriction Ledger evidence or action and preserves its declared relationship to the current selection. |
| `order-dependent-dangerous-goods-separation-and-placement-proof` | Owns Order Dependent Dangerous Goods Separation And Placement Proof evidence or action and preserves its declared relationship to the current selection. |
| `reorder-couple-or-uncouple-change-impact` | Owns Reorder Couple Or Uncouple Change Impact evidence or action and preserves its declared relationship to the current selection. |
| `retest-and-continuous-brake-coverage-restoration` | Owns Retest And Continuous Brake Coverage Restoration evidence or action and preserves its declared relationship to the current selection. |
| `whole-train-readiness` | Owns Whole Train Readiness evidence or action and preserves its declared relationship to the current selection. |
| `independent-role-signoffs` | Owns Independent Role Signoffs evidence or action and preserves its declared relationship to the current selection. |
| `one-global-release-restriction-or-rebuild-lineage` | Owns One Global Release Restriction Or Rebuild Lineage evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Ordered consist, selected-car facts, brake coverage, defects/restrictions, dangerous-goods placement and global readiness/signoffs remain visible; only the consist strip owns bounded longitudinal overflow.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `end-to-end-brake-pipe-and-tested-car-coverage-map` owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Selected car position and whole-train readiness stay pinned; consist/brake evidence and defect/placement evidence alternate while signoff state persists.
- **Navigation replacement:** Named evidence views replace displaced regions and preserve exact selection and trigger.
- **Sticky boundary:** The current verdict persists only while its target remains visible and returns to flow at short height.
- **Overflow owner:** The wide bounded owner remains local; alternate evidence views create no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Train identity → numbered locomotive/car chain → selected physical car and position → continuous brake-test coverage boundary → defect/restriction → order-dependent dangerous-goods placement → reorder impact and required retest → whole-train readiness → role signoffs → one global release/restrict/rebuild verdict; numbered positions replace the consist diagram.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The bounded visual has a textual ordered equivalent as the primary compact representation.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `consist-release → train-identity-route-and-operating-rule-set → exact-ordered-physical-locomotive-and-car-chain → position-bound-car-identity-load-and-dangerous-goods-register → end-to-end-brake-pipe-and-tested-car-coverage-map ↔ car-defect-and-restriction-ledger → order-dependent-dangerous-goods-separation-and-placement-proof → reorder-couple-or-uncouple-change-impact → retest-and-continuous-brake-coverage-restoration → whole-train-readiness → independent-role-signoffs → one-global-release-restriction-or-rebuild-lineage`.
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

Task-specific states: Consist loading/reconciled/mismatched, car identity verified/unknown/duplicate, position planned/actual/moved, brake test not-run/partial/passed/failed/expired, defect open/deferred/repaired, restriction compatible/blocking, dangerous-goods document missing/valid, placement pass/fail, readiness incomplete/conditional/ready, signoff pending/signed/rejected and release active/revoked/superseded.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `train-identity-route-and-operating-rule-set` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `exact-ordered-physical-locomotive-and-car-chain` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `exact-ordered-physical-locomotive-and-car-chain` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `independent-role-signoffs` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `one-global-release-restriction-or-rebuild-lineage` | Explain the restriction without implying hidden evidence is absent and provide a safe exit. |
| Pending | `one-global-release-restriction-or-rebuild-lineage` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `one-global-release-restriction-or-rebuild-lineage` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `train-identity-route-and-operating-rule-set` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `one-global-release-restriction-or-rebuild-lineage` | Move focus only to a modal or required error summary, then return it to the exact trigger. |
| Responsive presentation | `consist-release` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Reconcile an ordered train consist, prove brake-test continuity, resolve car-specific defects and dangerous-goods placement constraints and issue a whole-train release or restriction with role signoffs.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject `stage-gated-process-record`; this is `AR-RCIRW-90` evidence and must route to an adjacent archetype.
- Reject `regulatory-filing-package-validator`; this is `AR-RCIRW-91` evidence and must route to an adjacent archetype.
- Reject `chain-of-custody-transfer-ledger`; this is `AR-RCIRW-92` evidence and must route to an adjacent archetype.
- Reject `permit-to-work-isolation-control-room`; this is `AR-RCIRW-93` evidence and must route to an adjacent archetype.

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
| [Federal Railroad Administration hazardous-materials and consist information](https://railroads.fra.dot.gov/railroad-safety/divisions/hazardous-materials/hazardous-materials) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [ERA Operation and Traffic Management TSI](https://www.era.europa.eu/domains/technical-specifications-interoperability/operation-and-traffic-management-tsi_en) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "rail-consist-inspection-release-workbench",
  "situationCodes": [
    "<matched AR-RCIRW-* codes>"
  ],
  "searchAliases": [
    "rail consist inspection release",
    "rail consist inspection release workspace",
    "rail consist inspection release control"
  ],
  "dominantTask": "Reconcile an ordered train consist, prove brake-test continuity, resolve car-specific defects and dangerous-goods placement constraints and issue a whole-train release or restriction with role signoffs.",
  "regions": [
    "consist-release",
    "train-identity-route-and-operating-rule-set",
    "exact-ordered-physical-locomotive-and-car-chain",
    "position-bound-car-identity-load-and-dangerous-goods-register",
    "end-to-end-brake-pipe-and-tested-car-coverage-map",
    "car-defect-and-restriction-ledger",
    "order-dependent-dangerous-goods-separation-and-placement-proof",
    "reorder-couple-or-uncouple-change-impact",
    "retest-and-continuous-brake-coverage-restoration",
    "whole-train-readiness",
    "independent-role-signoffs",
    "one-global-release-restriction-or-rebuild-lineage"
  ],
  "regionRelationships": [
    "moving, adding or removing any physical car invalidates affected coverage and placement proof until recomputed for the complete ordered train."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "consist-release -> train-identity-route-and-operating-rule-set -> exact-ordered-physical-locomotive-and-car-chain -> position-bound-car-identity-load-and-dangerous-goods-register -> end-to-end-brake-pipe-and-tested-car-coverage-map -> car-defect-and-restriction-ledger -> order-dependent-dangerous-goods-separation-and-placement-proof -> reorder-couple-or-uncouple-change-impact -> retest-and-continuous-brake-coverage-restoration -> whole-train-readiness -> independent-role-signoffs -> one-global-release-restriction-or-rebuild-lineage",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "end-to-end-brake-pipe-and-tested-car-coverage-map",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Consist loading/reconciled/mismatched",
    "car identity verified/unknown/duplicate",
    "position planned/actual/moved",
    "brake test not-run/partial/passed/failed/expired",
    "defect open/deferred/repaired",
    "restriction compatible/blocking",
    "dangerous-goods document missing/valid",
    "placement pass/fail",
    "readiness incomplete/conditional/ready",
    "signoff pending/signed/rejected",
    "release active/revoked/superseded"
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

