# Progressive rollout gate console

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `progressive-rollout-gate-console` |
| Family | Flow |
| Dominant task | Shift exposure from an old version to a new version across cohorts only when live guardrails pass, with deterministic promotion and rollback. |
| Search aliases | `canary rollout gate`, `cohort exposure console`, `progressive delivery` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Shift exposure from an old version to a new version across cohorts only when live guardrails pass, with deterministic promotion and rollback.
- Exposure, treatment and control cohorts, and live guardrails jointly own promotion and rollback.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-PRG-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-PRG-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-PRG-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-PRG-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-PRG-90` | The dominant task is actually credential rotation cutover. | Reject. |
| `AR-PRG-91` | The dominant task is actually generic deployment monitor. | Reject. |
| `AR-PRG-92` | The dominant task is actually stage-gated record. | Reject. |
| `AR-PRG-93` | The dominant task is actually workflow builder. | Reject. |

### Selection rule

Select `progressive-rollout-gate-console` if and only if `AR-PRG-01` through `AR-PRG-04` are evidenced and none of `AR-PRG-90` through `AR-PRG-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
rollout-console -> release-and-version-context -> desired-and-current-traffic-split -> rollout-cohorts-or-rings -> live-guardrail-comparison -> per-cohort-health -> promotion-or-rollback-gate -> verification-and-receipt
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `rollout-console` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `release-and-version-context` | Owns Release And Version Context evidence or action and preserves its declared relationship to the current selection. |
| `desired-and-current-traffic-split` | Owns Desired And Current Traffic Split evidence or action and preserves its declared relationship to the current selection. |
| `rollout-cohorts-or-rings` | Owns Rollout Cohorts Or Rings evidence or action and preserves its declared relationship to the current selection. |
| `live-guardrail-comparison` | Owns Live Guardrail Comparison evidence or action and preserves its declared relationship to the current selection. |
| `per-cohort-health` | Owns Per Cohort Health evidence or action and preserves its declared relationship to the current selection. |
| `promotion-or-rollback-gate` | Owns Promotion Or Rollback Gate evidence or action and preserves its declared relationship to the current selection. |
| `verification-and-receipt` | Owns Verification And Receipt evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Traffic and cohort progression, guardrails, and gate actions remain simultaneously visible.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `rollout-cohorts-or-rings` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The current cohort and guardrails remain primary while prior cohorts collapse into history.
- **Navigation replacement:** A named disclosure or drawer replaces the displaced region and preserves exact selection and trigger.
- **Sticky boundary:** The current verdict or action persists only while its target and status remain visible and returns to flow at short height.
- **Overflow owner:** `rollout-cohorts-or-rings` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Current cohort and exposure → guardrail metrics → exceptions → promote or rollback → verification; history remains reachable.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `rollout-cohorts-or-rings` has a textual or list equivalent as primary when its bounded view does not fit.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `rollout-console -> release-and-version-context -> desired-and-current-traffic-split -> rollout-cohorts-or-rings -> live-guardrail-comparison -> per-cohort-health -> promotion-or-rollback-gate -> verification-and-receipt`.
- Long labels, translation, zoom, and enlarged controls trigger the same named topology changes.
- CSS never reorders semantics; ordinary content creates no page-level horizontal scroll.
- Hidden detail always has an explicit accessible reveal path.

### Interaction parity

- Every wide selection, edit, action, explanation, retry, and recovery remains reachable at intermediate and compact.
- Topology changes preserve the exact selected object, cursor or order, data state, pending result, and error context.
- Pointer actions have keyboard and single-pointer non-drag equivalents when movement is involved.
- Dynamic updates announce one contextual status without stealing focus; color is never the only signal.
- A modal receives and contains focus, supports Escape or Cancel, and returns focus to the exact trigger.

## State obligations

Task-specific states: old only, canary active, cohort healthy, cohort degraded, cohort unknown, guardrail pending, guardrail pass, guardrail fail, promotion locked, promotion pending, promotion success, rollback available, rollback running, rollback failure, verification, receipt.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `release-and-version-context` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `desired-and-current-traffic-split` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `desired-and-current-traffic-split` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `promotion-or-rollback-gate` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `verification-and-receipt` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `verification-and-receipt` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `verification-and-receipt` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `release-and-version-context` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `verification-and-receipt` | Move focus only to a modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `rollout-console` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Shift exposure from an old version to a new version across cohorts only when live guardrails pass, with deterministic promotion and rollback.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject credential rotation cutover; this is `AR-PRG-90` evidence and must route to an adjacent archetype.
- Reject generic deployment monitor; this is `AR-PRG-91` evidence and must route to an adjacent archetype.
- Reject stage-gated record; this is `AR-PRG-92` evidence and must route to an adjacent archetype.
- Reject workflow builder; this is `AR-PRG-93` evidence and must route to an adjacent archetype.

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
| [Kubernetes — Rolling update](https://kubernetes.io/docs/tasks/run-application/update-deployment-rolling/) | Controlled version replacement and rollback evidence. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Argo Rollouts — Canary](https://argo-rollouts.readthedocs.io/en/stable/features/canary/) | Stepwise exposure and canary progression. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Adaptive regions and readable pane relationships. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Status changes announced without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "progressive-rollout-gate-console",
  "situationCodes": ["<matched AR-PRG-* codes>"],
  "searchAliases": ["canary rollout gate","cohort exposure console","progressive delivery"],
  "dominantTask": "Shift exposure from an old version to a new version across cohorts only when live guardrails pass, with deterministic promotion and rollback.",
  "regions": ["rollout-console","release-and-version-context","desired-and-current-traffic-split","rollout-cohorts-or-rings","live-guardrail-comparison","per-cohort-health","promotion-or-rollback-gate","verification-and-receipt"],
  "regionRelationships": ["Exposure, treatment and control cohorts, and live guardrails jointly own promotion and rollback."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "rollout-console -> release-and-version-context -> desired-and-current-traffic-split -> rollout-cohorts-or-rings -> live-guardrail-comparison -> per-cohort-health -> promotion-or-rollback-gate -> verification-and-receipt",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "rollout-cohorts-or-rings",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["old only","canary active","cohort healthy","cohort degraded","cohort unknown","guardrail pending","guardrail pass","guardrail fail","promotion locked","promotion pending","promotion success","rollback available","rollback running","rollback failure","verification","receipt"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

