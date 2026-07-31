# Async data — the `runGraphQL` and SWR idiom

Scope: how the FE app makes asynchronous calls — GraphQL queries and mutations through SWR, wrapped
in custom hooks, with every WRITE going through `runGraphQL` (from `useGraphQLWithToast`). Grounded
entirely in real source; paths are relative as `src/…`.

---

## 1. Every WRITE goes through `runGraphQL = useGraphQLWithToast()` — never the pure version

`useGraphQLWithToast()` returns a stable function `(action, options?) => Promise<boolean>` that
toasts the result using already-localised copy. Never import `runGraphQLWithToast` — the pure
version in `src/modules/toast/api.ts` — into a component or hook; that one exists for use outside
React.

```tsx
// src/components/features/community/CommunityFeed/CommunityComposer/index.tsx
const runGraphQL = useGraphQLWithToast()
const ok = await runGraphQL(
    async () => {
        const result = await createPost({ channel, body: trimmed })
        return result.data!.createCommunityPost
    },
    { showSuccessToast: true },
)
if (ok) { setBody(""); onPosted() }
```

```tsx
// Wrong: calling the pure version inside React — the toast copy falls back to English,
// and you have to pass `messages` yourself.
import { runGraphQLWithToast } from "@/modules/toast/api"
await runGraphQLWithToast(() => createPost(...))
```

The rule is written at the source, in `src/modules/toast/hooks.ts`: *"Components/hooks should use
these instead of importing `run*WithToast` directly, so every toast message is localized."*

---

## 2. The `action` MUST return a `GraphQLResponse<T>`, not raw data

`runGraphQL` expects `action: () => Promise<GraphQLResponse<T>>` and toasts based on
`response.success`. So the action returns the resolver wrapper nested inside `result.data` —
`result.data!.createCommunityPost`, `response.data.addToCart`. When the payload is empty, `throw`,
so the wrapper catches it and toasts the failure.

```ts
// src/components/features/cart/hooks/useCart.ts
const success = await runGraphQL(
    async () => {
        const response = await addSwr.trigger({ courseId })
        if (!response.data?.addToCart) {
            throw new Error(response.error?.message)
        }
        return response.data.addToCart
    },
)
```

```ts
// Wrong: returning the raw Apollo result, which has no `.success` — the toast then always
// reads it as a failure and shows defaultError. It neither unwraps `.data` nor throws.
await runGraphQL(async () => addSwr.trigger({ courseId }))
```

`runGraphQL` returns a `boolean` — `true` when the action resolved, `false` when it threw. ALWAYS
guard on it with `if (ok)` / `if (success)` before refreshing, clearing, or navigating; never drop
the return value on the floor.

---

## 3. Three fixed layers: module fetcher → SWR hook → facade hook. A component never calls the module layer

- **Module layer** (`src/modules/api/graphql/{mutations,queries}/*.ts`): builds the `gql`, creates
  the Apollo client, returns `apollo.mutate/query`. For example `mutateAddToCart` in
  `src/modules/api/graphql/mutations/mutation-add-to-cart.ts`.
- **SWR hook layer** (`src/hooks/swr/api/graphql/{mutations,queries}/*.ts`): wraps the fetcher in
  `useSWR` or `useSWRMutation`, attaching the KEY and the generics. One hook, one operation.
- **Facade hook layer** (`src/components/features/**/hooks/*.ts` or `src/hooks/**`): combines
  several SWR hooks with `runGraphQL` into a clean API for the UI. For example `useCart`.

A component consumes the facade or SWR hook only; it never imports `mutateAddToCart` or
`queryMyCart` directly.

```ts
// src/hooks/swr/api/graphql/mutations/useMutateAddToCartSwr.ts
export const useMutateAddToCartSwr = () => {
    const swr = useSWRMutation<MutateAddToCartResult, Error, string, AddToCartRequest>(
        "MUTATE_ADD_TO_CART_SWR",
        async (_key, { arg }) => mutateAddToCart({ request: arg }),
    )
    return swr
}
```

```tsx
// Wrong: reaching for the module layer from a component — this skips the SWR cache and the toast.
import { mutateAddToCart } from "@/modules/api/graphql/mutations/mutation-add-to-cart"
const res = await mutateAddToCart({ request: { courseId } })
```

---

## 4. A query is `useSWR` or `useSWRInfinite`; a mutation is `useSWRMutation`. Keys follow a convention

- **Query key**: an exported `const UPPER_SNAKE_SWR = "…"`, used as a **tuple** `[KEY]` so that
  `mutate([KEY])` can revalidate it from somewhere else. A user-scoped query gates on auth with
  `authenticated ? [KEY] : null`.
- **Mutation key**: an inline UPPER_SNAKE string literal — no export needed, nothing revalidates it.

```ts
// src/hooks/swr/api/graphql/queries/useQueryMyCartSwr.ts
export const QUERY_MY_CART_SWR = "QUERY_MY_CART_SWR"
export const useQueryMyCartSwr = () => {
    const authenticated = useAppSelector((state) => state.keycloak.authenticated)
    return useSWR<Array<CartItemEntity>>(
        authenticated ? [QUERY_MY_CART_SWR] : null,
        async () => {
            const result = await queryMyCart({})
            return result.data?.myCart?.data ?? []
        },
    )
}
```

For an infinite or cursor query — `src/hooks/swr/api/graphql/queries/useQueryCommunityFeedSwr.ts` —
`getKey` returns the tuple `["QUERY_COMMUNITY_FEED_SWR", channel ?? "", cursor]` and stops by
returning `null` once `previous.nextCursor === null`.

```ts
// Wrong: a loose string key nothing else can revalidate, and no auth gate.
useSWR("myCart", async () => queryMyCart({}))
```

The generics are REQUIRED: `useSWR<Array<CartItemEntity>>`,
`useSWRMutation<Result, Error, string, Request>` — use `Awaited<ReturnType<typeof fetcher>>` for
`Result`. Never let it infer to `unknown` or `any`.

---

## 5. Loading, error, and mutating state COME FROM the hook — do not build your own `useState`

The facade and SWR hooks already expose them: for reads, `data ?? []`, `isLoading`, and `error`
from `useSWR`; for writes, `isMutating` and `trigger` from `useSWRMutation`. A component consumes
those; it does not keep its own loading flag.

```tsx
// src/components/features/community/CommunityCommentThread/index.tsx
const { data, isLoading, error, mutate } = useQueryCommunityPostCommentsSwr(postId)
const { trigger: createComment, isMutating } = useMutateCreateCommunityPostCommentSwr()
const comments = data?.comments ?? []
```

`isMutating` goes straight into `<Button isPending={isMutating}>`; `isLoading` and `error` go into
`<AsyncContent>`.

A facade may combine several flags — `src/components/features/cart/hooks/useCart.ts`:

```ts
const isMutating = addSwr.isMutating || removeSwr.isMutating || clearSwr.isMutating
const isLoading = cartSwr.isLoading && items.length === 0   // only loading when there is NO cache yet
```

```tsx
// Wrong: a parallel flag that drifts out of step with SWR.
const [loading, setLoading] = useState(false)
setLoading(true); await createComment(...); setLoading(false)
```

---

## 6. A facade hook returns `Promise<boolean>` and revalidates the shared KEY after a write

Every write action in a facade runs `runGraphQL` and, ONLY on success, calls `mutate([KEY])` so
every consumer on that cache — navbar badge, card, page — stays in step. Whether to show a success
toast is a UX call: skip it when the user already has visual confirmation.

```ts
// src/components/features/cart/hooks/useCart.ts
const refresh = useCallback(() => { void mutate([QUERY_MY_CART_SWR]) }, [mutate])
const addToCart = useCallback(async (courseId: string) => {
    // no success toast: mini-cart drawer IS the confirmation; errors still toasted by wrapper
    const success = await runGraphQL(async () => { /* ... */ })
    if (success) { refresh(); openMiniCart() }
    return success
}, [addSwr, runGraphQL, refresh, openMiniCart])
```

Custom toast copy is passed as an option — `{ successMessage: t("cart.removed") }`, already
localised — never as a hard-coded string.

```ts
// Wrong: writing without revalidating, so other parts of the UI keep showing stale data.
await runGraphQL(async () => addSwr.trigger({ courseId }))
// missing mutate([QUERY_MY_CART_SWR]) — the navbar badge never updates
```
