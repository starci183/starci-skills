---
title: File layout
description: Where an accepted shape's code goes — which file, which tier, what it exports, what it is named.
module: file-layout
kind: pattern
codes: [FILE-1, FILE-2, FILE-3, FILE-4, FILE-5, FILE-6]
---

# File layout

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | the published frontend machine this record cites |


## Record

The input to this pattern is a shape somebody already accepted — a screen, a domain sentence, a
container, a fetch, a pure function, a piece of copy. The decision that it should exist is closed and
this pattern never reopens it. The output is source architecture: which file holds it, which tier owns
that file, what the folder is named, what `index.tsx` exports, and what may not sit beside it.

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

The tree the law lands into:

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

In a workspace with several apps the split happens in exactly one place, and it is not a packaging
preference — it is the feature line drawn above.

```text
packages/ui/src/            THE VOCABULARY - knows no feature
    contracts/                  the entry table and the slot types
    leaves/<Name>/
    composites/<Name>/
    branches/<Name>/

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

## Situation codes

Every situation this module governs carries a code. The code names the SITUATION; the rule column
under **Layer held** names what mechanically holds it. They are not the same thing, and one of them
holds less than the code claims.

| Code | Situation | What the source must look like |
|---|---|---|
| `FILE-1` | The reader knows a component name and must be able to predict its path, and the reverse | One component per folder, the folder named for what it exports; `index.tsx` carries a direct named export belonging to the folder's family. Forbidden: a folder whose export does not match its name; an unrelated passenger sharing the folder |
| `FILE-2` | A surface — page, layout, overlay — is being given its folder | The folder holds `index.tsx` and `component.tsx` plus the twin test of each. Forbidden: a third thing in that folder — another component, a `constants/`, a `utils/`, a hand-copied shape |
| `FILE-3` | The shape produced something that is not component code — a fetch, a pure function, a type, copy, a config map | The helper lives in the tree that names what it is: a fetch in `hooks/`, a pure function in `modules/utils/`, a shape in `modules/types/`, copy or a config map in `resources/`. Forbidden: `constants/`, `utils/`, `types/` or `hooks/` anywhere under `components/` |
| `FILE-4` | A component and its family members are being exported | A component family exported member by member. Forbidden: `export const X = { A, B }` — one runtime object standing in for a namespace |
| `FILE-5` | The workspace has a shared package and one or more apps, and a tier must land on one side | The shared package holds `contracts/`, `leaves/`, `composites/`, `branches/`; `blocks/`, `overlays/`, `layouts/`, `pages/` belong to the app that owns the feature. Forbidden: a feature tier inside the shared package; a vocabulary tier inside one app; a parallel wrapper tier |
| `FILE-6` | The shape needs a URL, so something is being written under `app/` | A file under `app/` names which page renders at which URL, and is one of the framework's own slots. Forbidden: fetching, arrangement or a contract key in a route file; any named component file under `app/` |
| `FILE-7` | A file states which tier it belongs to, in source, beside the path that already states it | A source marker agrees with the folder that owns it. Forbidden: a file under one tier declaring itself another |
| `FILE-8` | A component needs a fixed vendor or native mechanic around checked content | The owner is a **named branch** that keeps the mechanic closed inside it. Forbidden: a `shells/` tier, and any tier standing in for one |

`FILE-2` AND `FILE-3` ARE NOT THE SAME REFUSAL. `FILE-2` counts files in one surface folder and
does not care what they are; `FILE-3` names four folders that are wrong anywhere under
`components/`, including beside a block that `FILE-2` never looks at. A `utils/` inside a page
folder trips both, and that is not double-billing — it is two different claims that happen to meet.

The numbering has no ranking in it. `FILE-6` is not more severe than `FILE-1`; the codes are
addresses, and they are addresses other law files and past task records already cite.

## Reading an accepted shape

1. **Read what the shape states.** It states what the thing IS — a screen, a domain sentence, a
   container, a shape, a fetch, a pure function, copy — and the domain it speaks for, or the fact that
   it speaks for none.
2. **Read what the shape does not state, and therefore does not resolve.** A shape does not name a
   path, a folder, an export list, a tier or a workspace side. It also never says who imports the
   thing, and if it did that would still not settle anything: a file's place follows from what it is,
   never from who currently imports it.
3. **Resolve outermost first.** Workspace side before tier (`FILE-5`), tier before folder, folder
   before file count (`FILE-2`), file count before export shape (`FILE-1`, then `FILE-4`). The route
   entry (`FILE-6`) is resolved from the screen, after the screen has a home — never before it.
4. **Ask each code's question in turn.** Would a second app want this without the feature
   (`FILE-5`)? Can the name predict the path and the path predict the name (`FILE-1`)? Is this a
   surface folder, and is anything in it besides the two halves and their twins (`FILE-2`)? Does this
   render anything at all (`FILE-3`)? Can the bundler tell the family members apart (`FILE-4`)? Is
   this file one of the framework's own slots (`FILE-6`)?
5. **When two codes both match, both hold.** Every code maps to exactly one situation, and no
   situation carries two codes — but one file can stand in two situations at once. A `utils/` folder
   inside a page folder is a `FILE-2` refusal about the count and a `FILE-3` refusal about the home;
   an `export const Card = { Root, Header }` inside `Card/` satisfies `FILE-1` and violates `FILE-4`.
   Emit one output block per file, and let it name every situation it stands in.

## `FILE-1` — one folder, one component, the name matches the export

**Situation.** The reader who knows a component name must be able to derive its path, and the reader
standing at a path must be able to derive the name. Grepping one name must land on one place, not
three places and not none.

**What it emits in source.** One folder per component, PascalCase, named for what it exports, with
`index.tsx` carrying a direct named export equal to the folder name — or starting with it and
continuing with a capital. Typed variants of the same component share the folder because every name
belongs to the folder's family: `Card`, `CardRoot`, `CardHeader`. What may not share it is a
passenger: a component of another family, another name, sitting there because it was convenient.

**Recognition signs.** The folder name is PascalCase but `index.tsx` does not export that name. Two
unrelated components share one folder, one of them "just parked here". Somebody has to open the file
to learn what the folder contains.

**Boundary.** This is not `FILE-2`: `FILE-1` is about the relation between name and export and holds
in every tier, while `FILE-2` counts files in a surface folder. A page folder whose `index.tsx`
matches its name but which carries a third file is green on `FILE-1` and red on `FILE-2`. It is not
`FILE-4` either: `FILE-1` asks whether the exported name belongs to the family, `FILE-4` asks what
SHAPE it was exported in — `export const Card = { Root, Header }` inside `Card/` satisfies `FILE-1`
and violates `FILE-4`.

**Common business situations.** A component is renamed and the folder is not · a variant is split out
and the old name is left behind · a `Card/` folder exports `Panel` because "it used to be Card" · a
small helper component is dropped into the big component's folder.

## `FILE-2` — a surface folder holds its two halves

**Situation.** A `page`, a `layout` or an `overlay` is one screen, and a screen has exactly two
halves: `index.tsx` is the wiring — request, situation, copy — and `component.tsx` is the shape. Plus
the twin test of each half. Nothing else.

**What it emits in source.** Exactly `index.tsx` and `component.tsx` in the surface folder, with
`component.spec.tsx` and `index.spec.tsx` where tests exist. Anything else the shape produced leaves
for its own tier: a domain row to `blocks/<category>/<Name>/`, a formatter to `modules/utils/`, a
response shape to `modules/types/`, a column config to `resources/`.

**Recognition signs.** A `.tsx` file with its own name appears in the page folder. A `constants/`,
`utils/`, `types/` folder or a hand-copied `shapes.ts` appears. Somebody has just said "only this page
uses it".

**Boundary.** This is not `FILE-3`: `FILE-3` forbids four helper folders everywhere under
`components/`, including beside a block that `FILE-2` never looks at. A `utils/` in a page folder
violates both, and that is not double-billing — it is two different claims that happen to meet.
It is also not `FILE-1`, which judges the name-to-export relation and is indifferent to the count.

This always starts harmless — "only this page uses it" — and it ends with one surface folder holding
four components, a constants folder, a utils folder and three hand-copied resting shapes, at which
point the screen is a second codebase with private vocabulary nobody else can reuse.

**Common business situations.** A table row "only this screen has" · a status badge "used only here" ·
a currency formatter parked beside the page · a hand-copied response type · a column config array · a
sub-section split out to keep `component.tsx` short.

## `FILE-3` — non-component code does not live in the component tree

**Situation.** `constants/`, `utils/`, `types/` and `hooks/` are not component folders. Each of those
things already has a real home, and the home is the whole point.

**What it emits in source.** The destination named by identity, created on first use: a fetch →
`hooks/`; a pure function → `modules/utils/`; a shared shape → `modules/types/`; copy or a config map
→ `resources/`. That a destination folder does not exist yet is not a reason to leave the file in the
component tree — it is created, not worked around.

**Recognition signs.** A folder named exactly one of those four words sits somewhere under
`components/`. A pure function that takes no props and renders nothing sits in the component tree. A
second person has just rewritten that same function somewhere else.

**Boundary.** This is not `FILE-2`: `FILE-2` counts files inside one surface folder and does not care
what they are, while `FILE-3` names four folder names that are wrong anywhere under `components/`,
beside any tier. `FILE-2` never looks at a block folder; `FILE-3` does.

The reason is the home, not tidiness. Parked beside a component, a helper is invisible to everyone who
would have reused it, so the second person rewrites it. Then the two copies drift apart — and nothing
raises an alarm, because each is "correct" inside its own scope.

**Common business situations.** A date formatter · a status-code-to-label map · a response type · a
per-page count constant · a `useX` that only calls an API · a column config table.

## `FILE-4` — a family is exported as members

**Situation.** `export const Card = { Root, Header }` packs the whole family into one build-time unit.
A call site importing only the header pulls the whole family in, and no member can fall out of the
bundle.

**What it emits in source.** One export statement per family member from `index.tsx`, each name
belonging to the folder's family. No `export const <Capital> = { … }` holding only capitalised
members.

**Recognition signs.** A capitalised `export const` whose value is an object literal with capitalised
keys. Call sites written as `Card.Header`. The bundle grows and nobody can explain why.

**Boundary.** This is not `FILE-1`: a namespace object still matches the folder name, so `FILE-1` does
not catch it. The two codes look at two different things on the same line of code.

A dotted call site is a convenience, and the bundler is the party paying for it.

**Common business situations.** `Card.Root` / `Card.Header` · `Table.Row` / `Table.Cell` ·
`Form.Field` / `Form.Error` · icons collected into one object · variants collected into one object.

## `FILE-5` — the shared package stops just below a block

**Situation.** In a workspace with several apps the boundary passes through exactly one place: between
a block and everything below it.

**What it emits in source.** `contracts/`, `leaves/`, `composites/` and `branches/` under
`packages/<name>/src/`; `blocks/`, `overlays/`, `layouts/` and `pages/` under `apps/<app>/src/`, in
the app that owns the feature. No feature tier inside the shared package, no vocabulary tier inside
one app, and no parallel wrapper tier invented to straddle the line.

**Recognition signs.** `packages/*/src/` contains `blocks/`, `overlays/`, `layouts/` or `pages/`.
`apps/*/src/` contains `contracts/`, `leaves/`, `composites/` or `branches/`. The package header says
"blocks belong to the app" while the folder tree says the opposite.

**Boundary.** Size, elegance and technical reusability are not the criterion; the only criterion is
whether the tier knows a feature. This is why `FILE-5` is a code and not a packaging preference: a
leaf, a composite, a branch and the contract table describe SHAPE, and a shape is the same shape in
every app, while a block is a domain sentence that knows what a course, an invoice or a fleet resource
is.

The damage is double, not single: a misplaced block ships in an app that does not need the domain,
**and** the next author reads the folder tree and reasonably concludes the line sits somewhere else —
so they put a page there too.

**Common business situations.** A domain row moved to the shared package "so it can be reused" · a
login overlay in the package · a `Badge` copied into the second app · a `Tree` contract that exists in
only one app.

## `FILE-6` — a route mounts, and `app/` holds routes only

**Situation.** A file under `app/` names which page renders at which URL. No fetching, no arrangement,
no contract key. And the reverse: `app/` holds nothing except the framework's own slots.

**What it emits in source.** A framework slot file under the segment — `page`, `layout`, `template`,
`loading`, `error`, `not-found`, `default`, `route` and their siblings — that mounts a screen living
at `components/pages/<Name>/`. Plus `providers` and `globals.css`, which the root layout mounts and
which have nowhere else to go. `app/api/**` is server code, `_folder` is the framework's own opt-out,
and `.spec.` files are exempt because a test ships in no bundle and no route renders it. **Every other
file there is a component sitting in a folder nobody will grep.**

**Recognition signs.** A route file calls a hook, reads the session, assembles a layout tree. A
named file such as `fleet-page.tsx` appears under `app/`. No screen can be found under
`components/pages/` although that screen is plainly running.

**Boundary.** This is not `FILE-2`: `FILE-6` cannot see INSIDE `page.tsx`. A `page.tsx` that draws
still passes. Splitting the two halves is `FILE-2`'s business, not this code's.

The second sentence of this code was once only prose, and the price of that is on record. A page owner
was written into `app/<segment>/fleet-page.tsx` and passed build, lint, typecheck, four sealed
screenshots and one approval, right up to the edge of a write into production with **every gate
green** — because every gate was reading a rule, and this one was only prose.

**Common business situations.** A route calling `useSession` itself · a route assembling a shell
before mounting the page · a component parked in `app/` "to keep it near the route" · a `helpers.ts`
inside a segment.

## `FILE-7` — a source marker is evidence, never a second classification

**Situation.** A component file declares its own tier in source — a `meta.shape`, or whatever a
repository calls it — while its path already declares one. Two statements about the same fact.

**What it emits in source.** Nothing new. This code adds no marker and requires none: a repository that
declares no marker anywhere is not failing this code, it has nothing for the code to read. What it
governs is the case where a marker exists.

**Recognition signs.** A file in `blocks/` saying it is a leaf. A folder moved between tiers with the
marker left behind. A marker copied along with a file that was duplicated from another tier.

**Boundary.** Not `FILE-1`: that code compares a folder with its export NAME. This one compares a folder
with a claim the source makes about the tier, which is a different sentence in a different place.

**Why a duplicate fact is worse than no fact.** A path and a marker cannot disagree usefully. Every
reader downstream — a rule, a script, a person — must pick one, and each picks silently, so the same
file is a block to one and a leaf to another. The marker earns its place only while it repeats the path
exactly; the moment it does not, it is a second classification nobody voted for.

**Common business situations.** A component promoted from composite to branch · a file copied to start
a new one · a tier renamed across a folder while one file kept the old word.

## `FILE-8` — there is no shell tier

**Situation.** A component must wrap checked content in a mechanic somebody else wrote — a dialog, a
drawer, a vendor card body — and the reflex is a tier to park such things in.

**What it emits in source.** A **named branch**, holding the mechanic closed inside it and taking typed
contract content across its boundary. Nothing else changes; the vocabulary gains a name, not a tier.

**Recognition signs.** A `shells/` folder. A tier whose members share no shape, only the fact that each
wraps something. A name ending in `Shell` for a thing that is not one of the two the vocabulary has.

**Boundary.** Not `FILE-5`: that code decides which SIDE a tier lands on. This one says the tier does not
exist to be placed.

**Why a tier here and not a name.** Every other tier answers *what shape is this*. A shell tier answers
*whose markup is inside*, which is a different question, so its members have nothing in common to check
and nothing to refuse. It becomes the folder anything can enter — an untyped exemption with a tidy name,
and the one place the contract stops governing.

**Common business situations.** A vendor dialog · a drawer around a form · a card body from a component
library · anything reached for when a mechanic feels too small for its own branch.

## Layer held

Which tier actually holds each code, and — where the tier over-promises — exactly what the mechanism
cannot see. The last column is the honest part of this table.

| Code | Tier | Rule in `@canon-fe` | What the rule cannot see |
|---|---|---|---|
| `FILE-1` | `enforced` | `export-matches-folder` | Whether the folder holds ONE component. The rule accepts a folder as soon as ONE export belongs to the family, so an unrelated passenger riding beside a matching export passes. |
| `FILE-2` | `enforced` | `surface-folder-two-files-only` | Nothing inside the two files. A `component.tsx` that has grown four components in one file is not a third file, so it passes. |
| `FILE-3` | `enforced` | `no-helper-folder-in-components` | A helper that is not in a folder. `components/blocks/billing/InvoiceRow/format.ts` is a loose file, not a `utils/`, and no path rule names it. |
| `FILE-4` | `enforced` | `no-runtime-namespace` | A namespace under a lowercase name, a one-member object, or members assembled outside an `export const`. The rule requires an initial capital and at least two capitalised members. |
| `FILE-5` | `enforced` | `monorepo-tier-belongs-to-its-side` | Anything in a single-app tree. Both regexes require a `packages/<name>/src/` or `apps/<name>/src/` segment, so in a single-app checkout the rule is inert by construction. |
| `FILE-6` | `enforced` | `route-tree-holds-routes-only` | Drawing. "Fetches and arranges" is not a property a path rule can measure: a route that mounts one component and a route that arranges six both return JSX. A `page.tsx` that draws still passes. |
| `FILE-7` | `enforced` | `source-tier-marker-matches-folder` | A repository that declares no marker. The rule reads a marker it finds; it never asks for one, so a tree without the convention is silent rather than red — inert by construction, like `FILE-5` in a single-app checkout. |
| `FILE-8` | `enforced` | `no-shell-tier` | A branch that is a shell in everything but its folder. The rule reads the path, so a mechanic parked inside `branches/` under a vague name passes — naming is `FILE-1`'s question. |

All six codes are held by a named rule, so no row reads `documented`. That is the good news and it is
also the whole trap of this table: a code can be `enforced` and still be mostly unheld, because the
rule reads the PATH and the law is about the CONTENTS. The right column is where that gap is stated,
and it is carried forward rather than hidden by the tier word.

## Anchor

Real code each code is measured against. The unit-test file is the primary anchor because it names the
codes directly; the tree glob is the secondary anchor because it is where the law is actually lived.

| Code | Anchor | What to look for |
|---|---|---|
| `FILE-1` | `@canon-fe`, case `FILE-1: the path predicts the name` · `components/*/**/<Name>/index.tsx` | A direct named export equal to the folder name, or starting with it and continuing with a capital |
| `FILE-2` | Same file, case `FILE-2: a surface folder holds its two halves and their twins` · `components/pages/*/` and `components/overlays/*/*/` | Each folder listing exactly `component.tsx` and `index.tsx`, plus `.spec.tsx` twins where they exist |
| `FILE-3` | Same file, case `FILE-3: a helper folder under components has a real home elsewhere` · `hooks/`, `modules/utils/` | The destinations exist and are populated, and a recursive search for `constants`, `utils`, `types` or `hooks` directories under `components/` returns nothing |
| `FILE-4` | Same file, case `FILE-4: a family is exported as members, not as one object` · every `index.tsx` under `components/` | Family members exported one per statement; no `export const <Capital> = { … }` holding only capitalised members |
| `FILE-5` | Same file, case `FILE-5: each tier sits on its own side of the feature line` — **not anchorable in production code** | No workspace with `packages/` and `apps/` exists to point at; the only live evidence is the rule's own fixture paths |
| `FILE-6` | Same file, case `FILE-6: the routing tree holds route files and nothing else` · `app/**` | Every filename is a framework slot, `providers`, `globals.css`, a `.spec.` twin, under `api/`, or under an `_` folder — and nothing else |

`FILE-5` is the one code with no production anchor, and it stays in the law anyway because the
single-app tree is a snapshot, not a decision. It is recorded as an open risk rather than quietly
downgraded.

## Inputs

| Input | Evidence required |
|---|---|
| file | The path being placed or judged, forward-slash normalised |
| identity | What the file IS — a screen, a domain sentence, a shape, a fetch, a pure function, copy |
| tier | Which of the named folders the identity belongs to |
| feature | The domain the file speaks for, or the fact that it speaks for none |
| workspace | Single app, or a shared package plus apps |
| exports | The direct named exports of `index.tsx`, when the folder is being judged |

## Rules

1. A file's place follows from what it is, never from who currently imports it.
2. A folder name and its export predict each other in both directions.
3. A page, layout or overlay folder holds its two halves and their twins.
4. Non-component code does not live in the component tree, whatever it is nested inside.
5. A family is exported as members; a runtime namespace object is not a family.
6. Tiers that know a feature belong to the app; tiers that know none belong to the shared package.
7. `app/` holds framework slots only; a named component there is a component nobody will grep for.
8. A destination folder that does not exist yet is created, not worked around.
9. Every code maps to exactly one situation, and no situation carries two codes.
10. Every frontend unit test is colocated with its owner and uses `.spec.`; frontend has no separate unit or E2E test tree.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Twin tests.** `FILE-2` admits `component.spec.tsx` and `index.spec.tsx` in the surface folder;
  they are the twins of the two halves, not a third thing.
- **Route tests.** `FILE-6` exempts any `.spec.` file under `app/`. A test ships in no bundle and no
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

One block per file the shape produces.

```text
file: <path being placed>
identity: <what it is, independent of who calls it>
tier: <contracts | leaves | composites | branches | blocks | overlays | layouts | pages | route | hooks | modules | resources>
situation: <FILE-1 | FILE-2 | FILE-3 | FILE-4 | FILE-5 | FILE-6>
destination: <the path it belongs at>
reason: <the fact about the file that excludes the adjacent code>
```

## Worked example

**The accepted shape.** A Fleet Resources screen at `/fleet` lists fleet resources as rows, each row
showing a status badge and a monthly cost rendered as currency; the screen is accepted in a single-app
tree.

The shape states what each thing IS and which domain it speaks for. It does not state a path, a folder
name, an export list, a tier or a route filename, and it does not resolve them — those follow from the
identities below, not from the shape and not from the fact that the row is used by exactly one screen
today.

```text
file: src/components/pages/FleetResources/component.tsx
identity: the shape half of one screen
tier: pages
situation: FILE-2
destination: src/components/pages/FleetResources/component.tsx
reason: it is the shape half of a surface folder, so the folder may hold it and index.tsx and their twins and nothing else; FILE-3 does not apply because it renders
```

```text
file: src/components/pages/FleetResources/index.tsx
identity: the wiring half of one screen - request, situation, copy
tier: pages
situation: FILE-1
destination: src/components/pages/FleetResources/index.tsx
reason: it carries a direct named export FleetResources equal to the folder name; this is the name-to-export claim, not the file count claim FILE-2 makes
```

```text
file: src/components/blocks/fleet/FleetRow.tsx
identity: a domain sentence - it knows what a fleet resource is
tier: blocks
situation: FILE-2
destination: src/components/blocks/fleet/FleetRow/index.tsx
reason: it is a third thing in the screen folder if left there, and it knows a feature, so it is grouped under a category; FILE-3 does not apply because it renders
```

```text
file: src/components/pages/FleetResources/StatusBadge.tsx
identity: a shape that knows no feature - a label with a state
tier: leaves
situation: FILE-1
destination: src/components/leaves/StatusBadge/index.tsx
reason: it is a passenger in another component's folder, not a typed variant of that folder's family, and it names no feature so it is flat with no category
```

```text
file: src/components/pages/FleetResources/utils/formatCurrency.ts
identity: a pure function - renders nothing, takes no props
tier: modules
situation: FILE-3
destination: src/modules/utils/formatCurrency.ts
reason: it is a helper folder name under components/, wrong beside any tier - FILE-2 also fires here on the count, and the two refusals are different claims that happen to meet
```

```text
file: src/app/fleet/page.tsx
identity: the route entry - which page renders at which URL
tier: route
situation: FILE-6
destination: src/app/fleet/page.tsx
reason: it is one of the framework's own slots and it mounts FleetResources rather than drawing; FILE-2 does not apply because this code cannot see inside page.tsx
```

`FILE-4` is not reached: the shape produces no component family, so no export shape is in question.
`FILE-5` is not reached either: the tree is a single app, and the rule's regexes require a
`packages/<name>/src/` or `apps/<name>/src/` segment, so it is inert here by construction.

## Scope

This module states a rule true of any front end that has a component tree and a file-based routing
tree. It names no product, no component library, no registry key and no repository. Every example is
ordinary TSX and ordinary folder names.
