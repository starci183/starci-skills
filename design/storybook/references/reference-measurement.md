# Reference measurement

One real system, measured 2026-07-31. **Not a target.** Use it two ways only:

- a repo with no tier architecture yet, as a shape to aim at
- a sanity check when your own scan produces a number that looks wrong

Your own repo outranks this file. Run `scripts/scan.mjs` and trust that instead.

## The tree

| Tier | Files | Touching vendor |
|---|---:|---:|
| atom | 50 | 42 |
| behavior | 2 | 2 |
| frame | 10 | 9 |
| composite | 50 | 42 |
| block | 123 | 33 |
| layout | 5 | 1 |
| overlay | 10 | 2 |
| page | 21 | 0 |

**271 files, 0 imports against the direction.** Not "rare" — zero. That is what makes the rule a
rule rather than a preference.

## What the shape says

**Atoms and composites are the same size.** 50 each. A system where composites vastly outnumber
atoms is one where shapes are being assembled repeatedly instead of being named once.

**Blocks are the largest tier by far.** 123, more than atoms and composites combined. That is
expected: blocks carry the domain, and the domain is where a product actually differs.

**Pages are thin.** 21 pages against 123 blocks — roughly six blocks per page, and **0 pages touch
the vendor**. A page that touches a vendor is building a shape inline.

**Frames stay tiny.** 10. Frames answer *how things are arranged*, and there are only so many
arrangements. A system with thirty frames has frames that are really composites.

## Vendor distribution

42 of 50 atoms and 9 of 10 frames wrap the vendor — that is the wrapping layer doing its job.

**33 blocks and 2 overlays import the vendor directly.** Each is a missing atom. It is recorded
here as a real number rather than hidden, because a system with zero of these has probably not been
measured rather than being perfectly clean.

## The one legal upward import

Exactly one frame imports one atom: a stack frame importing a divider, to place a rule **between**
children.

That is the frame's own chrome — the caller does not pass a divider in, the frame decides it with a
boolean prop. One occurrence across 271 files is what a well-drawn boundary looks like: not zero,
because the rule allows a narrow case, and not many, because the case really is narrow.

## Group split inside the big tiers

Atoms fell into 9 groups, composites into 13, blocks into 7 domains. The largest block domain held
94 of the 123 — a single feature area dominating is normal, and it is also where a tier system pays
for itself first.
