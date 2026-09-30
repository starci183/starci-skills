# Transport, status and wire

Law module: `transport.mjs`. Catalogue: R50 FE_TRANSPORT_OWNER, R51 FE_HTTP_STATUS_COLLAPSE, R52 FE_WIRE_GENERATED.

One repository, one client, one result vocabulary. The client is the file of HFS slot `fe.transport.client` (`apps/<app>/src/modules/api/client.ts`, a one-app repository) or `fe.package.api.client` (`packages/<family>-api/src/client.ts`, the shared client of a multi-app repository); the vocabulary is `Outcome<T>` (`ok`, `refused`, `invalid`, `not-found`, `unavailable`), declared in the `fe.transport.outcome` / `fe.package.api.outcome` file. The rules read the slot of the file being linted, never its path. 401 and 403 become `refused`; nothing collapses a status into `null`; wire types are generated from the contract copy in `modules/api/contract/`.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/fetch-only-in-api-client`

The repository's single `fetch` (and `Request`, `EventSource`, `navigator.sendBeacon`) lives in the api client slot. The global is found by scope resolution: `fetch(...)`, `globalThis.fetch`, `window.fetch`, `self.fetch`, `const f = fetch` and `const { fetch } = globalThis` all count, a local or imported `fetch` does not. A fetch library is refused by module specifier (axios, ky, got, undici, ofetch, graphql-request, urql, `@apollo/*`, ...; `import`, `export ... from`, `import()` and `require`), also inside the client. Another file of the api package (`src/transport.ts`) is not the client.

**Invalid** (`src/hooks/course/useCourse.ts`)

```ts
const r = await fetch(url)
```

**Valid** (`src/hooks/course/useCourse.ts`)

```ts
const r = await client.get(url)
```

**Finding code:** `FE_TRANSPORT_OWNER`

**Why:** `fetch` (or `Request`, `EventSource`, `sendBeacon`, another HTTP library) in `<file>` is outside the single client (`modules/api/client.ts`, or `src/client.ts` of the shared api package). Each repo has exactly one transport path.

**Fix:** Call the repo's client and receive `Outcome<T>`; do not call `fetch` yourself.

## `starci-fe/client-fetch-has-signal`

Every `fetch` in `modules/api/client.ts` passes an AbortSignal (timeout or caller).

**Invalid** (`src/modules/api/client.ts`)

```ts
fetch(url, { method: "GET" })
```

**Valid** (`src/modules/api/client.ts`)

```ts
fetch(url, { method: "GET", signal: AbortSignal.timeout(8000) })
```

**Finding code:** `FE_TRANSPORT_OWNER`

**Why:** `fetch` in `<file>` has no `signal`. The client must have a timeout and an `AbortSignal`.

**Fix:** Pass a `signal` (`AbortSignal.timeout(...)` combined with the caller's signal).

## `starci-fe/no-shared-transport-state`

`modules/api/**` holds no module-level `let`/`var`.

**Invalid** (`src/modules/api/client.ts`)

```ts
let token = null
```

**Valid** (`src/modules/api/client.ts`)

```ts
export const request = (token: string) => token
```

**Finding code:** `FE_TRANSPORT_OWNER`

**Why:** `<file>` keeps shared `let`/`var` state in the API layer. Tokens and locale must not live in a singleton.

**Fix:** Pass credentials and locale as parameters or context.

## `starci-fe/client-maps-auth-to-refused`

The api client branches on the response status: a comparison of the fetch response's status (typed as a `Response`) with 401 and 403 (`===`, `||`, a literal list `.includes`/`.has`, or a `switch` with both cases) whose consequent builds an object with `kind: "refused"`. The three literals lying anywhere in the file do not pass, and neither does a mapping delegated to a function in another file.

**Invalid** (`src/modules/api/client.ts`)

```ts
const r = await fetch(u, { signal })
```

**Valid** (`src/modules/api/client.ts`)

```ts
const r = await fetch(u, { signal })
if (r.status === 401 || r.status === 403) return { ok: false, kind: "refused" }
```

**Finding code:** `FE_HTTP_STATUS_COLLAPSE`

**Why:** The client in `<file>` has no branch comparing `response.status` with 401 and 403 and returning `{ kind: "refused" }`, so the "sign-in required" state can never be reached.

**Fix:** Add a branch `response.status === 401 || response.status === 403` returning `{ ok: false, kind: "refused" }` inside the client.

## `starci-fe/no-http-status-collapse`

A non-ok response is not folded into one branch or into null; 401/403 become `refused`.

**Invalid** (`src/modules/api/client.ts`)

```ts
if (!res.ok) return null
```

**Valid** (`src/modules/api/client.ts`)

```ts
if (!res.ok) return toOutcome(res.status)
```

**Finding code:** `FE_HTTP_STATUS_COLLAPSE`

**Why:** `<file>` collapses every HTTP code into one branch (or returns null on an error response). 401/403 must become `refused`.

**Fix:** Return an `Outcome` by code: `refused` (401/403), `not-found`, `invalid`, `unavailable`; do not return the server's raw error as the reason.

## `starci-fe/no-hand-typed-wire`

A transport response body is narrowed from `unknown` or typed by a generated wire type (a type imported from a `__generated__/` module), never by a hand-written one: `(await response.json()) as unknown` is the sanctioned entry and does not fire; an assertion or annotation of a `.json()` read (directly, or through a `const` initialised with one) to any other type does. Inline GraphQL documents are also refused. A hand-declared interface is not judged by its name; only a response read typed by hand is.

**Invalid** (`src/modules/api/course/read-course.ts`)

```ts
const x = (await res.json()) as Course
```

**Valid** (`src/modules/api/course/read-course.ts`)

```ts
import type { CourseQuery } from "../__generated__/graphql"
const raw = (await res.json()) as unknown
const x: CourseQuery = parse(raw)
```

**Finding code:** `FE_WIRE_GENERATED`

**Why:** `<file>` hand-types a wire type or casts a response. Use types generated from `contract/`.

**Fix:** Run codegen from the contract copy at `modules/api/contract/` and import the generated types; put GraphQL documents in `.graphql` files.

## `starci-fe/outcome-kinds-exhaustive`

A `switch` over an Outcome's `kind` has a case for every kind (catalogue R51, sub-check `FE_OUTCOME_KIND_UNHANDLED`).

**Invalid** (`src/hooks/course/useCourse.ts`)

```tsx
switch (outcome.kind) { case "ok": return outcome.data; default: return null }
```

**Valid** (`src/hooks/course/useCourse.ts`)

```tsx
switch (outcome.kind) {
  case "ok": return outcome.data
  case "refused": return goToSignIn()
  case "invalid": return showIssues(outcome.issues)
  case "not-found": return notFoundState()
  case "unavailable": return retryState(outcome.retryable)
}
```

**Finding code:** `FE_OUTCOME_KIND_UNHANDLED`

**Why:** The `switch` on `kind` in `<file>` has an `ok` branch but lacks one of refused, invalid, not-found, unavailable.

**Fix:** Write all five branches of `Outcome<T>`, one screen per branch; do not rely on `default`.

## `starci-fe/one-outcome-union`

A result union (`ok` / `kind` discriminant) is declared only in the outcome slot; elsewhere the code composes `Outcome<T>`.

A union type alias is a result union when its resolved members are all object types that carry the same literal-typed discriminant in the result vocabulary: `ok` (each member pins it to one value, `true` and `false` both present) or `kind` (at least one literal of the Outcome vocabulary: `ok`, `refused`, `forbidden`, `invalid`, `not-found`, `unavailable`). The members are read through the type checker, so `Ok<T> | Failure` and intersections are seen as what they are; no name (`*Outcome`, `*Result`) decides anything. UI state unions (`status`, `state`, `type`, a `kind` of tree nodes or menu items) are not result vocabulary and pass; so does an alias that only composes the one union (`type Read = Outcome<Course>`, `Exclude<Outcome<T>, ...>`). `Outcome<T> | { ok: false; kind: "conflict" }` adds an arm to the one union and is refused.

**Invalid** (`src/hooks/invite/useInvite.ts`)

```ts
export type InviteOutcome = { ok: true } | { ok: false; kind: "refused" }
```

**Valid** (`src/hooks/invite/useInvite.ts`)

```ts
import type { Outcome } from "@/modules/api/outcome"
export type InviteOutcome = Outcome<{ id: string }>
```

**Finding code:** `FE_HTTP_STATUS_COLLAPSE`

**Why:** `<file>` declares another result union (`ok` or `kind`) outside `outcome.ts`. A repo has only one `Outcome<T>`.

**Fix:** Use `Outcome<T>` from `modules/api/outcome.ts` (or the shared api package); add business detail through a second parameter instead of declaring a new union.
