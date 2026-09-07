# StarCi Work 3.0.0-alpha.2

Đọc [SKILL.md](SKILL.md) đầy đủ: prompt → preset/mode có tên → scope → op hữu hạn → kết quả thật.

## Thứ tự đọc

1. Skill gốc và [runtime](v3/README.vi.md).
2. [Catalogue skill](skills/catalog.json), document và recipe cố định được chọn.
3. [Contract op](v3/ops/catalog.json) được chọn và common policy.
4. Node/resource/evidence/source thực tế.
5. Sửa package thì đọc [UPDATE.md](UPDATE.md).

`skills/`: 14 preset EN/VI. `v3/ops/`: 32 op chi tiết. `v3/core/`, `v3/schemas/`: validation cây/deps/digest/evidence. `v3/cli/`: tra cứu, không dispatch. `knowledge/`: chuyên môn, không routing. `bin/`: installer. `.work/` thuộc sản phẩm, ngoài skill.

Mọi skill/worker/retry dùng chung tối đa 3 lớp tuần tự × 3 op đồng thời. Scope/deps thuộc sản phẩm, recipe chỉ giới hạn execution.

Đã bỏ V2 alias/routing/workflows/helpers/operators/session scripts/templates/website sinh cũ và Lite. Tra lịch sử bằng Git. Guard tên cũ bảo vệ dữ liệu, không là runtime thứ hai. Alpha/test không chứng minh product UAT/publish; installer không migrate ledger hoặc xóa Git worktree.
