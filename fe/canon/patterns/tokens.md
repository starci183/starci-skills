# tokens

## Definition

A token is a member of a closed set. Not a value somebody agreed to prefer — a value that is the
only thing which can be typed, so a screen off the scale is not a screen that failed review, it is a
screen that failed to compile.

Most of this law is therefore held by a type, and the rest of it exists to cover the one place the
type does not reach. That division is the whole shape of this file: **the union protects the table,
and the rules protect the folder the union cannot see.**

What holds this law is the closed union in
[`sources/fe/contracts.ts`](../../../sources/fe/contracts.ts) and, for what a union cannot see,
[`sources/fe/tokens.mjs`](../../../sources/fe/tokens.mjs).

Implementation anchors in `starci-academy-fe`: `src/components/contracts/index.ts` and
`src/components/branches/Tree/index.tsx`.

## The scale, as it actually is

Six rungs for the seam between things, and they are not evenly spaced:

| Rung | Reads as |
|---|---|
| 4px | `gap-1`: two lines of ONE identity — a name over its handle, a figure over the word labelling it, a title over its muted subtitle, a price over the caption qualifying it |
| 8px | `gap-2`: compact horizontal peers in one functional cluster — icon and label, peer tabs, grouped cards, or an input and its direct inline action |
| 12px | `gap-3`: owner-to-owned or independently readable local units — label to card/input, field to field, card to caption, toolbar to governed content, or unrelated groups sharing a row |
| 16px | `gap-4`: two participants that are each already a cluster — a stack over the stack beneath it, an identity cluster against the trailing fact at the far end of its row, a prompt against the action answering it, or peer cards repeating across a grid |
| 24px | two blocks on a page |
| 32px | the layout seam — a rail against the column beside it |

`gap-2` requires two facts at once: the peers are horizontal AND they form one functional cluster.
Fail either test and the seam is `gap-3`. The tokens are selected by relationship and grouping,
never by component name or direction:
an input and its direct action may use `gap-2` when they share one horizontal control, while a label
above that input uses `gap-3`. Horizontal parts that are separate semantic groups also use `gap-3`.
A subtle feed chronology may use `gap-2` between date labels and result cards, but the toolbar above
that chronology uses `gap-3`. `gap-4` is selected the same way and by the participants alone: once
each side is itself composed, the seam between them out-ranks the seams inside them, in a column, a
row and a grid alike. There is **no zero rung**, and its absence is deliberate: "touching" and
"almost touching" are not a distinction a second author reproduces from memory, so the surface this
replaces ended up spelling one identity stack both ways. Only the 4px rung survived that, and it
survived because it names a relationship rather than an amount — the second line qualifies the
first. A container that wants no seam at all declares no gap class, which is a different statement
from naming a rung that measures nothing.

Insets take 16px and 24px symmetric, or 12/8 and 16/12 asymmetric. And the relationship that makes
an unfamiliar surface decidable is visible in the table rather than asserted over it: **the house
surface carries a 16px inset around a 16px interior seam.** The edge breathes at the rhythm of the
contents, so the two are one decision and not two.

An ordinary Card therefore uses `p-4`. A joined-list Card preserves that same 16px outer edge
without insetting its dividers: both vendor Card and content host are `p-0`, the list root is `p-0`;
a single row is `p-4`; first/middle/last
rows are respectively `px-4 pt-4 pb-3`, `px-4 py-3`, and `px-4 pt-3 pb-4`.
When the generic Card token is enforced with `!important`, the joined-list root uses a semantic
`data-component` selector at equal strength. Utility presence is insufficient; computed padding
on the rendered test-account page must be `0px`.

Buttons have two height tokens, selected by placement rather than importance:

| Token | Placement |
|---|---|
| `sm` | Embedded action inside a row, list item, compact toolbar, card cluster or another control's local seam; reactions in an activity row belong here |
| `md` | Standalone action that owns a line or anchors a form or surface |

The `variant` axis remains independent: it says whether an action is primary, secondary, outline,
or tertiary; it does not select height. A primary action may be `sm` in a compact cluster, and a
tertiary action may be `md` when it stands alone. Label length never changes the size token.

## Rules

**TOKEN-1 · The vocabulary is a union, so an off-scale value is unrepresentable.**

`gap-[13px]` is not forbidden — it is not a member. That single property removes a whole family of
patrol rules: there is nothing to police once the wrong value cannot be typed, and nothing to argue
about once the compiler has already refused.

**TOKEN-2 · A new member is an edit to the scale, and reads as one.**

Growing the union is a decision about the house rhythm, taken deliberately, in a named list where
the diff shows it. That is the opposite of a value arriving inside a component nobody reviewed
closely, which is how a scale acquires a sixth rung that only one screen uses.

**TOKEN-3 · A fractional step is never on the scale.**

The rungs are whole steps and unevenly spaced, so a half-step is not "between two rungs" — it is off
the ladder entirely, and it will match nothing else on any screen. This is exact rather than a
matter of taste: there is no case where the correct answer is half of a rung.

**TOKEN-4 · An arbitrary value escapes the system, whatever it evaluates to.**

A bracketed length or a raw colour is a value chosen once, by one person, for one screen. Even when
it happens to equal a rung, it cannot be found by anybody searching the scale, and it does not move
when the scale moves.

**TOKEN-5 · Rank comes from the type scale, never from a hand-rolled combination.**

Large text plus heavy weight IS a heading, whatever element carries it. Assembled out of raw classes
it is a heading nothing else knows about: the outline a screen reader builds does not include it, and
the day the type scale changes it stays behind. Headings come from the one component that owns both
facts at once.

**TOKEN-6 · The rules exist for the folder the union cannot see.**

Every tier above the leaves takes its classes from an entry, and the entry is typed — so the union
already holds them. The leaf folder writes its own classes and is exempt from the entry rules by
policy, which makes it the one place an off-scale value can still be typed. That is what these rules
patrol, and it is why they read class strings in source rather than only entries.

They also read a class string hoisted into a module constant, because hoisting is where the last
off-scale value in this codebase survived every rule that existed.

**TOKEN-7 · Semantic colour is paired by the surface that carries it.**

A bare success word or glyph uses `text-success`. A soft success plate pairs
`bg-success-soft` with `text-success-soft-foreground`; a solid success plate pairs `bg-success`
with `text-success-foreground`. Warning and danger follow the same three roles. A background token
is not a foreground token: using `text-success-soft` on a bare check confuses the plate colour with
the ink intended to sit on it and breaks contrast across themes.

**TOKEN-8 · Button size follows placement, while variant follows priority.**

An embedded action uses `sm`; a standalone action that owns a line uses `md`. These are the only
button sizes because each names a reproducible relationship. Inferring height from primary versus
tertiary, from the number of words, or from how visually loud the control feels mixes independent
axes and makes the same role change geometry between screens.

**TOKEN-9 · A class that names a token means nothing until the theme defines it.**

`max-w-app-lg` is not a width. It is a REQUEST for `--container-app-lg`, and when that variable does
not exist the class is still emitted, the element still renders, and nothing anywhere goes red — the
union admits the name, the compiler is satisfied by the union, and the page silently loses its
measure.

This is the one dead value a closed union cannot catch, and it is worse than an off-scale value for
exactly that reason: an off-scale value fails to compile, while this one passes every gate and ships.
A repository already carried such a member for long enough to write a comment about it beside another
entry rather than delete it.

So the two halves are checked together: the name is a member of the union, AND the variable it asks
for is defined in the stylesheet. Names Tailwind resolves itself — `screen`, `full`, `fit`, the
viewport units — promise nothing about the theme and are not this rule's business; a rule that
reported them would send an author to define a variable nothing reads.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A class outside the union | It is not a member; the type is the scale | Add the member deliberately, or use the nearest rung |
| A fractional step | Not between rungs — off the ladder, matching nothing on any screen | The nearest rung |
| A bracketed length or raw colour | Chosen once for one screen, findable by nobody, and it does not move when the scale does | A member, or a semantic token |
| A written zero rung | Zero is a step off the ladder, not its bottom step, and naming it implies a rung below | Declare no gap class at all |
| The compact rung between two lines of one identity | `gap-2` separates two facts; a qualifying line is not a second fact | `gap-1` |
| Large text plus heavy weight assembled by hand | It is a heading the outline does not contain, and it stays behind when the scale moves | The component that owns both facts |
| A sixth rung because a screen looked slightly wrong | The scale then describes screens instead of relationships | Ask which level of grouping the seam separates |
| An off-scale value hoisted into a constant | Lifting it out of the markup hides it; it does not license it | The nearest rung |
| A `*-soft` background token used as text colour | Plate and foreground roles are different and have different contrast duties | Bare `text-*`, or pair `bg-*-soft` with `text-*-soft-foreground` |
| Button size inferred from variant | Visual priority does not say whether the action is embedded or standalone | Select variant from priority and size from placement |
| Custom padding used to shrink a button | It creates a third, local control height outside the closed set | Use `sm` for an embedded action |

## Examples

### The type doing the work

```ts
classes: ["flex", "flex-col", "gap-4"]
```

```ts
classes: ["flex", "flex-col", "gap-[15px]"]
```

They differ in one thing: whether the second one compiles. It does not — which is why no rule needs
to have an opinion about it.

### The matching inset

```ts
// the content node the house surface holds: a 16px edge around a 16px interior seam, so the
// edge breathes at the rhythm of what it holds
classes: ["flex", "flex-col", "gap-4", "p-4"]
```

```ts
// the same node with a tighter edge than its contents: every individual value is on the
// scale, and it still reads as crowded
classes: ["flex", "flex-col", "gap-4", "px-3", "py-2"]
```

They differ in one thing: whether the edge and the interior agree. No single value is wrong. The
ground, the radius and the elevation appear in neither, because the surface branch draws them and an
entry only arranges what stands inside — see CONTRACT-12 in
[`contract.md`](contract.md).

### The leaf, where the rules earn their place

```tsx
// inside the one folder that writes its own classes: on the scale
const GLUE = "inline-flex items-center gap-2"
```

```tsx
// the same folder, half a rung: off the ladder, and the entry rules do not look here
const GLUE = "inline-flex items-center gap-1.5"
```

They differ in one thing: whether the value exists anywhere else in the product.

### The hand-rolled heading

```tsx
<Heading props={{ content: title, level: 2 }} />
```

```tsx
<span className="text-2xl font-bold">{title}</span>
```

They differ in one thing: whether a screen reader's outline contains the title.

### The embedded action

```tsx
<Button props={{ label: reactionLabel, variant: "ghost", size: "sm" }} />
```

```tsx
<Button props={{ label: reactionLabel, variant: "ghost", size: "md" }} />
```

They differ in one thing: whether an action embedded in a feed row uses the compact placement token.

### Priority is not size

```tsx
<Button props={{ label: submitLabel, variant: "primary", size: "md" }} />
```

```tsx
<Button props={{ label: submitLabel, variant: "primary", size: "sm" }} />
```

They differ in one thing: whether a standalone form anchor uses the resting placement token; both
remain primary.
