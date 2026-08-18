# Cache-key

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | the published frontend machine this record cites |

## Record

The input is a shape that has already been accepted: a surface, a block, a capability or a contract
whose data needs are settled. This pattern does not re-open that decision. It lands it in source: it
says which hook file names the answer, what the key expression contains, where the fetcher reads its
arguments from, when the key must be `null` instead, and what a `null` result is allowed to mean.

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

## Situation codes

Every situation this module governs carries a code, `CACHE-<n>`. The code names the SITUATION; the
third column names what that situation obliges the source to look like.

| Code | Situation | What the source must look like |
|---|---|---|
| `CACHE-1` | The answer varies by some value — a filter, a page, a locale, a date range, a record id | Every value the answer depends on is a fragment of the key, and the fetcher reads its arguments back out of the key. No fragment the answer varies by sits outside the key; no fetcher closes over the parameter instead of reading the key; no noise fragment splits one entry for nothing |
| `CACHE-2` | The answer is computed from who is asking | A personal answer carries a stable, non-reversible fingerprint of the viewer in its key. Never a constant string as the whole key for a personal answer, and never the credential itself as the viewer fragment |
| `CACHE-3` | An action is pressed on each row of a list | A per-item action carries the item in its key, one hook per item. Never one mutation key shared across a list, which shares `isMutating` across every row |
| `CACHE-4` | A fragment is still unknown | The key is `null` until every fragment is known. Never a key assembled while a fragment is still `undefined`, and never a placeholder (`""`, `0`, `"guest"`) standing in for a missing fragment |
| `CACHE-5` | The result can be `null` | A failure stays the hook's error, and the meaning of a `null` is written at the unwrapping that produces it. Never a fetcher that returns `null` on failure, and never a `null` whose meaning is decided at the call site |

`CACHE-1` IS THE GENERAL CASE, AND THE OTHERS ARE NOT SUBSETS OF IT. `CACHE-2` and `CACHE-3` name
two fragments that are missed far more often than the rest and that fail in ways `CACHE-1` does not
describe: the viewer fails across a sign-out, the item fails across a list's running state. Folding
them back into `CACHE-1` would be true and useless — a situation with no name of its own is a
situation nobody can be shown to have got wrong.

`CACHE-4` and `CACHE-5` govern the two ends a key does not reach: what happens before the question
exists, and what the answer is allowed to mean once it arrives.

## Reading an accepted shape

1. Read what the shape states. It states which surface shows which data, which action sits on which
   row, and which of that data is personal to the reader. Those statements are settled; take them as
   given.
2. Read what the shape does not state, and therefore does not resolve. A shape does not state the
   key expression, the fetcher signature, the gate that produces a `null` key, or the meaning of a
   `null` result. Those are the outputs of this pattern, not inputs to it.
3. Resolve outermost first. Name the answer one entry holds, as a question, before naming any
   fragment; a fragment only means something relative to the answer it varies.
4. Ask each code's question in turn, against that answer:
   - `CACHE-1` — if this value were different, would the answer be different?
   - `CACHE-2` — two people both signed in, both calling this, do they get different results?
   - `CACHE-3` — how many buttons for this action exist on screen at once? More than one means the
     key must tell them apart.
   - `CACHE-4` — on the FIRST render, which fragment is still `undefined`? Is that fragment in the
     key?
   - `CACHE-5` — when a reader sees `null` at the unwrapping, what words should be on screen? If
     that depends on whether the request arrived, the `null` is carrying two meanings.
5. When two codes both match, both apply. They are not alternatives. A private query resolves
   `CACHE-2` and `CACHE-4` together, because one says the viewer fragment must be there and the
   other says what to do while it is not yet known. Record every code that applies in the output
   block; a hook resolving to one code when two describe it has been half read.

## `CACHE-1` — every value the answer varies by is in the key

**Situation.** The answer depends on a value: a filter, a page, a locale, a date range. The cache
does not compare requests, it compares keys. Two calls with the same key are ONE entry, and the
second caller is served the first caller's answer with no request going out at all.

**What it emits in source.** A key expression listing every fragment the answer varies by, and
nothing else, plus a fetcher whose signature destructures those fragments back out of the key and
passes THOSE to the request — never the identically named parameter sitting in the enclosing scope.
Key and closure are two copies of one truth, and after a re-render the two copies can diverge; the
entry is then filed under the name of this question while holding the answer to that one.

**Boundary.** Not `CACHE-2`: the viewer is also a fragment, but it has its own code because it fails
in a different way — across a sign-out, not across a parameter change. Not `CACHE-3`: an item id is
also a fragment, but on a mutation it decides the running state, not only the data. Not `CACHE-4`:
`CACHE-1` says which fragment MUST be present; `CACHE-4` says what to do while it is not.

## `CACHE-2` — a personal answer carries its viewer in the key

**Situation.** The answer is computed from the person asking. This is not shared data that happens
to sit behind a sign-in; it is a different answer per person, and a key that never mentions the
reader promises the opposite.

**What it emits in source.** A viewer fragment in the key, produced by a dedicated hook that folds
the session into a stable, non-reversible fingerprint and returns `undefined` when nobody is signed
in. The credential never leaves that file. Keys are handed to devtools, to every cache inspector,
and to anywhere a key is logged when a request fails; a bearer token sitting there is exactly the
mistake of a bearer token sitting in web storage. The fingerprint is NOT a security boundary and
does not claim to be — it only has to differ when the reader differs.

**Boundary.** Not `CACHE-1`: being behind auth is not the same fact as being computed from the
reader; adding a viewer to a shared key only clones one identical entry per person. Not `CACHE-4`:
while the viewer is unknown, `CACHE-2` says the fragment must be there and `CACHE-4` says the key is
`null` until it is. The two codes always travel together on private queries.

## `CACHE-3` — a per-row action carries its row in the key

**Situation.** Hooks sharing a key share STATE, not only data. On a mutation that state includes
`isMutating` — exactly what a button reads to know it is running. One key spread across a list
therefore produces: press ONE row, and the whole column spins while every other row is disabled by a
press the reader never made.

**What it emits in source.** A mutation key carrying the item id, on a hook the caller instantiates
once per row, so the running state belongs to one row. The item is what makes this press different
from the press on the row beside it; without it in the key the whole list has, as far as the cache
is concerned, exactly one button.

**Boundary.** Not `CACHE-1`: `CACHE-1` is about the DATA returned; `CACHE-3` is about the shared
RUNNING STATE. A mutation can be wrong under `CACHE-3` while the data it returns is perfectly
correct. Not the bulk-action exception: clearing a cart or marking everything read genuinely has the
whole list as its subject, one press and one running state, so its key holds no item. Per-row and
bulk are two different actions, not one action keyed two ways.

## `CACHE-4` — an incomplete key is `null`, not a key with a hole

**Situation.** Every fragment must be known before the question exists. While one fragment is still
`undefined` — a viewer before the session resolves, an id belonging to a resting placeholder, a
parameter of a surface nobody has opened — the hook passes `null` and fetches nothing.

**What it emits in source.** A gate in front of the key expression that returns `null` while any
required fragment is `undefined`, with no `??` or `||` supplying a stand-in for either. The
alternative is worse than a wasted request: a key built around a missing fragment asks something
nobody wanted to know and caches the answer under a name no later caller will ever produce again. A
query that needs a token and fires before the token exists does not fail once; it fails on a backoff
retry loop, reporting itself as loading each time — which is exactly how a signed-out screen keeps
flashing a skeleton at somebody who is waiting for nothing. A placeholder is that same fault wearing
a valid key: `""`, `0` or `"guest"` creates a REAL entry holding a REAL answer to a question the
caller did not ask, with nothing afterwards to show it is broken.

**Boundary.** Not `CACHE-1`: `CACHE-1` is wrong by OMITTING a fragment that should have been there;
`CACHE-4` is wrong by INVENTING one that has not arrived. Not `CACHE-5`: `CACHE-4` is about `null`
in the KEY position (not asked yet); `CACHE-5` is about `null` in the RESULT position (asked, and
the answer is nothing). These two `null`s have nothing to do with each other, and confusing them is
this module's most common misreading.

## `CACHE-5` — failure and emptiness are two different answers

**Situation.** "The request did not arrive" and "there genuinely is nothing" want two different
sentences on screen, and a fetcher that folds an error into `null` has destroyed that difference
before any caller could tell them apart.

**What it emits in source.** A fetcher with no `try`/`catch` swallowing failures — a failure stays
the hook's `error`, where the caller can retry, say so, or deliberately fall back. That frees `null`
to carry exactly one meaning, and the hook is where that meaning is written down, right beside the
unwrapping that produces it: a price preview returns `null` when no personal price can be computed
for this person, so the screen shows the list price — an honest answer, not a swallowed error. The
caller cannot infer that from the type and must not be made to guess.

**Boundary.** Not `CACHE-4`: as above, a `null` key and a `null` result are two different things.
Not the contract-failure exception: a fetcher may still return `null` for a failure the caller MUST
treat as emptiness — but only when the server itself distinguishes the two and the hook writes that
distinction down at the unwrapping. An untyped `catch` is never this case.

## Layer held

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

There is no `@canon-fe`. This module publishes **zero** rules, so all five codes are
held by review and by this file alone. That is not an omission waiting to be filled: an ESLint rule
sees a key EXPRESSION, and what makes a key correct is whether the values in it are the ones the
answer varies by — a fact about the server, not about the syntax. A rule can see that a key is an
array of three identifiers. It cannot see that the third one should have been a fourth.

The nearest mechanical neighbour is `@canon-fe`, whose `presentational-purity` rule
keeps every `useSWR` call in the connected half. That holds WHERE a key is built — in the file that
has the viewer and the route parameters to build it from — and nothing at all about what goes into
it. It is adjacency, not enforcement, and it is not counted above.

## Inputs

| Input | Evidence required |
|---|---|
| answer | What one entry under this key holds, stated as a question |
| fragments | Every value the answer varies by, each with the reason it varies |
| viewer | Whether the answer is computed from who is asking |
| cardinality | Whether one hook names one item or a whole list |
| readiness | Which fragments can still be `undefined`, and when they resolve |
| null meaning | What a `null` in the unwrapped result asserts, if the result can be `null` |

## Rules

1. The key contains every value the answer varies by, and nothing else.
2. The fetcher takes its arguments from the key, never from the enclosing scope.
3. A personal answer names its viewer; a shared answer does not.
4. The viewer fragment is a fingerprint, never the credential.
5. A per-item action names its item, and one hook serves one item.
6. An incomplete key is `null`. There is no placeholder fragment.
7. A failure reaches the caller as the hook's error, never as data.
8. The meaning of a `null` is written where the `null` is produced.
9. Every hook naming a cached answer resolves to at least one code. No hook is out of scope.

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

One block per hook file the accepted shape produces.

```text
answer: <the question one entry names>
fragments: <every value the answer varies by>
codes: <CACHE-1 | CACHE-2 | CACHE-3 | CACHE-4 | CACHE-5, all that apply>
key: <the key expression, or null and its gate>
null means: <what a null result asserts, or "result is never null">
reason: <the business fact that puts each fragment in, and keeps the others out>
```
