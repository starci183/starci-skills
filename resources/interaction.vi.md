# Tương tác

Với tạo mới/thiết kế lại frontend, `interface.draw` theo `artDirection`: mặc định một PNG theo concept, hiển thị inline trước code rồi tiếp tục, không hỏi chọn. Chỉ yêu cầu so sánh rõ của người dùng mới mở hai hoặc ba PNG và lựa chọn thật. Brief nghiệp vụ, Grammar và imagery plan từng region đã đóng băng đi cùng prompt và PNG đã chốt. `node scripts/art-direction.mjs present <branch>` xuất sheet ảnh native; hiển thị nguyên bản rồi dùng `shown` giữ nguồn message thật. Lượt so sánh dùng `answer` cho lựa chọn thật của người dùng. PNG không chứng minh hành vi source hay UAT; kỹ thuật xanh chưa đủ kết luận bề mặt triển khai đã đạt hình ảnh.

[interaction.json](interaction.json) sở hữu chính sách giao tiếp. Entry đọc trước khi điều phối.
Cột Ask của operator, `asks` trong workflow, thiếu mặc định và tên route xác định input hoặc owner;
tự chúng không cho phép hỏi hay thực hiện một thao tác.

Câu hỏi dự kiến được ghi thành `response.json.interaction`: `kind`, `decisionId` ổn định và các
phương án có `id`, `label`, `tradeoff` khác nhau. Phương án giao diện vẫn giữ bằng chứng render hiện
có. Gate response kiểm bản ghi trước khi gửi câu hỏi. Văn xuôi `reason` cũ là bằng chứng chẩn đoán,
không tự động trở thành câu hỏi đem chuyển cho người dùng.

Ghi câu trả lời thật vào `state.json.choices[decisionId]` gồm `selected`, `selectedBy`, `sourceRef`
trỏ tới tin nhắn người dùng. Request tiếp tục mang `decisionId`, `selectedOption`; gate đối chiếu
với bản ghi đó. Đề xuất của agent không phải lựa chọn của người dùng. Không tạo id mới chỉ để hỏi
lại cùng một điều. Mỗi phiên bản nhiệm vụ v2.2 có đúng một bản ghi xác nhận; prompt đã nêu rõ và
cấp quyền có thể chính là bản ghi đó.

`scripts/session-open.mjs` mở hoặc dùng lại phiên người dùng ngay từ prompt đầu, trước xác nhận và
trước mọi công việc operator. Hiển thị draft theo `interaction.json#scopePresentation`, bằng
`node scripts/session-open.mjs preview <session>`. Câu trả lời được ghi ở
`state.json.choices["goal:<sessionId>:v<version>"]` và bind lại trong `mission.confirmation`.
Khi prompt mở đầu đã nêu và cấp quyền đúng scope đó, tham chiếu tới chính prompt được dùng làm
`as-stated`; không hỏi xác nhận thường lệ lần hai. Sửa scope tạo phiên bản draft kế tiếp. Từ chối
hoặc chưa trả lời giữ lifecycle `draft`, nên không thể dispatch. Follow-up và replan trong goal đã
xác nhận dùng lại cùng host binding và không hỏi lại.

Sau mỗi chuyển bước giữ bản ghi máy theo `interaction.json#transitionLog` trong ledger session. Hai dòng dày này chỉ dùng nội bộ, không in trùng vào chat; validator hiện có vẫn kiểm bản ghi.

Phần hiển thị theo `interaction.json#outcomePresentation`: **Operator Result**, bảng gọn Step/Status/Result/Next, ảnh được nhúng trực tiếp, chi tiết ngắn, rồi link ảnh gốc và artifact đầy đủ. Với receipt done đã nghiệm thu, chạy `scripts/render-outcome.mjs <branch>` sau các gate hiện có và hiển thị Markdown/media. Chỉ ghi `logged: true` sau khi đã hiện khối kết quả và giữ bản ghi nội bộ. Nghiệm thu lượt kiểm không đồng nghĩa đối tượng đã đạt; giữ finding, mode, giới hạn và bước tiếp đúng thực tế. Attempt blocked, waiting hay mismatch hiện đúng trạng thái, không nhận là đã nghiệm thu hoàn tất.

Gate độc lập `scripts/validate-interaction.mjs <branch>` và gate response chung kiểm câu hỏi dự kiến.
Các gate này chỉ kiểm giao tiếp; qua gate không cấp quyền thực hiện thao tác nào.

Các ví dụ là định hướng, không ép một định dạng cho mọi việc. Đọc contract và mode của operator: hiện expected so với actual, coverage và bước tiếp cạnh kết quả được chọn. Kết quả được chọn giúp đánh giá kết quả, kể cả lỗi quan trọng. Operator kiểm xong vẫn có thể kết luận đối tượng bị kiểm không đạt. Dry-run là đề xuất; reuse/no-op là trạng thái không đổi đã quan sát; rollback là khôi phục. Tổng quan kết quả phải hiện đủ dù chỉ nhúng một artifact đại diện.

Sources: [Bằng chứng tương tác](../tests/evidence/20260904-interaction.md), [Review diễn giải được ủy quyền](../tests/evidence/20260907-delegated-restatement-review.md).

## Danh tính lời nói lại

Lựa chọn lời nói lại thuộc operator, phiên bản mục tiêu đã xác nhận và đúng nội dung đã hiển thị.
Sau khi ghi `response/restatement.md`, chạy `node scripts/restatement-choice.mjs <branch>` để suy id;
interaction bị chặn dùng đúng id đó. Digest chỉ chuẩn hóa xuống dòng. Ghi câu trả lời thật qua
`node scripts/restatement-choice.mjs answer <blocked-branch> <actual-answer.json>`; lệnh kiểm receipt bị chặn đã chấp nhận cùng inventory evidence trước khi
lưu đáp án. Request vào lại gọi nhánh bị chặn và lựa chọn của nó; không dùng lời đọc của phiên bản
mục tiêu khác. Lựa chọn và receipt trước giữ nguyên. Context invocation giữ lựa chọn tại lúc mở,
vì vậy câu hỏi lịch sử đã được trả lời không bị hiểu là yêu cầu hỏi lại.

Người dùng có thể uỷ quyền rõ ràng cho coordinator có danh tính để review bản đọc không đổi trong
scope. Ghi grant bằng `node scripts/restatement-choice.mjs delegate <session> <grant.json>`, theo
[restatement-delegation.schema.json](../templates/kinds/restatement-delegation.schema.json):
lời uỷ quyền thật và nguồn, đúng session tiêu thụ cùng hash/phiên bản scope đã xác nhận,
danh tính session coordinator và các operator restatement được phép. Chỉ duyệt scope hay có vai trò
agent không phải grant; bên tiêu thụ không tự cấp quyền cho mình. Session coordinated còn draft
có thể định danh reviewer khi chính grant thật của người cung cấp quyền review này.

Coordinator đối chiếu từng dòng đã hiện với điều khoản đã hash của scope được duyệt, ghi đủ mọi
loại trừ và không có tác động mới đáng kể, bằng
`node scripts/restatement-choice.mjs delegated-review <blocked-branch> <review.json>`, theo
[restatement-delegated-review.schema.json](../templates/kinds/restatement-delegated-review.schema.json).
Bản review gắn grant id, đúng bytes request và lời đọc đã niêm phong, hash/phiên bản mission và
danh tính reviewer. Lựa chọn ghi `selectedBy: coordinator`, nguồn review và căn cứ được giữ;
đây là quyết định kỹ thuật `as-stated`, không được gọi là đáp án của người cho bản đọc ấy.
Tương đương giữa dòng và scope là nhận định có trách nhiệm của reviewer, không phải ngữ nghĩa được
hash chứng minh. Thay đổi đáng kể chưa được trả lời vẫn hỏi người. Đường này không đổi goal,
tác động, ownership, tầng kiểm chứng hay budget. Lệnh `answer` vẫn chỉ nhận đáp án thật của người.

Request resume bình thường tiêu thụ quyết định được giữ. Admission mới kiểm lại grant hiện hành
và danh tính reviewer; lịch sử đã chấp nhận giữ thẩm quyền lúc mở cùng evidence niêm phong, kể cả
sau khi sửa scope. Quyết định scope cũ không cấp quyền cho công việc mới hiện hành.
