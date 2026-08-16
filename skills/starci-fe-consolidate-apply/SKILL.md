---
name: starci-fe-consolidate-apply
description: Carry out consolidation verdicts approved by starci-fe-consolidate-review, updating exactly the measured call sites and proving each still renders what it rendered. Use after Review approves merge, prop-variant or extract-composite groups and their production boundary.
---

# StarCi FE Consolidate Apply

Read [`../../skill-shape.md`](../../skill-shape.md) first.

Whether two owners are the same thing was already settled. Reopening it here would put one judgement
in two places, and the version that wins would be whichever is held by whoever is currently in the
files.

The promise is narrow and total: **ownership changes, the render does not.** That is
[`refactor-parity`](../../fe/governance/refactor-parity/INDEX.md), and it is the only thing this half is judged
on.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Require a user-declared `Project` or explicit `Frontend` and `Backend`, then resolve `Frontend` for this phase; never infer it from `Source` or `App`.

Print the table, then **confirm `Repo / branch` and `Touching` with the user before the first edit.**

Read the approved `## review` in the task file. No approved verdicts means
`$starci-fe-consolidate-review` has not finished. A group
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
[`../starci-fe-design-review/references/state-coverage.md`](../starci-fe-design-review/references/state-coverage.md)
before recording a call site as unproven: parity here is proved by images, so the camera failing is
the one failure this half must not accept on the first try.

Green tests are not the proof, and saying so is the point of the half: no unit test knows what a
screen looked like yesterday, so a merge that quietly restyles one caller passes all of them.

When a measured call site is authenticated or runtime-backed, follow
[`../starci-fe-design-review/references/live-flow-proof.md`](../starci-fe-design-review/references/live-flow-proof.md).
Use the declared app's authorized test account, run the real affected flow, inspect UI, Network,
Console and frontend/backend terminal output, and append `### LIVE FLOW PROOF`. Never record a
credential or token. An unexplained failed request, console error or terminal error breaks parity
even when before/after screenshots look equal.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. `OUTPUTS` names the consolidated concepts; `CHANGES` details every
written path and measured call site. Append `## apply` with parity evidence and owed proof.
