# Grammar Common states and accessibility

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-common-states-accessibility` |
| Contract revision | `7.6.0` |
| Package | `@starci/grammar/common` |
| Operators | `fe/authority-reconcile` |
| Search tags | `neutral state, loading, empty, error, focus, keyboard, accessibility` |
| Dependencies | `fe.grammar-common-capabilities` |

Grammar renders neutral presentation state. The application owns the mapping from business state.

| State | Grammar responsibility |
| --- | --- |
| `neutral` | No positive, negative, selected, or progress claim. |
| `affirmative` | Generic positive or satisfied treatment. |
| `negative` | Generic failed, destructive, or invalid treatment. |
| `pending` | Work or resolution has not completed. |
| `selected` | Object is the current choice. |
| `disabled` | Interaction is unavailable. |
| `loading` | Content or action is resolving. |
| `empty` | Collection has no renderable items. |

Never let Grammar decide that `affirmative` means paid, verified, approved, completed, entitled, or successful.

For every interactive object verify semantic element, accessible name, label/description association, keyboard model, focus entry and return, disabled versus read-only behavior, reduced motion, and state announcement. Color, contour, shadow, motion, or rotation cannot be the only state signal.

Complex states:

- Initial loading uses a skeleton only while content geometry is unresolved and no stable content is
  available. A background refresh preserves usable settled content and identifies only the updating
  owner; a mutation never turns unrelated content back into skeletons.
- Settled zero-data is `empty` and renders one nonblank `EmptyState` at the collection or region
  owner, with explanation and an authority-backed next action when one exists. It is never represented
  by a lingering skeleton, missing rows, or an empty framed shell.
- Mutation pending belongs to the triggering action, preserves its label and geometry, prevents
  duplicate activation, and exposes an announced busy state. The selected package binds this to its
  declared pending Button interface; it is not a page-loading state.
- Partial preserves usable content and identifies only the unresolved region.
- Error identifies consequence and recovery at the owning boundary.
- Mixed row states use a stable position and consistent treatment.
- Hidden or collapsed content cannot retain accidental focus or announce irrelevant updates.
