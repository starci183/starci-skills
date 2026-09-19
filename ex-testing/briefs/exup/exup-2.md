# exup-2 — branch coverage push (devin)

Read `_common.md`. Owns: `todo-app-backend/src/**/*.spec.ts` (NEW spec files only — không sửa spec có sẵn của lane khác; nếu spec file đã tồn tại cho module đó thì mở rộng trong file đó).

Mission: branch coverage đang **54.85%** — mục tiêu đẩy lên ≥75% bằng cách đánh error paths.
1. Đọc `coverage/coverage-summary.json` → list 10 file/module có branch coverage thấp nhất nhưng business-critical (bussiness/, platform/ ưu tiên, bỏ qua generated/trivial)
2. Với mỗi file: đọc source, viết specs cho uncovered branches — error handling, guard clauses, boundary conditions, failure injection (repo throws, external timeout)
3. Rules: real TestingModule hoặc focused unit spec — không mock-vô-nghĩa; mỗi spec phải assert behavior thật
4. Chạy coverage sau mỗi module, đo delta
Report: per-module before/after branch %, tổng delta, list specs added. Marker `done/exup-2.done`.
