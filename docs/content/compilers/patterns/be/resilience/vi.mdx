---
title: Resilience
---

# Resilience

## LOADS

Không có.

## Record

Mẫu này định tuyến call đã được chấp thuận nhưng có thể gây hại bởi failure, latency hoặc concurrency.
Nó đặt time budget, retry, isolation và fallback quanh dependency mà vẫn giữ feature contract trung thực.

## Law

Resilience là budget, không phải lạc quan. Mọi call ngoài process hoặc có thể block có deadline được
propagate, retry transient hữu hạn, boundary concurrency và outcome khi dependency không trả lời.
Cancellation là correctness: công việc không còn caller/deadline phải dừng nơi dependency cho phép.

Câu hỏi: dưới delay, failure, overload và cancellation, hệ thống có dừng tiêu tài nguyên vô hạn và chỉ
trả result mà contract cho phép không?

## Situation codes

| Code | Tình huống | Source phải có |
|---|---|---|
| `RESILIENCE-1` | Call chờ process/resource khác | Deadline/timeout explicit từ operation budget; timeout khác provider failure |
| `RESILIENCE-2` | Transient failure có thể thành công sau | Retry hữu hạn cho class transient allowlist, backoff/jitter bị chặn, một overall deadline; không retry auth/validation/permanent |
| `RESILIENCE-3` | Dependency fail hoặc quá tải | Breaker, bulkhead hoặc load-shed có tên, queue/concurrency hữu hạn và outcome reject rõ |
| `RESILIENCE-4` | Dependency không cung cấp primary result | Fallback giữ contract, freshness, authorization; không fabricate success hoặc stale data im lặng |
| `RESILIENCE-5` | Caller/request/job hết deadline | Signal cancellation/deadline đi qua call, timer, stream; late work không mutate operation đã bỏ |

## Reading an accepted shape

1. Xác định dependency, contract và quyền dùng stale/empty/degraded output.
2. Đặt total deadline trước retry/concurrency; control bên trong không được kéo dài nó.
3. Chỉ retry transient, operation idempotent/safe; bảo vệ dependency ở boundary chung.
4. Sau khi biết contract, chọn fallback/cancellation: thời gian kết thúc (`-1`), lỗi được lặp (`-2`),
   overload bị từ chối (`-3`), result trung thực (`-4`), abort đi tới mọi child (`-5`).
5. Code cộng dồn: breaker không thay deadline; fallback không thay cancellation.

## `RESILIENCE-1` — deadline/timeout explicit

Caller cung cấp hoặc operation tạo một deadline. Mỗi client nhận remaining budget, không nhận timeout mới
vượt tổng. Timeout là outcome typed khác provider reject, validation và cancellation.

Ranh giới: `CONFIGURATION` chỉ cung cấp default ceiling, operation sở hữu live deadline; `ASYNC-3` là
retry job, còn call trong job vẫn dùng budget chung.

## `RESILIENCE-2` — retry transient hữu hạn

Chỉ retry lỗi transient allowlist trên operation safe/idempotent; attempt, delay, jitter bị chặn bởi
deadline. Auth, validation, cancellation, business permanent không retry.

Ranh giới: `ASYNC-3` là delivery attempt của job, code này là dependency call; `OBSERVABILITY` ghi quyết
định nhưng không thực hiện retry.

## `RESILIENCE-3` — breaker/bulkhead/load shedding giữ capacity

Boundary dependency khai báo bảo vệ: breaker mở sau lỗi và probe hồi phục; bulkhead giới hạn concurrent/
queue; load shedding reject excess bằng outcome typed. Limit hữu hạn và đo được.

Ranh giới: timeout bảo vệ một call (`-1`), code này bảo vệ capacity chung; assurance không được suy ra từ
health check đơn giản.

## `RESILIENCE-4` — fallback giữ contract

Chỉ trả giá trị contract cho phép: cache có freshness, optional empty, queued acknowledgement hoặc
unavailable failure ổn định. Giữ authorization, tenant và shape; không giả success mutation hoặc lộ
stale/unauthorized data.

Ranh giới: `INTEGRATION-3` dịch provider result/error; code này chọn feature outcome sau failure.
`CQRS` không bị fallback đổi thành command/query khác.

## `RESILIENCE-5` — propagate cancellation/deadline

Signal đi tới client, DB, retry wait, stream và child task. Cancel/expiry dừng scheduling và ngăn late
completion mutate request/job bỏ dở; cleanup idempotent.

Ranh giới: request cancel không xóa durable job đã accept (`ASYNC-2`); telemetry ghi cancellation nhưng
không phải mechanism (`OBSERVABILITY`).

## Layer held

Application sở hữu tổng budget và fallback hợp lệ. Shared client/policy sở hữu retry, breaker, bulkhead
và propagation. Adapter dịch provider error; event delivery fan-out; CQRS semantics; observability ghi
quyết định; assurance chứng minh gate/runtime evidence.

## Inputs

| Input | Evidence |
|---|---|
| dependency | Call, idempotency, failure class |
| budget | Total deadline, per-attempt ceiling, cancellation source |
| capacity | Limit, threshold, reject result |
| contract | Fallback, freshness, authorization, result shape |
| proof | Delay, transient, overload, stale cache, cancellation |

## Rules

1. Một deadline chặn toàn operation.
2. Chỉ retry transient safe và dừng ở deadline.
3. Bảo vệ dependency bằng capacity hữu hạn.
4. Fallback explicit, trung thực, giữ contract.
5. Propagate cancellation và ngăn late mutation.

## Exceptions

- Non-idempotent chỉ retry khi idempotency key và guarantee provider làm duplicate an toàn.
- Detached background work phải được accept thành durable job và dùng deadline job.
- Contract cần authoritative data có thể fail-fast bằng unavailable typed, không fabricate.

## Output

```text
operation: <operation feature>
dependency: <client/provider/resource>
budget: <deadline/cancellation>
protection: <retry/breaker/bulkhead/load-shed>
fallback: <result giữ contract hoặc unavailable>
situation: <RESILIENCE-1 | RESILIENCE-2 | RESILIENCE-3 | RESILIENCE-4 | RESILIENCE-5>
reason: <fact failure/capacity/contract>
```
