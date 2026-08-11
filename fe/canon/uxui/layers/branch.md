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
fill each, and `render` carries one component per slot. So a branch cannot invent a position, and what it
holds is stated in the contract table rather than in whatever the call site happened to build.

**BRANCH-2 · It owns no class of its own.**

Not one literal, not one composed string, not one conditional. A branch that writes a class has
become a second contract table: the same arrangement now exists in two places, only one of which can be
searched, named or reused. The next author extends whichever they found first, and the two drift.

`Tree` is not an exception to this. It APPLIES contract classes; it does not author any. The classes
it renders are the entry's, and the entry is what a reader argues with.

**BRANCH-3 · A branch imports no vendor except the named surface family that owns its wrapper.**

`SurfaceCard`, `SurfaceAccordionCard`, and `SurfaceListCard` may import the vendor primitive whose
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

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Writing a class — once, one utility, or via a helper | The arrangement then exists outside the contract table, unfindable and unarguable | Add or name a contract entry and render it through `Tree` |
| Importing the component library from an ordinary branch | It creates an unnamed vendor owner | Use a leaf, ModalShell/DrawerShell, or one of the named surface family branches |
| A name that admits anything (`Card`, `Box`, `Wrapper`, `Row`) | The generic member drains the call sites from its specific siblings, and then constrains nothing | Name what it holds — `SurfaceListCard`, `SurfaceAccordionCard` |
| Calling the family's generic base directly | Same drain, one level down | Call the variant that says what is inside |
| Importing `@/hooks` or translating | Both are knowing the domain; the tier is defined by not knowing it | It is a `layout` or an `overlay` |
| Holding state about its content | That state means something to somebody else, and this container cannot know who | Lift it to the block or layout that knows |
| Reading or counting what fills the slots | The choice then depends on meaning, which this tier does not have — and the count is the key's to state | Take the choice as a prop from whoever knows |
| Republishing a slot component's props | It makes the branch a funnel that every child change edits | Let the caller pass to the child directly |
| A `children` slot | Markup arrives already built, so what this container holds could never be stated in the table | `contract` plus one component per named slot |

## Examples

### The ordinary case — a named section

```tsx
// branch: one key, and one component per slot. It never looks at what it holds.
export const SurfaceCard = ({ props, contract, render }: SurfaceCardProps) => (
    <div {...contractNodeProps("label-row-over-card")}>
        <Card>
            <Card.Content {...contractNodeProps(contract)}>
                <ContractContent contract={contract} render={render} />
            </Card.Content>
        </Card>
    </div>
)

// the call site binds the key to the named slot record before it crosses the branch boundary
const content = defineContractComponent("stacked-peer-controls", { control: courseRows })
<SurfaceCard contract="stacked-peer-controls" render={content} />
```

```tsx
// Wrong: identical output, arrangement stated here instead of named. Whoever needs the same
// surface tomorrow cannot find this one.
export const SurfaceCard = ({ props, children }: SurfaceCardProps) => (
    <div className="flex flex-col gap-3">
        <Heading props={{ content: props.label, level: 3 }} />
        <div className="flex flex-col gap-4 rounded-2xl bg-surface p-4 shadow-surface">{children}</div>
    </div>
)
```

They differ in one thing: whether the arrangement has a name somebody else can find.

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
export const SurfaceListCard = ({ props, render }: SurfaceListCardProps) => (
    <SurfaceCard props={{ label: props.label }} contract="label-over-stacked-rows" render={render} />
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
