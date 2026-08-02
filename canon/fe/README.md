# canon/fe — two lanes, by whether a machine can check it

Front-end canon is split by one question: **can a script decide whether the code obeys this?**

If yes, the rule lives in `enforce/`. It is convergent — one right answer, a gate that goes red
when the answer is wrong, a pixel or a tier or an import direction. You are *held to* it.

If no — if the rule is a judgement a person or a model makes and no linter could settle — it lives
in `explore/`. It is divergent: when a drawer instead of a modal, when a second surface instead of
a longer one, which component a shape of data becomes. You *reason with* it.

The line moves in one direction only. A rule starts in `explore` as a heuristic; the day someone
writes a gate that catches its violation, it graduates to `enforce`. Nothing travels the other way —
a rule a machine can check is not a matter of taste.

## explore/ — the creative lane, read before you build

| Shelf | What it helps you decide |
|---|---|
| `explore/principles/` | how the interface should behave: accent as signal, one primary action, honest persuasion, hover that matches what is clickable, restraint, voice, accessibility |
| `explore/patterns/` | the shape a recurring situation takes: when a drawer, a form flow, the three tiers of loading, a search-filter-list surface |
| `explore/layouts/` | which shell a surface's job calls for, and how its regions collapse |
| `explore/foundations/` | the tokens the above are spent in — colour, radius, typography, the spacing scale |
| `explore/component/` | which component a shape of data becomes — `data/matrix.csv` is the lookup, read one row at a time via `scripts/search-component-matrix.mjs`. The matrix feeds the judgement; it does not replace it. |

Nothing here has a gate. A rule in this lane that acquires one has stopped belonging here.

## enforce/ — the strict lane, checked after you build

| Shelf | What a gate holds you to |
|---|---|
| `enforce/tiers/` | which tier a component is, what it may import, the presentational and connected split, what a story must render |
| `enforce/spacing/` | the pixel a named seam or inset must compute to — `overview.md` is the prose, `patterns/fe/patterns.mjs` the values, kept equal by `patterns/fe/gates/check-canon-sync.mjs` |
| `enforce/authoring/` | how a line of code is spelled — imports, props, async data, forms, comments, i18n |
| `enforce/examples/` | one worked example per tier |
| `enforce/testing.md` | the DOM contract: how the rendered-tree runner measures a story against the registry |

Every file here names the `patterns/fe/gates/check-*.mjs` that enforces it. A rule with no gate,
and no gate a person could write, is in the wrong lane.

## The two files beside the lanes

- `storybook.md` — why the design system is the source of truth: a component is authored and storied
  there before it is anything in the app.
- `sync.md` — the discipline that connects the two trees: how a storied component becomes a working
  twin in the app's own `src`, and why `src` never reaches into the design-system tree.

Back-end canon is organised differently — by subsystem, under `canon/be/` — because its rules do not
split the same way.
