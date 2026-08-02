# starci-fe-review-scan — notes

`SKILL.md` says what to do. This file says why it is shaped this way. Read it before changing
anything here.

## Why one skill and not three

Copy, accessibility and width look like three subjects, and the first design of this was three
skills. Splitting them was wrong for a reason that only shows up in practice: the three share a
**unit of work**, and it is not the axis, it is the surface. Reading a page means opening the
component, the connected file, both catalogs and the running app, then walking the states. That
setup cost is paid once and it is most of the cost. Three skills pay it three times to produce three
independent queues that nobody reconciles, and — reliably — the third queue is never opened.

The bundling also catches a class of finding that none of the three would raise alone, because the
axes interact. A Vietnamese label is longer than its English original, so it wraps, so the row grows
a line, so the collapse order at the narrow width changes. Read as three separate reviews that is a
copy note, a layout note and a shrug. Read as one surface it is one finding with one fix.

## The territory is what the machine cannot see

The gates under `scripts/gates/` and the rendered-tree runner already own the mechanical part of
two of these axes, and they own it better than a reader does. That is the reason the skill opens by
running them rather than by grading anything: whatever they catch is not worth a human's attention,
and a review that re-reports it looks productive while adding nothing.

What is deliberately left is the residue — the type-valid, lint-clean, gate-green, renders-fine
failure. A rule of thumb that has held: if you can describe the check as a comparison between two
values, it belongs in a gate; if describing it requires the word *reads*, it belongs here.

## The ledger and the batch are different documents

The scan writes everything it found, and presents three to five findings. That asymmetry is the part
most likely to be "simplified" away by a later editor, so the reason is worth stating: a list of
forty findings is not a decision anybody can make. Handed one, a person picks nothing, and the
review's whole output becomes a file. Handed five ranked ones, they rule on five.

The ledger still has to exist, because without it a re-scan re-derives everything from zero and
re-raises what was already settled or already rejected. The ledger is the memory; the batch is the
conversation.

It lives beside the tree it describes — the front end's own artifacts folder — rather than in this
skill set, for the same reason the workspace record is per machine: a review of one app has no
meaning in a repository that serves several. When `fe.artifacts` answers `null`, that is honest and
not an error; ask where it should go rather than creating a folder in someone's source tree.

## Accessibility has no canon page yet, and the skill says so

Two parts of that axis are grounded in real canon — the paired colour tokens, and what the runner
can and cannot prove. The rest is written here as criteria rather than as rules, because
`canon/HOW-TO-WRITE.md` requires a rule to point at the code it describes and how many places do it
that way, and nobody has done that count for focus rings or icon labels in this tree.

That is a deliberate debt, not an oversight, and it has an exit: when the same accessibility ruling
has to be re-derived on a third surface, it has stopped being a judgement, and it should be measured
and written into `canon/` properly. Until then, stating it as a criterion in a skill is the honest
shape.

## Running the tests

```bash
node .claude/skills/starci-fe-review-scan/test.mjs
node .claude/scripts/run-all-tests.mjs                     # every skill's suite
```

This skill owns no script, so the suite tests the document: that every path it cites still resolves,
that no machine path has crept back in, and that the sentence the whole design rests on is still
there. Those are exactly the three ways a prose skill rots — a file moves and the reference goes
quietly dead, a session pastes in an absolute path that works today on one machine, and a tidy-up
edits out the load-bearing sentence because it reads like a summary.

## What these tests cannot tell you

They say nothing about whether an agent holding this skill actually reads a surface once and grades
all three axes, rather than reporting the first thing it noticed and stopping. That is a behaviour
question and needs an eval — the same prompt with and without the skill, graded blind.

> **prompt** — "Have a look at the course detail page before we ship it."
>
> **expected** — Enumerates the states, not just the happy one. Opens both catalogs rather than
> reading the rendered screen. Runs the gates before grading by hand. Comes back with a ranked
> handful across all three axes and changes no code.
