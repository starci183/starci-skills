# Layout composition

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.layout-composition` |
| Operations | `layout` |
| Search tags | `layout, block composition, grid span, sticky, responsive, direction` |
| Dependencies | `fe.page-model, fe.state-modeling` |

## Record

Compose normalized Blocks by task priority, information weight, density, comparison need, persistence, and responsive transformation. Do not select an archetype and force content into it.

## Composition decisions

Begin with semantic reading order and one dominant task path. Give primary dense content more space than short supporting data. A `2 + 1` grid is justified only when the wide Block owns the main task, the narrow Block remains useful beside it, and both satisfy minimum readable widths. Equal peers use equal tracks. Sparse supporting facts must not stretch into a visually dominant empty surface.

Separate two dense subjects when they have distinct decisions, states, or scan patterns. Use tabs only for same-page peer panels that are mutually exclusive and do not need side-by-side comparison. Use collections when items share one schema and repeated action model. Use nested surfaces only when the child has a distinct collection or interaction boundary; decoration alone is insufficient.

Sticky is allowed when a long primary task repeatedly needs bounded supporting reference or action. Declare scroll owner, offset, height bound, focus behavior, overflow behavior, and compact fallback. Compact layouts are static unless a smaller persistent pattern is proven safe.

## Directions

Produce two or three materially different layout directions. Each includes page regions, block placement/order/span, global refs, wide/intermediate/compact transformations, state visibility, action reachability, reasons, and trade-offs. A direction differs by composition or interaction strategy, not color or minor spacing. Stop for the layout approval checkpoint.
