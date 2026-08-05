---
name: starci-arch-sync-plan
description: Measures how far another repository stands from this one's canon and writes the migration as a sequenced proposal, without editing a line of the target. It reads the governing canon, ports the enforcement rules into the target at warn level so the debt can be counted by the rule itself rather than estimated, and separates the three things a naive plan blurs together - mechanical burn-down, prerequisites that are somebody's decision, and rules that are simply wrong for the target. Reach for it whenever an existing codebase should start obeying rules it was not written under, "sync the architecture to nivo", "port our backend conventions to that repo", "make this project follow our canon", "how far is that repo from our rules", "đồng bộ kiến trúc sang dự án khác", "đo xem repo kia lệch canon bao nhiêu", "lên kế hoạch port lint rules sang repo mới", "what would it take for this repo to pass our gates". Works for a back end against canon/be or a front end against canon/fe; the target is a parameter, not this repository. It measures and sequences only - carrying the plan out is starci-arch-sync-apply. Not for authoring canon (starci-canon-audit), and not for writing code inside this repository (starci-be-cannon-apply).
---

# Measuring a repository against canon it was not written under

A codebase that grew without a rule is not a codebase that broke the rule. It is a codebase where the
rule has never been true, and the distance is a number nobody has measured. The output of this lane is
that number, per rule, taken by running the rule - plus the sequence in which the distance can be closed
without breaking the target on the way.

**The plan writes a proposal and changes no source file in the target.** It may add the enforcement
plugin and its configuration, at `warn`, because that is the measuring instrument. It may not fix a
single violation. A plan that has already started fixing is not a plan; it is an unreviewed apply that
nobody can argue with.

## Why the estimate is always wrong

The reflex is to grep for the pattern, count the hits, and plan against that count. Do not.

A grep over module files once put a repository's debt for one rule at 426 across 106 files. The rule,
once written and run, reported 17. The estimate was high by a factor of twenty-five, because it counted
same-capability aggregators the rule correctly ignores and it could not read a registration built inside
a static factory. A plan built on 426 would have budgeted weeks for an afternoon and would have proposed
a phased burn-down for something that fits in one commit.

The estimate also fails the other way. The same session's estimator saw six files carrying an `imports`
array where a plain `grep -l "imports:"` found twenty, because it only understood the static
`@Module({...})` decorator and every dynamic module builds its imports somewhere else.

So: **write the rule first, land it at `warn`, and let the rule count.** An estimator is allowed only to
decide whether a rule is worth writing at all, and any number it produces is labelled as a floor in the
proposal, never as the debt.

## 0. Sweep the SOURCE first, because half the rules are not written down yet

Before measuring the target, measure the repository the canon comes from. A codebase that has been
written to a standard for years obeys more rules than anyone has recorded, and those unrecorded ones
are invisible until somebody tries to export them.

Sweep for **invariants**: patterns the source follows with no exception. For each candidate, count
the conforming sites and the violating ones, and read the percentage as a verdict:

- **at or near 100 percent** -- this is a real convention. It can become a rule and land at `error`
  immediately, because the debt is already zero.
- **around half** -- this is not a convention, it is coincidence. Writing a rule for it means
  inventing policy and then making a machine enforce it. Record the number and reject it by name, so
  the next sweep does not re-propose it.
- **in between** -- a convention with real debt. It becomes a rule at `warn` with a burn-down, not an
  `error`.

**An unwritten convention cannot be synced.** This is the reason the sweep comes first. One sweep
found a repository where persistence went through one handle at 1341 sites against zero alternatives,
and where a caching wrapper was used everywhere while the raw client appeared only inside the wrapper
itself. Both were absolute. Neither was in the canon: every mention was an example in a code snippet,
never a clause. The universal-principles shelf stated the idea in general terms, deliberately naming
no house spelling. So the practice was folklore -- true, total, and unexportable.

The order is therefore: sweep, then write the clause into the enforcing shelf, then write the rule.
A rule shipped ahead of its clause is a machine enforcing something no document says.

## 1. Read the canon that governs, and the target as it is

Open `canon/be/INDEX.md` and the shelf index `canon/be/enforce/authoring/INDEX.md` for a back end, or
`canon/fe/README.md` for a front end. Read the rules, not their filenames - the reason a rule exists is
what decides whether it can apply to the target at all. Where the target's tree is the question rather
than its spelling, `canon/be/sourcetree.md` is the shelf that answers it.

Then read the target the same way. Not its README, which describes what it was: its `package.json`
scripts, its `tsconfig.json` paths, its module tree, its test lanes, its branch. A README that calls a
repository a hosting panel while `src/` holds an expert-platform tree is a document that stopped being
true, and planning from it plans for a repository that no longer exists.

Record what the target ALREADY satisfies as carefully as what it violates. A migration that re-does
work already done is worse than one that skips it: it churns files for no change and buries the real
diff. One target already had the house exception shape in 119 files - one destructured metadata object,
exactly as canon prescribes - and a plan that had not checked would have proposed rewriting all of them.

## 2. Port the rules at `warn`, and measure with them

Bring the enforcement plugin over and wire every rule at `warn`, none at `error`. This is the
measurement, and it is also the first commit the apply will make.

Adapt only what genuinely differs - path aliases, tier names, the exception barrel's location. Do not
rename rules. Two repositories whose rule names match can be reviewed by the same person; two whose
names have drifted cannot.

Then produce the table. One row per rule: `rule -> violations -> files`. Numbers from the rule.

## 3. Sort every rule into one of three piles

This is the judgement the apply cannot re-derive, and it is why this half exists alone.

**Mechanical burn-down.** The violations are real and fixing them changes no design. Most rules land
here. The proposal states the count and nothing more.

**Blocked on a decision.** The rule cannot land until somebody decides something that is not a lint
question. The clearest case: a rule banning every logger but the house one, in a target that has no
house logger and 58 files using the framework's. Landing it there bans the only logger available. The
proposal names the decision, gives the options with their real cost, and stops - it does not pick.

**Wrong for the target.** The rule punishes code that is correct. When this happens the rule is the
defect, not the code. One rule flagged a legitimate facade over a third-party module; another had to
learn that a registration carrying per-instance configuration is not the same as a bare import wearing
parentheses. The proposal says which rule needs amending and why, and that amendment lands in the canon
repository - not as a per-target exception, which is how one canon becomes several.

## 4. Sequence it, because order is load-bearing

Rules are not independent, and a plan that lists them alphabetically will deadlock.

A rule about how imports name their target cannot land while the target still routes every import
through re-export barrels; the barrels go first. A rule about where modules are composed cannot be
burned down before it is known which application composes which feature - the same import is safe to
delete in a repository with one application and fatal in one with eight. State the dependencies between
rules explicitly, and say what must be true before each phase starts.

## 5. Prove each rule fires before believing its count

A rule that reports zero has two possible meanings and they are opposite: the code conforms, or the
rule never ran. Nothing in the output tells them apart, and the wrong reading ships a lint layer that
enforces nothing while every report says clean.

So before recording any rule's debt, write a probe file that violates every rule at once and confirm
each one reports. **Put the probe where the configuration actually looks.** One probe came back
silent on all eight rules under test and looked like eight broken rules; the file was sitting in a
directory outside the configuration's `files` glob, so nothing had scanned it. Moved inside, all
eight fired.

The same caution applies to a rule that already exists and reads as settled. A rule guards the
construct it names and nothing else: one that checks how an exception is THROWN says nothing about
how an exception class is DECLARED, so a class extending the framework's base is thrown by its own
name and the throw looks correct. That hole was live, and thrown from four call sites, while the gate
stayed green. When the sweep finds a rule that "already covers" something, check which construct it
actually visits.

## 6. Say which checks prove it, and which cannot

Name the commands, and be honest about what each one can see.

Type-checking and building prove that names resolve. They cannot see a provider that stopped resolving
because a module was un-imported while nothing registered it globally - that failure appears when the
application starts, and only an end-to-end run catches it. A plan that offers a green build as evidence
for that class of change is offering the wrong evidence.

Capture a baseline for every check BEFORE anything moves. A target's type-check error count is rarely
zero, and "no regressions" is not a claim that can be made against a number nobody wrote down.

## What the proposal contains

Written to the target repository, not to this one, so it travels with the work:

- the sweep of the SOURCE: invariants found, their conformance percentage, which became rules, and
  which were rejected by name with their number
- what the target already satisfies, with counts
- the debt table, one row per rule, measured by the rule, each rule proved to fire first
- the three piles, with every blocked rule's decision stated as a question
- the sequence, with the dependency between phases named
- the checks, with their baselines
- what was deliberately left out, and why

## Handing off

`skills/starci-arch-sync-apply/SKILL.md` carries out an approved proposal: one rule per commit, measure
after each, flip to `error` only at zero. It does not re-plan. If it finds the ground has moved, it stops
and says so rather than improvising a new sequence.
