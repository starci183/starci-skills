# Binary structure and hex inspector

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `binary-structure-hex-inspector` |
| Family | Detail |
| Dominant task | Decode a binary artifact by synchronizing parsed structure fields, byte offsets, raw hexadecimal or ASCII bytes, and validation results. |
| Search aliases | `hex inspector`, `binary parser`, `byte offsets`, `decoded fields` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The selected semantic field owns one exact byte range across parsed structure, hex, ASCII, decoded value, and validation evidence.
- The required region graph remains `binary-inspector → artifact-and-offset-context → parsed-structure-tree → hex-and-ascii-byte-view → decoded-field-values → checksum-and-format-validation → cross-references → export`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.
- Synchronized semantic fields and exact raw byte ranges are mandatory.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-BH-01` | The dominant task is: Decode a binary artifact by synchronizing parsed structure fields, byte offsets, raw hexadecimal or ASCII bytes, and validation results. | Candidate evidence. |
| `AR-BH-02` | The complete required region graph is semantically present. | Required evidence. |
| `AR-BH-03` | Compact preserves the wide selection, action, state, and recovery. | Required evidence. |
| `AR-BH-04` | Synchronized semantic fields and exact raw byte ranges are mandatory. | Required relationship evidence. |
| `AR-BH-90` | The dominant task is generic hierarchical three-pane explorer. | Reject. |
| `AR-BH-91` | The dominant task is packet timeline. | Reject. |
| `AR-BH-92` | The dominant task is code editor. | Reject. |
| `AR-BH-93` | The dominant task is document diff. | Reject. |

### Selection rule

Select `binary-structure-hex-inspector` only when `AR-BH-01`, `AR-BH-02`, `AR-BH-03`, and `AR-BH-04` are evidenced and none of the `AR-BH-90` through `AR-BH-93` rejection codes holds. Return `needs-evidence` when one required owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
binary-inspector
└─ artifact-and-offset-context
   └─ parsed-structure-tree
      └─ hex-and-ascii-byte-view
         └─ decoded-field-values
            └─ checksum-and-format-validation
               └─ cross-references
                  └─ export
```

- Required relationship: The selected semantic field owns one exact byte range across parsed structure, hex, ASCII, decoded value, and validation evidence.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `binary-inspector` | Owns the page-level dominant task and all descendant state. | Root of the graph. |
| `artifact-and-offset-context` | Owns the evidence, state, and action for artifact and offset context without borrowing product semantics. | Follows `binary-inspector` in semantic order and retains the same selection context. |
| `parsed-structure-tree` | Owns the evidence, state, and action for parsed structure tree without borrowing product semantics. | Follows `artifact-and-offset-context` in semantic order and retains the same selection context. |
| `hex-and-ascii-byte-view` | Owns the evidence, state, and action for hex and ascii byte view without borrowing product semantics. | Follows `parsed-structure-tree` in semantic order and retains the same selection context. |
| `decoded-field-values` | Owns the evidence, state, and action for decoded field values without borrowing product semantics. | Follows `hex-and-ascii-byte-view` in semantic order and retains the same selection context. |
| `checksum-and-format-validation` | Owns the evidence, state, and action for checksum and format validation without borrowing product semantics. | Follows `decoded-field-values` in semantic order and retains the same selection context. |
| `cross-references` | Owns the evidence, state, and action for cross references without borrowing product semantics. | Follows `checksum-and-format-validation` in semantic order and retains the same selection context. |
| `export` | Owns the evidence, state, and action for export without borrowing product semantics. | Follows `cross-references` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Keep the structure tree, bytes, and decoded values visible with the exact selected range highlighted.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** `hex-and-ascii-byte-view` alone may own bounded two-dimensional overflow when its task meaning requires it.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Collapse the tree while the selected structure path and offsets remain.
- **Navigation replacement:** A named pane control exposes the displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** `hex-and-ascii-byte-view` retains its bounded overflow; displaced prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Use structure path → decoded field → exact bytes → validation; previous and next field controls preserve offset context.
- **Navigation replacement:** Explicit Previous, Next, and named-pane controls restore selection, state, and scroll context.
- **Sticky boundary:** The compact step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** `hex-and-ascii-byte-view` remains the only bounded exception; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `binary-inspector → artifact-and-offset-context → parsed-structure-tree → hex-and-ascii-byte-view → decoded-field-values → checksum-and-format-validation → cross-references → export`.
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
- The fictional decode surfaces the checksum failure in both bytes and text.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `artifact-and-offset-context` | Identify the pending owner and preserve its semantic position. |
| Ready | `parsed-structure-tree` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `hex-and-ascii-byte-view` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `decoded-field-values` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `checksum-and-format-validation` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `export` | Prevent duplicate action and announce progress without moving focus. |
| Success | `export` | Expose the result, preserve context, and provide the next valid action. |
| Stale / conflict | `artifact-and-offset-context` | Keep the last safe value and require explicit recovery. |
| Focus transition | `export` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `binary-inspector` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: artifact loading, artifact truncated, parser unsupported, parser failure, field selected, field unknown, byte range invalid, checksum pass, checksum fail, cross-reference unresolved, endian changed, display changed, export ready.

## Boundaries

### Accept

- Accept when decode a binary artifact by synchronizing parsed structure fields, byte offsets, raw hexadecimal or ASCII bytes, and validation results.
- Accept when the selected semantic field owns one exact byte range across parsed structure, hex, ASCII, decoded value, and validation evidence.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject generic hierarchical three-pane explorer; this is `AR-BH-90` evidence and must route to an adjacent archetype.
- Reject packet timeline; this is `AR-BH-91` evidence and must route to an adjacent archetype.
- Reject code editor; this is `AR-BH-92` evidence and must route to an adjacent archetype.
- Reject document diff; this is `AR-BH-93` evidence and must route to an adjacent archetype.
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
| [Wireshark Foundation — User’s Guide](https://www.wireshark.org/docs/wsug_html/) | Supports synchronized protocol fields and byte evidence. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IETF — RFC Editor](https://www.rfc-editor.org/) | Supports authoritative binary-format specifications. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NIST — Research Data Framework](https://www.nist.gov/programs-projects/research-data-framework-rdaf) | Supports independent artifact provenance. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Treegrid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Supports keyboard access to hierarchical decoded fields. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "binary-structure-hex-inspector",
  "situationCodes": ["<matched AR-BH-* codes>"],
  "searchAliases": ["hex inspector","binary parser","byte offsets","decoded fields"],
  "dominantTask": "Decode a binary artifact by synchronizing parsed structure fields, byte offsets, raw hexadecimal or ASCII bytes, and validation results.",
  "regions": ["binary-inspector","artifact-and-offset-context","parsed-structure-tree","hex-and-ascii-byte-view","decoded-field-values","checksum-and-format-validation","cross-references","export"],
  "regionRelationships": ["The selected semantic field owns one exact byte range across parsed structure, hex, ASCII, decoded value, and validation evidence."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "binary-inspector → artifact-and-offset-context → parsed-structure-tree → hex-and-ascii-byte-view → decoded-field-values → checksum-and-format-validation → cross-references → export",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "hex-and-ascii-byte-view",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["artifact loading","artifact truncated","parser unsupported","parser failure","field selected","field unknown","byte range invalid","checksum pass","checksum fail","cross-reference unresolved","endian changed","display changed","export ready"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

