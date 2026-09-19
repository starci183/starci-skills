# exup-1 — seed enrichment (devin)

Read `_common.md`. Owns: `todo-app-backend/.starcistacks/dev/seeds/**`, `todo-app-backend/src/.starcistacks/dev/seeds/**`, `todo-app-backend/.starciwork/_resources/fixtures/**`.

Mission: seeds hiện chỉ `01-schema.sql` + `02-tasks.sql` — quá mỏng cho production bar.
1. Survey schema thật (src modules + existing seeds) → inventory mọi entity cần seed
2. Viết seed set đầy đủ: baseline realistic data + edge cases (unicode/emoji titles, boundary dates, timezone edge, max-length fields, recurrence edge patterns, share-cap boundary, soft-deleted rows, audit-erasure states)
3. Volume tier: thêm `seeds/volume/` — dataset đủ lớn để e2e perf-relevant queries có nghĩa (ít nhất vài nghìn tasks, phân bố đều users)
4. Idempotent: seeds phải chạy lại được (upsert/truncate strategy), document trong README của seeds dir
5. Verify: compose up + seeds apply sạch, một e2e journey chạy được trên seeded data
Report: inventory, files added, verification output. Marker `done/exup-1.done`.
