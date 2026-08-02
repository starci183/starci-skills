# A progress block leads with one growing quantity as a meter, not a strip of vanity numbers — STRICT

> The distinction between vanity metrics and actionable ones is standard product literature: a number
> that only ever goes up and changes no decision is decoration. Refactoring UI supplies the visual
> half — hierarchy is created by de-emphasising the secondary, not by enlarging everything that
> matters.

## Lead with the quantity that grows

A progress block leads with **one meaningful, growing quantity** — the answer to "how far along am
I" — rendered as a single meter. Not a row of loose peer numbers.

The question to ask is *what does the reader actually want to know about their progress?* It is the
quantity moving toward a goal: items completed out of items that exist, files synced out of files
found, sections signed off out of sections required. Three peer metrics tell no story between them.
A strip of numbers is a dashboard for the sake of having a dashboard: no hierarchy, and small numbers
set large look cheap. A new account reading `1 · 100% · 1` is the case that makes it obvious.

## One primary signal; everything else drops to secondary

The headline and its meter carry the signal. Everything else becomes a chip or a caption, never the
same size as the headline. In a task tracker: completion is the headline with the bar, the current
run of active days is a small momentum chip, and the average turnaround is a muted caption.

## Gate a number that only means something with a large enough sample

A success rate of one hundred percent derived from exactly one attempt means nothing, and publishing
it teaches the reader that the number is noise. Hide the caption while the sample is too small and
put a prompt in its place — "complete a few more to see your rate". Publishing a misleading number is
worse than publishing none.

## Design only for data that already exists

The headline quantity is assembled from fields already on hand, sharing a cache key with a sibling
region so no extra request is added for a decoration. A forecast, a heat map or a distribution chart
with no query behind it does not get drawn, however good it looks in the mock-up. Designing the
number first and sourcing it later is how a block ships with a hard-coded placeholder.

## Empty and loading keep the frame

Empty applies only when the surface is genuinely empty — the total is zero. An account that has
completed nothing yet still gets the meter at zero with a prompt beside it, exactly as an empty heat
map is still rendered as a grid. The frame is the thing that says what will be here. The skeleton
mirrors the meter rather than being a generic bar.

## The remainder slice takes the track tone

The not-yet-reached part of a meter takes the pale track token, not the muted token, which is a
darker grey. Untouched space stays pale, and only the part already achieved carries a strong semantic
colour. A dark remainder slice reads as "there is a lot of data here" and inverts the meaning of the
whole bar.

## The general form

Before rendering progress, ask: **which quantity grows toward this surface's goal?** That one is the
headline and the meter. Every other number is context — a chip, a caption — never a peer. Numbers
side by side are vanity; one meaningful meter with secondary detail is progress.

Use the meter and chip components that already exist rather than hand-building a statistics strip out
of text and dividers, which is how a set of surfaces ends up with four different progress dialects.

## Related

`meter-tracks-out-of-box-default-target.md` — a meter with a target runs on a default and always
moves · `labeled-section-render-empty-not-self-hide.md` — empty renders meaningfully rather than
disappearing.
