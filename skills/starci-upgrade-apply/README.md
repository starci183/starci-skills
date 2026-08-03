# Why this skill is shaped this way

## Why a plan half and an apply half

Deciding what a correction implies and writing that implication into a skill are different kinds of work,
and running them together is how an upgrade turns into an afternoon of edits nobody reviewed. The plan half
reads the pending corrections and proposes, for each, the skill it lands in and the shape of the fold. This
half lands those folds and proves them. The seam between them is the pending folder: everything the apply
needs to act is written in the correction file, so the apply can run in a different session, on a different
machine, from the plan.

## Why it edits the skill, not the output

The tempting move on feedback is to redo the thing that came out wrong. That fixes one artifact and leaves
the skill exactly as likely to repeat the miss. This half deliberately does the opposite: it changes the
skill — a rule in `skills/hooks/`, a step in a SKILL.md, a new gate under `scripts/gates/` — so the next
run is better without anyone in the loop. Redoing the design the feedback was about is the FE skill's job,
not this one's.

## Why a rule prefers a gate

A machine-checkable correction goes to `scripts/gates/` rather than to more prose. Prose a person must
remember to follow is the weakest kind of fix; a gate that fails the build is the strongest. The suite gets
stronger not by accumulating advice but by converting advice into checks.

## Why the correction is moved, never deleted

A correction is retired by moving it from `corrections/pending/` to `corrections/applied/`,
and the applied file is kept for good. Deleting it would erase the reason a skill reads the way it does, and
the next person to find the rule odd would have no way to see the case that produced it. Pending is the work
left; applied is the suite's memory of its own mistakes. The move is also the guard against folding the same
correction twice — a file still in pending is a fix still owed, whatever the diff already says.
