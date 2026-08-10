# branch

## Definition

A branch is an **open container**. It takes `children`, so the caller decides WHAT goes inside and
the branch decides only HOW what arrives is held: where it sits, how far apart, which part takes the
slack, and — for the ones that move — whether it is open, how wide, how far scrolled.

It knows no domain. `Tree` draws one contract node and `SurfaceCard` holds a named section, and
neither knows what a course, a quota or a streak is. The tier is deliberately small: a container
earns its place by holding something in a way no contract entry can express, and most of the time
an entry can.

The question that settles it: **does the caller put something inside it?** If yes and it knows no
domain, it is a branch. If yes and it DOES know the domain, it is a layout or an overlay. If nothing
can be put inside, it is a composite.

## Rules

**BRANCH-1 · It takes `children`. That is what makes it a branch.**

The slot IS the tier. A container the caller cannot fill is a closed shape and belongs one tier down
whatever it is called, and a closed shape given a slot has become a branch whatever folder it sits
in. Both directions are visible in the props alias, which is why this boundary is the only one here
that never needs arguing about.

**BRANCH-2 · It owns no class of its own.**

Not one literal, not one composed string, not one conditional. A branch that writes a class has
become a second contract table: the same arrangement now exists in two places, only one of which can be
searched, named or reused. The next author extends whichever they found first, and the two drift.

`Tree` is not an exception to this. It APPLIES contract classes; it does not author any. The classes
it renders are the entry's, and the entry is what a reader argues with.

**BRANCH-3 · It does not import the component library.**

This is where the leaf's vendor monopoly is usually lost, and losing it costs the most. A modal needs
a focus trap, an escape key, a scroll lock, a backdrop and a returned focus — none of that is
arrangement, and none of it can be written here. It gets wrapped as a LEAF, and the branch composes
that leaf with the caller's children. Without this rule, every container quietly reaches for the
library and no tier is the boundary any more.

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
MEANING, and meaning belongs to a block. A branch that counts its children to pick a layout has
started reading them.

**BRANCH-7 · It fetches nothing and translates nothing.**

No `@/hooks`, no translation call. A container that fetches has become a layout — an open container
that knows the domain — and belongs in that file instead.

**BRANCH-8 · It does not aggregate its children's APIs into its own.**

A branch republishing what its children accept has become a funnel: every future change to any child
now edits the branch, and the branch's own props stop describing the branch.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Writing a class — once, one utility, or via a helper | The arrangement then exists outside the contract table, unfindable and unarguable | Add or name a contract entry and render it through `Tree` |
| Importing `@heroui/react` | It moves the library boundary above the leaves, so a swap no longer ends there | Wrap the vendor behaviour as a leaf, then hold that leaf |
| A name that admits anything (`Card`, `Box`, `Wrapper`, `Row`) | The generic member drains the call sites from its specific siblings, and then constrains nothing | Name what it holds — `SurfaceListCard`, `SurfaceAccordionCard` |
| Calling the family's generic base directly | Same drain, one level down | Call the variant that says what is inside |
| Importing `@/hooks` or translating | Both are knowing the domain; the tier is defined by not knowing it | It is a `layout` or an `overlay` |
| Holding state about its content | That state means something to somebody else, and this container cannot know who | Lift it to the block or layout that knows |
| Reading children to choose a layout | The choice then depends on meaning, which this tier does not have | Take the choice as a prop from whoever knows |
| Republishing children's props | It makes the branch a funnel that every child change edits | Let the caller pass to the child directly |

## Examples

### The ordinary case — a named section

```tsx
// branch: three contract nodes, no class of its own, and it never looks at what it holds.
export const SurfaceCard = ({ props, children }: SurfaceCardProps) => (
    <Tree contract="label-row-over-card">
        <Tree contract="title-with-end-action">
            <Heading props={{ content: props.label, level: 3 }} />
        </Tree>
        <Tree contract="bounded-content-card">{children}</Tree>
    </Tree>
)
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
// branch: the focus trap, the escape key and the aria wiring live in a leaf. This file only
// arranges what the caller sent.
export const Modal = ({ props, on, children }: ModalProps) => (
    <ModalShell props={{ isOpen: props.isOpen, label: props.label }} on={{ dismiss: on?.dismiss }}>
        <Tree contract="title-over-body-over-actions">{children}</Tree>
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
// branch: the name fixes the inside, so a wrong child is visible on sight.
export const SurfaceListCard = ({ props, children }: SurfaceListCardProps) => (
    <SurfaceCard props={{ label: props.label, isFrameless: true }}>
        <Tree contract="stacked-rows">{children}</Tree>
    </SurfaceCard>
)
```

```tsx
// Wrong: `Card` admits anything, so it will hold a list here, a form there and a chart next
// month — and its stated reason cannot be true for all three.
export const Card = ({ props, children }: CardProps) => (
    <Tree contract="bounded-content-card">{children}</Tree>
)
```

They differ in one thing: whether the name constrains what may be passed.

### The domain trap — one hook changes the tier

```tsx
// branch: takes the label already resolved, so it stays usable on any surface.
export const SurfaceCard = ({ props, children }: SurfaceCardProps) => ( /* ... */ )
```

```tsx
// NOT a branch: it fetches and it translates, so it knows the domain. Open plus domain is a
// layout, not a branch.
export const SurfaceCard = ({ children }: { children: ReactNode }) => {
    const t = useTranslations("courses")
    const courses = useQueryMyCoursesSwr()
    return <Tree contract="label-row-over-card">{t("heading")}{children}</Tree>
}
```

They differ in one thing: whether the file knows what it is holding.
