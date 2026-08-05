# Why this skill is shaped the way it is

Notes for whoever changes it. `SKILL.md` is the interface; this is the reasoning behind it.

## Why one rule per commit, and not one phase

Because the only cheap question after something breaks is "which change did this", and that question is
cheap exactly once: when the history answers it.

A migration commit that lands four rules is one bisect nobody can perform. The failure will not surface
during the migration - it surfaces a week later, in a service that boots differently, and by then the
diff is a wall. Splitting per rule costs a few extra commits and buys the ability to revert one rule
without unpicking three.

This is also why the skill refuses to batch even when the rules look related. Two rules that touch the
same files are the most tempting pair to combine and the worst to have combined.

## Why a rule never lands at error while debt exists

A rule at `error` with outstanding violations blocks every commit that so much as opens an offending
file - including the commits that were going to fix it. The migration then has to be done with the gate
disabled, which is the same as not having a gate, except that it is now also confusing.

`warn` with the real count in a trailing comment is not a weaker rule. It is the rule doing its second
job: telling the next person how far there is to go. The count has to be the measured one; a predicted
number in that comment is worse than none, because it will be believed.

## Why a green build is called out as insufficient

The most common way this migration produces a confident, wrong report.

When a rule's fix removes wiring - an import deleted because the thing it provided is registered
globally somewhere else - the compiler sees nothing. Names still resolve. The build still emits. What
breaks is the dependency container at startup, and the only check that catches it is one that actually
boots the application.

The session this skill came from hit the sharper version: a module registered locally with a specific
instance key, where the global registration happened to carry the same key. It was safe - but only
because somebody read both sides. Had the keys differed, the type-check, the lint and the build would
all have passed and the service would have failed to start. The skill therefore requires checking
reachability in **every** application that composes the code, rather than trusting a green build.

## Why comment upkeep is part of the skill rather than tidiness

A comment describing wiring that no longer exists is not stale documentation, it is a false statement
that the next reader has no reason to doubt. "This module imports Elasticsearch" outlives the import by
years. Fixing it in the same commit costs a line; discovering it later costs a wrong mental model that
has already been copied somewhere else.

## Why stopping is a first-class outcome

The listed stop conditions - the re-measure disagrees, a rule punishes correct code, a fix needs an
undecided answer, a check cannot run - all share one property: continuing past them produces a
migration whose reasoning cannot be reconstructed. The work might even be correct. Nobody will be able
to show that it is.

Handing the finding back to `skills/starci-arch-sync-plan/SKILL.md` keeps the decision where it was
reviewed, instead of burying a new one in an execution diff.

## What the test cannot cover

`test.mjs` checks that the references land, that no machine, target or branch is assumed, and that the
four disciplines are still stated. It cannot check whether an agent actually stops when it should -
that is behaviour under pressure, and it needs an eval.

It also cannot check the quality of a migration. A run that follows every rule here and still makes a
poor call about what "reachable" means will pass every case in this file.
