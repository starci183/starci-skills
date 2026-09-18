# Visual review: ui.task.list

Reviewed by Codex on 2026-09-18T14:05:58.053Z. Outcome: accepted proposed direction with the declared implementation gaps.

## Before / corrected

Before: Missing composer SurfaceCard; task rows lie flat on canvas; count beside label; rectangular actions.

Corrected: Raised composer card and one rounded raised SurfaceListCard enclosing all four rows; external All tasks / 4 tasks header and external footer; pill actions; no mascot in populated state.

## Actual anatomy sources

- [app-shell.png](../../../../../brand/assets/grammar-reference/app-shell.png) - actual render, SHA256 81fc3540234b264cf0f1fd11670474f1db42aaf961420ba3f9d8a7cb4318539c
- [task-composer.png](../../../../../brand/assets/grammar-reference/task-composer.png) - actual render, SHA256 3bdd79f76d91b3735bfe296c8fdc1df399ccf6c63f578ae56289f7841c89c7e5
- [task-list.png](../../../../../brand/assets/grammar-reference/task-list.png) - actual render, SHA256 8a441d4efabb9c1dd56083d31418434cb597e3bced3f28efa81380b760c971ba
- [buttons.png](../../../../../brand/assets/grammar-reference/buttons.png) - actual render, SHA256 9189c6b63af7b744824f7ffc9cf3c282c027c58d3eb614fb5bc80606ec3d74c9
- [empty-state.png](../../../../../brand/assets/grammar-reference/empty-state.png) - actual render, SHA256 5b7f81d7db9982db08ba0b4a9e1018f32e476d24b88b2b19d1903fbda54fe803

SurfaceCard (ariaLabel, bounded) supplies the raised rounded shell and inset content; it does not add a visible external label unless label is supplied. SurfaceListCard supplies a separate label/fact row above its one continuous raised row body, with footer below. Input supplies label and hint above the field and error below. Button uses pill geometry. WorkspaceShell plus NavigationFeatureNav supplies identity, named destinations and account actions; authentication remains the owner-required PrimaryRailLayout split. Native checkbox/radio controls are application content, not fabricated Grammar exports.

Text/TextAction/Badge content and state semantics remain mapped; dark ink follows brand rev 3 where screenshots use blue/white/orange ink. Progress and PrimaryRailLayout are not independently demonstrated by these eight captures. The package source inspection and preserved business inputs remain their authority.

The first anatomy render copied white Add task text; a second imagegen invocation corrected only that label to black. Empty state keeps the composer, external All tasks / 0 tasks header and raised shell, then inserts MediaFrame plus EmptyNotice into the body. No destructive controls coexist with that turtle.

## Knowledge conflict

COLLECTION-1 cases 1-4 and COLLECTION-2 prohibit an enclosing card, but @starci/grammar 0.4.13 SurfaceListCard actually renders a raised shell around its rows. The coordinator addendum explicitly requires this shipped anatomy. Preserve the external section label/fact and footer; use the published collection owner without an extra SurfaceCard or per-row cards. This is a documented knowledge/renderer conflict, not a claimed pass of those contradictory cases.

## Provenance and limits

Selected PNG: assets/list-many-tasks.png (1536 x 1024), SHA256 c7dd58006db611bc82bef05d8602f003fb3e7ee421857debaa467b2c19774651. Exact final prompt: assets/list-many-tasks.prompt.txt, SHA256 46509603956a36fe0f5c9dbfcb702e3673ea4b93bd0fc9ea1388ed2a5a5a3a4e. Every supplied generation image is retained and named in generation.inputRefs. The .v4 PNG/prompt pair preserves the actual pre-addendum input; earlier .initial pairs remain historical inputs.

Coverage: 8 explicit state/screen/viewport entries. Desktop is generated direction; mobile-390 and other states are derived specifications, not extra captured screens. Legacy list-refused.prompt.txt is unselected history and is not a generation input.

image_gen.imagegen generated the PNG. No model field was exposed. Manual inspection confirms the intended visible anatomy and retained UX, not exact CSS values, pixel-perfect component rendering, focus behavior or API outcomes. Frontend implementation must use actual components and exact brand tokens, provide Grammar-owned dark label/error and danger capability where declared, then produce real browser/UAT proof. Brand index and all pre-existing brand assets were left byte-for-byte unchanged.
