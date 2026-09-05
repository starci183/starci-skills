# data.seed

## Việc

Đặt seed của một luồng vào kho của môi trường từ tài liệu luồng, mọi hàng quy được về luồng theo
quyền sở hữu của tài khoản hay theo tiền tố, ở khối lượng đại diện mà luồng khai, và liệt kê đúng
những gì để hoàn tác; hoặc gỡ đúng tập rollback đó và không gì khác.

## Xong khi

Xong khi `seed-receipt` liệt kê mọi hàng mà seed của luồng đã đặt cùng cách quy về của nó — tài
khoản đã cấp của luồng, hoặc tiền tố của luồng ở kho không có cột chủ sở hữu, kho không có cả hai được
ghi là giới hạn chứ không bao giờ là một thay đổi schema — tập rollback là tập con của những hàng đó,
và trạng thái mong đợi được chứng minh theo chính kỳ vọng của seed; hoặc, dưới chế độ rollback,
`seed-receipt` liệt kê các hàng đã gỡ và không hàng nào khác.

## Seed quy về được, hoặc là một giới hạn

Operator này làm việc bên trong luật cô lập mà chủ runtime công bố dưới
[Hai phiên, một sản phẩm](../runtime-serve/operator.vi.md#hai-phiên-một-sản-phẩm) và không chép lại
nó; điều duy nhất nó mang là điều thứ tư, và biên bản này là nơi điều ấy được kiểm. Mọi hàng được đặt
thuộc sở hữu của tài khoản đã cấp cho luồng, hoặc mang namespace của luồng trong một định danh ở kho
không có cột chủ sở hữu, và tập rollback nêu đúng những hàng ấy. Kho không có cột chủ sở hữu lẫn
định danh gắn tiền tố được thì được ghi là giới hạn của seed đó trong biên bản, để người đọc biết
hàng nào không phân biệt nổi với hàng của phiên khác; nó không bao giờ là một migration thêm vào để
thoả luật, vì một schema đổi vì một dấu test là một sản phẩm đổi vì một fixture. Một hàng đã đứng sẵn
trong kho ngoài namespace của luồng là hàng dùng chung: seed không đụng hàng nào như thế, và một bản
ghi sẽ rơi vào hàng như thế dừng nhánh bằng `SEED_SHARED_ROW` trước khi có gì được ghi.

## Seed là tiền điều kiện của luồng, ở khối lượng của luồng

Seed đặt những gì luồng cần trước khi bắt đầu — dòng danh mục, trạng thái ban đầu của tài khoản, thứ
phải tồn tại sẵn — và không bao giờ đặt kết quả mà luồng được kỳ vọng tạo ra, vì một kết quả được
seed biến một luồng hỏng thành một lượt chạy đạt. Số bản ghi mỗi thực thể là khối lượng đại diện của
luồng, đọc từ tài liệu luồng: các tiêu chí bề mặt phụ thuộc khối lượng dữ liệu được đo tại đó, nên
seed đặt đúng bằng số hàng mà bề mặt được thiết kế để mang, không phải một hàng cho luồng đi qua.
Hợp đồng của chính thư mục seed (`seed/README.md` của khuôn luồng) nói cái gì được đặt, đặt lại thì
không đổi gì ra sao, và trạng thái đã scope được lấy thế nào; một seed chỉ chạy trên kho trống là một
seed chỉ chạy được một lần, nên áp lần thứ hai trên cùng namespace là `SEED_ALREADY_APPLIED` và là
một no-op, không phải lỗi.

## Seed thiếu được tạo từ plan

`data.plan` quyết định fixture và phân loại nó là valid, missing hay invalid. Operator này reuse row
hợp lệ, create row thiếu, hoặc update row sai từ execution sheet đã freeze; nó không draft hay đổi
plan. Account thiếu được handoff cho `identity.provision`; store không tới được là
`PROVISIONING_UNAVAILABLE`.

## Seed không mang credential

Một bản ghi cần danh tính đã xác thực thì nêu alias trong hồ sơ tài khoản thay vì một credential; mật
khẩu dùng chung được giải theo tên đúng lúc gửi request và chỉ đi vào body của request. Không gì
dưới thư mục seed, biên bản hay fixture mang bí mật, và biên bản được quét để tìm.

## Luồng attempt cụ thể

Các row của operator này được gate bởi hợp đồng attempt expected/actual dùng chung trong `scripts/attempt-gate.mjs`.

| Trạng thái quan sát | Hành động | Kiểm actual | Nhánh kế tiếp |
| --- | --- | --- | --- |
| planned row đã khớp exact namespace | tái dùng; không mutation | đọc mọi row và bind seed-plan fingerprint | phát `SEED_ALREADY_APPLIED` không mutation mới |
| row thiếu | tạo từ JSON hoặc SQL tùy chọn qua runner đã khai | đọc id, value, ownership, volume | ghi row tạo và exact rollback set |
| row có namespace khác expected | idempotent upsert chỉ row sở hữu | đọc full expected state và tính rollback | repair attempt; retry tạm thời có transcript mới |
| apply trước partial hoặc không chắc | không reapply hay mở cleanup | xác định journaled row và effect chưa rõ | block tới khi exact remaining set an toàn |

## Ranh giới ghi

Context chỉ đọc, trừ planned store row. Operator đọc fixture bytes và expected state mà `seed-plan`
gọi tên, rồi đặt hay gỡ hàng trong kho của môi trường
qua kết nối đã khai hoặc API của chính sản phẩm, và chỉ ghi `response/` của nhánh mình: `response.md`
và `response.json`. Nó không tạo tài khoản, không phục vụ runtime, không đổi schema, không đụng hàng
ngoài namespace của luồng, không seed kết quả đang được kiểm, không ghi giá trị credential ở bất kỳ
đâu; và không tuyên bố đã đặt seed khi còn một check vắng mặt hay hỏng.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@worktrees/uat/<flow>` | flow folder đã plan và immutable fixture bytes mà `seed-plan` tham chiếu; chỉ đọc | có |
| `@worktrees/sessions/central-runtime` | entry của route đã bind: kho và các endpoint mà seed được áp qua, đọc theo fingerprint và generation | có |
| `@workspaces/device-state` | credential của kho theo tên và custody của nó; giá trị không bao giờ xuất hiện | có |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `seed-plan` | `data.plan`; JSON fixture đã validate, SQL input tùy chọn, namespace, expected read-back và rollback set | có |
| `uat-account` | `identity.provision`; hồ sơ tài khoản sở hữu các hàng, khi chuỗi này đã cấp nó; nếu không thì đọc từ thư mục luồng | không |
| `units` | `data.plan`; danh sách seed mà nhánh này đặt đúng một đơn vị, gọi tên bằng `request.unit` | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `flow` | id | — | Luồng có seed được đặt hay rollback |
| `routeKey` | id | — | Entry `<project>/<role>` có kho và endpoint mà seed đi qua |
| `env` | id | dev | Stack có kho nhận seed; seed của stack này không phải seed của stack khác |
| `approval` | id | — | Thẩm quyền phủ lên seed: một id phê duyệt, hoặc tham chiếu tới bản khai báo môi trường — đường dẫn cùng hash nội dung — khi bản khai báo đó đánh dấu `seed` là `declared` cho `env`; không có mặc định, vì im lặng không phải đồng thuận |
| `operation` | choice | apply | `apply` đặt seed ở khối lượng của luồng; `rollback` gỡ tập rollback mà lần áp gần nhất đã liệt kê và không gì khác |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate shared attempt gate và resume theo frozen `seed-plan`, account và exact namespace | `resume` | `request/request.json`, @worktrees/uat/<flow> tại fingerprint đã đóng băng | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Ràng thẩm quyền cho lớp seed, hồ sơ tài khoản của luồng và kho của entry route, giải credential của kho theo tên | `approval`, `env`, `routeKey`, `flow` | @worktrees/uat/<flow> cho hồ sơ tài khoản, đầu vào `uat-account` khi chuỗi mang nó, @worktrees/sessions/central-runtime cho kho và endpoint, @workspaces/device-state cho credential theo tên, bản khai báo của môi trường khi `approval` tham chiếu tới nó, @tools/secrets | — | `AUTHORITY_DRIFT`, `IDENTITY_MISSING` |
| 3 | Kiểm JSON fixture, SQL input tùy chọn, expected read-back và cleanup set trong `seed-plan`; từ chối plan thiếu/sai và không draft ở đây | — | đầu vào `seed-plan`, @worktrees/uat/<flow> cho bytes fixture được tham chiếu | — | `INVALID_INPUT` |
| 4 | Quan sát từng planned id trong exact namespace và phân loại row reusable, missing, invalid hoặc uncertain trước khi thay đổi | `operation` | @worktrees/sessions/central-runtime cho kho, @tools/database, @tools/http | — | `SEED_SHARED_ROW`, `PROVISIONING_UNAVAILABLE` |
| 5 | Tái dùng row khớp, tạo row thiếu, idempotent update row sai được sở hữu, hoặc chỉ xóa rollback set của plan; không reapply effect chưa chắc | — | @worktrees/uat/<flow> cho các bản ghi và tập rollback, @tools/database, @tools/http | @worktrees/uat/<flow> | `PROVISIONING_UNAVAILABLE` |
| 6 | Chứng minh trạng thái mong đợi theo kỳ vọng của seed và tập rollback theo các hàng đã đặt | — | @worktrees/uat/<flow> cho kỳ vọng, @tools/database, @tools/http | — | `SEED_UNPROVEN` |
| 7 | Viết biên bản và phát | — | mọi thứ ở trên | `response/response.md`, `response/response.json` | — |

Một lần resume bắt đầu lại từ cổng vào, chỉ dùng lại fingerprint seed không đổi, và chỉ áp phần kho
chưa giữ; một lần resume không thêm thẩm quyền, tài khoản, seed hay thay đổi kho nào là `NO_PROGRESS`.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `seed-receipt` | `response/response.md` | md | có |

## Kết quả tốt nhất

Khi `done`, in **Kết quả tốt nhất** là bảng record đã apply, reuse hoặc remove cùng proof before/after theo namespace trong `response/response.md`. Apply dở, rollback fail hoặc kết quả store chưa chắc phải đưa đúng các dòng incomplete và điểm dừng lên trước; không được báo namespace đã sẵn sàng.

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `AUTHORITY_DRIFT` | terminate |
| `IDENTITY_MISSING` | terminate |
| `SEED_SHARED_ROW` | terminate |
| `PROVISIONING_UNAVAILABLE` | terminate |
| `SEED_UNPROVEN` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| thư mục luồng hay kho đã đổi kể từ khi request đóng băng chúng | `workspace.bind` |
| luồng chưa có hồ sơ tài khoản, nên danh tính được cấp trước khi seed được đặt | `identity.provision` |
| seed đã đặt ở khối lượng và bề mặt từng được đo dưới mức ấy được chụp lại | `interface.audit` |
| seed đã đặt và lượt chạy đang chờ nó có thể đi qua luồng | `uat.verify` |
| seed đã đặt và bộ kiểm end-to-end chạy trên những hàng ấy có thể chạy như một client | `api.verify` |
| seed đã đặt và nhiệm vụ không đòi gì hơn thế, nên người đọc biên nhận trước khi có gì đi qua luồng | `user` |
