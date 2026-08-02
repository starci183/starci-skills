# Every layout carries a route into a course, and covers the whole data-state matrix — STRICT

> Two rules settled together on 2026-07-05: *"the mindset is that it has to be a CTA into a course"*
> and *"enough layout — when it is empty, with one CV, with five CVs, one upload and one generate.
> Cover all test cases."*

## Rule 1 — every surface offers a way into a course, and an empty region is an invitation

**Every page carries at least one anchor leading to `/courses` or to the course in progress.**
Shipping a layout with no way into a course is wrong on its own terms: StarCi sells courses, and no
screen is allowed to be a dead end.

**An empty or data-less region is a funnel, not a shrug.** On any surface whose value is *built by
studying* — CV, job readiness, achievements, portfolio, skills — the empty state is an **invitation
card**: a headline naming what studying produces, a primary `[Go to the course →]`, and a secondary
in-place action where one exists. The emptiness is the pitch. This extends the labelled-section rule
with a second dimension: empty means course funnel.

**The voice is fair.** *Study to earn real evidence and real results*, never *buy to raise a
number*. The funnel leads to actual work inside the course — capstone, challenges, coding — not to
paying for a better score. The loop should be readable straight off the layout: value (a recruiter
sees it, something unlocks, the score moves) comes from achievement, and achievement comes from
studying.

**Keep one durable anchor beside the empty state.** A page-level line or panel — "N points short,
study to level up" — so that the states which *do* have data still show the way onward. On a page
that is not a profile at all (a dashboard, a marketing page), the course CTA is the hero CTA, a
course card, or a "keep studying" nudge.

## Rule 2 — the layout spec covers the state matrix, not the happy path

A surface holding a **list or collection** defines a layout for every countable state, at minimum:

| State | What the layout does |
|---|---|
| empty (0) | the course funnel from rule 1 |
| 1 | usually hides the selector — a one-of-N control is for two or more |
| N | selector visible; any aggregate value takes the best or the max, never a sum over the count |
| overflow (past the display cap) | a `+N` opening a drawer or a see-all view |
| mixed variant (items of different kind or source) | distinguished by icon or a one-field label |

Each state records which blocks hide or show, which controls are live, and what the copy changes to.

**Overflow** must not be a silent `slice` — cutting items off with nothing to say so loses data the
reader had no way to know existed.

**Mixed variants** — generated against uploaded, free against premium — differ by an icon or a
single `source` field. The **shared handling** (grading, score display) stays identical; only the
part that genuinely differs looks different.

**A control that applies to several tabs sits above the tabs**, not inside one of them — a selector,
a filter, an outcome line — so every tab reads the same state.

## The review question

Ask of any proposed layout: *what does the empty state look like? One item? Many? Past the cap? An
item of a different kind?* A missing branch means the spec is not finished and is not ready to
build.

## Related

`labeled-section-render-empty-not-self-hide.md` — an empty labelled section renders rather than
hides · `search-filter-list-surface.md` — the list anatomy these states apply to.
