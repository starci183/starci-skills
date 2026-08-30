# Boundaries and spacing express structure

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.ui.boundaries-spacing` |
| Operators | frontend decision, implementation, review, and proof |
| Search tags | `padding, divider, scroll owner, rhythm, sticky, fixed, overlay, clipping` |
| Dependencies | `fe.ui`; `fe.layout-composition`; routed Grammar |

Every boundary has exactly one padding, divider, and scroll owner. Parent-to-child spacing expresses
relationship; internal spacing expresses one owner's rhythm. Do not stack owners into an accidental
moat, duplicate a terminal reserve, or apply one uniform gap across facts, explanation, controls, and
disclosure when their relationships differ.

When adjacent siblings together explain one fact, create an explicit semantic group. Repeated rows
share one rhythm and one divider owner. Prove edge alignment, first/last-child treatment, long-content
wrapping, and the preceding and following peer relationships.

When an existing Grammar or application primitive owns the same scroll semantics, boundary, and
constraints, reuse it or prove a stronger equivalent. A local overflow declaration is not equivalent
when it loses edge cues, overscroll, focus, scrollbar, or restoration behavior.

A pinned action projection and the content ending above it own one bottom boundary. Reserve that
boundary exactly once. A fixed or draggable overlay constrained to a safe viewport boundary does not
reserve terminal document height; an extra empty document spacer duplicates ownership and creates
false scrollable space. Sticky, fixed, and overlay surfaces must not occlude, visibly touch, clip, or
reveal content through their boundary at scroll start, middle, or terminal. Absence of overlap is not
enough to pass a surface touching a pinned edge.
