# Systematic evidence synthesis workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `systematic-evidence-synthesis-workbench` |
| Family | Work |
| Dominant task | Synthesize estimates from multiple studies, weigh risk of bias and heterogeneity, and produce a reviewable certainty conclusion. |
| Search aliases | `meta-analysis`, `evidence synthesis`, `forest plot`, `risk of bias` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Study weights, risk-of-bias judgments, and the aggregate effect model are distinct owners whose changes reconcile in one certainty conclusion.
- The required region graph remains `synthesis-workbench → review-question-and-inclusion → study-register → structured-extraction-table → risk-of-bias-assessment → effect-model-and-forest-plot → heterogeneity-and-sensitivity → certainty-summary → synthesis-record`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.
- Weighted cross-study synthesis, risk of bias, and heterogeneity are mandatory.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-SE-01` | The dominant task is: Synthesize estimates from multiple studies, weigh risk of bias and heterogeneity, and produce a reviewable certainty conclusion. | Candidate evidence. |
| `AR-SE-02` | The complete required region graph is semantically present. | Required evidence. |
| `AR-SE-03` | Compact preserves the wide selection, action, state, and recovery. | Required evidence. |
| `AR-SE-04` | Weighted cross-study synthesis, risk of bias, and heterogeneity are mandatory. | Required relationship evidence. |
| `AR-SE-90` | The dominant task is one-case evidence dossier. | Reject. |
| `AR-SE-91` | The dominant task is literature screening queue. | Reject. |
| `AR-SE-92` | The dominant task is generic pivot analytics. | Reject. |
| `AR-SE-93` | The dominant task is authored briefing. | Reject. |

### Selection rule

Select `systematic-evidence-synthesis-workbench` only when `AR-SE-01`, `AR-SE-02`, `AR-SE-03`, and `AR-SE-04` are evidenced and none of the `AR-SE-90` through `AR-SE-93` rejection codes holds. Return `needs-evidence` when one required owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
synthesis-workbench
└─ review-question-and-inclusion
   └─ study-register
      └─ structured-extraction-table
         └─ risk-of-bias-assessment
            └─ effect-model-and-forest-plot
               └─ heterogeneity-and-sensitivity
                  └─ certainty-summary
                     └─ synthesis-record
```

- Required relationship: Study weights, risk-of-bias judgments, and the aggregate effect model are distinct owners whose changes reconcile in one certainty conclusion.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `synthesis-workbench` | Owns the page-level dominant task and all descendant state. | Root of the graph. |
| `review-question-and-inclusion` | Owns the evidence, state, and action for review question and inclusion without borrowing product semantics. | Follows `synthesis-workbench` in semantic order and retains the same selection context. |
| `study-register` | Owns the evidence, state, and action for study register without borrowing product semantics. | Follows `review-question-and-inclusion` in semantic order and retains the same selection context. |
| `structured-extraction-table` | Owns the evidence, state, and action for structured extraction table without borrowing product semantics. | Follows `study-register` in semantic order and retains the same selection context. |
| `risk-of-bias-assessment` | Owns the evidence, state, and action for risk of bias assessment without borrowing product semantics. | Follows `structured-extraction-table` in semantic order and retains the same selection context. |
| `effect-model-and-forest-plot` | Owns the evidence, state, and action for effect model and forest plot without borrowing product semantics. | Follows `risk-of-bias-assessment` in semantic order and retains the same selection context. |
| `heterogeneity-and-sensitivity` | Owns the evidence, state, and action for heterogeneity and sensitivity without borrowing product semantics. | Follows `effect-model-and-forest-plot` in semantic order and retains the same selection context. |
| `certainty-summary` | Owns the evidence, state, and action for certainty summary without borrowing product semantics. | Follows `heterogeneity-and-sensitivity` in semantic order and retains the same selection context. |
| `synthesis-record` | Owns the evidence, state, and action for synthesis record without borrowing product semantics. | Follows `certainty-summary` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Keep the study table, forest-plot evidence, and bias or sensitivity evidence visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** `structured-extraction-table` alone may own bounded two-dimensional overflow when its task meaning requires it.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Make the study register primary; expose plot and bias as named panes while preserving the selected study.
- **Navigation replacement:** A named pane control exposes the displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** `structured-extraction-table` retains its bounded overflow; displaced prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Use study list → selected extraction or bias → numeric effect table → forest-plot alternative → synthesis or certainty summary.
- **Navigation replacement:** Explicit Previous, Next, and named-pane controls restore selection, state, and scroll context.
- **Sticky boundary:** The compact step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** `structured-extraction-table` remains the only bounded exception; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `synthesis-workbench → review-question-and-inclusion → study-register → structured-extraction-table → risk-of-bias-assessment → effect-model-and-forest-plot → heterogeneity-and-sensitivity → certainty-summary → synthesis-record`.
- Text zoom, long translation, and enlarged controls trigger the same relationship-driven topology changes.
- CSS never reorders the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap and every hidden region has a named accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, measurement, action, retry, and recovery path remains reachable in intermediate and compact.
- Topology changes preserve the exact selected item, shared coordinate or path, data state, and pending or completed receipt.
- Dynamic updates announce one contextual status without stealing focus.
- A modal traps focus, supports Escape or Cancel, and returns focus to the exact trigger.
- Color, position, geometry, and visual marks have textual or tabular equivalents.
- The fictional certainty remains draft while heterogeneity is high.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `review-question-and-inclusion` | Identify the pending owner and preserve its semantic position. |
| Ready | `study-register` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `structured-extraction-table` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `risk-of-bias-assessment` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `effect-model-and-forest-plot` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `synthesis-record` | Prevent duplicate action and announce progress without moving focus. |
| Success | `synthesis-record` | Expose the result, preserve context, and provide the next valid action. |
| Stale / conflict | `review-question-and-inclusion` | Keep the last safe value and require explicit recovery. |
| Focus transition | `synthesis-record` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `synthesis-workbench` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: study loading, study excluded, extraction incomplete, effect unavailable, bias low, bias some concerns, bias high, model calculating, model failure, heterogeneity high, sensitivity exclusion, certainty draft, certainty reviewed, source stale.

## Boundaries

### Accept

- Accept when synthesize estimates from multiple studies, weigh risk of bias and heterogeneity, and produce a reviewable certainty conclusion.
- Accept when study weights, risk-of-bias judgments, and the aggregate effect model are distinct owners whose changes reconcile in one certainty conclusion.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject one-case evidence dossier; this is `AR-SE-90` evidence and must route to an adjacent archetype.
- Reject literature screening queue; this is `AR-SE-91` evidence and must route to an adjacent archetype.
- Reject generic pivot analytics; this is `AR-SE-92` evidence and must route to an adjacent archetype.
- Reject authored briefing; this is `AR-SE-93` evidence and must route to an adjacent archetype.
- Reject a candidate whose only difference is product noun, count, density, color, component, or state as `duplicate-or-variation`.

### Boundary verdict

Return `accept` only when the dominant task, complete region graph, mandatory owner relationship, and compact interaction parity all hold. Return `reject` for any rejection code. Return `needs-evidence` when a required owner or relationship is unresolved.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permissions, actions, and truthful state meaning to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow realization, and relationship-driven transition points.
- Neither handoff may remove a required region, change the dominant task, or weaken interaction parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports task relationships, adaptive behavior, and accessibility obligations; it does not name StarCi owners, select exact geometry, or grant permission to copy a source interface. The sources were opened and verified as current official pages during this batch.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [Cochrane — Handbook current](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current) | Supports meta-analysis, bias, heterogeneity, and certainty methods. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [PRISMA — 2020 statement](https://www.prisma-statement.org/prisma-2020) | Supports systematic review reporting. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [CONSORT-SPIRIT — Published statements](https://www.consort-spirit.org/published-statements) | Supports independent trial-reporting context. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports non-disruptive calculation and review feedback. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "systematic-evidence-synthesis-workbench",
  "situationCodes": ["<matched AR-SE-* codes>"],
  "searchAliases": ["meta-analysis","evidence synthesis","forest plot","risk of bias"],
  "dominantTask": "Synthesize estimates from multiple studies, weigh risk of bias and heterogeneity, and produce a reviewable certainty conclusion.",
  "regions": ["synthesis-workbench","review-question-and-inclusion","study-register","structured-extraction-table","risk-of-bias-assessment","effect-model-and-forest-plot","heterogeneity-and-sensitivity","certainty-summary","synthesis-record"],
  "regionRelationships": ["Study weights, risk-of-bias judgments, and the aggregate effect model are distinct owners whose changes reconcile in one certainty conclusion."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "synthesis-workbench → review-question-and-inclusion → study-register → structured-extraction-table → risk-of-bias-assessment → effect-model-and-forest-plot → heterogeneity-and-sensitivity → certainty-summary → synthesis-record",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "structured-extraction-table",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["study loading","study excluded","extraction incomplete","effect unavailable","bias low","bias some concerns","bias high","model calculating","model failure","heterogeneity high","sensitivity exclusion","certainty draft","certainty reviewed","source stale"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

