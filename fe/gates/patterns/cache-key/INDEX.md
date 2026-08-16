---
id: fe-patterns-cache-key-index
title: INDEX.md
slug: /gates/patterns/cache-key
sidebar_label: cache-key
sidebar_position: 0
description: Binding rules for what a cache key must contain, when it must be null, and what a null answer is allowed to mean.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `cache-key`

## Law

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

**This is binding, not advisory.** Every hook that names a cached answer carries a code below. There
is no query small enough to be exempt: a one-fragment public list is `CACHE-1` for the same reason a
per-row mutation is `CACHE-3`. "It is only one string" is not an exemption — it is the most common
place a personal answer loses its viewer.

## Situation Codes

Every situation this module governs carries a code, `CACHE-<n>`. The code names the SITUATION; the
requirement column names what that situation obliges the key to hold.

| Code | Requires | Forbids |
|---|---|---|
| `CACHE-1` | Every value the answer depends on is a fragment of the key, and the fetcher reads its arguments back out of the key | A fragment the answer varies by left outside the key; a fetcher closing over the parameter instead of reading the key; noise fragments that split one entry for nothing |
| `CACHE-2` | A personal answer carries a stable, non-reversible fingerprint of the viewer in its key | A constant string as the whole key for a personal answer; the credential itself as the viewer fragment |
| `CACHE-3` | A per-item action carries the item in its key, one hook per item | One mutation key shared across a list, which shares `isMutating` across every row |
| `CACHE-4` | The key is `null` until every fragment is known | A key assembled while a fragment is still `undefined`; a placeholder (`""`, `0`, `"guest"`) standing in for a missing fragment |
| `CACHE-5` | A failure stays the hook's error, and the meaning of a `null` is written at the unwrapping that produces it | A fetcher that returns `null` on failure; a `null` whose meaning is decided at the call site |

`CACHE-1` IS THE GENERAL CASE, AND THE OTHERS ARE NOT SUBSETS OF IT. `CACHE-2` and `CACHE-3` name
two fragments that are missed far more often than the rest and that fail in ways `CACHE-1` does not
describe: the viewer fails across a sign-out, the item fails across a list's running state. Folding
them back into `CACHE-1` would be true and useless — a situation with no name of its own is a
situation nobody can be shown to have got wrong.

`CACHE-4` and `CACHE-5` govern the two ends a key does not reach: what happens before the question
exists, and what the answer is allowed to mean once it arrives.

## Tầng giữ

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes
the wrong value impossible to write; `enforced` means a lint rule catches it and the rule is named;
`documented` means nothing mechanical holds it and only a reader does.

| Code | Tier | Holder |
|---|---|---|
| `CACHE-1` | `documented` | none — no rule can see what a key contains |
| `CACHE-2` | `documented` | none — no rule can see what a key contains |
| `CACHE-3` | `documented` | none — no rule can see what a key contains |
| `CACHE-4` | `documented` | none — no rule can see what a key contains |
| `CACHE-5` | `documented` | none — no rule can see what a key contains |

There is no `sources/fe/cache-key.mjs`. This module publishes **zero** rules, so all five codes are
held by review and by this file alone. That is not an omission waiting to be filled: an ESLint rule
sees a key EXPRESSION, and what makes a key correct is whether the values in it are the ones the
answer varies by — a fact about the server, not about the syntax. A rule can see that a key is an
array of three identifiers. It cannot see that the third one should have been a fourth.

The nearest mechanical neighbour is [`sources/fe/the-split.mjs`](../../../../sources/fe/the-split.mjs),
whose `presentational-purity` rule keeps every `useSWR` call in the connected half. That holds WHERE
a key is built — in the file that has the viewer and the route parameters to build it from — and
nothing at all about what goes into it. It is adjacency, not enforcement, and it is not counted
above.

## Anchor

Real code each code can be checked against. Paths are relative to the front-end application
repository root.

| Code | Path | What to look for |
|---|---|---|
| `CACHE-1` | `src/hooks/swr/useQueryCoursePricePreviewSwr.ts` | The fetcher signature `async ([, , id]: [string, string, string])` — it destructures the id back out of the key and passes THAT to the request, while the parameter of the same name sits in scope unused |
| `CACHE-2` | `src/hooks/auth/useViewerKey.ts` | `fingerprint()` folding the session token to a short base-36 string, and the hook returning `undefined` when nobody is signed in. The token itself never leaves this file |
| `CACHE-3` | `src/hooks/swr/useMutateAddToCartSwr.ts` | The key `[MUTATE_ADD_TO_CART_SWR_KEY, courseId]` on a `useSWRMutation` the caller instantiates once per row, so `isMutating` belongs to one row |
| `CACHE-4` | `src/hooks/swr/useQueryCoursePricePreviewSwr.ts` | The gate `viewer === undefined \|\| courseId === undefined ? null : [...]` — two fragments, both required, and no `??` supplying a stand-in for either |
| `CACHE-5` | `src/hooks/swr/useQueryCoursePricePreviewSwr.ts` | The fetcher has no `try`/`catch`; the only `?? null` sits on the unwrapping of a present response, and the doc comment states what that `null` means |

Every code is anchored. No code reads `chưa neo được`.

## Inputs

| Input | Evidence required |
|---|---|
| answer | What one entry under this key holds, stated as a question |
| fragments | Every value the answer varies by, each with the reason it varies |
| viewer | Whether the answer is computed from who is asking |
| cardinality | Whether one hook names one item or a whole list |
| readiness | Which fragments can still be `undefined`, and when they resolve |
| null meaning | What a `null` in the unwrapped result asserts, if the result can be `null` |

## Invariants

- The key contains every value the answer varies by, and nothing else.
- The fetcher takes its arguments from the key, never from the enclosing scope.
- A personal answer names its viewer; a shared answer does not.
- The viewer fragment is a fingerprint, never the credential.
- A per-item action names its item, and one hook serves one item.
- An incomplete key is `null`. There is no placeholder fragment.
- A failure reaches the caller as the hook's error, never as data.
- The meaning of a `null` is written where the `null` is produced.
- Every hook naming a cached answer resolves to at least one code. No hook is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies
to.

- **Genuinely shared answers.** `CACHE-2` does not apply to an answer identical for every reader.
  A public catalog behind an authenticated route is still shared data; being behind auth is not the
  same fact as being computed from the reader.
- **Token refresh refetches.** Under `CACHE-2`, a renewed token changes the fingerprint and costs
  one refetch. That is accepted deliberately. The alternative is decoding the credential to find a
  subject claim, which puts a cache helper in the business of parsing credentials.
- **A key prefix with no fragments.** Under `CACHE-1`, a constant-only key is correct when the
  answer really is one answer for everybody, forever — a static configuration document, a public
  changelog. It stops being correct the moment the answer varies by anything.
- **Bulk actions.** Under `CACHE-3`, an action whose subject genuinely IS the whole list — clearing
  a cart, marking every notification read — takes a key without an item, because there is one press
  and one running state. Per-row and bulk are different actions, not one action keyed two ways.
- **A `null` that is a failure by contract.** Under `CACHE-5`, a fetcher may still return `null` for
  a failure the caller must treat as emptiness — but only when the server itself distinguishes the
  two and the hook writes that distinction down at the unwrapping. An untyped `catch` is never this
  case.

## Output

```text
answer: <the question one entry names>
fragments: <every value the answer varies by>
codes: <CACHE-1 | CACHE-2 | CACHE-3 | CACHE-4 | CACHE-5, all that apply>
key: <the key expression, or null and its gate>
null means: <what a null result asserts, or "result is never null">
reason: <the business fact that puts each fragment in, and keeps the others out>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end that caches by key. Its examples name no product, no
component library, no registry key and no repository — every one is an ordinary hook over ordinary
TSX. The `Anchor` table is the single deliberate exception: it points outward at repo-relative paths,
because a law that cannot be pointed at in real code is a proposal rather than a law.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
