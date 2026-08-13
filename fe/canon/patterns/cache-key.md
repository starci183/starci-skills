# cache key

## Definition

A cache key is the NAME of one answer. Everything that shares a key shares that answer — its data,
its error, and, for a mutation, its running state — so the key is not a label attached to a request
afterwards. It is the question, written down.

That makes the key a claim, and the claim is checkable: *this answer is true for anybody who asks
this question.* If two callers can produce the same key and need different answers back, the key is
naming something coarser than the answer it stores, and one of them will read the other's.

The question that settles a fragment: **if this value were different, would the answer be
different?** If it would, the fragment belongs in the key. If it would not, it is noise that splits
one entry into several and refetches for nothing.

A key is also either complete or absent. There is no partial key, because a key assembled from a
fragment that has not arrived is a different question — one nobody asked — and the answer it caches
is filed under a name that will never be requested again.

What holds this law is only its edge: [`sources/fe/the-split.mjs`](../../../sources/fe/the-split.mjs)
keeps the hook in the connected half, where a key has the viewer and the route parameters to be
built from. What a key CONTAINS no rule can see, so that half is a matter for review, and this file
is what review argues from.

Implementation anchors in `starci-academy-fe`: `src/hooks/swr/useQueryCoursePricePreviewSwr.ts` and
`src/hooks/swr/useMutateAddToCartSwr.ts`.

## Rules

**CACHE-1 · A key names one answer, so every value that changes the answer is IN the key.**

The cache does not compare requests, it compares keys. Two calls with one key are one entry, and the
second caller is served the first caller's answer without a request going out — that is the point of
a cache and also its entire failure mode. So a fragment the answer depends on and the key omits does
not produce a stale entry sometimes; it produces a WRONG entry deterministically, and it looks
correct, because a plausible answer to the wrong question is indistinguishable from the right one.

The same reason settles where the fetcher gets its arguments: it reads them back out of the key
rather than closing over the parameter it was called with. A key and a closure are two copies of one
fact, and after a re-render they can disagree — the entry is then filed under one question and holds
the answer to another.

**CACHE-2 · A personal answer carries the viewer in its key.**

An answer computed from who is asking is not shared data that happens to be behind auth; it is a
different answer per reader, and a key that does not mention the reader promises otherwise. Two
failures follow, and the second is worse than the first. Signing IN changes nothing, because the key
did not change, so a reader who has just signed in keeps reading the refusal fetched a second
earlier. Signing OUT changes nothing either, so the next person on that tab reads the previous
reader's figures — and those figures look entirely plausible.

Both stop being possible once the viewer is a fragment of the key: a change of viewer is a change of
key, and an unfetched key has nothing to serve.

What goes in is a stable, non-reversible fingerprint of the session, never the credential itself.
The key is handed to devtools, to any cache inspector, and to whatever logs a key when a request
fails; a bearer token there is the same mistake as a bearer token in web storage. The fingerprint is
not a security boundary and is not claimed to be one — it only has to differ when the viewer
differs.

**CACHE-3 · A per-item action carries the item in its key.**

Hooks sharing a key share their STATE, not only their data. For a mutation that state includes
`isMutating`, which is what a control reads to show it is working. So one key across a list is a
list where pressing one row puts every other row's control into the running state: one press, a
whole column of spinners, and every other row's button disabled for a press the reader never made.

The item is what makes this press a different press from the one on the row beside it. Without it in
the key, the list has one button as far as the cache is concerned.

**CACHE-4 · A key that is not ready is `null`, not a key with a gap in it.**

Every fragment must be known before the question exists. While one is still `undefined` — the viewer
before the session resolves, an id belonging to a resting placeholder, a parameter for a surface
nobody has opened — the hook passes `null` and fetches nothing.

The alternative is worse than a wasted request. A key built around a missing fragment asks something
nobody wanted an answer to, and caches the reply under a name no later caller will produce. An
auth-gated query fired without a token does not fail once, it fails on a retry backoff, and it
reports itself as loading each time — which is how a signed-out surface ends up shimmering at
somebody who is not waiting for anything.

A placeholder substituted for the missing fragment is the same defect wearing a valid key: an empty
string, a zero or the word `guest` produces a real entry holding a real answer to a question the
caller did not ask, and nothing about it reads as broken later.

**CACHE-5 · Failure and emptiness are different answers, and the unwrapping says which one a `null`
means where the caller reads it.**

"The request did not arrive" and "there is genuinely none" want different words on screen, and a
fetcher that folds an error into `null` has destroyed the difference before any caller can tell them
apart. A failure stays a failure — it belongs to the hook's error, where a caller can decide to
retry, say so, or fall back deliberately.

That leaves `null` free to mean exactly one thing, and the hook is where that meaning is written
down, next to the unwrapping that produces it: a price preview returns `null` when no personal price
can be computed, so the catalog prices from the phase instead — which is the honest answer, not a
swallowed error. A caller cannot infer that from a type, and it must not have to guess.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A constant string as the whole key for a personal answer | Two readers share one entry, and signing out leaves the previous reader's figures on the tab | Add the viewer fragment to the key |
| The bearer token itself as the viewer fragment | The key reaches devtools, cache inspectors and failure logs, where a credential must never be | A stable, non-reversible fingerprint of it |
| One mutation key across a list of rows | Hooks on one key share `isMutating`, so one press runs every row's control | Put the row's id in the key |
| A key assembled while a fragment is still `undefined` | It asks a question nobody asked, and an auth-gated retry loop reports itself as loading forever | Pass `null` until every fragment is known |
| A placeholder standing in for a missing fragment | `""`, `0` or `guest` is a valid key holding a real answer to the wrong question, and nothing about it reads as broken | Pass `null` |
| A fetcher closing over the parameter instead of reading the key | Key and request are two copies of one fact and can disagree after a re-render | Take the arguments back out of the key |
| A fetcher that returns `null` on failure | "It did not arrive" and "there is none" become the same value, and the surface says there is nothing | Let the failure stay the hook's error |
| A `null` whose meaning is written only at the call site | Every later caller re-decides it, and they will not agree | State what a `null` means at the unwrapping that produces it |

## Examples

### The viewer in the key

```ts
// the answer is personal, so the key says whose it is
useSWR(viewer === undefined ? null : [QUERY_MY_KPIS_SWR_KEY, viewer], fetcher)
```

```ts
// one entry for everybody: the next reader on this tab gets the last reader's figures
useSWR(QUERY_MY_KPIS_SWR_KEY, fetcher)
```

They differ in one thing: whether signing out changes the question being asked.

### The item in the key

```ts
// one hook per row, so a press runs only the row that was pressed
useSWRMutation([MUTATE_ADD_TO_CART_SWR_KEY, courseId], fetcher)
```

```ts
// every card on the grid shares one running state: one press, twelve spinners
useSWRMutation(MUTATE_ADD_TO_CART_SWR_KEY, fetcher)
```

They differ in one thing: whether the cache can tell one row's press from another's.

### Not ready is null

```ts
// no question until both fragments are known
viewer === undefined || courseId === undefined ? null : [KEY, viewer, courseId]
```

```ts
// a real key, a real entry, an answer to a question nobody asked
[KEY, viewer ?? "guest", courseId ?? ""]
```

They differ in one thing: whether an incomplete question gets asked anyway.

### The fetcher's arguments

```ts
async ([, , id]: [string, string, string]) => queryCoursePricePreview({ request: { courseId: id } })
```

```ts
async () => queryCoursePricePreview({ request: { courseId } })
```

They differ in one thing: whether the entry's name and the request that filled it can disagree.

### Failure is not emptiness

```ts
// the request failing is the hook's error; null means the server had no personal price
const result = await queryCoursePricePreview({ request: { courseId: id } })
return result.data?.coursePricePreview?.data ?? null
```

```ts
// a refused request and an absent price arrive as the same value, and the surface reads "none"
try {
    const result = await queryCoursePricePreview({ request: { courseId: id } })
    return result.data?.coursePricePreview?.data ?? null
} catch {
    return null
}
```

They differ in one thing: whether a caller can still tell a failure from an empty answer.
