# Responsive rendering preserves the task

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.ui.responsive` |
| Operators | frontend decision, implementation, review, and proof |
| Search tags | `responsive, wide, intermediate, compact, sticky, drag, zoom, recovery` |
| Dependencies | `fe.ui`; approved UX authority; `fe.layout-composition`; routed Grammar |

Responsive rendering may change tracks, order, disclosure, density, and persistence, but it preserves
meaning, ownership, comparison required for the decision, action reachability, and recovery. Compact
is a deliberate recomposition, never a wider layout merely squeezed smaller.

Sticky UI declares a scroll owner, bounded height, offset, focus/overflow behavior, collision handling,
and a compact static fallback. Draggable and zoom-sensitive controls remain reachable and recoverable
at every constraint edge. Prove wide, intermediate, and compact widths with sparse, dense, long,
wrapping, and missing content where applicable.
