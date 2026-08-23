# Constraint Solver Unsat Core Explorer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `constraint-solver-unsat-core-explorer` |
| Family | Work |
| Dominant task | Explain why one constraint model has no solution, isolate minimal conflicting constraint sets, test explicit relaxations and produce either a satisfiable witness or an impossibility receipt. |
| Search aliases | `unsat core explorer`, `minimal conflict set`, `constraint relaxation`, `satisfiable witness` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Explain why one constraint model has no solution, isolate minimal conflicting constraint sets, test explicit relaxations and produce either a satisfiable witness or an impossibility receipt.
- The required region graph remains `unsat-explorer → model-version-and-solve-context → variable-domain-register ↔ constraint-dependency-graph → solve-result-and-core-set → selected-core-constraint-provenance → relaxation-candidates-and-counterfactuals → rerun-witness-or-impossibility-receipt`.
- Every state and action binds to one selected context and its provenance.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product semantics; Principles own unresolved geometry; Direction owns visual character.
- Wide, intermediate, and compact preserve action, state, keyboard access, overflow ownership, and recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-UC-01` | The stated dominant task is the page's primary user outcome. | Candidate evidence. |
| `AR-UC-02` | Every required region and named relationship is present. | Required evidence. |
| `AR-UC-03` | Wide, intermediate, and compact use the declared topology transformations. | Required evidence. |
| `AR-UC-04` | Compact preserves every action, state, keyboard path, focus return, and recovery. | Required evidence. |
| `AR-UC-05` | Template must expose at least two cores, trace a constraint to source, preview a relaxation, rerun to a witness or receipt and preserve core/constraint/focus identity across topology changes. | Required evidence. |
| `AR-UC-90` | configuration-dependency-resolver | Reject. |
| `AR-UC-91` | formal-proof-obligation-workbench | Reject. |
| `AR-UC-92` | rule/query builder | Reject. |
| `AR-UC-93` | generic error list | Reject. |

### Selection rule

Select `constraint-solver-unsat-core-explorer` only when `AR-UC-01` through `AR-UC-05` are evidenced and no `AR-UC-9*` code holds. Return `needs-evidence` when a required owner or relationship is unknown. Return `reject` when any rejection code holds. A difference limited to nouns, density, color, card count, component, or state is `duplicate-or-variation`.

## Region graph

```text
unsat-explorer
   `-- model-version-and-solve-context
      `-- variable-domain-register
         `-- constraint-dependency-graph
            `-- solve-result-and-core-set
               `-- selected-core-constraint-provenance
                  `-- relaxation-candidates-and-counterfactuals
                     `-- rerun-witness-or-impossibility-receipt
```

Declared relationship expression: `unsat-explorer → model-version-and-solve-context → variable-domain-register ↔ constraint-dependency-graph → solve-result-and-core-set → selected-core-constraint-provenance → relaxation-candidates-and-counterfactuals → rerun-witness-or-impossibility-receipt`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `unsat-explorer` | Owns the complete dominant task, version context, and descendant recovery. | Root of the required graph; it cannot be replaced by a generic container. |
| `model-version-and-solve-context` | Owns model version and solve context evidence, action, state, and recovery. | Follows `unsat-explorer` in semantic order and consumes its exact selected context. |
| `variable-domain-register` | Owns variable domain register evidence, action, state, and recovery. | Synchronizes bidirectionally with `model-version-and-solve-context` under one selected context. |
| `constraint-dependency-graph` | Owns constraint dependency graph evidence, action, state, and recovery. | Synchronizes bidirectionally with `variable-domain-register` under one selected context. |
| `solve-result-and-core-set` | Owns solve result and core set evidence, action, state, and recovery. | Follows `constraint-dependency-graph` in semantic order and consumes its exact selected context. |
| `selected-core-constraint-provenance` | Owns selected core constraint provenance evidence, action, state, and recovery. | Follows `solve-result-and-core-set` in semantic order and consumes its exact selected context. |
| `relaxation-candidates-and-counterfactuals` | Owns relaxation candidates and counterfactuals evidence, action, state, and recovery. | Follows `selected-core-constraint-provenance` in semantic order and consumes its exact selected context. |
| `rerun-witness-or-impossibility-receipt` | Owns rerun witness or impossibility receipt evidence, action, state, and recovery. | Follows `relaxation-candidates-and-counterfactuals` in semantic order and consumes its exact selected context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when all simultaneous regions named by the contract cannot preserve readable labels, exact associations, visible actions, and unobscured focus.
- **Topology response:** Constraint graph, core set, selected provenance and relaxation/witness comparison remain simultaneous.
- **Navigation replacement:** None while every required owner remains simultaneously usable.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `constraint-dependency-graph` alone may own bounded horizontal overflow; ordinary content never owns page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region breaks the dominant cross-region relationship.
- **Topology response:** Core list and selected provenance remain primary; graph and candidate relaxations become synchronized panes while solve context persists.
- **Navigation replacement:** A named synchronized drawer, disclosure, or pane replaces each displaced persistent region and exposes current state in its trigger.
- **Sticky boundary:** A persistent action remains only while its exact target is visible and becomes in-flow at short height.
- **Overflow owner:** `constraint-dependency-graph` retains the only bounded overflow axis and a text or list equivalent.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task owners cannot keep readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Failed solve → one core → implicated constraints/provenance → choose relaxation → rerun → witness or receipt; graph becomes an accessible relation/path ledger.
- **Navigation replacement:** Use one primary-pane sequence with explicit Previous and Next controls that restore selection, query, state, and scroll context.
- **Sticky boundary:** The current action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The text or relation ledger is primary; `constraint-dependency-graph` is optional and bounded.

### Reflow

- Semantic and DOM order is `unsat-explorer → model-version-and-solve-context → variable-domain-register → constraint-dependency-graph → solve-result-and-core-set → selected-core-constraint-provenance → relaxation-candidates-and-counterfactuals → rerun-witness-or-impossibility-receipt`.
- Text zoom, long translation, and enlarged controls trigger the same named topology changes.
- CSS never reorders visual content away from keyboard or assistive-technology order.
- Long labels and identifiers wrap; hidden detail has an explicit accessible reveal.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, edit, action, explanation, retry, and recovery remains reachable at intermediate and compact.
- Topology changes preserve selected entity, version, filter, pending state, validation result, and recovery point.
- Dynamic updates use one contextual status message without moving focus.
- A modal receives and contains focus, supports Escape or Cancel, and returns focus to the exact trigger.
- Drag, drawing, fader, spatial, or point movement has button, numeric, or list parity.
- Color, position, geometry, and motion always have a textual or structural equivalent.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `model-version-and-solve-context` | Identify pending scope and preserve semantic position. |
| Ready | `variable-domain-register` | Expose the complete dominant task and current version. |
| Empty / not applicable | `constraint-dependency-graph` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `solve-result-and-core-set` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `relaxation-candidates-and-counterfactuals` | Do not imply restricted evidence is absent; provide a safe alternate route. |
| Pending | `rerun-witness-or-impossibility-receipt` | Prevent duplicate action and announce progress without moving focus. |
| Success | `rerun-witness-or-impossibility-receipt` | Expose the outcome, provenance, and next valid action. |
| Stale / conflict | `model-version-and-solve-context` | Keep the last safe value and require explicit reconciliation. |
| Focus transition | `rerun-witness-or-impossibility-receipt` | Move focus only to a required error summary or opened modal, then return it to the exact trigger. |
| Responsive presentation | `unsat-explorer` | Preserve selected entity, query, state, and recovery when topology changes. |
| parse/compile failure | `model-version-and-solve-context` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| solve sat/unsat/unknown | `variable-domain-register` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| core unavailable/nonminimal/multiple | `constraint-dependency-graph` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| source mapping missing | `solve-result-and-core-set` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| relaxation valid/unsafe | `selected-core-constraint-provenance` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| rerun pending/timeout | `relaxation-candidates-and-counterfactuals` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| witness found and impossibility receipt issued. | `rerun-witness-or-impossibility-receipt` | Expose this task-specific state with its cause, consequence, and valid recovery. |

## Boundaries

### Accept

- Accept only when the dominant task transforms the required evidence into the declared outcome.
- Accept only when each required region has an independent owner and the named relationships remain explicit.
- Accept only when template must expose at least two cores, trace a constraint to source, preview a relaxation, rerun to a witness or receipt and preserve core/constraint/focus identity across topology changes.

### Reject

- Reject configuration-dependency-resolver; this is `AR-UC-90` evidence and must route to an adjacent archetype.
- Reject formal-proof-obligation-workbench; this is `AR-UC-91` evidence and must route to an adjacent archetype.
- Reject rule/query builder; this is `AR-UC-92` evidence and must route to an adjacent archetype.
- Reject generic error list; this is `AR-UC-93` evidence and must route to an adjacent archetype.
- Reject any candidate that satisfies the task only by changing product nouns or visual treatment.

### Boundary verdict

Return `accept` only when the dominant task, complete required graph, transformation contract, state and recovery parity, and `AR-UC-05` all hold. Return `reject` for any rejection code. Return `needs-evidence` for an unresolved owner or relationship. Report `duplicate-or-variation` for differences limited to nouns, density, color, card count, component, or state.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permissions, truthful state meaning, and permitted actions to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow realization, and relationship-driven transition points.
- Neither handoff may remove a required region, replace the dominant task, or weaken keyboard, focus, responsive, or recovery parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports the synthesis of task relationships, responsive transformation, interaction, and accessibility obligations. It does not name StarCi owners, select exact geometry, create product facts, or authorize copying a source interface.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [Microsoft — Z3 Guide](https://microsoft.github.io/z3guide/docs/logic/basiccommands/) | Supports solver results, models, and assertions. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [MiniZinc — FindMUS](https://docs.minizinc.dev/en/latest/find_mus.html) | Supports minimal unsatisfiable subsets and source locations. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [SMT-LIB — Current Language](https://smt-lib.org/language.shtml) | Supports solver language and result interoperability. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports stable focus across graph-to-ledger transformations. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set contains current official material from at least three independent organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "constraint-solver-unsat-core-explorer",
  "situationCodes": [
    "<matched AR-UC-* codes>"
  ],
  "searchAliases": [
    "unsat core explorer",
    "minimal conflict set",
    "constraint relaxation",
    "satisfiable witness"
  ],
  "dominantTask": "Explain why one constraint model has no solution, isolate minimal conflicting constraint sets, test explicit relaxations and produce either a satisfiable witness or an impossibility receipt.",
  "regions": [
    "unsat-explorer",
    "model-version-and-solve-context",
    "variable-domain-register",
    "constraint-dependency-graph",
    "solve-result-and-core-set",
    "selected-core-constraint-provenance",
    "relaxation-candidates-and-counterfactuals",
    "rerun-witness-or-impossibility-receipt"
  ],
  "regionRelationships": [
    "unsat-explorer → model-version-and-solve-context → variable-domain-register ↔ constraint-dependency-graph → solve-result-and-core-set → selected-core-constraint-provenance → relaxation-candidates-and-counterfactuals → rerun-witness-or-impossibility-receipt"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "unsat-explorer → model-version-and-solve-context → variable-domain-register → constraint-dependency-graph → solve-result-and-core-set → selected-core-constraint-provenance → relaxation-candidates-and-counterfactuals → rerun-witness-or-impossibility-receipt",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "constraint-dependency-graph",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "parse/compile failure",
    "solve sat/unsat/unknown",
    "core unavailable/nonminimal/multiple",
    "source mapping missing",
    "relaxation valid/unsafe",
    "rerun pending/timeout",
    "witness found and impossibility receipt issued."
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

