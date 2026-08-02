# starci-fe-sync — notes

`SKILL.md` says what to do. This file says why the skill is shaped this way. Read it before changing
anything here.

## Why a copy rather than an import

The obvious design is the one this skill refuses: let the app import the design-system tree directly
and keep one file. It costs nothing to write and it fails in two directions at once.

The design-system tree is dev-only. An app that imports it ships a catalog, and the catalog's file
becomes the file that runs — so the twin, if one exists, is never exercised, and the day the alias is
finally removed the app breaks in places no test covered. The reverse direction is worse: the moment
the app depends on the book, the book can no longer be changed without a release, and a design system
nobody can change is a design system nobody edits.

A mirrored copy keeps both trees free. The cost is drift, and drift is exactly what a gate can catch
— `patterns/fe/gates/check-src-sb-import.mjs` for the boundary,
`patterns/fe/gates/check-doc-parity.mjs` for the spec block. The alternative's failure mode is one no
gate can see.

## Why the connected half is written in the app and nowhere else

It is not a policy choice. A connected file calls SWR, reads a Zustand slice and resolves text through
`next-intl` — three sources of truth a story cannot supply. Put that file in the design system and it
becomes the one component the design system cannot render, which is the same problem the split was
invented to remove (`canon/fe/enforce/tiers/split.md`).

So the sync produces exactly one new file, and only for the tiers where data enters. For an atom or a
composite it produces none: the mirror is the whole job, and adding a connected half there would be an
empty file pretending to be architecture.

## Why the direction is one-way, and stated so plainly

Every failure this skill has to prevent starts the same way: someone fixes the component in `src`
because that is where they were standing. The fix is correct, invisible upstream, and the story keeps
showing the old shape — so the next reader trusts a state matrix that is no longer true.

Stating the direction as a rule is cheap. Discovering it from a stale story is not, because a stale
story does not look stale.

## Why storybook-first is enforced after the fact

There is no way to stop a component being written straight into `src`. There never was; a rule that
must be obeyed before the first keystroke is a rule enforced by memory alone, and memory is the thing
this whole skill set is built to stop relying on.

What can be done is to make the shortcut fail later, loudly, at a moment when the repair is still
small: a component with no story at the mirror path fails `check-story-coverage`, and the repair runs
upward — take it to the design system, story it, sync it back. The order of the repair matters more
than the order of the writing.

## What the source skill contributed, and what was dropped

The procedure is ported from the older consolidation skill, which solved a related problem: several
hand-rolled spellings of one component, gathered into a canonical one. Three things carried over
because they are the same problem seen from a different side — replace **every** call site rather than
most, delete what was superseded in the same change, and verify with the type checker, the linter and
the real routes before calling it done. A migration that stops halfway leaves two spellings, and the
one nobody migrated is the one that keeps getting copied.

What was dropped is that skill's bookkeeping: a proposal file, a backlog with states, a push step. It
belonged to the pairing of a scan half with an apply half and has no meaning here. What replaced it is
narrower and survives a session ending: anything that could not be finished is recorded through
`starci-record-debt`, with the reason, which is the only part the code cannot show later.

## Running the tests

```bash
node .claude/skills/starci-fe-sync/test.mjs
node .claude/scripts/run-all-tests.mjs        # every skill's suite
```

The suite tests the document, not a script, because this skill has no script of its own — it is a
procedure over two trees whose paths differ per machine. Three claims are checked: that every canon,
pattern, design and skill path cited in `SKILL.md` still resolves, that no machine path was hardcoded
into it, and that the founding invariant is still stated in words rather than implied.

The first of those is the one that earns its keep. The canon audit found four rules anchored to files
that had been **moved** — nothing wrong with the rules, the paths under them had shifted, and the
failure is silent without a check.

## What these tests cannot tell you

They say nothing about whether an agent reaches for this skill at the right moment. That is decided
entirely by the `description` in `SKILL.md` and needs a different harness: realistic queries, half of
which should fire and half of which should not, each run several times because the model is
stochastic.

The near-miss worth measuring is the border this skill shares with authoring. *"Make this card show
real enrollments"* must land here. *"Write a card for enrollments"* must not — nothing exists to sync
yet, and the work starts in the design system.
