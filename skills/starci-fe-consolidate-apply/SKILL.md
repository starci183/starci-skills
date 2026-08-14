---
name: starci-fe-consolidate-apply
description: Carry out approved consolidation verdicts — merge the duplicate owners, add the one variant prop, or extract the shared shape — updating every measured call site and proving each still renders what it rendered. Use after starci-fe-consolidate-plan records verdicts in the task file: "gộp lại đi", "apply the consolidation plan".
---

# StarCi FE Consolidate Apply

Read [`../../skill-shape.md`](../../skill-shape.md) first.

Whether two owners are the same thing was already settled. Reopening it here would put one judgement
in two places, and the version that wins would be whichever is held by whoever is currently in the
files.

The promise is narrow and total: **ownership changes, the render does not.** That is
[`refactor-parity`](../../fe/design/refactor-parity.md), and it is the only thing this half is judged
on.

## SCOPE

Print the table, then **confirm `Repo / branch` and `Touching` with the user before the first edit.**

Read `## plan` in the task file. No verdicts means `$starci-fe-consolidate-plan` has not run. A group
recorded `keep-apart` cannot be applied here; changing that verdict means going back with new
evidence.

## PROCESS

**One group per diff, never batched.** A parity failure inside a batch cannot be attributed to the
group that caused it, and the whole batch then has to be unpicked to find out.

Work only inside the group and its measured call sites. Widening the set mid-edit is scope creep
discovered too late to review; narrowing it leaves a caller behind. A call site the survey missed
means the survey was wrong — name it and put that one correction back, while every other approved
group is applied and proved meanwhile.

An added prop preserves owner, semantic slot, absence and default, precedence and every existing
caller, and it is the ONE prop the survey approved. Never `className`, `style` or another appearance
hook.

Delete the superseded owner and its story in the same change. An orphan left behind is a second word
for the thing that now has one word, and the next survey will find it and rank it again.

**Prove nothing moved.** Render every measured call site before and after in the same state — same
route, viewport, locale, theme, persona and fixture. Then typecheck, lint, focused tests and build.
When the browser refuses to composite, take the fallback in
[`../starci-fe-design-preview/references/state-coverage.md`](../starci-fe-design-preview/references/state-coverage.md)
before recording a call site as unproven: parity here is proved by images, so the camera failing is
the one failure this half must not accept on the first try.

Green tests are not the proof, and saying so is the point of the half: no unit test knows what a
screen looked like yesterday, so a merge that quietly restyles one caller passes all of them.

## OUTPUT

The four tables. Append `## apply` to the task file: the SCOPE table, groups applied,
**every file written**, parity per call site, the green commands, and anything the survey got wrong.

Compare that file list against `## plan` above it — a file the verdicts never named is visible
immediately.
