# Input cho `uat.verify`

Input có hai phần đóng: `context` khai đúng phần vật liệu sẵn có mà operator được đọc, và `input` khai
một luồng cần kiểm chứng cùng danh tính, fixture và case đã đóng băng cho nó. Trường không khai báo là
không hợp lệ.

## Vỏ ngoài

- `schemaVersion`: đúng bằng `8`.
- `operatorId`: đúng bằng `uat.verify`.
- `context`: các binding thẩm quyền, giấy phép vào và runtime, mô tả trong `context.vi.md`.
- `input`: đúng một luồng quyết định sản phẩm đã đóng băng.

## Các binding context

`context.backendSource` nêu checkout đã route đang sở hữu thẩm quyền UAT chuẩn, và `sourceHead` của nó
phải bằng đúng `input.sourceHead`. `context.protocol` và `context.templates` ràng luật bằng chứng và
schema file chuẩn bằng fingerprint. `context.admission` mang blind visual PASS cuối và quality PASS
cuối kèm thời điểm chúng pass. `context.runtime` ràng đúng một owner đã sẵn sàng, generation của nó, và
các origin chính xác.

## Danh tính luồng

`input.feature` và `input.flow` là hai khoá chuẩn trỏ tới `.worktrees/uat/<feature>/<flow>/`. Một lần
gọi kiểm chứng đúng một luồng. Một luồng mới chỉ tồn tại khi actor hoặc lối vào, kết cục hoặc trạng
thái cuối, chủ sở hữu ngữ nghĩa hoặc tác dụng phụ, hay hình trạng phục hồi khác nhau về bản chất; các
hoán vị về trình bày và validation vẫn chỉ là case bên trong luồng này.

`input.runId` cô lập tài khoản và mọi fixture mà lần chạy này sở hữu.

## Danh tính người dùng

`input.identity` hoặc là bản ghi tài khoản không chứa bí mật, hoặc là bản ghi ẩn danh tường minh.

Bản ghi tài khoản mang tham chiếu tài khoản, tham chiếu bản ghi Keycloak và database ứng dụng,
fingerprint principal, namespace fixture, chủ sở hữu và chế độ cấp phát, chế độ giữ credential, và
trạng thái đã xác thực. Mỗi trường đều là hằng, fingerprint, hoặc tham chiếu ràng theo scheme, nên
không trường nào chứa nổi mật khẩu, cookie, token hay OTP.

Danh tính tài khoản đòi `input.lease`: lease Browser mờ do Control Panel cấp, với tài khoản,
fingerprint principal, namespace fixture, mission, generation runtime và origin đều bằng đúng lần chạy
này. `accountRecordRef` của nó phải trỏ đúng feature và flow này. Danh tính ẩn danh đòi `input.lease`
bằng `null`, vì một hành trình ẩn danh mà mang lease đã xác thực chính là một phiên kế thừa khoác nhãn
ẩn danh.

Lease `consumer-materialized` phải chứng minh được một tab đã tìm thấy ngay trong lượt này. Lease không
materialize được thì chạy ở chế độ `broker-executed` và phải nêu tên broker bằng chứng của nó.

## Fixture

`input.fixture` khai namespace của lần chạy, bước preflight ràng buộc, các tham chiếu chuẩn bị, và bộ
chọn dọn dẹp. Bộ chọn luôn mang cả `is_uat=true` lẫn đúng namespace; chỉ một trong hai sẽ với tới những
bản ghi mà lần chạy này không sở hữu.

Bước chuẩn bị được gieo tập nhỏ nhất các bản ghi mang namespace của lần chạy, đủ để render có nghĩa, và
kết thúc trước khi thực thi. Nó không bao giờ được tạo ra chính kết cục đang kiểm chứng.

## Case

`input.cases` đóng băng mọi case trước khi thực thi: mã case, vị trí trong thứ tự tuần tự đã khai, loại
actor, lối vào, tiền điều kiện, kết cục kỳ vọng, và những checkpoint bắt buộc phải có ảnh chụp. Các thứ
tự tạo thành dãy liên tục bắt đầu từ một, vì giao thức khai toàn bộ thứ tự thực thi từ trước chứ không
khám phá dần.

Case có actor đã đăng nhập không thể xuất hiện dưới một danh tính chạy ẩn danh, và điều ngược lại cũng
đúng.

## Input khi resume

`resume` là `null` với một lần gọi mới. Lần gọi tiếp nối cung cấp đúng receipt đã blocked, token dùng
một lần của nó, và những tham chiếu được thêm vào từ lúc đó. Một resume không thêm được delta nào về
giấy phép vào, lease, bằng chứng hay case thì không hợp lệ và trả `NO_PROGRESS`.
