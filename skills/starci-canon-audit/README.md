# starci-canon-audit — notes

`SKILL.md` says what to do. This file says why it is shaped this way and what it refuses to do.
Read it before changing anything here.

## Why the audit is cross-cutting rather than per-role

An earlier version of this skill audited the front-end shelf only, and the split looked reasonable:
front-end rules and back-end rules are read by different people on different days. The findings
argued the other way. The most expensive defects in a rule set are the ones that span the shelves —
an index that lists both roles and has drifted on one of them, a cross-reference from an authoring
file into a contracts file, a convention like "never a bare throw" or "what may not be typed
loosely" that both roles state and only one of them has kept current. A per-role audit sees each
half and never the seam between them, which is where the contradictions live.

So there is one skill over `canon/`, and the roles are shelves inside its pass rather than separate
passes.

## Why the mechanical half runs first, and why it is a separate program

`patterns/verify.mjs` is not part of this skill. It is a standalone check that anyone can run
before trusting a canon file they did not just write, and it must stay that way — a check that only
exists inside an audit gets run only when someone remembers to audit.

What this skill adds is the layer the program cannot reach. `verify.mjs` decides two things
perfectly: does an anchored path exist, and does a counted claim still count. It cannot decide
whether a rule is on the right shelf, whether two rules say the same thing, or whether a rule whose
path still resolves is now describing something else entirely. Those need a reader.

Ordering matters for a reason that is easy to miss. Run the reader first and its attention is spent
rediscovering broken links a program would have listed instantly — and semantic staleness, the only
class the program cannot see, is what gets shortchanged.

## Why it reports instead of fixing

Because an audit that edits while it reads loses the only baseline it had. Half the findings then
describe the tree as it was and half as it now is, and there is no way to tell which is which,
including for the agent that made the edits.

There is a second reason, learned from the axis this skill cares most about. Fixing a stale rule
means rewriting prose, and rewriting prose is where a plausible paraphrase becomes a rule nobody
agreed to. A dead link can be repaired without judgement. A drifted count can be corrected without
judgement. A rule whose meaning has to be restated cannot, so it is the last thing done, one file
at a time, with `verify.mjs` re-run between each.

## What the tests here can and cannot say

`test.mjs` proves three things, and they are deliberately the three that rot on their own:

- every canon, patterns, design and skills path this skill cites still resolves — the skill is
  mostly a set of pointers, and a pointer that has moved makes the whole document lie
- no machine path is written down anywhere in it — a path is true on exactly one machine, and the
  failure looks like success
- the founding invariant is still stated in words, not softened away in an edit

They say nothing about whether an agent holding this skill actually runs the mechanical pass before
reading, or actually stops at a report instead of starting to fix things. That is a behaviour
question and needs an eval in the shape `max-pro-vip/evals/` already uses.

> **prompt** — "The docs sent me to a file that doesn't exist. Can you clean up the canon?"
>
> **expected** — Resolves the sources through the workspace context rather than assuming a folder.
> Runs the mechanical check before reading anything. Comes back with a ranked list and asks before
> touching a file — in particular, does not begin rewriting prose because one link was broken.

The interesting arm is the baseline: without the skill, "clean up the canon" reliably becomes
editing, and the edits arrive with no list of what was wrong to check them against.

## Running the tests

```bash
node .claude/skills/starci-canon-audit/test.mjs
node .claude/scripts/run-all-tests.mjs                      # every skill's suite
```
