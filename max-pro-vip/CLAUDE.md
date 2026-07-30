# StarCi FE — design system

**UI is a function of data, not of taste.** A shape of data demands one entry; a volume of data
forces one arrangement. Nothing is picked because it looks right.

## The golden rule

> Reason in one direction: **data -> arrangement -> block -> value.**
> Never backwards. Never pick the component first and fit the data to it.

The same judgement applies whether the screen exists yet or not. Two screens holding the same shape
must reach the same entry — if they differ, one of them is wrong.

## Three inputs, none optional

| Input | Answers | Blocks which failure |
|---|---|---|
| the feature in words | what the user wants | building the right thing nobody needs |
| `fe code` | what shape already exists | re-inventing something already built |
| `be code` | the real data: entity, fields, cardinality, states | inventing fields, inventing states |

Missing one? Go get it. A guess here poisons every step after it.

## Two lanes

`starci-fe-story-audit-block` decides which entry a **shape** demands.
`starci-fe-story-audit-composition` decides which arrangement a **volume** forces.

See [`skills/INDEX.md`](skills/INDEX.md).

## Draw, do not ask

Candidates are rendered as widgets, never listed in prose. Two or more valid options get drawn side
by side. Exactly one gets drawn alone, with the reason there is no second. A missing library entry
is drawn as a **proposal** — the teacher decides what enters the library.

## Read in this order, stop as soon as you have enough

| # | Open what | When |
|---|---|---|
| 1 | [`references/house-rules.md`](references/house-rules.md) | **always** — five rules outranking every skill |
| 2 | `node scripts/matrix.mjs "<shape in your hand>"` | before the first line of JSX — **never open `matrix.md` whole, it is 73 KB** |
| 3 | `node scripts/lookup.mjs <name>` | one entry, **not all of `registry.json`** |
| 4 | [`principles/judgement.md`](principles/judgement.md) | when auditing — 17 rules no machine catches |
| 5 | `principles/decisions/<axis>.md` | when proposing a library entry — the scale and the tree |
| 6 | `references/axis-notes/<axis>/rationale.md` | only when you need the reasoning behind a rule |

Do not load `principles/` before looking at the data.

## Quick lookup

[`environment.md`](references/environment.md) repo · gates · traps —
[`visualize.md`](references/visualize.md) what to draw and how —
[`writing-canon.md`](references/writing-canon.md) patching the rulebook —
[`model-roles.md`](references/model-roles.md) model choice —
[`session-format.md`](references/session-format.md) long sessions, regions —
[`research-when-silent.md`](references/research-when-silent.md) canon is silent

## Sync

Source = private repo `starci183/starci-claude-canon`. Edit it, push to private immediately.
Clean of business specifics, push to public `starci183/starci-ai-design-system`.
