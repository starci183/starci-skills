# Error handling — boundaries, surfacing, and never swallowing

Scope: how a front end of this kind — React on a file-routed framework (Next.js App Router or
equivalent), data over a typed client with a cache layer (SWR, React Query, Apollo) — deals with
failure. Where a `try`/`catch` is allowed, where an error boundary sits, what the reader sees versus
what the operator sees, and how an error is typed on the way through.

Every rule below is anchored to a public source, because none of this is a house preference: the
constraints come from what React's boundaries can actually catch, what `tsc --strict` actually
narrows, and what the resilience literature learned the hard way about integration points.

---

## 1. An async region renders through ONE state frame with a fixed branch order

Every region backed by a remote read goes through a single reusable frame that receives `error`,
`isLoading`, an emptiness predicate and the content, and resolves them in one fixed order:

> **error → loading → empty → content**

The order is not stylistic. Loading-first hides a failure that has already resolved — a spinner
spins forever while `error` is set. Empty-first renders "nothing here" for a request that never
came back. Error is the only branch whose truth does not depend on the others, so it is tested
first.

The deeper reason the frame exists at all is that **React error boundaries cannot catch this class
of failure**. react.dev is explicit: a boundary catches errors thrown during rendering in the
subtree below it, and does not catch event handlers, asynchronous code, or server rendering. A
rejected fetch is therefore not an exception the tree can catch — it is *state*, and state needs a
component that renders it.

```tsx
// A region consumer. The frame is called with data, not with pre-built nodes:
// `skeleton` and `content` are component references the frame invokes itself.
const { data: project, isLoading, error, mutate } = useProjectQuery(projectId)
const t = useTranslations()

return (
    <AsyncContent
        error={error}
        isLoading={isLoading && !project}          // a refetch over cached data is NOT loading
        isEmpty={!isLoading && !error && !project}  // emptiness is only meaningful once settled
        skeleton={ProjectDetailSkeleton}
        content={ProjectDetailBody}
        errorContent={{ title: t("project.loadFailed"), onRetry: () => mutate() }}
    />
)
```

```tsx
// Wrong: an ad-hoc ternary chain. It puts loading first, so a failed request shows a spinner
// forever, and the next screen written this way will pick a different order.
if (isLoading) return <Spinner />
if (!project) return <Empty />
return <ProjectDetailBody project={project} />
```

Judgement, mostly: a lint rule can ban `isLoading ?` ternaries inside feature JSX, but whether a
region is "one region" is a design call. The branch order inside the frame itself is a unit test,
and should be one.

---

## 2. A boundary per independently-failing region — one at the root is not a strategy

react.dev's constraint from §1 has a second consequence: what boundaries *do* catch is a render
crash — a bad shape, an undefined read, a throwing child. Where you place the boundary decides how
much of the page that crash destroys. A single boundary at the root converts one broken widget into
a blank document.

Portable rule: **a boundary wraps each region that can fail independently and has a fallback that
leaves the rest of the page usable.** A sidebar that cannot render should not take the article with
it.

Frameworks with file-based routing give you the route-level boundary as a first-class file — in the
App Router it is `error.tsx` beside `page.tsx`, it must be a client component, and it receives a
`reset()` that re-attempts the segment. Use it as the outermost net, not as the only one.

```tsx
// app/[locale]/error.tsx — the route-level net. Client component by requirement, not by choice.
"use client"

interface RouteErrorProps {
    error: Error & { digest?: string }
    reset: () => void
}

export default function RouteError({ error, reset }: RouteErrorProps) {
    const t = useTranslations()

    // Surfacing and logging are separate acts (§6). This is the logging half: the operator
    // needs the cause and the digest; the reader below gets neither.
    useEffect(() => { logger.error("route_render_failed", { cause: error, digest: error.digest }) },
        [error])

    return (
        <ErrorPageState
            title={t("error.routeTitle")}
            description={t("error.routeDescription")}
            onRetry={reset}                        // reset() re-renders the segment
            homeHref={routes().home().build()}      // always an escape hatch (§ routing.md)
        />
    )
}
```

```tsx
// Wrong: one boundary at the application root and nothing below it. Any component in any region
// that throws now blanks the whole page, and the fallback cannot say what broke.
<ErrorBoundary fallback={<p>Something went wrong</p>}>
    <WholeApp />
</ErrorBoundary>
```

Two ways to get this wrong beyond placement: a fallback with no way forward — no retry, no link out
— which is a dead end; and a boundary that renders the raw `error.message`, which leaks internals to
a reader who cannot act on them.

---

## 3. `try`/`catch` belongs at boundaries you own, and nowhere else

There are exactly three places a `catch` earns its keep:

1. **An imperative action** — an event handler firing a mutation. Nothing above it can catch an
   async rejection, so if it is not caught here it becomes an unhandled rejection.
2. **A server-side read whose failure must degrade** rather than crash the render — metadata, an
   optional panel, a page that should still be indexable without its extras.
3. **An adapter** converting a foreign error shape (HTTP, GraphQL, SDK) into the application's own
   error type, at the point the foreign thing enters (§7).

Everywhere else, let the rejection propagate to the frame in §1 or the boundary in §2. Michael
Nygard's *Release It!* (2007/2018) names the failure this prevents: the **Integration Point** is
where systems break, and the fix is to fail fast and convert *at* the integration point rather than
to scatter half-handling along the call path.

```ts
// A server-side read that degrades. The catch is legitimate because the alternative is a page
// that 500s over an optional panel — but note it logs the cause before returning the fallback.
export const getProjectForMetadata = cache(async (projectId: string): Promise<Project | null> => {
    try {
        return await api.projects.get(projectId)
    } catch (cause) {
        // Degrade, do not crash: metadata generation must not take the document with it.
        logger.warn("project_metadata_fetch_failed", { projectId, cause })
        return null
    }
})
```

```ts
// Wrong: a catch in the middle of a call chain that neither handles nor converts. The caller
// now cannot tell "no project" from "the network is down", and the log line is the only trace.
const load = async (id: string) => {
    try { return await api.projects.get(id) } catch (e) { console.log(e); return null }
}
```

Machine-checkable in part: `@typescript-eslint/no-floating-promises` catches the promise nobody
awaited or `.catch`ed, and `@typescript-eslint/no-misused-promises` catches the async function
handed to something expecting `void`. Both require type-aware linting, which is the reason to turn
it on.

---

## 4. A `catch` handles, converts, or rethrows — never swallows

Swallowing is the defect this whole file exists to prevent, and it has three disguises: the empty
block, the block that only logs and then continues as if the value were present, and the block that
returns a plausible-looking default — `[]`, `0`, `""` — which the caller cannot distinguish from a
real empty result.

The rule: **every catch must end in one of three acts.** Handle it (render an error state, show a
toast, degrade with a logged reason as in §3). Convert it (wrap into a typed application error and
rethrow — §5). Or rethrow it untouched. There is no fourth.

```ts
// Convert-and-rethrow at the adapter edge: the cause is preserved via the standard `cause`
// option (ES2022), so the stack the operator reads still reaches the original failure.
export const toAppError = (cause: unknown, code: AppErrorCode): AppError => {
    if (cause instanceof AppError) return cause
    return new AppError(code, { cause })
}

export const createProject = async (input: CreateProjectInput): Promise<Project> => {
    try {
        return await api.projects.create(input)
    } catch (cause) {
        throw toAppError(cause, "project.createFailed")   // converted, not absorbed
    }
}
```

```ts
// Wrong: three flavours of swallowing, all of which type-check and all of which lie.
try { await save() } catch {}                                  // silent
try { await save() } catch (e) { console.error(e) }             // logged, then pretends it saved
try { return await load() } catch { return [] }                 // "no results" that was a 503
```

Machine-checkable: `no-empty` with `allowEmptyCatch` left at its default `false` catches the first
form; `@typescript-eslint/only-throw-error` (the successor to `no-throw-literal`) keeps `throw
"failed"` out of the codebase so that `instanceof` narrowing in the catch is meaningful at all. The
second and third forms are judgement — no linter can tell a deliberate degrade from an accident,
which is why a degrade must carry a comment saying what it is degrading to.

---

## 5. The catch variable is `unknown`; what crosses a module boundary is a typed error

Under `tsc --strict`, `useUnknownInCatchVariables` (TypeScript 4.4) types the caught value as
`unknown` rather than `any`. Keep it on. It is the flag that forces the question every catch should
answer — *what do I actually know about this value?* — instead of letting `error.message` compile
against a thing that might be a string, a `null`, or a DOM event.

Narrow with a real type guard. The Google TypeScript Style Guide's most portable rule applies with
full force here: no `any`, and no habitual non-null assertion — make the type honest instead.

For a use case whose failure the *caller must branch on* — a form submit, a payment step, anything
where "it failed" is a normal outcome rather than an exception — return a discriminated result
instead of throwing, and make the return value impossible to ignore.

```ts
export type Result<T, E extends AppError = AppError> =
    | { ok: true; data: T }
    | { ok: false; error: E }

export const submitProject = async (input: CreateProjectInput): Promise<Result<Project>> => {
    try {
        return { ok: true, data: await api.projects.create(input) }
    } catch (cause) {
        // `cause` is `unknown` here — narrowing is compulsory, which is the point of the flag.
        return { ok: false, error: toAppError(cause, "project.createFailed") }
    }
}

// The caller cannot reach `data` without proving the call succeeded.
const result = await submitProject(input)
if (!result.ok) { showError(result.error); return }
router.push(routes().project(result.data.id).build())
```

```ts
// Wrong: `any` in the catch, a message read off a value that may not have one, and a boolean
// return that says a call failed without saying how, so the caller can only show one message.
try { await create(input) } catch (e: any) { toast(e.message); return false }
```

Judgement call, worth stating: not everything becomes a `Result`. Throwing is right when the
failure is genuinely exceptional and the only sane handler is a boundary several levels up.
`Result` is right when the immediate caller has a specific thing to do about each failure. Mixing
the two inside one module is what makes error handling unreadable.

---

## 6. Surfacing and logging are two different audiences — write both, confuse neither

The reader and the operator need opposite things from the same failure, so one act cannot serve
both.

**What the reader gets:** localized copy that names what failed in domain terms and what to do
about it, plus a retry that revalidates the same cache key rather than reloading the document.
Never a raw message, never a stack, never a status code as prose.

**What the operator gets:** one structured event per unit of work carrying the machine-readable
code, the correlation id, the route, and the original cause — not five thin lines emitted from
five layers of the same failure. This is Charity Majors' rule from *Observability Engineering*
(2022): wide, high-cardinality events beat many narrow log lines, because the question you will ask
at 3am is one nobody predicted at write time. The correlation id itself is the *Enterprise
Integration Patterns* (Hohpe & Woolf, 2003) **Correlation Identifier**, propagated on the wire as
W3C Trace Context so the front-end event and the server span join up.

The code comes before the sentence. Google's API error model (AIP-193) and Stripe's error taxonomy
both settle this the same way: an error is a machine-readable enum first and human prose second,
because the enum is what the UI switches on and what survives translation.

```tsx
// Surfacing: the code selects localized copy; the message from the wire is never rendered.
const messageKeyFor = (error: AppError) =>
    error.code === "auth.expired"      ? "error.sessionExpired"
        : error.code === "network.offline" ? "error.offline"
            : "error.generic"

<AsyncContent
    error={error}
    errorContent={{
        title: t(messageKeyFor(error)),
        onRetry: () => mutate(),           // revalidate the key; do not reload the page
    }}
/>
```

```ts
// Logging: one wide event, at the boundary that owns the failure, carrying the cause.
logger.error("project_detail_load_failed", {
    code: error.code,
    projectId,
    route: pathname,
    correlationId: error.correlationId,   // joins this to the server-side span
    cause: error.cause,
})
```

```tsx
// Wrong: the wire message rendered to the reader — untranslated, unactionable, and a small
// information leak. And nothing was logged, so nobody will ever know it happened.
{error && <p>{error.message}</p>}
```

---

## 7. Transport errors are classified ONCE, centrally

Every remote call shares one client layer — an Apollo link, a fetch wrapper, an interceptor — and
that layer is the only place that knows about status codes. It discriminates the classes once,
maps each to a single house action, and everything above it sees typed application errors.

The classes worth separating, and what each one means:

| Class | House action |
|---|---|
| Rejected credential (401, invalid or superseded token) | drop the stored token, surface a re-auth prompt, do not retry |
| Forbidden (403) | surface as a permission state; never retry, never re-auth |
| Server fault (500–599) | treat as a maintenance/degraded state, retriable with backoff |
| Network or parse failure | offline state, retriable |
| Domain error carried in a successful envelope | pass through as a typed error to the caller |

Why once: `if (status === 401)` written at three call sites will disagree within a quarter, and the
third one will retry a rejected token in a loop. Nygard's **Fail Fast** and **Circuit Breaker** are
the same argument — a known-bad remote dependency should be recognised in one place and answered
immediately, not rediscovered per call.

The auth row is not negotiable and is not ours to soften: IETF **RFC 9700, OAuth 2.0 Security Best
Current Practice** (2025) treats a rejected token as an authorization failure requiring a fresh
authorization-code-with-PKCE flow, not a silent retry.

```ts
// One place discriminates. Everything above receives an AppError with a code.
const errorLink = onError(({ networkError, graphQLErrors, operation, forward }) => {
    if (isUnauthenticated(graphQLErrors)) {
        clearStoredToken()                       // the token is dead; retrying re-sends a dead token
        openReauthPrompt()
        return                                   // NOT forwarded — no retry on a credential failure
    }
    if (isServerFault(networkError)) {
        openMaintenanceSurface()                 // one house action for the whole 5xx class
        return
    }
    logger.error("transport_failed", { operation: operation.operationName, cause: networkError })
})
```

```ts
// Wrong: per-call-site status handling. Three of these exist by now and they disagree; this one
// retries an already-rejected credential, which is a loop against the auth server.
const res = await fetch(url)
if (res.status === 401) { await refresh(); return fetch(url) }
```

One rule about the retriable rows: **retries are bounded, jittered, and only for idempotent
operations.** Unbounded or synchronised retries turn a brief server fault into a self-inflicted
load spike — Marc Brooker's "Timeouts, retries, and backoff with jitter" in the AWS Builders'
Library is the standard write-up, and the AWS Well-Architected Reliability Pillar states it as a
requirement. On the client, the practical form of this is that automatic retry belongs to the cache
library's configured policy, and everything else is a retry *button* the reader pressed.
