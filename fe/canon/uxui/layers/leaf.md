# leaf

## Definition

A leaf wraps ONE vendor primitive and renders it straight through. It is the boundary between this
design system and the component library underneath it, and that boundary is the whole reason the
tier exists: a library swap reaches the leaves and stops there.

**How complicated the vendor's own component is does not matter.** A date picker that draws a month
grid, a weekday header and two paging controls is still a leaf when we render it, because none of
that arranging is ours — we did not choose a single gap in it and cannot change one without leaving
the vendor's API. What decides the tier is not how much appears on screen; it is **how much of the
arranging we did**.

The question that settles it: **does this file place two pieces of content relative to each other?**
If it does, it is not a leaf, however small it looks. If it does not, it is a leaf, however large the
vendor's output looks.

## Rules

**LEAF-1 · One vendor primitive, rendered through.**

A leaf names exactly one thing from the component library and hands it props. It is the only tier
permitted to import the library at all, and that monopoly is load-bearing: it is what lets somebody
answer "what would changing component libraries cost" by listing one folder. Every tier above asks a
leaf for vendor behaviour instead of reaching for it.

**LEAF-2 · It may keep the classes that hold ONE line together.**

Glyph-to-baseline glue — `inline-flex`, `items-center`, and the single gap between an icon and the
words it belongs to — is part of presenting one piece of content, not an arrangement of two. So is
filling the width it was given (`w-full`, `h-full`), which is not a position but the absence of one.

The test is not the class name; it is what sits on either side of the gap. A gap between a glyph and
its own label is glue. The identical class between a label and a separate figure is an arrangement,
and belongs to the contract table where it can be named.

Drawing that glyph means importing the leaf that owns it, and that is the one import a leaf may
make: **a leaf whose entire output is one mark, and which renders no words of its own.** It is
permitted because the alternative is worse — every leaf reaching past the glyph leaf for the
vendor's icon puts the same mark in a dozen files, and then a change to what a glyph IS has a dozen
places to be missed. What the import may not do is add a second content: the glyph and the words
are one piece, and the moment something arrives that could be read on its own, the file is
arranging.

**LEAF-3 · It takes `props`, `on`, `isLoading`, and nothing else.**

No `className`: a caller who can restyle a node has become its second owner, and the component now
has two authors who never speak. No `children`: accepting one is how a leaf starts arranging, and it
is also how it stops being usable without knowing what will be passed.

**LEAF-4 · It owns its own resting, disabled and focused shapes.**

These are states of the value it renders, so they belong here and are never asked of a caller. A
leaf that takes a `skeletonClassName` has handed its own anatomy to somebody who cannot see it.

**LEAF-5 · Its data is declared with `type`, not `interface`.**

TypeScript gives an implicit index signature to a type alias and not to an interface, so an
interface silently fails the data fence that keeps functions out of `props`. This is not a style
preference; it is the constraint working.

**LEAF-6 · It is named for what it IS, never for where it is used.**

A leaf named after its first caller has to be copied for the second one or turned into a falsehood.
Name the thing, and the second caller costs nothing.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| `flex-col`, or a gap between two separate contents | The moment a file decides how far apart two things sit, that decision needs a name and a reason somebody else can find | Move the file to `composite` and name a contract node for the arrangement |
| `justify-between`, `grid`, `space-x-*` | Same decision, wearing a different class | Same |
| Padding on a wrapper (`p-*`, `px-*`, `py-*`) | Padding makes a box, a box is a node, and nodes come from the contract table | Let the branch or composite holding it supply the node |
| A surface on a wrapper (`bg-*`, `rounded-*`, `shadow-*` on a `div` around the primitive) | Same as padding: this is a surface, and surfaces are named nodes | Same |
| `absolute`, `relative`, `sticky`, `z-*` | A child that positions itself cannot be moved by whoever assembles it | Position it from the node that holds it |
| Importing a leaf that carries its own content — words, a value, a control | A file holding two things that can each be read on their own is assembling the vocabulary rather than being a word in it, and the seam between them has no name anybody can find | It is a composite; move it |
| Importing the glyph leaf and then giving it a second content to sit beside | The permission in LEAF-2 covers a glyph and the words it belongs to, and stops at the first thing that could be read without them | Same: name the arrangement and move it up |
| A `className` prop, even "for position only" | It is the escape hatch by another name, and every use looks locally reasonable | Add a prop naming the VARIANT you actually need |
| A `children` slot | A caller who supplies the inside decides the arrangement, which is a branch's job | Move it to `branch` |

## Examples

### The ordinary case — a line of copy that may carry a glyph

```tsx
// leaf: one vendor paragraph. The gap is between a glyph and its own words, so there is
// still only one piece of content on the line.
export const Text = ({ props, isLoading = false }: TextProps) => (
    <Typography.Paragraph
        color={TONE_COLORS[props.tone ?? "default"]}
        className={props.icon === undefined ? undefined : "inline-flex items-center gap-2"}
    >
        {props.icon === undefined ? null : <Icon props={{ name: props.icon, size: "sm" }} />}
        {props.content ?? ""}
    </Typography.Paragraph>
)
```

```tsx
// NOT a leaf: the same class, but now between a label and a separate figure. That is an
// arrangement of two contents.
export const StatRow = ({ props }: StatRowProps) => (
    <div className="inline-flex items-center gap-2">
        <Text props={{ content: props.label }} />
        <Text props={{ content: props.value }} />
    </div>
)
```

They differ in one thing: whether the gap holds a glyph against its own words, or two contents
against each other.

### The import boundary — a mark is not a content

```tsx
// leaf: it imports the glyph leaf, which draws one mark and reads no words. The glyph and the
// label are one piece of content, so nothing here is being arranged.
export const Label = ({ props }: LabelProps) => (
    <HeroLabel className="inline-flex items-center gap-2">
        <Icon props={{ name: props.icon, size: "sm" }} />
        {props.content}
    </HeroLabel>
)
```

```tsx
// NOT a leaf: the hint can be read on its own, so the file is now holding two contents and the
// seam between them has no name.
export const Label = ({ props }: LabelProps) => (
    <HeroLabel className="inline-flex items-center gap-2">
        <Icon props={{ name: props.icon, size: "sm" }} />
        {props.content}
        <Text props={{ content: props.hint, tone: "muted" }} />
    </HeroLabel>
)
```

They differ in one thing: whether the second import can be read without the first.

### The size trap — big vendor output, small ours

```tsx
// leaf: the vendor draws a month grid, seven weekday headings and two paging controls.
// We chose none of it.
export const Calendar = ({ props, on }: CalendarProps) => (
    <HeroCalendar value={props.value} onChange={on?.pick} isDisabled={props.isDisabled} />
)
```

```tsx
// NOT a leaf: one number and one dot — far smaller on screen, and we chose the stacking.
export const DayCell = ({ props }: DayCellProps) => (
    <div className="flex flex-col items-center">
        <Text props={{ content: props.label }} />
        <Dot props={{ active: props.active }} />
    </div>
)
```

They differ in one thing: who decided the arrangement. Not size.

### The tempting shortcut — making the whole row pressable

```tsx
// leaf: the vendor's own link carries the press, and the glue keeps the glyph on the line.
export const NavLink = ({ props }: NavLinkProps) => (
    <HeroLink href={props.href} className="inline-flex items-center gap-2">
        <Icon props={{ name: props.icon, size: "sm" }} />
        {props.label}
    </HeroLink>
)
```

```tsx
// NOT a leaf: the padding is there to make the whole row the target, which turns it into a box.
export const QuickActionRow = ({ props }: QuickActionRowProps) => (
    <HeroLink href={props.href} className="flex flex-row items-center gap-3 rounded-xl px-3 py-2">
        <Icon props={{ name: props.icon, size: "sm" }} />
        {props.label}
    </HeroLink>
)
```

They differ in one thing: `px-3 py-2`. A box is a node, and nodes come from the contract table.

### The naming trap

```tsx
// leaf: named for what it is, so the second caller costs nothing.
export const Badge = ({ props }: BadgeProps) => <HeroChip color={TONE[props.tone]}>{props.label}</HeroChip>
```

```tsx
// Wrong: named for its first caller. The day a job posting needs the same chip, this name is
// either copied or false.
export const CourseLevelBadge = ({ props }: CourseLevelBadgeProps) => ( /* identical */ )
```

They differ in one thing: whether a second caller can use it without the name becoming a lie.
