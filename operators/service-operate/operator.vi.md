# service.operate

## Việc

Đưa đúng một dịch vụ phụ trợ mà môi trường khai báo — một ngăn xếp quan trắc, một dịch vụ chấm chất
lượng mã, một đường hầm bên cạnh một runtime đang phục vụ — về trạng thái mà bản khai báo ấy yêu
cầu, chứng minh bằng chính probe của nó rằng dịch vụ đang ở trạng thái đó, và ghi lại kẻ đang giữ
trả lời, dưới lease xếp thứ tự các phiên.

## Xong khi

Xong khi `service-receipt` ràng đúng một dịch vụ mà môi trường khai báo cùng thẩm quyền đã bao nó,
và bảng Checks của nó chứng minh trạng thái quan sát được từ chính probe của dịch vụ — một `up` có
trả lời, một `down` có cổng trống — với kẻ đang giữ trả lời được ghi lại và không giá trị thông tin
đăng nhập nào nằm trong đó.

## Một dịch vụ của môi trường, một nhánh

Một máy chạy sản phẩm cũng chạy những thứ bên cạnh nó: ngăn xếp thu số đo và log, dịch vụ mà một
gate chất lượng mã gửi lên, đường hầm đưa một runtime đang phục vụ ra tới nơi một người hay một nhà
cung cấp với tới được. Không cái nào là sản phẩm, không cái nào là runtime của sản phẩm, và mỗi cái
là một thứ khác để khởi động, một thứ khác để probe và một chủ khác khi nó không lên. Một operator
được giao tất cả cùng lúc là một operator báo một kết cục cho vài dịch vụ chẳng liên quan gì nhau,
nên đơn vị ở đây là một dịch vụ: request gọi tên nó, nhánh dời nó, và biên nhận nói về nó và không
nói về gì khác.

Chúng được liệt kê bởi môi trường, không bởi một bản kế hoạch. Mọi dịch vụ operator này được đụng tới
là một dòng của `services` trong bản khai báo môi trường — `id`, `kind`, trạng thái môi trường muốn
nó ở, lệnh đã khai dời nó, probe chứng minh nó, và môi trường có giữ nó với một người hay không —
nên chẳng có gì để một `service.plan` khám phá và chẳng có danh sách `units` nào để toả ra. Một
nhiệm vụ cần hai dịch vụ gọi tên operator này trên hai dòng "xong khi", và luật của planner cho một
operator không có anh em plan đặt mỗi cái lên nhánh riêng, cái thứ hai sau cái thứ nhất. Một request
gọi tên một dịch vụ mà bản khai báo không mang là `INVALID_INPUT`, vì một dịch vụ không ai khai
không phải một dịch vụ operator này được phép bịa ra.

## Bản khai báo là thẩm quyền, và một dịch vụ vẫn có thể là của một người

Thẩm quyền đứng sau `approval` đến từ đâu là chuyện của môi trường, và operator này không nói lại
luật mà schema môi trường công bố
(`readiness/initialization/stacks/environment.schema.json`): lớp ở đây là `service`, một môi trường
không phải production trả lời nó bằng bản khai báo còn production giữ nó với một người, mọi bản khai
báo đều được siết chặt lại, và `approval` do đó nhận hoặc một id phê duyệt hoặc tham chiếu của bản
khai báo — đường dẫn và hash các byte của nó. Hai điều là của riêng operator này. Thứ nhất là dòng
dịch vụ mang `holder` của chính nó: một môi trường có thể trả lời lớp ấy bằng bản khai báo mà vẫn
giữ riêng một dịch vụ với một người, và dịch vụ đó là `SERVICE_APPROVAL_REQUIRED` dù lớp đọc thế
nào. Thứ hai là mã dừng được lấy trước khi có gì dời đi, nên một dịch vụ một người đang giữ không
bao giờ bị khởi động rồi mới được báo cáo.

## Một trạng thái không ai probe thì không phải trạng thái

Biên nhận ghi hai trạng thái chứ không bao giờ một. `Desired` là điều request yêu cầu; `Observed` là
điều dịch vụ đang ở khi nhánh kết thúc, và nó được đặt từ probe đã khai chứ không từ gì khác — không
từ mã thoát của lệnh, không từ một dòng log, không từ việc lệnh đã được chạy. Một `up` có probe
không trả lời là `SERVICE_UNPROVEN`, và một `down` có cổng vẫn bị giữ cũng vậy; cả hai vào lại chính
operator này với dịch vụ được sửa hay probe được sửa, và không cái nào từng được trả lời bằng cách
bỏ probe đi. Một request cũng có thể xin `attested`, thứ không đổi gì và báo lại điều đang đứng:
lệnh đã khai không chạy, probe được đọc, và biên nhận ghi quan sát ấy như một finding chứ không như
một lần dời. Chứng thực không bao giờ khởi động lại thứ gì, vì đúng lý do mà chủ runtime nêu: một
dịch vụ khoẻ mạnh bị khởi động lại để được mô tả là trạng thái bước sau sắp đo, bị phá đi.

Một dịch vụ đã đứng sẵn ở trạng thái mong muốn là một no-op đã chứng minh. Lệnh không chạy, probe
vẫn quyết định `Observed`, và biên nhận ghi `SERVICE_ALREADY_IN_STATE` dưới các finding của nó, để
người đọc phân biệt được một dịch vụ nhánh này khởi động với một dịch vụ nó chỉ tìm thấy.

## Kẻ đang giữ được ghi lại, và cổng không bị giành lại

Một dịch vụ đang lên là một tiến trình, và một tiến trình không ai ghi lại là một tiến trình không
ai dừng được. Biên nhận ghi pid trả lời trên endpoint đã khai, và entry dịch vụ bên cạnh sổ đăng ký
runtime mang cùng bản ghi ấy, để nhánh sau này hạ dịch vụ xuống dừng đúng cây tiến trình nó đã ghi
và không cây nào khác. Một cổng công khai đã khai mà một route sản phẩm đã được chiếu lên là một
xung đột giữa hai chủ: nó được ghi là `SERVICE_PORT_SHARED` dưới các finding, với cả hai bên đòi
được gọi tên, và nó không bao giờ được giải bằng cách dời một cổng hay dừng thứ đang giữ cổng.
Operator này chỉ dừng thứ mà chính bản ghi của nó gọi tên.

## Lease là thứ tự giữa các phiên

Một phiên dời một dịch vụ tại một thời điểm. Phiên đang thao tác lấy lease của entry dịch vụ của môi
trường trong lúc chạy lệnh đã khai và probe kết quả, rồi nhả ra khi probe đã trả lời; một phiên xin
trong lúc phiên khác đang giữ thì chờ và được cho biết ai đang giữ. Lần chờ ngắn theo cấu tạo: lease
được giữ cho một lệnh và một probe, không bao giờ cho suốt độ dài của công việc mà dịch vụ ấy tồn
tại để đỡ.

## Luồng attempt cụ thể

Các row của operator này được gate bởi hợp đồng attempt expected/actual dùng chung trong `scripts/attempt-gate.mjs`.

| Trạng thái quan sát | Hành động | Kiểm actual | Nhánh kế tiếp |
| --- | --- | --- | --- |
| declared service khớp config và functional probe | tái dùng và ghi live identity | health và goal-specific probe pass | phát receipt không đổi |
| service thiếu | chỉ create/start approved kind và refs | đọc process/container, endpoint, probe | phát delta mới |
| service sai | chỉ update mutable declared refs | chạy lại health và probe fail | repair attempt mới; handoff foreign/wider owner |
| mutation không chắc | inventory lại trước action | phân loại converged, not converged, uncertain | không lặp mù |

## Ranh giới

Context là chỉ đọc trừ entry dịch vụ. Operator chạy đúng lệnh mà bản khai báo gọi tên, cho đúng dịch
vụ mà request gọi tên, và chỉ ghi entry của dịch vụ ấy dưới `@worktrees/sessions/central-runtime` và
`response/` của nhánh mình: `response.md` và `response.json`. Nó không ghi một bản khai báo môi
trường hay tự cấp phê duyệt cho mình cách nào khác; không khởi động, dừng hay cấu hình lại một dịch
vụ bản khai báo không gọi tên; không đụng tới server, nhánh tích hợp hay cổng của một route sản
phẩm; không dời một cổng hay giải phóng một cổng bằng cách dừng thứ đang giữ nó; không dừng một tiến
trình mà bản ghi của chính nó không gọi tên; không khởi động lại một dịch vụ để chứng thực nó; không
seed dữ liệu, cấp tài khoản, chạy gate hay chấm một sản phẩm; và không ghi giá trị thông tin đăng
nhập, handle capability hay token có hình dạng bí mật ở bất cứ đâu trong thứ nó viết.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@worktrees/sessions/central-runtime` | chủ runtime dùng chung: entry dịch vụ của môi trường với bản ghi kẻ đang giữ, lease và hàng đợi của nó, ràng theo fingerprint và chỉ ghi dưới một lease độc quyền | có |
| `@workspaces/ports/<project>` | bản chiếu cổng của project dùng chung máy này, đọc chỉ để thấy một cổng công khai đã khai có phải cổng một route sản phẩm đã sở hữu hay không | không |
| `@workspaces/device-state` | thông tin đăng nhập mà lệnh đã khai cần, theo tên và với custody của nó; giá trị không bao giờ xuất hiện | không |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| — | các dịch vụ được bản khai báo môi trường liệt kê, nên operator này không tiêu thụ nhánh nào trước đó | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `service` | id | — | `id` của đúng một dịch vụ, như bản khai báo môi trường gọi tên nó dưới `services` |
| `env` | id | dev | Môi trường mà bản khai báo gọi tên dịch vụ và entry ghi lại nó |
| `desired` | choice | up | `up` chạy lệnh đã khai để lên, `down` chạy nó để xuống, `attested` không đổi gì và báo lại điều probe thấy |
| `approval` | id | — | Thẩm quyền bao dịch vụ này và trạng thái này: một id phê duyệt, hoặc tham chiếu của bản khai báo môi trường — đường dẫn và hash nội dung — khi bản khai báo ấy đánh dấu `service` là `declared` cho `env`; không có mặc định, vì im lặng không phải đồng ý |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate và lần chạy lại theo entry dịch vụ đã đóng băng | `resume` | `request/request.json`, @worktrees/sessions/central-runtime ở fingerprint đã đóng băng | — | `INVALID_INPUT`, `NO_PROGRESS` |
| 2 | Ràng đúng một dịch vụ mà môi trường khai: kind, lệnh đã khai, probe, holder và cổng công khai của nó | `service`, `env` | bản khai báo môi trường của `env`, @worktrees/sessions/central-runtime cho entry dịch vụ | — | `INVALID_INPUT` |
| 3 | Ràng thẩm quyền cho lớp `service` và cho chính holder của dịch vụ này, giải thông tin đăng nhập của lệnh theo tên | `approval` | bản khai báo môi trường đọc lại và hash lại, @workspaces/device-state cho thông tin đăng nhập theo tên, @tools/secrets | — | `SERVICE_APPROVAL_REQUIRED` |
| 4 | Đọc bản chiếu cổng và ghi một cổng công khai đã khai mà một route sản phẩm đã sở hữu như một finding, không bao giờ như một cổng để dời | — | @workspaces/ports/<project>, @tools/shell cho bảng socket | — | — |
| 5 | Kiểm declared probe, process/container holder và config, phân loại service reusable, missing, invalid hoặc uncertain trước command | — | @tools/http, @tools/shell, @worktrees/sessions/central-runtime | — | — |
| 6 | Tái dùng service state khớp, create/start service thiếu, chỉ update mutable resource đã khai bị sai, và không đổi ownership uncertain/foreign | `desired` | @tools/shell, @tools/container, @worktrees/sessions/central-runtime cho lease và hàng đợi | @worktrees/sessions/central-runtime | — |
| 7 | Chứng minh trạng thái quan sát được chỉ từ probe đã khai: một `up` trả lời nó, một `down` để cổng trống, và pid trả lời được ghi lại | — | @tools/http, @tools/shell | @worktrees/sessions/central-runtime | `SERVICE_UNPROVEN` |
| 8 | Nhả lease, viết biên nhận và phát | — | mọi thứ ở trên | `service-receipt`, `response/response.json` | — |

Bước 2, 3 và 7 là những bước duy nhất dừng lại. Một lần chạy lại bắt đầu lại từ bước 1, đọc lại bản
khai báo và entry, và chứng minh lại trạng thái từ probe; một lần vào lại không mang thay đổi nào
cho dịch vụ, bản khai báo hay thẩm quyền là `NO_PROGRESS`.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `service-receipt` | `response/response.md` | md | có |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `NO_PROGRESS` | terminate |
| `SERVICE_APPROVAL_REQUIRED` | terminate |
| `SERVICE_UNPROVEN` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| dịch vụ chấm chất lượng mã đã lên và các gate gửi lên nó có thể chạy | `quality.verify` |
| đường hầm đã lên và lần đi thử với tới sản phẩm qua nó có thể chạy | `uat.verify` |
| một dịch vụ đã dời và độ sẵn sàng của máy được đọc lại cùng nó | `environment.preflight` |
| môi trường giữ dịch vụ này với một người, hoặc người không xin gì ngoài biên nhận | `user` |
