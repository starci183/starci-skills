# architecture.decide

## Việc

Quyết một kiến trúc với stack, ranh giới hệ thống và quyền sở hữu dữ liệu, rồi chứng minh nó bằng
hiện trạng quan sát được, các phương án bị loại, tương thích đã kiểm và một phản biện độc lập.

## Quan sát trước khi đề xuất

Không đề xuất gì trước khi hiện trạng được quan sát ở head đóng băng của `@workspaces/be` và ghi vào
`response/data/current-state.json` với fingerprint riêng. Một đề xuất viết trước khi quan sát mô tả
một hệ thống đơn giản hơn hệ thống thật, và mọi so sánh sau đó thừa hưởng sự đơn giản hoá ấy. Quan
sát ở một head khác còn tệ hơn: trông chặt chẽ nhưng mô tả mã không còn tồn tại.

## Đang chạy sẵn không phải là lý do

Inventory nói hệ thống hôm nay chạy gì; đó là context hữu ích nhất và nguy hiểm nhất operator này
nhận. Một framework, datastore, broker hay hình dạng deploy đang có chỉ đi vào quyết định theo đúng
hai vai: ràng buộc đo được mà đích phải thoả, hoặc bằng chứng quan sát về hành vi đã được chứng minh.
Nó không bao giờ là lý do tự thân. Component được biện minh vì đã có sẵn bị loại thẳng.

## Chứng minh, không giả định

Một phương án chỉ được tính khi khác nhau về bản chất, khác về quyền sở hữu hay cơ chế chứ không
phải câu chữ, và được chấm trên đúng các trục đánh đổi người dùng nêu. Mọi component giữ lại mang
một phán quyết đã kiểm có bằng chứng trên năm trục: phiên bản runtime, đơn vị deploy, lỗi giao
tiếp, quyền sở hữu datastore, sao lưu và khôi phục; phán quyết bỏ qua một trục là kiểm một phần
đội lốt kiểm đầy đủ. Mọi boundary trả lời câu hỏi dữ liệu: sở hữu ít nhất một store hoặc nói rõ
không sở hữu; một store gọi tên đúng một boundary chủ và boundary đó ghi nó, người ghi thứ hai chỉ
tồn tại khi có lý do chia sẻ ghi rõ ràng.

## Quyết định gọi tên mọi lần ghi nó cam kết

Một boundary sở hữu store không nói gì về việc ai ghi nó, lúc nào, dưới transaction nào, nên quyết
định tự lấp khoảng trống đó: `response/data/stack-model.json` mang một mục `operations` cho mỗi lần
ghi mà kiến trúc này cam kết, và bảng `## Operations` của biên nhận thuật lại đúng những hàng ấy. Mỗi
mục gọi tên transport, writer, các store nó chạm, ranh giới transaction, kiểu idempotency, các
migration nó mang, và các `dimension` của ma trận phủ thuộc head nghiệp vụ mà nó hiện thực. Danh sách
đó chính là hợp đồng đóng băng mà `backend.source.apply` lấp: phần hiện thực thuật lại nguyên vẹn
những operation đó và không được thêm cái nào, nên một operation không ai khai ở đây thì không thể
được viết ở đâu cả. Khai một lần ghi không phải là chọn một cách hiện thực, và đó là lý do writer là
đường dẫn file duy nhất operator này gọi tên.

Một migration độc lập dùng hình dạng operation tại
[`stack-model.schema.json#/$defs/migrationOperation`](../../templates/kinds/stack-model.schema.json#/$defs/migrationOperation).
Nó vẫn thuộc cùng quyết định ownership và phản biện độc lập. Khai báo operation source không cấp
quyền áp migration vào một môi trường.

## Phản biện là một cuộc trao đổi lồng

Sau khi phương án đã chọn được đào sâu, nhánh tạm ngưng: nó phát `response/response.json` với status
`waiting` và `awaiting { exchange: critique, kind: independent-critique }`. Orchestrator ghi
`critique/request/request.json` chỉ với `response/data/stack-model.json` làm đầu vào, không bao giờ
kèm lý lẽ của tác giả, rồi chạy một agent mới trên chính profile của operator này, không thừa hưởng
lượt. Agent đó chỉ ghi `critique/response/`. Khi response của nó done, agent đang ngưng chạy tiếp ở
bước xác nhận. Các nhánh khác cùng bậc vẫn chạy suốt thời gian đó.

## Ranh giới

Context chỉ đọc. Operator chỉ ghi `response/` của nhánh mình: `response.md`,
`data/current-state.json`, `data/stack-model.json`, trang so sánh phương án khi được yêu cầu nhiều
hơn một phương án, và `response.json`; agent phản biện chỉ ghi `critique/response/`. Nó không sửa
source được route, không publish thẩm quyền nghiệp vụ, không khởi động hay cấu hình lại dịch vụ
runtime, không nêu tên file implementation trong handoff, và không tuyên bố implementation, cổng
chất lượng hay UAT đã qua.

Khi đầu vào `model` có mặt, nó là thẩm quyền của lần chạy này và head đã publish chỉ còn là dòng dõi,
bởi một quyết định lấy theo lời hứa của hôm qua là quyết định lấy theo lời hứa sai. Khi nó vắng, head
đã publish là thẩm quyền.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@workspaces/be` | checkout backend được route, đọc ở head đóng băng; inventory lấy từ manifest và file deploy | có |
| `@worktrees/businesses/<featureId>` | head nghiệp vụ đã publish, lời hứa mà kiến trúc phải giữ; chỉ là bằng chứng khi phiên mang đầu vào `model` | có |
| `@knowledge/patterns` | hình dạng tái dùng mà scope có thể ràng; là hình dạng, không bao giờ là lựa chọn | không |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `architecture-decision` | một lần chạy `architecture.decide` trước trên cùng hoặc kề ranh giới; dòng dõi có thể bị phản bác, không được bỏ qua | không |
| `model` | `business.decide`; head mà nhánh đó đã mô hình hoá, khi nó chưa được publish | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `objective` | prompt | — | Mục tiêu kiến trúc phải đạt, bằng lời của người dùng |
| `decisionId` | id | slug of `objective` | Tên mà các artifact mang |
| `alternatives` | number 1–4 | 1 | Sinh bao nhiêu thiết kế khác nhau về bản chất; nhiều hơn một chỉ khi được yêu cầu so sánh |
| `tradeoffAxes` | list | cost, complexity, reversibility | Các trục mọi phương án được chấm và phản biện bám theo |
| `constraints` | list `{id, kind, statement}` | — | kind là fixed-intent, measurable, preference, assumption hoặc unknown; ít nhất một fixed-intent |
| `selectionPolicy` | choice | automatic | `automatic`: operator chọn và ghi lý do; `approval-required`: người chọn |
| `approval` | id | null | Id phương án được duyệt; chỉ bắt buộc dưới `approval-required`, nhập khi chạy lại sau `CHOICE_REQUIRED` |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate và chạy lại | `resume`, `approval` | `request/request.json`, đầu vào `architecture-decision` nếu có, @workspaces/be ở head đóng băng | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Quan sát hiện trạng | — | @workspaces/be ở head đóng băng: manifest, cấu hình, file deploy, @tools/git | `response/data/current-state.json` | `CURRENT_STATE_UNOBSERVED` |
| 3 | Ràng inventory với lời hứa nghiệp vụ | — | `response/data/current-state.json`, đầu vào `model` khi có, nếu không thì @worktrees/businesses/<featureId> ở head đã publish | — | `BUSINESS_AUTHORITY_REQUIRED`, `EVIDENCE_MISSING` |
| 4 | Đóng khung quyết định | `objective`, `decisionId`, `constraints`, `tradeoffAxes` | phần requirements của `request/request.json` | — | `CONSTRAINT_CONTRADICTION` |
| 5 | Sinh các phương án | `alternatives` | `response/data/current-state.json`, @knowledge/patterns, @tools/websearch | `response/artifacts/<decisionId>-alternatives.html` chỉ khi được yêu cầu nhiều hơn một phương án, @tools/visualize | `NO_VIABLE_ALTERNATIVE` |
| 6 | Chọn | `selectionPolicy`, `tradeoffAxes`, `approval` | `response/artifacts/<decisionId>-alternatives.html` khi có | — | `CHOICE_REQUIRED` |
| 7 | Đào sâu phương án đã chọn và khai các operation nó cam kết | `constraints` | `response/data/current-state.json`, ma trận phủ của head nghiệp vụ đã ràng cho các dimension mỗi operation trích dẫn | `response/data/stack-model.json`, gồm cả `operations` của nó | `DATA_OWNERSHIP_UNASSIGNED`, `COMPATIBILITY_UNVERIFIED` |
| 8 | Chờ phản biện: tạm ngưng, một agent mới tấn công lựa chọn, chạy tiếp khi nó trả lời | — | `critique/response/critique.md` khi cuộc trao đổi done | `response/response.json` (waiting, awaiting critique) | `CRITIQUE_UNRESOLVED` |
| 9 | Xác nhận hoặc trả lại lựa chọn | `selectionPolicy` | `critique/response/critique.md`, `response/data/stack-model.json` | — | `CHOICE_REQUIRED`, `NO_VIABLE_ALTERNATIVE` |
| 10 | Viết handoff và phát | — | mọi thứ ở trên | `response/response.md`, `response/response.json` | — |

Với mặc định, bước 5 sinh một thiết kế và không có trang so sánh, bước 6 không có gì để chọn, và
chất lượng quyết định dựa vào bước 8. Khi phương án duy nhất chết dưới một đòn tấn công, bước 9 dừng
với `NO_VIABLE_ALTERNATIVE`, không phải `CHOICE_REQUIRED`. Handoff nêu tên contract, không bao giờ
nêu file implementation, vì chọn file là việc của domain kế tiếp; ngoại lệ duy nhất là writer của mỗi
operation đã khai, cái mà operator này có gọi tên, bởi phần hiện thực không được tự chọn writer cho
mình.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `architecture-decision` | `response/response.md` | md | có |
| `current-state` | `response/data/current-state.json` | data | có |
| `stack-model` | `response/data/stack-model.json` | data | có |
| `alternatives` | `response/artifacts/<decisionId>-alternatives.html` | artifact | không |
| `independent-critique` | `critique/response/critique.md` | md | có |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `EVIDENCE_MISSING` | terminate |
| `CURRENT_STATE_UNOBSERVED` | terminate |
| `BUSINESS_AUTHORITY_REQUIRED` | terminate |
| `CONSTRAINT_CONTRADICTION` | terminate |
| `NO_VIABLE_ALTERNATIVE` | terminate |
| `CHOICE_REQUIRED` | fallback |
| `COMPATIBILITY_UNVERIFIED` | fallback |
| `DATA_OWNERSHIP_UNASSIGNED` | terminate |
| `CRITIQUE_UNRESOLVED` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| lời hứa nghiệp vụ phải được mô hình lại theo các boundary đã quyết | `business.decide` |
| quyết định đã xác nhận và một contract backend thay đổi | `backend.source.apply` |
| quyết định đã xác nhận và một bề mặt frontend thay đổi | `frontend.direction.decide` |
