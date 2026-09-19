# Known defects

Three assertions are red, from **two different causes**. Nothing is skipped: a gate bent to go green
stops being a gate, and each of these is the only evidence its problem exists.

```text
npm run test:fe   101 pass · 0 fail
npm run test:be   54 pass · 3 fail
```

## 1. A real defect: three rule names are published by two laws each

`packages/be` — `index.test.mjs`, two assertions:

```text
✖ no two laws publish the same rule name
✖ every declared rule survives into the published set   40 !== 37
```

Both `e2e-flow` and `testing` publish these three names, with **different implementations**:

| Rule name | `e2e-flow` | `testing` |
|---|---|---|
| `e2e-uses-production-transport` | 1388 chars | 991 chars |
| `e2e-asserts-persisted-state` | 421 chars | 371 chars |
| `no-model-call-in-e2e` | 452 chars | 432 chars |

Merging the two law modules keeps whichever imports last and discards the other silently: 40 rules are
declared, 37 ship, and no message says which three were dropped or which version won.

**What it needs:** an owner decision per rule — which law owns the name, and which implementation ships.
"Bigger is more complete" is a guess, not a reason: the two versions may disagree about what they refuse,
and that disagreement is the thing to settle.

## 2. A twin test that reads a product repository

`packages/be` — `e2e-flow.test.mjs`:

```text
✖ the canonical business inventory contains every executable flow suite
```

The assertion compares the rule's inventory against the e2e suites of a **backend product checkout**. A
lint package cannot carry that: the product is one of several that use these rules, and which one is
never knowable from here.

It needs a declared product input or a product-side parity check.

## Why none of them is patched here

Cause 2 is a coupling this package inherited from living beside one product checkout; deciding where
that check belongs changes the product/tree boundary, not the package. Cause 1 is a canon question about rule ownership.
The tests stay red so that all three keep asking.
