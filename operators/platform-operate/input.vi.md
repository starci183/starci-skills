# Input cho `platform.operate`

Input có hai phần đóng: `context` khai đúng phần vật liệu sẵn có mà operator được đọc, và `input`
khai đúng một dịch vụ cần vận hành cùng ranh giới nó được thay đổi. Trường không khai báo là không
hợp lệ.

## Vỏ ngoài

- `schemaVersion`: đúng bằng `8`.
- `operatorId`: đúng bằng `platform.operate`.
- `context`: các binding thẩm quyền và bằng chứng, mô tả trong `context.vi.md`.
- `input`: đúng một lần vận hành dịch vụ đã đóng băng.

## Các binding context

`context.knowledge` bind platform index cùng mỗi loại dịch vụ một record, mỗi loại nhiều nhất một
lần. Record của loại được yêu cầu phải có mặt; vận hành một dịch vụ Sonar mà không có record Sonar là
vận hành khi chưa có luật nào được publish.

`context.authority` bind phê duyệt, plan hash đã duyệt, các lớp effect được phép, và bằng chứng của
nó. `context.capabilities` bind mỗi credential mà loại đó cần một handle mờ. `context.inventory` bind
hiện trạng của dịch vụ. `context.sourceRefs` phải chứa workspace source đã route, với `sourceHead`
bằng đúng `input.project.sourceHead`. `context.auditRefs` là bằng chứng và được phép rỗng.

## Một việc, ba nhánh

`input.service.kind` chọn nhánh: `observability`, `sonar` hoặc `tunnel`. Đây là ba nhánh của cùng một
việc, không phải ba operator. Nhánh quyết định ba tập đóng, và cả ba đều được kiểm tra:

| Nhánh | Effect | Chứng minh bắt buộc | Capability |
| --- | --- | --- | --- |
| `observability` | config, restart dịch vụ, dashboard, remote-write | sức khoẻ, biên target và label, giao nhận, thứ tự mẫu, retry, lọc dữ liệu nhạy cảm | `metrics:remote-write` |
| `sonar` | project, profile, gate, enforcement | khả dụng, project, source revision, profile, gate, enforcement | `sonar:project-admin` |
| `tunnel` | tunnel, route, DNS proxied | đích DNS, tuyến tunnel, TLS, HTTPS công khai | `tunnel:write`, `dns:write` |

Một effect hay một check bị xếp nhầm nhánh là input không hợp lệ chứ không phải cảnh báo, vì effect
xếp nhầm chính là đường để một thay đổi chưa duyệt có được vẻ ngoài của thẩm quyền.

## Trạng thái mong muốn

`input.desiredState` ràng plan hash, các resource cần hội tụ, các effect cần áp, và phần chứng minh
mà lần vận hành phải tạo ra. Ba luật bao quanh nó:

1. `planSha256` phải bằng đúng `context.authority.planSha256` đã duyệt.
2. Mọi effect phải thuộc nhánh và phải nằm trong tập effect đã duyệt.
3. `requiredCheckNames` phải là trọn bộ chứng minh của nhánh. Người gọi không được xin ít hơn; một
   dashboard xanh chưa bao giờ chứng minh được giao nhận, thứ tự hay việc che dữ liệu.

Mọi resource được gọi tên đều phải đã có trong inventory, dưới cùng loại dịch vụ, và nằm trong
`input.scope.mutableResourceRefs`.

## Cổng

`input.portClaims` nêu desired state cần những cổng nào và cần cho resource nào. Một claim chỉ được
gọi tên resource mà lần vận hành này sở hữu. Cổng đó có rảnh hay không thì không quyết ở đây:
inventory ghi ai đang giữ nó, còn phần thực thi mới quyết điều đó nghĩa là gì.

## Phạm vi

`input.scope` chia đôi resource được thay đổi và resource chỉ được quan sát. Hai tập rời nhau, dịch
vụ đang vận hành nằm trong tập được sửa, và mọi resource mong muốn cũng vậy. Một dịch vụ product tình
cờ có mặt trong inventory thì thuộc về tập chỉ quan sát.

## Resume

`resume` là `null` cho lần gọi mới. Lần gọi resume cung cấp đúng receipt đã blocked, token dùng một
lần của nó, và những tham chiếu được thêm vào từ lúc đó. Project, source head, dịch vụ, plan hash và
phạm vi phải bằng đúng receipt đã blocked. Một resume không thêm delta nào về thẩm quyền, inventory,
desired state hay phạm vi là không hợp lệ, dưới mã `NO_PROGRESS`.
