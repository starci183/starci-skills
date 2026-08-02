# sync — from a storied component to a working twin

A component has two homes and they are not copies of each other. In the design system it is
*authored*: built at its tier, given a story for every state, and held by the gates. In the app it
*works*: wired to a request, a store, a translation. The second is a thin wrapper around the first,
and the direction between them is fixed — the design system never imports the app, and the app
imports the design system through its own alias, never the design-system tree directly.

The rule that makes this checkable:

**Nothing reaches `src/` that was never a component and a story in the design system first**, and
**`src/` renders the presentational file through `@/components/*`, never `@sb-components/*`.**

The second half is a gate: `scripts/gates/check-src-sb-import.mjs` fails any `src/` file that
reaches into the storybook tree. It exists because that import is invisible in review — the code
runs, the component renders — and ships design-system-only tooling to real users.

## The twin

The connected file in `src/` owns everything the presentational component refused to know:

- the fetch, through the app's async boundary, with the loading condition computed once and passed
  down as a single `isSkeleton` — see `enforce/authoring/async-data.md` and
  `enforce/authoring/loading-and-skeleton.md`
- the store slice and the translation
- and nothing else: no layout, no second tree, no branch that duplicates the presentational shape

The presentational half and the split that divides them are `enforce/tiers/split.md`. Which
component a given shape of data becomes — before either half exists — is `explore/component/`.

`starci-fe-sync` is the skill that performs this: it mirrors an authored component into the app and
writes the connected half. It does not author the component or its story; that happens first, in the
design system, and is the build lane's job.
