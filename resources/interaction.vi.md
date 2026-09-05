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
lại cùng một điều. Nhiệm vụ không có lựa chọn khác biệt thì không cần bản ghi lựa chọn.

Câu hỏi `goal-confirm` được hỏi một lần, ở đầu nhiệm vụ sẽ ghi source đã route hay chạm tới một
runtime, và không bao giờ cho việc chỉ đọc: orchestrator in khối mà `state.json.mission` giữ — mục
tiêu, phần bao gồm và loại trừ, các dòng "xong khi", và dòng phạm vi
`scope: <n> journey units, <m> unchecked` một khi plan đã điền `mission.scope` — thành tối đa
năm dòng bằng ngôn ngữ của người kèm một câu hỏi, rồi ghi câu trả lời vào
`state.json.choices["goal:<sessionId>:v<version>"]`.
`corrected` viết phiên bản kế tiếp rồi hỏi lại; chỉ phiên bản mới nhất được chọn `as-stated` mới cho
phép chạy bất cứ gì (`scripts/validate-request.mjs#missionGateErrors`, `scripts/validate-session.mjs`).
Nhiệm vụ có ghi hay chạm runtime hay không được đọc từ các tool mà operator của nó khai, không bao
giờ từ một danh sách id operator.

Sau mỗi chuyển bước của một nhiệm vụ, orchestrator in vào chat gốc đúng hai dòng mà
`interaction.json#transitionLog` khai — mục tiêu của nhánh, rồi kết quả kèm số dòng "xong khi" đã có
bằng chứng, đường dẫn artifact và ô kế tiếp — và ghi `logged: true` lên chuyển bước, điều mà
`scripts/validate-session.mjs` bắt buộc trên mọi chuyển bước của phiên có mission.
`scripts/validate-interaction.mjs#transitionLogErrors` đối chiếu một cặp dòng đã in với dạng đã khai,
biên dịch từ chính sách chứ không chép lại. Output đầy đủ ở lại trong thư mục phiên; ai cần thì đọc
sổ.

Gate độc lập `scripts/validate-interaction.mjs <branch>` và gate response chung kiểm câu hỏi dự kiến.
Các gate này chỉ kiểm giao tiếp; qua gate không cấp quyền thực hiện thao tác nào.

Sources: [Bằng chứng tương tác](../tests/evidence/20260904-interaction.md).
