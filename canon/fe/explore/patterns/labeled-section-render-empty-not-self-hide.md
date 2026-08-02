# A labelled section on a page the user opened deliberately renders an empty state, never hides — STRICT

> Nielsen's first heuristic, visibility of system status: the system keeps the user informed about
> what is going on. A section that removes itself when it has no data reports nothing at all, and the
> reader cannot tell an empty account from a broken page. Refactoring UI makes the constructive half
> of the same point — an empty state is a designed screen, not the absence of one.

## The rule

A block carrying a **label** — a titled card, or a section with a heading — on a page or tab the
reader chose to open must render an empty state when it has no data: an icon, a title, and a hint
saying what would put something here. It must not return nothing.

Hiding a labelled section leaves the reader on a page that looks broken. They opened the Activity
tab; the tab is blank, with not even an explanation of what activity would be. Self-hiding is right
only for a **secondary, unlabelled widget** — one prompt card among several on a dashboard — never
for the main section of a tab the reader navigated to on purpose.

## The trap that produces this

The usual case is not a missing empty state. It is an empty state that is wired correctly and never
reached, because an early return sits above it:

```tsx
// Wrong: this fires before the async wrapper renders, so the empty state never runs.
if (empty) return null
```

Delete the early return. Nothing else needs to change, which is why this one survives review: the
empty-state props are right there in the file, and a reader skimming for them finds them.

## Empty states are consistent across sibling tabs

A title plus a **description hint** — "Nothing here yet. Anything you publish shows up on this tab."
— matching every sibling tab. One tab carrying a hint while the next shows a bare title reads as an
unfinished screen, and consistency between siblings is cheaper to hold than to retrofit.

## Related

`loading-state-carries-no-artificial-hold.md` — the priority chain the empty branch sits in ·
`every-surface-offers-a-path-onward.md` — an empty region is also a route onward.
