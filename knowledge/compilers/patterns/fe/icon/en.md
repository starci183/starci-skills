---
title: Icon
---

# Icon

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | the published frontend machine this record cites |


## Record

The input is a shape somebody already accepted — a layout, a block, a row, a chip, a plated tile. That
decision is closed here; this module does not re-open it. The output is source architecture: which
file holds the glyph, which layer may name a glyph library, what the caller is allowed to say, what the
leaf must own, and what the source must look like once the shape has landed.

## Law

An icon is a **closed product meaning**, drawn through one glyph vocabulary. A caller names what the
glyph MEANS and the ROLE it performs. The icon leaf alone chooses the concrete drawing.

The frontend UI surface is closed to exactly three libraries: `@heroui/react` for UI primitives,
`@heroicons/react` for upstream Heroicons, and `@starci/heroicons` only for StarCi cuts missing from
upstream. The StarCi package never re-exports upstream icons. Product source chooses an existing
upstream Heroicon first; only a genuinely missing drawing is copied or authored into the matching
`24/outline` or `16/solid` StarCi entry point. Iconify, Phosphor and every other UI/glyph library are
outside this closed set.

The question that classifies the role is: **is this introducing content, leading an ordinary control
or row, or sitting inside a compact chip?** A heading glyph is not a leading glyph made larger, and
a chip glyph is not either one made smaller. The vocabulary ships separate drawings for those jobs,
authored at those optical sizes, and CSS cannot restore geometry it never had.

**This is binding, not advisory.** Every glyph a screen renders has a situation below, and that
situation has a code. "It is one small caret" is not an exemption — it is the exact case that opened
this law: a leaf reached into the glyph package directly, at a size off both steps and in a cut the
icon leaf does not offer, and nothing reported it.

## Situation codes

Every situation this module governs carries a code, `ICON-<n>`. The code names the SITUATION; it is
not a component, a size or a package name.

| Code | Situation | What the source must look like |
|---|---|---|
| `ICON-1` | Choosing a role for a glyph | Exactly three semantic roles: `heading`, `leading`, `chip`. No fourth role; no caller passing pixels, a size class or a weight |
| `ICON-2` | A glyph opening a content region | A heading glyph is the 24 outline drawing at `size-6`. Never mini or micro artwork grown into a heading box |
| `ICON-3` | A glyph leading a row, tab, field or icon control | A leading glyph is the outline drawing at `size-5`. Never heading weight, never chip compression, for navigation, rows, fields and ordinary icon controls |
| `ICON-4` | A glyph inside a chip that already has its own shell | A chip glyph is the native 16 solid micro drawing at `size-4`. Never a 24 outline glyph scaled down; never the 20px mini family used as a chip |
| `ICON-5` | A glyph inside a region carrying state (disabled, muted, selected) | A glyph draws in `currentColor`. No product glyph carries its own colour |
| `ICON-6` | A screen needs a drawing it does not yet have | Only the icon leaf names a glyph library; callers name meanings. No glyph component imported at a call site, and no second route into the library from a sibling file |
| `ICON-7` | Somebody wants to add another icon set | Exactly two glyph packages: upstream `@heroicons/react` plus custom-only `@starci/heroicons`, both limited to 24 outline and 16 solid. No other glyph package |
| `ICON-8` | The row narrows, the words lengthen | Every role carries `shrink-0`. No glyph deforming when its row becomes tight |
| `ICON-9` | Adding a new meaning to the product | The source feature map owns meaning-to-glyph selection, and name, map and table move together. No two unrelated meanings sharing one glyph; no stale or missing row |
| `ICON-10` | A metric cell, goal, kind label, streak caption or fact cell | A compact business fact whose reference is text-only stays text-only. No decorative feature glyph on it |
| `ICON-11` | A glyph sitting on a plate (icon tile) | Every plated icon tile draws the `leading` glyph at `size-5`; only the plate varies. Glyph role is never derived from plate size |
| `ICON-12` | A lone summary row under a heading | A leading glyph belongs in a heterogeneous set of peer choices or destinations. No leading glyph on a lone summary or header row already named by its section |
| `ICON-13` | A user reaction | Product reactions are the checked-in attributed artwork, passed by identity through the reaction leaf. No Unicode emoji, no caller-supplied asset paths or images, no importing that artwork as a glyph catalogue |

`ICON-1` IS THE CODE THE OTHERS HANG FROM. Roles are semantic names, not styling shorthands. Once a
caller can say "this size" instead of "this job", `ICON-2`, `ICON-3` and `ICON-4` have nothing left
to be true about: a third step appears, it is picked for a reason true on one screen, and everyone
after copies the nearest of three.

## Reading an accepted shape

1. Read what the shape states. It states where a glyph stands: in front of a region heading, in front
   of a row or control, inside a chip shell, on a plate, in a metric cell, in a reaction picker.
2. Read what the shape does not state, and therefore does not resolve. A shape never states a glyph
   package, a family, a pixel size, a stroke weight or a colour. Those are not open questions the
   shape left for the caller — they belong to the icon leaf, and a caller answering them is the
   failure `ICON-1` and `ICON-6` describe.
3. Resolve outermost first. Region before row, row before chip, plate before glyph. The plate is the
   surface's breathing room; the glyph's role is decided by its position in the content, not by the
   diameter of the disc it sits on.
4. Ask each code's question in order. Is this a job or a size (`ICON-1`)? Does it open a region
   (`ICON-2`), lead one line (`ICON-3`), or sit inside a shell that already draws its own boundary
   (`ICON-4`)? Whose colour is this (`ICON-5`)? Where may this be imported (`ICON-6`) and what may be
   imported (`ICON-7`)? What gives way when the row runs out of space (`ICON-8`)? Does the source map
   already own this meaning (`ICON-9`)? Has the adjacent text already closed the meaning (`ICON-10`)?
   Is the plate changing or the role (`ICON-11`)? Is there a peer to distinguish (`ICON-12`)? Am I
   passing an identity or a resource (`ICON-13`)?
5. When two codes both match, they are answering different questions and both hold. `ICON-3` says what
   a leading glyph is drawn with; `ICON-12` says whether it may appear at all. `ICON-6` says where a
   package may be imported; `ICON-7` says which package. `ICON-9` says which drawing; `ICON-12` says
   whether to draw. A row in the source map is not a licence to place a glyph anywhere. Satisfy the
   code that forbids before the code that draws.

## `ICON-1` — three roles, no fourth step

**Situation.** A caller needs a glyph. What the caller is allowed to decide is the JOB the glyph is
doing, never its size.

**What it emits in source.** A role union closed to three names — `heading`, `leading`, `chip` — and a
role-to-class map inside the icon leaf. The leaf's prop shape carries no size, class or colour slot,
so a fourth role does not compile and a pixel value has no channel.

**Recognition signs.** Somebody wants to pass `size`, a `size-*` class, a `strokeWidth` or a pixel
number. Somebody describes the need as "a bit bigger" or "smaller than that one". A step appears
between the two steps that exist.

**Boundary.** Not `ICON-2`/`ICON-3`/`ICON-4`: this code says there are exactly three roles; those
three say which drawing each role uses. Not `ICON-11`: a large or small plate is not a role — it is
the size of the disc, not of the glyph.

**Common business situations.** A caret in a disclosure · an icon inside a button · the icon opening a
menu row · an icon in an empty state · an icon beside a status label.

## `ICON-2` — the glyph that opens a region

**Situation.** The glyph stands in front of a region heading, an empty state, an introductory block. It
INTRODUCES; it does not LEAD.

**What it emits in source.** The 24 outline import block in the icon leaf, and a `heading` entry
reading `size-6 shrink-0`.

**Recognition signs.** Beside it is a real heading, not a line of text inside a list. The region can be
empty, and when it is empty the glyph is the first thing a reader sees. Remove the glyph and the region
is still correct, only harder to locate.

**Boundary.** Not `ICON-3`: a heading glyph is not a leading glyph enlarged — they are two different
drawings, not one drawing at two sizes. Not `ICON-4`: taking the micro drawing and giving it a 24px box
is the classic failure — right box, wrong stroke.

**Common business situations.** The empty state of a list · the header of a large section · a feature
introduction panel · a full-page error screen.

## `ICON-3` — the glyph that leads a control or a row

**Situation.** The glyph stands before text in navigation, a list row, a field, a switch, an icon
control. It leads the way; it does not claim a heading's weight.

**What it emits in source.** A `leading` entry reading `size-5 shrink-0`, selected from the same
outline import block as `heading`.

**Recognition signs.** It repeats many times in one tree, each time with a different meaning. It sits
on the same line as the text, not above it. Remove it and the cluster still reads, only slower to scan.

**Boundary.** Not `ICON-2`: see above. Not `ICON-12`: this code says what a leading glyph is drawn
with; `ICON-12` says where a leading glyph is allowed to appear. A lone summary row is still `size-5`
if it carries a glyph — but `ICON-12` says it should not carry one.

**Common business situations.** A navigation tab · a row in an account menu · an icon inside an input ·
an icon-only button · a dropdown item · a breadcrumb.

## `ICON-4` — the glyph inside a chip

**Situation.** The chip already has its own shell: background, radius, padding. All that is left for
the glyph inside is to stay legible at a very small size.

**What it emits in source.** A separate 16 solid import block, aliased per meaning, and a `chip` entry
reading `size-4 shrink-0`.

**Recognition signs.** The chip shell already states the boundary, so the glyph no longer needs a thin
stroke to feel light. At `size-4` a 24 outline stroke blurs into a grey smear. The micro drawing has
markedly less detail — that is the illustrator's intent, not an omission.

**Boundary.** Not `ICON-2`: these are two ends of the same mistake — one enlarges the small drawing,
the other crushes the large one. Not the 20px `mini` family: mini is not chip. An approximately right
size is not the right family.

**Common business situations.** A status badge · a filtered tag · a close button on a chip · a count
chip · a "new" label · a pill showing progress.

## `ICON-5` — the glyph inherits colour

**Situation.** The glyph sits in a region carrying state: disabled, muted, selected, dark theme. Its
colour belongs to that region, not to itself.

**What it emits in source.** `stroke="currentColor"` on the locally drawn glyphs. In the brand file,
one mark keeps four authored hex fills while the monochrome mark uses `currentColor` — the exception
and the rule side by side.

**Recognition signs.** The text beside it changes colour with state and the glyph does not. Somebody
writes `text-*` or `fill="#..."` directly on the glyph "to make it match". In dark theme the glyph
still carries the light-theme colour.

**Boundary.** The brand mark is a closed exception: a multi-colour mark is recognised BY those colours,
so recolouring it produces a different mark; monochrome marks still take `currentColor`. Not `ICON-13`:
reaction artwork is multi-colour by nature and is not a semantic glyph — it sits outside this code.

**Common business situations.** An icon in a disabled button · an icon in the selected tab · an icon in
an error callout · a sign-in provider mark · an icon in a hovered menu.

## `ICON-6` — callers name meanings, not vendors

**Situation.** A screen needs a drawing the meaning map does not have yet. The shortcut is to import
straight from the glyph package right there.

**What it emits in source.** `starci-fe/no-vendor-icon-outside-icon-leaf` — glyph packages matched as a
prefix, so a subpath cannot walk around the check — plus the single allowed module path in
`@canon-fe`.

**Recognition signs.** A screen file contains `import { XxxIcon } from "..."`. A "helper" file next to
the icon leaf imports the package too, "for convenience". The same concept is drawn with two different
shapes on two screens.

**Boundary.** Not `ICON-7`: this code is WHERE a package may be imported; `ICON-7` is WHAT may be
imported. A file in the right place calling the wrong package is silent to `ICON-6` and caught only by
`ICON-7`. Not `ICON-9`: when no meaning matches, the answer is to ADD a meaning, not to import.

**Common business situations.** A new screen needing an arrow · a brand file needing one more mark · a
block "temporarily" using another icon · code copied from an online example.

## `ICON-7` — upstream plus custom-only extension, two families

**Situation.** Somebody wants another icon set: prettier, more complete, or "just this one icon".

**What it emits in source.** `starci-fe/heroicons-is-the-glyph-vendor` — a closed allow set containing
only `@heroicons/react/24/outline`, `@heroicons/react/16/solid`, `@starci/heroicons/24/outline` and
`@starci/heroicons/16/solid`. The StarCi entry points contain custom cuts only and never re-export
upstream. The rule applies inside the icon leaf too, which is the half `ICON-6` cannot see.

**Recognition signs.** A second glyph library appears in `package.json`. A brand mark is picked from a
general-purpose package instead of drawn exactly. Somebody argues "the other one doesn't have this" —
correct, and that is exactly the moment to decide about MEANING, not about a package.

**Boundary.** Not `ICON-6`: see above. `ICON-7` applies INSIDE the icon leaf, the place `ICON-6`
deliberately does not look. Award artwork has no Iconify exemption: use upstream `TrophyIcon` where
faithful, and add missing medal cuts to `@starci/heroicons` before product source imports them.

**Common business situations.** Adding a social network icon · a badge or award icon · a marketing
illustration icon · a file-type icon · a partner logo.

## `ICON-8` — a glyph never shrinks

**Situation.** A flex row narrows: the name is long, the translated string grows, the screen gets
smaller.

**What it emits in source.** `shrink-0` baked into every one of the three role class strings —
including `chip`, the one most often assumed too small to matter.

**Recognition signs.** A round icon becomes an oval. A square icon flattens on one side. The text is
still intact while the glyph is already deformed — the order of yielding is reversed.

**Boundary.** Not `ICON-1`: deformation does not create a new role, it destroys the existing one. Not
the text-expansion law: long text wraps or truncates, and that is the text's job, not the glyph's.

**Common business situations.** A row with a very long name · a button with a long translated label ·
a breadcrumb on mobile · a chip in a horizontally scrolling row · a wordy toast.

## `ICON-9` — the source map owns the drawing

**Situation.** Adding or changing a meaning. The question "which drawing for this meaning" has exactly
one place that answers it.

**What it emits in source.** The feature table beside the meaning union and the glyph map, in one
folder, updated by hand. The parity test the flat law claims **could not be found in source** — it is
named by the law and is not anchored.

**Recognition signs.** The meaning union has a new name but the source table does not. Two different
meanings point at the same drawing "because it looks about right". The table still names a component
that was renamed long ago.

**Boundary.** Not `ICON-6`: `ICON-6` blocks the shortcut; `ICON-9` describes the main road. Not
`ICON-12`: the table says WHICH drawing, `ICON-12` says WHETHER to draw. A row in the table is not a
licence to place a glyph everywhere.

**Common business situations.** Adding a navigation entry · renaming a feature · merging two features ·
adding a new lesson state.

## `ICON-10` — a compact business fact stays text-only

**Situation.** A metric cell, a goal, a kind label, a streak caption, a fact cell — where the original
reference is TEXT-ONLY.

**What it emits in source.** `starci-fe/no-decorative-icon-in-metric-cell`, bound to one composite
path, so the rule holds that cell and no other. The composite it is bound to renders a label, a figure
and a bar with no glyph.

**Recognition signs.** The glyph repeats exactly what the adjacent text already said (a book beside the
word "Content"). In a grid, each cell sprouts a different glyph and creates a SECOND visual axis. The
person adding the glyph explains it as "it looked empty", not as "to distinguish".

**Boundary.** Closed exception: generic state/action semantics the reference genuinely carries —
complete, failed, pending, close, disclosure — stay. Navigation, named entry points and large
empty-region headings keep their reference glyphs, because there the glyph is part of LOCATING the
region. Not `ICON-12`: this code is about REPEATED fact cells; `ICON-12` is about a row standing alone.

**Common business situations.** A course-progress cell · a weekly goal · a content kind label · a
study-streak caption · a profile statistics grid.

## `ICON-11` — the plate changes, the glyph does not

**Situation.** The glyph sits on a plate (an icon tile). The plate has two steps; the glyph does not.

**What it emits in source.** Two plate steps in the tile's size map, and one line below it passing
`role: "leading"` unconditionally, so every plated tile draws the `leading` glyph at `size-5`.

**Recognition signs.** Somebody wants the glyph to "grow along" when the plate grows. The same meaning
appears on two screens with two different weights, only because the plates differ. A caller is deriving
the role from the tile's `size`.

**Boundary.** Not `ICON-1`: a plate is not a fourth role. Not `ICON-2`: a large tile still does not turn
the glyph into a heading — heading is a POSITION IN THE CONTENT, not the diameter of a disc.

**Common business situations.** A course row with a tile · a quick-action list · a notification row · a
feature card · a menu item with a background.

## `ICON-12` — leading must distinguish a peer

**Situation.** A leading glyph only means something when it helps pick ONE item out of MANY of
different kinds. A lone summary row has no peers to be distinguished from.

**What it emits in source.** Three recipes in the fact-row composite; the peer recipe is this code's
positive case. The label-led recipe already renders its trailing fact small and muted **and still draws
a glyph** — the half of this code that source does not yet keep. When a shape falls into this code, the
source renders the main label normally and the trailing fact as `text-xs muted`, with no glyph.

**Recognition signs.** In the whole section only ONE row carries a glyph. The section already has a
heading naming the very concept the glyph repeats. The set is homogeneous — ten rows of the same kind —
so an identical glyph on every row distinguishes nothing.

**Boundary.** Not `ICON-3`: `ICON-3` is what it is drawn WITH, `ICON-12` is whether it may be drawn at
all. Not `ICON-10`: `ICON-10` protects REPEATED fact cells; `ICON-12` protects the LONE row. One is a
grid, the other is a line.

**Common business situations.** A "total lessons" row under a "Skills" heading · a total-amount line
under a "Payment" heading · a single status line inside a panel · the header of a card that already has
a title.

## `ICON-13` — a reaction is artwork, not a glyph

**Situation.** A user expresses a feeling. This is the product's EXPRESSIVE ARTWORK, not an interface
symbol.

**What it emits in source.** A closed identity list inside the reaction leaf, and the checked-in
artwork files with the attribution travelling alongside them; call sites pass identity only.

**Recognition signs.** Somebody is about to render a Unicode emoji "for speed". A call site passes an
image path or an `<img>`. Somebody wants to import the whole artwork set as a second glyph catalogue.

**Boundary.** Not `ICON-7`: this is a NARROW artwork boundary. It opens no second glyph vendor;
navigation, state and action still belong to the single vocabulary. Not `ICON-5`: multi-colour artwork
is its nature, so `currentColor` does not apply. Unicode emoji are refused because every platform's
font draws them differently — the same reaction becomes two different pictures on two machines.

**Common business situations.** A reaction under a post · a reaction in an activity feed · a reaction
count summary · a reaction picker.

## Layer held

The icon leaf owns vendor, family, drawing and size; every caller layer must stay ignorant of all four.
Which tier actually holds each code today: `unrepresentable` means a closed union or prop shape makes
the wrong value impossible to write; `enforced` means a rule in
`@canon-fe` reports it, named here; `documented` means only
a reader holds it.

| Code | Tier | What holds it |
|---|---|---|
| `ICON-1` | `unrepresentable` | The role union is closed to three names, and the leaf's prop shape carries no size, class or colour slot, so a fourth role does not compile and a pixel value has no channel. The residue — an off-scale `size-*` written on any element — is additionally reported by `starci-fe/no-off-scale-glyph-size` |
| `ICON-2` | `documented` | Nothing mechanical pairs `heading` with the 24 outline drawing; the pairing lives in one map inside the leaf, and a twin test asserts the `size-6` box only |
| `ICON-3` | `documented` | Same map, same absence: the `size-5` step is a line of source no rule reads |
| `ICON-4` | `documented` | No rule distinguishes the 16 solid micro family from a 24 outline glyph in a `size-4` box; the two produce identical CSS |
| `ICON-5` | `documented` | A glyph inherits colour because the leaf draws it that way, not because anything refuses a hard-coded fill |
| `ICON-6` | `enforced` | `starci-fe/no-vendor-icon-outside-icon-leaf` — glyph packages matched as a prefix, so a subpath cannot walk around the check |
| `ICON-7` | `enforced` | `starci-fe/heroicons-is-the-glyph-vendor` — applies inside the icon leaf too, which is the half `ICON-6` cannot see |
| `ICON-8` | `documented` | `shrink-0` is baked into every role's class string; a hand-written glyph beside it is held by nothing |
| `ICON-9` | `documented` | The map and the table sit in the same folder and are updated by hand. The parity test the flat law claims could not be found in source |
| `ICON-10` | `enforced` | `starci-fe/no-decorative-icon-in-metric-cell` — bound to one composite path, so the rule holds that cell and no other |
| `ICON-11` | `documented` | The plate leaf passes `leading` in one line; nothing stops a second plated leaf choosing differently |
| `ICON-12` | `documented` | Peer identity is a judgement about a set, and no rule reads a set |
| `ICON-13` | `documented` | The reaction identities are a closed set in the leaf; no rule refuses a Unicode pictograph or an asset path at a call site |

The retired `rank-artwork-is-a-closed-set` rule must not reopen Iconify. Rank remains a closed product
meaning owned by `RankMark`; the ordinary `ICON-6` and `ICON-7` vendor boundary applies to it.

## Anchor

Where each code can be checked against real code. Paths under `src/` are front-end product source;
paths under `starci-eslint/packages/fe/` are the rules in this trust tree.

| Code | Path | What to look for |
|---|---|---|
| `ICON-1` | `components/leaves/Icon/index.tsx` · `components/contracts/props.ts` | The three-name role union and the role-to-class map; the leaf prop shape with exactly `props`, `on`, `isLoading` — and therefore no place to write a size |
| `ICON-2` | `components/leaves/Icon/index.tsx` · `components/leaves/Icon/index.test.tsx` | The 24 outline import block; the `heading` entry reading `size-6 shrink-0`; the twin test asserting `size-6` |
| `ICON-3` | `components/leaves/Icon/index.tsx` | The `leading` entry reading `size-5 shrink-0`, selected from the same outline import block as `heading` |
| `ICON-4` | `components/leaves/Icon/index.tsx` | The separate 16 solid import block, aliased per meaning, and the `chip` entry reading `size-4 shrink-0` |
| `ICON-5` | `components/leaves/Icon/index.tsx` · `components/leaves/Icon/brands.tsx` | `stroke="currentColor"` on the locally drawn glyphs; in the brand file, one mark keeping four authored hex fills while the monochrome mark uses `currentColor` — the exception and the rule side by side |
| `ICON-6` | `@canon-fe` | `noVendorIconOutsideIconLeaf`; the single allowed module path; the package list matched by prefix |
| `ICON-7` | `@canon-fe` | `heroiconsIsTheGlyphVendor`; the two-package glyph allow set, exact subpaths, and no rank exemption |
| `ICON-8` | `components/leaves/Icon/index.tsx` | Every one of the three role strings ending in `shrink-0` — including `chip`, the one most often assumed too small to matter |
| `ICON-9` | `components/leaves/Icon/icon.md` · `components/leaves/Icon/index.tsx` | The feature table beside the meaning union and the glyph map, in one folder. The parity test named by the law: not anchored |
| `ICON-10` | `@canon-fe` · `components/composites/LabelledProgressRow/index.tsx` | `noDecorativeIconInMetricCell` and the path it is bound to; that composite rendering a label, a figure and a bar with no glyph |
| `ICON-11` | `components/leaves/IconTile/index.tsx` | Two plate steps in the size map, and one line below it passing `role: "leading"` unconditionally |
| `ICON-12` | `components/composites/IconLabelFactRow/index.tsx` | Three recipes; the peer recipe is the code's positive case. The label-led recipe already renders its trailing fact small and muted **and still draws a glyph** — the half of the code source does not yet keep |
| `ICON-13` | `components/leaves/ReactionPicker/index.tsx` · `public/reactions/` | The closed identity list in the leaf; the six checked-in artwork files and the attribution travelling with them |

## Inputs

| Input | Evidence required |
|---|---|
| meaning | A product feature, state or action already present in the source feature map |
| role | Introducing a region, leading an ordinary control or row, or sitting in a compact chip |
| placement | The set the glyph sits in: peers, a lone summary, a repeated metric cell, a plated tile |
| reference | What the named reference actually draws there — text-only, or a glyph |
| container | Which state the surrounding node carries: disabled, muted, selected, themed |

## Rules

1. A caller names a meaning and a role; the icon leaf owns vendor, family, drawing and size.
2. One meaning maps to one drawing, and one drawing serves one meaning.
3. Role does not follow from plate size, container size, viewport or density.
4. A glyph inherits colour; an identity mark keeps the colours that make it that identity.
5. A glyph never shrinks; words give way first.
6. A glyph appears where it distinguishes something the words have not already closed.
7. A situation code maps to exactly one requirement, and no requirement serves two codes.
8. Artwork vocabularies — reactions, awards — are closed sets owned by one leaf each, never catalogues.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Identity marks keep their colour** (`ICON-5`). An exact provider or house mark is recognised by
  its colours; recolouring it produces a different mark. Monochrome marks still take `currentColor`.
- **Identity marks are local SVG** (`ICON-7`). A brand is drawn exactly, from a file in the icon
  folder — never approximated by the nearest glyph in a general-purpose package.
- **Reference-backed generic semantics stay** (`ICON-10`). Complete, failed, pending, close and
  disclosure are meanings a compact reference genuinely carries. Navigation, named feature entry
  points and large empty-region headings keep their reference glyphs, because there the glyph is part
  of locating the region.
- **Reaction artwork** (`ICON-13`). A closed set of product artwork, owned by one leaf, passed by
  identity. It is a narrow artwork boundary and does not open a second glyph vocabulary.
- **Award artwork** (`ICON-7`). Use upstream `TrophyIcon` when it is faithful; missing place-medal
  drawings are closed custom cuts in `@starci/heroicons`. Product source gets no extra package.

## Output

One block per glyph decision the accepted shape produces.

```text
meaning: <feature, state or action from the source map>
role: <heading | leading | chip>
situation: <ICON-1 … ICON-13>
placement: <peers | lone summary | metric cell | plated tile | chip | heading region>
decision: <the glyph that is drawn, or the decision to draw none>
reason: <the business fact that excludes the adjacent code>
```

## Worked example

**The accepted shape.** A section that opens with a heading and an introductory glyph, then a
heterogeneous list of destination rows each led by a glyph and each carrying a status chip, and below
the list one lone summary row stating a total.

The shape states position: heading region, peer rows, chip inside a shell, lone summary row. It does
NOT state a package, a family, a pixel size, a stroke weight or a colour, and therefore resolves none
of them — those belong to the icon leaf and are not open questions the shape left behind.

```text
meaning: the section's named feature
role: heading
situation: ICON-2
placement: heading region
decision: the 24 outline drawing at size-6 shrink-0, from the leaf's outline import block
reason: it stands in front of a region heading that can be empty, not in front of one line in a list — that excludes ICON-3
```

```text
meaning: each destination in the list
role: leading
situation: ICON-3
placement: peers
decision: the outline drawing at size-5 shrink-0, one drawing per meaning from the source map
reason: the rows are a heterogeneous set of destinations, so the glyph distinguishes one from its peers — that excludes ICON-12
```

```text
meaning: the row's status
role: chip
situation: ICON-4
placement: chip
decision: the native 16 solid micro drawing at size-4 shrink-0, from the separate solid import block
reason: the chip shell already draws the boundary and the box is 16px, so the 24 outline stroke would smear — that excludes ICON-2 and the 20px mini family
```

```text
meaning: the total stated by the summary row
role: leading
situation: ICON-12
placement: lone summary
decision: no glyph; the label renders normally and the trailing fact renders text-xs muted
reason: it is the only row of its kind in the section and the heading already names the concept, so there is no peer to distinguish — that excludes ICON-10, which protects repeated fact cells rather than a lone row
```

## Scope

This module states a rule true of any front end. It names no product, no repository, no component
library and no registry key. It does name a glyph vendor, because the closed vendor choice IS the
substance of `ICON-7`; substitute your own and every other code still reads the same. Every example
is ordinary TSX.

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published
name, plugin prefix and all, because that is the exact string a build log prints and a disable
comment carries. A citation that cannot be pasted into a search is not a citation. What the ban
above forbids is PROSE and EXAMPLES that need a product to be understood — never an identifier
somebody will read in a failure and have to look up.
