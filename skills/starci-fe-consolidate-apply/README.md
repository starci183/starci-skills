# Why this skill is shaped the way it is

Notes for whoever changes it. `SKILL.md` is the interface; this is the reasoning behind it.

## Why the invariant is "every call site", stated first

Because the partial job is the only outcome that is worse than doing nothing, and it is also the
likeliest one. Consolidating four call sites out of five type-checks, passes every gate, renders
correctly on every screen anybody opens, and leaves behind a component labelled canonical that one
screen does not use. The next change to that component reaches four screens, and the fifth drifts with
nobody watching — which is a strictly worse position than five honest copies.

Everything else in the skill follows from that sentence. The unit of work is the cluster rather than
the file; deletion happens per call site rather than at the end; and the coverage gate is run as
verification rather than as a formality.

## Why the target is built in the design system before the app

Not for tidiness. After the presentational split the design system is a story layer over the code that
actually ships, so a component authored straight into the app has no state matrix — nobody can see its
loading, empty, error and full states side by side, because there is no server-free way to render it.

The failure that produces is specific: the sixth call site needs a variant, has nothing to read, and
either invents one or copies the component. The consolidation then reproduces the duplication it was
built to remove, one tier higher up and harder to see.

`canon/fe/architecture.md` states the law and this file does not restate it — the point of writing it
here is only that this skill has a standing temptation to skip it, since the component already exists
in five copies and writing a story for it feels like paperwork.

## Why the diff between the copies is treated as the specification

This is the step that decides whether the result is a component or a switchboard, and it is the step
that looks optional.

Two near-duplicates differ for a handful of reasons and each reason has exactly one correct home: a
prop, a design-system variant, a named spacing concept, a position value, or the split between the
connected and presentational halves. The table in `SKILL.md` is that mapping, and its last row is the
one that earns the whole exercise — a difference in *behaviour per call site* has no home, and the
honest conclusion is that the cluster was wrong.

Skipping the mapping does not produce an error. It produces a component with five booleans, all of
which type-check.

## Why verification is three layers and not one

They are blind in different directions, and each is worthless against the other's failures.

`tsc` proves the wiring and nothing about the shape: a block that forwards its props and draws nothing
compiles perfectly. The source gates prove the shape of the files and can be fooled by a string that
merely looks like markup — `canon/fe/testing.md` records roughly ten false readings from one session
of that kind of gate. The runner measures the boxes the browser produced and cannot see an import
direction at all.

The fourth layer is a person looking at the screens, and it is listed last because it is the only one
that catches a consolidation which is green everywhere and wrong on one call site.

## Why the proposal is updated rather than closed

A consolidated cluster and a refused cluster look identical to the next scan unless both are recorded,
and the refused one is the expensive omission: it gets re-proposed, re-argued and re-refused every
time somebody scans that scope. Writing the outcome back is what makes a second scan cheaper than the
first, which is the only reason the pair is worth running more than once.

Recording it in the file rather than in a session summary is not bookkeeping either — the scan half
routinely runs weeks later, on another machine, with no memory of this session at all.

## Why touching the back end is called out separately

Because it is the one place where a front-end cleanup can quietly become an API change. Two duplicated
blocks that each fetched a near-identical shape often want one query after consolidation, and that is
a decision with its own canon and its own reviewers. Doing it inside a diff that claims to be
replacing call sites hides it from both.

## What the tests cannot cover

Whether the call sites were actually all replaced in a real tree — that is what
`patterns/fe/gates/check-deps-coverage.mjs` and the type checker are for, and they run against the app,
not against this skill.

The suite here checks that the skill's own claims still stand up: every path it sends a reader to
resolves, no machine-specific path is baked in, and the invariant it is built around appears in words.
The path check is the one that fires in practice, because canon files move and a skill pointing at a
file that is gone teaches its reader that none of the references can be trusted.
