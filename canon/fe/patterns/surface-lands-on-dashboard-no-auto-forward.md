# A surface that has a dashboard lands on the dashboard — no auto-forward into an item — STRICT

> Read from `/learn/personal-project`, which `router.replace`d straight into the brief of a single
> task.

## The rule

When a surface has its own dashboard or overview — continue, percentage, path, KPIs — that dashboard
**is** the landing page. Do not `router.replace` the learner into the first or in-progress item.

Auto-forwarding kills the dashboard twice over: nobody ever sees it, and the learner loses the
"where am I, what is next" orientation before they had a chance to read it. The learner presses
**Continue** themselves — one deliberate primary action rather than a silent redirect.

## Two kinds of base route

- **Has a dashboard** — the personal-project home, the content home. Remove the auto-forward and
  land on the dashboard. Resuming into an item goes through the Continue button
  (`currentTask`, `nextContentTask`).
- **A bare list with no overview** — for example `/learn/modules`, if there is no module dashboard.
  Forwarding into the first item is acceptable here, because there is nothing to land on. Consider
  dropping the route altogether when the content home is already the dashboard for that content.

## What the change touches

The default-redirect hook: drop the forwarding branch for any route that has a dashboard, so the
workspace renders the dashboard when there is no `taskId`. Then clean up the imports that go dead
with it and update the comment that now describes the old behaviour.

## Related

`course-home-no-duplicate-surfaces.md` — what the home is for, and its one primary action ·
`learn-home-surfaces-share-flat-chrome.md` — the chrome the landing dashboard uses.
