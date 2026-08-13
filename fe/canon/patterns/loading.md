# loading

## Definition

A surface waiting for data draws **the same shape it will draw when the data arrives**, with the
values taken out. Not a different tree, not a stack of grey bars that happens to look similar — the
same components, in the same arrangement, resting.

The reason is drift, and it is not hypothetical. A second tree describing the first is a description
that nobody updates: it is correct on the day it is written, and wrong the first time the real shape
changes. Nothing turns red, because a resting shape has no assertion to fail — it is simply wrong on
screen, and only for the second somebody happens to be watching.

The question that settles it: **if this component changes shape tomorrow, does the waiting version
change with it?** If it does not, it is a second description and it will drift.

What holds this law is [`sources/fe/loading.mjs`](../../../sources/fe/loading.mjs).

Implementation anchors in `starci-academy-fe`: `src/components/leaves/Text/index.tsx` and
`src/components/blocks/dashboard/pending-gate.test.tsx`.

## How the two halves meet

This is the seam most often got wrong, so it is written down rather than inferred. A block and a leaf
express waiting differently, and the translation between them is one line:

| Tier | How waiting is expressed |
|---|---|
| block | `pending` is a member of the state union — a real situation, beside `ready`, `empty`, `failed` |
| leaf, composite | `isLoading`, a flag received and never decided |
| the seam | `const isLoading = input.state === "pending"` in the presentational half |

The block owns the SITUATION because only it knows whether the answer has arrived. The leaf owns the
LOOK of resting because only it knows its own anatomy. Neither can do the other's half, and the one
line between them is where they meet.

## Rules

**LOADING-1 · One shape, two states. Never two trees.**

The component that draws the data draws the waiting. It does not delegate to a twin, and nothing
hands it a ready-made placeholder to render instead of itself.

**LOADING-2 · A resting element is the SAME element, emptied.**

Same tag, same arrangement, same measure — the values gone and a resting surface in their place. That
is what makes the layout hold still at the moment data lands, and holding still is the entire point:
a reader who has begun reading loses their place when the page moves under them.

**LOADING-3 · The resting shape keeps the section's height.**

A region that draws nothing while waiting collapses, and the whole column below it jumps when the
answer arrives. A run of rows rests as a run of rows — the count is a decision, made so the resting
region is the size of a real one.

**LOADING-4 · A resting element is hidden from assistive technology.**

There is nothing to read yet. A shimmer announced to a screen reader is noise at the exact moment a
reader is waiting to be told something, and the emptied values would be read as blanks.

**LOADING-5 · A control is not drawn before it has somewhere to go.**

A resting card leaves the place where its action will be empty rather than shimmering a button. A
target that arrives before its destination is one a reader presses and learns nothing from — and
pressing it is the fastest way to teach them the surface is not to be trusted.

**LOADING-6 · Each region owns its own waiting.**

One flag shared across independent requests makes the fastest region wait for the slowest, and blurs
several honest situations into one. A screen that fills in over a second reads faster than one that
appears all at once after three.

**LOADING-7 · The waiting state is a real situation, not the absence of one.**

`pending` sits in the union beside `ready`, `empty` and `failed`, and it carries what it needs to
draw the frame — the region's own name does not disappear while its contents are on their way. A
component that treats waiting as "no data yet" cannot tell it from "there is none", and those two
need different words.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A twin component whose job is to mirror another's shape | It cannot be kept in step; it can only be noticed after it has already drifted | Give the component a resting state |
| A `skeleton={<...>}` prop | Same second tree, handed in from outside, where it is even further from the shape it copies | Pass the flag down |
| A ternary choosing between two DIFFERENT components | It is a resting shape written at the call site, and it drifts from the real one | One component, two states |
| A region that draws nothing while waiting | The column jumps when the answer lands, and the reader loses their place | Rest at the height of a real one |
| A shimmer announced to assistive technology | Noise at the moment a reader is waiting to be told something | Hide it while it rests |
| A control drawn before its destination exists | A reader presses it and learns the surface cannot be trusted | Leave the place empty until there is somewhere to go |
| One flag across independent requests | The fastest region waits for the slowest, and four situations become one | Let each land when it lands |
| Treating waiting as missing data | "Not arrived" and "there is none" need different words | Make `pending` a member of the union |

## Examples

### The seam, in one line

```tsx
// the block owns the situation; the leaf owns what resting looks like
const isLoading = input.state === "pending"
```

```tsx
// the block decides what resting LOOKS like, which is the leaf's own anatomy
{input.state === "pending" ? <div className="h-4 w-24 animate-pulse rounded bg-default" /> : <Text ... />}
```

They differ in one thing: which file knows the shape of the thing that is resting.

### The same element, emptied

```tsx
<Avatar props={{ name }} isLoading={isLoading} />
```

```tsx
{isLoading ? <AvatarSkeleton /> : <Avatar props={{ name }} />}
```

They differ in one thing: whether the waiting version changes when the real one does.

### The height

```tsx
// a run of rows rests as a run of rows, so nothing moves when the data lands
const rows = isLoading ? RESTING_ROWS : props.rows
```

```tsx
// nothing is drawn, the section collapses, and the whole column jumps on arrival
{isLoading ? null : props.rows.map(...)}
```

They differ in one thing: whether the reader keeps their place.

### The control with nowhere to go

```tsx
{item === undefined ? null : <SeeMoreLink props={{ label: resumeLabel }} on={{ press }} />}
```

```tsx
<SeeMoreLink props={{ label: resumeLabel }} isLoading={isLoading} on={{ press }} />
```

They differ in one thing: whether a reader can press something that does not lead anywhere yet.
