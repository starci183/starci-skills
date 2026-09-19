# exup-3 — frontend test depth (qwen)

Read `_common.md`. Owns: `todo-app-frontend/src/**` (test files), `todo-app-frontend` test config.

Mission: FE chỉ có 23 specs — quá mỏng.
1. Survey FE routes/components/state — map ra user journeys đã có UAT video trong backend `.starciwork` (sign-in, task lifecycle, share, notify prefs, plan)
2. Viết component/integration specs cho journeys đó: render đúng state, user interaction flows, error/loading states, form validation
3. Dùng stack test hiện có của repo (check package.json — vitest/jest + testing-library); không thêm framework mới nếu repo đã có
4. Mỗi spec gắn journey thật — không phải snapshot vô nghĩa
5. Chạy suite, đảm bảo xanh; report coverage nếu tooling cho phép
Report: journeys covered, specs added, suite result. Marker `done/exup-3.done`.
