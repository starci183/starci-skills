# exup-8 — negative corpus (qwen)

Read `_common.md`. Owns: `todo-app-backend/ex-testing/negative/**` (new dir only — KHÔNG sửa src hay .starciwork records thật).

Mission: template cần chứng minh hệ thống *bắt được* lỗi — tạo corpus defect mẫu.
1. Trong `ex-testing/negative/` tạo các case: record giả (`.starciwork` yaml mẫu có provenBy trỏ vào artifact không tồn tại), stale evidence mẫu (run cũ claim done sau khi src đổi), spec sai business (SRS inconsistency mẫu), lease-drift scenario mẫu
2. Mỗi case: file mẫu + README giải thích nó vi phạm luật nào + check nào phải bắt nó
3. Nếu checks hiện tại CHƯA bắt được case nào → report gap (không fix check — đó là việc wave khác)
4. Chạy check suite lên corpus, ghi kết quả pass/fail từng case
Report: corpus cases, detection matrix. Marker `done/exup-8.done`.
