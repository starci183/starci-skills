---
name: starci-fe-sync
description: Mirrors a component out of the design-system folder — where it was authored, storied and gated — into the app's own `src` tree as a twin, and writes the connected half on the app side: the wrapper that holds the request, the store slice and the translation, and renders the presentational file through `@/components/*` rather than `@sb-components/*`. Reach for it when a design-system component has to start doing real work in the app, when the app is reaching into the design system to get one, or when a component changed shape upstream and the app copy stayed behind: "wire this card to real data", "bring the storybook block into the app", "connect this block to SWR", "the twin is missing", "why is src importing @sb-components", "dựng trang X", "sửa layout", "component này có story rồi mà app chưa dùng", "tạo twin cho block này". Not for authoring the component or its story in the first place — that happens in the design system, before anything is synced — and not for deciding which component a shape of data becomes, which is the lookup in `canon/fe/explore/component/`. Registering the two roots is `starci-setup-workspace-fe`.
---

# Syncing a design-system component into the app

A component is authored where it can be seen: in the design-system folder, beside a story that puts
its states side by side, under gates that read both. It is used where it cannot be seen: in the app,
against a live server, a session, a locale. Those are two different jobs, and the file that does both
at once can be rendered in neither place honestly — `canon/fe/enforce/tiers/architecture.md` sets out why, and
`canon/fe/enforce/tiers/split.md` works the divide out in full.

So the app does not import the design system. It carries a **twin**: the same presentational file,
mirrored, plus a connected file that only the app can write. The sync runs one way. The design system
is the source, the twin is the copy, and a change made in the copy is a change nobody will ever see
in a story.

## The two roots

Never write either of them down. Ask:

```bash
node .claude/scripts/read-workspace-context.mjs fe.path
node .claude/scripts/read-workspace-context.mjs fe.design_system
```

`fe.design_system` is `.storybook/` inside the app repo. When the ecosystem's book lives in another
checkout instead, that entry is `design_system.path`, recorded by `starci-setup-storybook-choose`.
Either way the answer comes from the command, not from memory: a path that was right on the last
machine is the failure that looks like success.

## What a twin is

| In the design-system folder | In `src` | Exports | Is |
|---|---|---|---|
| a vocabulary tier's single file, named for its folder | `index.tsx` in the mirror folder | `Name` | presentational, one file |
| a data-owning tier's `component.tsx` | `component.tsx` in the mirror folder | `_Name` | presentational |
| nothing — it cannot live there | `index.tsx` beside it | `Name` | connected |

Atoms, frames and composites are vocabulary: they never fetch and never resolve text, so their twin
is the mirrored file and nothing else. Blocks, layouts, overlays and pages own data, so their twin is
two files, and the second one is the only new code the sync produces.

The connected file is the whole reason the design system cannot hold it. It reads SWR, it reads a
Zustand slice, it calls `t()` — every one of those is a source of truth reached for past its props,
and a story has none of them to offer.

## The sync, in order

**1. Confirm it exists as a component and a story.** A component with no story has not finished being
authored, and syncing it makes the app the place where its states are first discovered. If there is
no story, stop here: the work belongs upstream, in the design system, before anything is mirrored.

```bash
cd "$(node .claude/scripts/read-workspace-context.mjs fe.path)"
node .claude/patterns/fe/gates/check-story-coverage.mjs
```

**2. Read it before copying it.**

- **2a.** Decide the tier from what the file *knows*, not from the folder it sits in. A component that
  takes `items`, `title`, `onPress` is vocabulary; one that takes an entity, or an id it intends to
  resolve, is a block whatever the path says. The tier table and the deciding signals are in
  `canon/fe/enforce/tiers/architecture.md`.
- **2b.** List, in words, what the connected half will have to supply: which query or facade hook,
  which store slice, which translation keys. Writing that list first is what keeps the connected file
  from growing a second job. If a key does not exist yet in both message catalogs, it is part of this
  change — `canon/fe/enforce/authoring/i18n.md`.

**3. Mirror the presentational file.** Copy it to the same sub-path under `src/components/`, then
rewrite its imports: every `@sb-components/` becomes `@/components/`, and the repeated folder segment
collapses, because a component folder in the app is reached through its `index.tsx`
(`canon/fe/enforce/authoring/structure-and-naming.md`). Change nothing else. A diff that also improves the
component is a diff nobody can review, and the improvement belongs upstream where the story would
have shown it.

**4. Write the connected half.** Only for a data-owning tier. It takes nothing from its parent, holds
the request and derives the status, resolves the text, and renders the presentational export with
already-resolved props:

- the request through the SWR and facade-hook layering in `canon/fe/enforce/authoring/async-data.md` — a
  component never reaches the module layer;
- loading, error and mutating flags taken from the hook rather than mirrored into a `useState`, which
  is the same file's rule and the one most often broken by hand;
- store reads by selector, per `canon/fe/enforce/authoring/state-management.md`;
- text through `next-intl`, resolved here and passed down as strings.

The order of the async switch is fixed and belongs to the presentational half: error, then loading,
then empty, then content. The connected half decides *what the status is*; it does not re-decide what
to render. `canon/fe/enforce/authoring/loading-and-skeleton.md` spells the states out.

A presentational parent composes **connected** children — `_Screen` renders `Block`, never `_Block`.
Threading a child's data through its parent is the prop-drilling the tiers exist to prevent.

**5. Move every call site, and delete what it replaced.** Every place in the app that was drawing this
shape by hand now imports the twin. Leaving one behind is worse than not starting: the app then holds
two spellings of one component, and the one nobody migrated is the one that keeps being copied. If a
call site cannot move in this change, record it rather than remember it — `starci-record-debt`.

**6. Verify.** Below.

**7. Record what did not fit.** A call site left behind, a prop the twin had to widen, a translation
key invented on the way — each of those is a deferral with a reason, and the reason is the part the
code cannot show later.

## The import that the whole split rests on

App code imports `@/components/*`. It never imports `@sb-components/*`.

The alias is not cosmetic: `@sb-components/` resolves into the design-system tree, which is dev-only.
An app that imports it ships a catalog, and — worse — makes the catalog's file the thing that runs, so
the twin silently stops being exercised. The line is held by
`patterns/fe/gates/check-src-sb-import.mjs`, which fails on any `src` file that reaches across, and
names the twin to create when one is missing.

## Storybook-first, checked afterwards rather than trusted

**No component reaches the app that was never a component and a story in the design-system folder
first.** Discipline states that; the gates prove it, and they prove it after the fact, which is the
only moment it can be proved:

| Gate | Refuses |
|---|---|
| `patterns/fe/gates/check-src-sb-import.mjs` | an `src` file importing the design-system tree |
| `patterns/fe/gates/check-story-coverage.mjs` | a canonical component with no story at the mirror path |
| `patterns/fe/gates/check-doc-parity.mjs` | a component whose leading spec block drifted from its story's |
| `scripts/check-presentational-purity.mjs` | a `component.tsx` that fetches, reads a store, or resolves text |
| `patterns/fe/gates/check-orphan-parts.mjs` | the retired anatomy props surviving in a mirrored file |
| `patterns/fe/gates/check-passthrough-block.mjs` | a block that forwards instead of earning its layer |

Finding a component in `src` that has no counterpart upstream is not a sync problem. It is a
component that skipped the design system, and the repair runs the other way: take it up, story it,
then sync it back down.

## Verifying

```bash
cd "$(node .claude/scripts/read-workspace-context.mjs fe.path)"
npx tsc --noEmit
npx eslint . --max-warnings=0
```

Lint is not advisory here — formatting is decided by ESLint and the pre-commit gate runs it at
`--max-warnings=0` (`canon/fe/enforce/authoring/imports-and-format.md`).

Then the gates above, and — when the sync touched spacing, seams or truncation — the rendered-tree
run, which measures computed style rather than reading source: `patterns/fe/runner/test-runner.ts`,
against the vocabulary in `patterns/fe/patterns.mjs`, with the contract explained in
`canon/fe/enforce/testing.md`. Last, open the routes whose call sites moved. A twin can type-check, pass every
gate, and still be the wrong shell; `canon/fe/enforce/spacing/overview.md` is what a screen is read against.

## When the connected half needs something the API does not have

Sometimes the twin is blocked on a field that does not exist yet. That is a backend change, not a
reason to fetch twice or to derive the value in the component: `canon/be/contracts/api-surface.md` for
the shape of the surface, and `node .claude/scripts/read-workspace-context.mjs be.path` for where it
lives. Until the field exists, the honest move is to record the gap rather than fake it.

## Common mistakes

- **Editing the mirrored file in `src`.** It is a copy. The change belongs upstream, where a story
  would have shown its effect on every state at once; sync it down again afterwards.
- **Putting `t()` in the presentational half** because the string was right there. That file can no
  longer be rendered from a story with no locale, which was the entire point of splitting it.
- **A connected half that also draws.** If it composes classes or lays anything out, a composite is
  missing. `canon/fe/enforce/tiers/architecture.md` states why a block takes no `className`.
- **Syncing a component nobody picked.** Which component a shape of data becomes is a lookup, entered
  from the data and read rightward: `canon/fe/explore/component/data/matrix.csv` and
  `canon/fe/explore/component/data/sections.csv`. Reading backward from a name you already had in mind is how a
  type-valid, gate-green, wrong shell survives review.
- **Half a migration.** Two spellings of one component in one app is the state this skill exists to
  end, not a stage it is allowed to stop in.

## Files

| Path | What it is |
|---|---|
| `canon/fe/enforce/tiers/architecture.md` | the tiers, the import direction, the split |
| `canon/fe/enforce/tiers/split.md` | the two files, worked out in full |
| `canon/fe/enforce/tiers/story.md` | what the story upstream has to be |
| `patterns/fe/gates/` | the gates that hold each line |
| `.claude/scripts/read-workspace-context.mjs` | where the two roots actually are |
| `test.mjs` | `node .claude/skills/starci-fe-sync/test.mjs` |

Authoring the component upstream comes first; fetching the book onto a machine that has none is
`starci-setup-storybook-generate`, and choosing between the ones it has is
`starci-setup-storybook-choose`.
