# Input cho `architecture.decide`

Input có hai phần đóng: `context` khai báo đúng phần vật liệu sẵn có mà operator được đọc, và `input`
khai báo quyết định cần lấy cùng ranh giới nó được phép ghi. Trường không khai báo là không hợp lệ.

## Vỏ ngoài

- `schemaVersion`: đúng bằng `8`.
- `operatorId`: đúng bằng `architecture.decide`.
- `context`: các binding thẩm quyền và bằng chứng.
- `input`: đúng một quyết định kiến trúc đã đóng băng.

## Các binding context

`context.businessRefs` ràng lời hứa mà kiến trúc phục vụ và không được rỗng. `context.sourceRefs` phải
chứa source đã route, với `sourceHead` bằng đúng `input.project.sourceHead`.

`context.inventory` ràng stack quan sát được: tham chiếu, fingerprint, và mỗi thành phần một mục với
lớp, tên, phiên bản, cùng đúng file chứng thực cho nó. Mã thành phần là duy nhất, và mọi tham chiếu
bằng chứng đều phải là một trong các source đã bind.

`context.patternRefs` và `context.priorDecisionRefs` là bằng chứng và có thể rỗng.

## Ranh giới quyết định

- `input.project` ràng source đã xác minh và gốc ghi artifact duy nhất.
- `input.objective` nêu mục tiêu, đúng một `decisionId`, và `tradeoffAxes`: các trục liên ranh giới
  khiến quyết định này đáng lấy. Cần ít nhất một trục, và về sau mọi phương án đều được đánh giá trên
  tất cả các trục đó.

## Ràng buộc

`input.constraints` tách vật liệu theo loại:

- `fixed-intent` — điều quyết định bắt buộc phải đạt, không thương lượng;
- `measurable` — một ngưỡng, một con số hay một giới hạn đã phát biểu mà một phương án có thể trượt;
- `preference` — điều người ta muốn, và tự nó không bao giờ quyết định gì;
- `assumption` — được tin nhưng chưa đo, và được mang vào output như một điểm yếu đã biết;
- `unknown` — thiếu một cách công khai, và không bao giờ được lặng lẽ điền vào.

Cần ít nhất một `fixed-intent` và một `measurable`. Một sở thích xuất hiện trong bảng so sánh như thể
nó là một phép đo chính là thất bại mà sự tách bạch này tồn tại để chặn.

## Chính sách chọn

`input.selectionPolicy` là `approval-required` hoặc `automatic`.

`approval-required` nghĩa là thẩm quyền sản phẩm chọn. Lựa chọn đến trong `input.approval`, gọi tên
phương án đã duyệt và fingerprint của nó, và quyết định phải chọn đúng phương án ấy. Khi chưa có phê
duyệt nào được bind, lần gọi dừng với `APPROVAL_REQUIRED` thay vì tự chọn.

`automatic` nghĩa là chính input đã khai rằng operator được phép bind phương án còn sống sót. Vì vậy
chính sách automatic không mang phê duyệt; đưa cả hai vào sẽ che mất bên nào thật sự đã quyết.

## Input khi resume

`resume` là `null` với một lần gọi mới. Lần gọi resume cung cấp đúng receipt đã blocked, token dùng một
lần của nó, và những tham chiếu được bổ sung kể từ đó.

Project, source head, quyết định, mục tiêu và các trục đánh đổi phải bằng đúng receipt đã blocked. Một
resume không bổ sung delta nào về bằng chứng, ràng buộc, inventory hay phê duyệt là không hợp lệ dưới
dạng `NO_PROGRESS`. Một hệ thống được quan sát lại phải đến dưới fingerprint inventory hoặc source mới;
cùng một fingerprint không thể cho ra câu trả lời khác.
