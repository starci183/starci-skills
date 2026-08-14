---
name: starci-fe-fidelity-apply
description: Make the repair a fidelity plan named, in the files it named, and prove it with a before-and-after pair in the frozen comparison state. Use after starci-fe-fidelity-plan records the binding evidence and the file list. Never widens the fix or redesigns on the way past.
---

# StarCi FE Fidelity Apply

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## SCOPE

Print the table, then **confirm `Repo / branch` and `Touching` with the user before the first
production write.** Once. A small fix changes the amount of code, not the authority required to
change it.

Read `## plan` in `<backend-repo>/.workflows/fidel/<app>/<id>.md`. No plan means the binding evidence
was never named — say so rather than deciding for yourself what "correct" meant.

## PROCESS

Make the smallest correction that restores the expected result, in the files the plan listed,
following canon and the components already shipped.

**A file the plan did not name is a stop, not a detail.** Either the plan measured the defect wrongly
or the target moved; both are worth one line to the user before the write, and neither is worth
discovering afterwards in a diff.

If the target has moved and the frozen comparison no longer exists — the route renamed, the state
unreachable, the reference commit gone — that is a confirm row. Do not re-freeze it silently: a
comparison chosen after seeing the defect is a comparison chosen to pass.

**Render before and after for every touched state.** This lane is judged on a pair of images, and
green tests know nothing about what a screen looks like. When the browser refuses to composite, take
the fallback in
[`../starci-fe-design-preview/references/state-coverage.md`](../starci-fe-design-preview/references/state-coverage.md)
before recording any state as uncaptured — and when a capture tool lays the page out at a width it
was never given, say so and carry the measurement instead. An image that lies is worse than no image.

Typecheck, lint, focused tests and build must be green with nothing suppressed.

For several independent fixes, dispatch non-overlapping owner/file packets and integrate centrally.
One blocked packet does not hold the others.

## OUTPUT

The four tables. Append `## apply` to the same task file: the SCOPE table, the frozen comparison
identity, every file written, before-and-after per touched state, the green commands, what the
founder rejected during the write, and what is still owed.

That file list is the check. Compare it against `## plan` directly above it — a file the plan never
named is visible immediately, with no hash and no script.
