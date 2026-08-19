---
title: Validation
---

# Validation

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | máy backend đã publish mà record này trích dẫn |

## Bản ghi

Đầu vào là operation và input shape đã duyệt. Module này quyết định nơi dữ liệu không tin cậy trở
thành application value canonical, và cách failure còn hữu ích cho caller. Nó không chọn external
door, static narrowing, persistence access hay refactor shape. Validation là contract ở boundary,
không phải các check tiện tay rải trong handler.

## Luật

Dữ liệu không tin cậy bị reject ở boundary đầu tiên có thể gọi tên shape của nó. Normalize diễn ra một
lần ở boundary sở hữu representation; canonical form được chuyền vào trong mà không âm thầm đổi
lại. Rule cần nhiều field hoặc application state chạy ở layer nhìn thấy đủ fact. Failure dùng một
field-error contract ổn định với path và code máy đọc được; text trình bày và transport status là
concern riêng.

Ranh giới này có chủ ý. `type-safety` narrow điều compiler biết; `transport` đặt external door;
`data-access` xử lý database constraint và handle; `maintainability` phán duplication/orchestration.
Module này chỉ quyết định ownership của validation và nghĩa error quan sát được.

## Mã tình huống

Mỗi tình huống mang identity cố định `VALIDATE-<n>`.

| Code | Tình huống | Source phải có hình dạng |
|---|---|---|
| `VALIDATE-1` | Untrusted input đi vào application boundary | Boundary parse và reject shape đã khai báo trước khi application coi input là trusted |
| `VALIDATE-2` | Input cần canonicalization | Một boundary sở hữu trim, case-fold, parse hoặc default đúng một lần rồi chuyền canonical representation vào trong |
| `VALIDATE-3` | Rule spans field hoặc application state | Cross-field/context rule chạy tại layer có đủ fact, không giả vờ field syntax một mình là đủ |
| `VALIDATE-4` | Caller cần validation failure | Error expose field path và machine code ổn định trong một contract; wording và transport status không phải identity |

`VALIDATE-1` hỏi trust, `VALIDATE-2` hỏi representation. `VALIDATE-3` hỏi ownership của rule,
`VALIDATE-4` hỏi shape của failure. Một request có thể áp dụng độc lập cả bốn.

## Đọc một shape đã duyệt

1. Đọc input đã khai báo của operation và nơi byte, JSON, GraphQL variable, message hoặc provider
   response đi vào application lần đầu.
2. Tách shape check, canonicalization và rule cần field/state khác nhau.
3. Giao normalize cho boundary đầu tiên sở hữu representation và ghi canonical form downstream nhận.
4. Xác định mọi consumer của validation failure và chọn một contract path/code ổn định.
5. Áp dụng độc lập mọi mã phù hợp. DTO có thể vi phạm `VALIDATE-1`, `VALIDATE-2`; application rule
   đồng thời giải quyết `VALIDATE-3`.

## `VALIDATE-1` — untrusted input dừng ở boundary

**Khi nào gặp.** Data đến từ client, broker, file, environment, provider hoặc fixture và không tự
thành trusted chỉ vì TypeScript annotation mô tả nó.

**Source phải thể hiện gì.** Boundary parser/validator kiểm tra presence, primitive shape, allowed
values và basic syntax trước khi giao trusted input type cho application. Input sai thoát qua
validation contract, không đợi thành domain/database accident.

**Dấu hiệu nhận ra.** Handler nhận data hình `any` rồi gọi business method; cast bị coi là validation;
provider payload được dùng trước parse; chỉ happy path có shape check.

**Ranh giới.** Không phải `TYPE-*`: compile-time type không chứng minh runtime data. Không phải
`TRANSPORT`: resolver/controller là cửa, còn mã này hỏi input đã trusted trước khi dùng chưa. Không
phải `DATA-*`: database constraint là boundary persistence về sau.

**Tình huống business thường gặp.** GraphQL mutation input · webhook body · queue message · payment
response bên ngoài · environment value do adapter đọc.

## `VALIDATE-2` — normalize một lần

**Khi nào gặp.** Một input có nhiều spelling tương đương hoặc form mặc định, còn downstream cần một
canonical value.

**Source phải thể hiện gì.** Boundary sở hữu thực hiện normalize một lần — trim, case-fold, parse,
sort, đổi unit hoặc default đã duyệt — và đặt tên canonical field/value. Layer trong chỉ tiêu thụ,
không trim/parse lại hoặc áp competing default.

**Dấu hiệu nhận ra.** `trim()`/`toLowerCase()` lặp ở nhiều layer; caller coi empty string là absent
nhưng layer khác coi là meaningful; default khác nhau giữa DTO, handler và repository.

**Ranh giới.** Không phải `DOMAIN-2`: value object có thể enforce domain validity sau boundary, còn mã
này chọn nơi canonicalize external representation. Không phải `MAINTAIN-*`: normalize lặp ở đây là
validation ownership error; maintainability có thể phán duplication riêng.

**Tình huống business thường gặp.** Email casing · đổi currency/unit · pagination default · tag list
· provider status map về một spelling nội bộ.

## `VALIDATE-3` — cross-field và application rule chạy nơi đủ fact

**Khi nào gặp.** Validity phụ thuộc từ hai field trở lên, aggregate state, entitlement, clock, record
đã có hoặc fact khác của application.

**Source phải thể hiện gì.** Field-level shape rule ở input boundary. Rule cross-field/context chạy ở
application/domain policy nhìn thấy đủ fact, trả domain decision hoặc failure ổn định và không bị
bypass chỉ bằng cách chọn transport khác.

**Dấu hiệu nhận ra.** DTO đi query database; resolver check rule mà queue consumer bypass được; chỉ
check một trong `start`/`end`; uniqueness rule bị mô tả như string format.

**Ranh giới.** Không phải `DOMAIN-1`: aggregate có thể là authority cuối của domain invariant sau khi
application gom fact, nhưng mã này xác định layer gom đủ input trước. Không phải `DATA-*`: database
uniqueness constraint không phải toàn bộ application rule.

**Tình huống business thường gặp.** End date sau start date · voucher hợp lệ với course/user · refund
chỉ trước fulfillment · payment methods loại trừ nhau · message chỉ hợp lệ trong workflow state hiện tại.

## `VALIDATE-4` — field error có contract ổn định

**Khi nào gặp.** Caller cần gắn một hoặc nhiều validation failure với input field và xử lý nhất quán
qua GraphQL, REST, job hoặc in-process caller.

**Source phải thể hiện gì.** Collection error deterministic với field path, machine code và structured
parameter tùy chọn. Một operation family có một shape; human message có thể đổi/localize mà không đổi
code/path identity.

**Dấu hiệu nhận ra.** Client parse message text; cùng field dùng key khác nhau; mất array index/nested
path; transport status bị dùng làm validation code; cross-field error không có path hoặc relation có tên.

**Ranh giới.** Không phải exception identity: class/code exception có thể do nơi khác chọn; mã này
định nghĩa validation field payload. Không phải `TRANSPORT`: controller/filter map contract ở cửa nhưng
không định nghĩa lại identity.

**Tình huống business thường gặp.** Form có nhiều field sai · batch item errors · date-range error
gắn hai field · provider response map về internal field code.

## Tầng giữ

Cả bốn tình huống hiện là `documented`. Owner đúng phụ thuộc input shape, consumer behavior và
application fact; chưa claim canonical rule nào cho chúng.

| Code | Tier | Ai giữ |
|---|---|---|
| `VALIDATE-1` | `documented` | Runtime trust phụ thuộc boundary và nguồn payload thật, không phải TypeScript annotation |
| `VALIDATE-2` | `documented` | Ownership của canonicalization và competing default cần đọc flow/call graph |
| `VALIDATE-3` | `documented` | Field/application fact cần thiết không thể suy ra an toàn từ một AST |
| `VALIDATE-4` | `documented` | Ý nghĩa path/code ổn định phụ thuộc consumer và error contract của operation |

## Điểm neo

Các path sau là reference shape đang tồn tại để đọc.

| Code | Anchor | Đọc gì ở đó |
|---|---|---|
| `VALIDATE-1` | `src/features/api/core/graphql/mutations/courses/course-enroll/graphql-types/request.ts` | Request shape bên ngoài trước khi enrollment logic nhận |
| `VALIDATE-2` | `src/modules/api/rest/dtos/rest-transform.ts` | Boundary conversion và việc có tạo đúng một canonical representation không |
| `VALIDATE-3` | `src/features/api/core/graphql/mutations/courses/course-enroll/course-pricing.service.ts` | Rule cần course, pricing và request fact cùng lúc thay vì chỉ field syntax |
| `VALIDATE-4` | `src/modules/platform/exceptions/filters/abstract-exception-http.filter.ts` | Transport projection của failure; giữ validation code/path khác với HTTP status |

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| source boundary | Nơi untrusted object/byte đi vào và cách parse |
| input schema | Field bắt buộc, primitive form, allowed value và nested path |
| canonical form | Một representation normalized và boundary sở hữu nó |
| application fact | Field khác, state, record, clock hoặc provider fact cần cho rule |
| error consumer | Caller cần path, code, parameter hay human text |

## Quy tắc

1. Validate runtime data trước khi coi trusted, bất kể annotation hay cast.
2. Normalize một lần ở boundary đầu tiên sở hữu external representation.
3. Giữ shape check ở boundary; để cross-field/application rule chạy nơi đủ fact.
4. Trả stable field path và machine code; message wording không phải contract.
5. Giữ cùng validation meaning qua transport và consumer bất đồng bộ.
6. Áp dụng độc lập từng mã; một input có thể cùng lúc có quyết định trust, normalize, rule và error contract.

## Ngoại lệ

- **Trusted internal value.** Value sinh từ boundary đã validate có thể bỏ qua `VALIDATE-1` khi
  provenance rõ và chưa qua untrusted boundary lần nữa.
- **Provider bắt buộc normalize.** Adapter có thể map spelling provider ở boundary của mình; phải
  emit canonical form của application, không bắt mọi caller lặp lại.
- **Cross-field rule trong domain object.** Aggregate/value object có thể là authority cuối cho
  domain invariant dưới `VALIDATE-3`; application vẫn gom fact và map failure contract.
- **Transport projection.** Controller/filter có thể map field error vào GraphQL/HTTP syntax dưới
  `VALIDATE-4`, nhưng không đổi machine path/code theo transport.
- **Database constraint.** Database có thể reject race/uniqueness conflict, nhưng không xóa application
  rule và không miễn validate input.

## Điểm dừng

Dừng trước khi viết source khi chưa gọi tên trust boundary, canonical form có nhiều owner, cross-field
rule thiếu một layer có đủ fact, hoặc consumer bất đồng về field path/code. Dừng nếu fix dựa vào cast,
message-string parser, database error hay transport status như proof của validation.

## Chứng minh

| Code | Proof tối thiểu |
|---|---|
| `VALIDATE-1` | Boundary test reject malformed, missing, extra và provider-shaped input trước business logic |
| `VALIDATE-2` | Spelling tương đương tạo cùng canonical value; downstream test chứng minh không cần normalize lần hai |
| `VALIDATE-3` | Test bao phủ từng tổ hợp field và application state, gồm consumer có thể bypass boundary kia |
| `VALIDATE-4` | Contract test assert field path/code deterministic và chứng minh đổi message/transport không đổi chúng |

## Đầu ra

```text
boundary:   <untrusted boundary đầu tiên hoặc application layer sở hữu>
canonical:   <canonical representation, hoặc none>
rule:        <field, cross-field hoặc application rule>
errors:      <stable field path và machine code>
situation:   <VALIDATE-1 | VALIDATE-2 | VALIDATE-3 | VALIDATE-4>
verdict:     <holds | violates | stop>
reason:      <fact về trust, normalize, rule ownership hoặc error contract>
proof:       <test hoặc evidence chứng minh boundary>
```

## Ví dụ đã giải

Shape đã duyệt: enrollment request có learner, course, payment method và voucher tùy chọn.
`VALIDATE-1` check request shape ở GraphQL boundary. `VALIDATE-2` canonicalize voucher và payment một
lần. `VALIDATE-3` đánh giá eligibility của voucher/course/learner nơi đủ fact. `VALIDATE-4` trả field
code ổn định cho form. Resolver placement vẫn là `transport`; database handle là `data-access`; domain
invariant ownership là `domain-modeling`.

## Phạm vi

Pattern này quản lý runtime input trust, ownership của canonicalization, placement của cross-field/
application rule và validation failure ổn định. Nó không quản lý static type narrowing, external
routing, database access, domain aggregate design, exception identity hay maintainability mechanics.
