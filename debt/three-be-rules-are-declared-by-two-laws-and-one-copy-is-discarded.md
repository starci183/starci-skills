---
title: Three back-end rules are declared by two laws, and one copy is discarded on import
role: be
state: open
cost: medium
opened: 2026-08-16
paths: [sources/be/e2e-flow.mjs, sources/be/testing.mjs, sources/be/index.mjs, be/lints/e2e-flow/INDEX.md, be/patterns/e2e-flow/INDEX.md, be/patterns/testing/INDEX.md]
---

## What is wrong

`sources/be/e2e-flow.mjs` and `sources/be/testing.mjs` each declare five rules, and three of the
names are the same:

- `e2e-uses-production-transport`
- `e2e-asserts-persisted-state`
- `no-model-call-in-e2e`

`index.mjs` gathers them with `Object.fromEntries`, so the later import wins and the earlier
implementation is discarded without a word. The laws declare **40** rules; the plugin ships **37**.
`testing` is the survivor in all three cases — verified by object identity, not by reading the
import order.

The discarded copies are not duplicates. `e2e-flow`'s `e2e-uses-production-transport` carries a
third branch — a member call whose receiver is an identifier ending in `Worker` or `Handler` — that
does not exist in `testing`'s version. `be/lints/e2e-flow/INDEX.md` documents that branch, so the
documentation describes behaviour no build can produce.

The same rule also carries two different law codes depending on which shelf is read: `E2E-11` versus
`TESTING-3`, `E2E-4` versus `TESTING-2`, `E2E-12` versus `TESTING-9`. Neither module discloses that
the other exists.

## Why it went unnoticed

`sources/be/index.test.mjs` had a test named exactly for this failure — *"no two laws publish the
same rule name"* — and it **could not fail**. It walked `ruleOwners`, which is itself built with
`Object.fromEntries`, so the duplicate was already collapsed before the test looked. Every name
appeared once by construction, `owners.length > 1` was unreachable, and the guard reported green for
its entire life while three collisions shipped underneath it.

This is the failure mode the tree warns about elsewhere in its own words: a gate that cannot fail is
indistinguishable from no gate.

## What was already done

Both axes now export `ruleDeclarations`, the raw `(law, name)` list before any collapsing, and both
guards walk that instead. A second test compares declaration count against shipped count, so a
discarded rule fails on arithmetic even if a future collision escapes the name comparison.

The back-end guard is now **RED**, correctly. The front end is green and proven so: 58 declared, 58
shipped.

## What is still owed — a decision, not a repair

Which law owns the three names. This is not a mechanical fix: the two implementations differ, so
whichever way it is settled **changes what the linter reports in a repository that is already
running it**.

- Moving them to `e2e-flow` restores the `Worker`/`Handler` branch and may surface new failures in
  code that currently passes.
- Leaving them in `testing` is the shipped behaviour today, and requires deleting the copies in
  `e2e-flow.mjs`, correcting `be/lints/e2e-flow/INDEX.md`, and reconciling the `E2E-*` codes in
  `be/patterns/e2e-flow/` against the `TESTING-*` codes that actually apply.

By name and by subject the rules read as `e2e-flow`'s. By what ships today they are `testing`'s.
Nobody should choose between those on the author's behalf while the owner is away.

## Collateral evidence

`sources/be/e2e-flow.mjs:210` comments that "**Both** are exact and both fire on a syntactic shape"
while the file declares five rules. That sentence was written when the file held two, which dates
the moment the three names were added to it.

## Cleared by

An explicit decision on ownership, then: one copy deleted, the surviving law's codes reconciled
across `be/patterns/` and `be/lints/`, and `node --test sources/be/index.test.mjs` green with
declared count equal to shipped count.
