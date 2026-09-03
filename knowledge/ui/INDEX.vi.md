# UI knowledge

Cây này chứa universal UI law dùng chung cho mọi Grammar family đã publish, chia thành ba nhóm theo
operator đọc từng law.
Nó sở hữu 115 law X-n ổn định đang sống (36 ở composition, 60 ở presentation, 19 ở proof), cộng
năm id composition đã nghỉ vào COVERAGE-1 và không bao giờ dùng lại, cùng với selection condition
quan sát được, ownership decision, deterministic verdict và audit vector. Đây không phải implementation hay consumer cookbook. Nó không sở hữu business fact, copy riêng của page, route, permission,
identity artwork, effect sản phẩm hay lựa chọn material của family.

## Runtime policy

- Knowledge chuẩn cho agent/runtime chỉ là file `.md` tiếng Anh.
- File `.vi.md` cùng tên là bản mirror đầy đủ dành cho human review. Không bao giờ load, index hay
  cite chúng như runtime authority.
- Grammar operator resolve file canonical nhỏ nhất liên quan cùng rule ID. Từng file không mang
  routing metadata theo topic.
- Rule ID là địa chỉ ổn định, công khai. Chỉ được nối thêm `PREFIX-n` kế tiếp theo thứ tự; không bao
  giờ đánh số lại, tái sử dụng, hay lặng lẽ đổi nghĩa một ID đã tồn tại.
- Knowledge sở hữu invariant decision và audit vector, không sở hữu implementation status, migration
  plan, workflow, operator DAG hay task orchestration. Capability/debt hiện tại thuộc về plan và audit.

## Grammar binding

`@starci/grammar/common` là authority công khai cho props, semantics, renderer anatomy, state,
accessibility, composition và universal implementation. Một application đã chọn family chỉ import
đúng stylesheet của family đó; stylesheet đó import Common. Import trực tiếp
`@starci/grammar/common/styles.css` chỉ dành cho trường hợp dùng Common không family có chủ đích và
cho test harness cô lập. Một application không được import cả hai đường cho cùng một cây đã render.

Một visual family là scoped overlay tương thích props, khai báo qua `defineGrammarFamily`. Nó có thể
thay một Common renderer đã biết bằng props tương thích chính xác, hoặc thêm extension không xung
đột; stylesheet của nó được scope bằng `data-grammar-family`. Nó phải giữ nguyên meaning, state
behavior, accessibility, ownership và substitutability của Common.

Business/application code chọn đúng một family và cung cấp domain content, data, permission, handler
và verified state. Application CSS được phép sở hữu page canvas, product layout/content/media và
placement thông qua extension point công khai. Nó không được reach-through, dựng lại hay override
anatomy, spacing, semantics, state, focus hay variant do Common sở hữu. Family document ghi lại lựa
chọn overlay và conformance evidence; chúng không bao giờ lặp lại hay định nghĩa lại những universal
law này. Một capability tái dùng còn thiếu là gap của Common, không phải giấy phép cho anatomy cục bộ
theo sản phẩm hay một universal rule riêng của family.

## Ba nhóm

Một topic sống cùng operator đọc nó. Topic nào không operator nào đọc thì không có lý do tồn tại.

| Nhóm | Quyết định | Ai đọc |
| --- | --- | --- |
| [`composition/`](composition/INDEX.vi.md) | Ràng buộc mà một direction phải thoả, sau khi gu thẩm mỹ đã quyết ở grammars | `frontend.direction.decide` |
| [`presentation/`](presentation/INDEX.vi.md) | Ranh giới do app sở hữu lấy giá trị CSS nào | `frontend.presentation.resolve` |
| [`proof/`](proof/INDEX.vi.md) | Thứ chỉ đúng sau khi đã render | `frontend.surface.audit` |

Phép thử để xếp một topic là: đọc source có trả lời được không. Giá trị khoảng cách đọc được từ class
nên thuộc presentation. Số hành động trội đã chốt trước khi có cây nên thuộc composition. Thứ tự bàn
phím có khớp thứ tự nhìn thấy hay không thì phải chạy mới biết, nên thuộc proof.

Quy ước viết code sinh ra tất cả những thứ này nằm ở [`patterns/`](../patterns/fe/INDEX.vi.md), còn
phần hiện thực của từng họ nằm ở [`grammars/`](../grammars/starci/INDEX.vi.md).

## Rule binding architecture

Knowledge định nghĩa một rule nghĩa là gì; nó không hard-code instance DOM hiện tại nào pass rule đó.
Một Common reusable expose stable anchor cho component, slot và relationship. Một binding registry
co-located hoặc generated map các anchor đó sang rule, với tối thiểu:

- một binding ID và version ổn định;
- `ruleId`;
- target slot hoặc between-slot relationship chính xác;
- `when` variant, state hoặc composition selector;
- expected owner anchor.

Registry không bao giờ lặp lại metric hay behavior của rule. Application không tự tay viết mảng rule,
và không markup nào tự gán nhãn pass cho chính nó. Auditor resolve binding từ stable DOM anchor, thu
thập rendered evidence, và ghi rule ID cùng finding vào audit result. Rule ID không rõ, slot thiếu,
anchor cũ và binding mồ côi đều fail validation. DOM nằm ngoài một reusable đã đăng ký có thể được
chọn bằng semantic inspection, nhưng không thể nhận `PASS` nếu thiếu cùng owner và runtime evidence.

Contract claim là ngoại lệ duy nhất, và nó không phải self-assessment. Một rule-binding operator có
thể emit `data-contract` trên node nó đã resolve, dưới dạng danh sách identifier cách nhau bằng
space mà node đó tuyên bố thoả mãn. Claim nêu ra một ý định để auditor có thể phản bác: một node claim
`GAP-4` trong khi gap tính ra là `1.5rem` là một finding, một node mang spacing mà không claim gì là
một giá trị vô chủ, và một identifier được claim nhưng không có trong knowledge đã publish thì fail
validation. Claim không bao giờ mang verdict, score hay `PASS`, và một claim viết tay là không hợp lệ
vì chỉ receipt của operator mới verify được. Grammar emit cùng một claim trên những element hiện thực
một relationship nó sở hữu, chính là các row trong bảng "Common already owns" của từng topic, nên một
giá trị nội bộ của Grammar không bao giờ là giá trị vô chủ và resolver không claim lại những node đó.
Receipt vẫn là bản ghi bền vững, nên attribute này có thể bị strip khỏi production build mà không làm
yếu bất kỳ audit nào.

## Canonical verdict model

Base verdict chỉ gồm đúng: `PASS`, `COMMON_CAPABILITY_MISSING`, `COMMON_IMPLEMENTATION_GLITCH`,
`FAMILY_OVERRIDE_GLITCH`, `APP_REIMPLEMENTATION`, `APP_OVERRIDE`, `APP_WORKAROUND`, `PROOF_MISSING`.

Cause tag chỉ gồm đúng: `VALUE_DRIFT`, `VENDOR_LEAK`, `WRONG_OWNER`, `OFF_SCALE_VALUE`,
`DOUBLE_OWNER`, `PHYSICAL_SIDE_DRIFT`, `STATE_OR_VIEWPORT_DRIFT`.

Đánh giá theo thứ tự capability, output cô lập của Common, delta của family, delta của app, rồi mới
tới owner/state evidence. Một finding chứa đúng một base verdict và không hoặc nhiều cause tag. Nhiều
layer fail cùng lúc tạo ra các finding liên kết; chúng không bị gộp thành một base verdict tổng hợp
hay bị first-match logic che mất. `PASS` chỉ hợp lệ khi không tồn tại failure finding nào.
