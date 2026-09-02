# Input cho `fe.presentation.resolve`

Input có hai phần đóng: `context` khai đúng phần vật liệu sẵn có mà operator được đọc, và `input`
khai cây cần giải quyết cùng ranh giới nó được ghi. Trường không khai báo là không hợp lệ.

## Vỏ ngoài

- `schemaVersion`: đúng bằng `8`.
- `operatorId`: đúng bằng `fe.presentation.resolve`.
- `context`: các binding thẩm quyền và bằng chứng, mô tả trong `context.vi.md`.
- `input`: đúng một lần giải quyết presentation đã đóng băng.

## Các binding context

`context.knowledge` và `context.grammar` luôn bắt buộc. `context.sourceRefs` phải chứa frontend source
đã route, và `sourceHead` của nó phải bằng đúng `input.project.sourceHead`.

`context.knowledge.topics` bind mỗi thuộc tính presentation một mục, kèm tham chiếu, fingerprint, và
danh sách đầy đủ những mã nó publish. Một topic xuất hiện nhiều nhất một lần. Một mã xuất hiện dưới
đúng một topic và phải mang tiền tố của topic đó.

`context.grammar.ownedRelationships` nêu từng component đã sở hữu thuộc tính nào, và rule mà quyền sở
hữu đó thoả. Mọi mã ở đó đều phải có trong danh sách của knowledge.

`context.directionRefs` và `context.auditRefs` là bằng chứng và được phép rỗng.

## Ranh giới giải quyết

- `input.project` ràng frontend source đã xác minh và write root duy nhất cho artifact.
- `input.target` xác định đúng một page, layout, modal, drawer, flow, block hoặc component.
- `input.tree` ràng cây đã dựng bằng tham chiếu, fingerprint, định dạng và số node. Cây là đối tượng
  của lần gọi và không bao giờ bị dựng lại cấu trúc.
- `input.scope` chia đôi owner được sửa và owner chỉ quan sát. Hai tập rời nhau, và owner của target
  nằm trong tập được sửa.

## Nơi phát contract

`input.contractEmission` chọn nơi công bố các lời khai.

- `attribute` ghi `data-contract` lên từng node do ứng dụng sở hữu trong cây kết quả, dưới dạng danh
  sách token cách nhau bằng khoảng trắng, đồng thời vẫn ghi mọi lời khai vào receipt.
- `receipt-only` không ghi thuộc tính nào. Chỉ receipt mang các lời khai, và đó là lựa chọn đúng khi
  cây kết quả là một artifact production.

Cả hai chế độ đều sinh ra cùng bộ lời khai. Chế độ chỉ đổi nơi người audit đọc chúng, không bao giờ
đổi việc chúng có tồn tại hay không.

## Input khi resume

`resume` là `null` với một lần gọi mới. Lần gọi tiếp nối cung cấp đúng receipt đã blocked, token dùng
một lần của nó, và những tham chiếu được thêm vào từ lúc đó.

Project, source head, target, fingerprint của cây, và trần owner phải bằng đúng receipt đã blocked.
Một resume không thêm được delta nào về knowledge, Grammar, cây hay scope thì không hợp lệ và trả
`NO_PROGRESS`. Knowledge publish lại phải đến dưới dạng fingerprint mới của topic: cùng một
fingerprint không thể cho ra một đáp án khác.
