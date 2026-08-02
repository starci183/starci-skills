# Surfaces that hold the same role share one chrome — pick a reference and mirror it — STRICT

> Nielsen's fourth heuristic, consistency and standards: users should not have to wonder whether
> different words, situations or actions mean the same thing. Jakob's Law is the wider version —
> people spend most of their time on other products, and they carry those expectations here, so the
> cost of an invented chrome is paid on first contact and never recovered.

## The failure this prevents

Two pages doing the same job invent two different chromes, usually because they were built months
apart by different hands. Neither is wrong on its own. Together they stop reading as one product,
and the reader relearns the page every time they move between them.

The fix is not a style guide argument. Pick one of the two as the reference and mirror it, tier by
tier.

## The shape

Every overview page of a section — the reference and every sibling that holds the same role — uses
the same chrome:

1. **Tier one: breadcrumb.**
2. **Tier two: header** — a title, a description, and one row of meta or status chips.
3. **Tier three: a flat resume-and-progress block** — an eyebrow, the name of the next piece of work
   in semibold, one primary action, a progress meter showing its value, and one muted stat line.
4. **The path — "Up next", with the current group named** — the items in the group the reader is
   currently inside, as rows carrying a status icon, each opening its item.

No grid of metric cards and no ribbon of statistics. Those are the two shapes that get added when a
page feels thin, and they are the two that make sibling pages diverge fastest.

## The full list lives in the rail; the body says where you are and what is next

Whatever tree the section has — a folder hierarchy, a milestone outline, a chapter list — belongs to
the rail. The body shows the path through the group the reader is currently in.

The body never redraws the whole tree. That is the same duplication the home-page rule forbids, one
level down.

## Surface-specific data folds into the shared chrome

A surface with something the others do not have does not get its own layout for it. A repository
connection becomes **one status chip in the header** — repository and branch when connected, "Not
connected" when not — rather than a card of its own. Secondary numbers join the **single muted stat
line** under the meter instead of forming a ribbon.

The test: can this fact be a chip, a line, or a row inside the chrome that already exists? If yes,
it is not a reason for a new chrome.

## Mirror the blocks and the rhythm, not just the order

The same meter and the same row component, with the same leading icons — active, done, locked, not
started — and the same vertical rhythm: the tighter spacing step inside a region and the step above
it between regions (on a four-pixel scale, twelve within and twenty-four between). The skeleton
mirrors the same structure, so the two pages also agree about what they look like before their data
arrives.

## The general form

When two surfaces hold the same role, one of them is the reference and the other mirrors it. Letting
each invent its own chrome means the set stops reading as a set, and no individual page ever looks
wrong enough for anyone to fix it.

## Related

`home-does-not-duplicate-navigation.md` — what an overview page is for, and what it must not repeat ·
`surface-lands-on-its-overview-no-auto-forward.md` — the surface lands on this chrome rather than
skipping past it.
