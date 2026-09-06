# Tương tác

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

Sources: [Bằng chứng tương tác](../tests/evidence/20260904-interaction.md).

## Danh tính lời nói lại

Lựa chọn lời nói lại thuộc operator, phiên bản mục tiêu đã xác nhận và đúng nội dung đã hiển thị.
Sau khi ghi `response/restatement.md`, chạy `node scripts/restatement-choice.mjs <branch>` để suy id;
interaction bị chặn dùng đúng id đó. Digest chỉ chuẩn hóa xuống dòng. Ghi câu trả lời thật qua
`node scripts/restatement-choice.mjs answer <blocked-branch> <actual-answer.json>`; lệnh kiểm receipt bị chặn đã chấp nhận cùng inventory evidence trước khi
lưu đáp án. Request vào lại gọi nhánh bị chặn và lựa chọn của nó; không dùng lời đọc của phiên bản
mục tiêu khác. Lựa chọn và receipt trước giữ nguyên. Context invocation giữ lựa chọn tại lúc mở,
vì vậy câu hỏi lịch sử đã được trả lời không bị hiểu là yêu cầu hỏi lại.
