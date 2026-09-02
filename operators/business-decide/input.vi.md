# Input cho `business.decide`

Input có hai phần đóng: `context` khai báo đúng phần vật liệu sẵn có mà operator được đọc, và `input`
khai báo lời hứa cần quyết cùng ranh giới nó được phép ghi. Trường không khai báo là không hợp lệ.

## Vỏ bọc

- `schemaVersion`: đúng bằng `8`.
- `operatorId`: đúng bằng `business.decide`.
- `context`: các binding thẩm quyền và bằng chứng.
- `input`: đúng một quyết định nghiệp vụ đã đóng băng.

## Binding context

`context.evidence` ràng tập claim đã chuẩn hoá. Mỗi claim mang mã, loại, vai trò, phát biểu, tham chiếu
source, đường dẫn, khoảng dòng và head quan sát được. Một claim chỉ xuất hiện một lần, khoảng dòng chạy
xuôi, source của nó nằm trong `context.sourceRefs`, và claim loại `fact` phải ràng head.

`context.authority` ràng gốc businesses phẳng, fingerprint của nó, và mọi head đã publish cùng trạng
thái hiện tại. `context.sourceRefs` phải chứa backend source đã route, với `sourceHead` bằng đúng
`input.project.sourceHead`. `context.architectureRefs` là bằng chứng và có thể rỗng.

## Ranh giới quyết định

- `input.project` ràng backend source đã xác minh và gốc thẩm quyền duy nhất mà lần gọi này được ghi.
  `businessesRootRef` được chép từ `route.authorityRoots.businesses` trong receipt của `workspace.bind`;
  giá trị do bên gọi gõ tay không có thẩm quyền.
- `input.objective` nêu tham chiếu mục tiêu, đúng một `featureId`, và ý định: `create`, `revise`,
  `reconcile` hoặc `retire`.
- `input.publication` nêu trạng thái đích và tham chiếu head. Head phải đúng bằng
  `<businessesRootRef>/features/<featureId>`. `approvalRef` là phê duyệt của chủ sở hữu khi bước chuyển cần nó.

Ý định `retire` chỉ được nhắm tới `rejected`. Một publication `pending` bị từ chối khi đã tồn tại một
head sống ở bất kỳ trạng thái nào khác `rejected`, vì pending sẽ ghi đè lên thẩm quyền đã publish. Mọi
trạng thái đích khác đều cần một head sẵn có để chuyển đi từ đó.

## Discovery

`input.discovery` là bề mặt mà người gọi thật sự tìm thấy trong source đã route, và đó chính là lý do
operator này tồn tại.

- `consumers` liệt kê mọi consumer thực thi quan sát được: mã của nó, chiều coverage nó thuộc về, và
  source nó được quan sát trong đó. Mã là duy nhất và mỗi source đều phải được bind.
- `lifecycleBranches` liệt kê mọi nhánh vòng đời quan sát được trong source, như gia hạn, huỷ, hết hạn,
  phục hồi hay tất toán di sản.

Discovery đi vào quyết định như một nghĩa vụ, không phải một gợi ý. Một consumer khai ở đây bắt buộc
phải nhận một disposition trong ma trận được publish, và một nhánh vòng đời khai ở đây không bao giờ
được publish là không áp dụng.

## Input khi resume

`resume` là `null` với một lần gọi mới. Lần gọi resume cung cấp đúng receipt đã blocked, token dùng một
lần của nó, và những tham chiếu được bổ sung kể từ đó.

Project, source head, feature, mục tiêu và gốc thẩm quyền phải bằng đúng receipt đã blocked. Một resume
không bổ sung delta nào về bằng chứng, thẩm quyền, discovery hay phê duyệt là không hợp lệ dưới dạng
`NO_PROGRESS`. Bằng chứng publish lại phải đến dưới một fingerprint mới; cùng một fingerprint không thể
cho ra câu trả lời khác.
