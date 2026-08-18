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

**Boundary.** Not `CONTRACT-2`: this is a static string written in the wrong place, that one is a
string assembled while the component runs — two faults, two repairs. Not `CONTRACT-3`: this asks
*who may write this class*, that one asks *whether this class exists at all*; a `gap-[13px]` written
inside the table is still wrong, but wrong under `CONTRACT-3`. Not `CONTRACT-7`: if you just opened a
whole new `div`, that is `CONTRACT-7`; this covers the class on an element you were already entitled
to open.

## `CONTRACT-2` — no class string is composed at runtime

**Situation.** Two real states exist (`isCompact`, `isSelected`, `variant`) and you are about to say
so with `cn(base, isCompact && "gap-2")` or with a template string.

**What it emits in source.** A second entry in the table, or a named prop on the component that owns
the node. No `cn`, `clsx`, `twMerge`, `cva` or `tv` call site anywhere in the governed tree, and no
interpolated `className`.

**Boundary.** Not `CONTRACT-1` — see above. Not `CONTRACT-9`: where the distinction is real,
`CONTRACT-2` says *give it a name*, and `CONTRACT-9` says *only give it a name when the shape truly
differs*; two keys differing by one `gap` are refused by `CONTRACT-9`. Not `CONTRACT-12` alone: a
`cn` that exists only to switch on a `hover:` is both faults at once.

## `CONTRACT-3` — the class vocabulary is a closed union

**Situation.** You need a value the vocabulary does not carry: `gap-[13px]`, `w-[42%]`,
`items-stretch`.

**What it emits in source.** Either the shape is expressed with members that already exist, or a new
member is added deliberately to `export type LayoutClassName` in the contract table file, as a named
edit to a named list.

**Boundary.** Not `CONTRACT-1`: that one says who may write, this one says what can be written. Not
`CONTRACT-9`: this widens the CLASS vocabulary, that widens the KEY vocabulary — both are inflation,
but in two different tables.

## `CONTRACT-4` — the element belongs to the entry, not to the caller

**Situation.** The node IS a list, or IS a form, or IS the document's main landmark. A `div` cannot
say that.

**What it emits in source.** The host is named on the entry, drawn from the closed `ContractHost`
union, and the frame reads it — `const Host = spec.host ?? "div"`. The frame's props carry no `host`
and no `as` for a caller to pass.

**Boundary.** Not `CONTRACT-7`: that one says *do not open the tag yourself*, this one says *which
tag is the entry's decision*; a hand-written `<ul>` breaks `CONTRACT-7`, a `<ul>` chosen by the
caller through a prop breaks `CONTRACT-4`. Not `CONTRACT-10`: a surface branch IS allowed to open its
vendor wrapper; what it may not do is wear the entry's node on that wrapper.

## `CONTRACT-5` — the NAME of a key fixes what may sit inside it

**Situation.** You have just built a node and have to name it.

**What it emits in source.** A key in the table whose name fixes a child — `label-fact-over-progress`,
`page-header-stack`, `title-with-baseline-fact`, `weekday-run` — and never the generic
`card`, `box`, `wrapper`, `row`, `container`, `content`, `section-inner`, `main-wrapper`.

**Boundary.** Not `CONTRACT-6`: the name fixes WHAT is inside, the `why` says WHY those things stand
that way; a wrong name makes a right `why` impossible, so `CONTRACT-5` is always repaired first. Not
`CONTRACT-11`: a composed entry declares each slot and the compiler checks each one, so for that
entry the name is no longer the ONLY thing holding the child in place; for a node that receives
content from a caller, the name still is. Not `CONTRACT-9`: this asks *can this name fix anything*,
that asks *does this key deserve to exist*.

## `CONTRACT-6` — every entry says why its node exists

**Situation.** You are filling in an entry's `why` field.

**What it emits in source.** A `why:` sentence on the entry naming what breaks, wraps or overflows
without the node — long enough to be a clause, and not a restatement of the key's own words.

**Boundary.** Not `CONTRACT-5` — see above. Not `CONTRACT-12`: if the real reason is "so it can be
clicked", that is not an entry's reason at all — it is `CONTRACT-12`, and the behaviour moves to the
branch that owns the control.

## `CONTRACT-7` — exactly one file turns a key into an element

**Situation.** You need a box. No key fits.

**What it emits in source.** The single `<Host>` opened from a spec inside the contract frame, and
nowhere else. Every other file composes keys. Where no key fits, the emission is a new entry in the
table — not a `div`.

**Boundary.** Not `CONTRACT-1`: an unkeyed element carrying NO structural class is still
`CONTRACT-7`; the two codes catch two halves of one habit. Not `CONTRACT-4` — see above. Not
`CONTRACT-10`: the named surface branches are a closed exception to this code.

## `CONTRACT-8` — markers are painted by the frame, never written by hand

**Situation.** You want an element to read as "belonging to a contract", for a test or for tooling.

**What it emits in source.** `data-node` and `data-why` produced in exactly one function,
`contractNodeProps`, and applied by the frame. Product source writes neither attribute.

**Boundary.** Not `CONTRACT-4`: that one spreads a whole cluster of node props onto the wrong
element, this one types the attributes out one by one. They agree at their worst: a node that reads
as contracted and is not.

## `CONTRACT-9` — a new key is justified by a shape, not by a different gap

**Situation.** A near-enough key exists; it is only "a bit tight" or "a bit loose".

**What it emits in source.** No new entry. Either the existing entry changes for EVERYONE, or the
existing key is used as it stands. A new entry is written only where no existing key expresses the
shape.

**Boundary.** Not `CONTRACT-3` — see above. Not `CONTRACT-13`: this one blocks a key that is
redundant AT BIRTH, that one deletes a key that is already DEAD. Not `CONTRACT-2` — see above.

## `CONTRACT-10` — the contract fixes content; the branch owns wrapper mechanics

**Situation.** The content already has a contract, but it has to sit inside a fixed vendor wrapper: a
card body, an accordion body, a list body.

**What it emits in source.** The fixed vendor seam written as ordinary branch code in the named
surface branches — `SurfaceCard`, `SurfaceListCard`, `SurfaceFormCard` — with the contract node
standing INSIDE the content body. No compound table, and no node props on `Card.Content`.

**Boundary.** Not `CONTRACT-7`: the named surface branches are its exception, and no other branch is.
Not `CONTRACT-4`: the contract node stands INSIDE the content host, not ON it — this is where the two
codes meet and where the mistake is made most often. Not `CONTRACT-11`: the relationship between
SIBLING rows belongs to the root contract, not to the wrapper.

## `CONTRACT-11` — an entry declares every slot inside it, by name

**Situation.** You are telling an entry what is inside it.

**What it emits in source.** A named slot record on the entry — `ContractSlots`, `ContractProjection`,
`ContractComponent`, `defineContractComponent` — with identity, optionality and cardinality per slot,
and the `ContractChildCardinality` / `ChildrenOf` union that makes `repeats: true` without
`restingCount` unwritable.

**Boundary.** Not `CONTRACT-5` — see above. Not `CONTRACT-10`: `divide-y` sits on the content host;
the row leaf does NOT draw its own `after` rule and does not inspect `last-child`. Not `CONTRACT-12`:
`props` inside a slot are LITERAL CONSTRAINTS, not values injected at runtime; text returned by a
query travels through the render component's runtime `props` and NEVER enters the table.

## `CONTRACT-12` — an entry's classes are ARRANGEMENT, not behaviour and not paint

**Situation.** The node needs to be clickable, or needs a ground, or needs elevation.

**What it emits in source.** An entry carrying arrangement only. Behaviour moves to the branch that
owns the control; ground and elevation move to the surface component that already owns them.

**Boundary.** Not `CONTRACT-6` — see above. Not `CONTRACT-10`: a surface is a COMPONENT, not a list
of classes; an entry that paints ground and shadow is a second way to make a thing that already has
an owner. Not `CONTRACT-3`: the union still ADMITS a few tokens of this family — `cursor-pointer`,
`group`, `bg-surface`, `shadow-surface`. That is measured debt in plain sight, not a licence; it is
argued in the audit record.

## `CONTRACT-13` — a key nobody draws is not vocabulary

**Situation.** The table holds a key that no screen renders.

**What it emits in source.** Only keys reachable from a `contract="…"`, a
`defineContractComponent("…")` or another entry's slot survive in `CONTRACT_KEYS`. An unbuilt shape is
emitted into a plan record instead.

**Boundary.** Not `CONTRACT-9` — see above. Not `CONTRACT-5`: a key that died because its name was
too generic for anyone to reach for is also an unrepaired `CONTRACT-5`.

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
