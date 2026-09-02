# Context cho `content.generate`

## Mục đích

Context là đúng phần vật liệu đã có sẵn để dựng một đơn vị nội dung giáo dục. Nó trả lời câu "operator
này được đọc những gì?" trước khi brief được viết. Context không bao giờ nới rộng phạm vi nhiệm vụ và
không bao giờ biến bằng chứng thành thẩm quyền.

Mọi tham chiếu đều bất biến trong suốt lần gọi và bị ràng bằng fingerprint `sha256:`. Những quan sát
dựa trên source thì ràng thêm cả source head đã quan sát được.

## Các lớp context

| Context | Vai trò trong quyết định | Tư cách thẩm quyền |
| --- | --- | --- |
| Curriculum | Mục tiêu mà đơn vị này phục vụ, vị trí của nó trong khoá, và những tiền đề khoá học đã bảo đảm. | Luật tái dùng bắt buộc. |
| Style | Luật ngôn ngữ, thuật ngữ và biên tập mà các bản viết phải theo. | Luật tái dùng khi được bind. |
| Content source | Checkout đã route và head của nó, gồm cả đơn vị đang được refactor. | Bằng chứng rằng công việc thuộc về source đã đóng băng. |
| AI runtime | Model, số lần chạy và mức cô lập mà cấu hình workspace ấn định cho brief và cho phần phê bình. | Bắt buộc. Quyết định ai được viết và ai được phán. |
| Audit trước đó | Những lần review trước của cùng đơn vị. | Bằng chứng và lịch sử hồi quy. |

## Context bắt buộc

Mỗi lần gọi đều cần:

1. ít nhất một tham chiếu curriculum;
2. tham chiếu content source đã route, với head bằng đúng `input.project.sourceHead`;
3. binding AI runtime, có fingerprint đối chiếu với cấu hình workspace.

Tham chiếu style và audit là bằng chứng và được phép rỗng.

## Ref

Mọi nơi operator này được đọc, theo alias. `refs.json` ở gốc `.claude` phân giải từng alias; nơi nào
không có trong bảng thì operator này không được đọc, và `@artifacts` là nơi duy nhất nó ghi.

| Alias | Trỏ tới | Bind | Bắt buộc |
| --- | --- | --- | --- |
| `@content/<contentId>/<locale>` | MinIO object contents/<contentId>/<locale>.json through the routed runtime | fingerprint of the fetched object | Bắt buộc: The lesson as served; the unit being authored or revised. |
| `@runtime` | <Source>/.worktrees/sessions/central-runtime/owner.json | fingerprint + generation | Bắt buộc: The AI runtime that runs, reads, and repairs generated code. |
| `@receipt/content-generation-receipt/<invocationId>` | <@artifacts of invocation <invocationId>>/<receiptType>.json (the receipt file that invocation registered in output.artifactRefs) | fingerprint + the sourceHead the receipt binds | Tuỳ chọn: A prior audit of the same unit; regression history. |
| `@artifacts` | input.project.artifactRootRef; convention <Source>/.worktrees/sessions/<invocationId>/artifacts/ | fingerprint per artifact; every artifact an operator writes is registered in output.artifactRefs | Bắt buộc: Where the brief, articles, code tracks, images, review, and receipt are written. |

## Binding runtime là ranh giới, không phải sở thích

`context.aiRuntime` chép lại đúng thứ mà cấu hình workspace đã ấn định: brief của người dạy và phần
phê bình cuối, mỗi phần chạy đúng một execution mới tinh không thừa kế lượt nào, còn phần sản xuất
chạy trên model viết. Đây là hằng số trong contract, không phải trường để chỉnh theo từng lần gọi.

Chính điều đó khiến bước cuối mới thật sự là một lần review. Một phê bình thừa kế lại cuộc hội thoại
sản xuất thì đã đồng ý với nó từ trước khi đọc bất cứ thứ gì, và một đơn vị qua được lần review của
chính tác giả nó thì chưa hề được review.

## Brief sở hữu những gì

Brief của người dạy được viết đầu tiên và mọi thứ sau đó đều bị đo theo nó. Brief publish các learning
outcome, những claim mà một hình ảnh được phép mã hoá, các ví dụ, và các quyết định thêm, sửa, bỏ.
Không khâu nào phía sau được đưa thêm một outcome hay một claim mà brief chưa publish, nên phần
context lẽ ra thuộc về brief thì không thể lẻn vào trong lúc viết.

## Ranh giới

Context chỉ để đọc. Operator ghi brief, các bản viết, hình ảnh cùng prompt của nó, các track hiện
thực, và phần phê bình dưới các target đã khai, và chỉ chạy đúng những lệnh build và kiểm tra thực thi
đã khai. Nó không sửa curriculum, không tự duyệt việc của mình, không publish đơn vị, và không claim
bất kỳ mức sẵn sàng nào vượt quá những kiểm tra nó thật sự đã chạy.

## Tài nguyên

Operator này chạy trọn trên profile `luna` (`gpt-5.6-luna`, runtime `openai`), khai dưới `resources` trong `operator.json` và được `scripts/validate-resources.mjs` kiểm. Quyền nó cần: tìm trên mạng, sinh hình, ghi source. Nó được tìm trên mạng trong giới hạn đúng khoảng trống phải lấp, có ghi lại, không ràng với Grammar, và bắt buộc sinh hình theo tuyên bố đã nêu. Một quyền không nằm trong `requires` thì không dùng được dù profile có cho phép.
