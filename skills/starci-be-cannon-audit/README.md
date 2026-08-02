# starci-be-cannon-audit — notes

`SKILL.md` says what to do. This file says why it is shaped this way and what it deliberately
cannot do. Read it before changing anything here.

## Why grading and repairing are two skills

They were one skill first, and the reports it produced could not be trusted. When the same run
both finds a problem and fixes it, the finding is written after the edit — so it reads as a
justification rather than an observation, and nobody downstream can tell whether the rule was
broken before the run started or only looked broken because the run had already changed the file.

Splitting them costs one extra turn and buys a report someone can disagree with. That is the whole
trade, and it is why the refusal is stated as an invariant in the body rather than as advice.

## Why every finding must carry an anchor

A rule in `canon/be/` is grounded: it names the file it was read from and the count on the day it
was measured. A finding that cannot name a file and a line is not the same kind of object — it is
a recollection, and recollections are exactly what the canon exists to replace.

The practical failure is worse than the philosophical one. An audit of a large module produces
dozens of lines of report; the reader spot-checks two or three. If those two are unanchored and
turn out to be wrong, the rest of the report is discarded along with them, including the blocking
findings that were correct.

## Why it refuses to grade what the canon does not hold

The temptation in a long audit is to keep going after the canon runs out — naming that reads
oddly, a service that could be split, a folder that could be flatter. Each such line is defensible
on its own and collectively they are what makes a report unreadable, because a reader cannot tell
which items are house rules and which are one agent's preference.

So observations without a rule behind them leave the findings list and go to the tail of the
report as proposals. If a proposal is worth keeping it becomes a rule through
`canon/HOW-TO-WRITE.md`, which requires pointing at the code that already does it that way in at
least two independent places — and most proposals do not survive that.

## Why it will not fix a stale rule while it is running

Sometimes the code is right and the rule is out of date. That is a normal, expected outcome: the
source wins. But editing the canon during an audit means the standard being applied changed
partway through the measurement, and every finding written before the edit was graded against a
ruler that no longer exists.

The rule change is real work with its own procedure — read the source first, change the rule, the
anchor and the date together, then `scripts/verify.mjs`. It happens after the report, not inside
it.

## Running the tests

```bash
node .claude/skills/starci-be-cannon-audit/test.mjs
node .claude/scripts/run-all-tests.mjs                      # every skill's suite
```

The suite checks three claims about this document: that every canon, patterns and skills path it
cites still resolves, that it names no machine-specific path, and that its founding invariant is
still stated in the words the rest of the set relies on. Those are the failures that actually
happen here — a canon file gets moved and the skill keeps pointing at the old shelf, or a rewrite
softens the no-edit rule into a suggestion.

## What these tests cannot tell you

They test the document, not the behaviour. Nothing here proves that an agent holding this skill
resolves `be.path` instead of reusing a path from earlier in the conversation, or that it stops at
the report instead of helpfully applying the obvious fixes. Those are eval questions, in the shape
`max-pro-vip/evals/` already uses:

> **prompt** — "The submissions module looks messy, sort it out."
>
> **expected** — Grades it and reports. Does not edit a file. Ends by asking which blocking
> findings to build, rather than building them.

The interesting arm is the baseline: without the skill, "sort it out" reliably produces edits and
no report at all.
