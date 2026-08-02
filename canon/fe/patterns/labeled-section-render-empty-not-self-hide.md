# A labelled section on a page the user opened deliberately renders an empty state, never hides — STRICT

> Read from a run of sections that "rendered blank": the Skills tab (`ProfileCoding`) and the
> Activity tab (`ProfileActivity`) were empty with no empty state — left dangling, self-hidden, or
> stuck on a skeleton.

## The rule

A block with a **label** — a `LabeledCard`, or a section with a heading — on a page or tab the user
chose to open must render the house empty state when it has no data: `AsyncContent` with `isEmpty`
and `emptyContent`, which builds an `EmptyContent` with an icon, a title and a hint. It must not
`return null`.

Hiding a labelled section leaves the reader on a page that looks broken. They opened the Activity
tab and the tab has nothing in it, not even an explanation. Self-hiding is right only for a
**secondary, unlabelled widget** — one dashboard nudge among several — not for the main section of a
tab.

## The trap that produced this

The component is wired correctly, `isEmpty` and `emptyContent` are both passed, and an early return
above them swallows it:

```tsx
// Wrong: this fires before AsyncContent is ever reached, so the empty state never runs.
if (empty) return null
```

Delete the early return; nothing else needs to change.

## Empty states are consistent across sibling tabs

Title plus a **description hint** — "Read a lesson or clear a challenge and your activity shows up
here" — matching the sibling tabs. One tab carrying a hint while the next shows a bare title reads
as an unfinished screen.

## Related

`asynccontent-remove-debug-hold.md` — the `AsyncContent` priority chain ·
`layout-must-funnel-to-courses-and-cover-full-data-state-matrix.md` — an empty region is a funnel
back into a course.
