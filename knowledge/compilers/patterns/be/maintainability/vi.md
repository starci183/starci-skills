# Khả năng bảo trì backend

## LOADS

None.

## Record

Đầu vào là một năng lực backend đã được chấp nhận, trong đó hành vi nghiệp vụ, transport và nhu cầu lưu
trữ đã được quyết định. Đầu ra là hình dạng source giúp hành vi đó tiếp tục dễ đọc, dễ test và dễ thay đổi
sau lần triển khai đầu tiên: orchestration dừng ở đâu, decision sống ở đâu, giá trị biến động nào là
dependency, sự lặp nào thật sự là một khái niệm, và complexity nào phải tách trước khi thành rừng nhánh vô
danh.

Module này không đặt ngưỡng SonarQube và không biến analyzer thành kiến trúc sư. Static analysis cung cấp
bằng chứng rằng người đọc đang trả quá nhiều chi phí để hiểu file. Pattern này quyết định boundary source
loại bỏ chi phí đó mà không thay hành vi đã chấp nhận.

## Law

Maintainability là khả năng đổi một sự thật nghiệp vụ tại một nơi và chứng minh thay đổi đó mà không boot
infrastructure không liên quan. File ngắn vẫn có thể vi phạm khi giấu năm decision trong một expression;
file dài vẫn có thể đúng nếu là catalogue phẳng với entry có một shape ổn định. Số dòng là bằng chứng,
không bao giờ là phán quyết.

Đơn vị extract là một **decision**, không phải một số dòng. Decision có input, outcome và tên mà người đọc
nghiệp vụ nhận ra. Orchestration sắp thứ tự decision và effect; nó không chứa cây nhánh của chúng.
Integration adapter dịch một vocabulary bên ngoài; nó không quyết luật domain dùng giá trị đã dịch.

Duplication cũng là câu hỏi semantic. Hai block giống hình nhưng đổi vì lý do khác nhau phải tách. Hai
block diễn đạt cùng một luật qua hai transport phải hội tụ. Câu hỏi không phải “có share được các dòng
này không?” mà là “các outcome này có bắt buộc đổi cùng nhau không?”.

Không quality result nào được mua bằng cách chuyển code ra ngoài analysis, exclude production file, thay
branch bằng metaprogramming mờ, nuốt lỗi, xóa assertion hoặc đánh dấu false positive cho một issue thật.

## Situation codes

| Code | Situation | Source shape |
|---|---|---|
| `MAINTAIN-1` | Operation trộn orchestration với decision tree | Handler đọc như chuỗi tuyến tính; pure decision function hoặc focused service có tên sở hữu branching |
| `MAINTAIN-2` | Một function có nhiều lý do thay đổi độc lập | Tách theo business decision hoặc external boundary, không theo khoảng dòng tùy ý |
| `MAINTAIN-3` | Code lặp có thể hoặc không phải cùng một luật | Chỉ share khi input, outcome và change reason giống nhau; giữ coincidental similarity tách biệt |
| `MAINTAIN-4` | Thời gian, randomness, environment hoặc network state đổi outcome | Resolve volatile value qua dependency rõ và đưa fact đã resolve vào decision |
| `MAINTAIN-5` | Input bị normalize/default ở nhiều layer | Normalize một lần tại boundary sở hữu và mang một canonical representation vào trong |
| `MAINTAIN-6` | Branch được mã hóa bằng boolean cho phép state mâu thuẫn | Thay boolean bag bằng closed discriminated state và exhaustive handling |
| `MAINTAIN-7` | Analyzer báo complexity, duplication hoặc dead code | Trace issue về decision sở hữu và sửa boundary đó; không phẫu thuật chỉ để đổi metric |
| `MAINTAIN-8` | Generated, vendored hoặc data-only artifact vào analysis | Phân loại bằng provenance; cấu hình analysis surface một lần, không exclude authored production code |

Các số là cố định. Chỉ append situation mới khi không code nào ở trên diễn đạt được nó.

## Reading an accepted shape

1. Gọi tên operation và các outcome quan sát được từ bên ngoài.
2. Đánh dấu mọi decision: validation, authorization, state transition, tính price/entitlement, routing,
   retry và disclosure.
3. Đánh dấu mọi effect: database, queue, network, filesystem, clock, randomness và telemetry.
4. Vẽ thứ tự `facts → decisions → effects → result`. Cycle nghĩa là decision đang đọc side effect của
   chính nó hoặc adapter đang sở hữu domain state.
5. Áp dụng `MAINTAIN-1` và `MAINTAIN-2` trước khi extract shared helper.
6. Chỉ áp dụng `MAINTAIN-3` sau khi cả hai block đã có input và outcome được gọi tên.
7. Dùng `MAINTAIN-4` đến `MAINTAIN-6` để decision deterministic và state đóng.
8. Dùng analyzer evidence cuối cùng: nó xác nhận reader cost và chứng minh repair, không tự chọn boundary.

## `MAINTAIN-1` — orchestration tuyến tính

Operation handler có thể phối hợp nhiều collaborator, nhưng happy path phải đọc từ trên xuống: establish
precondition, load state, decide, persist, publish, answer. Policy branch lồng nhau, provider switch và
calculation đi sau những tên nói rõ fact chúng quyết định.

Unit được extract nhận facts và trả value hoặc named decision. Nó không fetch thêm row hay emit telemetry.
Nếu cần infrastructure, nó là orchestration collaborator và tên phải nói boundary nào nó sở hữu.

Không “sửa” complexity bằng cách đảo condition hàng loạt, thêm early return tới mức câu chuyện bị rải,
hoặc thay branch bằng lookup chứa anonymous closure. Early refusal chỉ hữu ích khi nó gọi tên precondition.

## `MAINTAIN-2` — tách theo lý do thay đổi

Một function có nhiều lý do đổi khi payment policy, email formatting và provider retry có thể đổi độc lập.
Đó là ba owner dù implementation hiện chỉ bốn mươi dòng. Ngược lại, declarative mapping hai trăm dòng có
thể chỉ có một lý do đổi và không nên vỡ thành một function cho mỗi row.

Boundary phát ra phải theo module family hiện hữu. Domain calculation ở gần operation/domain module;
provider translation ở integration adapter; persistence query shape ở data access. Folder `utils` hoặc
`helpers` chung không phải boundary—đó là nơi ownership bị mất.

## `MAINTAIN-3` — duplication theo semantics

Trước khi share hai block, ghi bốn fact cho từng block: input, output, failure, reason to change. Chúng chỉ
là một abstraction khi cả bốn khớp. DTO mapping giống nhau của hai provider độc lập thường tách; hai
controller tính cùng entitlement phải hội tụ dù syntax khác nhau.

Unit dùng chung được đặt tên theo rule, không theo callers (`calculateRefundEligibility`, không phải
`commonPaymentHelper`). Caller giữ transport mapping và đưa canonical facts vào rule.

## `MAINTAIN-4` — volatile facts là dependencies

`Date.now()`, random id, process environment, hostname và live network answer làm decision đổi dù argument
không đổi. Resolve chúng ở boundary qua clock, id generator, configuration object hoặc integration client,
rồi đưa fact kết quả vào decision.

Không cần wrap mọi global bằng interface. Chỉ extract volatile fact ảnh hưởng outcome. Logger timestamp là
observability mechanics; invoice deadline là business input và phải được test kiểm soát.

## `MAINTAIN-5` — normalize một lần

Chọn boundary đầu tiên sở hữu representation không tin cậy: DTO/parser cho syntax, adapter cho provider
vocabulary, domain constructor cho invariant-bearing value. Trim, case-fold, default hoặc convert ở đó,
rồi mang một representation vào trong.

Default đổi ý nghĩa nghiệp vụ là decision. Missing page size thành `20` là transport normalization;
missing payment deadline thành “ngày mai” là domain policy dùng clock và cũng thuộc `MAINTAIN-4`.

## `MAINTAIN-6` — state đóng

Nhiều boolean mô tả một lifecycle tạo tổ hợp không thể có: `paid && cancelled`, `running && suspended`,
`verified && pending`. Dùng discriminated union hoặc enum-backed state và làm transition exhaustive.

Exhaustive switch được phép lặp hình khi mỗi arm là business state khác nhau. Share mechanics bên trong
arm, không merge state. Default arm âm thầm coi future state như old state phá closed representation.

## `MAINTAIN-7` — trace analyzer evidence

Với từng issue, ghi file, rule, decision bị ảnh hưởng và owner đề xuất. Complexity thường route về
`MAINTAIN-1/2`; duplication về `MAINTAIN-3`; hidden global về `MAINTAIN-4`; repeated coercion về
`MAINTAIN-5`; contradictory condition về `MAINTAIN-6`.

False positive cần source evidence giải thích vì sao đổi construct làm code kém thật hơn. “Gate phiền”,
“legacy” và “cần Quality Gate xanh” không phải evidence.

## `MAINTAIN-8` — analysis surface theo provenance

Authored production code luôn ở quality và coverage surface. Test là test code; generated client,
compiled output, vendored source và data payload được phân loại một lần bằng deterministic path hoặc
generation manifest. Artifact không thành generated chỉ vì khó test.

Coverage và quality exclusions khác nhau. Generated client có thể không chịu authored-code smells nhưng
adapter vẫn cần contract test. Test file có thể ngoài production coverage nhưng vẫn được analyze như test.

## Layer held

| Code | Tier | Evidence |
|---|---|---|
| `MAINTAIN-1` | analyzed + reviewed | Cognitive complexity và handler story review |
| `MAINTAIN-2` | reviewed | Ownership và change reasons độc lập |
| `MAINTAIN-3` | analyzed + reviewed | Duplication report và semantic four-fact comparison |
| `MAINTAIN-4` | tested + reviewed | Deterministic tests kiểm soát volatile fact |
| `MAINTAIN-5` | reviewed | Một normalization boundary và canonical internal type |
| `MAINTAIN-6` | type-held + tested | Closed union/enum và exhaustive transition tests |
| `MAINTAIN-7` | externally enforced | Sonar issue state và waited quality gate |
| `MAINTAIN-8` | configuration-held | Declared provenance và LCOV surface |

Không row nào được giữ chỉ bằng metric. Analyzer evidence không có source boundary chỉ là symptom report;
refactor không có proof là unmeasured rewrite.

## Inputs

| Input | Evidence required |
|---|---|
| operation | Accepted operation và observable outcomes |
| decisions | Branches chọn business result |
| effects | Database, network, queue, filesystem, time, randomness và telemetry |
| state | Valid lifecycle states và transitions |
| repetition | Input/output/failure/change-reason của từng block |
| analysis | Exact rule, file và issue state hiện tại |
| provenance | Authored, test, generated, vendored, compiled hoặc data-only |

## Rules

1. Extract decisions, không extract line ranges.
2. Giữ orchestration tuyến tính và effects nhìn thấy được.
3. Tách theo reason to change, không theo universal size limit.
4. Share semantic rules; giữ coincidental similarity tách biệt.
5. Biến time, randomness, environment và network answer ảnh hưởng outcome thành dependency rõ.
6. Normalize external representation một lần ở boundary sở hữu.
7. Biểu diễn một lifecycle bằng closed state, không bằng contradictory booleans.
8. Trace analyzer finding về source ownership trước khi đổi code.
9. Không exclude authored production code để cải thiện metric.
10. Chứng minh cùng accepted behaviour sau repair.

## Exceptions

- Declarative catalogue có thể dài khi entry đồng nhất và một owner đổi chúng cùng nhau.
- Duplication nhỏ có thể giữ khi callers có failure hoặc release cadence khác nhau.
- Framework-generated decorator branches chỉ được xử lý tại project analysis threshold sau khi đo được
  nguyên nhân; không cho phép per-file ignore.
- Provider adapter có thể giữ provider vocabulary ở edge; canonical domain terms bắt đầu sau translation.
- Performance denormalization cần benchmark, consistency owner và repair path.

## Stops

- Chưa biết accepted behaviour đủ để chứng minh preservation.
- Extraction vượt capability boundary ngoài approved file plan.
- Green result cần exclusion, suppression, skipped test hoặc lower gate.
- Không chứng minh được hai block lặp có cùng change reason.
- Thiếu analyzer authority trong khi yêu cầu cần external issue state.

## Proof

Chạy original tests, source gates và exact analyzer gate. Đọc diff như một câu chuyện: handler tuyến tính,
decision có tên, volatile facts kiểm soát được, state exhaustive, và không authored source nào rời analysis
surface. Chỉ báo before/after complexity hoặc duplication cùng boundary ownership đã đổi.

## Output

```text
operation: <accepted capability>
situations: <MAINTAIN-1 ... MAINTAIN-8>
orchestration: <file and linear sequence>
decisions: <named units and inputs/outcomes>
effects: <explicit boundary collaborators>
state: <closed representation and transitions>
analysis: <issue/rule and source owner>
files: <exact paths>
proof: <tests, source gates and waited analysis>
```
