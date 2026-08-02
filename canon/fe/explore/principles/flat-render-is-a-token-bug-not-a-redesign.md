# A flat or washed-out element is an undefined token, not a UX problem

Debug first. A complaint that a surface looks "flat", "washed out" or "colourless" is a report about
rendering, and the cheapest explanation is usually the right one: a design token that was never
declared.

## The rule

- **When an element renders flat, washed out or colourless, suspect a BUG before considering a
  redesign.** Inspect the computed style and the actual custom property. The common case is
  `bg-[var(--xxx)]` where `--xxx` is not declared anywhere in the stylesheet: a custom property with
  no value and no fallback makes the declaration invalid at computed-value time, so the background
  falls back to inherited or initial — usually transparent — and the result looks "flat" rather than
  broken. That is a one-line defect, not a design defect. Fix the token; do not tear down the
  layout.

  The case that produces it most often is a ramp. A density grid — an activity calendar, a
  utilisation matrix, a correlation table — paints its cells from a graded set such as `--heat-0`
  through `--heat-4`. Add a level, rename the scale, or split the stylesheet, and the ramp goes
  missing while every other colour on the page still works. The fix is to declare the ramp, with the
  lowest rung set to the neutral surface colour so the empty track is a real colour rather than a
  hole, in both light and dark themes. Nothing about the grid, its selection behaviour or its
  controls needs to change.

- **Do not escalate a display complaint into a redesign request.** "It lost its colour" means what
  it says. Diagnose the rendering cause first; redesign only when the problem really is information
  architecture or flow, rather than a style bug wearing a design complaint's clothes.

- **An element with zero data still renders its frame** rather than being replaced by a message.
  Once the track colour is real, an empty grid is a valid empty state on its own — the way a
  contribution calendar reads before the first entry. Empty is not hidden; empty renders
  meaningfully.

- **Fixing a token in the global stylesheet is a systemic fix.** One token used in many places is
  repaired everywhere by defining it once. Do not patch individual colours inside the feature that
  reported the symptom; that leaves the same bug live in every other consumer and adds a second
  source of truth for the colour.

- **Tokens go missing when the global stylesheet is rewritten or edited in parallel.** When touching
  it, check by grep that every rung of a ramp appears the expected number of times, in both themes;
  a ramp that is complete in light and short one rung in dark is the version that ships. Note for
  utility frameworks that read arbitrary values, such as Tailwind v4: `bg-[var(--heat-3)]` only
  requires the variable to be defined on the root or the dark selector, and does not require a theme
  registration — which is exactly why a missing declaration produces silence rather than a build
  error.

Related: the same family of reasoning covers layout judder from a missing scrollbar gutter, which is
a CSS layout bug rather than a re-render problem. Suspect the simple bug before the large change.
