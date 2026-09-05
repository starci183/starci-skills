# workspace.bind

## Việc

Phân giải một project và một role thành định danh checkout đã kiểm, head source chính xác của nó, và
rồi trả về thành một biên nhận route có kiểu; runtime mà người gọi tiêu thụ là việc của chủ runtime
phục vụ và ràng.

## Xong khi

Xong khi `workspace-route-binding` cùng `route` của nó gọi tên một checkout được phân giải chỉ từ
bản khai báo và phép chiếu hydrate của nó, trên một nhánh mà chính sách được route cho phép với cây
làm việc không mang gì chính sách từ chối, tại head source quan sát được với mức sẵn sàng mutation
suy ra, và không ràng runtime nào.

## Khai báo là thẩm quyền duy nhất

Một route tồn tại vì một khai báo portable trong `@workspaces/projects/<project>/<role>` nói vậy, và
một route local đã hydrate chiếu nó xuống ổ đĩa của máy này. Bốn thứ thường trông giống route mà
không phải: một thư mục trùng tên project, một checkout anh em nằm cạnh Source, thư mục làm việc hiện
tại, và origin đang mở trong trình duyệt. Chúng là hint, không mang chút thẩm quyền nào, và operator
này không có chỗ nào để chứa: bảng Yêu cầu không khai field hint nào, nên một request mang hint sẽ
trượt gate với `INVALID_INPUT` ở bước 1 thay vì được cân nhắc. Từ chối ngay ở gate mới là điểm mấu
chốt, vì một hint sống sót vào thân của lượt chạy là một hint sẽ được nghe theo ngay khi route đã
khai trông bất tiện. Hai nửa của route phải khớp nhau về project, role, kho Git và nhánh; kiểu kho
`source` không mang thư mục và phân giải về chính gốc Source, kiểu `sibling` mang một thư mục tương
đối an toàn và phân giải bên cạnh nó, còn một route đã hydrate nêu tên một Source khác là của máy
khác và bị từ chối.

`checkout` mặc định chọn checkout đã khai. Với `session`, hai khai báo được kiểm trước, rồi
`scripts/workspace-checkout.mjs` chọn worktree duy nhất Git đã đăng ký có nhánh đúng bằng
`session/<request.sessionId>` trong cùng thư mục Git common của checkout chuẩn. Chỉ chính sách
`session-only` cho phép chọn như vậy. Không nhận đường dẫn hay tên phiên khác; helper không tạo,
chuyển hay sửa chữa gì. Checkout và source head trong route mô tả worktree đã chọn, còn
`sessionCheckout` giữ đường dẫn, nhánh, head chuẩn đã quan sát, thư mục common và định danh phiên
hiện tại. Head chuẩn là quan sát, không phải base gốc của phiên; biên nhận ghi source sở hữu base ấy.
Đăng ký thiếu, thuộc kho khác, không duy nhất hoặc không khả dụng đều bị từ chối. Biên nhận route
hiện có không bao giờ được âm thầm ràng lại.

## Route không ràng runtime nào

Một route là một checkout và một head, không phải thứ gì đang lắng nghe. Các tiến trình frontend, api
và identity local dùng chung thuộc về chủ runtime, bên phục vụ nhánh tích hợp của sản phẩm, giữ lease
cùng pid, và ràng entry mà người gọi tiêu thụ với endpoint, head đang phục vụ và những gì head đó
chứa; một operator cần một bề mặt đang phục vụ đọc entry ấy qua alias của chủ runtime, không bao giờ
qua biên nhận này. Vì vậy operator này không mang endpoint, không mang phép chiếu port, không mang
entry sổ đăng ký và không mang trạng thái runtime: `route.runtime` là null trên mọi biên nhận nó ghi,
và một binding mang runtime là đã tiêu thụ tài nguyên chung theo ý riêng. Nó không khởi động, dừng,
khởi động lại, thay thế hay giết một tiến trình, và không đòi port, PID hay vòng đời runtime nào.

## Không sửa chữa gì ở đây

Không credential nào được đọc, chép hay ghi lại; chỉ tham chiếu roster đã niêm phong được ràng, và
`IDENTITY_ROSTER_SEALED` nói đúng điều đó. Một khai báo không tồn tại thì do chủ workspace sửa, không
bao giờ do operator này, nên `ROUTE_UNDECLARED` và `ROUTE_UNHYDRATED` là kết cục dự kiến của một
workspace chưa chuẩn bị chứ không phải lỗi của request. `CHECKOUT_DIRTY` không bao giờ có fallback:
operator này không stash, không clean, không reset cây làm việc để một binding trở nên khả thi. Gốc
thẩm quyền businesses được suy ra là `<gốc git>/.worktrees/businesses` khi worktree ấy tồn tại trên
một checkout source và vắng mặt nếu không; nó không bao giờ được nhận từ người, vì một gốc thẩm quyền
do người gõ vào chính là cách cây business thứ hai ra đời. Provenance và độ tươi không phải một bước
riêng: chúng được ghi ngay trong bước phát, cạnh binding mà chúng mô tả. Head mà một route đã hydrate
ghi lại chỉ là hồ sơ của lần hydrate ấy chứ không bao giờ là thẩm quyền của route: head quan sát được
mới thắng, và một head hydrate chậm hơn checkout hai commit không phải một mã dừng.

Một nhánh bị chặn không phát biên nhận và không phát route: `response.json` là toàn bộ hồ sơ, còn
`reason` mang quan sát đã biện minh cho lần dừng.

## Luồng attempt cụ thể

Các row của operator này được gate bởi hợp đồng attempt expected/actual dùng chung trong `scripts/attempt-gate.mjs`.

| Trạng thái quan sát | Hành động | Kiểm actual | Nhánh kế tiếp |
| --- | --- | --- | --- |
| checkout đã khai hợp lệ | tái dùng đúng disk path, head, policy | đọc lại Git root, installed tree, write roots | phát binding |
| thiếu declaration hoặc hydration | không đoán path gần giống và không tạo | ghi evidence thiếu | handoff workspace owner |
| identity, head hoặc policy sai | từ chối binding cache | ghi root, revision hoặc policy xung đột | owner sửa, rồi attempt chỉ đọc mới |

## Ranh giới

Context chỉ đọc, trừ trạng thái route đã hydrate cục bộ của máy, thứ mà Git bỏ qua. Operator chỉ ghi
`response/` của nhánh mình: `response.md`, `response/data/route.json` và `response.json`. Nó không bao
giờ nhận một cái tên na ná, một thư mục anh em, thư mục làm việc hay một URL trình duyệt làm thẩm
quyền route, không bao giờ nhận một URL tự chọn, một bí danh loopback hay một port chỉ đang lắng nghe
làm endpoint, không bao giờ khởi động, dừng, khởi động lại, thay thế hay giết một tiến trình runtime
dùng chung, không bao giờ đòi port, PID hay vòng đời runtime cho một task feature, không bao giờ tạo
hay chuyển sang nhánh task, feature hay worktree dưới một chính sách worktree cấm, không bao giờ ghi
credential, token, cookie hay mật khẩu vào biên nhận hay bất kỳ bằng chứng nào, và không bao giờ sửa
một route thiếu, khởi tạo một workspace hay cấp phát một tài khoản. Nó không ra quyết định sản phẩm
và không mang phán quyết nào.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@workspaces/projects/<project>/<role>` | khai báo route portable, đọc theo fingerprint; thẩm quyền route duy nhất | có |
| `@workspaces/local/routes/<project>/<role>` | route đã hydrate mà máy này chiếu khai báo xuống, và checkout nó phân giải ra | có |
| `@workspaces/device-state` | định danh máy và roster credential đã niêm phong, ràng theo tên và không bao giờ đọc | có |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| — | operator này mở chuỗi, nên nó không tiêu thụ nhánh nào trước đó | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `project` | id | — | Project cần ràng |
| `role` | choice | — | `fe` hay `be`: vai của project ấy cần ràng |
| `checkout` | choice | routed | `routed` chọn checkout chuẩn; `session` chỉ chọn worktree đã đăng ký của chính phiên trong request theo chính sách đã khai |
| `gitPolicy` | object `{worktreeBranches, mutationBranch}`, hai trường của `repository.gitPolicy` trong khai báo route mà binding được kiểm theo | the policy the route declaration carries; a declaration that carries none is `INVALID_INPUT` at step 1, never a guessed policy | Luật nhánh mà binding này được kiểm theo; `forbidden` giữ mọi lần ghi trên nhánh mutation |
| `declaredWriteRoots` | list | empty | Những đường dẫn duy nhất mà việc sau được ghi; bẩn ngoài chúng là `CHECKOUT_DIRTY`, và bẩn bất kỳ khi checkout đang ở nhánh mutation thay vì nhánh `session/<sessionId>` cũng vậy |
| `sharedInstall` | choice | false | Cây đã cài được chia sẻ qua junction một cách có chủ đích; xoá bên trong nó là bị cấm |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate và chạy lại, và từ chối mọi hint nó mang | `resume` | `request/request.json`, phần requirements và head đóng băng của nó | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Ràng bootstrap và identity | — | @workspaces/device-state, định danh máy và roster credential đã niêm phong, @tools/secrets | — | `IDENTITY_UNVERIFIED` |
| 3 | Kiểm exact declaration và checkout, phân loại reusable, missing hoặc invalid theo identity và head, và chỉ resolve route đã khai reusable | `project`, `role`, `checkout` | @workspaces/projects/<project>/<role> đúng project và role này, @workspaces/local/routes/<project>/<role>, @tools/git | — | `ROUTE_UNDECLARED`, `ROUTE_UNHYDRATED`, `ROUTE_MISMATCH` |
| 4 | Xác minh branch policy, clean tree, write roots và installed tree; ghi exact owner delta cho check sai và không sửa ở đây | `gitPolicy`, `declaredWriteRoots`, `sharedInstall` | @workspaces/local/routes/<project>/<role>, checkout đã phân giải, nhánh, head, cây làm việc và `node_modules` của nó, @tools/git, @tools/shell | — | `BRANCH_POLICY_VIOLATION`, `CHECKOUT_DIRTY` |
| 5 | Ràng provenance và độ tươi, rồi phát | — | mọi thứ ở trên, @workspaces/device-state | `response/response.md`, `response/data/route.json`, `response/response.json` | — |

Dưới
`worktreeBranches` đặt là forbidden, một route chỉ ràng trên nhánh mutation và ghi
`WORKTREE_BRANCH_FORBIDDEN`, và khi đặt là `session-only` thì ghi `WORKTREE_BRANCH_SESSION_ONLY`, bởi
một chính sách mở ra đường ghi đúng là phát hiện mà người đọc sau đi tìm; một head hội thoại đã che ghi `PROVENANCE_HEAD_BOUND`, và một biên nhận Đặt là `session-only` thì route ràng trên nhánh mutation hoặc trên nhánh worktree
`session/<sessionId>`, hình dạng duy nhất mà operator ghi source được commit lên;
cache khớp cùng bộ định danh và fingerprint ghi `CACHED_ROUTE_REUSED`. `mutationReadiness` là `ready` khi nhánh quan sát được là nhánh mà chính sách được route cho phép ghi
lên — nhánh mutation, hoặc một nhánh `session/<sessionId>` dưới `session-only` — và cây làm việc không
mang thứ gì bước này phải từ chối; mọi trường hợp khác là `read-only`, kể cả một route ràng mà không
khai gốc ghi nào. Các gốc ghi đã khai chỉ miễn trừ vết bẩn trên một nhánh `session/<sessionId>`, nơi
đó là việc dở dang mà một phiên vốn phải có; nhánh mutation không có trạng thái dở dang nào của riêng
nó để miễn trừ, nên bất kỳ vết bẩn nào thấy ở đó — trong một gốc ghi đã khai hay ngoài nó — đều là
source được ghi mà không có phiên nào chịu trách nhiệm, và bước 4 dừng với `CHECKOUT_DIRTY` thay vì
báo một mức sẵn sàng sẽ mang vi phạm đi tiếp mà không ghi lại. Nó được suy ra ở đây và không bao giờ nhận từ request, vì một mức sẵn sàng mà người gọi khẳng
định được là một mức sẵn sàng không ai đo. Chạy lại thì bắt đầu lại từ
bước 1, chỉ dùng lại quan sát có fingerprint không đổi, và tiêu thụ đúng phần delta. Byte khai báo
thay đổi tạo fingerprint route mới; dùng lại còn đòi hỏi cùng chế độ chọn, định danh checkout được
chọn và source head đã quan sát.

Cây đã cài là một phần của việc checkout là gì, và bước 4 quan sát nó: `## Checkout` mang hàng
`Installed tree` đọc là `own directory`, `absent`, hay `junction to <target>` với đích đã phân giải. Một
junction `node_modules` có đích nằm ngoài checkout là một cây đã cài mà nhiều checkout dùng chung, nên
một lệnh xoá đệ quy bên trong checkout ấy đi xuyên qua liên kết và làm rỗng cây mà mọi checkout khác
đang dùng; binding bị từ chối với `INVALID_INPUT` trừ khi request đã khai `sharedInstall`, và một
checkout giữ junction thì không bao giờ bị xoá bằng tay — một worktree tạm được gỡ bằng
`git worktree remove --force` và không gì khác. Hàng ấy là quan sát, không phải khẳng định: validator
phản hồi đọc chính liên kết đó và so.

Lệnh chọn chỉ đọc là `node scripts/workspace-checkout.mjs <project> <role> <sessionId>
<routed|session> [declaredWriteRoot ...] [--shared-install]`. Lệnh nhận trần ghi tương đối trong kho, không nhận đường
dẫn checkout. JSON đó là quan sát checkout; operator vẫn phải ràng identity và gốc thẩm quyền
đã yêu cầu để tạo biên nhận route đầy đủ. Bước 4 kiểm cây đã chọn; chọn phiên còn yêu cầu checkout mutation chuẩn sạch.
Validator phản hồi tự chạy lại phép chọn và so các field route; gate request kiểm phép chọn phiên
trước khi dispatch và ràng id phiên vào tọa độ chứa request, trạng thái phiên và hash request đã đóng băng.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `workspace-route-binding` | `response/response.md` | md | có |
| `route` | `response/data/route.json` | data | có |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `IDENTITY_UNVERIFIED` | terminate |
| `ROUTE_UNDECLARED` | terminate |
| `ROUTE_UNHYDRATED` | terminate |
| `ROUTE_MISMATCH` | terminate |
| `BRANCH_POLICY_VIOLATION` | terminate |
| `CHECKOUT_DIRTY` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| route đã ràng và checkout mang một bản publish cần đẩy | `git.publish` |
| route đã ràng và một lời hứa phải được quyết dựa trên source của nó | `business.decide` |
| route đã ràng và một ranh giới phải được quyết bên trong nó | `architecture.decide` |
| route đã ràng và một contract backend phải được điền bên trong nó | `backend.generate` |
| route đã ràng và các trang, modal một tính năng cần phải được gọi tên trước khi mỗi nhánh sinh một cái | `interface.plan` |
| route đã ràng và product journey, actor, case cùng fixture ref phải được đóng băng trước effect identity và seed | `uat.plan` |
| route đã ràng và các seed nhiệm vụ cần phải được lên kế hoạch trên các kho của nó trước khi mỗi nhánh đặt một seed | `data.plan` |
| route đã ràng và một bề mặt frontend phải được sinh bên trong nó | `interface.generate` |
| route đã ràng và một phát hiện trên bề mặt đã sinh phải được sửa bên trong nó | `interface.fix` |
| route bind package của owner đã được giao sửa hành vi hiện có và tiêu thụ bản phát hành của nó | `library.update` |
| route đã ràng và chủ runtime phải phục vụ head của nó trước khi một bề mặt được quan sát | `runtime.serve` |
| route đã ràng và một head đã publish phải được kiểm trước khi lên | `quality.verify` |
| route đã ràng và một bề mặt đang phục vụ phải được quan sát | `interface.audit` |
