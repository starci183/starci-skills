---
id: fe-patterns-vendor-boundary-index
title: INDEX.md
slug: /gates/patterns/vendor-boundary
sidebar_label: vendor-boundary
sidebar_position: 0
description: Binding rules for which files may own a component-library primitive, and what every other file must compose instead.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `vendor-boundary`

## Law

Vendor ownership is a **closed list**. A file may import the component library only if it is one of:

- a **leaf**, which owns a closed primitive;
- one of the **covering shells** — `ModalShell`, `DrawerShell`, `DropdownShell` — which own closed
  vendor mechanics and hold the only uninterpreted `children` slots, plus the **framework shell**
  `RouteShell`, which owns the same slot for a route segment and imports no vendor at all;
- one of the **named surface branches** — `SurfaceCard`, `SurfaceAccordionCard`, `SurfaceListCard`,
  `SurfaceFormCard` — which own a vendor wrapper they project a typed content contract into.

Everything else composes those owners. A provider standing the library up for the whole application
sits outside the component tree; that is not a component reaching for a widget.

**The boundary is checked in both directions, and the inward direction is the point.** Outward, a
component importing the library from the wrong folder is misfiled — that half is obvious. Inward, a
file sitting in a wrapper folder that wraps nothing is an ordinary component holding an exemption it
does not need, and without that check the wrapper folder becomes the place difficult things go. The
first thing to opt in is always something that was hard to place.

**This is binding, not advisory.** Every file under the component tree is either an owner on the
closed list or a composer. There is no third state, and "it only needs one small widget" is not an
exemption — it is the sentence that opens a fourth owner.

## Situation Codes

Every situation this module governs carries a code, `VENDOR-<n>`. The code names the SITUATION; the
columns name what that situation requires and what it forecloses.

| Code | Requires | Forbids |
|---|---|---|
| `VENDOR-1` | Every vendor primitive has one named owner on the closed list | A vendor import from any file outside `leaves/`, the four shells, or the named surface branches |
| `VENDOR-2` | `shells/` holds only `ModalShell`, `DrawerShell`, `DropdownShell`, `RouteShell`, and each covering shell actually wraps a vendor primitive | A fifth shell folder; a shell that imports nothing and is therefore an ordinary branch in a privileged tier |
| `VENDOR-3` | A surface branch keeps a typed interior: `contract + render` | Importing the vendor Card or Accordion as a licence to take React `children` |
| `VENDOR-4` | The named surface branch owns its vendor wrapper directly | A `CardShell`; wrapper syntax such as `Card > Card.Content` promoted into a mechanics policy of its own |
| `VENDOR-5` | The glyph library keeps a boundary of its own, owned by the sibling icon module | Treating a glyph package as covered by this law because it is also a vendor |
| `VENDOR-6` | `ModalShell` keeps exactly one zero-inset vendor body around its uninterpreted children | A second content surface inside the dialog; vendor body padding stacked on contract padding |
| `VENDOR-7` | The house Field fixes the bounded-surface input variant | An appearance slot handed to callers; the default field surface returning inside a dialog or card |
| `VENDOR-8` | An overlay draws headings, spacing, rows and controls directly | An overlay mounting a named surface branch — the overlay is already the bounded object |
| `VENDOR-9` | Field labels are text-only | A decorative glyph inferred from the input kind and placed before the label |
| `VENDOR-10` | `TextLink` wraps the vendor Link primitive, which owns navigation semantics, keyboard handling, focus and hover | A raw button plus a hand-written `hover:underline` imitating a link |
| `VENDOR-11` | `DropdownShell` alone imports the vendor Dropdown and expands typed section/item data plus one action dispatcher into trigger/popover/menu/section/item mechanics; the account block owns the guest sentence, the grouping and the auth choices; the nav composes the block | The account block importing the vendor or reassembling shell Section/Item pieces; the nav faking the control with a direct icon action; the account press jumping straight into one auth mode |
| `VENDOR-12` | Auth projection has one zero-inset host: the shell supplies the scroll body, the panel owns `centred-page-column`, the overlay projects with `ContractContent` | Re-wrapping the projection in `Tree`; adding `py-*`, `pt-*` or `pb-*` to `centred-page-column` |
| `VENDOR-13` | A vendor compound control keeps its required anatomy: `Content` wraps `Control`, which wraps `Indicator`, and the visible label sits inside `Content` | Control and Content as siblings; label text passed to the root, which can preserve an accessible name while drawing no box |
| `VENDOR-14` | Internal navigation is an action: the pure component reports an id or `on.press`, and the connected owner keeps the path and calls the router | `href` for an internal destination, including brand, navbar, tabs and legal copy; an `href` field declared at all on an internal-only leaf |

Two codes name an **absence** rather than a value. `VENDOR-4` says a file must not exist, and
`VENDOR-14` says a field must not be declared. Both are real situations a reader has to be able to
cite: a rule that can only describe what is present cannot correct what somebody added.

## Tầng giữ

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes
the wrong value impossible to write; `enforced` means a rule in
[`sources/fe/vendor-boundary.mjs`](../../../../sources/fe/vendor-boundary.mjs) reports it, named below;
`documented` means nothing mechanical holds it and only a reader does.

| Code | Tier | What holds it |
|---|---|---|
| `VENDOR-1` | `enforced` | `vendor-boundary`, message `outside`. Holds the FOLDER half — a vendor import outside the closed list. The word "one" is not held: two leaves may both own the same primitive and nothing reports it. |
| `VENDOR-2` | `enforced` | `vendor-boundary`, messages `unknownShell` (a fifth folder under `shells/`) and `emptyShell` (a covering shell importing no vendor, with `RouteShell` exempt because its mechanic is the framework's). |
| `VENDOR-3` | `documented` | No rule in this file. A sibling module's `no-children-slot` holds the `children` half; the "importing Card does not grant it" half — the reasoning a reader needs — is held by nobody here. |
| `VENDOR-4` | `enforced` | `vendor-boundary`. A `shells/CardShell/` folder reports `unknownShell`; a `CardShell` anywhere else reports `outside` the moment it imports the vendor. |
| `VENDOR-5` | `documented` | Deliberately. This file names one vendor package and protects one vendor; the glyph library belongs to the sibling icon module. Nothing here fires for a glyph import, by design and at a known cost. |
| `VENDOR-6` | `enforced` | `modal-shell-owns-scroll-body`, messages `missing` (no vendor body) and `inset` (a body whose `className` is not exactly `p-0`). |
| `VENDOR-7` | `documented` | `field-input-uses-secondary-variant` exists and would hold this — but it scopes itself to `src/components/leaves/Field/index.tsx`, a path the tree does not have. The rule returns early for every file, so at present nothing fires. See `audit.md`. |
| `VENDOR-8` | `enforced` | `no-surface-branch-in-overlay`, message `nested`, on any import of the four named surface branches from a file under `overlays/`. |
| `VENDOR-9` | `documented` | `field-label-is-text-only` exists and would hold this — but it is scoped to the same absent `leaves/Field/index.tsx`. Nothing fires. See `audit.md`. |
| `VENDOR-10` | `enforced` | `text-link-uses-hero-link`, messages `missing` (no vendor Link import) and `handmade` (a raw `button`, or a `className` containing `hover:` or `underline`). |
| `VENDOR-11` | `enforced` | `account-control-owns-dropdown`, messages `dropdown`, `shell`, `vendor`, `menu`, `direct`, `pieces`. Holds every structural half. The product half — that the press reveals a guest summary rather than entering one auth mode — is held only by `direct`, which forbids the shortcut without describing the replacement. |
| `VENDOR-12` | `enforced` | `auth-overlay-owns-single-content-host`, messages `duplicate` (a `Tree` import), `missing` (no `ContractContent`) and `inset` (`py`/`pt`/`pb` on the `centred-page-column` contract entry). |
| `VENDOR-13` | `enforced` | `checkbox-keeps-compound-anatomy`, message `anatomy`. Holds one control at one path; the general sentence "a compound control keeps its anatomy" is held for the checkbox only. |
| `VENDOR-14` | `enforced` | `no-internal-starci-href`, messages `internal` (a literal internal `href`, as attribute or object property) and `leaf` (an `href` declared or rendered on a named internal-only leaf). |

Ten codes are held by a rule; four are held by a reader. The four are not a backlog to be silently
closed — two of them (`VENDOR-3`, `VENDOR-5`) are deliberate, and two (`VENDOR-7`, `VENDOR-9`) are a
defect this module records rather than hides.

## Anchor

A law that cannot be pointed at in real code is a proposal. Paths are relative to the front-end
component tree.

| Code | Anchor | What to look for |
|---|---|---|
| `VENDOR-1` | `src/components/leaves/Button/index.tsx` | The vendor import sits in a leaf. The identical import placed in an ordinary branch is the reported case. |
| `VENDOR-2` | `src/components/shells/` | Exactly four folders: `ModalShell`, `DrawerShell`, `DropdownShell`, `RouteShell`. The first three each import the vendor; the fourth imports none, which is why the rule exempts it explicitly. |
| `VENDOR-3` | `src/components/branches/SurfaceListCard/index.tsx` | The vendor wrapper is imported, and the interior is still `contract + render` — no `children` parameter, no `children` property in the data type. |
| `VENDOR-4` | `src/components/branches/SurfaceCard/index.tsx` | The `Card > Card.Content` wrapper is owned here, inside the named branch. There is no `shells/CardShell/` beside it; that absence is the other half of the anchor. |
| `VENDOR-5` | `src/components/leaves/Icon/index.tsx` | The glyph package is imported in this leaf and nowhere else — enforced by the sibling icon module, not by this one. |
| `VENDOR-6` | `src/components/shells/ModalShell/index.tsx` | One `Modal.Body` with `className="p-0"` wrapping the uninterpreted children, and nothing else claiming to be a content surface. |
| `VENDOR-7` | **neo lệch** — the law is anchored at `src/components/leaves/Input/index.tsx`, where the vendor input is hard-coded to the bounded-surface variant, and at `src/components/composites/Field/index.tsx`, whose data type exposes no appearance prop. The lint rule watches `leaves/Field/index.tsx`, which does not exist. Listed in `audit.md` under "Rủi ro còn mở". |
| `VENDOR-8` | `src/components/overlays/**` | No file imports `SurfaceCard`, `SurfaceAccordionCard`, `SurfaceListCard` or `SurfaceFormCard`. |
| `VENDOR-9` | **neo lệch** — the law is anchored at `src/components/composites/Field/index.tsx`, where the label leaf is mounted with resolved copy and no `icon`, even though that leaf accepts one. The lint rule watches the same absent `leaves/Field/index.tsx`. Listed in `audit.md`. |
| `VENDOR-10` | `src/components/leaves/TextLink/index.tsx` | The vendor `Link` is imported at the top of the file, and no local `hover:` or `underline` class is written. |
| `VENDOR-11` | `src/components/shells/DropdownShell/index.tsx`, `src/components/blocks/auth/AccountMenu/component.tsx`, `src/components/layouts/ShellNav/component.tsx` | The vendor `Dropdown` appears in the shell only; the block imports the shell and passes typed section data; the nav imports the block and its account control carries no action of its own. |
| `VENDOR-12` | `src/components/overlays/auth/SignInOverlay/component.tsx`, `src/components/contracts/index.ts` | The overlay renders `ContractContent` and imports no `Tree`; the `centred-page-column` contract entry carries no `py`, `pt` or `pb`. |
| `VENDOR-13` | `src/components/leaves/Checkbox/index.tsx` | `Content` wrapping `Control` wrapping `Indicator`, with the visible label inside `Content`. |
| `VENDOR-14` | `src/components/leaves/NavLink/index.tsx`, `src/components/leaves/SeeMoreLink/index.tsx` | Neither data type declares `href`; both report a press, and the path is resolved by the connected owner. |

## Inputs

| Input | Evidence required |
|---|---|
| file path | Which tier the file sits in, read from the path — leaf, shell, surface branch, branch, block, composite, overlay, layout, page |
| import source | Whether the module named is the component library, subpaths included |
| tier permission | Whether that path appears on the closed owner list |
| interior shape | Whether the file takes `children` or `contract + render` |
| destination | For a navigation control: internal to the application, or a foreign origin |
| ownership split | For a compound control: which file owns vendor mechanics and which owns product meaning |

## Invariants

- The owner list is closed. Adding to it is a rule change recorded in `changelog.md`, never a local decision.
- The boundary is symmetric: a non-owner importing the vendor is a defect, and an owner importing nothing is the same defect seen from the other side.
- A vendor wrapper does not widen an interior. Owning `Card` grants a wrapper, not a `children` hole.
- One vendor primitive is expanded in one place. Callers pass typed data, never reassembled vendor anatomy.
- A vendor body and a contract do not both claim the inset.
- Vendor mechanics and product meaning are different owners, even when they draw one control.
- A compound control is complete only at its required nesting; a queryable accessible name is not proof it drew anything.
- Internal navigation is an action; `href` is reserved for destinations outside the application.
- Each vendor package is protected by exactly one rule module. A package no module names is unprotected, and the gap between two modules is where an unowned import lands.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Outside the component tree.** `VENDOR-1` does not apply to a provider that stands the library up
  for the whole application. Configuring a library once is a different act from a component reaching
  for a widget.
- **Test files.** A `.test.` or `.spec.` file is exempt from the inward half of `VENDOR-1`/`VENDOR-2`;
  a test that mounts a primitive is not an ordinary component claiming a tier.
- **The framework shell.** `RouteShell` satisfies `VENDOR-2` while importing no vendor, because the
  mechanic it owns belongs to the framework: a route segment layout is handed its page as `children`,
  no tier below a shell may take one, and a server component cannot convert it because a function
  does not serialise across that boundary. Demanding a vendor import there would force an import that
  means nothing.
- **Foreign destinations.** `VENDOR-14` does not apply to a destination outside the application. A
  real outbound URL is an `href`, and forcing it through the router would be the mirror-image error.
- **A separate action, not a decoration.** `VENDOR-9` admits a glyph that owns its own action, such
  as revealing a password. The action owns it; the label never does.

## Output

```text
file: <path under the component tree>
tier: <leaf | covering shell | framework shell | surface branch | composer>
situation: <VENDOR-1 … VENDOR-14>
verdict: <owner | composer | defect>
holder: <rule name | reader>
reason: <the fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module governs which files may own a component-library primitive inside one front-end component
tree. It names no product and no library brand. Anchors cite real paths because a pattern module owes
a place to check; every worked example is ordinary TSX importing a placeholder vendor module.

It does not govern the glyph library — that boundary is `VENDOR-5`'s deliberate hand-off to the
sibling icon module — and it does not govern what a contract contains, only who may hold a vendor
one.

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published
name, plugin prefix and all, because that is the exact string a build log prints and a disable
comment carries. A citation that cannot be pasted into a search is not a citation. What the ban
above forbids is PROSE and EXAMPLES that need a product to be understood - never an identifier
somebody will read in a failure and have to look up.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`. A
new code, a removed code, or a change to the closed owner list is a rule change. Renumbering an
existing code is never permitted: the codes are cited from other law files and from task records, and
a silent renumber breaks a citation somebody already made.
