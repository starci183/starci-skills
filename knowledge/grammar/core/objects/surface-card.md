# Core object: SurfaceCard

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-object-surface-card` |
| Contract revision | `7.6.0` |
| Package | `@starci/grammar/core` |
| Operators | `fe/authority-reconcile` |
| Search tags | `SurfaceCard, surface, header, body, footer, density, sticky` |
| Dependencies | `fe.grammar-core-overview, fe.grammar-common-capabilities` |

## Responsibility

SurfaceCard owns one coherent block-level boundary. It may coordinate its declared header, body, supporting facts, status, and actions, but it cannot become a wrapper for unrelated content.

## Render rules

- Use Core's exact radius, border, elevation, background, and spacing interface.
- `single-block`: one functional Block owns the surface and one card body with `p-4`.
- `compound-block`: two or more distinct functional child Blocks share one relationship; the outer
  surface owns `p-0`, every child owns `p-3`, and adjacent children meet through exactly one divider.
  Children do not add Card frames, duplicate outer radius/elevation, or insert a gap across the shared
  divider.
- External section labels stay outside unless the card interface explicitly owns them.
- Keep header, content, facts, and actions in stable regions.
- Group a title with its explanatory sentence before separating the next action; in Core's compact card rhythm the copy group uses `gap-2`, while the action boundary remains visibly stronger.
- Use whitespace before adding an internal boundary.
- Equal card height is required only when comparison or action alignment materially benefits.
- Loading, empty, error, and partial replace only the region they own.

## Density

Divide content by responsibility, not arbitrary length. Compound mode is justified by distinct
functional Blocks that share one outer relationship; prose sections that merely need scanning remain
one single-block body with headings/facts. A child collection or interaction with its own focus,
selection, state, or overflow may bind its declared nested interface without becoming another Card.

## Responsive

Preserve content/action order. A sticky variant must name its scroll owner and usually becomes inline on narrow screens. Do not keep desktop min-height when it produces empty mobile space.

## Proof

Verify short, long, media, actionless, multi-action, loading, empty, error, partial, equal-peer, sticky, and narrow-screen fixtures.

## Reject

Reject decorative card nesting, a compound `p-4` outer moat, a single block fragmented into `p-3`
children, missing/doubled dividers, child Card frames, arbitrary elevation, competing padding owners,
unrelated responsibilities, and global CSS structural overrides.
