# starci-fe-review-apply — notes

`SKILL.md` says what to do. This file says why it is shaped this way. Read it before changing
anything here.

## Why the adjustment lane lives here

"Move that a bit", "shorten this label", "the ring is invisible on the dark surface" — the small
adjustment to a surface that already exists is the most common request there is, and for a long time
it had no lane. Two homes were tried and both were wrong in an instructive way.

Giving it to the **build** skills turned them into general-purpose editors. A skill whose job is to
author a component and its story, and which also accepts "just nudge this", loses the property that
made it useful: everything it produces went through the design system. The nudges did not, because
nudges never feel like they need to.

Giving it to **nobody** was worse. An adjustment with no lane is an adjustment with no verification:
nobody reads the other locale after shortening a label, nobody tabs through after touching a ring,
nobody resizes after changing a class. Those are exactly the three checks this skill already runs
for a review finding.

So the adjustment sits with the review fixes, because it is the same shape of work — a bounded
change to a piece that already exists — and it inherits the same procedure and the same proof. The
only real difference is where the reason comes from: a proposal, or the sentence someone just said.
Writing the reason down before the edit is what keeps the second case from becoming a free hand.

## The refusals are the skill

Most of what this file does is decline things, and each refusal is there because the alternative has
a known failure:

**A finding that is not in the proposal.** Fixing it on the way past leaves the ledger describing a
tree that no longer exists, and the next scan re-raises what was already handled or misses what was
quietly changed.

**A class on a block to correct its appearance.** `canon/fe/architecture.md` explains the mechanism
better than a summary would: the escape hatch produces an undocumented variant living at one call
site, and five of those is five files nobody can find. Dropping one tier is more work in the moment
and the only version that other screens inherit.

**A component that does not exist yet.** Storybook first is not a preference about tooling. A
component authored inside a review fix has no story, so it has no state matrix, so its empty and
error states are the ones the next review will find. The fix that stays here lands on a piece
already in the system.

## Say what you did not do

The close-out has three buckets, and the third — dropped as a false positive — is the one that gets
skipped, because a wrong finding feels like nothing happened. It is not nothing. A false positive
that is deleted rather than recorded comes back on the next scan, costs the same argument again, and
the third time it appears the honest conclusion is that the criterion that produced it is wrong and
should be changed rather than re-litigated.

Real work deliberately left undone goes to `skills/starci-record-debt` with its files and its
reason. A deferral held in memory is indistinguishable, next month, from code nobody ever looked at.

## Running the tests

```bash
node .claude/skills/starci-fe-review-apply/test.mjs
node .claude/scripts/run-all-tests.mjs                     # every skill's suite
```

This skill owns no script, so the suite tests the document: that every path it cites still resolves,
that no machine path has crept back in, and that the two sentences the design rests on — the unit of
work, and Storybook first — are still there. Those are the three ways a prose skill rots: a file
moves and the reference goes quietly dead, a session pastes an absolute path that is true on one
machine, and a tidy-up removes the load-bearing sentence because it reads like a summary.

## What these tests cannot tell you

They say nothing about whether an agent holding this skill actually refuses the finding that is not
in the proposal, or drops a tier instead of reaching for a class on a block. Those are behaviour
questions and need an eval — the same prompt with and without the skill, graded blind.

> **prompt** — "The status chip on the dashboard is hard to read. Fix it and while you're there make
> the card a bit tighter."
>
> **expected** — Resolves the source rather than assuming a path. Treats the contrast fix as the
> paired-token fix it is, not a hand-mixed tint. Names the second request as an adjustment with a
> written reason, and lands it one tier down rather than on the block. Reads both locales and
> resizes before calling it done.
