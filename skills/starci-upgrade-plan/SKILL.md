---
name: starci-upgrade-plan
description: Reads every open correction under corrections/pending/, groups them by the skill each one targets, and decides the fold for each — which rule lands in a single skill's SKILL.md or a file under its references, which is a house rule that belongs in skills/hooks/README.md because it binds every FE skill, and which is a duplicate of a miss already grouped — then writes that as one proposal, grouped by target, without editing a single skill file. Reach for it whenever corrections have piled up and the question is where each one goes rather than how to make the edit: "plan the upgrade", "what does the feedback change", "group the pending corrections", "which skill does this note belong to", "lên kế hoạch fold feedback", "gom các correction đang chờ", "is this a skills/hooks/README.md rule or a one-skill rule", "read the ledger and tell me the fold", "sort the corrections before we apply them". It reads and groups only; the mechanical half — making the edits, running each skill's test, moving the correction to applied — is starci-upgrade-apply. Not for recording a new correction (a person writes that into corrections/pending/ by hand, in the format corrections/README.md sets out), and not for doing the design or build task the feedback is about — that is the FE skill named in the correction, not this one.
---

# Reading the corrections, planning the fold

A correction is evidence, not an instruction list. A person told a skill "not like that" once, and the
useful output of reading the pile is the sentence that says *where that miss lives* — which skill owned
the decision, and whether the fix belongs to that one skill or to all of them. A count of open
corrections is not a plan; the plan is the placement.

The expensive mistake is the one a diff cannot show, and it is why this half exists on its own. Fold a
correction into the wrong skill and the miss recurs in the skill that actually made it, while a skill
nobody complained about grows a rule it never needed. Scatter one miss across three skills and the next
person to read any of the three cannot tell it was a single note. Write a house rule — one that binds
every FE skill — into a single SKILL.md, and the other skills keep making it. So the plan spends its
effort on the judgement the apply cannot re-derive: *which skill, and one or all* — and hands the edit,
which is mechanical once the placement is decided, to the apply.

**The plan writes a proposal and changes no skill file.** Editing while reading destroys the thing the
proposal is for: a reviewed placement that a second person can argue with before any SKILL.md moves. A
plan that has already edited is not a plan, it is an unreviewed apply.

## The loop this sits inside

`skills/hooks/README.md` sets up the loop and `corrections/README.md` is its ledger: a person writes each
correction down so the miss is fixed once, in the skill, rather than remembered. This skill is the first
half of folding that ledger back — it decides the placement; `skills/starci-upgrade-apply/SKILL.md` makes
the edit and closes the entry. The correction files live under `corrections/pending/`, one open
correction per file, and move to `corrections/applied/` only after the apply has folded them in.

## 1. Read every open correction

Open each file under `corrections/pending/` and read it whole — the miss, the reason it was wrong,
and the change its author proposed. The format is the one `corrections/README.md` sets out: a correction
names the skill it targets, so most placements are read off the entry rather than guessed. An entry that
names no target skill and proposes no concrete change is not actionable — leave it in pending and say so
in the proposal, rather than inventing a home for it.

Read the reason, not only the fix. A correction whose author wrote "add this line to the layout skill" may
be describing a house rule that every FE skill needs; the reason is what tells the two apart, and the
placement follows the reason.

## 2. Group by the skill each targets

Gather the corrections that name the same skill. A group is a claim that these misses all belong to one
place, and it is what makes the proposal reviewable: a person reads the layout skill's group and decides
its edits together, rather than meeting the same skill three times in an ungrouped list.

Two corrections that name the same skill are not automatically the same miss. Read them against each
other before merging: the same rule restated twice is one fold recorded once — a second identical note
means the loop failed to upgrade, which the proposal flags rather than folds again. Two different misses
in one skill stay two folds under one group.

## 3. Decide the fold for each

Every correction gets exactly one placement, and the proposal names which of three it is.

**A single-skill rule** lands in that skill's `SKILL.md`, or in a file under its `references/` when the
rule is long enough to weigh the SKILL.md down. This is the common case: the miss was made by one skill
and the fix reads only there.

**A house rule** lands in `skills/hooks/README.md`. The test is the reason, not the wording: if the correction
would be true of `starci-fe-layout-plan`, `-review-plan`, `-consolidate-plan` and the rest alike, it is
the house talking, and writing it into one skill leaves the others uncorrected. `corrections/README.md`
states this directly — a correction that applies to every FE skill belongs in `skills/hooks/README.md` — and the
proposal cites the entry that says so.

**A duplicate** of a miss already grouped is recorded as a duplicate, not folded a second time. Two
entries pointing at one miss is a bug in the loop, and the proposal names both so the apply closes both
against the single fold.

Prefer the smallest placement that keeps the miss from recurring. A rule a script could enforce is
noted as a candidate gate under `scripts/gates/` rather than more prose — but the plan only names it;
writing the gate is the apply's to do.

## 4. Write the proposal

The proposal is one document — `upgrade-plan.md` — written beside the corrections it groups, under
`corrections/`. It is grouped by target skill, and for each group it lists the corrections folded
there, the placement decided for each (SKILL.md, a named reference, `skills/hooks/README.md`, or duplicate-of), and
the exact edit the apply will make. A correction left in pending because it named no target is listed too,
with the reason it could not be placed.

The proposal changes no skill file. It is the reviewed plan the apply reads before it edits anything, and
it reads the same in a session next month — which is the whole reason the placement is written down rather
than carried in someone's head from reading to editing.

## 5. Apply the skill's own voice — in the proposal, as a plan

The edits the proposal describes must be written in the target skill's register: match
`canon/HOW-TO-WRITE.md` and the surrounding file — English, no emoji, a rule stated with its reason, the
correction encoded as the rule it implies rather than retold as a story. The plan states *what* that edit
is; the apply makes it. Writing the finished prose here and the apply merely pasting it is acceptable;
folding it into the skill file here is not.

## Offering the apply

Finish by asking whether to fold the proposal now. Agreement moves straight to
`skills/starci-upgrade-apply/SKILL.md`, which makes each edit, runs the affected skill's test, and moves
the correction from `corrections/pending/` to `corrections/applied/`. A no costs nothing:
the proposal is the handover, and it holds.

## Common mistakes

- **Placing on the wording instead of the reason.** A correction that says "fix the layout skill" can be
  a house rule; the reason it was wrong is what decides between `skills/hooks/README.md` and one SKILL.md.
- **Folding the same miss twice.** Two entries on one miss is a loop bug to flag, not two folds to write.
- **Writing a house rule into one skill.** If it binds every FE skill, it belongs in `skills/hooks/README.md`, and one
  SKILL.md leaves the rest uncorrected.
- **Inventing a home for an unactionable entry.** A correction with no target and no concrete change stays
  in pending, named in the proposal, not folded somewhere plausible.
- **Editing a skill while planning.** The plan changes no skill file; a plan that already edited is an
  unreviewed apply.

## What the plan may not do

No SKILL.md, no `skills/hooks/README.md`, no reference and no gate is edited. No correction is moved from
`corrections/pending/` to `corrections/applied/`. Reading a correction makes its fix look
obvious and cheap, and it usually is — make it in the apply, where the edit is verified against the
skill's own test and the entry is closed, rather than as a side effect of a plan that reports having
changed nothing.

## Files

| Path | What it is |
|---|---|
| `corrections/pending/` | the open corrections this reads, one per file |
| `corrections/applied/` | where the apply moves each, after folding it in |
| `corrections/README.md` | the format an entry is written in, and the house-rule test |
| `skills/hooks/README.md` | where a correction that binds every FE skill lands |
| `skills/starci-upgrade-apply/SKILL.md` | the half that makes the edits and closes the entries |
| `canon/HOW-TO-WRITE.md` | the voice and grounding every folded rule matches |
| `README.md` | why this half is separate from the apply |
| `test.mjs` | run after any change: `node .claude/skills/starci-upgrade-plan/test.mjs` |
