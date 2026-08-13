# the split

## Definition

A surface that owns a request is two files. `index.tsx` fetches, settles which situation the reader
is in, and resolves the words. `component.tsx` takes an already-settled situation and draws it.

The split is not organisational tidiness. It is a line drawn so that **everything that can be wrong
about DATA lives in one file and everything that can be wrong about DRAWING lives in the other** —
and neither review has to read the other file.

The question that settles which half a line belongs to: **could this be wrong when the network is
fine?** A wrong tree, a wrong seam, a missing state: drawing. A wrong request, a wrong situation,
the wrong word chosen: data.

What holds this law is [`sources/fe/the-split.mjs`](../../../sources/fe/the-split.mjs). It checks both
directions a syntax tree can prove: the drawing half cannot reach for the world, and a connected
block must import and render only its exact `_X` twin.

Implementation anchors in `starci-academy-fe`:
`src/components/blocks/dashboard/CreditStatRow/index.tsx` and
`src/components/blocks/dashboard/CreditStatRow/component.tsx`.

## Rules

**SPLIT-1 · The drawing half receives everything and asks for nothing.**

No request, no store, no translation call, no reading of the current locale. Every value it renders
arrives already decided, which is what makes it renderable from a fixture — and a component that
cannot be rendered from a fixture cannot be tested, because the test would have to stand up the
world first.

**SPLIT-2 · The connected half settles the SITUATION, not the styling.**

It decides which of the named states this is and hands it down. It does not decide how a state
looks, how far apart anything sits, or which element draws what. Those are the drawing half's, and
a connected file that reaches for them has taken a decision it cannot see the consequence of.

**SPLIT-3 · The situation crosses the line as a NAME, never as a bag of flags.**

`state="pending"` rather than `isLoading`, `hasError`, `isEmpty`. A name is one value from a closed
set; four flags admit sixteen combinations, of which most have never been seen. The union is what
makes the drawing half exhaustive: every situation that exists is drawn, and no situation that does
not exist can be expressed.

**SPLIT-4 · Copy is resolved before it crosses.**

The drawing half receives words, not keys. A translated string is a value like any other, and a
component that looks one up has acquired a dependency on the whole translation runtime for a job
that was already done one file away.

**SPLIT-5 · The connected half draws nothing of its own.**

It imports exact `_${FolderName}` from `./component` and renders that one component on every JSX
path. A connected file that renders a leaf, branch or alternate tree has become both halves, and the
line stops meaning anything the moment it is crossed once.

There is no thin-block exception. One leaf, one tree in every state, no local domain state, or a
presentational twin that only forwards props are the cases most likely to grow a second situation
later; they still cross the same exact twin.

**SPLIT-6 · A surface with no request does not split.**

Two files for a component that fetches nothing is ceremony: there is no data half, so the second
file holds nothing that the first could get wrong. The split exists because a request exists.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A request, store read or translation call in the drawing half | It stops being renderable from a fixture, so it stops being testable without the world | Put it in the connected half and pass the result |
| Reading the current locale while drawing | Same dependency, wearing a smaller name | Resolve the words one file away |
| A translation key crossing the line | The drawing half acquires the translation runtime for a job already done | Send the resolved string |
| Flags instead of a named situation | Four booleans admit sixteen combinations, and most have never existed | A discriminated union |
| Styling decided in the connected half | It takes a decision whose consequence it cannot see | Let the drawing half decide how a situation looks |
| Markup in the connected half | It has become both halves, and the line stops meaning anything | Render the drawing half and nothing else |
| Rendering a leaf directly because the block is thin | The request and presentation can no longer be tested independently, and the first added state crosses the line | Create exact `_X` and render only it |
| Splitting a component that fetches nothing | There is no data half to separate, so the second file is ceremony | One file |

## Examples

### The line

```tsx
// index.tsx - it settles the situation and resolves the words
const quest = useQueryMyDailyQuestSwr()
if (quest.error !== undefined) return <_DailyQuest state="failed" props={{ label: t("label") }} />
```

```tsx
// component.tsx - it draws a situation that has already been decided
const isLoading = input.state === "pending"
```

They differ in one thing: which of them could be wrong while the network is fine.

### The situation, not the flags

```tsx
type Props =
    | { state: "pending"; props: Frame }
    | { state: "failed"; props: Frame & { message: string } }
    | { state: "ready"; props: Frame & { rows: ReadonlyArray<Row> } }
```

```tsx
type Props = { isLoading: boolean; hasError: boolean; isEmpty: boolean; rows: ReadonlyArray<Row> }
```

They differ in one thing: whether a situation nobody has seen can be expressed.

### The words

```tsx
<_DailyQuest state="failed" props={{ label: t("label"), message: t("failed") }} />
```

```tsx
<_DailyQuest state="failed" props={{ labelKey: "quest.label", messageKey: "quest.failed" }} />
```

They differ in one thing: whether the drawing half needs the translation runtime to be tested.

### The thin-block trap

```tsx
export const CreditStatRow = () => {
    const quota = useQueryMyAiQuotaSwr()
    return <_CreditStatRow state="settled" props={{ label: t("credit"), value: formatQuota(quota.data) }} />
}
```

```tsx
export const CreditStatRow = () => {
    const quota = useQueryMyAiQuotaSwr()
    return <StatRow props={{ label: t("credit"), value: formatQuota(quota.data) }} />
}
```

They differ in one thing: whether every connected render crosses the exact presentational twin.
