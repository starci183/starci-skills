# Why this skill is shaped the way it is

Notes for whoever changes it. `SKILL.md` is the interface; this is the reasoning behind it.

## Why measuring is a separate skill from migrating

The two halves fail in opposite directions.

Measuring is wide, cheap and reversible: reading a whole repository costs nothing and a wrong count
costs a line in a proposal that a reviewer catches. Migrating is narrow, destructive and slow - it
rewrites source in a repository whose tests somebody else depends on. Written as one skill, the edit
sets the tempo, and the sequence gets decided in the same motion that commits it, which is exactly the
motion nobody reviews.

The deciding reason is which judgement is hard. Once the debt is known and the order is fixed, the
migration is mechanical - fix, re-measure, flip, commit. What is not mechanical is deciding **which rule
cannot land yet and why**: a rule blocked on somebody's decision looks identical, in a violation count,
to a rule with the same number of easy fixes. Coupling that judgement to the edit hides it inside a diff.

## Why the estimate is called out so bluntly

Because the instinct is overwhelming and the failure is silent.

Every migration starts with someone grepping for a pattern to see "how bad it is", and the number that
comes back feels like data. It is not. In the session this skill was written from, a grep-based
estimator put one rule's debt at 426 across 106 files; the rule, once written and run, found 17. The
estimator had counted same-capability aggregators the rule correctly ignores, and it could not see
inside a static factory that builds its imports at runtime.

Neither error is visible from the number alone. That is why the skill does not say "prefer measuring" -
it says write the rule first and let the rule count, and the test pins the sentence in place so a
rewrite cannot soften it back into advice.

## Why the three piles, rather than a single ordered list

An ordered list of rules implies every entry is the same kind of work. They are not, and the difference
is not one of size.

A mechanical rule needs an afternoon. A rule blocked on a decision needs a person: banning every logger
but the house one, in a repository with no house logger, is not a task at all until someone chooses
between porting the logger and scoping observability out. A rule that is simply wrong for the target
needs an amendment to the canon, in the canon repository - and if that amendment is instead written as
a per-target exception, one canon quietly becomes several, which is the failure the whole enforcement
layer exists to prevent.

Flattening those three into one list makes the plan unreviewable: the reviewer cannot see which entries
they are being asked to decide.

## Why order is stated as a dependency, not a preference

Rules constrain each other. A rule about how an import names its target is meaningless while every
import still routes through a re-export barrel. A rule about where modules are composed cannot be burned
down before it is known which application composes which feature - the identical edit is free in a
repository with one application and fatal in one with eight.

A plan that lists rules without their dependencies will deadlock on the first one, and the person
running it will improvise an order. The improvised order is where migrations go wrong.

## What the test cannot cover

`test.mjs` checks that the references land, that no machine or target is baked in, and that the
load-bearing sentences are still present. It cannot check the thing that matters most: whether an agent
holding this skill reaches for it **before** starting to edit a target repository, rather than after.
That is a triggering question, and triggering needs an eval, not a unit test.

It also cannot check whether a proposal produced under this skill is any good. A proposal that measures
correctly and sequences wrongly passes every case here.
