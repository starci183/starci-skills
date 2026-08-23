# Formal Proof Obligation Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `formal-proof-obligation-workbench` |
| Family | Work |
| Dominant task | Discharge formal proof obligations with tactics while tracking hypotheses, targets, generated subgoals and kernel-checkable verdicts. |
| Search aliases | `proof obligation stack`, `tactic state transition`, `kernel verdict`, `subgoal navigator` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Discharge formal proof obligations with tactics while tracking hypotheses, targets, generated subgoals and kernel-checkable verdicts.
- The required region graph remains `proof-workbench → theorem-outline → obligation-stack → selected-local-context-and-target ↔ tactic-editor → proof-state-transition-ledger → successor-subgoals → kernel-verdict`.
- Every state and action binds to one selected context and its provenance.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product semantics; Principles own unresolved geometry; Direction owns visual character.
- Wide, intermediate, and compact preserve action, state, keyboard access, overflow ownership, and recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-PO-01` | The stated dominant task is the page's primary user outcome. | Candidate evidence. |
| `AR-PO-02` | Every required region and named relationship is present. | Required evidence. |
| `AR-PO-03` | Wide, intermediate, and compact use the declared topology transformations. | Required evidence. |
| `AR-PO-04` | Compact preserves every action, state, keyboard path, focus return, and recovery. | Required evidence. |
| `AR-PO-05` | Template must apply a tactic, expose the exact before/after proof states, navigate generated subgoals, announce failure without stealing focus and end only on a kernel verdict. | Required evidence. |
| `AR-PO-90` | code playground | Reject. |
| `AR-PO-91` | document editor | Reject. |
| `AR-PO-92` | tree navigator | Reject. |
| `AR-PO-93` | generic workflow | Reject. |

### Selection rule

Select `formal-proof-obligation-workbench` only when `AR-PO-01` through `AR-PO-05` are evidenced and no `AR-PO-9*` code holds. Return `needs-evidence` when a required owner or relationship is unknown. Return `reject` when any rejection code holds. A difference limited to nouns, density, color, card count, component, or state is `duplicate-or-variation`.

## Region graph

```text
proof-workbench
   `-- theorem-outline
      `-- obligation-stack
         `-- selected-local-context-and-target
            `-- tactic-editor
               `-- proof-state-transition-ledger
                  `-- successor-subgoals
                     `-- kernel-verdict
```

Declared relationship expression: `proof-workbench → theorem-outline → obligation-stack → selected-local-context-and-target ↔ tactic-editor → proof-state-transition-ledger → successor-subgoals → kernel-verdict`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `proof-workbench` | Owns the complete dominant task, version context, and descendant recovery. | Root of the required graph; it cannot be replaced by a generic container. |
| `theorem-outline` | Owns theorem outline evidence, action, state, and recovery. | Follows `proof-workbench` in semantic order and consumes its exact selected context. |
| `obligation-stack` | Owns obligation stack evidence, action, state, and recovery. | Follows `theorem-outline` in semantic order and consumes its exact selected context. |
| `selected-local-context-and-target` | Owns selected local context and target evidence, action, state, and recovery. | Synchronizes bidirectionally with `obligation-stack` under one selected context. |
| `tactic-editor` | Owns tactic editor evidence, action, state, and recovery. | Synchronizes bidirectionally with `selected-local-context-and-target` under one selected context. |
| `proof-state-transition-ledger` | Owns proof state transition ledger evidence, action, state, and recovery. | Follows `tactic-editor` in semantic order and consumes its exact selected context. |
| `successor-subgoals` | Owns successor subgoals evidence, action, state, and recovery. | Follows `proof-state-transition-ledger` in semantic order and consumes its exact selected context. |
| `kernel-verdict` | Owns kernel verdict evidence, action, state, and recovery. | Follows `successor-subgoals` in semantic order and consumes its exact selected context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when all simultaneous regions named by the contract cannot preserve readable labels, exact associations, visible actions, and unobscured focus.
- **Topology response:** Theorem outline, current context/goal, tactic editor and transition/subgoal evidence remain visible.
- **Navigation replacement:** None while every required owner remains simultaneously usable.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `proof-state-transition-ledger` alone may own bounded horizontal overflow; ordinary content never owns page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region breaks the dominant cross-region relationship.
- **Topology response:** Outline becomes a proof-path breadcrumb; goal and editor keep a split while transition history becomes a drawer.
- **Navigation replacement:** A named synchronized drawer, disclosure, or pane replaces each displaced persistent region and exposes current state in its trigger.
- **Sticky boundary:** A persistent action remains only while its exact target is visible and becomes in-flow at short height.
- **Overflow owner:** `proof-state-transition-ledger` retains the only bounded overflow axis and a text or list equivalent.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task owners cannot keep readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Pending obligation → hypotheses → target → tactic input → resulting subgoals/verdict; the proof tree becomes current path plus pending branch count.
- **Navigation replacement:** Use one primary-pane sequence with explicit Previous and Next controls that restore selection, query, state, and scroll context.
- **Sticky boundary:** The current action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The text or relation ledger is primary; `proof-state-transition-ledger` is optional and bounded.

### Reflow

- Semantic and DOM order is `proof-workbench → theorem-outline → obligation-stack → selected-local-context-and-target → tactic-editor → proof-state-transition-ledger → successor-subgoals → kernel-verdict`.
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
| Initial / loading | `theorem-outline` | Identify pending scope and preserve semantic position. |
| Ready | `obligation-stack` | Expose the complete dominant task and current version. |
| Empty / not applicable | `selected-local-context-and-target` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `tactic-editor` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `successor-subgoals` | Do not imply restricted evidence is absent; provide a safe alternate route. |
| Pending | `kernel-verdict` | Prevent duplicate action and announce progress without moving focus. |
| Success | `kernel-verdict` | Expose the outcome, provenance, and next valid action. |
| Stale / conflict | `theorem-outline` | Keep the last safe value and require explicit reconciliation. |
| Focus transition | `kernel-verdict` | Move focus only to a required error summary or opened modal, then return it to the exact trigger. |
| Responsive presentation | `proof-workbench` | Preserve selected entity, query, state, and recovery when topology changes. |
| theorem loading | `theorem-outline` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| obligation pending/active/closed | `obligation-stack` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| tactic parsing/running/error | `selected-local-context-and-target` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| no progress | `tactic-editor` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| subgoals generated | `proof-state-transition-ledger` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| context changed | `successor-subgoals` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| kernel accepted/rejected and proof stale after edit. | `kernel-verdict` | Expose this task-specific state with its cause, consequence, and valid recovery. |

## Boundaries

### Accept

- Accept only when the dominant task transforms the required evidence into the declared outcome.
- Accept only when each required region has an independent owner and the named relationships remain explicit.
- Accept only when template must apply a tactic, expose the exact before/after proof states, navigate generated subgoals, announce failure without stealing focus and end only on a kernel verdict.

### Reject

- Reject code playground; this is `AR-PO-90` evidence and must route to an adjacent archetype.
- Reject document editor; this is `AR-PO-91` evidence and must route to an adjacent archetype.
- Reject tree navigator; this is `AR-PO-92` evidence and must route to an adjacent archetype.
- Reject generic workflow; this is `AR-PO-93` evidence and must route to an adjacent archetype.
- Reject any candidate that satisfies the task only by changing product nouns or visual treatment.

### Boundary verdict

Return `accept` only when the dominant task, complete required graph, transformation contract, state and recovery parity, and `AR-PO-05` all hold. Return `reject` for any rejection code. Return `needs-evidence` for an unresolved owner or relationship. Report `duplicate-or-variation` for differences limited to nouns, density, color, card count, component, or state.

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
| [Lean — Tactic Proofs](https://lean-lang.org/doc/reference/latest/Tactic-Proofs/) | Supports tactics, goals, generated proof states, and closure. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Isabelle — Documentation](https://isabelle.in.tum.de/documentation.html) | Supports formal proof documents and checked results. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports announcing tactic outcomes without focus theft. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set contains current official material from at least three independent organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "formal-proof-obligation-workbench",
  "situationCodes": [
    "<matched AR-PO-* codes>"
  ],
  "searchAliases": [
    "proof obligation stack",
    "tactic state transition",
    "kernel verdict",
    "subgoal navigator"
  ],
  "dominantTask": "Discharge formal proof obligations with tactics while tracking hypotheses, targets, generated subgoals and kernel-checkable verdicts.",
  "regions": [
    "proof-workbench",
    "theorem-outline",
    "obligation-stack",
    "selected-local-context-and-target",
    "tactic-editor",
    "proof-state-transition-ledger",
    "successor-subgoals",
    "kernel-verdict"
  ],
  "regionRelationships": [
    "proof-workbench → theorem-outline → obligation-stack → selected-local-context-and-target ↔ tactic-editor → proof-state-transition-ledger → successor-subgoals → kernel-verdict"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "proof-workbench → theorem-outline → obligation-stack → selected-local-context-and-target → tactic-editor → proof-state-transition-ledger → successor-subgoals → kernel-verdict",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "none",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "theorem loading",
    "obligation pending/active/closed",
    "tactic parsing/running/error",
    "no progress",
    "subgoals generated",
    "context changed",
    "kernel accepted/rejected and proof stale after edit."
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

