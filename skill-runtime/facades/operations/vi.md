# Operations facade

## LOADS

Không có.

## Purpose

Route provider và runtime operation tới đúng một existing owner mà không trộn credential, publication, deployment, quality-service hay proof boundary.

## Modes

| Mode | Physical skill | Discriminating intent |
|---|---|---|
| `tunnel` | `starci-cloudflare-tunnel-set` | public HTTP(S) tunnel và DNS route đã approve |
| `deploy` | `starci-deploy` | declared stack adoption, release, monitoring, recovery hoặc rollback |
| `mcp` | `starci-setup-mcp` | setup hoặc refresh Source-wide read-only source-context MCP |
| `sonar` | `starci-setup-sonar` | shared SonarQube service và strict quality-gate reconciliation |

## Input

Dùng yêu cầu gốc, Source/project route đã verify, service hoặc stack identity đã declare, provider target và known credential authority nhưng không dùng credential value.

## Output

Trả một mode và physical skill, selection reason, risk class, unresolved fact và invocation envelope không đổi.

## Permissions

Facade là read-only selection metadata. Nó không được lấy credential, mutate provider state, publish hostname, deploy release hay chuyển giao approval.

## Stops

Dừng khi route chưa resolve, có nhiều provider owner, thiếu credential authority, destructive/publication boundary chưa công bố, hoặc request là local development startup.

## Authority boundary

Dispatcher khởi động một physical skill riêng. Chỉ skill đó sở hữu credential intake, exact provider boundary, approval, mutation, retry, rollback và steady-state proof. Facade không có orchestration profile.
