# Input cho `quality.verify`

Input có hai phần đóng: `context` khai đúng phần vật liệu sẵn có mà operator được đọc, và `input` khai
bản giao cần thẩm định cùng kế hoạch gate nó phải chạy. Trường không khai báo là không hợp lệ.

## Vỏ ngoài

- `schemaVersion`: đúng bằng `8`.
- `operatorId`: đúng bằng `quality.verify`.
- `context`: các binding tiền nhiệm và bằng chứng, mô tả trong `context.vi.md`.
- `input`: đúng một lần thẩm định đã đóng băng.

## Các binding context

`context.predecessors` mang ít nhất một receipt thượng nguồn kèm tham chiếu, loại, fingerprint và head
đã quan sát. Mọi head phải bằng nhau và bằng `input.project.sourceHead`; bất đồng là tiền nhiệm trộn
lẫn và bị từ chối trước khi có gate nào chạy.

`context.gateConfigRefs` ràng danh tính cấu hình đã ghim. `context.sourceRefs` phải chứa source đã
route, và `sourceHead` của nó phải bằng `input.project.sourceHead`. `context.knowledgeRefs` và
`context.approvalRefs` là bằng chứng và được phép rỗng.

## Kế hoạch gate

`input.gates` liệt kê các gate phải chạy, mỗi cái một lần, trong số `format`, `lint`, `typecheck`,
`build`, `unit-coverage`, `integration`, `e2e` và `sonar`. Mỗi mục nêu `commandRef` đã ghim, `configRef`
của nó, và nó có `required` hay không.

Hai quy tắc của kế hoạch được cưỡng chế ngay ở tầng hợp lệ của input:

1. hoạch định `e2e` trong khi `input.explicitE2eRequest` là `false` là không hợp lệ, vì bộ end-to-end
   chỉ chạy khi người gọi yêu cầu trong chính lần gọi này;
2. hoạch định `sonar` trong khi `input.sonarScope` là `not-planned`, hoặc bỏ `sonar` trong khi phạm vi
   đã được đặt, là tự mâu thuẫn. Phạm vi có ý nghĩa vì một cổng `new-code` không nói gì về dự án nằm
   bên dưới nó, và receipt buộc phải ghi lại cái nào trong hai cái đã được đo.

## Ngưỡng độ phủ

`input.thresholds` phát biểu phần trăm câu lệnh, dòng, hàm và nhánh mà cổng unit phải đạt. Nhánh mang
ngưỡng riêng chứ không thừa hưởng con số của câu lệnh, vì gộp ngưỡng nhánh vào những cái kia chính là
cách một đường lỗi chưa được test đi lọt.

## Nợ đã khai

`input.declaredDebts` được phép rỗng. Mỗi bản ghi nêu mã của nó, gate nó phủ, tham chiếu phê duyệt, chủ
sở hữu và hạn, và hạn phải muộn hơn `input.observedAt`. Một phê duyệt đã hết hạn thì không phải nợ.

Một bản giao `frontend` không được khai khoản nợ nào. Một nhiệm vụ frontend khi tới được chất lượng thì
đã là chỉ thẩm định, nên một khoản nợ ghi ở đây sẽ là một quyết định sửa chữa đặt sai chỗ.

## Input khi resume

`resume` là `null` với một lần gọi mới. Lần gọi tiếp nối cung cấp đúng receipt đã blocked, token dùng
một lần của nó, và những tham chiếu được thêm vào từ lúc đó.

Project, source head, bản giao và kế hoạch gate phải bằng đúng receipt đã blocked. Một resume không
thêm được delta nào về tiền nhiệm, gate, nợ hay source thì không hợp lệ và trả `NO_PROGRESS`. Một bản
giao đã sửa sẽ đến dưới dạng source head mới và fingerprint tiền nhiệm mới; cùng một fingerprint không
thể cho ra một đáp án khác.
