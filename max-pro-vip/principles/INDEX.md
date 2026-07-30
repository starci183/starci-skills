# Axes

Three files, three moments.

| File | Open when | Holds |
|---|---|---|
| [`judgement.md`](judgement.md) | **auditing** a screen | 17 rules no machine catches |
| `decisions/<axis>.md` | **proposing** a library entry | the scale, the tree, the confused pairs |
| [`../references/axis-notes/`](../references/axis-notes/INDEX.md) | you need to know **why** | the full argument and every dated incident |

A screen assembled correctly from the library opens none of them.

The fifteen axes below are the index into `decisions/`, grouped by what decides them.

## Atomics — values inside one unit

Mostly enforced by union literals: `tsc` catches a wrong value before a person can.

| Axis | Answers |
|---|---|
| `text` | what size, what weight |
| `color` | what colour goes here, or none |
| `icon` | whether there should be an icon at all, what size, what weight |
| `button` | what variant, what size |
| `press` | how it answers a press |
| `surface` | radius · border · shadow · background |
| `inset` | padding inside one surface |
| `seam` | how far apart two things sit |
| `skeleton` | whether it needs `isSkeleton`, and what shape |
| `markdown` | how far a string renders as markdown |
| `prominence` | which **mechanism** makes something loud — the one axis judged across a whole region |

## Frame — how things are arranged

| Axis | Answers |
|---|---|
| `frame` | which frame does the arranging |
| `reading-flow` | how text aligns, where a block sits in its track |

## Responsive — how shape changes with width

| Axis | Answers |
|---|---|
| `responsive` | where a row breaks, what happens to a side region, who owns a threshold |

## Ownership — which layer decides a state

| Axis | Answers |
|---|---|
| `async` | what empty, error, and loading render, and **who** gets to draw it |

## Three cross-axis rules

1. **Measure, don't infer.** Where a real `src` exists, measure it. A decision tree is the fallback,
   not the first move.
2. **Never infer sideways.** Two components that look alike can correctly land on different values,
   because each is anchored to its own source.
3. **Hesitating between two steps that sit two apart means the tree was drawn wrong**, not that the
   value was picked wrong. Go back to the tree.

## Order when admitting a library entry

Intent (`reading-flow` · `prominence` · `async`) → structure (`frame`) → space (`seam` · `inset` ·
`surface`) → content (`text` → `icon` · `color` · `button` → `press` · `markdown`) → `responsive` →
`skeleton`.

Each axis appears exactly once, at the point where it no longer depends on something undecided.

## Moved out

`naming` is a source-code convention, not a visual judgement — it now lives at
[`references/naming.md`](../references/naming.md). Nine "verify before concluding" rules that were
written into nine separate axes now live in
[`references/house-rules.md`](../references/house-rules.md).

The measurement behind both moves is in [`docs/RULE-SCAN.md`](../docs/RULE-SCAN.md).
