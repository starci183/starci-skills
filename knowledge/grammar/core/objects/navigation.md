# Core object: navigation and Sidebar

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-object-navigation` |
| Contract revision | `7.6.0` |
| Package | `@starci/grammar/core` |
| Operators | `fe/authority-reconcile` |
| Search tags | `navigation, Sidebar, rail, destination, selected, disclosure, mobile drawer` |
| Dependencies | `fe.grammar-core-overview, fe.grammar-common-states-accessibility` |

Navigation owns destination selection, hierarchy disclosure, and access to destinations. It never owns business workflow completion.

- Keep destination identity primary; counts and neutral states are secondary.
- Distinguish current, hover, focus, expanded, disabled, and parent-containing-current states.
- Group labels structure destinations and are not clickable unless the interface declares it.
- Collapse only when every destination remains identifiable and accessible.
- Deep hierarchy uses controlled disclosure rather than rendering every level.
- Sticky Sidebar names one scroll owner and avoids a competing page scroll.
- Wide primary navigation and a complementary rail keep separate destination/context ownership. A
  rail may collapse only when every destination remains identifiable and the compact projection is
  declared; it never silently disappears.
- When compact composition removes the desktop parent/rail orientation, render a native `TextLink`
  back to the exact parent destination. The link owns navigation; a Button with a left icon is not an
  equivalent substitute.
- Secondary rail/context actions move behind one accessible three-dot trigger into the declared
  Drawer/Sheet. The trigger names what it opens, reports expanded state, and returns focus on close.
  The Drawer owns title, secondary destinations/actions, bounded scroll, dismissal, and restoration.
- Primary compact navigation uses the declared drawer, sheet, or alternate navigation object; a
  three-dot context drawer must not impersonate the primary destination tree.

Verify long labels, deep hierarchy, current descendant, collapsed, counts, disabled, keyboard
traversal, zoom, back-link destination, three-dot open/close/focus-return, drawer scroll restoration,
and mobile transformation. Reject vanished rail responsibilities, unlabeled ellipsis controls,
Buttons used as back links, desktop nav squeezed into compact width, and journey progress represented
as route tabs or Sidebar selection.
