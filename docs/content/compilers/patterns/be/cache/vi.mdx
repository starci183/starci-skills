---
title: Cache · Vietnamese
---

# Cache

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | bộ máy backend đã phát hành mà bản ghi này viện dẫn |

## Bản ghi

Đầu vào là một read path đã duyệt, có derived result đủ tốn kém để tái sử dụng. Pattern này không
biến cache thành database thứ hai. Nó quyết định canonical key và toàn bộ input, authoritative source,
invalidation khi mutation, cùng hợp đồng stale/TTL/error.

## Luật

Cache là derived data có thể vứt đi. Source of truth vẫn là database hoặc domain projection; miss,
eviction, restart hay stale entry phải có read path về authority. Key là namespace/version cộng mọi
input làm result đổi. Mutation invalidate/refresh mọi key bị ảnh hưởng theo thứ tự đã khai báo; TTL và
stale/error behaviour phải rõ.

## Mã tình huống

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `CACHE-1` | Derived read cần cache key | Canonical key có namespace/version và mọi input ngữ nghĩa (tenant, actor, locale, filter, auth scope); không nội suy object/string thô |
| `CACHE-2` | Cached value có authority | Cache chỉ giữ read/derived result và miss đọc authoritative state. Cấm: cache là durable write duy nhất hoặc dùng correctness/replay record như cache |
| `CACHE-3` | Mutation có thể làm cache sai | Mutation invalidate/refresh mọi canonical key bị ảnh hưởng theo transaction/event ordering rõ, không có stale window vô hạn |
| `CACHE-4` | Chọn freshness, stale và error policy | TTL, stale-while-revalidate, negative cache, stampede control và fallback khi lỗi đều rõ; exception/partial result không bị cache tình cờ |

## Đọc một shape đã duyệt

1. Gọi tên read result và authoritative source.
2. Dựng canonical key (`CACHE-1`), rồi authority (`-2`), mutation path (`-3`) và freshness/error
   contract (`-4`).
3. Nếu record ngăn business effect chạy lại thì đó là `IDEMP`, không phải cache. Nếu dedupe broker/CDC
   message thì là `DELIVERY`/`CDC`, không phải cache.

## `CACHE-1` — key gọi tên toàn bộ input

**Source phải sinh ra.** Một builder tạo key có namespace/version, normalize scalar và ghi rõ chiều
tenant/user/locale/filter/permission. Input tương đương cho key tương đương; input làm result đổi phải
làm key đổi.

**Ranh giới.** Không phải `IDEMP-1`: cache key định danh derived data, idempotency key định danh một
effect logic. Không phải primary key hay broker digest: chúng định danh entity bền vững hoặc envelope.

## `CACHE-2` — authority nằm ngoài cache

**Source phải sinh ra.** Cache miss/read-through load từ database hoặc projection authoritative và chỉ
serialize derived result. Durable write cập nhật authority trước; cache population theo sau.

**Ranh giới.** Không phải `IDEMP-3`: replay record là correctness state phải sống qua eviction. Không
phải `CDC-4`: CDC rebuild projection từ source row; cache có thể đứng trước projection, không làm source.
Không phải `DATA-4`: source write vẫn chịu luật transaction atomicity.

## `CACHE-3` — mutation invalidate key bị ảnh hưởng

**Source phải sinh ra.** Mutation nhận diện dimension của key bị ảnh hưởng và invalidate/refresh sau
authoritative commit, hoặc phát durable invalidation event với ordering rõ. Invalidation fail phải
quan sát và sửa được; wildcard flush không phải mặc định.

**Ranh giới.** Không phải `CDC-4`: CDC recompute projection, còn mã này xóa derived cache entry. Không
phải `DELIVERY-4`: digest dedupe ngăn duplicate delivery effect. Không phải async retry: retry
invalidation chỉ an toàn sau khi biết commit/order của mutation.

## `CACHE-4` — freshness và failure được gọi tên

**Source phải sinh ra.** TTL cộng stale-while-revalidate hoặc fail-open/closed, negative-cache policy,
stampede protection và serialization/version handling. Database/provider error không biến thành empty
hay partial cached value ngoài ý muốn.

**Ranh giới.** Không phải `IDEMP-4`: retention của idempotency là claim correctness; cache TTL là
freshness. Không phải `TESTING-5`/`-6`: test cover branch nhưng mã này gọi tên runtime policy.

## Tầng giữ

| Mã | Tầng | Thứ giữ mã |
|---|---|---|
| `CACHE-1` | `documented` | canonical key builder và cache adapter |
| `CACHE-2` | `documented` | read service cùng authoritative repository/projection |
| `CACHE-3` | `documented` | mutation coordinator và invalidation/refresh publisher |
| `CACHE-4` | `documented` | cache policy, serializer và failure handling |

## Neo

| Mã | Neo | Tìm gì |
|---|---|---|
| `CACHE-1` | `src/modules/lib/native/redis/constants.ts` | Redis namespace/instance key ổn định |
| `CACHE-2` | `src/modules/databases/postgresql/primary/cache/in-memory-query-result-cache.ts` | query-result cache derived tách khỏi persistence source |
| `CACHE-3` | `src/modules/platform/winston/types/messages/cache.ts` | vocabulary quan sát read/invalidation cache |
| `CACHE-4` | `src/modules/ai/utils/openrouter-cache-headers.ts` | cache-control/freshness header và policy input |

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| result | Derived value và authoritative source |
| key | Namespace/version và mọi dimension làm result đổi |
| mutation | Write có thể làm value sai |
| freshness | TTL, stale, negative và stampede policy |
| failure | Miss/error/partial-value behaviour |

## Quy tắc

1. Key canonical, versioned và đầy đủ.
2. Authority là durable source state, không phải cache storage.
3. Mutation invalidate/refresh affected key sau source commit hoặc event ordering đã chốt.
4. TTL, stale, negative và error policy phải rõ.
5. Cache không phải idempotency replay, delivery/CDC dedupe, async retry hay test assertion.

## Ngoại lệ

- **Process-local memoization.** Được phép cho immutable config hoặc request scope có giới hạn; không
  làm authority cho mutable product state.
- **Cố ý đọc stale.** Được phép khi shape gọi tên freshness budget và caller chịu được; `CACHE-4` vẫn
  ghi TTL và failure policy.
- **Write-through cache.** Chỉ được phép khi durable authority commit vẫn là tiêu chí thành công và có
  repair/invalidation path khi cache lỗi.

## Đầu ra

```text
read: <derived result>
authority: <database hoặc projection source>
situation: <CACHE-1 … CACHE-4>
key: <canonical namespace/version/inputs>
mutation: <affected-key invalidation hoặc refresh ordering>
policy: <TTL/stale/error/negative/stampede semantics>
reason: <sự thật loại trừ concern lân cận>
```

## Phạm vi

Pattern này quản disposable derived read data trong backend adapter/service. Durable business effect,
broker/CDC delivery claim, retry budget và testing lane có pattern riêng.
