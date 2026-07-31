# composite

A reusable shape assembled from atoms inside frames.

> **Read the worked examples first:** [`../examples/composite.md`](../examples/composite.md) — real components
> at this tier, each with what it renders and why it sits here. The rules below are easier to judge
> once the examples are in front of you.

## At a glance

| | |
|---|---|
| group | vocabulary — a word any product can use |
| owns | a reusable shape assembled from atoms inside frames |
| never | knows any domain entity |
| may import | atoms, frames — **never the vendor** |
| takes `className` | **no — `classNames: Array<AllowedClassName>`** |
| composes classes (`cn`) | yes |
| tiers below | atom · frame |

## Rules

**COMPOSITE-1 · It owns a reusable shape assembled from atoms inside frames.**

Anything outside that scope belongs to another tier, whatever the folder says.

**COMPOSITE-2 · It never knows a domain entity.**

This is the line that decides the tier, not a preference about style.

**COMPOSITE-3 · It may import: atoms, frames — and the vendor is not one of them.**

Imports run downward only. A lower tier that reaches up stops being usable anywhere the upper tier
is absent.

**"Downward only" does not cover the vendor**, because a UI library is not a tier — it sits beside
the whole diagram, reachable from anywhere, which is exactly what makes it the easiest rule to
break without noticing. ATOM-9 says the vendor stops at the atom tier. This is the same sentence
read from above: a composite importing a library component has reached *past* the atom that exists
to wrap it.

Two different failures hide behind one symptom, and they need different answers:

| What you find | What it means |
|---|---|
| the house already has that atom | plain error — use it; the atom exists precisely so this import does not happen |
| the house has no such atom | the atom is **missing**; add it, then use it |

The second is the valuable one. Every vendor import in a composite is a component the design system
has not named yet, and the list of them is a to-do list for the tier below — not a licence.

The utility exception: `cn`, or whatever your library calls its class-merging helper, is a function,
not a component. It composes strings and renders nothing, so it may be imported anywhere.

Why this matters more here than anywhere else: swapping the library is meant to be a change in the
atom tier alone. One composite reaching past it turns that into a change in every file that did.

**COMPOSITE-4 · The prop is `classNames: Array<AllowedClassName>` — the same closed union an atom and a frame take.**

One vocabulary for position, at every vocabulary tier. See [`atom.md`](atom.md) ATOM-5 for the union
and the reasoning; nothing about being two tiers up changes it.

It matters more here than below, because a composite is where the string usually enters. A composite
that declares `className?: string` and forwards it into an atom has re-opened the door the atom just
closed — the atom's union is enforced at its own signature and says nothing about what a caller
handed to the thing wrapping it. Half the atom-tier violations found in practice arrive this way.

**There is no `@deprecated` stage** here either. A prop marked deprecated is a door still open with
a sign on it: callers keep walking through, the compiler keeps allowing it, and the rule now has a
documented exception — which reads as compliance when a gate goes green beside it. Delete the old
prop in the change that introduces the new one; where a caller genuinely cannot move, that caller is
the finding, and the prop stays only while that debt entry is open.

**COMPOSITE-5 · It composes classes (`cn`): yes.**

Deciding appearance is exactly this tier's work.

**COMPOSITE-6 · It belongs here when: props are shapes: items, title, onPress.**

Use this to confirm a placement, not to argue one.

**COMPOSITE-7 · It is in the wrong tier when: a prop names a domain entity — it is a block.**

This is the detection signal — the thing to look for in review.

**COMPOSITE-8 · Props are slots and shapes, never fields of an entity — and a repeated part arrives as DATA, not as elements.**

`items`, `title`, `onPress`, `header`/`body`/`footer`. The moment a prop is named after a domain
field, the component has moved a tier up.

**The repeated part is the half that gets built backwards.**

```tsx
<SurfaceCard items={rows} />                        // yes — data
<SurfaceCard items={rows.map(r => <Row {...r} />)} /> // no  — elements
```

An element handed in is **frozen**. The composite cannot reach inside it to say "you are loading" —
not without `cloneElement`, which silently overwrites props the caller set and is unreadable at
both ends. So the moment a composite accepts pre-built children for its repeated part, it has given
away COMPOSITE-10: it can no longer decide which parts shimmer.

And the decisive case is the one that looks fine until you try it: **while loading there is no data
yet**. Hand a composite elements and ask what the caller passes during load. An empty array renders
nothing. Three placeholder elements built by the caller puts the number three back at the call site
— which is exactly the decision COMPOSITE-10 just placed with the composite, handed straight back.

With data, both states fall out of one shape:

```tsx
{isSkeleton
    ? Array.from({ length: 3 }, (_, i) => <Row key={i} isSkeleton />)
    : items.map((item) => <Row key={item.id} {...item} />)}
```

The composite owns the row component, so it can render it either way. That is the whole reason the
prop is data.

**A named slot on a composite takes a COMPONENT, not a node.**

This is where a composite parts company with a frame. A frame's `body` is `ReactNode` and that is
correct — a frame only arranges, it has no opinion about loading, so a finished node is exactly what
it wants. A composite owns the loading state of the shape, so a finished node is the one thing it
cannot use.

```tsx
body: ReactNode                              // frame — arrange it, nothing more
body: ComponentType<{ isSkeleton?: boolean }> // composite — it must be able to build it
```

```tsx
const Summary = ({ isSkeleton }) => <Typography isSkeleton={isSkeleton} text="…" />

<SurfaceCard body={Summary} />         // yes — a reference; the card calls it
<SurfaceCard body={<Summary />} />     // no  — already called; the card cannot reach inside
```

**Uncalled is the whole point.** A node handed in has already been built with the props the caller
chose; the only way in afterwards is `cloneElement`, which silently overwrites those props and is
unreadable from both ends. Handed the function instead, the composite calls it — with
`isSkeleton`, with whatever else the shape needs — and the caller's closure still supplies
everything else:

```tsx
const Summary = ({ isSkeleton }) => <Metric isSkeleton={isSkeleton} value={total} />
```

The house already uses this and wrote down why, on `leadingIcon`: *"the path for callers who must
NOT hold an atom/JSX"*. Receiving the icon **unbuilt** is what lets the composite force `size-5`,
make the colour follow the label, and pass the flag. Once the caller has called it, none of those
are available.

**The same trap, one level in: a `ReactNode` field inside an item.**

```ts
interface Row { title?: ReactNode }

<Card items={[{ title: "Hello" }]} />                     // the card can wrap and shimmer it
<Card items={[{ title: <Typography text="Hello" /> }]} />  // frozen
```

One type, two opposite behaviours, and **the type cannot tell them apart**. `ReactNode` on anything
a composite is responsible for is `children` wearing a name.

| The part holds | Type it |
|---|---|
| text the composite renders | `string` — it wraps it in the atom itself |
| an icon | `ComponentType` — a reference, never a built element |
| a sub-shape | that shape's own data interface |
| a whole region | `ComponentType<{ isSkeleton?: boolean }>` |

`ReactNode` does not appear in that table, and its absence is the rule. If a composite renders it,
the composite must be able to build it.

> **Test:** has this already been called by the time it reaches you? If yes, you cannot tell it that
> it is loading — and deciding that is your job.

**COMPOSITE-9 · Two components may share data and differ only in placement.**

A ratio as a ring and the same ratio as a bar are two components on purpose. Placement is a shape decision, and merging them hides it behind a variant flag.

**COMPOSITE-10 · It takes `isSkeleton` and decides WHICH parts shimmer and HOW MANY. It never draws one.**

```ts
isSkeleton?: boolean
```

The loading state splits across two tiers, and the split is the same one the whole architecture
runs on — **value versus arrangement**:

| | Owned by | Because |
|---|---|---|
| the **shape** of one shimmer — line box, width, radius | the **atom** | only it knows the space its value will occupy (ATOM-4) |
| **which** parts shimmer, and **how many** | the **composite** | only it knows what it is a shape *of* |

A loading list is three rows. A loading card is a label and a body, not two identical bars. Nothing
one tier down can supply the number three, or know that this card's title shimmers while its footer
does not — that is a fact about the composition, and the composition is what a composite is.

So a skeletal composite renders its **real structure**, with the atoms it would render anyway, each
handed `isSkeleton`. The count comes from the composite; the shape of each comes from the atom.

```tsx
// a list, loading: the composite chooses three; each row's atoms draw themselves
{isSkeleton
    ? Array.from({ length: 3 }, (_, i) => <Row key={i} isSkeleton />)
    : items.map((item) => <Row key={item.id} {...item} />)}
```

**What it must not do is draw the bar.** Reaching for the vendor's `Skeleton` is guessing at a shape
one tier below, and the guess is invisible until data lands and the row jumps — the single thing a
skeleton exists to prevent.

The frame stays real throughout: padding, radius, background, separators, gaps. A card that is
loading is still a card.

> **Test:** you are about to write a shimmer — is it a *number of things*, or a *shape*? A number is
> yours. A shape is the atom's, always.

**Why this rots quietly.** Drawing a bar locally always works *today*: the author has the real
layout in front of them and matches it by eye. It breaks later, when the atom's `size` or font
changes, because nothing connects the copy to the original. A count cannot drift; a hand-matched
rectangle can, and silently.

A composite importing a skeleton from the vendor breaks COMPOSITE-3 and COMPOSITE-10 at once —
reaching past the atom tier, to do a job that tier already does.

## Notes

_Empty on purpose. Anchored rules for `composite` go here — each from something that actually broke,
with the case that proves it._

---

Examples: [`../examples/composite.md`](../examples/composite.md) · Architecture: [`concept.md`](../concept.md)
