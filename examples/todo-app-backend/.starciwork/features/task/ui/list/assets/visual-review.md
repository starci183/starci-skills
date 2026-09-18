# Visual review: ui.task.list

Reviewed by Codex from the actual generated image on 2026-09-18T12:29:10.478Z.
Outcome: accepted as a proposed direction with the implementation gaps named in index.yaml.

- Real top navigation and Alex presence; add-task input/action, four native checkbox rows, per-row Share/Schedule/Delete, and footer links are visible.
- Corrected Delete text to dark ink inside danger outlines. Rows remain a plain collection, without individual cards or a enclosing list card.
- No mascot in the populated destructive-action view. Empty state explicitly derives from this shell with no rows/delete controls and the brand turtle master.

Final PNG: assets/list-many-tasks.png (1536 x 1024), sha256 9bf10368a7319782318d131f90b309b79adf92d2a0ae2f043d439ab47a3ab47f.
Exact final prompt: assets/list-many-tasks.prompt.txt, sha256 e1c9d8c08d7ce8ee480e253b2e0ee56b49419cc9efd6355f454861ab9da0a4ce.

Coverage: 8 explicit state/screen/viewport entries; desktop-1280 is a design target, not a browser-captured viewport. Mobile-390 entries derive from the same direction and retain all controls.
The initial image and its exact prompt are retained as the final edit reference; they are not the selected direction.

Truth boundary: image_gen.imagegen generated every pixel. No image model field was exposed. The PNG is not a running-product screenshot and proves neither exact Grammar rendering, CSS colour values, focus/keyboard behavior nor API outcomes. Implementation must use brand rev 3 tokens rather than sampling the raster, reuse the actual turtle master where allowed, address declared Grammar/theme/link gaps, and provide real implementation captures and independent browser UAT.

Checks: BRAND-1/2/3, CONTRAST-1, LAYOUT-1/2/3, COLLECTION-1/2, CTA-1/2/3/4 and RESPONSIVE-1/3 were applied as direction criteria. Contrast numbers belong to the source tokens; no pixel-level accessibility pass is claimed.

Legacy note: list-refused.prompt.txt predates this run and is retained history only. It is neither the selected direction prompt nor an input to this generation.
