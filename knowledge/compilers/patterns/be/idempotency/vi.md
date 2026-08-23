---
title: Idempotency · Vietnamese
---

# Idempotency

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | bộ máy backend đã phát hành mà bản ghi này viện dẫn |

## Bản ghi

Đầu vào là command, job hoặc webhook đã duyệt nhưng có thể được giao nhiều lần. Pattern này không
quyết định business action có nên tồn tại hay không. Nó quyết định cách một logical request có key
ổn định, cách claim bền vững trước effect, cách replay result đã xong, và cách scope, retention,
failure được gọi tên.

## Luật

Idempotency nghĩa là lặp một logical operation tạo đúng một business effect và cùng observable
result. Coordination phải bền vững ở boundary nơi effect bắt đầu; process map, consumer offset hay
"client sẽ không retry" không phải bằng chứng bền vững.

Key là identity của logical operation, không phải random value server tạo mới ở mỗi attempt. Durable
claim phải thắng nguyên tử trước external/irreversible effect. Completion lưu result để attempt sau
replay. Claim thất bại phải có nghĩa retryable hoặc terminal và cửa sổ retention rõ.

## Mã tình huống

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `IDEMP-1` | Caller, webhook hoặc job cần identity của lần lặp | Key ổn định được caller/job cung cấp hoặc suy ra xác định từ identity và scope operation; validate và không sinh lại mỗi retry |
| `IDEMP-2` | Effect phải được claim trước khi chạy | Insert/lock durable có unique được thực hiện nguyên tử trước effect, có owner/status/lease hoặc tương đương. Cấm: effect trước, marker sau |
| `IDEMP-3` | Duplicate đến sau khi completion | Status/result hoàn tất bền vững và được trả lại cho cùng key; effect không chạy lại, duplicate không tự chế response mới |
| `IDEMP-4` | Chọn scope, retention và failure semantics | Namespace key, tenant/actor scope, expiry/retention, payload mismatch, failure retryable và terminal được gọi tên |
| `IDEMP-5` | Cần proof cho one-effect | Test submit cùng key đồng thời và sau completion, assert một effect và cùng result, dùng durable storage thật ở claim boundary |

## Đọc một shape đã duyệt

1. Gọi tên logical operation và các nguồn delivery có thể lặp.
2. Giải quyết key (`IDEMP-1`), durable claim trước effect (`IDEMP-2`), replay (`IDEMP-3`), lifecycle
   (`IDEMP-4`) rồi proof (`IDEMP-5`).
3. Hỏi có phải hai command hợp lệ khác nhau đang tranh chấp không. Nếu có, dùng `CONCURRENCY`, không
   dùng idempotency key. Duplicate envelope broker/CDC thuộc `DELIVERY`/`CDC`, trừ khi nó cũng là
   business command boundary.

## `IDEMP-1` — logical request có key ổn định

**Source phải sinh ra.** Key bắt buộc từ caller, webhook event id hoặc durable job identity, ghép với
operation/version và tenant scope. Server được normalize nhưng không được thay bằng `randomUUID()` ở
mỗi attempt.

**Ranh giới.** Không phải `CONCURRENCY-1`: đây là repeat của một command, không phải hai command khác
nhau tranh quota. Không phải `DELIVERY-1`/`CDC-2`: envelope/group là identity giao nhận, không nhất
thiết là business effect. Không phải async retry: retry phải mang cùng key.

## `IDEMP-2` — claim trước effect

**Source phải sinh ra.** Atomic unique insert hoặc claim transition trong durable storage trước payment,
email, grant, enqueue, provider call hay effect không đảo ngược. Claim đồng thời nhận pending/duplicate,
không chạy effect lần hai.

**Ranh giới.** Không phải `DATA-4`: transaction-manager propagation nói về atomic writes; mã này nói
thứ tự durable claim trước external effect. Không phải `DELIVERY-4`/`CDC-4`: digest claim của message
là dedupe transport/projection và không dùng thay business claim nếu chưa mapping rõ. Không phải async
retry: retry chỉ reclaim lease hết hạn theo lifecycle đã chốt.

## `IDEMP-3` — replay result đã ghi

**Source phải sinh ra.** Completion lưu status và response/result ổn định (hoặc reference chuẩn). Request
cùng key về sau validate fingerprint và trả result đã lưu; không gọi effect lại.

**Ranh giới.** Không phải `CACHE-2`: replay record là correctness state, phải sống qua cache eviction;
cache là derived data. Không phải `CONCURRENCY-2`: conflict của row cũ không phải duplicate command.
Không phải `DELIVERY-5`/`TESTING-2`: runtime result là behaviour, test vẫn phải assert one effect.

## `IDEMP-4` — lifecycle là một phần hợp đồng key

**Source phải sinh ra.** Namespace/scope, lỗi fingerprint mismatch, retention/TTL, pending lease expiry,
failure retryable/terminal, và failure được replay hay reclaim đều rõ ràng. Không lưu response trước
khi an toàn và không vô tình giữ payload nhạy cảm.

**Ranh giới.** Không phải async retry: budget/backoff là delivery policy; lifecycle nói key lặp nghĩa
gì. Không phải `CACHE-4`: idempotency retention là correctness retention, không phải freshness.

## `IDEMP-5` — proof chạy duplicate

**Source phải sinh ra.** Spec/e2e chạy concurrent same-key từ barrier, lặp key sau completion và assert
một durable effect cùng result tương đương. Không mock claim store hoặc gọi handler trực tiếp thay cho
production boundary.

**Ranh giới.** Không phải `TESTING-5`/`TESTING-6`: branch/call assertion không chứng minh one-effect
bền vững. Không phải `CONCURRENCY-4`: mã kia dùng state transition cạnh tranh, mã này dùng cùng key và
effect. Không phải `DELIVERY-6`/`CDC-7`: fan-out/projection không chứng minh business claim.

## Tầng giữ

| Mã | Tầng | Thứ giữ mã |
|---|---|---|
| `IDEMP-1` | `documented` | transport/job contract và key normalizer |
| `IDEMP-2` | `documented` | durable idempotency store và effect coordinator |
| `IDEMP-3` | `documented` | completion persistence và replay path |
| `IDEMP-4` | `documented` | schema, retention worker và error policy |
| `IDEMP-5` | `documented` | duplicate/concurrency e2e hoặc integration spec |

## Neo

| Mã | Neo | Tìm gì |
|---|---|---|
| `IDEMP-1` | `src/tests/e2e/payment-idempotency.e2e-spec.ts` | cùng payment key qua các attempt lặp |
| `IDEMP-2` | `src/tests/e2e/xp-history-idempotency.e2e-spec.ts` | durable claim trước history effect |
| `IDEMP-3` | `src/tests/e2e/payment-idempotency.e2e-spec.ts` | request lặp nhận result ban đầu |
| `IDEMP-4` | `src/features/api/processors/reconcile-transaction/reconcile-transaction.worker.ts` | job identity, retry state và terminal outcome |
| `IDEMP-5` | `src/tests/e2e/payment-idempotency.e2e-spec.ts` | duplicate attempt và một observable effect |

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| operation | Logical command/job/webhook và irreversible effect |
| key | Caller/job identity, normalized và scoped |
| claim | Durable unique record, owner và status |
| result | Completion response hoặc canonical reference đã lưu |
| lifecycle | Retention, lease, mismatch và failure policy |
| proof | Test same-key đồng thời và replay |

## Quy tắc

1. Retry mang cùng logical key.
2. Claim xảy ra bền vững trước effect.
3. Completion replay được và fingerprint không được đổi im lặng.
4. Scope, retention và error semantics được gọi tên.
5. One-effect proof dùng durable coordination thật.
6. Transport/CDC dedupe, concurrency arbitration, async retry và testing lane là boundary riêng.

## Ngoại lệ

- **Pure read.** Không có irreversible effect thì không cần idempotency record; cache read thuộc `CACHE`.
- **Write vốn idempotent.** Deterministic upsert có thể thỏa effect property, nhưng vẫn cần key và proof
  khi caller cần original result hoặc có external side effect.
- **Claim hết hạn.** Chỉ reclaim sau lease/retention rõ và xác định owner cũ không còn có thể chạy effect.

## Đầu ra

```text
operation: <mutation | webhook | job | scheduler>
key: <stable scoped logical key>
situation: <IDEMP-1 … IDEMP-5>
claim: <durable claim và status>
replay: <stored result hoặc terminal outcome>
retention: <expiry/lease/fingerprint/failure semantics>
proof: <duplicate test>
reason: <sự thật loại trừ boundary lân cận>
```

## Phạm vi

Pattern này quản một business operation bị lặp bởi cùng logical caller/job. Delivery dedupe, CDC
recompute, generic retry và cache freshness có authority riêng.
