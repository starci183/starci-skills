# Output của `platform.operate`

Operator trả về một vỏ đóng với `outcome` bằng `operated` hoặc `blocked`. Nó không bao giờ phát ra
handoff hay chỉ dẫn điều phối dạng văn xuôi tự do.

## Receipt khi đã vận hành

Một receipt `operated` chứa:

- các binding chính xác về project, source, dịch vụ, plan, knowledge, inventory, input và tiến độ;
- kết quả hội tụ, `converged` hoặc `already-converged`;
- những resource đã được kiểm kê trước khi bất cứ thứ gì thay đổi, và những tiến trình giữ cổng đã
  quan sát được;
- mỗi effect đã áp kèm resource nó chạm tới cùng revision trước và sau;
- trọn bộ chứng minh của nhánh, mọi check đều đạt, mỗi check có bằng chứng riêng;
- các finding cho việc kiểm kê, cho một no-op đã hội tụ sẵn, cho lần áp dở dang, và cho mọi yêu cầu
  deploy product bị từ chối.

Receipt chứng minh dịch vụ dùng chung đã tới trạng thái đã duyệt. Nó không chứng minh product nào đã
được release, khoẻ mạnh hay được nghiệm thu, và không mang phán quyết nào về hành vi của product.

## Hội tụ

`already-converged` nghĩa là dịch vụ vốn đã khớp plan đã duyệt. Đó là thành công, và nó không báo cáo
mutation nào. `converged` nghĩa là đã áp ít nhất một effect, nên một receipt `converged` mà không có
mutation nào sẽ bị từ chối: một trong hai lời khai đó là sai.

## Cổng

`operation.observedPortHolders` nhắc lại ai đang giữ từng cổng được claim tại thời điểm kiểm kê.
Không mutation nào được nhắm vào những tiến trình đó. Xung đột được báo cáo bằng finding
`PORT_COORDINATION_REQUIRED` gọi tên cả cổng lẫn người giữ, và nó chỉ xuất hiện trên receipt
`blocked` mang `PORT_CONFLICT`. Không có kết cục nào trong đó operator này đã đòi lại một cổng.

## Receipt khi bị chặn

Receipt `blocked` không có phần vận hành. Nó chứa đúng một failure có kiểu, các resource và tham
chiếu liên quan, domain sở hữu, tính retry được, và chỉ khi retry được mới có token resume dùng một
lần kèm phần vật liệu còn thiếu. Finding vẫn đi theo receipt bị chặn, và đó chính là cách một xung đột
cổng đến được tay hai chủ sở hữu phải ngồi lại với nhau.

## Mã lỗi

| Mã | Vấn đề sở hữu | Delta vật liệu hợp lệ |
| --- | --- | --- |
| `INVALID_INPUT` | Contract input đóng đã fail. | Input đã sửa. |
| `SOURCE_DRIFT` | Source quan sát được không còn khớp head đã đóng băng. | Binding source làm mới. |
| `AUTHORITY_DRIFT` | Phê duyệt hoặc plan hash không còn khớp delta yêu cầu. | Một phê duyệt mới cho đúng plan đó. |
| `INVENTORY_DRIFT` | Một resource đã khai đổi kể từ lúc inventory được bind. | Inventory quan sát lại với fingerprint mới. |
| `CAPABILITY_MISSING` | Capability nhánh cần bị thiếu hoặc không có bằng chứng custody. | Capability handle còn thiếu. |
| `PORT_CONFLICT` | Một cổng được claim đang bị tiến trình đã khai khác giữ. | Một cổng đã thống nhất, hoặc chủ sở hữu kia nhả cổng. |
| `EFFECT_UNAUTHORIZED` | Một effect cần thiết nằm ngoài tập đã duyệt. | Phê duyệt bao được nó, hoặc một plan hẹp hơn. |
| `SERVICE_UNAVAILABLE` | Không với tới được dịch vụ dùng chung hoặc provider của nó. | Provider đã phục hồi. |
| `PROOF_FAILED` | Một check bắt buộc fail hoặc không đọc được sau khi áp. | Dịch vụ đã sửa, rồi một lần gọi mới. |
| `NO_PROGRESS` | Một resume không thêm delta thực chất nào. | Thẩm quyền, inventory, desired state hoặc phạm vi mới thật sự. |

`PORT_CONFLICT` là kết cục dự kiến trên một máy dùng chung đông đúc, không phải lỗi của plan. Nó
thuộc về hai chủ sở hữu dịch vụ cùng lúc, và thống nhất cổng là bước đi đúng tiếp theo.

## Bất biến liên trường

- `outcome="operated"` đòi `receipt.status="operated"`, `operation` khác null, `failure` null và
  `resume` null.
- `outcome="blocked"` đòi `receipt.status="blocked"`, `operation` null và `failure` khác null. Failure
  retry được thì phải có resume; failure không retry được thì cấm có resume.
- Mọi effect của mutation đều thuộc loại dịch vụ đã bind.
- Mọi effect của mutation đều xuất hiện trong `appliedEffects`, mọi effect đã áp đều ghi được ít nhất
  một mutation, và `appliedEffects` không lặp.
- Mọi resource bị thay đổi đều có trong `inventoriedResourceRefs`.
- Không mutation nào nhắm vào một resource đã bị quan sát là đang giữ cổng được claim.
- Mọi check đều thuộc loại dịch vụ đã bind, gọi tên một resource đã kiểm kê, và chỉ được ghi một lần.
- Kết quả `operated` đòi trọn bộ chứng minh của nhánh, mọi check đều đạt.
- `already-converged` cấm mutation; `converged` đòi ít nhất một mutation.
- Finding `PORT_COORDINATION_REQUIRED` gọi tên cả cổng lẫn người giữ, cấm kết quả `operated`, và đòi
  failure `PORT_CONFLICT`.
- Mọi finding đều gọi tên một resource đã kiểm kê.
- Không chuỗi nào trong output mang capability handle hay chuỗi có hình dạng credential.
- `artifactRefs` đăng ký artifact receipt của lần vận hành.
- `handoff` luôn là `null`.

## Kết cục thực tế

Hội tụ metrics stack: cấu hình scrape và đích remote-write được cập nhật trên một Prometheus đã kiểm
kê, cả bảy check đều đạt trên bằng chứng riêng của mình, và receipt ghi cả hai revision của từng thay
đổi.

Vận hành một Grafana muốn cổng mà dịch vụ web product đang giữ: không gì bị thay đổi, finding gọi tên
cả cổng lẫn người giữ, và receipt trả về `PORT_CONFLICT` cùng một resume chờ cổng được thống nhất.
