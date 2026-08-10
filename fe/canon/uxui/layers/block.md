# block

## Definition

A block is a **domain sentence**. It knows what the thing on screen MEANS — the words, the figures,
the request behind them, and which situation the reader is actually in — and it says that in the
vocabulary this product speaks.

It is also **terminal**: from a page's side a block is one object with one name. A page composes
blocks; it never reaches inside one to rearrange its parts. That is what lets a block change shape
entirely without a single page changing.

The question that settles it: **does this file know the domain?** A file that can tell a lesson from
a challenge, a quota from a balance, a claimed reward from an unclaimed one, is a block — whatever
it happens to be built from, and however little it arranges.

## Rules

**BLOCK-1 · Two halves, and the split is not cosmetic.**

The connected half (`index.tsx`) fetches, settles the situation and resolves the words. The
presentational half (`component.tsx`) takes an already-settled situation and draws it. Everything
that can be got wrong about DATA lives in one file; everything that can be got wrong about DRAWING
lives in the other, and neither review has to read the other file.

**BLOCK-2 · The STATE picks the tree; anything else is props.**

If a situation renders a different arrangement, it is a state. If it renders the same arrangement
with a different sentence or a resting control, it is props. This one test is what stops a block
growing five booleans that between them describe three real situations — and five booleans admit
thirty-two combinations, of which twenty-nine have never been seen by anybody.

**BLOCK-3 · It never says how many pixels.**

Spacing, direction and measure come from branches and composites. A block that reaches for a gap has
answered a question that was not its own, and has made itself unusable in the one place that needed
it tighter.

**BLOCK-4 · It resolves its own copy and its own request.**

A block takes no already-translated string from its page and no fetched payload as a prop. Blocks
handing each other data through a page turn that page into a data layer, and the page then becomes
the file that breaks whenever anything below it changes.

**BLOCK-5 · It may be terminal without arranging.**

Wrapping one leaf to give it the domain's words and the domain's request is a legitimate block. It
assembles nothing and needs to: what makes it a block is that it knows what the value MEANS.

**BLOCK-6 · It may use basic vocabulary leaves directly, and so may a page.**

A heading, a line of copy, a button. Reaching for one of these is not tier-skipping, and wrapping
each in a composite that does nothing would be ritual. What may not be reached for is an
ARRANGEMENT: the moment two of them need to sit in a relationship, that relationship is a branch or
a composite with a name.

**BLOCK-7 · It takes no `children`.**

Something that takes children AND knows the domain is a layout or an overlay — route-stable chrome
or interaction topology, not a domain sentence. Filing one as a block is how a container quietly
acquires a request.

**BLOCK-8 · Its landing states are its own.**

Loading, empty, failed and ready all belong here, because only this file knows whether an empty list
means "you have none" or "it has not arrived". A block reporting `undefined` upward has pushed its
own question onto something that cannot answer it.

**BLOCK-9 · Its name says what it SAYS, not where it sits.**

`DashboardLeftThing` dies the day a second surface wants it. `DailyQuest` does not.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Fabricating a figure — an invented count, a placeholder percent, an averaged guess | A wrong number is believed; a missing one is asked about | Report the gap in words, and say which field the back end does not send |
| Taking `className`, `gap`, or any appearance prop | The block then has two owners, and the second one is invisible from inside | Add a semantic variant, or let the holding node decide |
| Taking a `children` slot | Open plus domain is a different tier, and mixing them is how a container acquires a request | Move it to `layout` or `overlay` |
| Taking fetched data as a prop | Whoever passes it becomes a data layer, and breaks whenever the payload changes | Fetch it here, in the connected half |
| Taking an already-translated string as a prop | Same: the caller becomes responsible for this block's words | Translate here |
| Importing another block | Two blocks needing each other are one unnamed block, or two a page should compose | Merge them, or compose both from the page |
| One `isLoading` shared across independent requests | It makes the fastest wait on the slowest and blurs four honest situations into one | Let each block own its own request and land when it lands |
| A boolean that could be a state | Booleans multiply into combinations nobody has seen | Use a discriminated union of the situations that exist |
| Naming it after its current surface | The name dies at the second caller | Name what it says |

## Examples

### The ordinary case — a block that owns its request

```tsx
// block: it fetches, it settles the situation, and it hands the drawing half something decided.
export const DailyQuest = () => {
    const t = useTranslations("quest")
    const quest = useQueryMyDailyQuestSwr()

    if (quest.error != null) {
        return <_DailyQuest state="failed" props={{ label: t("label"), message: t("failed") }} />
    }
    if (quest.data == null) return <_DailyQuest state="pending" props={{ label: t("label") }} />
    return <_DailyQuest state="claimable" props={{ label: t("label"), tasks: quest.data.tasks }} />
}
```

```tsx
// NOT a block: the domain now lives above it, so the page fetches, decides and translates —
// and the page breaks whenever the quest payload changes.
export const DailyQuest = ({ tasks, label, isLoading }: {
    tasks: Task[]; label: string; isLoading: boolean
}) => <SurfaceCard props={{ label }} isLoading={isLoading}>{/* ... */}</SurfaceCard>
```

They differ in one thing: which file has to change when the domain does.

### States versus props

```tsx
// block: a discriminated union. Every shape that exists is named, and no shape that does not
// exist can be expressed.
type DailyQuestProps =
    | { state: "pending"; props: Frame }
    | { state: "failed"; props: Frame & { message: string } }
    | { state: "claimable"; props: Frame & { tasks: Task[]; claimLabel: string } }
    | { state: "claimed"; props: Frame & { reward: string } }
```

```tsx
// Wrong: four booleans admit sixteen combinations. `isClaimed && isFailed` type-checks and
// nobody has ever seen it.
type DailyQuestProps = {
    isLoading: boolean; isFailed: boolean; isClaimed: boolean; hasTasks: boolean
}
```

They differ in one thing: whether an impossible situation can be expressed.

### The missing-field trap

```tsx
// block: the back end sends no progress for a resume target, so it is not drawn, and the gap
// is stated where the next author will read it.
// NOTE: no progress field exists for either resume kind; never fabricate one.
return <_ContinueLearning state="ready" props={{ items, resumeLabel: t("resume") }} />
```

```tsx
// Wrong: an invented number. It renders beautifully and it is false, and a reader will act on it.
return <_ContinueLearning state="ready" props={{ items: items.map((i) => ({ ...i, percent: 50 })) }} />
```

They differ in one thing: whether the screen claims something the back end never said.

### The terminal-without-arranging case

```tsx
// block: it assembles nothing at all. What makes it a block is that it knows the figure means
// AI credit, and where to get it.
export const CreditStatRow = () => {
    const t = useTranslations("identity")
    const quota = useQueryMyAiQuotaSwr()
    return <StatRow props={{ icon: "credit", label: t("credit"), value: formatQuota(quota.data) }} />
}
```

```tsx
// Wrong at this tier: same file, no domain left in it — no request, no words of its own. That is
// a composite that has been given a block's folder.
export const CreditStatRow = ({ props }: { props: { label: string; value: string } }) => (
    <StatRow props={{ icon: "credit", label: props.label, value: props.value }} />
)
```

They differ in one thing: whether the file knows what the number means.
