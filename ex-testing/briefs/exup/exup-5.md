# exup-5 — perf baseline (qwen)

Read `_common.md`. Owns: `todo-app-backend/ex-testing/perf/**` (new dir), `todo-app-backend/scripts/perf-*` (new).

Mission: không có perf baseline — production bar cần con số.
1. Survey compose stack + endpoints (REST + GraphQL nếu có) — chọn 5 journey nặng nhất (task list paginated, recur expansion, share fan-out, notify digest, audit export)
2. Viết k6 (hoặc autocannon nếu k6 không có sẵn — check tooling trước) scripts cho journeys đó, chạy trên seeded data (volume seeds của exup-1 nếu đã land, không thì tự seed minimal)
3. Baseline report: p50/p95/p99 latency, throughput, error rate — lưu `ex-testing/perf/baseline-<ts>.json` + README.md cách chạy
4. Đề xuất SLO draft trong report (không enforce — chỉ đo)
Report + marker `done/exup-5.done`.
