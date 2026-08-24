# Core object: tables and dense comparison

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-object-tables` |
| Package | `@starci/grammar/core` |
| Operators | `grammar-convergence` |
| Search tags | `table, dense data, comparison, columns, bulk selection, sticky header` |
| Dependencies | `fe.grammar-core-overview, fe.grammar-common-case-collection-cardinality` |

Tables own comparison across aligned fields. Use a list or cards when cross-row comparison is not important.

- Put primary identity first and align comparable values.
- Associate headers with cells and preserve keyboard/focus visibility.
- Keep row actions predictable and subordinate to scanning.
- Bulk selection has one owner and visible scope.
- Define loading, empty, error, partial, and stale separately.
- Sticky headers name the scroll owner and cannot cover focused cells.
- Responsive behavior uses declared horizontal scrolling, column priority, or alternate row composition.

A mobile card transformation is accepted only when field labels remain clear and comparison semantics are no longer essential. Reject arbitrary column removal, card-per-cell rendering, hidden selection scope, and uncontrolled nested scrolling.
