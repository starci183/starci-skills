---
name: starci-fe-cta-and-link-apply
description: Builds an approved CTA and link proposal into the real front end — re-reading each finding's call site before touching it, fixing the ones that live in a single component (mechanism copy rewritten as an outcome, a second primary demoted, a plain-text mention wired to a real reference link, a deep link given the intent the surface already knows, an invented fallback number deleted), routing the ones that need a shell or a cross-surface funnel out to the layout lane, verifying every changed surface against the contract and a click-through, and recording what was fixed, what was routed and what turned out to be a false positive so the next scan does not raise it again. Reach for it once a proposal exists and has been approved: "apply the CTA proposal", "build the funnel fixes we agreed", "fix the dead-end empty states from the audit", "chốt sửa CTA/link", "apply CTA fix", "sửa phễu đã chốt", "make the changes from cta-link-learn". Not for finding the problems — that is the sibling starci-fe-cta-and-link-scan, and a defect not in the proposal goes back there rather than being fixed on the way past.
---

# CTA and link apply

The scan half produced a document; this half turns it into a diff. The document is what makes that
safe, and the discipline that keeps it safe is narrow: **the proposal is the spec, and a finding that
is not in it is not fixed here.**

That reads like bureaucracy until the alternative is priced. An apply pass that fixes what it
notices along the way produces a diff nobody approved, mixed with one they did, in a review where
they can no longer be told apart — and the audit trail that let the two halves run in different
sessions is gone. Something new and real gets recorded as a finding and scanned properly. Something
new and small gets recorded too; small is not the same as approved.

## Where the source is

```bash
node .claude/scripts/read-workspace-context.mjs fe.path
node .claude/scripts/read-workspace-context.mjs fe.design_system
node .claude/scripts/read-workspace-context.mjs be.path
```

Resolve them at the start of the session rather than trusting a path the proposal or the earlier
conversation carried — [`skills/starci-setup-workspace-fe/SKILL.md`](../starci-setup-workspace-fe/SKILL.md)
explains why a remembered path fails silently rather than loudly.

## Before the first edit

Open `proposals/BACKLOG.md`, take one pending `cta-link-<scope>` entry, and move it to in-progress
before starting. That line is the only thing standing between two sessions doing the same batch
twice.

Then read the proposal and, for every finding in it, **re-read the call site**. The scan may be days
old; the component may have been rewritten, the copy already fixed, the whole surface deleted. Three
outcomes are legitimate at this point, and each has to be recorded rather than quietly acted on: the
finding still stands, the finding is already resolved, or the finding was wrong — usually because a
relationship the scan assumed in the data does not exist. A false positive is closed as a false
positive, with the reason. Deleting it leaves the next scan free to raise it again.

## The three routes

Every finding arrives carrying a route from the scan. Confirm it still holds against the source in
front of you, then follow it.

**1. Fixed in place.** The large majority. Copy rewritten from mechanism to outcome; a second primary
demoted so one action leads; a plain-text entity mention wired to the app's real reference link with
an honest fallback when it cannot resolve; a deep link pointed at the module the surface already
identified rather than at a general page; a fabricated fallback number removed so the component shows
nothing rather than something untrue. These are edits inside one component. Spell them the way the
rest of the tree is spelled — [`canon/fe/authoring/INDEX.md`](../../canon/fe/authoring/INDEX.md)
decides that, and nothing about being an "audit fix" exempts a line from it. In particular, do not
hand-roll a new primitive inside a block to get the fix done; that trades one finding for a worse one.

**2. Routed to the layout lane.** A finding is layout-level when it cannot be satisfied without
moving a region, changing a shell, or adding a path that spans surfaces: an onward route that does
not exist anywhere in the flow, a primary action sitting in the wrong zone rather than merely the
wrong rank, a resume that lands outside the scope of its own surface. Do not force these in from
here. Mark the finding as routed, leave it pending in the backlog, and take it up through
[`skills/starci-fe-layout-brainstorm/SKILL.md`](../starci-fe-layout-brainstorm/SKILL.md) and the apply
half that follows it — or, if there is appetite to widen the session, say so and open that lane
deliberately.

**3. Built in the design system first.** When the fix needs a component that does not exist, or a
state of one that was never storied, it does not start in the app. **No component reaches the app
that was never a component and a story in the design-system folder first** —
[`canon/fe/architecture.md`](../../canon/fe/architecture.md), with the story's obligations in
[`design/storybook/architecture/story.md`](../../design/storybook/architecture/story.md) and coverage
held by [`patterns/fe/gates/check-story-coverage.mjs`](../../patterns/fe/gates/check-story-coverage.mjs).
Author it under `fe.design_system`, story it with its full state matrix, then bring it across as a
twin with `starci-fe-sync`. A reference link component invented directly in `src` because it was
"only needed here" is the exact shape that gate exists to stop.

## Verifying

Per surface changed, not once at the end.

1. `npx tsc --noEmit` and the linter, clean.
2. The contract — the rendered-tree runner and the source-reading gates, through
   [`skills/starci-fe-contract/SKILL.md`](../starci-fe-contract/SKILL.md). A demoted button and a
   moved link both change the rendered tree, so this is not a formality.
3. A click-through of the actual surface, in every state the finding named. The action fires where
   the proposal said it would; the secondary reads as subordinate; the link and the deep link arrive
   where they claimed; the empty state offers a way out. This is the only check that can tell whether
   the finding was actually addressed rather than merely edited, because the defect was never visible
   in the file to begin with.

If a finding touched a loading or empty state, the skeleton has to move with it — a layout change
that leaves its skeleton describing the old shape is a new defect, and `starci-fe-skeleton-apply`
owns that lane.

## Closing out

1. Mark the proposal done in `proposals/BACKLOG.md` with the date, and mark each fixed finding done
   in `proposals/cta-link-<scope>.audit.md`. The ledger is what lets the next scan pick up the next
   batch instead of re-deriving the whole list.
2. **Record the outcome, in three groups**: fixed, routed elsewhere and still open, dropped as a
   false positive with the reason. This is the part that is skipped and the part that pays. Without
   it the next scan re-raises the routed findings as new, re-raises the false positives as real, and
   the second audit costs as much as the first.
3. If the work settled a general judgement rather than one call site — a copy pattern, a rule about
   where a primary action belongs — that belongs in canon, written the way `canon/HOW-TO-WRITE.md`
   requires: a rule that names the files it was read from and the day it was measured.
4. Anything knowingly left undone is debt, not silence. `starci-record-debt` takes the files, the
   rule and the reason it was deferred; a finding dropped without a record is indistinguishable later
   from one nobody ever noticed.

## What this skill does not do

It does not add findings. It does not restructure a shell to make a fix land. It does not "tidy while
here". And it does not treat a green type check as evidence that a conversion defect was fixed — the
whole class of problem this pair exists for is type-valid, lint-clean and renders fine.

## Files

| Path | What it is |
|---|---|
| `proposals/cta-link-<scope>-<batch>.proposal.md` | the spec this pass builds |
| `proposals/cta-link-<scope>.audit.md` | the full ledger, updated as findings close |
| `proposals/BACKLOG.md` | the queue, and the only place that says what is done |
| `README.md` | why this skill is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-fe-cta-and-link-apply/test.mjs` |
