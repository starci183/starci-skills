# Visual review: ui.audit.privacy

Reviewed by Codex from the actual generated image on 2026-09-18T12:25:43.315Z.
Outcome: accepted as a proposed direction with the implementation gaps named in index.yaml.

- Privacy navigation, user presence and footer are visible. Export is separate from erasure, with independent labels and consequences.
- Benign export uses a blue action with black ink. Erasure is a danger-outline action with dark label and explicit irreversible copy. Refusal says submission failed, without claiming success or inventing a legal hold.
- No turtle anywhere on this destructive surface. Confirmation and completed/pending states remain explicitly mapped.

Final PNG: assets/privacy-erasure-refused.png (1536 x 1024), sha256 e660c47df2949dd0808dc3c3b3c927668da9864260d460042b45540810436cf8.
Exact final prompt: assets/privacy-erasure-refused.prompt.txt, sha256 84f35a17a04bc812718d2d0d1dd45bbd51c82d403abb41f9e550c895df9a1ee8.

Coverage: 12 explicit state/screen/viewport entries; desktop-1280 is a design target, not a browser-captured viewport. Mobile-390 entries derive from the same direction and retain all controls.
One generation invocation produced the selected direction.

Truth boundary: image_gen.imagegen generated every pixel. No image model field was exposed. The PNG is not a running-product screenshot and proves neither exact Grammar rendering, CSS colour values, focus/keyboard behavior nor API outcomes. Implementation must use brand rev 3 tokens rather than sampling the raster, reuse the actual turtle master where allowed, address declared Grammar/theme/link gaps, and provide real implementation captures and independent browser UAT.

Checks: BRAND-1/2/3, CONTRAST-1, LAYOUT-1/2/3, COLLECTION-1/2, CTA-1/2/3/4 and RESPONSIVE-1/3 were applied as direction criteria. Contrast numbers belong to the source tokens; no pixel-level accessibility pass is claimed.
