# Input cho `release.deploy`

Input có hai phần đóng: `context` khai đúng phần vật liệu sẵn có mà operator được đọc, và `input` khai
một bản phát hành cần triển khai cùng target mà nó được phép đổi. Trường không khai báo là không hợp
lệ.

## Vỏ ngoài

- `schemaVersion`: đúng bằng `8`.
- `operatorId`: đúng bằng `release.deploy`.
- `context`: các binding về ý định, luật, manifest, cho phép, credential và quan sát, mô tả trong
  `context.vi.md`.
- `input`: đúng một release bất biến và một target đã khai.

## Các binding context

`context.intent` ràng khai báo bền trong `.stacks` bằng fingerprint, và môi trường của nó bằng đúng
`input.target.environment`. `context.lifecycle` ràng luật triển khai. `context.manifest` nêu manifest
đã kiểm và release mà nó bị ghim vào, và đó phải là release này.

`context.authorization` mang giấy phép `deploy` đã khai, phạm vi của nó, và khoảng thời gian còn hiệu
lực. Phạm vi phải trùng đúng project, môi trường và target này, và giấy phép phải còn hiệu lực tại
thời điểm target được quan sát.

`context.credentials` liệt kê các handle `secret-ref://` mờ cùng tham chiếu custody của chúng. Không
trường nào nhận một giá trị.

`context.observed` là mốc nền cho mọi lần compare-and-set: tham chiếu target, revision của nó, release
đang chạy, digest đang chạy, và thời điểm đọc được.

## Danh tính bản phát hành

`input.release` là bất biến và chính xác: một mã release, tham chiếu artifact, digest `sha256:` định
danh nó, source head nó được dựng từ đó, và giá trị hằng `immutable: true`. Digest mới là thứ mà lần
triển khai này có nghĩa; tag thì không.

## Target và chiến lược

`input.target` nêu một target, môi trường của nó, chiến lược rollout, số target đã khai, và
`replacedReleaseId`: release đang chạy, phải bằng đúng release quan sát được. Ghi lại nó chính là thứ
làm cho trôi dạt đồng thời trở nên phát hiện được, vì mọi release khác xuất hiện trong lúc thực thi đều
thuộc về lần chạy của người khác.

## Cửa sổ ổn định và probe

`input.steady` khai cửa sổ mà trạng thái ổn định phải giữ được, deadline có chặn, và backoff giữa các
probe. Deadline phải lớn hơn cửa sổ mà nó phải chứa, và backoff không được lớn hơn cửa sổ.

`input.probes` khai những gì sẽ được đo. Phải có ít nhất một probe công khai. Ở dự án này, probe
GraphQL typename trả `200` là tín hiệu sẵn sàng, và boot sau khi đẩy `main` mất khoảng tám tới chín
phút, nên deadline được đặt theo thực tế đó chứ không theo sự lạc quan.

## Danh tính rollback

`input.rollbackIdentity` nêu đúng release an toàn có thể khôi phục, artifact của nó, digest của nó, và
việc trạng thái dữ liệu cùng schema hiện tại có còn tương thích hay không. Nó phải nêu một release khác
và một digest khác với cái đang được triển khai. Nó được phép là `null`, và khi đó nhánh rollback không
tồn tại, một rollout không cứu được sẽ bị chặn thay vì được lùi.

## Input khi resume

`resume` là `null` với một lần gọi mới. Lần gọi tiếp nối cung cấp đúng receipt đã blocked, token dùng
một lần của nó, và những tham chiếu được thêm vào từ lúc đó. Một resume không thêm được delta nào về
cho phép, manifest, credential hay quan sát thì không hợp lệ và trả `NO_PROGRESS`.
