# Architecture — the tiers, the direction, and the split

A component library that is only a folder tree tells you where a file sits and nothing about what it
is allowed to know. The tiers here are not filing: each one names a different **kind of knowledge**,
and the whole system is held up by one sentence — *the domain is built out of vocabulary, and
vocabulary never knows what sentence it ended up in*.

Everything below follows from that. Where a boundary looks arbitrary, the reason is written down in
`canon/fe/enforce/tiers/references/tier-boundaries.md`, and every reason there came from something that
actually broke.

## The seven tiers

Two groups. The lower three are **vocabulary** — words any product can use. The upper four are
**sentences** — one product saying something specific. The dividing question is a single one: *does
it know a domain entity?*

| Tier | Owns | Never | Group |
|---|---|---|---|
| `atom` | one indivisible unit: a value, and the states that value can be in | knows data; arranges children | vocabulary |
| `frame` | direction, seam, alignment, and its own chrome between children | asks what its children are | vocabulary |
| `composite` | a reusable shape assembled from atoms inside frames | knows any domain entity | vocabulary |
| `block` | domain data and its async decisions | draws a shape of its own | sentences |
| `layout` | the shell a whole route sits in | owns content | sentences |
| `overlay` | a surface that covers the page — modal, drawer, popover shell | owns domain data | sentences |
| `page` | which blocks, in which frames, fed which data | draws a shape of its own | sentences |

The machine-readable form of that table — including the *signal it belongs here* and *signal it is
misplaced* column for each tier — is `scripts/search/data/tiers.csv`, and each tier is written out
in full in `canon/fe/enforce/tiers/<tier>.md` with worked examples beside it in
`canon/fe/enforce/examples/<tier>.md`.

A composite takes `items`, `title`, `onPress`. A block takes an entity. **A component that takes
`courseId` is a block whatever folder it sits in** — the folder is a record of the judgement, never
the judgement itself.

## The import direction

```
atom  <-  frame  <-  composite  <-  block  <-  page
```

A higher tier may import a lower one. Never the reverse. The full matrix, pair by pair with the
reason attached to each, is `scripts/search/data/import-rules.csv`.

The moment an atom imports a composite, that atom can no longer be used anywhere the composite is
absent — it has stopped being a word. That is why the rule is stated as a direction rather than as a
list of permitted pairs: the direction survives a tier being added, a list does not.

### The one legal exception, and the question that keeps it legal

A frame may import an atom **to place chrome the frame itself owns** — a divider between children,
decided by the frame with a boolean, is the canonical case.

> Is the imported thing something the caller handed in? If yes, the frame is doing a composite's job.

The deleted prop that proves it: a frame once took `bodyStartsWithTabs`, asking the caller to declare
*"my body opens with tabs"* so the frame could subtract four pixels. Those four pixels are the tabs
component's own geometry and the tabs component had to own them. A prop that makes the caller
describe its own content is always the same mistake — the frame asking a question it has no right to
ask.

### Why the vendor sits at the bottom

Wrap the component library at atom and frame level so nothing above ever sees it. Where a `XBase`
file sits beside `X`, the `Base` holds the vendor import and the plain name is the constrained house
version; the rest of the system talks to the plain name, so the vendor can be swapped in one file.

**A block importing a vendor component is a missing atom, not a shortcut.** The failure is specific
and silent: some libraries bake their styles unlayered, so a utility class written at the call site
loses with no error and no warning — the class simply does nothing. An atom wrapping the vendor can
encode that; a block importing the vendor directly cannot.

A vendor **utility** is a different case and must not be counted with the components. A class merger
has no shape to wrap, so there is no atom missing; re-export it and move on.

## The rule that does the real work: `className` stops at the vocabulary

**A block takes no `className`. A page takes none and composes no classes at all.**

| Tier | Takes `className` | Composes classes | Because |
|---|---|---|---|
| atom · frame · composite | yes | yes | they are vocabulary — the caller adjusts placement |
| block | no | rarely, and each time is a smell | it owns an entity; if callers could restyle it, one entity would look different on two screens |
| page | no | never | a page is a list: which blocks, in which frames, fed which data |

Removing the prop is what forces good structure, and this is worth spelling out because it reads as
mere strictness until you have watched it work. A block that accepts `className` hands its caller an
escape hatch. Whenever a screen needs the block to look slightly different, the caller reaches for
the hatch, and the difference lives at that call site — invisible to every other screen that will
need the same thing. Five times over, the block has five undocumented variants held in five files.

Take the prop away and the only route to a different look runs **one tier down**: extend the
composite, or write the atom. That change is named, it sits in one place, and the next screen
inherits it for free.

The same argument applies to composing a class string inside a block. Deciding what something looks
like is a composite's job. When a block reaches for a class merger, the honest reading is *a
composite is missing, or an existing one needs a variant*.

The gradient is measurable: on a system that follows this, nearly every atom, frame and composite
both takes `className` and composes classes; a minority of blocks do; pages do neither at all. If
`className` is as common in your blocks as in your atoms, the tiers are folders, not layers.

## What may be said about placement, and by whom

The one class of decision a caller genuinely knows and the component cannot is **where this element
sits inside its parent**. That is passed, through a closed union, and nothing else is:
`canon/fe/enforce/spacing/position.md` holds the members. Everything else about how a
child looks is already a prop — `tone`, `size`, `variant` — decided by the design system rather than
by whoever called it.

> Would this class still make sense if the element moved to a completely different screen? Position
> classes stop making sense, which is why they belong to the caller. Appearance classes would still
> apply, which is exactly why they must not be passed.

Spacing has its own vocabulary and its own reasoning; that is `canon/fe/enforce/spacing/overview.md`.

## The split: a presentational twin and a connected twin

A block owns domain data *and* its async decisions. Written as one file, that block both fetches and
renders — and a fetching component cannot be rendered in a story, because there is no server, no
store, no session. The states that matter (loading, empty, error, full data) can never be put side by
side. The usual workaround is a second hand-kept blueprint copy that takes props instead of fetching:
two files for one component, in sync until the first person edits one and not the other.

The split removes the second copy by making the divide a property of the component itself. The full
treatment is `canon/fe/enforce/tiers/split.md`.

A data-owning tier — `block`, `layout`, `page` — is one folder with two files:

| File | Export | Is | Takes | Never |
|---|---|---|---|---|
| `component.tsx` | `_Name` | presentational | typed props, already resolved | fetches, reads a store, resolves i18n |
| `index.tsx` | `Name` | connected | nothing from its parent | draws a shape of its own |

The connected file wires the data from wherever the app keeps it and renders the presentational one.
The app imports `Name`; a story imports `_Name`. **`_Name` is the single source of truth for the
shape**, so there is no blueprint left to keep in sync — the story renders the file that ships.

Three consequences follow, and each is the same rule read from a different side.

1. **The async switch spans the two files.** The connected half owns the *decision*: it holds the
   request and derives the status. The presentational half owns the *switch*: it takes the status as
   props and renders error, then loading, then empty, then content, in that fixed order. Error
   outranks a stale loading flag — a block that hand-writes the if-else in another order renders a
   stale error on a background refetch, or hides a real error behind a spinner. Nothing below the
   block learns that a request exists, because the presentational half is handed a status, not a
   request.

2. **Translation is data, so it lives in the connected file.** Text is resolved from a catalog and
   interpolated with values only the connected layer holds. A presentational component takes what it
   renders; it does not go and get it. A component that resolves its own text has reached past its
   props for a source of truth — the identical failure as one that reads a store. A story passes the
   translation key as the text prop's value, which names the slot without inventing fixture copy or
   baking a locale into the story.

3. **A presentational parent composes connected children.** A screen is arrangement, and each block
   it places fetches its own data, so `_Screen` renders `Block`, never `_Block`. Threading a child's
   data through its parent is the prop-drilling the tiers exist to prevent.

Scope: the split applies only where data enters. An atom or a composite never fetches and never
resolves text, so it is one file, already presentational. Giving it a connected half would be an
empty file.

> The test for the presentational half: could this file be rendered in a story with no server, no
> store, no session, no locale — just props? If not, a fetch or a translation call has leaked down.

## Identity is emitted, never drilled

Every component emits its own identity, unconditionally, from its own file: a `data-tier` naming its
layer and a `data-component` naming the component. Nothing is passed down from a parent to make that
happen.

Which tier supplies a *human-readable* name follows from what each tier is allowed to know. An atom
supplies its own, hard-coded — it knows it is a rule and not a spacer, and a caller passing it a name
is a caller describing the atom, the same failure as passing it a colour class. A frame takes its
name from the caller — it has no idea what it is arranging, and that is its defining rule; the same
stack in a card header and in a footer are two different parts of a screen, and only the caller can
tell them apart.

This replaced an earlier overlay that drilled a `showAnatomy` switch through every level and hand-set
badge attributes on children. That scaffolding is removed, and its removal is gated rather than
remembered: `scripts/gates/check-orphan-parts.mjs` and the purity gate reject a presentational
file that names the retired props.

### The outermost frame of a higher tier wears that tier — by override, not by a wrapper

A component emits its own identity, as above — **until it is the outermost element of a higher tier
being built, and then it wears that tier instead.** An overlay, a block, a page has no identity node of
its own: its root is the frame or composite it is built from, standing at the outer edge and overriding
its own `data-tier`/`data-component` to the surface's. A drawer is a `DrawerShell` whose own `<Drawer>`
root, at the outer edge, emits `data-tier="overlay" data-component="SubmissionAttemptsDrawer"` — the
shell promoted, not a bare `<div data-tier="drawer">` wrapped around it. Nested anywhere inside, the same
shell keeps its own `composite` identity; the override is spent at exactly one node, the container.

So every structural frame and composite accepts an overridable `data-tier`/`data-component`, defaulting
to its own value — the default is the rule, the override the exception taken only at the outer edge.

What this forbids is the **identity-only wrapper**: a component whose whole body is
`<div data-tier="…" data-component={caller}>{children}</div>`, added solely to stamp a tier that a real
element could have carried. It adds a node the contract cannot measure — it owns no spacing, so it
declares no `principles` and exposes no seam — while doubling the identity of one logical surface. A
`*Root` frame and a `principles`-free "grouping" frame are the same mistake; both were removed, and
their absence is the rule. When a surface needs an identity, the element already there wears it.

## Which component a data shape becomes

Placing a component in a tier and choosing *which* component a cluster of data demands are two
different questions, and conflating them is how the wrong shell survives a review. The tier question
is answered here. The component question is a lookup, and it lives in `canon/fe/explore/component/` — the
matrix in `canon/fe/explore/component/data/matrix.csv`, its fifteen sections and their deciding tests in
`canon/fe/explore/component/data/sections.csv`, the reasoning in
`canon/fe/explore/component/references/general-rules.md`, and the section-by-section traps in
`canon/fe/explore/component/references/traps.md`.

**Enter from the shape of the data in your hand, and read rightward to exactly one component.** Never
read backward from a component name you already had in mind.

The failure this blocks is type-valid and renders fine: the right field, the right business logic, a
clean type check, every gate green, and the wrong shell. A paragraph pushed into a list whose `items`
length is always one. An accordion nested inside itself to get a single trigger. No machine catches
either.

Two questions decide most rows:

1. **One block, or an array of uniform rows?** A paragraph is not a one-element list. An `items`
   whose length is always one is the wrong family chosen at the data-shape level, and it drags in a
   between-row divider that will never exist and a key that means nothing.

2. **If an array — does each row hide a part, and is the row pressable?** A hidden body means an
   accordion. One collapsible region means a disclosure, not an accordion with a single item. A
   pressable row whose panel opens elsewhere is a row plus a drawer, and not a disclosure at all.

Two rules ride along with the lookup. **A surface is a property of the component you already picked,
not a reason to pick a different one** — a card inside another surface changes a variant, not a
component. And **a repeating frame takes `items`; free-form children belong to wrapping frames only**
— a repeating frame that accepts children has handed the caller control of the row, and every call
site then draws the row slightly differently.

When no row matches, that is a real outcome and not a failure of searching. Describe the data rather
than the picture and look again; check the section you did not think to look in; and only then treat
it as a gap in the set. A row added on your own authority is a claim wearing the clothes of a rule.

## Storybook first, without exception

**No component reaches the app that was never a component and a story in the design-system folder
first.** The design system is not a catalogue kept beside the code — after the split it is a story
layer over the code that actually ships, and a component that skipped it has no state matrix anybody
can read.

Resolve the two roots rather than remembering them:

```bash
node .claude/scripts/workspace/read-workspace-context.mjs fe.path
node .claude/scripts/workspace/read-workspace-context.mjs fe.design_system
```

A story is a storymap, not a demo: one prop per leaf, every value of that prop rendered, each state
carrying the sentence that says when to reach for it. The rules for writing one are
`canon/fe/enforce/tiers/story.md`, and how a story file is spelled is
`canon/fe/enforce/authoring/storybook-stories.md`. Coverage is not left to discipline —
`scripts/gates/check-story-coverage.mjs` requires a story at the mirror path for every canonical
component, `scripts/gates/check-doc-parity.mjs` requires the component's leading spec block and
its story's to be identical, and `scripts/gates/check-src-sb-import.mjs` stops app code importing
the design-system tree instead of its own twin.

## When two tiers both fit

Pick the lower one. Promoting later is a rename and a move; demoting leaves every caller that reached
for the higher-tier behaviour with nowhere to go, and the usual outcome is that behaviour hand-rolled
at each call site — the exact state the tiers exist to prevent.

## Where each judgement is enforced

Prose states the reason; a gate holds the line. The DOM-contract side of this — how `data-tier` and
`data-component` are read back off the rendered tree and checked against each tier's allowed set — is
`canon/fe/enforce/testing.md`. The source-side gates live in `scripts/gates/`, and
`scripts/gates/check-passthrough-block.mjs` in particular enforces the one thing no rendered tree
can see: that a block earns its layer instead of forwarding.
