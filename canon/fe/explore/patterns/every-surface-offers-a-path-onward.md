# Every surface offers a path onward, and covers the whole data-state matrix — STRICT

> Two rules that belong together, because the state everyone forgets to design is the state where the
> rule matters most. Fogg's behaviour model — behaviour happens when motivation, ability and a prompt
> arrive together — is the grounding for the first. The second is ordinary specification discipline:
> a layout described only for the case where data exists is not a finished layout.

## Rule 1 — every surface offers a route onward, and an empty region is an invitation

**Every page carries at least one route back into the product's core loop** — the thing the reader
came to the product to do, and the thing the business is paid for. A surface with no way onward is
a dead end, and a dead end is a decision to make the reader find their own way out.

**An empty or data-less region is a prompt, not a shrug.** On any surface whose value is *built up
by using the product* — a portfolio, a report history, an achievements page, a set of saved items —
the empty state is an invitation: a headline naming what the work produces, one primary action that
starts that work, and a secondary in-place action where one genuinely exists. The emptiness is the
pitch, and it is the highest-motivation moment the surface will ever have, because the reader is
looking straight at the gap.

**The voice is fair.** Name what the reader gets by doing the work, never sell a shortcut to the
number itself. Earning the outcome and buying the appearance of it are different products, and a
surface that blurs them teaches the reader to distrust every number on it. The loop should be
readable straight off the layout: the visible value comes from a real result, and the real result
comes from doing the work.

**Keep one durable anchor beside the empty state.** A page-level line or panel that still points
onward once data exists — "two items short of the next threshold" — so the populated states are not
quietly worse at pointing onward than the empty one. On a surface that is not a personal record at
all, a dashboard or a marketing page, the route onward is the hero action, a card, or a resume
prompt.

## Rule 2 — the layout specification covers the state matrix, not the happy path

A surface holding a **list or a collection** defines a layout for every countable state, at minimum:

| State | What the layout does |
|---|---|
| empty (0) | the invitation from rule 1 |
| 1 | usually hides the selector — a one-of-N control is for two or more |
| N | selector visible; an aggregate takes the best or the maximum, never a sum divided by a count nobody sees |
| overflow (past the display cap) | a `+N` control opening a drawer or a see-all view |
| mixed variant (items of different kind or source) | distinguished by an icon or a one-field label |

Each state records which blocks hide or show, which controls are live, and what the copy changes to.

**Overflow must not be a silent truncation.** Cutting a list off with nothing to say so loses data
the reader had no way of knowing existed, and it is invisible in every screenshot taken with test
data.

**Mixed variants** — imported against created, free against paid — differ by an icon or a single
source field. The **shared handling** stays identical; only the part that genuinely differs looks
different, or the reader learns two mental models for one list.

**A control that applies to several tabs sits above the tabs**, not inside one of them — a selector,
a filter, a summary line — so every tab reads the same state and switching tabs does not silently
reset it.

## The review question

Ask of any proposed layout: *what does the empty state look like? One item? Many? Past the cap? An
item of a different kind?* A missing branch means the specification is not finished, and building
from it means the branch will be invented at implementation time by whoever hits it first.

## Related

`labeled-section-render-empty-not-self-hide.md` — an empty labelled section renders rather than
hides · `search-filter-list-surface.md` — the list anatomy these states apply to.
