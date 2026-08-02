# Routing — segments, params, and what belongs in a URL

Scope: how a front end of this kind — React on a file-system router (Next.js App Router or
equivalent) — is routed. How a segment is named and nested, what state earns a place in the URL,
how params are read and typed, how a link is constructed, and what a layout is allowed to own.

The through-line: **a URL is an interface, not an implementation detail.** Roy Fielding's
dissertation (2000) puts resource identification at the centre of the uniform interface, and that
constraint survives intact on the client — a URL that does not identify what the reader is looking
at cannot be shared, bookmarked, restored, or navigated back to, and no amount of client state
recovers those.

---

## 1. The route tree IS the file tree, and each segment owns its first-class files

Routing is file-system based and colocated: a folder is a segment, and the segment's behaviour is
declared by files sitting in it rather than by a registry somewhere else. Next.js names these as
first-class conventions — `layout`, `page`, `loading`, `error`, `not-found` — and the portable rule
is to **use the convention file rather than reimplementing its job inside `page`**.

Why it matters beyond tidiness: the framework wires these into the render in ways handwritten
equivalents do not get. `loading` becomes a Suspense boundary for the segment; `error` becomes a
React error boundary around it (see `error-handling.md` §2); `not-found` is what a thrown
not-found resolves to. A spinner returned early from `page` is none of those things — it will not
stream, and it will not catch anything.

```
app/
  [locale]/
    layout.tsx                     locale provider, shared shell — persists across children
    page.tsx
    projects/
      page.tsx                     the collection
      loading.tsx                  streamed while the collection resolves
      [projectId]/
        layout.tsx                 shared rails + shared queries for this project
        page.tsx                   the resource
        error.tsx                  boundary for this subtree only
        settings/
          page.tsx
```

```tsx
// Wrong: the segment's states hand-rolled inside page.tsx. None of these participate in
// streaming or in the boundary tree — they are just early returns.
export default function ProjectPage() {
    if (isLoading) return <Spinner />
    if (error) return <ErrorState />
    ...
}
```

Machine-checkable: a folder-shape gate can assert that every segment holding a `page` also holds
the state files the house requires. Whether a given segment *needs* its own `error` is judgement —
it needs one when it can fail independently of its parent.

---

## 2. Route segment, query param, or component state — decide by lifetime and shareability

Three tiers, and the decision is not aesthetic:

- **Route segment** — the identity of the thing being looked at. If two values here name two
  different resources, they are segments. `projects/42` and `projects/43` are different pages.
- **Query parameter** — a *view* of one resource that a reader would reasonably want to send to a
  colleague or return to after a reload: the active tab, a filter, a sort, a page cursor, a search
  term.
- **Component or store state** — everything ephemeral: a hover, an open dropdown, an unsubmitted
  form field, a transient toast.

The test that settles arguments: **press back, or paste the URL to someone else — what should
happen?** If the answer is "they should see what I see", it is in the URL. If the answer is
"nothing, that was mine", it is not.

Google's resource-oriented design (AIP-121) draws the same line server-side — resources are named
by path, and the parameters that shape a *view* of a resource (filter, page token, ordering) are
query fields, never path segments. Keeping the client's URL grammar aligned with the API's is what
lets a route be turned into a request without a translation table.

```tsx
// The active tab is a view of one resource: it belongs in the query string, and it is written
// with replace() so back leaves the page rather than walking the tab history.
const searchParams = useSearchParams()
const pathname = usePathname()
const router = useRouter()

const tab = (searchParams.get("tab") ?? "overview") as ProjectTab

const selectTab = useCallback((next: ProjectTab) => {
    const params = new URLSearchParams(searchParams)
    params.set("tab", next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
}, [router, pathname, searchParams])
```

```tsx
// Wrong: the tab held only in component state. Reload loses it, a shared link never lands on
// the right tab, and the back button does something the reader did not ask for.
const [tab, setTab] = useState<ProjectTab>("overview")
```

Never put a secret, a token, or personal data in a query string: it lands in browser history,
server access logs, and the `Referer` header of every outbound link on the page. That is a fixed
prohibition, not a preference — OWASP's API and web risk guidance treats sensitive data in URLs as
a disclosure defect.

---

## 3. Params are typed and awaited at the boundary, and read through the router's own hooks

Route params are untyped input from the outside world. Type them explicitly at the point they enter
— a named interface, not an inline `any`, and not a non-null assertion on a lookup that can miss.
Google's TypeScript Style Guide's blunt version applies: no `any`, no habitual `!`; make the type
honest.

In modern App Router versions, a server component's `params` and `searchParams` arrive as promises
and must be awaited — awaiting them is also the moment to validate them, because a segment can hold
any string a reader typed.

On the client, read them through the router's hooks — `useParams`, `useSearchParams`,
`usePathname`, `useSelectedLayoutSegments`. Never parse `window.location`: it is undefined during
server rendering, it does not re-render on client navigation, and it silently drops the framework's
basePath and locale handling.

```tsx
// app/[locale]/projects/[projectId]/page.tsx
interface ProjectPageParams {
    params: Promise<{ locale: string; projectId: string }>
}

export default async function ProjectPage({ params }: ProjectPageParams) {
    const { locale, projectId } = await params
    const project = await getProject(projectId)      // deduped per request — see §5
    if (!project) notFound()                          // resolves to the segment's not-found file

    return <ProjectDetail project={project} locale={locale} />
}
```

```tsx
// Wrong: window.location on the client — undefined on the server, stale after a soft navigation.
const projectId = window.location.pathname.split("/").pop()!
```

---

## 4. Every URL in the codebase comes from ONE typed builder — never string concatenation

A route string written by hand is a route that will not be found when the segment is renamed, and
`` `/projects/${id}/settings` `` typed twelve times is twelve independent chances to forget the
locale prefix. One builder module owns the route grammar; everything else calls it.

The builder is worth its weight only if it is *typed* — a fluent chain or a set of functions whose
signature names the parameters each route requires, so that adding a required segment breaks the
call sites at compile time rather than at click time. That compile-time break is the entire
argument for the pattern.

```ts
// resources/routes/index.ts — the only module that knows what a URL looks like.
export const routes = (locale: string = defaultLocale) => ({
    home: () => segment(`/${locale}`),
    projects: () => segment(`/${locale}/projects`),
    project: (projectId: string) => ({
        ...segment(`/${locale}/projects/${projectId}`),
        settings: () => segment(`/${locale}/projects/${projectId}/settings`),
    }),
})

// Call site: renaming the segment is one edit, and a missing projectId is a type error.
<Link href={routes(locale).project(project.id).settings().build()}>{t("project.settings")}</Link>
```

```tsx
// Wrong: hand-built strings. The locale prefix is missing here and present three files away,
// and a rename of `projects` leaves this one pointing at a 404 that nothing catches.
<Link href={`/projects/${project.id}/settings`}>Settings</Link>
```

Machine-checkable, and worth gating: a lint rule banning string literals matching `^/` in `href`
and `router.push` arguments outside the builder module catches every regression of this rule. It is
one of the few routing rules a script can enforce completely.

---

## 5. A layout owns what PERSISTS; anything that must reset on navigation cannot live there

A layout does not re-render when navigation happens within its subtree — that is the point of it,
and it is also the constraint. So the ownership rule follows mechanically: **a layout owns state,
data, and chrome that must survive navigation between its children, and nothing else.** A scroll
position that should reset, a form that should clear, a step counter that should restart — none of
those can be a layout's, because the layout will not re-run to reset them.

What a layout legitimately owns:

- shared chrome — rails, headers, breadcrumbs — that would flicker if each child rebuilt it
- a shared read every child needs, fetched once so children do not each request it
- a provider or context whose identity must be stable across the subtree
- an access gate for the whole subtree, when every child requires the same precondition

What it must not do is become a place to smuggle per-page state, and it must not re-fetch what a
child already owns. The other half of the gate rule is a security constraint, not a layout one:
OWASP's API Security Top 10 puts **Broken Object Level Authorization** first precisely because
route-level checks get mistaken for object-level ones. A layout gate is a UX affordance — the real
authorization decision is made per object on the server, every time.

```tsx
// app/[locale]/projects/[projectId]/layout.tsx
"use client"

export default function ProjectLayout({ children }: PropsWithChildren) {
    const { projectId } = useParams<{ projectId: string }>()
    const segments = useSelectedLayoutSegments()

    // Fetched once for the whole subtree; children read the same cache key rather than refetching.
    const { data: project } = useProjectQuery(projectId)

    return (
        <div className="flex">
            <ProjectRail project={project} activeSegment={segments[0] ?? "overview"} />
            <main className="flex-1">{children}</main>
        </div>
    )
}
```

```tsx
// Wrong: a wizard step held in the layout. Navigating between children does not re-render the
// layout, so the step never resets and the reader lands mid-flow on a fresh entry.
export default function ProjectLayout({ children }: PropsWithChildren) {
    const [step, setStep] = useState(0)
    ...
}
```

A related idiom worth naming: when a server layout and a page both need the same read, memoize the
fetch per request (`React.cache()` or the framework's request-scoped cache) so metadata generation
and the body share one round trip instead of issuing two.

---

## 6. Route names are lowercase, hyphenated, plural for collections, and say what they carry

The rules, and why each one:

- **Lowercase and hyphenated.** `project-settings`, never `projectSettings` or `project_settings`.
  Some filesystems are case-insensitive and some are not, so a capital in a path is a bug that only
  appears on someone else's machine. Hyphens over underscores is the web's settled convention and
  the one both the Airbnb and Google style guides land on for URL-facing names.
- **Plural collection, then identifier.** `projects/[projectId]` — the collection is a resource and
  the member is a resource under it. This is AIP-121/122's resource-name grammar, and matching it
  means a route maps to an API path without a lookup table.
- **A dynamic segment is named for what it holds.** `[projectId]`, not `[id]`. With nested dynamic
  segments, `[id]` inside `[id]` is unreadable and `useParams()` returns a shape nobody can type
  honestly.
- **Verbs are not segments.** `projects/[projectId]/settings` is a resource; `projects/edit-project`
  is a remote procedure call wearing a URL. Where an action genuinely needs a page, name the page
  after the state it puts the reader in (`checkout`, `review`), not after the verb.
- **Organisational folders must not leak into the URL.** Grouping a set of routes for code reasons
  is what route groups are for — `(marketing)/about` serves `/about`. If a folder exists to organise
  files rather than to name a resource, it must not appear in the path.

```
projects/[projectId]/settings          the resource, then the sub-resource
(marketing)/pricing                    grouped for the file tree, serves /pricing

// Wrong: a verb as a segment, a bare [id], and camelCase that breaks on a case-sensitive host.
projects/editProject/[id]
```

---

## 7. Query-string state binds to a store on ONE edge at a time, with an echo breaker

When a value lives in the URL and also in a store — the case in §2 where a tab drives a panel — the
two must be reconciled, and the naive two-way binding oscillates: the URL writes the store, the
store's change writes the URL, that write re-reads as a URL change, and so on.

The house shape is one hook that owns the whole binding for that value, and inside it:

- **URL is the source of truth on entry.** On mount and on external URL change, the URL writes the
  store.
- **Store writes the URL with `replace`, not `push`.** A filter change is not a navigation the back
  button should have to walk through one step at a time.
- **An echo-breaking ref** records the value this hook just wrote, so the resulting URL change is
  recognised as its own echo and does not write back into the store.

```ts
// One hook owns the binding. Nothing else writes `tab` to the URL or to the store.
export const useProjectTabUrlSync = () => {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const tab = useProjectTabStore((state) => state.tab)
    const setTab = useProjectTabStore((state) => state.setTab)
    const writtenByUs = useRef<ProjectTab | null>(null)

    // URL -> store, ignoring the echo of our own write.
    useEffect(() => {
        const fromUrl = (searchParams.get("tab") ?? "overview") as ProjectTab
        if (writtenByUs.current === fromUrl) { writtenByUs.current = null; return }
        if (fromUrl !== tab) setTab(fromUrl)
    }, [searchParams, tab, setTab])

    // store -> URL, replace so the back button leaves the page rather than rewinding tabs.
    useEffect(() => {
        if ((searchParams.get("tab") ?? "overview") === tab) return
        writtenByUs.current = tab
        const params = new URLSearchParams(searchParams)
        params.set("tab", tab)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, [tab, router, pathname, searchParams])
}
```

```ts
// Wrong: both edges written inline in a component, with push. The history fills with tab
// changes, and on a slow render the two effects fight each other.
onClick={() => { setTab(next); router.push(`?tab=${next}`) }}
```

This is a `useEffect` doing what react.dev says effects are for — synchronising with an external
system. The URL is that external system. Deriving `tab` from the URL during render needs no effect
at all, and where you can get away with that, do: the store only earns its place when something far
from this component also needs to read or set the value.

---

## 8. Middleware redirects and negotiates — it does not authorize

The edge layer that runs before a route is the right place for cheap, global, request-shaping
decisions: locale negotiation, canonical redirects, a bounce away from a page a signed-out reader
has no business rendering.

It is the wrong place for the authorization decision itself. Anything middleware can read cheaply —
a non-HttpOnly cookie, a hint header — is something the client can also write. A hint that the
reader is probably signed in is a *display* signal that saves a flash of the wrong shell; it is not
a permission. The real check is made on the server, per object, on every request that touches data
(OWASP API Security Top 10: Broken Object Level Authorization). RFC 9700 and OIDC put the same
constraint on the token: possession is verified where the resource lives, not at the edge that
routed the request.

```ts
// middleware.ts — negotiate and redirect only.
export const middleware = (request: NextRequest) => {
    const locale = negotiateLocale(request)            // cheap, global, no data access
    if (!hasLocalePrefix(request.nextUrl.pathname)) {
        return NextResponse.redirect(withLocale(request.nextUrl, locale))
    }

    // A display-only hint: skips the signed-out shell flash. It is NOT authorization —
    // every data read behind this route is authorized again on the server.
    const hint = request.cookies.get("session_hint")?.value
    if (!hint && isPrivateArea(request.nextUrl.pathname)) {
        return NextResponse.redirect(signInUrl(request.nextUrl))
    }
    return NextResponse.next()
}
```

```ts
// Wrong: a role decision taken at the edge from a client-writable cookie. Editing one cookie
// value in devtools now renders an admin surface, and whatever it fetches was never re-checked.
if (request.cookies.get("role")?.value === "admin") return NextResponse.next()
return NextResponse.redirect(homeUrl(request.nextUrl))
```

Keep the matcher narrow. Middleware runs on every matched request, so a broad matcher puts a
synchronous cost in front of static assets and every navigation for the sake of a check that
applies to a handful of routes.
