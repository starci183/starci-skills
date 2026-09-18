# Visual review: ui.recur.schedule

Reviewed by Codex from the actual generated image on 2026-09-18T12:26:24.711Z.
Outcome: accepted as a proposed direction with the implementation gaps named in index.yaml.

- Task context, frequency radio options, retained n=0 refusal, time, IANA zone and start date are legible. Save schedule, Cancel, shell and policy links are visible.
- Invalid positive-integer input replaces the old invented weekend refusal; day 31 remains allowed by the accepted specification.
- No upcoming list or end-rule action before a rule exists. Active/ended states separately map previews and materialised history; no mascot in this refusal screen.

Final PNG: assets/schedule-refused.png (1536 x 1024), sha256 8da30b01000f8f232067d6e440cf9e5ce55a59a9a804504f151539d3aa6f8c4f.
Exact final prompt: assets/schedule-refused.prompt.txt, sha256 c95b1b219a08bd6ae604adb46de8b722feb512a7b91157c385380b0e74282c3b.

Coverage: 8 explicit state/screen/viewport entries; desktop-1280 is a design target, not a browser-captured viewport. Mobile-390 entries derive from the same direction and retain all controls.
One generation invocation produced the selected direction.

Truth boundary: image_gen.imagegen generated every pixel. No image model field was exposed. The PNG is not a running-product screenshot and proves neither exact Grammar rendering, CSS colour values, focus/keyboard behavior nor API outcomes. Implementation must use brand rev 3 tokens rather than sampling the raster, reuse the actual turtle master where allowed, address declared Grammar/theme/link gaps, and provide real implementation captures and independent browser UAT.

Checks: BRAND-1/2/3, CONTRAST-1, LAYOUT-1/2/3, COLLECTION-1/2, CTA-1/2/3/4 and RESPONSIVE-1/3 were applied as direction criteria. Contrast numbers belong to the source tokens; no pixel-level accessibility pass is claimed.
