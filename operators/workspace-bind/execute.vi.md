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

## Trình tự thực thi

1. **Kiểm tra input và resume.** Áp `input.schema.json` cùng kiểm tra ngữ nghĩa. Từ chối một route
   khai danh tính khác, một source route mang directory, một sibling route đi ngược lên, một route đã
   hydrate có workspace root ngoại lai, một quan sát của checkout khác, một runtime được ràng mà
   không có nhu cầu, và một resume không đổi gì.
2. **Ràng bootstrap và danh tính.** Xác nhận các entry bootstrap và việc phát hiện agent cho Source
   này, rồi tới danh tính máy cùng roster credential đã mã hoá của nó. Danh tính chưa xác minh là
   `IDENTITY_UNVERIFIED`. Không credential nào được đọc, sao chép hay ghi lại; chỉ tham chiếu roster
   đã niêm phong được ràng vào, và `IDENTITY_ROSTER_SEALED` nói ra điều đó.
3. **Phân giải route.** Đọc khai báo portable cho đúng project và role được yêu cầu. Một khai báo
   không tồn tại là `ROUTE_UNDECLARED`; việc sửa thuộc về chủ sở hữu workspace, không bao giờ thuộc
   operator này. Hydrate nó, rồi ghi `ROUTE_HYDRATED_FROM_PORTABLE` gọi tên route cục bộ. Thiếu route
   đã hydrate là `ROUTE_UNHYDRATED`; một route đã hydrate lệch với route portable đóng ở kho, branch
   hay đường dẫn đĩa là `ROUTE_MISMATCH`.
4. **Từ chối mọi gợi ý.** Ghi một finding `HINT_REJECTED` cho từng gợi ý được cấp, nêu nó là gì và vì
   sao nó không quyết định điều gì.
5. **Xác minh checkout.** So head quan sát được với `input.frozenSourceHead`; khác nhau là
   `SOURCE_DRIFT`. Đối chiếu branch với chính sách Git đã route; dưới
   `worktreeBranches: forbidden`, mọi branch khác `mutationBranch` là `BRANCH_POLICY_VIOLATION`, và
   route được ràng sẽ ghi `WORKTREE_BRANCH_FORBIDDEN`. Xác nhận không có gì bẩn nằm ngoài write root
   đã khai, nếu không thì trả `CHECKOUT_DIRTY`. Suy ra `authorityRoots.businesses` là
   `<gitRoot>/.worktrees/businesses` khi worktree đó tồn tại trên một source checkout, ngược lại là
   `null`; không bao giờ nhận nó từ input, vì một gốc thẩm quyền gõ tay là cách một cây nghiệp vụ thứ
   hai ra đời.
6. **Ràng runtime khi bên gọi tiêu thụ nó.** Phân giải registry của chủ sở hữu, generation và bằng
   chứng health của nó. Không tính lại gì cả: fingerprint của `endpointBinding` hoặc khớp phép chiếu
   đóng `workspace-route-port-projection`, hoặc là `ENDPOINT_AUTHORITY_STALE`. Chỉ chấp nhận giá trị
   chỉ-origin dạng `http://localhost:<cổng-chuẩn>`. Một registry thiếu, cũ, `starting`, `degraded`
   hay `stopped` là `RUNTIME_NOT_READY`.
7. **Ràng provenance và độ tươi.** Gắn head hội thoại đã redact khi có, rồi ghi
   `PROVENANCE_HEAD_BOUND`. Khi một receipt đã cache khớp cùng bộ danh tính và cùng fingerprint, ghi
   `CACHED_ROUTE_REUSED`; một receipt cache cũ hoặc hỏng là bằng chứng, không bao giờ là thứ để sửa.
8. **Phát ra và dừng.** Ghi receipt route dưới `input.artifactRootRef`, phát đúng một output hợp với
   `output.schema.json`, và ràng mọi fingerprint.

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
