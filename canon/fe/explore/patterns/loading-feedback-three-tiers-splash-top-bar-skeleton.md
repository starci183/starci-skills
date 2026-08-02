# Three separate tiers of loading feedback: entry splash, top bar, region skeleton — STRICT

> Nielsen's response-time limits set the tiers. Under about one second the reader keeps their train
> of thought and needs no indicator at all; past a second they need to know the system heard them;
> past ten they need to know it is still working. Three different waits, three different affordances,
> and mixing them is what makes an app feel noisy while still feeling slow.

## The three tiers, kept apart

1. **Cold load, arriving at the product — a full-screen splash.** The mark and an accent bar, fading
   out once the app is ready.
2. **Client-side navigation, on every route change — a top bar.** A three-pixel accent bar along the
   top edge, trickling forward, then snapping to full width and fading.
3. **A region fetching inside a page — a skeleton** that mirrors the shape of what is coming.

One affordance per tier. The splash and the top bar **share the same accent bar** so the two read as
one system rather than two loading screens the product happens to own.

## The top bar is hand-rolled, and that is cheaper than it sounds

Some client routers deliberately expose no global navigation events, so there is no start and finish
to subscribe to. What they do expose is enough:

- **Start** — patch the history push, because a router that updates the URL optimistically does it at
  the *start* of a navigation, and listen for the back and forward event. Do not patch history
  replace: a replace is usually a shallow query-parameter change, and that should not raise a bar.
- **Finish** — react to the new route committing; the committed path is what changes.
- **Indeterminate trickle** — creep toward ninety percent, then snap to full. The progress is not
  knowable, and pretending otherwise produces a bar that sits at forty percent and lies.
- **Anti-flash** — wait about 120ms before painting the bar at all, so a prefetched navigation that
  resolves faster than the reader can perceive never shows one. This is the sub-0.1s limit doing its
  job: an indicator for an instant transition is pure noise.
- **Safety timeout** — about ten seconds, after which the bar completes itself, so a same-page link
  that never commits does not leave a bar stuck near the end forever.
- **Reduced motion** — no trickle; show and hide statically, per the reduced-motion preference.

A per-link pending state is not this. It reports one link's status and suits an inline hint, not a
global bar.

Z-order runs navigation bar below top bar below splash overlay, and the top bar is fixed to the top
edge with its width driven from script.

## The entry splash is a self-managed overlay inside the providers — STRICT

"A loading screen when you arrive" means an overlay on entry. It does not mean a suspense boundary
wrapped around the application root, and the difference is not stylistic:

1. **Theme.** A suspense fallback renders while its subtree suspends, and that subtree contains the
   theme provider — so the fallback sits *outside* the theme and picks up the root tokens even when
   the reader is in dark mode, flashing the wrong background. An overlay mounted inside the providers
   inherits the theme class and paints the right colour immediately.
2. **Scope.** Wrapping the children in a fallback splashes on every navigation that suspends, which
   is the top bar's job. One event, one affordance.
3. **Reliability.** Server-rendered HTML usually arrives resolved, so a suspense fallback often never
   stays up long enough to be seen at all. A self-managed overlay — visible by default so the server
   paints it into the HTML, then fading after mount once a minimum visible time of roughly half a
   second has passed — is actually seen on a cold load.

The pattern: a fixed full-screen layer at the top of the stack, on the background token, visible by
default so it appears before any script runs; an effect after mount marks it leaving once the minimum
has elapsed, fades the opacity, then unmounts. Under reduced motion it is static.

The general lesson is worth more than the implementation: when an instruction names a mechanism but
the mechanism carries pitfalls of theme and scope, build the thing that achieves the **intent** — an
entry overlay that is themed, server-painted, and does not touch navigation — and write down why.

## Related

`loading-state-carries-no-artificial-hold.md` — tier three, the region skeleton, and why it is never
held open.
