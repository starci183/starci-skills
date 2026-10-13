# Transport, status and wire

Law module: `transport.mjs`. Catalogue: R50 FE_TRANSPORT_OWNER, R51 FE_HTTP_STATUS_COLLAPSE, R52 FE_WIRE_GENERATED.

One front end, one API layer, one result vocabulary (lite and full alike). The API layer is `modules/api` (slot `fe.modules.api`, or the shared api package `fe.package.api`): the transport owner is the folder of the auth and no-auth Apollo clients and their link chain (slot `fe.transport.client`: `apps/<app>/src/modules/api/graphql/clients/`, or `fe.package.api.client`: `packages/<family>-api/src/graphql/clients/`), one file per GraphQL operation runs on them (`graphql/queries/query-<x>.ts`, `graphql/mutations/mutation-<x>.ts`), and the REST calls (uploads, presigned URLs, auth endpoints) are axios calls in `rest/<area>/`. `fetch` is reached only in the API layer, `@apollo/client` is imported only there, `axios` only by its REST calls and `socket.io-client` only by `hooks/socketio/`; everything else reaches the back end through the SWR hooks of `hooks/swr/`. The vocabulary is `GraphQLResponse<T>` (`success`, `message`, `error`, `data`), declared in the file of the slot the manifest marks `outcomeHome`: `fe.transport.outcome` (`modules/api/graphql/types.ts`) or `fe.package.api.outcome`. The rules read the slot of the file being linted, never its path. A raw `fetch` answered in the clients folder maps 401 and 403 to `refused`; nothing collapses a status into `null`; wire types are generated from the be contract snapshot into `graphql/__generated__/`, and a GraphQL document is written only in the API layer.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/fetch-only-in-api-client`

`fetch` (and `Request`, `EventSource`, `navigator.sendBeacon`) lives in the API layer (`modules/api`, or the shared api package). The global is found by scope resolution: `fetch(...)`, `globalThis.fetch`, `window.fetch`, `self.fetch`, `const f = fetch` and `const { fetch } = globalThis` all count, a local or imported `fetch` does not. The canonical transports are placed by module specifier (`import`, `export ... from`, `import()` and `require`): `@apollo/client` only in the API layer, `axios` only in its REST calls (`modules/api/rest/`), `socket.io-client` only in `hooks/socketio/` (`placed`). Another HTTP library (got, undici, ofetch, `@apollo/server`, ...) is refused everywhere (`library`); one the fe-stack catalog forbids by name (ky, graphql-request, urql, ...) is `fe-stack-import`'s finding.

**Invalid** (`src/hooks/course/useCourse.ts`)

```ts
const r = await fetch(url)
```

**Valid** (`src/hooks/swr/api/graphql/queries/useQueryCourseSwr.ts`)

```ts
const swr = useSWR([QUERY_COURSE_SWR_KEY, id], () => queryCourse({ request: { id } }))
```

**Finding code:** `FE_TRANSPORT_OWNER`

**Why:** `<file>` reaches the back end outside the API layer: `fetch` (or `Request`, `EventSource`, `sendBeacon`, another HTTP library) outside `modules/api`, or Apollo, axios or socket.io-client outside its home (`modules/api`, `modules/api/rest`, `hooks/socketio`).

**Fix:** Call an operation of `modules/api` (Apollo GraphQL, or axios in `modules/api/rest`) through its SWR hook in `hooks/swr`; listen to realtime through `hooks/socketio`.

## `starci-fe/client-fetch-has-signal`

Every `fetch` in the API layer (`modules/api`: a custom fetch handed to the Apollo http link, a raw call) passes an AbortSignal (timeout or caller).

**Invalid** (`src/modules/api/graphql/clients/links/http.ts`)

```ts
fetch(url, { method: "GET" })
```

**Valid** (`src/modules/api/graphql/clients/links/http.ts`)

```ts
fetch(url, { method: "GET", signal: AbortSignal.timeout(8000) })
```

**Finding code:** `FE_TRANSPORT_OWNER`

**Why:** `fetch` in `<file>` has no `signal`. The client must have a timeout and an `AbortSignal`.

**Fix:** Pass a `signal` (`AbortSignal.timeout(...)` combined with the caller's signal).

## `starci-fe/no-shared-transport-state`

`modules/api/**` holds no module-level `let`/`var`.

**Invalid** (`src/modules/api/graphql/clients/links/http.ts`)

```ts
let token = null
```

**Valid** (`src/modules/api/graphql/clients/links/http.ts`)

```ts
export const request = (token: string) => token
```

**Finding code:** `FE_TRANSPORT_OWNER`

**Why:** `<file>` keeps shared `let`/`var` state in the API layer. Tokens and locale must not live in a singleton.

**Fix:** Pass credentials and locale as parameters or context.

## `starci-fe/client-maps-auth-to-refused`

The api client branches on the response status: a comparison of the fetch response's status (typed as a `Response`) with 401 and 403 (`===`, `||`, a literal list `.includes`/`.has`, or a `switch` with both cases) whose consequent builds an object with `kind: "refused"`. The three literals lying anywhere in the file do not pass, and neither does a mapping delegated to a function in another file.

**Invalid** (`src/modules/api/graphql/clients/links/http.ts`)

```ts
const r = await fetch(u, { signal })
```

**Valid** (`src/modules/api/graphql/clients/links/http.ts`)

```ts
const r = await fetch(u, { signal })
if (r.status === 401 || r.status === 403) return { ok: false, kind: "refused" }
```

**Finding code:** `FE_HTTP_STATUS_COLLAPSE`

**Why:** The client in `<file>` has no branch comparing `response.status` with 401 and 403 and returning `{ kind: "refused" }`, so the "sign-in required" state can never be reached.

**Fix:** Add a branch `response.status === 401 || response.status === 403` returning `{ ok: false, kind: "refused" }` inside the client.

## `starci-fe/no-failure-collapse`

A failure, a non-ok HTTP response or a failed `Outcome`, is not folded into one branch or into an empty value; its reason is read and kept (an HTTP status is mapped first: 401/403 `refused`, 404 `not-found`, 422 `invalid`, the rest `unavailable`).

**Invalid** (`src/modules/api/graphql/clients/links/http.ts`)

```ts
if (!res.ok) return null
```

**Valid** (`src/modules/api/graphql/clients/links/http.ts`)

```ts
if (!res.ok) return toOutcome(res.status)
```

**Finding code:** `FE_HTTP_STATUS_COLLAPSE`

**Why:** `<file>` collapses every failure (a failed HTTP response or a failed `Outcome`) into one branch or an empty value, so its reason is lost.

**Fix:** Keep the reason: branch on an `Outcome`'s reason code; map an HTTP status to an `Outcome` first (`refused` for 401/403, `not-found`, `invalid`, `unavailable`). Never use the server's raw text as the reason.

## `starci-fe/no-hand-typed-wire`

A transport response body is narrowed from `unknown` or typed by a generated wire type (a type imported from a `__generated__/` module), never by a hand-written one: `(await response.json()) as unknown` is the sanctioned entry and does not fire; an assertion or annotation of a `.json()` read (directly, or through a `const` initialised with one) to any other type does. A GraphQL document (a `gql`/`graphql` tagged template or a string that reads as one) is written only in the API layer, one file per operation (`graphql/queries/query-<x>.ts`, `graphql/mutations/mutation-<x>.ts`), where codegen reads it; outside the layer it is refused. A hand-declared interface is not judged by its name; only a response read typed by hand is.

**Invalid** (`src/modules/api/graphql/queries/query-course.ts`)

```ts
const x = (await res.json()) as Course
```

**Valid** (`src/modules/api/graphql/queries/query-course.ts`)

```ts
import type { CourseQuery } from "../__generated__/graphql"
const raw = (await res.json()) as unknown
const x: CourseQuery = parse(raw)
```

**Finding code:** `FE_WIRE_GENERATED`

**Why:** `<file>` hand-types a wire type, casts a response, or writes a GraphQL document outside the API layer. Use the types generated from `be/contracts/`.

**Fix:** Run codegen from the be contract snapshot (`be/contracts/`) and import the generated types; write each GraphQL document in its operation file under `modules/api/graphql/queries` or `modules/api/graphql/mutations`.

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

A result union (`success` / `ok` / `kind` discriminant) is declared only in the outcome-home slot (`outcomeHome: true` in the slot manifest: `modules/api/graphql/types.ts`, or the api package's `src/graphql/types.ts`); elsewhere the code composes `GraphQLResponse<T>`.

A union type alias is a result union when its resolved members are all object types that carry the same literal-typed discriminant in the result vocabulary: `success` or `ok` (each member pins it to one value, `true` and `false` both present) or `kind` (at least one literal of the Outcome vocabulary: `ok`, `refused`, `forbidden`, `invalid`, `not-found`, `unavailable`). The members are read through the type checker, so `Ok<T> | Failure` and intersections are seen as what they are; no name (`*Outcome`, `*Result`) decides anything. UI state unions (`status`, `state`, `type`, a `kind` of tree nodes or menu items) are not result vocabulary and pass; so does an alias that only composes the one union (`type Read = Outcome<Course>`, `Exclude<Outcome<T>, ...>`). `Outcome<T> | { ok: false; kind: "conflict" }` adds an arm to the one union and is refused.

**Invalid** (`src/hooks/invite/useInvite.ts`)

```ts
export type InviteOutcome = { ok: true } | { ok: false; kind: "refused" }
```

**Valid** (`src/hooks/invite/useInvite.ts`)

```ts
import type { GraphQLResponse } from "@/modules/api/graphql/types"
export type InviteResponse = GraphQLResponse<{ id: string }>
```

**Finding code:** `FE_HTTP_STATUS_COLLAPSE`

**Why:** `<file>` declares another result union (`success`, `ok` or `kind`) outside `modules/api/graphql/types.ts`. A repo has only one result vocabulary, `GraphQLResponse<T>`.

**Fix:** Use `GraphQLResponse<T>` of `modules/api/graphql/types.ts` (or the shared api package); put the business detail in its `data` instead of declaring a new union.
