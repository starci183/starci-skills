# Front end — foundations

The closed scales. Every file here answers the same kind of question: **which value, out of a set that
is deliberately small, does this element get?** A gap, a radius, a shadow tier, a breakpoint, a
z-index step. The reason they are closed is the whole point — a reader who knows the scale can predict
any component in the app without opening it, and one arbitrary value spends that knowledge everywhere
to buy a slightly better fit in one place.

Where a number here also exists in `canon/fe/explore/registry.mjs`, the registry is authoritative and this
prose is the side that goes stale. What prose owns is the reason a value was chosen, which no registry
can hold.

| File | Decides |
|---|---|
| [`breakpoints.md`](breakpoints.md) | that the five Tailwind v4 defaults are the whole scale, and that an arbitrary stop like `min-[900px]` is not opened when one of the five will do |
| [`color.md`](color.md) | that every colour is a semantic token — background, surface and field families, foreground and muted, separator and default border — with no hex and no raw palette class |
| [`elevation.md`](elevation.md) | the three shadow tiers chosen by role rather than by weight: surface at rest, field at rest, and overlay for anything floating |
| [`gap.md`](gap.md) | the one spacing scale covering gap and padding alike — `0 · 2 · 3 · 6 · 8` — and which relationship between two things earns each step |
| [`motion.md`](motion.md) | that `transition-colors` is the default, what the real durations are when read back out of usage, and the two guards mandatory for any decorative animation |
| [`radius.md`](radius.md) | that one root token generates the scale and every step is a multiple of it, so a corner is never a hand-picked value |
| [`scrollbar-gutter.md`](scrollbar-gutter.md) | the two declarations that stop the vertical scrollbar flickering in and out and sliding centred content sideways when it does |
| [`sticky.md`](sticky.md) | that a sticky element pins at its own resting position rather than flush to the navbar, and the offset that makes it look like it simply stopped |
| [`typography.md`](typography.md) | that type is selected through the `Typography` component's `type=` scale, not through loose `text-*` classes that put a size in the tree no other component shares |
| [`wide-content-scrolls-not-blocks-ui.md`](wide-content-scrolls-not-blocks-ui.md) | that a block wider than its column scrolls on its own axis, and the `min-w-0` on the flex chain that lets the column shrink instead of overflowing the page |
| [`z-index.md`](z-index.md) | the seven-step layering scale with a role written beside each step, and that a new layer anchors to the nearest existing step rather than climbing to an arbitrary number |

## Reading order

There is none. Open the scale the change touches. If a value you need is not on a scale, that is the
signal to argue the scale in a review — not to add a sixth step in a component file and leave the
next reader to discover it.
