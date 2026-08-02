---
name: starci-upgrade
description: Reads the feedback ledger at skills/corrections.md and folds each open correction back into the skill it targets, so a miss the user pointed out once is fixed in the skill rather than remembered. Reach for it whenever feedback has accumulated or the user asks the suite to learn from a correction: "upgrade the skills", "apply my feedback", "nâng cấp skills", "áp feedback đã ghi", "fold that correction in", "the layout skill keeps making the same mistake", "revise the skills from the ledger". It edits the skills themselves — a SKILL.md, prompt.md, or a reference — verifies each with the skill's own test, and marks the ledger entry applied. Not for doing a design or build task (that is the FE skill the feedback is about), and not for recording a new correction (append it to skills/corrections.md by hand first); this skill consumes the ledger, it does not write to it except to flip an entry to applied.
---

# starci-upgrade — fold feedback back into the skills

A correction a person gives once is a correction the suite should never need again. This skill is the
second half of the loop `skills/prompt.md` sets up: feedback is recorded in `skills/corrections.md`, and here it
is folded into the skill it belongs to, so the skill reads differently next time rather than depending on
anyone remembering.

## Procedure

1. **Read the ledger.** Open `skills/corrections.md` and take every entry whose status is `open`, newest first.
   An entry with no target skill and no concrete change is not actionable — leave it open and say so.

2. **For each open entry, place the fix.** The entry names where it lands. A correction that applies to
   every FE skill goes into `skills/prompt.md`; one that is about a single skill goes into that skill's
   SKILL.md or a file under its `references/`; a rule that a script could enforce becomes a gate under
   `scripts/gates/` and a `Checked by:` line, not more prose. Prefer the smallest edit that keeps the miss
   from recurring.

3. **Apply it in the skill's own voice.** Match `canon/HOW-TO-WRITE.md` and the surrounding file — English,
   no emoji, a rule with its reason. Do not restate the correction as a story; encode it as the rule it
   implies.

4. **Verify.** Run the affected skill's `test.mjs` (and `node scripts/verify.mjs` if canon paths changed).
   A green test is the evidence the edit is coherent; a red one is the entry not yet applied.

5. **Close the entry.** Flip its status in `skills/corrections.md` from `open` to `applied`. Do not delete it —
   the applied entries are the record of how the suite learned to read the way it does.

## What it does not do

It does not invent feedback. If the ledger is empty, there is nothing to upgrade — say so rather than
polishing skills nobody asked to change. It does not perform the design or build the feedback is about; a
note that "the layout came out wrong" is folded into `starci-fe-layout-apply`, it does not rebuild the
layout. And it does not write new corrections into the ledger — a person does that; this skill only reads
them and marks them applied.

## Files

| Path | What it is |
|---|---|
| `skills/corrections.md` | the ledger this reads and flips to applied |
| `skills/prompt.md` | where a correction that applies to every FE skill lands |
| `README.md` | why the loop is shaped this way |
| `test.mjs` | run after any change: `node .claude/skills/starci-upgrade/test.mjs` |
