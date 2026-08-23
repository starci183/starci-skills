# Typeface Glyph Metrics Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `typeface-glyph-metrics-workbench` |
| Family | Work |
| Dominant task | Author a coherent font repertoire by reconciling glyph outlines, anchors and metrics with pair or class spacing, shaping tests and whole-font specimen proof. |
| Search aliases | `glyph metrics editor`, `kerning pair workbench`, `font shaping proof`, `outline anchor validation` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Author a coherent font repertoire by reconciling glyph outlines, anchors and metrics with pair or class spacing, shaping tests and whole-font specimen proof.
- The required region graph remains `typeface-workbench → glyph-repertoire-grid → selected-glyph-outline-editor ↔ metrics-and-anchor-inspector → kerning-pair-or-class-editor → script-shaping-test-runs → specimen-proof → font-validation-and-export`.
- Every state and action binds to one selected context and its provenance.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product semantics; Principles own unresolved geometry; Direction owns visual character.
- Wide, intermediate, and compact preserve action, state, keyboard access, overflow ownership, and recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-TG-01` | The stated dominant task is the page's primary user outcome. | Candidate evidence. |
| `AR-TG-02` | Every required region and named relationship is present. | Required evidence. |
| `AR-TG-03` | Wide, intermediate, and compact use the declared topology transformations. | Required evidence. |
| `AR-TG-04` | Compact preserves every action, state, keyboard path, focus return, and recovery. | Required evidence. |
| `AR-TG-05` | Template must edit a glyph through coordinate controls, update metrics, inspect a kerning pair and shaping run, expose a validation failure and update the specimen from the same source. | Required evidence. |
| `AR-TG-90` | generic canvas inspector | Reject. |
| `AR-TG-91` | vector editor | Reject. |
| `AR-TG-92` | asset grid | Reject. |
| `AR-TG-93` | typography settings | Reject. |

### Selection rule

Select `typeface-glyph-metrics-workbench` only when `AR-TG-01` through `AR-TG-05` are evidenced and no `AR-TG-9*` code holds. Return `needs-evidence` when a required owner or relationship is unknown. Return `reject` when any rejection code holds. A difference limited to nouns, density, color, card count, component, or state is `duplicate-or-variation`.

## Region graph

```text
typeface-workbench
   `-- glyph-repertoire-grid
      `-- selected-glyph-outline-editor
         `-- metrics-and-anchor-inspector
            `-- kerning-pair-or-class-editor
               `-- script-shaping-test-runs
                  `-- specimen-proof
                     `-- font-validation-and-export
```

Declared relationship expression: `typeface-workbench → glyph-repertoire-grid → selected-glyph-outline-editor ↔ metrics-and-anchor-inspector → kerning-pair-or-class-editor → script-shaping-test-runs → specimen-proof → font-validation-and-export`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `typeface-workbench` | Owns the complete dominant task, version context, and descendant recovery. | Root of the required graph; it cannot be replaced by a generic container. |
| `glyph-repertoire-grid` | Owns glyph repertoire grid evidence, action, state, and recovery. | Follows `typeface-workbench` in semantic order and consumes its exact selected context. |
| `selected-glyph-outline-editor` | Owns selected glyph outline editor evidence, action, state, and recovery. | Synchronizes bidirectionally with `glyph-repertoire-grid` under one selected context. |
| `metrics-and-anchor-inspector` | Owns metrics and anchor inspector evidence, action, state, and recovery. | Synchronizes bidirectionally with `selected-glyph-outline-editor` under one selected context. |
| `kerning-pair-or-class-editor` | Owns kerning pair or class editor evidence, action, state, and recovery. | Follows `metrics-and-anchor-inspector` in semantic order and consumes its exact selected context. |
| `script-shaping-test-runs` | Owns script shaping test runs evidence, action, state, and recovery. | Follows `kerning-pair-or-class-editor` in semantic order and consumes its exact selected context. |
| `specimen-proof` | Owns specimen proof evidence, action, state, and recovery. | Follows `script-shaping-test-runs` in semantic order and consumes its exact selected context. |
| `font-validation-and-export` | Owns font validation and export evidence, action, state, and recovery. | Follows `specimen-proof` in semantic order and consumes its exact selected context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when all simultaneous regions named by the contract cannot preserve readable labels, exact associations, visible actions, and unobscured focus.
- **Topology response:** Glyph repertoire, outline editor, metrics inspector and bounded kerning/shaping/specimen regions remain visible.
- **Navigation replacement:** None while every required owner remains simultaneously usable.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `glyph-repertoire-grid` alone may own bounded horizontal overflow; ordinary content never owns page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region breaks the dominant cross-region relationship.
- **Topology response:** Repertoire becomes a drawer; outline stays primary while metrics, pair tests and proof become synchronized tabs.
- **Navigation replacement:** A named synchronized drawer, disclosure, or pane replaces each displaced persistent region and exposes current state in its trigger.
- **Sticky boundary:** A persistent action remains only while its exact target is visible and becomes in-flow at short height.
- **Overflow owner:** `glyph-repertoire-grid` retains the only bounded overflow axis and a text or list equivalent.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task owners cannot keep readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Glyph selector → outline editor → numeric metrics/anchors → pair or shaping test → specimen/validation; point movement has coordinate and keyboard alternatives.
- **Navigation replacement:** Use one primary-pane sequence with explicit Previous and Next controls that restore selection, query, state, and scroll context.
- **Sticky boundary:** The current action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The text or relation ledger is primary; `glyph-repertoire-grid` is optional and bounded.

### Reflow

- Semantic and DOM order is `typeface-workbench → glyph-repertoire-grid → selected-glyph-outline-editor → metrics-and-anchor-inspector → kerning-pair-or-class-editor → script-shaping-test-runs → specimen-proof → font-validation-and-export`.
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
| Initial / loading | `glyph-repertoire-grid` | Identify pending scope and preserve semantic position. |
| Ready | `selected-glyph-outline-editor` | Expose the complete dominant task and current version. |
| Empty / not applicable | `metrics-and-anchor-inspector` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `kerning-pair-or-class-editor` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `specimen-proof` | Do not imply restricted evidence is absent; provide a safe alternate route. |
| Pending | `font-validation-and-export` | Prevent duplicate action and announce progress without moving focus. |
| Success | `font-validation-and-export` | Expose the outcome, provenance, and next valid action. |
| Stale / conflict | `glyph-repertoire-grid` | Keep the last safe value and require explicit reconciliation. |
| Focus transition | `font-validation-and-export` | Move focus only to a required error summary or opened modal, then return it to the exact trigger. |
| Responsive presentation | `typeface-workbench` | Preserve selected entity, query, state, and recovery when topology changes. |
| font loading | `glyph-repertoire-grid` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| glyph missing/draft/complete | `selected-glyph-outline-editor` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| contour open/invalid | `metrics-and-anchor-inspector` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| metric conflict | `kerning-pair-or-class-editor` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| anchor missing | `script-shaping-test-runs` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| pair override/class conflict | `specimen-proof` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| shaping pass/fail | `font-validation-and-export` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| specimen stale and export warning/failure. | `font-validation-and-export` | Expose this task-specific state with its cause, consequence, and valid recovery. |

## Boundaries

### Accept

- Accept only when the dominant task transforms the required evidence into the declared outcome.
- Accept only when each required region has an independent owner and the named relationships remain explicit.
- Accept only when template must edit a glyph through coordinate controls, update metrics, inspect a kerning pair and shaping run, expose a validation failure and update the specimen from the same source.

### Reject

- Reject generic canvas inspector; this is `AR-TG-90` evidence and must route to an adjacent archetype.
- Reject vector editor; this is `AR-TG-91` evidence and must route to an adjacent archetype.
- Reject asset grid; this is `AR-TG-92` evidence and must route to an adjacent archetype.
- Reject typography settings; this is `AR-TG-93` evidence and must route to an adjacent archetype.
- Reject any candidate that satisfies the task only by changing product nouns or visual treatment.

### Boundary verdict

Return `accept` only when the dominant task, complete required graph, transformation contract, state and recovery parity, and `AR-TG-05` all hold. Return `reject` for any rejection code. Return `needs-evidence` for an unresolved owner or relationship. Report `duplicate-or-variation` for differences limited to nouns, density, color, card count, component, or state.

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
| [Microsoft — OpenType Kerning](https://learn.microsoft.com/en-us/typography/opentype/spec/kern) | Supports kerning pairs, classes, and font units. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Apple — TrueType Reference Manual](https://developer.apple.com/fonts/TrueType-Reference-Manual/index.html) | Supports glyph outlines, anchors, metrics, and font tables. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Supports non-drag coordinate alternatives. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set contains current official material from at least three independent organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "typeface-glyph-metrics-workbench",
  "situationCodes": [
    "<matched AR-TG-* codes>"
  ],
  "searchAliases": [
    "glyph metrics editor",
    "kerning pair workbench",
    "font shaping proof",
    "outline anchor validation"
  ],
  "dominantTask": "Author a coherent font repertoire by reconciling glyph outlines, anchors and metrics with pair or class spacing, shaping tests and whole-font specimen proof.",
  "regions": [
    "typeface-workbench",
    "glyph-repertoire-grid",
    "selected-glyph-outline-editor",
    "metrics-and-anchor-inspector",
    "kerning-pair-or-class-editor",
    "script-shaping-test-runs",
    "specimen-proof",
    "font-validation-and-export"
  ],
  "regionRelationships": [
    "typeface-workbench → glyph-repertoire-grid → selected-glyph-outline-editor ↔ metrics-and-anchor-inspector → kerning-pair-or-class-editor → script-shaping-test-runs → specimen-proof → font-validation-and-export"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "typeface-workbench → glyph-repertoire-grid → selected-glyph-outline-editor → metrics-and-anchor-inspector → kerning-pair-or-class-editor → script-shaping-test-runs → specimen-proof → font-validation-and-export",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "glyph-repertoire-grid",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "font loading",
    "glyph missing/draft/complete",
    "contour open/invalid",
    "metric conflict",
    "anchor missing",
    "pair override/class conflict",
    "shaping pass/fail",
    "specimen stale and export warning/failure."
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

