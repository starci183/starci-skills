# contract

## Definition

A contract is the description of ONE node. It is a key, and the key owns three things that are
worthless apart: the classes the node wears, the element it opens, and the reason what it holds sits
that way. An author who needs a shape types the key. That is the whole layout decision there is.

Everything above the leaves composes keys. A branch renders one, a composite arranges several, a
block asks for one, a page orders them — and not one of them writes a class string, because the
moment a caller can type `flex gap-3`, the tree is decided in as many places as there are call sites
and nothing above can be predicted from the key any more.

The question that settles it: **does this element hold other elements?** If it does, it is a node,
and a node comes from a key. A file that opens a `div` has answered a question the contract table
was supposed to answer.

What holds this law is [`sources/contract.mjs`](../../../sources/fe/contract.mjs) and, more
importantly, the two closed unions in [`sources/contracts.ts`](../../../sources/fe/contracts.ts). The
unions matter more than the rules: a class or an element that is not a member is not forbidden, it
is unrepresentable, and there is nothing to police when the wrong value cannot be typed.

Implementation anchors in `starci-academy-fe`: `src/components/contracts/index.ts` and
`src/components/branches/Tree/index.tsx`.

## Rules

**CONTRACT-1 · A structural node takes its classes from a key, never from a literal.**

`flex`, `grid`, `gap-*`, `items-*`, `justify-*`, `col-*`, the position family — these decide the
shape of a tree rather than the look of one value, and a shape decided at a call site is a shape
nobody can find from anywhere else. The key is the only spelling. This is the rule the others exist
to protect, and each of them closes a door somebody would otherwise walk through while believing
they had obeyed it.

**CONTRACT-2 · A class string is never assembled at runtime.**

`cn(base, isActive && "gap-4")` is the same escape hatch wearing a function call: a second table
with no keys, no reasons and nothing anybody can read back. Interpolation is the same thing again —
a string that exists only while the component runs cannot be inspected, searched, or argued with.
Whatever the branch was testing is a real distinction, and a real distinction earns a key or a named
prop.

**CONTRACT-3 · The class vocabulary is a closed union.**

The classes a node may lay its children out with are a union type, not a convention. `gap-[13px]`
does not fail review; it fails to compile. This is what makes a whole family of patrol rules
unnecessary, and it is why a new spacing value is a deliberate edit to a named list rather than
something that arrives inside a diff nobody read closely.

**CONTRACT-4 · The element belongs to the entry, never to a caller.**

A node is not always a `div`. A run of days IS a list; a field with a submit IS a form; an element
chosen for meaning cannot be swapped for a neutral one without changing what assistive technology
reports. So the entry names its own host, from a closed union, and there is no host prop for a
caller to pass — two call sites of one key that disagreed about the element would be two different
nodes wearing one name.

This rule is load-bearing for a reason that is not obvious. Before it existed the frame drew only
`div`, so any shape that needed `<ul>` had **nowhere lawful to live** and was filed among the leaves
instead, where it could write its own classes. That is how an entire tier filled up with
arrangements. A missing host was not a small gap; it was the hole the vocabulary drained into.

The way it is actually broken is not a `host` prop; nobody adds one. It is a branch that wears an
entry's node on a vendor element of its own. `contractNodeProps(contract)` hands back the classes
and the markers and NOT the element, so spreading them onto `Card.Content`, an accordion body or a
hand-written box erases the host the entry named while every visible sign of the contract stays
exactly where a reader expects it. The entry says `ol` and the document gets `div`: the list leaves
the accessibility tree, nothing announces how many items there are, and the key still resolves, the
markers still read correct, and every gate stays green. It is the failure with no red anywhere. So
a surface branch renders the entry's own node INSIDE its vendor body rather than on it, and the
frame remains the only thing that ever wears one.

**CONTRACT-5 · A key's NAME fixes what goes inside it.**

`card` is not a name here. It says nothing about what it holds, so anything may go in, and the entry
stops constraining anything — and the generic member of a family always wins the call sites from its
specific siblings, because it is the one nobody has to think about. `label-figure-over-bar` says what
it holds, so a wrong child is visible on sight.

The name is also what keeps the reason honest. One key drawing twenty regions cannot say why any one
of them is there; the reason a title and a fact share a baseline is the SAME reason at all twenty.

For a plain node the name is the only thing holding the child contract, because the contents come
from a caller and could be anything. **It is no longer the ONLY thing everywhere** — a compound key
declares every slot inside it and the compiler checks each one, see CONTRACT-11.

That reversal is recorded rather than quiet. The child map was retired because nothing could be
checked once contents arrived as markup: a `.map`, a ternary and an unnamed subtree all look the
same to a rule. Contents arrive as COMPONENTS now, one per named slot, so the check is not a rule at
all — it is the type. The old decision was right for the shape it was made in and wrong for this one.

**CONTRACT-6 · Every entry states why its node exists, and the reason is not the key again.**

The reason is the one thing nobody can reconstruct from the markup later. It names what breaks,
wraps, overflows or stops being pressable when the node is removed. "A row of chips" on `content-row`
costs a line and teaches nothing; "the tags wrap onto their own line before the title does" is the
fact that made the node exist.

**CONTRACT-7 · One frame turns a key into an element.**

An entry becomes real markup in exactly one file. Everywhere else, a NEUTRAL box written by hand — a
`div`, a `section`, a `nav` — is a node with no key: nothing records what classes it should carry,
which children belong inside it, or why it is there. If no key fits the shape being built, that is
the finding — not a reason to open a `div`.

**A semantic element is different, and the difference is not a loophole.** A `form` exists to
submit; a `ul` exists because its contents are a list. Assistive technology reports the element, so
it cannot be swapped for a neutral box, and opening one around a contract node decides no shape at
all. What must still come from an entry is the SHAPE: the moment a semantic element carries a class,
it has stopped being a wrapper and become a node with no key, and the entry that replaces it names
the element as its host.

**CONTRACT-8 · The markers are painted from the entry, never written by hand.**

The frame emits the attributes that identify a node from the entry it is rendering. Written by hand
they claim a contract nothing enforces, and every reader and every test that walks those attributes
then trusts a claim no rule is holding. That is worse than an unmarked node, because an unmarked
node is at least honest.

**CONTRACT-9 · A new key is justified by a shape, never by a different gap.**

A shape none of the existing keys can express earns a key. Wanting the same shape slightly tighter
does not: that is the vocabulary being widened one call site at a time, until the keys describe call
sites instead of shapes and the list is longer than the code that reads it.

**CONTRACT-10 · The contract fixes content; the branch owns wrapper mechanics.**

A contract describes the node that arranges validated content. It does not describe vendor
composition. `Tree` may open the host the entry names; `SurfaceCard` may stand that same node inside
`Card.Content` within `div > Card > Card.Content`; an accordion or list surface may project it into
another wrapper. Those wrappers are branch mechanics, not a second contract vocabulary.

The named surface branch owns its fixed outer seam as ordinary branch code. That seam is not a
second content grammar: it cannot vary by caller, it cannot admit children, and it never receives
contract markers. The contract node stands INSIDE the content host (`Card.Content`, accordion body,
list body) and never on it, because the node props carry no element and wearing them would hand the
entry's host to the vendor. A bound host places `ContractContent` there; a data-driven surface
places the branded component there and passes its ordinary `props`, `on`, and `isLoading`. Creating
keys for the heading line, outer wrapper and caption merely to avoid writing the branch would turn
one host into three contracts.

This is why there is no `CardShell` and no compound table. Repeating `Card > Card.Content` is only
two lines; extracting it would add indirection without owning a policy. `SurfaceCard`,
`SurfaceAccordionCard`, `SurfaceListCard`, and `SurfaceFormCard` are named branches because each owns a distinct wrapper
and still accepts `contract + render` for the content node.

**CONTRACT-11 · An entry declares every slot inside it, and each slot has a name.**

`children` is a record. Each key is a slot name; each value names one or more closed identities:

| the child is | the slot says | the component declares |
|---|---|---|
| another node | `{ contract: "key" }` | `ContractComponent<"key">` |
| a leaf | `{ leaf: "icon", props: { size: "sm" } }` | `LeafComponent<"icon", { size: "sm" }>` |

A node child names a key and the key is checked against the table. A leaf cannot — a leaf is not a
node and has no key — so the slot names the leaf and the props it must take, and the leaf declares
the same pair on its own metadata. The table never imports a component and the compiler still holds
the pairing.

**Slots are named, never counted.** Insert a child into a positional list and every position after
it silently means something else; a name survives the insertion, reads at the call site without
counting, and gives the reason something to refer to.

**`repeats: true` says the live slot is an array; `restingCount: 6` says how many placeholders draw
while waiting.** Live length is dynamic, so it must not be confused with the skeleton count. The
pair is required together: no `restingCount` on a scalar slot, and no repeated slot with an
unspecified resting shape.

The values in `props` are literal constraints, never values injected at runtime. A slot declaring
`props: { size: "sm" }` accepts a leaf component branded with that exact constraint; copy such as a
query-provided label travels through the render component's runtime `props` and never enters the
table.

For a joined list, the relation between peer rows belongs to the root contract. `divide-y` sits on
the content host; a row leaf does not draw an `after` rule or inspect `last-child`. The collection's
domain name (`tasks`, `courses`, `alerts`) remains a field of the content component's named props
type. A generic `items` slot would teach the surface the caller's data model and is not part of the
branch vocabulary.

That joined-list root is `p-0`, with repeated rows as direct children, so every divider reaches both
surface edges. The row contract restores the Card's ordinary `p-4` edge asymmetrically: one row
`p-4`; first `px-4 pt-4 pb-3`; middle `px-4 py-3`; last `px-4 pt-3 pb-4`. The fixed
label/surface/caption assembly contains owner-to-owned units and uses `gap-3`.

The list host also owns the optional fact at the end of its label line. That fact is `xs muted`
beside an `sm semibold` label and qualifies the joined list itself. It must not be projected as a
separate sibling by the caller, and it must not be put in `description`: description is reserved
for the whole-list caption below the surface.

None of this is `children` in the React sense, and that is what makes it checkable. Markup arrives
already built and erases its shape. `ContractSlots<K>` carries a checked bound record and is not
callable. `ContractProjection<K>` carries an explicit `project` function for a branch that already
drew its wrapper. `ContractComponent<K,P>` is the third lane: a real `ComponentType<P>` branded with
the exact key, used when runtime data must remain in `props` instead of being closed into a new
descriptor on every render. Wrong key, props, identity, cardinality, missing slots and extra slots
are compile errors.

**CONTRACT-12 · An entry's classes are the ARRANGEMENT, never the behaviour or the paint.**

`flex`, `grid`, `gap-*`, `items-*`, `justify-*`, the width and inset family: these say how the
children of one node stand together, which is what an entry is for. A cursor, a hover or active
state, a text colour, a text alignment, `group`: these say how one thing REACTS and what it looks
like, and neither is a relationship between children.

The difference is not stylistic tidiness. A node whose entry carries `cursor-pointer` and
`hover:opacity-80` is claiming to be pressable, while the thing that actually presses — the button,
the link, the control that owns the handler and the disabled state — is somewhere else entirely. Two
owners for one promise, and the table is the one that cannot be told the promise is off: an entry
cannot know that this call site passed no handler, so it goes on drawing a pointer over something
that does nothing.

So behaviour belongs to the component that owns the behaviour. A press target is a named branch that
draws its own control and puts the arranged node inside it; the entry inside stays a pure
arrangement and can be reused by a row that presses and a row that does not.

The paint follows the same verdict, and it has a consequence worth stating outright: **a surface is a
COMPONENT, not a class list.** The named surface branches draw the ground, the radius and the
elevation, so an entry that paints `bg-surface`, `rounded-2xl` or `shadow-surface` is a second way to
make a thing that already has an owner. What that costs is paid by every later reader of the table:
it then holds two kinds of card — one a branch draws, one a key draws — and no key tells anybody
which kind they are looking at. The next author reaches for whichever is nearer, and the day the
house surface changes its radius or its elevation, only one of the two kinds moves.

**CONTRACT-13 · A key nobody renders is not vocabulary.**

An entry is a promise about a node that exists — these classes, this element, this reason, standing
in the document — so a key with no user is a promise about nothing, and a promise about nothing does
not sit quietly. It survives every rename, because renaming follows call sites and it has none. It
is copied into the next repository, because the table travels whole and nothing in it says which
members were ever drawn. And it makes the table longer than the code that reads it, which is how a
reader stops trusting the table as a description of the product: once some keys describe screens and
others describe intentions, telling them apart means searching the source, and a vocabulary that has
to be searched before it can be believed is not one anybody types from.

So delete it. A key kept for work that has not started belongs in the plan record, where an unbuilt
shape is exactly what a reader expects to find, and not in the vocabulary, where everything present
is taken to be on screen.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| An interaction or paint class in an entry (`cursor-*`, `hover:*`, `active:*`, `focus:*`, `group`, `text-left`, a text colour) | The node claims a behaviour it does not own, and the table cannot be told when that behaviour is absent | Give the behaviour to the branch that owns the control, and leave the entry its arrangement |
| A branch that renders somebody else's key on a host of its own choosing | Two call sites of one key then disagree about the element, which is CONTRACT-4 wearing a helper's name | Draw your own control and put the key's own node inside it |
| `contractNodeProps(contract)` spread onto a vendor element | The props carry the classes and the markers and not the element, so an entry that says `ol` reaches the document as a `div` and the list leaves the accessibility tree with every gate still green | Render the entry's own node inside the vendor body; only the frame wears a host |
| A literal structural class (`flex`, `gap-4`, `items-center`) outside the table or a named surface host | The node's shape is decided at a call site, where nothing above it can find or predict it | Add or reuse a key; fixed vendor-wrapper mechanics belong only to their named surface branch |
| `cn`, `clsx`, `twMerge`, `cva` or any runtime class composition | A second table with no keys, no reasons and nothing readable from outside | Give the distinction a key, or a named prop on the component that owns the node |
| An interpolated `className` | The string exists only while the component runs, so nothing can read it back | Move the whole string into an entry and pass the key |
| A class not in the union | It escapes the vocabulary the whole system is defined by | Add the member deliberately, or use the nearest one that exists |
| A `host` or `as` prop on the frame | Two call sites of one key could then disagree about the element, which is two nodes wearing one name | Name the host on the entry |
| Opening `<ul>`, `<form>` or `<nav>` by hand because the frame "only draws divs" | It no longer does. This is the exact hole that filled the leaf tier with arrangements | Give the entry a host |
| A key named `card`, `box`, `wrapper`, `row` | It admits anything, so it constrains nothing and drains the call sites from its specific siblings | Name what it holds |
| A reason that restates the key | It costs a line and teaches nothing, and the next author cannot tell whether the node is load-bearing | State what breaks, wraps or overflows without the node |
| A structural host written outside the frame or a named surface host branch | It is a node with no key, no child contract and no recorded reason | Compose the key; surface branches alone may open the fixed wrapper around their checked content host |
| Hand-writing a contract marker attribute | The node claims a contract nothing enforces, and every test that reads those attributes believes it | Render the key and let the frame paint them |
| A new key because the existing one is the wrong size | The vocabulary grows one call site at a time until it describes call sites, not shapes | Use the key that exists, or change the entry for everyone |
| A key in the table that nothing renders | It promises a node that does not exist, survives every rename because it has no call sites, and lengthens the table past the code that reads it until the table stops describing the product | Delete it; a shape wanted for work that has not started belongs in the plan record |
| `children` on a structural node | Markup arrives already built, so nothing above can say what is inside and no rule can check | Declare the slots on the entry and pass one component per slot in `render` |
| A bare arrow or literal JSX in a `render` slot | It carries no contract/leaf metadata | Brand the stable component type with `defineContractComponent`; pass runtime data through `props` |
| A positional list of children instead of named slots | Insert one in the middle and every slot after it silently means something else | Name each slot; a name survives the insertion |
| A leaf without a `name` on its metadata | Two leaves taking the same props become interchangeable, and a slot asking for a glyph will accept a label | Give every leaf its name beside its tier marker |
| A hand-written skeleton tree beside a list | Loading cardinality drifts away from the live shape | Put `repeats: true` and `restingCount` on the slot |
| A boolean prop choosing between two arrangements | One of the two ends up with no key, no reason and no name — it exists on screen and nowhere in the table | Two shapes are two keys, and both get named |
| A compound/CardShell table for `Card > Card.Content` | It models wrapper mechanics as a second vocabulary and adds indirection without a policy | Let the named surface branch own the wrapper and apply the content contract to its body |

## Examples

### The ordinary case — a node is a key

```tsx
// The wrapper passes named runtime props; the branded content draws the one contract root.
export const SurfaceListCard = ({ props, on, contract, render: Content, isLoading }: SurfaceListCardProps) => (
    <div className="flex flex-col gap-3">
        {props.fact === undefined ? (
            <Heading props={{ content: props.label, level: 3 }} />
        ) : (
            <Tree contract="label-with-muted-fact-row" render={labelAndFactFrom(props)} />
        )}
        <Card className="p-0" data-component="SurfaceListCardSurface">
            <Card.Content className="p-0">
                <Content props={props} on={on} isLoading={isLoading} />
            </Card.Content>
        </Card>
        {caption}
    </div>
)

const DailyQuestContentView = ({ props }) => (
    <Tree contract="daily-quest-list" render={rowsFrom(props.tasks)} />
)
const DailyQuestContent = defineContractComponent("daily-quest-list", DailyQuestContentView)
<SurfaceListCard
    contract="daily-quest-list"
    render={DailyQuestContent}
    props={{ label, fact, description, tasks }}
/>
```

```tsx
// Wrong: the wrapper accepts untyped markup, so the contract cannot prove what the card contains.
export const SurfaceCard = ({ props, children }: SurfaceCardProps) => (
    <div className="flex flex-col gap-3">{children}</div>
)
```

They differ in one thing: whether the content body is checked by the contract it claims.

### The host trap — the hole the vocabulary drained into

```ts
// The entry names its element, so a run of days is a list and still comes from a key - and
// `repeats` says both that the slot holds many and how many rest while they load.
"weekday-run": {
    classNames: ["flex", "flex-row", "flex-wrap", "items-center", "gap-2"],
    children: { day: { leaf: "day-cell", props: { size: "sm" }, repeats: true, restingCount: 6 } },
    host: "ul",
    why: "a run of equal columns only reads as one span of time while the columns stay on one line",
}
```

```tsx
// Wrong: no host was available, so the shape was filed among the leaves where it could write
// its own classes - and the same class string now exists in two places that no rule reads together.
const RUN_CLASSES = "flex flex-row flex-wrap items-center gap-2"
export const StreakWeekRun = ({ props }: StreakWeekRunProps) => <ul className={RUN_CLASSES}>{/* ... */}</ul>
```

They differ in one thing: whether the element was expressible in an entry.

### The composition trap — a helper is not an exemption

```tsx
// Two shapes are two keys. The distinction was real, so it got a name.
<Tree contract={props.isCompact ? "stacked-peer-controls" : "stacked-sections"} render={render} />
```

```tsx
// Wrong: a second table with no keys and no reasons, and `gap-4` is now invisible to every
// rule and every reader that looks at the entry table.
<div className={cn("flex flex-col", props.isCompact ? "gap-2" : "gap-4")}>{children}</div>
```

They differ in one thing: whether the distinction earned a name or was spent inline.

### The naming trap — a key that admits anything

```ts
// The name fixes the inside, so a wrong child is visible on sight, and one reason is true for
// every place the key is used.
"title-with-baseline-fact": {
    classes: ["flex", "flex-row", "flex-wrap", "items-baseline", "gap-2"],
    why: "the fact reads as part of the heading sentence, so it sits on the title's baseline and wraps under it",
}
```

```ts
// Wrong: `card` will hold a list here, a form there and a chart next month, and no single
// sentence can say why all three sit that way.
"card": {
    classes: ["flex", "flex-col", "gap-4", "p-4", "rounded-2xl", "bg-surface"],
    why: "a card",
}
```

They differ in one thing: whether the name constrains what may be passed.

### The reason trap — a label is not a why

```ts
why: "the tags wrap onto their own line before the title does, so a long title never breaks mid-word"
```

```ts
why: "row of chips"
```

They differ in one thing: whether the sentence says what breaks when the node is removed.
