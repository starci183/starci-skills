---
title: Performance
---

# Performance

## LOADS

Không có.

## Record

Đầu vào là operation và data shape đã chấp nhận. Module này quyết định cost contract của backend:
request được hỏi bao nhiêu data, relation load ra sao, cần bằng chứng query plan nào và latency/resource
budget nào được đo. Nó không biến “nhanh” thành gu thẩm mỹ hay thay correctness, authorization,
transaction law.

## Law

Mọi collection read đều bounded và chỉ project field cần cho answer. Relation load explicit và batch;
entity không âm thầm bắt mọi caller trả giá eager relation, loop không âm thầm tạo một query mỗi item.
Index phải dựa predicate/order thật và được verify bằng plan. Budget phải nêu percentile, workload,
resource và measurement point; “đã tối ưu” không phải evidence nếu không có workload lặp lại.

`transport` giữ reachability/protocol limit; `data-access` giữ manager/query/transaction; `authorization`
giữ visibility; `maintainability` giữ decomposition chung; `testing` giữ test lane. Module này nối các
quyết định đó với cost/evidence mà không chép luật của chúng.

## Situation codes

| Code | Situation | Source phải thể hiện |
|---|---|---|
| `PERF-1` | Expose collection/answer lớn | Page bounded với server max, cursor/order ổn định và projection rõ |
| `PERF-2` | Load relation hoặc repeated item | Join/batch/data-loader explicit; không N+1 ẩn hay eager relation ở entity |
| `PERF-3` | Thêm query/index | Có predicate/order rationale, index phù hợp và `EXPLAIN`/query-plan proof |
| `PERF-4` | Operation có performance promise | p95/p99 latency cùng query, bytes, memory/concurrency/provider budget trên workload gọi tên được |

## Đọc shape đã duyệt

1. Gọi tên answer, max rows/fields hữu ích, visibility filter và workload.
2. Đặt bound và cursor/order trước ORM call; sau đó chỉ project field cần.
3. Trace relation qua loop/resolver/serializer và batch explicit.
4. Đọc predicate/order thật, suy ra index, capture plan.
5. Ghi budget và measurement point, gồm cold/warm, tenant size, failure.
6. Áp dụng độc lập mọi code; query bounded vẫn có thể N+1 hoặc plan chưa chứng minh.

## `PERF-1` — page và projection có bound

**Situation.** List/search/feed/export preview/relation có thể vượt memory và latency an toàn.

**Source phải thể hiện.** API nhận limit có bound, clamp/reject quá server max, dùng opaque cursor hoặc
continuation ổn định, order có tie-breaker unique. Query select đúng field cần; full entity không phải
projection mặc định.

**Ranh giới.** Không phải `TRANSPORT`: protocol parse argument, mã này đặt data bound. Không phải
`DATA-*`: data access thực thi query; mã này đặt cost của answer. Không phải `API-*`: pagination
compatibility là API evolution; mã này bảo đảm contract hiện tại bounded. Không phải `TESTING-*`.

## `PERF-2` — relation work explicit và batched

**Situation.** List trả parent rồi serializer/resolver truy cập child trong loop; một query mỗi item
làm cost tăng theo row count.

**Source phải thể hiện.** Relation được chọn ở call site, join khi cardinality/projection cho phép,
hoặc request-scoped batch/data-loader theo parent set. Entity không eager vì tiện. Có query-count
expectation cho case bounded.

**Ranh giới.** `DATA-5` đặt relation intent; `PERF-2` chứng minh shape không nhân query. Không phải
`MAINTAIN-*`: repeated calls là runtime cost. Không phải `AUTHORIZATION`: visibility predicate vẫn phải
giữ trong batch query.

## `PERF-3` — index và plan có evidence

**Situation.** Có đề xuất filter/order/index/join/query rewrite để nhanh hơn.

**Source phải thể hiện.** Ghi predicate, selectivity, order thật; index hỗ trợ access path đó. Capture
`EXPLAIN`/plan trước-sau với row estimate và việc index có được dùng. Index speculative/unused không phải
proof.

**Ranh giới.** `DATA-*` khai báo entity/migration/transaction; `PERF-3` cần workload evidence.
`NAMING-*` lo tên index. `MAINTAIN-*` không thể thay plan evidence.

## `PERF-4` — budget là promise đo được

**Situation.** Handler/query/media transfer/job có kỳ vọng latency/resource.

**Source phải thể hiện.** Budget nêu p95/p99, request shape, dataset/tenant size, concurrency, query
count, payload bytes, memory/CPU/provider time và measurement boundary. Telemetry và regression/load
scenario có thể fail khi vượt budget.

**Ranh giới.** `TRANSPORT` timeout chỉ là một control. `EXCEPTION-IDENTITY` giữ failure identity.
`TESTING` chọn lane/assertion; mã này định cost cần đo. `MAINTAINABILITY` có thể dùng pressure để split
nhưng không định ownership.

## Layer held

| Code | Tier | Được giữ bởi |
|---|---|---|
| `PERF-1` | `documented` | Query/contract review và pagination tests |
| `PERF-2` | `documented` | Query-count integration tests và call-graph review |
| `PERF-3` | `documented` | Migration/query review với plan artifact |
| `PERF-4` | `documented` | Benchmark/load/telemetry trên workload gọi tên được |

## Inputs

| Input | Bằng chứng bắt buộc |
|---|---|
| answer | Field, row, relation, visibility cần thật |
| workload | Dataset/tenant, concurrency, hot/cold, provider behavior |
| query | Predicate, order, join, projection, continuation key |
| budget | Percentile, latency/query/byte/memory/CPU/provider limit và measurement point |
| proof | Query count, plan, benchmark, telemetry và regression threshold |

## Rules

1. Bound mọi collection và cap phía server.
2. Dùng continuation opaque, order deterministic.
3. Project field và load relation explicit; batch repeated access.
4. Index/query change phải có predicate/order và plan evidence.
5. Ghi percentile và resource budget đo được trên workload cụ thể.
6. Giữ transport, data access, authorization, naming, exception identity, maintainability, testing ở module riêng.

## Exceptions

- **Internal batch/export.** Có thể xử lý nhiều row hơn nhưng dùng chunk bounded, checkpoint và job budget.
- **Relation nhỏ cố định.** Join hợp lệ khi cardinality bound được chứng minh; vẫn cần projection/query evidence.
- **Planner thay đổi.** Plan có thể khác theo statistics/tenant; ghi range đại diện, refresh statistics và
  fail budget khi supported range regress.

## Stops

Dừng khi thiếu page max, continuation/order, relation strategy, plan evidence hoặc percentile/resource
budget. Dừng khi proof chỉ là timing local, danh sách index không có plan, hoặc happy path một row.

## Proof

| Code | Proof tối thiểu |
|---|---|
| `PERF-1` | Test reject quá limit, traversal ổn định và projection đúng |
| `PERF-2` | Integration test assert query count bounded với nhiều parent và không eager |
| `PERF-3` | Plan artifact chứng minh access path và estimate/usage chấp nhận được |
| `PERF-4` | Benchmark/load/telemetry regression assert percentile và resource budget |

## Output

```text
answer: <fields, rows, relations>
bound: <limit/cursor/order>
queries: <projection và batching>
plan: <index và EXPLAIN evidence>
budget: <percentile và resource limits>
situation: <PERF-1 | PERF-2 | PERF-3 | PERF-4>
verdict: <holds | violates | stop>
proof: <test, plan hoặc workload evidence>
```

## Scope

Pattern quản lý answer bounded, relation explicit, index/plan evidence và latency/resource budget.
Nó không chọn transport, data access, authorization, naming, exception identity, maintainability
chung hay testing mechanics; các module đó vẫn là authority của boundary tương ứng.
