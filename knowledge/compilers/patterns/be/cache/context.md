# Cache

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | the published backend machine this record cites |

## Record

The input is an accepted read path whose derived result is expensive enough to reuse. This pattern
does not make cache a second database. It decides the canonical key and its complete inputs, the
authoritative source, invalidation on mutation, and the stale/TTL/error contract.

## Law

A cache is disposable derived data. The source of truth remains the database or domain projection;
a miss, eviction, restart or stale entry must have a defined read path back to that authority. A key
is a versioned namespace plus every input that can change the result. Mutation invalidates or refreshes
all affected keys through a declared ordering; TTL and stale/error behaviour are explicit.

## Situation codes

| Code | Situation | What the source must look like |
|---|---|---|
| `CACHE-1` | A derived read needs a cache key | Canonical key builder includes namespace/version and every semantic input (tenant, actor, locale, filters, auth scope); no raw object/string interpolation |
| `CACHE-2` | The cached value has an authority | Cache stores a derived/read result and misses read authoritative state. Forbidden: accepting cache as the only durable write or treating a replay/correctness record as cache |
| `CACHE-3` | A mutation can make a cached result wrong | Mutation invalidates/refreshes all affected canonical keys with an explicit transaction/event ordering and no unbounded stale window |
| `CACHE-4` | Freshness, stale and error policy are chosen | TTL, stale-while-revalidate, negative caching, stampede control and failure fallback are explicit; exceptions and partial results are not cached accidentally |

## Reading an accepted shape

1. Name the read result and its authoritative source.
2. Derive the complete canonical key (`CACHE-1`), then authority (`-2`), mutation path (`-3`) and
   freshness/error contract (`-4`).
3. Ask whether the record prevents a business effect from repeating; if yes it is `IDEMP`, not cache.
   Ask whether a broker/CDC message is being deduped; that is `DELIVERY`/`CDC`, not cache.

## `CACHE-1` — key names the complete input

**What it emits.** One builder for a namespaced/versioned key, with normalized scalar inputs and explicit
tenant/user/locale/filter/permission dimensions. Equivalent inputs produce equivalent keys; changing
any result-bearing input changes the key.

**Boundary.** Not `IDEMP-1`: a cache key identifies derived data, while an idempotency key identifies
one logical effect. Not a database primary key or a broker digest: those identify durable entities or
delivery envelopes.

## `CACHE-2` — authority stays outside the cache

**What it emits.** Cache miss/read-through loads from the database or authoritative projection and
serializes only a derived result. Durable writes update authority first; cache population follows.

**Boundary.** Not `IDEMP-3`: idempotency replay is correctness state and must survive eviction. Not
`CDC-4`: a projection recomputes from source rows; cache may front that projection but cannot become
its source. Not `DATA-4`: transaction atomicity still governs source writes.

## `CACHE-3` — mutation invalidates affected keys

**What it emits.** A mutation identifies affected key dimensions and invalidates/refreshes them after
the authoritative commit, or publishes a durable invalidation event with an explicit ordering. A
failed invalidation is observable and repairable; wildcard flush is not the default policy.

**Boundary.** Not `CDC-4`: CDC recomputation rebuilds a projection, while this removes derived cache
entries. Not `DELIVERY-4`: message digest dedupe prevents duplicate delivery effects. Not async retry:
retrying an invalidation is safe only after the mutation's commit/order is known.

## `CACHE-4` — freshness and failure are explicit

**What it emits.** TTL plus stale-while-revalidate or fail-closed/open behaviour, negative-cache policy,
stampede protection and serialization/version handling. Provider/database errors do not become cached
empty or partial values by accident.

**Boundary.** Not `IDEMP-4`: idempotency retention answers how long correctness claims remain; cache
TTL answers freshness. Not `TESTING-5`/`-6`: tests may cover branches, but this code names runtime policy.

## Layer held

| Code | Tier | What holds it |
|---|---|---|
| `CACHE-1` | `documented` | canonical key builder and cache adapter |
| `CACHE-2` | `documented` | read service plus authoritative repository/projection |
| `CACHE-3` | `documented` | mutation coordinator and invalidation/refresh publisher |
| `CACHE-4` | `documented` | cache policy, serializer and failure handling |

## Inputs

| Input | Evidence required |
|---|---|
| result | Derived value and authoritative source |
| key | Namespace/version and every result-bearing dimension |
| mutation | Writes that can make the value wrong |
| freshness | TTL, stale, negative and stampede policy |
| failure | Miss/error/partial-value behaviour |

## Rules

1. Keys are canonical, versioned and complete.
2. Authority is durable source state, never cache storage.
3. Mutations invalidate/refresh affected keys after the source commit or declared event ordering.
4. TTL, stale, negative and error policy are explicit.
5. Cache is not idempotency replay, delivery/CDC dedupe, async retry or a test assertion.

## Exceptions

- **Process-local memoization.** Allowed for immutable configuration or a bounded request scope; it
  still cannot be the authority for mutable product state.
- **Intentional stale read.** Allowed when the accepted shape names its freshness budget and the
  caller can tolerate it; `CACHE-4` still records TTL and failure policy.
- **Write-through cache.** Allowed only when durable authority commit remains the success criterion
  and a repair/invalidation path exists for cache failure.

## Output

```text
read: <derived result>
authority: <database or projection source>
situation: <CACHE-1 … CACHE-4>
key: <canonical namespace/version/inputs>
mutation: <affected-key invalidation or refresh ordering>
policy: <TTL/stale/error/negative/stampede semantics>
reason: <fact excluding adjacent concern>
```
