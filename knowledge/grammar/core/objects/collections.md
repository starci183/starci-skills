# Core object: collections

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-object-collections` |
| Package | `@starci/grammar/core` |
| Operators | `grammar-convergence` |
| Search tags | `list, rows, SurfaceListCard, collection, divider, row action, status` |
| Dependencies | `fe.grammar-common-case-collection-cardinality, fe.grammar-core-overview` |

## Responsibility

The collection owner controls repeated-row anatomy, separators, local state placement, row interaction, grouping, and overflow. Rows normally share one surface.

## Render rules

- Keep primary identity, supporting copy, neutral state, and row action in predictable positions.
- Use dividers or spacing from the package contract; remove orphan first/last separators.
- Render `affirmative`, `negative`, `pending`, and selected treatments only after application mapping.
- Separate static and interactive rows unless a mixed-row variant exists.
- Use a stable empty treatment owned by the collection.
- Keep row action emphasis below the collection's primary task.

## Scale

Use declared pagination, virtualization, clipping, or scrolling for unbounded data. Preserve visible selection scope and keyboard continuity through updates.

## Responsive

Wrap secondary copy while maintaining state/action alignment. Move secondary metadata only through the declared alternate row layout. Flatten borders only if row boundaries remain understandable.

## Proof

Verify zero, one, many, long row, mixed states, interactive/static, expanded, loading, partial, error, selected, keyboard, and narrow-screen fixtures.

## Reject

Reject card-per-row decoration, unstable status position, unlimited rendering without an owner, and hidden essential row actions.
