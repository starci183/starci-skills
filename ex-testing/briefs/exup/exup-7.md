# exup-7 — UAT evidence pipeline hardening (qwen)

Read `_common.md`. Owns: `todo-app-frontend` UAT/e2e tooling + `todo-app-backend/.starciwork/features/*/uat/**` audit (read-mostly; chỉ tạo runs mới, không sửa runs cũ).

Mission: 242 artifacts tồn tại nhưng cần verify pipeline còn sống + bao phủ đủ.
1. Audit: feature nào có `.starciwork` records nhưng thiếu/không có UAT run evidence (screens/video)? List ra.
2. Chạy UAT capture pipeline (tìm script trong repo — playwright? scripts/) cho các feature thiếu evidence → tạo runs mới với đúng format `runs/<ts>-<id>/{screens,videos}`
3. Negative-path evidence: hiện evidence hầu hết happy path — capture thêm error states (form validation fail, unauthorized, cap-exceeded, offline)
4. Viết `ex-testing/uat/README.md`: cách chạy capture, retention policy đề xuất, naming conventions
Report: coverage matrix feature→evidence, new runs created, gaps còn lại. Marker `done/exup-7.done`.
