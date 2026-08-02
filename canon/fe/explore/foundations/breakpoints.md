# Breakpoints

A responsive interface changes shape at a small, fixed set of widths, and every component in the
product uses the same set. The numbers matter far less than the fact that they are shared: a reader
opening any component already knows the only widths at which it can change.

## 1. Five stops, and no sixth

Almost every mainstream scale lands on five, and they land close to each other — the common utility
framework default is 640, 768, 1024, 1280 and 1536 pixels; Material 3's window size classes cut at
600, 840, 1200 and 1600. Pick one set, publish it, and treat it as closed.

Do not open an arbitrary stop — `min-[900px]` and its family — when one of the five will do. A
one-off stop buys a slightly better fit for one block and spends, everywhere else, the reader's
ability to predict a component without opening it. If a component genuinely cannot live on the
scale, that is an argument to make about the scale in review, not a value to bury in one file.

## 2. The first stop is the mobile/desktop line

Everything that appears, disappears or swaps between phone and laptop should hang off one stop, and
in practice that is the lowest one. Tab strips drop their labels there, a field's variant follows
its background there, the various "hidden on mobile" cases resolve there.

Reach for the second stop only when a rule genuinely needs it. A layout with decisions scattered
across three stops has no legible break; it has three, and no reader can hold all of them.

## 3. The third stop is where a rail or a two-pane opens

Material's window size classes make the same call: a navigation rail belongs to the expanded class,
not to the medium one. Below that width a rail folds into a horizontally scrolling row of chips, or
disappears into a drawer.

Resist an intermediate "and at the middle stop the rail narrows" step. It puts a layout in the tree
that no other surface has, and it is the arrangement nobody remembers to update. The middle band is
real — no longer as cramped as a phone, not yet a desktop — but it should anchor almost no primary
layout decision.

## 4. A JavaScript mirror is a last resort

A `matchMedia` hook that exposes the same stops to JavaScript is worth having, and worth using
rarely: only when logic must actually branch — a different component mounted, a different handler
bound, a virtualised list given a different row count.

A difference that is purely visual belongs in a media query, where it costs no render, no
measurement, and no hydration mismatch on a server-rendered page. The mirror is also the thing that
drifts: two definitions of "mobile", one in CSS and one in JavaScript, will disagree the first time
someone edits only one of them.

## Related

[[sidebar]] · [[tabs]] · [[wide-content-scrolls-not-blocks-ui]].
