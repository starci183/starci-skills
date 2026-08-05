---
name: starci-arch-sync-apply
description: Carries out an approved architecture-sync proposal against another repository - ports the enforcement plugin and its commit gate, burns each rule's debt down one rule per commit, and flips a rule from warn to error only when its count reaches zero, verifying with the target's own checks rather than with the plan's predictions. Reach for it once a sync has been planned and approved and the work is to make the target actually obey, "apply the sync plan", "port the lint layer to that repo now", "burn down the debt we measured", "thực thi kế hoạch đồng bộ kiến trúc", "cắm lint rules sang repo kia và dọn nợ", "make that repository pass our gates", "run the migration we agreed". It executes an existing proposal and does not decide scope - measuring the distance and sequencing the work is starci-arch-sync-plan, and a proposal that has not been approved is not a licence to start. Not for authoring canon (starci-canon-audit), and not for writing code inside this repository (starci-be-cannon-apply).
---

# Carrying an approved sync into another repository

The plan decided what and in which order. This half does it, and its whole discipline is refusing to
improvise: the expensive failures in a migration are not the edits, they are the moments somebody
decided mid-flight that a rule could land early, that a build passing meant the change was safe, or that
a number could be reported without running the command.

**One rule per commit.** Not one phase, not one afternoon's work. When something breaks two days later
the only cheap question is which rule did it, and that question is only cheap if the history answers it.

## Before the first edit

Read the approved proposal and the canon it cites - `canon/be/INDEX.md` and the shelf index
`canon/be/enforce/authoring/INDEX.md` for a back end, `canon/fe/README.md` for a front end. Where a fix
touches where code lives rather than how it is spelled, `canon/be/sourcetree.md` governs.

Then re-measure. The proposal was true when it was written; the target has had commits since. If a
count has moved materially, or a file the proposal names is gone, **stop and say so**. A proposal
executed against a repository that has moved underneath it produces a diff nobody planned.

Capture the baselines the proposal names, again, now. Every later claim is relative to these numbers,
not to the ones in the document.

Check the branch. The target's branch is the target's business and is stated in the proposal; it is
never assumed from the repository this skill lives in.

## Land the instrument first

The plugin and its configuration go in with every rule at `warn`, in one commit, before any violation
is touched. Then the commit gate - the pre-commit hook running the linter over staged files only, so
untouched history never blocks a commit while the file being touched must be clean.

Nothing is at `error` yet. A rule at `error` with debt blocks every commit that so much as opens an
offending file, including the commits that were going to fix it.

## Then, one rule at a time

For each rule, in the sequence the proposal set:

1. Measure it. The count comes from the rule.
2. Fix the violations. Fix the code to satisfy the rule - do not weaken the rule to satisfy the code,
   and do not reach for the suppression comment. If a rule turns out to punish code that is correct,
   the rule is the defect: stop, amend it in the canon repository, and record that the pile was
   misjudged.
3. Re-measure. At zero, flip the rule to `error` and write the count into its trailing comment. Above
   zero, leave it at `warn` with the real number - never the number the plan predicted.
4. Commit, naming the rule and its before and after.

Do not batch. Two rules in one commit is one bisect nobody can do.

## What proves it, and what only looks like proof

Run what the proposal named, and know what each one can see.

A type-check and a build prove that names resolve. **They cannot see a provider that stopped resolving.**
When a rule's fix removes wiring - an import deleted because something is registered globally elsewhere -
the failure mode is a container that will not start, and it appears at runtime. Only running the
application, or an end-to-end suite that boots it, catches that. Do not offer a green build as evidence
for that class of change.

Before removing any wiring, verify the thing it provided is genuinely reachable without it, in every
application that composes the code being changed. A repository with one application makes this cheap;
one with eight makes it the whole job. A registration carrying configuration is not interchangeable with
a global one that carries different configuration - the two compile identically and behave differently.

Report the numbers actually seen. If a command was not run, say which and why. A count copied from the
proposal into a report is a fabricated measurement.

## Comments are part of the change

When wiring is removed, the comment that described it becomes false. A JSDoc that still says a module
imports something it no longer imports will be believed by the next reader, and it is cheaper to fix in
the same commit than to discover later. The same goes for a debt count in the configuration: after a
burn-down it states the new number, and why anything left cannot simply be deleted.

## When to stop and hand back

Stop and report rather than improvise when: the re-measure disagrees materially with the proposal; a
rule punishes correct code; a fix would need a decision the proposal did not settle; or a check the
proposal named cannot be run in this environment. Each of those is a finding. Carrying on past one of
them produces a migration whose reasoning nobody can reconstruct.

The planning half is `skills/starci-arch-sync-plan/SKILL.md`. A finding goes back there, not into an
improvised change of course here.
