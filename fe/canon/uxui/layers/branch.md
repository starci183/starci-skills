# branch

## Definition

A branch is an **open container**. It takes a `contract` and a branded `render` component, so the caller decides
WHICH component fills each slot the key declares and the branch decides only HOW what arrives is
held: where it sits, how far apart, which part takes the slack, and — for the ones that move —
whether it is open, how wide, how far scrolled.

It knows no domain. `Tree` draws one contract node and `SurfaceCard` holds a named section, and
neither knows what a course, a quota or a streak is. The tier is deliberately small: a container
earns its place by holding something in a way no contract entry can express, and most of the time
an entry can.

The question that settles it: **does the caller choose what fills it?** If yes and it knows no
domain, it is a branch. If yes and it DOES know the domain, it is a layout or an overlay. If nothing
can be put inside, it is a composite.

## Rules

**BRANCH-1 · It opens slots. That is what makes it a branch.**

The slots ARE the tier. A container the caller cannot fill is a closed shape and belongs one tier
down whatever it is called, and a closed shape given slots has become a branch whatever folder it
sits in. Both directions are visible in the props alias, which is why this boundary is the only one
here that never needs arguing about.

The slots come from the KEY, not from this file: the entry declares which slots exist and what may
fill each. A bound Tree receives the checked slot record. A data-driven surface receives a stable
component type branded for that key and passes its ordinary `props` into it. So a branch cannot
invent a position, and runtime data does not have to be closed into call-site callbacks.

**BRANCH-2 · Ordinary branches own no class; named surface hosts own only their fixed wrapper.**

Not one literal, not one composed string, not one conditional. A branch that writes a class has
become a second contract table: the same arrangement now exists in two places, only one of which can be
searched, named or reused. The next author extends whichever they found first, and the two drift.

`Tree` applies contract classes; it does not author any. `SurfaceCard`, `SurfaceAccordionCard`,
`SurfaceListCard` and `SurfaceFormCard` are peers of `Tree` as contract hosts: they may author the fixed outer seam and
vendor wrapper they exist to own, while `contractNodeProps(contract)` is applied only to the content
body. They may not create extra contracts for their label, wrapper or caption merely to avoid
writing that fixed assembly, and callers may not tune it through class props.

**BRANCH-3 · A branch imports no vendor except the named surface family that owns its wrapper.**

`SurfaceCard`, `SurfaceAccordionCard`, `SurfaceListCard`, and `SurfaceFormCard` may import the vendor primitive whose
wrapper they own. Their visible content still arrives as `contract + render`; only the physical
projection differs. A two-line `Card > Card.Content` does not earn `CardShell`, because no independent
mechanics policy exists to own.

Modal and drawer mechanics remain in [`shell`](shell.md), the only tier allowed an uninterpreted
`children` hole.

**BRANCH-4 · Its name fixes what may go inside it.**

`card`, `box`, `wrapper`, `container` admit anything, so they constrain nothing and collect
everything: the generic member of a family always wins the call sites from its specific siblings,
because it is the one nobody has to think about. A name saying what it HOLDS makes a wrong child
visible on sight, and keeps the entry's stated reason honest — one entry drawing twenty regions
cannot say why any one of them is there.

Where a generic base is genuinely useful, it is not called directly. The family's specific members
are, and the base exists only for them to build on.

**BRANCH-5 · It may hold state about ITSELF, and nothing else.**

Open or closed, how wide, how far scrolled: its own, because none of it means anything outside this
container. Which item is selected, what was submitted, whether the quota is exceeded: never, because
all of it means something to somebody else.

**BRANCH-6 · It does not read what it holds.**

A branch moves boxes. Inspecting a child to decide how to place it is a decision that depends on
MEANING, and meaning belongs to a block. Counting them is the same offence: the key already fixes
how many slots there are, so a branch that counts to pick a layout is deciding something the entry
had already decided.

**BRANCH-7 · It fetches nothing and translates nothing.**

No `@/hooks`, no translation call. A container that fetches has become a layout — an open container
that knows the domain — and belongs in that file instead.

**BRANCH-8 · It does not aggregate the APIs of what fills its slots into its own.**

A branch republishing what its slot components accept has become a funnel: every future change to
any of them now edits the branch, and the branch's own props stop describing the branch.

**BRANCH-9 · A list surface receives props, never an `items` lane.**

`SurfaceListCard` owns the shared Card, clipping, the contract-bearing content body, and placement
of the list label, its optional trailing fact, and the whole-list caption. The fact shares the
label line because it qualifies that list as one bounded object: the label is `sm semibold`, while
the supporting fact is `xs muted`. It is not a description. A description explains the whole list
after the surface and therefore remains the caption below it. It does not decide whether the domain calls its collection tasks,
courses, rows or alerts. The branded content component receives the same named `props` value and
turns that domain data into the repeated slot. Separators remain on the root contract as `divide-y`,
never as an `after` rule owned by each row leaf.

Its fixed outer assembly uses `gap-3`: label, joined surface and whole-list caption/action are
owner-to-owned units inside one named section. The Card and list root use `p-0` so every divider
reaches both surface edges. Rows
restore the ordinary Card inset without widening the interior seam: one row `p-4`; first row
`px-4 pt-4 pb-3`; middle rows `px-4 py-3`; last row `px-4 pt-3 pb-4`. The repeated row slot must be
a direct child of the dividing contract root; an extra projection wrapper would make `divide-y`
and the first/last matrix target the wrong elements.

The Card root is marked `data-component="SurfaceListCardSurface"`. If the theme's ordinary Card
inset is `!important`, the theme must also define the semantic zero-inset override at equal cascade
strength. A test that sees only `className="p-0"` has not verified the rendered branch.

When the joined list belongs inside a larger story surface, `isNested` changes only the wrapper's
surface treatment: the Card keeps the ordinary SurfaceListCard radius and zero inset, replaces its
shadow with one token border, and the contract remains a borderless row recipe. This is branch-owned
vendor projection, not a caller styling hook. A whole-list description below the surface is a
supporting caption and uses the reserved `xs` text step, one rank below a `sm` row label.

The list label stays visible by default. A nested list may suppress that duplicate heading only when
the enclosing surface already names the exact list. The resolved label still remains required data;
`isLabelHidden` changes projection, not meaning. A page-level list, or a nested list whose outer
heading names a broader story rather than the list itself, must draw its own label.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Writing a class in an ordinary branch, or composing a surface host's classes dynamically | The arrangement becomes caller-dependent or creates an unnamed second vocabulary | Add a contract entry; a named surface host may own only its fixed wrapper seam |
| Importing the component library from an ordinary branch | It creates an unnamed vendor owner | Use a leaf, ModalShell/DrawerShell, or one of the named surface family branches |
| A name that admits anything (`Card`, `Box`, `Wrapper`, `Row`) | The generic member drains the call sites from its specific siblings, and then constrains nothing | Name what it holds — `SurfaceListCard`, `SurfaceAccordionCard` |
| Calling the family's generic base directly | Same drain, one level down | Call the variant that says what is inside |
| Importing `@/hooks` or translating | Both are knowing the domain; the tier is defined by not knowing it | It is a `layout` or an `overlay` |
| Holding state about its content | That state means something to somebody else, and this container cannot know who | Lift it to the block or layout that knows |
| Reading or counting what fills the slots | The choice then depends on meaning, which this tier does not have — and the count is the key's to state | Take the choice as a prop from whoever knows |
| Republishing a slot component's props | It makes the branch a funnel that every child change edits | Let the caller pass to the child directly |
| A `children` slot | Markup arrives already built, so what this container holds could never be stated in the table | `contract` plus one component per named slot |
| An `items` slot invented by `SurfaceListCard` | The branch has learned one caller's data model and cannot host a list derived from any other props shape | Keep the collection under its domain name in the content component's named `props` type |
| A row leaf drawing its own separator | The leaf has learned that it has peers and whether it is last | Put `divide-y` on the joined-list contract root |
| `p-4` around the joined-list root | The divider becomes inset even though the Card edge is correct | Keep the root `p-0`; distribute `p-4`/`p-2` through the first/middle/last rows |
| Border/radius/shadow classes on a nested list contract or call site | The same SurfaceListCard acquires a second visual implementation | Set `isNested`; the branch owns one border, no shadow, and the ordinary list radius |
| Hiding a page-list label, or hiding a nested label without an enclosing name for that exact list | The bounded object becomes anonymous and its data label stops matching what readers see | Keep the label visible; use `isLabelHidden` only for the exact duplicate nested heading |
| An extra wrapper between the dividing root and rows | `divide-y` and first/last selectors no longer target the rows | Make repeated rows direct children of the contract root |

## Examples

### The ordinary case — a named section

```tsx
// branch: the component identity is stable; only its named props change.
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

// Runtime collections remain fields of a named props type, never a special `items` slot.
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
// Wrong: the vendor surface is rebuilt by hand and its interior is untyped markup.
export const SurfaceCard = ({ props, children }: SurfaceCardProps) => (
    <div className="flex flex-col gap-3">
        <Heading props={{ content: props.label, level: 3 }} />
        <div className="flex flex-col gap-4 rounded-2xl bg-surface p-4 shadow-surface">{children}</div>
    </div>
)
```

They differ in one thing: whether the named surface owns a contract-checked content body.

### The vendor trap — behaviour is not arrangement

```tsx
// branch: the focus trap, the escape key and the aria wiring live in a SHELL. This file only
// arranges what the caller sent, and the arrangement comes from a key.
export const Modal = ({ props, on, render }: ModalProps) => (
    <ModalShell props={{ isOpen: props.isOpen }} on={{ dismiss: on?.dismiss }}>
        <Tree contract="title-over-body-over-actions" render={render} />
    </ModalShell>
)
```

```tsx
// Wrong: the library boundary has moved above the leaves, and a swap no longer ends there.
import { Modal as HeroModal, ModalBody } from "@heroui/react"

export const Modal = ({ props, children }: ModalProps) => (
    <HeroModal isOpen={props.isOpen} className="flex flex-col gap-4 p-6">
        <ModalBody>{children}</ModalBody>
    </HeroModal>
)
```

They differ in one thing: whether the tier below is still the boundary with the library.

### The naming trap — the generic sibling wins

```tsx
// branch: the name fixes the inside, and the key fixes the slots. A wrong child does not compile.
export const SurfaceListCard = ({ props, on, contract, render: Content, isLoading }: SurfaceListCardProps) => (
    <div className="flex flex-col gap-3">
        <Heading props={{ content: props.label, level: 3 }} />
        <Card className="p-0" data-component="SurfaceListCardSurface">
            <Card.Content className="p-0">
                <Content props={props} on={on} isLoading={isLoading} />
            </Card.Content>
        </Card>
        {caption}
    </div>
)
```

```tsx
// Wrong: `Card` admits anything, so it will hold a list here, a form there and a chart next
// month — and its stated reason cannot be true for all three.
export const Card = ({ props, render }: CardProps) => (
    <Tree contract="bounded-content-card" render={render} />
)
```

They differ in one thing: whether the name constrains what may be passed.

### The domain trap — one hook changes the tier

```tsx
// branch: takes the label already resolved, so it stays usable on any surface.
export const SurfaceCard = ({ props, contract, render }: SurfaceCardProps) => ( /* ... */ )
```

```tsx
// NOT a branch: it fetches and it translates, so it knows the domain. Open plus domain is a
// layout, not a branch.
export const SurfaceCard = ({ render }: SurfaceCardProps) => {
    const t = useTranslations("courses")
    const courses = useQueryMyCoursesSwr()
    return <Tree contract="label-row-over-card" render={render} />
}
```

They differ in one thing: whether the file knows what it is holding.
