# A home page does not repeat a surface that navigation already reaches — STRICT

> Two public principles meet here. Nielsen's eighth heuristic, aesthetic and minimalist design: every
> extra unit of information on a page competes with the units that matter. And Hick's Law: the time
> to choose grows with the number of options, so a second copy of a menu is not free, it is a tax on
> every visit.

## The navigation is already the directory

Consider a workspace with a sidebar that reaches every surface the product has: overview, files,
activity, members, settings, billing. A grid of launch tiles on the home page, one per sidebar entry,
is the same navigation offered twice. It costs the reader a scan to discover it leads nowhere new,
and it costs the designer a second surface to keep in step whenever the sidebar changes. A home page
is not an app drawer.

## Every piece of data has exactly one home

Information that already has a page of its own is not duplicated as a fragment on the home page.
Two copies drift — one is computed differently, one is cached longer, one is updated when a feature
ships and the other is forgotten — and the reader is left to work out which is authoritative. The
home keeps only what the home is the home of.

## What a home page is actually for

Three jobs, and they are the three that have nowhere else to live:

- **Resume** — the pointer back into the work in progress, as the single primary action. This is the
  Zeigarnik effect put to work: an unfinished task is already occupying the reader's attention, and
  the home page's job is to give it one obvious place to land.
- **Overall progress** across the whole of the thing the home page is the home of.
- **The where-am-I path** — the section the reader is currently in, and the next step inside it.

Anything with a page of its own is reached through the navigation instead.

## The test for keeping a block on the home

Keep a block only if it is either work the home itself must do — resume, progress, path — or a
**time-sensitive prompt that nothing else raises**, such as "three items are due today". Fogg's
behaviour model is the reason the second case survives the rule: behaviour needs motivation, ability
and a prompt arriving at the same moment, and a prompt has to appear somewhere the reader already
is. A static link to a page the menu also lists is not a prompt.

"It makes the page richer" and "the home looks empty" are not reasons. The default is to cut, and
adding a block is a question to answer before it is built rather than after.

## Related

`sibling-surfaces-share-chrome.md` — surfaces holding the same role share one chrome ·
`surface-lands-on-its-overview-no-auto-forward.md` — a surface that has an overview lands on it.
