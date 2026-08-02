# Performance — memoization, splitting, long lists

Scope: how a front-end file is written when render cost, bundle size, or list length is the concern —
when `memo` / `useMemo` / `useCallback` earn their keep and when they are noise, what referential
stability actually buys, route- and component-level code splitting, and what to do about a list that
keeps growing. Grounded in named public sources: the React reference on `memo` and `useMemo`
(react.dev), the Next.js docs on `next/dynamic` and lazy loading, Google's Core Web Vitals thresholds
(web.dev), and Addy Osmani's *The Cost of JavaScript*.

This is the one area of the canon where the rule is mostly **judgement**, so each section says
plainly whether a machine can decide it or a person has to.

---

## 1. Measure before optimising — a memo with no measurement behind it is noise

The React reference on `useMemo` is explicit that memoization is for a calculation you have
**observed** to be slow, and gives the check: time it with realistic data, and treat roughly 1ms or
more as the point where a memo starts paying for itself. React DevTools Profiler answers the other
half — which component actually re-rendered, and how long its commit took.

```tsx
// The measurement that has to happen BEFORE the useMemo is written.
// Run it with production-sized data, not the three rows in the fixture.
console.time("visibleRows")
const visibleRows = rows.filter((row) => row.status === status)
console.timeEnd("visibleRows")
```

If that prints 0.1ms on a thousand rows, the `useMemo` you were about to add is pure cost: an extra
array of dependencies, an extra cache entry, an extra thing to keep correct — bought with nothing.

Every memo is a claim, and the claim has an owner. Where the reason is not obvious from the code, a
one-line comment stating what was measured is worth more than the memo itself:

```ts
// 4k-row sort measured at 12ms on a mid-tier phone; without the memo it ran on every keystroke
const sorted = useMemo(() => [...rows].sort(byRank), [rows])
```

**Judgement, not machine-checkable.** No linter can tell an earned memo from a decorative one. What a
machine *can* do is prevent the opposite failure: `react-hooks/exhaustive-deps` catches a memo whose
dependency list is wrong, which is a memo that returns stale data — strictly worse than no memo.

---

## 2. Restructure first, memoize second

The React docs' own advice, in the `memo` reference under "Should you add memo everywhere?", is that
changing the shape of the tree beats wrapping it. Two moves cover most cases, and both delete code
rather than adding it:

- **Move state down.** If only one subtree reads the state, the state belongs in that subtree, and
  nothing else re-renders at all.
- **Lift content up as `children`.** A component whose expensive part arrives as `children` does not
  re-render that part when its own state changes, because the element was created by the parent.

```tsx
// Right: the input owns its own state, so the report is not in the re-rendering component at all.
const SearchField = () => {
    const [query, setQuery] = useState("")
    return <Input value={query} onValueChange={setQuery} />
}

const ReportPage = () => (
    <>
        <SearchField />
        <ExpensiveReport />
    </>
)

// Wrong: state at the top, so every keystroke re-renders ExpensiveReport, and the fix reached for
// is memo(ExpensiveReport) — which papers over a structure that did not need memoizing.
const ReportPage = () => {
    const [query, setQuery] = useState("")
    return (
        <>
            <Input value={query} onValueChange={setQuery} />
            <ExpensiveReport />
        </>
    )
}
```

The same reference makes the related point about `useEffect`: an effect that derives state from
props re-renders twice per change. Derive in render, do not synchronize.

---

## 3. The three cases where a memo is genuinely earned

Everything else is decoration. Write the memo when one of these is true, and the reason is then
statable in a sentence:

1. **A measured-expensive derivation** — a sort, a filter over a large collection, a parse, a regex
   pass, a date-formatter construction. Section 1's measurement is the entry ticket.
2. **A value whose IDENTITY is consumed** — it feeds a dependency array, a subscription, a context
   value, or a `memo`-wrapped child. Here the memo is about correctness and re-subscription cost, not
   about arithmetic, and it is earned even when the computation is trivial.
3. **A `memo`-wrapped child in a hot path** — a row rendered hundreds of times, or a subtree that
   re-renders on every frame of an animation or every keystroke of a search field.

```tsx
// Case 2, the one people miss: the object goes into a context, so a new identity every render
// would re-render every consumer no matter how cheap the object is to build.
const value = useMemo(() => ({ locale, currency }), [locale, currency])
return <FormatContext.Provider value={value}>{children}</FormatContext.Provider>

// Wrong: cheap arithmetic wrapped for no reason — the memo costs more than the expression.
const totalPages = useMemo(() => Math.ceil(count / pageSize), [count, pageSize])
```

A cheap derived value is computed directly in the body. `count`, a boolean comparison, a template
string, `Math.max` — these are not calculations, they are expressions.

---

## 4. Referential stability is all-or-nothing

`memo` compares props shallowly. One prop with a fresh identity each render defeats it completely,
and the component pays the comparison cost on top of the render it was supposed to skip. This is the
most common way a performance change ends up making things slower, and it is invisible in review
unless you look for it deliberately.

The three identities that leak: an inline arrow, an object literal, an array literal.

```tsx
// A memoized row needs a memoized callback, or memo(Row) never short-circuits once.
const Row = memo(({ item, onSelect }: RowProps) => (
    <li onClick={() => onSelect(item.id)}>{item.label}</li>
))

const ItemList = ({ items, onSelect }: ItemListProps) => {
    // stable identity, so the shallow compare in memo(Row) actually short-circuits
    const onSelectRow = useCallback((id: string) => onSelect(id), [onSelect])
    return <ul>{items.map((item) => <Row key={item.id} item={item} onSelect={onSelectRow} />)}</ul>
}

// Wrong: memo(Row) plus an inline arrow. A new function identity per row per render, so every row
// re-renders and the memo only adds a wasted comparison.
<Row key={item.id} item={item} onSelect={(id) => onSelect(id)} />

// Wrong for the same reason, and easier to miss because it does not look like a function:
<Row key={item.id} item={item} onSelect={onSelectRow} style={{ marginTop: 8 }} />
```

The corollary, which decides whether to bother at all: **do not memoize a callback whose consumer is
not memoized.** A `useCallback` handed to a plain `<button onClick=…>` buys nothing — the element is
recreated regardless. `useCallback` earns its keep when the consumer is a `memo` child, a dependency
array, or a ref-bound listener.

Dependency identity matters outside React's own tree too. Data-fetching libraries key their cache on
the argument you pass, so an array key of primitives (`["ordersQuery", customerId, page]`) is stable
by structural comparison, while an options object rebuilt in render is a new identity every time and
can re-trigger the very fetch it was meant to cache.

**Partly machine-checkable.** `react/jsx-no-bind` (eslint-plugin-react) flags inline arrows and
`.bind` in JSX; it has no idea whether the child is memoized, so it is worth enabling only for the
files where you have decided identity matters. `react-hooks/exhaustive-deps` catches the stale-deps
half. The rest is review.

---

## 5. Split at the route first, at the component second — and always with a sized placeholder

*The Cost of JavaScript* (Addy Osmani) puts route-level splitting via dynamic `import()` plus
tree-shaking as the default posture, on the argument that shipping less JavaScript beats optimising
the JavaScript you ship. Most frameworks give route splitting for free; what is left as a deliberate
decision is component-level splitting, and it is worth it for exactly two shapes:

- **Heavy and browser-only** — a 3D scene, a chart engine, a rich-text or code editor, a map. These
  also need server rendering switched off, because they touch `window` during module evaluation.
- **Heavy and conditional** — a panel behind a tab, a modal body, a preview that most sessions never
  open.

```tsx
// The whole idiom in one declaration: out of the initial chunk, out of the server render,
// and reserving its final height so the layout does not jump when the chunk lands.
const SceneCanvas = dynamic(() => import("./SceneCanvas"), {
    ssr: false,
    loading: () => <div className="h-[520px] w-full rounded-3xl bg-default-100" />,
})

// Wrong: no loading placeholder. The region is 0px tall until the chunk arrives, then 520px —
// which is a Cumulative Layout Shift you created on purpose. CLS budget is 0.1 at p75 (web.dev).
const SceneCanvas = dynamic(() => import("./SceneCanvas"), { ssr: false })

// Wrong in the other direction: splitting a 3KB component that is visible above the fold.
// You traded inline bytes for a network round trip on the critical path.
const PriceLabel = dynamic(() => import("./PriceLabel"))
```

The placeholder must match the final height, not merely exist. A spinner in a `h-8` box in front of
a `h-[520px]` component shifts the page exactly as much as no placeholder at all.

Two adjacent rules from the same source that belong here because they are the highest-leverage
things on the list, and both are cheap:

- **Do not lazy-load the largest above-the-fold image.** It is almost always the LCP element;
  deferring it defers the metric. Mark it as high priority instead. Lighthouse names this directly
  (`lcp-lazy-loaded`, `prioritize-lcp-image`).
- **Give every image and embed intrinsic dimensions**, so space is reserved before bytes arrive
  (`unsized-images`).

**Machine-checkable.** Bundle size through a bundle analyzer or `size-limit` in CI; the layout and
LCP rules through Lighthouse CI assertions on the audit ids above.

---

## 6. Long lists: paginate or slice first; virtualize only when the DOM is the measured cost

Windowing is a real tool and it is not free. It gives up browser find-in-page over the off-screen
rows, breaks anchor links and scroll restoration unless you re-implement them, needs
`aria-setsize` / `aria-posinset` supplied by hand for a screen reader to report position correctly,
and prints only what is on screen. That is a large bill for a list of eighty rows.

The order to reach for, cheapest first:

1. **Return less** — server-side pagination, or a cursor. The rows that do not exist cost nothing to
   render, transfer, or keep in memory.
2. **Show less** — slice to a visible page and let the user ask for more.
3. **Render less per row** — a row that is a `memo` leaf over primitives is often the whole fix,
   because the cost was re-rendering, not mounting.
4. **Virtualize** — when the mounted node count itself is what the Profiler shows as the cost, and
   the list genuinely cannot be paginated (a chat transcript, a log viewer, a large table).

The threshold is a measurement, not a number in a document: profile the interaction and check it
against the Interaction to Next Paint budget of 200ms at the 75th percentile (web.dev, Core Web
Vitals). If a click on a row takes 40ms with a thousand rows mounted, virtualization is solving a
problem you do not have.

**Judgement.** What a machine can tell you is whether you have a problem — the field data from the
`web-vitals` library, or a Profiler trace — not whether windowing is the right answer.

---

## 7. A performance budget is a build-time gate, or it is a wish

Numbers that live only in a document drift upward one merge at a time, because no individual pull
request is ever the one that made it slow. The portable rule from the Core Web Vitals guidance is to
put the thresholds where the build can fail on them: LCP at or under 2.5s, INP at or under 200ms,
CLS at or under 0.1, all at the 75th percentile of real-user data.

Two gates, both cheap to add, and they catch different things:

- **Bytes**, in CI, on every pull request — `size-limit` or the framework's bundle analyzer, with a
  ceiling per entry point. This catches the accidental import of a date library into a leaf
  component on the day it happens, not a quarter later.
- **Metrics**, from real users — the `web-vitals` library reporting LCP, INP, and CLS to your
  analytics endpoint. Lab numbers from a developer machine are a debugging tool, not a budget; the
  percentile that matters is measured on the devices your users actually hold.

The rule that follows from having both: a change that moves a budget gets the budget raised
deliberately, in the same commit, with the reason written down. A budget that is edited silently
whenever it fails is not a gate.
