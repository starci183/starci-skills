# Visual review: ui.notify.preferences

Reviewed by Codex from the actual generated image on 2026-09-18T12:24:31.258Z.
Outcome: accepted as a proposed direction with the implementation gaps named in index.yaml.

- Notifications navigation is selected with Alex present. Current On state, Turn off, refusal, Save preferences, Back to tasks, unsubscribe link and policy footer are visible.
- The control is an ordinary labelled Button, not an invented Grammar Switch. The refused save retains the prior setting.
- Signed-out unsubscribe is an explicit derived screen without authenticated shell or login prerequisite. No mascot or false delivery-success claim.

Final PNG: assets/preferences-refused.png (1536 x 1024), sha256 53a7bf26c06989cf7b906e37f232b23799150ae3dc544aa81f9dc59e8204e183.
Exact final prompt: assets/preferences-refused.prompt.txt, sha256 2decd0656f69b963380f3600a34dc2775df6bac5f1267c757e4f7a8d20bfb81b.

Coverage: 12 explicit state/screen/viewport entries; desktop-1280 is a design target, not a browser-captured viewport. Mobile-390 entries derive from the same direction and retain all controls.
One generation invocation produced the selected direction.

Truth boundary: image_gen.imagegen generated every pixel. No image model field was exposed. The PNG is not a running-product screenshot and proves neither exact Grammar rendering, CSS colour values, focus/keyboard behavior nor API outcomes. Implementation must use brand rev 3 tokens rather than sampling the raster, reuse the actual turtle master where allowed, address declared Grammar/theme/link gaps, and provide real implementation captures and independent browser UAT.

Checks: BRAND-1/2/3, CONTRAST-1, LAYOUT-1/2/3, COLLECTION-1/2, CTA-1/2/3/4 and RESPONSIVE-1/3 were applied as direction criteria. Contrast numbers belong to the source tokens; no pixel-level accessibility pass is claimed.
