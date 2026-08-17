# layout

The folder architecture of this tree. What each directory holds, what it may not hold, and where a
new file goes.

Read [`records.md`](records.md) for what the files inside a module mean, [`gate.md`](gate.md) for
what a shelf must publish to run in the chain, and [`proof.md`](proof.md) for the evidence a shelf
carries that it works.

## The chain

Five shelves, in order. Each is a gate: it takes a defined input and returns a defined output, and
the output of one is the input of the next.

```
prompt · image · feedback
      → layouts     which composition, what each region holds
      → blocks      which block per region, and what it is made of
      → principles  which classes and which host, per node
      → patterns    which files, which tier, which props
      → lints       what the machine refuses
      → code
```

A shelf that cannot state its input and output is not in the chain yet, whatever else it holds.

## A shelf

```
fe/<shelf>/
├── INDEX.md              the shelf: what it answers, the law that generates it, routing
├── gate.schema.json      input and output shapes; output $refs the next shelf's input
├── proofs/               held-out test fixtures, one per screen
│   ├── INDEX.md          score table across screens, and what the gate still lacks
│   └── <screen>.md       one fixture: IN, EXPECTED OUT, ACTUAL OUT, score, gap
└── <module>/             one concept, five records
    ├── INDEX.md
    ├── vi.md
    ├── example.md
    ├── audit.md
    └── changelog.md
```

`fe/<shelf>/INDEX.md` is the only file in the shelf root besides the schema. A shelf that grows a
second loose `.md` has a module it has not admitted yet.

### Families

A shelf holding two kinds of module may sort them one level down, and `blocks` does:

```
gates/blocks/
├── archetypes/<module>/   which shapes exist
└── laws/<module>/         which constraints apply to any of them
```

The two answer different questions and mixing them in one flat list loses that. **One level only** —
a family folder holds modules, never another family. A module's id is its path under the shelf, so it
reads `laws/b1-one-surface-owner`.

This nesting was invisible to the docs sync until `discoverModules` was taught to walk into a folder
that holds no `INDEX.md` of its own. Before that, 21 modules published as zero — no error, no count,
nothing to notice.

## A module

One concept. Five records, no more, and none of the five is optional — the docs sync
(`docs/scripts/sync-content.mjs`) requires `INDEX.md`, `vi.md`, `example.md` and `audit.md` before it
publishes a module at all, and it skips a short module **silently**. A module missing one record does
not appear anywhere, and nothing says so.

A module owns a code prefix, and **a prefix has exactly one owner in the whole tree**. Before adding
one, sweep every shelf for it. Two collisions in one session came from moving a code without
checking where it was moving to, and the second was caused by the fix for the first.

## What each directory is for

| Path | Holds | Never holds |
|---|---|---|
| `gates/layouts/` | composition: which regions, what each holds | spacing values, element choices |
| `gates/blocks/` | anatomy: which block, its parts, its states | page composition, class strings |
| `gates/principles/` | classes and host per node | file structure, business rules |
| `gates/patterns/` | files, tiers, props, the split | visual decisions |
| `gates/lints/` | what a machine refuses, and the escape hatches | law a machine cannot see |
| `be/patterns/`, `be/lints/` | the same two questions, backend side | frontend anything |
| `sources/` | the artifact that HOLDS a law — a rule module and its twin test | prose |
| `skills/` | one folder per phase, each a `SKILL.md` | law; a skill cites law, it does not restate it |
| `syntax/` | this: the shape of the tree itself | any law about a product |
| `docs/` | the Nextra site that publishes the tree | anything the tree does not already say |
| `.workflows/` | one append-only record per task, including every `REJECTED` row | law; a rejection becomes law only by being written into a shelf |

### Một hàng cố ý không có chủ

A routing row may name no module on purpose: the escape hatch a gate emits when nothing in the shelf
fits is not a module and never becomes one. Mark it `by design` in the owner cell.

Without that mark it is indistinguishable from a law the shelf claims and has not written, and
`scripts/gate-health.mjs` counts it as a conflict — which makes the stopping condition unreachable,
and a condition that cannot be met is not one.

## Where a new thing goes

**A new law.** Which shelf is decided by the KIND of answer it produces, not by the topic it mentions.
A composition decision goes to `layouts/` even if it is about a card; a class choice goes to
`principles/` even if it is about a page. A law that seems to fit two shelves is usually two laws.

**A new archetype.** Only with an anchor to a screen that already runs it. A composition nobody has
shipped is a proposal, and a proposal belongs in the shelf's `## Owed`, not in a module of its own.

**A new record type.** It does not. The five are fixed, and adding a sixth to one module breaks the
uniformity every reader relies on when they open a folder they have not seen.

## The one rule that outranks the others

**Canon records what the code already does.** A law here is not a preference somebody had; it is
something the source can be checked against, or a founder's recorded refusal in `.workflows`. A rule
with neither anchor is a proposal, and it must say so on its own line rather than sit among the laws
looking like one of them.
