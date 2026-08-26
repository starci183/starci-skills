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
- Render repeated label-value facts that share one reading job through `SurfaceListCard`; the list owns one labelled shell, joined rows, and their separators. A generic `SurfaceCard` with hand-spaced rows is not the same object.
- Keep a compact state legend as a legend, not a data list. Every state needs a visible semantic mark attached to its text label; labels alone name states but do not demonstrate how to recognize them in the controlled object.
- Make legend marks correspond to the actual controlled states. If answered, current, and future controls do not remain distinguishable without reading the legend text, the state mapping is incomplete.
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

Verify zero, one, many, long row, mixed states, interactive/static, expanded, loading, partial, error, selected, keyboard, and narrow-screen fixtures. Prove the exact branch and contract identity in the DOM, then confirm the owned anatomy and state distinctions in a rendered viewport.

## Reject

Reject card-per-row decoration, a generic surface substituted for a joined collection, label-only legends, unstable status position, unlimited rendering without an owner, and hidden essential row actions.
