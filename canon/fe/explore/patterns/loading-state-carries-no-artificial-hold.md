# A loading state carries no artificial hold, and no debug switch that can ship — STRICT

> Grounded in Nielsen's three response-time limits: under 0.1s feels instant, up to 1s keeps the
> flow of thought, and beyond about 10s the user leaves. Every millisecond a loading state is held
> past the arrival of its data is spent against those limits for nothing.

## The async wrapper has one priority chain and nothing else

The component that stands between a request and a region resolves in a fixed order:

```
error -> loading -> empty -> content
```

No hold timer, no minimum display duration, no `debug` flag that freezes the skeleton so a developer
can look at it. The reason is the shape of the affordance rather than the length of any particular
hold. A developer aid that is **on by default and easy to leave behind** will be left behind: it
gets passed at a handful of call sites during a design pass, the pass ends, the prop stays, and every
one of those regions now shows a skeleton for seconds after its data has already arrived. Defaulting
such a flag to off leaves the same trap for whoever passes it deliberately. Deleting the mechanism
deletes the class of bug.

This is worth stating as a rule because no linter and no type checker catches it: a held skeleton is
type-valid, lint-clean and renders fine. Only a user notices.

## Inspecting a loading state without one

Throttle the network in the browser's developer tools, or drop a temporary delay into the fetcher
and take it out again. Both are local to the person looking, which is exactly the property the prop
did not have.

## A skeleton belongs to a region that will have content, or that shows an empty state

A card that hides itself when it has nothing — no empty state, rendering nothing at all — may still
carry a skeleton, because with no hold the flash lasts exactly as long as the real request and no
longer. If the region is normally empty for most accounts and the flicker is still visible, drop the
skeleton so the region appears only once there is data. Do not reach for a timer to steady it; a
timer trades a visible flicker for an invisible delay that every user pays.

## The loading flag passed in is an already-resolved condition

Caches that follow stale-while-revalidate report a first-load flag that is true only when there is
nothing cached, but they also revalidate on window focus and after a mutation. Pass the raw flag and
a skeleton drops over content the reader is currently looking at. Pass a formula instead, so the
skeleton is reserved for the case where there is genuinely nothing to show:

```tsx
isLoading={isLoading && !data}
isLoading={isLoading && items.length === 0}
```

Visibility of system status, the first of Nielsen's heuristics, asks for feedback about what the
system is doing. It does not ask for the screen the reader is reading to be replaced by grey boxes
because a background refresh started.

## Related

`labeled-section-render-empty-not-self-hide.md` — an empty labelled section renders an empty state
rather than hiding itself.
