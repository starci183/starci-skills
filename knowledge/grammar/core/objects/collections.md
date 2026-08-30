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
- When that list lives inside an approved `SurfaceCard`, use `SurfaceListCard`'s `nested` interface. Core's outer card body keeps its `p-4` inset while the nested list must not add a second full card inset or compete for elevation; its row padding and separators remain owned by the collection.
- Keep a compact state legend as a legend, not a data list. Every state needs a visible semantic mark attached to its text label; labels alone name states but do not demonstrate how to recognize them in the controlled object.
- Make legend marks correspond to the actual controlled states. If answered, current, and future controls do not remain distinguishable without reading the legend text, the state mapping is incomplete.
- Use dividers or spacing from the package interface; remove orphan first/last separators.
- A disclosure collection uses the package accordion primitive so open/close motion, keyboard state, and panel lifecycle remain coherent. One separator belongs between sibling items; never draw an extra divider between an item's trigger and its own expanded panel.
- When ordered progression and current position are the comparison meaning, use progression anatomy rather than compressing a generic label-value table into a narrow disclosure. Keep identity readable, attach emphasis to the current status/value, and let the progression marker carry order without divider noise.
- Render `affirmative`, `negative`, `pending`, and selected treatments only after application mapping. The glyph, tone, and text must make the same evidenced claim; never map promises, benefits, capabilities, or future outcomes to affirmative or negative state rows for decoration. An offering may mark included benefits with a purpose-named foreground `included` glyph, but that marker is not completion or success state.
- Difficulty, tier, phase name, and other categorical metadata remain neutral unless upstream evidence declares an actual state or consequence. Current emphasis belongs on the active status/value, not on the category identity beside it.
- Separate static and interactive rows unless a mixed-row variant exists.
- Use a stable empty treatment owned by the collection.
- Keep row action emphasis below the collection's primary task.

## Scale

Use declared pagination, virtualization, clipping, or scrolling for unbounded data. When an existing primitive owns the same bounded vertical-scroll job, reuse it instead of recreating raw overflow locally; reject reuse when owner or interaction semantics differ. Preserve visible selection scope and keyboard continuity through updates.

## Responsive

Wrap secondary copy while maintaining state/action alignment. Move secondary metadata only through the declared alternate row layout. Flatten borders only if row boundaries remain understandable.

## Proof

Verify zero, one, many, long row, mixed states, interactive/static, expanded, loading, partial, error, selected, keyboard, and narrow-screen fixtures. Prove the exact branch and interface identity in the DOM, then confirm the owned anatomy and state distinctions in a rendered viewport.

## Reject

Reject card-per-row decoration, a generic surface substituted for a joined collection, a non-nested list interface inside an owning card, duplicated full-card padding, label-only legends, unstable status position, unlimited rendering without an owner, and hidden essential row actions.
