# exup-6 — observability slice (devin)

Read `_common.md`. Owns: `todo-app-backend/src/modules/platform/observability/**` (new), health/metrics wiring, related specs.

Mission: chưa thấy observability story — prod cần health/metrics/logs.
1. Survey platform/ dir — NestJS conventions hiện có (terminus? custom?)
2. Implement: `/health` (liveness) + `/ready` (readiness — check DB, queue nếu có), `/metrics` Prometheus-format nếu stack cho phép, structured request logging (request-id correlation, không log secrets)
3. Specs: health endpoint trả đúng shape khi DB up/down (e2e), request-id propagate, metrics endpoint expose counters
4. Document trong TESTING.md/README cách xem metrics trong dev stack
Report: endpoints, specs, sample output. Marker `done/exup-6.done`.
