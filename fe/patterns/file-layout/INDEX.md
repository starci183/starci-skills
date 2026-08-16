---
id: fe-patterns-file-layout-index
title: INDEX.md
slug: /fe/patterns/file-layout
sidebar_label: file-layout
sidebar_position: 0
description: Binding rules for where a front-end file sits, read from what the file IS rather than from who currently calls it.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `file-layout`

## Law

Where a file sits is a claim about what it is. A folder under `components/` says "this draws
something"; a folder under `hooks/` says "this fetches"; a folder under `modules/` says "this is not
React at all". A file in the wrong place is not untidy — it is mislabelled, and the cost is that
nobody who would have reused it can find it.

The question that settles it: **what is this file, independent of who currently calls it?** "Only
this screen uses it" describes today's call graph, not the thing, and it is the sentence that turns
one screen's folder into a second codebase.

**This is binding, not advisory.** Every file that ships has a place the law already decided. There
is no file small enough to be exempt, and "it is one helper" is the most common place the rule gets
skipped.

### The tree

```text
src/
    app/                    routes only - a route mounts a page and draws nothing
        api/
        <segment>/
    components/
        contracts/                  the entry table and the slot types - two files, no more
        leaves/<Name>/              one vendor primitive each, flat, no category
        composites/<Name>/          closed arrangements, flat
        branches/<Name>/            open containers, flat
        blocks/<category>/<Name>/   domain sentences, grouped by feature
        overlays/<category>/<Name>/ summoned surfaces, grouped by feature
        layouts/<Name>/             route-stable chrome, flat
        pages/<Name>/               one screen each, flat
    hooks/
        swr/                        one file per query or mutation
        <area>/
    modules/
        api/graphql/                clients, queries, mutations, and their types
    i18n/                   the translation runtime
    messages/               the copy itself, per locale
    tests/
```

**The category level is not decoration.** `blocks/` and `overlays/` group by feature because they
know the domain, and a feature is the only grouping that stays true as the product grows. `leaves/`,
`branches/`, `layouts/` and `pages/` are flat because they know no feature — a category there would
be somebody's guess about which screen owns a thing that belongs to all of them.

### The same tree in a workspace with several apps

The split happens in exactly one place, and it is not a packaging preference — it is the feature line
drawn above.

```text
packages/ui/src/            THE VOCABULARY - knows no feature
    contracts/                  the entry table and the slot types
    leaves/<Name>/
    composites/<Name>/
    branches/<Name>/
    shells/<Name>/

apps/<app>/src/             THE SENTENCES - each knows its own domain
    app/                        routes only
    components/
        blocks/<category>/<Name>/
        overlays/<category>/<Name>/
        layouts/<Name>/
        pages/<Name>/
```

**Everything below a block is shared; a block and everything above it is not.** A leaf, a composite,
a branch and the contract table describe SHAPE, and a shape is the same shape in every app — that is
why one copy can exist and why it must. A block is a domain sentence: it knows what a course, an
invoice or a fleet resource is. Put one in the shared package and the package now knows a feature it
has no business knowing, and the next app inherits vocabulary it will never use.

The test is the same question the tier answers, asked about the workspace: **would a second app want
this without wanting the feature it was written for?** A `Badge` yes. A `FleetRow` no.

Nothing else moves. The tiers keep their names, their flat-or-categorised rule and their two-file
shape; several apps only decide which side of the feature line each tier lives on.

Destinations the rules name are created on first use rather than kept empty: a pure helper goes to
`modules/utils/`, a shared shape to `modules/types/`, a config map or non-translated copy to
`resources/`. That a folder does not exist yet is not a reason to leave a file in the component tree.

## Situation Codes

Every situation this module governs carries a code, `LAYOUT-<n>`. The code names the SITUATION; the
rule column of `## Tầng giữ` names what mechanically holds it. They are not the same thing, and one
of them holds less than the code claims.

| Code | Requires | Forbids |
|---|---|---|
| `FILE-1` | One component per folder, the folder named for what it exports; `index.tsx` carries a direct named export belonging to the folder's family | A folder whose export does not match its name; an unrelated passenger sharing the folder |
| `FILE-2` | A page, layout or overlay folder holds `index.tsx` and `component.tsx` plus the twin test of each | A third thing in that folder — another component, a `constants/`, a `utils/`, a hand-copied shape |
| `FILE-3` | A helper lives in the tree that names what it is: a fetch in `hooks/`, a pure function in `modules/utils/`, a shape in `modules/types/`, copy or a config map in `resources/` | `constants/`, `utils/`, `types/` or `hooks/` anywhere under `components/` |
| `FILE-4` | A component family exported member by member | `export const X = { A, B }` — one runtime object standing in for a namespace |
| `FILE-5` | The shared package holds `contracts/`, `leaves/`, `composites/`, `branches/`, `shells/`; `blocks/`, `overlays/`, `layouts/`, `pages/` belong to the app that owns the feature | A feature tier inside the shared package; a vocabulary tier inside one app |
| `FILE-6` | A file under `app/` names which page renders at which URL, and is one of the framework's own slots | Fetching, arrangement or a contract key in a route file; any named component file under `app/` |

`FILE-2` AND `FILE-3` ARE NOT THE SAME REFUSAL. `FILE-2` counts files in one surface folder and
does not care what they are; `FILE-3` names four folders that are wrong anywhere under
`components/`, including beside a block that `FILE-2` never looks at. A `utils/` inside a page
folder trips both, and that is not double-billing — it is two different claims that happen to meet.

The numbering has no ranking in it. `FILE-6` is not more severe than `FILE-1`; the codes are
addresses, and they are addresses other law files and past task records already cite.

## Tầng giữ

Which tier actually holds each code, and — where the tier over-promises — exactly what the mechanism
cannot see. The last column is the honest part of this table.

| Code | Tier | Rule in [`sources/fe/file-layout.mjs`](../../../sources/fe/file-layout.mjs) | What the rule cannot see |
|---|---|---|---|
| `FILE-1` | `enforced` | `export-matches-folder` | Whether the folder holds ONE component. The rule accepts a folder as soon as ONE export belongs to the family, so an unrelated passenger riding beside a matching export passes. |
| `FILE-2` | `enforced` | `surface-folder-two-files-only` | Nothing inside the two files. A `component.tsx` that has grown four components in one file is not a third file, so it passes. |
| `FILE-3` | `enforced` | `no-helper-folder-in-components` | A helper that is not in a folder. `components/blocks/billing/InvoiceRow/format.ts` is a loose file, not a `utils/`, and no path rule names it. |
| `FILE-4` | `enforced` | `no-runtime-namespace` | A namespace under a lowercase name, a one-member object, or members assembled outside an `export const`. The rule requires an initial capital and at least two capitalised members. |
| `FILE-5` | `enforced` | `monorepo-tier-belongs-to-its-side` | Anything in a single-app tree. Both regexes require a `packages/<name>/src/` or `apps/<name>/src/` segment, so in a single-app checkout the rule is inert by construction. |
| `FILE-6` | `enforced` | `route-tree-holds-routes-only` | Drawing. "Fetches and arranges" is not a property a path rule can measure: a route that mounts one component and a route that arranges six both return JSX. A `page.tsx` that draws still passes. |

All six codes are held by a named rule, so no row reads `documented`. That is the good news and it is
also the whole trap of this table: a code can be `enforced` and still be mostly unheld, because the
rule reads the PATH and the law is about the CONTENTS. The right column is where that gap is stated,
and it is carried forward into `audit.md` rather than hidden by the tier word.

## Anchor

Real code each code can be checked against. The unit-test file is the primary anchor because it names
the codes directly; the tree glob is the secondary anchor because it is where the law is actually
lived.

| Code | Anchor | What to look for |
|---|---|---|
| `FILE-1` | [`sources/fe/file-layout.test.mjs`](../../../sources/fe/file-layout.test.mjs), case `FILE-1: the path predicts the name` · `src/components/*/**/<Name>/index.tsx` | A direct named export equal to the folder name, or starting with it and continuing with a capital |
| `FILE-2` | Same file, case `FILE-2: a surface folder holds its two halves and their twins` · `src/components/pages/*/` and `src/components/overlays/*/*/` | Each folder listing exactly `component.tsx` and `index.tsx`, plus `.test.tsx` twins where they exist |
| `FILE-3` | Same file, case `FILE-3: a helper folder under components has a real home elsewhere` · `src/hooks/`, `src/modules/utils/` | The destinations exist and are populated, and a recursive search for `constants`, `utils`, `types` or `hooks` directories under `src/components/` returns nothing |
| `FILE-4` | Same file, case `FILE-4: a family is exported as members, not as one object` · every `index.tsx` under `src/components/` | Family members exported one per statement; no `export const <Capital> = { … }` holding only capitalised members |
| `FILE-5` | Same file, case `FILE-5: each tier sits on its own side of the feature line` — **`chưa neo được` in production code** | No workspace with `packages/` and `apps/` exists to point at; the only live evidence is the rule's own fixture paths |
| `FILE-6` | Same file, case `FILE-6: the routing tree holds route files and nothing else` · `src/app/**` | Every filename is a framework slot, `providers`, `globals.css`, a `.test.` twin, under `api/`, or under an `_` folder — and nothing else |

`FILE-5` is the one code with no production anchor, and it stays in the law anyway because the
single-app tree is a snapshot, not a decision. It is recorded under "Rủi ro còn mở" in `audit.md`
rather than quietly downgraded.

## Inputs

| Input | Evidence required |
|---|---|
| file | The path being placed or judged, forward-slash normalised |
| identity | What the file IS — a screen, a domain sentence, a shape, a fetch, a pure function, copy |
| tier | Which of the named folders the identity belongs to |
| feature | The domain the file speaks for, or the fact that it speaks for none |
| workspace | Single app, or a shared package plus apps |
| exports | The direct named exports of `index.tsx`, when the folder is being judged |

## Invariants

- A file's place follows from what it is, never from who currently imports it.
- A folder name and its export predict each other in both directions.
- A page, layout or overlay folder holds its two halves and their twins.
- Non-component code does not live in the component tree, whatever it is nested inside.
- A family is exported as members; a runtime namespace object is not a family.
- Tiers that know a feature belong to the app; tiers that know none belong to the shared package.
- `app/` holds framework slots only; a named component there is a component nobody will grep for.
- A destination folder that does not exist yet is created, not worked around.
- Every code maps to exactly one situation, and no situation carries two codes.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Twin tests.** `FILE-2` admits `component.test.tsx` and `index.test.tsx` in the surface folder;
  they are the twins of the two halves, not a third thing.
- **Route tests.** `FILE-6` exempts any `.test.` file under `app/`. A test ships in no bundle and no
  route renders it, so it cannot become the second page the code exists to prevent. Its name is
  deliberately not required to match `page` or `layout`: a route's tests split by CONCERN, and forcing
  them into one file buys nothing but a longer file.
- **Server code and framework opt-outs.** `FILE-6` exempts `app/api/**` and any `_folder`. Neither
  is a screen.
- **The two admitted non-slots.** `providers` and `globals.css` live under `app/` because the root
  layout mounts them and there is nowhere else they could be.
- **Typed variants of one component.** `FILE-1` admits several exports in one folder when each name
  belongs to the folder's family. A component and its variants are one component; a passenger is not.
- **Candidate trees.** A candidate under `.artifacts/**/candidate/` may mirror either workspace shape,
  and `FILE-5` reads whichever it finds.
- **Adoption order.** `export-matches-folder` is the one rule worth switching on at `warn` first in an
  existing tree: it fires on every folder whose convention predates the rule, and that count is a
  migration rather than a defect. The level in the consuming repository's config stays the authority.

## Output

```text
file: <path being placed>
identity: <what it is, independent of who calls it>
tier: <contracts | leaves | composites | branches | shells | blocks | overlays | layouts | pages | route | hooks | modules | resources>
situation: <FILE-1 | FILE-2 | FILE-3 | FILE-4 | FILE-5 | FILE-6>
destination: <the path it belongs at>
reason: <the fact about the file that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end that has a component tree and a file-based routing
tree. It names no product, no component library, no registry key and no repository. Every example is
ordinary TSX and ordinary folder names.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`. The
`LAYOUT-<n>` codes are addresses other files already cite: a code keeps its number and its meaning
across every version, and a code believed wrong is kept and argued in `audit.md`.
