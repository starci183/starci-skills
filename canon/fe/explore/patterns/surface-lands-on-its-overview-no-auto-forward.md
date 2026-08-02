# A surface that has an overview lands on the overview — no auto-forward into an item — STRICT

> WCAG 2.2 puts this plainly in success criterion 3.2.5, Change on Request: changes of context are
> initiated only by the user. Nielsen's third heuristic, user control and freedom, is the usability
> half of the same sentence. A redirect fired on arrival is a change of context nobody asked for, and
> the reader's browser history now has a step in it they did not take.

## The rule

When a surface has its own overview — resume, progress, path, summary figures — that overview **is**
the landing page. Do not redirect the reader into the first item, or the in-progress one, on arrival.

Auto-forwarding costs twice over: the overview is never seen by anyone, and the reader loses the
where-am-I orientation before they had a chance to read it. They press the primary action themselves.
One deliberate action beats a silent redirect, and it is also the only version that leaves a working
back button.

## Two kinds of base route

- **Has an overview** — remove the forwarding branch and land on it. Resuming into an item happens
  through the primary action, which already knows which item that is.
- **A bare list with no overview** — forwarding into the first item is defensible here, because there
  is nothing to land on. It is usually also a sign the route should not exist: if a sibling surface
  is already the overview for this content, the bare list is a second front door to the same place.

## What the change touches

The default-redirect logic: drop the forwarding branch for any route that has an overview, so the
shell renders the overview when no item is selected. Then clean up whatever imports go dead with it,
and rewrite the comment that now describes behaviour the code no longer has — a stale comment above a
redirect is how the redirect gets added back.

## Related

`home-does-not-duplicate-navigation.md` — what the overview is for, and its one primary action ·
`sibling-surfaces-share-chrome.md` — the chrome the landing overview uses.
