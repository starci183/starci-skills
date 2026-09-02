# Thực thi `workspace.bind`

## Một việc duy nhất

Biến một project và một role thành đúng một danh tính checkout đã xác minh, source head chính xác của
nó, và binding runtime đóng mà bên gọi được phép tiêu thụ, rồi trả tất cả về dưới dạng một receipt
route có kiểu. Đây là một lần gọi operator tuyến tính. Nó không gọi operator khác, không định tuyến
workflow, không tự dừng giữa chừng, và không trả về chỉ dẫn tự do.

Mọi thứ operator này sinh ra đều là một binding. Nó không ra quyết định sản phẩm nào, không sửa route,
không khởi tạo workspace, không cấp tài khoản, và không publish gì.

## Khai báo là thẩm quyền duy nhất

Một route tồn tại vì khai báo portable trong `.workspaces/projects/<project>/<role>.json` nói vậy, và
một route cục bộ đã hydrate chiếu nó xuống ổ đĩa của máy này. Có bốn thứ thường xuyên trông giống
route mà không phải route: một thư mục có tên trùng project, một checkout anh em nằm cạnh Source, thư
mục làm việc hiện tại, và origin đang mở trên trình duyệt.

Chúng đến qua `context.hints`, mỗi cái mang hằng `authoritative: false`, và mỗi cái được ghi lại thành
`HINT_REJECTED` thay vì được tra cứu. Việc gọi tên chúng chính là điểm mấu chốt. Một gợi ý không bao
giờ được ghi ra là một gợi ý sẽ được đi theo ngay khi route đã khai trông có vẻ bất tiện.

## Trình tự

| # | Bước | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- |
| 1 | Kiểm tra input và resume | input, `@workspaces/local/routes/<project>/<role>` (head quan sát được của Source) | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Ràng bootstrap và danh tính | `@workspaces/device-state` (danh tính máy và roster credential đã niêm phong), input (các entry bootstrap của Source, việc phát hiện agent) | — | `IDENTITY_UNVERIFIED` |
| 3 | Phân giải route | `@workspaces/projects/<project>/<role>` (khai báo portable cho đúng project và role này), `@workspaces/local/routes/<project>/<role>` (route cục bộ đã hydrate) | — | `ROUTE_UNDECLARED`, `ROUTE_UNHYDRATED`, `ROUTE_MISMATCH` |
| 4 | Từ chối mọi gợi ý | input (`context.hints`) | — | — |
| 5 | Xác minh checkout | `@workspaces/local/routes/<project>/<role>` (route đã phân giải, checkout quan sát được, chính sách Git đã route, cây làm việc) | — | `BRANCH_POLICY_VIOLATION`, `CHECKOUT_DIRTY` |
| 6 | Ràng runtime mà bên gọi tiêu thụ | `@worktrees/sessions/central-runtime` (registry của chủ sở hữu, generation và bằng chứng health của nó), `@workspaces/ports/<project>` (`workspace-route-port-projection`) | — | `ENDPOINT_AUTHORITY_STALE`, `RUNTIME_NOT_READY` |
| 7 | Ràng provenance và độ tươi | input (head hội thoại đã redact), `@dynamic/workspace-route-binding.json` (receipt đã cache) | — | — |
| 8 | Phát ra và dừng | tất cả những gì ở trên | `@dynamic/workspace-route-binding.json` | — |

Khâu kiểm tra từ chối một route khai danh tính khác, một source route mang directory, một sibling
route đi ngược lên, một route đã hydrate có workspace root ngoại lai, một quan sát của checkout khác,
một runtime được ràng mà không có nhu cầu, và một resume không đổi gì.

Không credential nào được đọc, sao chép hay ghi lại; chỉ tham chiếu roster đã niêm phong được ràng
vào, và `IDENTITY_ROSTER_SEALED` nói ra điều đó. Việc hydrate ghi `ROUTE_HYDRATED_FROM_PORTABLE` gọi
tên route cục bộ, còn một khai báo không tồn tại thì do chủ sở hữu workspace sửa, không bao giờ do
operator này sửa. Mỗi gợi ý được cấp nhận đúng một finding `HINT_REJECTED` nêu nó là gì và vì sao nó
không quyết định điều gì.

Dưới `worktreeBranches: forbidden`, mọi branch khác `mutationBranch` đều vi phạm chính sách, và route
được ràng sẽ ghi `WORKTREE_BRANCH_FORBIDDEN`. `authorityRoots.businesses` được suy ra là
`<gitRoot>/.worktrees/businesses` khi worktree đó tồn tại trên một source checkout, ngược lại là
`null`; không bao giờ nhận nó từ input, vì một gốc thẩm quyền gõ tay là cách một cây nghiệp vụ thứ
hai ra đời. Bước runtime không tính lại gì cả: fingerprint của `endpointBinding` hoặc khớp phép chiếu
đóng, hoặc lần gọi dừng lại, và chỉ giá trị chỉ-origin dạng `http://localhost:<cổng-chuẩn>` được chấp
nhận. Một head hội thoại đã redact ghi `PROVENANCE_HEAD_BOUND`, còn một receipt đã cache khớp cùng bộ
danh tính và cùng fingerprint ghi `CACHED_ROUTE_REUSED`; một receipt cache cũ hoặc hỏng là bằng
chứng, không bao giờ là thứ để sửa.

## Bên gọi tiêu thụ runtime, không bao giờ sở hữu nó

Các tiến trình FE, API và identity cục bộ dùng chung thuộc về đúng một task chủ sở hữu được uỷ nhiệm.
Operator này ràng bên gọi vào endpoint của chủ sở hữu đó với `consumerRole: "consumer"`, vốn là một
hằng. Không có output nào biểu diễn được việc bên gọi sở hữu một cổng, một PID hay một vòng đời tiến
trình.

`EADDRINUSE`, một phiên đăng nhập bất ngờ, và một probe hỏng đều là bằng chứng để báo cáo. Không cái
nào cho phép start, stop, restart, thay thế hay kill một tiến trình, và một cổng chỉ đang lắng nghe
không chứng minh được gì về sự sẵn sàng. Khi runtime chưa sẵn sàng, lần gọi bị chặn, và bên gọi phát
đúng một yêu cầu điều phối tới chủ sở hữu đã đăng ký.

## Thực thi khi resume

Một lần resume bắt đầu lại từ khâu kiểm tra, chỉ tái dùng những quan sát có fingerprint không đổi, và
tiêu thụ đúng phần delta. Một resume không thêm được thay đổi nào về route, danh tính, runtime hay
provenance sẽ trả `NO_PROGRESS`. Một route được publish lại phải đến dưới dạng fingerprint mới; cùng
một fingerprint không thể cho ra một binding khác.

## Các đòn tấn công bắt buộc

Operator không được phép ràng khi còn bất kỳ mục nào áp dụng được mà chưa xử lý:

- có gợi ý được cấp mà không finding nào ghi rằng nó không quyết định gì;
- route portable và route đã hydrate lệch nhau ở kho, branch hoặc đường dẫn;
- route đã hydrate gọi tên một Source khác Source này;
- checkout quan sát được không phải checkout mà route phân giải ra;
- head quan sát được khác head đã đóng băng;
- một route được báo là sẵn sàng sửa đổi trên branch mà chính sách không cho phép;
- một runtime được ràng trong khi generation của chủ sở hữu chưa sẵn sàng;
- một endpoint là thứ gì khác ngoài phép chiếu localhost chỉ-origin;
- một credential, token, cookie hay mật khẩu sắp lọt vào receipt hoặc bất kỳ bằng chứng nào.
