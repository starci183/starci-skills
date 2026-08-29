# Core object: tabs

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-object-tabs` |
| Package | `@starci/grammar/core` |
| Operators | `grammar-convergence` |
| Search tags | `tabs, peer content, selected tab, overflow, keyboard, unsaved panel` |
| Dependencies | `fe.grammar-core-overview, fe.grammar-common-states-accessibility` |

Tabs switch mutually exclusive peer content within one task context.

- Labels stay short, distinct, and stable.
- Selected, hover, focus, and disabled remain visually and semantically distinct.
- Keyboard movement, activation model, panel association, and focus behavior follow the exact interface.
- Overflow uses only the declared scrolling, menu, or alternate treatment.
- Hidden panels cannot retain accidental focus or announce irrelevant updates.
- Unsaved transitions are application policy and must be explicit.

Use tabs for peer views, never sequential journey steps, independent routes, completion state, or unrelated card categories. If peers exceed the package's practical capacity, change information architecture rather than shrinking labels indefinitely.
