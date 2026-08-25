---
title: Contract
---

# Contract

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | the published frontend machine this record cites |


## Record

The input is a shape that has already been accepted — a layout, a block, a capability or a contract
someone signed off on. This module does not re-open that decision. Its output is source architecture:
which file the node is described in, which layer holds it, what it may import, what it must export,
what it is named. An accepted shape arrives as a picture; it leaves as a key in a table, an element
opened in exactly one frame, and a reason recorded next to both.

## Law

A contract is the description of ONE node. It is a key, and the key owns three things that are
worthless apart: the classes the node wears, the element it opens, and the reason what it holds sits
that way. An author who needs a shape types the key. That is the whole layout decision there is.

Everything above the leaves composes keys. A branch renders one, a composite arranges several, a
block asks for one, a page orders them — and not one of them writes a class string, because the
moment a caller can type `flex gap-3`, the tree is decided in as many places as there are call sites
and nothing above can be predicted from the key any more.

The question that settles it: **does this element hold other elements?** If it does, it is a node,
and a node comes from a key. A file that opens a `div` has answered a question the table was
supposed to answer.

**This is binding, not advisory.** Every structural element that ships resolves to exactly one code
below. There is no shape too small to have one: a two-child row is `CONTRACT-1` for the same reason
a page shell is. "It is only a wrapper" is not an exemption — it is the most common place the rule
gets skipped.

## Situation codes

Every situation this module governs carries a code, `CONTRACT-<n>`. The code names the SITUATION;
what holds it is a separate question, answered under *Layer held* below.

| Code | Situation | What the source must look like |
|---|---|---|
| `CONTRACT-1` | You are about to type `flex gap-3` straight into a file | A structural node takes its classes from a key; no literal structural class at a call site, including one hoisted into a module constant |
| `CONTRACT-2` | Two real states exist and you are about to compose classes at runtime to tell them apart | A distinction between two shapes earns a key or a named prop; no runtime class composition or interpolation |
| `CONTRACT-3` | You need a spacing or alignment value the vocabulary does not have | The layout vocabulary is a closed union edited deliberately; no class value outside that union |
| `CONTRACT-4` | The node must be a `ul`, a `form`, a `main` — not a `div` | The entry names its own host and the frame alone wears it; no `host`/`as` prop, no node props spread onto an element the caller chose |
| `CONTRACT-5` | You are naming a new key | A key's name says what goes inside it; not `card`, `box`, `wrapper`, `row` or any other name that admits anything |
| `CONTRACT-6` | You are writing the `why` of an entry | Every entry states what breaks when the node is removed; not a reason built only from the words already in the key |
| `CONTRACT-7` | You are opening a tag by hand outside the frame | Exactly one file turns a key into an element; no neutral box written by hand, no semantic element carrying a class |
| `CONTRACT-8` | You are hand-writing `data-node` / `data-why` | The frame paints the node's markers from the entry; no hand-written contract marker attribute |
| `CONTRACT-9` | You want a new key because the old one is "a bit tight" | A new key is justified by a shape no existing key expresses; no second entry spelling a shape another entry already spells |
| `CONTRACT-10` | The node has to sit inside a fixed vendor wrapper | A named surface branch owns its fixed vendor wrapper as branch code; no second contract vocabulary for wrapper mechanics, no contract node worn ON the vendor body |
| `CONTRACT-11` | You are declaring what is inside an entry | An entry declares every slot inside it, by name; no `children`, no positional child lists, no bare arrows in a slot, no repeated slot without a resting count |
| `CONTRACT-12` | An entry wants to carry `cursor-pointer`, `bg-surface`, `shadow-*` | An entry's classes describe how children stand together; no behaviour, paint, ground or elevation in an entry |
| `CONTRACT-13` | A key sits in the table and no screen draws it | Every key in the table is rendered somewhere; no key kept for work that has not started |

The numbering is FIXED. These codes are cited from other law files and from task records already
written, so a renumbering silently breaks a citation somebody has already made. A code believed
wrong is kept and argued in the audit record, never quietly repaired.

The list ends at thirteen. A new situation is a rule change with a version bump, not a fourteenth row
added while nobody is reading.

## Reading an accepted shape

1. **Read what the shape states.** It states which regions exist, which region holds which, how the
   children of a region stand together, and what is repeated. Those are facts you may not re-decide.
2. **Read what the shape does not state, and therefore does not resolve.** A picture does not state
   the element a region opens, the name of a key, the reason a region exists, or whether an existing
   key already spells that region. Those are resolved here, from the table, not from the picture.
3. **Resolve outermost first.** Take the outermost region, settle its code, its key and its host,
   then descend. An inner region resolved before its parent will invent a key the parent's entry
   already declares as a slot.
4. **Ask each code's question of every region.** Does this element hold other elements (`CONTRACT-1`,
   `CONTRACT-7`)? Is the distinction between two of its states real (`CONTRACT-2`)? Does every class
   it needs exist in the union (`CONTRACT-3`)? Which element does it open (`CONTRACT-4`)? Does its
   name fix its children (`CONTRACT-5`)? What breaks without it (`CONTRACT-6`)? Who paints its
   markers (`CONTRACT-8`)? Does an existing key already spell it (`CONTRACT-9`)? Is there a fixed
   vendor wrapper around it (`CONTRACT-10`)? Is every child of it named (`CONTRACT-11`)? Is any class
   it carries behaviour, paint or elevation (`CONTRACT-12`)? Is the key it resolves to actually
   drawn (`CONTRACT-13`)?
5. **When two codes both match, both apply and both are fixed.** They are not alternatives. A `cn`
   that only turns on a `hover:` is `CONTRACT-2` and `CONTRACT-12` at once: composed at runtime, and
   behaviour in the wrong place. A hand-opened `<ul>` carrying `flex gap-3` is `CONTRACT-7` for the
   tag and `CONTRACT-1` for the string. Fix the outer one first — `CONTRACT-5` before `CONTRACT-6`,
   because a wrong name makes a right reason impossible.

## `CONTRACT-1` — structural classes come from a key, not a literal

**Situation.** You are inside a block, a page or a composite and need two things to stand next to
each other. Your hand is about to type `className="flex items-center gap-3"`. `flex`, `grid`,
`gap-*`, `items-*`, `justify-*`, `col-*` and the `position` family decide the shape of a tree, not
the look of one value. A shape decided at a call site is a shape nobody can find from anywhere else.

**What it emits in source.** The classes land in the entry's `classes: [...]` array in the contract
table, and the call site carries the key alone. The block, page and composite tiers contain no
`className=` literal at all.

**Recognition signs.** The class string holds at least one token from the structural family; the
element is being opened to HOLD something rather than to display a value; you have just lifted the
string into a module constant "to tidy it up". Ask: if tomorrow someone needs to know how wide this
node is and how its children stack, where do they look? If the answer is "grep", it is `CONTRACT-1`.
Hoisting to a constant rescues nothing — `const ROW = "flex items-center gap-3"` moves the decision
up one line and makes it invisible to the table's readers and to every rule that reads JSX.

**Boundary.** Not `CONTRACT-2`: this is a static string written in the wrong place, that one is a
string assembled while the component runs — two faults, two repairs. Not `CONTRACT-3`: this asks
*who may write this class*, that one asks *whether this class exists at all*; a `gap-[13px]` written
inside the table is still wrong, but wrong under `CONTRACT-3`. Not `CONTRACT-7`: if you just opened a
whole new `div`, that is `CONTRACT-7`; this covers the class on an element you were already entitled
to open.

**Common business situations.** An avatar-plus-name row; a grid of course cards; a filter toolbar;
the left column of a detail page; a form's footer; the sticky action bar on mobile.

## `CONTRACT-2` — no class string is composed at runtime

**Situation.** Two real states exist (`isCompact`, `isSelected`, `variant`) and you are about to say
so with `cn(base, isCompact && "gap-2")` or with a template string.

**What it emits in source.** A second entry in the table, or a named prop on the component that owns
the node. No `cn`, `clsx`, `twMerge`, `cva` or `tv` call site anywhere in the governed tree, and no
interpolated `className`.

**Recognition signs.** `cn`, `clsx`, `twMerge`, `cva` or `tv` appears in the file; `className={`…
`${x}` …`}` or `className={a + b}`; a boolean variable choosing between two class strings. Ask:
after the build, can anyone read the full class string this node will wear without running the
component? The distinction is real — only the way of expressing it is wrong. What you are branching
on is a genuine difference in the business, and it deserves a NAME: either a second key, or a named
prop on the component that owns the node.

**Boundary.** Not `CONTRACT-1` — see above. Not `CONTRACT-9`: where the distinction is real,
`CONTRACT-2` says *give it a name*, and `CONTRACT-9` says *only give it a name when the shape truly
differs*; two keys differing by one `gap` are refused by `CONTRACT-9`. Not `CONTRACT-12` alone: a
`cn` that exists only to switch on a `hover:` is both faults at once.

**Common business situations.** A selected versus unselected row; a compact versus roomy card; a
collapsed versus expanded sidebar; a badge that changes colour with status; a button that is loading.

## `CONTRACT-3` — the class vocabulary is a closed union

**Situation.** You need a value the vocabulary does not carry: `gap-[13px]`, `w-[42%]`,
`items-stretch`.

**What it emits in source.** Either the shape is expressed with members that already exist, or a new
member is added deliberately to `export type LayoutClassName` in the contract table file, as a named
edit to a named list.

**Recognition signs.** TypeScript reports red on the element inside the `classes` array; you are
about to add `as string` or `as LayoutClassName` to get past it. Ask: is this value a new step of the
system, or one adjustment made to please the eye on exactly one screen? This is the strongest code in
the module precisely because it is not a rule: `gap-[13px]` is not *forbidden*, it is **unwritable**.
There is nothing to police when the wrong value cannot be typed. Adding a member is a deliberate edit
to a named list, not a line that slips into a diff nobody read closely.

**Boundary.** Not `CONTRACT-1`: that one says who may write, this one says what can be written. Not
`CONTRACT-9`: this widens the CLASS vocabulary, that widens the KEY vocabulary — both are inflation,
but in two different tables.

**Common business situations.** A right-hand rail that needs a new width; a new breakpoint; a new
grid track for the leaderboard; a new inset shadow for a verdict band.

## `CONTRACT-4` — the element belongs to the entry, not to the caller

**Situation.** The node IS a list, or IS a form, or IS the document's main landmark. A `div` cannot
say that.

**What it emits in source.** The host is named on the entry, drawn from the closed `ContractHost`
union, and the frame reads it — `const Host = spec.host ?? "div"`. The frame's props carry no `host`
and no `as` for a caller to pass.

**Recognition signs.** You want to add an `as` or `host` prop to the frame; you are about to spread
an entry's node props onto an element of your own; assistive technology would read the node wrongly
if the element changed. Ask: if two call sites of one key open two different elements, are they still
one node? No — they are two nodes wearing one name. This is the fault with no red anywhere: the
function that returns node props hands back classes and markers and NOT an element, so spreading them
onto a vendor body leaves the entry saying `ol` while the document receives `div` — the list drops
out of the accessibility tree, nothing announces how many items there are, and meanwhile the key
still resolves, the markers still read correctly, and every gate is still green. That is why the
entry's node stands INSIDE the vendor body, never ON it.

The history of this code is worth remembering. Before entries named their element, the frame drew
only `div`, so every shape that needed a `<ul>` had nowhere legitimate to live and was pushed down
into the leaf tier — the one tier allowed to write its own classes. A whole tier filled up with
arrangement because of one missing field.

**Boundary.** Not `CONTRACT-7`: that one says *do not open the tag yourself*, this one says *which
tag is the entry's decision*; a hand-written `<ul>` breaks `CONTRACT-7`, a `<ul>` chosen by the
caller through a prop breaks `CONTRACT-4`. Not `CONTRACT-10`: a surface branch IS allowed to open its
vendor wrapper; what it may not do is wear the entry's node on that wrapper.

**Common business situations.** A streak of days; the module list of a course; a payment form; the
page's `main` landmark; the sidebar's destination nav; a row of a joined list.

## `CONTRACT-5` — the NAME of a key fixes what may sit inside it

**Situation.** You have just built a node and have to name it.

**What it emits in source.** A key in the table whose name fixes a child — `label-fact-over-progress`,
`page-header-stack`, `title-with-baseline-fact`, `weekday-run` — and never the generic
`card`, `box`, `wrapper`, `row`, `container`, `content`, `section-inner`, `main-wrapper`.

**Recognition signs.** The name you are reaching for is `card`, `box`, `wrapper`, `row`, `container`
or `content`; you cannot write one `why` sentence that is true of EVERY place this key will be used;
you catch yourself thinking this key "will probably work for lots of things". Ask: if somebody put
the wrong child inside this key, would a reader see it immediately? The generic name beats its
specific siblings at every call site, because it is the one nobody has to think about — and a key
that draws twenty regions cannot say why ANY one of them is there.

The reversal here is recorded, not silent. A child map was once dropped because it could check
nothing while content arrived as markup: a `.map`, a ternary and an anonymous subtree look identical
to every rule. Content now arrives as COMPONENTS, one per named slot, so the check is no longer a
rule — it is a TYPE. The old decision was right for the shape it was made against and wrong for this
one.

**Boundary.** Not `CONTRACT-6`: the name fixes WHAT is inside, the `why` says WHY those things stand
that way; a wrong name makes a right `why` impossible, so `CONTRACT-5` is always repaired first. Not
`CONTRACT-11`: a composed entry declares each slot and the compiler checks each one, so for that
entry the name is no longer the ONLY thing holding the child in place; for a node that receives
content from a caller, the name still is. Not `CONTRACT-9`: this asks *can this name fix anything*,
that asks *does this key deserve to exist*.

**Common business situations.** `label-figure-over-bar`; `title-with-baseline-fact`;
`page-header-stack`; `weekday-run` — and the names that are NOT used: `card`, `section-inner`,
`main-wrapper`.

## `CONTRACT-6` — every entry says why its node exists

**Situation.** You are filling in an entry's `why` field.

**What it emits in source.** A `why:` sentence on the entry naming what breaks, wraps or overflows
without the node — long enough to be a clause, and not a restatement of the key's own words.

**Recognition signs.** The `why` reads as the key lower-cased with spaces; the `why` is shorter than
a clause; remove the node and the `why` is still "true", because it said nothing. Ask: if this node
is deleted, what breaks, wraps, overflows or stops being pressable? Write exactly that. This is the
only thing that cannot be reconstructed from markup later — classes can be read back, the element can
be read back, the child list can be read back. What cannot be read back is why somebody built this
node. "A row of chips" costs a line and teaches nothing; "the tags wrap onto their own line before
the title wraps" is the fact that brought the node into existence.

**Boundary.** Not `CONTRACT-5` — see above. Not `CONTRACT-12`: if the real reason is "so it can be
clicked", that is not an entry's reason at all — it is `CONTRACT-12`, and the behaviour moves to the
branch that owns the control.

**Common business situations.** Why the fact sits on the title's baseline; why the rail must be
sticky; why the total is cut off from the lines above it by a rule; why the thumbnail hides on a
narrow screen.

## `CONTRACT-7` — exactly one file turns a key into an element

**Situation.** You need a box. No key fits.

**What it emits in source.** The single `<Host>` opened from a spec inside the contract frame, and
nowhere else. Every other file composes keys. Where no key fits, the emission is a new entry in the
table — not a `div`.

**Recognition signs.** You have just typed `<div>`, `<section>`, `<main>`, `<header>`, `<footer>`,
`<aside>` or `<nav>` outside the frame; you have just put a `className` on a `<ul>`, `<ol>`, `<li>`
or `<form>`. Ask: can this box be recorded anywhere — what classes it wears, which children belong to
it, and what it exists for? If there is nowhere to record it, it is a node with no key. And "no key
fits" is a FINDING, not a licence to open a `div`.

A semantic element is a different matter, and that difference is not a loophole. A `form` exists to
submit; a `ul` exists because its content is a list. Assistive technology reads that very element, so
it cannot be swapped for a neutral box, and opening it around a contract node decides NO shape at
all. What must still come from the entry is the SHAPE: the moment a semantic element carries a class,
it stops being a wrapper and becomes a node with no key.

**Boundary.** Not `CONTRACT-1`: an unkeyed element carrying NO structural class is still
`CONTRACT-7`; the two codes catch two halves of one habit. Not `CONTRACT-4` — see above. Not
`CONTRACT-10`: the named surface branches are a closed exception to this code.

**Common business situations.** A wrapper "just to line things up"; a `section` around page content;
a `div` holding space while loading; a `form` with an `onSubmit` and no class — the last one is
legitimate.

## `CONTRACT-8` — markers are painted by the frame, never written by hand

**Situation.** You want an element to read as "belonging to a contract", for a test or for tooling.

**What it emits in source.** `data-node` and `data-why` produced in exactly one function,
`contractNodeProps`, and applied by the frame. Product source writes neither attribute.

**Recognition signs.** A hand-written `data-node="..."` or `data-why="..."` in product source. Ask:
is this marker REPORTING an entry, or ASSERTING an entry that nothing holds? A hand-written marker is
worse than a node with no marker. The unmarked node is at least honest. The hand-marked node makes
every reader and every test that travels through those attributes believe an assertion that no rule
holds.

**Boundary.** Not `CONTRACT-4`: that one spreads a whole cluster of node props onto the wrong
element, this one types the attributes out one by one. They agree at their worst: a node that reads
as contracted and is not.

**Common business situations.** Adding `data-node` to shorten an e2e selector; copying a rendered
node and pasting it elsewhere; a story fixture promoted into a real component.

## `CONTRACT-9` — a new key is justified by a shape, not by a different gap

**Situation.** A near-enough key exists; it is only "a bit tight" or "a bit loose".

**What it emits in source.** No new entry. Either the existing entry changes for EVERYONE, or the
existing key is used as it stands. A new entry is written only where no existing key expresses the
shape.

**Recognition signs.** The new key differs from the old by exactly one spacing token; by exactly one
`restingCount`; or only in its `why` and its name. Ask: apart from the name, the reason and the
placeholder count, where do these two entries differ? If nowhere, they are ONE entry under two names.
The vocabulary inflates one call site at a time until the keys describe CALL SITES rather than
SHAPES, and the list is longer than the code that reads it.

**Boundary.** Not `CONTRACT-3` — see above. Not `CONTRACT-13`: this one blocks a key that is
redundant AT BIRTH, that one deletes a key that is already DEAD. Not `CONTRACT-2` — see above.

**Common business situations.** "This is like that card but roomier"; "exactly that, but four loading
rows instead of three"; "identical, only used on another page".

## `CONTRACT-10` — the contract fixes content; the branch owns wrapper mechanics

**Situation.** The content already has a contract, but it has to sit inside a fixed vendor wrapper: a
card body, an accordion body, a list body.

**What it emits in source.** The fixed vendor seam written as ordinary branch code in the named
surface branches — `SurfaceCard`, `SurfaceListCard`, `SurfaceFormCard` — with the contract node
standing INSIDE the content body. No compound table, and no node props on `Card.Content`.

**Recognition signs.** You are about to mint keys for the heading line, the outer wrapper and the
caption just to avoid writing a branch; you are about to build a "compound" table modelling
`Card > Card.Content`; you are about to spread node props onto `Card.Content`. Ask: does this seam
VARY BY CALLER? Does it ACCEPT CHILDREN? If neither, it is branch mechanics, not a second vocabulary.

Why there is no compound table: repeating `Card > Card.Content` costs two lines, and extracting it
adds a layer of indirection that OWNS NO POLICY. Conversely, minting keys for the heading line, the
outer wrapper and the caption turns ONE host into THREE contracts.

**Boundary.** Not `CONTRACT-7`: the named surface branches are its exception, and no other branch is.
Not `CONTRACT-4`: the contract node stands INSIDE the content host, not ON it — this is where the two
codes meet and where the mistake is made most often. Not `CONTRACT-11`: the relationship between
SIBLING rows belongs to the root contract, not to the wrapper.

**Common business situations.** A card with an outer title and a caption below; an accordion with a
scrolling body; a joined list inside a `p-0` card; a form card with a fixed action footer.

## `CONTRACT-11` — an entry declares every slot inside it, by name

**Situation.** You are telling an entry what is inside it.

**What it emits in source.** A named slot record on the entry — `ContractSlots`, `ContractProjection`,
`ContractComponent`, `defineContractComponent` — with identity, optionality and cardinality per slot,
and the `ContractChildCardinality` / `ChildrenOf` union that makes `repeats: true` without
`restingCount` unwritable.

**Recognition signs.** You are about to use `children` in the React sense; to pass an array of
children BY ORDER; to write a bare arrow directly into a slot; or you have a repeated slot and have
not said how many placeholders are drawn while waiting. Ask: if somebody inserts an extra child in
the MIDDLE tomorrow, does anything silently change meaning?

Slots are NAMED, not COUNTED. Insert a child into a positional list and every position after it
quietly means something else; a name survives that insertion, reads at the call site without
counting, and gives the `why` something to refer to.

`repeats: true` says the slot is an array at runtime; `restingCount` says how many placeholders are
drawn while waiting. The real length is dynamic, so it must never be confused with the skeleton
count. The pair is mandatory together: no `restingCount` on a scalar slot, and no repeated slot that
leaves its resting shape blank.

For a joined list: the relationship between sibling rows belongs to the root contract. The business
name of the collection (`tasks`, `courses`, `alerts`) is a FIELD in the content component's named
props type; a shared slot called `items` would teach the surface the caller's data model and does not
belong to the branch vocabulary. The joined list's root is `p-0` and the rows are direct children, so
every divider reaches both edges. The row contract gives back the card's `p-4` margin
ASYMMETRICALLY: one row `p-4`; the first row `px-4 pt-4 pb-3`; middle rows `px-4 py-3`; the last row
`px-4 pt-3 pb-4`. The fixed label/surface/caption cluster holds owning-and-owned units and therefore
uses `gap-3`.

The list host also owns the optional fact at the end of the label line. That fact is `xs muted`
standing beside an `sm semibold` label and QUALIFIES the joined list itself. The caller may not
project it out as a separate sibling, and it may not be pushed into `description`: `description` is
the caption of the whole list, sitting below the surface.

This is not React `children`, and that is exactly what makes it checkable. Markup arrives already
built and has erased its own shape. A wrong key, wrong props, wrong identity, wrong count, a missing
slot and an extra slot are all COMPILE ERRORS.

**Boundary.** Not `CONTRACT-5` — see above. Not `CONTRACT-10`: `divide-y` sits on the content host;
the row leaf does NOT draw its own `after` rule and does not inspect `last-child`. Not `CONTRACT-12`:
`props` inside a slot are LITERAL CONSTRAINTS, not values injected at runtime; text returned by a
query travels through the render component's runtime `props` and NEVER enters the table.

**Common business situations.** A list of daily quests; a grid of course cards; a leaderboard; a
module list with a skeleton; a label line with a trailing fact.

## `CONTRACT-12` — an entry's classes are ARRANGEMENT, not behaviour and not paint

**Situation.** The node needs to be clickable, or needs a ground, or needs elevation.

**What it emits in source.** An entry carrying arrangement only. Behaviour moves to the branch that
owns the control; ground and elevation move to the surface component that already owns them.

**Recognition signs.** The entry carries `cursor-*`, `hover:*`, `active:*`, `focus:*` or `group`; it
carries a text colour, `underline` or `decoration-*`; it carries `bg-surface*` or `shadow-*`. Ask:
does this class say HOW THE CHILDREN STAND TOGETHER, or does it say HOW THIS NODE REACTS / WHAT IT
LOOKS LIKE?

Two owners for one promise. A node given `cursor-pointer` + `hover:opacity-80` by its entry is
CLAIMING TO BE PRESSABLE, while the thing that actually presses — the button, the link, the control
holding the handler and the disabled state — lives somewhere else entirely. The table is the party
that CANNOT BE TOLD the promise is off: the entry does not know this call site passes no handler, so
it keeps drawing a cursor onto a dead thing.

Ground and elevation have their own consequence. The table will hold TWO KINDS OF CARD — one drawn by
a branch, one drawn by a key — and no key tells anybody which kind they are looking at. The next
person reaches for whichever is nearer to hand, and on the day the house surface changes its radius
or its elevation, only ONE of the two kinds follows.

A band is a closed exception. Ground alone does not make a raised object: a landing page whose
sections change ground so they can be counted is still not a card. A band runs the FULL WIDTH and
draws its own boundary with the next band; an object stops short of the edge and is bounded by
itself.

**Boundary.** Not `CONTRACT-6` — see above. Not `CONTRACT-10`: a surface is a COMPONENT, not a list
of classes; an entry that paints ground and shadow is a second way to make a thing that already has
an owner. Not `CONTRACT-3`: the union still ADMITS a few tokens of this family — `cursor-pointer`,
`group`, `bg-surface`, `shadow-surface`. That is measured debt in plain sight, not a licence; it is
argued in the audit record.

**Common business situations.** A pressable row in a list; a card with a hover; a landing section
that changes ground; a row with its own shadow inside a card that already has one.

## `CONTRACT-13` — a key nobody draws is not vocabulary

**Situation.** The table holds a key that no screen renders.

**What it emits in source.** Only keys reachable from a `contract="…"`, a
`defineContractComponent("…")` or another entry's slot survive in `CONTRACT_KEYS`. An unbuilt shape is
emitted into a plan record instead.

**Recognition signs.** No `contract="key"`, no `defineContractComponent("key")`, no slot of another
entry calling it; the key was added "for next week"; the key survived a rename wave untouched. Ask:
is any screen standing in the document because of this key?

A dead key does not lie still. It survives every rename, because renames follow call sites and it has
none. It is copied wholesale into the next repository, because the table travels as a block and
nothing in the table says which member was ever drawn. And it makes the table longer than the code
that reads it — at which point readers stop believing the table describes the product.

The right home for an unbuilt shape is the plan record, where a node that does not yet exist is
exactly what a reader expects to meet; not the vocabulary table, where everything present is read as
being on screen.

**Boundary.** Not `CONTRACT-9` — see above. Not `CONTRACT-5`: a key that died because its name was
too generic for anyone to reach for is also an unrepaired `CONTRACT-5`.

**Common business situations.** A key left over after a page was removed; a key born from a preview
that was never approved; a key copied into a new repository along with the whole table.

## Layer held

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes the
wrong value impossible to write. `enforced` means a rule in `@canon-fe` catches it.
`documented` means nothing mechanical holds it and only a reader does.

| Code | Tier | What holds it |
|---|---|---|
| `CONTRACT-1` | `enforced` | `no-literal-structural-class` — both the JSX attribute and the hoisted module constant |
| `CONTRACT-2` | `enforced` | `no-class-composition-outside-contract` — `cn`/`clsx`/`twMerge`/`cva` and interpolated `className` |
| `CONTRACT-3` | `unrepresentable` | the `LayoutClassName` union; a non-member does not compile |
| `CONTRACT-4` | `enforced` | `only-the-frame-wears-a-node`; the frame's props carry no host to pass |
| `CONTRACT-5` | `documented` | nothing. A reader decides whether a name fixes its children |
| `CONTRACT-6` | `enforced` | `contract-why-is-a-reason` — length floor, plus a restatement check against the key's own words |
| `CONTRACT-7` | `enforced` | `no-structural-host-outside-contract-frame` — neutral boxes always, semantic elements once they carry a class |
| `CONTRACT-8` | `enforced` | `no-hand-written-contract-attrs` |
| `CONTRACT-9` | `enforced` | `no-unknown-contract-key` for a key that does not exist, `no-duplicate-entry-shape` for a key that should not |
| `CONTRACT-10` | `documented` | nothing directly. The rules only EXEMPT the named surface branches; no rule checks that what they own stayed wrapper mechanics |
| `CONTRACT-11` | `unrepresentable` + `enforced` | the slot record type, the branded component types, and the `repeats`/`restingCount` pairing — and `contract-children-are-typed`, which reads the table itself, because the types govern a component that *consumes* an entry while the entry is written as a plain object literal nothing has typed yet. An entry with no `children` at all, or a slot naming no owner identity, is legal object syntax and unreachable from the component side |
| `CONTRACT-12` | `enforced` | `no-interaction-class-in-entry` — interaction, paint and raised-object families |
| `CONTRACT-13` | `enforced` | `no-dead-contract-key`, over a repository-wide reference walk |

Nine codes are held by a rule, two by a type, and two by a reader alone. The two held by a type are
held BETTER than the nine: there is nothing to police when the wrong value cannot be typed. The two
held by a reader — `CONTRACT-5` and `CONTRACT-10` — are the module's real exposure, and they are
listed again as open risk in the audit record with what a rule would have to see.

The tiers that must stay ignorant of all of this are the tiers above the frame: a block, a page and a
composite know keys and nothing else — not classes, not hosts, not markers.

## Anchor

A law that cannot be pointed at in real code is a proposal, not a law. Every code names a path and
what to look for there.

| Code | Path | What to look for |
|---|---|---|
| `CONTRACT-1` | `components/contracts/index.ts` | every entry's `classes: [...]` array — and the absence of any `className=` literal in the block, page and composite tiers |
| `CONTRACT-2` | the whole governed tree under `src/` | zero call sites of `cn`, `clsx`, `twMerge`, `cva`; zero interpolated `className` |
| `CONTRACT-3` | `components/contracts/index.ts` → `export type LayoutClassName` | the union itself; a value outside it fails to compile rather than failing review |
| `CONTRACT-4` | `components/contracts/index.ts` → `export type ContractHost`; `components/branches/Tree/index.tsx` | `const Host = spec.host ?? "div"` — the element read off the entry, and no `host`/`as` on the frame's props |
| `CONTRACT-5` | `components/contracts/index.ts` key names | names that fix a child (`label-fact-over-progress`, `page-header-stack`) against the banned generic (`card`, `row`) |
| `CONTRACT-6` | `components/contracts/index.ts` → every `why:` field | a sentence naming what breaks, wraps or overflows without the node |
| `CONTRACT-7` | `components/branches/Tree/index.tsx` | the one `<Host>` opened from a spec anywhere in the tree |
| `CONTRACT-8` | `components/contracts/index.ts` → `contractNodeProps` | `data-node` and `data-why` produced in exactly one function |
| `CONTRACT-9` | `components/contracts/index.ts` → `export type ContractKey = keyof typeof CONTRACTS` | the key union a call site is checked against |
| `CONTRACT-10` | `components/branches/SurfaceCard`, `SurfaceListCard`, `SurfaceFormCard` | the fixed vendor seam written as ordinary branch code, with the contract node standing INSIDE the content body |
| `CONTRACT-11` | `components/contracts/props.ts` → `ContractSlots`, `ContractProjection`, `ContractComponent`, `defineContractComponent`; `index.ts` → `ContractChildCardinality`, `ChildrenOf` | the named slot record, and the union that makes `repeats: true` without `restingCount` unwritable |
| `CONTRACT-12` | `components/contracts/index.ts` → `LayoutClassName` | live debt in plain sight: the union still admits `cursor-pointer`, `group`, `bg-surface`, `shadow-surface` that the rule refuses in an entry |
| `CONTRACT-13` | `components/contracts/index.ts` → `CONTRACT_KEYS` | every key reachable from a `contract="…"`, a `defineContractComponent("…")`, or another entry's slot |

All thirteen are anchored. `CONTRACT-12`'s anchor is deliberately an anchor to a CONTRADICTION and is
argued in the audit record; it is still an anchor, because the thing the law is about can be pointed
at.

## Inputs

| Input | Evidence required |
|---|---|
| element | Whether it holds other elements, which is what makes it a node |
| key | The entry it resolves to, or the finding that none fits |
| classes | The entry's array, every member drawn from the closed layout union |
| host | The element the entry names, from the closed host union |
| slots | The named child record, with identity, optionality and cardinality per slot |
| reason | What breaks, wraps, overflows or stops being pressable without the node |
| call sites | Every place the key is rendered, including another entry's slot |

## Rules

1. A structural node's classes come from its key and from nowhere else.
2. No class string is assembled or interpolated while a component runs.
3. Every class value is a member of the closed layout union.
4. The element belongs to the entry; the frame is its only wearer.
5. Exactly one file turns a key into an element.
6. Contract markers are emitted by that frame, never written by hand.
7. Every slot is named; no child is reached by counting.
8. A repeated slot always declares its resting count, and a scalar slot never does.
9. Two entries never spell one shape under two names.
10. An entry's classes are the arrangement, never the behaviour, the paint or the object.
11. Every key in the table is rendered somewhere.
12. A key's name fixes what may go inside it.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **The leaf tier owns its own interior.** `CONTRACT-1` and `CONTRACT-7`. A leaf wraps ONE vendor
  primitive and writes the glue that holds one line together, so those two codes do not reach it. The
  exemption is a FOLDER, which makes it a policy boundary rather than a type: anything filed there
  escapes that way. The question that keeps a region out — does this file arrange two contents? — is
  asked by `no-structural-arrangement-in-leaf`, which reads the JSX a leaf actually opens. What it
  cannot read is a leaf that arranges through a helper or a vendor prop, so the folder still admits
  what does not look structural in source.
- **A named surface branch owns its fixed vendor wrapper.** `CONTRACT-10`. The seam cannot vary by
  caller, cannot admit children and never receives contract markers.
- **An authored-document branch draws content it did not design.** `CONTRACT-1`, `CONTRACT-2`,
  `CONTRACT-7` and `CONTRACT-11`, for `Article`, `MarkdownCodeBlock` and `MermaidDiagram` only. An
  entry declares every slot inside it by name, and a document has no such list: the children of one
  authored list are whichever of a dozen node kinds the writer typed, in whichever order, nested
  however deep. A `children` record written for that is a guess, and a guess in the table is worse
  than no entry, because the next reader takes it for a rule somebody checked. The same holds one
  level down, where a highlighted code region and a rendered diagram are strings of markup produced
  at runtime with no slots to name. Like the leaf exemption this is a FOLDER, and the question that
  keeps a file out is asked by a person: does this component receive its children as PARSED CONTENT
  rather than as a designed arrangement? Many children is not the fact; a shape somebody chose is
  exactly what the table is for.
- **A semantic element opened for MEANING, carrying no class, is not a node.** `CONTRACT-7`. A `form`
  submits and a `ul` is a list; wrapping a contract node in one decides no shape at all. The moment
  it carries a class it has become a node with no key.
- **A twin test may build fixture markup by hand.** `CONTRACT-8`. Product source may not, and a test
  that spreads the node props itself proves its own fixture and nothing about the product.
- **A plan record carries a copy of the vocabulary.** `CONTRACT-13`. A design candidate renders the
  one page it was built to answer, so most of that copy is drawn by nobody — which is what a plan
  record IS, and not a list of deletions.

## Output

One block per file the accepted shape produces.

```text
element: <the element being written>
holds-others: <yes | no>
code: <CONTRACT-1 … CONTRACT-13>
key: <existing key | new key justified by a shape | none, this is a leaf>
host: <element the entry names>
slots: <name: identity, per slot>
reason: <what breaks, wraps or overflows without this node>
```

## Worked example

**The accepted shape.** A daily-quest panel: a card whose body is a joined list of quest rows, each
row a label with an optional trailing fact, drawn as four placeholder rows while loading.

What the shape does NOT state, and therefore does not resolve here: which element the list opens,
what the key is called, why the list exists, whether an existing key already spells the row, and who
paints the markers. Those are resolved from the table, not from the picture.

```text
element: the joined list that holds the quest rows
holds-others: yes
code: CONTRACT-11
key: new key justified by a shape — quest-run
host: ul
slots: rows: quest row component, repeats: true, restingCount: 4
reason: without it the rows lose their shared divider and each row draws its own edge, so the dividers stop reaching both sides of the card
```

`reason` for the code: the entry declares a NAMED, REPEATED slot with a resting count, which is what
excludes `CONTRACT-5` — the name is no longer the only thing holding the child in place, the slot
record is.

```text
element: the row that holds the label and the trailing fact
holds-others: yes
code: CONTRACT-4
key: existing key — label-fact-over-progress
host: li
slots: label: label leaf; fact: fact leaf, optional
reason: without it the fact drops below the label instead of sitting on its baseline, and the progress bar loses the line it aligns to
```

`reason` for the code: the entry NAMES `li` and the frame reads it off the spec; no caller passes a
host — which is what excludes `CONTRACT-7`, since nobody is opening the tag by hand.

```text
element: the card body the list sits inside
holds-others: yes
code: CONTRACT-10
key: none, this is a leaf
host: the vendor content body, opened by SurfaceListCard as ordinary branch code
slots: none; the contract node stands inside the content body
reason: the seam does not vary by caller and does not accept children, so it is branch mechanics and never receives contract markers
```

`reason` for the code: the contract node stands INSIDE the vendor body rather than being worn ON it —
which is what excludes `CONTRACT-4`, the fault where node props are spread onto the vendor body and
every gate stays green while the list leaves the accessibility tree.

## Scope

This rule holds for any code of this kind in this stack: any front end that keeps a registry of
layout nodes. It names no product, no feature and no repository. The paths in the *Anchor* table are
ordinary component-tree paths, and every example is ordinary TSX.
