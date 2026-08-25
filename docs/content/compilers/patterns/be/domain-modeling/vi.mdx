---
title: Mô hình hóa domain
---

# Mô hình hóa domain

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | máy backend đã publish mà record này trích dẫn |

## Bản ghi

Đầu vào là một business shape đã được duyệt: aggregate, value, chuyển trạng thái, luật cần nhiều
aggregate, hoặc representation để lưu trữ. Module này giải quyết boundary giữ nguyên ý nghĩa
business trong source. Nó không quyết định business outcome, không chọn transport, database handle,
lối thoát của type system, hay refactor orchestration.

## Luật

Invariant thuộc về object nhỏ nhất có thể giữ nó đúng. Value đi qua domain boundary dưới dạng value
object đã kiểm chứng, không phải một nhóm primitive không giới hạn. Lifecycle là tập state đóng với
transition có tên, không phải một túi boolean. Luật thực sự cần hơn một aggregate do stateless domain
service tính; service nhận domain object và trả quyết định, không biến thành repository trá hình.
Shape lưu trữ là bản dịch ở biên, không phải domain model.

Đây là luật bắt buộc. Mỗi domain shape đã duyệt phải giải quyết mọi tình huống phù hợp bên dưới. Khi
hai mã mô tả hai sự thật khác nhau trong cùng một file, cả hai đều áp dụng và có quyết định riêng.
Module lân cận vẫn tách biệt: narrowing kiểu thuộc `type-safety`, database handle và transaction
thuộc `data-access`, cửa ngoài thuộc `transport`, còn decision tree/duplication thuộc
`maintainability`.

## Mã tình huống

Mỗi tình huống được quản lý mang identity cố định `DOMAIN-<n>`. Số và nghĩa của mã là ổn định.

| Code | Tình huống | Source phải có hình dạng |
|---|---|---|
| `DOMAIN-1` | Một invariant có một aggregate owner | Aggregate expose command giữ invariant; caller không tự mutate field hay chép predicate ở bên cạnh |
| `DOMAIN-2` | Một domain value đi qua boundary | Value object immutable validate và canonicalize một lần; domain code không chuyền primitive trần nơi value có ý nghĩa business |
| `DOMAIN-3` | Lifecycle state thay đổi | Một transition authority có tên kiểm tra state hiện tại và tạo state kế; cấm gán state tùy ý và boolean lifecycle mâu thuẫn |
| `DOMAIN-4` | Một luật cần hơn một aggregate | Stateless domain service giữ quyết định cross-aggregate và nhận domain concepts; persistence, transport, framework ở bên ngoài |
| `DOMAIN-5` | Domain object được lưu hoặc load | Mapper tường minh dịch giữa domain và persistence shape; ORM decorator, column default và field chỉ có ở database không trở thành domain behavior |

`DOMAIN-1` và `DOMAIN-4` không loại trừ nhau. Aggregate vẫn giữ invariant nội bộ khi domain service
điều phối luật giữa các aggregate. `DOMAIN-2` và `DOMAIN-5` có thể cùng áp dụng cho một property ở
hai biên: value object giữ meaning, mapper giữ representation.

## Đọc một shape đã duyệt

1. Đọc business language đã chốt trước: object, fact, outcome hợp lệ và transition có tên. Không
   bịa thêm rule chỉ để làm một mã khớp.
2. Tìm owner hẹp nhất cho mỗi invariant. Nếu một aggregate quyết định được từ state của nó, dùng
   `DOMAIN-1`; nếu cần state của hai aggregate, đi tiếp đến `DOMAIN-4`.
3. Đánh dấu mọi value có unit, identity, format, range hoặc luật equality. Những value đó giải quyết
   `DOMAIN-2` trước khi aggregate hay service nhận vào.
4. Vẽ lifecycle thành state và transition hợp lệ, rồi xác định authority duy nhất được phép chuyển.
   Đó là `DOMAIN-3`.
5. Nếu domain object được persist, tách field domain khỏi field row/document và giải quyết
   `DOMAIN-5` ở mapper boundary.
6. Áp dụng từng mã phù hợp độc lập. Handler vừa gán `order.status` vừa serialize domain object có
   hai finding, không phải một finding placement gộp lại.

## `DOMAIN-1` — aggregate giữ invariant của nó

**Khi nào gặp.** Một command chỉ được đổi aggregate nếu một rule về aggregate đó vẫn đúng. Rule là
ý nghĩa của object, nên object giữ state cần thiết phải là nơi quyết định.

**Source phải thể hiện gì.** Public command hoặc method có tên trên aggregate kiểm tra invariant và
đổi state atomically. State private hoặc được kiểm soát mutation. Handler, resolver hay service gọi
method đó, không set field và không chép predicate.

**Dấu hiệu nhận ra.** `aggregate.status = ...` nằm ngoài aggregate; predicate balance, quantity,
membership hoặc ownership bị chép ở handler; collection public cho caller update mà không chạy check.

**Ranh giới.** Không phải `DOMAIN-4`: rule chỉ dùng state của một aggregate không phải cross-aggregate
service. Không phải `VALIDATE-3`: tổ hợp field của request không phải invariant của aggregate. Không
phải `DATA-*`: manager, transaction và query là quyết định persistence riêng.

**Tình huống business thường gặp.** Reserve inventory · thêm lesson khi order hợp lệ · tiêu credit
không xuống dưới zero · đóng support thread đúng một lần.

## `DOMAIN-2` — value object giữ boundary của value

**Khi nào gặp.** Một value có ý nghĩa business vượt quá primitive: amount tiền, email, slug khóa học,
date range, currency hoặc external identifier.

**Source phải thể hiện gì.** Immutable value object có factory hoặc constructor có tên để reject input
không hợp lệ, lưu một canonical representation và định nghĩa equality theo value. Domain method nhận
object đó thay vì lặp primitive check ở mọi caller.

**Dấu hiệu nhận ra.** Parameter `string` hoặc `number` có format/range check lặp lại; unit business
chỉ nằm trong tên biến; value object có public field mutable hoặc normalize ở từng caller.

**Ranh giới.** Không phải `TYPE-*`: mã này quyết định business meaning và ownership, không quyết định
unknown value được narrow an toàn ra sao. Không phải `VALIDATE-2`: normalize bên ngoài là boundary
operation; value object vẫn đảm bảo domain value canonical sau khi tạo.

**Tình huống business thường gặp.** Price có currency · email normalized · percentage bị giới hạn ·
course code có case canonical · date interval không thể kết thúc trước khi bắt đầu.

## `DOMAIN-3` — lifecycle transition có một authority

**Khi nào gặp.** Entity hoặc aggregate đi qua các state có transition hợp lệ và không hợp lệ. State
hiện tại và rule chuyển phải đi cùng nhau; nếu không caller có thể tạo lifecycle bất khả.

**Source phải thể hiện gì.** Closed state representation và một transition method có tên (hoặc state
machine do aggregate sở hữu) kiểm tra state hiện tại, ghi state kế và trả domain fact. Caller yêu cầu
`approve`, `cancel`, `complete` hoặc tên tương đương; không gán state hay giữ boolean song song.

**Dấu hiệu nhận ra.** `isPaid`, `isCancelled`, `isOpen` có thể cùng true; public `state` setter;
transition predicate lặp trong nhiều handler; string lạ âm thầm được nhận làm state.

**Ranh giới.** Không phải `MAINTAIN-*`: boolean mâu thuẫn là domain lifecycle error ở đây; module
maintainability có thể phán duplication/complexity riêng. Không phải transport status mapping: HTTP
status không phải domain lifecycle.

**Tình huống business thường gặp.** Pending sang paid · draft sang published · active sang suspended
· review sang approved/rejected · session chỉ expire một lần.

## `DOMAIN-4` — luật cross-aggregate thuộc domain service

**Khi nào gặp.** Business decision cần state của từ hai aggregate root trở lên và không aggregate nào
tự quyết được.

**Source phải thể hiện gì.** Stateless domain service có business name, domain input và domain result
hoặc decision. Nó điều phối rule nhưng không có persistence handle, transport decorator, framework
lifecycle hay mutable request state. Aggregate vẫn bảo vệ invariant riêng khi service gọi chúng.

**Dấu hiệu nhận ra.** Handler đọc hai aggregate rồi chứa business predicate; một aggregate chui vào
private state của aggregate khác; class gọi là “domain service” nhưng inject ORM manager hoặc resolver
và trả transport response.

**Ranh giới.** Không phải `DATA-4`: transaction scope và manager propagation là persistence concern.
Không phải `CQRS` hay `TRANSPORT`: command placement và external door không quyết định domain
predicate nằm đâu. Chỉ dùng mã này khi cần thật sự state của nhiều aggregate.

**Tình huống business thường gặp.** Eligibility từ learner và course · pricing từ voucher và basket
· cấp seat theo cohort và capacity · quyết định refund từ payment và entitlement.

## `DOMAIN-5` — persistence và domain shape được map tường minh

**Khi nào gặp.** Domain object cần được lưu hoặc khôi phục từ row/document. Constraint và ORM
annotation không phải business behavior, không được rò vào domain.

**Source phải thể hiện gì.** Mapper hoặc conversion boundary có tên map domain value sang persistence
shape và ngược lại, xử lý rõ id, timestamp, nullable field và value object. Domain object không có ORM
decorator, lazy relation, database default hoặc column-only flag.

**Dấu hiệu nhận ra.** Domain method đọc column decorator hoặc ORM relation; entity được chuyền thẳng vào
use case như aggregate; mapper âm thầm làm rơi domain field hoặc để database default quyết định
business default.

**Ranh giới.** Không phải `DATA-3`: table name và entity declaration thuộc data access. Mã này hỏi
domain/persistence boundary có rõ không. Không phải `DOMAIN-2`: value object có thể được mapper
serialize, nhưng invariant vẫn thuộc value object.

**Tình huống business thường gặp.** Rehydrate order với money value · lưu enum state đóng · migrate
nullable column cũ · giữ audit column ngoài domain aggregate.

## Tầng giữ

`documented` nghĩa là quyết định phụ thuộc business semantics hoặc call graph mà canonical machine một
file hiện tại không thể suy ra an toàn. Chưa claim canonical rule nào cho đến khi rule tồn tại.

| Code | Tier | Ai giữ |
|---|---|---|
| `DOMAIN-1` | `documented` | Aggregate invariant owner là semantic decision; parser không biết predicate đã đủ hay bị chép ở đâu khác |
| `DOMAIN-2` | `documented` | Validity, unit và equality là domain fact; syntax của type không phân biệt primitive có ý nghĩa với primitive thường |
| `DOMAIN-3` | `documented` | Legal transition cần lifecycle graph đã duyệt và call-graph intent; AST cục bộ có thể nhận state machine chưa đủ |
| `DOMAIN-4` | `documented` | Rule có thực sự cần nhiều aggregate root là business fact, không phải filename/decorator heuristic an toàn |
| `DOMAIN-5` | `documented` | Mapping đúng cần domain intent và persistence schema; không được nói quá rằng data-access lint đang enforce domain |

## Điểm neo

Các path sau là reference shape đang tồn tại. Chúng là bằng chứng để đọc, không phải quyền copy tên
feature vào domain model mới.

| Code | Anchor | Đọc gì ở đó |
|---|---|---|
| `DOMAIN-1` | `src/features/api/core/graphql/mutations/courses/course-enroll/course-enroll.handler.ts` | Quyết định enrollment và fact aggregate bị đổi; xác định invariant nào là local và invariant nào đang nằm ngoài model |
| `DOMAIN-2` | `src/features/api/core/graphql/mutations/courses/course-enroll/graphql-types/request.ts` | Request value có unit/format business cần trở thành domain value trước khi handler quyết định |
| `DOMAIN-3` | `src/modules/databases/postgresql/primary/entities/enrollment.entity.ts` | Enrollment state đang persist và lifecycle là closed state hay nhiều flag writable |
| `DOMAIN-4` | `src/features/api/core/graphql/mutations/courses/courses-checkout/courses-checkout.handler.ts` | Decision đọc course, enrollment, payment; tách cross-aggregate policy khỏi orchestration và persistence |
| `DOMAIN-5` | `src/modules/databases/postgresql/primary/entities/course.entity.ts` | ORM representation ở database edge; đối chiếu với domain shape, không coi entity là domain object |

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| business shape đã duyệt | Object, invariant, value meaning, lifecycle state và outcome hợp lệ đã chốt |
| ownership của invariant | State cần để quyết định và object nhỏ nhất sở hữu nó |
| value boundary | Primitive representation, canonical form, invalid form và equality semantics |
| lifecycle graph | State hiện tại, edge hợp lệ, edge bị reject và transition authority |
| aggregate set | Aggregate root cần state cho cross-aggregate decision |
| persistence shape | Row/document field, nullability, generated field và domain conversion boundary tường minh |

## Quy tắc

1. Giữ mỗi invariant ở aggregate nhỏ nhất có thể quyết định từ state của nó.
2. Tạo business value một lần thành immutable value object rồi truyền object đó vào trong.
3. Biểu diễn một lifecycle bằng một state đóng và transition có tên, không bằng boolean mâu thuẫn.
4. Chỉ dùng stateless domain service khi cần nhiều aggregate root cho một decision.
5. Để transport, framework và persistence handle bên ngoài domain service và aggregate.
6. Map domain và persistence shape tường minh hai chiều; không dùng ORM entity thay domain aggregate.
7. Áp dụng độc lập mọi mã phù hợp; một file có thể có nhiều domain finding.

## Ngoại lệ

Ngoại lệ là lối ra đóng của pattern, không phải waiver tổng quát.

- **Read model hoặc projection.** Projection có thể là persistence/read shape phẳng có chủ ý.
  `DOMAIN-5` vẫn cần boundary tường minh trước khi shape đó được coi là domain object; một read row
  có class không tự thành aggregate.
- **Primitive không có business meaning.** Loop index, pagination offset hoặc framework token cục bộ
  không cần `DOMAIN-2` khi không có domain rule nào gắn với nó.
- **Aggregate factory.** Factory có thể là authority tạo state đầu tiên dưới `DOMAIN-3`; nó vẫn phải
  reject initial state bất khả.
- **Cross-aggregate transaction.** Transaction có thể bọc domain service call, nhưng manager,
  repository và commit policy vẫn thuộc `data-access`, không phải ngoại lệ cho `DOMAIN-4`.
- **Persistence entity.** ORM decorator có thể sống trên persistence representation dưới `DOMAIN-5`;
  ngoại lệ này không cho phép decorator hay database default đi vào domain code.

## Điểm dừng

Dừng trước khi viết source khi một trong các fact sau chưa rõ:

- chưa có invariant, value meaning, lifecycle graph hoặc aggregate set đã duyệt;
- hai owner đều có thể mutate cùng invariant mà chưa có owner được phê duyệt;
- chưa biết unit, canonical form hoặc invalid range của primitive;
- yêu cầu transition nhưng chưa có tập state đóng và transition bị reject;
- domain service đề xuất cần database handle, transport object hoặc framework lifecycle;
- persistence schema bị đoán thay vì đọc từ data-access contract đã khai báo.

## Chứng minh

Record được chứng minh khi mỗi mã phù hợp có owner, source boundary và consequence test. Đây là proof
kiến trúc, không phải claim rằng một lint rule không tồn tại đang enforce.

| Code | Proof tối thiểu |
|---|---|
| `DOMAIN-1` | Test đổi aggregate qua command và chứng minh caller không bypass được invariant |
| `DOMAIN-2` | Factory test bao phủ canonicalization, value không hợp lệ và equality; caller nhận value object |
| `DOMAIN-3` | Transition test bao phủ mọi edge hợp lệ và bị reject, gồm cả transition lặp |
| `DOMAIN-4` | Service test cấp state của hai aggregate và chứng minh decision không có persistence/transport side effect |
| `DOMAIN-5` | Round-trip mapping test chứng minh domain meaning còn nguyên và ORM detail không rò vào trong |

## Đầu ra

Một block cho mỗi tình huống áp dụng:

```text
shape:       <business shape đã duyệt>
owner:       <aggregate, value object, transition authority, domain service hoặc mapper>
boundary:    <source boundary giữ quyết định>
situation:   <DOMAIN-1 | DOMAIN-2 | DOMAIN-3 | DOMAIN-4 | DOMAIN-5>
verdict:     <holds | violates | stop>
reason:      <fact về invariant, value, transition, aggregate set hoặc mapping>
proof:       <test hoặc evidence chứng minh boundary>
```

## Ví dụ đã giải

Shape đã duyệt: enrollment phải kiểm tra learner, course, payment; seat course không được tiêu hai
lần; persistence của payment có tính transaction.

`DOMAIN-1` giữ invariant “seat chỉ tiêu một lần” ở course aggregate. `DOMAIN-4` đặt eligibility
decision cần learner và course state trong stateless domain service. `DOMAIN-5` map aggregate sang
course/enrollment row. Transaction và manager thuộc `data-access`; GraphQL resolver thuộc `transport`;
không sự thật nào trong hai module đó đổi ownership của domain.

## Phạm vi

Pattern này quản lý domain ownership và representation trong TypeScript backend của stack này. Nó
không quản lý static narrowing, vị trí request bên ngoài, database handle, transaction, query shape,
exception identity hay maintainability mechanics. Các concern đó phải được route đến module riêng,
không được đưa lén vào domain rule.
