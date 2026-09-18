# Visual review: ui.share.invite

Reviewed by Codex from the actual generated image on 2026-09-18T12:30:38.429Z.
Outcome: accepted as a proposed direction with the implementation gaps named in index.yaml.

- Task breadcrumb and Back to task place the screen. Invalid retained email, Viewer/Editor choices, refusal, Send invitation and two unchanged collaborators are visible.
- Removed the initial outer card around the collaborator collection and corrected refusal ink. Revoke labels remain dark within danger outlines. Pending expiry copy is 14 days.
- No mascot. Invalid-email refusal is grounded in fr.share.invite; this image does not invent a duplicate-invitation backend rule.

Final PNG: assets/invite-refused.png (1536 x 1024), sha256 3e3040354d9ae1e9d874f7a04f0731166def52e465bfb739c7b630daf1f321b7.
Exact final prompt: assets/invite-refused.prompt.txt, sha256 6033834c00bceffb22af88a9f2dbae3a59a079725a19725c8ec9d8624c668638.

Coverage: 10 explicit state/screen/viewport entries; desktop-1280 is a design target, not a browser-captured viewport. Mobile-390 entries derive from the same direction and retain all controls.
The initial image and its exact prompt are retained as the final edit reference; they are not the selected direction.

Truth boundary: image_gen.imagegen generated every pixel. No image model field was exposed. The PNG is not a running-product screenshot and proves neither exact Grammar rendering, CSS colour values, focus/keyboard behavior nor API outcomes. Implementation must use brand rev 3 tokens rather than sampling the raster, reuse the actual turtle master where allowed, address declared Grammar/theme/link gaps, and provide real implementation captures and independent browser UAT.

Checks: BRAND-1/2/3, CONTRAST-1, LAYOUT-1/2/3, COLLECTION-1/2, CTA-1/2/3/4 and RESPONSIVE-1/3 were applied as direction criteria. Contrast numbers belong to the source tokens; no pixel-level accessibility pass is claimed.
