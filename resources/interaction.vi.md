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
trước mọi công việc operator. Draft được trình bày bằng bảng gồm Goal, Target, Trong scope, Ngoài
scope, Đầu ra, Đạt khi, Phạm vi kiểm và Ví dụ. Câu trả lời được ghi ở
`state.json.choices["goal:<sessionId>:v<version>"]` và bind lại trong `mission.confirmation`.
Khi prompt mở đầu đã nêu và cấp quyền đúng scope đó, tham chiếu tới chính prompt được dùng làm
`as-stated`; không hỏi xác nhận thường lệ lần hai. Sửa scope tạo phiên bản draft kế tiếp. Từ chối
hoặc chưa trả lời giữ lifecycle `draft`, nên không thể dispatch. Follow-up và replan trong goal đã
xác nhận dùng lại cùng host binding và không hỏi lại.

Sau mỗi chuyển bước của một nhiệm vụ, orchestrator in vào chat gốc bản ghi hai dòng mà
`interaction.json#transitionLog` khai — mục tiêu của nhánh, rồi kết quả kèm số dòng "xong khi" đã có
bằng chứng, đường dẫn artifact và ô kế tiếp — và ghi `logged: true` lên chuyển bước, điều mà
`scripts/validate-session.mjs` bắt buộc trên mọi chuyển bước của phiên có mission.
`scripts/validate-interaction.mjs#transitionLogErrors` đối chiếu một cặp dòng đã in với dạng đã khai,
biên dịch từ chính sách chứ không chép lại.

Với kết quả v2.2 done đã được nghiệm thu, chạy thêm `scripts/render-outcome.mjs <branch>` và hiển thị
Markdown cùng media trả về ngay trong chat gốc dưới **The best outcome**, rồi mới đánh dấu đã log.
`response.json.outcome` chỉ rõ kết quả được chọn để người dùng xem cùng bằng chứng; gate chung và
[bảng định dạng theo operator](outcomes.json) kiểm nó trước acceptance. UI generation phải hiện hình
render thật của phương án được chọn. Code, plan và kiểm thử hiện source/diff, sơ đồ/bảng/tài liệu hoặc
kết quả đo phù hợp với operator, kèm link tới bằng chứng đầy đủ. Không thay phần hiển thị bằng một tên
file, JSON thô hoặc câu “đã tạo file”. Attempt lỗi, waiting hay mismatch giữ đúng trạng thái và bước
sửa tiếp; không trình bày thành best outcome đã thành công. Output đầy đủ và lần chạy trước vẫn ở
trong thư mục session.

Gate độc lập `scripts/validate-interaction.mjs <branch>` và gate response chung kiểm câu hỏi dự kiến.
Các gate này chỉ kiểm giao tiếp; qua gate không cấp quyền thực hiện thao tác nào.

Các ví dụ là định hướng, không ép một định dạng cho mọi việc. Đọc contract và mode của operator: hiện expected so với actual, coverage và bước tiếp cạnh kết quả được chọn. “Best” là phần hữu ích nhất để đánh giá kết quả, kể cả lỗi quan trọng. Operator kiểm xong vẫn có thể kết luận đối tượng bị kiểm không đạt. Dry-run là đề xuất; reuse/no-op là trạng thái không đổi đã quan sát; rollback là khôi phục. Tổng quan kết quả phải hiện đủ dù chỉ nhúng một artifact đại diện.

Sources: [Bằng chứng tương tác](../tests/evidence/20260904-interaction.md).
