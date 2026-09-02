# Input cho `fe.source.apply`

Input có hai phần đóng: `context` khai đúng phần vật liệu sẵn có mà operator được đọc, và `input` khai
ranh giới đã đóng băng mà nó được ghi. Trường không khai báo là không hợp lệ.

## Vỏ ngoài

- `schemaVersion`: đúng bằng `8`.
- `operatorId`: đúng bằng `fe.source.apply`.
- `context`: các binding thẩm quyền và bằng chứng, mô tả trong `context.vi.md`.
- `input`: đúng một lần ghi vào source đã đóng băng.

## Các binding context

`context.resolution` luôn bắt buộc. Nó ràng resolution receipt bằng tham chiếu, id và fingerprint; cây
đã resolve bằng tham chiếu và fingerprint; chế độ phát contract mà resolution đã chọn; danh sách đầy
đủ các chuỗi class nó đã công bố; và danh sách đầy đủ các mã rule nó đã áp dụng.

`context.sourceRefs` phải chứa frontend source đã route, và `sourceHead` của nó phải bằng đúng
`input.project.sourceHead`. `context.directionRefs` và `context.auditRefs` là bằng chứng và được phép
rỗng.

## Ranh giới ghi

- `input.project` ràng frontend source đã xác minh và write root cho artifact của receipt.
- `input.target` xác định đúng một page, layout, modal, drawer, flow, block hoặc component.
- `input.resolution` nhắc lại tham chiếu và fingerprint của receipt mà bên gọi tin rằng mình đã bind,
  và phải bằng đúng `context.resolution`. Bên gọi nêu tên một receipt nhưng bind một receipt khác thì
  bị từ chối trước khi mở bất kỳ file nào.
- `input.scope.mutableOwners` nêu từng owner được phép ghi và đúng đường gốc mà owner đó sở hữu.
  `input.scope.observationOnlyOwnerRefs` nêu những owner chỉ được đọc và không bao giờ được ghi. Hai
  tập rời nhau, và owner của target nằm trong tập được sửa.
- `input.writeSet` là đúng và đủ tập file mà lần gọi này được đụng tới. Mỗi mục nêu đường dẫn, owner,
  và việc đường đó dự kiến được tạo mới hay được sửa.

## Luật của write set

Một đường dẫn xuất hiện nhiều nhất một lần. Mọi đường dẫn đều tương đối, dùng dấu gạch xuôi, và không
chứa đoạn đi ngược.

Mỗi mục đều nêu một owner được phép sửa, và đường dẫn phải nằm dưới gốc đã khai của owner đó. Chỉ
thuộc về owner thôi thì chưa phải là trần: một ownerRef được phép sửa gắn vào một đường nằm ngoài gốc
của chính nó chính là cách một lần ghi thoát khỏi trần mà vẫn trông như đã được cho phép.

Write set là một cái trần, không phải một bản kế hoạch. Một đường đã khai mà resolution không cho gì
để ghi thì để nguyên và được báo là không dùng tới; nó không bao giờ bị nhét nội dung bịa vào chỉ để
biện minh cho việc đã khai nó.

## Input khi resume

`resume` là `null` với một lần gọi mới. Lần gọi tiếp nối cung cấp đúng receipt đã blocked, token dùng
một lần của nó, và những tham chiếu được thêm vào từ lúc đó.

Project, source head, target và fingerprint của resolution phải bằng đúng receipt đã blocked. Một
resume không thêm được delta nào về resolution, write set hay scope thì không hợp lệ và trả
`NO_PROGRESS`. Cây được resolve lại phải đến dưới dạng fingerprint mới của resolution: cùng một
fingerprint không thể cho ra một lần ghi khác.
