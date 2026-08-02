# Why this skill is shaped this way

## Why a ledger instead of memory

A correction held in someone's head is applied unevenly and lost when they move on. Written into
`skills/corrections.md`, it becomes a thing a skill can be measured against and a thing this skill can act
on mechanically. The ledger is what turns "you told me this before" from an accusation into a bug report
with a fix.

## Why upgrade edits the skill, not the output

The tempting move on feedback is to redo the thing that came out wrong. That fixes one artifact and leaves
the skill exactly as likely to repeat the miss. This skill deliberately does the opposite: it changes the
skill — a rule in `prompt.md`, a step in a SKILL.md, a new gate under `scripts/gates/` — so the next run is
better without anyone in the loop. The output the feedback was about is the design skill's job to redo, not
this one's.

## Why a rule prefers a gate

Step 2 sends a machine-checkable correction to `scripts/gates/` rather than to more prose. Prose a person
must remember to follow is the weakest kind of fix; a gate that fails the build is the strongest. The suite
gets stronger not by accumulating advice but by converting advice into checks.

## Why applied entries are kept

Deleting an applied correction would erase the reason a skill reads the way it does, and the next person to
find the rule odd would have no way to see the case that produced it. The ledger is append-mostly: entries
flip from open to applied, and the applied ones are the suite's memory of its own mistakes.
