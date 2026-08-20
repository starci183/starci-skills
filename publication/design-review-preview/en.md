# Universal parent-child design review

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@manifest-schema` | `publication/design-review-preview/schema.json` | file | Defines the project graph shared by layout canvas and block-detail routes. |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | Adapts registry heads and optional review batches into the shared Vite application. |

## Record

This module renders one Vite review application per project. Its manifest is a parent-child graph:
an exact `layoutId/layoutHash` owns declared regions, and each region resolves one scoped child
`(layoutId, layoutHash, blockId)` with an independently hashed block candidate.

## Law

Canonical layout/block JSON and registry heads remain authority. The Vite bundle, graph manifest, HeroUI
controls and representative content are rebuildable publication evidence.

The layout route renders the complete page with content in every region. A missing or stale child uses a
rough representation sufficient to judge geometry, density and reading order; it cannot imply block parts
or states. An accepted child whose recorded `layoutHash` equals the displayed parent renders its accepted
parts more precisely.

Clicking a region navigates to a dedicated block-detail route. It never opens a modal. The block route names
its exact parent layout version, compares anatomy candidates and explains every enumerated state. Accepting a
block changes the registry head; rebuilding the graph then replaces rough region content on the layout route.

## Inputs

Required inputs are project, registry, visual vocabulary and an output below
`.worktrees/<project>/cache/preview`. `--all-current` renders every accepted layout and compatible child
head. A layout or block review may overlay one validated artifact batch; block overlays additionally require
stable `layoutId`, `blockId` and the accepted parent `layoutHash`.

Optional shell and representative-content descriptors are project data, never hard-coded application rules.

## Process

Build the current project graph:

```bash
node scripts/render-design-review.mjs \
  --all-current --project <project> \
  --registry .worktrees/<project>/registries \
  --vocabulary .worktrees/<project>/cache/preview/visual-vocabulary.json \
  --out .worktrees/<project>/cache/preview/design-review
```

During layout review, add `--phase layout --layout-id <layoutId> --artifact <batch.json>`,
`--directions <batch.json>` and `--recommended-id <candidateId>`. During block review, use
`--phase block --layout-id <layoutId> --block-id <blockId> --artifact <batch.json>`.

For a combined first-layout review, use `--layout-draft-index <index.json>`. The index has a non-empty
`layouts` array whose entries declare `layoutId`, `artifact`, optional `directions`, optional `content`,
optional `shell`, and `recommendedId`; entry paths are relative to the index. Optional `flows` hold ordered
nodes referencing a layout and optional declared block region. The renderer resolves their immutable review
routes and adjacent edges. All proposed layouts share one manifest without requiring an accepted head.

The application uses hash routes:

```text
#/layouts/<layoutId>/<layoutHash>
#/layouts/<layoutId>/<layoutHash>/blocks/<blockId>
```

The script installs pinned Vite/HeroUI dependencies only when absent, builds once into the declared project
cache and writes one `review-manifest.json`.

## Rules

1. One project has one review application and one graph manifest, not one HTML page per candidate.
2. Every block record carries `layoutId`, exact parent `layoutHash` and `blockId`.
3. A child renders on the layout canvas only when its block head binds the displayed layout hash.
4. Missing/stale children render rough content; accepted children render accepted parts.
5. Clicking a layout region navigates to its block-detail route; publication modals are forbidden.
6. Block detail exposes every state with the same direction, copy and representative data.
7. Proposed block candidates appear on the block route but never replace accepted layout content before approval.
8. A new layout hash makes children bound to the old hash stale.
9. HeroUI is documentation chrome only; it is not product anatomy evidence.
10. Preview navigation never mutates registry state or counts as approval.

## Output

One self-contained Vite bundle plus a schema-2 graph manifest under the project cache. The default route opens
a layout canvas; every declared region links to a version-bound block-detail page.

## Stops

- Output outside the project preview cache is refused.
- A block artifact whose `layoutHash` is not the accepted registry head is refused.
- A blockId absent from the accepted parent regions is refused.
- Missing registry objects, vocabulary, layouts or recommended candidates are refused.
- A child head bound to another layout hash is shown stale and never rendered as accepted.

## Proof

Run graph-adapter tests, manifest validation, Vite typecheck/build and browser QA. Browser proof must show rough
missing/stale blocks, precise accepted blocks, navigation from layout to block detail, parent hash visibility,
state switching and back navigation without console errors.
