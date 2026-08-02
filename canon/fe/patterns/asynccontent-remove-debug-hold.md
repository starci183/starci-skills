# AsyncContent has no `debug` prop and no three-second hold — STRICT

> Read from the dashboard and profile skeletons that "stuttered". `AsyncContent` carried a `debug`
> prop that held the skeleton for 3000ms (`DEBUG_HOLD_MS`, gated on `publicEnv().debug`, which is ON
> in dev), and `debug={true}` had been left behind at roughly 18 call sites — so every one of those
> regions held its skeleton for three seconds in front of real users.

## The prop is gone, not defaulted off

`debug`, `held`, the timer, `DEBUG_HOLD_MS` and `holdEnabled` are removed. What is left is the
priority chain and nothing else:

```
error → loading → empty → content
```

The reason is the shape of the affordance rather than the length of the hold. A developer aid that
is **on by default and easy to leave behind** will be left behind, and each site that keeps it costs
a real user three seconds of skeleton on a region whose data had already arrived. Turning the
default off would have left the same footgun for whoever passed the prop deliberately; removing the
source removes the class of bug.

## Inspecting a loading state without it

Throttle the network in DevTools, or drop a temporary `await sleep` into the fetcher. This
supersedes the step in the `starci-fe-skeleton-apply` skill that read "set `debug={true}`, watch the
3s hold, remove it" — there is no prop to set.

## A skeleton belongs to a region that will have content, or that shows an empty state

A card that hides itself — `isEmpty` with no `emptyContent`, rendering `null` — may still carry a
skeleton now that the hold is gone, because the flash lasts exactly as long as the real fetch and no
longer. If an account is normally empty and the flicker is still visible, drop the skeleton so the
region appears only once there is data. Do not reach for a timer to hold it steady.

## `isLoading` passed in is an already-resolved condition

SWR reports `isLoading` true only on the first load with nothing cached, but the value handed to
`AsyncContent` is a formula, not the raw flag, so a revalidation on focus or after `mutate` never
brings the skeleton back over content the reader is looking at:

```tsx
isLoading={isLoading && !data}
isLoading={isLoading && items.length === 0}
```

## Related

`labeled-section-render-empty-not-self-hide.md` — an empty labelled section renders an empty state
rather than hiding itself.
