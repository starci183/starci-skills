# Layout composition

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.layout-composition` |
| Contract revision | `7.6.0` |
| Operators | `fe/request-compile` |
| Search tags | `layout, semantic block, card-first, grid span, sticky, responsive, direction` |
| Dependencies | `fe.page-model, fe.state-modeling, fe.ui` |

## Internal guidance

This record helps compile a closed layout and, when eligible, helps `generate` one dominant direction.
It is not a visible layout stage, approval checkpoint, or repair route.

Begin with semantic reading order and one dominant task path. Compose normalized Blocks by task
priority, information weight, density, comparison need, persistence, and responsive transformation;
never select an archetype and force content into it.

Use semantic card-first composition: a coherent Block receives one selected-Grammar surface when a
boundary improves ownership, while joined collections, articles, navigation, and intentionally
frameless regions keep their declared objects. A compound surface contains multiple functional child
Blocks only when one shared relationship and divider owner are real. Card-per-row and wrapper Cards
around unrelated content are invalid.

Give primary dense content more space than short supporting data. A `2 + 1` grid is justified only
when the wide Block owns the main task, the narrow Block remains useful beside it, and both meet
minimum readable widths. Equal peers use equal tracks. Sparse supporting facts do not stretch into a
dominant empty slab.

Separate dense subjects with different decisions, states, or scan patterns. Tabs are only same-page
peer panels that need not be compared simultaneously. Collections own one repeated schema/action
model. Nested surfaces require a distinct collection, focus, selection, state, scroll, or interaction
owner.

Sticky is allowed only when a long primary task repeatedly needs bounded supporting reference or
action. Declare scroll owner, offset, height/collision bound, focus, overflow, terminal clearance, and
compact static fallback. Page/content inset and peer rhythm come from the selected Grammar's page
container, not per-page invention.

One dominant generated layout records page regions, block placement/order/span, wide/intermediate/
compact transformations, state visibility, action reachability, Grammar bindings, reasons, and
trade-offs. When complete Grammar leaves several material compositions and none dominates, or the
owner explicitly asks to compare, use the three-or-four direction mode defined by
`direction.visualization`; this record never waits or routes.
