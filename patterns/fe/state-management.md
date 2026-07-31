# Code style: Zustand state management

Scope: how to WRITE a zustand store in the FE app — where a store lives, reading it by selector, not
prop-drilling, and the overlay and cart patterns. Grounded entirely in `src/hooks/zustand/**` and
its real consumers. These are code rules, not design rules.

---

## 1. A store lives in `hooks/zustand/<feature>/store.ts` and exports `use<Feature>Store`

Each piece of cross-cutting state is a folder under `src/hooks/zustand/`, with a `store.ts` and a
hook named `use<Feature>Store`. The first line of the file is ALWAYS `"use client"`. Do not scatter
stores through components.

```ts
// src/hooks/zustand/dashboardTab/store.ts
"use client"
import { create } from "zustand"

export const useDashboardTabStore = create<DashboardTabStoreState>((set) => ({
    tab: "overview",
    setTab: (tab) => set({ tab }),
}))
```

Three ways to get this wrong: omitting `"use client"`, dropping a loose store beside a component,
and naming it anything other than `use…Store`.

There is a legitimate exception: a store that belongs to one sub-feature may sit beside it for
colocation — `src/components/features/learn/ContentAiSelectionAsk/hintStore.ts`,
`src/hooks/socketio/connectionStore.ts`. It still carries `"use client"`, `create<T>`, and the
`use…Store` name.

---

## 2. State and actions share ONE `XxxStoreState` interface, with JSDoc on every field

A single `XxxStoreState` interface holds both the data fields and the actions, and
`create<XxxStoreState>(...)` passes the generic explicitly. Every field and action gets a one-line
`/** … */`.

```ts
// src/hooks/zustand/dashboardTab/store.ts
interface DashboardTabStoreState {
    /** Currently open tab (drives the panel switch). */
    tab: DashboardTab
    /** Select a tab. */
    setTab: (tab: DashboardTab) => void
}
```

Two ways to get this wrong: splitting state and actions into two separate types, and calling
`create()` without the generic, which throws away type safety.

---

## 3. Consumers read through NARROW selectors — one selector per value

Inside a component or hook, subscribe to one piece at a time with `useStore((state) => state.x)`,
one line per field or action, so the component re-renders only when that piece changes. The
parameter is named `state`; the `s` variant exists but `state` is the dominant idiom.

```ts
// src/components/features/dashboard/hooks/useDashboardTabUrlSync.ts
const tab = useDashboardTabStore((state) => state.tab)
const setTab = useDashboardTabStore((state) => state.setTab)
```

```ts
// Avoid: destructuring the whole store re-renders the component whenever ANY field changes.
const { tab, setTab } = useDashboardTabStore()
```

The destructured form is acceptable only for a small store with few fields — `DashboardTabsBar`,
`ProfileTabsBar`. A store with many fields, such as the overlay store, REQUIRES selectors.

---

## 4. A store OWNS shared state, so siblings read it directly instead of prop-drilling

State several sibling surfaces need — the open tab, the cart badge, an overlay — belongs in a store,
and each surface reads it directly rather than threading a prop or callback through several layers.
The comment says so on purpose.

```ts
// src/hooks/zustand/dashboardTab/store.ts
/** Owned here … so the tab strip and any jump-to-tab action drive the same
 * selection without prop-drilling. */
```

`src/components/features/cart/hooks/useCart.ts` states it too: *"Any component reads this directly
(no prop-drilling) so the navbar badge, course cards, and the cart page all stay in sync off one SWR
cache."*

The shape to avoid is lifting `tab` and `setTab` to a common ancestor and passing them down level by
level.

---

## 5. `set` — patch directly when independent, `set((state) => …)` when it depends on the old state

Writing one field that does not depend on the current value is `set({ field })`. When you need the
previous state — a map, an array, a toggle, a counter — use `set((state) => …)` and spread
immutably. To skip a re-render when nothing changed, return the SAME `state` object.

```ts
// src/hooks/zustand/overlay/store.ts
setPaymentContext: (context) => set({ paymentContext: context }),
toggleOverlay: (key) =>
    set((state) => ({ openMap: { ...state.openMap, [key]: !state.openMap[key] } })),
```

```ts
// src/hooks/socketio/connectionStore.ts — a no-op returns the state unchanged, so nothing re-renders
setStatus: (ns, status) =>
    set((state) => {
        if (state.statuses[ns] === status) return state // same object → no re-render
        return { statuses: { ...state.statuses, [ns]: status } }
    }),
```

Two ways to get this wrong: mutating the old state (`state.openMap[key] = true`), and reaching for
`set((state) => …)` on an independent write that never needed it.

---

## 6. A form store keeps an `initialState` object plus `reset()`; take `get` only when an action reads state

A shared form — one that keeps its values across steps — factors out `initialState` so `reset` can
reuse it. Only an action that must read the current value (an idempotent hydrate, a commit) takes
`get` in `(set, get) => …`.

```ts
// src/hooks/zustand/signIn/store.ts
const initialState = { email: "", password: "", otp: "", /* … */ }
export const useSignInStore = create<SignInStoreState>((set) => ({
    ...initialState,
    setValue: (field, value) => set({ [field]: value } as Partial<SignInStoreState>),
    reset: () => set({ ...initialState }),
}))
```

```ts
// src/hooks/zustand/cookieConsent/store.ts — this one genuinely needs get
export const useCookieConsentStore = create<CookieConsentStoreState>((set, get) => ({
    hydrate: () => { if (get().decided !== null) return; /* … */ },
}))
```

Two ways to get this wrong: writing the default values inline in both the state and `reset`, so the
two drift apart; and declaring `get` in every store whether or not an action reads state.

---

## 7. Many overlays share ONE store with an `openMap`, plus a per-key accessor in `hooks.ts`

Every modal, drawer, and popover lives in `useOverlayStore` behind a single
`openMap: Record<OverlayKey, boolean>`. Consumers never touch the store directly; they use the
`useXxxOverlayState()` accessor declared in `hooks.ts` beside `store.ts`. Each accessor subscribes to
exactly its key through the `useOverlayHandle(key)` factory and wraps its actions in `useCallback` to
keep their identity stable.

```ts
// src/hooks/zustand/overlay/hooks.ts
const useOverlayHandle = (key: OverlayKey): OverlayStateHandle => {
    const isOpen = useOverlayStore((state) => state.openMap[key]) // this key only
    const openOverlay = useOverlayStore((state) => state.openOverlay)
    const open = useCallback(() => openOverlay(key), [openOverlay, key])
    return { isOpen, /* … */ open }
}
export const useMiniCartOverlayState = () => useOverlayHandle("miniCart")
```

An overlay with a payload overrides `open(context)`: stash the context first, then call
`openOverlay` — see `usePaymentOverlayState` and `useFollowListOverlayState`.

Two ways to get this wrong: giving each modal its own `useState` or store, and having a consumer
read `useOverlayStore((s) => s.openMap)`, which subscribes to the whole map and re-renders whenever
any other overlay changes.

---

## 8. Writing state from OUTSIDE React is `useStore.getState().action()`

Non-component code — an Apollo link, a socket.io lifecycle — writes to a store through
`useStore.getState().action(...)`. No subscription, no hook.

```ts
// src/hooks/socketio/useAiLabSocketIoLifecycle.ts
useSocketConnectionStore.getState().setStatus("ai_lab", "connected")
```

The JSDoc in `src/hooks/zustand/overlay/hooks.ts` records the same thing: the maintenance overlay is
opened from the Apollo `ErrorLink` with
`useOverlayStore.getState().openOverlay("maintenance")`.

Two ways to get this wrong: calling the `useStore(...)` hook outside a component body, and passing a
setter around by hand through a global variable.
