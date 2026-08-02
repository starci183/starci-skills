# React hooks and render idioms — STRICT

Scope: the rules for WRITING hooks, effects, memo/callback, handler names, and keeping render
clean, in `src/components/**` and `src/hooks/**`. Grounded entirely in real code; examples are
quoted verbatim, paths relative as `src/…`.

## 1. Hooks at top level only, never called conditionally

Every `use*` is called at the top of the component, never inside an `if`, a loop, or a callback.
To bail out of render early, call all hooks FIRST and only then `return null` — the guard goes
after the hooks, not before.

As done in `src/components/blocks/async/InfiniteScrollSentinel/index.tsx`: `useRef` and `useEffect`
at top level, with the guard `if (!node || disabled) return` INSIDE the effect rather than blocking
the hook. Same in `src/components/blocks/layout/SocketConnectionStatus/index.tsx` — four
`useEffect` calls lined up at the top, each holding its own guard `if (phase !== "recovered") return`.

**Never** put `if (!data) return null` above a `useMemo` or `useEffect` further down: the hook count
then changes between renders.

## 2. useEffect: deps are hand-managed, `exhaustive-deps` is OFF

`react-hooks/exhaustive-deps` is `"off"` (`eslint.config.mjs`). Deps are a MANUAL responsibility —
list the signals that should re-run the effect, and deliberately leave out the ones that should not.
The linter will not do it for you.

A callback that changes every render and must NOT enter the deps is held in a "latest" ref, so the
deps carry only the real re-subscribe signals:

```tsx
// src/components/blocks/async/InfiniteScrollSentinel/index.tsx
const onReachRef = React.useRef(onReach)
onReachRef.current = onReach          // updated every render, does NOT re-subscribe the observer
React.useEffect(() => {
    …
    observer.observe(node)
    return () => observer.disconnect()
}, [disabled, root])                  // deliberately WITHOUT onReach
```

Two ways to get this wrong: **putting `onReach` into the deps**, which rebuilds the observer every
render, and **leaving the deps empty** while the effect reads a prop or state that is changing.

## 3. useEffect MUST clean up everything it registered

Timers, observers, subscriptions, lingering toasts all return a cleanup. This is a hard idiom here.

- a timer: `const handle = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS); return () => clearTimeout(handle)`
  (`src/components/features/course/CourseCatalog/index.tsx`)
- an observer: `return () => observer.disconnect()` (`InfiniteScrollSentinel`)
- a resource outside the queue: `return () => { if (downToastKey.current) toast.close(downToastKey.current) }`,
  plus a separate unmount effect clearing every timer (`SocketConnectionStatus`)

**Never** leave a `setTimeout`, `setInterval`, `addEventListener`, or `new IntersectionObserver`
without a cleanup.

## 4. An effect touching `window` or storage guards SSR and wraps in try/catch

Reaching for `window`, `sessionStorage`, or `localStorage` inside an effect means guarding the
environment, wrapping in `try/catch`, and swallowing the error silently (private mode):

```ts
// src/hooks/effects/useSessionSuperseded.ts
if (typeof window === "undefined") return
try { sessionStorage.getItem(…) } catch { /* ignore storage errors */ }

// src/components/features/course/CourseCatalog/index.tsx
try { window.localStorage.setItem(…) } catch { /* storage unavailable (private mode) */ }
```

**Never** read `localStorage` directly in the component body — it runs during SSR and hydration —
and never omit the try/catch.

## 5. One effect per concern, chained through state

Each `useEffect` does ONE thing with its own deps. A multi-step flow is a chain of effects joined by
intermediate state, never one giant effect.

`CourseCatalog` chains three: a debounce effect `[query]→setDebouncedQuery`, then a page-reset
effect `[debouncedQuery]→setPageNumber(0)`, then SWR reading `debouncedQuery`.
`SocketConnectionStatus` splits four concerns into four effects: "react to the socket signal"
`[anyDown]`, "recovered → hidden after a delay" `[phase]`, "push the toast for this phase"
`[phase, t]`, and "clean up on unmount" `[]`.

## 6. useMemo and useCallback: when there is a reason, not by reflex

`useMemo` is for a non-trivial derived value — sort, filter, split — with deps naming the real data
source. A cheap value (a count, a sum, a comparison) is computed DIRECTLY in the body, unmemoized.

```ts
// CourseCatalog — the memo is earned
const list = useMemo(() => [...data].sort((l, r) => rankOf(l.displayId) - rankOf(r.displayId)), [payload])

// CourseCatalog — same file, left direct
const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
const currentPage = pageNumber + 1
```

`useCallback` is for a handler passed down to a child or an effect, or bound to a ref, with correct
deps — `const onChangeView = useCallback((next) => { setView(next); … }, [])` and
`const selectAt = useCallback((index) => {…}, [items, onSelectSuggestion])` (`SearchInput`).

Two things **not** to do: wrap `a + b` in a `useMemo`, or reach for `useCallback` on a handler used
inline in one place (a JSX `onChange`) and passed nowhere.

## 7. Handlers are named `onXxx`, not `handleXxx`

The repo runs overwhelmingly to `on*` (~354 occurrences across 175 files) against `handle*` (~25
across 14) for internal handlers. WRITE NEW code as `onXxx` — `onChangeView`, `onNavigateHome`
(`CourseCatalog`); `onKeyDown`, `onMouseDown` (`SearchInput`).

`handleXxx` still exists — `handleDiagramChange` in
`src/components/features/learn/MockInterview/MockInterviewSession/index.tsx` — but it is the
minority. Do not multiply it.

A callback prop crossing the component boundary MUST be `onXxx`: `onReach`, `onValueChange`,
`onSelectSuggestion` (`InfiniteScrollSentinel`, `SearchInput`).

## 8. No heavy logic in the render body or inside JSX

The component body runs every render, so it holds cheap derivations and memoized expensive ones.
Sort, filter, parse, regex go in a `useMemo`. Never build a large array or run a loop inline in
render.

`SearchInput` keeps its split-for-highlighting in a memo —
`const segments = useMemo(() => { … indexOf … slice … }, [suggestion.label, query])` — and the JSX
only reads `segments.before/match/after`.

Side effects — fetch, storage, toast, timer — never belong in render, only in a `useEffect` or a
handler. The two shapes to reject at review: `<ul>{items.filter(...).sort(...).map(...)}</ul>`
inline, and `localStorage.getItem(...)` or `toast(...)` in the middle of the render body.

## 9. A WHY comment on every non-obvious effect or callback

The repo treats a single `//` line explaining the REASON, sitting directly above the effect or
callback, as required whenever the behaviour is not self-evident: why a dep was left out, why
mousedown instead of click, why a grace timer exists.

```ts
// keep the latest callback without re-subscribing the observer each render
// mousedown (not click) so it runs before the input blur closes the dropdown
// debounce the search input before it reaches the backend
```

An effect with "odd" deps — missing a variable the effect reads — and no line saying why that is
deliberate does not pass review.
