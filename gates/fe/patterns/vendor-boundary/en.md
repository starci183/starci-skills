---
title: Vendor boundary
---

# Vendor boundary

The input to this pattern is a shape someone already accepted — an overlay, a field, a navigation
block, a link, a card. The decision about what that shape looks like is closed. The output is source
architecture: which file holds the HeroUI import, which file holds the visible classes, what that file
must export, and what it may never receive. HeroUI owns interaction mechanics; StarCi contracts own
visible shape. A vendor import is legal only where that ownership can be named and tested.

## Law

HeroUI owns interaction mechanics; StarCi contracts own visible shape. A vendor import is legal only
where that ownership can be named and tested.

## Situation codes

| Code | Situation | What the source must look like |
|---|---|---|
| `VENDOR-1` | Any file in the component tier reaches for HeroUI | Leaves, the named mechanics branches, and the named SurfaceCard family are the only component-tier HeroUI owners. No vendor imports in blocks, layouts, overlays, pages, composites, or unrelated branches |
| `VENDOR-2` | A mechanics branch exists, or a wrapper tier is proposed | `ModalBranch`, `DrawerBranch`, and `DropdownBranch` each wrap their vendor interaction primitive. No empty mechanics branch and no `components/shells` directory |
| `VENDOR-6` | An accepted overlay scrolls its interior | `ModalBranch` owns exactly one zero-inset `Modal.Body` scroll region. No missing body, no stacked body/contract padding |
| `VENDOR-7` | The shape contains a text input | The house `Field` uses HeroUI Input `variant="secondary"`. No competing default input surface |
| `VENDOR-8` | An accepted overlay contains card-looking content | The overlay uses headings, rows, spacing, and controls directly. No second named SurfaceCard branch inside an already bounded overlay |
| `VENDOR-9` | A field wants to signal what kind of value it takes | Field labels remain textual. No decorative kind icons inferred from input type |
| `VENDOR-10` | The shape contains a link | `TextLink` wraps HeroUI `Link`. No raw-button link behaviour and no local hover/underline recreation |
| `VENDOR-11` | Navigation carries an account menu | `DropdownBranch` owns Dropdown mechanics; `AccountMenu` owns choices; `ShellNav` composes the block. No vendor anatomy leaking into the block and no direct account action in navigation |
| `VENDOR-12` | An accepted auth overlay must host content | Auth overlays project one named content contract into zero-inset `ModalBranch` mechanics. No duplicate Tree/content hosts and no second vertical inset |
| `VENDOR-13` | A checkbox carries a label | Checkbox Control and Indicator remain inside Checkbox Content. No visible label outside the checkbox press target |
| `VENDOR-14` | The shape navigates inside StarCi | Internal navigation reports an action to connected routing code. No internal StarCi `href` values in leaves or components |

This module publishes eleven codes. The numbers `VENDOR-3`, `VENDOR-4` and `VENDOR-5` are not
published here; do not invent them to fill the gap.

## Reading an accepted shape

1. Read what the shape states: which surface it is, what it contains, how it opens and closes, what
   the reader can press.
2. Name what the shape does not state. A shape does not state which file holds the HeroUI import,
   which layer holds the padding, or what the component exports. Those are not resolved by the shape
   and must be resolved by these codes.
3. Resolve outermost first. The overlay or navigation container resolves before the rows inside it,
   because the outer resolution decides whether an inner one is already bounded.
4. Ask each code's question in turn: does this shape contain a vendor mechanic, a scroll region, an
   input, a card-looking region, a link, an account menu, a checkbox, or internal navigation?
5. When two codes both match, they are not alternatives — each names a different file. `VENDOR-2` and
   `VENDOR-6` both bind the same `ModalBranch`: one says it must wrap the vendor primitive, the other
   says its `Modal.Body` is zero-inset and singular. Apply both. Only where a code says a thing is
   *already bounded* — `VENDOR-8` inside an overlay — does an outer resolution stop an inner one.

## `VENDOR-1` — Component-tier vendor owners

**Situation.** Any component-tier file in the accepted shape needs HeroUI.

**What it emits in source.** The HeroUI import lands in a leaf, in one of the named mechanics
branches, or in the named SurfaceCard family — nowhere else. Every other file in the shape receives
the result of those owners, not the vendor anatomy.

**Recognition signs.** A `@heroui/react` import inside a block, layout, overlay, page, composite, or a
branch that is not a named mechanics owner.

**Boundary.** This is not `VENDOR-2`. `VENDOR-1` asks where a vendor import may live at all;
`VENDOR-2` asks whether a file that claims mechanics ownership actually owns a mechanic.

**Common business situations.** A marketing block reaches for a HeroUI Button; a page pulls a HeroUI
Card to lay out a summary; a feature branch imports a vendor Chip because it is quicker than adding a
leaf.

## `VENDOR-2` — Named mechanics branches

**Situation.** The shape opens, dismisses, portals or places something, or someone proposes a generic
wrapper tier for it.

**What it emits in source.** `ModalBranch`, `DrawerBranch`, and `DropdownBranch`, each wrapping its
vendor interaction primitive. No empty mechanics branch, and no `components/shells` directory — every
such directory is drift and is deleted.

**Recognition signs.** A branch in the mechanics position with no vendor import; a new folder created
to hold "wrappers"; a `components/shells` path reappearing.

**Boundary.** This is not `VENDOR-1`. `VENDOR-1` polices files that import vendor without the right;
`VENDOR-2` polices files that hold the right and import nothing — the privilege without the mechanic.

**Common business situations.** A drawer added for mobile filters; a dropdown added for a language
switch; a refactor that proposes a shared wrapper layer "so overlays are consistent".

## `VENDOR-6` — One zero-inset modal body

**Situation.** The accepted overlay has an interior that scrolls.

**What it emits in source.** `ModalBranch` holds exactly one `Modal.Body` and that body carries zero
inset; the padding stays in the contract. Neither a missing body nor stacked body-and-contract padding
is acceptable.

**Recognition signs.** Two scroll regions in one overlay; `className="p-4"` on `Modal.Body`; content
placed directly in `Modal` with no body.

**Boundary.** This is not `VENDOR-12`. `VENDOR-6` binds the mechanics file's body and inset;
`VENDOR-12` binds what an auth overlay projects into that body.

**Common business situations.** A long terms overlay that must scroll; a checkout overlay whose footer
must stay put; a form overlay where the designer's spacing was pushed into the vendor body.

## `VENDOR-7` — House field surface

**Situation.** The shape contains a text input.

**What it emits in source.** The house `Field`, using HeroUI Input `variant="secondary"`. No competing
default input surface is introduced beside it.

**Recognition signs.** A second input component with its own default surface; a HeroUI Input used at a
different variant to get a different look.

**Boundary.** This is not `VENDOR-9`. `VENDOR-7` binds the input surface; `VENDOR-9` binds what the
label may show.

**Common business situations.** A search box that "needs to look lighter"; a settings form that
introduces its own input to match a mock; a vendor Input dropped straight into a block.

## `VENDOR-8` — Overlay content is already bounded

**Situation.** The accepted overlay contains content that looks like a card.

**What it emits in source.** The overlay uses headings, rows, spacing, and controls directly. No
second named SurfaceCard branch is placed inside an overlay that is already bounded.

**Recognition signs.** A `SurfaceCard` rendered inside a modal or drawer; a visible border inside a
surface that already has one.

**Boundary.** This is not `VENDOR-1`. `VENDOR-1` would allow the SurfaceCard family to import vendor;
`VENDOR-8` says that even a legal owner does not belong inside an already bounded overlay.

**Common business situations.** A confirmation overlay wrapping its summary in a card; a drawer whose
sections were each given a card; a mock that drew a card because the overlay chrome was not in frame.

## `VENDOR-9` — Textual field labels

**Situation.** A field wants to signal what kind of value it takes.

**What it emits in source.** The label stays textual. No decorative kind icon is inferred from the
input type.

**Recognition signs.** A mail glyph beside an email field; a lock glyph beside a password field, added
by type rather than by meaning.

**Boundary.** This is not `VENDOR-7`. `VENDOR-7` binds the input surface itself; `VENDOR-9` binds the
label beside it.

**Common business situations.** A sign-in form decorated to look friendlier; a profile form where each
field was given a matching glyph; an imported design system whose fields ship icons by default.

## `VENDOR-10` — Links go through TextLink

**Situation.** The shape contains a link.

**What it emits in source.** `TextLink`, wrapping HeroUI `Link`. No raw-button link behaviour and no
local recreation of hover or underline.

**Recognition signs.** A button styled to look like a link; a local `hover:underline` on an anchor; an
anchor that reimplements the link's visited and hover treatment.

**Boundary.** This is not `VENDOR-14`. `VENDOR-10` binds what a link is made of; `VENDOR-14` binds
whether an internal destination may appear as an `href` at all.

**Common business situations.** A footer full of hand-styled anchors; a "learn more" rendered as a
ghost button; an inline link inside prose recreated with local classes.

## `VENDOR-11` — Account menu composition

**Situation.** Navigation carries an account menu.

**What it emits in source.** Three files with three jobs: `DropdownBranch` owns Dropdown mechanics,
`AccountMenu` owns the choices, `ShellNav` composes the block. Vendor anatomy does not leak into the
block, and navigation performs no direct account action.

**Recognition signs.** Dropdown item anatomy written inside `ShellNav`; a sign-out call made directly
from the navigation layout.

**Boundary.** This is not `VENDOR-2`. `VENDOR-2` only requires that `DropdownBranch` own a mechanic;
`VENDOR-11` additionally splits choices and composition into their own files.

**Common business situations.** Adding a "switch workspace" entry; adding sign-out to the header;
moving the avatar menu into a new navigation design.

## `VENDOR-12` — Auth overlay projection

**Situation.** An accepted auth overlay must host content.

**What it emits in source.** One named content contract, projected into zero-inset `ModalBranch`
mechanics. No duplicate Tree or content hosts, and no second vertical inset.

**Recognition signs.** Two content hosts in one auth overlay; a wrapper `div` adding vertical padding
on top of the contract's own.

**Boundary.** This is not `VENDOR-6`. `VENDOR-6` binds the body and its inset in the mechanics file;
`VENDOR-12` binds the auth overlay's content to a single named contract projection.

**Common business situations.** Sign-in and sign-up sharing one overlay; a forgot-password step added
inside the same modal; an OTP step given its own host beside the existing one.

## `VENDOR-13` — Checkbox label inside the press target

**Situation.** A checkbox carries a label.

**What it emits in source.** Checkbox Control and Indicator remain inside Checkbox Content. The
visible label is never placed outside the checkbox press target.

**Recognition signs.** A label rendered as a sibling of the checkbox; a row where only the small box
responds to a press.

**Boundary.** This is not `VENDOR-9`. `VENDOR-9` concerns what a field label may show; `VENDOR-13`
concerns where a checkbox label physically sits relative to the press target.

**Common business situations.** A terms-acceptance row; a filter list of checkboxes with labels laid
out in a grid; a settings toggle list rebuilt from a mock.

## `VENDOR-14` — Internal navigation is an action

**Situation.** The shape navigates somewhere inside StarCi.

**What it emits in source.** The component reports an action to connected routing code. Internal
StarCi `href` values do not appear in leaves or components.

**Recognition signs.** A hardcoded internal path in a leaf; a component importing a router to build an
internal URL string.

**Boundary.** This is not `VENDOR-10`. `VENDOR-10` says what a link is built from; `VENDOR-14` says an
internal destination is not the component's to hold.

**Common business situations.** A card that opens a course page; a breadcrumb inside a dashboard; a
CTA that moves the reader to pricing.

## Layer held

Contracts hold visible shape. Mechanics branches hold only lifecycle, focus, portal, dismiss,
placement and the HeroUI scroll region — they are three named owners, `ModalBranch`, `DrawerBranch`,
`DropdownBranch`, and they do not constitute an architectural tier of their own. Blocks, layouts,
overlays, pages and composites stay ignorant of vendor anatomy entirely: they receive results, never
imports. `ShellNav` is a product name, not an exemption from any ownership rule.

## Anchor

The rules live in `sources/fe/vendor-boundary.mjs` with their twin tests in
`sources/fe/vendor-boundary.test.mjs`. Product anchors are `src/components/branches/ModalBranch`,
`DrawerBranch`, `DropdownBranch`, the SurfaceCard family, `src/components/leaves/Field`, `TextLink`,
`Checkbox`, `src/components/blocks/auth/AccountMenu`, and `src/components/layouts/ShellNav`.

## Inputs

| Input | Evidence required |
|---|---|
| The accepted shape | The surface it is, what it contains, and how it opens, dismisses or navigates |
| The component tier position | Whether the file is a leaf, a named mechanics branch, a SurfaceCard family member, or a block/layout/overlay/page/composite |
| Existing product anchor | The path under `src/components/…` that already owns this concern, from the Anchor list |
| The rule source | `sources/fe/vendor-boundary.mjs` and its twin test `sources/fe/vendor-boundary.test.mjs` |
| Route origin, if any | Whether the value arrives from a framework route and is closed into a named contract projection before the component tier |

## Rules

1. Leaves, the named mechanics branches, and the named SurfaceCard family are the only component-tier
   HeroUI owners; vendor imports in blocks, layouts, overlays, pages, composites, or unrelated
   branches are forbidden.
2. `ModalBranch`, `DrawerBranch`, and `DropdownBranch` each wrap their vendor interaction primitive;
   an empty mechanics branch is forbidden, and so is any `components/shells` directory.
3. `ModalBranch` owns exactly one zero-inset `Modal.Body` scroll region; a missing body or stacked
   body/contract padding is forbidden.
4. The house `Field` uses HeroUI Input `variant="secondary"`; a competing default input surface is
   forbidden.
5. An overlay uses headings, rows, spacing, and controls directly; a second named SurfaceCard branch
   inside an already bounded overlay is forbidden.
6. Field labels remain textual; decorative kind icons inferred from input type are forbidden.
7. `TextLink` wraps HeroUI `Link`; raw-button link behaviour and local hover/underline recreation are
   forbidden.
8. `DropdownBranch` owns Dropdown mechanics, `AccountMenu` owns choices, and `ShellNav` composes the
   block; vendor anatomy leaking into the block or direct account action in navigation is forbidden.
9. Auth overlays project one named content contract into zero-inset `ModalBranch` mechanics; duplicate
   Tree/content hosts or a second vertical inset are forbidden.
10. Checkbox Control and Indicator remain inside Checkbox Content; a visible label outside the checkbox
    press target is forbidden.
11. Internal navigation reports an action to connected routing code; internal StarCi `href` values in
    leaves or components are forbidden.
12. Do not create a generic wrapper tier, re-export vendor anatomy, pass raw markup through component
    containers, or move visible classes out of the contract to make mechanics convenient.

## Exceptions

**Framework routes, against `VENDOR-1`.** Framework routes may receive framework content, but they
close it into a named contract projection before entering the component tier. This is a route
boundary, not a privileged component folder — the closure happens outside the component tier, and no
wrapper folder is created for it.

The v2 source records no other exception. Every other code above is closed.

## Output

One block per file the accepted shape produces.

```text
file: src/components/branches/ModalBranch/index.tsx
tier: branch (named mechanics owner)
codes: VENDOR-2, VENDOR-6
owns: HeroUI Modal lifecycle, focus, portal, dismiss, placement; exactly one zero-inset Modal.Body scroll region
imports: @heroui/react
exports: ModalBranch
forbidden: children passthrough; padding on Modal.Body; any components/shells directory
anchor: sources/fe/vendor-boundary.mjs
```

```text
file: src/components/blocks/auth/<AuthOverlay>/contract.ts
tier: block
codes: VENDOR-12, VENDOR-8
owns: the single named content contract projected into ModalBranch; all visible padding
imports: none from @heroui/react
exports: <authOverlayContract>
forbidden: duplicate Tree/content hosts; a second vertical inset; a named SurfaceCard branch inside the overlay
anchor: sources/fe/vendor-boundary.mjs
```

## Worked example

**Accepted shape.** A sign-in overlay that opens over the page, holds a scrolling column with a
heading, an email field, a password field, a "remember me" checkbox, a submit control, and a "forgot
password" link.

```text
file: src/components/branches/ModalBranch/index.tsx
tier: branch (named mechanics owner)
codes: VENDOR-2, VENDOR-6
owns: Modal open/close, focus, portal, dismiss; exactly one zero-inset Modal.Body
imports: @heroui/react
exports: ModalBranch
forbidden: children passthrough; className padding on Modal.Body
reason: this file imports and wraps the HeroUI interaction primitive, so it is VENDOR-2's owner and not a VENDOR-1 violation; and because it is the branch holding Modal.Body, the inset rule that lands here is VENDOR-6, not VENDOR-12, which binds the projected content instead
```

```text
file: src/components/blocks/auth/SignInOverlay/contract.ts
tier: block
codes: VENDOR-12, VENDOR-8
owns: one named content contract; heading, rows, spacing and controls stated directly; all vertical inset
imports: none from @heroui/react
exports: signInOverlayContract
forbidden: a second content host; a second vertical inset; a SurfaceCard branch inside the overlay
reason: the overlay is already bounded by ModalBranch, which is the fact that excludes VENDOR-8's SurfaceCard from the interior; and it is a block, which is the fact that excludes it from VENDOR-1's list of legal vendor owners
```

```text
file: src/components/leaves/Field/index.tsx
tier: leaf
codes: VENDOR-7, VENDOR-9
owns: the house input surface, HeroUI Input variant="secondary"; a textual label
imports: @heroui/react
exports: Field
forbidden: a competing default input surface; a kind icon inferred from input type
reason: a leaf is a legal VENDOR-1 owner, so the vendor import stays here rather than in the overlay; the email and password fields take no glyph because VENDOR-9 forbids inferring a decorative icon from the input type
```

```text
file: src/components/leaves/Checkbox/index.tsx
tier: leaf
codes: VENDOR-13
owns: Control and Indicator, both inside Checkbox Content
imports: @heroui/react
exports: Checkbox
forbidden: the visible "remember me" label rendered outside the press target
reason: the label belongs to the checkbox press target, which is what separates this from VENDOR-9 — that code governs a field's label content, not a checkbox label's position
```

```text
file: src/components/leaves/TextLink/index.tsx
tier: leaf
codes: VENDOR-10, VENDOR-14
owns: the wrap of HeroUI Link; reporting the forgot-password navigation as an action
imports: @heroui/react
exports: TextLink
forbidden: raw-button link behaviour; local hover/underline recreation; an internal StarCi href value
reason: the destination is internal to StarCi, which is the fact that pulls VENDOR-14 in beside VENDOR-10 — the link is built from HeroUI Link, but the internal path is reported to connected routing code rather than held here
```

**What the shape does not state, and therefore does not resolve.** The shape says nothing about which
file imports HeroUI, where the padding lives, whether the checkbox label sits inside or beside the
press target, or whether the forgot-password link carries an `href`. None of that is a design
question, so none of it is answered by the shape; each is answered by the code above that names it.

## Scope

This rule holds for any component-tier code of this kind in this stack — every leaf, branch, block,
layout, overlay, page and composite that touches HeroUI, an overlay body, an input, a link, a
checkbox, an account menu or internal navigation. It names no single feature.
