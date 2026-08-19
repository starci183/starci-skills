---
title: Configuration
---

# Configuration

## LOADS

Không có.

## Record

Mẫu này định tuyến runtime configuration sau khi capability đã được chấp thuận. Nó xác định nơi
shape, validate, compose và inject config; không tự chọn product default hay secret value.

## Law

Configuration là snapshot typed, immutable được tạo một lần ở composition root. Env, file và secret
store chỉ là input, không phải contract cho toàn ứng dụng. Snapshot validate schema, áp default đã khai
báo, enforce required/secret policy, fail-closed khi sai và là nguồn duy nhất runtime đọc.

Câu hỏi: process có chứng minh được startup sẽ dùng giá trị nào, ai cung cấp, và code sau đó không thể
diễn giải raw input âm thầm không?

## Situation codes

| Code | Tình huống | Source phải có |
|---|---|---|
| `CONFIG-1` | Raw config vào process | Một schema/parser validate một lần type, range, enum, cross-field và unknown key |
| `CONFIG-2` | Runtime cần setting | Nhận typed config/narrow view; không feature/adapter nào đọc `process.env`, raw file, secret store sau composition |
| `CONFIG-3` | Field có thể thiếu hoặc nhạy cảm | Mỗi field khai required/default/secret; secret không log, serialize hoặc có default không an toàn |
| `CONFIG-4` | Config sai hoặc thiếu | Startup fail-closed trước traffic, claim hoặc register; chẩn đoán an toàn, exit/health failure |
| `CONFIG-5` | Config dùng chung runtime | Snapshot và nested value readonly/immutable; reload là snapshot mới explicit, không mutate assumption sống |

## Reading an accepted shape

1. Liệt kê setting, source và sensitivity; không tự suy default.
2. Viết schema/parser trước, compose snapshot sau, rồi inject narrow view.
3. Chốt policy và fail-closed trước consumer runtime đầu tiên.
4. Hỏi: field được check một lần (`-1`); runtime tránh raw read (`-2`); default/secret có chủ ý (`-3`);
   input sai có dừng process (`-4`); consumer có mutate/nhìn value khác (`-5`) không?
5. Code cộng dồn: parser đúng nhưng còn `process.env` là sai `-2`; readonly nhưng default nguy hiểm là
   sai `-3`.

## `CONFIG-1` — validate schema một lần

Composition-root parser đọc source đã khai báo, reject key lạ, check type/range/enum/cross-field rồi
trả snapshot typed. Consumer không tự parse từng phần.

Ranh giới: `INTEGRATION-2` dùng provider config nhưng không sở hữu global composition; assurance CI không
thay runtime validation.

## `CONFIG-2` — không raw env sau composition

Sau composition, constructor/method nhận config hoặc typed view. `process.env`, file read và secret-store
call chỉ nằm ở boundary; test override dùng cùng typed contract.

Ranh giới: `OBSERVABILITY` có thể dùng redaction config nhưng không thành source thứ hai; `ASYNC-WORK`
không đưa process env vào serialized job.

## `CONFIG-3` — policy required/default/secret rõ ràng

Field khai required, safe default hoặc optional. Secret được đánh dấu, giữ opaque; output/error/telemetry
redact secret. Default không biến credential thiếu thành secret công khai/dự đoán được.

Ranh giới: `INTEGRATION-3` dịch provider metadata; code này quyết định giá trị config nào là secret.

## `CONFIG-4` — startup fail-closed

Config invalid/missing/contradictory dừng startup trước readiness HTTP, consume queue, scheduler claim
hoặc provider registration. Diagnostic nêu field/reason nhưng không lộ secret.

Ranh giới: assurance có thể chặn release, nhưng runtime vẫn fail-closed khi env khác; đây không phải
live load shedding của `RESILIENCE-3`.

## `CONFIG-5` — config typed immutable

Snapshot và nested value readonly/frozen. Consumer không đổi timeout, endpoint, flag hay credential của
consumer khác. Reload phải compose/validate snapshot mới và swap tại lifecycle boundary đã khai báo.

Ranh giới: config change không tự là CQRS command/event; broadcast event cũng không làm mutable config an
toàn (`EVENT-DELIVERY`). Fallback vận hành là quyết định của `RESILIENCE-4`, không phải default config.

## Layer held

Composition root sở hữu source reading, validation, secret policy, snapshot. Module nhận typed views.
Integration dùng provider view, resilience dùng budget view, async work dùng queue/schedule view. Event
delivery, CQRS, observability và assurance chỉ là consumer/proof owner, không phải authority config khác.

## Inputs

| Input | Evidence |
|---|---|
| schema | Field, type, range, enum, cross-field, unknown-key |
| sources | Env/file/secret và precedence |
| policy | Required/default/optional/secret |
| startup | Thứ tự readiness/claim/register và diagnostic an toàn |
| lifecycle | Immutable hoặc reload boundary |
| proof | Invalid, missing, redact, override, reload |

## Rules

1. Parse/validate một lần ở composition.
2. Runtime module không đọc raw env/secret store.
3. Khai policy required/default/secret từng field.
4. Fail-closed trước serve/consume/register.
5. Expose snapshot typed immutable hoặc readonly view.
6. Redact secret khỏi error, log, event và serialized config.

## Exceptions

- Reload explicit phải tạo snapshot mới, validate, swap atomic và chứng minh version reader.
- CLI standalone compose tại entry point nhưng vẫn validate/fail-closed và không export raw value.
- Secret rotation đi qua composition owner; consumer chỉ nhận typed view, không nhận store client.

## Output

```text
config: <schema/snapshot>
sources: <env, file, secret provider>
views: <typed consumers>
startup: <fail-closed boundary>
lifecycle: <immutable/reload>
situation: <CONFIG-1 | CONFIG-2 | CONFIG-3 | CONFIG-4 | CONFIG-5>
reason: <fact chọn code>
```
