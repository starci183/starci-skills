---
title: Async-work
---

# Async-work

## LOADS

Không có.

## Record

Mẫu này nhận một quyết định đã được chấp thuận rằng công việc có thể tiếp tục sau request hoặc event
khởi tạo nó. Mẫu trả về kiến trúc nguồn cho hợp đồng job, ranh giới queue, scheduler và kiểm thử
worker; không quyết định lại việc có nên chạy bất đồng bộ hay không.

## Law

Async work là hợp đồng bền vững giữa producer và worker ở thời điểm sau. Job có identity ổn định,
payload có version, trạng thái giao nhận rõ ràng và chính sách thực thi có giới hạn. Worker có thể
chạy lại, restart hoặc gặp race của scheduler mà vẫn phải tạo một kết quả có thể kiểm toán. Queue là
hạ tầng giao nhận, không phải chính sách nghiệp vụ.

Câu hỏi quyết định là: sau restart và giao trùng, worker khác có nhận ra cùng một ý định, kiểm tra
đúng hạn, và kết thúc mà không retry vô hạn không?

## Situation codes

| Code | Tình huống | Source phải có |
|---|---|---|
| `ASYNC-1` | Producer chuyển việc cho process sau | Envelope job thuần dữ liệu, serializable, có `jobId`, `jobType`, `schemaVersion`, payload và correlation/causation id ổn định; không truyền instance sống, request, closure hay schema ngầm |
| `ASYNC-2` | Worker nhận, thành công hoặc không thể hoàn tất job | Ack chỉ sau khi consequence nghiệp vụ commit; retry và dead-letter terminal là chuyển trạng thái bền vững, có thể quan sát; không ack trước việc hay bỏ im lặng |
| `ASYNC-3` | Lỗi tạm thời có thể retry | Số attempt bền vững, giới hạn hữu hạn, backoff/jitter bị chặn; lỗi vĩnh viễn đi thẳng terminal; không loop vô hạn hoặc spin nóng |
| `ASYNC-4` | Job theo lịch đến hạn | Query `dueAt` và lease/claim có owner, expiry ngăn chạy chồng; tick lặp lại an toàn, không giữ transaction qua thân job |

## Reading an accepted shape

1. Xác định công việc nghiệp vụ đã chốt, producer, worker và kết quả mong đợi.
2. Không tự bịa transport, field payload hay số retry khi shape chưa nói; đó là input kiến trúc.
3. Chốt identity và version trước delivery/retry; chốt thứ tự ack/lease trước thân worker.
4. Hỏi: payload có giải mã được từ bytes (`-1`); consequence đã bền vững trước ack (`-2`); attempt
   và delay có điểm kết thúc (`-3`); hai tick có thể cùng claim (`-4`) không?
5. Các code cộng dồn. Envelope đúng version vẫn sai `-2` nếu ack sớm; lease đúng vẫn sai `-3` nếu
   retry vô hạn.

## `ASYNC-1` — job là contract có version và serializable

Producer ghi plain data để process khác giải mã mà không cần object graph của producer. `schemaVersion`
chọn decoder hoặc migration rõ ràng; `jobId` giữ nguyên khi redelivery. Correlation/causation là
metadata, không thay identity.

Ranh giới: không phải `CQRS`: job có thể chở consequence của command tới worker sau nhưng không quyết
định ownership command/query. Không phải `EVENT-DELIVERY`: job là việc phải thực hiện, event là fact đã
quyết định để phân phối; job có thể dùng event delivery nhưng vẫn cần envelope này.

## `ASYNC-2` — delivery state chỉ ack sau consequence

Worker claim/nhận job, chạy nghiệp vụ, commit kết quả bền vững rồi mới ack/complete. Lỗi retryable đưa
job lại queue và ghi attempt; lỗi permanent hoặc hết lượt vào dead-letter cùng reason và identity gốc.

Ranh giới: không phải `OBSERVABILITY`: log/metric giải thích quyết định nhưng không thay trạng thái
bền vững. Không phải `ASSURANCE`: test ack không thay ownership vận hành queue, replay và dead-letter.

## `ASYNC-3` — attempt và backoff bị giới hạn

Retry policy phân loại lỗi, tăng attempt atomically, đặt maximum hữu hạn và delay có jitter bị chặn.
Payload sai và lỗi permanent là terminal; worker không sleep trong hot loop hoặc requeue không đổi state.

Ranh giới: không phải `RESILIENCE-2`: resilience điều khiển call bên trong job, còn code này điều khiển
delivery attempt của chính job. Cả hai có thể áp dụng và phải có deadline tổng rõ ràng.

## `ASYNC-4` — việc đến hạn được lease, không chạy chồng

Scheduler chọn row đã tới `dueAt`, claim atomically bằng owner/expiry, rồi chỉ enqueue hoặc chạy row đã
claim. Lease hết hạn có thể reclaim; không giữ transaction DB khi chạy thân job; tick lặp lại không gây
trùng.

Ranh giới: không phải `EVENT-DELIVERY` vì scheduler tạo/giải phóng work, không phát business fact;
không phải `OBSERVABILITY` vì metric claim không ngăn overlap.

## Layer held

Module job sở hữu type, decoder và policy worker. Adapter queue/scheduler sở hữu broker, clock và DB
mechanics. Domain service sở hữu consequence. Event delivery, CQRS, observability và assurance là các
ranh giới riêng: async work có thể gọi chúng nhưng không biến chúng thành state machine ẩn.

Bốn code là documented trừ khi backend machine của repository có rule được đặt tên. Lint có thể kiểm
presence envelope hoặc cấm request import, nhưng không tự chứng minh commit-before-ack, phân loại retry
hay non-overlap nếu thiếu runtime evidence.

## Inputs

| Input | Evidence |
|---|---|
| identity | Type, id và schema version ổn định |
| payload | Field serializable và owner decoder/migration |
| delivery | Ack semantics và terminal state |
| retry | Error class, max attempts, delay ceiling |
| schedule | Due-time, lease owner/expiry và clock |
| proof | Restart, duplicate, exhaustion và overlapping tick |

## Rules

1. Job là plain data có version và identity ổn định.
2. Chỉ ack sau consequence bền vững.
3. Mọi retry có attempt, ceiling hữu hạn và delay bị chặn.
4. Work sai hoặc permanent vào terminal state bền vững.
5. Work đến hạn dùng lease hết hạn; tick lặp lại không overlap.
6. Correlation, log và test bám job id nhưng không thay state.

## Exceptions

- **Best-effort mất mát.** Job cố ý lossy có thể ack trước execution nếu contract đã chấp nhận loss;
  vẫn phải ghi drop và không được gọi là durable (`ASYNC-2`).
- **Job dài.** Có thể renew lease nhưng phải có owner, interval và expiry cứng (`ASYNC-4`).
- **Replay thủ công.** Operator tạo attempt record mới trỏ job gốc; không sửa lịch sử hoặc reset counter
  (`ASYNC-2,-3`).

## Output

```text
job: <type và stable id>
producer: <module nguồn>
worker: <module worker>
delivery: <ack, retry và terminal state>
schedule: <due-time và lease, hoặc n/a>
situation: <ASYNC-1 | ASYNC-2 | ASYNC-3 | ASYNC-4>
reason: <fact chọn code và loại trừ ranh giới>
```
