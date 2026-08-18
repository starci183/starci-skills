# Vendor-boundary

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | the published frontend machine this record cites |

## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
whether the file was in scope at all, which published rule fired, what it reported and on which node,
which law code that maps to, and the open hatch that would have hidden the same failure. This module
chooses nothing. It refuses, and it must be able to point at the import, the path, the tag or the
class literal it refuses on.

## Law

Ownership of a vendor is held by path, by import, by JSX anatomy and by the class literal that is
required to be written. The gate exposes the strict rules implemented by
`@canon-fe`. It deliberately does not measure design by regex: the contract stays
the source of shape, and lint only blocks the source lines that can be proven wrong.

Two directions must hold at once. A vendor import under the wrong owner is reported, and a mechanics
branch that owns no vendor is reported too. `components/shells` is no longer an exemption — the mere
existence of that path is the error.

The law states **zero codes**. All ten published rules therefore have a rule and no code: identity
here is the published rule name, and there is no numeric identifier for any rule anywhere in this
module. The product law itself is written as prose in `../../patterns/vendor-boundary/INDEX.md`; every
sentence of it that no rule below names is unenforced.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `vendor-boundary` | none | `rejects` — a HeroUI import outside leaves, named mechanics branches and named SurfaceCard branches; every legacy `components/shells` file; an empty mechanics branch |
| `modal-branch-owns-scroll-body` | none | `requires` — `ModalBranch/index.tsx` must render `Modal.Body className="p-0"` |
| `field-input-uses-secondary-variant` | none | `requires` — the house Field's HeroUI Input secondary variant |
| `field-label-is-text-only` | none | `rejects` — the house Icon inside a Field label |
| `no-surface-branch-in-overlay` | none | `rejects` — a named SurfaceCard import in an overlay |
| `text-link-uses-hero-link` | none | `requires` HeroUI Link, and `rejects` handmade button/hover link behaviour |
| `account-control-owns-dropdown` | none | `rejects` — a break in DropdownBranch → AccountMenu → ShellNav ownership |
| `auth-overlay-owns-single-content-host` | none | `requires` ContractContent, and `rejects` a duplicate host/inset |
| `checkbox-keeps-compound-anatomy` | none | `rejects` — a break in Content → Control → Indicator nesting |
| `no-internal-starci-href` | none | `rejects` — internal href ownership in a governed component |

No code is left without a rule, because the gate publishes no codes at all. That cuts the other way
too: nothing in a verdict from this module can be traced to a numbered clause of the product law, and
a reader who wants the law must read the prose, not the rule list.

## Reading a diff

1. **Decide scope before anything else, and record it.** Every rule here is keyed to an owner path, a
   named file or a named component family. Out of scope does not mean the file passed — it means the
   rule did not exist for that file.
2. **Check exemptions.** There are none in code. `components/shells` was the one exemption the gate
   used to carry, and it was inverted: the path is now the failure. Do not grant one by hand.
3. **Read the nodes the rules actually read** — the file path, the import source and its specifiers,
   the JSX tag names and their nesting, and the class literal as written.
4. **Emit one block per finding**, naming the node.
5. **Write the `hatch` line** whenever an open hatch below would have hidden the same failure.
6. **Do not report what no rule watches.** The gate does not measure design, shape or composition by
   regex; a verdict that claims otherwise is wrong about the module.

## `vendor-boundary` — none

**What it reports.** `rejects`, in three separate situations: a HeroUI import made outside leaves,
named mechanics branches and named SurfaceCard branches; any file at all under the legacy
`components/shells` path; and a mechanics branch that is empty of vendor.

**How it detects.** By path and by import. The owner is decided from the file path — leaf, named
mechanics branch, named SurfaceCard branch — and the vendor is decided from the import source
`@heroui/react`. The legacy check needs no import at all: `components/shells` in the path is the whole
finding. The empty-branch check is the mirror direction, a named mechanics branch with no vendor
import in it.

**What it cannot see.** It reads one file's path and its import sources. A vendor re-exported through
a local module and imported from there is not an `@heroui/react` import in the offending file. A
renamed owner folder changes the owner without changing a line of behaviour. Whether a leaf that is
allowed to import HeroUI uses it well is not judged at all — the exact node predicate lives in
`@canon-fe` and is not published by this gate.

**Boundary.** This rule decides who may import a vendor. What the owner must then render is the
business of the anatomy and literal rules below.

## `modal-branch-owns-scroll-body` — none

**What it reports.** `requires` — `ModalBranch/index.tsx` does not render `Modal.Body className="p-0"`.

**How it detects.** By named file plus JSX anatomy plus a class literal. Scope is the one file
`ModalBranch/index.tsx`; inside it the `Modal.Body` tag must carry the literal `p-0`.

**What it cannot see.** The class must be written literally. A `p-0` composed at runtime — through a
helper, a variable, a conditional, a spread of props — is not the literal the rule looks for, and a
literal `p-0` present on the wrong element satisfies a text-shaped check while owning nothing. A
second modal branch under a different name is outside the one named file.

**Boundary.** This rule owns the scroll body only. The inset belongs to the contract, and the single
content host is `auth-overlay-owns-single-content-host`.

## `field-input-uses-secondary-variant` — none

**What it reports.** `requires` — the house Field's HeroUI Input is not on the secondary variant.

**How it detects.** By the governed Field component plus the variant written on the HeroUI Input.

**What it cannot see.** Only the house Field is governed. An Input placed outside it, or a variant
passed as a value rather than written on the element, is not the thing the rule reads.

**Boundary.** This rule judges the input's variant. The label beside it is
`field-label-is-text-only`.

## `field-label-is-text-only` — none

**What it reports.** `rejects` — the house Icon appears inside a Field label.

**How it detects.** By JSX anatomy: the Icon tag nested inside the Field's label.

**What it cannot see.** It watches the house Icon. A raw SVG, an emoji, a vendor icon or an icon
wrapped in another component are not that tag, and a namespaced tag is not the identifier the anatomy
check reads.

**Boundary.** Only the label's contents. The input beside it is
`field-input-uses-secondary-variant`.

## `no-surface-branch-in-overlay` — none

**What it reports.** `rejects` — a named SurfaceCard import inside an overlay.

**How it detects.** By path plus import: the file is an overlay, and it imports a named SurfaceCard
branch.

**What it cannot see.** The import must be the named one. A SurfaceCard reached through a re-export,
an alias or a wrapper component enters the overlay without an import the rule recognises, and a
surface reconstructed by hand inside the overlay is never a SurfaceCard import at all.

**Boundary.** This rule keeps surfaces out of overlays. Which vendor the overlay itself may import is
`vendor-boundary`.

## `text-link-uses-hero-link` — none

**What it reports.** `requires` HeroUI Link, and `rejects` handmade button or hover link behaviour
standing in for it.

**How it detects.** By import and JSX: the HeroUI Link must be the element used, and the handmade
substitutes — a button with link behaviour, hand-rolled hover behaviour — are refused.

**What it cannot see.** It recognises the shapes it names. A substitute written some other way, or one
hidden a component away, is not the node it reads, and it does not judge how the Link is styled once
it is the right element.

**Boundary.** Link behaviour only. Where the link points is `no-internal-starci-href`.

## `account-control-owns-dropdown` — none

**What it reports.** `rejects` — the ownership chain DropdownBranch → AccountMenu → ShellNav is
broken.

**How it detects.** By named components and their nesting: the dropdown mechanics live in
DropdownBranch, consumed by AccountMenu, mounted in ShellNav, and the check enforces that chain.

**What it cannot see.** It reads the chain by name. An intermediate wrapper, a rename of any link in
the chain, or a dropdown assembled from vendor parts under some other component leaves the named chain
intact while the ownership it stands for is gone.

**Boundary.** This rule owns the account control's chain. Whether DropdownBranch may import HeroUI at
all is `vendor-boundary`.

## `auth-overlay-owns-single-content-host` — none

**What it reports.** `requires` ContractContent, and `rejects` any duplicate host or duplicate inset.

**How it detects.** By JSX anatomy in the auth overlay: `ContractContent` must be present, and the
count of hosts and insets must be exactly one.

**What it cannot see.** A duplicate that is not written in this file — a second host arriving through
a child component — is not in the tree the rule counts, and a namespaced or aliased host tag is not
the identifier it counts.

**Boundary.** The host and the inset. The scroll body of the modal is
`modal-branch-owns-scroll-body`.

## `checkbox-keeps-compound-anatomy` — none

**What it reports.** `rejects` — the Content → Control → Indicator nesting is broken.

**How it detects.** By JSX anatomy: the three parts must nest in that order.

**What it cannot see.** Anatomy expressed through a wrapper — one of the three parts rendered by
another component, or produced without JSX — is not nesting the rule can read, and the check says
nothing about what the compound does once the three tags are in the right order.

**Boundary.** Nesting only. The vendor the checkbox is built from is `vendor-boundary`.

## `no-internal-starci-href` — none

**What it reports.** `rejects` — a governed component owns an internal href.

**How it detects.** By governed component plus the href written on it.

**What it cannot see.** Only governed components are watched. An href built at runtime, or one placed
in a component outside the governed set, is outside the check, and the rule judges ownership of the
href rather than whether the destination is correct.

**Boundary.** Href ownership inside governed components. That the element is a HeroUI Link at all is
`text-link-uses-hero-link`.

## Detection

| Part | Mechanism |
|---|---|
| ownership by path | Owner is decided from the file path — leaf, named mechanics branch, named SurfaceCard branch — before any node is read |
| the deleted tier | `components/shells` is not an exemption; the existence of the path is itself the finding, with no import required |
| vendor identity | The vendor is the import source `@heroui/react`; anything reaching the file some other way is not that source |
| both directions | A vendor import under the wrong owner fires, and a named mechanics branch that owns no vendor fires |
| JSX anatomy | Named tags and their nesting — `Modal.Body`, `ContractContent`, Content → Control → Indicator, DropdownBranch → AccountMenu → ShellNav |
| required class literal | `p-0` on `Modal.Body`, matched as written |
| implementation | The exact node predicates live in `@canon-fe` and are not restated by this gate |
| twin test | `node --test @canon-fe` |

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| A `components/shells` file that imports no vendor at all | The legacy check needs no import; the path is the finding |
| A named mechanics branch kept deliberately vendor-free | The empty mechanics branch is reported in its own right, not passed as harmless |
| A connected product block importing `Dropdown` from `@heroui/react` | A block is not a leaf, a named mechanics branch or a named SurfaceCard branch, so the import has no owner |
| Adopting a rule at `warn` instead of `error` | Every rule is recommended at `error`; no warning adoption is valid |
| A suppression comment over the offending import | No suppression is valid in this gate |
| `Modal.Body` in `ModalBranch/index.tsx` with no `className` at all | The literal is required, so absence is the failure |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Scope | What passes |
|---|---|
| `vendor-boundary` | **A vendor re-exported through a local module.** The offending file no longer imports `@heroui/react`, so no import is seen |
| `vendor-boundary` | **A renamed owner folder.** Ownership is decided by path, and a rename changes the owner without changing behaviour |
| `modal-branch-owns-scroll-body` | **A `p-0` composed at runtime**, and **a second modal branch under another name** — the rule holds one named file and one written literal |
| `field-input-uses-secondary-variant`, `field-label-is-text-only`, `no-internal-starci-href` | **Anything outside the governed component.** The house Field, the house Icon and the governed set are named; a substitute of another name is not watched |
| `no-surface-branch-in-overlay` | **A SurfaceCard reached through an alias, a re-export or a wrapper**, and **a surface rebuilt by hand inside the overlay** |
| `text-link-uses-hero-link` | **A handmade link written some other way**, or one hidden a component away |
| `account-control-owns-dropdown`, `checkbox-keeps-compound-anatomy`, `auth-overlay-owns-single-content-host` | **Anatomy expressed through a wrapper**, **a namespaced tag**, and **a rename of any named link in the chain** — all three read names and nesting in one file |
| all | **Design itself.** The gate deliberately does not measure design by regex; the contract remains the source of shape and nothing here judges it |
| all | **Every sentence of the product law that no rule above names.** Ten rules ship; the prose law is longer than they are, and a green run says nothing about the rest |

That last row is the honest summary: this gate blocks the source paths that can be proven wrong, and
proof here is a path, an import source, a tag name or a written class — each of which one ordinary
rename or one indirection defeats.

## Rules

1. The identity of a rule is its published name. There is no numeric identifier for a rule anywhere in
   this module.
2. Ownership is held by path, import, JSX anatomy and required class literal — nothing else.
3. Both directions are enforced: a vendor import under the wrong owner, and a mechanics branch that
   owns no vendor.
4. `components/shells` is not an exemption. The existence of the path is the error.
5. Out of scope means the rule did not exist for that file, not that the file passed.
6. Design is not measured by regex. The contract stays the source of shape.
7. Every rule is recommended at `error`.
8. No warning adoption and no suppression is valid.
9. The twin test `node --test @canon-fe` is the proof that the rules still
   behave as published.

## Exceptions

There are none in code. The one exemption this gate used to carry — `components/shells` — was
inverted rather than kept: the path releases nothing and is now itself a finding.

No rule declares an allowlist or a per-file opt-out, no rule may be adopted at `warn`, and no
suppression is valid. A repository that needs one is making a rule change, which belongs in the
module's history — not in a comment above the import.

## Output

One block per finding:

```text
file: <path as the rule sees it, forward slashes>
rule: <published rule name>
scope: <in | out — the path, named file or governed component that decided it>
report: <rejects | requires> at <node>
code: none — this gate publishes no numeric codes
hatch: <the open hatch that would have hidden this, or none>
```

A clean file emits one block per rule that was in scope with `report: none`. A file no rule scoped
emits `scope: out` and `report: none` — unjudged, not clean.
