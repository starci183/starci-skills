---
name: gap
tier: foundations
admitted: 2026-07-30
---

# Gap

## Role

The spacing ladder for two related but distinct axes: the **seam** between two elements (`gap`)
and the **inset** a surface gives its own content (`padding`). It governs every gap and padding
value in the app — it does not govern which element owns the seam (that is a `frame` decision:
the parent, never the child via margin).

## Source of truth

`--spacing: 0.25rem` (4px) is Tailwind v4's own default root — declared in `tailwindcss/theme.css`,
not overridden anywhere in this app's `globals.css`. Every `gap-N` / `p-N` utility compiles to
`calc(var(--spacing) * N)`; `globals.css` itself proves this live (`.card { padding:
calc(var(--spacing) * 3) !important }`).

Two TypeScript union types pin which multiples a caller going through the frame tier is allowed to
reach: `SeamScale` (for `gap`) and `InsetScale` (for `padding`), both declared in
`.storybook/components/frames/_spacing.ts` and consumed by `Stack` / `Cluster` / `Grid` / `Split`.

**This scale superseded a stale one.** The backed-up note (`fe/foundations/gap.md`, locked in
2026-06-24/06-30) documents a single unified scale `0·2·3·6·8` plus two named exceptions —
`gap-10` for `PageHeader → content` and `gap-16` for landing `SectionHeading → content`. The
2026-07-27 frame-tier rebuild replaced that: it split gap and padding into two named scales,
**added** a `tight`/`gap-1` rung that never existed in the note, and **retired** `gap-10`/`gap-16`
as off-scale. Live component comments call this out explicitly:
`.storybook/components/starci/pages/CourseContents/CourseContents.tsx` — "`gap-10` → `gap="page"`.
`10` is NOT on the §10c scale (0·1·2·3·6·8)" — and
`.storybook/components/starci/blocks/learn/ContentHeader/ContentHeader.tsx` — "`src` writes
`gap-10` there, which is OFF-SCALE ... this is a deliberate correction, not a transcription slip."
The old production tree (`src/`, pre-Storybook-migration) still has 20 files using `gap-10` or
`gap-16` — that is now debt to migrate down to `gap-8`, not a currently valid step.

## Scale

**Seam scale (`gap`, `SeamScale`) — six steps, named by relationship, not by number:**

| Step | Value | Derived as | Means |
|---|---|---|---|
| `flush` → `gap-0` | 0px | 0 × root | one unit of meaning (a title and its subtitle) |
| `tight` → `gap-1` | 4px | 1 × root | a mark attached to its owner (an icon before a label) |
| `related` → `gap-2` | 8px | 2 × root | peers in one set (a chip row, two buttons) |
| `grouped` → `gap-3` | 12px | 3 × root | rows inside one surface (list rows, label → its content) |
| `section` → `gap-6` | 24px | 6 × root | different regions of one thing (header vs body) |
| `page` → `gap-8` | 32px | 8 × root | separate features on a page |

**Inset scale (`padding`, `InsetScale`) — five steps, no `tight` rung:**

| Step | Value | Derived as | Means |
|---|---|---|---|
| `flush` → `p-0` | 0px | 0 × root | content touches the edge (a cover image, a scrolling table) |
| `snug` → `p-2` | 8px | 2 × root | compact chrome (a chip, a collapsed sidebar item) |
| `cozy` → `p-3` | 12px | 3 × root | the interior of a card — the house default |
| `roomy` → `p-6` | 24px | 6 × root | a page measure or a container |
| `airy` → `p-8` | 32px | 8 × root | a hero or an empty state that wants to breathe |

**Retired, not current** — `gap-10` (40px) and `gap-16` (64px). Both still *look* like valid
multiples of the root (10 × 4, 16 × 4) — that is exactly why they survived as an unquestioned
"named exception" in the old note. They are excluded from both `SeamScale` and `InsetScale` today;
writing either is a canon violation, not a legitimate step, even though `src/` still carries them
in 20 unmigrated files.

There is no other `notDerived` case: unlike `radius`, every step in both tables above is a plain
Tailwind `gap-N` / `p-N` utility resolving through the single `calc(var(--spacing) * N)` formula —
no step hardcodes a value outside the multiplier, and no independent `--gap-*` / `--inset-*` custom
property exists anywhere in `globals.css`.

## How steps relate

**Concentric by relationship, not by taste.** For `gap`, ask in order, stop at the first yes: are
the two things one unit of meaning → `flush`. Is one a mark attached to the other → `tight`. Are
they peers in one set → `related`. Are they rows stacked inside one surface → `grouped`. Are they
different regions of one thing → `section`. Are they separate features on a page → `page`. `gap`
belongs to the parent (the frame), never to the child — children of a frame must not carry margin.

`padding` asks a different question — how much air a surface gives what it holds — so it shares
`gap`'s four middle numbers (2, 3, 6, 8) off the same `--spacing` root but has **no** `tight`
rung: "tight" describes a relationship between two things, and a surface cannot be tight to
itself.

## Forbidden

| Forbidden | Caught by |
|---|---|
| off-scale `gap` written by hand (`gap-4`, `gap-5`, `gap-7`, `gap-9`, `gap-10`, `gap-16`…) on a raw `className`, bypassing `Stack`/`Cluster`/`Grid`/`Split`'s typed `gap` prop | nothing, if the value is a plain integer: `no-fractional-spacing` only matches `\d+\.5`, `no-arbitrary-token` only matches bracket syntax (`gap-[7px]`) — a bare `gap-4` string passes both |
| off-scale `margin` (`m-5`, `mt-7`…) | nothing at all — there is no `MarginScale` type in `_spacing.ts`; margin relies solely on the same two regex lints, which do not catch plain off-scale integers |
| a hand-rolled `<div className="flex gap-…">` instead of going through the typed frame component | nothing — no lint flags a raw flex div; only the typed `gap`/`padding` prop of `Stack`/`Cluster`/`Grid`/`Split` turns an off-scale value into a compiler error, and a caller can always skip the frame entirely |

## Read by which axes

`seam` — every `Stack`/`Cluster`/`Grid`/`Split` caller reads `SeamScale` here.
`inset` — every caller of the same frames' `padding` prop reads `InsetScale` here.
`radius` — the concentric radius formula uses padding as its variable (see `radius.md`, "How steps
relate").

## Anchors

2026-06-24 — original scale locked in (`0·2·3·6·8`), now superseded. 2026-06-26 — landing `gap-16`
correction, now superseded. 2026-06-30 — divider-surrounds-`gap-3` rule, still consistent with
`grouped`. 2026-07-27 — frame-tier rebuild (`_spacing.ts`): split gap/padding into named
`SeamScale`/`InsetScale`, added `tight`/`gap-1`, retired `gap-10`/`gap-16` as off-scale; confirmed
live in dated comments in `CourseContents.tsx` and `ContentHeader.tsx`.

Files read: `tailwindcss/theme.css` (`--spacing` root); `src/app/globals.css` (`calc(var(--spacing)
* 3)` card/accordion padding, confirms no local `--spacing` override); `.storybook/components/
frames/_spacing.ts` (`SeamScale`, `InsetScale`, `GAP_CLASS`, `PADDING_CLASS`); `.storybook/
components/frames/Stack/Stack.tsx`; `.storybook/components/starci/pages/CourseContents/
CourseContents.tsx`; `.storybook/components/starci/blocks/learn/ContentHeader/ContentHeader.tsx`;
`eslint-plugin-starci-fe/index.mjs` (`no-fractional-spacing`, `no-arbitrary-token`); a repo-wide
grep for `gap-10`/`gap-16` — 20 hits under `src/` (debt), 0 hits under `.storybook/components`
outside the two retirement comments above.
