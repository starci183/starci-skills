# starci-fe-skeleton-apply — notes

`SKILL.md` says what to do. This file says why it is shaped this way and what it deliberately
refuses to do. Read it before changing anything here.

## Why a loading state gets its own skill

Loading is the state nobody is looking at when the work is done. A layout task ends when the screen
looks right, and the screen looks right with data in it — so the pending rendering is written last,
under the least attention, by whoever is closest to shipping. That is the whole reason this is a
named skill rather than a paragraph inside a layout skill: it puts the least-watched state in front
of a reader on purpose, once, with its own loop.

It is scoped narrowly for the same reason. A skill that could also restructure the region would be
used to restructure the region, and the loading state would again be the part that ran out of time.

## Why the invariant is stated as geometry rather than as feedback

The common framing is that a skeleton tells the user something is happening. That framing permits a
spinner, and a spinner is exactly what produces the failure this skill exists to prevent: a
zero-height box that becomes a four-hundred-pixel box in one frame, under a thumb already moving.

Stating it as geometry — the shape the data will occupy, held at the right size — makes the spinner
obviously wrong without a rule having to forbid it, and makes the mirror obviously right. A rule
whose reason is written down survives a case its author never saw; a bare prohibition does not.

## Why the flags get a table before the procedure

Three booleans, all about waiting, all plausible names for each other. In practice the mis-naming is
the defect that survives review, because every version of it type-checks, renders, and looks fine in
the state the reviewer happened to open.

The table is first in the body because the rest of the procedure reads differently once the reader
knows that the branch input and the shimmer flag are two different questions. The machine half of
that rule is `patterns/fe/gates/check-skeleton-prop.mjs`, which is why the body states the concept
and points at the gate instead of restating what the gate already enforces — a prose copy of a rule
a script owns is a second source of truth, wrong the day the first one changes.

## What was dropped in the port

This skill descends from an earlier one that carried a hardcoded machine path, an inspection step
built around a `debug` prop that has since been removed from the component, and its rules copied
inline. All three are gone:

| Dropped | Replaced by |
|---|---|
| a literal repository path | `node .claude/scripts/read-workspace-context.mjs fe.path` |
| a `debug` prop to freeze the loading branch | the story, plus a throttled reload for the app |
| rule text copied from the canon | citations to `canon/fe/authoring/loading-and-skeleton.md` and the gates |

The last one is the substantive change. The original restated the formula, the mirror rule and the
piece-picking rule in its own words, so there were two versions of each and no way to tell which was
current. A skill that points outward stays true when the canon moves; a skill that copies it is a
snapshot with no date on it.

## Running the tests

```bash
node .claude/skills/starci-fe-skeleton-apply/test.mjs
node .claude/scripts/run-all-tests.mjs                      # every skill's suite
```

The suite reads `SKILL.md` and nothing else: it checks that every path the skill cites still
resolves, that no machine path crept back in, and that the founding invariant is still stated in
words. A moved canon file fails it — which is the point, since a citation to a file that has been
renamed is worse than no citation, because it reads as grounded.

## What these tests cannot tell you

They test the document. They say nothing about whether the skeleton an agent holding this skill
actually builds mirrors anything. That needs two evals, and neither has been run.

> **prompt** — "The dashboard jumps around while it loads, fix it."
>
> **expected** — Resolves `fe.path` rather than assuming one. Enumerates the data-backed regions
> before editing any. Builds the mirror as a component with a story, not inline in the feature file.
> Does not reach for a spinner in any region.

The second, sharper one grades the *watching* step, which is the step most likely to be skipped
because its output is a claim rather than a diff: with the skill and without it, does the run
produce evidence that the loading branch was actually rendered and compared, or only an assertion
that it now matches?
