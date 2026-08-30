# Core object: SurfaceCard

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-object-surface-card` |
| Package | `@starci/grammar/core` |
| Operators | `grammar-convergence` |
| Search tags | `SurfaceCard, surface, header, body, footer, density, sticky` |
| Dependencies | `fe.grammar-core-overview, fe.grammar-common-capabilities` |

## Responsibility

SurfaceCard owns one coherent block-level boundary. It may coordinate its declared header, body, supporting facts, status, and actions, but it cannot become a wrapper for unrelated content.

## Render rules

- Use Core's exact radius, border, elevation, background, and spacing interface.
- External section labels stay outside unless the card interface explicitly owns them.
- Keep header, content, facts, and actions in stable regions.
- Group a title with its explanatory sentence before separating the next action; in Core's compact card rhythm the copy group uses `gap-2`, while the action boundary remains visibly stronger.
- Use whitespace before adding an internal boundary.
- Equal card height is required only when comparison or action alignment materially benefits.
- Loading, empty, error, and partial replace only the region they own.

## Density

Divide content by responsibility, not arbitrary length. If two content groups carry independent interaction or collection ownership, compose the declared nested owner. If they merely need scanning, use headings, facts, or dividers instead.

## Responsive

Preserve content/action order. A sticky variant must name its scroll owner and usually becomes inline on narrow screens. Do not keep desktop min-height when it produces empty mobile space.

## Proof

Verify short, long, media, actionless, multi-action, loading, empty, error, partial, equal-peer, sticky, and narrow-screen fixtures.

## Reject

Reject decorative card nesting, arbitrary elevation, competing padding owners, unrelated responsibilities, and global CSS structural overrides.
