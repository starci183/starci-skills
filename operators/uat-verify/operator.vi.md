# uat.verify

## Việc

Kiểm chứng một luồng sản phẩm từ đầu đến cuối trên sản phẩm đang chạy tại commit đã ghim, rồi phát
một hồ sơ lượt chạy chỉ-thêm với ba làn được xét độc lập, hoặc dừng đúng chỗ không sẵn sàng thay vì
chế ra một phán quyết.

## UAT chỉ chạy khi có người yêu cầu

`requestedBy` nêu tên người đã yêu cầu; thiếu nó thì operator không có ai để chạy cho và dừng ngay ở
cổng. Không có gì ở operator này là thường lệ: nó đăng nhập như một người dùng thật, ghi bản ghi thật
vào một runtime dùng chung và để lại một hồ sơ lượt chạy vĩnh viễn, nên thứ khởi động nó là một con
người, không bao giờ là lịch hẹn, mặc định của chain hay sự tiện tay của một agent khác. `runId` và
`lease` cũng không phải câu hỏi dành cho người: orchestrator sinh mã lượt chạy và cấp lease độc quyền
trên thư mục luồng trước khi nhánh bắt đầu, và một lần gọi đến mà thiếu chúng là `INVALID_INPUT` ở bước 1 chứ
không phải một lời hỏi. Vì thế Mặc định của chúng là `—`: một ô Mặc định ghi "mã lượt chạy của
orchestrator" là lời văn chứ không phải một giá trị cổng dùng được, và một cổng chấp nhận lời văn là
một cổng chấp nhận ô rỗng. `LEASE_INVALID` là một thất bại khác và giữ chỗ riêng của nó: đó là cái
lease có tồn tại nhưng đã hết hạn, thuộc về nơi khác, hoặc đang ràng vào một lượt chạy khác, và nó bị
phát hiện ở bước 6 trên chính thư mục luồng mà lượt chạy này đang giữ.

## Endpoint là cái đã ràng, không phải cái suy lại

Luồng được lái theo endpoint mà đầu vào `route` mang, chính cái mà nhánh `workspace.bind` của chuỗi
này đã quan sát và đóng lại. Operator này không suy lại sự sẵn sàng từ sổ đăng ký runtime: một sổ
đăng ký báo `ready` trong khi không ai lắng nghe đúng là nguồn đẩy trình duyệt vào một cổng chết, và
bước ràng đã từ chối một cổng chỉ-lắng-nghe thay cho chuỗi này rồi. Khi endpoint đã ràng không trả
lời, mã dừng là `RUNTIME_UNAVAILABLE` trên một endpoint có tên, chứ không phải một phỏng đoán xem
origin nào mới là origin được nhắc tới.

## Mật khẩu là một cái tên, không bao giờ là một giá trị

Mọi tài khoản UAT dùng chung một mật khẩu, niêm phong tại `.stacks/<env>/secrets/uat.enc` bằng master
identity dùng chung, còn mỗi luồng giữ username riêng của nó. Operator giải mã thông tin đăng nhập
theo tên qua `@workspaces/device-state` đúng lúc đăng nhập và không lúc nào khác; nó không bao giờ
chép giá trị ấy vào một biến nó ghi ra, một fixture, một câu lệnh nó lưu lại hay một câu nó phát
hành. Mật khẩu không bao giờ nằm ở dạng rõ tại bất kỳ nơi nào operator này ghi: không trong
`response/`, không trong hồ sơ lượt chạy dưới `runs/<runId>/`, không trong log. Ô mật khẩu bị che
trong mọi ảnh chụp, kể cả ảnh chụp trước khi gửi và ảnh chụp sau một lần đăng nhập hỏng, vì một ảnh
chụp là bằng chứng đã phát hành và mật khẩu đã lọt vào ảnh thì đã rời khỏi vòng giữ. Vì thế hồ sơ tài
khoản chỉ mang username, vai trò, tên thông tin đăng nhập và đường dẫn file niêm phong, không mang
thứ gì có thể chứa một bí mật.

## Đóng băng đi trước thực thi

Snapshot được ghi trước mọi hành động lên sản phẩm và không bao giờ sửa lại sau đó. Nó nêu commit, các
case theo thứ tự đã đóng băng cùng những khẳng định có tên, hồ sơ tài khoản, fingerprint của seed và
namespace fixture. Thứ tự ấy biến ba thất bại vô hình thành ba thất bại thấy được: một case chưa từng
được đóng băng không thể xuất hiện trong kết quả, một lượt chạy không thể được giải thích lại sau khi
xong bằng cách sửa điều nó nói là mình kiểm, và một admission không thể bị gán ngược vào một commit nó
chưa từng thấy. Cả hai admission — biên bản `frontend-surface-audit` và biên bản `quality-verification` —
phải nêu đúng commit đã ghim; thiếu một trong hai, hoặc một trong hai lấy ở commit khác, là
`ADMISSION_MISSING`, vì một bề mặt sạch và một cổng xanh ở commit khác chẳng nói gì về sản phẩm mà
lượt chạy này đang lái.

## Ba làn, xét riêng

Hành vi, UX và UI được xét trên bằng chứng của riêng chúng và không bao giờ mượn kết luận của nhau.
Đúng ba làn được phát hành, mỗi làn có pass hoặc fail riêng và tham chiếu bằng chứng riêng; một làn
không có bằng chứng không phải là fail mà là `EVIDENCE_UNAVAILABLE`, vì tính sự không sẵn sàng thành
lỗi là đổ tội cho một sản phẩm chưa ai quan sát. Lỗi UI trên một node do ứng dụng sở hữu đi về
presentation, lỗi hành vi đi về backend, còn lỗi UX đi về người: không ai giải một câu hỏi về ý đồ
bằng cách chạy lại luồng mạnh tay hơn.

## Namespace sở hữu mọi thứ lượt chạy này ghi ra

Mọi bản ghi lượt chạy này ghi đều mang `is_uat=true` và namespace `runId`, nên thứ lượt chạy tạo ra
tách bạch với thứ sản phẩm vốn đã có. Dọn dẹp xoá đúng namespace ấy và không gì khác: không xoá
namespace của lượt chạy khác, không xoá bản ghi chỉ vì nó mang cờ UAT, và không bao giờ xoá một hồ sơ
lượt chạy. Bản thân khâu kiểm chứng chỉ đọc chứ không ghi, và seed không bao giờ được tạo ra chính kết
quả cần kiểm.

## Hồ sơ lượt chạy chỉ được thêm

`runs/<runId>/` được ghi một lần, ở cuối, dưới lease độc quyền, rồi `latest` được dời sang trỏ vào nó.
Một thư mục lượt chạy đã tồn tại thì không bao giờ bị ghi đè, bị cắt bớt hay bị "sửa cho đúng": lần
thử thứ hai là một `runId` mới, còn hồ sơ cũ ở lại làm bằng chứng cho điều đã quan sát được lúc ấy.
Lịch sử mà sửa được thì không còn là lịch sử.

## Ranh giới ghi

Context là chỉ-đọc, trừ thư mục luồng. Operator ghi snapshot và hồ sơ lượt chạy dưới
`@worktrees/uat/<flow>/<case>` trong khi còn giữ lease độc quyền, và chỉ ghi trong `response/` của
nhánh mình: `data/snapshot.json`, `data/captures/<case>.json`, `data/verdicts.json`, các ảnh chụp và
tấm ghép dưới `response/artifacts/`, `response.md` và `response.json`. Nó không đọc cũng không ghi mật
khẩu dưới dạng giá trị, không nhờ người đăng nhập hay đưa thông tin đăng nhập, không sửa sản phẩm cho
một case đậu, không sửa snapshot đã đóng băng sau khi bắt đầu chạy, không ghi đè hay xoá một hồ sơ
lượt chạy, và không xoá bất cứ thứ gì ngoài namespace fixture của chính nó.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@worktrees/uat/<flow>/<case>` | thư mục luồng: `flow.md`, `account.json`, `seed/`, lịch sử chỉ-thêm `runs/<runId>/` và con trỏ `latest`, bind theo fingerprint từng file và chỉ ghi khi giữ lease độc quyền | có |
| `@worktrees/_templates` | khuôn luồng UAT dùng để tạo thư mục luồng mới, đúng ba thứ mà bước 4 đọc: `uat/flow.md` với các case và những khẳng định có tên của chúng, `uat/account.json` với username, vai, tên thông tin đăng nhập và đường dẫn file niêm phong, không trường nào có thể chứa bí mật, và `uat/seed/` với các bản ghi mà một lượt chạy đặt namespace lên; tiêu thụ, không sửa | có |
| `@worktrees/sessions/central-runtime` | generation của chủ runtime đứng sau endpoint đã ràng; sự sẵn sàng do đầu vào `route` chứng minh, không bao giờ suy lại từ sổ đăng ký này | có |
| `@workspaces/device-state` | sổ thông tin đăng nhập niêm phong; mật khẩu UAT dùng chung được giải theo tên ở đây lúc đăng nhập và không đọc ở đâu khác | có |
| `@workspaces/be` | checkout backend được route tại commit đã ghim, nơi luồng kiểm hành vi và nơi store giữ các bản ghi có namespace | có |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `frontend-surface-audit` | lượt soi bề mặt kết luận frontend sạch, lấy tại commit đã ghim | có |
| `quality-verification` | cổng chất lượng đã xanh, lấy tại đúng commit đã ghim ấy | có |
| `route` | `workspace.bind` ở vai fe; route đã ràng mà lượt chạy này lái theo endpoint của nó | có |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `requestedBy` | id | — | Ai yêu cầu lượt UAT này; UAT không bao giờ khởi động khi không có người đứng sau |
| `feature` | id | — | Khoá feature dùng để địa chỉ hoá thư mục luồng |
| `flow` | id | — | Luồng sản phẩm duy nhất mà lần gọi này kiểm chứng |
| `cases` | list `caseId` | every case of the flow | Chạy những case đã đóng băng nào; mặc định là mọi case `flow.md` khai, theo đúng thứ tự của nó |
| `runId` | id | — | Không hỏi người: orchestrator điền nó, và nó namespace mọi bản ghi lượt chạy này ghi ra |
| `lease` | token | — | Không hỏi người: orchestrator điền nó, cấp lease độc quyền trên thư mục luồng trước khi nhánh bắt đầu |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate, lần chạy lại, lease độc quyền và người đã yêu cầu | `requestedBy`, `lease`, `resume` | `request/request.json`, @worktrees/uat/<flow>/<case> để lấy `latest` và hồ sơ lượt chạy trước, @workspaces/be tại commit đã ghim, @tools/git | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Xác nhận admission: bề mặt sạch và cổng chất lượng xanh tại cùng một commit đã ghim | — | đầu vào `frontend-surface-audit`, đầu vào `quality-verification` | — | `ADMISSION_MISSING` |
| 3 | Preflight runtime: thông tin đăng nhập niêm phong giải được theo tên, tài khoản tồn tại, store trả lời | — | @workspaces/device-state để lấy thông tin đăng nhập mà `account.json` nêu tên, @worktrees/sessions/central-runtime để lấy generation và các origin, @tools/secrets, @tools/http | — | `PROVISIONING_UNAVAILABLE` |
| 4 | Đóng băng snapshot từ `flow.md`, `account.json` và `seed/` | `feature`, `flow`, `cases` | @worktrees/uat/<flow>/<case>, @worktrees/_templates để lấy khuôn luồng | @worktrees/uat/<flow>/<case> (snapshot), `response/data/snapshot.json`, @tools/sourcewrite | `CANONICAL_WRITE_DENIED` |
| 5 | Gieo các bản ghi đã đóng băng vào namespace lượt chạy | `runId` | `response/data/snapshot.json`, @workspaces/be | @tools/database | `FIXTURE_VIOLATION` |
| 6 | Chạy các case đã đóng băng theo thứ tự trên endpoint mà route đã ràng mang, tại commit đã ghim | — | `response/data/snapshot.json`, đầu vào `route` để lấy endpoint lượt chạy này lái theo, @worktrees/sessions/central-runtime để lấy generation đứng sau endpoint đó, @workspaces/device-state để lấy thông tin đăng nhập chỉ lúc đăng nhập, @tools/browsercontrol, @tools/websearch | — | `LEASE_INVALID`, `RUNTIME_UNAVAILABLE` |
| 7 | Capture tại từng khẳng định có tên với ô mật khẩu đã che, rồi ghép tấm sheet | — | `response/data/snapshot.json`, @worktrees/sessions/central-runtime để lấy bằng chứng runtime trực tiếp nhất | `response/data/captures/<case>.json`, `response/artifacts/<case>.png`, `response/artifacts/sheet.png`, @tools/visualize | `EVIDENCE_UNAVAILABLE` |
| 8 | Xét ba làn tách rời nhau | — | `response/data/captures/<case>.json` | `response/data/verdicts.json` | — |
| 9 | Kiểm chỉ-đọc, rồi xoá namespace lượt chạy và không gì khác | `runId` | @workspaces/be để lấy các bản ghi mang `is_uat=true` và namespace này, `response/data/verdicts.json` | @tools/database | — |
| 10 | Thêm `runs/<runId>/`, dời `latest`, rồi phát | `runId` | mọi thứ ở trên | @worktrees/uat/<flow>/<case> (runs/<runId>/ và latest), `response/response.md`, `response/response.json`, @tools/sourcewrite | — |

Một lượt bị chặn không phát hồ sơ lượt chạy nào cả, vì một hồ sơ viết nửa vời chính là thứ người đọc
sau này sẽ nhầm thành một quyết định. Lần chạy lại bắt đầu lại từ khâu kiểm, chỉ tái dùng những quan
sát có fingerprint không đổi, và ghi dưới cùng một lease; lần chạy lại không thêm admission, lease,
bằng chứng hay case nào là `NO_PROGRESS`. Lần thử thứ hai sau một lượt đã phát hành là một `runId`
mới, không bao giờ là một lần sửa lượt cũ.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `uat-flow-verification` | `response/response.md` | md | có |
| `uat-snapshot` | `response/data/snapshot.json` | data | có |
| `uat-capture` | `response/data/captures/<case>.json` | data | có |
| `uat-verdicts` | `response/data/verdicts.json` | data | có |
| `screenshot` | `response/artifacts/<case>.png` | artifact | có |
| `sheet` | `response/artifacts/sheet.png` | artifact | có |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `ADMISSION_MISSING` | terminate |
| `PROVISIONING_UNAVAILABLE` | terminate |
| `LEASE_INVALID` | terminate |
| `RUNTIME_UNAVAILABLE` | terminate |
| `EVIDENCE_UNAVAILABLE` | terminate |
| `FIXTURE_VIOLATION` | terminate |
| `CANONICAL_WRITE_DENIED` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| cả ba làn đều pass | `git.publish` |
| làn UI fail trên một node do ứng dụng sở hữu | `frontend.presentation.resolve` |
| làn hành vi fail | `backend.source.apply` |
| làn UX fail: người quyết định trải nghiệm phải thế nào, và luồng chỉ được kiểm lại sau quyết định ấy | `user` |
