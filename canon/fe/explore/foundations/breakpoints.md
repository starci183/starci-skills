# Breakpoints

The app runs on Tailwind v4's default breakpoints, unmodified. There is no `tailwind.config.*` in
the repo, and `globals.css` / `@theme` declares no `--breakpoint-*` of its own, so the five stops in
`node_modules/tailwindcss/theme.css` are the whole scale.

## 1. Five stops, and no sixth

`sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, `2xl` 1536px.

Do not open an arbitrary breakpoint — `min-[900px]` and its family — when one of the five will do.
The value of a shared scale is that a reader of any component already knows where it changes; a
one-off stop buys a slightly better fit for one block and costs that knowledge everywhere else.

## 2. `sm` is the mobile/desktop line, not `md`

The rules in this set that hide or swap something for small screens hang off `sm`: tab labels
appear and disappear there ([[tabs]] §2), the input variant follows the background there, and the
various "hidden on mobile" cases resolve there. Reach for `md` only when a rule genuinely needs the
768px stop, which is rare.

## 3. `lg` is where a rail or a two-pane opens

A rail is always `hidden lg:flex` ([[when-rail]], [[sidebar]]). Below `lg` it folds into a
horizontally scrolling chip row, or disappears entirely. There is no intermediate "at `md` the rail
narrows" step, and adding one would put a layout in the tree that no other page has.

The `md` band is therefore "not yet `lg`, no longer as cramped as mobile" — real, but it anchors
almost no primary layout decision.

## 4. The JS mirror is `useSmViewpoint()`

`src/hooks/reuseables/useSmViewpoint.ts` exposes `isMobile` (`max-width: 640px`), `isTablet`
(`max-width: 768px`) and `isDesktop` (`min-width: 1024px`).

Use it only when JS logic must actually branch on viewport — a different component rendered, a
different handler bound. A difference that is purely visual belongs in a `sm:` or `lg:` class, where
it costs no render and no hydration mismatch.

## Related

[[when-rail]] · [[sidebar]] · [[tabs]] §2 · [[wide-content-scrolls-not-blocks-ui]].
