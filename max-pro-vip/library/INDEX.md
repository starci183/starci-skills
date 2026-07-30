# Library

The single source. Every component is assembled from here.

**Status: SCAFFOLD — 0 entries admitted.** The import source sits in the private canon repo (`starci-claude-canon`), 76 files waiting to be proposed and admitted.

## Four tiers

| Tier | What it is | Import source |
|---|---|---|
| `foundations/` | tokens: color · font size · spacing · corner radius · z-index · motion · breakpoints | 11 files |
| `atoms/` | smallest unit, carries no business logic | 28 files |
| `frames/` | how atoms combine, not yet tied to a specific screen | ~15 files *(needs filtering: many source files are **rulings**, not library entries)* |
| `composites/` | page frame, overlay frame | ~14 files *(needs filtering, same as above)* |

## Lookup

**Don't know which component to reach for** — open [`matrix.md`](matrix.md), the lookup table for *given this data shape in hand, which wrapper do you use*. Enter through the first column, read right to exactly one component. Open it **before typing the first line of JSX**, not after building it and auditing it afterward.

**Already know the name** — look up the contract:

```bash
node scripts/lookup.mjs <name|tier|keyword>
```

Returns exactly the entry needed. Don't read `registry.json` with your eyes.

## Admitting

A lane that finds no matching entry **proposes one as a widget**; the teacher decides. Once approved, the entry is filled in from [`assets/library-entry.md`](../assets/library-entry.md) and must carry: role · API · full states · skeleton · tokens · Forbidden · a verdict on all 15 axes.

## Filter before importing

The source mixes two kinds of files:

| Kind | Example name | Goes into library? |
|---|---|---|
| **library entry** — a buildable thing, has a contract | `card`, `input`, `catalog-grid`, `region-model` | yes |
| **ruling** — a verdict about how to use something | `course-home-no-duplicate-surfaces`, `meter-tracks-out-of-box-default-target` | → `principles/<axis>/rationale.md` |

Stuffing a ruling into the library breaks lookups — it has no API, no state, no skeleton.
