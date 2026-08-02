# History and statistics become tabs on the existing setup screen, not a new route

> A data-state addition inside a shell that already exists. Nielsen's aesthetic and minimalist design
> heuristic argues against a new surface for material that is a variant of an existing one, and
> information scent argues the same way from the other side: the reader looks for their past runs
> where they start a new one.

## The rule

When a resumable, session-based feature — configure, then the work, then the result — needs "the runs
I have already done" plus "aggregate statistics", and sometimes "what to improve", **do not open a
new route or a new shell**. Add a tab bar of two or three tabs directly above the setup screen —
Start, History, Statistics — held in local component state rather than a query parameter, with
mutually exclusive branches rendered under it. The work itself and the result keep their own shells;
only the setup screen gains tabs.

Worked example: a report generator whose setup screen chooses a data range and a format. History
lists past runs with their status and duration; Statistics shows how long runs take and how often
they fail. Neither needed a route, and neither is worth a menu entry of its own.

## Shape

- **The tab bar** sits immediately above the setup content, driven by one local state value. No query
  parameter, because nothing deep-links into a specific tab; adding one is a decision to support
  those URLs forever.
- **An embedded history widget is promoted, not copied.** If the setup screen already shows the last
  few runs with a hard cap and no filter, the cap goes, an explicit load-more control comes in — never
  a silent truncation — and an optional filter by mode or tier is added. That filter must be a
  **server-side parameter**, not a client-side pass over the current page, or pagination and filter
  go out of step and the reader sees a page with three rows on it.
- **The statistics tab gets its own aggregate query**, scanning the most recent runs with an explicit
  cap — fifty is a reasonable one — and returning an insufficient-data signal when the sample is too
  small. Do not infer a percentage from one or two runs. Break the numbers down along an axis that
  **recurs across sessions**, such as the kind of work or the configuration used, rather than a
  positional label like "Step 3" or "Run 4", which means nothing once compared across runs.
- **Trend charts.** Simple inline bars, sized as a percentage, are enough for a shape; reach for a
  charting library only where a real axis or tooltip is needed, and only if one is already in the
  bundle. Do not extract a shared trend block until there are at least three callers — two is a
  coincidence.
- **An empty state that needs its own action button** uses the empty-state block that supports an
  action slot, rendered by hand, rather than the async wrapper's empty branch.

## Gotcha — an empty-state prop bag cannot carry an arbitrary action

The empty branch of an async wrapper usually maps onto a fixed prop set: title, description, icon,
and a retry handler with its label. For any action that is not a retry — "Start your first run" — the
correct move is to render the richer empty-state block, which accepts an arbitrary node as its
action, inside the content branch instead.

Strict typing catches the mistake. An escape hatch copied over from another case does not, which is
how this one reaches a screen.

## Related

`labeled-section-render-empty-not-self-hide.md` — the empty state each tab owes ·
`every-surface-offers-a-path-onward.md` — every empty state carries a route onward.
