# @starci/skills — Work 3.0 alpha

Prompt → skill/mode có tên → piece nghiệp vụ → op hữu hạn → kết quả thật.

[Entry gốc](SKILL.md) chọn [14 preset](skills/catalog.json) dùng [op có thật](v3/ops/catalog.json). Tổng mọi skill/worker/retry tối đa 3 lớp tuần tự × 3 invocation đồng thời. Không tự brainstorm workflow, request/response ledger bắt buộc hoặc provisioning ngầm.

Xem [runtime/storage](v3/README.vi.md). Candidate `3.0.0-alpha.2`; đổi version không phải publish/cài host. Node 20+, không dependency runtime ngoài. Chạy `npm test`, `node bin/starci-skills.mjs work help`; cài thử vào host biệt lập bằng init rồi doctor.

Installer ghi file package vào `.claude`, giữ custom instructions, chỉ ignore `.work/_local/`. Init bản quản lý dùng update. Không tự tạo nghiệp vụ, resolve credential/migrate dữ liệu.

Major cũ cần update --upgrade-major. Chỉ xóa file runtime nghỉ còn nguyên có manifest ownership; giữ và báo file sửa/unowned/settings. Force thay file package hiện hành, không xóa file nghỉ đã sửa. Bootstrap cũ nhận diện chính xác có thể chuyển về full router; custom conflict dừng trước ghi. No-bootstrap không được bỏ Lite khi host còn cần nó.

Đã bỏ V2 alias/routing/workflows/scripts/templates/test cũ/website sinh cũ và Lite; tra lịch sử bằng Git, không fallback. `.worktrees` sản phẩm/Git checkout là owner riêng. Migrate từ code là preset được chọn, phải giữ provenance/evidence/commit/credential custody.

Test fixture/installer không chứng minh product browser UAT/hành vi model. Ảnh phải capture và xem thật; source SHA không thay served build. Xóa website source/CI không gỡ website đã deploy. Refactor không publish registry/rollout/account/migrate ledger thật.
