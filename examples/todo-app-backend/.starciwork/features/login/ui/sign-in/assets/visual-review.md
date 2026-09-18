# Visual review: ui.login.sign-in

Reviewed by Codex on 2026-09-18T14:05:58.053Z. Outcome: accepted proposed direction with the declared implementation gaps.

## Before / corrected

Before: No bounded form SurfaceCard; outlined square controls and disabled rectangular action.

Corrected: Left turtle preserved; right raised SurfaceCard contains vertically labelled Inputs, uniform refusal, inactive filled pill and real auth links; policy footer outside.

## Actual anatomy sources

- [sign-in-card.png](../../../../../brand/assets/grammar-reference/sign-in-card.png) - actual render, SHA256 b1948cf75464804f055ea37953c72751f3e36795267f1f204179917da1d6eeee
- [inputs.png](../../../../../brand/assets/grammar-reference/inputs.png) - actual render, SHA256 812589428e7f1fb3cd538f5502f8cc58f0981270ecdcc15e908f86737a87e112
- [buttons.png](../../../../../brand/assets/grammar-reference/buttons.png) - actual render, SHA256 9189c6b63af7b744824f7ffc9cf3c282c027c58d3eb614fb5bc80606ec3d74c9
- [text-and-actions.png](../../../../../brand/assets/grammar-reference/text-and-actions.png) - actual render, SHA256 bc0242e9ebe4c3b4930dc7457f115b6b25742c1ca262cee338fa813830b6bd73

SurfaceCard (ariaLabel, bounded) supplies the raised rounded shell and inset content; it does not add a visible external label unless label is supplied. SurfaceListCard supplies a separate label/fact row above its one continuous raised row body, with footer below. Input supplies label and hint above the field and error below. Button uses pill geometry. WorkspaceShell plus NavigationFeatureNav supplies identity, named destinations and account actions; authentication remains the owner-required PrimaryRailLayout split. Native checkbox/radio controls are application content, not fabricated Grammar exports.

Text/TextAction/Badge content and state semantics remain mapped; dark ink follows brand rev 3 where screenshots use blue/white/orange ink. Progress and PrimaryRailLayout are not independently demonstrated by these eight captures. The package source inspection and preserved business inputs remain their authority.

One reference-guided imagegen invocation produced this correction.

## Provenance and limits

Selected PNG: assets/sign-in-refused.png (1536 x 1024), SHA256 fa29e6e11f6491abab71863a1a601efe762d92e6980ec3a301fa65b32d72beff. Exact final prompt: assets/sign-in-refused.prompt.txt, SHA256 835f2722e0ced512e4deb805fa95af97a766e8e4e7554fcb5b3a3f5737451a86. Every supplied generation image is retained and named in generation.inputRefs. The .v4 PNG/prompt pair preserves the actual pre-addendum input; earlier .initial pairs remain historical inputs.

Coverage: 8 explicit state/screen/viewport entries. Desktop is generated direction; mobile-390 and other states are derived specifications, not extra captured screens.

image_gen.imagegen generated the PNG. No model field was exposed. Manual inspection confirms the intended visible anatomy and retained UX, not exact CSS values, pixel-perfect component rendering, focus behavior or API outcomes. Frontend implementation must use actual components and exact brand tokens, provide Grammar-owned dark label/error and danger capability where declared, then produce real browser/UAT proof. Brand index and all pre-existing brand assets were left byte-for-byte unchanged.
