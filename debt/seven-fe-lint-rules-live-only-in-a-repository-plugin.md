---
title: Seven FE lint rules live only in a repository plugin
role: fe
state: open
cost: medium
opened: 2026-08-13
paths: [.claude/sources/fe/index.mjs, .claude/skills/starci-fe-lint-sync-plan/SKILL.md]
---

## What is wrong

Seven rules were enforced by the front-end repositories and are not in this tree:

- `no-per-part-classname-prop`
- `no-public-classname-prop`
- `no-public-frame-css-props`
- `no-css-door-type-laundering`
- `source-tier-marker-matches-folder`
- `contract-children-are-typed`
- `no-parallel-skeleton`

Four of them close CSS doors — a caller restyling a node it does not own, a `className` prop laundered
through a utility type. One asserts that a source tier marker matches the folder it sits in. One
requires a contract's child slots to be typed. One bans a hand-kept skeleton tree. All seven do work
this tree agrees with; none of them is a local preference.

## Why it was left

`starci-fe-lint-sync-plan` audits a repository's own plugin folder, because a second copy of the rules is
a second answer to the same question. That removal drops these seven with it. They were recorded here
and dropped rather than carried, which is the branch the skill's own Forbidden table permits when the
alternative is a large port made in the same breath as the wiring change.

Porting them is not mechanical. They are spread across several modules in the repository plugin,
including its own `canon/` subfolder, and this tree files a rule beside the law that governs it: a
rule module here needs its law file and its twin test, and `sources/parity.test.mjs` fails when any of
the three is missing. Moving seven rules is therefore seven placements, not one copy.

While they are gone, both front ends are enforced by fewer rules than they were the day before this
was written. That is the cost, and it is stated rather than absorbed: adoption that quietly subtracts
enforcement is the failure `LINT-ADOPTION-1` describes, wearing the word adoption.

## What paying it looks like

Each rule joins the existing canon module whose law already covers its concept, so no new law file is
needed:

| rule | module | law |
|---|---|---|
| `no-per-part-classname-prop`, `no-public-classname-prop`, `no-public-frame-css-props` | `sources/fe/props-and-slots.mjs` | `fe/canon/patterns/props-and-slots.md` |
| `no-css-door-type-laundering` | `sources/fe/type-safety.mjs` | `fe/canon/patterns/type-safety.md` |
| `source-tier-marker-matches-folder` | `sources/fe/file-layout.mjs` | `fe/canon/patterns/file-layout.md` |
| `contract-children-are-typed` | `sources/fe/contract.mjs` | `fe/canon/patterns/contract.md` |
| `no-parallel-skeleton` | `sources/fe/loading.mjs` | `fe/canon/patterns/loading.md` |

Each carries its twin test cases across with it, is registered in `sources/fe/index.mjs` and in
`recommended`, and the law it lands under gains a sentence naming it. `npm test` at the trust root is
the gate. Then re-run `sync-fe-lint.mjs` on both repositories and compare the error counts before and
after, because a rule returning to force is only legible beside the number it moves.

The last of the seven is spelled `registry-children-are-typed` in the repository plugin. It arrives
here as `contract-children-are-typed`: this tree renamed that vocabulary, and carrying the old spelling
in would reopen the drift the rename closed.
