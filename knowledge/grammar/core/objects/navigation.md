# Core object: navigation and Sidebar

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-object-navigation` |
| Package | `@starci/grammar/core` |
| Operators | `grammar-convergence` |
| Search tags | `navigation, Sidebar, rail, destination, selected, disclosure, mobile drawer` |
| Dependencies | `fe.grammar-core-overview, fe.grammar-common-states-accessibility` |

Navigation owns destination selection, hierarchy disclosure, and access to destinations. It never owns business workflow completion.

- Keep destination identity primary; counts and neutral states are secondary.
- Distinguish current, hover, focus, expanded, disabled, and parent-containing-current states.
- Group labels structure destinations and are not clickable unless the interface declares it.
- Collapse only when every destination remains identifiable and accessible.
- Deep hierarchy uses controlled disclosure rather than rendering every level.
- Sticky Sidebar names one scroll owner and avoids a competing page scroll.
- Mobile uses the declared drawer, sheet, or alternate navigation object.

Verify long labels, deep hierarchy, current descendant, collapsed, counts, disabled, keyboard traversal, zoom, and mobile transformation. Reject journey progress represented as route tabs or Sidebar selection.
