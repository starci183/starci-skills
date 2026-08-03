# Why this skill is shaped the way it is

Notes for whoever changes it. `SKILL.md` is the interface; this is the reasoning behind it.

## Why planning is a separate skill from applying

The two halves fail in opposite directions, and one skill can only be tuned for one of them.

Reading the corrections is cheap, wide and reversible: opening the whole pending folder costs nothing,
and a wrong placement costs a line in a proposal a reviewer catches. The edit is narrow and it changes
the skills themselves — the thing every future run reads. Written as one skill, the edit sets the tempo,
and the placement gets decided in the same motion that commits it, which is exactly the motion nobody
reviews. Split, the placement becomes a document: grouped by skill, argued with, corrected before a
single SKILL.md moves.

The deciding reason is which judgement is hard. Once a correction's home is known, the edit is
mechanical — add the rule, run the test, move the file. What is not mechanical is *which skill owns the
miss, and whether it is one skill or the house*. That is the judgement worth reviewing on its own, and
coupling it to the edit hides it inside a diff.

## Why the reason decides the placement, not the wording

A correction's author writes down a fix in the terms of the skill in front of them — "add this to the
layout skill" — because that is the skill that just missed. But the same miss is often the house
talking: a rule that would be true of every FE skill, written into one because one is where it surfaced.
The reason the correction was wrong is the only thing that separates a single-skill rule from a house
rule, so the plan reads the reason and places on it. `corrections/README.md` states the rule directly —
a correction that binds every FE skill belongs in `skills/hooks/README.md` — and the plan's job is to notice when an
entry written as one-skill is really that.

## Why one miss must not be folded twice

The whole point of the ledger is that a correction is needed once. Two pending entries pointing at one
miss means the loop already failed — the skill was not upgraded the first time — and folding both would
write the same rule twice and paper over the failure. So the plan groups duplicates as duplicates and
names them, and the apply closes both against the single fold. A duplicate is a signal about the loop,
not a second unit of work.

## Why the proposal, and why it changes nothing

The tempting move on a pile of corrections is to fold them as you read. That commits every placement
unreviewed, and a wrong one is discovered later by someone who was not there when it was decided. The
proposal is the opposite: a placement written down, grouped by target skill, that a second person reads
before any skill file moves. It is also the handover — the apply reads it rather than re-deriving the
placements — so the reading is done once and the edit trusts it.

## What the tests cannot cover

Whether an agent holding this skill reaches for it when corrections have piled up, rather than editing a
skill straight from a note in its head. That is a property of the description, not the body, and only an
eval measures it.

What the suite does check is narrower and still worth having: that every path the skill sends a reader to
still resolves, that no machine-specific path was baked in, and that the founding invariant — it writes a
proposal and changes no skill file — is present in words a reader can quote back. The first is the one
that breaks: the sibling skills and the corrections folder get renamed, and a skill pointing at a moved
file teaches its reader that none of its references can be trusted.
