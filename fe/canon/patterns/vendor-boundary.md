# vendor boundary

## Definition

Vendor ownership is a closed list:

- `leaves/` own closed primitives;
- `ModalShell`, `DrawerShell`, and `DropdownShell` own closed vendor mechanics and the only uninterpreted `children` slots;
- `SurfaceCard`, `SurfaceAccordionCard`, `SurfaceListCard`, and `SurfaceFormCard` own vendor wrappers that project a
  typed content contract into the vendor body.

Everything else composes those owners. A provider outside the component tree may stand the library
up for the app; that is not a component reaching for a widget.

What holds this law is
[`sources/fe/vendor-boundary.mjs`](../../../sources/fe/vendor-boundary.mjs).

Implementation anchors in `starci-academy-fe`: `src/components/leaves/Button/index.tsx`,
`src/components/shells/ModalShell/index.tsx`, and
`src/components/branches/SurfaceListCard/index.tsx`.

## Rules

**VENDOR-1 · Every vendor primitive has one named owner.**

**VENDOR-2 · `shells/` is closed to ModalShell, DrawerShell, and DropdownShell.** A fourth file is not
made lawful by importing the vendor.

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
bounded object. `SurfaceCard`, `SurfaceAccordionCard`, `SurfaceListCard`, and `SurfaceFormCard` belong on page ground,
not inside `overlays/**`.

**VENDOR-9 · Field labels are text-only.** Input kind does not license a decorative email, lock, or
code icon before the label. A glyph appears only when it owns a separate action, such as password
visibility, and then the action—not the label—owns it.

**VENDOR-10 · TextLink is HeroUI Link.** Navigation semantics, keyboard handling, focus and hover
belong to the vendor primitive. A raw button with a handwritten `hover:underline` class is not a
link and must not imitate one.

**VENDOR-11 · Dropdown mechanics and account meaning have different owners.** Pressing the account
icon reveals the guest summary plus Sign in and Sign up choices; it does not jump directly into one
auth mode. `DropdownShell` alone imports HeroUI Dropdown, accepts typed section/item data plus one
action dispatcher, and expands them into trigger/popover/menu/section/item mechanics. `AccountMenu`
is a block over that shell because it owns the guest sentence, grouping and authentication actions;
it must not import Section or Item pieces and assemble vendor anatomy. `ShellNav` composes the block;
it does not fake the control with a direct icon action.

**VENDOR-12 · Auth projection has one zero-inset host.** `ModalShell` supplies the zero-inset scroll
body, `AuthenticationPanel` owns `centred-page-column`, and `SignInOverlay` projects it with
`ContractContent`. Re-wrapping the projection in `Tree` duplicates the contract host; adding
`py-*`, `pt-*`, or `pb-*` to `centred-page-column` recreates the second padding band.

**VENDOR-13 · A HeroUI compound control keeps its required anatomy.** A checkbox is not complete
at `Checkbox.Root`: `Checkbox.Content` wraps `Checkbox.Control` (which wraps
`Checkbox.Indicator`) and the visible label. Control and Content as siblings may draw a tick, but
leave the visible words outside the checkbox's press target. Passing label text directly to the
root may preserve an accessible name while drawing no box at all, so neither visual nor interaction
failure can hide behind a semantically queryable control.

**VENDOR-14 · Internal StarCi navigation is an action, never an href.** Pure components report an
id or `on.press`; the connected owner keeps the path and calls `router.push`. This applies even when
the control is visually and semantically a link, including brand, navbar, tabs and legal copy.
`href` is reserved for destinations outside StarCi. Internal-only leaves such as `NavLink`,
`QuickActionRow`, `SeeMoreLink` and compound checkbox labels must not expose an `href` field at all.

## Examples

```tsx
import { Button as HeroButton } from "@heroui/react" // leaves/Button
import { Modal } from "@heroui/react"                // shells/ModalShell
import { Dropdown } from "@heroui/react"             // shells/DropdownShell
import { Card } from "@heroui/react"                 // branches/SurfaceCard
```

```tsx
// Wrong: an ordinary branch creates a new vendor owner.
import { Modal } from "@heroui/react" // branches/GenericPanel
```
