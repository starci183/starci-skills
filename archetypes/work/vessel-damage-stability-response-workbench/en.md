# Vessel damage stability response workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `vessel-damage-stability-response-workbench` |
| Family | Work |
| Dominant task | Assess a flooding casualty, predict progressive loss of buoyancy and stability, compare closure, pumping, ballast or counter-flooding actions and issue a survivability response without creating a worse propagation path. |
| Search aliases | `vessel damage stability response`, `vessel damage stability response workspace`, `vessel damage stability response control` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Assess a flooding casualty, predict progressive loss of buoyancy and stability, compare closure, pumping, ballast or counter-flooding actions and issue a survivability response without creating a worse propagation path.
- physical subdivision, dynamic flooding paths and recalculated stability jointly own the response.
- Every required region retains a separate owner and the same selected context.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-VDSRW-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-VDSRW-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-VDSRW-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-VDSRW-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-VDSRW-90` | The dominant task is actually `load-and-balance-packing-workbench`. | Reject. |
| `AR-VDSRW-91` | The dominant task is actually `process-mass-balance-analyzer`. | Reject. |
| `AR-VDSRW-92` | The dominant task is actually `live-operations-command-center`. | Reject. |
| `AR-VDSRW-93` | The dominant task is actually `risk-bow-tie-control-overview`. | Reject. |

### Selection rule

Select `vessel-damage-stability-response-workbench` if and only if `AR-VDSRW-01` through `AR-VDSRW-04` are evidenced and none of `AR-VDSRW-90` through `AR-VDSRW-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
damage-stability-response → vessel-loading-and-sea-condition → watertight-compartment-topology ↔ flooding-source-opening-pump-and-closure-state → hydrostatic-heel-trim-free-surface-envelope → progressive-flooding-scenario-tree → candidate-response-sequence → action-side-effect-and-stability-forecast → commander-go-no-go-decision → executed-action-and-residual-survivability-log
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `damage-stability-response` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `vessel-loading-and-sea-condition` | Owns Vessel Loading And Sea Condition evidence or action and preserves its declared relationship to the current selection. |
| `watertight-compartment-topology` | Owns Watertight Compartment Topology evidence or action and preserves its declared relationship to the current selection. |
| `flooding-source-opening-pump-and-closure-state` | Owns Flooding Source Opening Pump And Closure State evidence or action and preserves its declared relationship to the current selection. |
| `hydrostatic-heel-trim-free-surface-envelope` | Owns Hydrostatic Heel Trim Free Surface Envelope evidence or action and preserves its declared relationship to the current selection. |
| `progressive-flooding-scenario-tree` | Owns Progressive Flooding Scenario Tree evidence or action and preserves its declared relationship to the current selection. |
| `candidate-response-sequence` | Owns Candidate Response Sequence evidence or action and preserves its declared relationship to the current selection. |
| `action-side-effect-and-stability-forecast` | Owns Action Side Effect And Stability Forecast evidence or action and preserves its declared relationship to the current selection. |
| `commander-go-no-go-decision` | Owns Commander Go No Go Decision evidence or action and preserves its declared relationship to the current selection. |
| `executed-action-and-residual-survivability-log` | Owns Executed Action And Residual Survivability Log evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Compartment topology, openings/pumps, stability envelope, scenario tree and candidate response forecast remain visible; the compartment plan alone owns bounded pan/zoom.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `watertight-compartment-topology` owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The selected flooding path and residual-stability summary stay primary; compartment and forecast evidence alternate while the action sequence remains editable.
- **Navigation replacement:** Named evidence views replace displaced regions and preserve exact selection and trigger.
- **Sticky boundary:** The current verdict persists only while its target remains visible and returns to flow at short height.
- **Overflow owner:** The wide bounded owner remains local; alternate evidence views create no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Casualty → affected compartment chain → active openings/pumps → current heel/trim/stability margin → candidate action and side effects → predicted residual state → command → verify; a causal compartment list and numeric envelope replace the deck plan.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The bounded visual has a textual ordered equivalent as the primary compact representation.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `damage-stability-response → vessel-loading-and-sea-condition → watertight-compartment-topology ↔ flooding-source-opening-pump-and-closure-state → hydrostatic-heel-trim-free-surface-envelope → progressive-flooding-scenario-tree → candidate-response-sequence → action-side-effect-and-stability-forecast → commander-go-no-go-decision → executed-action-and-residual-survivability-log`.
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

Task-specific states: Vessel data loading/stale, compartment intact/flooding/flooded, boundary open/closed/failed, pump available/running/failed, sensor confirmed/uncertain, stability safe/marginal/unsafe, progressive path dormant/active, action proposed/blocked/ordered/complete, survivability improving/worsening and abandon/continue decision recorded.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `vessel-loading-and-sea-condition` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `watertight-compartment-topology` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `watertight-compartment-topology` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `commander-go-no-go-decision` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `executed-action-and-residual-survivability-log` | Explain the restriction without implying hidden evidence is absent and provide a safe exit. |
| Pending | `executed-action-and-residual-survivability-log` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `executed-action-and-residual-survivability-log` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `vessel-loading-and-sea-condition` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `executed-action-and-residual-survivability-log` | Move focus only to a modal or required error summary, then return it to the exact trigger. |
| Responsive presentation | `damage-stability-response` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Assess a flooding casualty, predict progressive loss of buoyancy and stability, compare closure, pumping, ballast or counter-flooding actions and issue a survivability response without creating a worse propagation path.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject `load-and-balance-packing-workbench`; this is `AR-VDSRW-90` evidence and must route to an adjacent archetype.
- Reject `process-mass-balance-analyzer`; this is `AR-VDSRW-91` evidence and must route to an adjacent archetype.
- Reject `live-operations-command-center`; this is `AR-VDSRW-92` evidence and must route to an adjacent archetype.
- Reject `risk-bow-tie-control-overview`; this is `AR-VDSRW-93` evidence and must route to an adjacent archetype.

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
| [IMO Damage Stability](https://www.imo.org/en/ourwork/safety/pages/damagestability.aspx) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [U.S. Coast Guard Marine Safety Center technical notes](https://www.dco.uscg.mil/msc/mtn/) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "vessel-damage-stability-response-workbench",
  "situationCodes": [
    "<matched AR-VDSRW-* codes>"
  ],
  "searchAliases": [
    "vessel damage stability response",
    "vessel damage stability response workspace",
    "vessel damage stability response control"
  ],
  "dominantTask": "Assess a flooding casualty, predict progressive loss of buoyancy and stability, compare closure, pumping, ballast or counter-flooding actions and issue a survivability response without creating a worse propagation path.",
  "regions": [
    "damage-stability-response",
    "vessel-loading-and-sea-condition",
    "watertight-compartment-topology",
    "flooding-source-opening-pump-and-closure-state",
    "hydrostatic-heel-trim-free-surface-envelope",
    "progressive-flooding-scenario-tree",
    "candidate-response-sequence",
    "action-side-effect-and-stability-forecast",
    "commander-go-no-go-decision",
    "executed-action-and-residual-survivability-log"
  ],
  "regionRelationships": [
    "physical subdivision, dynamic flooding paths and recalculated stability jointly own the response."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "damage-stability-response -> vessel-loading-and-sea-condition -> watertight-compartment-topology -> flooding-source-opening-pump-and-closure-state -> hydrostatic-heel-trim-free-surface-envelope -> progressive-flooding-scenario-tree -> candidate-response-sequence -> action-side-effect-and-stability-forecast -> commander-go-no-go-decision -> executed-action-and-residual-survivability-log",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "watertight-compartment-topology",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Vessel data loading/stale",
    "compartment intact/flooding/flooded",
    "boundary open/closed/failed",
    "pump available/running/failed",
    "sensor confirmed/uncertain",
    "stability safe/marginal/unsafe",
    "progressive path dormant/active",
    "action proposed/blocked/ordered/complete",
    "survivability improving/worsening",
    "abandon/continue decision recorded"
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

