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

**CONTRACT-5 · A key's NAME fixes what goes inside it.**

`card` is not a name here. It says nothing about what it holds, so anything may go in, and the entry
stops constraining anything — and the generic member of a family always wins the call sites from its
specific siblings, because it is the one nobody has to think about. `label-figure-over-bar` says what
it holds, so a wrong child is visible on sight.

The name is also what keeps the reason honest. One key drawing twenty regions cannot say why any one
of them is there; the reason a title and a fact share a baseline is the SAME reason at all twenty.

Since the child map was retired, the name is the ONLY thing holding the child contract. A rule can
no longer check what goes inside a node; a reader can, and only if the name tells them.

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

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A literal structural class (`flex`, `gap-4`, `items-center`) outside the table | The node's shape is decided at the call site, where nothing above it can find or predict it | Add or reuse a key and render it through the frame |
| `cn`, `clsx`, `twMerge`, `cva` or any runtime class composition | A second table with no keys, no reasons and nothing readable from outside | Give the distinction a key, or a named prop on the component that owns the node |
| An interpolated `className` | The string exists only while the component runs, so nothing can read it back | Move the whole string into an entry and pass the key |
| A class not in the union | It escapes the vocabulary the whole system is defined by | Add the member deliberately, or use the nearest one that exists |
| A `host` or `as` prop on the frame | Two call sites of one key could then disagree about the element, which is two nodes wearing one name | Name the host on the entry |
| Opening `<ul>`, `<form>` or `<nav>` by hand because the frame "only draws divs" | It no longer does. This is the exact hole that filled the leaf tier with arrangements | Give the entry a host |
| A key named `card`, `box`, `wrapper`, `row` | It admits anything, so it constrains nothing and drains the call sites from its specific siblings | Name what it holds |
| A reason that restates the key | It costs a line and teaches nothing, and the next author cannot tell whether the node is load-bearing | State what breaks, wraps or overflows without the node |
| A structural host written outside the frame | It is a node with no key, no child contract and no recorded reason | Compose the key; if none fits, that is the finding |
| Hand-writing a contract marker attribute | The node claims a contract nothing enforces, and every test that reads those attributes believes it | Render the key and let the frame paint them |
| A new key because the existing one is the wrong size | The vocabulary grows one call site at a time until it describes call sites, not shapes | Use the key that exists, or change the entry for everyone |

## Examples

### The ordinary case — a node is a key

```tsx
// The shape has a name, the name says what it holds, and the reason lives with it.
export const SurfaceCard = ({ props, children }: SurfaceCardProps) => (
    <Tree contract="label-row-over-card">{children}</Tree>
)
```

```tsx
// Wrong: the same output, decided here. Whoever needs this surface tomorrow cannot find it,
// and nothing records why the label sits outside the card it names.
export const SurfaceCard = ({ props, children }: SurfaceCardProps) => (
    <div className="flex flex-col gap-3">{children}</div>
)
```

They differ in one thing: whether the arrangement has a name somebody else can find.

### The host trap — the hole the vocabulary drained into

```ts
// The entry names its element, so a run of days is a list and still comes from a key.
"weekday-run": {
    classes: ["flex", "flex-row", "flex-wrap", "items-center", "gap-2"],
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
<Tree contract={props.isCompact ? "stacked-peer-controls" : "stacked-sections"}>{children}</Tree>
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
