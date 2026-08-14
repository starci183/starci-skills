---
name: starci-fe-consolidate-apply
description: Carry out an approved consolidation survey — merge the duplicate owners, add the one named variant prop, or extract the shared shape as a composite — updating every measured call site and proving each one still renders exactly what it rendered. Use it after starci-fe-consolidate-plan records approved verdicts: "gộp lại đi", "apply the consolidation plan", "làm theo bảng vừa duyệt", "merge those two cards now". Inherits the survey's clusters and call sites and may not widen them. Not the half that decides what is duplicated — that is starci-fe-consolidate-plan, and a cluster it never approved cannot be applied here.
---

# StarCi FE Consolidate Apply

This half carries out a decision that has already been made. Whether two owners are the same thing
was settled and approved in the survey; reopening it here would put one judgement in two places, and
the version that wins would be the one held by whoever is currently in the files.

The promise is narrow and total: **ownership changes, the render does not.** Every call site the
survey measured still shows what it showed. That is [`refactor-parity`](../../fe/design/refactor-parity.md),
and it is the only thing this phase is allowed to be judged on.

## Context, confirmation and admission

Read [`../../CONTEXT-LOCK.md`](../../CONTEXT-LOCK.md) and the survey's context record. Redetect,
print the lock and any drift, persist `context-lock.consolidate-apply.md/json` with
`status: awaiting-confirmation`, then stop for explicit confirmation of target repository, branch,
worktree and exact writable files. No edit happens before that confirmation.

Proceed only from an approved survey. Validate it before touching anything:

```powershell
node <trust-root>/skills/starci-fe-consolidate-plan/scripts/verify_consolidation_plan.mjs <consolidation-plan.json>
```

A missing survey is not a bare absence to report: name `$starci-fe-consolidate-plan` as the thing
that produces it and what it will measure, per [`../../handoff.md`](../../handoff.md). A cluster the
survey recorded as `keep-apart` is a finding, not a backlog item: it cannot be applied here, and
changing that verdict means going back to the survey with the new evidence named.

Read [`references/steps-table.md`](references/steps-table.md),
[`references/consolidation-record.md`](references/consolidation-record.md),
[`props-and-slots`](../../fe/canon/patterns/props-and-slots.md) and the layer files under
[`../../fe/canon/uxui/layers/`](../../fe/canon/uxui/layers/).

## Apply one cluster at a time

Never batch clusters into one diff. A parity failure inside a batch cannot be attributed to the
cluster that caused it, and the whole batch then has to be unpicked to find out.

Work only inside the inherited cluster and its measured call sites. Widening the set mid-edit is
scope creep discovered too late to review; narrowing it is a caller left behind. If the work reveals
a call site the survey missed, that is a survey that was wrong — name that call site and put the
correction back to the survey rather than quietly extending the diff.

That return is scoped to the cluster whose measurement was wrong. Clusters are applied one per diff
precisely so they are independent, so every other approved cluster is applied and proved while the
mismeasured one goes back. Sending the whole approved set back for one missed call site charges a
single correction as the entire survey redone.

An added prop preserves owner, semantic slot, absence and default, precedence and every existing
caller, and it is the ONE prop the survey approved. It is never `className`, `style` or another
appearance hook: [`SLOTS-6`](../../fe/canon/patterns/props-and-slots.md) refuses the appearance slot
because a caller who can restyle a node has become its second owner.

Delete the superseded owner and its story in the same change. An orphan left behind is a second word
for the thing that now has one word, and the next survey will find it and rank it again.

## Prove nothing moved

Render every measured call site before and after in the same state — same route, viewport, locale,
theme, persona and fixture. Then run focused tests, typecheck, strict lint and the build, and seal:

```powershell
node <trust-root>/skills/starci-fe-consolidate-apply/scripts/verify_consolidation_record.mjs <consolidation-record.json> --seal
node <trust-root>/skills/starci-fe-consolidate-apply/scripts/verify_consolidation_record.mjs <consolidation-record.json>
```

It refuses a cluster the survey never approved, a pair the survey kept apart, a call-site set that
was widened or narrowed, a call site with no before-and-after render, a render that changed, and a
superseded owner left in place.

Green tests are not the proof here, and saying so is the point of the phase: no unit test knows what
a screen looked like yesterday, so a merge that quietly restyles one caller passes all of them.
Report clusters applied, call sites touched, parity per call site, and anything the survey got wrong.

This half invites nothing after it, so its close is the item form itself. Hand it over as ONE pass,
sorted by who can clear each line, per [`../../handoff.md`](../../handoff.md): what the run already
handled, each DECISION with the default in force, each RESOURCE with the command that supplies it,
and each SUB-RUN with the skill that owns it. A render the browser refused is not a
finding until the fallback in
[`../starci-fe-design-preview/references/state-coverage.md`](../starci-fe-design-preview/references/state-coverage.md)
has also failed — parity here is proved by images, so the phase that cannot take one has to try the
other camera before it reports a call site as unproven.
