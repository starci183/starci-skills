# file layout

## Definition

Where a file sits is a claim about what it is. A folder under `components/` says "this draws
something"; a folder under `hooks/` says "this fetches"; a folder under `modules/` says "this is not
React at all". A file in the wrong place is not untidy — it is mislabelled, and the cost is that
nobody who would have reused it can find it.

The question that settles it: **what is this file, independent of who currently calls it?** "Only
this screen uses it" describes today's call graph, not the thing, and it is the sentence that turns
one screen's folder into a second codebase.

What holds this law is [`sources/file-layout.mjs`](../../../sources/fe/file-layout.mjs), plus the tree
below, which is the map the rules send things back to.

Implementation anchors in `starci-academy-fe`:
`src/components/blocks/dashboard/CreditStatRow/index.tsx` and
`src/components/blocks/dashboard/CreditStatRow/component.tsx`.

## The tree

```
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
know the domain, and a feature is the only grouping that stays true as the product grows.
`leaves/`, `branches/`, `layouts/` and `pages/` are flat because they know no feature — a category
there would be somebody's guess about which screen owns a thing that belongs to all of them.

## The same tree in a monorepo

A workspace with several apps splits the tree in exactly one place, and the split is not a packaging
preference — it is the feature line drawn above.

```
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
shape; a monorepo only decides which side of the feature line each tier lives on. A candidate under
`.artifacts/**/candidate/` may mirror either layout, and lint reads whichever it finds.

Destinations the rules name are created on first use rather than kept empty: a pure helper goes to
`modules/utils/`, a shared shape to `modules/types/`, a config map or non-translated copy to
`resources/`. That a folder does not exist yet is not a reason to leave a file in the component
tree.

## Rules

**LAYOUT-1 · One component, one folder, and the folder is named for what it exports.**

The folder name is the component's name. A reader who knows the name knows the path, and a grep for
the name finds one place. The rule that holds this asks only for a direct named export whose name
belongs to the folder's family, so a component and its typed variants can share a folder while an
unrelated passenger cannot.

**LAYOUT-2 · A screen folder holds its two halves and nothing else.**

A page, a layout or an overlay folder holds `index.tsx` and `component.tsx` — the wiring and the
shape — plus the twin test of each. A third thing appearing there is the notification that something
reusable was invented in a place nobody else can find.

This always begins harmlessly: "only this page uses it". It ends as a screen folder holding four
components, a constants folder, a utils folder and three hand-copied resting shapes, at which point
the screen is a second codebase with its own private vocabulary.

**LAYOUT-3 · What is not component code does not live in the component tree.**

`constants/`, `utils/`, `types/` and `hooks/` are not component folders. Each has a real home, and
the home is the point: left beside the component, the helper is invisible to everybody who would
have reused it, so the second author writes it again and the two drift.

**LAYOUT-4 · A folder exports a family, never a runtime namespace object.**

`export const Card = { Root, Header }` bundles at build time as one unit, so importing the header
drags the whole family in, and nothing can be tree-shaken away. Export the members. A dotted call
site is a convenience the bundler pays for.

**LAYOUT-5 · In a monorepo, the shared package stops below the block.**

`packages/ui/src/` holds `contracts/`, `leaves/`, `composites/`, `branches/` and `shells/` — the
tiers that know no feature. `blocks/`, `overlays/`, `layouts/` and `pages/` belong to the app that
owns the feature they speak for.

A block in the shared package is the whole failure in one file: the package now knows a domain, the
apps that never wanted that domain still ship it, and the next author reasonably concludes the line
is somewhere else and puts a page there too.

**LAYOUT-6 · The route file mounts and nothing else, and `app/` holds nothing but route files.**

A file under `app/` names which page renders at which URL. No fetching, no arrangement, no contract
key. If a route file is drawing, the page it should be mounting does not exist yet — and the drawing
is now in the one place nobody looks for it.

The routing tree holds the framework's own slots — `page`, `layout`, `template`, `loading`, `error`,
`not-found`, `default`, `route` and their siblings — plus `providers` and `globals.css`, which the
root layout mounts and which have nowhere else to be. `app/api/**` is server code and `_folders`
are Next's own opt-out; neither is a screen. **Any other file there is a component in the one
directory nobody greps.** A screen goes to `components/pages/<Name>/`, a domain sentence to
`components/blocks/<category>/<Name>/`.

That second sentence was not always written down, and the cost of leaving it implicit is on record:
a page owner was written to `app/<segment>/fleet-page.tsx` and carried a build, a lint run, a
typecheck, four sealed screenshots and an approval to the edge of a production write with every gate
green — because every gate was reading rules, and this one was only prose.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A third file in a page, layout or overlay folder | Something reusable was invented where nobody can find it | A component of its own goes to `blocks/<category>/`, a fetch to `hooks/`, a pure helper to `modules/utils/` |
| `constants/`, `utils/`, `types/`, `hooks/` under `components/` | It is not component code, so the folder is mislabelled and the contents are invisible | Move it to the tree that names what it is |
| A category folder under `leaves/` or `branches/` | Those tiers know no feature, so any category is a guess about which screen owns them | Keep them flat |
| A flat `blocks/<Name>/` with no category | A domain component with no feature has nowhere to be found by the next person working on that feature | Put it under the feature it speaks for |
| `blocks/`, `overlays/`, `layouts/` or `pages/` inside a shared package | The package learns a feature, and every app that never wanted it ships it anyway | Move it to `apps/<app>/src/components/` |
| A leaf, composite, branch or contract inside one app of a monorepo | The second app writes it again, and the two drift with nothing to notice | Move it to `packages/ui/src/` |
| A folder whose export does not match its name | The path stops predicting the name, and a grep finds nothing | Rename one of them so the two agree |
| `export const X = { A, B }` as a namespace | It bundles as one unit, so importing one member drags in all of them | Export the members directly |
| Fetching or drawing in a route file | The route becomes a second page, in the file nobody looks in | Mount the page; move the work into it |
| A named component file under `app/` | The routing tree is addressed by URL, not browsed by tier, so the component is invisible to everyone looking for its siblings | `components/pages/<Name>/` for a screen, `components/blocks/<category>/<Name>/` for a domain sentence |

## Examples

### The ordinary case — a block lands where its feature is

```
components/blocks/dashboard/DailyQuest/
    index.tsx           the wiring: the request, the situation, the words
    component.tsx       the shape
    component.test.tsx  the twin
```

```
components/pages/DashboardPage/
    index.tsx
    component.tsx
    DailyQuest.tsx      <- wrong: invented here, so the feature that needs it next cannot find it
    utils/format.ts     <- wrong: not component code at all
```

They differ in one thing: whether the parts have names outside the screen that first needed them.

### The category trap

```
components/leaves/Text/                     flat: a line of copy belongs to no feature
components/blocks/dashboard/StreakStrip/    grouped: a streak is a dashboard sentence
```

```
components/leaves/dashboard/Text/           wrong: this leaf is not the dashboard's
components/blocks/StreakStrip/              wrong: no feature, so nobody owns it
```

They differ in one thing: whether the tier knows a feature at all.

### The namespace trap

```tsx
export const CardRoot = ({ contract, render }: CardRootProps) => /* ... */
export const CardHeader = ({ props }: CardHeaderProps) => /* ... */
```

```tsx
// Wrong: one runtime object, so a call site importing the header links the whole family and
// nothing can be dropped from the bundle.
export const Card = { Root: CardRoot, Header: CardHeader }
```

They differ in one thing: whether the bundler can tell the members apart.

### The route trap

```tsx
// route: it says which page renders here.
const DashboardRoute = () => <DashboardPage />
export default DashboardRoute
```

```tsx
// Wrong: the route fetches and arranges, so there are now two pages and only one of them is
// where anybody would look.
export default function DashboardRoute() {
    const session = useSessionToken()
    return <Tree contract="nav-over-body-page"><ShellNav /><DashboardPage /></Tree>
}
```

They differ in one thing: whether the route draws.
