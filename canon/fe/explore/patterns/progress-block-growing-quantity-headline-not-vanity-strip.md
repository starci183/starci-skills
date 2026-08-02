# A progress block leads with one growing quantity as a meter, not a strip of vanity numbers — STRICT

> The companion to the default-target rule: that one is about a meter with a target; this one is
> about what a progress block leads with at all.

## Lead with the quantity that grows

A surface's progress block leads with **one meaningful, growing quantity** — the answer to "how far
along am I" — rendered as a single meter. Not a row of N loose numbers.

The question to ask is *what does the learner actually want to know about their progress?* It is the
quantity moving toward a goal — for spaced repetition, **cards mastered out of total cards** — not
three peer metrics that tell no story between them. A strip of N numbers is a dashboard for the sake
of having a dashboard: no hierarchy, and small numbers set large look cheap. A new user reading
`1 · 100% · 1` is the case that makes it obvious.

## One primary signal; everything else drops to secondary

Headline plus meter carries the signal. The rest becomes a chip or a caption, never the same size as
the headline. For flashcards: mastery is the headline with the maturity bar, streak is a small
momentum chip, retention is a muted caption.

## Gate a number that only means something with a large enough sample

`retention 100%` derived from exactly one review means nothing. Hide the caption while the sample is
too small and put a nudge in its place — "review your first card". Publishing a misleading number is
worse than publishing none.

## Design only for data that already exists

The headline quantity is assembled from fields already on hand, sharing the SWR key with a sibling
so no extra fetch is added. A forecast, a heatmap, a maturity histogram with no query behind it does
not get drawn.

## Empty and loading keep the frame

Empty applies only when the surface is genuinely empty (`total = 0`). A new user who has mastered
nothing still gets the meter at 0% with a nudge — the same way an empty heatmap is still rendered as
a grid. It is never hidden silently. The skeleton mirrors the meter.

## The remainder slice takes the track tone

The "not yet reached" slice of a meter is `--default`, the pale track tone, **not** `--muted`, which
is a darker grey. Untouched space stays pale; only the part already achieved carries a strong
semantic colour (success, warning). A dark remainder slice reads as "there is a lot of data here".

## The general form

Before rendering progress, ask: **which quantity grows toward this surface's goal?** That one is the
headline and the meter. Every other number is context — a chip, a caption — not a peer. N numbers
side by side is vanity; one meaningful meter with secondary detail is progress.

Use the blocks that exist: `SegmentBar` in max-mode is a meter with maturity plus legend,
`ProgressMeter` is a single bar, and a `Chip` on a `bg-token/10` is momentum. Do not hand-build a
stat strip.

## Related

`meter-tracks-out-of-box-default-target.md` — a meter with a target runs on a default and always
moves · `labeled-section-render-empty-not-self-hide.md` — empty renders meaningfully rather than
disappearing.
