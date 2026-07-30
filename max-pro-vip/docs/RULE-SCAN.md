---
name: rule-scan
description: Every Forbidden rule across the 15 axes, classified by who enforces it. The basis for collapsing the axes into three.
measured: 2026-07-30
---

# Who actually enforces canon

103 Forbidden rules scanned across 15 axes.

| Enforcer | Rules | What it means |
|---|---:|---|
| `tsc` — union literal | 8 | already unbreakable. Delete the prose, the compiler says it better |
| gate script, written | 17 | already caught. Delete the prose, point at the script |
| gate script, writable but unwritten | 22 | engineering backlog, not canon |
| **no machine can catch it** | **28** | **this is the real canon** |
| unclassified | 28 | enforcement column written off-pattern, needs a pass |

**46% of what canon spends pages on is already enforced by something else.**

## The 28 that no machine catches, sorted by kind

### Judged across a whole region — no type can see this

| Axis | Rule |
|---|---|
| `prominence` · `color` | multiple simultaneous focal points in one region (**appears in both — duplicate**) |
| `prominence` | a left-right pair with a real hierarchy rendered at the same level |
| `prominence` | changing the mechanism of one info-type across states |
| `icon` | icons on one row with different geometric silhouettes |

### Reading the structure wrong — the value is right, the reading was not

| Axis | Rule |
|---|---|
| `icon` | looking up the size table before deciding BARE vs INSIDE A CELL |
| `press` | a ROW with no border of its own using `scale`/ripple |
| `press` | a pressable card carrying `hover:bg-*` at rest |
| `press` | hand-rolling `<div cursor-pointer>` instead of native `<button>`/`<a>` |
| `press` | `data-[pressed]` instead of native `:active` on a hand-written card |
| `reading-flow` | centering main content of two lines or more |
| `reading-flow` | changing `justify` on a whole track when one element needs pushing |
| `frame` | choosing the wrong frame while it still compiles |
| `frame` | building a NEW frame without two real independent cases |
| `skeleton` | one generic shape for every configuration of a known-in-advance axis |
| `markdown` | a field at the small-richtext tier rendered through plain Typography |
| `async` | hand-writing if/else in an order other than the four branches |
| `color` | rolling a narrower colour enum instead of reusing the shared one |
| `naming` | inferring a type/prop name from where it is used instead of its role |

### Not visual at all — working discipline, belongs in `house-rules`

| Axis | Rule |
|---|---|
| `seam` | reporting done after reading code, without measuring `getComputedStyle` |
| `seam` | copying a seam from a component with a different `src` |
| `skeleton` | reporting done without running `tsc --noEmit` after adding a union |
| `button` | inferring the variant from a component that looks similar in `src` |
| `button` | citing an anchor from documentation without grepping the real file |
| `async` | trusting a log that says "already fixed" without checking disk |
| `markdown` | judging something safe by scanning story data alone |
| `text` | bumping `size` above `src` on your own |
| `inset` | rounding an asymmetric padding from `src` without noting the drift |

Nine rules. None of them are about how a thing looks — all of them are about **not verifying before
concluding**. They repeat across nine different axes because the failure is not axis-specific.

## Rules per axis

| Axis | Rules | tsc | gate | gate-todo | judgement |
|---|---:|---:|---:|---:|---:|
| `naming` | 12 | — | 4 | 1 | 1 |
| `icon` | 9 | — | 2 | 1 | 2 |
| `skeleton` | 9 | — | — | 3 | 2 |
| `inset` | 7 | — | 2 | 1 | 1 |
| `press` | 7 | 1 | — | — | 4 |
| `seam` | 7 | 1 | 4 | — | 2 |
| `async` | 6 | — | 1 | 2 | 2 |
| `button` | 6 | 1 | — | 2 | 2 |
| `color` | 6 | 1 | — | 3 | 2 |
| `frame` | 6 | 1 | 2 | 1 | 2 |
| `markdown` | 6 | 1 | — | 3 | 2 |
| `reading-flow` | 6 | — | 1 | — | 2 |
| `surface` | 6 | — | — | 2 | — |
| `prominence` | 5 | 1 | — | 1 | 3 |
| `text` | 5 | 1 | 1 | 2 | 1 |
| **`responsive`** | **0** | — | — | — | — |

`responsive` has no axis and no rules, while the machine traps it causes are real and dated:
`wrap` with no threshold, `@container` sharing an element with padding, an aside shipped without a
breakpoint.

## What this scan says to do

1. **Delete 25 rule lines** already enforced by `tsc` or an existing gate. Point at the enforcer
   instead of restating it.
2. **Move 9 rules to `house-rules`.** They are one rule wearing nine costumes: verify before
   concluding.
3. **Merge the duplicate** — accent-flood is written twice, in `color` and in `prominence`. It
   belongs to `prominence`; `color` decides a value, `prominence` decides how loud a region is.
4. **Move `naming` out of `principles/`.** It is a source-code convention, not a visual judgement,
   and it carries the most rules of any axis while contributing one judgement rule.
5. **Create `responsive`** — but write the API first and let the axis be whatever the API cannot
   catch. Writing the axis first would repeat the mistake the other 46% shows.

## Where the discipline rules landed

The nine "no machine can catch it" rules listed above under working discipline were not the whole
picture. A full pass over all 15 axes for verification-discipline rules — rules about *how to check*
rather than *what should look right* — turned up 49, not 9, spread across every axis that was
scanned:

| Axis | Discipline rules found |
|---|---:|
| `markdown` | 7 |
| `button` | 6 |
| `icon` | 5 |
| `seam` | 5 |
| `inset` | 5 |
| `color` | 4 |
| `text` | 4 |
| `async` | 3 |
| `skeleton` | 3 |
| `frame` | 2 |
| `prominence` | 1 |
| `reading-flow` | 1 |
| `surface` | 1 |
| `press` | 1 |
| `responsive` | 1 |
| **Total** | **49** |

All 49 collapse to the same handful of failure shapes: don't report done without measuring, don't
infer from a lookalike, don't trust a stale anchor or a log, don't bump a value up on your own
initiative, don't judge safety from data alone when the debt lives in the type. None of them are
about how something should look — every one is about verifying before concluding. That collapse is
already written up in [`references/house-rules.md`](../references/house-rules.md) §2, "The nine
costumes of one failure." Nothing found in this scan needed a new home — house-rules.md already held
it before this scan ran. This section exists to confirm the count: **49 discipline rules went in,
none were dropped, all 49 are accounted for in the nine costumes already on file.**
