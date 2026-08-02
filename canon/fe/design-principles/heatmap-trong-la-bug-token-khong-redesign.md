# A flat or washed-out element is an undefined CSS token, not a UX problem

Debug first. Drawn from the contribution heatmap that rendered "hồng trắng trơn" — flat, washed-out
pink — on **2026-06-22**. The cause was that the `--heat-*` tokens had never been declared.

## The rule

- **When an element renders flat, washed out or colourless, suspect a BUG before considering a
  redesign.** Inspect the computed style and the real token: the common case is `bg-[var(--xxx)]`
  where `--xxx` is **not defined** in `globals.css`, so the CSS variable resolves to nothing, the
  background is transparent, and the result looks "flat". That is a one-line defect, not a design
  defect. Fix the token; do not tear down the layout.

  The concrete case: `ContributionCalendarView` paints its cells with `--heat-0` through `--heat-4`,
  and `globals.css` declared none of them. The fix was to add the `--heat-*` ramp, with
  `--heat-0 = var(--default)` as the empty track, in both light and dark. The full-year heatmap, the
  drag selection and the year switcher were all kept exactly as they were.

- **Do not escalate a display complaint into a redesign request.** "Trơn" means "why has it lost its
  colour", not "change the layout". Diagnose the rendering cause first; redesign only when the
  problem really is information architecture or flow, rather than a style bug.

- **An element with zero data still renders its frame** rather than being replaced by a message.
  Once the track token has a real colour, an empty grid is a valid empty state on its own — the way
  GitHub's is before the first commit. Empty is not hidden; empty renders meaningfully.

- **Fixing a token in `globals.css` is a systemic fix.** One component using that token in many
  places is repaired everywhere by defining the token once. Do not patch individual colours inside a
  feature.

- **Tokens go missing when `globals.css` is rewritten or edited in parallel.** When touching it,
  check by grep — `--heat` must appear the full number of times, in light and in dark. Note for
  Tailwind v4: an arbitrary value such as `bg-[var(--heat-N)]` only needs the variable defined on
  `:root` or `.dark`; it does not need to be declared in `@theme`.

Related: the scrollbar-gutter rule (juddering is a CSS layout bug, not a re-render — the same
family of "suspect the simple bug before the large change"), and the progress-block rule (an empty
meter still renders meaningfully).
