# Input cho `fe.surface.audit`

Input có hai phần đóng: `context` khai đúng phần vật liệu sẵn có mà operator được đọc, và `input` khai
bề mặt cần quan sát cùng những điều kiện để quan sát nó. Trường không khai báo là không hợp lệ.

## Vỏ ngoài

- `schemaVersion`: đúng bằng `8`.
- `operatorId`: đúng bằng `fe.surface.audit`.
- `context`: các binding thẩm quyền và bằng chứng, mô tả trong `context.vi.md`.
- `input`: đúng một lần quan sát bề mặt đã đóng băng.

## Các binding context

`context.knowledge` và `context.applied` luôn bắt buộc. `context.sourceRefs` phải chứa frontend source
đã route, và `sourceHead` của nó phải bằng đúng `input.project.sourceHead`.

`context.knowledge.topics` bind mỗi họ rule một mục, kèm tham chiếu, fingerprint, tiền tố rule, và
danh sách đầy đủ những mã nó publish. Một topic xuất hiện nhiều nhất một lần, một tiền tố thuộc về một
topic, và mọi mã đều mang tiền tố của topic đã publish nó.

`context.applied` ràng application receipt: tham chiếu, fingerprint, head mà source đã được ghi vào,
chế độ phát contract, và mỗi node có khai một mục claim. `appliedSourceHead` phải bằng đúng
`input.project.sourceHead`, vì một bề mặt quan sát ở head khác không phải là bề mặt đã được ghi.

`context.auditRefs` là bằng chứng và được phép rỗng.

## Lời khai được phép nêu bất cứ gì

Một mục claim liệt kê các chuỗi mã, không phải các mã rule đã được kiểm. Điều này là cố ý: một mã mà
knowledge đã bind không publish chính là một trong ba loại finding mà lần audit này sinh ra để tìm,
nên từ chối nó ngay ở biên input sẽ giấu đi đúng cái lỗi đang bị săn.

Audit tra từng mã được khai ngược lại danh sách đã bind và báo cáo những mã tra ra không có gì.

## Ranh giới quan sát

- `input.project` ràng frontend source đã xác minh và write root cho receipt cùng các ảnh chụp của nó.
- `input.target` xác định đúng một page, layout, modal, drawer, flow, block hoặc component, và owner
  của nó phải nằm trong `input.scope.observedOwnerRefs`.
- `input.runtime` ràng endpoint phục vụ bề mặt, đúng đường route, và mức độ phải được phục vụ xong
  trước khi một ảnh chụp được tính là sẵn sàng.
- `input.matrix` khai mọi viewport, color scheme và trạng thái cần chụp. Mỗi mục có id riêng, và không
  hai mục nào mô tả cùng một điều kiện: hai id cho một điều kiện sẽ khiến một ảnh chụp đứng thay cho
  hai.
- `input.scope.observedOwnerRefs` liệt kê mọi owner có node được phép đo. Không có tập được sửa, vì
  operator này hoàn toàn không ghi product source.

## Sẵn sàng

`readinessProbe` quyết định khi nào được chụp. `route-served` chờ route render xong.
`route-and-data-served` chờ thêm cả dữ liệu mà bề mặt phụ thuộc, và đó là lựa chọn đúng mỗi khi một
giá trị đo được sẽ bị lấy từ skeleton nếu không chờ.

Một ảnh chụp lấy trước lúc sẵn sàng là đo nhầm bề mặt, nên mức sẵn sàng được khai ra chứ không được
mặc định.

## Input khi resume

`resume` là `null` với một lần gọi mới. Lần gọi tiếp nối cung cấp đúng receipt đã blocked, token dùng
một lần của nó, và những tham chiếu được thêm vào từ lúc đó.

Project, source head, target và fingerprint của application receipt phải bằng đúng receipt đã blocked.
Một resume không thêm được delta nào về knowledge, applied source, matrix hay runtime thì không hợp lệ
và trả `NO_PROGRESS`. Knowledge publish lại phải đến dưới dạng fingerprint mới của topic: cùng một
fingerprint không thể cho ra một phán quyết khác.
