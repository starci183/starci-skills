# composite

## Definition

A composite is a **closed shape**. It assembles leaves and branches into an arrangement a caller can
use but cannot rearrange: it takes `props`, and there is no slot to put anything else in.

It knows no domain. A label, a figure and a bar is a composite; *a course's progress* is a block. The
same three parts serve a weekly target, a storage quota and a download, and that is exactly why the
SHAPE earns a name while the meaning does not.

The question that settles it: **can the caller put something inside it?** If yes, it is a branch. If
no, and it still assembles more than one thing, it is a composite. If it assembles nothing at all, it
is a leaf.

## Rules

**COMPOSITE-1 · Closed. `props`, `on`, `isLoading` — and no way in.**

This is the entire boundary with branch, and it is a TYPE rather than a convention: the props alias
carries no slot, so an author who wanted one cannot express it and has to decide which tier they are
actually writing. A boundary the compiler holds does not drift; a boundary a document holds does.

**COMPOSITE-2 · It names its SHAPE, never a domain.**

If the name only makes sense to somebody who knows this product, the file belongs a tier up. A
composite named after its first caller is a lie waiting for the second one — at which point it is
either copied, which doubles the maintenance, or kept, which makes the name false for everybody who
reads it afterwards.

Direction and incidental chrome are not the shape either. Two peer tab groups sharing one toolbar
are `DualTabsToolbar`: `StackedChoiceTabs` becomes false when the groups sit on one row, while
`DualFilterTabsCard` invents both a domain role and a card the arrangement does not own. The name
must survive a layout-preserving reuse without describing an obsolete implementation accident.

StarCi's feed toolbar renders both the audience axis (`For you / Following`) and the content-category
axis (`All / Courses / Achievements / People`) as HeroUI `primary`. "Category is secondary to scope"
describes product meaning, not the vendor `variant`; translating that sentence into `secondary`
silently changes the legacy control. The toolbar fixes the two resolved variants, while the generic
`ChoiceTabs` leaf accepts a variant because other arrangements can legitimately choose differently.

**COMPOSITE-3 · It owns no class of its own.**

Its arrangement comes from branches and the contract table, exactly as a branch's does. A composite that
writes a class has put the same layout in two places, and only one of them can be searched, named or
reused — so the next author extends whichever they happen to find, and the two drift apart quietly.

Closed does not mean exempt from branches. It means the composite itself closes the named slots passed
to `Tree`: callers cannot rearrange them, while every seam remains visible in the contract table. A raw
`div` inside `composites/` is therefore not a harmless implementation detail; it is an unnamed branch
and a second registry.

The same applies to semantic containers such as `article`, `ul` and `ol`. Semantics do not make a
container cease to be structure. A composite closes typed slots with `defineContractComponent` and
hands them to `Tree` or another named branch; it never opens the host itself. The strict structural-host
gate covers `composites/` and these semantic containers, so moving a raw host into a composite is not
an escape hatch.

**COMPOSITE-4 · It does not import the component library.**

The vendor is a leaf's monopoly. A composite needing vendor behaviour asks for a leaf that wraps it.
This is what keeps "what would a library swap cost" answerable by listing one folder.

**COMPOSITE-5 · It may hold state about ITSELF, and nothing else.**

Open or closed, how wide, how far scrolled: its own business, because none of it means anything
outside this component. Which item is selected, what the reader last submitted, whether a quota is
exceeded: never, because all of it means something to somebody else, and the component that holds it
becomes the one everybody has to route around.

**COMPOSITE-6 · It fetches nothing and translates nothing.**

No `@/hooks`, no translation call. Every word it renders arrives already resolved in `props`. A
composite that reaches for either has become a block without changing folder, and the folder is then
lying about what is inside it.

**COMPOSITE-7 · It is promoted by the SECOND consumer, not by a prediction of one.**

An arrangement used once lives inside the block that uses it. It becomes a composite the day a second
caller genuinely needs the same shape — at which point the extraction is justified by evidence rather
than by taste, and the tier stays small enough to read.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Any slot a caller fills — `render`, or `children` under any name | The moment a caller supplies the inside, the shape is not closed, and every rule below stops being checkable | Move it to `branch` |
| A domain word in the name (`Course…`, `Streak…`, `Quota…`) | The name will be false for the second caller, and false names get copied rather than corrected | Name the shape; if the shape has no name without the domain, it is a block |
| Writing a class | The arrangement then exists in two places and only one is findable | Name a contract node and hold it with a branch |
| Opening `div`, `article`, `ul` or `ol` directly | A semantic tag is still an unnamed structural node, and the composite becomes a second registry | Close the contract's named leaves and render them through `Tree` or a named branch |
| Importing `@heroui/react` | It moves the library boundary above the leaves, so a swap no longer ends there | Wrap the vendor behaviour as a leaf first |
| Importing `@/hooks` | Fetching is knowing the domain, whatever the folder says | Move it to `block`, or take the value through `props` |
| Calling a translation function | Same: choosing words for a domain is a block's job | Take the resolved string through `props` |
| Holding state about its content (selection, submission, validity) | That state means something to somebody else, and this component cannot know who | Lift it to the block that knows what it means |
| Extracting it for one caller | An arrangement with one consumer is a block's internals, and moving it out only adds a hop | Leave it inside the block until a second caller appears |

## Examples

### The ordinary case — a name, a figure and a bar

```tsx
// composite: closed. Three values in, one arrangement out, no idea what is progressing.
export const LabelledProgressRow = ({ props, isLoading = false }: LabelledProgressRowProps) => (
    <Tree
        contract="label-figure-over-bar"
        render={defineContractComponent("label-figure-over-bar", {
            heading: defineContractComponent("label-value-row", {
                label: defineLeafComponent("text", { size: "sm", weight: "medium" }, () => (
                    <Text props={{ content: props.title, size: "sm", weight: "medium" }} isLoading={isLoading} />
                )),
                value: defineLeafComponent("text", { size: "sm", tone: "muted" }, () => (
                    <Text props={{ content: props.percentText, size: "sm", tone: "muted" }} isLoading={isLoading} />
                )),
            }),
            bar: defineLeafComponent("progress", {}, () => (
                <Progress props={{ value: props.percent, label: props.title ?? "" }} isLoading={isLoading} />
            )),
        })}
    />
)
```

```tsx
// NOT a composite: identical arrangement, but the caller now decides what sits under the bar,
// so the shape is open.
export const LabelledProgressRow = ({ props, children }: LabelledProgressRowProps) => (
    <Tree contract="label-figure-over-bar">
        {/* ... */}
        {children}
    </Tree>
)
```

They differ in one thing: whether the caller can put something inside. That is the whole boundary
with branch.

### The naming trap — a real scar in this codebase

```tsx
// composite: names the shape, so a weekly target and a storage quota both fit.
export const LabelledProgressRow = ({ props }: LabelledProgressRowProps) => ( /* ... */ )
```

```tsx
// Wrong: this was the actual name, and the file's own comment records why it had to change —
// it "was a lie the moment a weekly target needed the same three parts".
export const CourseProgressRow = ({ props }: CourseProgressRowProps) => ( /* identical */ )
```

They differ in one thing: whether a second caller can use it without the name becoming false.

### The vendor trap — needing behaviour, not arrangement

```tsx
// composite: the resize behaviour lives in a leaf; this file only arranges what surrounds it.
export const SearchBox = ({ props, on }: SearchBoxProps) => (
    <Tree
        contract="glyph-input-hint-row"
        render={defineContractComponent("glyph-input-hint-row", {
            glyph: defineLeafComponent("icon", { size: "sm" }, () => (
                <Icon props={{ name: "search", size: "sm" }} />
            )),
            input: defineLeafComponent("input", {}, () => (
                <Input props={{ value: props.value, placeholder: props.placeholder }} on={{ change: on?.change }} />
            )),
            hint: defineLeafComponent("kbd", {}, () => <Kbd props={{ keys: props.shortcut }} />),
        })}
    />
)
```

```tsx
// Wrong: reaching past the leaves for the vendor's input, and writing the row's classes by hand
// while it is there.
import { Input as HeroInput } from "@heroui/react"

export const SearchBox = ({ props }: SearchBoxProps) => (
    <div className="flex flex-row items-center gap-2 rounded-full bg-default px-3 py-1.5">
        <Icon props={{ name: "search", size: "sm" }} />
        <HeroInput value={props.value} />
    </div>
)
```

They differ in one thing: whether the library boundary is still at the leaves.

### The premature-extraction trap

```tsx
// block internals: this arrangement has exactly one caller today, so it stays where it is used.
export const _DailyQuest = ({ props }: DailyQuestProps) => (
    <SurfaceCard
        props={{ label: props.label }}
        contract="stacked-rows"
        render={taskRows(props.tasks)}
    />
)
```

```tsx
// Wrong: pulled out as `QuestTaskList` on the theory that something else will want it. Nothing
// does, so the codebase now has one more hop and one more name to keep true.
export const QuestTaskList = ({ props }: QuestTaskListProps) => ( /* the same three lines */ )
```

They differ in one thing: whether a second consumer exists yet.
