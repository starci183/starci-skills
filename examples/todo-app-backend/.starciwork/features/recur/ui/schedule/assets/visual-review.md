# Visual review: ui.recur.schedule

Reviewed by Codex on 2026-09-18T14:05:58.053Z. Outcome: accepted proposed direction with the declared implementation gaps.

## Before / corrected

Before: Outlined panel; labels beside Inputs and hints below; rectangular actions.

Corrected: Raised form SurfaceCard, labels and hints above rounded Inputs, error below n=0, paired time/time-zone grid, pill actions; no upcoming/end action before rule exists.

## Actual anatomy sources

- [app-shell.png](../../../../../brand/assets/grammar-reference/app-shell.png) - actual render, SHA256 81fc3540234b264cf0f1fd11670474f1db42aaf961420ba3f9d8a7cb4318539c
- [sign-in-card.png](../../../../../brand/assets/grammar-reference/sign-in-card.png) - actual render, SHA256 b1948cf75464804f055ea37953c72751f3e36795267f1f204179917da1d6eeee
- [inputs.png](../../../../../brand/assets/grammar-reference/inputs.png) - actual render, SHA256 812589428e7f1fb3cd538f5502f8cc58f0981270ecdcc15e908f86737a87e112
- [buttons.png](../../../../../brand/assets/grammar-reference/buttons.png) - actual render, SHA256 9189c6b63af7b744824f7ffc9cf3c282c027c58d3eb614fb5bc80606ec3d74c9
- [empty-state.png](../../../../../brand/assets/grammar-reference/empty-state.png) - actual render, SHA256 5b7f81d7db9982db08ba0b4a9e1018f32e476d24b88b2b19d1903fbda54fe803
- [task-list.png](../../../../../brand/assets/grammar-reference/task-list.png) - actual render, SHA256 8a441d4efabb9c1dd56083d31418434cb597e3bced3f28efa81380b760c971ba

SurfaceCard (ariaLabel, bounded) supplies the raised rounded shell and inset content; it does not add a visible external label unless label is supplied. SurfaceListCard supplies a separate label/fact row above its one continuous raised row body, with footer below. Input supplies label and hint above the field and error below. Button uses pill geometry. WorkspaceShell plus NavigationFeatureNav supplies identity, named destinations and account actions; authentication remains the owner-required PrimaryRailLayout split. Native checkbox/radio controls are application content, not fabricated Grammar exports.

Text/TextAction/Badge content and state semantics remain mapped; dark ink follows brand rev 3 where screenshots use blue/white/orange ink. Progress and PrimaryRailLayout are not independently demonstrated by these eight captures. The package source inspection and preserved business inputs remain their authority.

The first anatomy render copied orange error ink; a second imagegen invocation corrected that sentence to dark text while retaining the danger edge. Active/ended states place StaticStateRow children inside the shared raised SurfaceListCard. EmptyNotice remains source-grounded because the empty capture has no visible notice text.

## Knowledge conflict

COLLECTION-1 cases 1-4 and COLLECTION-2 prohibit an enclosing card, but @starci/grammar 0.4.13 SurfaceListCard actually renders a raised shell around its rows. The coordinator addendum explicitly requires this shipped anatomy. Preserve the external section label/fact and footer; use the published collection owner without an extra SurfaceCard or per-row cards. This is a documented knowledge/renderer conflict, not a claimed pass of those contradictory cases.

## Provenance and limits

Selected PNG: assets/schedule-refused.png (1536 x 1024), SHA256 72d414204d5e268e80de282db9747f3ef6dead9aa39bcae909b8f432189e2d1a. Exact final prompt: assets/schedule-refused.prompt.txt, SHA256 5422440ad6dee0bca97bddea096348e3451ffca89f6c31cef2666718a8b2abd4. Every supplied generation image is retained and named in generation.inputRefs. The .v4 PNG/prompt pair preserves the actual pre-addendum input; earlier .initial pairs remain historical inputs.

Coverage: 8 explicit state/screen/viewport entries. Desktop is generated direction; mobile-390 and other states are derived specifications, not extra captured screens.

image_gen.imagegen generated the PNG. No model field was exposed. Manual inspection confirms the intended visible anatomy and retained UX, not exact CSS values, pixel-perfect component rendering, focus behavior or API outcomes. Frontend implementation must use actual components and exact brand tokens, provide Grammar-owned dark label/error and danger capability where declared, then produce real browser/UAT proof. Brand index and all pre-existing brand assets were left byte-for-byte unchanged.
