---
name: starci-upgrade-apply
description: The apply half of the upgrade loop — it takes the folds that starci-upgrade-plan proposed from the pending corrections and lands each one in the skill it targets, adding the rule to a SKILL.md or to `skills/hooks/`, fixing the step, writing the reference, then verifying with the skill's own test and moving the correction file from `corrections/pending/*.md` to `corrections/applied/`. Reach for it when a correction has been recorded and the change is decided: "upgrade the skills", "apply my feedback", "nâng cấp skills", "áp feedback đã ghi", "fold that correction in", "land the upgrade plan", "the layout skill keeps making the same mistake — fix the skill". It edits the skills themselves and moves the trail; it does not decide what to fold — that is starci-upgrade-plan, and a correction you would rather apply differently goes back there. Not for doing the design or build task the feedback is about (that is the FE skill named in the correction), and not for writing a new correction — a person records that beside the skill that missed.
---

# starci-upgrade-apply — fold feedback back into the skills

A correction lands twice or it did not land at all. The first time is the person saying it; the second
is the skill reading differently because of it. This half is the second time. The plan half read the
pending corrections and decided where each fold goes; here each fold is written into the skill, proved,
and the correction is carried from the pending pile to the applied one — the trail of how the suite
learned to read the way it does.

The correction file is not a task to close and forget. It is a scar. Moved into
`corrections/applied/`, it stays there for good, so the next person who finds a rule odd can read
the case that produced it. **An applied correction is never deleted.**

## Where the plan is

The input is the open correction files under `corrections/pending/*.md`, one correction per file,
each carrying the four things `starci-upgrade-plan` works from: what was corrected, why, the concrete
change to make, and `status: open`. The plan half named, for each, the skill it lands in and the shape of
the edit. Read that before touching a file — landing a fold the plan did not propose is the same mistake
as scanning inside an apply.

## Procedure

1. **Take one pending correction.** Open the oldest open file in `corrections/pending/` and read
   its whole row: the target skill, the reason, the change the plan proposed. A file with no target and no
   concrete change is not applicable — leave it in pending and say so, rather than inventing a fold for it.

2. **Place the fix where the plan put it.** A correction that applies to every FE skill goes into
   `skills/hooks/`; one about a single skill goes into that skill's SKILL.md or a file under its
   references; a rule a script could enforce becomes a gate under `scripts/gates/` and a `Checked by:`
   line, not more prose. Prefer the smallest edit that keeps the miss from recurring.

3. **Write it in the skill's own voice.** Match `canon/HOW-TO-WRITE.md` and the file around it — English,
   no emoji, a rule carrying its reason. Do not paste the correction as a story; encode the rule it
   implies. The correction is the evidence; the edit is the law it produces.

4. **Verify.** Run the edited skill's own `test.mjs`, and `node scripts/verify.mjs` if any canon path
   moved. A green test is the evidence the fold is coherent; a red one is a fold not yet landed, and the
   correction stays in pending until it passes.

5. **Move the correction to applied.** Only once the test is green, move the file from
   `corrections/pending/` to `corrections/applied/` — a move, not a copy, and not a delete.
   The pending folder is the work left; the applied folder is the memory. A correction fixed in the skill
   but left in pending gets folded a second time next session.

## What it does not do

It does not decide the fold. If the pending pile is empty, there is nothing to apply — say so rather than
polishing skills nobody asked to change. It does not perform the design or build the feedback was about; a
note that "the layout came out wrong" is folded into the layout skill, it does not rebuild the layout. And
it does not write new corrections — a person records those beside the skill that missed; this half reads
the pending files and retires them to applied.

## Constraints

Land the fold the plan proposed. A correction you would rather apply differently — a different target
skill, a rule you would word another way, a fold that turns out to belong in a gate instead of prose —
goes back to `starci-upgrade-plan`, which is cheap, rather than being redecided silently inside an edit
that claims to be applying an approved plan.

## Files

| Path | What it is |
|---|---|
| `corrections/pending/*.md` | the open corrections this reads, one per file — the input from the plan half |
| `corrections/applied/` | where each correction is moved once its fold is landed and green |
| `skills/hooks/` | where a correction that applies to every FE skill lands |
| `skills/starci-upgrade-plan/` | the half that reads the pending corrections and proposes the folds |
| `README.md` | why the loop is shaped this way |
| `test.mjs` | run after any change: `node .claude/skills/starci-upgrade-apply/test.mjs` |
