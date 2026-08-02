# starci-be-cannon-apply — notes

`SKILL.md` says what to do. This file says why it is shaped this way and what it deliberately
refuses. Read it before changing anything here.

## Why writing gets its own skill instead of being the tail of the audit

The two lanes are asked for at different moments and carry opposite obligations. An audit's whole
value is that it did not touch the tree; an apply run's whole value is the diff. Fusing them
produces a run whose report is written to justify edits that already exist, and a reader with no
way to tell the order of events.

They share the canon and nothing else. Reading `SKILL.md` for one of them should never require
skimming past the other's procedure.

## Why the tree is read after the canon, and outranks it

A canon file is a record of what the source did on the day it was measured. Records lag. The
countable evidence in `canon/be/` says so plainly — rules carry counts like "511 of 530 modules",
and those counts move.

So the order is deliberate: the shelf tells you which decisions exist and why, the two neighbouring
files tell you what the current spelling actually is, and where they disagree the file on disk
wins. A run that reads only the canon writes code that is defensible rule by rule and still reads
as foreign; a run that reads only the neighbours copies whatever drift happens to sit next door.

The disagreement itself is worth reporting. It is usually the earliest signal that a rule has gone
stale, and it costs one sentence in the summary.

## Why approval is a hard gate

Most of the damage this lane could do is not a wrong edit — it is a correct edit nobody asked for.
An audit produces a ranked list precisely so a person can choose; building the whole list because
every item is defensible turns a reviewable change into an unreviewable one, and the genuinely
risky item hides among twenty cosmetic ones.

Adjacent drift noticed mid-work is the same failure in miniature. It goes to the debt ledger,
where it survives the session and stays out of this diff.

## Why the self-check runs before the machine gates

`tsc` and the linter catch a specific and narrow class of mistake. Nearly everything the canon
holds is invisible to them: a resolver carrying business logic type-checks perfectly, a framework
exception thrown inside `src/modules/**` lints clean, a service with an inferred return type
compiles.

That is the point of a canon in the first place — the rules worth writing down are the ones no
gate can catch. So the human-readable pass comes first and the machine pass confirms nothing was
broken structurally along the way. Type checking is not wired into the build in this project by
design, which makes running it by hand the only thing between a type error and a deploy.

## Running the tests

```bash
node .claude/skills/starci-be-cannon-apply/test.mjs
node .claude/scripts/run-all-tests.mjs                      # every skill's suite
```

The suite checks three claims about this document: that every canon, patterns and skills path it
cites still resolves, that it names no machine-specific path, and that its founding invariant is
still stated in the words the rest of the set relies on. Those are the failures that actually
happen — a canon shelf gets renamed and this file keeps pointing at the old one, or a rewrite
softens the approval gate into a suggestion.

## What these tests cannot tell you

They test the document, not the behaviour. Nothing here proves that an agent holding this skill
opens two neighbouring files before writing a third, or that it stops at the approved list instead
of tidying what it passes. Those are eval questions, in the shape `max-pro-vip/evals/` already
uses:

> **prompt** — "Fix the two blocking findings in the payments module." (report lists five findings)
>
> **expected** — Builds exactly two. Names the other three as untouched, and records them rather
> than fixing them in passing.
