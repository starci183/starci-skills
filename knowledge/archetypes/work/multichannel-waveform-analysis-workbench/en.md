# Multichannel waveform analysis workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `multichannel-waveform-analysis-workbench` |
| Family | Work |
| Dominant task | Locate and measure morphology, intervals, and event candidates across multiple synchronized continuous signal channels. |
| Search aliases | `waveform analysis`, `synchronized signals`, `interval measurement`, `multichannel traces` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- A shared time cursor and interval synchronize continuous channels; numeric measurements govern every visual trace and event candidate.
- The required region graph remains `waveform-workbench → recording-and-calibration-context → channel-set-and-scale → synchronized-waveform-traces → shared-cursor-and-interval → derived-measurements → event-candidate-list → selected-interval-detail → finding-export`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.
- Continuous sampled channels and a shared interval measurement are mandatory.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-MW-01` | The dominant task is: Locate and measure morphology, intervals, and event candidates across multiple synchronized continuous signal channels. | Candidate evidence. |
| `AR-MW-02` | The complete required region graph is semantically present. | Required evidence. |
| `AR-MW-03` | Compact preserves the wide selection, action, state, and recovery. | Required evidence. |
| `AR-MW-04` | Continuous sampled channels and a shared interval measurement are mandatory. | Required relationship evidence. |
| `AR-MW-90` | The dominant task is timeline status monitor. | Reject. |
| `AR-MW-91` | The dominant task is media annotation. | Reject. |
| `AR-MW-92` | The dominant task is streaming logs. | Reject. |
| `AR-MW-93` | The dominant task is generic chart overview. | Reject. |

### Selection rule

Select `multichannel-waveform-analysis-workbench` only when `AR-MW-01`, `AR-MW-02`, `AR-MW-03`, and `AR-MW-04` are evidenced and none of the `AR-MW-90` through `AR-MW-93` rejection codes holds. Return `needs-evidence` when one required owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
waveform-workbench
└─ recording-and-calibration-context
   └─ channel-set-and-scale
      └─ synchronized-waveform-traces
         └─ shared-cursor-and-interval
            └─ derived-measurements
               └─ event-candidate-list
                  └─ selected-interval-detail
                     └─ finding-export
```

- Required relationship: A shared time cursor and interval synchronize continuous channels; numeric measurements govern every visual trace and event candidate.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `waveform-workbench` | Owns the page-level dominant task and all descendant state. | Root of the graph. |
| `recording-and-calibration-context` | Owns the evidence, state, and action for recording and calibration context without borrowing product semantics. | Follows `waveform-workbench` in semantic order and retains the same selection context. |
| `channel-set-and-scale` | Owns the evidence, state, and action for channel set and scale without borrowing product semantics. | Follows `recording-and-calibration-context` in semantic order and retains the same selection context. |
| `synchronized-waveform-traces` | Owns the evidence, state, and action for synchronized waveform traces without borrowing product semantics. | Follows `channel-set-and-scale` in semantic order and retains the same selection context. |
| `shared-cursor-and-interval` | Owns the evidence, state, and action for shared cursor and interval without borrowing product semantics. | Follows `synchronized-waveform-traces` in semantic order and retains the same selection context. |
| `derived-measurements` | Owns the evidence, state, and action for derived measurements without borrowing product semantics. | Follows `shared-cursor-and-interval` in semantic order and retains the same selection context. |
| `event-candidate-list` | Owns the evidence, state, and action for event candidate list without borrowing product semantics. | Follows `derived-measurements` in semantic order and retains the same selection context. |
| `selected-interval-detail` | Owns the evidence, state, and action for selected interval detail without borrowing product semantics. | Follows `event-candidate-list` in semantic order and retains the same selection context. |
| `finding-export` | Owns the evidence, state, and action for finding export without borrowing product semantics. | Follows `selected-interval-detail` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Keep stacked traces, measurements, and event candidates visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** `synchronized-waveform-traces` alone may own bounded two-dimensional overflow when its task meaning requires it.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Show fewer channels while preserving the channel selector, shared cursor, and measurement summary.
- **Navigation replacement:** A named pane control exposes the displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** `synchronized-waveform-traces` retains its bounded overflow; displaced prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Use event-first list or one channel group → selected trace window → numeric measurements → adjacent channels → finding without page-level horizontal overflow.
- **Navigation replacement:** Explicit Previous, Next, and named-pane controls restore selection, state, and scroll context.
- **Sticky boundary:** The compact step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** `synchronized-waveform-traces` remains the only bounded exception; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `waveform-workbench → recording-and-calibration-context → channel-set-and-scale → synchronized-waveform-traces → shared-cursor-and-interval → derived-measurements → event-candidate-list → selected-interval-detail → finding-export`.
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
- The fictional event records numeric evidence and the same interval on all channels.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `recording-and-calibration-context` | Identify the pending owner and preserve its semantic position. |
| Ready | `channel-set-and-scale` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `synchronized-waveform-traces` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `shared-cursor-and-interval` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `derived-measurements` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `finding-export` | Prevent duplicate action and announce progress without moving focus. |
| Success | `finding-export` | Expose the result, preserve context, and provide the next valid action. |
| Stale / conflict | `recording-and-calibration-context` | Keep the last safe value and require explicit recovery. |
| Focus transition | `finding-export` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `waveform-workbench` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: recording loading, recording gap, recording clipped, channel hidden, channel noisy, cursor selected, interval selected, event accepted, event rejected, measurement recalculating, measurement out of range, calibration warning, export ready.

## Boundaries

### Accept

- Accept when locate and measure morphology, intervals, and event candidates across multiple synchronized continuous signal channels.
- Accept when a shared time cursor and interval synchronize continuous channels; numeric measurements govern every visual trace and event candidate.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject timeline status monitor; this is `AR-MW-90` evidence and must route to an adjacent archetype.
- Reject media annotation; this is `AR-MW-91` evidence and must route to an adjacent archetype.
- Reject streaming logs; this is `AR-MW-92` evidence and must route to an adjacent archetype.
- Reject generic chart overview; this is `AR-MW-93` evidence and must route to an adjacent archetype.
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
| [PhysioNet — Waveform databases](https://physionet.org/about/database/) | Supports synchronized physiological waveform resources. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [FDA — Randomized trial design guidance](https://www.fda.gov/media/191123/download) | Supports independent evidence-quality and measurement context. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [DICOM — Current Volumetric Presentation State IODs](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_a.80.html) | Supports independent synchronized measurement context. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Complex Images](https://www.w3.org/WAI/tutorials/images/complex/) | Supports numeric and textual alternatives for complex traces. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "multichannel-waveform-analysis-workbench",
  "situationCodes": ["<matched AR-MW-* codes>"],
  "searchAliases": ["waveform analysis","synchronized signals","interval measurement","multichannel traces"],
  "dominantTask": "Locate and measure morphology, intervals, and event candidates across multiple synchronized continuous signal channels.",
  "regions": ["waveform-workbench","recording-and-calibration-context","channel-set-and-scale","synchronized-waveform-traces","shared-cursor-and-interval","derived-measurements","event-candidate-list","selected-interval-detail","finding-export"],
  "regionRelationships": ["A shared time cursor and interval synchronize continuous channels; numeric measurements govern every visual trace and event candidate."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "waveform-workbench → recording-and-calibration-context → channel-set-and-scale → synchronized-waveform-traces → shared-cursor-and-interval → derived-measurements → event-candidate-list → selected-interval-detail → finding-export",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "synchronized-waveform-traces",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["recording loading","recording gap","recording clipped","channel hidden","channel noisy","cursor selected","interval selected","event accepted","event rejected","measurement recalculating","measurement out of range","calibration warning","export ready"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

