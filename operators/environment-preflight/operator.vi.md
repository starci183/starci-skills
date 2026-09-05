# environment.preflight

## Việc

Chạy một lần, trước mọi chuỗi, mọi phép kiểm sẵn sàng mà một nhiệm vụ nếu không sẽ gặp từng bức
tường một — khai báo, checkout, custody danh tính, runtime, máy chủ và các phê duyệt của môi trường —
rồi trả về tất cả cùng lúc thành một báo cáo sẵn sàng có kiểu, không sửa chữa gì.

## Xong khi

Xong khi `readiness-report` mang câu trả lời ok, wall hoặc skipped cho mọi phép kiểm trong bộ từ
vựng đóng, trên mọi role được yêu cầu và mọi lớp thao tác, không phép kiểm nào trả lời wall, và biên
nhận `environment-readiness` gọi tên bản khai báo nó đã đọc bằng đường dẫn và hash.

## Mọi bức tường cùng lúc

Một nhiệm vụ phát hiện các bức tường của nó theo thứ tự thì trả giá cho từng bức riêng lẻ: một route
không ai khai, một checkout không có chính sách nhánh, một nhà cung cấp danh tính từ chối chính
credential admin của nó, một trình duyệt mà profile audit không tìm thấy, một cổng mà tiến trình
trước vẫn giữ và một lần tải lên bên ngoài không khai báo nào cho phép, mỗi thứ dừng một operator
khác nhau, cách nhau hàng giờ, và mỗi lần dừng đưa cho một người đúng một món. Operator này chạy
cùng những câu hỏi ấy trong một lượt trước khi chuỗi mở, và báo cáo mọi bức tường ở một chỗ, để người
đó dọn chúng cùng lúc và chuỗi theo sau không gặp bức nào. Một phép kiểm là một câu hỏi với một trong
ba câu trả lời: `ok`, `wall`, hoặc `skipped` khi thứ nó hỏi không thể quan sát được vì một bức tường
trước đó của cùng role đang đứng hay yêu cầu nó cần không được nêu. Một bức tường là một phát hiện có
chủ và có cách sửa; nó không bao giờ là một hành động. Bộ từ vựng của các phép kiểm là đóng và sống
trong kind dữ liệu `readiness-report`, khai triển theo các role được yêu cầu và các lớp thao tác mà
schema môi trường công bố, nên một phép kiểm không chạy sẽ lộ ra như một id thiếu, không bao giờ như
sự im lặng.

## Khai báo là thẩm quyền route duy nhất

Một route tồn tại vì một khai báo portable trong `@workspaces/projects/<project>/<role>` nói vậy, và
một route đã hydrate trong `@workspaces/local/routes/<project>/<role>` chiếu nó xuống máy này. Một thư
mục có tên na ná project, một checkout anh em, thư mục làm việc hiện tại và origin đang mở trong trình
duyệt không thiết lập gì cả, và operator này không có field nào để chứa chúng. Khi project hoặc role
được yêu cầu không có khai báo nào và đúng một khai báo khác với tên được yêu cầu chỉ bởi một dấu gạch
nối, một hậu tố hay chữ hoa chữ thường, phép kiểm khai báo là một bức tường mà phần sửa nêu khai báo
ấy dưới dạng suggested `<id>`, và `ROUTE_NAME_NEAR_MATCH` ghi cùng gợi ý ấy dưới
`## Fallbacks taken`. Bức tường vẫn đứng và tên được yêu cầu không bao giờ bị đổi, vì một cái tên được
sửa âm thầm là một route không ai khai. Các phép kiểm checkout sau đó đọc chính sách mà khai báo mang
— một route không có chính sách là một bức tường, không bao giờ là một chính sách đoán — và quan sát
nhánh cùng cây làm việc của checkout đã phân giải qua `@tools/git`: nhánh phải là một nhánh chính sách
cho phép, và bất kỳ vết bẩn nào trên nhánh mutation đều là một bức tường, vì nhánh ấy không có trạng
thái dở dang của riêng nó để chịu trách nhiệm.

## Custody danh tính được chứng minh, không bao giờ in ra

Credential admin đã niêm phong của nhà cung cấp danh tính trong môi trường được kiểm qua chính
preflight của cây, `scripts/identity-custody.mjs`, thứ ràng nhà cung cấp, realm, container và custody
đã mount trước khi bất kỳ giá trị nào được phân giải, rồi trả về một mã kết cục cố định. Bằng chứng
của phép kiểm ấy là kết cục, tên của credential và độ dài hay digest của nó; không bao giờ là giá trị,
và một phép kiểm không thể viết theo cách ấy thì không được chạy. Khi `flow` được nêu, hồ sơ tài khoản
của luồng dưới `@worktrees/uat/<flow>` phải tồn tại cho `env`, và một probe đăng nhập vào nhà cung cấp
danh tính mà entry registry của route khai phải thành công, với mật khẩu được phân giải theo tên ngay
tại lời gọi qua `@tools/secrets` và không đi tới đâu ngoài thân request. Khi không nêu luồng nào, cả
hai phép kiểm luồng đều `skipped` và nói rõ như vậy.

## Runtime và máy chủ được quan sát, không bao giờ vận hành

Registry runtime tại `@worktrees/sessions/central-runtime` giữ một entry cho mỗi `<project>/<role>`;
mỗi role được yêu cầu đọc entry của đúng route mình và không route nào khác, nên entry của một route
anh em không bao giờ trả lời thay. Entry sẵn sàng cho nhiệm vụ này khi head nó phục vụ chứa head mà
checkout của route đang đứng — có mặt trong các commit mà entry ghi là đã chứa — và các cổng mà
`@workspaces/ports/<project>` chiếu cho role trả lời một probe qua `@tools/http`. Một cổng trả lời
trong khi entry không nêu server nào, hoặc bị một tiến trình mà registry không ghi giữ, là một bức
tường với kẻ giữ làm bằng chứng và không bao giờ là giấy phép giành lại. Các phép kiểm máy chủ hỏi
liệu có một tệp nhị phân trình duyệt cho profile audit không, liệu bản cài Playwright duy nhất của
máy chủ có đứng đúng chỗ mà tool trình duyệt ở chế độ `playwright` nạp nó không — runner
`scripts/browser-walk.mjs` đọc chỗ ấy từ sổ đăng ký tool và validator của operator này đọc lại đúng
chỗ ấy, nên một báo cáo ghi `ok` trên một bản cài không tồn tại bị từ chối — liệu daemon container
trả lời một lần inspect qua `@tools/container` không, liệu dependency của mỗi checkout được cài đúng như lockfile ghi
không, và liệu một checkout nằm lồng dưới một kho khác có để `node_modules/@types` của kho ấy lọt vào
typecheck của mình không — một rò rỉ làm typecheck hỏng vì những lý do không thay đổi source nào giải
thích được. Mọi quan sát ở đây là một lệnh đã khai qua `@tools/shell` với đầu ra giữ làm bằng chứng;
không gì được khởi động, dừng, cài đặt hay giết.

## Dịch vụ được hỏi tới, không bao giờ được vận hành

Môi trường khai các dịch vụ phụ trợ nó chạy bên cạnh các route sản phẩm, và readiness hỏi mỗi cái
hai câu: bản khai báo có gọi tên nó đầy đủ không — kind, lệnh đã khai, probe, và môi trường có giữ
nó với một người không — và nó có trả lời chính probe của mình không khi bản khai báo muốn nó lên.
Một dịch vụ bản khai báo muốn xuống thì probe của nó là `skipped`, vì không có gì trả lời chính là
trạng thái đã yêu cầu. Không có gì ở đây khởi động, dừng hay cấu hình lại một dịch vụ: một bức
tường của họ này thuộc `service` và được dọn bởi operator sở hữu một dịch vụ tại một thời điểm, là
nơi bảng Kế tiếp gửi nó tới. Một môi trường không khai dịch vụ nào thì không có phép kiểm nào của
họ này, và đó là một sự thật mà các id vắng mặt nói ra chứ không phải một sự im lặng.

## Phê duyệt được đọc từ khai báo

Khai báo môi trường `.stacks/<env>/environment.json`, theo hình dạng
`readiness/initialization/stacks/environment.schema.json` đưa ra, nói ai phê duyệt từng lớp thao tác
trong môi trường này. Một phép kiểm phê duyệt cho mỗi lớp mà schema công bố ghi `declared` hay
`person`; một lớp mà khai báo bỏ qua nhận mặc định mà schema đưa ra theo giá trị `production` của nó,
nên một chuỗi biết trước khi bắt đầu rung nào của nó được khai báo trả lời và rung nào sẽ chờ một
người. Hàng Declaration của biên nhận và `declarationRef` của báo cáo mang đường dẫn của khai báo cùng
hash của các byte của nó; một khai báo thiếu hoặc không khớp schema làm mọi phép kiểm phê duyệt thành
bức tường thuộc chủ `approval`.

## Luồng attempt cụ thể

Các row của operator này được gate bởi hợp đồng attempt expected/actual dùng chung trong `scripts/attempt-gate.mjs`.

| Trạng thái quan sát | Hành động | Kiểm actual | Nhánh kế tiếp |
| --- | --- | --- | --- |
| prerequisite đã khai hợp lệ | tái dùng fingerprint và chạy probe thật | readiness item ghi value và evidence quan sát | chỉ advance khi mọi mục bắt buộc ready |
| prerequisite thiếu | ghi mọi mục thiếu; không tạo gì | mục nêu owner domain và delta cần trả | typed owner handoff, rồi vào lại khi fingerprint đổi |
| prerequisite stale, gần tên hoặc sai | từ chối readiness cache | ghi declared/observed mismatch | owner sửa; attempt mới xác minh |

## Ranh giới

Context chỉ đọc. Operator chỉ ghi `response/` của nhánh mình: `response.md`,
`response/data/readiness-report.json` và `response.json`. Nó không bao giờ sửa một khai báo, hydrate
một route, khai một chính sách, stash hay clean một cây, cấp một tài khoản, xoay một credential, khởi
động hay dừng một server hay một container, cài một dependency, đòi một cổng, hay ghi credential,
token, cookie hay mật khẩu vào biên nhận hay bất kỳ bằng chứng nào. Mọi bức tường trong báo cáo là toàn
bộ những gì nó làm về bức tường ấy; một nhánh bị chặn vẫn mang báo cáo đầy đủ, vì một báo cáo dừng ở
bức tường đầu tiên chính là chuỗi các bức tường mà operator này tồn tại để thay thế. Nó không ra quyết
định sản phẩm và không mang phán quyết nào về source.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@workspaces/projects/<project>/<role>` | khai báo route portable của mỗi role được yêu cầu, đọc theo fingerprint; thẩm quyền route duy nhất | có |
| `@workspaces/local/routes/<project>/<role>` | route đã hydrate mà máy này chiếu mỗi khai báo xuống, và checkout nó phân giải ra | có |
| `@workspaces/device-state` | định danh máy và roster credential đã niêm phong, ràng theo tên và không bao giờ đọc | có |
| `@workspaces/ports/<project>` | phép chiếu cổng mà các phép kiểm runtime dò | có |
| `@worktrees/sessions/central-runtime` | registry runtime: entry của mỗi route được yêu cầu, head nó phục vụ và những gì head ấy chứa | có |
| `@worktrees/uat/<flow>` | hồ sơ tài khoản của luồng cho `env`, chỉ đọc khi `flow` được nêu | không |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| — | operator này mở chuỗi, nên nó không tiêu thụ nhánh nào trước đó | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `project` | id | — | Project có các route, runtime và danh tính được kiểm |
| `roles` | list | `fe, be` | Các role của project ấy mà chuỗi sẽ ràng; mỗi role có phép kiểm khai báo, checkout, runtime và máy chủ riêng |
| `env` | id | dev | Môi trường có khai báo, secret và tài khoản luồng được đọc |
| `flow` | id | null | Luồng có hồ sơ tài khoản và đăng nhập được dò; null bỏ qua cả hai phép kiểm luồng |
| `runtimeRoles` | list | `[]` | Các vai mà chuỗi phục vụ, quan sát hay đi thử runtime của chúng — planner đặt sẵn mọi vai đã bind khi chuỗi có `runtime.serve`, `interface.audit` hay `uat.verify`, và không vai nào khi không có; họ runtime được kiểm cho các vai này và bỏ qua cho các vai còn lại, vì runtime là thứ một chuỗi chạm vào nó nợ, không phải thứ một checkout chỉ được bind nợ |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate và chạy lại | `resume` | `request/request.json`, phần requirements của nó và báo cáo bị chặn khi chạy lại | — | `INVALID_INPUT`, `NO_PROGRESS` |
| 2 | Kiểm các khai báo: mọi role được yêu cầu đều được khai và route đã hydrate chiếu nó, tên gần khớp được báo như gợi ý và không bao giờ được nhận | `project`, `roles` | @workspaces/projects/<project>/<role>, @workspaces/local/routes/<project>/<role> | — | `ROUTE_NAME_NEAR_MATCH` |
| 3 | Kiểm từng checkout: route mang chính sách git, cây sạch và nhánh là một nhánh chính sách cho phép | — | @workspaces/local/routes/<project>/<role>, checkout đã phân giải, nhánh và cây làm việc của nó, @tools/git | — | — |
| 4 | Kiểm custody danh tính: preflight credential admin đã niêm phong qua `scripts/identity-custody.mjs`, và khi có luồng được nêu thì hồ sơ tài khoản cùng một probe đăng nhập | `flow`, `env` | @workspaces/device-state, @worktrees/uat/<flow> cho hồ sơ tài khoản của `env`, @worktrees/sessions/central-runtime cho nhà cung cấp danh tính trong entry của mỗi route, @tools/secrets, @tools/http | — | — |
| 5 | Kiểm runtime: entry registry của mỗi route, head phục vụ có chứa head của checkout không, các cổng đã chiếu có trả lời không, và cổng nào bị tiến trình lạ giữ | `runtimeRoles` | @worktrees/sessions/central-runtime, @workspaces/ports/<project>, @tools/http, @tools/shell | — | — |
| 6 | Kiểm máy chủ: tệp nhị phân trình duyệt cho profile audit, bản cài Playwright mà runner đi thử nạp (`host.playwright`, là một bức tường với đúng lời của runner khi thiếu), daemon container tới được, dependency đã cài cho từng checkout và cách ly kiểu với thư mục tổ tiên | — | các checkout đã phân giải và lockfile của chúng, chỗ cài mà `resources/tools.json` nêu cho tool trình duyệt, @tools/shell, @tools/container | — | — |
| 7 | Kiểm phê duyệt: lớp thao tác nào khai báo môi trường đánh dấu declared hay person, lớp bị bỏ qua nhận mặc định của schema | `env` | khai báo môi trường của `env` và schema môi trường | — | — |
| 8 | Kiểm các dịch vụ đã khai: mỗi dịch vụ bản khai báo gọi tên dưới `services` là đầy đủ, và probe của nó trả lời khi bản khai báo muốn nó lên | `env` | khai báo môi trường của `env` cho các dịch vụ của nó, @tools/http, @tools/shell | — | — |
| 9 | Đối chiếu mọi prerequisite với observation, phát một report có toàn bộ mục ready, missing, invalid cùng owner delta, và block khi criterion bắt buộc chưa ready | — | mọi thứ ở trên | `response/response.md`, `response/data/readiness-report.json`, `response/response.json` | `ENVIRONMENT_NOT_READY` |

Bước 8 là bước duy nhất dừng vì một bức tường: một bức tường tìm thấy ở các bước 2 đến 7 được ghi lại
và bước kế tiếp vẫn chạy, nên báo cáo mà người đọc là đầy đủ dù phép kiểm nào hỏng trước. Một role có
khai báo là bức tường thì mọi phép kiểm khác của role ấy đều `skipped`, vì không có checkout nào để
quan sát; một luồng không được nêu thì cả hai phép kiểm luồng đều `skipped`. Chạy lại bắt đầu lại từ
bước 1 và chạy lại mọi phép kiểm; một lần vào lại mà báo cáo nêu cùng những bức tường như nhánh nó
chạy lại là `NO_PROGRESS`.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `environment-readiness` | `response/response.md` | md | có |
| `readiness-report` | `response/data/readiness-report.json` | data | có |

## Kết quả tốt nhất

In **Kết quả tốt nhất** là bảng readiness đầy đủ render từ `response/data/readiness-report.json`, kèm `response/response.md` làm phần tóm tắt. Wall hoặc check bị skip phải vẫn hiện cùng owner và evidence; chỉ trình bày môi trường sẵn sàng khi mọi dòng bắt buộc đều `ok`.

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `NO_PROGRESS` | terminate |
| `ROUTE_NAME_NEAR_MATCH` | fallback |
| `ENVIRONMENT_NOT_READY` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| mọi bức tường đã dọn và chuỗi ràng các route của nó | `workspace.bind` |
| một bức tường danh tính phải được dọn trước | `identity.provision` |
| một bức tường runtime phải được dọn trước | `runtime.serve` |
| nhiệm vụ không route source nào và một đơn vị giáo trình theo sau | `content.generate` |
| một bức tường dịch vụ phải được dọn trước, hoặc một dịch vụ nhiệm vụ cần phải được đưa lên | `service.operate` |
| một bức tường chỉ một người mới dọn được đang đứng | `user` |
