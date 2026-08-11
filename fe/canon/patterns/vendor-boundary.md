# vendor boundary

## Definition

Vendor ownership is a closed list:

- `leaves/` own closed primitives;
- `ModalShell` and `DrawerShell` own covering mechanics and the only uninterpreted `children` slots;
- `SurfaceCard`, `SurfaceAccordionCard`, and `SurfaceListCard` own vendor wrappers that project a
  typed content contract into the vendor body.

Everything else composes those owners. A provider outside the component tree may stand the library
up for the app; that is not a component reaching for a widget.

What holds this law is
[`sources/fe/vendor-boundary.mjs`](../../../sources/fe/vendor-boundary.mjs).

## Rules

**VENDOR-1 · Every vendor primitive has one named owner.**

**VENDOR-2 · `shells/` is closed to ModalShell and DrawerShell.** A third file is not made lawful by
importing the vendor.

**VENDOR-3 · Surface branches keep typed interiors.** Importing Card or Accordion does not grant
React `children`; their content remains `contract + render`.

**VENDOR-4 · No `CardShell`.** `Card > Card.Content` is wrapper syntax, not an independent mechanics
policy. The named surface branch owns it directly.

**VENDOR-5 · Glyph libraries keep their own boundary.**

**VENDOR-6 · ModalShell owns one zero-inset scroll body.** `Modal.Body` is the vendor's scroll
mechanics for the same dialog, not a second content surface. It wraps the uninterpreted `children`
with `p-0`: the mounted contract owns layout, while the shell preserves scrolling without adding a
second inset.

**VENDOR-7 · The house Field fixes the bounded-surface input variant.** Its HeroUI `Input` uses
`secondary`; callers do not receive an appearance slot and the default field surface cannot return
inside a dialog or card.

**VENDOR-8 · An overlay cannot directly mount a named surface branch.** The overlay is already the
bounded object. `SurfaceCard`, `SurfaceAccordionCard`, and `SurfaceListCard` belong on page ground,
not inside `overlays/**`.

**VENDOR-9 · Field labels are text-only.** Input kind does not license a decorative email, lock, or
code icon before the label. A glyph appears only when it owns a separate action, such as password
visibility, and then the action—not the label—owns it.

## Examples

```tsx
import { Button as HeroButton } from "@heroui/react" // leaves/Button
import { Modal } from "@heroui/react"                // shells/ModalShell
import { Card } from "@heroui/react"                 // branches/SurfaceCard
```

```tsx
// Wrong: an ordinary branch creates a new vendor owner.
import { Modal } from "@heroui/react" // branches/GenericPanel
```
