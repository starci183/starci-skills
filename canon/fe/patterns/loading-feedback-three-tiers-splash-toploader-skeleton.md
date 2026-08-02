# Three separate tiers of loading feedback: entry splash, top bar, region skeleton — STRICT

> App Router with React 19. Settled 2026-06-27 from the request for *"a suspense page, so that every
> time a page loads there is a bar sliding across the top"*. The top bar is hand-rolled with no new
> dependency, and the splash is a self-dismissing overlay rather than a raw `<Suspense fallback>`.

## The three tiers, kept apart

1. **Cold load, arriving at the site — a full-screen splash** (`AppSplash`): the logo and an accent
   bar, fading out once the app is ready.
2. **SPA navigation, on every nav — a top bar** (`TopLoader`): a 3px accent bar along the top edge,
   trickling forward, then snapping to 100% and fading.
3. **A region fetching inside a page — an `AsyncContent` skeleton**, which stays as it is.

One affordance per tier, and the splash and the top bar **share the same 3px accent bar** so the two
read as one system.

## The top bar is hand-rolled — no `nextjs-toploader`, no `@bprogress`

App Router has no global router events, deliberately. What it does expose is enough:

- **Start** — patch `history.pushState` (App Router pushes the URL optimistically at the *start* of
  a navigation, so this fires early) and listen for `popstate`. Do **not** patch `replaceState`:
  `router.replace` is mostly a shallow `?param=` change, and that should not raise a bar.
- **Done** — `useEffect(complete, [pathname, searchParams])`; the new segment committing is what
  changes `pathname`.
- **Indeterminate trickle** — creep to about 90%, then snap to 100%, nprogress-style.
- **Anti-flash** — wait about 120ms before painting the bar at all, so a prefetched navigation that
  resolves faster than that never shows one. Plus a **safety timeout** of about 10s, so a same-page
  link completes itself instead of leaving the bar stuck at 90%.
- **Reduced motion** — no trickle; show and hide statically.

`useLinkStatus` is not a global bar. It reports the `pending` state of a single `<Link>`, which
suits an inline hint and not the sliding bar.

Z-order: navbar `z-50` below top bar `z-[60]` below splash overlay `z-[70]`. The bar is
`fixed inset-x-0 top-0 h-[3px] bg-accent` with its width driven from JS.

## The entry splash is a self-dismissing overlay inside the providers — STRICT

"A suspense page when you arrive at the site" means a loading screen on entry; it does not mean a
literal React `<Suspense>`. The correct implementation is a **client-managed overlay mounted inside
the provider tree**, not a `<Suspense fallback>` boundary at the root. Three reasons:

1. **Theme.** A `<Suspense fallback>` renders while its subtree suspends, and that subtree includes
   the theme provider — so the fallback sits *outside* the theme and picks up the `:root` (light)
   tokens even when the app is dark, flashing the wrong colour. An overlay inside the providers has
   the `.dark` class and paints the right background immediately.
2. **It must not splash every navigation.** Wrapping `{children}` in
   `<Suspense fallback={splash}>` splashes on every navigation that suspends, which is the top bar's
   job.
3. **Reliability.** SSR-streamed HTML usually arrives resolved, so a `<Suspense fallback>` rarely
   stays up long enough to be seen. A self-managed overlay — visible by default, so SSR paints it
   into the HTML, then fading after mount with a minimum visible time of about 550ms — guarantees the
   splash is actually seen on a cold load.

The pattern: `fixed inset-0 z-[70] bg-background`, visible by default so it appears before JS runs
at all; a `useEffect` after mount sets `leaving` once `MIN_VISIBLE` has passed, fades the opacity,
then goes to `gone` and returns `null`. Under reduced motion it is static.

The general lesson: when a technical instruction carries pitfalls of theme and timing, build the
thing that achieves the **intent** — an entry overlay that is themed, SSR-painted, and does not
touch navigation — and write down why, rather than attaching a fallback to a Suspense boundary that
gets both the theme and the scope wrong.

## Where it lives

`blocks/layout/TopLoader` and `blocks/layout/AppSplash`, both client components, mounted inside
`SwrProvider` after `<UseEffects/>` and before `<Navbar/>`. The keyframe (`appSplashTrickle`) is in
`globals.css` with a reduced-motion guard. The `history.pushState` patch also catches `router.push`,
since App Router pushes the URL at the start of a navigation; if a CTA calling `router.push` ever
fails to raise the bar, the options are intercepting the anchor click or wrapping the router. A
per-route `loading.tsx` skeleton on a heavy route is optional and belongs to
`starci-fe-skeleton-apply`.

## Related

`asynccontent-remove-debug-hold.md` — tier three, the region skeleton.
