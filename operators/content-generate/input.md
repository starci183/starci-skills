# Input for `content.generate`

The input has two closed sections: `context`, which declares the exact existing material the operator
may read, and `input`, which declares the one unit to build and the boundary it may write. Undeclared
fields are invalid.

## Envelope

- `schemaVersion`: exactly `8`.
- `operatorId`: exactly `content.generate`.
- `context`: authority and evidence bindings described by `context.md`.
- `input`: one frozen content unit.

## Context bindings

`context.curriculumRefs` and `context.sourceRefs` are required and non-empty, and the routed content
source must bind `input.project.sourceHead`. `context.aiRuntime` binds the workspace configuration
and fixes the brief and critique executions at one fresh run each with no inherited turns.
`context.styleRefs` and `context.auditRefs` are evidence and may be empty.

## The unit

`input.unit` names one unit, its objective, and its audience. `mode` is `generate` or `refactor`. A
refactor must name the existing unit in `existingUnitRef`; a generate run must leave it null, because
a run that quietly rewrites an existing unit under a new identity loses the history of what changed.

## Languages

`naturalLanguages` declares the editions to write, and `targets.articleTargets` must cover exactly
that set, one destination per language. `implementationLanguages` declares up to four programming
tracks that share one behaviour, and `targets.trackTargets` must cover exactly that set.

A language declared without a destination is a language the writing stage cannot deliver, discovered
only after the brief is frozen. That is invalid input rather than a runtime surprise.

## Stage modes

`input.stageModes` sets each of `image`, `code`, and `e2e` to `required`, `optional`, or `disabled`.

- A disabled image stage takes null image and prompt targets; an enabled one requires both, because
  an image is generated to a stated intent and the prompt is where that intent is stated.
- A disabled code stage takes no implementation languages and no track targets.
- An executable check may not be enabled while the code stage is disabled: there would be nothing to
  execute. Its commands must cover exactly the declared implementation languages.

`maxE2eIterations` bounds the run-read-repair loop.

## Review

`input.review` carries the current round, the approved maximum, and `minimumScore`, which is fixed at
`85`. The score floor is part of the contract, not a per-invocation setting.

`targets.reviewTargetRef` must differ from `targets.briefTargetRef`. The producing intent and the
independent judgement are two records, and merging them would let one overwrite the other.

## Resume input

`resume` is `null` for a new invocation. A resumed invocation supplies the exact blocked receipt, its
single-use token, and the references added since. Project, source head, unit, mode, and declared
languages must equal the blocked receipt. A resume that adds no curriculum, source, finding, or scope
delta is invalid as `NO_PROGRESS`.
