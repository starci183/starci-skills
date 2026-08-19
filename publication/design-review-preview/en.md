# Universal design review preview

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@manifest-schema` | `publication/design-review-preview/schema.json` | file | Defines the shared layout/block review input. |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | Adapts a validated design artifact and registry into the shared Vite preview. |

## Record

This module owns the human rendering shared by frontend layout and block design. One Vite application
renders every project from a disposable `review-manifest.json`; a skill never authors candidate-specific
HTML, CSS or JavaScript.

## Law

The canonical layout or block JSON and its hash remain authority. The manifest, Vite bundle, HeroUI
documentation chrome, shell,
representative content, inspectors and interactions are rebuildable publication evidence. They may expose
registry facts but cannot add a product decision absent from the artifact.

The renderer has two adapters over one interface:

- layout candidates render route geometry and clickable regions; region modals show contract citation,
  assembler, mount lifetime and current block-head status;
- block candidates render every enumerated state and clickable parts; part modals show citation,
  optionality and ownership evidence.

## Inputs

Required inputs are `phase`, `project`, the validated artifact batch, the project design registry, the
generated visual vocabulary and an output below `.worktrees/<project>/cache/preview`. Block reviews also
require stable `layoutId` and `blockId`. A direction batch, shell descriptor and representative-content
descriptor are optional inputs; defaults are neutral and carry no project claim.

## Process

Run the adapter after artifact validation and hashing:

```bash
node scripts/render-design-review.mjs \
  --phase layout \
  --project <project> \
  --layout-id <layoutId> \
  --artifact <layout-batch.json> \
  --directions <direction-batch.json> \
  --registry .worktrees/<project>/registries \
  --vocabulary .worktrees/<project>/cache/preview/visual-vocabulary.json \
  --content <representative-content.json> \
  --shell <shell-descriptor.json> \
  --recommended-id <candidateId> \
  --out .worktrees/<project>/cache/preview/<layoutId>
```

For a block review, use `--phase block`, `--layout-id`, `--block-id` and the block batch. The adapter
resolves the accepted parent direction from the registry; it never accepts a competing direction.

The script installs the pinned Vite runtime only when absent, builds the same application into the
declared cache root and writes `review-manifest.json`. Serve the generated directory with the bounded
8080–8099 port search already owned by the calling design skill.

## Rules

1. A design skill produces JSON plus a manifest; it does not create bespoke preview markup.
2. The output path must be below the declared project's preview cache.
3. Project identity, shell and representative content are data inputs, never hard-coded in the Vite app.
4. Layout modals may read block status but never display or decide block anatomy.
5. Block previews show every enumerated state with the same direction, copy and representative data.
6. Candidate, direction, viewport, evidence and approval inspectors use the shared controls in every project.
7. Preview interactions do not mutate the registry or count as approval.
8. HeroUI is pinned to the frontend vendor family for modal and control mechanics only; it is not product anatomy evidence.

## Output

One self-contained Vite bundle and `review-manifest.json` under the project cache. The URL opens one review
application with candidate switching, responsive viewport controls and typed inspector modals.

## Stops

- Output outside the project preview cache is refused.
- A block artifact whose `layoutHash` is not the accepted registry head is refused.
- A missing artifact, registry object, visual vocabulary or recommended candidate is refused.
- A direction that cannot be resolved from the layout artifact or accepted parent layout is refused.

## Proof

Run the renderer tests, Vite typecheck and build. A valid review must open without console errors, switch
candidates and viewports, and open region or part inspectors without changing the artifact or registry.
