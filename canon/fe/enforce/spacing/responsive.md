# responsive — naming the width where a shape changes

`Responsive<T>` is how any value on any scale in this folder may vary with width. One generic, not one
type per prop: `ResponsiveGap`, `ResponsivePadding` and `ResponsiveColumns` would be three copies of
the same idea and three places for the breakpoint set to drift.

```ts
/**
 * A value, or that value per container width.
 *
 * `base` is required in the object form. A responsive value with no floor depends on which
 * breakpoint happens to match first, and that is not a decision anybody made.
 */
export type Responsive<T> = T | { base: T; sm?: T; md?: T; lg?: T; xl?: T }
```

## The breakpoints are container queries, not viewport

Four steps, resolving to `@app-sm:` … `@app-xl:` — **container** queries against a named container,
not media queries against the viewport:

| step | rem | px | reads as |
|---|---|---|---|
| `sm` | 40 | 640 | the container is past its narrow form |
| `md` | 48 | 768 | the container can hold two things side by side |
| `lg` | 64 | 1024 | the container is a page column |
| `xl` | 80 | 1280 | the container is the whole workspace |

That distinction is the whole reason this file can exist. A component does not know how wide the
screen is, and it should not: the same card sits in a full-width page, in a two-column split, and in a
narrow drawer, and its shape depends on **the box it was given**, never on the device. A viewport
breakpoint would make the card in the drawer behave as if it had the whole screen — the exact bug that
sends someone reaching for a `className` override, after which the shape lives at the call site
forever.

## Why the value carries the breakpoint instead of a class

FRAME-10 says a frame that changes shape names the width where it changes, **as a prop, never buried
in a class string**. Two ways that rule breaks, and the second is worse:

```tsx
wrap                                    // a boolean threshold: says THAT it changes, refuses to say WHERE
className="@app-xl:flex-row"            // a real threshold, absent from the prop list and from every review
gap={{ base: 3, md: 4, xl: 6 }}         // the contract, readable from the props
```

A boolean fires wherever the content happens to overflow — which depends on the string, the
translation, the font — so the same frame breaks at a different width on every screen and none of them
is a width anybody designed. A threshold inside `cn(...)` is worse because it looks solved: the frame
does change at a real, deliberate width, but that width is absent from the type, so two frames doing
the same job drift to different breakpoints and nothing shows it.

## Reading the object form

```tsx
gap={{ base: 3, md: 4, xl: 6 }}
```

reads as: *tight while I am narrow, one step looser once I can hold two things, wider still when I am
the whole workspace.* Each key is a **floor** — a value applies from that width upward until the next
key overrides it. Omitting a key means "keep what the previous one said", never "reset". `base` is not
`sm`: it is the value with no query attached, what a container gets before any breakpoint matches,
including containers narrower than `sm`.

## The stack-to-row switch has a name

A row that becomes a full-width column below a named width is the commonest responsive shape — the
`stack-below` pattern, carried by a `ResponsiveRow` / `ResponsiveCluster` frame. That is the answer to
every `wrap` boolean: a two-element reflow that matters is part of the contract, so it names its width;
one that does not matter should not have been a breakpoint at all.

## What this forbids

- **A breakpoint outside the four.** No `2xl`, no arbitrary `@app-[733px]`. A fifth step is a fifth step for the whole system, added here, and the compiler then requires every `Record<Breakpoint, …>` to cover it.
- **A viewport media query in a component.** `md:flex-row` (viewport-scoped) inside any tier is a component asking about the screen. Only the app shell that establishes the container may.
- **A boolean that stands in for a width** — `wrap`, `stackOnMobile`, `isCompact`. "Mobile" is not a width.

---

Siblings: [`gap.md`](gap.md) · [`padding.md`](padding.md) · [`margin.md`](margin.md) ·
[`position.md`](position.md)
Rules: [`../elements/frame.md`](../elements/frame.md) FRAME-10
