# Z-index

Layering is a scale like any other, and the reason to publish it is that a stacking order nobody
wrote down becomes a race between authors, each raising a number until their layer wins. Bootstrap
publishes its map — dropdown 1000, sticky 1020, fixed 1030, modal backdrop 1040, modal 1050, popover
1070, tooltip 1080 — and the numbers themselves matter far less than the fact that they are listed
in one place with a role beside each one.

## 1. A scale of seven steps, low to high

- **10** — chrome floating LOCALLY inside one component: a small popover attached to a control, an
  overlay button on an image. The negative step, `-10`, is for decoration sitting behind content.
- **20** — a control floating above a region that is itself already sticky: a rail's resize handle,
  a video's controls overlay.
- **30** — a sticky sub-header, or an in-page overlay on mobile: a filter bar pinned below the main
  header, a search-results dropdown.
- **40** — chrome floating at PAGE level: a floating action button, a sticky bottom bar, a mobile
  tab bar, a connection-status pill.
- **50** — the main navigation header. This step is the marker for "top of the application chrome in
  the ordinary page flow", and it is the one every other number is read against.
- **60** — the navigation progress bar, which must sit above the header because it reports on the
  navigation the header initiated.
- **70** — a cold-load splash, and any secondary overlay that has to clear all chrome. This is the
  ceiling.

Write the anchors down beside the scale — which real element occupies each step — because a step
with no occupant is a step nobody can calibrate against.

## 2. Every new layer anchors to the nearest existing step

No inventing a value in between, and no jumping to 100 to be safe. A scale only tells the reader
what a layer MEANS while its steps stay countable; one number nobody can place turns the whole thing
back into guesswork, and the next author will jump to 200.

When two overlays fight, fix the ARCHITECTURE before raising a number.

## 3. The unlayered gotcha: the number does not decide the fight

Component libraries bake a z-index into their modal and drawer backdrops. That baked rule sits in
the SAME stacking context as a value added through a class, so the winner is decided by SOURCE ORDER
in the bundle rather than by the number — a hand-added 70 can still lose if the library's stylesheet
loads after it.

There is a second mechanism underneath, and it is the one that actually matters: z-index only
compares siblings within a stacking context. A parent with a transform, a filter, an opacity below
1, or a `will-change` creates a new stacking context, and every descendant is trapped inside it no
matter what number it carries. A child at 9999 inside a transformed ancestor still renders beneath
that ancestor's sibling at 1.

So an overlay opened from inside another floating panel is not a fight you can win by counting.
Render it in place, inside the panel, rather than as a document-level dialog — or move it out of the
trapped subtree entirely with a portal. Both are architecture; raising the number is not.

## Related

[[when-drawer]].
