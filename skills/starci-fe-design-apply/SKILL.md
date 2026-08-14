---
name: starci-fe-design-apply
description: Write the reviewed StarCi screen into production — backend updates first if the review proposed any, then the frontend — and open the real page to prove it renders. Use after starci-fe-design-preview records an approved review in the task file. Confirms the write boundary once, then runs to a working page.
---

# StarCi FE Design Apply

Read [`../../skill-shape.md`](../../skill-shape.md) first.

Apply writes what the review named. It does not finish design work in JSX, substitute a component
that was easier, or improve something on the way past.

## SCOPE

Print the table, then **confirm `Repo / branch` and `Touching` with the user before the first
production write.** Once. Detection is not permission, and this is the only place in the chain where
the work becomes expensive to unwind.

Read `## review` in the task file. No review means `$starci-fe-design-preview` has not run; say so
rather than inventing what it would have decided.

## PROCESS

**Backend first when the review proposed one.** A frontend built against a field nobody serves fails
at the only moment that counts. Hand it to `$starci-be-feature-plan`, which returns here.

**Write what the review named, where it named it.** Pages orchestrate, blocks own product sentences,
branches arrange contract content, shells own vendor mechanics, connected blocks resolve data and
render pure `_X` halves. Read the tier's file in
[`../../fe/canon/uxui/layers/`](../../fe/canon/uxui/layers/) BEFORE authoring that tier — a page
taking one situation prop for the whole screen, a branch opening `children`, a component writing its
own layout class: each compiles, renders and reviews cleanly, and each is refused.

**Inventory before invention** — the same rule Plan and Preview ran. A new entry whose class list and
child identities repeat an existing one is the same concept under a second name.

If the target has moved and the reviewed shape no longer fits, that is shape A. Do not adapt it
quietly. Report what actually moved rather than the error you saw: a shared import renamed under you
is yours to resync and carry on from; a component that no longer exposes the slot the review used is
the user's call. One broken seam refuses its own file, never the whole run — everything clear of it
lands and is proved.

**Prove it renders.** Typecheck, lint and build must be green with nothing suppressed. Then open the
real page and look at each state the review listed, in the same route, viewport, locale, theme,
persona and fixture the review used. A screenshot from another state cannot prove or disprove
anything, and green tests know nothing about what a screen looks like.

## OUTPUT

Shape C, and it is the last one in the chain, so it invites nobody. Append `## apply` to the task
file: the SCOPE table, **every file written**, the green commands, and what is still owed.

That file list is the check. Compare it against `## review` directly above it — a file the review
never mentions is visible immediately, with no hash and no script. `$starci-workflow-drift` makes the
same comparison later, across every task at once.
