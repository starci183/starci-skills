# records

The five files inside a module: what each one is for, its exact frontmatter, its heading set, and
which language it is written in.

## Language

| File | Language | Why |
|---|---|---|
| `INDEX.md` | **English** | It is the law. It is read by every skill, quoted in workflow records, and mirrored into rule modules under `sources/` |
| `vi.md` | **Vietnamese** | The situations, told the way the founder speaks about them |
| `example.md` | **Vietnamese** prose, code stays as written | Cases and mistakes, walked through |
| `audit.md` | **Vietnamese** | The adversarial pass over the law |
| `changelog.md` | **Vietnamese** | Version history |

Inside a Vietnamese file, four things stay untranslated because translating them breaks a gate or an
evidence chain: **headings** (`## Verdict`, `## Findings`), **code identifiers and paths**, **rule
codes** (`GAP-3`), and **exact quotes from a source**.

## Frontmatter

Every record opens with it. Two shapes, and the difference is easy to get wrong.

**`INDEX.md`** — `sidebar_label` is the MODULE name, and it is the only record carrying `template`:

```
---
id: fe-principles-gap-index
title: INDEX.md
slug: /fe/principles/gap
sidebar_label: gap
sidebar_position: 0
description: Binding rules for choosing a gap className from the relationship between direct siblings.
template: principles
---
```

**The other four** — `sidebar_label` is the FILE name, `slug` gains a segment, no `template`:

```
---
id: fe-principles-gap-vi
title: vi.md
slug: /fe/principles/gap/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống GAP-N, nhận diện bằng nghiệp vụ chứ không bằng mắt.
---
```

`sidebar_position`: `INDEX` 0 · `vi` 1 · `example` 2 · `audit` 3 · `changelog` 4.

`id` is `<axis>-<shelf>-<module>-<record>`, kebab throughout. The docs sync strips `id`, `slug`,
`sidebar_label` and `sidebar_position` when publishing, so they exist for the site and nowhere else.

## `INDEX.md` — the law

After the frontmatter: `# INDEX.md`, then a line reading
`` Version: `<n.nn>` · Module: `<name>` ``, then the headings. **Three templates, three heading sets,
in this exact order** — the validator checks order, not just presence.

The template is named for its shelf and carries no version suffix. There is one shape per shelf, so a
suffix could only distinguish it from a shape that no longer exists.

| `principles` | `patterns` | `lints` |
|---|---|---|
| `Law` | `Law` | `Law` |
| `Situation Codes` | `Situation Codes` | `Rules` |
| | `Tầng giữ` | `Detection` |
| | `Anchor` | `Escape Hatches` |
| `Inputs` | `Inputs` | `Inputs` |
| `Invariants` | `Invariants` | `Invariants` |
| `Exceptions` | `Exceptions` | `Exceptions` |
| `Output` | `Output` | `Output` |
| `Load Policy` | `Load Policy` | `Load Policy` |
| `Scope` | `Scope` | `Scope` |
| `Version Rule` | `Version Rule` | `Version Rule` |

`Tầng giữ` says who holds each code — *unrepresentable*, *enforced* or *documented*. `Anchor` points
at the real code that implements it. `Escape Hatches` carries two tables, `Closed` and `Open`; the
`Open` rows are the ways past the rule that the linter cannot see, and counting them is the only
honest measure of how much a shelf actually holds.

### How a table renders in `INDEX.md`

`Situation Codes` is the table every module is read through. Three columns, and the first two are not
the same thing:

```
| Code | Situation | className |
|---|---|---|
| `GAP-0` | A divided or joined list already owns its rhythm | *no gap class* |
| `GAP-1` | One identity or value; one child qualifies the other | `gap-1` |
```

**`Code` names the situation, not the output.** A situation that emits nothing still gets a code —
`GAP-0` above — because the reader needs a name for "this case is handled and the answer is nothing".
Without it, the absence looks like an oversight.

The third column changes per shelf: `className` for principles, `Rule` for lints, the artifact for
patterns.

## `vi.md` — the situations

`# vi.md`, then `` > Version: `<n.nn>` · Module: `<name>` ``, then:

```
# <Module>                     one paragraph: what this module is about
## Bảng tra nhanh              lookup table, one row per code
## `CODE-1` — <short name>     one section per code, in code order
## `CODE-2` — <short name>
...
## Luật                        the law restated in Vietnamese
## Ngoại lệ                    the exceptions
```

Each `## CODE-N` section identifies its situation **by how the work behaves**, never by what it looks
like and never by a component name. "A label owns the block below it" is a situation; "the gap under
a heading" is a measurement, and a reader who already knows the measurement did not need the module.

## `example.md` — the cases

The longest record, typically three to four times `INDEX.md`. Header line carries cross-links:

```
> Version: `<n.nn>` · Module: `<name>` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)
```

Then, per code:

```
## `CODE-N` — <short name>
### Case: <the situation, in plain words>
   real TSX, trimmed but never invented
### Case: <another situation>
### Ngoại lệ và nhầm lẫn
```

Every code needs **at least one right case and one wrong case**, and the wrong one carries the reason
it breaks. A module showing only correct code teaches recognition, not judgement — the reader meets
the wrong shape for the first time in review.

## `audit.md` — the adversarial pass

Six headings, fixed:

```
## Verdict              one line: does the law hold
## Kiểm phân định       does this law reach into another shelf's territory
## Findings             what is wrong or unproven
## Decisions            what was settled, and on what evidence
## Rủi ro còn mở        what could still be wrong
## Re-audit Triggers    what event makes this audit stale
```

`Kiểm phân định` is the one that earns its place. A law drifting into a neighbouring shelf reads
perfectly well on its own page, and is only visible when somebody asks the question deliberately.

## `changelog.md` — the history

```
## Version Policy       what a major and a minor bump mean here
## <n.nn> — <date>       what changed, and the evidence
```

Newest version first. An old entry is never rewritten to match a newer schema; a migration note is
appended instead, because the old entry is evidence of what was believed then.

## `proofs/` — not a record

Proof files are not module records and do not follow this shape. They live in the shelf root, one per
tested screen, and their format is in [`proof.md`](proof.md).
