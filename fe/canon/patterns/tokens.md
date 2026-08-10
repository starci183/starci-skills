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

## The scale, as it actually is

Five rungs for the seam between things, and they are not evenly spaced:

| Rung | Reads as |
|---|---|
| 8px | things that belong to one unit but stay separate — a row of controls, a run of rows |
| 12px | a label and the thing it names |
| 16px | two groups inside one surface |
| 24px | two blocks on a page |
| 32px | the layout seam — a rail against the column beside it |

There is **no zero rung and no 4px rung**, and their absence is deliberate. The surface this
replaces ran eight rungs including both; the two tightest were the ones nobody applied consistently,
because "touching" and "almost touching" are not a distinction a second author reproduces from
memory. Two things that are one thing do not need a seam at all — they are one element.

Insets take 16px and 24px symmetric, or 12/8 and 16/12 asymmetric. And the relationship that makes
an unfamiliar surface decidable is visible in the table rather than asserted over it: **the house
surface carries a 16px inset around a 16px interior seam.** The edge breathes at the rhythm of the
contents, so the two are one decision and not two.

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

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A class outside the union | It is not a member; the type is the scale | Add the member deliberately, or use the nearest rung |
| A fractional step | Not between rungs — off the ladder, matching nothing on any screen | The nearest rung |
| A bracketed length or raw colour | Chosen once for one screen, findable by nobody, and it does not move when the scale does | A member, or a semantic token |
| A zero or near-zero seam | Two things that need no seam are one element | Make it one element |
| Large text plus heavy weight assembled by hand | It is a heading the outline does not contain, and it stays behind when the scale moves | The component that owns both facts |
| A sixth rung because a screen looked slightly wrong | The scale then describes screens instead of relationships | Ask which level of grouping the seam separates |
| An off-scale value hoisted into a constant | Lifting it out of the markup hides it; it does not license it | The nearest rung |

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
// the house surface: a 16px edge around a 16px interior seam, so the edge breathes at the
// rhythm of what it holds
classes: ["flex", "flex-col", "gap-4", "rounded-2xl", "bg-surface", "p-4", "shadow-surface"]
```

```ts
// the same surface with a tighter edge than its contents: every individual value is on the
// scale, and it still reads as crowded
classes: ["flex", "flex-col", "gap-4", "rounded-2xl", "bg-surface", "px-3", "py-2", "shadow-surface"]
```

They differ in one thing: whether the edge and the interior agree. No single value is wrong.

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
