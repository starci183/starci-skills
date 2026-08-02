# A progress meter runs out of the box, on a default target — STRICT

> The endowed progress effect, from Nunes and Drèze's loyalty-card work: people given a goal that is
> already visibly under way persist toward it far more than people handed an identical goal starting
> at zero. The goal-gradient effect is the second half — effort rises as the target gets closer. Both
> require a target to exist. A meter with no target has neither.

## The rule

A meter measuring **progress toward a goal** — a weekly target, a quota, a usage allowance — must not
sit empty because the user has never configured a target. Give it a sensible **default** so that any
activity moves the bar from the first session, and let the user override it afterwards.

A meter waiting on configuration reads as broken rather than as unconfigured, because the reader's
question is not "have I set a target" but "I did the work, why did nothing move?" The failure looks
identical to a bug, which is why nobody reports it as a design problem.

## Three parts, one effective target

`current` is real activity and rises as the feature is used. `target` is the user's custom value or
the default. `percent` is one divided by the other. Derive a single **effective target** —
`custom ?? default` — and feed the bar, the `current / target` label and any summary line from that
one value, so the three can never disagree. Two independent fallbacks in two components is how a bar
at sixty percent ends up next to the text "3 of 10".

## Where the default belongs

Server-side, because the editor then offers the same number the meter is already using. A front-end
default is an acceptable stopgap, but the editor will read blank until the user saves something, and
that gap should be recorded as debt rather than left to be rediscovered.

## Render the bar plainly

A track element and a fill element, the fill's width set as a percentage, on the neutral track token
and the accent token. It always renders. A compound component from a library can lose its styling
depending on the context it is dropped into, and a progress bar that silently renders at zero height
is the wrong place to discover that.

## Two kinds of meter, one shared obligation

This kind has a **target** and needs a number to aim at. The other kind measures a **quantity that
grows** toward a natural denominator — items completed out of items that exist — and needs no
configuration at all. Either way, no meter is left meaningless or blank. There is always a
denominator to fill against, and if there genuinely is not, the thing being drawn is not a meter.

## A worked example

A weekly activity block on a productivity dashboard ships with defaults for each of its rows —
sessions five, active days five, items cleared twenty — and the effective target feeds the bar, the
label and the week summary alike. On day one of a new account the bar moves the first time the user
does anything, which is the only day the movement matters.

Note the failure mode this example also caught: when a neighbouring visualisation in the same block
loses its colour, that is a token or theme bug in one component, not evidence that the block needs
redesigning. Fix the token.

## Related

`progress-block-growing-quantity-headline-not-vanity-strip.md` — the growing-quantity meter, and why
a strip of numbers is not progress.
