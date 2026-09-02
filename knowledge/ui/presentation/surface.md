# Surface presentation

This file answers one question: given a region the application already decided to render, which
semantic surface token does that region take, and which foreground token pairs with it?

A surface and its foreground always travel together. The application never picks a background alone,
because a background chosen without its paired foreground leaves the copy on top of it unmeasured,
which is a contrast defect rather than a preference. Paint inside a Grammar object belongs to
Grammar; this file resolves only the faces the application owns.

## Catalog

Surfaces have no value ramp, so the rule ID is an address over semantic faces rather than a position
on a scale. Prefer the earliest rule that works: no surface before the card face, the card face
before a secondary band, a neutral band before a meaningful one.

| Rule | Surface | Paired foreground | Carries |
| --- | --- | --- | --- |
| SURFACE-1 | none, transparent | inherited | Content that already sits on someone else's face |
| SURFACE-2 | `--surface` | `--surface-foreground` | The face of one bounded object |
| SURFACE-3 | `--surface-secondary` | `--foreground` | A neutral band inside a joined surface |
| SURFACE-4 | `--accent-soft` | `--accent-soft-foreground` | A band the product deliberately raises |
| SURFACE-5 | `--success-soft` | the foreground of the band it replaces | A proven outcome |
| SURFACE-6 | `--accent` | none, because it carries no copy | A decorative slab |

`--surface`, `--surface-secondary` and `--accent` are base theme tokens; `--accent-soft` and
`--success-soft` and their `-foreground` partners are derived from `--accent` and `--success` on the
same element, so overriding a base moves the whole family. Nothing on this list may be reproduced as
a hex value, an `oklch()` literal, or a palette step, even when the literal matches the token.

## Owner

Each case names who owns the face. The owner decides whether the application writes a class at all.

| Owner | Meaning | Application writes |
| --- | --- | --- |
| `App` | The region belongs to the application | The class pair |
| A component name | Grammar already paints this face | Nothing. Pass the prop |
| `—` | Grammar exposes no public path for this face | The class pair, recorded as a workaround |

Writing a class where a component is the owner is `APP_REIMPLEMENTATION`. Writing one where the owner
is `—` stays linked to `COMMON_CAPABILITY_MISSING`. Reaching into a Grammar component with a selector
or a passed class to repaint it is `APP_OVERRIDE`.

## Surfaces Common already owns

Check this table before writing any surface. If the face appears here, the application composes the
component and writes nothing.

| Common component | Face it paints | Rule |
| --- | --- | --- |
| `SurfaceCard` | `--surface` with `--surface-foreground` | SURFACE-2 |
| `SurfaceCard` at `frame="frameless"` | transparent, colour inherited | SURFACE-1 |
| `SurfaceListCard` and `SurfaceAccordionCard` | The same card face as `SurfaceCard` | SURFACE-2 |
| `MediaFrame` viewport | `--surface-secondary` | SURFACE-3 |
| `MediaFrame` at `treatment="plain"` | transparent | SURFACE-1 |
| `SurfaceCard` at `interaction="whole-action"`, hovered or focused | `--accent-soft` | SURFACE-4 |
| `Tooltip` content | `--foreground` inverted against `--background` | off catalog |
| `NavigationFeatureNav`, `Subnav`, `ChatWorkspace` | `--background` with `--foreground` | off catalog |
| `MarkdownArticle` inline code | `--muted-surface` | off catalog |
| `FencedCodeBlock` and `MarkdownTableFrame` | `--code-surface` | off catalog |

The off-catalog rows are page-chrome and content-material faces. They are named so a reader can rule
out writing anything, not so an application may reach for those tokens directly.

## SURFACE-1 — no surface / inherited foreground

The region paints nothing, because the face underneath it is already the right one and the copy
inherits the foreground that was measured against it.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Content whose visible boundaries are already drawn by its children | `SurfaceCard` | `frame="frameless"` already sets transparent and `color: inherit` |
| Case 2 | Media that must sit on the page canvas with no inset frame | `MediaFrame` | `treatment="plain"` already clears the fill and the border |
| Case 3 | An app-owned grouping container that only stacks children which each own a face | `App` | `<div className="flex min-w-0 flex-col">` with no background class |

Not this rule: a region that needs its own readable face uses SURFACE-2.

## SURFACE-2 — `bg-surface` / `text-surface-foreground`

The face of one bounded object. This is the surface a card presents to the page, and Grammar paints
it as a pair so the copy inside never has to state a colour.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | One bounded content object on the page canvas | `SurfaceCard` | Compose the card; no background class |
| Case 2 | A list or disclosure presenting the same bounded face | `SurfaceListCard`, `SurfaceAccordionCard` | Compose the card; no background class |
| Case 3 | Rows that must show the card face through a joined list at reduced alpha | `—` | `<li className="bg-surface/90">` inside a joined card body |

Not this rule: a band that must read as recessed against the card face uses SURFACE-3.

Case 3 composes two layers, so contrast is measured against the resulting pixels rather than against
`--surface` alone.

## SURFACE-3 — `bg-surface-secondary` / `text-foreground`

A neutral band inside a joined surface. It reads as recessed against the card face without claiming
any meaning of its own, so the copy on it stays at ordinary reading attention.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A summary or explanatory band running edge to edge inside a joined card | `—` | `<div className="bg-surface-secondary px-4 py-3 text-foreground">` |
| Case 2 | A full-bleed illustration band sharing that neutral face | `—` | `<div className="min-w-0 bg-surface-secondary">` with the image inside |
| Case 3 | The recessed backdrop behind framed media | `MediaFrame` | Compose the frame; no background class |

Not this rule: a band the product means to raise uses SURFACE-4, and a band reporting a proven
outcome uses SURFACE-5.

The theme also publishes `--surface-secondary-foreground`, but the bands above pair the secondary
face with `--foreground`. The two resolve to the same value in both themes, so the pair is recorded
as it is written rather than corrected here.

## SURFACE-4 — `bg-accent-soft` / `text-accent-soft-foreground`

A band the product deliberately raises. Accent is scarce: repeated across every peer band it stops
marking anything, and the raised band still has to say in words why it is raised.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | One summary band inside a joined card that the product ranked above its peers | `—` | `<div className="bg-accent-soft px-4 py-3 text-accent-soft-foreground">` |
| Case 2 | A leading marker inside a raised region, taking the paired foreground alone | `—` | `<Icon className="text-accent-soft-foreground" />` on the raised band |
| Case 3 | A card whose whole face responds to hover or keyboard focus | `SurfaceCard` | `interaction="whole-action"` already swaps the face |

Not this rule: a full-strength accent slab under copy. Use SURFACE-6 only where no copy sits on it.

A raised band that omits `text-accent-soft-foreground` leaves its copy on the inherited foreground of
whatever face it replaced, which is the defect this rule exists to prevent.

`--accent-soft` is a `color-mix` of `--accent` toward transparent, so the band is translucent and the
face beneath it shows through. Contrast on this rule is therefore measured against the composed
pixels, never against the token.

## SURFACE-5 — `bg-success-soft` / the foreground of the band it replaces

A band reports a proven outcome by exchanging its neutral face for the status face, and keeps the
foreground the neutral band already established.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A band whose outcome is settled and evidenced, not merely promised | `—` | The neutral band class followed by `bg-success-soft` |
| Case 2 | The same band before the outcome is proven | `—` | Stay on SURFACE-3; do not pre-paint the result |

Not this rule: colour as the only carrier of the outcome. The band still states the outcome in words,
and status colour is never chosen as a text tone.

The status face is exchanged without a matching foreground swap, so the pair is `--success-soft` under
`--foreground`. That composition has to be measured, not assumed, in both themes.

## SURFACE-6 — `bg-accent` / no paired foreground

A decorative slab at full accent strength. It is admissible only because nothing readable sits on it,
which is also why it names no foreground.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A hero band carrying one decorative image and no copy | `—` | `<div className="relative isolate min-h-32 overflow-hidden bg-accent">` with an `aria-hidden` image |

Not this rule: any slab carrying text, a label, or a control. Put copy on SURFACE-4 instead, where a
paired foreground exists.

## What this file does not decide

Which foreground a single line of copy takes, once its surface is settled, is [Tone](tone.md). The
edges that separate two faces are [Boundary](boundary.md). The space between a face and its content
is [Padding](padding.md), and the clipping that keeps a band inside its card is
[Overflow](overflow.md).
